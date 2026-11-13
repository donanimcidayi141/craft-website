import React, { useState } from 'react';
import { Box, Plus, Search, X } from 'lucide-react';
import { PRESET_ASSETS } from '../constants';
import PresetThumbnail from './PresetThumbnail';

export default function AssetsPanel({ onAddPreset, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');

  const categories = [
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

  const filteredAssets = PRESET_ASSETS.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'Hepsi' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-80 bg-[#141417] border-l border-[#27272d] flex flex-col h-full text-xs text-zinc-300 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#27272d] bg-[#18181b]">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Box size={14} className="text-[#38bdf8]" />
          <span>Varlıklar & Şablonlar (Assets)</span>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]">
          <X size={13} />
        </button>
      </div>

      {/* Search & Categories */}
      <div className="p-3 border-b border-[#27272d] space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Asset ara (buton, kart, şekil)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#101013] border border-[#2c2c32] rounded pl-7 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
          />
        </div>

        {/* Filter categories */}
        <div className="flex flex-wrap items-center gap-1 pb-1 text-[10px]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#0d99ff] text-white font-medium'
                  : 'bg-[#101013] text-zinc-400 hover:text-zinc-100 border border-[#27272d]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid */}
      <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
        <div className="grid grid-cols-1 gap-2.5">
          {filteredAssets.map((asset, idx) => (
            <div
              key={asset.presetKey || idx}
              className="bg-[#18181b] border border-[#27272d] hover:border-[#0d99ff]/50 rounded p-2.5 flex flex-col justify-between group transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-zinc-200 text-xs">{asset.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#101013] text-zinc-400 border border-[#27272d]">
                  {asset.category}
                </span>
              </div>

              {asset.description && (
                <p className="text-[10px] text-zinc-400 mb-2 line-clamp-1">{asset.description}</p>
              )}

              {/* Visual preview representation */}
              <div className="h-20 bg-[#101013] rounded border border-[#27272d] flex items-center justify-center p-2 mb-2 overflow-hidden">
                <PresetThumbnail asset={asset} />
              </div>

              {/* Add to canvas button */}
              <button
                onClick={() => onAddPreset(asset.element, asset.name, asset)}
                className="w-full py-1.5 rounded bg-[#101013] border border-[#27272d] hover:bg-[#0d99ff] hover:border-[#0d99ff] hover:text-white text-zinc-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                <Plus size={13} />
                <span>Tuvale Ekle</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
