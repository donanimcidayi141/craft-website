import { getPanelConfig, MOVABLE_PANEL_ZONES } from '../data/panelRegistry.js';
import { clampFloatingRect } from './propertySearch.js';

export const PANEL_DRAG_THRESHOLD_PX = 6;
export const PANEL_DROP_EDGE_PX = 148;
export const FLOATING_MIN_TOP_Y = 48;

/**
 * Returns true once the pointer has moved at least `PANEL_DRAG_THRESHOLD_PX` (6px)
 * from its pointerdown origin. Movements strictly below 6px count as a click, never a drag.
 */
export function hasExceededPanelDragThreshold(
  startX,
  startY,
  clientX,
  clientY,
  thresholdPx = PANEL_DRAG_THRESHOLD_PX,
) {
  const dx = (Number(clientX) || 0) - (Number(startX) || 0);
  const dy = (Number(clientY) || 0) - (Number(startY) || 0);
  return Math.hypot(dx, dy) >= thresholdPx;
}

/**
 * Resolves the target drop zone ('left' | 'right' | 'floating') from pointer coordinates.
 * Respects each panel's allowedZones so restricted panels cannot drop into forbidden zones.
 */
export function resolvePanelDropZone(
  clientX,
  viewportWidth = 1440,
  allowedZones = MOVABLE_PANEL_ZONES,
  edgeThresholdPx = PANEL_DROP_EDGE_PX,
) {
  const x = Number(clientX) || 0;
  const vw = Math.max(320, Number(viewportWidth) || 1440);
  const allowed = Array.isArray(allowedZones) ? allowedZones : MOVABLE_PANEL_ZONES;

  if (x <= edgeThresholdPx && allowed.includes('left')) {
    return 'left';
  }
  if (x >= vw - edgeThresholdPx && allowed.includes('right')) {
    return 'right';
  }
  if (allowed.includes('floating')) {
    return 'floating';
  }
  return allowed[0] || null;
}

/**
 * Computes a clamped floating rectangle centered horizontally under the drop pointer,
 * staying below the TopMenuBar (`y >= FLOATING_MIN_TOP_Y`) and completely inside the viewport.
 */
export function computeFloatingDropRect(
  panelId,
  clientX,
  clientY,
  viewport = { width: 1440, height: 920 },
  previousRect = null,
) {
  const panelCfg = getPanelConfig(panelId);
  const minWidth = panelCfg?.sizeLimits?.minWidth || 240;
  const minHeight = panelCfg?.sizeLimits?.minHeight || 280;
  const width = Number(previousRect?.width) > 0
    ? Number(previousRect.width)
    : panelCfg?.sizeLimits?.defaultWidth || 320;
  const height = Number(previousRect?.height) > 0
    ? Number(previousRect.height)
    : panelCfg?.sizeLimits?.defaultHeight || 480;

  const vw = Math.max(320, Number(viewport?.width) || 1440);
  const vh = Math.max(240, Number(viewport?.height) || 920);
  const desiredX = Math.round((Number(clientX) || vw / 2) - width / 2);
  const desiredY = Math.max(FLOATING_MIN_TOP_Y, Math.round((Number(clientY) || 120) - 18));

  const clamped = clampFloatingRect(
    { x: desiredX, y: desiredY, width, height },
    { width: vw, height: vh },
    { minWidth, minHeight },
  );

  return {
    ...clamped,
    y: Math.max(FLOATING_MIN_TOP_Y, Math.min(clamped.y, Math.max(FLOATING_MIN_TOP_Y, vh - clamped.height - 12))),
  };
}
