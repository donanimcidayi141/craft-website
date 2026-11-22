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
  getPanelConfig,
  resolveCanonicalPanelId,
  isPanelAllowedInMode,
  isPanelAllowedInZone,
  getDefaultRightPanelIdForMode,
  createDefaultPanelZonesForMode,
  createDefaultFloatingPanelsForMode,
} from '../data/panelRegistry.js';
import { STUDIO_MODES } from '../data/studioModesRegistry.js';
import { clampFloatingRect } from '../utils/propertySearch.js';

export const SETTINGS_STORAGE_KEY = 'craftstudio_settings_v1';
export const GEMINI_API_KEY_STORAGE_KEY = 'craft_gemini_api_key';
export const RECENT_PROJECTS_STORAGE_KEY = 'craftstudio.recentProjects.v1';
export const SAVED_PROJECTS_STORAGE_KEY = 'craftstudio.savedProjects.v1';
export const AUTOSAVE_STORAGE_KEY = 'craftstudio.autosaveDraft.v1';

export const SETTINGS_SCHEMA_VERSION = 3;
export const MIN_CENTER_WORKSPACE_WIDTH = 360;

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const DEFAULT_WORKSPACE_LAYOUTS_BY_MODE = deepFreeze({
  design: {
    presetId: DEFAULT_WORKSPACE_PRESET_ID,
    panelZones: createDefaultPanelZonesForMode('design'),
    leftDrawer: {
      activeTab: null,
      tabs: [],
      width: DEFAULT_LEFT_DRAWER_WIDTH,
    },
    rightDock: {
      isOpen: true,
      activeTab: getDefaultRightPanelIdForMode('design'),
      tabs: [getDefaultRightPanelIdForMode('design')],
      propertiesTab: 'layout',
      width: DEFAULT_RIGHT_DOCK_WIDTH,
    },
    floatingPanels: createDefaultFloatingPanelsForMode('design'),
    aiDock: { isMinimized: false },
  },
  backend: {
    presetId: DEFAULT_WORKSPACE_PRESET_ID,
    panelZones: createDefaultPanelZonesForMode('backend'),
    leftDrawer: {
      activeTab: 'flows',
      tabs: ['flows'],
      width: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
    },
    rightDock: {
      isOpen: true,
      activeTab: getDefaultRightPanelIdForMode('backend'),
      tabs: [getDefaultRightPanelIdForMode('backend')],
      propertiesTab: 'stepConfig',
      width: DEFAULT_RIGHT_DOCK_WIDTH,
    },
    floatingPanels: createDefaultFloatingPanelsForMode('backend'),
    aiDock: { isMinimized: false },
  },
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

function getAllowedRightTabsForMode(modeId) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  return new Set((STUDIO_MODES[resolvedMode]?.rightTabs || []).map((t) => t.id));
}

function sanitizeIntrinsicFloatingRect(rawRect, panelId, fallbackRect) {
  if (!rawRect || typeof rawRect !== 'object' || Array.isArray(rawRect)) {
    return { ...fallbackRect };
  }
  const panelCfg = getPanelConfig(panelId);
  const minW = panelCfg?.sizeLimits?.minWidth || 220;
  const maxW = panelCfg?.sizeLimits?.maxWidth || 960;
  const minH = panelCfg?.sizeLimits?.minHeight || 260;
  const maxH = panelCfg?.sizeLimits?.maxHeight || 880;

  const rawX = Number(rawRect.x);
  const rawY = Number(rawRect.y);
  const rawW = Number(rawRect.width);
  const rawH = Number(rawRect.height);

  return {
    x: Number.isFinite(rawX) ? Math.round(rawX) : fallbackRect.x,
    y: Number.isFinite(rawY) ? Math.round(rawY) : fallbackRect.y,
    width: Number.isFinite(rawW) && rawW > 0
      ? Math.max(minW, Math.min(maxW, Math.round(rawW)))
      : fallbackRect.width,
    height: Number.isFinite(rawH) && rawH > 0
      ? Math.max(minH, Math.min(maxH, Math.round(rawH)))
      : fallbackRect.height,
  };
}

/**
 * Clamps a mode's layout slice (dock widths AND floating panel rects) to fit within a specific
 * viewport/screen size at read/render time WITHOUT mutating the user's saved intrinsic preferences
 * in storage. Ensures at least `MIN_CENTER_WORKSPACE_WIDTH` (360px) remains for the center workspace.
 */
export function clampModeLayoutToViewport(
  modeSlice,
  { viewportWidth = null, viewportHeight = null } = {},
) {
  if (!modeSlice || typeof modeSlice !== 'object') return modeSlice;
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

  let leftWidth = Number(modeSlice.leftDrawer?.width) || DEFAULT_LEFT_DRAWER_WIDTH;
  let rightWidth = Number(modeSlice.rightDock?.width) || DEFAULT_RIGHT_DOCK_WIDTH;

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

  let nextFloatingPanels = modeSlice.floatingPanels;
  if (modeSlice.floatingPanels && typeof modeSlice.floatingPanels === 'object' && !Array.isArray(modeSlice.floatingPanels)) {
    nextFloatingPanels = {};
    for (const [panelId, floatState] of Object.entries(modeSlice.floatingPanels)) {
      if (!floatState || typeof floatState !== 'object') continue;
      const panelCfg = getPanelConfig(panelId);
      const clampedRect = floatState.rect && typeof floatState.rect === 'object'
        ? clampFloatingRect(
            floatState.rect,
            { width: effectiveViewportW, height: effectiveViewportH },
            {
              minWidth: panelCfg?.sizeLimits?.minWidth || 220,
              minHeight: panelCfg?.sizeLimits?.minHeight || 260,
            },
          )
        : floatState.rect;
      nextFloatingPanels[panelId] = {
        ...floatState,
        rect: clampedRect,
      };
    }
  }

  const out = {
    ...modeSlice,
    leftDrawer: {
      ...modeSlice.leftDrawer,
      width: leftWidth,
    },
    rightDock: {
      ...modeSlice.rightDock,
      width: rightWidth,
    },
    ...(nextFloatingPanels ? { floatingPanels: nextFloatingPanels } : {}),
  };

  if (modeSlice.floatingRect && typeof modeSlice.floatingRect === 'object') {
    out.floatingRect = clampFloatingRect(
      modeSlice.floatingRect,
      { width: effectiveViewportW, height: effectiveViewportH },
      { minWidth: 440, minHeight: 360 },
    );
  }

  return out;
}

/**
 * Sanitizes a single mode's workspace layout slice ('design' | 'backend') to the v3 multi-zone schema.
 * - Losslessly upgrades v2 slices (preserving widths, open panels, tabs, and legacy floatingRect).
 * - Silently rejects unknown panel IDs, cross-mode panel IDs, invalid zones (e.g. 'top'),
 *   or out-of-bounds dimensions with safe intrinsic defaults without crashing.
 * - Applies screen/viewport clamping ONLY when `viewportWidth` or `viewportHeight` is passed
 *   (read/render time), never overwriting intrinsic stored values.
 */
export function sanitizeModeWorkspaceLayout(
  modeId,
  rawSlice,
  { viewportWidth = null, viewportHeight = null } = {},
) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  const baseDefault = DEFAULT_WORKSPACE_LAYOUTS_BY_MODE[resolvedMode];
  const defaultRightId = getDefaultRightPanelIdForMode(resolvedMode);
  const src = rawSlice && typeof rawSlice === 'object' && !Array.isArray(rawSlice) ? rawSlice : {};

  const presetId =
    src.presetId === 'custom' || isValidWorkspacePreset(src.presetId)
      ? src.presetId
      : DEFAULT_WORKSPACE_PRESET_ID;

  // 1. Validate panelZones against mode & allowedZones
  const panelZones = createDefaultPanelZonesForMode(resolvedMode);
  if (src.panelZones && typeof src.panelZones === 'object' && !Array.isArray(src.panelZones)) {
    for (const [rawId, rawZone] of Object.entries(src.panelZones)) {
      const canonicalId = resolveCanonicalPanelId(rawId, resolvedMode);
      if (canonicalId && isPanelAllowedInMode(canonicalId, resolvedMode) && isPanelAllowedInZone(canonicalId, rawZone)) {
        panelZones[canonicalId] = rawZone;
      }
    }
  }

  // 2. Validate leftDrawer (tabs, activeTab, intrinsic width)
  const rawLeftObj =
    src.leftDrawer && typeof src.leftDrawer === 'object' && !Array.isArray(src.leftDrawer)
      ? src.leftDrawer
      : null;

  let leftTabs = [];
  if (Array.isArray(rawLeftObj?.tabs)) {
    for (const rawTab of rawLeftObj.tabs) {
      const canonicalId = resolveCanonicalPanelId(rawTab, resolvedMode);
      if (canonicalId && panelZones[canonicalId] === 'left' && !leftTabs.includes(canonicalId)) {
        leftTabs.push(canonicalId);
      }
    }
  }

  let activeTab = baseDefault.leftDrawer.activeTab;
  if (activeTab && panelZones[activeTab] !== 'left') {
    activeTab = null;
  }

  if (rawLeftObj && Object.prototype.hasOwnProperty.call(rawLeftObj, 'activeTab')) {
    if (rawLeftObj.activeTab === null) {
      activeTab = null;
      leftTabs = [];
    } else if (typeof rawLeftObj.activeTab === 'string') {
      const canonicalActive = resolveCanonicalPanelId(rawLeftObj.activeTab, resolvedMode);
      if (canonicalActive && panelZones[canonicalActive] === 'left') {
        activeTab = canonicalActive;
      } else if (leftTabs.length > 0) {
        activeTab = leftTabs[0];
      }
    } else if (leftTabs.length > 0) {
      activeTab = leftTabs[0];
    }
  } else if (leftTabs.length > 0) {
    activeTab = leftTabs[0];
  }

  if (activeTab && !leftTabs.includes(activeTab)) {
    leftTabs.push(activeTab);
  }
  if (!activeTab) {
    leftTabs = [];
  }

  const rawLeftW = Number(rawLeftObj?.width);
  const leftWidth =
    Number.isFinite(rawLeftW) && rawLeftW > 0
      ? Math.max(MIN_LEFT_DRAWER_WIDTH, Math.min(MAX_LEFT_DRAWER_WIDTH, Math.round(rawLeftW)))
      : baseDefault.leftDrawer.width;

  // 3. Validate rightDock (tabs, activeTab, isOpen, propertiesTab, intrinsic width)
  const allowedRightTabs = getAllowedRightTabsForMode(resolvedMode);
  const rawRightObj =
    src.rightDock && typeof src.rightDock === 'object' && !Array.isArray(src.rightDock)
      ? src.rightDock
      : null;

  let rightTabs = [];
  if (Array.isArray(rawRightObj?.tabs)) {
    for (const rawTab of rawRightObj.tabs) {
      const canonicalId = resolveCanonicalPanelId(rawTab, resolvedMode);
      if (canonicalId && panelZones[canonicalId] === 'right' && !rightTabs.includes(canonicalId)) {
        rightTabs.push(canonicalId);
      }
    }
  }
  if (rightTabs.length === 0 && panelZones[defaultRightId] === 'right') {
    rightTabs = [defaultRightId];
  }

  const rawRightActive = typeof rawRightObj?.activeTab === 'string'
    ? resolveCanonicalPanelId(rawRightObj.activeTab, resolvedMode)
    : null;
  const rightActiveTab =
    rawRightActive && rightTabs.includes(rawRightActive)
      ? rawRightActive
      : rightTabs[0] || null;

  const rawIsOpen =
    rawRightObj && typeof rawRightObj.isOpen === 'boolean'
      ? rawRightObj.isOpen
      : baseDefault.rightDock.isOpen;
  const isOpen = rightTabs.length > 0 ? rawIsOpen : false;

  const propertiesTab =
    rawRightObj && typeof rawRightObj.propertiesTab === 'string' && allowedRightTabs.has(rawRightObj.propertiesTab)
      ? rawRightObj.propertiesTab
      : baseDefault.rightDock.propertiesTab;

  const rawRightW = Number(rawRightObj?.width);
  const rightWidth =
    Number.isFinite(rawRightW) && rawRightW > 0
      ? Math.max(MIN_RIGHT_DOCK_WIDTH, Math.min(MAX_RIGHT_DOCK_WIDTH, Math.round(rawRightW)))
      : baseDefault.rightDock.width;

  // 4. Validate floatingPanels (and migrate legacy v2 top-level `floatingRect` into `attributesAndCss.rect`)
  const floatingPanels = createDefaultFloatingPanelsForMode(resolvedMode);
  const rawFloatMap =
    src.floatingPanels && typeof src.floatingPanels === 'object' && !Array.isArray(src.floatingPanels)
      ? src.floatingPanels
      : null;

  if (rawFloatMap) {
    for (const [rawId, rawState] of Object.entries(rawFloatMap)) {
      const canonicalId = resolveCanonicalPanelId(rawId, resolvedMode);
      if (!canonicalId || !floatingPanels[canonicalId] || !rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
        continue;
      }
      const baseFloat = floatingPanels[canonicalId];
      const allowedOpen = panelZones[canonicalId] === 'floating';
      const rawZ = Number(rawState.zIndex);
      floatingPanels[canonicalId] = {
        isOpen: allowedOpen && typeof rawState.isOpen === 'boolean' ? rawState.isOpen : false,
        isMinimized: typeof rawState.isMinimized === 'boolean' ? rawState.isMinimized : baseFloat.isMinimized,
        rect: sanitizeIntrinsicFloatingRect(rawState.rect, canonicalId, baseFloat.rect),
        zIndex: Number.isFinite(rawZ) ? Math.max(40, Math.round(rawZ)) : baseFloat.zIndex,
      };
    }
  }

  // v2 -> v3 migration: preserve legacy v2 `floatingRect` on design mode into `floatingPanels.attributesAndCss.rect`
  if (
    resolvedMode === 'design' &&
    src.floatingRect &&
    typeof src.floatingRect === 'object' &&
    !Array.isArray(src.floatingRect) &&
    !(rawFloatMap && rawFloatMap.attributesAndCss && rawFloatMap.attributesAndCss.rect)
  ) {
    const baseAttrFloat = floatingPanels.attributesAndCss;
    floatingPanels.attributesAndCss = {
      ...baseAttrFloat,
      rect: sanitizeIntrinsicFloatingRect(src.floatingRect, 'attributesAndCss', baseAttrFloat.rect),
    };
  }

  // 5. Validate aiDock
  const rawAiObj =
    src.aiDock && typeof src.aiDock === 'object' && !Array.isArray(src.aiDock) ? src.aiDock : null;
  const aiMinimized =
    rawAiObj && typeof rawAiObj.isMinimized === 'boolean'
      ? rawAiObj.isMinimized
      : baseDefault.aiDock.isMinimized;

  const sanitized = {
    presetId,
    panelZones,
    leftDrawer: {
      activeTab,
      tabs: leftTabs,
      width: leftWidth,
    },
    rightDock: {
      isOpen,
      activeTab: rightActiveTab,
      tabs: rightTabs,
      propertiesTab,
      width: rightWidth,
    },
    floatingPanels,
    aiDock: {
      isMinimized: aiMinimized,
    },
  };

  if (Number(viewportWidth) > 0 || Number(viewportHeight) > 0) {
    return clampModeLayoutToViewport(sanitized, { viewportWidth, viewportHeight });
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
