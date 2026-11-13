import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Tag as TagIcon, Box, Type, MousePointer, Image, Layout, Sparkles, Code2 } from 'lucide-react';
import { ALL_HTML_TAGS, TAG_CATEGORIES, TAG_INFO, isVoidTag } from '../data/tagRegistry';

export default function TagPickerModal({
  isOpen,
  onClose,
  onSelectTag,
  title = "Bu ne olacak?",
  subtitle = "Sayfaya eklemek istediğiniz HTML tag'ini seçin:"
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedCategory('popular');
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter tags based on category & search term
  const filteredTags = ALL_HTML_TAGS.filter(tag => {
    // Category filter (if not searching)
    if (!search.trim()) {
      if (selectedCategory === 'all') return true;
      const categoryTags = TAG_CATEGORIES[selectedCategory]?.tags || [];
      return categoryTags.includes(tag);
    }
    // Search query
    const query = search.toLowerCase().trim();
    const info = TAG_INFO[tag];
    const matchTag = tag.toLowerCase().includes(query);
    const matchLabel = info?.label?.toLowerCase().includes(query);
    const matchDesc = info?.desc?.toLowerCase().includes(query);
    return matchTag || matchLabel || matchDesc;
  });

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredTags.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags[highlightedIndex]) {
        onSelectTag(filteredTags[highlightedIndex]);
        onClose();
      }
    }
  };

  const categories = [
    { id: 'popular', label: 'Yaygın', icon: Sparkles },
    { id: 'containers', label: 'Kapsayıcılar', icon: Box },
    { id: 'typography', label: 'Metin & Başlık', icon: Type },
    { id: 'interactive', label: 'Buton & Form', icon: MousePointer },
    { id: 'media', label: 'Medya', icon: Image },
    { id: 'tables', label: 'Tablolar', icon: Layout },
    { id: 'all', label: "Bütün Tag'ler (144+)", icon: Code2 },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#18181b] border border-[#2c2c32] rounded-md shadow-2xl w-full max-w-2xl h-[560px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#27272d] flex items-center justify-between bg-[#141417]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#0d99ff]/15 text-[#38bdf8] border border-[#0d99ff]/35 flex items-center justify-center">
              <TagIcon size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-[13px] flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101013] text-[#7dd3fc] border border-[#27272d]">
                  HTML5 AST
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#27272d] bg-[#161619]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Tag adı veya işlevi ile ara (örn: button, section, img, h1, nav, form, p)..."
              className="w-full pl-9 pr-16 py-2 bg-[#101013] border border-[#2c2c34] rounded text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#0d99ff] font-mono transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 hover:text-white"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Category Chips (Only shown when not searching) */}
          {!search && (
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-0.5 no-scrollbar">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setHighlightedIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#0d99ff] border-[#0d99ff] text-white font-semibold'
                        : 'bg-[#1c1c21] border-[#2a2a32] text-zinc-400 hover:text-zinc-100 hover:bg-[#23232a]'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tag List Grid / Scroll Area */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3.5 space-y-1.5">
          {filteredTags.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-zinc-400">
              <Code2 size={32} className="text-zinc-600 mb-2" />
              <p className="text-xs font-medium">&quot;{search}&quot; ile eşleşen bir HTML tag&apos;i bulunamadı.</p>
              <p className="text-[11px] text-zinc-500 mt-1">Lütfen farklı bir arama terimi deneyin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filteredTags.map((tag, idx) => {
                const info = TAG_INFO[tag];
                const isVoid = isVoidTag(tag);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={tag}
                    onClick={() => {
                      onSelectTag(tag);
                      onClose();
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-2.5 rounded border cursor-pointer transition-colors flex flex-col justify-between ${
                      isHighlighted
                        ? 'bg-[#0d99ff]/15 border-[#0d99ff] text-white'
                        : 'bg-[#1c1c21] border-[#2a2a32] hover:bg-[#222229] hover:border-[#383844]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#7dd3fc]">
                          &lt;{tag}&gt;
                        </span>
                        <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[140px]">
                          {info?.label?.split('(')[0] || tag}
                        </span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-mono font-medium ${
                        isVoid
                          ? 'bg-[#211316] text-rose-300 border border-rose-500/30'
                          : 'bg-[#101c16] text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isVoid ? 'Void' : 'Kapsayıcı'}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 line-clamp-1">
                      {info?.desc || `${tag} HTML öğesi`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 border-t border-[#27272d] bg-[#141417] flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span>Toplam: <strong className="font-mono text-zinc-200">{filteredTags.length}</strong> tag</span>
            <span className="text-zinc-600">|</span>
            <span>↑ / ↓ ok tuşları ile gezin, <kbd className="px-1.5 py-0.5 rounded bg-[#101013] border border-[#2c2c34] text-zinc-300 font-mono text-[10px]">Enter</kbd> ile seç</span>
          </div>
          <span className="text-zinc-400">Tag&apos;i daha sonra sağ panelden değiştirebilirsiniz</span>
        </div>

      </div>
    </div>
  );
}
