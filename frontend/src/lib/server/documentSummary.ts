import { getOpenRouterRuntimeConfig } from './aiSettingsService';

type SummaryResult = {
  summary: string | null;
  model: string | null;
};

function localFallbackSummary(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ');

  if (sentences) {
    return sentences.slice(0, 900);
  }

  return compact.slice(0, 900);
}

export async function summarizeDocumentForKnowledgeBase(text: string): Promise<SummaryResult> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { summary: null, model: null };
  }

  const { apiKey, model } = await getOpenRouterRuntimeConfig();

  // Keep summaries deterministic and inexpensive for document ingestion.
  if (!apiKey) {
    const fallback = localFallbackSummary(normalized);
    return { summary: fallback || null, model: 'local-fallback' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content:
              'You summarize compliance documents for tender matching. Return concise, factual summaries with key entities, dates, obligations, and risks.',
          },
          {
            role: 'user',
            content:
              'Summarize this document for a knowledge base used in AI tender matching. Include: document purpose, important dates, legal/compliance signals, and key requirements. Keep under 220 words.\n\n' +
              normalized.slice(0, 20000),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed (${response.status})`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      const fallback = localFallbackSummary(normalized);
      return { summary: fallback || null, model: 'local-fallback' };
    }

    return { summary: content.slice(0, 4000), model: json.model ?? model };
  } catch (error) {
    console.warn('OpenRouter summary generation failed, using local fallback.', error);
    const fallback = localFallbackSummary(normalized);
    return { summary: fallback || null, model: 'local-fallback' };
  }
}
