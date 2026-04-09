import { getFirestore, isFirestoreAvailable } from './firebaseAdmin';

const SETTINGS_COLLECTION = 'app_settings';
const AI_SETTINGS_DOC = 'ai_provider';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

type StoredAiSettings = {
  openRouterApiKey?: string;
  openRouterModel?: string;
  updatedAt?: string;
  updatedBy?: string;
};

let memoryAiSettings: StoredAiSettings = {};

function sanitizeModel(model: string | null | undefined): string {
  const value = (model ?? '').trim();
  return value || DEFAULT_OPENROUTER_MODEL;
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

export async function getAiSettingsPublic() {
  const stored = await readStoredAiSettings();
  const envModel = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const envKey = process.env.OPENROUTER_API_KEY ?? null;

  const effectiveKey = stored.openRouterApiKey?.trim() || envKey;
  const effectiveModel = sanitizeModel(stored.openRouterModel || envModel);

  return {
    hasOpenRouterKey: Boolean(effectiveKey),
    openRouterKeyMasked: maskKey(effectiveKey),
    openRouterModel: effectiveModel,
    updatedAt: stored.updatedAt ?? null,
    source: stored.openRouterApiKey ? 'admin' as const : envKey ? 'env' as const : 'none' as const,
  };
}

export async function getOpenRouterRuntimeConfig(): Promise<{ apiKey: string | null; model: string }> {
  const stored = await readStoredAiSettings();
  const apiKey = stored.openRouterApiKey?.trim() || process.env.OPENROUTER_API_KEY || null;
  const model = sanitizeModel(stored.openRouterModel || process.env.OPENROUTER_MODEL);
  return { apiKey, model };
}

export async function upsertAiSettings(payload: {
  openRouterApiKey?: string | null;
  openRouterModel?: string | null;
  updatedBy: string;
}) {
  const existing = await readStoredAiSettings();
  const updates: StoredAiSettings = {
    ...existing,
    updatedAt: new Date().toISOString(),
    updatedBy: payload.updatedBy,
  };

  if (payload.openRouterApiKey !== undefined) {
    const key = (payload.openRouterApiKey ?? '').trim();
    updates.openRouterApiKey = key || undefined;
  }

  if (payload.openRouterModel !== undefined) {
    updates.openRouterModel = sanitizeModel(payload.openRouterModel);
  }

  if (isFirestoreAvailable()) {
    const db = getFirestore()!;
    await db.collection(SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC).set(updates, { merge: true });
  } else {
    memoryAiSettings = updates;
  }

  return getAiSettingsPublic();
}
