import { useState, useRef, useCallback, useEffect } from 'react';
import { clampCanvasZoom } from '../utils/canvasInputUtils.js';
import {
  DEFAULT_LEFT_DRAWER_WIDTH,
  DEFAULT_RIGHT_DOCK_WIDTH,
  MIN_AI_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  RIGHT_RAIL_WIDTH,
} from '../data/studioModesRegistry.js';

const INITIAL_ZOOM = 0.56;
const INITIAL_PAN_OFFSET = { x: 24, y: 48 };

/**
 * Pure helper computing the exact horizontal pixel width occupied by the left rail + left drawer.
 * - Replaces the former hard-coded 292 / 340 estimate with the real `leftSidebarWidth` state.
 * - Any panel whose zone is `'floating'` never adds to left occupied width.
 */
export function computeLeftOccupiedWidth({
  previewMode = false,
  leftSidebarTab = null,
  leftSidebarWidth = DEFAULT_LEFT_DRAWER_WIDTH,
  panelZones = null,
} = {}) {
  if (previewMode) return 0;
  if (!leftSidebarTab) return LEFT_RAIL_WIDTH;
  if (panelZones && panelZones[leftSidebarTab] && panelZones[leftSidebarTab] !== 'left') {
    return LEFT_RAIL_WIDTH;
  }
  const rawW = Number(leftSidebarWidth) || DEFAULT_LEFT_DRAWER_WIDTH;
  const effectiveDrawerW = leftSidebarTab === 'ai' ? Math.max(rawW, MIN_AI_LEFT_DRAWER_WIDTH) : rawW;
  return LEFT_RAIL_WIDTH + effectiveDrawerW;
}

/**
 * Pure helper computing the exact horizontal pixel width occupied by the right rail + right dock.
 * - Any panel moved to `'floating'` never adds to right occupied width.
 * - Any panel docked and open in `'right'` contributes its dock width.
 */
export function computeRightOccupiedWidth({
  previewMode = false,
  rightDockOpen = true,
  rightDockWidth = DEFAULT_RIGHT_DOCK_WIDTH,
  rightDockTabs = null,
  rightDockActiveTab = null,
  panelZones = null,
} = {}) {
  if (previewMode) return 0;
  if (!rightDockOpen) return RIGHT_RAIL_WIDTH;
  if (panelZones) {
    if (Array.isArray(rightDockTabs)) {
      const hasDockedRightTab = rightDockTabs.some((tabId) => panelZones[tabId] === 'right');
      if (!hasDockedRightTab) return RIGHT_RAIL_WIDTH;
    } else if (rightDockActiveTab && panelZones[rightDockActiveTab] !== 'right') {
      return RIGHT_RAIL_WIDTH;
    }
  }
  const rawW = Number(rightDockWidth) || DEFAULT_RIGHT_DOCK_WIDTH;
  return RIGHT_RAIL_WIDTH + rawW;
}

/**
 * Pure multi-zone helper computing exact left/right occupied widths and remaining canvas width.
 * Floating panels (`zone === 'floating'`, `activeModeLayout.floatingPanels`) overlay the canvas
 * and are explicitly excluded from available width subtraction.
 */
export function computeCanvasOccupiedWidths({
  previewMode = false,
  activeModeLayout = null,
  leftSidebarTab = null,
  leftSidebarWidth = DEFAULT_LEFT_DRAWER_WIDTH,
  rightDockOpen = true,
  rightDockWidth = DEFAULT_RIGHT_DOCK_WIDTH,
  viewportWidth = 1440,
} = {}) {
  const panelZones = activeModeLayout?.panelZones || null;
  const resolvedLeftTab = activeModeLayout ? activeModeLayout.leftDrawer?.activeTab ?? null : leftSidebarTab;
  const resolvedLeftWidth = activeModeLayout ? activeModeLayout.leftDrawer?.width ?? DEFAULT_LEFT_DRAWER_WIDTH : leftSidebarWidth;
  const resolvedRightOpen = activeModeLayout ? Boolean(activeModeLayout.rightDock?.isOpen) : Boolean(rightDockOpen);
  const resolvedRightWidth = activeModeLayout ? activeModeLayout.rightDock?.width ?? DEFAULT_RIGHT_DOCK_WIDTH : rightDockWidth;
  const resolvedRightTabs = activeModeLayout?.rightDock?.tabs || null;
  const resolvedRightActiveTab = activeModeLayout?.rightDock?.activeTab || null;

  const leftOccupiedWidth = computeLeftOccupiedWidth({
    previewMode,
    leftSidebarTab: resolvedLeftTab,
    leftSidebarWidth: resolvedLeftWidth,
    panelZones,
  });
  const rightOccupiedWidth = computeRightOccupiedWidth({
    previewMode,
    rightDockOpen: resolvedRightOpen,
    rightDockWidth: resolvedRightWidth,
    rightDockTabs: resolvedRightTabs,
    rightDockActiveTab: resolvedRightActiveTab,
    panelZones,
  });
  const totalOccupiedWidth = leftOccupiedWidth + rightOccupiedWidth;
  const availableWidth = Math.max(360, (Number(viewportWidth) || 1440) - totalOccupiedWidth);

  return {
    leftOccupiedWidth,
    rightOccupiedWidth,
    totalOccupiedWidth,
    availableWidth,
  };
}

/**
 * Canvas zoom, pan offset, viewport-fit, and horizontal centering hook.
 * Input:  {
 *   showWelcomeScreen, previewMode, activeMode,
 *   activeModeLayout,
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
  activeModeLayout = null,
  leftSidebarTab = null,
  leftSidebarWidth = DEFAULT_LEFT_DRAWER_WIDTH,
  rightDockOpen = true,
  rightDockWidth = DEFAULT_RIGHT_DOCK_WIDTH,
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

  const occupied = computeCanvasOccupiedWidths({
    previewMode,
    activeModeLayout,
    leftSidebarTab,
    leftSidebarWidth,
    rightDockOpen,
    rightDockWidth,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
  });
  const leftOccupiedWidth = occupied.leftOccupiedWidth;
  const rightOccupiedWidth = occupied.rightOccupiedWidth;

  const fitCanvasToViewport = useCallback((overrideWidth = null) => {
    const canvasW = Number(overrideWidth) || Number(canvasWidth) || 1280;
    const canvasH = Number(canvasHeight) || 1350;
    const wrapperEl = typeof document !== 'undefined' ? document.getElementById('canvas-wrapper') : null;
    const availW = wrapperEl?.clientWidth || Math.max(360, (typeof window !== 'undefined' ? window.innerWidth : 1440) - leftOccupiedWidth - rightOccupiedWidth);
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
  }, [canvasWidth, canvasHeight, previewMode, leftOccupiedWidth, rightOccupiedWidth]);

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

  // Keep artboard horizontally centered whenever docked sidebars open/close, window resizes, or returning to design mode.
  // Floating panels (zone === 'floating') do not alter leftOccupiedWidth/rightOccupiedWidth and never shift the canvas.
  useEffect(() => {
    if (showWelcomeScreen || previewMode || activeMode !== 'design') return undefined;
    const designLayoutKey = `${leftOccupiedWidth}|${rightOccupiedWidth}`;
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
  }, [showWelcomeScreen, previewMode, activeMode, leftOccupiedWidth, rightOccupiedWidth]);

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
