import { chatWithOpenRouter } from './openRouterClient';

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

  const response = await chatWithOpenRouter({
    temperature: 0.2,
    maxTokens: 500,
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
  });

  if (!response.ok) {
    if (response.reason !== 'no_api_key') {
      console.warn('Gemini summary generation failed, using local fallback.', response);
    }
    const fallback = localFallbackSummary(normalized);
    return { summary: fallback || null, model: 'local-fallback' };
  }

  return { summary: response.content.slice(0, 4000), model: response.model };
}
