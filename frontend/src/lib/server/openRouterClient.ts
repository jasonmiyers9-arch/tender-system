import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAiRuntimeConfig } from './aiSettingsService';

type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// A binary attachment (PDF page image, scan, photo) sent inline to the model
// so it can read documents directly — layout, stamps, and scanned pages that
// text extraction cannot recover. `data` must be base64-encoded.
export type AiAttachment = {
  mimeType: string;
  data: string;
};

type AiChatOptions = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  attachments?: AiAttachment[];
};

type GeminiTextPart = { text: string };
type GeminiInlinePart = { inlineData: { mimeType: string; data: string } };
type GeminiPart = GeminiTextPart | GeminiInlinePart;
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export type AiChatResult =
  | {
      ok: true;
      content: string;
      model: string;
    }
  | {
      ok: false;
      reason: 'no_api_key' | 'empty_response' | 'request_failed' | 'exception';
      model: string;
      status?: number;
      error?: string;
    };

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const candidate = error as { status?: unknown; response?: { status?: unknown } };
    if (typeof candidate.status === 'number') return candidate.status;
    if (typeof candidate.response?.status === 'number') return candidate.response.status;
  }
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/(?:\[|\b)(400|401|403|404|429|500|502|503)(?:\b|\s)/);
  return match ? Number(match[1]) : undefined;
}

export function describeAiFailure(result: Extract<AiChatResult, { ok: false }>): string {
  if (result.reason === 'no_api_key') return 'Gemini API key is not configured.';
  if (result.reason === 'empty_response') return 'Gemini returned an empty response.';
  if (result.status === 401 || result.status === 403) {
    return 'Gemini rejected the API key. Check that the key belongs to a project with the Generative Language API enabled.';
  }
  if (result.status === 404) return `The configured Gemini model (${result.model}) is unavailable for this API key.`;
  if (result.status === 429) {
    return 'Gemini quota is exhausted. Confirm that billing is linked to the same Google project as this API key.';
  }
  if (result.status && result.status >= 500) return 'Gemini is temporarily unavailable. Try again shortly.';
  return `Gemini request failed${result.status ? ` (${result.status})` : ''}. Check the API key, model, and project billing configuration.`;
}

function splitMessages(messages: AiMessage[]) {
  const systemMessages: string[] = [];
  const conversationMessages = messages.reduce<Array<{ role: 'user' | 'assistant'; content: string }>>((acc, message) => {
    if (message.role === 'system') {
      systemMessages.push(message.content);
      return acc;
    }
    acc.push({ role: message.role, content: message.content });
    return acc;
  }, []);

  return {
    systemInstruction: systemMessages.join('\n\n').trim(),
    conversationMessages,
  };
}

function toGeminiContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  attachments?: AiAttachment[],
): GeminiContent[] {
  const contents: GeminiContent[] = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  if (attachments?.length) {
    // Attach binary parts to the most recent user turn so the model reads the
    // document alongside the instruction. Create a user turn if none exists.
    let target = [...contents].reverse().find((content) => content.role === 'user');
    if (!target) {
      target = { role: 'user', parts: [] };
      contents.push(target);
    }
    for (const attachment of attachments) {
      target.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    }
  }

  return contents;
}

async function chatWithGemini(options: AiChatOptions): Promise<AiChatResult> {
  const { apiKey, model } = await getAiRuntimeConfig();

  if (!apiKey) {
    return { ok: false, reason: 'no_api_key', model };
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const modelClient = client.getGenerativeModel({
      model,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 700,
      },
    });

    const { systemInstruction, conversationMessages } = splitMessages(options.messages);
    const response = await modelClient.generateContent({
      contents: toGeminiContents(conversationMessages, options.attachments),
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    const content = response.response.text().trim();
    if (!content) {
      return { ok: false, reason: 'empty_response', model };
    }

    return {
      ok: true,
      content,
      model,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'exception',
      model,
      status: errorStatus(error),
      error: error instanceof Error ? error.message : 'Gemini request failed',
    };
  }
}

export async function chatWithOpenRouter(options: AiChatOptions): Promise<AiChatResult> {
  return chatWithGemini(options);
}
