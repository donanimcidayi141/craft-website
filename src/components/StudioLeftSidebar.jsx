import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, Box, LayoutTemplate, Code2, MousePointer, Square, Hand,
  Type, Image as ImageIcon, RectangleHorizontal, Wand2, Plus,
  ArrowRightLeft, Eye, EyeOff, Lock, Unlock, Trash2, Group,
  ChevronRight, ChevronDown, Search, Sparkles, Copy, Check,
  ChevronsLeft, Info, Link2, Navigation, LayoutGrid, X
} from 'lucide-react';
import { canHaveChildren, isExplicitContainer } from '../utils/treeUtils.js';
import { PRESET_ASSETS } from '../constants.js';
import { elementToHtml, styleObjectToCss } from '../utils/codeSync.js';
import PresetThumbnail from './PresetThumbnail.jsx';

const DEFAULT_LEFT_WIDTH = 276;
const MIN_LEFT_WIDTH = 236;
const MAX_LEFT_WIDTH = 400;

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

export default function StudioLeftSidebar({
  activeTab = 'layers', // 'layers' | 'elements' | 'templates' | 'code' | null
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
  onGroupSelected,
  onUngroupSelected,
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
  // AI Agent props
  onToggleAIAgent,
  isAIAgentOpen,
  viewportMode = 'desktop',
}) {
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

  // Tools definition
  const tools = [
    { id: 'select', name: 'Seçim Aracı (V)', icon: MousePointer, shortcut: 'V' },
    { id: 'rectangle', name: 'Kutu / Dikdörtgen (R)', icon: Square, shortcut: 'R' },
    { id: 'text', name: 'Metin Aracı (T)', icon: Type, shortcut: 'T' },
    { id: 'button', name: 'Buton Aracı (B)', icon: RectangleHorizontal, shortcut: 'B' },
    { id: 'image', name: 'Görsel Aracı (I)', icon: ImageIcon, shortcut: 'I' },
    { id: 'hand', name: 'El / Pan (H)', icon: Hand, shortcut: 'H' },
  ];

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
    { id: 'elements', title: 'Bileşenler & Çizim Araçları', icon: Box },
    { id: 'templates', title: 'Şablonlar & Hazır Bloklar', icon: LayoutTemplate },
    { id: 'code', title: 'Canlı Kod İnceleyici (JSX & CSS)', icon: Code2 },
  ];

  return (
    <aside className="flex h-full bg-[#18181b] border-r border-[#2c2c32] select-none z-30 relative">
      {/* 1. PRO VERTICAL TOOL RAIL (44px) */}
      <div className="w-11 bg-[#141417] border-r border-[#27272d] flex flex-col items-center justify-between py-2 z-10 shrink-0">
        {/* Top Tabs */}
        <div className="flex flex-col items-center gap-1 w-full px-1">
          {railTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(isActive ? null : item.id)}
                title={item.title}
                className={`relative w-full h-8 flex items-center justify-center rounded transition-colors border ${
                  isActive
                    ? 'bg-[#23232b] text-white border-[#383844]'
                    : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/[0.05]'
                }`}
              >
                {isActive && (
                  <span className="absolute -left-1 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[#0d99ff]" />
                )}
                <Icon size={15} strokeWidth={1.75} />
              </button>
            );
          })}

          {onToggleAIAgent && (
            <>
              <div className="w-4 h-px bg-[#2c2c32] my-1" />
              <button
                type="button"
                onClick={onToggleAIAgent}
                title="Gemini AI Tasarım Ajanı (API ile Site Tasarla)"
                className={`relative w-full h-8 flex items-center justify-center rounded transition-colors border ${
                  isAIAgentOpen
                    ? 'bg-[#1a222b] border-[#2c435a] text-[#7dd3fc]'
                    : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/[0.05]'
                }`}
              >
                <Sparkles size={15} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>

        {/* Bottom Color Swatches */}
        <div className="flex flex-col items-center w-full px-1 relative" ref={colorModalRef}>
          <div className="relative w-7 h-7 mb-1">
            <button
              type="button"
              onClick={() => {
                setEditingColorType('secondary');
                setShowColorModal(true);
              }}
              title="İkincil / Zemin Rengi"
              style={{ backgroundColor: secondaryColor }}
              className="absolute bottom-0 right-0 w-4 h-4 rounded-sm border border-[#141417] ring-1 ring-white/20"
            />
            <button
              type="button"
              onClick={() => {
                setEditingColorType('primary');
                setShowColorModal(true);
              }}
              title="Birincil / Vurgu Rengi"
              style={{ backgroundColor: primaryColor }}
              className="absolute top-0 left-0 w-4 h-4 rounded-sm border border-white/30 z-10"
            />
          </div>

          <button
            type="button"
            onClick={handleSwapColors}
            title="Renkleri Değiştir (X)"
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-white/[0.05] transition-colors"
          >
            <ArrowRightLeft size={10} />
          </button>

          {showColorModal && (
            <div className="absolute left-12 bottom-2 bg-[#18181b] border border-[#2f2f38] rounded-md p-3 shadow-2xl z-50 w-56 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-white">
                  {editingColorType === 'primary' ? 'Birincil Renk' : 'İkincil Renk'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowColorModal(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/[0.08]"
                >
                  <X size={12} />
                </button>
              </div>

              <input
                type="color"
                value={editingColorType === 'primary' ? primaryColor : secondaryColor}
                onChange={(e) => {
                  if (editingColorType === 'primary') setPrimaryColor(e.target.value);
                  else setSecondaryColor(e.target.value);
                }}
                className="w-full h-8 cursor-pointer rounded-lg border border-white/[0.1] bg-transparent"
              />

              <div className="flex items-center gap-1.5 bg-[#0b0d12] border border-white/[0.08] rounded-lg px-2 py-1">
                <span className="text-[10px] text-slate-500 font-mono">HEX</span>
                <input
                  type="text"
                  value={editingColorType === 'primary' ? primaryColor : secondaryColor}
                  onChange={(e) => {
                    if (editingColorType === 'primary') setPrimaryColor(e.target.value);
                    else setSecondaryColor(e.target.value);
                  }}
                  className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-white/[0.07]">
                {['#f59e0b', '#f8fafc', '#0f172a', '#e2e8f0', '#ffffff', '#ef4444', '#10b981', '#38bdf8', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (editingColorType === 'primary') setPrimaryColor(c);
                      else setSecondaryColor(c);
                    }}
                    style={{ backgroundColor: c }}
                    className="w-6 h-6 rounded-md border border-white/15 hover:scale-110 transition-transform"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. RESIZABLE ACTIVE PANEL DRAWER */}
      {activeTab && (
        <div
          style={{ width: `${drawerWidth}px` }}
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
                  <Box size={13} className="text-[#38bdf8]" />
                  <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider">Araçlar &amp; Etiketler</span>
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Çizim &amp; Seçim Araçları
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {tools.map((t) => {
                      const Icon = t.icon;
                      const isActive = activeTool === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setActiveTool(t.id);
                            if (['rectangle', 'text', 'button', 'image'].includes(t.id)) {
                              onQuickAdd(t.id);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-colors border ${
                            isActive
                              ? 'bg-[#0d99ff]/18 text-white border-[#0d99ff] font-medium'
                              : 'bg-[#1c1c21] text-zinc-300 border-[#2a2a32] hover:border-[#3e3e48] hover:text-white'
                          }`}
                        >
                          <Icon size={15} />
                          <span className="text-[10px] mt-1 font-medium">{t.name.split(' ')[0]}</span>
                          <kbd className="text-[9px] font-mono text-zinc-500 mt-0.5">{t.shortcut}</kbd>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onRemoveBackground}
                    disabled={!selectedElement}
                    className={`w-full py-1.5 px-3 rounded border flex items-center justify-center gap-2 transition-colors ${
                      selectedElement
                        ? 'bg-[#202026] border-[#32323c] text-zinc-100 hover:bg-[#282830]'
                        : 'bg-[#141418] border-[#24242a] text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <Wand2 size={12} className="text-[#38bdf8]" />
                    <span className="font-medium text-[11px]">Arka Planı Kaldır (AI)</span>
                  </button>
                </div>

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
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/[0.06]"
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
                      {cat}
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
