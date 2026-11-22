/**
 * Input, wheel-panning, and global keyboard shortcut guards for CraftStudio canvas.
 * Ensures Shift+Wheel scrolls vertically during multi-select and prevents
 * canvas hotkeys from misfiring inside text editors or open modals.
 */

export const MIN_CANVAS_ZOOM = 0.2;
export const MAX_CANVAS_ZOOM = 3.5;

/**
 * Clamps canvas zoom scale to safe viewport limits rounded to 2 decimals.
 */
export function clampCanvasZoom(nextZoom, min = MIN_CANVAS_ZOOM, max = MAX_CANVAS_ZOOM) {
  const numeric = Number(nextZoom);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(max, Math.max(min, +numeric.toFixed(2)));
}

/**
 * Resolves viewport pan delta from a wheel event.
 * Keeps vertical mouse wheel scrolling vertical even while Shift is held
 * (for sequential Shift+Click selection), while preserving native trackpad deltaX.
 */
export function resolveWheelPanDelta({ deltaX = 0, deltaY = 0 } = {}) {
  const numX = Number(deltaX) || 0;
  const numY = Number(deltaY) || 0;
  return {
    dx: numX === 0 ? 0 : -numX,
    dy: numY === 0 ? 0 : -numY,
  };
}

/**
 * Returns true if the focused element is a form input or rich contentEditable node.
 */
export function isEditableElementTarget(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(tag)) return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === 'function') {
    if (el.closest('[contenteditable="true"], [contenteditable=""], input, textarea, select')) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the target or focused element is inside the floating CSS & Attributes inspector
 * (or any floating studio panel), even when the focused node is a button or container rather than an input.
 */
export function isInsideFloatingInspector(el) {
  if (!el || typeof el !== 'object') return false;
  if (el.dataset?.floatingCssInspector === 'true' || el.dataset?.floatingPanel === 'true') {
    return true;
  }
  if (typeof el.getAttribute === 'function') {
    if (
      el.getAttribute('data-floating-css-inspector') === 'true' ||
      el.getAttribute('data-floating-panel') === 'true'
    ) {
      return true;
    }
  }
  if (typeof el.closest === 'function') {
    if (el.closest('[data-floating-css-inspector="true"], [data-floating-panel="true"]')) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether the global canvas keyboard listener should process an event.
 */
export function shouldHandleGlobalCanvasShortcut({
  activeElement = null,
  eventTarget = null,
  isAnyModalOpen = false,
} = {}) {
  if (isAnyModalOpen) return false;
  if (isEditableElementTarget(activeElement)) return false;
  if (isEditableElementTarget(eventTarget)) return false;
  return true;
}

const SINGLE_KEY_TOOL_MAP = {
  v: 'select',
  r: 'rectangle',
  o: 'circle',
  l: 'line',
  f: 'frame',
  h: 'hand',
  t: 'text',
  z: 'zoom',
  i: 'eyedropper',
};

/**
 * Maps unmodified single-key shortcuts ('v', 'r', 'o', 'l', 'f', 'h', 't', 'z', 'i') to canvas tools.
 * Rejects modified presses (Ctrl/Cmd/Alt/Shift) so browser or selection combos stay safe.
 */
export function resolveSingleKeyToolShortcut(key, { isCtrlOrMeta = false, altKey = false, shiftKey = false } = {}) {
  if (isCtrlOrMeta || altKey || shiftKey) return null;
  if (typeof key !== 'string') return null;
  return SINGLE_KEY_TOOL_MAP[key.toLowerCase()] || null;
}
