import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers, Box, LayoutTemplate, Code2, MousePointer, Square, Hand,
  Type, Image as ImageIcon, RectangleHorizontal, Wand2, Plus,
  ArrowRightLeft, Eye, EyeOff, Lock, Unlock, Trash2, Group,
  ChevronRight, ChevronDown, Search, Sparkles, Copy, Check,
  ChevronsLeft, Info, Link2, Navigation, LayoutGrid, X, Tag as TagIcon,
  Heading1, Heading2, Pilcrow, PanelTop, PanelBottom, Ungroup, Boxes, Shapes,
  Circle, Minus, Frame, Pipette, Paintbrush, TextCursorInput, CheckSquare,
  ListCollapse, Video, SeparatorHorizontal, Grid3x3, Ruler, Maximize2,
  SlidersHorizontal, CopyPlus, ArrowUpToLine, ArrowDownToLine,
  AlignCenterHorizontal, AlignCenterVertical, Workflow, Database, Zap
} from 'lucide-react';
import { canHaveChildren, isExplicitContainer } from '../utils/treeUtils.js';
import { PRESET_ASSETS } from '../constants.js';
import { elementToHtml, styleObjectToCss } from '../utils/codeSync.js';
import { getStudioModeConfig } from '../data/studioModesRegistry.js';
import PresetThumbnail from './PresetThumbnail.jsx';
import LeftAiChatPanel from './LeftAiChatPanel.jsx';

const BACKEND_PANEL_ICON_MAP = {
  Workflow,
  Database,
  Zap,
};

const DEFAULT_LEFT_WIDTH = 248;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 440;

function getLayerNodeIcon(type) {
  const t = (type || 'div').toLowerCase();
  if (t === 'text' || t === 'p' || t === 'h1' || t === 'h2' || t === 'h3' || t === 'span') return Type;
  if (t === 'button') return RectangleHorizontal;
  if (t === 'a') return Link2;
  if (t === 'img') return ImageIcon;
  if (t === 'nav' || t === 'navbar' || t === 'header' || t === 'footer') return Navigation;
  if (t === 'section' || t === 'div' || t === 'group') return LayoutGrid;
  return Box;
}

function RailTip({ label, hint }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 ml-2.5 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-md border border-[#34343e] bg-[#0f0f13] px-2 py-1 text-[11px] font-medium text-zinc-100 opacity-0 shadow-xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 z-[80]"
    >
      {label}
      {hint ? (
        <kbd className="ml-2 rounded border border-[#3a3a46] bg-[#1c1c23] px-1 py-px font-mono text-[10px] text-[#7dd3fc]">
          {hint}
        </kbd>
      ) : null}
    </span>
  );
}

export default function StudioLeftSidebar({
  activeTab = 'layers', // 'layers' | 'elements' | 'templates' | 'code' | 'ai' | null
  setActiveTab,
  // Layer tree props
  elements = [],
  selectedIds = [],
  onSelectElement,
  onSelectMultipleElements,
  onToggleElementSelection,
  onToggleVisibility,
  onToggleLock,
  onRenameElement,
  onReparentElement,
  onDeleteSelected,
  onDuplicateSelected,
  onGroupSelected,
  onUngroupSelected,
  onZOrderSelected,
  onToggleLockSelected,
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  copiedStyle,
  onCopyStyle,
  onPasteStyle,
  showLayoutGrid,
  setShowLayoutGrid,
  showRulers,
  setShowRulers,
  onResetZoom,
  // Element / Tool props
  activeTool,
  setActiveTool,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  setSecondaryColor,
  onQuickAdd,
  onRemoveBackground,
  selectedElement,
  // Preset asset props
  onAddPreset,
  // Live Code sync props
  onUpdateElement,
  onCommitHistory,
  // Shared Gemini AI session controller
  aiChat,
  viewportMode = 'desktop',
  activeMode = 'design',
  modeConfig = null,
  projectBackend = null,
}) {
  const resolvedModeConfig = modeConfig || getStudioModeConfig(activeMode);
  const isBackendMode = activeMode === 'backend';
  const [collapsedMap, setCollapsedMap] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [layerSearchTerm, setLayerSearchTerm] = useState('');

  // Drawer width resizing
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  // Drag and drop state for layers
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);

  // Template/Asset filters
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Hepsi');
  const templateCategories = [
    'Hepsi',
    'Navbar',
    'Footer',
    'Slider',
    'İçerik Blokları',
    'Butonlar',
    'Şekiller',
    'Tipografi',
    'Medya',
    'Etiketler',
  ];

  // Color modal
  const [showColorModal, setShowColorModal] = useState(false);
  const [editingColorType, setEditingColorType] = useState('primary');
  const colorModalRef = useRef(null);

  // Live code tab state
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!isResizing) return undefined;
    const handlePointerMove = (e) => {
      const state = resizeRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const clamped = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, state.startWidth + dx));
      setDrawerWidth(clamped);
    };
    const handlePointerUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!showColorModal) return undefined;
    const closeOnOutside = (e) => {
      if (colorModalRef.current && !colorModalRef.current.contains(e.target)) {
        setShowColorModal(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [showColorModal]);

  // Shape flyout options (single slot with corner flyout arrow: R/O/L/F)
  const shapeTools = [
    { id: 'rectangle', name: 'Kutu Çiz', desc: 'Dikdörtgen / Kart', icon: Square, shortcut: 'R' },
    { id: 'circle', name: 'Daire / Elips', desc: 'Yuvarlak şekil', icon: Circle, shortcut: 'O' },
    { id: 'line', name: 'Çizgi / Ayırıcı', desc: 'Yatay veya dikey çizgi', icon: Minus, shortcut: 'L' },
    { id: 'frame', name: 'Çerçeve / Bölüm', desc: 'İçine öğe konabilen kutu', icon: Frame, shortcut: 'F' },
  ];
  const [lastShapeToolId, setLastShapeToolId] = useState('rectangle');
  useEffect(() => {
    if (['rectangle', 'circle', 'line', 'frame'].includes(activeTool)) {
      setLastShapeToolId(activeTool);
    }
  }, [activeTool]);
  const activeShapeTool = shapeTools.find((s) => s.id === lastShapeToolId) || shapeTools[0];
  const isShapeToolActive = shapeTools.some((s) => s.id === activeTool);

  const addGroups = [
    {
      id: 'structure',
      name: 'Yapı blokları',
      icon: Boxes,
      items: [
        { tag: 'section', name: 'Bölüm', desc: 'Tam genişlik bölüm', icon: LayoutGrid },
        { tag: 'frame', name: 'Çerçeve', desc: 'Kart / alan kutusu', icon: Frame },
        { tag: 'div', name: 'Kapsayıcı', desc: 'Esnek kutu', icon: Square },
        { tag: 'nav', name: 'Üst menü', desc: 'Navigasyon çubuğu', icon: PanelTop },
        { tag: 'header', name: 'Başlık alanı', desc: 'Sayfa üstlüğü', icon: Navigation },
        { tag: 'footer', name: 'Alt bilgi', desc: 'Sayfa altlığı', icon: PanelBottom },
      ],
    },
    {
      id: 'typography',
      name: 'Yazı öğeleri',
      icon: Type,
      items: [
        { tag: 'h1', name: 'Büyük başlık', desc: 'H1 · hero başlığı', icon: Heading1 },
        { tag: 'h2', name: 'Alt başlık', desc: 'H2 · bölüm başlığı', icon: Heading2 },
        { tag: 'p', name: 'Paragraf', desc: 'Açıklama metni', icon: Pilcrow },
        { tag: 'a', name: 'Bağlantı', desc: 'Sayfa veya dış link', icon: Link2 },
        { tag: 'span', name: 'Rozet / etiket', desc: 'Küçük vurgu', icon: TagIcon },
      ],
    },
    {
      id: 'components',
      name: 'Form & Medya',
      icon: Shapes,
      items: [
        { tag: 'button', name: 'Buton', desc: 'Eylem düğmesi', icon: RectangleHorizontal },
        { tag: 'img', name: 'Görsel', desc: 'Resim bloğu', icon: ImageIcon },
        { tag: 'input', name: 'Girdi Kutusu', desc: 'Tek satır form alanı', icon: TextCursorInput },
        { tag: 'textarea', name: 'Metin Alanı', desc: 'Çok satırlı form', icon: Pilcrow },
        { tag: 'select', name: 'Açılır Liste', desc: 'Seçenek menüsü', icon: ListCollapse },
        { tag: 'checkbox', name: 'Onay Kutusu', desc: 'İşaretleme kutusu', icon: CheckSquare },
        { tag: 'video', name: 'Video', desc: 'Medya oynatıcı', icon: Video },
        { tag: 'hr', name: 'Ayırıcı', desc: 'İnce yatay çizgi', icon: SeparatorHorizontal },
      ],
    },
  ];
  const hasSelection = Array.isArray(selectedIds) && selectedIds.length > 0;
  const [openAddGroup, setOpenAddGroup] = useState(null);
  const railRef = useRef(null);
  useEffect(() => {
    setOpenAddGroup(null);
  }, [activeMode]);
  useEffect(() => {
    if (!openAddGroup) return undefined;
    const onDown = (e) => {
      if (railRef.current && !railRef.current.contains(e.target)) setOpenAddGroup(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenAddGroup(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openAddGroup]);

  // Quick Semantic Tags
  const SEMANTIC_TAGS = [
    { tag: 'section', name: 'Bölüm (section)', desc: 'Ana sayfa bölümü' },
    { tag: 'div', name: 'Kapsayıcı (div)', desc: 'Esnek flexbox kutusu' },
    { tag: 'header', name: 'Başlık Alanı (header)', desc: 'Sayfa üstlüğü' },
    { tag: 'nav', name: 'Navigasyon (nav)', desc: 'Menü çubuğu' },
    { tag: 'h1', name: 'Büyük Başlık (h1)', desc: 'Hero ana başlığı' },
    { tag: 'h2', name: 'Alt Başlık (h2)', desc: 'Bölüm başlığı' },
    { tag: 'p', name: 'Paragraf (p)', desc: 'Açıklama metni' },
    { tag: 'button', name: 'Buton (button)', desc: 'Aksiyon butonu' },
    { tag: 'a', name: 'Bağlantı Linki (a)', desc: 'Sayfa veya dış link' },
    { tag: 'img', name: 'Resim (img)', desc: 'Görsel elemanı' },
    { tag: 'span', name: 'Rozet / Etiket (span)', desc: 'Küçük etiket' },
    { tag: 'footer', name: 'Alt Bilgi (footer)', desc: 'Sayfa altlığı' },
  ];

  const handleSwapColors = () => {
    const temp = primaryColor;
    setPrimaryColor(secondaryColor);
    setSecondaryColor(temp);
  };

  const toggleCollapse = (id, e) => {
    e.stopPropagation();
    setCollapsedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLayerClick = (node, e) => {
    if (editingId) return;
    if (e.ctrlKey || e.metaKey) {
      onToggleElementSelection(node.id);
    } else {
      onSelectElement(node.id);
    }
  };

  const handleCommitRename = (id) => {
    if (editingName.trim()) {
      onRenameElement(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleDragStart = (e, node) => {
    if (editingId === node.id) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.id);
    setDraggedId(node.id);
  };

  const handleDragOver = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId === node.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    const isContainer = canHaveChildren(node.type) && isExplicitContainer(node.type);

    if (isContainer && offsetY > height * 0.25 && offsetY < height * 0.75) {
      setDropPosition('inside');
    } else if (offsetY < height * 0.5) {
      setDropPosition('before');
    } else {
      setDropPosition('after');
    }
    setDragOverTargetId(node.id);
  };

  const handleDragLeave = (e, node) => {
    e.stopPropagation();
    if (dragOverTargetId === node.id) {
      setDragOverTargetId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedId || draggedId === targetNode.id) {
      setDraggedId(null);
      setDragOverTargetId(null);
      setDropPosition(null);
      return;
    }

    if (dropPosition === 'inside') {
      onReparentElement(draggedId, targetNode.id, -1);
    } else if (dropPosition === 'before') {
      onReparentElement(draggedId, targetNode.parentId || null, 0);
    } else if (dropPosition === 'after') {
      onReparentElement(draggedId, targetNode.parentId || null, -1);
    }

    setDraggedId(null);
    setDragOverTargetId(null);
    setDropPosition(null);
  };

  const countAllNodes = (nodes) => {
    if (!Array.isArray(nodes)) return 0;
    let count = nodes.length;
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) {
        count += countAllNodes(n.children);
      }
    });
    return count;
  };

  const renderLayerNode = (node, depth = 0) => {
    const isSelected = selectedIds.includes(node.id);
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = Boolean(collapsedMap[node.id]);
    const isEditing = editingId === node.id;
    const isDragged = draggedId === node.id;
    const isOverTarget = dragOverTargetId === node.id;

    if (layerSearchTerm.trim()) {
      const term = layerSearchTerm.toLowerCase();
      const matchesSelf = (node.name || '').toLowerCase().includes(term) || (node.type || '').toLowerCase().includes(term);
      const matchesChild = hasChildren && JSON.stringify(node.children).toLowerCase().includes(term);
      if (!matchesSelf && !matchesChild) return null;
    }

    const NodeIcon = getLayerNodeIcon(node.type);

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={(e) => handleDragLeave(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          onClick={(e) => handleLayerClick(node, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(node.id);
            setEditingName(node.name || node.type);
          }}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
          className={`group flex items-center justify-between h-7 pr-2 mx-1 rounded cursor-pointer transition-colors relative border ${
            isSelected
              ? 'bg-[#0d99ff]/15 text-zinc-100 border-[#0d99ff]/50 font-medium'
              : 'text-zinc-300 border-transparent hover:bg-white/[0.05] hover:text-white'
          } ${isDragged ? 'opacity-40' : ''} ${
            isOverTarget && dropPosition === 'before' ? 'border-t-2 border-t-[#0d99ff]' : ''
          } ${
            isOverTarget && dropPosition === 'after' ? 'border-b-2 border-b-[#0d99ff]' : ''
          } ${
            isOverTarget && dropPosition === 'inside' ? 'bg-[#0d99ff]/20 ring-1 ring-[#0d99ff]' : ''
          }`}
        >
          {/* Left section: expand toggle + icon + tag badge + name */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(node.id, e)}
                className="w-4 h-4 flex items-center justify-center rounded-sm text-zinc-400 hover:text-white hover:bg-white/[0.08] shrink-0"
              >
                {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              </button>
            ) : (
              <span className="w-3 shrink-0" />
            )}

            <NodeIcon size={11} className={isSelected ? 'text-[#38bdf8] shrink-0' : 'text-zinc-500 shrink-0'} />

            <span className={`text-[9px] font-mono px-1 py-0.2 rounded-sm border shrink-0 ${
              isSelected
                ? 'bg-[#0d99ff]/15 text-[#7dd3fc] border-[#0d99ff]/40'
                : 'bg-[#101013] text-zinc-400 border-[#27272d]'
            }`}>
              {node.type || 'div'}
            </span>

            {isEditing ? (
              <input
                type="text"
                value={editingName}
                autoFocus
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleCommitRename(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename(node.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="bg-[#101013] border border-[#0d99ff] rounded-sm px-1.5 py-0 text-xs text-white focus:outline-none w-32"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-[11px] truncate">{node.name || node.type}</span>
            )}
          </div>

          {/* Right section: Visibility & Lock */}
          <div className={`flex items-center gap-0.5 transition-opacity shrink-0 ${
            node.isHidden || node.isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(node.id);
              }}
              title={
                node.isHidden
                  ? `${viewportMode === 'mobile' ? 'Mobil' : viewportMode === 'tablet' ? 'Tablet' : 'Masaüstü'} görünümünde göster`
                  : `${viewportMode === 'mobile' ? 'Mobil' : viewportMode === 'tablet' ? 'Tablet' : 'Masaüstü'} görünümünde gizle`
              }
              className="p-1 hover:text-white text-zinc-400 rounded hover:bg-white/[0.08]"
            >
              {node.isHidden ? <EyeOff size={11} className="text-rose-400" /> : <Eye size={11} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(node.id);
              }}
              title={node.isLocked ? 'Kilidi Aç' : 'Kilitle'}
              className="p-1 hover:text-white text-zinc-400 rounded hover:bg-white/[0.08]"
            >
              {node.isLocked ? <Lock size={11} className="text-[#38bdf8]" /> : <Unlock size={11} />}
            </button>
          </div>
        </div>

        {/* Children if expanded */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col border-l border-white/[0.06] ml-4">
            {node.children.map(child => renderLayerNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const presetCategoryCounts = useMemo(() => {
    const counts = { Hepsi: PRESET_ASSETS.length };
    PRESET_ASSETS.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredAssets = PRESET_ASSETS.filter((item) => {
    const q = templateSearch.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    const matchesCategory = templateCategory === 'Hepsi' || item.category === templateCategory;
    return matchesSearch && matchesCategory;
  });

  const railTabs = [
    { id: 'layers', title: 'Katmanlar & DOM Ağacı', icon: Layers },
    { id: 'templates', title: 'Şablonlar & Hazır Bloklar', icon: LayoutTemplate },
    { id: 'elements', title: 'HTML Etiketleri', icon: TagIcon },
    { id: 'code', title: 'Canlı Kod (JSX & CSS)', icon: Code2 },
  ];

  if (isBackendMode) {
    const backendLeftPanels = resolvedModeConfig.leftPanels || [];
    const activeBackendPanel = backendLeftPanels.find((p) => p.id === activeTab) || null;
    const backendItems = activeBackendPanel && Array.isArray(projectBackend?.[activeBackendPanel.id])
      ? projectBackend[activeBackendPanel.id]
      : [];

    return (
      <aside
        data-left-sidebar-mode="backend"
        className="flex h-full bg-[#18181b] border-r border-[#2c2c32] select-none z-30 relative"
      >
        <div
          ref={railRef}
          className="w-[52px] bg-gradient-to-b from-[#16161a] to-[#111114] border-r border-[#27272d] flex flex-col items-center py-2 z-20 shrink-0"
        >
          <div className="w-full px-1.5 flex flex-col items-center gap-2.5">
            <div
              role="toolbar"
              aria-label="Backend gezinme araçları"
              className="w-full flex flex-col items-center gap-0.5 rounded-xl border border-[#2a2a33] bg-[#0f0f13] p-1 shadow-inner"
            >
              {[
                { id: 'select', name: 'Seçim', icon: MousePointer, shortcut: 'V' },
                { id: 'hand', name: 'El / Kaydır', icon: Hand, shortcut: 'H' },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={t.name}
                    aria-pressed={isActive}
                    data-tool-id={t.id}
                    onClick={() => setActiveTool(t.id)}
                    className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.3 : 1.9} />
                    <RailTip label={t.name} hint={t.shortcut} />
                  </button>
                );
              })}
            </div>

            <div className="w-full flex flex-col items-center gap-1 pt-1 border-t border-[#24242b]">
              <span className="text-[8px] font-bold tracking-[0.14em] text-zinc-600">PANELLER</span>
              {backendLeftPanels.map((panel) => {
                const PIcon = BACKEND_PANEL_ICON_MAP[panel.icon] || Workflow;
                const isPanelOpen = activeTab === panel.id;
                return (
                  <button
                    key={panel.id}
                    type="button"
                    data-left-panel-id={panel.id}
                    aria-label={panel.title}
                    aria-pressed={isPanelOpen}
                    onClick={() => setActiveTab(isPanelOpen ? null : panel.id)}
                    className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                      isPanelOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <PIcon size={14} strokeWidth={1.9} />
                    <RailTip label={panel.title} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {activeTab && (
          <div
            style={{ width: `${activeTab === 'ai' ? Math.max(drawerWidth, 296) : drawerWidth}px` }}
            className="relative bg-[#18181b] flex flex-col h-full text-xs text-zinc-300 min-w-0"
          >
            {activeTab === 'ai' ? (
              <LeftAiChatPanel
                aiChat={aiChat}
                onClosePanel={() => setActiveTab(null)}
              />
            ) : activeBackendPanel ? (
              <div className="flex flex-col h-full min-h-0" data-backend-left-drawer={activeBackendPanel.id}>
                <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider truncate">
                      {activeBackendPanel.title}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-emerald-300 bg-[#101013] border border-emerald-500/30 px-1.5 py-0.2 rounded">
                      {backendItems.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    title="Sol paneli gizle"
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                  >
                    <ChevronsLeft size={13} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {backendItems.length === 0 ? (
                    <div className="p-5 text-center text-zinc-500 text-[11px] leading-relaxed">
                      Henüz kayıtlı öğe yok. Görsel akış tuvali eklendiğinde buradan yönetilecek.
                    </div>
                  ) : (
                    backendItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-2.5 rounded-lg bg-[#121216] border border-[#27272f] text-zinc-200 text-[11px] font-medium"
                      >
                        {item.name || item.id || `Kayıt #${idx + 1}`}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="flex h-full bg-[#18181b] border-r border-[#2c2c32] select-none z-30 relative">
      {/* 1. STUDIO RAIL: Gezinme, Büyüteç, Şekiller, Stil & Boya, Ekle & Düzenle */}
      <div ref={railRef} className="w-[52px] bg-gradient-to-b from-[#16161a] to-[#111114] border-r border-[#27272d] flex flex-col items-center py-2 z-20 shrink-0">
        <div className="w-full px-1.5 flex flex-col items-center gap-2.5 overflow-visible">
          {/* ÇİZİM & GEZİNME CAPSULE */}
          <div role="toolbar" aria-label="Çizim ve gezinme araçları" className="w-full flex flex-col items-center gap-0.5 rounded-xl border border-[#2a2a33] bg-[#0f0f13] p-1 shadow-inner">
            {[
              { id: 'select', name: 'Seçim', icon: MousePointer, shortcut: 'V' },
              { id: 'hand', name: 'El / Kaydır', icon: Hand, shortcut: 'H' },
              { id: 'zoom', name: 'Büyüteç (Yakınlaştır)', icon: Search, shortcut: 'Z' },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.name}
                  aria-pressed={isActive}
                  data-tool-id={t.id}
                  onClick={() => {
                    setActiveTool(t.id);
                    setOpenAddGroup(null);
                  }}
                  className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-br from-[#0d99ff] to-[#6d5cff] text-white shadow-[0_4px_14px_rgba(13,153,255,0.38)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.3 : 1.9} />
                  {openAddGroup !== 'shapes' && <RailTip label={t.name} hint={t.shortcut} />}
                </button>
              );
            })}

            {/* Shape Flyout Slot (Kutu R, Daire O, Çizgi L, Çerçeve F) */}
            <div className="relative w-full">
              {(() => {
                const ShapeIcon = activeShapeTool.icon;
                const isFlyoutOpen = openAddGroup === 'shapes';
                return (
                  <button
                    type="button"
                    aria-label={activeShapeTool.name}
                    aria-pressed={isShapeToolActive}
                    aria-expanded={isFlyoutOpen}
                    data-tool-id={activeShapeTool.id}
                    onClick={() => {
                      if (!isShapeToolActive) {
                        setActiveTool(activeShapeTool.id);
                        setOpenAddGroup(null);
                      } else {
                        setOpenAddGroup(isFlyoutOpen ? null : 'shapes');
                      }
                    }}
                    className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
                      isShapeToolActive
                        ? 'bg-gradient-to-br from-[#0d99ff] to-[#6d5cff] text-white shadow-[0_4px_14px_rgba(13,153,255,0.38)]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <ShapeIcon size={15} strokeWidth={isShapeToolActive ? 2.3 : 1.9} />
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label="Şekil seçeneklerini aç"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenAddGroup(isFlyoutOpen ? null : 'shapes');
                      }}
                      className="absolute right-0.5 bottom-0.5 flex items-center justify-center w-2.5 h-2.5 opacity-75 hover:opacity-100"
                    >
                      <ChevronRight size={8} />
                    </span>
                    {!isFlyoutOpen && (
                      <RailTip label={`${activeShapeTool.name} · Şekiller için tıkla`} hint={activeShapeTool.shortcut} />
                    )}
                  </button>
                );
              })()}
              {openAddGroup === 'shapes' && (
                <div className="absolute left-full top-0 ml-2.5 w-48 rounded-xl border border-[#34343e] bg-[#121216] p-1.5 shadow-2xl z-[90]">
                  <div className="px-2 pt-1 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-zinc-500 uppercase">Şekiller & Çerçeve</div>
                  {shapeTools.map((shape) => {
                    const SIcon = shape.icon;
                    const active = activeTool === shape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        data-shape-tool={shape.id}
                        onClick={() => {
                          setActiveTool(shape.id);
                          setOpenAddGroup(null);
                        }}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          active ? 'bg-[#0d99ff]/15 text-white' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center ${active ? 'bg-[#0d99ff]/20 border-[#0d99ff]/50 text-[#7dd3fc]' : 'bg-[#1d1d24] border-[#2c2c36] text-[#7dd3fc]'}`}>
                          <SIcon size={13} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block text-[11.5px] font-medium truncate">{shape.name}</span>
                          <span className="block text-[9.5px] text-zinc-500 truncate">{shape.desc}</span>
                        </span>
                        <kbd className="text-[9.5px] font-mono text-zinc-500 px-1 py-0.5 rounded bg-[#1b1b22] border border-[#2d2d37]">{shape.shortcut}</kbd>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Metin (T) */}
            <button
              type="button"
              aria-label="Metin yaz"
              aria-pressed={activeTool === 'text'}
              data-tool-id="text"
              onClick={() => {
                setActiveTool('text');
                setOpenAddGroup(null);
              }}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
                activeTool === 'text'
                  ? 'bg-gradient-to-br from-[#0d99ff] to-[#6d5cff] text-white shadow-[0_4px_14px_rgba(13,153,255,0.38)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <Type size={15} strokeWidth={activeTool === 'text' ? 2.3 : 1.9} />
              <RailTip label="Metin yaz" hint="T" />
            </button>
          </div>

          {/* BOYA & STİL: Damlalık (I) & Biçim Boyacısı */}
          <div className="w-full flex flex-col items-center gap-1 pt-1 border-t border-[#24242b]">
            <span className="text-[8px] font-bold tracking-[0.14em] text-zinc-600">STİL</span>
            <button
              type="button"
              aria-label="Renk Damlalığı"
              aria-pressed={activeTool === 'eyedropper'}
              data-tool-id="eyedropper"
              onClick={() => {
                setActiveTool(activeTool === 'eyedropper' ? 'select' : 'eyedropper');
                setOpenAddGroup(null);
              }}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                activeTool === 'eyedropper'
                  ? 'bg-gradient-to-br from-[#0d99ff] to-[#6d5cff] text-white shadow-[0_4px_14px_rgba(13,153,255,0.38)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <Pipette size={14} strokeWidth={1.9} />
              <RailTip label="Renk damlalığı (Örnekle/Boya)" hint="I" />
            </button>

            <button
              type="button"
              aria-label="Biçim Boyacısı"
              aria-pressed={activeTool === 'format_paint'}
              data-tool-id="format_paint"
              onClick={() => {
                setOpenAddGroup(null);
                if (activeTool === 'format_paint') {
                  setActiveTool('select');
                } else if (hasSelection) {
                  onCopyStyle?.({ activateTool: true });
                } else if (copiedStyle) {
                  setActiveTool('format_paint');
                } else {
                  onCopyStyle?.({ activateTool: true });
                }
              }}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                activeTool === 'format_paint'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
                  : copiedStyle
                    ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : hasSelection
                      ? 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                      : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              <Paintbrush size={14} strokeWidth={1.9} />
              {copiedStyle && (
                <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              <RailTip
                label={copiedStyle ? 'Biçim boyacısı (Hazır — hedefe tıkla)' : 'Biçim boyacısı (Stil kopyala)'}
                hint="Ctrl+Shift+C"
              />
            </button>
          </div>

          {/* EKLE: Yapı, Yazı, Form & Medya, Arka Plan Sil */}
          <div className="w-full flex flex-col items-center gap-1 pt-1 border-t border-[#24242b]">
            <span className="text-[8px] font-bold tracking-[0.14em] text-zinc-600">EKLE</span>
            {addGroups.map((g) => {
              const GIcon = g.icon;
              const isOpen = openAddGroup === g.id;
              return (
                <div key={g.id} className="relative w-full">
                  <button
                    type="button"
                    aria-label={g.name}
                    aria-expanded={isOpen}
                    data-add-group={g.id}
                    onClick={() => setOpenAddGroup(isOpen ? null : g.id)}
                    className={`group relative w-full h-7 flex items-center justify-center rounded-lg border transition-all ${
                      isOpen
                        ? 'border-[#0d99ff]/70 bg-[#0d99ff]/15 text-[#7dd3fc]'
                        : 'border-dashed border-[#32323c] text-zinc-400 hover:text-[#7dd3fc] hover:border-[#0d99ff]/70 hover:bg-[#0d99ff]/10'
                    }`}
                  >
                    <GIcon size={14} strokeWidth={1.9} />
                    <ChevronRight size={8} className="absolute right-0.5 bottom-0.5 opacity-60" />
                    {!isOpen && <RailTip label={g.name} />}
                  </button>
                  {isOpen && (
                    <div className="absolute left-full top-0 ml-2.5 w-52 max-h-[340px] overflow-y-auto rounded-xl border border-[#34343e] bg-[#121216] p-1.5 shadow-2xl z-[90]">
                      <div className="px-2 pt-1 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-zinc-500 uppercase">{g.name}</div>
                      {g.items.map((item) => {
                        const IIcon = item.icon;
                        return (
                          <button
                            key={item.tag}
                            type="button"
                            data-add-tag={item.tag}
                            onClick={() => {
                              onQuickAdd(item.tag);
                              setOpenAddGroup(null);
                            }}
                            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <span className="w-6 h-6 shrink-0 rounded-md bg-[#1d1d24] border border-[#2c2c36] flex items-center justify-center text-[#7dd3fc]">
                              <IIcon size={13} strokeWidth={1.9} />
                            </span>
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block text-[11.5px] font-medium truncate">{item.name}</span>
                              <span className="block text-[9.5px] text-zinc-500 truncate">{item.desc}</span>
                            </span>
                            <code className="text-[9px] font-mono text-zinc-600">&lt;{item.tag}&gt;</code>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              aria-label="Arka planı kaldır"
              data-quick-add="remove-bg"
              onClick={onRemoveBackground}
              disabled={!selectedElement}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                selectedElement ? 'text-[#c4b5fd] hover:bg-[#8b5cf6]/15 hover:text-white' : 'text-zinc-700 cursor-not-allowed'
              }`}
            >
              <Wand2 size={14} strokeWidth={1.9} />
              <RailTip label={selectedElement ? 'Arka planı şeffaf yap' : 'Arka plan silmek için bir öğe seç'} />
            </button>
          </div>

          {/* GÖRÜNÜM & DÜZENLE */}
          <div className="w-full flex flex-col items-center gap-1 pt-1 border-t border-[#24242b]">
            <span className="text-[8px] font-bold tracking-[0.14em] text-zinc-600">DÜZEN</span>

            {/* View Guides Popover (12-Col Grid, Rulers, Fit) */}
            <div className="relative w-full">
              <button
                type="button"
                aria-label="Izgara & Cetvel görünümü"
                aria-expanded={openAddGroup === 'view'}
                data-rail-popover="view"
                onClick={() => setOpenAddGroup(openAddGroup === 'view' ? null : 'view')}
                className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                  openAddGroup === 'view' || showLayoutGrid || showRulers
                    ? 'bg-[#0d99ff]/15 text-[#7dd3fc] border border-[#0d99ff]/40'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <Grid3x3 size={14} strokeWidth={1.9} />
                <ChevronRight size={8} className="absolute right-0.5 bottom-0.5 opacity-60" />
                {openAddGroup !== 'view' && <RailTip label="Görünüm · Izgara & Cetvel" />}
              </button>
              {openAddGroup === 'view' && (
                <div className="absolute left-full bottom-0 ml-2.5 w-52 rounded-xl border border-[#34343e] bg-[#121216] p-1.5 shadow-2xl z-[90]">
                  <div className="px-2 pt-1 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-zinc-500 uppercase">Tuval Yardımcıları</div>
                  <button
                    type="button"
                    data-toggle-grid
                    onClick={() => setShowLayoutGrid?.((v) => !v)}
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                      showLayoutGrid ? 'bg-[#0d99ff]/15 text-[#7dd3fc]' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Grid3x3 size={13} />
                    <span className="flex-1">12 Sütun Izgara</span>
                    <kbd className="text-[9px] font-mono text-zinc-500">Shift+G</kbd>
                  </button>
                  <button
                    type="button"
                    data-toggle-rulers
                    onClick={() => setShowRulers?.((v) => !v)}
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                      showRulers ? 'bg-[#0d99ff]/15 text-[#7dd3fc]' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Ruler size={13} />
                    <span className="flex-1">Piksel Cetvelleri</span>
                    <kbd className="text-[9px] font-mono text-zinc-500">Shift+R</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetZoom?.();
                      setOpenAddGroup(null);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <Maximize2 size={13} />
                    <span className="flex-1">Ekrana Sığdır</span>
                    <kbd className="text-[9px] font-mono text-zinc-500">Ctrl+0</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Duplicate (Ctrl+D) */}
            <button
              type="button"
              aria-label="Çoğalt"
              data-edit-action="duplicate"
              disabled={!hasSelection}
              onClick={onDuplicateSelected}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                !hasSelection ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <CopyPlus size={14} strokeWidth={1.9} />
              <RailTip label="Çoğalt" hint="Ctrl+D" />
            </button>

            {/* Arrange & Align Popover (Z-Order, Align, Group, Lock) */}
            <div className="relative w-full">
              <button
                type="button"
                aria-label="Sırala & Hizala"
                aria-expanded={openAddGroup === 'arrange'}
                data-rail-popover="arrange"
                disabled={!hasSelection}
                onClick={() => setOpenAddGroup(openAddGroup === 'arrange' ? null : 'arrange')}
                className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                  !hasSelection
                    ? 'text-zinc-700 cursor-not-allowed'
                    : openAddGroup === 'arrange'
                      ? 'bg-white/[0.12] text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <SlidersHorizontal size={14} strokeWidth={1.9} />
                <ChevronRight size={8} className="absolute right-0.5 bottom-0.5 opacity-60" />
                {openAddGroup !== 'arrange' && <RailTip label="Sırala, Hizala & Grupla" />}
              </button>
              {openAddGroup === 'arrange' && hasSelection && (
                <div className="absolute left-full bottom-0 ml-2.5 w-52 rounded-xl border border-[#34343e] bg-[#121216] p-1.5 shadow-2xl z-[90]">
                  <div className="px-2 pt-1 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-zinc-500 uppercase">Sıra, Hiza & Grup</div>
                  {[
                    { label: 'Öne Getir', hint: ']', icon: Layers, run: () => onZOrderSelected?.('forward') },
                    { label: 'En Öne Getir', hint: 'Ctrl+]', icon: ArrowUpToLine, run: () => onZOrderSelected?.('front') },
                    { label: 'Arkaya Gönder', hint: '[', icon: Layers, run: () => onZOrderSelected?.('backward') },
                    { label: 'En Arkaya Gönder', hint: 'Ctrl+[', icon: ArrowDownToLine, run: () => onZOrderSelected?.('back') },
                    { label: 'Yatay Ortala', hint: '', icon: AlignCenterHorizontal, run: onAlignHorizontalCenter },
                    { label: 'Dikey Ortala', hint: '', icon: AlignCenterVertical, run: onAlignVerticalCenter },
                    { label: 'Grupla', hint: 'Ctrl+G', icon: Group, run: onGroupSelected },
                    { label: 'Grubu Çöz', hint: 'Ctrl+Shift+G', icon: Ungroup, run: onUngroupSelected },
                    { label: selectedElement?.isLocked ? 'Kilidi Aç' : 'Kilitle', hint: 'Ctrl+Shift+L', icon: Lock, run: () => onToggleLockSelected?.() },
                  ].map((act) => {
                    const AIcon = act.icon;
                    return (
                      <button
                        key={act.label}
                        type="button"
                        onClick={() => {
                          act.run?.();
                          setOpenAddGroup(null);
                        }}
                        className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <AIcon size={13} className="text-zinc-400 shrink-0" />
                        <span className="flex-1 truncate">{act.label}</span>
                        {act.hint && <kbd className="text-[9px] font-mono text-zinc-500">{act.hint}</kbd>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              type="button"
              aria-label="Sil"
              data-edit-action="delete"
              disabled={!hasSelection}
              onClick={onDeleteSelected}
              className={`group relative w-full h-7 flex items-center justify-center rounded-lg transition-all ${
                !hasSelection ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-rose-500/80'
              }`}
            >
              <Trash2 size={14} strokeWidth={1.9} />
              <RailTip label="Sil" hint="Del" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. RESIZABLE ACTIVE PANEL DRAWER */}
      {activeTab && (
        <div
          style={{ width: `${activeTab === 'ai' ? Math.max(drawerWidth, 296) : drawerWidth}px` }}
          className="relative bg-[#18181b] flex flex-col h-full text-xs text-zinc-300 min-w-0"
        >
          {/* TAB 1: LAYERS */}
          {activeTab === 'layers' && (
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={13} className="text-[#38bdf8]" />
                  <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider">Katmanlar</span>
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400 bg-[#101013] border border-[#27272d] px-1.5 py-0.2 rounded">
                    {countAllNodes(elements)}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  {selectedIds.length > 1 && (
                    <button
                      type="button"
                      onClick={onGroupSelected}
                      title="Grupla (Ctrl+G)"
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                    >
                      <Group size={13} />
                    </button>
                  )}
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={onDeleteSelected}
                      title="Sil (Delete)"
                      className="p-1 text-zinc-400 hover:text-rose-400 rounded hover:bg-white/[0.06]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    title="Sol paneli gizle"
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                  >
                    <ChevronsLeft size={13} />
                  </button>
                </div>
              </div>

              <div className="px-2.5 py-2 border-b border-[#24242a]">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Katmanlarda ara..."
                    value={layerSearchTerm}
                    onChange={(e) => setLayerSearchTerm(e.target.value)}
                    className="w-full bg-[#101013] border border-[#2a2a32] rounded pl-7 pr-7 py-1 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#0d99ff]"
                  />
                  {layerSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setLayerSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
                {elements.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-[11px] leading-relaxed">
                    Tuval boş. Araçlardan veya şablonlardan ilk bileşeninizi ekleyebilirsiniz.
                  </div>
                ) : (
                  elements.map(node => renderLayerNode(node, 0))
                )}
              </div>

              <div className="px-3 py-1.5 bg-[#141417] border-t border-[#24242a] text-[10px] text-zinc-500 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Info size={10} className="text-zinc-400" />
                  <span>Çift tık: Adlandır</span>
                </span>
                <span>Sürükle: Taşı</span>
              </div>
            </div>
          )}

          {/* TAB 2: ELEMENTS & TOOLS */}
          {activeTab === 'elements' && (
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TagIcon size={13} className="text-[#38bdf8]" />
                  <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider">HTML Etiketleri</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  title="Sol paneli gizle"
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                >
                  <ChevronsLeft size={13} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      HTML5 Anlamsal Etiketler
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickAdd('tag_picker')}
                      className="text-[10px] text-[#38bdf8] hover:text-[#7dd3fc] font-semibold flex items-center gap-0.5"
                    >
                      <Plus size={11} />
                      <span>Tümünü Gör</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    {SEMANTIC_TAGS.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => onQuickAdd(item.tag)}
                        className="w-full text-left p-2 rounded bg-[#1c1c21] hover:bg-[#222229] border border-[#2a2a32] hover:border-[#0d99ff]/60 flex items-center justify-between group transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[#7dd3fc] font-semibold text-[10px] bg-[#101013] px-1.5 py-0.5 rounded-sm border border-[#27272d] shrink-0">
                            &lt;{item.tag}&gt;
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-zinc-100 text-[11px] block leading-tight truncate">{item.name}</span>
                            <span className="text-[9px] text-zinc-500 leading-none">{item.desc}</span>
                          </div>
                        </div>
                        <Plus size={12} className="text-zinc-500 group-hover:text-[#0d99ff] transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEMPLATES & PRESETS */}
          {activeTab === 'templates' && (
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutTemplate size={13} className="text-[#38bdf8]" />
                  <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider">Şablonlar &amp; Bloklar</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  title="Sol paneli gizle"
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                >
                  <ChevronsLeft size={13} />
                </button>
              </div>

              <div className="p-2.5 border-b border-[#24242a] space-y-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Şablon veya blok ara..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="w-full bg-[#101013] border border-[#2a2a32] rounded pl-7 pr-7 py-1 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#0d99ff]"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {templateCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors border ${
                        templateCategory === cat
                          ? 'bg-[#0d99ff]/18 text-white border-[#0d99ff] font-medium'
                          : 'bg-[#101013] text-zinc-400 border-[#27272d] hover:text-white'
                      }`}
                    >
                      {cat} <span className="opacity-65 font-normal">({presetCategoryCounts[cat] ?? 0})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {filteredAssets.map((asset, idx) => (
                  <div
                    key={asset.presetKey || idx}
                    onClick={() => onAddPreset(asset.element, asset.name, asset)}
                    className="bg-[#1c1c21] border border-[#2a2a32] hover:border-[#0d99ff]/60 rounded p-2.5 flex flex-col justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-medium text-zinc-100 text-[11px] truncate">{asset.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#101013] border border-[#27272d] text-zinc-400 font-mono shrink-0">
                        {asset.category}
                      </span>
                    </div>

                    {asset.description && (
                      <p className="text-[10px] text-zinc-400 mb-2 line-clamp-1">
                        {asset.description}
                      </p>
                    )}

                    <div className="h-16 bg-[#101013] rounded-sm border border-[#27272d] flex items-center justify-center p-2 mb-2 overflow-hidden">
                      <PresetThumbnail asset={asset} />
                    </div>

                    <button
                      type="button"
                      className="w-full py-1 rounded-sm bg-[#25252c] group-hover:bg-[#0d99ff] group-hover:text-white text-zinc-200 font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus size={11} />
                      <span>Sayfaya Ekle</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE CODE */}
          {activeTab === 'code' && (
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 size={13} className="text-emerald-400" />
                  <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider">Canlı Kod İnceleyici</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedElement && (
                    <span className="text-[10px] font-mono text-[#7dd3fc] font-medium bg-[#101013] border border-[#27272d] px-1.5 py-0.5 rounded-sm">
                      &lt;{selectedElement.type}&gt;
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    title="Sol paneli gizle"
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
                  >
                    <ChevronsLeft size={13} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {selectedElement ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                          HTML / JSX
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(elementToHtml(selectedElement));
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2000);
                          }}
                          className="text-[10px] text-[#38bdf8] hover:text-[#7dd3fc] flex items-center gap-1 font-medium"
                        >
                          {codeCopied ? <Check size={11} /> : <Copy size={11} />}
                          <span>{codeCopied ? 'Kopyalandı' : 'Kopyala'}</span>
                        </button>
                      </div>

                      <textarea
                        readOnly
                        value={elementToHtml(selectedElement)}
                        rows={8}
                        className="w-full bg-[#101013] border border-[#27272d] rounded p-2.5 text-[11px] font-mono text-emerald-300 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                        CSS Stilleri
                      </span>
                      <textarea
                        readOnly
                        value={styleObjectToCss(selectedElement.style || {})}
                        rows={7}
                        className="w-full bg-[#101013] border border-[#27272d] rounded p-2.5 text-[11px] font-mono text-sky-300 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-zinc-500 text-[11px] leading-relaxed">
                    Canlı HTML ve CSS kodunu incelemek için tuvalden bir bileşen seçin.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: GEMINI AI CHAT & CONVERSATION HISTORY */}
          {activeTab === 'ai' && (
            <LeftAiChatPanel
              aiChat={aiChat}
              onClosePanel={() => setActiveTab(null)}
            />
          )}

          {/* Right-Edge Smooth Width Splitter */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              resizeRef.current = { startX: e.clientX, startWidth: drawerWidth };
              setIsResizing(true);
            }}
            onDoubleClick={() => setDrawerWidth(DEFAULT_LEFT_WIDTH)}
            title="Panel genişliğini sürükle (çift tıkla: varsayılan)"
            className={`absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-30 transition-colors flex items-center justify-center group ${
              isResizing ? 'bg-[#0d99ff]/45' : 'hover:bg-[#0d99ff]/20'
            }`}
          >
            <span className={`w-0.5 h-10 rounded-sm transition-all ${
              isResizing
                ? 'bg-[#0d99ff] opacity-100 h-16'
                : 'bg-zinc-600 group-hover:bg-[#0d99ff] opacity-0 group-hover:opacity-100'
            }`} />
          </div>
        </div>
      )}
    </aside>
  );
}
