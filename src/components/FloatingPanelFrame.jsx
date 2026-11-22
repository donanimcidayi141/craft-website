import React, { useRef, useEffect } from 'react';
import {
  GripHorizontal,
  PanelLeft,
  PanelRight,
  Minus,
  Maximize2,
  X,
} from 'lucide-react';
import { getPanelConfig } from '../data/panelRegistry.js';
import { clampFloatingRect } from '../utils/propertySearch.js';
import { FLOATING_MIN_TOP_Y } from '../utils/panelDragUtils.js';

/**
 * Reusable Floating Studio Panel Frame (`zone === 'floating'`).
 * - Always renders above the canvas with dynamic `zIndex` managed via `panelActions.bringToFront`.
 * - Header drag supports `6px` threshold, pointer capture, `Escape` cancel, and edge drop into left/right docks.
 * - Bottom-right resize handle uses pointer capture and clamps bounds via `clampFloatingRect`.
 * - Every zone action is keyboard-accessible (`<button type="button">` with clear `aria-label`s, no Alt shortcuts).
 * - Focus-scoped `Escape` closes only this floating window when focus is inside it and no drag is active.
 */
export default function FloatingPanelFrame({
  panelId,
  title,
  icon = null,
  floatingState,
  panelActions,
  onStartHeaderDrag,
  isDragging = false,
  children,
}) {
  const frameRef = useRef(null);
  const resizeSessionRef = useRef(null);

  const panelCfg = getPanelConfig(panelId);
  const minWidth = panelCfg?.sizeLimits?.minWidth || 240;
  const minHeight = panelCfg?.sizeLimits?.minHeight || 280;
  const maxWidth = panelCfg?.sizeLimits?.maxWidth || 960;
  const maxHeight = panelCfg?.sizeLimits?.maxHeight || 880;
  const allowedZones = panelCfg?.allowedZones || ['left', 'right', 'floating'];
  const canDockLeft = allowedZones.includes('left');
  const canDockRight = allowedZones.includes('right');

  const isOpen = Boolean(floatingState?.isOpen);
  const isMinimized = Boolean(floatingState?.isMinimized);
  const zIndex = Number(floatingState?.zIndex) || 60;

  const rawRect = floatingState?.rect || {
    x: 360,
    y: 84,
    width: panelCfg?.sizeLimits?.defaultWidth || 320,
    height: panelCfg?.sizeLimits?.defaultHeight || 480,
  };
  const vpW = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1440;
  const vpH = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 920;
  const clampedRect = clampFloatingRect(
    rawRect,
    { width: vpW, height: vpH },
    { minWidth, minHeight },
  );
  const renderRect = {
    ...clampedRect,
    y: Math.max(FLOATING_MIN_TOP_Y, Math.min(clampedRect.y, Math.max(FLOATING_MIN_TOP_Y, vpH - (isMinimized ? 42 : clampedRect.height) - 12))),
  };

  // Focus-scoped Escape closes only this floating window (without leaking to canvas shortcuts)
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (isDragging || resizeSessionRef.current) return;
      const frameEl = frameRef.current;
      const activeEl = document.activeElement;
      if (!frameEl || !activeEl || !frameEl.contains(activeEl)) return;
      if (
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        typeof activeEl.value === 'string' &&
        activeEl.value.length > 0
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      panelActions?.close(panelId);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isDragging, panelActions, panelId]);

  if (!isOpen) return null;

  const handleResizePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    panelActions?.bringToFront(panelId);
    const target = e.currentTarget;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic PointerEvent fallback
    }
    const startRect = { ...renderRect };
    resizeSessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect,
      pointerId: e.pointerId,
      target,
    };

    const cleanup = () => {
      const s = resizeSessionRef.current;
      if (s?.target) {
        try {
          s.target.releasePointerCapture?.(s.pointerId);
        } catch {
          // ignore
        }
      }
      resizeSessionRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onEsc, true);
    };

    const onMove = (moveEvt) => {
      const s = resizeSessionRef.current;
      if (!s) return;
      const dx = moveEvt.clientX - s.startX;
      const dy = moveEvt.clientY - s.startY;
      const nextW = Math.max(minWidth, Math.min(maxWidth, s.startRect.width + dx));
      const nextH = Math.max(minHeight, Math.min(maxHeight, s.startRect.height + dy));
      panelActions?.updateFloatingRect(panelId, {
        ...s.startRect,
        width: nextW,
        height: nextH,
      });
    };

    const onUp = () => cleanup();
    const onCancel = () => {
      const s = resizeSessionRef.current;
      if (s) panelActions?.updateFloatingRect(panelId, s.startRect);
      cleanup();
    };
    const onEsc = (keyEvt) => {
      if (keyEvt.key !== 'Escape') return;
      keyEvt.preventDefault();
      keyEvt.stopPropagation();
      const s = resizeSessionRef.current;
      if (s) panelActions?.updateFloatingRect(panelId, s.startRect);
      cleanup();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onEsc, true);
  };

  return (
    <section
      ref={frameRef}
      role="dialog"
      aria-modal="false"
      aria-label={title || panelCfg?.title || panelId}
      tabIndex={-1}
      data-floating-panel="true"
      data-floating-panel-id={panelId}
      data-floating-panel-minimized={isMinimized ? 'true' : 'false'}
      onPointerDown={() => panelActions?.bringToFront(panelId)}
      onFocus={() => panelActions?.bringToFront(panelId)}
      style={{
        left: `${renderRect.x}px`,
        top: `${renderRect.y}px`,
        width: `${renderRect.width}px`,
        height: isMinimized ? '38px' : `${renderRect.height}px`,
        zIndex,
      }}
      className="fixed flex flex-col bg-[#18181b] border border-[#32323d] rounded-lg shadow-[0_20px_56px_rgba(0,0,0,0.68)] overflow-hidden select-none text-zinc-200"
    >
      {/* Draggable Floating Panel Title Bar */}
      <div
        data-panel-drag-handle={panelId}
        onPointerDown={(e) => {
          panelActions?.bringToFront(panelId);
          onStartHeaderDrag?.(e, {
            panelId,
            title: title || panelCfg?.title || panelId,
            sourceZone: 'floating',
            allowedZones,
            initialRect: renderRect,
          });
        }}
        onDoubleClick={(e) => {
          if (e.target.closest('button')) return;
          panelActions?.toggleFloatingMinimized(panelId);
        }}
        className="h-[38px] shrink-0 px-2.5 bg-[#131317] border-b border-[#27272f] flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal size={13} className="text-zinc-500 shrink-0" />
          {icon}
          <span className="text-[11px] font-semibold text-zinc-100 truncate">
            {title || panelCfg?.title || panelId}
          </span>
        </div>

        {/* Keyboard-accessible zone & window controls */}
        <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Pencere konum kontrolleri">
          {canDockLeft && (
            <button
              type="button"
              data-panel-zone-action={`${panelId}:left`}
              aria-label={`${title || panelId} panelini sola sabitle`}
              title="Sola Sabitle"
              onClick={() => panelActions?.moveToZone(panelId, 'left')}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#38bdf8] transition-colors"
            >
              <PanelLeft size={12} />
            </button>
          )}
          {canDockRight && (
            <button
              type="button"
              data-panel-zone-action={`${panelId}:right`}
              aria-label={`${title || panelId} panelini sağa sabitle`}
              title="Sağa Sabitle"
              onClick={() => panelActions?.moveToZone(panelId, 'right')}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#38bdf8] transition-colors"
            >
              <PanelRight size={12} />
            </button>
          )}
          <button
            type="button"
            data-floating-panel-minimize={panelId}
            aria-label={isMinimized ? 'Pencereyi genişlet' : 'Pencereyi küçült'}
            title={isMinimized ? 'Genişlet' : 'Küçült'}
            onClick={() => panelActions?.toggleFloatingMinimized(panelId)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#38bdf8] transition-colors"
          >
            {isMinimized ? <Maximize2 size={11} /> : <Minus size={12} />}
          </button>
          <button
            type="button"
            data-floating-panel-close={panelId}
            aria-label={`${title || panelId} penceresini kapat`}
            title="Kapat"
            onClick={() => panelActions?.close(panelId)}
            className="p-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-rose-500/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#18181b]">
          {children}
        </div>
      )}

      {/* Bottom-Right Resize Handle */}
      {!isMinimized && (
        <div
          data-floating-panel-resize={panelId}
          onPointerDown={handleResizePointerDown}
          title="Boyutlandırmak için sürükle"
          className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-zinc-500 hover:text-[#38bdf8]"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </section>
  );
}
