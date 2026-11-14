/**
 * CraftStudio Yerel Ayar Deposu (React bağımsız, saf JS)
 * - Mevcut localStorage anahtarlarıyla tam geriye uyumludur:
 *   - Gemini API anahtarı: `craft_gemini_api_key`
 *   - Son projeler listesi: `craftstudio.recentProjects.v1`
 *   - Kayıtlı proje verileri: `craftstudio.savedProjects.v1` (kesinlikle silinmez)
 *   - Otomatik taslak: `craftstudio.autosaveDraft.v1`
 * - Yeni tercihler yalnızca `craftstudio_settings_v1` JSON anahtarında tutulur.
 */

export const SETTINGS_STORAGE_KEY = 'craftstudio_settings_v1';
export const GEMINI_API_KEY_STORAGE_KEY = 'craft_gemini_api_key';
export const RECENT_PROJECTS_STORAGE_KEY = 'craftstudio.recentProjects.v1';
export const SAVED_PROJECTS_STORAGE_KEY = 'craftstudio.savedProjects.v1';
export const AUTOSAVE_STORAGE_KEY = 'craftstudio.autosaveDraft.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  defaultModel: 'gemini-3-flash-preview',
  defaultDevice: 'desktop',
  showAmbientBg: true,
  reduceMotion: false,
});

const listeners = new Set();
let windowStorageBound = false;

function resolveStorage(customStorage = null) {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function normalizeDevice(value) {
  return value === 'mobile' ? 'mobile' : 'desktop';
}

/**
 * Eski sürümlerden gelen veya bozuk ayar JSON'larını güvenli varsayılana dönüştürür.
 */
export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }

  // Eski sürümlerden olası alan adlarını (v0) v1 şemasına taşı
  const migratedModel =
    typeof raw.defaultModel === 'string' && raw.defaultModel.trim()
      ? raw.defaultModel.trim()
      : typeof raw.model === 'string' && raw.model.trim()
        ? raw.model.trim()
        : DEFAULT_SETTINGS.defaultModel;

  const migratedDevice = normalizeDevice(raw.defaultDevice ?? raw.device);

  return {
    version: 1,
    defaultModel: migratedModel,
    defaultDevice: migratedDevice,
    showAmbientBg:
      typeof raw.showAmbientBg === 'boolean'
        ? raw.showAmbientBg
        : typeof raw.ambientBackground === 'boolean'
          ? raw.ambientBackground
          : DEFAULT_SETTINGS.showAmbientBg,
    reduceMotion:
      typeof raw.reduceMotion === 'boolean'
        ? raw.reduceMotion
        : DEFAULT_SETTINGS.reduceMotion,
  };
}

export function getSettings(customStorage = null) {
  const storage = resolveStorage(customStorage);
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const rawText = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawText) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(rawText);
    return migrateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function notifySubscribers(customStorage = null) {
  const snapshot = {
    settings: getSettings(customStorage),
    apiKey: getApiKey(customStorage),
  };
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Dinleyici hataları diğer aboneleri etkilememeli
    }
  }
}

function ensureWindowStorageListener() {
  if (windowStorageBound || typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (
      event.key === SETTINGS_STORAGE_KEY ||
      event.key === GEMINI_API_KEY_STORAGE_KEY ||
      event.key === RECENT_PROJECTS_STORAGE_KEY ||
      event.key === null
    ) {
      notifySubscribers();
    }
  });
  windowStorageBound = true;
}

export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  ensureWindowStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateSettings(patch = {}, customStorage = null) {
  const storage = resolveStorage(customStorage);
  const current = getSettings(storage);
  const next = migrateSettings({
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {}),
    version: 1,
  });

  if (storage) {
    try {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Depolama kotası hatasını yoksay
    }
  }
  notifySubscribers(storage);
  return next;
}

export function getApiKey(customStorage = null) {
  const storage = resolveStorage(customStorage);
  if (!storage) return '';
  try {
    const val = storage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    return val ? String(val).trim() : '';
  } catch {
    return '';
  }
}

/**
 * Gemini API anahtarını doğrular:
 * - Baş/son boşlukları kırpar, içinde boşluk veya satır sonu varsa REDDEDER.
 * - "AIza" veya 39 karakter olmayanlarda yalnızca UYARI döndürür (reddetmez).
 */
export function validateApiKeyInput(rawKey) {
  const str = String(rawKey ?? '');
  const trimmed = str.trim();

  if (!trimmed) {
    return { valid: false, trimmed: '', error: 'API anahtarı boş olamaz.' };
  }

  if (/[\s\r\n]/.test(trimmed)) {
    return {
      valid: false,
      trimmed: '',
      error: 'API anahtarı boşluk veya satır sonu karakteri içeremez.',
    };
  }

  let warning = null;
  if (!trimmed.startsWith('AIza') || trimmed.length !== 39) {
    warning =
      'Bilgi: Standart Gemini anahtarları genellikle "AIza" ile başlar ve 39 karakter uzunluğundadır. Yine de kaydedildi.';
  }

  return { valid: true, trimmed, error: null, warning };
}

export function setApiKey(rawKey, customStorage = null) {
  const check = validateApiKeyInput(rawKey);
  if (!check.valid) {
    return { ok: false, error: check.error, warning: null };
  }

  const storage = resolveStorage(customStorage);
  if (storage) {
    try {
      storage.setItem(GEMINI_API_KEY_STORAGE_KEY, check.trimmed);
    } catch {
      return { ok: false, error: 'Tarayıcı depolamasına yazılamadı.', warning: null };
    }
  }

  notifySubscribers(storage);
  return { ok: true, warning: check.warning, apiKey: check.trimmed };
}

export function clearApiKey(customStorage = null) {
  const storage = resolveStorage(customStorage);
  if (storage) {
    try {
      storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    } catch {
      // Depolama hatasını yoksay
    }
  }
  notifySubscribers(storage);
  return true;
}

/**
 * API anahtarını arayüzde güvenli şekilde maskeler (`AIza••••••••xxxx`).
 */
export function maskApiKey(key) {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 4) return '••••';
  const last4 = clean.slice(-4);
  if (clean.length <= 8) return `••••${last4}`;
  const prefix = clean.slice(0, 4);
  return `${prefix}••••••••${last4}`;
}

/**
 * Verilen hata veya log metninde ham API anahtarı parçası varsa temizler.
 */
export function redactApiKeyFromText(text, key = '') {
  let out = String(text ?? '');
  const cleanKey = String(key || '').trim();
  if (cleanKey && out.includes(cleanKey)) {
    out = out.split(cleanKey).join('[GİZLİ]');
  }
  out = out.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[GİZLİ]');
  return out;
}

/**
 * Verilen API anahtarıyla Gemini Models uç noktasına hafif doğrulama isteği atar.
 * Anahtar her zaman x-goog-api-key başlığıyla gönderilir; URL query'de taşınmaz.
 */
export async function testGeminiKey(
  rawKey,
  { fetchImpl = typeof fetch === 'function' ? fetch : null, signal = null, timeoutMs = 10000 } = {},
) {
  const check = validateApiKeyInput(rawKey);
  if (!check.valid) {
    return { ok: false, status: 0, message: check.error };
  }
  if (!fetchImpl) {
    return { ok: false, status: 0, message: 'Ağ istemcisi kullanılamıyor.' };
  }

  const controller = new AbortController();
  let timedOut = false;
  let externallyAborted = false;

  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      return { ok: false, status: 0, aborted: true, message: 'Bağlantı testi iptal edildi.' };
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      method: 'GET',
      headers: {
        'x-goog-api-key': check.trimmed,
      },
      signal: controller.signal,
    });

    if (res.status === 200) {
      return { ok: true, status: 200, message: 'Bağlantı başarılı' };
    }
    if (res.status === 400 || res.status === 403) {
      return { ok: false, status: res.status, message: 'Anahtar geçersiz veya yetkisiz' };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, message: 'Kota aşıldı, biraz sonra dene' };
    }
    return {
      ok: false,
      status: res.status,
      message: `Sunucu beklenmeyen yanıt verdi (HTTP ${res.status})`,
    };
  } catch (err) {
    if (externallyAborted) {
      return { ok: false, status: 0, aborted: true, message: 'Bağlantı testi iptal edildi.' };
    }
    const msg = timedOut || err?.name === 'AbortError'
      ? 'Bağlanılamadı, internet bağlantını kontrol et'
      : 'Bağlanılamadı, internet bağlantını kontrol et';
    return {
      ok: false,
      status: 0,
      message: redactApiKeyFromText(msg, check.trimmed),
    };
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Yalnızca kayıtsız otomatik taslağı siler (kayıtlı projelere ve son listeye dokunmaz).
 */
export function discardAutosaveDraft(customStorage = null) {
  const storage = resolveStorage(customStorage);
  if (!storage) return false;
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(AUTOSAVE_STORAGE_KEY);
    } else {
      storage.setItem(AUTOSAVE_STORAGE_KEY, '');
    }
    notifySubscribers(storage);
    return true;
  } catch {
    return false;
  }
}

/**
 * Yalnızca "Son Projelerim" listesini temizler; craftstudio.savedProjects.v1 içine DOKUNMAZ.
 */
export function clearRecentProjectsList(customStorage = null) {
  const storage = resolveStorage(customStorage);
  if (!storage) return false;
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(RECENT_PROJECTS_STORAGE_KEY);
    } else {
      storage.setItem(RECENT_PROJECTS_STORAGE_KEY, '[]');
    }
    notifySubscribers(storage);
    return true;
  } catch {
    return false;
  }
}

/**
 * Yalnızca craftstudio_settings_v1 ayarlarını sıfırlar.
 * İsteğe bağlı olarak API anahtarını da silebilir; proje verilerine asla dokunmaz.
 */
export function resetLocalSettings(customStorage = null, { includeApiKey = false } = {}) {
  const storage = resolveStorage(customStorage);
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(SETTINGS_STORAGE_KEY);
    } else {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (includeApiKey && typeof storage.removeItem === 'function') {
      storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Depolama hatasını yoksay
  }
  notifySubscribers(storage);
  return { ...DEFAULT_SETTINGS };
}
