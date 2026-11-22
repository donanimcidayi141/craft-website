import { useState, useRef, useCallback, useEffect } from 'react';
import { clampCanvasZoom } from '../utils/canvasInputUtils';

const INITIAL_ZOOM = 0.56;
const INITIAL_PAN_OFFSET = { x: 24, y: 48 };

/**
 * Canvas zoom, pan offset, viewport-fit, and horizontal centering hook.
 * Input:  {
 *   showWelcomeScreen, previewMode,
 *   leftSidebarTab, rightDockOpen, rightDockWidth,
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
  leftSidebarTab = null,
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

  const fitCanvasToViewport = useCallback((overrideWidth = null) => {
    const canvasW = Number(overrideWidth) || Number(canvasWidth) || 1280;
    const canvasH = Number(canvasHeight) || 1350;
    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    const estLeftW = previewMode ? 0 : (leftSidebarTab ? (leftSidebarTab === 'ai' ? 340 : 292) : 52);
    const estRightW = previewMode ? 0 : (rightDockOpen ? rightDockWidth + 40 : 40);
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
  }, [canvasWidth, canvasHeight, previewMode, leftSidebarTab, rightDockOpen, rightDockWidth]);

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

  // Keep artboard horizontally centered whenever sidebars open/close or window resizes
  useEffect(() => {
    if (showWelcomeScreen || previewMode) return undefined;
    const rafId = requestAnimationFrame(() => centerHorizRef.current?.());
    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    const ro = wrapperEl && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => centerHorizRef.current?.())
      : null;
    if (ro && wrapperEl) ro.observe(wrapperEl);
    const onResize = () => centerHorizRef.current?.();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [showWelcomeScreen, previewMode, leftSidebarTab, rightDockOpen, rightDockWidth]);

  const handleResetZoom = useCallback(() => {
    fitCanvasToViewport();
  }, [fitCanvasToViewport]);

  const triggerFit = useCallback(() => {
    setFitVersion((v) => v + 1);
  }, []);

  const reset = useCallback(({ fit = true } = {}) => {
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
