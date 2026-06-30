import Anthropic from '@anthropic-ai/sdk';
import { getAiRuntimeConfig } from './aiSettingsService';

type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// A binary attachment (PDF, scan, photo) sent inline to the model so it can read
// documents directly — layout, stamps, tables, and scanned pages that plain text
// extraction cannot recover. `data` must be base64-encoded. Claude reads PDFs
// natively (text + rendered pages) and images.
export type AiAttachment = {
  mimeType: string;
  data: string;
};

type AiChatOptions = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  attachments?: AiAttachment[];
  // Hard ceiling for the underlying Anthropic request, in milliseconds. Must stay
  // comfortably below the hosting function's execution limit so a slow model
  // response surfaces as a catchable timeout (graceful fallback) instead of the
  // serverless function being killed and returning a bare 500.
  timeoutMs?: number;
};

// Default per-request timeout. Netlify functions on the Pro plan allow up to 26s
// (set via `export const maxDuration = 26` on each AI route); keeping the model
// request under that lets the SDK abort and fall back cleanly. Override with
// AI_REQUEST_TIMEOUT_MS when running where a longer budget is available.
const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 20_000;

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

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

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
  if (result.reason === 'no_api_key') return 'The Claude (Anthropic) API key is not configured.';
  if (result.reason === 'empty_response') return 'Claude returned an empty response.';
  if (/timed?\s*out|timeout|aborted/i.test(result.error ?? '')) {
    return 'Claude took too long to respond and the request timed out. Try again, or use a smaller document.';
  }
  if (result.status === 401 || result.status === 403) {
    return 'Claude rejected the API key. Check that the Anthropic API key (or Netlify AI Gateway) is valid for this project.';
  }
  if (result.status === 404) return `The configured Claude model (${result.model}) is unavailable for this API key.`;
  if (result.status === 429) {
    return 'Claude rate limit reached. Wait a moment and try again, or reduce the request size.';
  }
  if (result.status && result.status >= 500) return 'Claude is temporarily unavailable. Try again shortly.';
  return `Claude request failed${result.status ? ` (${result.status})` : ''}. Check the API key, model, and account configuration.`;
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

function normalizeImageMediaType(mimeType: string): Anthropic.Base64ImageSource['media_type'] | null {
  const value = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
  return SUPPORTED_IMAGE_MEDIA_TYPES.has(value)
    ? (value as Anthropic.Base64ImageSource['media_type'])
    : null;
}

// Converts an attachment into a Claude content block. PDFs become native
// document blocks (Claude reads text + rendered pages); supported images become
// image blocks. Anything else is dropped.
function attachmentToBlock(attachment: AiAttachment): Anthropic.ContentBlockParam | null {
  const mime = attachment.mimeType.toLowerCase();
  if (mime === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: attachment.data },
    };
  }
  const imageMediaType = normalizeImageMediaType(mime);
  if (imageMediaType) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: imageMediaType, data: attachment.data },
    };
  }
  return null;
}

function toAnthropicMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  attachments?: AiAttachment[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const attachmentBlocks = (attachments ?? [])
    .map(attachmentToBlock)
    .filter((block): block is Anthropic.ContentBlockParam => block !== null);

  if (attachmentBlocks.length) {
    // Attach binary parts to the most recent user turn so the model reads the
    // document alongside the instruction. Create a user turn if none exists.
    let targetIndex = -1;
    for (let i = result.length - 1; i >= 0; i -= 1) {
      if (result[i].role === 'user') {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      result.push({ role: 'user', content: [...attachmentBlocks] });
    } else {
      const target = result[targetIndex];
      const existing: Anthropic.ContentBlockParam[] =
        typeof target.content === 'string'
          ? [{ type: 'text', text: target.content }]
          : [...target.content];
      // Place documents/images before the instruction text so the model reads
      // them first, mirroring how a human reviews the file then the question.
      result[targetIndex] = { ...target, content: [...attachmentBlocks, ...existing] };
    }
  }

  return result;
}

export async function chatWithOpenRouter(options: AiChatOptions): Promise<AiChatResult> {
  const { apiKey, model, baseURL } = await getAiRuntimeConfig();

  // With Netlify AI Gateway, ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL are injected at
  // runtime and picked up by the SDK even when no explicit key is resolved here.
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || null;
  if (!resolvedKey) {
    return { ok: false, reason: 'no_api_key', model };
  }

  try {
    const client = new Anthropic({
      apiKey: resolvedKey,
      // Don't let the SDK silently retry a slow/failed call — on a time-boxed
      // serverless function the retries would blow past the execution limit and
      // the function would be killed (a bare 500) before any retry could help.
      maxRetries: 0,
      ...(baseURL ? { baseURL } : {}),
    });

    const { systemInstruction, conversationMessages } = splitMessages(options.messages);
    const message = await client.messages.create(
      {
        model,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.2,
        ...(systemInstruction ? { system: systemInstruction } : {}),
        messages: toAnthropicMessages(conversationMessages, options.attachments),
      },
      { timeout: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS },
    );

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!content) {
      return { ok: false, reason: 'empty_response', model };
    }

    return { ok: true, content, model };
  } catch (error) {
    return {
      ok: false,
      reason: 'exception',
      model,
      status: errorStatus(error),
      error: error instanceof Error ? error.message : 'Claude request failed',
    };
  }
}
