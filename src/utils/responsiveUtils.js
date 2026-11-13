import {
  updateNodeInTree,
  reparentNodeInTree,
  getAbsoluteCoords,
  findNodeAndParent,
  wrapNodesWithTag,
  unwrapWrapperNode,
} from './treeUtils.js';
import { MIN_ELEMENT_SIZE } from './snapUtils.js';

/**
 * Preset definitions for supported responsive viewports.
 */
export const VIEWPORT_PRESETS = {
  desktop: { id: 'desktop', label: 'Masaüstü', shortLabel: 'PC', width: 1280, defaultHeight: 1350 },
  tablet: { id: 'tablet', label: 'Tablet', shortLabel: 'Tablet', width: 768, defaultHeight: 1650 },
  mobile: { id: 'mobile', label: 'Mobil', shortLabel: 'Mobil', width: 375, defaultHeight: 2250 },
};

/**
 * Top-level element keys that vary independently per device viewport.
 * Elements themselves (id, type, tag, name, text, src, href, attrs, children) are shared.
 */
export const RESPONSIVE_NODE_KEYS = [
  'x',
  'y',
  'width',
  'height',
  'isHidden',
  'opacity',
  'zIndex',
  'positionMode',
  'borderRadius',
  'borderRadiusCorners',
  'fillType',
  'fillColor',
  'gradient',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'shadow',
];

export function getViewportPreset(viewportMode) {
  return VIEWPORT_PRESETS[viewportMode] || VIEWPORT_PRESETS.desktop;
}

/**
 * Builds per-viewport canvas settings preserving shared background/height where sensible.
 */
export function createDefaultCanvasByViewport(baseCanvas = {}) {
  const desktopBgColor = baseCanvas.bgColor || baseCanvas.backgroundColor || '#0f172a';
  const desktopBg = baseCanvas.background;
  const desktopWidth = Number(baseCanvas.width) || VIEWPORT_PRESETS.desktop.width;
  const desktopHeight = Number(baseCanvas.height) || VIEWPORT_PRESETS.desktop.defaultHeight;

  const sharedBg = desktopBg ? { background: desktopBg } : {};
  return {
    desktop: {
      width: desktopWidth,
      height: desktopHeight,
      backgroundColor: desktopBgColor,
      ...sharedBg,
    },
    tablet: {
      width: VIEWPORT_PRESETS.tablet.width,
      height: Math.max(VIEWPORT_PRESETS.tablet.defaultHeight, desktopHeight),
      backgroundColor: desktopBgColor,
      ...sharedBg,
    },
    mobile: {
      width: VIEWPORT_PRESETS.mobile.width,
      height: Math.max(VIEWPORT_PRESETS.mobile.defaultHeight, desktopHeight),
      backgroundColor: desktopBgColor,
      ...sharedBg,
    },
  };
}

function shallowCloneStyle(style) {
  return style && typeof style === 'object' ? { ...style } : {};
}

function cloneOverrideValue(val) {
  if (val && typeof val === 'object') {
    return JSON.parse(JSON.stringify(val));
  }
  return val;
}

/**
 * Merges a single AST node with its responsive overrides for `viewportMode`.
 * Desktop always returns the base properties (keeping `node.responsive` intact for inspection).
 */
export function resolveNodeForViewport(node, viewportMode = 'desktop') {
  if (!node) return node;
  const resolvedChildren = Array.isArray(node.children)
    ? node.children.map((c) => resolveNodeForViewport(c, viewportMode))
    : undefined;

  if (viewportMode === 'desktop') {
    if (!resolvedChildren) return node;
    return { ...node, children: resolvedChildren };
  }

  const ov = node.responsive?.[viewportMode];
  if (!ov) {
    if (!resolvedChildren) return node;
    return { ...node, children: resolvedChildren };
  }

  const resolved = { ...node };
  for (const key of RESPONSIVE_NODE_KEYS) {
    if (ov[key] !== undefined) {
      resolved[key] = cloneOverrideValue(ov[key]);
    }
  }

  if (ov.style && typeof ov.style === 'object') {
    const mergedStyle = shallowCloneStyle(node.style);
    for (const [k, v] of Object.entries(ov.style)) {
      if (v === null || v === undefined) {
        delete mergedStyle[k];
      } else {
        mergedStyle[k] = v;
      }
    }
    resolved.style = mergedStyle;
  }

  if (resolvedChildren) {
    resolved.children = resolvedChildren;
  }
  return resolved;
}

/**
 * Resolves the entire AST element tree for the active viewport.
 */
export function resolveTreeForViewport(elements, viewportMode = 'desktop') {
  if (!Array.isArray(elements)) return [];
  if (viewportMode === 'desktop') return elements;
  return elements.map((el) => resolveNodeForViewport(el, viewportMode));
}

/**
 * Checks whether a node (or any descendant when `includeDescendants` is true)
 * has explicit overrides stored for `viewportMode`.
 */
export function hasViewportOverrides(node, viewportMode, includeDescendants = false) {
  if (!node || viewportMode === 'desktop') return false;
  const ov = node.responsive?.[viewportMode];
  if (ov && Object.keys(ov).length > 0) return true;
  if (includeDescendants && Array.isArray(node.children)) {
    return node.children.some((c) => hasViewportOverrides(c, viewportMode, true));
  }
  return false;
}

function findNodeWithParent(nodes, targetId, parent = null) {
  for (const n of nodes || []) {
    if (n.id === targetId) return { node: n, parent };
    if (n.children) {
      const found = findNodeWithParent(n.children, targetId, n);
      if (found) return found;
    }
  }
  return null;
}

function areValuesEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Computes a minimal responsive override object comparing a resolved/edited node state
 * back against the raw desktop node.
 */
function buildOverrideFromResolvedDiff(baseNode, targetNode, prevOverride = {}) {
  const nextOv = { ...(prevOverride || {}) };

  for (const key of RESPONSIVE_NODE_KEYS) {
    if (targetNode[key] === undefined && baseNode[key] === undefined) {
      delete nextOv[key];
      continue;
    }
    if (areValuesEqual(targetNode[key], baseNode[key])) {
      delete nextOv[key];
    } else if (targetNode[key] !== undefined) {
      nextOv[key] = cloneOverrideValue(targetNode[key]);
    }
  }

  if (targetNode.style || baseNode.style) {
    const baseStyle = shallowCloneStyle(baseNode.style);
    const targetStyle = shallowCloneStyle(targetNode.style);
    const styleDiff = {};

    for (const [k, v] of Object.entries(targetStyle)) {
      if (v === undefined) {
        if (Object.prototype.hasOwnProperty.call(baseStyle, k)) {
          styleDiff[k] = null;
        }
      } else if (!areValuesEqual(baseStyle[k], v)) {
        styleDiff[k] = v;
      }
    }

    for (const k of Object.keys(baseStyle)) {
      if (!Object.prototype.hasOwnProperty.call(targetStyle, k)) {
        styleDiff[k] = null;
      }
    }

    if (Object.keys(styleDiff).length > 0) {
      nextOv.style = styleDiff;
    } else {
      delete nextOv.style;
    }
  }

  return nextOv;
}

/**
 * Syncs responsive overrides onto raw children without mutating Desktop child positions/styles.
 */
function syncChildrenViewportDiffs(rawChildren, editedResolvedChildren, viewportMode) {
  if (!Array.isArray(rawChildren)) return rawChildren;
  const editedMap = new Map((editedResolvedChildren || []).map((c) => [c.id, c]));

  return rawChildren.map((rawChild) => {
    const editedChild = editedMap.get(rawChild.id);
    if (!editedChild) return rawChild;

    const nextOverride = buildOverrideFromResolvedDiff(
      rawChild,
      editedChild,
      rawChild.responsive?.[viewportMode]
    );

    const nextResponsive = { ...(rawChild.responsive || {}) };
    if (Object.keys(nextOverride).length > 0) {
      nextResponsive[viewportMode] = nextOverride;
    } else {
      delete nextResponsive[viewportMode];
    }

    const updatedChild = {
      ...rawChild,
      responsive: nextResponsive,
    };

    if (rawChild.children) {
      updatedChild.children = syncChildrenViewportDiffs(
        rawChild.children,
        editedChild.children,
        viewportMode
      );
    }

    return updatedChild;
  });
}

function clampChildrenToContainer(children, containerW, containerH) {
  if (!Array.isArray(children) || children.length === 0) return children;
  if (typeof containerW !== 'number' || containerW <= 0) return children;

  return children.map((c) => {
    let cx = c.x;
    let cy = c.y;
    if (typeof cx === 'number' && typeof c.width === 'number' && cx + c.width > containerW - 8) {
      cx = Math.max(8, Math.round(containerW - c.width - 8));
    }
    if (
      typeof containerH === 'number' &&
      containerH > 0 &&
      typeof cy === 'number' &&
      typeof c.height === 'number' &&
      cy + c.height > containerH - 8
    ) {
      cy = Math.max(8, Math.round(containerH - c.height - 8));
    }
    if (cx !== c.x || cy !== c.y) {
      return { ...c, x: cx, y: cy };
    }
    return c;
  });
}

/**
 * Applies a partial update `updatesOrFn` to `nodeId` inside `rawTree` for the given `viewportMode`.
 * - In `desktop`, updates the base node via `updateNodeInTree` (preserving `node.responsive`).
 * - In `tablet`/`mobile`, records geometry/style/visibility diffs inside `node.responsive[viewportMode]`
 *   and isolates any child clamping or layout edits into children's `responsive[viewportMode]`.
 */
export function applyNodeUpdateForViewport(
  rawTree,
  nodeId,
  updatesOrFn,
  viewportMode = 'desktop'
) {
  if (!Array.isArray(rawTree)) return [];

  if (viewportMode === 'desktop') {
    return updateNodeInTree(rawTree, nodeId, updatesOrFn);
  }

  const found = findNodeWithParent(rawTree, nodeId);
  if (!found) return rawTree;

  const { node: rawNode } = found;
  const resolvedCurrent = resolveNodeForViewport(rawNode, viewportMode);
  const updates = typeof updatesOrFn === 'function' ? updatesOrFn(resolvedCurrent) : updatesOrFn;
  if (!updates || typeof updates !== 'object') return rawTree;

  // Build next resolved state first so container child clamping matches Desktop behavior
  const nextResolved = { ...resolvedCurrent, ...updates };
  let resolvedChildrenToSync =
    updates.children !== undefined ? updates.children : resolvedCurrent.children;

  if (
    Array.isArray(resolvedChildrenToSync) &&
    resolvedChildrenToSync.length > 0 &&
    (updates.width !== undefined || updates.height !== undefined)
  ) {
    const newW = updates.width !== undefined ? updates.width : resolvedCurrent.width;
    const newH = updates.height !== undefined ? updates.height : resolvedCurrent.height;
    resolvedChildrenToSync = clampChildrenToContainer(resolvedChildrenToSync, newW, newH);
  }

  // Split updates into shared base updates (text/src/href/name/attrs/isLocked) and responsive diffs
  const sharedUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'children' || k === 'style' || k === 'responsive' || RESPONSIVE_NODE_KEYS.includes(k)) {
      continue;
    }
    sharedUpdates[k] = v;
  }

  const nextOv = buildOverrideFromResolvedDiff(
    rawNode,
    nextResolved,
    rawNode.responsive?.[viewportMode]
  );

  const nextResponsive = { ...(rawNode.responsive || {}) };
  if (Object.keys(nextOv).length > 0) {
    nextResponsive[viewportMode] = nextOv;
  } else {
    delete nextResponsive[viewportMode];
  }

  const patchNode = (nodes) =>
    nodes.map((n) => {
      if (n.id === nodeId) {
        const updated = {
          ...n,
          ...sharedUpdates,
          responsive: nextResponsive,
        };
        if (Array.isArray(resolvedChildrenToSync) && n.children) {
          updated.children = syncChildrenViewportDiffs(
            n.children,
            resolvedChildrenToSync,
            viewportMode
          );
        }
        return updated;
      }
      if (n.children) {
        return { ...n, children: patchNode(n.children) };
      }
      return n;
    });

  return patchNode(rawTree);
}

/**
 * Applies a map `{ [id]: updates }` to multiple nodes for the active viewport.
 */
export function applyMultipleUpdatesForViewport(rawTree, updatesMap, viewportMode = 'desktop') {
  if (!updatesMap || typeof updatesMap !== 'object') return rawTree;
  let nextTree = rawTree;
  for (const [id, updates] of Object.entries(updatesMap)) {
    if (updates) {
      nextTree = applyNodeUpdateForViewport(nextTree, id, updates, viewportMode);
    }
  }
  return nextTree;
}

/**
 * Syncs edits from an already-transformed resolved tree (e.g. align/distribute/AI update)
 * back into `rawTree` while preserving both Desktop design and other viewports' overrides.
 */
export function syncViewportTreeDiffs(rawTree, editedResolvedTree, viewportMode = 'desktop') {
  const rawById = new Map();
  const indexRaw = (nodes) => {
    for (const n of nodes || []) {
      rawById.set(n.id, n);
      if (n.children) indexRaw(n.children);
    }
  };
  indexRaw(rawTree);

  const walk = (editedNodes) =>
    (editedNodes || []).map((editedNode) => {
      const rawNode = rawById.get(editedNode.id);
      const nextChildren = Array.isArray(editedNode.children) ? walk(editedNode.children) : undefined;

      if (!rawNode) {
        return nextChildren ? { ...editedNode, children: nextChildren } : editedNode;
      }

      if (viewportMode === 'desktop') {
        const merged = { ...editedNode };
        if (rawNode.responsive && !editedNode.responsive) {
          merged.responsive = rawNode.responsive;
        }
        if (nextChildren) merged.children = nextChildren;
        return merged;
      }

      const nextOv = buildOverrideFromResolvedDiff(
        rawNode,
        editedNode,
        rawNode.responsive?.[viewportMode]
      );
      const nextResponsive = { ...(rawNode.responsive || {}) };
      if (Object.keys(nextOv).length > 0) {
        nextResponsive[viewportMode] = nextOv;
      } else {
        delete nextResponsive[viewportMode];
      }

      // Preserve shared properties edited on the active element if any (text/name/attrs/src)
      const mergedNode = {
        ...rawNode,
        name: editedNode.name ?? rawNode.name,
        tag: editedNode.tag ?? rawNode.tag,
        text: editedNode.text !== undefined ? editedNode.text : rawNode.text,
        src: editedNode.src !== undefined ? editedNode.src : rawNode.src,
        href: editedNode.href !== undefined ? editedNode.href : rawNode.href,
        attrs: editedNode.attrs !== undefined ? editedNode.attrs : rawNode.attrs,
        responsive: nextResponsive,
      };
      if (nextChildren) mergedNode.children = nextChildren;
      return mergedNode;
    });

  return walk(editedResolvedTree);
}

/**
 * Reparents a node in the shared tree while keeping every viewport's local coordinates anchored
 * to its previous absolute canvas position inside the new parent.
 */
export function reparentNodeForViewport(
  rawTree,
  draggedId,
  targetParentId,
  targetIndex = -1
) {
  const found = findNodeAndParent(rawTree, draggedId);
  if (!found) return rawTree;

  // Calculate new local coordinates in Tablet & Mobile if that viewport has overrides on node or parents
  const vpNewCoords = {};
  for (const vp of ['tablet', 'mobile']) {
    const oldParentNode = found.parent;
    const targetParentNode = targetParentId ? findNodeAndParent(rawTree, targetParentId)?.node : null;
    const vpActive =
      Boolean(found.node.responsive?.[vp]) ||
      Boolean(oldParentNode?.responsive?.[vp]) ||
      Boolean(targetParentNode?.responsive?.[vp]);
    if (!vpActive) continue;

    const vpTree = resolveTreeForViewport(rawTree, vp);
    const oldAbs = getAbsoluteCoords(vpTree, draggedId);
    if (!oldAbs) continue;
    if (targetParentId) {
      const targetAbs = getAbsoluteCoords(vpTree, targetParentId);
      vpNewCoords[vp] = targetAbs
        ? {
            x: Math.round(oldAbs.x - targetAbs.x),
            y: Math.round(oldAbs.y - targetAbs.y),
          }
        : { x: Math.round(oldAbs.x), y: Math.round(oldAbs.y) };
    } else {
      vpNewCoords[vp] = { x: Math.round(oldAbs.x), y: Math.round(oldAbs.y) };
    }
  }

  let nextTree = reparentNodeInTree(rawTree, draggedId, targetParentId, targetIndex);
  for (const [vp, coords] of Object.entries(vpNewCoords)) {
    nextTree = applyNodeUpdateForViewport(nextTree, draggedId, coords, vp);
  }
  return nextTree;
}

/**
 * Creates a raw AST node ready for insertion when a new element is added while viewing `viewportMode`.
 * Ensures the element is cleanly present on Desktop AND has exact placement on `viewportMode`.
 */
export function computeBaseFromViewportElement(viewportEl, viewportMode = 'desktop', parentNode = null) {
  if (!viewportEl || viewportMode === 'desktop') return viewportEl;

  const vpW = parentNode
    ? Number(resolveNodeForViewport(parentNode, viewportMode)?.width) || getViewportPreset(viewportMode).width
    : getViewportPreset(viewportMode).width;
  const deskW = parentNode ? Number(parentNode.width) || 1280 : VIEWPORT_PRESETS.desktop.width;
  const ratio = vpW > 0 ? Math.min(3.5, Math.max(1, deskW / vpW)) : 1;

  const vw = Number(viewportEl.width) || 120;
  const vh = Number(viewportEl.height) || 40;
  const vx = Number(viewportEl.x) || 0;
  const vy = Number(viewportEl.y) || 0;

  const isFullWidth = vx <= 4 && vw >= vpW - 8;
  const baseWidth = isFullWidth
    ? deskW
    : Math.min(deskW - 24, Math.max(vw, Math.round(vw * (vw >= vpW * 0.65 ? ratio : Math.min(1.5, ratio)))));
  const baseX = isFullWidth
    ? 0
    : Math.max(0, Math.min(Math.max(0, deskW - baseWidth), Math.round(vx * ratio)));

  return {
    ...viewportEl,
    x: baseX,
    y: vy,
    width: baseWidth,
    height: vh,
    responsive: {
      ...(viewportEl.responsive || {}),
      [viewportMode]: {
        x: vx,
        y: vy,
        width: vw,
        height: vh,
      },
    },
  };
}

// ============================================================================
// AUTOMATIC RESPONSIVE ADAPTATION (Desktop 1280px -> Tablet 768px / Mobile 375px)
// ============================================================================

function parseFontSizePx(fontSize) {
  if (typeof fontSize === 'number') return fontSize;
  if (typeof fontSize !== 'string') return null;
  const m = fontSize.match(/([\d.]+)\s*px/i);
  return m ? parseFloat(m[1]) : null;
}

function parsePaddingPx(paddingStr) {
  if (!paddingStr || typeof paddingStr !== 'string') return null;
  const nums = paddingStr
    .trim()
    .split(/\s+/)
    .map((p) => parseFloat(p))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 1) return { top: nums[0], right: nums[0], bottom: nums[0], left: nums[0] };
  if (nums.length === 2) return { top: nums[0], right: nums[1], bottom: nums[0], left: nums[1] };
  if (nums.length === 3) return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[1] };
  if (nums.length >= 4) return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[3] };
  return null;
}

function adaptFontSizeForViewport(baseFontSize, targetViewport) {
  const px = parseFontSizePx(baseFontSize);
  if (!px) return baseFontSize;

  if (targetViewport === 'tablet') {
    if (px >= 40) return `${Math.max(28, Math.round(px * 0.76))}px`;
    if (px >= 28) return `${Math.max(22, Math.round(px * 0.84))}px`;
    if (px >= 18) return `${Math.max(15, Math.round(px * 0.9))}px`;
    return `${Math.max(12, Math.round(px * 0.95))}px`;
  }

  // mobile
  if (px >= 40) return `${Math.max(24, Math.round(px * 0.56))}px`;
  if (px >= 28) return `${Math.max(20, Math.round(px * 0.72))}px`;
  if (px >= 20) return `${Math.max(17, Math.round(px * 0.85))}px`;
  if (px >= 16) return `${Math.max(14, Math.round(px * 0.88))}px`;
  return `${Math.max(11, Math.round(px * 0.92))}px`;
}

function estimateMinTextHeight(node, targetWidth, adaptedStyle) {
  const baseH = Number(node.height) || 32;
  const text = typeof node.text === 'string' ? node.text.trim() : '';
  if (!text || (Array.isArray(node.children) && node.children.length > 0)) {
    return baseH;
  }

  const tag = (node.tag || '').toLowerCase();
  if (tag === 'button' || tag === 'a') {
    const fs = parseFontSizePx(adaptedStyle?.fontSize || node.style?.fontSize) || 14;
    return Math.max(36, Math.min(baseH, Math.round(fs * 2.6)));
  }

  const fs = parseFontSizePx(adaptedStyle?.fontSize || node.style?.fontSize) || 14;
  const pad = parsePaddingPx(adaptedStyle?.padding || node.style?.padding) || {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const usableW = Math.max(40, targetWidth - pad.left - pad.right);
  const avgCharW = fs * 0.54;
  const charsPerLine = Math.max(4, Math.floor(usableW / avgCharW));
  const explicitLines = text.split('\n');
  let lines = 0;
  for (const part of explicitLines) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine));
  }
  const lineHeight = fs * 1.42;
  const needed = Math.ceil(lines * lineHeight + pad.top + pad.bottom + 4);
  return Math.max(Math.min(baseH, Math.round(lineHeight + pad.top + pad.bottom + 8)), needed);
}

function isNavElement(node) {
  const tag = (node.tag || '').toLowerCase();
  const id = (node.id || '').toLowerCase();
  const name = (node.name || '').toLowerCase();
  return tag === 'nav' || id.includes('nav') || name.includes('nav');
}

/**
 * Groups children into horizontal visual rows ordered top-to-bottom, left-to-right.
 */
function groupChildrenIntoVisualRows(children) {
  if (!children || children.length === 0) return [];
  const sorted = [...children].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const rows = [];

  for (const child of sorted) {
    const cy1 = Number(child.y) || 0;
    const cy2 = cy1 + (Number(child.height) || 40);
    const cH = Math.max(1, cy2 - cy1);

    let placed = false;
    for (const row of rows) {
      const overlap = Math.min(row.bottom, cy2) - Math.max(row.top, cy1);
      const minH = Math.min(row.avgH, cH);
      if (overlap >= minH * 0.4) {
        row.items.push(child);
        row.top = Math.min(row.top, cy1);
        row.bottom = Math.max(row.bottom, cy2);
        row.avgH = (row.avgH * (row.items.length - 1) + cH) / row.items.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ top: cy1, bottom: cy2, avgH: cH, items: [child] });
    }
  }

  for (const row of rows) {
    row.items.sort((a, b) => (a.x - b.x) || (a.y - b.y));
  }
  rows.sort((a, b) => a.top - b.top);
  return rows;
}

/**
 * Adapts styles (font size, horizontal padding) for non-nav elements cleanly.
 */
function buildAdaptedStyle(baseStyle, targetViewport, availableW) {
  if (!baseStyle || typeof baseStyle !== 'object') return {};
  const next = { ...baseStyle };
  let changed = false;

  if (baseStyle.fontSize) {
    const adaptedFs = adaptFontSizeForViewport(baseStyle.fontSize, targetViewport);
    if (adaptedFs !== baseStyle.fontSize) {
      next.fontSize = adaptedFs;
      changed = true;
    }
  }

  if (baseStyle.padding && typeof baseStyle.padding === 'string') {
    const pad = parsePaddingPx(baseStyle.padding);
    if (pad && (pad.left >= 24 || pad.right >= 24)) {
      const cap = targetViewport === 'mobile' ? 14 : 24;
      const newL = Math.min(pad.left, cap, Math.floor(availableW * 0.12));
      const newR = Math.min(pad.right, cap, Math.floor(availableW * 0.12));
      const newT = targetViewport === 'mobile' ? Math.min(pad.top, 20) : pad.top;
      const newB = targetViewport === 'mobile' ? Math.min(pad.bottom, 20) : pad.bottom;
      next.padding = `${newT}px ${newR}px ${newB}px ${newL}px`;
      changed = true;
    }
  }

  return changed ? next : baseStyle;
}

/**
 * Special clean adaptation for navigation bars (`nav` / header rows).
 */
function layoutNavChildren(rawNode, targetWidth, targetViewport, patchMap) {
  const isMobile = targetViewport === 'mobile';
  const padX = isMobile ? 12 : 20;
  const innerW = Math.max(120, targetWidth - padX * 2);
  const children = rawNode.children || [];
  if (children.length === 0) return Math.max(60, Number(rawNode.height) || 72);

  // Identify likely logo (leftmost), CTA button (tag==='button' or rightmost), and links group
  const sorted = [...children].sort((a, b) => a.x - b.x);
  const logo = sorted[0];
  const cta = sorted.length >= 2 && (sorted[sorted.length - 1].tag === 'button' || sorted.length >= 3)
    ? sorted[sorted.length - 1]
    : null;
  const middleItems = sorted.filter((c) => c !== logo && c !== cta);

  const setPatch = (child, box, extraStyle = null, adaptedChildrenHeight = null) => {
    const style = buildAdaptedStyle(child.style, targetViewport, box.width);
    if (extraStyle) Object.assign(style, extraStyle);
    const targetState = {
      ...child,
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.max(MIN_ELEMENT_SIZE, Math.round(box.width)),
      height: Math.max(MIN_ELEMENT_SIZE, Math.round(adaptedChildrenHeight ?? box.height)),
      style,
    };
    const ov = buildOverrideFromResolvedDiff(child, targetState, {});
    patchMap.set(child.id, { ov, adaptedWidth: targetState.width, adaptedHeight: targetState.height });
    return targetState;
  };

  if (!isMobile && sorted.length <= 3) {
    // Tablet single clean row
    const navH = 68;
    const logoW = Math.min(Number(logo.width) || 150, 175);
    const logoH = Math.min(Number(logo.height) || 32, 36);
    setPatch(logo, { x: padX, y: Math.round((navH - logoH) / 2), width: logoW, height: logoH });

    let ctaW = 0;
    if (cta) {
      ctaW = Math.min(Number(cta.width) || 120, 140);
      const ctaH = Math.min(Number(cta.height) || 38, 40);
      setPatch(
        cta,
        {
          x: targetWidth - padX - ctaW,
          y: Math.round((navH - ctaH) / 2),
          width: ctaW,
          height: ctaH,
        },
        { fontSize: '13px', padding: '8px 14px' }
      );
    }

    if (middleItems.length > 0) {
      const availMid = Math.max(160, innerW - logoW - ctaW - 24);
      const mid = middleItems[0];
      const midW = Math.min(Number(mid.width) || availMid, availMid);
      const midH = Math.min(Number(mid.height) || 36, 40);
      const midX = Math.round(padX + logoW + 12 + Math.max(0, (availMid - midW) / 2));
      layoutNavLinksContainer(mid, midW, targetViewport, patchMap);
      setPatch(mid, { x: midX, y: Math.round((navH - midH) / 2), width: midW, height: midH }, { gap: '14px' });
    }
    return navH;
  }

  // Mobile 2-row crisp header: top row (Logo + CTA), second row (Links strip)
  const logoH = Math.min(Number(logo.height) || 30, 32);
  const ctaW = cta ? Math.min(Number(cta.width) || 110, 126) : 0;
  const ctaH = cta ? Math.min(Number(cta.height) || 34, 34) : 0;
  const logoMaxW = cta ? Math.max(110, innerW - ctaW - 10) : innerW;
  const logoW = Math.min(Number(logo.width) || 150, logoMaxW);

  setPatch(
    logo,
    { x: padX, y: 14, width: logoW, height: logoH },
    { fontSize: '15px' }
  );

  if (cta) {
    setPatch(
      cta,
      { x: targetWidth - padX - ctaW, y: 13, width: ctaW, height: ctaH },
      { fontSize: '12px', padding: '6px 12px' }
    );
  }

  let curY = 56;
  const allFlatMiddle = middleItems.every((m) => !Array.isArray(m.children) || m.children.length === 0);
  if (middleItems.length > 1 && allFlatMiddle) {
    // Wrap flat middle links/badges cleanly into horizontal rows instead of stacking 1-per-row
    const rowGap = 8;
    const itemGap = 8;
    const rowH = 30;
    let cursorX = padX;
    let rowY = curY;

    middleItems.forEach((mid) => {
      const isBadge = (mid.tag === 'span' || mid.type === 'span') && Number(mid.width) >= 100;
      const desiredW = Math.min(
        innerW,
        Math.max(isBadge ? 116 : 74, Math.min(Number(mid.width) || 90, isBadge ? 148 : Math.floor((innerW - itemGap) / 2)))
      );
      if (cursorX > padX && cursorX + desiredW > padX + innerW) {
        cursorX = padX;
        rowY += rowH + rowGap;
      }
      setPatch(
        mid,
        { x: cursorX, y: rowY, width: desiredW, height: rowH },
        { fontSize: isBadge ? '11px' : '12px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }
      );
      cursorX += desiredW + itemGap;
    });
    return Math.max(60, rowY + rowH + 10);
  }

  for (const mid of middleItems) {
    const midH = 34;
    if (Array.isArray(mid.children) && mid.children.length > 0) {
      layoutNavLinksContainer(mid, innerW, targetViewport, patchMap);
    }
    setPatch(
      mid,
      { x: padX, y: curY, width: innerW, height: midH },
      { gap: '8px', justifyContent: 'space-between', flexWrap: 'wrap', padding: '0 4px' }
    );
    curY += midH + 10;
  }

  return Math.max(60, middleItems.length > 0 ? curY : 60);
}

/**
 * Special responsive layout for Slider containers so slides remain stacked at (0,0)
 * instead of unfolding sequentially into a tall empty vertical list.
 */
function adaptSliderSubtree(rawNode, assignedWidth, targetViewport, patchMap, adaptedStyle) {
  const isMobile = targetViewport === 'mobile';
  const children = rawNode.children || [];
  const slides = children.filter((c) => c.sliderRole === 'slide');
  const prevBtns = children.filter((c) => c.events?.onClick?.mode === 'slider_prev');
  const nextBtns = children.filter((c) => c.events?.onClick?.mode === 'slider_next');
  const dots = children
    .filter((c) => c.sliderRole === 'dot')
    .sort((a, b) => Number(a.slideIndex || 0) - Number(b.slideIndex || 0));
  const handledSet = new Set([...slides, ...prevBtns, ...nextBtns, ...dots]);
  const extras = children.filter((c) => !handledSet.has(c));

  const setPatch = (child, box, styleObj = child.style, extraW = null, extraH = null) => {
    const targetState = {
      ...child,
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.max(8, Math.round(box.width)),
      height: Math.max(8, Math.round(box.height)),
      style: styleObj,
    };
    patchMap.set(child.id, {
      ov: buildOverrideFromResolvedDiff(child, targetState, {}),
      adaptedWidth: extraW ?? targetState.width,
      adaptedHeight: extraH ?? targetState.height,
    });
  };

  let maxSlideH = 0;
  const slideResults = slides.map((slide) => {
    const adaptedSlide = adaptSubtreeAtWidth(slide, assignedWidth, targetViewport, patchMap);
    maxSlideH = Math.max(maxSlideH, adaptedSlide.height);
    return { slide, adaptedSlide };
  });

  const dotReserve = dots.length > 0 ? (isMobile ? 28 : 22) : 0;
  const totalSliderH = Math.max(MIN_ELEMENT_SIZE, maxSlideH + dotReserve);

  slideResults.forEach(({ slide, adaptedSlide }) => {
    setPatch(
      slide,
      { x: 0, y: 0, width: assignedWidth, height: maxSlideH },
      { ...adaptedSlide.style, paddingBottom: dotReserve ? `${dotReserve}px` : adaptedSlide.style?.paddingBottom },
      assignedWidth,
      maxSlideH
    );
  });

  const arrowSize = isMobile ? 32 : 38;
  const arrowY = Math.max(8, Math.round((maxSlideH - arrowSize) / 2));
  prevBtns.forEach((btn) => {
    const btnStyle = buildAdaptedStyle(btn.style, targetViewport, arrowSize);
    setPatch(btn, { x: isMobile ? 6 : 12, y: arrowY, width: arrowSize, height: arrowSize }, btnStyle);
  });
  nextBtns.forEach((btn) => {
    const btnStyle = buildAdaptedStyle(btn.style, targetViewport, arrowSize);
    setPatch(btn, { x: assignedWidth - arrowSize - (isMobile ? 6 : 12), y: arrowY, width: arrowSize, height: arrowSize }, btnStyle);
  });

  if (dots.length > 0) {
    const dotSize = 10;
    const dotGap = 8;
    const dotsSpan = dots.length * dotSize + (dots.length - 1) * dotGap;
    const startX = Math.round((assignedWidth - dotsSpan) / 2);
    const dotY = Math.max(12, totalSliderH - 18);
    dots.forEach((dot, idx) => {
      setPatch(
        dot,
        { x: startX + idx * (dotSize + dotGap), y: dotY, width: dotSize, height: dotSize },
        dot.style
      );
    });
  }

  extras.forEach((extra) => {
    const extraW = Math.min(assignedWidth - 24, Math.max(MIN_ELEMENT_SIZE, Number(extra.width) || 120));
    const adaptedExtra = adaptSubtreeAtWidth(extra, extraW, targetViewport, patchMap);
    setPatch(
      extra,
      {
        x: Math.min(Number(extra.x) || 0, Math.max(0, assignedWidth - extraW)),
        y: Math.min(Number(extra.y) || 0, Math.max(0, totalSliderH - adaptedExtra.height)),
        width: adaptedExtra.width,
        height: adaptedExtra.height,
      },
      adaptedExtra.style
    );
  });

  return {
    width: assignedWidth,
    height: totalSliderH,
    style: adaptedStyle,
  };
}

/**
 * Detects multi-column vertical clusters (like Footer directories) so mobile stacks each column cleanly instead of interleaving rows across columns.
 */
function buildGroupedColumnSequence(children, baseW) {
  if (!children || children.length < 4 || baseW < 640) return null;
  const wideThreshold = baseW * 0.56;
  const wideItems = [];
  const colItems = [];

  children.forEach((ch) => {
    const w = Number(ch.width) || 0;
    const isFooterBottomCopy =
      (ch.children?.length || 0) === 0 &&
      /^(©|copyright|\(c\))/i.test(String(ch.textContent || ch.text || ch.content || '').trim());
    if (w >= wideThreshold || isFooterBottomCopy) wideItems.push(ch);
    else colItems.push(ch);
  });

  if (colItems.length < 4) return null;

  const sortedByX = [...colItems].sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0));
  const clusters = [];
  for (const item of sortedByX) {
    const x1 = Number(item.x) || 0;
    const x2 = x1 + (Number(item.width) || 40);
    const match = clusters.find((cl) => x1 <= cl.maxX - 4 && x2 >= cl.minX + 4);
    if (match) {
      match.items.push(item);
      match.minX = Math.min(match.minX, x1);
      match.maxX = Math.max(match.maxX, x2);
      match.minY = Math.min(match.minY, Number(item.y) || 0);
      match.maxY = Math.max(match.maxY, (Number(item.y) || 0) + (Number(item.height) || 24));
    } else {
      clusters.push({
        items: [item],
        minX: x1,
        maxX: x2,
        minY: Number(item.y) || 0,
        maxY: (Number(item.y) || 0) + (Number(item.height) || 24),
      });
    }
  }

  const multiItemClusters = clusters.filter((cl) => cl.items.length >= 2);
  if (clusters.length < 2 || multiItemClusters.length < 2) return null;

  const minColY = Math.min(...clusters.map((cl) => cl.minY));
  const maxColY = Math.max(...clusters.map((cl) => cl.maxY));
  const topBands = wideItems.filter((w) => (Number(w.y) || 0) <= minColY).sort((a, b) => a.y - b.y);
  const bottomBands = wideItems.filter((w) => (Number(w.y) || 0) > minColY && (Number(w.y) || 0) >= maxColY - 24).sort((a, b) => a.y - b.y);
  const middleBands = wideItems.filter((w) => !topBands.includes(w) && !bottomBands.includes(w));
  if (middleBands.length > 0) return null;

  const orderedRows = [];
  topBands.forEach((b) => orderedRows.push(...groupChildrenIntoVisualRows([b])));
  clusters
    .sort((a, b) => a.minX - b.minX)
    .forEach((cl) => {
      orderedRows.push(...groupChildrenIntoVisualRows(cl.items));
    });
  bottomBands.forEach((b) => orderedRows.push(...groupChildrenIntoVisualRows([b])));
  return orderedRows;
}

function layoutNavLinksContainer(containerNode, targetW, targetViewport, patchMap) {
  const kids = [...(containerNode.children || [])].sort((a, b) => a.x - b.x);
  if (kids.length === 0) return;
  const count = kids.length;
  const gap = targetViewport === 'mobile' ? 6 : 12;
  const eachW = Math.max(36, Math.floor((targetW - gap * Math.max(0, count - 1)) / count));
  const fs = targetViewport === 'mobile' ? '12px' : '13px';

  kids.forEach((child, idx) => {
    const style = buildAdaptedStyle(child.style, targetViewport, eachW);
    style.fontSize = fs;
    style.textAlign = 'center';
    const targetState = {
      ...child,
      x: Math.round(idx * (eachW + gap)),
      y: Math.min(Number(child.y) || 6, 8),
      width: eachW,
      height: Math.min(Number(child.height) || 24, 26),
      style,
    };
    const ov = buildOverrideFromResolvedDiff(child, targetState, {});
    patchMap.set(child.id, { ov, adaptedWidth: eachW, adaptedHeight: targetState.height });
  });
}

/**
 * Recursively computes clean responsive box & styles for a node and its descendants
 * given an assigned `assignedWidth`, collecting patches into `patchMap`.
 */
function adaptSubtreeAtWidth(rawNode, assignedWidth, targetViewport, patchMap, options = {}) {
  const isMobile = targetViewport === 'mobile';
  const baseW = Math.max(1, Number(rawNode.width) || assignedWidth);
  const scaleRatio = Math.min(1, assignedWidth / baseW);

  // Check special navbar handling
  if (isNavElement(rawNode) && Array.isArray(rawNode.children) && rawNode.children.length > 0) {
    const navH = layoutNavChildren(rawNode, assignedWidth, targetViewport, patchMap);
    const navStyle = buildAdaptedStyle(rawNode.style, targetViewport, assignedWidth);
    navStyle.padding = isMobile ? '8px 12px' : '0 20px';
    if (isMobile) {
      navStyle.flexDirection = 'column';
      navStyle.alignItems = 'stretch';
    }
    return {
      width: assignedWidth,
      height: navH,
      style: navStyle,
    };
  }

  const adaptedStyle = buildAdaptedStyle(rawNode.style, targetViewport, assignedWidth);
  const children = rawNode.children || [];

  // Leaf node: adapt typography + height to fit wrapped text cleanly
  if (children.length === 0) {
    const estH = estimateMinTextHeight(rawNode, assignedWidth, adaptedStyle);
    const isDecorativeShape = !rawNode.text && (rawNode.tag === 'div' || rawNode.tag === 'img');
    const minH = isDecorativeShape
      ? Math.max(MIN_ELEMENT_SIZE, Math.round((Number(rawNode.height) || 40) * Math.max(0.65, scaleRatio)))
      : estH;
    return {
      width: assignedWidth,
      height: Math.max(MIN_ELEMENT_SIZE, minH),
      style: adaptedStyle,
    };
  }

  // Slider container: keep slides overlaid at (0,0) and keep arrows/dots compact
  if (rawNode.sliderConfig || children.some((c) => c.sliderRole === 'slide')) {
    return adaptSliderSubtree(rawNode, assignedWidth, targetViewport, patchMap, adaptedStyle);
  }

  // Container node with children: compute inner padding & reflow rows recursively
  const minChildX = Math.min(...children.map((c) => Number(c.x) || 0));
  const minChildY = Math.min(...children.map((c) => Number(c.y) || 0));
  const stylePad = parsePaddingPx(rawNode.style?.padding);

  let padX = 0;
  if (stylePad && (stylePad.left > 0 || stylePad.right > 0)) {
    padX = Math.min(
      isMobile ? 14 : 24,
      Math.max(8, Math.round((stylePad.left + stylePad.right) / 2 * (isMobile ? 0.45 : 0.65)))
    );
  } else if (minChildX > 0 && minChildX <= 64) {
    padX = Math.min(isMobile ? 14 : 22, Math.max(8, Math.round(minChildX * (isMobile ? 0.4 : 0.65))));
  } else if (minChildX > 64 && assignedWidth <= 768) {
    // e.g. Hero with centered wide blocks that had 200px left margin on Desktop
    padX = isMobile ? 14 : 24;
  }

  const innerAvailW = Math.max(60, assignedWidth - padX * 2);
  const padTop = minChildY > 0
    ? Math.min(isMobile ? 28 : 40, Math.max(8, Math.round(minChildY * (isMobile ? 0.55 : 0.78))))
    : 0;

  const groupedColumnRows = (isMobile || assignedWidth <= 520) ? buildGroupedColumnSequence(children, baseW) : null;
  const rows = groupedColumnRows || groupChildrenIntoVisualRows(children);
  const layoutGap = isMobile ? 14 : 18;
  let curY = padTop;
  let prevDesktopRowBottom = rows[0]?.top ?? 0;

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const items = row.items;

    if (rIdx > 0) {
      const desktopGap = Math.max(8, row.top - prevDesktopRowBottom);
      const scaledGap = isMobile
        ? Math.min(24, Math.max(12, Math.round(desktopGap * 0.6)))
        : Math.min(32, Math.max(14, Math.round(desktopGap * 0.8)));
      curY += scaledGap;
    }

    if (items.length === 1) {
      const item = items[0];
      const itemBaseW = Number(item.width) || 120;
      const baseCenter = (Number(item.x) || 0) + itemBaseW / 2;
      const wasCentered = Math.abs(baseCenter - baseW / 2) <= Math.max(36, baseW * 0.05);
      const wasFullBleed = (Number(item.x) || 0) <= 6 && itemBaseW >= baseW - 12;

      let targetChildW;
      let targetChildX;

      if (wasFullBleed) {
        targetChildW = assignedWidth;
        targetChildX = 0;
      } else if (itemBaseW >= baseW * 0.62 || itemBaseW > innerAvailW) {
        targetChildW = innerAvailW;
        targetChildX = padX;
      } else if (wasCentered) {
        targetChildW = Math.min(innerAvailW, Math.max(MIN_ELEMENT_SIZE, itemBaseW));
        targetChildX = Math.round((assignedWidth - targetChildW) / 2);
      } else if (groupedColumnRows) {
        targetChildW = Math.min(innerAvailW, Math.max(MIN_ELEMENT_SIZE, itemBaseW));
        targetChildX = padX;
      } else {
        targetChildW = Math.min(innerAvailW, Math.max(MIN_ELEMENT_SIZE, itemBaseW));
        const relX = (Number(item.x) || 0) / Math.max(1, baseW - itemBaseW);
        const freeSpace = Math.max(0, innerAvailW - targetChildW);
        targetChildX = Math.round(padX + relX * freeSpace);
      }

      const adaptedChild = adaptSubtreeAtWidth(item, targetChildW, targetViewport, patchMap);
      const targetState = {
        ...item,
        x: targetChildX,
        y: curY,
        width: adaptedChild.width,
        height: adaptedChild.height,
        style: adaptedChild.style,
      };
      patchMap.set(item.id, {
        ov: buildOverrideFromResolvedDiff(item, targetState, {}),
        adaptedWidth: adaptedChild.width,
        adaptedHeight: adaptedChild.height,
      });

      curY += adaptedChild.height;
      prevDesktopRowBottom = row.bottom;
      continue;
    }

    // Multiple items in the same visual row: decide how many columns fit comfortably
    const k = items.length;
    const isLabelWithTrailingActionIcon =
      k === 2 &&
      (items[0].children?.length || 0) === 0 &&
      (items[1].children?.length || 0) === 0 &&
      (Number(items[1].width) || 0) <= 56 &&
      (Number(items[1].height) || 0) <= 56 &&
      innerAvailW >= 150;

    if (isLabelWithTrailingActionIcon) {
      const [leadItem, actionItem] = items;
      const actionW = Math.max(28, Math.round(Number(actionItem.width) || 32));
      const actionH = Math.max(28, Math.round(Number(actionItem.height) || 32));
      const gapPx = 10;
      const leadW = Math.max(80, innerAvailW - actionW - gapPx);
      const adaptedLead = adaptSubtreeAtWidth(leadItem, leadW, targetViewport, patchMap);
      const actionStyle = buildAdaptedStyle(actionItem.style, targetViewport, actionW);
      const rowMaxH = Math.max(adaptedLead.height, actionH);

      const leadTarget = {
        ...leadItem,
        x: padX,
        y: curY,
        width: adaptedLead.width,
        height: adaptedLead.height,
        style: adaptedLead.style,
      };
      patchMap.set(leadItem.id, {
        ov: buildOverrideFromResolvedDiff(leadItem, leadTarget, {}),
        adaptedWidth: leadTarget.width,
        adaptedHeight: leadTarget.height,
      });

      const actionTarget = {
        ...actionItem,
        x: padX + innerAvailW - actionW,
        y: curY + Math.max(0, Math.round((rowMaxH - actionH) / 2)),
        width: actionW,
        height: actionH,
        style: actionStyle,
      };
      patchMap.set(actionItem.id, {
        ov: buildOverrideFromResolvedDiff(actionItem, actionTarget, {}),
        adaptedWidth: actionW,
        adaptedHeight: actionH,
      });

      curY += rowMaxH;
      prevDesktopRowBottom = row.bottom;
      continue;
    }

    const minDesktopItemW = Math.min(...items.map((it) => Number(it.width) || 100));
    const maxDesktopItemW = Math.max(...items.map((it) => Number(it.width) || 100));
    const areSmallInlineControls =
      maxDesktopItemW <= 200 && items.every((it) => (it.children?.length || 0) === 0);

    let cols = 1;
    if (isMobile) {
      // Keep 2 small hero buttons side-by-side if they comfortably fit; stack larger cards/columns
      if (areSmallInlineControls && k === 2 && innerAvailW >= 260) {
        cols = 2;
      } else if (areSmallInlineControls && k <= 3 && maxDesktopItemW <= 115) {
        cols = k;
      } else {
        cols = 1;
      }
    } else {
      // Tablet: keep all in one row if each column gets >= 195px (e.g. 3 feature cards in 720px),
      // otherwise wrap cleanly to 2 columns (e.g. 4 footer cols -> 2x2 grid)
      const allFitWidth = Math.floor((innerAvailW - layoutGap * (k - 1)) / k);
      if (allFitWidth >= 195 || (areSmallInlineControls && allFitWidth >= 90)) {
        cols = k;
      } else if (k >= 2 && Math.floor((innerAvailW - layoutGap) / 2) >= 130) {
        cols = 2;
      } else {
        cols = 1;
      }
    }

    // Check if the row items as a small centered group (like 2 CTA buttons) should stay centered
    const desktopRowSpan =
      Math.max(...items.map((it) => (Number(it.x) || 0) + (Number(it.width) || 0))) -
      Math.min(...items.map((it) => Number(it.x) || 0));
    const rowMidX =
      Math.min(...items.map((it) => Number(it.x) || 0)) + desktopRowSpan / 2;
    const rowWasCentered = Math.abs(rowMidX - baseW / 2) <= Math.max(48, baseW * 0.06);

    const colGap = isMobile ? 10 : 16;
    const uniformColW = Math.max(
      MIN_ELEMENT_SIZE,
      Math.floor((innerAvailW - colGap * (cols - 1)) / cols)
    );

    let rowCursorY = curY;
    for (let i = 0; i < items.length; i += cols) {
      const slice = items.slice(i, i + cols);
      let rowMaxH = 0;

      // For small centered controls that don't fill the whole row, keep natural compact widths centered
      let startX = padX;
      let useCompactWidths = false;
      if (areSmallInlineControls && cols === slice.length) {
        const sumDesired = slice.reduce((acc, it) => acc + Math.min(Number(it.width) || 120, uniformColW), 0);
        const totalNeeded = sumDesired + colGap * Math.max(0, slice.length - 1);
        if (totalNeeded <= innerAvailW && rowWasCentered) {
          useCompactWidths = true;
          startX = Math.round((assignedWidth - totalNeeded) / 2);
        }
      }

      let cursorX = startX;
      const pendingLine = [];
      for (let cIdx = 0; cIdx < slice.length; cIdx++) {
        const item = slice[cIdx];
        const cellW = useCompactWidths
          ? Math.min(Number(item.width) || 120, uniformColW)
          : (slice.length === 1 ? innerAvailW : uniformColW);
        const cellX = useCompactWidths ? cursorX : Math.round(padX + cIdx * (uniformColW + colGap));
        cursorX += cellW + colGap;

        const adaptedChild = adaptSubtreeAtWidth(item, cellW, targetViewport, patchMap);
        rowMaxH = Math.max(rowMaxH, adaptedChild.height);
        pendingLine.push({ item, cellX, cellW: adaptedChild.width, adaptedChild });
      }

      // If side-by-side cards sit in the same visual row and originally had equal height, equalize cleanly
      const allEqualOrigH =
        slice.length > 1 &&
        slice.every((it) => Math.abs((Number(it.height) || 0) - (Number(slice[0].height) || 0)) <= 8);

      for (const entry of pendingLine) {
        const finalH = allEqualOrigH ? rowMaxH : entry.adaptedChild.height;
        const targetState = {
          ...entry.item,
          x: entry.cellX,
          y: rowCursorY,
          width: entry.cellW,
          height: finalH,
          style: entry.adaptedChild.style,
        };
        patchMap.set(entry.item.id, {
          ov: buildOverrideFromResolvedDiff(entry.item, targetState, {}),
          adaptedWidth: entry.cellW,
          adaptedHeight: finalH,
        });
      }

      rowCursorY += rowMaxH + (i + cols < items.length ? layoutGap : 0);
    }

    curY = rowCursorY;
    prevDesktopRowBottom = row.bottom;
  }

  const bottomPad = minChildY > 0 ? Math.min(isMobile ? 20 : 32, Math.max(14, padTop)) : 12;
  const computedH = Math.max(
    MIN_ELEMENT_SIZE,
    Math.round(Math.max(curY + bottomPad, (Number(rawNode.height) || 80) * (isMobile ? 0.5 : 0.75)))
  );

  // Expand children inside patchMap if equalized height changed their parent size wasn't needed
  return {
    width: assignedWidth,
    height: computedH,
    style: adaptedStyle,
  };
}

/**
 * Computes auto-adapted Tablet (`768px`) or Mobile (`375px`) overrides from Desktop (`baseWidth`).
 * - When `forceReset === false`: ONLY populates `node.responsive[targetViewport]` for nodes that do
 *   not yet have overrides for `targetViewport`, preserving all existing user customizations.
 * - When `forceReset === true`: cleanly recomputes `node.responsive[targetViewport]` for every node.
 * Returns `{ tree, changed, suggestedHeight }`.
 */
export function ensureViewportAdapted(rawTree, targetViewport, options = {}) {
  if (!Array.isArray(rawTree) || targetViewport === 'desktop') {
    return { tree: rawTree, changed: false, suggestedHeight: VIEWPORT_PRESETS.desktop.defaultHeight };
  }

  const {
    forceReset = false,
    desktopWidth = VIEWPORT_PRESETS.desktop.width,
  } = options;
  const preset = getViewportPreset(targetViewport);
  const targetWidth = options.targetWidth || preset.width;
  const isMobile = targetViewport === 'mobile';
  const outerMargin = isMobile ? 12 : 24;
  const innerCanvasW = Math.max(120, targetWidth - outerMargin * 2);

  // Run full responsive root layout computation from Desktop AST
  const patchMap = new Map();
  const rootRows = groupChildrenIntoVisualRows(rawTree);
  let curRootY = 0;
  let prevDesktopRowBottom = 0;

  for (let rIdx = 0; rIdx < rootRows.length; rIdx++) {
    const row = rootRows[rIdx];
    const items = row.items;

    if (rIdx === 0) {
      curRootY = row.top <= 4 ? 0 : (isMobile ? 12 : 18);
    } else {
      const gap = Math.max(12, row.top - prevDesktopRowBottom);
      curRootY += isMobile ? Math.min(20, Math.round(gap * 0.65)) : Math.min(28, Math.round(gap * 0.85));
    }

    if (items.length === 1) {
      const item = items[0];
      const baseW = Number(item.width) || 120;
      const isFullBleed = (Number(item.x) || 0) <= 6 && baseW >= desktopWidth - 12;
      const targetW = isFullBleed
        ? targetWidth
        : baseW >= desktopWidth * 0.62
        ? innerCanvasW
        : Math.min(innerCanvasW, Math.max(MIN_ELEMENT_SIZE, baseW));
      const targetX = isFullBleed
        ? 0
        : baseW >= desktopWidth * 0.62
        ? outerMargin
        : Math.max(outerMargin, Math.min(targetWidth - outerMargin - targetW, Math.round((Number(item.x) || 0) * (targetWidth / desktopWidth))));

      const adapted = adaptSubtreeAtWidth(item, targetW, targetViewport, patchMap);
      const targetState = {
        ...item,
        x: targetX,
        y: curRootY,
        width: adapted.width,
        height: adapted.height,
        style: adapted.style,
      };
      patchMap.set(item.id, {
        ov: buildOverrideFromResolvedDiff(item, targetState, {}),
        adaptedWidth: adapted.width,
        adaptedHeight: adapted.height,
      });
      curRootY += adapted.height;
      prevDesktopRowBottom = row.bottom;
      continue;
    }

    // Multiple root siblings on same Desktop row
    const cols = isMobile ? 1 : (items.length <= 2 ? items.length : 2);
    const colGap = isMobile ? 12 : 18;
    const colW = Math.max(MIN_ELEMENT_SIZE, Math.floor((innerCanvasW - colGap * (cols - 1)) / cols));

    let rowY = curRootY;
    for (let i = 0; i < items.length; i += cols) {
      const slice = items.slice(i, i + cols);
      let rowMaxH = 0;
      for (let cIdx = 0; cIdx < slice.length; cIdx++) {
        const item = slice[cIdx];
        const cellW = slice.length === 1 ? innerCanvasW : colW;
        const cellX = Math.round(outerMargin + cIdx * (colW + colGap));
        const adapted = adaptSubtreeAtWidth(item, cellW, targetViewport, patchMap);
        rowMaxH = Math.max(rowMaxH, adapted.height);
        const targetState = {
          ...item,
          x: cellX,
          y: rowY,
          width: adapted.width,
          height: adapted.height,
          style: adapted.style,
        };
        patchMap.set(item.id, {
          ov: buildOverrideFromResolvedDiff(item, targetState, {}),
          adaptedWidth: adapted.width,
          adaptedHeight: adapted.height,
        });
      }
      rowY += rowMaxH + (i + cols < items.length ? colGap : 0);
    }

    curRootY = rowY;
    prevDesktopRowBottom = row.bottom;
  }

  let changed = false;
  const applyPatches = (nodes) =>
    nodes.map((node) => {
      const existingOv = node.responsive?.[targetViewport];
      const patchEntry = patchMap.get(node.id);
      let nextResponsive = node.responsive ? { ...node.responsive } : undefined;

      if (patchEntry && (forceReset || !existingOv)) {
        changed = true;
        nextResponsive = nextResponsive || {};
        nextResponsive[targetViewport] = patchEntry.ov;
      }

      const nextChildren = Array.isArray(node.children) ? applyPatches(node.children) : undefined;
      if (!changed && nextChildren === node.children && nextResponsive === node.responsive) {
        return node;
      }

      const updated = { ...node };
      if (nextResponsive) updated.responsive = nextResponsive;
      if (nextChildren) updated.children = nextChildren;
      return updated;
    });

  const nextTree = applyPatches(rawTree);

  // Calculate actual resolved height after applying/keeping overrides
  const resolvedNodes = resolveTreeForViewport(nextTree, targetViewport);
  const maxBottom = resolvedNodes.reduce((maxB, el) => {
    if (el.isHidden) return maxB;
    return Math.max(maxB, (Number(el.y) || 0) + (Number(el.height) || 0));
  }, 0);
  const suggestedHeight = Math.max(
    isMobile ? 700 : 900,
    maxBottom > 0 ? maxBottom + 48 : preset.defaultHeight
  );

  return { tree: nextTree, changed, suggestedHeight };
}

/**
 * Wraps sibling nodes inside a wrapper tag (`<a>`, `<button>`, etc.) while preserving
 * Desktop, Tablet, and Mobile responsive geometry independently.
 */
export function wrapNodesForViewport(rawTree, selectedIds, wrapperTag = 'a', options = {}) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return { newTree: rawTree, wrapperId: null };
  }

  const vpLayouts = {};
  const padX = options.withBox ? 16 : 0;
  const padY = options.withBox ? 10 : 0;

  for (const vp of ['tablet', 'mobile']) {
    const resolvedTree = resolveTreeForViewport(rawTree, vp);
    const vpNodes = selectedIds
      .map((id) => findNodeAndParent(resolvedTree, id)?.node)
      .filter(Boolean);
    const anyOverride = selectedIds.some((id) => {
      const rawFound = findNodeAndParent(rawTree, id)?.node;
      return Boolean(rawFound?.responsive?.[vp]);
    });
    if (!anyOverride || vpNodes.length === 0) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    vpNodes.forEach((n) => {
      const nx = Number(n.x) || 0;
      const ny = Number(n.y) || 0;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, nx + (Number(n.width) || 40));
      maxY = Math.max(maxY, ny + (Number(n.height) || 24));
    });

    const wrapX = Math.round(minX - padX);
    const wrapY = Math.round(minY - padY);
    const wrapW = Math.max(24, Math.round(maxX - minX + padX * 2));
    const wrapH = Math.max(24, Math.round(maxY - minY + padY * 2));

    const childRelById = {};
    vpNodes.forEach((n) => {
      childRelById[n.id] = {
        x: Math.round((Number(n.x) || 0) - wrapX),
        y: Math.round((Number(n.y) || 0) - wrapY),
      };
    });

    vpLayouts[vp] = {
      wrapperRect: { x: wrapX, y: wrapY, width: wrapW, height: wrapH },
      childRelById,
    };
  }

  const { newTree, wrapperId } = wrapNodesWithTag(rawTree, selectedIds, wrapperTag, options);
  if (!wrapperId) return { newTree: rawTree, wrapperId: null };

  let finalTree = newTree;
  for (const [vp, layout] of Object.entries(vpLayouts)) {
    finalTree = applyNodeUpdateForViewport(finalTree, wrapperId, layout.wrapperRect, vp);
    for (const [cid, coords] of Object.entries(layout.childRelById)) {
      finalTree = applyNodeUpdateForViewport(finalTree, cid, coords, vp);
    }
  }
  return { newTree: finalTree, wrapperId };
}

/**
 * Unwraps a wrapper node while keeping children anchored cleanly in Desktop, Tablet, and Mobile.
 */
export function unwrapNodeForViewport(rawTree, wrapperId) {
  const rawFound = findNodeAndParent(rawTree, wrapperId);
  if (!rawFound || !rawFound.node) return { newTree: rawTree, restoredIds: [] };

  const wrapperNode = rawFound.node;
  const vpChildCoords = {};

  if (Array.isArray(wrapperNode.children) && wrapperNode.children.length > 0) {
    for (const vp of ['tablet', 'mobile']) {
      const vpTree = resolveTreeForViewport(rawTree, vp);
      const vpWrapper = findNodeAndParent(vpTree, wrapperId)?.node;
      if (!vpWrapper) continue;
      const wrapperHasVp = Boolean(wrapperNode.responsive?.[vp]);
      wrapperNode.children.forEach((rawChild) => {
        const childHasVp = Boolean(rawChild.responsive?.[vp]);
        if (!wrapperHasVp && !childHasVp) return;
        const vpChild = vpWrapper.children?.find((c) => c.id === rawChild.id);
        if (!vpChild) return;
        vpChildCoords[vp] = vpChildCoords[vp] || {};
        vpChildCoords[vp][rawChild.id] = {
          x: Math.round((Number(vpChild.x) || 0) + (Number(vpWrapper.x) || 0)),
          y: Math.round((Number(vpChild.y) || 0) + (Number(vpWrapper.y) || 0)),
        };
      });
    }
  }

  const { newTree, restoredIds } = unwrapWrapperNode(rawTree, wrapperId);
  let finalTree = newTree;
  for (const [vp, childMap] of Object.entries(vpChildCoords)) {
    for (const [cid, coords] of Object.entries(childMap)) {
      finalTree = applyNodeUpdateForViewport(finalTree, cid, coords, vp);
    }
  }
  return { newTree: finalTree, restoredIds };
}

