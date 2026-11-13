import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  ExternalLink,
  Rocket,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { buildStandaloneHtmlSite } from '../utils/generateReactCode';

const PRESENTATION_FRAMES = [
  { id: 'full', label: 'Tam Tarayıcı', icon: Maximize2, width: null },
  { id: 'desktop', label: '1280px', icon: Monitor, width: 1280 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 768 },
  { id: 'mobile', label: 'Mobil', icon: Smartphone, width: 390 },
];

/**
 * Full-viewport PowerPoint-style live browser presentation overlay.
 * Renders the published standalone HTML5 bundle at exact 1:1 scale with multi-page slide controls.
 */
export default function PresentationOverlay({
  projectName = 'CraftStudio Sitesi',
  tabs = [],
  activeTabId = null,
  onSelectTab,
  projectFunctions = [],
  initialViewport = 'full',
  onClose,
  onOpenExportModal,
}) {
  const safeTabs = useMemo(
    () => (Array.isArray(tabs) && tabs.length > 0 ? tabs : []),
    [tabs]
  );

  const [frameMode, setFrameMode] = useState(
    initialViewport === 'mobile' || initialViewport === 'tablet' ? initialViewport : 'full'
  );
  const [barCollapsed, setBarCollapsed] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState(activeTabId || safeTabs[0]?.id || null);
  const iframeRef = useRef(null);

  // Build HTML once for the presentation session (only changes when tabs or functions change)
  const presentationHtml = useMemo(() => {
    const active = safeTabs.find((t) => t.id === (activeTabId || currentSlideId)) || safeTabs[0];
    return buildStandaloneHtmlSite({
      projectName,
      tabs: safeTabs,
      activeTabId: active?.id || activeTabId,
      elements: active?.elements,
      canvasSettings: active?.canvasByViewport?.desktop || { width: 1280, height: 1350, backgroundColor: '#0b0a09' },
      canvasByViewport: active?.canvasByViewport,
      projectFunctions,
    });
  }, [projectName, safeTabs, activeTabId, currentSlideId, projectFunctions]);

  const currentIdx = Math.max(
    0,
    safeTabs.findIndex((t) => t.id === currentSlideId)
  );
  const currentTab = safeTabs[currentIdx] || safeTabs[0];

  const goToSlideIndex = useCallback(
    (nextIdx) => {
      if (safeTabs.length === 0) return;
      const wrapped = ((nextIdx % safeTabs.length) + safeTabs.length) % safeTabs.length;
      const targetTab = safeTabs[wrapped];
      if (!targetTab) return;
      setCurrentSlideId(targetTab.id);
      onSelectTab?.(targetTab.id);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'craft-goto-page', target: targetTab.route || targetTab.id },
          '*'
        );
      } catch {
        // Ignore cross-frame timing before iframe load completes
      }
    },
    [safeTabs, onSelectTab]
  );

  // Sync in-page navbar route clicks back to presentation slide indicator
  useEffect(() => {
    const onMessage = (evt) => {
      if (evt?.data?.type !== 'craft-active-page') return;
      const hit = safeTabs.find(
        (t) =>
          t.id === evt.data.id ||
          (t.route && t.route === evt.data.route)
      );
      if (hit) {
        setCurrentSlideId(hit.id);
        onSelectTab?.(hit.id);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [safeTabs, onSelectTab]);

  // Keyboard shortcuts: Esc exits, ArrowLeft / ArrowRight step slides on multi-page sites
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (safeTabs.length > 1 && e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlideIndex(currentIdx + 1);
      } else if (safeTabs.length > 1 && e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlideIndex(currentIdx - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, safeTabs.length, goToSlideIndex, currentIdx]);

  const handleOpenInNewTab = () => {
    const blob = new Blob([presentationHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const activeFrame = PRESENTATION_FRAMES.find((f) => f.id === frameMode) || PRESENTATION_FRAMES[0];

  return (
    <div
      data-testid="presentation-overlay"
      className="fixed inset-0 z-[120] bg-[#070709] flex flex-col select-none"
    >
      {/* Top Sleek Presenter Bar */}
      {!barCollapsed ? (
        <header className="h-12 shrink-0 px-4 bg-[#101013]/95 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between gap-3">
          {/* Left: Slide Indicator & Prev/Next */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-200 text-[11px] font-semibold whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Sunum Modu</span>
            </div>

            <span className="text-xs font-medium text-zinc-200 truncate max-w-[180px]" title={projectName}>
              {projectName}
            </span>

            {safeTabs.length > 1 && (
              <div className="flex items-center gap-1 ml-1 bg-[#18181d] border border-white/[0.07] rounded-full px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => goToSlideIndex(currentIdx - 1)}
                  title="Önceki Sayfa (Sol Ok)"
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="px-2 text-[11px] text-zinc-300 font-medium tabular-nums">
                  {currentIdx + 1} / {safeTabs.length} • {String(currentTab?.name || 'Anasayfa').replace(/\.craft$/i, '')}
                </span>
                <button
                  type="button"
                  onClick={() => goToSlideIndex(currentIdx + 1)}
                  title="Sonraki Sayfa (Sağ Ok)"
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Center: Real Browser Device Switcher */}
          <div className="flex items-center gap-1 bg-[#18181d] border border-white/[0.07] rounded-lg p-0.5">
            {PRESENTATION_FRAMES.map((frame) => {
              const Icon = frame.icon;
              const isSelected = frameMode === frame.id;
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => setFrameMode(frame.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#2a2a33] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={12} />
                  <span>{frame.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              title="Bağımsız Yeni Sekmede Aç"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18181d] hover:bg-[#222229] border border-white/[0.08] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors"
            >
              <ExternalLink size={12} />
              <span>Yeni Sekme</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenExportModal?.();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d99ff] hover:bg-[#1fa3ff] text-white text-[11px] font-semibold transition-colors shadow"
            >
              <Rocket size={12} />
              <span>Yayına Al</span>
            </button>

            <button
              type="button"
              onClick={() => setBarCollapsed(true)}
              title="Üst Çubuğu Gizle (Tam Ekran Deneyimi)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronUp size={14} />
            </button>

            <button
              type="button"
              onClick={() => onClose?.()}
              title="Sunumu Kapat (Esc)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-rose-500/25 border border-white/[0.1] hover:border-rose-400/40 text-zinc-100 text-[11px] font-semibold transition-colors"
            >
              <EyeOff size={12} />
              <span>Düzenlemeye Dön</span>
            </button>
          </div>
        </header>
      ) : (
        <div className="fixed top-3 right-4 z-[130] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBarCollapsed(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216]/90 backdrop-blur-xl border border-white/[0.12] text-zinc-200 hover:text-white text-[11px] font-medium shadow-2xl"
          >
            <ChevronDown size={12} />
            <span>Sunum Araçları</span>
          </button>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 rounded-full bg-[#121216]/90 backdrop-blur-xl border border-white/[0.12] text-zinc-200 hover:text-rose-300 shadow-2xl"
            title="Çık (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Full Browser Stage */}
      <main
        className={`flex-1 min-h-0 flex justify-center items-stretch overflow-auto ${
          activeFrame.width ? 'p-4 md:p-6 bg-[#09090b]' : 'p-0 bg-black'
        }`}
      >
        <div
          style={{
            width: activeFrame.width ? `${activeFrame.width}px` : '100%',
            maxWidth: '100%',
          }}
          className={`h-full transition-all duration-200 flex flex-col bg-black ${
            frameMode === 'mobile'
              ? 'rounded-[36px] border-[8px] border-[#25252b] shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden'
              : frameMode === 'tablet'
              ? 'rounded-[22px] border-[6px] border-[#25252b] shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden'
              : 'w-full'
          }`}
        >
          <iframe
            ref={iframeRef}
            title={`${projectName} — Canlı Sunum`}
            srcDoc={presentationHtml}
            className="w-full h-full flex-1 border-0 bg-[#0b0a09]"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      </main>
    </div>
  );
}
