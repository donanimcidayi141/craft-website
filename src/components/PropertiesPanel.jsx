import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, Move, Maximize2, Palette, Shield, Sparkles, 
  CornerUpLeft, CornerUpRight, CornerDownRight, CornerDownLeft, 
  Link, Unlink, Type, AlignLeft, AlignCenter, AlignRight, 
  Layers, Trash2, Copy, X, Anchor, Pin, 
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  BoxSelect, Box, Group, Ungroup, Plus, Search, Code2, Eye, EyeOff, Tag as TagIcon,
  Check, ChevronDown, ChevronRight, CheckSquare, Square, Paintbrush, RefreshCw, Monitor, Tablet, Smartphone,
  Zap, Play, Wand2, Info, AlertTriangle, ExternalLink, LayoutGrid
} from 'lucide-react';
import { 
  ALL_HTML_TAGS, TAG_INFO, isVoidTag, COMMON_ATTRIBUTES_PER_TAG, 
  getValidAttributesForTag, getAttributeInputType, ALL_CSS_PROPERTIES, 
  getCommonStyleKeysForTag 
} from '../data/tagRegistry';
import { elementToHtml, htmlToElementData, styleObjectToCss, cssToStyleObject } from '../utils/codeSync';
import { 
  flattenTree, findNodeAndParent, getNodePath, getAbsoluteCoords, isExplicitContainer,
  distributeChildrenInContainer, centerElementsSmart 
} from '../utils/treeUtils';
import { sanitizeFunctionIdentifier } from '../utils/interactionEngine';
import { COLOR_PALETTES, ANIMATION_PRESETS, HOVER_PRESETS, TEXT_SHADOW_PRESETS } from '../constants';
import TagPickerModal from './TagPickerModal';
import SearchableOptionCombobox from './SearchableOptionCombobox';
import BlockCustomizer from './BlockCustomizer';
import { findOwningBlock } from '../utils/blockCustomizerUtils';
import { toCamelCaseCss, toKebabCaseCss } from '../utils/propertySearch';

/**
 * Collapsible inspector section so advanced controls stay calm and scannable.
 */
function InspectorSection({ title, icon: Icon = null, badge = null, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#18181b] rounded border border-[#27272d] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 min-w-0 truncate">
          {Icon && <Icon size={12} className="text-[#0d99ff] shrink-0" />}
          <span className="truncate">{title}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#101013] border border-[#27272d] text-zinc-400 font-mono">
              {badge}
            </span>
          )}
          {isOpen ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1.5 border-t border-[#27272d]/80 space-y-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

// 🌟 BACKGROUND & GRADIENT PICKER COMPONENT
function BackgroundGradientPicker({ value = '#ffffff', onChange, label = 'Arka Plan' }) {
  const isGradient = (value || '').includes('gradient');
  const [mode, setMode] = useState(isGradient ? 'gradient' : 'solid');
  
  const [gradType, setGradType] = useState('linear');
  const [angle, setAngle] = useState(135);
  const [color1, setColor1] = useState('#2563eb');
  const [color2, setColor2] = useState('#1d4ed8');
  const [solidColor, setSolidColor] = useState(isGradient ? '#0f172a' : (value || '#ffffff'));

  useEffect(() => {
    if ((value || '').includes('gradient')) {
      setMode('gradient');
      const angleMatch = value.match(/(\d+)deg/);
      if (angleMatch) setAngle(parseInt(angleMatch[1], 10));
      const hexMatches = value.match(/#[a-fA-F0-9]{3,8}/g);
      if (hexMatches && hexMatches.length >= 2) {
        setColor1(hexMatches[0]);
        setColor2(hexMatches[1]);
      }
    } else if (value && !value.includes('gradient')) {
      setMode('solid');
      if (value.startsWith('#') || value.startsWith('rgb')) {
        setSolidColor(value);
      }
    }
  }, [value]);

  const handleSolidChange = (newCol) => {
    setSolidColor(newCol);
    onChange(newCol);
  };

  const handleGradientChange = (newAngle, c1, c2, type = gradType) => {
    setAngle(newAngle);
    setColor1(c1);
    setColor2(c2);
    setGradType(type);
    const grad = type === 'linear'
      ? `linear-gradient(${newAngle}deg, ${c1} 0%, ${c2} 100%)`
      : `radial-gradient(circle, ${c1} 0%, ${c2} 100%)`;
    onChange(grad);
  };

  const PRESETS = [
    { name: 'Okyanus Mavi', c1: '#2563eb', c2: '#1d4ed8', a: 135 },
    { name: 'Gece Yarısı', c1: '#0f172a', c2: '#1e1b4b', a: 135 },
    { name: 'Gün Batımı', c1: '#f97316', c2: '#db2777', a: 135 },
    { name: 'Zümrüt', c1: '#059669', c2: '#047857', a: 135 },
    { name: 'Neon Mor', c1: '#7c3aed', c2: '#4f46e5', a: 135 },
    { name: 'Altın Işıltı', c1: '#d97706', c2: '#78350f', a: 135 },
    { name: 'Minimal Açık', c1: '#f8fafc', c2: '#e2e8f0', a: 180 },
    { name: 'Koyu Siyah', c1: '#18181b', c2: '#09090b', a: 135 },
  ];

  const SOLID_PALETTE = [
    '#ffffff', '#0f172a', '#1e293b', '#2563eb', '#3b82f6', 
    '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 'transparent'
  ];

  return (
    <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-2.5">
      {/* Top Header & Mode Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="flex bg-[#101013] p-0.5 rounded border border-[#27272d]">
          <button
            type="button"
            onClick={() => {
              setMode('solid');
              onChange(solidColor);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              mode === 'solid' ? 'bg-[#222228] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Düz Renk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('gradient');
              handleGradientChange(angle, color1, color2, gradType);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1 ${
              mode === 'gradient' ? 'bg-[#0d99ff] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Gradyan</span>
            <Sparkles size={10} />
          </button>
        </div>
      </div>

      {/* Live Preview Stripe */}
      <div
        className="w-full h-7 rounded border border-[#2c2c32] transition-all flex items-center justify-center overflow-hidden"
        style={{ background: value || '#ffffff' }}
      >
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/55 text-white/95 backdrop-blur-sm truncate max-w-[90%]">
          {value || '#ffffff'}
        </span>
      </div>

      {/* DÜZ RENK (SOLID) MODE */}
      {mode === 'solid' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-[#101013] p-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff]">
            <div className="relative w-7 h-7 rounded border border-[#3f3f46] overflow-hidden flex-shrink-0 cursor-pointer">
              <input
                type="color"
                value={solidColor.startsWith('#') ? solidColor : '#ffffff'}
                onChange={(e) => handleSolidChange(e.target.value)}
                className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0"
              />
            </div>
            <input
              type="text"
              value={solidColor}
              onChange={(e) => handleSolidChange(e.target.value)}
              className="w-full bg-transparent text-zinc-100 font-mono text-xs focus:outline-none"
              placeholder="#ffffff veya transparent"
            />
          </div>

          {/* Quick Palette Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {SOLID_PALETTE.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => handleSolidChange(col)}
                title={col}
                style={{ backgroundColor: col === 'transparent' ? '#333' : col }}
                className={`w-5 h-5 rounded border border-[#3f3f46] hover:scale-110 transition-transform ${
                  solidColor === col ? 'ring-2 ring-[#0d99ff] scale-105' : ''
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* GRADYAN (GRADIENT) MODE */}
      {mode === 'gradient' && (
        <div className="space-y-3 pt-1">
          {/* Angle / Direction Slider & Quick Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-neutral-400">Açı (Yön)</span>
              <span className="font-mono text-blue-400 font-bold">{angle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={angle}
              onChange={(e) => handleGradientChange(parseInt(e.target.value, 10), color1, color2)}
              className="w-full studio-slider"
            />
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {[
                { label: '0° ↑', a: 0 },
                { label: '45° ↗', a: 45 },
                { label: '90° →', a: 90 },
                { label: '135° ↘', a: 135 },
                { label: '180° ↓', a: 180 },
              ].map(btn => (
                <button
                  key={btn.a}
                  type="button"
                  onClick={() => handleGradientChange(btn.a, color1, color2)}
                  className={`py-0.5 text-[9px] rounded font-mono border ${
                    angle === btn.a 
                      ? 'bg-[#0d99ff]/20 border-[#0d99ff] text-[#38bdf8] font-bold' 
                      : 'bg-[#101013] border-[#2c2c32] text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color 1 & Color 2 Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#101013] p-1.5 rounded border border-[#2c2c32] space-y-1">
              <span className="text-[9px] text-zinc-400 block font-medium">1. Renk (Başlangıç)</span>
              <div className="flex items-center gap-1.5">
                <div className="relative w-6 h-6 rounded border border-[#3f3f46] overflow-hidden flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={color1.startsWith('#') ? color1 : '#2563eb'}
                    onChange={(e) => handleGradientChange(angle, e.target.value, color2)}
                    className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  type="text"
                  value={color1}
                  onChange={(e) => handleGradientChange(angle, e.target.value, color2)}
                  className="w-full bg-transparent text-zinc-100 font-mono text-[10px] focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-[#101013] p-1.5 rounded border border-[#2c2c32] space-y-1">
              <span className="text-[9px] text-zinc-400 block font-medium">2. Renk (Bitiş)</span>
              <div className="flex items-center gap-1.5">
                <div className="relative w-6 h-6 rounded border border-[#3f3f46] overflow-hidden flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={color2.startsWith('#') ? color2 : '#1d4ed8'}
                    onChange={(e) => handleGradientChange(angle, color1, e.target.value)}
                    className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  type="text"
                  value={color2}
                  onChange={(e) => handleGradientChange(angle, color1, e.target.value)}
                  className="w-full bg-transparent text-zinc-100 font-mono text-[10px] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ready Gradyan Presets */}
          <div className="space-y-1 pt-1 border-t border-[#27272d]">
            <span className="text-[9px] text-zinc-400 block font-medium">Hazır Gradyan Şablonları</span>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleGradientChange(p.a, p.c1, p.c2)}
                  style={{ background: `linear-gradient(${p.a}deg, ${p.c1}, ${p.c2})` }}
                  title={`${p.name} (${p.c1} → ${p.c2})`}
                  className="h-6 rounded border border-[#3f3f46] hover:scale-105 transition-transform flex items-center justify-center"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🌟 COMPREHENSIVE BORDER & CORNER MANAGER
function BorderManager({ style = {}, onChange, onUpdateStyle }) {
  const [activeSide, setActiveSide] = useState('all'); // 'all' | 'bottom' | 'top' | 'left' | 'right'

  // Extract side-specific or general border settings
  const getValues = (side) => {
    let raw = '';
    if (side === 'bottom') raw = style.borderBottom || '';
    else if (side === 'top') raw = style.borderTop || '';
    else if (side === 'left') raw = style.borderLeft || '';
    else if (side === 'right') raw = style.borderRight || '';
    else raw = style.border || (style.borderWidth ? `${style.borderWidth} ${style.borderStyle || 'solid'} ${style.borderColor || '#38322c'}` : '');

    let width = '1px';
    let bStyle = 'solid';
    let color = '#3b82f6';

    if (raw) {
      const parts = raw.trim().split(/\s+/);
      parts.forEach(p => {
        if (p.includes('px') || p.includes('rem') || !isNaN(p)) width = p.includes('px') ? p : `${p}px`;
        else if (['solid', 'dashed', 'dotted', 'double', 'none'].includes(p)) bStyle = p;
        else if (p.startsWith('#') || p.startsWith('rgb') || p.startsWith('hsl')) color = p;
      });
    }

    if (side === 'all') {
      if (style.borderWidth) width = style.borderWidth.includes('px') ? style.borderWidth : `${style.borderWidth}px`;
      if (style.borderStyle) bStyle = style.borderStyle;
      if (style.borderColor) color = style.borderColor;
    }

    return { width, bStyle, color };
  };

  const current = getValues(activeSide);

  const applyBorder = (w, s, c, side = activeSide) => {
    const formattedWidth = w.includes('px') ? w : `${w}px`;
    const val = `${formattedWidth} ${s} ${c}`;
    if (side === 'all') {
      onChange({
        border: val,
        borderWidth: formattedWidth,
        borderStyle: s,
        borderColor: c,
        borderTop: undefined,
        borderBottom: undefined,
        borderLeft: undefined,
        borderRight: undefined,
      });
    } else if (side === 'bottom') {
      onChange({ borderBottom: val, border: undefined });
    } else if (side === 'top') {
      onChange({ borderTop: val, border: undefined });
    } else if (side === 'left') {
      onChange({ borderLeft: val, border: undefined });
    } else if (side === 'right') {
      onChange({ borderRight: val, border: undefined });
    }
  };

  const BORDER_PALETTE = [
    '#3b82f6', '#2563eb', '#0f172a', '#e2e8f0', '#64748b', 
    '#10b981', '#f59e0b', '#ef4444', '#ffffff'
  ];

  return (
    <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Kenarlık & Çerçeve (Border)
        </span>
        <span className="text-[9px] text-[#38bdf8] font-mono font-semibold">
          {activeSide === 'all' ? 'Tüm Kenarlar' : activeSide === 'bottom' ? 'Alt Kenarlık (border-bottom)' : activeSide === 'top' ? 'Üst Kenarlık (border-top)' : activeSide === 'left' ? 'Sol Kenarlık (border-left)' : 'Sağ Kenarlık (border-right)'}
        </span>
      </div>

      {/* 1. Kenar Seçimi Düğmeleri */}
      <div className="grid grid-cols-5 gap-1 bg-[#101013] p-1 rounded border border-[#27272d]">
        {[
          { id: 'all', label: 'Tümü' },
          { id: 'bottom', label: 'Alt' },
          { id: 'top', label: 'Üst' },
          { id: 'left', label: 'Sol' },
          { id: 'right', label: 'Sağ' },
        ].map(btn => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setActiveSide(btn.id)}
            className={`py-1 text-[10px] font-semibold rounded transition-all ${
              activeSide === btn.id
                ? 'bg-[#0d99ff] text-white'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222228]'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 2. Kalınlık & Çizgi Stili */}
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-400 shrink-0">Kalınlık</span>
          <input
            type="text"
            value={current.width}
            onChange={(e) => applyBorder(e.target.value, current.bStyle, current.color)}
            className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
            placeholder="1px"
          />
        </div>

        <select
          value={current.bStyle}
          onChange={(e) => applyBorder(current.width, e.target.value, current.color)}
          className="min-w-0 bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff] font-mono"
        >
          <option value="solid">Düz (Solid)</option>
          <option value="dashed">Kesikli (Dashed)</option>
          <option value="dotted">Noktalı (Dotted)</option>
          <option value="double">Çift (Double)</option>
          <option value="none">Kenarlık Yok</option>
        </select>
      </div>

      {/* 3. Görsel Renk Seçici (Visual Color Picker + Swatch + Hex) */}
      <div className="space-y-1.5">
        <span className="text-[9px] text-zinc-400 font-medium block">Kenarlık Rengi (Border Color)</span>
        <div className="flex items-center gap-2 bg-[#101013] p-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] min-w-0">
          {/* Visual Color Preview Box */}
          <div 
            className="relative w-7 h-7 rounded border border-[#3f3f46] overflow-hidden shrink-0 cursor-pointer"
            style={{ backgroundColor: current.color }}
            title="Rengi değiştirmek için tıkla"
          >
            <input
              type="color"
              value={current.color.startsWith('#') ? current.color : '#3b82f6'}
              onChange={(e) => applyBorder(current.width, current.bStyle, e.target.value)}
              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0 opacity-0"
            />
          </div>
          <input
            type="text"
            value={current.color}
            onChange={(e) => applyBorder(current.width, current.bStyle, e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none"
            placeholder="#3b82f6"
          />
        </div>

        {/* Quick color chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {BORDER_PALETTE.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => applyBorder(current.width, current.bStyle, col)}
              style={{ backgroundColor: col }}
              title={col}
              className={`w-4 h-4 rounded-full border border-[#3f3f46] hover:scale-125 transition-transform shrink-0 ${
                current.color === col ? 'ring-2 ring-[#0d99ff] scale-110' : ''
              }`}
            />
          ))}
        </div>
      </div>

      {/* 4. Köşe Yuvarlama (Border Radius) */}
      <div className="pt-2 border-t border-[#27272d] flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] text-zinc-400 shrink-0">Köşe Yuvarlama</span>
        <div className="bg-[#101013] px-2 py-1 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center flex-1 min-w-0 max-w-[130px]">
          <input
            type="text"
            value={style.borderRadius || ''}
            onChange={(e) => onUpdateStyle('borderRadius', e.target.value)}
            className="w-full min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
            placeholder="12px"
          />
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPanel({
  selectedIds = [],
  elements = [],
  onSelectElement = null,
  onUpdateElement,
  onUpdateElementDirect,
  onUpdateResolvedElements = null,
  onUpdateMultipleElements,
  onDeleteSelected,
  onDuplicateSelected,
  onGroupSelected,
  onUngroupSelected,
  onWrapSelected = null,
  onUnwrapElement = null,
  canvasSettings,
  onUpdateCanvasSettings,
  onCommitHistory,
  onClose,
  onOpenAttributesInspector,
  viewportMode = 'desktop',
  onResetViewportFromDesktop,
  controlledTab = null,
  onTabChange = null,
  tabs = [],
  projectFunctions = [],
  onOpenFunctionEditor = null,
  onDeleteProjectFunction = null,
}) {
  const flatElements = flattenTree(elements);
  const selectedElements = flatElements.filter(el => selectedIds.includes(el.id));
  const singleElement = selectedElements.length === 1 ? selectedElements[0] : null;

  // Active Tab: 'style' (Stil), 'layout' (Düzen), 'props' (Nitelik), 'css' (CSS Kuralları), 'code' (Kod)
  const [internalPanelTab, setInternalPanelTab] = useState('layout');
  const activePanelTab = controlledTab || internalPanelTab;
  const setActivePanelTab = (nextTab) => {
    setInternalPanelTab(nextTab);
    if (onTabChange) onTabChange(nextTab);
  };

  // Tag Changer Modal State
  const [showTagModal, setShowTagModal] = useState(false);

  // Quick manual CSS entry state & auto-focus refs for newly added properties
  const [inlineCssKey, setInlineCssKey] = useState('');
  const [inlineCssVal, setInlineCssVal] = useState('');
  const [lastAddedCssKey, setLastAddedCssKey] = useState(null);
  const cssValueInputRefs = useRef({});

  // Auto-focus newly added CSS rule value input so user can type its value immediately
  useEffect(() => {
    if (!lastAddedCssKey) return undefined;
    const timer = setTimeout(() => {
      const target = cssValueInputRefs.current[lastAddedCssKey];
      if (target && typeof target.focus === 'function') {
        target.focus();
        if (typeof target.select === 'function') {
          target.select();
        }
      }
      setLastAddedCssKey(null);
    }, 30);
    return () => clearTimeout(timer);
  }, [lastAddedCssKey]);

  // Live Code Editor local states for smooth typing
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [codeError, setCodeError] = useState(null);

  // Sync code editors whenever singleElement changes externally
  useEffect(() => {
    if (singleElement) {
      setHtmlCode(elementToHtml(singleElement));
      setCssCode(styleObjectToCss(singleElement.style || {}));
      setCodeError(null);
    }
  }, [singleElement?.id, singleElement?.type, JSON.stringify(singleElement?.attrs), JSON.stringify(singleElement?.style), singleElement?.textContent]);

  // 1. IF NO ELEMENT SELECTED: Canvas / Artboard properties
  if (selectedElements.length === 0) {
    return (
      <div className="w-full min-w-0 bg-[#141417] flex flex-col h-full text-xs text-zinc-300 select-none">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#27272d] bg-[#18181b]">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
            <Sliders size={14} className="text-[#38bdf8]" />
            <span>Sayfa Ayarları (Artboard)</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]">
            <X size={13} />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          {/* Active Device View Banner */}
          <div className={`p-2.5 rounded border flex flex-col gap-2 ${
            viewportMode === 'mobile'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : viewportMode === 'tablet'
              ? 'bg-[#0d99ff]/10 border-[#0d99ff]/35 text-sky-200'
              : 'bg-[#18181b] border-[#27272d] text-zinc-300'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                {viewportMode === 'mobile' ? <Smartphone size={13} /> : viewportMode === 'tablet' ? <Tablet size={13} /> : <Monitor size={13} />}
                <span>{viewportMode === 'mobile' ? 'Mobil Görünüm (375px)' : viewportMode === 'tablet' ? 'Tablet Görünümü (768px)' : 'Masaüstü Görünüm (1280px)'}</span>
              </span>
              <span className="text-[9px] uppercase tracking-wider opacity-80">Bağımsız Düzen</span>
            </div>
            <p className="text-[10px] opacity-80 leading-relaxed">
              {viewportMode === 'desktop'
                ? 'Ana tasarım katmanları ve stiller burada tanımlanır.'
                : 'Konum, boyut, stil ve gizleme değişiklikleri yalnızca bu cihaz görünümüne kaydedilir.'}
            </p>
            {viewportMode !== 'desktop' && onResetViewportFromDesktop && (
              <button
                type="button"
                onClick={onResetViewportFromDesktop}
                className="w-full py-1.5 px-2.5 rounded bg-[#18181b] hover:bg-[#0d99ff]/15 border border-[#2c2c32] hover:border-[#0d99ff]/40 text-[#38bdf8] font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Masaüstünden Yeniden Uyarla</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Sayfa Boyutları (px)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#101013] p-2 rounded border border-[#2c2c32]">
                <span className="text-[10px] text-zinc-500 block">Genişlik (W)</span>
                <input
                  type="number"
                  value={canvasSettings.width}
                  onChange={(e) => onUpdateCanvasSettings({ width: Number(e.target.value) })}
                  className="w-full bg-transparent text-zinc-100 font-mono text-sm focus:outline-none tabular-nums"
                />
              </div>
              <div className="bg-[#101013] p-2 rounded border border-[#2c2c32]">
                <span className="text-[10px] text-zinc-500 block">Yükseklik (H)</span>
                <input
                  type="number"
                  value={canvasSettings.height}
                  onChange={(e) => onUpdateCanvasSettings({ height: Number(e.target.value) })}
                  className="w-full bg-transparent text-zinc-100 font-mono text-sm focus:outline-none tabular-nums"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2 flex items-start gap-1.5 leading-relaxed">
              <Info size={11} className="text-[#38bdf8] shrink-0 mt-0.5" />
              <span>Sayfanın altındaki <strong className="text-zinc-200">&quot;Sayfa Boyunu Uzat&quot;</strong> tutamacıyla da sayfayı aşağı doğru çekip uzatabilirsiniz.</span>
            </p>
          </div>

          <div>
            <BackgroundGradientPicker
              value={canvasSettings.backgroundColor || canvasSettings.background || '#ffffff'}
              onChange={(newVal) => onUpdateCanvasSettings({ backgroundColor: newVal, background: newVal })}
              label="Sayfa Arka Planı & Gradyan"
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. MULTI-SELECTION MODE
  if (selectedElements.length > 1) {
    const isAnyGrouped = selectedElements.some(el => el.groupId);

    // Compute absolute coordinates for robust multi-alignment
    const absItems = selectedElements.map(el => {
      const abs = getAbsoluteCoords(elements, el.id);
      const parent = findNodeAndParent(elements, el.id)?.parent;
      const parentAbs = parent ? getAbsoluteCoords(elements, parent.id) : { x: 0, y: 0 };
      return { el, abs, parentAbs };
    });

    const minAbsX = Math.min(...absItems.map(item => item.abs.x));
    const maxAbsX = Math.max(...absItems.map(item => item.abs.x + item.abs.width));
    const minAbsY = Math.min(...absItems.map(item => item.abs.y));
    const maxAbsY = Math.max(...absItems.map(item => item.abs.y + item.abs.height));
    const totalW = maxAbsX - minAbsX;
    const totalH = maxAbsY - minAbsY;

    const handleAlignMultiLeft = () => {
      const updates = {};
      absItems.forEach(item => {
        updates[item.el.id] = { x: Math.round(minAbsX - item.parentAbs.x) };
      });
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    const handleAlignMultiRight = () => {
      const updates = {};
      absItems.forEach(item => {
        updates[item.el.id] = { x: Math.round(maxAbsX - item.abs.width - item.parentAbs.x) };
      });
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    const handleAlignMultiTop = () => {
      const updates = {};
      absItems.forEach(item => {
        updates[item.el.id] = { y: Math.round(minAbsY - item.parentAbs.y) };
      });
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    const handleAlignMultiBottom = () => {
      const updates = {};
      absItems.forEach(item => {
        updates[item.el.id] = { y: Math.round(maxAbsY - item.abs.height - item.parentAbs.y) };
      });
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    const handleAlignMultiHorizontalCenter = () => {
      const { updates } = centerElementsSmart(elements, selectedIds, canvasSettings.width, canvasSettings.height, 'x');
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    const handleAlignMultiVerticalCenter = () => {
      const { updates } = centerElementsSmart(elements, selectedIds, canvasSettings.width, canvasSettings.height, 'y');
      onUpdateMultipleElements(updates);
      if (onCommitHistory) onCommitHistory();
    };

    return (
      <div className="w-full min-w-0 bg-[#141417] flex flex-col h-full text-xs text-zinc-300 select-none">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#27272d] bg-[#18181b]">
          <div className="flex items-center gap-2 font-semibold text-zinc-100">
            <span className="w-2 h-2 rounded-full bg-[#0d99ff]"></span>
            <span>Çoklu Seçim ({selectedElements.length} Öğe)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onDeleteSelected}
              title="Seçilenleri Sil (Delete)"
              className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-[#222228]"
            >
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]">
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Grup Yönetimi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onGroupSelected}
                className="py-2 px-3 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 border border-[#0d99ff]/40 text-[#38bdf8] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Group size={14} />
                <span>Grupla (Ctrl+G)</span>
              </button>
              <button
                onClick={onUngroupSelected}
                disabled={!isAnyGrouped}
                className="py-2 px-3 rounded bg-[#101013] hover:bg-[#222228] border border-[#2c2c32] text-zinc-300 disabled:opacity-40 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Ungroup size={14} />
                <span>Grubu Çöz</span>
              </button>
            </div>
            {onWrapSelected && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#27272d]">
                <button
                  type="button"
                  onClick={() => onWrapSelected('a', { withBox: false })}
                  className="py-1.5 px-2.5 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 border border-[#0d99ff]/35 text-[#38bdf8] font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                >
                  <Link size={12} />
                  <span>&lt;a&gt; Link ile Sar</span>
                </button>
                <button
                  type="button"
                  onClick={() => onWrapSelected('button', { withBox: false })}
                  className="py-1.5 px-2.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                >
                  <Zap size={12} />
                  <span>&lt;button&gt; ile Sar</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <BoxSelect size={13} />
              <span>Birlikte Hizalama</span>
            </label>
            <div className="grid grid-cols-6 gap-1 bg-[#101013] border border-[#27272d] p-1 rounded">
              <button onClick={handleAlignMultiLeft} title="Sola Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignStartVertical size={13} />
              </button>
              <button onClick={handleAlignMultiHorizontalCenter} title="Yatayda Merkeze Hizala" className="p-1.5 rounded hover:bg-[#222228] text-[#38bdf8] flex items-center justify-center">
                <AlignHorizontalJustifyCenter size={14} />
              </button>
              <button onClick={handleAlignMultiRight} title="Sağa Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignEndVertical size={13} />
              </button>
              <button onClick={handleAlignMultiTop} title="Üste Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignStartHorizontal size={13} />
              </button>
              <button onClick={handleAlignMultiVerticalCenter} title="Dikeyde Merkeze Hizala" className="p-1.5 rounded hover:bg-[#222228] text-[#38bdf8] flex items-center justify-center">
                <AlignVerticalJustifyCenter size={14} />
              </button>
              <button onClick={handleAlignMultiBottom} title="Alta Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignEndHorizontal size={13} />
              </button>
            </div>
          </div>

          <div className="bg-[#18181b] p-3 rounded border border-[#27272d]">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Toplam Boyut
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-100 tabular-nums">
              <div className="bg-[#101013] border border-[#2c2c32] p-1.5 rounded">W: {Math.round(totalW)}px</div>
              <div className="bg-[#101013] border border-[#2c2c32] p-1.5 rounded">H: {Math.round(totalH)}px</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. SINGLE ELEMENT MODE
  const el = singleElement;
  const currentTag = (el.type || 'div').toLowerCase();
  const isVoid = isVoidTag(currentTag);
  const tagInfo = TAG_INFO[currentTag];

  // Common attributes for this tag
  const commonAttrsConfig = [
    { name: 'id', type: 'text', label: 'ID (id)' },
    { name: 'class', type: 'text', label: 'Class (class)' },
    ...(COMMON_ATTRIBUTES_PER_TAG[currentTag] || [])
  ];
  const commonAttrNames = new Set(commonAttrsConfig.map(a => a.name));

  // Custom attributes that were added dynamically via "+ Ekle"
  const currentAttrs = el.attrs || {};
  const customAttrEntries = Object.entries(currentAttrs).filter(([k]) => !commonAttrNames.has(k));

  // Valid attributes formatted for SearchableOptionCombobox
  const allValidAttrsForTag = getValidAttributesForTag(currentTag);
  const addableAttributeItems = allValidAttrsForTag
    .filter((attr) => attr !== 'id' && attr !== 'class')
    .map((attr) => ({
      key: attr,
      label: `Tür: ${getAttributeInputType(attr)}`,
    }));

  // Style attributes
  const currentStyle = el.style || {};
  const nodePath = getNodePath(elements, el.id) || [el];
  const hasChildren = Array.isArray(el.children) && el.children.length > 0;
  const isBoxStyled =
    (el.fillColor && el.fillColor !== 'transparent') ||
    (el.borderWidth && el.borderWidth > 0) ||
    Boolean(currentStyle.backgroundColor && currentStyle.backgroundColor !== 'transparent');

  const handleToggleBoxStyle = () => {
    if (isBoxStyled) {
      onUpdateElement({
        fillColor: 'transparent',
        borderWidth: 0,
        shadow: 'none',
        style: {
          ...currentStyle,
          backgroundColor: 'transparent',
        },
      });
    } else {
      onUpdateElement({
        fillColor: currentTag === 'button' ? '#f59e0b' : '#ffffff',
        borderWidth: currentTag === 'button' ? 0 : 1,
        borderColor: currentTag === 'button' ? 'transparent' : '#cbd5e1',
        borderRadius: el.borderRadius ?? 8,
        style: {
          ...currentStyle,
          padding: currentStyle.padding || '8px 16px',
        },
      });
    }
    if (onCommitHistory) onCommitHistory();
  };

  const clickEvent = el.events?.onClick || { mode: 'none' };
  const updateClickEvent = (patch, commit = true) => {
    onUpdateElement({
      events: {
        ...(el.events || {}),
        onClick: {
          ...(el.events?.onClick || { mode: 'none' }),
          ...patch,
        },
      },
    });
    if (commit && onCommitHistory) onCommitHistory();
  };

  // Find if inside an explicit container (div, section, article, etc.)
  const parentContainer = findNodeAndParent(elements, el.id)?.parent;
  const isRealParentContainer = parentContainer && isExplicitContainer(parentContainer.type);
  const ancestorPath = getNodePath(elements, el.id) || [];
  const activeSliderOwner = ancestorPath.slice().reverse().find((n) => n?.sliderConfig);

  // Alignments (relative to parent container if inside, or canvas if top-level)
  const handleAlignHorizontalCenter = () => {
    const { updates } = centerElementsSmart(elements, [el.id], canvasSettings.width, canvasSettings.height, 'x');
    if (updates[el.id]) onUpdateElement(updates[el.id]);
    if (onCommitHistory) onCommitHistory();
  };

  const handleAlignVerticalCenter = () => {
    const { updates } = centerElementsSmart(elements, [el.id], canvasSettings.width, canvasSettings.height, 'y');
    if (updates[el.id]) onUpdateElement(updates[el.id]);
    if (onCommitHistory) onCommitHistory();
  };

  const handleDistributeChildren = (mode) => {
    if (!el.children || el.children.length === 0) return;
    const newTree = distributeChildrenInContainer(elements, el.id, mode);
    const found = findNodeAndParent(newTree, el.id);
    if (found && found.node) {
      onUpdateElement({ children: found.node.children });
      if (onCommitHistory) onCommitHistory();
    }
  };

  const handleAlignLeft = () => {
    onUpdateElement({ x: 0 });
    if (onCommitHistory) onCommitHistory();
  };

  const handleAlignRight = () => {
    const maxX = isRealParentContainer ? parentContainer.width : canvasSettings.width;
    onUpdateElement({ 
      x: Math.max(0, maxX - el.width) 
    });
    if (onCommitHistory) onCommitHistory();
  };

  const handleAlignTop = () => {
    onUpdateElement({ y: 0 });
    if (onCommitHistory) onCommitHistory();
  };

  const handleAlignBottom = () => {
    const maxY = isRealParentContainer ? parentContainer.height : canvasSettings.height;
    onUpdateElement({ 
      y: Math.max(0, maxY - el.height) 
    });
    if (onCommitHistory) onCommitHistory();
  };

  // Attribute update helper
  const handleUpdateAttr = (attrName, value) => {
    const updatedAttrs = {
      ...(el.attrs || {}),
      [attrName]: value
    };
    onUpdateElement({ attrs: updatedAttrs });
  };

  // Delete attribute
  const handleDeleteAttr = (attrName) => {
    const updatedAttrs = { ...(el.attrs || {}) };
    delete updatedAttrs[attrName];
    onUpdateElement({ attrs: updatedAttrs });
  };

  // Style update helper
  const handleUpdateStyle = (styleProp, value) => {
    const updatedStyle = {
      ...(el.style || {}),
      [styleProp]: value
    };
    onUpdateElement({ style: updatedStyle });
  };

  const handleUpdateMultipleStyles = (stylesObj) => {
    const updatedStyle = {
      ...(el.style || {}),
      ...stylesObj
    };
    Object.keys(updatedStyle).forEach(k => {
      if (updatedStyle[k] === undefined) {
        delete updatedStyle[k];
      }
    });
    onUpdateElement({ style: updatedStyle });
  };

  // Delete style and commit to history
  const handleDeleteStyle = (styleProp) => {
    const updatedStyle = { ...(el.style || {}) };
    delete updatedStyle[styleProp];
    onUpdateElement({ style: updatedStyle });
    if (onCommitHistory) onCommitHistory();
  };

  // Add new attribute from combobox
  const handleAddAttribute = (attrName) => {
    const cleanAttr = typeof attrName === 'string' ? attrName.trim() : attrName?.key;
    if (!cleanAttr) return;
    const inputType = getAttributeInputType(cleanAttr);
    const initialVal = inputType === 'checkbox' ? true : '';
    handleUpdateAttr(cleanAttr, initialVal);
    if (onCommitHistory) onCommitHistory();
  };

  // Add new CSS property from combobox or direct manual entry
  const handleAddStyleProperty = (propKeyOrObj, defaultVal = '') => {
    const rawKey = typeof propKeyOrObj === 'string' ? propKeyOrObj : propKeyOrObj?.key;
    const val = typeof propKeyOrObj === 'string' ? defaultVal : (propKeyOrObj?.default ?? defaultVal);
    const key = toCamelCaseCss(rawKey);
    if (!key) return;
    handleUpdateStyle(key, val);
    setLastAddedCssKey(key);
    if (onCommitHistory) onCommitHistory();
  };

  // Tag change handler
  const handleTagChange = (newTag) => {
    const cleanTag = newTag.toLowerCase();
    const isNewVoid = isVoidTag(cleanTag);
    onUpdateElement({
      type: cleanTag,
      name: TAG_INFO[cleanTag]?.label || `<${cleanTag}>`,
      textContent: isNewVoid ? '' : (el.textContent || '')
    });
    setShowTagModal(false);
  };

  // Live HTML Editor Change
  const handleHtmlChange = (newHtml) => {
    setHtmlCode(newHtml);
    const parsed = htmlToElementData(newHtml);
    if (parsed) {
      setCodeError(null);
      onUpdateElement({
        type: parsed.type,
        attrs: parsed.attrs,
        textContent: parsed.textContent,
      });
    } else {
      setCodeError('Geçersiz HTML sözdizimi');
    }
  };

  // Live CSS Editor Change
  const handleCssChange = (newCss) => {
    setCssCode(newCss);
    const parsedStyle = cssToStyleObject(newCss);
    onUpdateElement({
      style: parsedStyle
    });
  };

  const cssCatalogMap = ALL_CSS_PROPERTIES.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {});

  const blockContext = findOwningBlock(elements, el.id);
  const effectiveTab = activePanelTab === 'block' && !blockContext ? 'style' : activePanelTab;

  return (
    <div className="w-full min-w-0 bg-[#141417] flex flex-col h-full text-xs text-zinc-300 select-none">
      
      {/* 1. Calm Header with Tag Badge, Quick Name & Actions */}
      <div className="px-3 py-2 border-b border-[#27272d] bg-[#18181b] flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          {/* Tag Selector Button */}
          <button
            onClick={() => setShowTagModal(true)}
            title="HTML Tag'ini Değiştir"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#101013] hover:bg-[#222228] border border-[#2c2c32] hover:border-[#0d99ff]/50 text-[#38bdf8] transition-all group font-mono text-[11px] shrink-0"
          >
            <TagIcon size={11} className="text-[#0d99ff]" />
            <span className="font-bold">&lt;{currentTag}&gt;</span>
            <ChevronDown size={11} className="opacity-60 group-hover:opacity-100" />
          </button>

          <input
            type="text"
            value={el.name || ''}
            onChange={(e) => onUpdateElement({ name: e.target.value })}
            placeholder="Öğe adı..."
            className="flex-1 min-w-0 bg-[#101013] border border-[#27272d] focus:border-[#0d99ff] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none truncate"
          />

          <div className="flex items-center gap-1">
            {onOpenAttributesInspector && (
              <button
                type="button"
                onClick={onOpenAttributesInspector}
                title="Öznitelikler & CSS'i Ayrı Geniş Pencerede Aç"
                className="p-1 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 text-[#38bdf8] border border-[#0d99ff]/35 transition-colors shrink-0"
              >
                <ExternalLink size={12} />
              </button>
            )}
            <button
              onClick={onDuplicateSelected}
              title="Klonla / Çoğalt"
              className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={onDeleteSelected}
              title="Sil (Delete)"
              className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-[#222228]"
            >
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Clickable Hierarchy Path Pill (Katman / Sarmalayıcı Geçişi) */}
        {(nodePath.length > 1 || hasChildren) && (
          <div className="flex flex-wrap items-center gap-1 bg-[#101013] border border-[#27272d] rounded px-2 py-1">
            <span className="text-[9px] text-zinc-500 mr-0.5 font-semibold">Katman:</span>
            {nodePath.map((pathNode, idx) => {
              const isCurrent = pathNode.id === el.id;
              return (
                <React.Fragment key={pathNode.id}>
                  {idx > 0 && <ChevronRight size={10} className="text-zinc-600 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onSelectElement?.(pathNode.id)}
                    title={`${pathNode.name || pathNode.type} katmanını seç`}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors ${
                      isCurrent
                        ? 'bg-[#0d99ff]/15 text-[#38bdf8] border border-[#0d99ff]/40 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222228]'
                    }`}
                  >
                    &lt;{(pathNode.type || 'div').toLowerCase()}&gt;
                  </button>
                </React.Fragment>
              );
            })}
            {hasChildren && el.children.slice(0, 3).map((child) => (
              <React.Fragment key={child.id}>
                <ChevronRight size={10} className="text-zinc-600 shrink-0" />
                <button
                  type="button"
                  onClick={() => onSelectElement?.(child.id)}
                  title={`Alt öğeyi seç: ${child.name || child.type}`}
                  className="px-1.5 py-0.5 rounded font-mono text-[10px] text-zinc-300 hover:text-white bg-[#18181b] hover:bg-[#222228] border border-[#2c2c32] transition-colors"
                >
                  &lt;{(child.type || 'div').toLowerCase()}&gt;
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Semantic Wrap / Unwrap & Box Toggle Quick Bar */}
        {(onWrapSelected || onUnwrapElement || ['text', 'span', 'p', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(currentTag)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {onWrapSelected && !hasChildren && !['a', 'button', 'nav', 'group'].includes(currentTag) && (
              <>
                <button
                  type="button"
                  onClick={() => onWrapSelected('a', false, [el.id])}
                  title="Bu öğeyi bir <a> bağlantı kapsayıcısı içine al (kutu zorunlu değil)"
                  className="flex-1 min-w-[95px] py-1 px-2 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Link size={11} />
                  <span>&lt;a&gt; ile Sar</span>
                </button>
                <button
                  type="button"
                  onClick={() => onWrapSelected('button', false, [el.id])}
                  title="Bu öğeyi tıklanabilir <button> kapsayıcısı içine al"
                  className="flex-1 min-w-[95px] py-1 px-2 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Zap size={11} />
                  <span>&lt;button&gt; ile Sar</span>
                </button>
              </>
            )}

            {onUnwrapElement && hasChildren && (el.isAtomicWrapper || ['a', 'button', 'span'].includes(currentTag)) && (
              <button
                type="button"
                onClick={() => onUnwrapElement(el.id)}
                title="Dış kapsayıcıyı kaldır, içindeki öğeyi serbest bırak"
                className="flex-1 py-1 px-2 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Ungroup size={11} />
                <span>Sarmalamayı Çöz</span>
              </button>
            )}

            {['text', 'span', 'p', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(currentTag) && (
              <button
                type="button"
                onClick={handleToggleBoxStyle}
                title={isBoxStyled ? 'Arka plan kutusunu kaldır, yalnızca saf metin/kapsayıcı bırak' : 'Arka plan kutusu, kenarlık ve iç boşluk ekle'}
                className={`py-1 px-2 rounded border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                  isBoxStyled
                    ? 'bg-[#222228] hover:bg-[#2c2c32] border-[#3f3f46] text-zinc-200'
                    : 'bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 border-[#0d99ff]/35 text-[#38bdf8]'
                }`}
              >
                <Box size={11} />
                <span>{isBoxStyled ? 'Kutuyu Kaldır' : 'Arka Plan Kutusu Ekle'}</span>
              </button>
            )}
          </div>
        )}

        {/* Active Device & Per-Device Visibility Row */}
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${
            viewportMode === 'mobile'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : viewportMode === 'tablet'
              ? 'bg-[#0d99ff]/10 border-[#0d99ff]/35 text-[#38bdf8]'
              : 'bg-[#101013] border-[#27272d] text-zinc-400'
          }`}>
            {viewportMode === 'mobile' ? <Smartphone size={11} /> : viewportMode === 'tablet' ? <Tablet size={11} /> : <Monitor size={11} />}
            <span>{viewportMode === 'mobile' ? 'Mobil (375px)' : viewportMode === 'tablet' ? 'Tablet (768px)' : 'Masaüstü'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onUpdateElementDirect) {
                onUpdateElementDirect(el.id, { isHidden: !el.isHidden });
              } else {
                onUpdateElement({ isHidden: !el.isHidden });
                if (onCommitHistory) onCommitHistory();
              }
            }}
            title="Yalnızca aktif cihaz görünümünde öğeyi gizle veya göster"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
              el.isHidden
                ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25'
                : 'bg-[#101013] border-[#27272d] text-zinc-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            {el.isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
            <span>{el.isHidden ? 'Bu Cihazda Gizli' : 'Görünür'}</span>
          </button>
        </div>

        {/* Active Slider Slide Switcher (Editor Mode Authoring Control) */}
        {activeSliderOwner && (
          <div className="bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-zinc-300 truncate">
              Slayt ({Number(activeSliderOwner.sliderConfig?.activeSlideIndex || 0) + 1}/{activeSliderOwner.sliderConfig?.totalSlides || 1})
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {Array.from({ length: Math.max(1, activeSliderOwner.sliderConfig?.totalSlides || 1) }).map((_, idx) => {
                const isCur = Number(activeSliderOwner.sliderConfig?.activeSlideIndex || 0) === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const nextCfg = { ...activeSliderOwner.sliderConfig, activeSlideIndex: idx };
                      if (onUpdateElementDirect) {
                        onUpdateElementDirect(activeSliderOwner.id, { sliderConfig: nextCfg });
                      } else if (activeSliderOwner.id === el.id) {
                        onUpdateElement({ sliderConfig: nextCfg });
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                      isCur
                        ? 'bg-[#0d99ff] text-white'
                        : 'bg-[#18181b] text-zinc-400 hover:text-white border border-[#27272d]'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Navigation Tabs: Blok, Stil, Düzen, Nitelik, CSS, Kod */}
      <div className="flex border-b border-[#27272d] bg-[#18181b] shrink-0 overflow-x-auto no-scrollbar">
        {[
          ...(blockContext
            ? [{
                id: 'block',
                label: 'Blok',
                icon: LayoutGrid,
                activeCls: 'text-[#38bdf8] border-[#0d99ff] bg-[#141417]',
                hasDot: true,
                dotCls: 'bg-emerald-400',
                title: `${blockContext.blockNode?.name || 'Bileşen'} Hızlı Özelleştir`,
              }]
            : []),
          { id: 'style', label: 'Stil', icon: Sliders, activeCls: 'text-zinc-100 border-[#0d99ff] bg-[#141417]', hasDot: false, title: 'Stil & Tipografi' },
          { id: 'layout', label: 'Düzen', icon: Box, activeCls: 'text-zinc-100 border-[#0d99ff] bg-[#141417]', hasDot: false, title: 'Konum, Boyut & Flexbox' },
          { id: 'props', label: 'Nitelik', icon: TagIcon, activeCls: 'text-[#38bdf8] border-[#0d99ff] bg-[#141417]', hasDot: Object.keys(currentAttrs).length > 0 || (el.events?.onClick?.mode && el.events.onClick.mode !== 'none'), dotCls: 'bg-[#0d99ff]', title: `Nitelikler (${Object.keys(currentAttrs).length})` },
          { id: 'css', label: 'CSS', icon: Sparkles, activeCls: 'text-[#38bdf8] border-[#0d99ff] bg-[#141417]', hasDot: Object.keys(currentStyle).length > 0, dotCls: 'bg-[#0d99ff]', title: `Özel CSS (${Object.keys(currentStyle).length})` },
          { id: 'code', label: 'Kod', icon: Code2, activeCls: 'text-zinc-100 border-[#0d99ff] bg-[#141417]', hasDot: false, title: 'Canlı HTML & CSS Kodu' },
        ].map((tab) => {
          const isActive = effectiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePanelTab(tab.id)}
              title={tab.title}
              className={`flex-1 min-w-[44px] py-2.5 px-1.5 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? tab.activeCls
                  : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-[#222228]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.hasDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dotCls}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* 3.0 TAB: BLOCK CUSTOMIZER (CONTEXTUAL NAVBAR / FOOTER / SLIDER / SECTION EDITOR) */}
      {effectiveTab === 'block' && blockContext && (
        <BlockCustomizer
          elements={elements}
          selectedElement={el}
          onSelectElement={onSelectElement}
          onUpdateElementDirect={onUpdateElementDirect}
          onUpdateResolvedElements={onUpdateResolvedElements}
        />
      )}

      {/* 3.1 TAB: PROPS (NİTELİKLER & ÖZELLİKLER) */}
      {effectiveTab === 'props' && (
        <div className="p-3.5 space-y-4 overflow-y-auto flex-1">
          {/* 🌟 PROMINENT WINDOW LAUNCHER BANNER */}
          {onOpenAttributesInspector && (
            <button
              type="button"
              onClick={onOpenAttributesInspector}
              className="w-full py-2 px-3 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 text-[#38bdf8] border border-[#0d99ff]/35 flex items-center justify-center gap-2 font-semibold text-xs transition-all group"
            >
              <Sliders size={13} className="text-[#38bdf8] group-hover:rotate-12 transition-transform" />
              <span>Öznitelikler &amp; CSS&apos;i Ayrı Pencerede Aç</span>
            </button>
          )}

          {/* 🌟 PROMINENT SECTION: METİN İÇERİĞİ (TEXT CONTENT) */}
          {!isVoid && (
            <div className="bg-[#18181b] p-3 rounded border border-[#2c2c32] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={13} className="text-[#0d99ff]" />
                  <span>Metin İçeriği (Yazıyı Değiştir)</span>
                </label>
                <span className="text-[9px] font-mono text-zinc-400">
                  &lt;{currentTag}&gt;
                </span>
              </div>
              <textarea
                rows={3}
                value={el.textContent ?? el.content ?? ''}
                onChange={(e) => onUpdateElement({ textContent: e.target.value, content: e.target.value })}
                className="w-full bg-[#101013] border border-[#2c2c32] focus:border-[#0d99ff] rounded p-2.5 text-xs text-zinc-100 focus:outline-none resize-none font-sans leading-relaxed"
                placeholder="Öğenin metnini buraya yazın..."
              />
            </div>
          )}

          {/* SECTION A: ÖZELLİKLER (ATTRIBUTES) */}
          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <TagIcon size={12} className="text-[#0d99ff]" />
                <span>Özellikler (Attributes)</span>
              </label>
              <span className="text-[9px] font-mono text-zinc-400">
                &lt;{currentTag}&gt;
              </span>
            </div>

            {/* Tag Common Attributes */}
            <div className="space-y-2">
              {commonAttrsConfig.map((attrDef) => {
                const val = currentAttrs[attrDef.name] ?? '';
                const isBool = attrDef.type === 'checkbox';
                const isSelect = attrDef.type === 'select';

                return (
                  <div key={attrDef.name} className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {attrDef.label || attrDef.name}
                    </span>

                    {isBool ? (
                      <label className="flex items-center gap-2 cursor-pointer bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32]">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleUpdateAttr(attrDef.name, e.target.checked)}
                          className="accent-[#0d99ff] rounded cursor-pointer"
                        />
                        <span className="text-xs text-zinc-200">
                          {val ? 'Aktif (true)' : 'Pasif (false)'}
                        </span>
                      </label>
                    ) : isSelect ? (
                      <select
                        value={val}
                        onChange={(e) => handleUpdateAttr(attrDef.name, e.target.value)}
                        className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff] font-mono"
                      >
                        {(attrDef.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={attrDef.type === 'number' ? 'number' : 'text'}
                        value={val}
                        onChange={(e) => handleUpdateAttr(attrDef.name, e.target.value)}
                        placeholder={`${attrDef.name} değeri...`}
                        className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff] font-mono"
                      />
                    )}
                  </div>
                );
              })}

              {/* Dynamically added custom attributes */}
              {customAttrEntries.map(([attrName, val]) => {
                const inputType = getAttributeInputType(attrName);
                const isBool = inputType === 'checkbox';

                return (
                  <div key={attrName} className="flex flex-col gap-1 pt-1 border-t border-[#27272d]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#38bdf8] font-mono">
                        {attrName}
                      </span>
                      <button
                        onClick={() => handleDeleteAttr(attrName)}
                        title="Bu özelliği sil"
                        className="text-zinc-500 hover:text-red-400 p-0.5"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {isBool ? (
                      <label className="flex items-center gap-2 cursor-pointer bg-[#101013] px-2 py-1 rounded border border-[#2c2c32]">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleUpdateAttr(attrName, e.target.checked)}
                          className="accent-[#0d99ff]"
                        />
                        <span className="text-xs text-zinc-200">
                          {val ? 'Aktif (true)' : 'Pasif (false)'}
                        </span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleUpdateAttr(attrName, e.target.value)}
                        className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Searchable HTML Attribute Selector */}
            <div className="pt-2 border-t border-white/[0.07] space-y-1.5">
              <span className="text-[10px] font-semibold text-neutral-400 block">
                + Yeni HTML Niteliği (Attribute) Ekle
              </span>
              <SearchableOptionCombobox
                items={addableAttributeItems}
                excludedKeys={Object.keys(currentAttrs)}
                onSelect={(item) => handleAddAttribute(item.key)}
                placeholder="Attribute ara... (↓/↑ ile seç, Enter ekle)"
                triggerLabel="Liste"
                allowCustom={true}
                customLabelPrefix="Özel attribute ekle:"
                formatPrimaryName={(item) => item.key}
                formatSecondaryLabel={(item) => item.label}
                emptyMessage="Eklenebilecek başka standart attribute yok."
                accent="blue"
              />
            </div>

          </div>

          {/* 3.1.4 EYLEM & FONKSİYON (ONCLICK EVENTS) */}
          <div className="bg-[#18181b] p-3 rounded border border-[#2c2c32] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={12} />
                <span>Eylem &amp; Fonksiyon (onClick)</span>
              </label>
              {onOpenFunctionEditor && (
                <button
                  type="button"
                  onClick={() => onOpenFunctionEditor(null, el.id)}
                  className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus size={10} />
                  <span>Yeni Fonksiyon</span>
                </button>
              )}
            </div>

            <div>
              <span className="text-[10px] text-zinc-400 block mb-1">Tıklandığında Ne Yapsın?</span>
              <select
                value={clickEvent.mode || 'none'}
                onChange={(e) => {
                  const nextMode = e.target.value;
                  const firstFn = projectFunctions[0];
                  updateClickEvent({
                    mode: nextMode,
                    ...(nextMode === 'function' && !clickEvent.functionId && firstFn
                      ? { functionId: firstFn.id, functionName: firstFn.name }
                      : {}),
                  });
                }}
                className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
              >
                <option value="none">Yok (Standart / &lt;a&gt; href varsa kullan)</option>
                <option value="function">Fonksiyon Çalıştır — hesapla() vb.</option>
                <option value="navigate_page">Proje Sayfasına Git</option>
                <option value="navigate_url">Dış Bağlantıya Git (URL)</option>
                <option value="scroll_to">Sayfadaki Öğeye Kaydır (#id)</option>
                <option value="toggle_visibility">Öğeyi Göster / Gizle</option>
                <option value="accordion_toggle">Akordiyon Aç / Kapa</option>
                <option value="set_text">Başka Öğenin Metnini Değiştir</option>
                <option value="slider_prev">Slider: Önceki Slayt</option>
                <option value="slider_next">Slider: Sonraki Slayt</option>
                <option value="slider_goto">Slider: Belirli Slayta Git</option>
              </select>
            </div>

            {clickEvent.mode === 'function' && (
              <div className="space-y-2 pt-1 border-t border-[#27272d]">
                {projectFunctions.length === 0 ? (
                  <div className="bg-[#101013] border border-dashed border-emerald-500/35 rounded p-2.5 text-center space-y-2">
                    <p className="text-[10px] text-zinc-400">
                      Henüz tanımlı bir proje fonksiyonu yok. Hesaplama, kontrol veya formül eklemek için yeni bir fonksiyon oluşturun.
                    </p>
                    {onOpenFunctionEditor && (
                      <button
                        type="button"
                        onClick={() => onOpenFunctionEditor(null, el.id)}
                        className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Wand2 size={12} />
                        <span>hesapla() Fonksiyonu Oluştur</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={clickEvent.functionId || ''}
                        onChange={(e) => {
                          const selectedFn = projectFunctions.find((f) => f.id === e.target.value);
                          updateClickEvent({
                            functionId: selectedFn?.id || '',
                            functionName: selectedFn?.name || '',
                          });
                        }}
                        className="flex-1 min-w-0 bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-[#0d99ff]"
                      >
                        <option value="">-- Fonksiyon Seçin --</option>
                        {projectFunctions.map((fn) => (
                          <option key={fn.id} value={fn.id}>
                            {sanitizeFunctionIdentifier(fn.name)}({fn.params || ''})
                          </option>
                        ))}
                      </select>
                      {onOpenFunctionEditor && (() => {
                        const activeFn =
                          projectFunctions.find((f) => f.id === clickEvent.functionId) ||
                          projectFunctions.find((f) => f.name === clickEvent.functionName);
                        return activeFn ? (
                          <button
                            type="button"
                            onClick={() => onOpenFunctionEditor(activeFn, el.id)}
                            title="Fonksiyon Kodunu & Formülünü Düzenle"
                            className="px-2 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                          >
                            <Code2 size={11} />
                            <span>Düzenle</span>
                          </button>
                        ) : null;
                      })()}
                      {onDeleteProjectFunction && clickEvent.functionId && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProjectFunction(clickEvent.functionId);
                            updateClickEvent({ functionId: '', functionName: '' });
                          }}
                          title="Seçili Fonksiyonu Projeden Sil"
                          className="p-1.5 rounded bg-[#101013] hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-[#2c2c32]"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {clickEvent.mode === 'navigate_page' && (
              <div>
                <span className="text-[10px] text-zinc-400 block mb-1">Hedef Proje Sayfası</span>
                <select
                  value={clickEvent.targetPageId || ''}
                  onChange={(e) => updateClickEvent({ targetPageId: e.target.value })}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="">-- Sayfa Seç --</option>
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name} {tab.route ? `(${tab.route})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {clickEvent.mode === 'navigate_url' && (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={clickEvent.url || ''}
                  onChange={(e) => updateClickEvent({ url: e.target.value }, false)}
                  onBlur={() => onCommitHistory?.()}
                  placeholder="https://ornek.com"
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                />
                <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clickEvent.openInNewTab !== false}
                    onChange={(e) => updateClickEvent({ openInNewTab: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  <span>Yeni sekmede aç (_blank)</span>
                </label>
              </div>
            )}

            {(clickEvent.mode === 'scroll_to' ||
              clickEvent.mode === 'toggle_visibility' ||
              clickEvent.mode === 'accordion_toggle' ||
              clickEvent.mode === 'set_text' ||
              clickEvent.mode === 'slider_prev' ||
              clickEvent.mode === 'slider_next' ||
              clickEvent.mode === 'slider_goto') && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 block">
                  {clickEvent.mode.startsWith('slider_') ? 'Hedef Slider' : 'Hedef Öğe'}
                </span>
                <select
                  value={clickEvent.targetElementId || ''}
                  onChange={(e) => updateClickEvent({ targetElementId: e.target.value })}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="">-- Hedef Seç --</option>
                  {flatElements
                    .filter((item) => item.id !== el.id && (!clickEvent.mode.startsWith('slider_') || Boolean(item.sliderConfig)))
                    .map((item) => {
                      const targetRef = item.attrs?.id || item.id;
                      const label = item.attrs?.id
                        ? `#${item.attrs.id} (${item.name || item.type})`
                        : `${item.name || item.type} [${item.id}]`;
                      return (
                        <option key={item.id} value={targetRef}>
                          {label}
                        </option>
                      );
                    })}
                </select>
                {clickEvent.mode === 'set_text' && (
                  <input
                    type="text"
                    value={clickEvent.newText ?? ''}
                    onChange={(e) => updateClickEvent({ newText: e.target.value }, false)}
                    onBlur={() => onCommitHistory?.()}
                    placeholder="Yeni metin içeriği..."
                    className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  />
                )}
                {clickEvent.mode === 'slider_goto' && (
                  <div className="flex items-center justify-between gap-2 bg-[#101013] border border-[#2c2c32] rounded px-2 py-1">
                    <span className="text-[10px] text-zinc-400">Slayt No (1-bazlı)</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={Number(clickEvent.slideIndex ?? 0) + 1}
                      onChange={(e) => updateClickEvent({ slideIndex: Math.max(0, Number(e.target.value || 1) - 1) })}
                      className="w-16 bg-[#18181b] border border-[#27272d] rounded px-1.5 py-0.5 text-xs text-zinc-100 font-mono text-right focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3.2 TAB: LAYOUT (DÜZEN & BOYUT & FLEXBOX) */}
      {effectiveTab === 'layout' && (
        <div className="p-3.5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Alignment Bar */}
          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Hizalama (Align)
            </span>
            <div className="grid grid-cols-6 gap-1 bg-[#101013] border border-[#27272d] p-1 rounded">
              <button onClick={handleAlignLeft} title="Sola Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignStartVertical size={13} />
              </button>
              <button onClick={handleAlignHorizontalCenter} title="Yatayda Ortala" className="p-1.5 rounded hover:bg-[#222228] text-[#38bdf8] flex items-center justify-center">
                <AlignHorizontalJustifyCenter size={14} />
              </button>
              <button onClick={handleAlignRight} title="Sağa Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignEndVertical size={13} />
              </button>
              <button onClick={handleAlignTop} title="Üste Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignStartHorizontal size={13} />
              </button>
              <button onClick={handleAlignVerticalCenter} title="Dikeyde Ortala" className="p-1.5 rounded hover:bg-[#222228] text-[#38bdf8] flex items-center justify-center">
                <AlignVerticalJustifyCenter size={14} />
              </button>
              <button onClick={handleAlignBottom} title="Alta Hizala" className="p-1.5 rounded hover:bg-[#222228] hover:text-[#38bdf8] flex items-center justify-center">
                <AlignEndHorizontal size={13} />
              </button>
            </div>
          </div>

          {/* Container Content Distribution (If element has children e.g. navbar, section) */}
          {el.children && el.children.length > 0 && (
            <div className="bg-[#18181b] p-3 rounded border border-[#2c2c32] space-y-2">
              <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider block">
                İçindekileri Dağıt & Hizala ({el.children.length} alt öğe)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDistributeChildren('space-between')}
                  className="py-1.5 px-1 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 hover:text-[#38bdf8] text-[10px] font-semibold border border-[#2c2c32] text-center"
                  title="İlk öğe sola, son öğe sağa, ortadakiler eşit aralıklı dağıtılır"
                >
                  İki Yana Aç
                </button>
                <button
                  type="button"
                  onClick={() => handleDistributeChildren('center')}
                  className="py-1.5 px-1 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 hover:text-[#38bdf8] text-[10px] font-semibold border border-[#2c2c32] text-center"
                  title="Tüm alt öğeleri ortada toplar"
                >
                  Ortala
                </button>
                <button
                  type="button"
                  onClick={() => handleDistributeChildren('flex-start')}
                  className="py-1.5 px-1 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 hover:text-white text-[10px] font-semibold border border-[#2c2c32] text-center"
                  title="Sola yaslar"
                >
                  Sola Yasla
                </button>
                <button
                  type="button"
                  onClick={() => handleDistributeChildren('flex-end')}
                  className="py-1.5 px-1 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 hover:text-white text-[10px] font-semibold border border-[#2c2c32] text-center"
                  title="Sağa yaslar"
                >
                  Sağa Yasla
                </button>
              </div>
            </div>
          )}

          {/* Boyutlar (Dimensions) & Konum (Coordinates X, Y) */}
          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Boyutlar & Koordinatlar (px)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 shrink-0 font-bold">W</span>
                <input
                  type="number"
                  value={el.width}
                  onChange={(e) => onUpdateElement({ width: Number(e.target.value) })}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs tabular-nums focus:outline-none"
                />
                <span className="text-[9px] text-zinc-600 shrink-0">px</span>
              </div>
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 shrink-0 font-bold">H</span>
                <input
                  type="number"
                  value={el.height}
                  onChange={(e) => onUpdateElement({ height: Number(e.target.value) })}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs tabular-nums focus:outline-none"
                />
                <span className="text-[9px] text-zinc-600 shrink-0">px</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 shrink-0 font-bold">X</span>
                <input
                  type="number"
                  value={Math.round(el.x || 0)}
                  onChange={(e) => onUpdateElement({ x: Number(e.target.value) })}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs tabular-nums focus:outline-none"
                />
                <span className="text-[9px] text-zinc-600 shrink-0">px</span>
              </div>
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 shrink-0 font-bold">Y</span>
                <input
                  type="number"
                  value={Math.round(el.y || 0)}
                  onChange={(e) => onUpdateElement({ y: Number(e.target.value) })}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs tabular-nums focus:outline-none"
                />
                <span className="text-[9px] text-zinc-600 shrink-0">px</span>
              </div>
            </div>
          </div>

          {/* Flexbox & Düzen Modu (Gelişmiş - Varsayılan Kapalı) */}
          <InspectorSection
            title="Flexbox & Düzen Sistemi"
            badge={currentStyle.display || 'flex'}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-zinc-500 block mb-1">Display</span>
                <select
                  value={currentStyle.display || 'flex'}
                  onChange={(e) => handleUpdateStyle('display', e.target.value)}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="flex">Flex (flex)</option>
                  <option value="grid">Grid (grid)</option>
                  <option value="block">Blok (block)</option>
                  <option value="inline-flex">Inline Flex</option>
                  <option value="none">Gizli (none)</option>
                </select>
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-1">Direction</span>
                <select
                  value={currentStyle.flexDirection || 'row'}
                  onChange={(e) => handleUpdateStyle('flexDirection', e.target.value)}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="row">Yatay (Row →)</option>
                  <option value="column">Dikey (Column ↓)</option>
                  <option value="row-reverse">Ters Yatay (←)</option>
                  <option value="column-reverse">Ters Dikey (↑)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-zinc-500 block mb-1">Justify Content</span>
                <select
                  value={currentStyle.justifyContent || 'flex-start'}
                  onChange={(e) => handleUpdateStyle('justifyContent', e.target.value)}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="flex-start">Başlangıç</option>
                  <option value="center">Merkez</option>
                  <option value="flex-end">Bitiş</option>
                  <option value="space-between">İki Yana Aç</option>
                  <option value="space-around">Eşit Dağıt</option>
                </select>
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block mb-1">Align Items</span>
                <select
                  value={currentStyle.alignItems || 'stretch'}
                  onChange={(e) => handleUpdateStyle('alignItems', e.target.value)}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="stretch">Sündür (stretch)</option>
                  <option value="center">Merkez</option>
                  <option value="flex-start">Üst / Baş</option>
                  <option value="flex-end">Alt / Son</option>
                </select>
              </div>
            </div>

            <div className="bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-zinc-400 shrink-0">Boşluk (Gap)</span>
              <input
                type="text"
                value={currentStyle.gap || ''}
                onChange={(e) => handleUpdateStyle('gap', e.target.value)}
                onBlur={() => onCommitHistory?.()}
                placeholder="örn: 12px veya 1rem"
                className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
              />
            </div>
          </InspectorSection>

          {/* Boşluklar (Padding & Margin - Varsayılan Kapalı) */}
          <InspectorSection
            title="İç / Dış Boşluklar"
            badge={(currentStyle.padding || currentStyle.margin) ? 'aktif' : null}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 shrink-0">Padding</span>
                <input
                  type="text"
                  value={currentStyle.padding || ''}
                  onChange={(e) => handleUpdateStyle('padding', e.target.value)}
                  onBlur={() => onCommitHistory?.()}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
                  placeholder="16px"
                />
              </div>
              <div className="min-w-0 bg-[#101013] px-2 py-1.5 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 shrink-0">Margin</span>
                <input
                  type="text"
                  value={currentStyle.margin || ''}
                  onChange={(e) => handleUpdateStyle('margin', e.target.value)}
                  onBlur={() => onCommitHistory?.()}
                  className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
                  placeholder="0px"
                />
              </div>
            </div>
          </InspectorSection>
        </div>
      )}

      {/* 3.3 TAB: STYLE (STİL & TASARIM) */}
      {effectiveTab === 'style' && (
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <InspectorSection
            title="Dolgu, Gradyan & Opaklık"
            icon={Palette}
            badge={`${el.opacity ?? 100}%`}
            defaultOpen={true}
          >
            {/* Opacity slider */}
            <div className="pb-2 border-b border-[#27272d]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-zinc-400 font-medium">Saydamlık (Opacity)</span>
                <span className="text-[10px] text-[#38bdf8] font-mono font-bold tabular-nums">{el.opacity ?? 100}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={el.opacity ?? 100}
                onChange={(e) => onUpdateElement({ opacity: Number(e.target.value) })}
                className="w-full studio-slider"
              />
            </div>

            {/* Arka Plan Rengi & Gradyan (Background & Gradient) */}
            <BackgroundGradientPicker
              value={currentStyle.background || currentStyle.backgroundColor || '#ffffff'}
              onChange={(newVal) => {
                if (newVal.includes('gradient')) {
                  handleUpdateMultipleStyles({ background: newVal, backgroundColor: 'transparent' });
                } else {
                  handleUpdateMultipleStyles({ backgroundColor: newVal, background: undefined });
                }
              }}
              label="Arka Plan Rengi & Gradyan"
            />
          </InspectorSection>

          {/* Typography (for text, button, headings) */}
          {(!isVoid && currentTag !== 'img') && (
            <InspectorSection title="Yazı & Tipografi" icon={Type} defaultOpen={true}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0 bg-[#101013] px-2 py-1 rounded border border-[#2c2c32] focus-within:border-[#0d99ff] flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 shrink-0">Font</span>
                    <input
                      type="text"
                      value={currentStyle.fontSize || '16px'}
                      onChange={(e) => handleUpdateStyle('fontSize', e.target.value)}
                      onBlur={() => onCommitHistory?.()}
                      className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none text-right"
                      placeholder="16px"
                    />
                  </div>
                  <div className="min-w-0 flex items-center gap-1.5 bg-[#101013] px-2 py-1 rounded border border-[#2c2c32] focus-within:border-[#0d99ff]">
                    <input
                      type="color"
                      value={currentStyle.color || '#1a1816'}
                      onChange={(e) => handleUpdateStyle('color', e.target.value)}
                      className="w-5 h-5 shrink-0 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={currentStyle.color || '#1a1816'}
                      onChange={(e) => handleUpdateStyle('color', e.target.value)}
                      onBlur={() => onCommitHistory?.()}
                      className="flex-1 min-w-0 bg-transparent text-zinc-100 font-mono text-[10px] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={currentStyle.fontWeight || '400'}
                    onChange={(e) => handleUpdateStyle('fontWeight', e.target.value)}
                    className="bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  >
                    <option value="300">İnce (300)</option>
                    <option value="400">Normal (400)</option>
                    <option value="500">Orta (500)</option>
                    <option value="600">Yarı Kalın (600)</option>
                    <option value="700">Kalın (700)</option>
                    <option value="800">Ekstra Kalın (800)</option>
                  </select>
                  <select
                    value={currentStyle.textAlign || 'left'}
                    onChange={(e) => handleUpdateStyle('textAlign', e.target.value)}
                    className="bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  >
                    <option value="left">Sola Hizala</option>
                    <option value="center">Ortala</option>
                    <option value="right">Sağa Hizala</option>
                    <option value="justify">İki Yana Yasla</option>
                  </select>
                </div>

                {/* Metin Gölgesi (Text Shadow) */}
                {(() => {
                  const tsRaw = currentStyle.textShadow || 'none';
                  const hasTs = tsRaw && tsRaw !== 'none';
                  const colorMatch = String(tsRaw).match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/i);
                  const tsColor = colorMatch ? colorMatch[1] : '#000000';
                  const tsHex = /^#[0-9a-fA-F]{6}$/i.test(tsColor) ? tsColor : '#000000';
                  const nums = ((colorMatch ? String(tsRaw).replace(colorMatch[1], '') : String(tsRaw)).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
                  const tsX = Number.isFinite(nums[0]) ? nums[0] : 0;
                  const tsY = Number.isFinite(nums[1]) ? nums[1] : 2;
                  const tsBlur = Number.isFinite(nums[2]) ? Math.max(0, nums[2]) : 6;
                  const updateTs = (nx, ny, nblur, ncolor) => {
                    handleUpdateStyle('textShadow', `${nx}px ${ny}px ${nblur}px ${ncolor}`);
                  };
                  return (
                    <div className="pt-2 border-t border-white/[0.06]/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400">Metin Gölgesi (textShadow)</span>
                        {hasTs && (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateStyle('textShadow', 'none');
                              onCommitHistory?.();
                            }}
                            className="text-[9px] text-neutral-500 hover:text-red-400"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                      <select
                        value={TEXT_SHADOW_PRESETS.some((p) => p.value === tsRaw) ? tsRaw : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            handleUpdateStyle('textShadow', e.target.value);
                            onCommitHistory?.();
                          }
                        }}
                        className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                      >
                        {TEXT_SHADOW_PRESETS.map((p) => (
                          <option key={p.id} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                        {!TEXT_SHADOW_PRESETS.some((p) => p.value === tsRaw) && (
                          <option value="custom">Özel Gölge ({tsRaw})</option>
                        )}
                      </select>
                      <div className="grid grid-cols-4 gap-1.5 items-center">
                        <label className="bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-1 flex items-center gap-1">
                          <span className="text-[9px] text-zinc-500">X</span>
                          <input
                            type="number"
                            value={tsX}
                            onChange={(e) => updateTs(Number(e.target.value || 0), tsY, tsBlur, tsColor)}
                            onBlur={() => onCommitHistory?.()}
                            className="w-full bg-transparent text-zinc-100 font-mono text-[10px] text-right focus:outline-none"
                          />
                        </label>
                        <label className="bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-1 flex items-center gap-1">
                          <span className="text-[9px] text-zinc-500">Y</span>
                          <input
                            type="number"
                            value={tsY}
                            onChange={(e) => updateTs(tsX, Number(e.target.value || 0), tsBlur, tsColor)}
                            onBlur={() => onCommitHistory?.()}
                            className="w-full bg-transparent text-zinc-100 font-mono text-[10px] text-right focus:outline-none"
                          />
                        </label>
                        <label className="bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-1 flex items-center gap-1">
                          <span className="text-[9px] text-zinc-500">Bul</span>
                          <input
                            type="number"
                            min={0}
                            value={tsBlur}
                            onChange={(e) => updateTs(tsX, tsY, Math.max(0, Number(e.target.value || 0)), tsColor)}
                            onBlur={() => onCommitHistory?.()}
                            className="w-full bg-transparent text-zinc-100 font-mono text-[10px] text-right focus:outline-none"
                          />
                        </label>
                        <div className="bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-1 flex items-center justify-center">
                          <input
                            type="color"
                            value={tsHex}
                            onChange={(e) => updateTs(tsX, tsY, tsBlur, e.target.value)}
                            onBlur={() => onCommitHistory?.()}
                            title="Metin Gölge Rengi"
                            className="w-full h-4 rounded cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </InspectorSection>
            )}

            {/* Kenarlık & Kutu Gölgesi (Varsayılan Kapalı) */}
            <InspectorSection
              title="Kenarlık & Gölge"
              badge={(currentStyle.border || currentStyle.borderWidth || (currentStyle.boxShadow && currentStyle.boxShadow !== 'none')) ? 'aktif' : null}
              defaultOpen={false}
            >
              <BorderManager
                style={currentStyle}
                onChange={(borderStyles) => handleUpdateMultipleStyles(borderStyles)}
                onUpdateStyle={handleUpdateStyle}
              />

              <div className="pt-1 border-t border-[#27272d]">
                <span className="text-[10px] text-zinc-400 block mb-1">Kutu Gölgesi (box-shadow)</span>
                <select
                  value={currentStyle.boxShadow || 'none'}
                  onChange={(e) => handleUpdateStyle('boxShadow', e.target.value)}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  <option value="none">Gölge Yok</option>
                  <option value="0 4px 12px rgba(0, 0, 0, 0.08)">Hafif Soft Gölge</option>
                  <option value="0 10px 25px rgba(0, 0, 0, 0.15)">Orta Derinlik</option>
                  <option value="0 20px 40px rgba(0, 0, 0, 0.35)">Güçlü Gölgelendirme</option>
                  <option value="0 8px 24px rgba(212, 175, 55, 0.35)">Altın Işıltısı (Gold Glow)</option>
                </select>
              </div>
            </InspectorSection>

            {/* 🌟 SECTION: ANİMASYON & GEÇİŞ EFEKTLERİ (Varsayılan Kapalı) */}
            <InspectorSection
              title="Animasyon & Hover Efektleri"
              icon={Sparkles}
              badge={el.animation?.type && el.animation?.type !== 'none' ? el.animation.type : (el.animation?.hover && el.animation?.hover !== 'none' ? 'hover' : null)}
              defaultOpen={false}
            >
              <div className="flex items-center justify-end">
                {el.animation?.type && el.animation?.type !== 'none' && (
                  <button
                    type="button"
                    onClick={() => {
                      const elDom = document.getElementById(el.id);
                      if (elDom) {
                        const allCls = ['animate-fade-in', 'animate-slide-up', 'animate-slide-down', 'animate-slide-left', 'animate-slide-right', 'animate-zoom-in', 'animate-bounce-in', 'animate-float', 'animate-pulse-glow'];
                        allCls.forEach(c => elDom.classList.remove(c));
                        void elDom.offsetWidth;
                        const preset = ANIMATION_PRESETS.find(p => p.id === el.animation?.type);
                        if (preset?.className) elDom.classList.add(preset.className);
                      }
                    }}
                    title="Animasyonu Ekranda Test Et"
                    className="px-2 py-0.5 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 text-[#38bdf8] border border-[#0d99ff]/35 font-semibold text-[10px] flex items-center gap-1 transition-all"
                  >
                    <Play size={10} className="fill-current" />
                    <span>Test Et</span>
                  </button>
                )}
              </div>

              {/* Entrance Animation Preset */}
              <div>
                <span className="text-[10px] text-zinc-400 block mb-1">Giriş Animasyonu (Entrance)</span>
                <select
                  value={el.animation?.type || 'none'}
                  onChange={(e) => {
                    const type = e.target.value;
                    const preset = ANIMATION_PRESETS.find(p => p.id === type);
                    onUpdateElement({
                      animation: {
                        ...(el.animation || {}),
                        type,
                        className: preset?.className || ''
                      }
                    });
                    if (onCommitHistory) onCommitHistory();
                  }}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  {ANIMATION_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hover Effect Preset */}
              <div>
                <span className="text-[10px] text-zinc-400 block mb-1">Fare Üzerine Gelince (Hover Efekti)</span>
                <select
                  value={el.animation?.hover || 'none'}
                  onChange={(e) => {
                    const hover = e.target.value;
                    const preset = HOVER_PRESETS.find(p => p.id === hover);
                    onUpdateElement({
                      animation: {
                        ...(el.animation || {}),
                        hover,
                        hoverClassName: preset?.className || ''
                      }
                    });
                    if (onCommitHistory) onCommitHistory();
                  }}
                  className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                >
                  {HOVER_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                {HOVER_PRESETS.find((p) => p.id === (el.animation?.hover || 'none'))?.supportsLineConfig && (
                  <div className="mt-2 p-2 rounded bg-[#101013] border border-[#2c2c32] space-y-1.5">
                    <span className="text-[10px] font-semibold text-[#38bdf8] block">
                      Alt Çizgi Animasyon Ayarları (Navbar / Link)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 items-center">
                      <label className="bg-[#18181b] border border-[#2c2c32] rounded px-1.5 py-1 flex items-center gap-1.5">
                        <input
                          type="color"
                          value={el.animation?.hoverLineColor || '#0d99ff'}
                          onChange={(e) => onUpdateElement({
                            animation: { ...(el.animation || {}), hoverLineColor: e.target.value }
                          })}
                          onBlur={() => onCommitHistory?.()}
                          className="w-4 h-4 rounded bg-transparent cursor-pointer shrink-0"
                        />
                        <span className="text-[9px] text-neutral-400 truncate">Renk</span>
                      </label>
                      <label className="bg-[#101013] border border-white/[0.08] rounded px-1.5 py-1 flex items-center gap-1">
                        <span className="text-[9px] text-neutral-500">Kal.</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={el.animation?.hoverLineHeight ?? 2}
                          onChange={(e) => onUpdateElement({
                            animation: { ...(el.animation || {}), hoverLineHeight: Math.max(1, Number(e.target.value || 2)) }
                          })}
                          onBlur={() => onCommitHistory?.()}
                          className="w-full bg-transparent text-white font-mono text-[10px] text-right focus:outline-none"
                        />
                        <span className="text-[9px] text-neutral-500">px</span>
                      </label>
                      <label className="bg-[#101013] border border-white/[0.08] rounded px-1.5 py-1 flex items-center gap-1">
                        <span className="text-[9px] text-neutral-500">Süre</span>
                        <input
                          type="number"
                          step="0.05"
                          min={0.05}
                          max={2}
                          value={el.animation?.hoverLineDuration ?? 0.28}
                          onChange={(e) => onUpdateElement({
                            animation: { ...(el.animation || {}), hoverLineDuration: Math.max(0.05, Number(e.target.value || 0.28)) }
                          })}
                          onBlur={() => onCommitHistory?.()}
                          className="w-full bg-transparent text-white font-mono text-[10px] text-right focus:outline-none"
                        />
                        <span className="text-[9px] text-neutral-500">s</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </InspectorSection>

            {/* CSS Tab & Dedicated Inspector Shortcut */}
            <div className="pt-3 border-t border-[#27272d] bg-[#101013] p-2.5 rounded border border-[#2c2c32] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-300">Özel CSS Özellikleri</span>
                <span className="text-[9px] text-zinc-500">Tüm CSS özelliklerini yönetmek için</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePanelTab('css')}
                  className="px-2 py-1 rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 text-[#38bdf8] border border-[#0d99ff]/35 font-semibold text-[10px] transition-colors"
                >
                  CSS Sekmesi →
                </button>
                {onOpenAttributesInspector && (
                  <button
                    type="button"
                    onClick={onOpenAttributesInspector}
                    title="Ayrı Geniş Pencerede Aç"
                    className="px-2 py-1 rounded bg-[#18181b] hover:bg-[#222228] text-zinc-200 border border-[#2c2c32] font-semibold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink size={10} />
                    <span>Pencere</span>
                  </button>
                )}
              </div>
            </div>

        </div>
      )}

      {/* 3.3 TAB: CSS (ÖZEL CSS ÖZELLİKLERİ & DEVTOOLS STİLİ) */}
      {effectiveTab === 'css' && (
        <div className="p-3 space-y-3 overflow-y-auto flex-1 min-w-0">
          {/* Dedicated Floating Window Launcher */}
          {onOpenAttributesInspector && (
            <button
              type="button"
              onClick={onOpenAttributesInspector}
              className="w-full py-2 px-3 rounded bg-[#18181b] hover:bg-[#222228] text-zinc-200 border border-[#2c2c32] hover:border-[#0d99ff]/50 flex items-center justify-center gap-2 font-semibold text-[11px] transition-all group"
            >
              <Sparkles size={13} className="text-[#0d99ff] group-hover:rotate-12 transition-transform shrink-0" />
              <span className="truncate">Yüzen CSS & Nitelik Penceresinde Aç</span>
            </button>
          )}

          <div className="bg-[#18181b] p-3 rounded border border-[#27272d] space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-1.5 min-w-0">
                <Sparkles size={12} className="shrink-0" />
                <span>CSS Özellikleri ({Object.keys(currentStyle).length})</span>
              </span>
              <span className="text-[9px] text-zinc-400 font-mono shrink-0">↑↓ / Enter</span>
            </div>

            {/* Searchable CSS Catalog Combobox at top so list never clips off bottom */}
            <SearchableOptionCombobox
              items={ALL_CSS_PROPERTIES}
              excludedKeys={Object.keys(currentStyle)}
              onSelect={(item) => handleAddStyleProperty(item)}
              placeholder="CSS özelliği ara... (↓/↑ ile seç, Enter ekle)"
              triggerLabel="Katalog"
              allowCustom={true}
              customLabelPrefix="Özel CSS ekle:"
              formatPrimaryName={(item) => toKebabCaseCss(item.key)}
              formatSecondaryLabel={(item) => item.label}
              emptyMessage="Tüm kayıtlı CSS özellikleri eklendi. Özel özellik yazabilirsiniz."
              accent="blue"
            />

            {/* Inline Quick Manual CSS Add Row */}
            <div className="flex items-center gap-1.5 bg-[#101013] p-1.5 rounded border border-[#27272d] min-w-0">
              <input
                type="text"
                value={inlineCssKey}
                onChange={(e) => setInlineCssKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inlineCssKey.trim()) {
                    handleAddStyleProperty(inlineCssKey, inlineCssVal);
                    setInlineCssKey('');
                    setInlineCssVal('');
                  }
                }}
                placeholder="özellik (ör: opacity)"
                className="flex-1 min-w-0 bg-[#141417] border border-[#2c2c32] rounded px-2 py-1 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-[#0d99ff]"
              />
              <input
                type="text"
                value={inlineCssVal}
                onChange={(e) => setInlineCssVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inlineCssKey.trim()) {
                    handleAddStyleProperty(inlineCssKey, inlineCssVal);
                    setInlineCssKey('');
                    setInlineCssVal('');
                  }
                }}
                placeholder="değer"
                className="w-20 min-w-0 shrink bg-[#141417] border border-[#2c2c32] rounded px-2 py-1 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-[#0d99ff]"
              />
              <button
                type="button"
                onClick={() => {
                  if (inlineCssKey.trim()) {
                    handleAddStyleProperty(inlineCssKey, inlineCssVal);
                    setInlineCssKey('');
                    setInlineCssVal('');
                  }
                }}
                disabled={!inlineCssKey.trim()}
                className="shrink-0 px-2.5 py-1 rounded bg-[#0d99ff] hover:bg-[#0284c7] text-white font-semibold text-[11px] disabled:opacity-30 transition-colors"
              >
                Ekle
              </button>
            </div>

            {/* Active Applied CSS Rules (all properties shown with full non-truncated names) */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
              {Object.keys(currentStyle).length === 0 ? (
                <div className="py-5 px-3 text-center text-[11px] text-zinc-500 italic bg-[#101013] rounded border border-dashed border-[#27272d]">
                  Henüz özel CSS kuralı yok. Yukarıdan arayarak seçebilir veya manuel ekleyebilirsiniz.
                </div>
              ) : (
                Object.entries(currentStyle).map(([prop, val]) => {
                  const meta = cssCatalogMap[prop];
                  const kebabName = toKebabCaseCss(prop);
                  const strVal = val === undefined || val === null ? '' : String(val);
                  const hasCustomSelectValue =
                    meta?.type === 'select' &&
                    Array.isArray(meta.options) &&
                    !meta.options.includes(strVal);

                  return (
                    <div
                      key={prop}
                      className="bg-[#101013] px-2.5 py-2 rounded border border-[#2c2c32] hover:border-[#3f3f46] transition-colors space-y-1.5 min-w-0"
                    >
                      {/* Property Full Name & Delete Action */}
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[11px] font-semibold text-[#38bdf8] break-words leading-snug">
                            {kebabName}
                            {kebabName !== prop && (
                              <span className="ml-1.5 text-[10px] font-normal text-zinc-500">
                                ({prop})
                              </span>
                            )}
                          </div>
                          {meta?.label && (
                            <div className="text-[10px] text-zinc-400 break-words leading-tight mt-0.5">
                              {meta.label.split('(')[0].trim()}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteStyle(prop)}
                          title="Bu stili kaldır"
                          className="shrink-0 text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-[#222228] transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Smart Property Value Editor */}
                      {meta?.type === 'color' ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="relative w-6 h-6 rounded border border-[#2c2c32] shrink-0 overflow-hidden cursor-pointer"
                            style={{ backgroundColor: strVal || '#ffffff' }}
                          >
                            <input
                              type="color"
                              value={strVal.startsWith('#') && strVal.length === 7 ? strVal : '#ffffff'}
                              onChange={(e) => {
                                handleUpdateStyle(prop, e.target.value);
                                onCommitHistory?.();
                              }}
                              className="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                            />
                          </div>
                          <input
                            ref={(elNode) => {
                              cssValueInputRefs.current[prop] = elNode;
                            }}
                            type="text"
                            value={strVal}
                            onChange={(e) => handleUpdateStyle(prop, e.target.value)}
                            onBlur={() => onCommitHistory?.()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            placeholder="#ffffff veya rgba(...)"
                            className="flex-1 min-w-0 bg-[#141417] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                          />
                        </div>
                      ) : meta?.type === 'select' && Array.isArray(meta.options) ? (
                        <select
                          ref={(elNode) => {
                            cssValueInputRefs.current[prop] = elNode;
                          }}
                          value={strVal}
                          onChange={(e) => {
                            handleUpdateStyle(prop, e.target.value);
                            onCommitHistory?.();
                          }}
                          className="w-full min-w-0 bg-[#141417] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                        >
                          {hasCustomSelectValue && strVal && (
                            <option value={strVal}>{strVal} (Özel)</option>
                          )}
                          {meta.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          ref={(elNode) => {
                            cssValueInputRefs.current[prop] = elNode;
                          }}
                          type="text"
                          value={strVal}
                          onChange={(e) => handleUpdateStyle(prop, e.target.value)}
                          onBlur={() => onCommitHistory?.()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          placeholder={meta?.default || 'Değer girin...'}
                          className="w-full min-w-0 bg-[#141417] border border-[#2c2c32] rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: LIVE CODE EDITOR (CANLI KOD - ÇİFT YÖNLÜ SENKRONİZE) */}
      {effectiveTab === 'code' && (
        <div className="p-3.5 space-y-4 overflow-y-auto flex-1 flex flex-col">
          <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-zinc-100 text-xs font-semibold">
              <Code2 size={14} className="text-[#0d99ff]" />
              <span>Canlı Kod Senkronizasyonu</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              Gerçek Zamanlı
            </span>
          </div>

          <p className="text-[10px] text-zinc-400 leading-normal flex items-start gap-1.5">
            <Info size={12} className="text-[#38bdf8] shrink-0 mt-0.5" />
            <span>Aşağıdaki HTML ve CSS kodunu elle düzenleyebilirsiniz. Yaptığınız değişiklikler anında sayfadaki tuvale ve özellikler paneline yansır.</span>
          </p>

          {codeError && (
            <div className="p-2.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
              <AlertTriangle size={13} className="shrink-0 text-rose-400" />
              <span>{codeError}</span>
            </div>
          )}

          {/* HTML Code Editor */}
          <div className="flex flex-col flex-1 min-h-[160px] bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#38bdf8] font-mono uppercase tracking-wider">
                HTML
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">
                &lt;{currentTag}&gt;
              </span>
            </div>
            <textarea
              value={htmlCode}
              onChange={(e) => handleHtmlChange(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full bg-[#101013] text-zinc-200 font-mono text-[11px] p-2 rounded border border-[#2c2c32] focus:outline-none focus:border-[#0d99ff] resize-none leading-relaxed"
            />
          </div>

          {/* CSS Style Editor */}
          <div className="flex flex-col flex-1 min-h-[160px] bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-wider">
                CSS (style)
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">
                kebab-case
              </span>
            </div>
            <textarea
              value={cssCode}
              onChange={(e) => handleCssChange(e.target.value)}
              spellCheck={false}
              placeholder="background-color: #0d99ff;&#10;font-size: 16px;"
              className="flex-1 w-full bg-[#101013] text-sky-200 font-mono text-[11px] p-2 rounded border border-[#2c2c32] focus:outline-none focus:border-[#0d99ff] resize-none leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* Tag Changer Modal */}
      <TagPickerModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSelectTag={handleTagChange}
        title="Tag'i Değiştir"
        subtitle={`Seçili <${currentTag}> elemanını yeni bir HTML tag'ine dönüştürün:`}
      />

    </div>
  );
}
