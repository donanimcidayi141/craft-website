/**
 * Pure helper utilities for canvas drawing, style copying, z-order adjustments,
 * Alt+Hover smart distance guides, and CSS color contrast calculation.
 */

const SKIPPED_STYLE_KEYS = new Set([
  'left', 'top', 'right', 'bottom', 'width', 'height',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'position', 'zIndex', 'transform', 'margin',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
]);

const PORTABLE_NODE_FIELDS = [
  'fillType', 'fillColor', 'gradient',
  'borderRadius', 'borderRadiusType', 'borderRadiusCorners',
  'borderWidth', 'borderColor', 'borderStyle',
  'shadow', 'opacity', 'color', 'fontSize', 'fontWeight', 'textAlign',
];

/**
 * Resolves a bounding rectangle from a drag-to-draw gesture or falls back to
 * a clean default box centered on click coordinates when movement < minDrag.
 */
export function resolveDrawnBox(start, current, options = {}) {
  const {
    shiftKey = false,
    isLine = false,
    minDrag = 6,
    defaultSize = { width: 160, height: 110 },
  } = options;

  const dx = (current?.x ?? start.x) - start.x;
  const dy = (current?.y ?? start.y) - start.y;
  const distance = Math.hypot(dx, dy);

  if (distance < minDrag) {
    const w = Math.max(1, defaultSize.width ?? 160);
    const h = Math.max(1, defaultSize.height ?? 110);
    return {
      x: Math.round(start.x - w / 2),
      y: Math.round(start.y - h / 2),
      width: w,
      height: h,
      wasDrag: false,
      orientation: w >= h ? 'horizontal' : 'vertical',
    };
  }

  if (isLine) {
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    if (horizontal) {
      const len = Math.max(8, Math.round(Math.abs(dx)));
      const x = dx >= 0 ? start.x : start.x - len;
      return {
        x: Math.round(x),
        y: Math.round(start.y),
        width: len,
        height: 2,
        wasDrag: true,
        orientation: 'horizontal',
      };
    }
    const len = Math.max(8, Math.round(Math.abs(dy)));
    const y = dy >= 0 ? start.y : start.y - len;
    return {
      x: Math.round(start.x),
      y: Math.round(y),
      width: 2,
      height: len,
      wasDrag: true,
      orientation: 'vertical',
    };
  }

  let width = Math.abs(dx);
  let height = Math.abs(dy);
  if (shiftKey) {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }

  const x = dx >= 0 ? start.x : start.x - width;
  const y = dy >= 0 ? start.y : start.y - height;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(4, Math.round(width)),
    height: Math.max(4, Math.round(height)),
    wasDrag: true,
    orientation: width >= height ? 'horizontal' : 'vertical',
  };
}

/**
 * Extracts portable visual style properties from a canvas node (Format Painter),
 * stripping layout coordinates and dimensions so pasting never moves/resizes targets.
 */
export function extractPortableElementStyle(node) {
  if (!node || typeof node !== 'object') return null;
  const extracted = {};

  for (const field of PORTABLE_NODE_FIELDS) {
    if (node[field] !== undefined) {
      extracted[field] = node[field] && typeof node[field] === 'object'
        ? { ...node[field] }
        : node[field];
    }
  }

  if (node.style && typeof node.style === 'object') {
    const cleanStyle = {};
    for (const [key, val] of Object.entries(node.style)) {
      if (!SKIPPED_STYLE_KEYS.has(key) && val !== undefined) {
        cleanStyle[key] = val;
      }
    }
    if (Object.keys(cleanStyle).length > 0) {
      extracted.style = cleanStyle;
    }
  }

  return extracted;
}

/**
 * Merges a portable style payload onto a target node, preserving the target's layout geometry.
 */
export function mergePortableStyleOntoNode(targetNode, portableStyle) {
  if (!targetNode || !portableStyle) return {};
  const updates = {};

  for (const field of PORTABLE_NODE_FIELDS) {
    if (portableStyle[field] !== undefined) {
      updates[field] = portableStyle[field] && typeof portableStyle[field] === 'object'
        ? { ...portableStyle[field] }
        : portableStyle[field];
    }
  }

  if (portableStyle.style) {
    updates.style = {
      ...(targetNode.style || {}),
      ...portableStyle.style,
    };
  }

  return updates;
}

/**
 * Computes updatesMap ({ [id]: { zIndex } }) for sibling-aware Z-Order changes.
 * Supports actions: 'front', 'forward', 'backward', 'back'.
 */
export function computeElementZOrderUpdate(elements, selectedIds, action) {
  if (!Array.isArray(elements) || !Array.isArray(selectedIds) || selectedIds.length === 0) {
    return {};
  }

  const byId = new Map();
  for (const el of elements) {
    if (el && el.id) byId.set(el.id, el);
  }

  const updates = {};
  const parentGroups = new Map();

  for (const id of selectedIds) {
    const node = byId.get(id);
    if (!node) continue;
    const pKey = node.parentId || '__ROOT__';
    if (!parentGroups.has(pKey)) parentGroups.set(pKey, []);
    parentGroups.get(pKey).push(id);
  }

  for (const [pKey, groupIds] of parentGroups.entries()) {
    const parentId = pKey === '__ROOT__' ? null : pKey;
    const siblings = elements
      .filter((el) => (el.parentId || null) === parentId)
      .sort((a, b) => (Number(a.zIndex) || 1) - (Number(b.zIndex) || 1));

    if (siblings.length <= 1) continue;
    const selectedSet = new Set(groupIds);
    const reordered = siblings.map((s) => s.id);

    if (action === 'front') {
      const rest = reordered.filter((id) => !selectedSet.has(id));
      const picked = reordered.filter((id) => selectedSet.has(id));
      reordered.splice(0, reordered.length, ...rest, ...picked);
    } else if (action === 'back') {
      const rest = reordered.filter((id) => !selectedSet.has(id));
      const picked = reordered.filter((id) => selectedSet.has(id));
      reordered.splice(0, reordered.length, ...picked, ...rest);
    } else if (action === 'forward') {
      for (let i = reordered.length - 2; i >= 0; i -= 1) {
        if (selectedSet.has(reordered[i]) && !selectedSet.has(reordered[i + 1])) {
          const tmp = reordered[i];
          reordered[i] = reordered[i + 1];
          reordered[i + 1] = tmp;
        }
      }
    } else if (action === 'backward') {
      for (let i = 1; i < reordered.length; i += 1) {
        if (selectedSet.has(reordered[i]) && !selectedSet.has(reordered[i - 1])) {
          const tmp = reordered[i];
          reordered[i] = reordered[i - 1];
          reordered[i - 1] = tmp;
        }
      }
    }

    reordered.forEach((id, idx) => {
      const nextZ = idx + 1;
      const curNode = byId.get(id);
      if ((Number(curNode?.zIndex) || 1) !== nextZ) {
        updates[id] = { zIndex: nextZ };
      }
    });
  }

  return updates;
}

/**
 * Computes Figma-style Alt+Hover distance measurement lines between sourceBox and targetBox
 * (if targetBox is a distinct sibling) or containerBox (if measuring against enclosing bounds).
 * Returns an array of segments: { x1, y1, x2, y2, gap, axis, helperLine? }.
 */
export function computeAltMeasureGuides(sourceBox, targetBox, containerBox) {
  if (!sourceBox) return [];
  const sLeft = sourceBox.x;
  const sRight = sourceBox.x + sourceBox.width;
  const sTop = sourceBox.y;
  const sBottom = sourceBox.y + sourceBox.height;
  const sCx = sourceBox.x + sourceBox.width / 2;
  const sCy = sourceBox.y + sourceBox.height / 2;

  const guides = [];

  if (targetBox) {
    const tLeft = targetBox.x;
    const tRight = targetBox.x + targetBox.width;
    const tTop = targetBox.y;
    const tBottom = targetBox.y + targetBox.height;

    const targetEnclosesSource =
      tLeft <= sLeft && tRight >= sRight && tTop <= sTop && tBottom >= sBottom;

    if (targetEnclosesSource) {
      return computeAltMeasureGuides(sourceBox, null, targetBox);
    }

    // Horizontal separation (left / right)
    const yMid = Math.max(Math.min(sBottom, tBottom), Math.max(sTop, tTop));
    const hLineY = (sBottom >= tTop && sTop <= tBottom)
      ? (Math.max(sTop, tTop) + Math.min(sBottom, tBottom)) / 2
      : sCy;

    if (sRight <= tLeft) {
      const gap = Math.round(tLeft - sRight);
      if (gap > 0) guides.push({ x1: sRight, y1: hLineY, x2: tLeft, y2: hLineY, gap, axis: 'x' });
    } else if (tRight <= sLeft) {
      const gap = Math.round(sLeft - tRight);
      if (gap > 0) guides.push({ x1: tRight, y1: hLineY, x2: sLeft, y2: hLineY, gap, axis: 'x' });
    } else {
      // Overlapping horizontally: show left/right offset differences
      const leftDiff = Math.round(Math.abs(sLeft - tLeft));
      if (leftDiff > 0) {
        guides.push({ x1: Math.min(sLeft, tLeft), y1: sTop, x2: Math.max(sLeft, tLeft), y2: sTop, gap: leftDiff, axis: 'x' });
      }
      void yMid;
    }

    // Vertical separation (top / bottom)
    const vLineX = (sRight >= tLeft && sLeft <= tRight)
      ? (Math.max(sLeft, tLeft) + Math.min(sRight, tRight)) / 2
      : sCx;

    if (sBottom <= tTop) {
      const gap = Math.round(tTop - sBottom);
      if (gap > 0) guides.push({ x1: vLineX, y1: sBottom, x2: vLineX, y2: tTop, gap, axis: 'y' });
    } else if (tBottom <= sTop) {
      const gap = Math.round(sTop - tBottom);
      if (gap > 0) guides.push({ x1: vLineX, y1: tBottom, x2: vLineX, y2: sTop, gap, axis: 'y' });
    }

    return guides;
  }

  if (containerBox) {
    const cLeft = containerBox.x ?? 0;
    const cTop = containerBox.y ?? 0;
    const cRight = cLeft + containerBox.width;
    const cBottom = cTop + containerBox.height;

    const topGap = Math.round(sTop - cTop);
    const bottomGap = Math.round(cBottom - sBottom);
    const leftGap = Math.round(sLeft - cLeft);
    const rightGap = Math.round(cRight - sRight);

    if (topGap > 0) guides.push({ x1: sCx, y1: cTop, x2: sCx, y2: sTop, gap: topGap, axis: 'y' });
    if (bottomGap > 0) guides.push({ x1: sCx, y1: sBottom, x2: sCx, y2: cBottom, gap: bottomGap, axis: 'y' });
    if (leftGap > 0) guides.push({ x1: cLeft, y1: sCy, x2: sLeft, y2: sCy, gap: leftGap, axis: 'x' });
    if (rightGap > 0) guides.push({ x1: sRight, y1: sCy, x2: cRight, y2: sCy, gap: rightGap, axis: 'x' });
  }

  return guides;
}

/**
 * Parses '#rgb', '#rrggbb', 'rgb(...)', or 'rgba(...)' strings into uppercase '#RRGGBB'.
 * Returns null for 'transparent' / alpha === 0 or unrecognized values.
 */
export function parseCssColorToHex(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return null;
  const trimmed = colorStr.trim();
  if (!trimmed || trimmed === 'transparent') return null;

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return `#${hex.split('').map((c) => c + c).join('')}`.toUpperCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `#${hex.toUpperCase()}`;
    }
    if (/^[0-9a-fA-F]{8}$/.test(hex)) {
      if (hex.slice(6, 8) === '00') return null;
      return `#${hex.slice(0, 6).toUpperCase()}`;
    }
    return null;
  }

  const match = trimmed.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (!match) return null;

  if (match[4] !== undefined) {
    const alphaRaw = match[4];
    const alpha = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    if (alpha <= 0.02) return null;
  }

  const toHex = (n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`.toUpperCase();
}

function relativeLuminance(hex) {
  const parsed = parseCssColorToHex(hex);
  if (!parsed) return null;
  const r = parseInt(parsed.slice(1, 3), 16) / 255;
  const g = parseInt(parsed.slice(3, 5), 16) / 255;
  const b = parseInt(parsed.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Returns WCAG 2.1 contrast ratio between two hex/rgb colors rounded to 2 decimals.
 */
export function computeContrastRatio(fgColor, bgColor) {
  const l1 = relativeLuminance(fgColor);
  const l2 = relativeLuminance(bgColor);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
