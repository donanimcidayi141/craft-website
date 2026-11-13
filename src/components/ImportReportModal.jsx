import React, { useEffect } from 'react';
import {
  FolderCheck, Layers, Link as LinkIcon, ShieldAlert,
  CheckCircle2, X, ArrowRight, FileCode
} from 'lucide-react';

export default function ImportReportModal({
  isOpen,
  onClose,
  importData,
  onConfirmOpen
}) {
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

  if (!isOpen || !importData) return null;

  const isNative = importData.type === 'craft-native';
  const tabsCount = importData.tabs?.length || 0;
  const linksCount = importData.pageLinks?.length || 0;
  const unsupportedCount = importData.unsupportedCount || 0;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#18181b] border border-[#2c2c34] rounded-md shadow-2xl w-full max-w-2xl max-h-[640px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#27272d] flex items-center justify-between bg-[#141417]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded flex items-center justify-center border ${
              isNative
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
                : 'bg-[#0d99ff]/15 text-[#38bdf8] border-[#0d99ff]/35'
            }`}>
              {isNative ? <CheckCircle2 size={17} /> : <FolderCheck size={17} />}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-[13px] flex items-center gap-2">
                <span>{importData.name || 'Proje'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isNative
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-[#101013] text-[#7dd3fc] border-[#27272d]'
                }`}>
                  {isNative ? 'craft.project.json (Kayıpsız Şema)' : 'Harici Web Projesi (Babel & İzole Motor)'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-md font-mono mt-0.5">
                {importData.folderPath}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 bg-[#111113]">
          {/* Summary Status Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#18181b] border border-[#27272d] p-3 rounded">
              <div className="flex items-center gap-2 text-[#7dd3fc] font-medium mb-1">
                <Layers size={14} />
                <span>Sayfalar</span>
              </div>
              <span className="text-xl font-bold text-white font-mono tabular-nums">{tabsCount}</span>
              <span className="text-[11px] text-zinc-500 block mt-0.5">Sekme oluşturuldu</span>
            </div>

            <div className="bg-[#18181b] border border-[#27272d] p-3 rounded">
              <div className="flex items-center gap-2 text-emerald-400 font-medium mb-1">
                <LinkIcon size={14} />
                <span>Sayfa Bağlantıları</span>
              </div>
              <span className="text-xl font-bold text-white font-mono tabular-nums">{linksCount}</span>
              <span className="text-[11px] text-zinc-500 block mt-0.5">Bağlantı grafı hazır</span>
            </div>

            <div className={`p-3 rounded border ${
              unsupportedCount > 0
                ? 'bg-[#1b1812] border-amber-500/35 text-amber-300'
                : 'bg-[#18181b] border-[#27272d] text-zinc-400'
            }`}>
              <div className="flex items-center gap-2 font-medium mb-1">
                <ShieldAlert size={14} className={unsupportedCount > 0 ? 'text-amber-400' : 'text-zinc-500'} />
                <span>Kod Bileşenleri</span>
              </div>
              <span className={`text-xl font-bold font-mono tabular-nums ${unsupportedCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                {unsupportedCount}
              </span>
              <span className="text-[11px] text-zinc-500 block mt-0.5">
                {unsupportedCount > 0 ? 'Kilitli kutu olarak eklendi' : 'Tam statik uyumlu'}
              </span>
            </div>
          </div>

          {/* Detailed Tab List */}
          <div>
            <h4 className="font-medium text-zinc-200 mb-2 flex items-center gap-1.5">
              <FileCode size={13} className="text-[#38bdf8]" />
              <span>Açılacak Sayfalar / Sekmeler:</span>
            </h4>
            <div className="bg-[#18181b] border border-[#27272d] rounded overflow-hidden divide-y divide-[#222228]">
              {importData.tabs?.map((t, idx) => (
                <div key={t.id || idx} className="px-3.5 py-2 flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-sm bg-[#101013] border border-[#27272d] flex items-center justify-center font-mono text-[10px] text-zinc-400">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-white">{t.name}</span>
                    <span className="text-zinc-500 font-mono text-[11px]">({t.route || '/'})</span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                    {t.elements?.length || 0} kök eleman
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Unsupported Features Info Box */}
          {unsupportedCount > 0 && (
            <div className="bg-[#1b1812] border border-amber-500/35 rounded p-3.5 text-amber-200 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-amber-300 block">
                    {unsupportedCount} Adet Dinamik Kod Bileşeni Güvenle Kilitlendi
                  </span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    React Hook&apos;ları (useState, useEffect vb.), dinamik dizi haritalama (.map) ve koşullu render ifadeleri stüdyo tuvalinde hata vermeden <strong>&quot;Kod Bileşeni&quot;</strong> olarak kilitli gösterilir. Kod stüdyo penceresinde çalıştırılmaz.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#27272d] bg-[#141417] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#202026] hover:bg-[#282830] border border-[#2f2f38] text-zinc-300 font-medium transition-colors"
          >
            Vazgeç
          </button>

          <button
            onClick={onConfirmOpen}
            className="px-4 py-1.5 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>Stüdyoda Projeyi Aç</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
