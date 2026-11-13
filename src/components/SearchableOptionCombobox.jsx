import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, CornerDownLeft, ChevronDown, X } from 'lucide-react';
import {
  filterPropertyCatalog,
  moveHighlightIndex,
  resolveCatalogSelectionOnEnter,
  toKebabCaseCss,
} from '../utils/propertySearch';

const ACCENT_STYLES = {
  pink: {
    ring: 'focus-within:border-[#0d99ff] focus-within:ring-1 focus-within:ring-[#0d99ff]/25',
    activeItem: 'bg-[#0d99ff]/15 border-[#0d99ff] text-white',
    badge: 'text-[#7dd3fc]',
    button: 'text-[#7dd3fc] border-[#0d99ff]/40 bg-[#0d99ff]/10 hover:bg-[#0d99ff]/20',
  },
  blue: {
    ring: 'focus-within:border-[#0d99ff] focus-within:ring-1 focus-within:ring-[#0d99ff]/25',
    activeItem: 'bg-[#0d99ff]/15 border-[#0d99ff] text-white',
    badge: 'text-[#7dd3fc]',
    button: 'text-[#7dd3fc] border-[#0d99ff]/40 bg-[#0d99ff]/10 hover:bg-[#0d99ff]/20',
  },
  purple: {
    ring: 'focus-within:border-[#0d99ff] focus-within:ring-1 focus-within:ring-[#0d99ff]/25',
    activeItem: 'bg-[#0d99ff]/15 border-[#0d99ff] text-white',
    badge: 'text-[#7dd3fc]',
    button: 'text-[#7dd3fc] border-[#0d99ff]/40 bg-[#0d99ff]/10 hover:bg-[#0d99ff]/20',
  },
  cyan: {
    ring: 'focus-within:border-[#0d99ff] focus-within:ring-1 focus-within:ring-[#0d99ff]/25',
    activeItem: 'bg-[#0d99ff]/15 border-[#0d99ff] text-white',
    badge: 'text-[#7dd3fc]',
    button: 'text-[#7dd3fc] border-[#0d99ff]/40 bg-[#0d99ff]/10 hover:bg-[#0d99ff]/20',
  },
};

/**
 * Keyboard-accessible searchable catalog combobox (ArrowDown/Up, Enter, Escape).
 * Displays full non-truncated property names and avoids blur/click timing issues.
 */
export default function SearchableOptionCombobox({
  items = [],
  excludedKeys = [],
  onSelect,
  placeholder = 'Özellik ara... (↓/↑ ile seç, Enter ile ekle)',
  allowCustom = true,
  customLabelPrefix = 'Özel ekle',
  formatPrimaryName = (item) => toKebabCaseCss(item.key),
  formatSecondaryLabel = (item) => item.label || item.description || '',
  emptyMessage = 'Eşleşen özellik bulunamadı.',
  accent = 'pink',
  triggerLabel = null,
  inputId = undefined,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const palette = ACCENT_STYLES[accent] || ACCENT_STYLES.pink;

  const filteredItems = useMemo(
    () => filterPropertyCatalog(items, query, excludedKeys),
    [items, query, excludedKeys]
  );

  // Keep highlighted index valid when results shrink/expand
  useEffect(() => {
    if (filteredItems.length === 0) {
      setHighlightedIndex(-1);
    } else {
      setHighlightedIndex((prev) =>
        prev >= 0 && prev < filteredItems.length ? prev : 0
      );
    }
  }, [filteredItems.length, query]);

  // Scroll highlighted option cleanly into view during ArrowDown / ArrowUp navigation
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const node = optionRefs.current[highlightedIndex];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on outside pointer down
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const commitSelection = (item) => {
    if (!item) return;
    onSelect?.(item);
    setQuery('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const trimmedQuery = query.trim();
  const customCandidate = useMemo(() => {
    if (!allowCustom || !trimmedQuery) return null;
    if (filteredItems.some((it) => it.key.toLowerCase() === trimmedQuery.toLowerCase() || toKebabCaseCss(it.key).toLowerCase() === trimmedQuery.toLowerCase())) {
      return null;
    }
    return resolveCatalogSelectionOnEnter({
      query: trimmedQuery,
      filteredItems: [],
      highlightedIndex: -1,
      allowCustomCssProp: true,
    });
  }, [allowCustom, trimmedQuery, filteredItems]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) => moveHighlightIndex(prev, 1, filteredItems.length));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) => moveHighlightIndex(prev, -1, filteredItems.length));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = resolveCatalogSelectionOnEnter({
        query,
        filteredItems,
        highlightedIndex,
        allowCustomCssProp: allowCustom,
      });
      if (chosen) {
        commitSelection(chosen);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div
        className={`flex items-center gap-1.5 bg-[#0d0f15] border border-white/[0.08] rounded-lg px-2.5 py-1.5 transition-all ${palette.ring}`}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-100 placeholder-slate-500 outline-none"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            title="Aramayı temizle"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {triggerLabel && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsOpen((v) => !v);
              inputRef.current?.focus();
            }}
            className="shrink-0 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] transition-colors"
            title="Listeyi aç / kapat"
          >
            <span>{triggerLabel}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="mt-1.5 w-full bg-[#13161f] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-40"
        >
          <div className="px-2.5 py-1.5 bg-[#0d0f15] border-b border-white/[0.07] flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-medium">{filteredItems.length} özellik</span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span>↑↓</span>
              <span>•</span>
              <span className="inline-flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" /> ekle
              </span>
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.05]">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isActive = idx === highlightedIndex;
                const primaryName = formatPrimaryName(item);
                const secondaryLabel = formatSecondaryLabel(item);
                return (
                  <button
                    key={item.key}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={(e) => {
                      // Prevent blur closing the menu or swallowing the click before selection executes
                      e.preventDefault();
                      commitSelection(item);
                    }}
                    className={`w-full px-2.5 py-2 flex items-start justify-between gap-2 text-left transition-colors border-l-2 ${
                      isActive
                        ? palette.activeItem
                        : 'border-l-transparent hover:bg-white/[0.04] text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-100 break-words leading-snug">
                        {primaryName}
                      </span>
                      {secondaryLabel && secondaryLabel !== primaryName && (
                        <span className="text-[10px] text-slate-400 break-words leading-snug mt-0.5">
                          {secondaryLabel}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md border mt-0.5 ${palette.button}`}>
                      + Ekle
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3.5 text-[11px] text-slate-500 text-center">
                {emptyMessage}
              </div>
            )}

            {customCandidate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSelection(customCandidate);
                }}
                className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left bg-[#0d0f15] hover:bg-white/[0.05] text-slate-200 border-t border-white/[0.07]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Plus className={`w-3.5 h-3.5 shrink-0 ${palette.badge}`} />
                  <span className="text-[11px] break-all">
                    {customLabelPrefix}{' '}
                    <span className="font-mono font-semibold text-white">
                      {customCandidate.label || customCandidate.key}
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">Özel</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
