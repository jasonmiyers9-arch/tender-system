import { getFirestore, isFirestoreAvailable } from './firebaseAdmin';

const SETTINGS_COLLECTION = 'app_settings';
const AI_SETTINGS_DOC = 'ai_provider';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// Models retired by the Generative Language API. generateContent returns
// 404 NOT_FOUND for these even though ListModels may still echo them back.
// Remap to a current equivalent so stored/admin/env values don't break the app.
const RETIRED_MODEL_REMAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-flash-latest': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-pro-latest': 'gemini-2.5-pro',
  'gemini-pro': 'gemini-2.5-flash',
};

type StoredAiSettings = {
  geminiApiKey?: string;
  geminiModel?: string;
  updatedAt?: string;
  updatedBy?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
};

let memoryAiSettings: StoredAiSettings = {};

function sanitizeModel(model: string | null | undefined): string {
  const value = (model ?? '').trim();
  if (!value) return DEFAULT_GEMINI_MODEL;
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

function resolveGeminiKey(stored: StoredAiSettings): string | null {
  return stored.geminiApiKey?.trim() || stored.openRouterApiKey?.trim() || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || null;
}

function resolveGeminiModel(stored: StoredAiSettings): string {
  return sanitizeModel(stored.geminiModel || stored.openRouterModel || process.env.GEMINI_MODEL || process.env.OPENROUTER_MODEL);
}

export async function getAiSettingsPublic() {
  const stored = await readStoredAiSettings();
  const effectiveKey = resolveGeminiKey(stored);
  const effectiveModel = resolveGeminiModel(stored);

  return {
    hasGeminiKey: Boolean(effectiveKey),
    geminiKeyMasked: maskKey(effectiveKey),
    geminiModel: effectiveModel,
    updatedAt: stored.updatedAt ?? null,
    source: stored.geminiApiKey || stored.openRouterApiKey ? 'admin' as const : process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY ? 'env' as const : 'none' as const,
  };
}

export async function getAiRuntimeConfig(): Promise<{ apiKey: string | null; model: string }> {
  const stored = await readStoredAiSettings();
  return {
    apiKey: resolveGeminiKey(stored),
    model: resolveGeminiModel(stored),
  };
}

export async function upsertAiSettings(payload: {
  geminiApiKey?: string | null;
  geminiModel?: string | null;
  updatedBy: string;
}) {
  const existing = await readStoredAiSettings();
  const updates: StoredAiSettings = {
    ...existing,
    updatedAt: new Date().toISOString(),
    updatedBy: payload.updatedBy,
  };

  if (payload.geminiApiKey !== undefined) {
    const key = (payload.geminiApiKey ?? '').trim();
    updates.geminiApiKey = key || undefined;
    updates.openRouterApiKey = key || undefined;
  }

  if (payload.geminiModel !== undefined) {
    const model = sanitizeModel(payload.geminiModel);
    updates.geminiModel = model;
    updates.openRouterModel = model;
  }

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC).set(updates, { merge: true });
  } else {
    memoryAiSettings = updates;
  }

  return getAiSettingsPublic();
}
