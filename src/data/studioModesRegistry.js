/**
 * Declarative registry for CraftStudio workspace modes ("Tasarım" | "Backend").
 * Adding a future studio mode only requires registering a new mode definition here.
 */

export const DEFAULT_STUDIO_MODE = 'design';
export const DEFAULT_RIGHT_DOCK_WIDTH = 336;

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

    leftPanels: [
      { id: 'layers', title: 'Katmanlar & DOM Ağacı', menuLabel: 'Katmanlar (Layers)', icon: 'Layers', minWidth: 220, defaultWidth: 248 },
      { id: 'templates', title: 'Şablonlar & Hazır Bloklar', menuLabel: 'Assetler & Şablonlar', icon: 'LayoutTemplate', minWidth: 220, defaultWidth: 248 },
      { id: 'elements', title: 'HTML Etiketleri', menuLabel: null, icon: 'Tag', minWidth: 220, defaultWidth: 248 },
      { id: 'code', title: 'Canlı Kod (JSX & CSS)', menuLabel: null, icon: 'Code2', minWidth: 220, defaultWidth: 248 },
      { id: 'ai', title: 'AI Tasarım Asistanı', menuLabel: null, icon: 'Sparkles', minWidth: 296, defaultWidth: 296 },
    ],

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

    menuPanels: [
      {
        id: 'properties',
        label: 'Özellikler & Hizalama',
        icon: 'Sliders',
        target: { area: 'rightDock' },
      },
      {
        id: 'assets',
        label: 'Assetler & Şablonlar',
        icon: 'Box',
        target: { area: 'leftDrawer', tabId: 'templates', activeMatchTabs: ['templates', 'elements'] },
      },
      {
        id: 'layers',
        label: 'Katmanlar (Layers)',
        icon: 'Layers',
        target: { area: 'leftDrawer', tabId: 'layers', activeMatchTabs: ['layers'] },
      },
      {
        id: 'aiAgent',
        label: 'AI Sohbet Çubuğu',
        icon: 'Sparkles',
        shortcutHint: 'Ctrl+K',
        target: { area: 'aiDock' },
      },
      {
        id: 'attributesAndCss',
        label: 'Yüzen CSS & Nitelik Penceresi',
        icon: 'Tag',
        dividerBefore: true,
        target: { area: 'modal', modalKey: 'attributesInspector' },
      },
    ],

    shortcutsProfile: 'design',

    defaultLayout: {
      leftDrawer: { activeTab: null },
      rightDock: { isOpen: true, propertiesTab: 'layout', width: 336 },
      aiDock: { isMinimized: false },
    },
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

    leftPanels: [
      { id: 'flows', title: 'Olay & İş Akışları', menuLabel: 'İş Akışları (Flows)', icon: 'Workflow', minWidth: 220, defaultWidth: 256 },
      { id: 'dataModels', title: 'Veri Kutuları & Tablolar', menuLabel: 'Veri Kutuları', icon: 'Database', minWidth: 220, defaultWidth: 256 },
      { id: 'triggers', title: 'Sayfa Tetikleyicileri', menuLabel: 'Tetikleyiciler', icon: 'Zap', minWidth: 220, defaultWidth: 256 },
    ],

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

    menuPanels: [
      {
        id: 'backendInspector',
        label: 'Akış & Adım Özellikleri',
        icon: 'Sliders',
        target: { area: 'rightDock' },
      },
      {
        id: 'flows',
        label: 'İş Akışları (Flows)',
        icon: 'Workflow',
        target: { area: 'leftDrawer', tabId: 'flows', activeMatchTabs: ['flows'] },
      },
      {
        id: 'dataModels',
        label: 'Veri Kutuları',
        icon: 'Database',
        target: { area: 'leftDrawer', tabId: 'dataModels', activeMatchTabs: ['dataModels'] },
      },
      {
        id: 'aiAgent',
        label: 'AI Sohbet Çubuğu',
        icon: 'Sparkles',
        shortcutHint: 'Ctrl+K',
        target: { area: 'aiDock' },
      },
    ],

    shortcutsProfile: 'backend',

    defaultLayout: {
      leftDrawer: { activeTab: 'flows' },
      rightDock: { isOpen: true, propertiesTab: 'stepConfig', width: 336 },
      aiDock: { isMinimized: false },
    },
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
