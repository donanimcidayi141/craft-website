import { migrateFlatToNestedTree, sanitizeTree, flattenTree } from './treeUtils.js';
import { createDefaultCanvasByViewport } from './responsiveUtils.js';

export const RECENT_PROJECTS_STORAGE_KEY = 'craftstudio.recentProjects.v1';
export const SAVED_PROJECTS_STORAGE_KEY = 'craftstudio.savedProjects.v1';
export const AUTOSAVE_STORAGE_KEY = 'craftstudio.autosaveDraft.v1';
export const MAX_RECENT_PROJECTS = 12;

function getSafeStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Normalizes a single tab record with responsive viewports and sanitized AST elements.
 */
export function normalizeProjectTab(tab = {}, index = 0, fallbackCanvasSettings = null) {
  const safeId = tab.id || `tab-${Date.now()}-${index + 1}`;
  const rawName = tab.name || `Sayfa-${index + 1}.craft`;
  const cleanRoute =
    tab.route ||
    (index === 0 ? '/' : `/${rawName.replace(/\.craft$/, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-')}`);
  const migratedElements = sanitizeTree(migrateFlatToNestedTree(Array.isArray(tab.elements) ? tab.elements : []));
  const byVp = tab.canvasByViewport
    ? {
        desktop: { ...createDefaultCanvasByViewport().desktop, ...(tab.canvasByViewport.desktop || {}) },
        tablet: { ...createDefaultCanvasByViewport().tablet, ...(tab.canvasByViewport.tablet || {}) },
        mobile: { ...createDefaultCanvasByViewport().mobile, ...(tab.canvasByViewport.mobile || {}) },
      }
    : createDefaultCanvasByViewport(tab.canvasSettings || fallbackCanvasSettings || {});

  return {
    id: safeId,
    name: rawName,
    route: cleanRoute,
    elements: migratedElements,
    canvasByViewport: byVp,
    initializedViewports: tab.initializedViewports || {
      desktop: true,
      tablet: Boolean(tab.canvasByViewport?.tablet),
      mobile: Boolean(tab.canvasByViewport?.mobile),
    },
  };
}

/**
 * Builds the canonical `craft.project.json` schema object ready to save or export.
 */
export function buildSerializableProjectSchema(options = {}) {
  const {
    id = `proj-${Date.now()}`,
    name = 'Yeni Web Projesi',
    filePath = null,
    tabs = [],
    activeTabId = null,
    viewportMode = 'desktop',
    projectFunctions = [],
    pageLinks = [],
    createdAt = null,
  } = options;

  const normalizedTabs = (Array.isArray(tabs) && tabs.length > 0 ? tabs : [normalizeProjectTab({}, 0)]).map((t, idx) =>
    normalizeProjectTab(t, idx)
  );
  const resolvedActiveTab = normalizedTabs.find((t) => t.id === activeTabId)?.id || normalizedTabs[0].id;
  const activeTabObj = normalizedTabs.find((t) => t.id === resolvedActiveTab) || normalizedTabs[0];
  const nowIso = new Date().toISOString();

  return {
    schemaVersion: '1.1.0',
    studio: 'CraftStudio',
    generator: 'CraftStudio v2.1 Project Engine',
    id,
    name: String(name || 'Yeni Web Projesi').trim() || 'Yeni Web Projesi',
    filePath: filePath || undefined,
    createdAt: createdAt || nowIso,
    updatedAt: nowIso,
    viewportMode: ['desktop', 'tablet', 'mobile'].includes(viewportMode) ? viewportMode : 'desktop',
    activeTabId: resolvedActiveTab,
    canvasSettings: activeTabObj.canvasByViewport?.desktop || createDefaultCanvasByViewport().desktop,
    canvasByViewport: activeTabObj.canvasByViewport,
    tabs: normalizedTabs,
    projectFunctions: Array.isArray(projectFunctions) ? projectFunctions : [],
    pageLinks: Array.isArray(pageLinks) ? pageLinks : [],
  };
}

/**
 * Parses and migrates any supported `.craft.json` / exported project JSON format into clean runtime state.
 */
export function parseAndMigrateLoadedProject(rawInput) {
  let parsed = rawInput;
  if (typeof rawInput === 'string') {
    parsed = JSON.parse(rawInput);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Geçersiz proje verisi.');
  }

  // Case 1: Array of tabs
  if (Array.isArray(parsed)) {
    const migratedTabs = parsed.map((t, idx) => normalizeProjectTab(t, idx));
    return buildSerializableProjectSchema({
      name: 'İçe Aktarılan Proje',
      tabs: migratedTabs,
      activeTabId: migratedTabs[0]?.id,
    });
  }

  // Case 2: Standard CraftStudio project with tabs[]
  if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
    const sharedCanvas = parsed.canvasByViewport || parsed.canvasSettings || null;
    const migratedTabs = parsed.tabs.map((t, idx) =>
      normalizeProjectTab(
        {
          ...t,
          canvasByViewport: t.canvasByViewport || (idx === 0 ? sharedCanvas : null),
        },
        idx,
        parsed.canvasSettings
      )
    );
    return buildSerializableProjectSchema({
      id: parsed.id || `proj-${Date.now()}`,
      name: parsed.name || 'Yüklenen Proje',
      filePath: parsed.filePath || null,
      createdAt: parsed.createdAt,
      viewportMode: parsed.viewportMode || 'desktop',
      activeTabId: parsed.activeTabId || migratedTabs[0]?.id,
      tabs: migratedTabs,
      projectFunctions: Array.isArray(parsed.projectFunctions) ? parsed.projectFunctions : [],
      pageLinks: Array.isArray(parsed.pageLinks) ? parsed.pageLinks : [],
    });
  }

  // Case 3: Single-page legacy JSON (`elements[]`)
  if (Array.isArray(parsed.elements)) {
    const singleTab = normalizeProjectTab(
      {
        id: 'tab-imported',
        name: parsed.name ? `${parsed.name}.craft` : 'Anasayfa.craft',
        elements: parsed.elements,
        canvasByViewport: parsed.canvasByViewport,
        canvasSettings: parsed.canvasSettings,
      },
      0
    );
    return buildSerializableProjectSchema({
      id: parsed.id || `proj-${Date.now()}`,
      name: parsed.name || 'Yüklenen Proje',
      filePath: parsed.filePath || null,
      createdAt: parsed.createdAt,
      tabs: [singleTab],
      activeTabId: singleTab.id,
      projectFunctions: Array.isArray(parsed.projectFunctions) ? parsed.projectFunctions : [],
      pageLinks: Array.isArray(parsed.pageLinks) ? parsed.pageLinks : [],
    });
  }

  throw new Error('Bu JSON dosyası geçerli bir CraftStudio projesi içermiyor.');
}

export function countProjectElements(tabs = []) {
  return (tabs || []).reduce((acc, tab) => acc + flattenTree(tab.elements || []).length, 0);
}

export function formatSavedDateLabel(isoDate) {
  if (!isoDate) return 'Yeni';
  try {
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return String(isoDate);
    const diffMs = Date.now() - dt.getTime();
    if (diffMs < 60 * 1000) return 'Az önce';
    if (diffMs < 24 * 60 * 60 * 1000 && new Date().getDate() === dt.getDate()) {
      return `Bugün ${dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(isoDate);
  }
}

export function loadRecentProjects(customStorage = null) {
  const storage = getSafeStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function upsertRecentProject(projectSchema, customStorage = null) {
  const storage = getSafeStorage(customStorage);
  const current = loadRecentProjects(storage);
  const activeTab = (projectSchema.tabs || []).find((t) => t.id === projectSchema.activeTabId) || projectSchema.tabs?.[0];
  const desktopSize = activeTab?.canvasByViewport?.desktop || projectSchema.canvasSettings || { width: 1280, height: 1350 };

  const summaryEntry = {
    id: projectSchema.id,
    name: projectSchema.name,
    filePath: projectSchema.filePath || null,
    updatedAt: projectSchema.updatedAt || new Date().toISOString(),
    date: formatSavedDateLabel(projectSchema.updatedAt),
    elementsCount: countProjectElements(projectSchema.tabs),
    tabsCount: (projectSchema.tabs || []).length,
    functionsCount: (projectSchema.projectFunctions || []).length,
    width: desktopSize.width || 1280,
    height: desktopSize.height || 1350,
    // Keep full snapshot cached for instant restore even in browser mode
    snapshot: projectSchema,
  };

  const filtered = current.filter((item) => {
    if (projectSchema.filePath && item.filePath && item.filePath === projectSchema.filePath) return false;
    return item.id !== projectSchema.id;
  });
  const nextList = [summaryEntry, ...filtered].slice(0, MAX_RECENT_PROJECTS);

  if (storage) {
    try {
      storage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // Fallback: strip snapshots if quota exceeded and keep lightweight entries
      const slimList = nextList.map(({ snapshot, ...rest }) => rest);
      try {
        storage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(slimList));
      } catch {
        // Ignore quota error silently
      }
    }
  }
  return nextList;
}

export function removeRecentProject(projectId, customStorage = null) {
  const storage = getSafeStorage(customStorage);
  const current = loadRecentProjects(storage);
  const next = current.filter((item) => item.id !== projectId);
  if (storage) {
    try {
      storage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function saveProjectToWebStorage(projectSchema, customStorage = null) {
  const storage = getSafeStorage(customStorage);
  if (!storage) return false;
  try {
    const rawMap = storage.getItem(SAVED_PROJECTS_STORAGE_KEY);
    const map = rawMap ? JSON.parse(rawMap) : {};
    map[projectSchema.id] = projectSchema;
    storage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function saveAutosaveDraft(projectSchema, customStorage = null) {
  const storage = getSafeStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(projectSchema));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosaveDraft(customStorage = null) {
  const storage = getSafeStorage(customStorage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    return parseAndMigrateLoadedProject(raw);
  } catch {
    return null;
  }
}

export function triggerBrowserJsonDownload(projectSchema) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
  const safeFile = String(projectSchema.name || 'craftstudio-proje')
    .toLowerCase()
    .replace(/[^a-z0-9-_ğüşıöç]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'craftstudio-proje';
  const blob = new Blob([JSON.stringify(projectSchema, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFile}.craft.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
