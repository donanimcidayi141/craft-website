import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Tag as TagIcon, Sparkles, Plus, Trash2, Search, 
  Code2, Sliders, Check, Copy, ExternalLink, RefreshCw,
  Layers, Palette, Layout, Eye, Move, PanelRight, GripHorizontal
} from 'lucide-react';
import { 
  ALL_HTML_TAGS, TAG_INFO, isVoidTag, COMMON_ATTRIBUTES_PER_TAG, 
  getValidAttributesForTag, getAttributeInputType, ALL_CSS_PROPERTIES, 
  getCommonStyleKeysForTag 
} from '../data/tagRegistry';
import { styleObjectToCss, cssToStyleObject } from '../utils/codeSync';
import {
  filterPropertyCatalog,
  moveHighlightIndex,
  resolveCatalogSelectionOnEnter,
  toCamelCaseCss,
  toKebabCaseCss,
  clampFloatingRect,
} from '../utils/propertySearch';

/**
 * 🌟 DEDICATED ATTRIBUTES & CSS INSPECTOR WINDOW (Adobe Non-Blocking Floating Palette)
 * Draggable, resizable floating inspector that lets users keep interacting with the canvas
 * or dock back into the right inspector in one click.
 */
export default function AttributesCssInspectorModal({
  isOpen,
  onClose,
  element,
  elements = [],
  onUpdateElement,
  onCommitHistory,
  onDockToRightPanel,
}) {
  const [activeTab, setActiveTab] = useState('css'); // 'css' | 'attrs' | 'raw_css'
  const [cssSearch, setCssSearch] = useState('');
  const [highlightedCssIdx, setHighlightedCssIdx] = useState(0);
  const [attrSearch, setAttrSearch] = useState('');

  // Custom new attribute state
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  // Custom new CSS property state
  const [newCssProp, setNewCssProp] = useState('');
  const [newCssVal, setNewCssVal] = useState('');

  // Auto-focus newly added CSS rule value input
  const [lastAddedCssKey, setLastAddedCssKey] = useState(null);
  const cssValueRefs = useRef({});
  const cssCatalogItemRefs = useRef([]);

  // Floating window geometry (Adobe-like movable & resizable palette)
  const [floatingRect, setFloatingRect] = useState(() => {
    if (typeof window === 'undefined') {
      return { x: 180, y: 72, width: 760, height: 560 };
    }
    return clampFloatingRect(
      {
        x: Math.max(24, window.innerWidth - 840),
        y: 72,
        width: Math.min(760, window.innerWidth - 64),
        height: Math.min(560, window.innerHeight - 104),
      },
      { width: window.innerWidth, height: window.innerHeight },
      { minWidth: 440, minHeight: 360 }
    );
  });
  const dragInteractionRef = useRef(null);

  const currentStyle = element?.style || {};
  const currentAttrs = element?.attrs || {};
  const [rawCss, setRawCss] = useState(() => styleObjectToCss(currentStyle));
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Sync raw CSS whenever element or its styles change externally
  useEffect(() => {
    if (!element) return;
    setRawCss(styleObjectToCss(element.style || {}));
  }, [element?.id, element?.style]);

  // Filter & rank catalog CSS properties (already added items still shown cleanly at bottom or annotated)
  const cssCatalogMap = useMemo(() => {
    const map = {};
    ALL_CSS_PROPERTIES.forEach((p) => {
      map[p.key] = p;
    });
    return map;
  }, []);

  const filteredCssProps = useMemo(
    () => filterPropertyCatalog(ALL_CSS_PROPERTIES, cssSearch, []),
    [cssSearch]
  );

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedCssIdx(filteredCssProps.length > 0 ? 0 : -1);
  }, [cssSearch, filteredCssProps.length]);

  // Keep keyboard-selected catalog item scrolled into view
  useEffect(() => {
    if (!isOpen || highlightedCssIdx < 0) return;
    const node = cssCatalogItemRefs.current[highlightedCssIdx];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedCssIdx, isOpen]);

  // Focus newly added CSS rule value field
  useEffect(() => {
    if (!isOpen || !lastAddedCssKey) return undefined;
    const timer = setTimeout(() => {
      const node = cssValueRefs.current[lastAddedCssKey];
      if (node && typeof node.focus === 'function') {
        node.focus();
        if (typeof node.select === 'function') node.select();
      }
      setLastAddedCssKey(null);
    }, 30);
    return () => clearTimeout(timer);
  }, [lastAddedCssKey, isOpen]);

  // Keep palette inside viewport on window resize
  useEffect(() => {
    const onResize = () => {
      setFloatingRect((prev) =>
        clampFloatingRect(
          prev,
          { width: window.innerWidth, height: window.innerHeight },
          { minWidth: 440, minHeight: 360 }
        )
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Drag/resize pointer handlers
  useEffect(() => {
    const handlePointerMove = (e) => {
      const active = dragInteractionRef.current;
      if (!active) return;
      const dx = e.clientX - active.startX;
      const dy = e.clientY - active.startY;
      const vp = { width: window.innerWidth, height: window.innerHeight };

      if (active.mode === 'move') {
        setFloatingRect(
          clampFloatingRect(
            {
              ...active.startRect,
              x: active.startRect.x + dx,
              y: active.startRect.y + dy,
            },
            vp,
            { minWidth: 440, minHeight: 360 }
          )
        );
      } else if (active.mode === 'resize') {
        setFloatingRect(
          clampFloatingRect(
            {
              ...active.startRect,
              width: active.startRect.width + dx,
              height: active.startRect.height + dy,
            },
            vp,
            { minWidth: 440, minHeight: 360 }
          )
        );
      }
    };

    const handlePointerUp = () => {
      dragInteractionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Esc closes palette unless a child input consumed Esc to clear its search query
  useEffect(() => {
    if (!isOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !element) return null;

  const cleanTag = (element.type || 'div').toLowerCase();
  const validCommonAttrs = getValidAttributesForTag(cleanTag);

  // Handle Style Updates
  const handleUpdateStyle = (property, value, commit = false) => {
    const key = toCamelCaseCss(property);
    if (!key) return;
    const updated = { ...currentStyle, [key]: value };
    onUpdateElement({ style: updated });
    setRawCss(styleObjectToCss(updated));
    if (commit && onCommitHistory) onCommitHistory();
  };

  const handleAddCssProperty = (propKeyOrObj, explicitVal) => {
    const rawKey = typeof propKeyOrObj === 'string' ? propKeyOrObj : propKeyOrObj?.key;
    const key = toCamelCaseCss(rawKey);
    if (!key) return;
    const defaultVal =
      explicitVal !== undefined
        ? explicitVal
        : (typeof propKeyOrObj === 'object' ? propKeyOrObj?.default : '') || 'initial';
    handleUpdateStyle(key, defaultVal, true);
    setLastAddedCssKey(key);
  };

  const handleDeleteStyle = (property) => {
    const updated = { ...currentStyle };
    delete updated[property];
    onUpdateElement({ style: updated });
    setRawCss(styleObjectToCss(updated));
    if (onCommitHistory) onCommitHistory();
  };

  const handleAddCustomCss = () => {
    if (!newCssProp.trim()) return;
    handleAddCssProperty(newCssProp.trim(), newCssVal.trim() || 'initial');
    setNewCssProp('');
    setNewCssVal('');
  };

  // Handle Attribute Updates
  const handleUpdateAttr = (attrKey, attrVal) => {
    const updated = { ...currentAttrs, [attrKey]: attrVal };
    onUpdateElement({ attrs: updated });
    if (onCommitHistory) onCommitHistory();
  };

  const handleDeleteAttr = (attrKey) => {
    const updated = { ...currentAttrs };
    delete updated[attrKey];
    onUpdateElement({ attrs: updated });
    if (onCommitHistory) onCommitHistory();
  };

  const handleAddCustomAttr = () => {
    if (!newAttrKey.trim()) return;
    handleUpdateAttr(newAttrKey.trim(), newAttrVal.trim());
    setNewAttrKey('');
    setNewAttrVal('');
  };

  // Raw CSS sync
  const handleRawCssChange = (val) => {
    setRawCss(val);
    const parsed = cssToStyleObject(val);
    onUpdateElement({ style: parsed });
  };

  const handleCopyRawCss = () => {
    navigator.clipboard.writeText(rawCss);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      <div
        style={{
          left: floatingRect.x,
          top: floatingRect.y,
          width: floatingRect.width,
          height: floatingRect.height,
        }}
        className="fixed pointer-events-auto bg-[#18181b] border border-[#2c2c34] rounded-md shadow-2xl flex flex-col overflow-hidden text-zinc-200 font-sans"
      >
        {/* 1. ADOBE FLOATING PALETTE TITLEBAR (Draggable) */}
        <div
          onPointerDown={(e) => {
            if (e.target.closest('button')) return;
            dragInteractionRef.current = {
              mode: 'move',
              startX: e.clientX,
              startY: e.clientY,
              startRect: floatingRect,
            };
          }}
          className="flex items-center justify-between px-3.5 py-2 bg-[#141417] border-b border-[#27272d] cursor-move shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-[#0d99ff]/15 text-[#38bdf8] flex items-center justify-center border border-[#0d99ff]/35 shrink-0">
              <GripHorizontal size={13} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">
                  CSS &amp; Nitelik Penceresi
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101013] text-[#7dd3fc] border border-[#27272d] font-semibold">
                  &lt;{cleanTag}&gt;
                </span>
                <span className="text-[11px] text-zinc-400 font-medium truncate">
                  {element.name || element.id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onDockToRightPanel && (
              <button
                type="button"
                onClick={() => onDockToRightPanel(activeTab === 'attrs' ? 'props' : activeTab === 'raw_css' ? 'code' : 'css')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#1f1f25] hover:bg-[#0d99ff]/20 text-zinc-200 hover:text-white border border-[#2f2f38] transition-colors"
                title="Yüzen pencereyi sağ inspector paneline sabitle"
              >
                <PanelRight size={12} />
                <span>Panele Sabitle</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-colors"
              title="Kapat"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. TAB SWITCHER */}
        <div className="flex items-center px-3 bg-[#121215] border-b border-[#27272d] gap-1">
          <button
            onClick={() => setActiveTab('css')}
            className={`px-3.5 py-2 text-xs font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'css'
                ? 'border-[#0d99ff] text-white bg-[#18181b]'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Sliders size={12} />
            <span>CSS Kuralları & Stiller</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d99ff]/20 text-[#7dd3fc] font-semibold">
              {Object.keys(currentStyle).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('attrs')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'attrs'
                ? 'border-blue-400 text-blue-300 bg-[#13151d]'
                : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <TagIcon size={13} />
            <span>HTML Öznitelikleri (Attributes)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-400/20 text-blue-300 font-bold">
              {Object.keys(currentAttrs).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('raw_css')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'raw_css'
                ? 'border-purple-400 text-purple-300 bg-[#13151d]'
                : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Code2 size={13} />
            <span>Ham CSS Metni</span>
          </button>
        </div>

        {/* 3. TAB CONTENT */}
        <div className="flex-1 overflow-hidden p-4">

          {/* TAB 1: CSS RULES & PROPERTIES */}
          {activeTab === 'css' && (
            <div className="grid grid-cols-12 gap-4 h-full">
              
              {/* Left Column: Active Applied CSS Rules (7 cols) */}
              <div className="col-span-7 min-w-0 flex flex-col bg-[#121215] border border-[#27272d] rounded overflow-hidden">
                <div className="p-2.5 bg-[#141417] border-b border-[#27272d] flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-200 truncate">
                    Uygulanmış CSS Kuralları ({Object.keys(currentStyle).length})
                  </span>
                  <span className="text-[10px] text-[#7dd3fc] font-mono shrink-0">
                    Canlı Senkronize
                  </span>
                </div>

                {/* Inline Quick Add Input */}
                <div className="p-2 bg-[#101013] border-b border-[#27272d] flex items-center gap-1.5 min-w-0">
                  <input
                    type="text"
                    value={newCssProp}
                    onChange={(e) => setNewCssProp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomCss();
                    }}
                    placeholder="Özellik (örn: gap, backdropFilter)"
                    className="flex-1 min-w-0 bg-[#141417] border border-[#2c2c34] rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                  />
                  <input
                    type="text"
                    value={newCssVal}
                    onChange={(e) => setNewCssVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomCss();
                    }}
                    placeholder="Değer (örn: 16px, blur(10px))"
                    className="w-36 min-w-0 shrink bg-[#141417] border border-[#2c2c34] rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCss}
                    disabled={!newCssProp.trim()}
                    className="shrink-0 px-3 py-1 bg-[#0d99ff] hover:bg-[#1fa3ff] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors"
                  >
                    Ekle
                  </button>
                </div>

                {/* List of Styles */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {Object.keys(currentStyle).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-xs">
                      <Sliders size={22} className="mb-2 opacity-40" />
                      <span>Henüz özel bir CSS kuralı atanmadı.</span>
                      <span className="text-[11px] text-zinc-600 mt-1 text-center">
                        Sağdaki katalogdan ↑/↓ ve Enter ile veya tıklayarak ekleyebilirsiniz.
                      </span>
                    </div>
                  ) : (
                    Object.entries(currentStyle).map(([key, val]) => {
                      const meta = cssCatalogMap[key];
                      const kebabName = toKebabCaseCss(key);
                      const strVal = val === undefined || val === null ? '' : String(val);

                      return (
                        <div
                          key={key}
                          className="group bg-[#1c1c21] hover:bg-[#222229] border border-[#2a2a32] hover:border-[#3a3a46] rounded px-2.5 py-2 transition-colors space-y-1.5 min-w-0"
                        >
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-xs text-[#7dd3fc] font-semibold break-words block leading-snug">
                                {kebabName}
                                {kebabName !== key && (
                                  <span className="ml-1.5 text-[10px] font-normal text-zinc-500">
                                    ({key})
                                  </span>
                                )}
                              </span>
                              {meta?.label && (
                                <span className="text-[10px] text-zinc-400 break-words block leading-tight">
                                  {meta.label.split('(')[0].trim()}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteStyle(key)}
                              className="shrink-0 text-zinc-500 hover:text-red-400 p-1 rounded opacity-70 group-hover:opacity-100 transition-opacity"
                              title="Özelliği Kaldır"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <input
                            ref={(elNode) => {
                              cssValueRefs.current[key] = elNode;
                            }}
                            type="text"
                            value={strVal}
                            onChange={(e) => handleUpdateStyle(key, e.target.value, false)}
                            onBlur={() => onCommitHistory?.()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            placeholder={meta?.default || 'Değer girin...'}
                            className="w-full min-w-0 bg-[#101013] border border-[#2c2c34] focus:border-[#0d99ff] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Searchable CSS Property Catalog (5 cols) */}
              <div className="col-span-5 flex flex-col bg-[#121215] border border-[#27272d] rounded overflow-hidden min-w-0">
                <div className="p-2.5 bg-[#141417] border-b border-[#27272d]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-neutral-200">
                      CSS Özellik Kataloğu
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">↑↓ / Enter</span>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={cssSearch}
                      onChange={(e) => setCssSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedCssIdx((prev) =>
                            moveHighlightIndex(prev, 1, filteredCssProps.length)
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedCssIdx((prev) =>
                            moveHighlightIndex(prev, -1, filteredCssProps.length)
                          );
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const chosen = resolveCatalogSelectionOnEnter({
                            query: cssSearch,
                            filteredItems: filteredCssProps,
                            highlightedIndex: highlightedCssIdx,
                            allowCustomCssProp: true,
                          });
                          if (chosen) {
                            handleAddCssProperty(chosen);
                            setCssSearch('');
                          }
                        } else if (e.key === 'Escape') {
                          if (cssSearch) {
                            e.preventDefault();
                            setCssSearch('');
                          }
                        }
                      }}
                      placeholder="CSS ara (↓/↑ seç, Enter ekle)..."
                      className="w-full bg-[#101013] border border-[#2c2c34] rounded pl-7 pr-2 py-1 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-mono"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {filteredCssProps.map((prop, idx) => {
                    const isAlreadyAdded = Object.prototype.hasOwnProperty.call(currentStyle, prop.key);
                    const isHighlighted = idx === highlightedCssIdx;
                    const kebabName = toKebabCaseCss(prop.key);
                    const turkishLabel = prop.label.split('(')[0].trim();

                    return (
                      <button
                        key={prop.key}
                        ref={(elNode) => {
                          cssCatalogItemRefs.current[idx] = elNode;
                        }}
                        type="button"
                        onMouseEnter={() => setHighlightedCssIdx(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!isAlreadyAdded) {
                            handleAddCssProperty(prop);
                          } else {
                            setLastAddedCssKey(prop.key);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded flex items-start justify-between gap-2 text-xs transition-colors border-l-2 ${
                          isHighlighted
                            ? 'bg-[#0d99ff]/18 border-l-[#0d99ff] text-white'
                            : isAlreadyAdded
                            ? 'bg-[#141417]/60 border-l-transparent text-zinc-400 hover:bg-[#1e1e24]'
                            : 'border-l-transparent hover:bg-white/[0.05] hover:text-white text-zinc-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-[11px] font-semibold break-words block leading-snug">
                            {kebabName}
                          </span>
                          <span className="text-[10px] text-zinc-400 break-words block leading-tight mt-0.5">
                            {turkishLabel}
                          </span>
                        </div>
                        {isAlreadyAdded ? (
                          <span className="shrink-0 text-[10px] text-emerald-400 font-sans mt-0.5">Ekli ✓</span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-[#7dd3fc] font-medium px-1.5 py-0.5 rounded bg-[#0d99ff]/12 border border-[#0d99ff]/35 mt-0.5">
                            + Ekle
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: HTML ATTRIBUTES (PROPS) */}
          {activeTab === 'attrs' && (
            <div className="grid grid-cols-12 gap-4 h-full">
              
              {/* Left Column: Applied & Recommended Attributes (7 cols) */}
              <div className="col-span-7 min-w-0 flex flex-col bg-[#141417] border border-[#27272d] rounded overflow-hidden">
                <div className="p-3 bg-[#18181b] border-b border-[#27272d] flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-200 truncate">
                    Mevcut Öznitelikler ({Object.keys(currentAttrs).length})
                  </span>
                  <span className="text-[10px] text-[#38bdf8] font-mono shrink-0">
                    HTML5 DOM
                  </span>
                </div>

                {/* Inline Quick Add Attribute */}
                <div className="p-2.5 bg-[#101013] border-b border-[#27272d] flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomAttr();
                    }}
                    placeholder="Öznitelik adı (örn: href, target, data-id)"
                    className="flex-1 min-w-0 bg-[#141417] border border-[#2c2c32] rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                  />
                  <input
                    type="text"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomAttr();
                    }}
                    placeholder="Değer"
                    className="w-36 min-w-0 shrink bg-[#141417] border border-[#2c2c32] rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAttr}
                    disabled={!newAttrKey.trim()}
                    className="shrink-0 px-3 py-1 bg-[#0d99ff] hover:bg-[#0284c7] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors"
                  >
                    Ekle
                  </button>
                </div>

                {/* List of Attributes */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {/* Standard Base Attributes: id, class */}
                  <div className="bg-[#18181b] border border-[#27272d] rounded p-2.5 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Temel DOM Tanımlayıcıları
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono block mb-1">id:</span>
                        <input
                          type="text"
                          value={currentAttrs.id || ''}
                          onChange={(e) => handleUpdateAttr('id', e.target.value)}
                          placeholder="element-id"
                          className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono block mb-1">class:</span>
                        <input
                          type="text"
                          value={currentAttrs.class || ''}
                          onChange={(e) => handleUpdateAttr('class', e.target.value)}
                          placeholder="tailwind veya custom css sınıfları"
                          className="w-full bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Other Attributes */}
                  {Object.entries(currentAttrs)
                    .filter(([key]) => key !== 'id' && key !== 'class')
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="group bg-[#18181b] hover:bg-[#1f1f24] border border-[#27272d] hover:border-[#3f3f46] rounded px-2.5 py-2 transition-colors space-y-1 min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <span className="font-mono text-xs text-[#38bdf8] font-semibold break-words flex-1 min-w-0" title={key}>
                            {key}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttr(key)}
                            className="shrink-0 text-zinc-500 hover:text-red-400 p-1 rounded opacity-70 group-hover:opacity-100 transition-opacity"
                            title="Özniteliği Kaldır"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={val || ''}
                          onChange={(e) => handleUpdateAttr(key, e.target.value)}
                          className="w-full min-w-0 bg-[#101013] border border-[#2c2c32] focus:border-[#0d99ff] rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none"
                        />
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Column: Suggested Attributes for this Tag (5 cols) */}
              <div className="col-span-5 min-w-0 flex flex-col bg-[#141417] border border-[#27272d] rounded overflow-hidden">
                <div className="p-3 bg-[#18181b] border-b border-[#27272d]">
                  <span className="text-xs font-bold text-zinc-200 block mb-1">
                    &lt;{cleanTag}&gt; İçin Önerilen Öznitelikler
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    HTML5 standardına göre bu etiket için geçerli nitelikler:
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {validCommonAttrs.map((attr) => {
                    const isAdded = currentAttrs.hasOwnProperty(attr);
                    return (
                      <button
                        key={attr}
                        onClick={() => {
                          if (!isAdded) {
                            handleUpdateAttr(attr, attr === 'target' ? '_blank' : '');
                          }
                        }}
                        disabled={isAdded}
                        className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                          isAdded
                            ? 'bg-[#101013] text-zinc-500 cursor-not-allowed'
                            : 'hover:bg-[#0d99ff]/15 hover:text-[#38bdf8] text-zinc-300'
                        }`}
                      >
                        <span className="font-mono">{attr}</span>
                        {isAdded ? (
                          <span className="text-[10px] text-emerald-400 font-sans">Ekli ✓</span>
                        ) : (
                          <span className="text-[10px] text-[#38bdf8] font-sans">+ Ekle</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: RAW CSS TEXT EDITOR */}
          {activeTab === 'raw_css' && (
            <div className="flex flex-col h-full bg-[#141417] border border-[#27272d] rounded overflow-hidden">
              <div className="p-3 bg-[#18181b] border-b border-[#27272d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">
                    Doğrudan CSS Düzenleyici (İki Yönlü Canlı Senkronizasyon)
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    CSS kurallarını standart sözdizimiyle yazın veya kopyalayın.
                  </span>
                </div>
                <button
                  onClick={handleCopyRawCss}
                  className="px-2.5 py-1 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#2c2c32]"
                >
                  {copiedRaw ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedRaw ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>

              <textarea
                value={rawCss}
                onChange={(e) => handleRawCssChange(e.target.value)}
                onBlur={() => {
                  if (onCommitHistory) onCommitHistory();
                }}
                className="flex-1 w-full p-4 bg-[#101013] text-emerald-300 font-mono text-xs focus:outline-none resize-none leading-relaxed selection:bg-[#0d99ff]/30"
                placeholder="/* Örnek CSS kuralları */&#10;color: #ffffff;&#10;padding: 16px;&#10;border-radius: 12px;"
              />
            </div>
          )}

        </div>

        {/* 4. FOOTER STATUS BAR & RESIZE HANDLE */}
        <div className="relative px-4 py-2 bg-[#18181b] border-t border-[#27272d] flex items-center justify-between text-[11px] text-zinc-400 shrink-0 pr-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate">Seçili: <strong className="text-zinc-100 font-mono">&lt;{cleanTag}&gt;#{currentAttrs.id || element.id}</strong></span>
            <span>•</span>
            <span className="shrink-0 tabular-nums">W: <strong className="text-zinc-100">{element.width}px</strong> × H: <strong className="text-zinc-100">{element.height}px</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded bg-[#0d99ff] hover:bg-[#0284c7] text-white font-semibold text-xs transition-colors shrink-0"
          >
            Tamam
          </button>
          {/* Adobe Bottom-Right Resize Corner Grip */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              dragInteractionRef.current = {
                mode: 'resize',
                startX: e.clientX,
                startY: e.clientY,
                startRect: floatingRect,
              };
            }}
            title="Pencere boyutunu sürükleyerek ayarla"
            className="absolute right-0.5 bottom-0.5 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-neutral-500 hover:text-neutral-200"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-70">
              <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
