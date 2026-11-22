/**
 * Single source of truth for CraftStudio workspace panels and workspace layout presets.
 * Both `studioModesRegistry.js` and `useWorkspaceLayout.js` read panel definitions,
 * allowed zones, size limits, mode filters, and preset configurations from this module.
 */

export const DEFAULT_LEFT_DRAWER_WIDTH = 248;
export const DEFAULT_BACKEND_LEFT_DRAWER_WIDTH = 256;
export const MIN_LEFT_DRAWER_WIDTH = 220;
export const MAX_LEFT_DRAWER_WIDTH = 440;
export const MIN_AI_LEFT_DRAWER_WIDTH = 296;
export const LEFT_RAIL_WIDTH = 52;
export const DEFAULT_RIGHT_DOCK_WIDTH = 336;
export const MIN_RIGHT_DOCK_WIDTH = 296;
export const MAX_RIGHT_DOCK_WIDTH = 540;
export const RIGHT_RAIL_WIDTH = 40;

export const VALID_PANEL_ZONES = Object.freeze(['left', 'right', 'floating', 'bottomCenter']);
export const MOVABLE_PANEL_ZONES = Object.freeze(['left', 'right', 'floating']);

export const PANEL_REGISTRY = Object.freeze({
  // --- DESIGN MODE PANELS ---
  properties: {
    id: 'properties',
    menuPanelId: 'properties',
    title: 'Özellikler & Tasarım',
    menuLabel: 'Özellikler & Hizalama',
    icon: 'Sliders',
    menuIcon: 'Sliders',
    modes: ['design'],
    defaultZone: 'right',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: true,
    defaultSubTab: 'layout',
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: false,
    showInWindowMenu: true,
    menuOrder: 10,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_RIGHT_DOCK_WIDTH,
      maxWidth: MAX_RIGHT_DOCK_WIDTH,
      defaultWidth: DEFAULT_RIGHT_DOCK_WIDTH,
      minHeight: 360,
      maxHeight: 880,
      defaultHeight: 600,
    },
    target: { area: 'rightDock', panelId: 'properties' },
  },

  layers: {
    id: 'layers',
    menuPanelId: 'layers',
    title: 'Katmanlar & DOM Ağacı',
    menuLabel: 'Katmanlar (Layers)',
    icon: 'Layers',
    menuIcon: 'Layers',
    modes: ['design'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 10,
    showInWindowMenu: true,
    menuOrder: 30,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_LEFT_DRAWER_WIDTH,
      minHeight: 280,
      maxHeight: 820,
      defaultHeight: 480,
    },
    target: { area: 'leftDrawer', tabId: 'layers', activeMatchTabs: ['layers'], panelId: 'layers' },
  },

  templates: {
    id: 'templates',
    menuPanelId: 'assets',
    title: 'Şablonlar & Hazır Bloklar',
    menuLabel: 'Assetler & Şablonlar',
    icon: 'LayoutTemplate',
    menuIcon: 'Box',
    modes: ['design'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 20,
    showInWindowMenu: true,
    menuOrder: 20,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_LEFT_DRAWER_WIDTH,
      minHeight: 320,
      maxHeight: 840,
      defaultHeight: 520,
    },
    target: {
      area: 'leftDrawer',
      tabId: 'templates',
      activeMatchTabs: ['templates', 'elements'],
      panelId: 'templates',
    },
  },

  elements: {
    id: 'elements',
    menuPanelId: null,
    title: 'HTML Etiketleri',
    menuLabel: null,
    icon: 'Tag',
    menuIcon: 'Tag',
    modes: ['design'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 30,
    showInWindowMenu: false,
    menuOrder: 35,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_LEFT_DRAWER_WIDTH,
      minHeight: 280,
      maxHeight: 760,
      defaultHeight: 460,
    },
    target: { area: 'leftDrawer', tabId: 'elements', activeMatchTabs: ['elements'], panelId: 'elements' },
  },

  code: {
    id: 'code',
    menuPanelId: null,
    title: 'Canlı Kod (JSX & CSS)',
    menuLabel: null,
    icon: 'Code2',
    menuIcon: 'Code2',
    modes: ['design'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 40,
    showInWindowMenu: false,
    menuOrder: 45,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_LEFT_DRAWER_WIDTH,
      minHeight: 300,
      maxHeight: 800,
      defaultHeight: 480,
    },
    target: { area: 'leftDrawer', tabId: 'code', activeMatchTabs: ['code'], panelId: 'code' },
  },

  ai: {
    id: 'ai',
    menuPanelId: null,
    title: 'AI Tasarım Asistanı',
    menuLabel: null,
    icon: 'Sparkles',
    menuIcon: 'Sparkles',
    modes: ['design', 'backend'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftDrawerModes: ['design'],
    leftOrder: 50,
    showInWindowMenu: false,
    menuOrder: 55,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_AI_LEFT_DRAWER_WIDTH,
      maxWidth: 480,
      defaultWidth: MIN_AI_LEFT_DRAWER_WIDTH,
      minHeight: 360,
      maxHeight: 840,
      defaultHeight: 540,
    },
    target: { area: 'leftDrawer', tabId: 'ai', activeMatchTabs: ['ai'], panelId: 'ai' },
  },

  aiAgent: {
    id: 'aiAgent',
    menuPanelId: 'aiAgent',
    title: 'AI Sohbet Çubuğu',
    menuLabel: 'AI Sohbet Çubuğu',
    icon: 'Sparkles',
    menuIcon: 'Sparkles',
    modes: ['design', 'backend'],
    defaultZone: 'bottomCenter',
    allowedZones: ['bottomCenter'],
    defaultOpen: true,
    canFloat: false,
    canMinimize: true,
    canClose: true,
    shortcutHint: 'Ctrl+K',
    showInLeftDrawer: false,
    showInWindowMenu: true,
    menuOrder: 40,
    dividerBefore: false,
    sizeLimits: {
      minWidth: 320,
      maxWidth: 620,
      defaultWidth: 620,
      minHeight: 48,
      maxHeight: 320,
      defaultHeight: 64,
    },
    target: { area: 'aiDock', panelId: 'aiAgent' },
  },

  attributesAndCss: {
    id: 'attributesAndCss',
    menuPanelId: 'attributesAndCss',
    title: 'CSS & Nitelik Penceresi',
    menuLabel: 'Yüzen CSS & Nitelik Penceresi',
    icon: 'Tag',
    menuIcon: 'Tag',
    modes: ['design'],
    defaultZone: 'floating',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: false,
    showInWindowMenu: true,
    menuOrder: 50,
    dividerBefore: true,
    sizeLimits: {
      minWidth: 440,
      maxWidth: 960,
      defaultWidth: 760,
      minHeight: 360,
      maxHeight: 860,
      defaultHeight: 560,
    },
    target: { area: 'modal', modalKey: 'attributesInspector', panelId: 'attributesAndCss' },
  },

  // --- BACKEND MODE PANELS ---
  backendInspector: {
    id: 'backendInspector',
    menuPanelId: 'backendInspector',
    title: 'Akış & Veri Özellikleri',
    menuLabel: 'Akış & Adım Özellikleri',
    icon: 'Sliders',
    menuIcon: 'Sliders',
    modes: ['backend'],
    defaultZone: 'right',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: true,
    defaultSubTab: 'stepConfig',
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: false,
    showInWindowMenu: true,
    menuOrder: 10,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_RIGHT_DOCK_WIDTH,
      maxWidth: MAX_RIGHT_DOCK_WIDTH,
      defaultWidth: DEFAULT_RIGHT_DOCK_WIDTH,
      minHeight: 340,
      maxHeight: 840,
      defaultHeight: 540,
    },
    target: { area: 'rightDock', panelId: 'backendInspector' },
  },

  flows: {
    id: 'flows',
    menuPanelId: 'flows',
    title: 'Olay & İş Akışları',
    menuLabel: 'İş Akışları (Flows)',
    icon: 'Workflow',
    menuIcon: 'Workflow',
    modes: ['backend'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: true,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 10,
    showInWindowMenu: true,
    menuOrder: 20,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
      minHeight: 280,
      maxHeight: 800,
      defaultHeight: 480,
    },
    target: { area: 'leftDrawer', tabId: 'flows', activeMatchTabs: ['flows'], panelId: 'flows' },
  },

  dataModels: {
    id: 'dataModels',
    menuPanelId: 'dataModels',
    title: 'Veri Kutuları & Tablolar',
    menuLabel: 'Veri Kutuları',
    icon: 'Database',
    menuIcon: 'Database',
    modes: ['backend'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 20,
    showInWindowMenu: true,
    menuOrder: 30,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
      minHeight: 280,
      maxHeight: 800,
      defaultHeight: 480,
    },
    target: { area: 'leftDrawer', tabId: 'dataModels', activeMatchTabs: ['dataModels'], panelId: 'dataModels' },
  },

  triggers: {
    id: 'triggers',
    menuPanelId: null,
    title: 'Sayfa Tetikleyicileri',
    menuLabel: 'Tetikleyiciler',
    icon: 'Zap',
    menuIcon: 'Zap',
    modes: ['backend'],
    defaultZone: 'left',
    allowedZones: ['left', 'right', 'floating'],
    defaultOpen: false,
    canFloat: true,
    canMinimize: true,
    canClose: true,
    shortcutHint: null,
    showInLeftDrawer: true,
    leftOrder: 30,
    showInWindowMenu: false,
    menuOrder: 35,
    dividerBefore: false,
    sizeLimits: {
      minWidth: MIN_LEFT_DRAWER_WIDTH,
      maxWidth: MAX_LEFT_DRAWER_WIDTH,
      defaultWidth: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
      minHeight: 280,
      maxHeight: 800,
      defaultHeight: 480,
    },
    target: { area: 'leftDrawer', tabId: 'triggers', activeMatchTabs: ['triggers'], panelId: 'triggers' },
  },
});

export const PANEL_LIST = Object.freeze(Object.values(PANEL_REGISTRY));

export const DEFAULT_WORKSPACE_PRESET_ID = 'standard';

export const WORKSPACE_PRESETS = Object.freeze({
  standard: {
    id: 'standard',
    label: 'Standart',
    description: 'Varsayılan dengeli çalışma alanı düzeni',
    modes: {
      design: {
        leftDrawer: { activeTab: null, width: DEFAULT_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: true, propertiesTab: 'layout', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: false },
        modals: { attributesInspector: false },
      },
      backend: {
        leftDrawer: { activeTab: 'flows', width: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: true, propertiesTab: 'stepConfig', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: false },
        modals: { attributesInspector: false },
      },
    },
  },

  design_focused: {
    id: 'design_focused',
    label: 'Tasarım Odaklı',
    description: 'Katmanlar çekmecesi ve Stil özellikleri aynı anda açık',
    modes: {
      design: {
        leftDrawer: { activeTab: 'layers', width: DEFAULT_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: true, propertiesTab: 'style', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: false },
        modals: { attributesInspector: false },
      },
      backend: {
        leftDrawer: { activeTab: 'flows', width: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: true, propertiesTab: 'stepConfig', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: false },
        modals: { attributesInspector: false },
      },
    },
  },

  wide_canvas: {
    id: 'wide_canvas',
    label: 'Geniş Tuval',
    description: 'Maksimum orta çalışma alanı için kenar panelleri daraltılmış',
    modes: {
      design: {
        leftDrawer: { activeTab: null, width: DEFAULT_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: false, propertiesTab: 'layout', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: true },
        modals: { attributesInspector: false },
      },
      backend: {
        leftDrawer: { activeTab: null, width: DEFAULT_BACKEND_LEFT_DRAWER_WIDTH },
        rightDock: { isOpen: false, propertiesTab: 'stepConfig', width: DEFAULT_RIGHT_DOCK_WIDTH },
        aiDock: { isMinimized: true },
        modals: { attributesInspector: false },
      },
    },
  },
});

export const WORKSPACE_PRESET_LIST = Object.freeze(Object.values(WORKSPACE_PRESETS));

export function isValidPanelId(panelId) {
  return Boolean(panelId && Object.prototype.hasOwnProperty.call(PANEL_REGISTRY, panelId));
}

export function getPanelConfig(panelId) {
  if (!panelId) return null;
  if (isValidPanelId(panelId)) return PANEL_REGISTRY[panelId];
  return PANEL_LIST.find((p) => p.menuPanelId === panelId) || null;
}

export function isPanelAllowedInMode(panelId, modeId) {
  const panel = getPanelConfig(panelId);
  if (!panel || !modeId) return false;
  return Array.isArray(panel.modes) && panel.modes.includes(modeId);
}

export function isPanelAllowedInZone(panelId, zone) {
  const panel = getPanelConfig(panelId);
  if (!panel || !zone || !VALID_PANEL_ZONES.includes(zone)) return false;
  return Array.isArray(panel.allowedZones) && panel.allowedZones.includes(zone);
}

export function getPanelsForMode(modeId = 'design') {
  return PANEL_LIST.filter((panel) => Array.isArray(panel.modes) && panel.modes.includes(modeId));
}

export function getLeftPanelsForMode(modeId = 'design') {
  return getPanelsForMode(modeId)
    .filter((panel) => {
      if (!panel.showInLeftDrawer) return false;
      if (Array.isArray(panel.leftDrawerModes)) {
        return panel.leftDrawerModes.includes(modeId);
      }
      return true;
    })
    .sort((a, b) => (a.leftOrder || 0) - (b.leftOrder || 0))
    .map((panel) => ({
      id: panel.id,
      title: panel.title,
      menuLabel: panel.menuLabel,
      icon: panel.icon,
      minWidth: panel.sizeLimits.minWidth,
      defaultWidth: panel.sizeLimits.defaultWidth,
    }));
}

export function getMenuPanelsForMode(modeId = 'design') {
  return getPanelsForMode(modeId)
    .filter((panel) => panel.showInWindowMenu)
    .sort((a, b) => (a.menuOrder || 0) - (b.menuOrder || 0))
    .map((panel) => {
      const entry = {
        id: panel.menuPanelId || panel.id,
        panelId: panel.id,
        label: panel.menuLabel || panel.title,
        icon: panel.menuIcon || panel.icon,
        defaultZone: panel.defaultZone,
        allowedZones: [...panel.allowedZones],
        target: { ...panel.target },
      };
      if (panel.shortcutHint) {
        entry.shortcutHint = panel.shortcutHint;
      }
      if (panel.dividerBefore) {
        entry.dividerBefore = true;
      }
      return entry;
    });
}

export function isValidWorkspacePreset(presetId) {
  return Boolean(presetId && Object.prototype.hasOwnProperty.call(WORKSPACE_PRESETS, presetId));
}

export function getWorkspacePreset(presetId = DEFAULT_WORKSPACE_PRESET_ID) {
  return isValidWorkspacePreset(presetId)
    ? WORKSPACE_PRESETS[presetId]
    : WORKSPACE_PRESETS[DEFAULT_WORKSPACE_PRESET_ID];
}

export function resolvePresetModeLayout(presetId = DEFAULT_WORKSPACE_PRESET_ID, modeId = 'design') {
  const preset = getWorkspacePreset(presetId);
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  const modeTemplate = preset.modes[resolvedMode] || WORKSPACE_PRESETS.standard.modes[resolvedMode];
  return {
    leftDrawer: { ...modeTemplate.leftDrawer },
    rightDock: { ...modeTemplate.rightDock },
    aiDock: { ...modeTemplate.aiDock },
    modals: { ...(modeTemplate.modals || { attributesInspector: false }) },
  };
}
