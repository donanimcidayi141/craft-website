import { useState, useRef, useCallback, useEffect } from 'react';
import { clampCanvasZoom } from '../utils/canvasInputUtils.js';
import {
  DEFAULT_LEFT_DRAWER_WIDTH,
  MIN_AI_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  RIGHT_RAIL_WIDTH,
} from '../data/studioModesRegistry.js';

const INITIAL_ZOOM = 0.56;
const INITIAL_PAN_OFFSET = { x: 24, y: 48 };

/**
 * Pure helper computing the exact horizontal pixel width occupied by the left rail + left drawer.
 * Replaces the former hard-coded 292 / 340 estimate with the real `leftSidebarWidth` state.
 */
export function computeLeftOccupiedWidth({
  previewMode = false,
  leftSidebarTab = null,
  leftSidebarWidth = DEFAULT_LEFT_DRAWER_WIDTH,
} = {}) {
  if (previewMode) return 0;
  if (!leftSidebarTab) return LEFT_RAIL_WIDTH;
  const rawW = Number(leftSidebarWidth) || DEFAULT_LEFT_DRAWER_WIDTH;
  const effectiveDrawerW = leftSidebarTab === 'ai' ? Math.max(rawW, MIN_AI_LEFT_DRAWER_WIDTH) : rawW;
  return LEFT_RAIL_WIDTH + effectiveDrawerW;
}

/**
 * Canvas zoom, pan offset, viewport-fit, and horizontal centering hook.
 * Input:  {
 *   showWelcomeScreen, previewMode, activeMode,
 *   leftSidebarTab, leftSidebarWidth, rightDockOpen, rightDockWidth,
 *   activeTabId, viewportMode, canvasWidth, canvasHeight,
 * }
 * Output: {
 *   zoom, setZoom, panOffset, setPanOffset, fitVersion, setFitVersion,
 *   fitCanvasToViewport, centerCanvasHorizontally, handleResetZoom, triggerFit, reset,
 * }
 */
export function useCanvasView({
  showWelcomeScreen = true,
  previewMode = false,
  activeMode = 'design',
  leftSidebarTab = null,
  leftSidebarWidth = DEFAULT_LEFT_DRAWER_WIDTH,
  rightDockOpen = true,
  rightDockWidth = 336,
  activeTabId = 'tab-1',
  viewportMode = 'desktop',
  canvasWidth = 1280,
  canvasHeight = 1350,
} = {}) {
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [panOffset, setPanOffset] = useState(INITIAL_PAN_OFFSET);
  const [fitVersion, setFitVersion] = useState(0);
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const pendingFitWhileHiddenRef = useRef(false);
  const lastDesignLayoutKeyRef = useRef(null);

  const fitCanvasToViewport = useCallback((overrideWidth = null) => {
    const canvasW = Number(overrideWidth) || Number(canvasWidth) || 1280;
    const canvasH = Number(canvasHeight) || 1350;
    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    const estLeftW = computeLeftOccupiedWidth({ previewMode, leftSidebarTab, leftSidebarWidth });
    const estRightW = previewMode ? 0 : (rightDockOpen ? rightDockWidth + RIGHT_RAIL_WIDTH : RIGHT_RAIL_WIDTH);
    const availW = wrapperEl?.clientWidth || Math.max(360, (typeof window !== 'undefined' ? window.innerWidth : 1440) - estLeftW - estRightW);
    const availH = wrapperEl?.clientHeight || Math.max(420, (typeof window !== 'undefined' ? window.innerHeight : 920) - 76);
    const usableW = Math.max(240, availW - 48);
    let rawFitZoom = usableW / canvasW;
    // Keep desktop/short artboards wholly clear of top breadcrumb and lifted Gemini chat dock
    if (!previewMode && canvasH <= 1650) {
      const usableH = Math.max(240, availH - 186);
      rawFitZoom = Math.min(rawFitZoom, usableH / canvasH);
    }
    const fitZoom = clampCanvasZoom(Math.min(1, +rawFitZoom.toFixed(2)));
    const scaledW = canvasW * fitZoom;
    const panX = Math.max(20, Math.round((availW - scaledW) / 2));
    setZoom(fitZoom);
    setPanOffset({ x: panX, y: previewMode ? 28 : 34 });
  }, [canvasWidth, canvasHeight, previewMode, leftSidebarTab, leftSidebarWidth, rightDockOpen, rightDockWidth]);

  const centerCanvasHorizontally = useCallback(() => {
    if (previewMode) return;
    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    if (!wrapperEl || !wrapperEl.clientWidth) return;
    const canvasW = Number(canvasWidth) || 1280;
    const scaledW = canvasW * zoom;
    if (scaledW > wrapperEl.clientWidth - 24) return;
    const centeredX = Math.max(20, Math.round((wrapperEl.clientWidth - scaledW) / 2));
    setPanOffset((prev) => (Math.abs(prev.x - centeredX) <= 1 ? prev : { ...prev, x: centeredX }));
  }, [previewMode, canvasWidth, zoom]);

  const fitCanvasRef = useRef(fitCanvasToViewport);
  const centerHorizRef = useRef(centerCanvasHorizontally);
  useEffect(() => {
    fitCanvasRef.current = fitCanvasToViewport;
  }, [fitCanvasToViewport]);
  useEffect(() => {
    centerHorizRef.current = centerCanvasHorizontally;
  }, [centerCanvasHorizontally]);

  // Fit & center artboard on initial load, tab switch, viewport switch, or fit trigger
  useEffect(() => {
    if (showWelcomeScreen) return undefined;
    if (activeModeRef.current !== 'design') {
      pendingFitWhileHiddenRef.current = true;
      return undefined;
    }
    pendingFitWhileHiddenRef.current = false;
    let cancelled = false;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) fitCanvasRef.current?.();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [showWelcomeScreen, fitVersion, activeTabId, viewportMode, canvasWidth]);

  // Keep artboard horizontally centered whenever sidebars open/close, window resizes, or returning to design mode
  useEffect(() => {
    if (showWelcomeScreen || previewMode || activeMode !== 'design') return undefined;
    const designLayoutKey = `${leftSidebarTab ?? ''}|${leftSidebarWidth}|${rightDockOpen}|${rightDockWidth}`;
    const didDesignLayoutChange =
      lastDesignLayoutKeyRef.current !== null && lastDesignLayoutKeyRef.current !== designLayoutKey;
    lastDesignLayoutKeyRef.current = designLayoutKey;

    let rafId = null;
    let raf2 = null;
    if (pendingFitWhileHiddenRef.current) {
      pendingFitWhileHiddenRef.current = false;
      rafId = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => fitCanvasRef.current?.());
      });
    } else if (didDesignLayoutChange) {
      rafId = requestAnimationFrame(() => {
        centerHorizRef.current?.();
      });
    }

    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    let lastWrapperWidth = wrapperEl?.clientWidth || 0;
    const ro = wrapperEl && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const nextWidth = wrapperEl.clientWidth || 0;
          if (nextWidth > 0 && Math.abs(nextWidth - lastWrapperWidth) > 1) {
            lastWrapperWidth = nextWidth;
            centerHorizRef.current?.();
          }
        })
      : null;
    if (ro && wrapperEl) ro.observe(wrapperEl);
    const onResize = () => centerHorizRef.current?.();
    window.addEventListener('resize', onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (raf2) cancelAnimationFrame(raf2);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [showWelcomeScreen, previewMode, activeMode, leftSidebarTab, leftSidebarWidth, rightDockOpen, rightDockWidth]);

  const handleResetZoom = useCallback(() => {
    fitCanvasToViewport();
  }, [fitCanvasToViewport]);

  const triggerFit = useCallback(() => {
    setFitVersion((v) => v + 1);
  }, []);

  const reset = useCallback(({ fit = true } = {}) => {
    lastDesignLayoutKeyRef.current = null;
    pendingFitWhileHiddenRef.current = false;
    setZoom(INITIAL_ZOOM);
    setPanOffset(INITIAL_PAN_OFFSET);
    if (fit) {
      setFitVersion((v) => v + 1);
    }
  }, []);

  return {
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    fitVersion,
    setFitVersion,
    fitCanvasToViewport,
    centerCanvasHorizontally,
    handleResetZoom,
    triggerFit,
    reset,
  };
}
