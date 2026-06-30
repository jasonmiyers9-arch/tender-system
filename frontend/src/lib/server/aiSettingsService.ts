import { getFirestore, isFirestoreAvailable } from './firebaseAdmin';

const SETTINGS_COLLECTION = 'app_settings';
const AI_SETTINGS_DOC = 'ai_provider';

// Default Claude model served through the Netlify AI Gateway. Strong multimodal
// reasoning for reading tender/compliance PDFs while staying cost-effective.
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

// Models that are no longer valid for this provider. Legacy Gemini values (from
// before the switch to Claude) and retired Claude snapshots are remapped to a
// current equivalent so stored/admin/env values never break the app.
const RETIRED_MODEL_REMAP: Record<string, string> = {
  'gemini-2.0-flash': DEFAULT_ANTHROPIC_MODEL,
  'gemini-2.0-flash-001': DEFAULT_ANTHROPIC_MODEL,
  'gemini-1.5-flash': DEFAULT_ANTHROPIC_MODEL,
  'gemini-1.5-flash-latest': DEFAULT_ANTHROPIC_MODEL,
  'gemini-1.5-pro': DEFAULT_ANTHROPIC_MODEL,
  'gemini-1.5-pro-latest': DEFAULT_ANTHROPIC_MODEL,
  'gemini-2.5-flash': DEFAULT_ANTHROPIC_MODEL,
  'gemini-2.5-pro': DEFAULT_ANTHROPIC_MODEL,
  'gemini-pro': DEFAULT_ANTHROPIC_MODEL,
};

type StoredAiSettings = {
  anthropicApiKey?: string;
  anthropicModel?: string;
  updatedAt?: string;
  updatedBy?: string;
  // Legacy fields kept for backwards-compatible reads of older documents.
  geminiApiKey?: string;
  geminiModel?: string;
};

let memoryAiSettings: StoredAiSettings = {};

function sanitizeModel(model: string | null | undefined): string {
  const value = (model ?? '').trim();
  if (!value) return DEFAULT_ANTHROPIC_MODEL;
  // Any leftover Gemini model id falls back to the default Claude model.
  if (/^gemini/i.test(value)) return RETIRED_MODEL_REMAP[value] ?? DEFAULT_ANTHROPIC_MODEL;
  return RETIRED_MODEL_REMAP[value] ?? value;
}

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '********';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

async function readStoredAiSettings(): Promise<StoredAiSettings> {
  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    const snapshot = await db.collection(SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC).get();
    if (!snapshot.exists) return {};
    return snapshot.data() as StoredAiSettings;
  }

  return memoryAiSettings;
}

// Resolve the Anthropic API key. Order: admin-stored key → standard
// ANTHROPIC_API_KEY (set by the user or injected by Netlify AI Gateway) →
// alternative env names the user may have used when adding their Claude key.
function resolveAnthropicKey(stored: StoredAiSettings): string | null {
  return (
    stored.anthropicApiKey?.trim() ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.Claude_API_Key ||
    null
  );
}

function resolveAnthropicModel(stored: StoredAiSettings): string {
  return sanitizeModel(stored.anthropicModel || stored.geminiModel || process.env.ANTHROPIC_MODEL);
}

// Base URL for the Anthropic SDK. Netlify AI Gateway injects ANTHROPIC_BASE_URL;
// when the user supplies their own key, this is unset and the SDK uses the
// default Anthropic endpoint.
function resolveAnthropicBaseUrl(): string | null {
  return process.env.ANTHROPIC_BASE_URL || null;
}

function settingsSource(stored: StoredAiSettings): 'admin' | 'env' | 'none' {
  if (stored.anthropicApiKey) return 'admin';
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.Claude_API_Key) return 'env';
  return 'none';
}

export async function getAiSettingsPublic() {
  const stored = await readStoredAiSettings();
  const effectiveKey = resolveAnthropicKey(stored);
  const effectiveModel = resolveAnthropicModel(stored);

  return {
    provider: 'anthropic' as const,
    hasApiKey: Boolean(effectiveKey),
    apiKeyMasked: maskKey(effectiveKey),
    model: effectiveModel,
    updatedAt: stored.updatedAt ?? null,
    source: settingsSource(stored),
  };
}

export async function getAiRuntimeConfig(): Promise<{ apiKey: string | null; model: string; baseURL: string | null }> {
  const stored = await readStoredAiSettings();
  return {
    apiKey: resolveAnthropicKey(stored),
    model: resolveAnthropicModel(stored),
    baseURL: resolveAnthropicBaseUrl(),
  };
}

export async function upsertAiSettings(payload: {
  apiKey?: string | null;
  model?: string | null;
  updatedBy: string;
}) {
  const existing = await readStoredAiSettings();
  const updates: StoredAiSettings = {
    ...existing,
    updatedAt: new Date().toISOString(),
    updatedBy: payload.updatedBy,
  };

  if (payload.apiKey !== undefined) {
    const key = (payload.apiKey ?? '').trim();
    updates.anthropicApiKey = key || undefined;
  }

  if (payload.model !== undefined) {
    updates.anthropicModel = sanitizeModel(payload.model);
  }

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC).set(updates, { merge: true });
  } else {
    memoryAiSettings = updates;
  }

  return getAiSettingsPublic();
}
