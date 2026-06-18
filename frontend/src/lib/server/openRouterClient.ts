import { getOpenRouterRuntimeConfig } from './aiSettingsService';

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterChatOptions = {
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type OpenRouterChatResult =
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

export async function chatWithOpenRouter(options: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
  const { apiKey, model } = await getOpenRouterRuntimeConfig();

  if (!apiKey) {
    return { ok: false, reason: 'no_api_key', model };
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
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 700,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: 'request_failed', model, status: response.status };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? '';

    if (!content) {
      return { ok: false, reason: 'empty_response', model: json.model ?? model };
    }

    return {
      ok: true,
      content,
      model: json.model ?? model,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'exception',
      model,
      error: error instanceof Error ? error.message : 'OpenRouter request failed',
    };
  }
}
