/**
 * CraftStudio Yerel Ayar Deposu (React bağımsız, saf JS)
 * - Mevcut localStorage anahtarlarıyla tam geriye uyumludur:
 *   - Gemini API anahtarı: `craft_gemini_api_key`
 *   - Son projeler listesi: `craftstudio.recentProjects.v1`
 *   - Kayıtlı proje verileri: `craftstudio.savedProjects.v1` (kesinlikle silinmez)
 *   - Otomatik taslak: `craftstudio.autosaveDraft.v1`
 * - Yeni tercihler yalnızca `craftstudio_settings_v1` JSON anahtarında tutulur.
 */

import {
  DEFAULT_LEFT_DRAWER_WIDTH,
  DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
  MIN_LEFT_DRAWER_WIDTH,
  MAX_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  DEFAULT_RIGHT_DOCK_WIDTH,
  MIN_RIGHT_DOCK_WIDTH,
  MAX_RIGHT_DOCK_WIDTH,
  RIGHT_RAIL_WIDTH,
  DEFAULT_WORKSPACE_PRESET_ID,
  isValidWorkspacePreset,
  getLeftPanelsForMode,
} from '../data/panelRegistry.js';
import { STUDIO_MODES } from '../data/studioModesRegistry.js';
import { clampFloatingRect } from '../utils/propertySearch.js';

export const SETTINGS_STORAGE_KEY = 'craftstudio_settings_v1';
export const GEMINI_API_KEY_STORAGE_KEY = 'craft_gemini_api_key';
export const RECENT_PROJECTS_STORAGE_KEY = 'craftstudio.recentProjects.v1';
export const SAVED_PROJECTS_STORAGE_KEY = 'craftstudio.savedProjects.v1';
export const AUTOSAVE_STORAGE_KEY = 'craftstudio.autosaveDraft.v1';

export const SETTINGS_SCHEMA_VERSION = 2;
export const MIN_CENTER_WORKSPACE_WIDTH = 360;

export const DEFAULT_WORKSPACE_LAYOUTS_BY_MODE = Object.freeze({
  design: Object.freeze({
    presetId: DEFAULT_WORKSPACE_PRESET_ID,
    leftDrawer: Object.freeze({ activeTab: null, width: DEFAULT_LEFT_DRAWER_WIDTH }),
    rightDock: Object.freeze({ isOpen: true, propertiesTab: 'layout', width: DEFAULT_RIGHT_DOCK_WIDTH }),
    aiDock: Object.freeze({ isMinimized: false }),
  }),
  backend: Object.freeze({
    presetId: DEFAULT_WORKSPACE_PRESET_ID,
    leftDrawer: Object.freeze({ activeTab: 'flows', width: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH }),
    rightDock: Object.freeze({ isOpen: true, propertiesTab: 'stepConfig', width: DEFAULT_RIGHT_DOCK_WIDTH }),
    aiDock: Object.freeze({ isMinimized: false }),
  }),
});

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_SCHEMA_VERSION,
  defaultModel: 'gemini-3-flash-preview',
  defaultDevice: 'desktop',
  showAmbientBg: true,
  reduceMotion: false,
  workspaceLayoutsByMode: DEFAULT_WORKSPACE_LAYOUTS_BY_MODE,
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

function getAllowedLeftTabsForMode(modeId) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  const tabs = new Set(getLeftPanelsForMode(resolvedMode).map((p) => p.id));
  tabs.add('ai');
  return tabs;
}

function getAllowedRightTabsForMode(modeId) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  return new Set((STUDIO_MODES[resolvedMode]?.rightTabs || []).map((t) => t.id));
}

/**
 * Sanitizes a single mode's workspace layout slice ('design' | 'backend').
 * Silently replaces unknown panel IDs, invalid types, or out-of-bounds/off-screen dimensions
 * with safe defaults so app startup never crashes on corrupt or legacy storage.
 */
export function sanitizeModeWorkspaceLayout(
  modeId,
  rawSlice,
  { viewportWidth = null, viewportHeight = null } = {},
) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  const baseDefault = DEFAULT_WORKSPACE_LAYOUTS_BY_MODE[resolvedMode];
  const src = rawSlice && typeof rawSlice === 'object' && !Array.isArray(rawSlice) ? rawSlice : {};

  const presetId =
    src.presetId === 'custom' || isValidWorkspacePreset(src.presetId)
      ? src.presetId
      : DEFAULT_WORKSPACE_PRESET_ID;

  // Validate leftDrawer.activeTab against mode's allowed left panels
  const allowedLeftTabs = getAllowedLeftTabsForMode(resolvedMode);
  const rawLeftObj =
    src.leftDrawer && typeof src.leftDrawer === 'object' && !Array.isArray(src.leftDrawer)
      ? src.leftDrawer
      : null;
  let activeTab = baseDefault.leftDrawer.activeTab;
  if (rawLeftObj && Object.prototype.hasOwnProperty.call(rawLeftObj, 'activeTab')) {
    if (rawLeftObj.activeTab === null) {
      activeTab = null;
    } else if (typeof rawLeftObj.activeTab === 'string' && allowedLeftTabs.has(rawLeftObj.activeTab)) {
      activeTab = rawLeftObj.activeTab;
    }
  }

  // Validate rightDock.isOpen and rightDock.propertiesTab
  const allowedRightTabs = getAllowedRightTabsForMode(resolvedMode);
  const rawRightObj =
    src.rightDock && typeof src.rightDock === 'object' && !Array.isArray(src.rightDock)
      ? src.rightDock
      : null;
  const isOpen =
    rawRightObj && typeof rawRightObj.isOpen === 'boolean'
      ? rawRightObj.isOpen
      : baseDefault.rightDock.isOpen;
  const propertiesTab =
    rawRightObj && typeof rawRightObj.propertiesTab === 'string' && allowedRightTabs.has(rawRightObj.propertiesTab)
      ? rawRightObj.propertiesTab
      : baseDefault.rightDock.propertiesTab;

  // Validate & clamp leftDrawer.width and rightDock.width within panel limits and viewport width
  const rawLeftW = Number(rawLeftObj?.width);
  let leftWidth =
    Number.isFinite(rawLeftW) && rawLeftW > 0
      ? Math.max(MIN_LEFT_DRAWER_WIDTH, Math.min(MAX_LEFT_DRAWER_WIDTH, Math.round(rawLeftW)))
      : baseDefault.leftDrawer.width;

  const rawRightW = Number(rawRightObj?.width);
  let rightWidth =
    Number.isFinite(rawRightW) && rawRightW > 0
      ? Math.max(MIN_RIGHT_DOCK_WIDTH, Math.min(MAX_RIGHT_DOCK_WIDTH, Math.round(rawRightW)))
      : baseDefault.rightDock.width;

  const effectiveViewportW =
    Number(viewportWidth) > 0
      ? Number(viewportWidth)
      : typeof window !== 'undefined' && Number(window.innerWidth) > 0
        ? Number(window.innerWidth)
        : 1440;
  const effectiveViewportH =
    Number(viewportHeight) > 0
      ? Number(viewportHeight)
      : typeof window !== 'undefined' && Number(window.innerHeight) > 0
        ? Number(window.innerHeight)
        : 920;

  const maxRightForScreen = Math.max(
    MIN_RIGHT_DOCK_WIDTH,
    Math.min(MAX_RIGHT_DOCK_WIDTH, Math.floor(effectiveViewportW * 0.48)),
  );
  const maxLeftForScreen = Math.max(
    MIN_LEFT_DRAWER_WIDTH,
    Math.min(MAX_LEFT_DRAWER_WIDTH, Math.floor(effectiveViewportW * 0.45)),
  );
  rightWidth = Math.min(rightWidth, maxRightForScreen);
  leftWidth = Math.min(leftWidth, maxLeftForScreen);

  const maxCombinedDocksW = Math.max(
    MIN_LEFT_DRAWER_WIDTH + MIN_RIGHT_DOCK_WIDTH,
    effectiveViewportW - LEFT_RAIL_WIDTH - RIGHT_RAIL_WIDTH - MIN_CENTER_WORKSPACE_WIDTH,
  );
  if (leftWidth + rightWidth > maxCombinedDocksW) {
    let overflow = leftWidth + rightWidth - maxCombinedDocksW;
    const shrinkRight = Math.min(overflow, Math.max(0, rightWidth - MIN_RIGHT_DOCK_WIDTH));
    rightWidth -= shrinkRight;
    overflow -= shrinkRight;
    if (overflow > 0) {
      const shrinkLeft = Math.min(overflow, Math.max(0, leftWidth - MIN_LEFT_DRAWER_WIDTH));
      leftWidth -= shrinkLeft;
    }
  }

  const rawAiObj =
    src.aiDock && typeof src.aiDock === 'object' && !Array.isArray(src.aiDock) ? src.aiDock : null;
  const aiMinimized =
    rawAiObj && typeof rawAiObj.isMinimized === 'boolean'
      ? rawAiObj.isMinimized
      : baseDefault.aiDock.isMinimized;

  const sanitized = {
    presetId,
    leftDrawer: {
      activeTab,
      width: leftWidth,
    },
    rightDock: {
      isOpen,
      propertiesTab,
      width: rightWidth,
    },
    aiDock: {
      isMinimized: aiMinimized,
    },
  };

  if (src.floatingRect && typeof src.floatingRect === 'object' && !Array.isArray(src.floatingRect)) {
    sanitized.floatingRect = clampFloatingRect(
      src.floatingRect,
      { width: effectiveViewportW, height: effectiveViewportH },
      { minWidth: 440, minHeight: 360 },
    );
  }

  return sanitized;
}

export function sanitizeWorkspaceLayoutsByMode(rawLayouts, options = {}) {
  const src =
    rawLayouts && typeof rawLayouts === 'object' && !Array.isArray(rawLayouts) ? rawLayouts : {};
  return {
    design: sanitizeModeWorkspaceLayout('design', src.design, options),
    backend: sanitizeModeWorkspaceLayout('backend', src.backend, options),
  };
}

/**
 * Eski sürümlerden (v0, v1) gelen veya bozuk ayar JSON'larını güvenli v2 şemasına dönüştürür.
 */
export function migrateSettings(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_SETTINGS,
      workspaceLayoutsByMode: sanitizeWorkspaceLayoutsByMode(null, options),
    };
  }

  // Eski sürümlerden olası alan adlarını (v0 / v1) v2 şemasına taşı
  const migratedModel =
    typeof raw.defaultModel === 'string' && raw.defaultModel.trim()
      ? raw.defaultModel.trim()
      : typeof raw.model === 'string' && raw.model.trim()
        ? raw.model.trim()
        : DEFAULT_SETTINGS.defaultModel;

  const migratedDevice = normalizeDevice(raw.defaultDevice ?? raw.device);

  // v1 kaydında tekil workspaceLayout varsa design dilimine göç ettir
  const rawLayoutsSource =
    raw.workspaceLayoutsByMode && typeof raw.workspaceLayoutsByMode === 'object'
      ? raw.workspaceLayoutsByMode
      : raw.layoutsByMode && typeof raw.layoutsByMode === 'object'
        ? raw.layoutsByMode
        : raw.workspaceLayout && typeof raw.workspaceLayout === 'object'
          ? { design: raw.workspaceLayout }
          : null;

  return {
    version: SETTINGS_SCHEMA_VERSION,
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
    workspaceLayoutsByMode: sanitizeWorkspaceLayoutsByMode(rawLayoutsSource, options),
  };
}

export function getSettings(customStorage = null, options = {}) {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return {
      ...DEFAULT_SETTINGS,
      workspaceLayoutsByMode: sanitizeWorkspaceLayoutsByMode(null, options),
    };
  }
  try {
    const rawText = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawText) {
      return {
        ...DEFAULT_SETTINGS,
        workspaceLayoutsByMode: sanitizeWorkspaceLayoutsByMode(null, options),
      };
    }
    const parsed = JSON.parse(rawText);
    return migrateSettings(parsed, options);
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      workspaceLayoutsByMode: sanitizeWorkspaceLayoutsByMode(null, options),
    };
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

export function updateSettings(patch = {}, customStorage = null, options = {}) {
  const storage = resolveStorage(customStorage);
  const current = getSettings(storage, options);
  const next = migrateSettings(
    {
      ...current,
      ...(patch && typeof patch === 'object' ? patch : {}),
      version: SETTINGS_SCHEMA_VERSION,
    },
    options,
  );

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

export function getWorkspaceLayoutsByMode(customStorage = null, options = {}) {
  return getSettings(customStorage, options).workspaceLayoutsByMode;
}

export function saveWorkspaceLayoutsByMode(layoutsByMode, customStorage = null, options = {}) {
  const sanitized = sanitizeWorkspaceLayoutsByMode(layoutsByMode, options);
  updateSettings({ workspaceLayoutsByMode: sanitized }, customStorage, options);
  return sanitized;
}

export function resetWorkspaceLayoutsInSettings(modeId = null, customStorage = null, options = {}) {
  const current = getWorkspaceLayoutsByMode(customStorage, options);
  const next =
    modeId === 'design' || modeId === 'backend'
      ? {
          ...current,
          [modeId]: sanitizeModeWorkspaceLayout(modeId, DEFAULT_WORKSPACE_LAYOUTS_BY_MODE[modeId], options),
        }
      : sanitizeWorkspaceLayoutsByMode(DEFAULT_WORKSPACE_LAYOUTS_BY_MODE, options);
  updateSettings({ workspaceLayoutsByMode: next }, customStorage, options);
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
