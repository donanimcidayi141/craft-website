import React, { useState } from 'react';
import { 
  MousePointer, Square, Hand, Type, Image as ImageIcon, 
  Sparkles, RectangleHorizontal, Palette, ArrowRightLeft, 
  Wand2, Layers, Sliders, Plus, Tag as TagIcon
} from 'lucide-react';

export default function LeftToolbar({
  activeTool,
  setActiveTool,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  setSecondaryColor,
  onQuickAdd,
  onRemoveBackground,
  selectedElement
}) {
  const [showColorModal, setShowColorModal] = useState(false);
  const [editingColorType, setEditingColorType] = useState('primary'); // 'primary' or 'secondary'

  const tools = [
    { id: 'select', name: 'Seçim Aracı (V)', icon: MousePointer, shortcut: 'V' },
    { id: 'rectangle', name: 'Kutu / Dikdörtgen (R)', icon: Square, shortcut: 'R' },
    { id: 'hand', name: 'El Aracı / Pan (H)', icon: Hand, shortcut: 'H' },
    { id: 'text', name: 'Metin Aracı (T)', icon: Type, shortcut: 'T' },
    { id: 'image', name: 'Görsel Aracı (I)', icon: ImageIcon, shortcut: 'I' },
    { id: 'button', name: 'Buton Aracı (B)', icon: RectangleHorizontal, shortcut: 'B' },
  ];

  const handleSwapColors = () => {
    const temp = primaryColor;
    setPrimaryColor(secondaryColor);
    setSecondaryColor(temp);
  };

  return (
    <aside className="w-14 bg-[#18181b] border-r border-[#27272d] flex flex-col items-center py-2 select-none z-30 justify-between">
      {/* Top Tools */}
      <div className="flex flex-col items-center space-y-1.5 w-full px-1.5">
        {/* Quick Tag Adder Button */}
        <button
          onClick={() => onQuickAdd('tag_picker')}
          title="HTML Tag'i Ekle (Bu ne olacak?)"
          className="w-10 h-10 flex flex-col items-center justify-center rounded bg-[#0d99ff]/15 hover:bg-[#0d99ff]/25 border border-[#0d99ff]/40 text-[#38bdf8] transition-all group"
        >
          <Plus size={15} className="group-hover:scale-110 transition-transform" />
          <span className="text-[7px] font-semibold tracking-tight">Tag+</span>
        </button>

        <div className="w-8 h-[1px] bg-[#27272d] my-0.5"></div>

        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTool(t.id);
                if (t.id === 'rectangle' || t.id === 'text' || t.id === 'image' || t.id === 'button') {
                  onQuickAdd(t.id);
                }
              }}
              title={t.name}
              className={`relative w-10 h-10 flex items-center justify-center rounded transition-all ${
                isActive
                  ? 'bg-[#0d99ff] text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222228]'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="absolute bottom-0.5 right-1 text-[8px] font-mono opacity-60">
                {t.shortcut}
              </span>
            </button>
          );
        })}

        <div className="w-8 h-[1px] bg-[#27272d] my-1"></div>

        {/* Adobe Background Remover Tool */}
        <button
          onClick={onRemoveBackground}
          title="Arka Plan Silme Aracı (AI Magic Wand) - Seçili elemanın arka planını şeffaf yapar"
          disabled={!selectedElement}
          className={`w-10 h-10 flex flex-col items-center justify-center rounded transition-all ${
            selectedElement
              ? 'text-zinc-300 hover:bg-[#0d99ff]/15 hover:text-[#38bdf8]'
              : 'text-zinc-600 opacity-40 cursor-not-allowed'
          }`}
        >
          <Wand2 size={17} />
          <span className="text-[7px] font-medium tracking-tight mt-0.5">Silici</span>
        </button>
      </div>

      {/* Bottom Color Swatches (Adobe Style Overlapping Squares) */}
      <div className="flex flex-col items-center w-full px-1.5 pb-2">
        <div className="relative w-10 h-10 mb-1">
          {/* Secondary (Background) Color Box */}
          <button
            onClick={() => {
              setEditingColorType('secondary');
              setShowColorModal(true);
            }}
            title="İkincil / Arka Plan Rengi"
            style={{ backgroundColor: secondaryColor }}
            className="absolute bottom-0 right-0 w-6 h-6 rounded border-2 border-[#18181b] shadow-sm hover:scale-105 transition-transform"
          />
          
          {/* Primary (Foreground) Color Box */}
          <button
            onClick={() => {
              setEditingColorType('primary');
              setShowColorModal(true);
            }}
            title="Birincil / Dolgu Rengi"
            style={{ backgroundColor: primaryColor }}
            className="absolute top-0 left-0 w-6 h-6 rounded border-2 border-[#3f3f46] shadow-md z-10 hover:scale-105 transition-transform"
          />
        </div>

        {/* Swap colors button (Adobe X shortcut) */}
        <button
          onClick={handleSwapColors}
          title="Renkleri Değiştir (X)"
          className="text-zinc-400 hover:text-[#38bdf8] p-1"
        >
          <ArrowRightLeft size={11} />
        </button>

        {/* Color picker popup modal */}
        {showColorModal && (
          <div className="absolute left-16 bottom-6 bg-[#18181b] border border-[#2c2c32] rounded-md p-3 shadow-2xl z-50 w-52">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-neutral-200">
                {editingColorType === 'primary' ? 'Birincil Renk' : 'İkincil Renk'}
              </span>
              <button 
                onClick={() => setShowColorModal(false)}
                className="text-neutral-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            <input
              type="color"
              value={editingColorType === 'primary' ? primaryColor : secondaryColor}
              onChange={(e) => {
                if (editingColorType === 'primary') {
                  setPrimaryColor(e.target.value);
                } else {
                  setSecondaryColor(e.target.value);
                }
              }}
              className="w-full h-8 cursor-pointer rounded border border-white/[0.09] mb-2 bg-transparent"
            />

            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] text-neutral-400">HEX:</span>
              <input
                type="text"
                value={editingColorType === 'primary' ? primaryColor : secondaryColor}
                onChange={(e) => {
                  if (editingColorType === 'primary') {
                    setPrimaryColor(e.target.value);
                  } else {
                    setSecondaryColor(e.target.value);
                  }
                }}
                className="w-full bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-0.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#0d99ff]"
              />
            </div>

            {/* Quick swatches */}
            <div className="grid grid-cols-5 gap-1 pt-1 border-t border-white/[0.07]">
              {['#d4af37', '#f5ecd7', '#1a1816', '#e5e7eb', '#ffffff', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    if (editingColorType === 'primary') {
                      setPrimaryColor(c);
                    } else {
                      setSecondaryColor(c);
                    }
                  }}
                  style={{ backgroundColor: c }}
                  className="w-6 h-6 rounded border border-white/[0.1] hover:scale-110 transition-transform"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
