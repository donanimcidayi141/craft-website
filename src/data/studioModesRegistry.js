/**
 * Declarative registry for CraftStudio workspace modes ("Tasarım" | "Backend").
 * Adding a future studio mode only requires registering a new mode definition here.
 */

import {
  DEFAULT_LEFT_DRAWER_WIDTH,
  DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
  MIN_LEFT_DRAWER_WIDTH,
  MAX_LEFT_DRAWER_WIDTH,
  MIN_AI_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  DEFAULT_RIGHT_DOCK_WIDTH,
  MIN_RIGHT_DOCK_WIDTH,
  MAX_RIGHT_DOCK_WIDTH,
  RIGHT_RAIL_WIDTH,
  getLeftPanelsForMode,
  getMenuPanelsForMode,
  resolvePresetModeLayout,
} from './panelRegistry.js';

export const DEFAULT_STUDIO_MODE = 'design';
export {
  DEFAULT_LEFT_DRAWER_WIDTH,
  DEFAULT_BACKEND_LEFT_DRAWER_WIDTH,
  MIN_LEFT_DRAWER_WIDTH,
  MAX_LEFT_DRAWER_WIDTH,
  MIN_AI_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  DEFAULT_RIGHT_DOCK_WIDTH,
  MIN_RIGHT_DOCK_WIDTH,
  MAX_RIGHT_DOCK_WIDTH,
  RIGHT_RAIL_WIDTH,
};

export const STUDIO_MODES = {
  design: {
    id: 'design',
    label: 'Tasarım',
    shortLabel: 'Tasarım',
    description: 'Sayfa düzeni, görsel bileşenler ve duyarlı (PC/Tablet/Mobil) görünüm tasarım alanı',
    icon: 'Palette',
    accentColor: '#0d99ff',

    topBarConfig: {
      showViewportSwitcher: true,
      showPageTabsBar: true,
      showSelectionAlignStrip: true,
      showZoomCapsule: true,
      showPreviewButton: true,
    },

    tools: {
      defaultToolId: 'select',
      primaryTools: [
        { id: 'select', label: 'Seçim', shortcut: 'V', icon: 'MousePointer', kind: 'cursor' },
        { id: 'hand', label: 'El / Kaydır', shortcut: 'H', icon: 'Hand', kind: 'pan' },
        { id: 'zoom', label: 'Büyüteç (Yakınlaştır)', shortcut: 'Z', icon: 'Search', kind: 'zoom' },
        {
          id: 'shapes',
          kind: 'flyout',
          defaultSubToolId: 'rectangle',
          items: [
            { id: 'rectangle', label: 'Kutu Çiz', desc: 'Dikdörtgen / Kart', shortcut: 'R', icon: 'Square', drawTool: true },
            { id: 'circle', label: 'Daire / Elips', desc: 'Yuvarlak şekil', shortcut: 'O', icon: 'Circle', drawTool: true },
            { id: 'line', label: 'Çizgi / Ayırıcı', desc: 'Yatay veya dikey çizgi', shortcut: 'L', icon: 'Minus', drawTool: true },
            { id: 'frame', label: 'Çerçeve / Bölüm', desc: 'İçine öğe konabilen kutu', shortcut: 'F', icon: 'Frame', drawTool: true },
          ],
        },
        { id: 'text', label: 'Metin yaz', shortcut: 'T', icon: 'Type', kind: 'draw', drawTool: true },
      ],
      styleTools: [
        { id: 'eyedropper', label: 'Renk Damlalığı', shortcut: 'I', icon: 'Pipette' },
        { id: 'format_paint', label: 'Biçim Boyacısı', shortcut: 'Ctrl+Shift+C', icon: 'Paintbrush' },
      ],
      addGroups: ['structure', 'typography', 'components'],
      showRemoveBackgroundAction: true,
      showViewGuidesPopover: true,
      showArrangeActions: true,
    },

    leftPanels: getLeftPanelsForMode('design'),

    centerView: {
      componentKey: 'design_canvas',
      supportsCanvasFit: true,
      supportsFloatingAiDock: true,
    },

    rightTabs: [
      { id: 'block', railId: 'prop-block', label: 'Bileşen Özelleştirici', icon: 'LayoutGrid', indicator: 'bg-emerald-400' },
      { id: 'style', railId: 'prop-style', label: 'Stil ve Görünüm', icon: 'Sliders', indicator: 'bg-[#0d99ff]' },
      { id: 'layout', railId: 'prop-layout', label: 'Düzen ve Konum', icon: 'Box', indicator: 'bg-[#0d99ff]' },
      { id: 'props', railId: 'prop-props', label: 'HTML Nitelikleri & Eylem', icon: 'Tag', indicator: 'bg-[#0d99ff]' },
      { id: 'css', railId: 'prop-css', label: 'CSS Kuralları', icon: 'Sparkles', indicator: 'bg-[#0d99ff]' },
      { id: 'code', railId: 'prop-code', label: 'Canlı HTML & CSS Kodu', icon: 'Code2', indicator: 'bg-[#0d99ff]' },
    ],
    rightDockHeaderTitle: 'Özellikler & Tasarım',
    supportsFloatingAttributesInspector: true,

    menuPanels: getMenuPanelsForMode('design'),

    shortcutsProfile: 'design',

    defaultLayout: resolvePresetModeLayout('standard', 'design'),
  },

  backend: {
    id: 'backend',
    label: 'Backend',
    shortLabel: 'Backend',
    description: 'Kod yazmadan sayfa olayları, veri tabloları ve görsel iş akışı kurgulama alanı',
    icon: 'Workflow',
    accentColor: '#10b981',

    topBarConfig: {
      showViewportSwitcher: false,
      showPageTabsBar: false,
      showSelectionAlignStrip: false,
      showZoomCapsule: true,
      showPreviewButton: true,
    },

    tools: {
      defaultToolId: 'select',
      primaryTools: [
        { id: 'select', label: 'Seçim', shortcut: 'V', icon: 'MousePointer', kind: 'cursor' },
        { id: 'hand', label: 'El / Kaydır', shortcut: 'H', icon: 'Hand', kind: 'pan' },
      ],
      styleTools: [],
      addGroups: [],
      showRemoveBackgroundAction: false,
      showViewGuidesPopover: false,
      showArrangeActions: false,
    },

    leftPanels: getLeftPanelsForMode('backend'),

    centerView: {
      componentKey: 'backend_canvas_skeleton',
      supportsCanvasFit: false,
      supportsFloatingAiDock: true,
    },

    rightTabs: [
      { id: 'stepConfig', railId: 'back-step', label: 'Adım Ayarları', icon: 'Sliders', indicator: 'bg-emerald-400' },
      { id: 'dataBinding', railId: 'back-data', label: 'Veri Bağlama', icon: 'Database', indicator: 'bg-emerald-400' },
      { id: 'testRun', railId: 'back-test', label: 'Test & Çıktı', icon: 'Play', indicator: 'bg-emerald-400' },
    ],
    rightDockHeaderTitle: 'Akış & Veri Özellikleri',
    supportsFloatingAttributesInspector: false,

    menuPanels: getMenuPanelsForMode('backend'),

    shortcutsProfile: 'backend',

    defaultLayout: resolvePresetModeLayout('standard', 'backend'),
  },
};

export const STUDIO_MODE_LIST = [STUDIO_MODES.design, STUDIO_MODES.backend];

export function isValidStudioMode(modeId) {
  return Boolean(modeId && Object.prototype.hasOwnProperty.call(STUDIO_MODES, modeId));
}

export function getStudioModeConfig(modeId = DEFAULT_STUDIO_MODE) {
  return isValidStudioMode(modeId) ? STUDIO_MODES[modeId] : STUDIO_MODES[DEFAULT_STUDIO_MODE];
}

export function isToolSupportedInMode(modeId, toolId) {
  if (!toolId) return false;
  const mode = getStudioModeConfig(modeId);
  const { primaryTools = [], styleTools = [] } = mode.tools || {};
  for (const item of primaryTools) {
    if (item.id === toolId) return true;
    if (Array.isArray(item.items) && item.items.some((sub) => sub.id === toolId)) {
      return true;
    }
  }
  return styleTools.some((st) => st.id === toolId);
}
