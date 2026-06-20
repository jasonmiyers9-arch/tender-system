import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAiRuntimeConfig } from './aiSettingsService';

type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiChatOptions = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
};

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

function toGeminiContents(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
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
      contents: toGeminiContents(conversationMessages),
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
      error: error instanceof Error ? error.message : 'Gemini request failed',
    };
  }
}

export async function chatWithOpenRouter(options: AiChatOptions): Promise<AiChatResult> {
  return chatWithGemini(options);
}
