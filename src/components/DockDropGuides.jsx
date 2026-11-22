import React from 'react';
import { PanelLeft, PanelRight, Square, X } from 'lucide-react';

/**
 * Non-blocking translucent drop-zone overlays displayed only while a panel header drag
 * has crossed the 6px movement threshold. Guides non-technical users cleanly to Left Dock,
 * Right Dock, or Floating Window targets with an explicit Escape cancel hint.
 */
export default function DockDropGuides({ activeDrag }) {
  if (!activeDrag || !activeDrag.hasExceededThreshold) return null;

  const { title, targetZone, allowedZones = ['left', 'right', 'floating'] } = activeDrag;
  const canLeft = allowedZones.includes('left');
  const canRight = allowedZones.includes('right');
  const canFloat = allowedZones.includes('floating');

  return (
    <div
      data-dock-drop-guides="true"
      aria-live="polite"
      className="fixed inset-0 pointer-events-none z-[120]"
    >
      {/* Left Dock Drop Target */}
      {canLeft && (
        <div
          data-drop-zone-guide="left"
          data-drop-zone-active={targetZone === 'left' ? 'true' : 'false'}
          className={`fixed top-[46px] bottom-2 left-[54px] w-[104px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-150 ${
            targetZone === 'left'
              ? 'bg-[#0d99ff]/28 border-[#38bdf8] text-white shadow-[0_0_28px_rgba(13,153,255,0.45)] scale-[1.01]'
              : 'bg-[#0d99ff]/10 border-[#0d99ff]/45 text-sky-200/80'
          }`}
        >
          <PanelLeft size={20} />
          <span className="text-[11px] font-semibold text-center px-2 leading-tight">
            Sola Sabitle
          </span>
        </div>
      )}

      {/* Right Dock Drop Target */}
      {canRight && (
        <div
          data-drop-zone-guide="right"
          data-drop-zone-active={targetZone === 'right' ? 'true' : 'false'}
          className={`fixed top-[46px] bottom-2 right-[44px] w-[104px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-150 ${
            targetZone === 'right'
              ? 'bg-[#0d99ff]/28 border-[#38bdf8] text-white shadow-[0_0_28px_rgba(13,153,255,0.45)] scale-[1.01]'
              : 'bg-[#0d99ff]/10 border-[#0d99ff]/45 text-sky-200/80'
          }`}
        >
          <PanelRight size={20} />
          <span className="text-[11px] font-semibold text-center px-2 leading-tight">
            Sağa Sabitle
          </span>
        </div>
      )}

      {/* Top-Center Floating Status Pill */}
      {canFloat && (
        <div className="fixed top-[54px] left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div
            data-drop-zone-guide="floating"
            data-drop-zone-active={targetZone === 'floating' ? 'true' : 'false'}
            className={`px-3.5 py-2 rounded-lg border text-[11px] font-medium flex items-center gap-2 shadow-2xl backdrop-blur-md transition-all ${
              targetZone === 'floating'
                ? 'bg-[#111827]/95 border-[#38bdf8] text-white'
                : 'bg-[#18181b]/92 border-[#32323c] text-zinc-200'
            }`}
          >
            <Square size={13} className="text-[#38bdf8] shrink-0" />
            <span>
              <strong className="text-white">{title}</strong>:{' '}
              {targetZone === 'left'
                ? 'Sol panele sabitlenecek'
                : targetZone === 'right'
                  ? 'Sağ panele sabitlenecek'
                  : 'Yüzen pencere olarak bırak'}
            </span>
            <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-[#101014] border border-[#2f2f39] text-[10px] text-zinc-400">
              <X size={10} />
              <span>Esc: İptal</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
