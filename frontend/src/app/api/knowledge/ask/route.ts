import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, getDocumentById, ensureUserCompanyContext } from '@/lib/server/firestoreService';
import { getOpenRouterRuntimeConfig } from '@/lib/server/aiSettingsService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

const FALLBACK_MODEL = 'openai/gpt-oss-120b:free';

function localAnswer(question: string, extractedText: string | null | undefined): string {
  const source = (extractedText ?? '').trim();
  if (!source) {
    return 'No extracted text is available for this document yet. Upload a PDF with AI extraction enabled to ask document-grounded questions.';
  }

  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);

  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matched = lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 8);
  if (matched.length === 0) {
    return 'I could not find a direct match in the extracted text. Try a more specific question about dates, requirements, amounts, or obligations.';
  }

  return matched.join('\n');
}

export async function POST(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const question = String(body.question ?? '').trim();
  const documentId = String(body.documentId ?? '').trim();

  if (!question) {
    return NextResponse.json({ detail: 'question is required' }, { status: 400 });
  }

  if (!documentId) {
    return NextResponse.json({ detail: 'documentId is required' }, { status: 400 });
  }

  let activeCompanyId = user.activeCompanyId;
  if (!activeCompanyId) {
    const companies = await listCompaniesForUser(user.id);
    activeCompanyId = companies[0]?.id ?? null;
  }
  if (!activeCompanyId) {
    const ensured = await ensureUserCompanyContext(user.id);
    activeCompanyId = ensured?.id ?? null;
  }
  if (!activeCompanyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const document = await getDocumentById(documentId);
  if (!document || document.companyId !== activeCompanyId) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  const extractedText = document.extractedText?.trim() || '';
  const summary = document.aiSummary?.trim() || '';

  const runtime = await getOpenRouterRuntimeConfig();
  const apiKey = runtime.apiKey;
  const model = FALLBACK_MODEL;

  if (!apiKey) {
    return NextResponse.json({
      answer: localAnswer(question, extractedText),
      model: 'local-fallback',
      source: 'fallback',
    });
  }

  try {
    const contextText = [
      summary ? `AI Summary:\n${summary}` : '',
      extractedText ? `Extracted Text:\n${extractedText.slice(0, 24000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const completion = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You are a compliance document assistant. Answer strictly from the provided document context. If context is insufficient, say so clearly.',
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nDocument context:\n${contextText || 'No extracted context available.'}`,
          },
        ],
      }),
    });

    if (!completion.ok) {
      throw new Error(`OpenRouter request failed (${completion.status})`);
    }

    const json = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({
        answer: localAnswer(question, extractedText),
        model: 'local-fallback',
        source: 'fallback',
      });
    }

    return NextResponse.json({
      answer,
      model: json.model ?? model,
      source: 'openrouter',
    });
  } catch (error) {
    console.warn('Knowledge ask fallback:', error);
    return NextResponse.json({
      answer: localAnswer(question, extractedText),
      model: 'local-fallback',
      source: 'fallback',
    });
  }
}
