import { findNodeAndParent, flattenTree, getAbsoluteCoords } from './treeUtils.js';

export const MIN_ELEMENT_SIZE = 20;
export const MIN_MULTI_SIZE = 40;

/**
 * Returns a Set containing all `ids` plus all of their nested descendants.
 */
export function getDescendantIds(elements, ids = []) {
  const result = new Set(ids);
  ids.forEach((id) => {
    const found = findNodeAndParent(elements, id);
    if (found?.node?.children?.length) {
      flattenTree(found.node.children).forEach((child) => result.add(child.id));
    }
  });
  return result;
}

/**
 * Collects X and Y snap lines (page boundaries, page centers, parent bounds,
 * and visible non-excluded element edges/centers) plus visible element bounding boxes.
 */
export function collectSnapTargets(elements = [], canvasSettings = {}, excludeIdsSet = new Set(), parentAbs = null) {
  const canvasW = Number(canvasSettings.width) || 1280;
  const canvasH = Number(canvasSettings.height) || 1350;
  const midW = Math.round(canvasW / 2);
  const midH = Math.round(canvasH / 2);

  const xCandidates = [
    { val: 0, minY: 0, maxY: canvasH, source: 'page-edge', label: 'Sayfa Sol Sınırı' },
    { val: midW, minY: 0, maxY: canvasH, source: 'page-center', label: 'Sayfa Merkez' },
    { val: canvasW, minY: 0, maxY: canvasH, source: 'page-edge', label: 'Sayfa Sağ Sınırı' },
  ];

  const yCandidates = [
    { val: 0, minX: 0, maxX: canvasW, source: 'page-edge', label: 'Sayfa Üst Sınırı' },
    { val: midH, minX: 0, maxX: canvasW, source: 'page-center', label: 'Sayfa Merkez' },
    { val: canvasH, minX: 0, maxX: canvasW, source: 'page-edge', label: 'Sayfa Alt Sınırı' },
  ];

  if (parentAbs && parentAbs.width > 0 && parentAbs.height > 0) {
    const pLeft = Math.round(parentAbs.x);
    const pRight = Math.round(parentAbs.x + parentAbs.width);
    const pCenterX = Math.round(parentAbs.x + parentAbs.width / 2);
    const pTop = Math.round(parentAbs.y);
    const pBottom = Math.round(parentAbs.y + parentAbs.height);
    const pCenterY = Math.round(parentAbs.y + parentAbs.height / 2);

    xCandidates.push(
      { val: pLeft, minY: pTop, maxY: pBottom, source: 'parent-edge', label: 'Kapsayıcı Sol' },
      { val: pCenterX, minY: pTop, maxY: pBottom, source: 'parent-center', label: 'Kapsayıcı Merkez' },
      { val: pRight, minY: pTop, maxY: pBottom, source: 'parent-edge', label: 'Kapsayıcı Sağ' }
    );
    yCandidates.push(
      { val: pTop, minX: pLeft, maxX: pRight, source: 'parent-edge', label: 'Kapsayıcı Üst' },
      { val: pCenterY, minX: pLeft, maxX: pRight, source: 'parent-center', label: 'Kapsayıcı Merkez' },
      { val: pBottom, minX: pLeft, maxX: pRight, source: 'parent-edge', label: 'Kapsayıcı Alt' }
    );
  }

  const elementBoxes = [];
  const flatList = flattenTree(elements);

  flatList.forEach((cand) => {
    if (excludeIdsSet.has(cand.id) || cand.isHidden) return;
    const abs = getAbsoluteCoords(elements, cand.id);
    if (!abs || (abs.width === 0 && abs.height === 0)) return;

    const cLeft = abs.x;
    const cRight = abs.x + abs.width;
    const cCenterX = abs.x + abs.width / 2;
    const cTop = abs.y;
    const cBottom = abs.y + abs.height;
    const cCenterY = abs.y + abs.height / 2;

    elementBoxes.push({
      id: cand.id,
      left: cLeft,
      right: cRight,
      centerX: cCenterX,
      top: cTop,
      bottom: cBottom,
      centerY: cCenterY,
      width: abs.width,
      height: abs.height,
    });

    xCandidates.push(
      { val: cLeft, minY: cTop, maxY: cBottom, source: 'element', edge: 'left', box: abs },
      { val: Math.round(cCenterX), minY: cTop, maxY: cBottom, source: 'element', edge: 'center', box: abs },
      { val: cRight, minY: cTop, maxY: cBottom, source: 'element', edge: 'right', box: abs }
    );
    yCandidates.push(
      { val: cTop, minX: cLeft, maxX: cRight, source: 'element', edge: 'top', box: abs },
      { val: Math.round(cCenterY), minX: cLeft, maxX: cRight, source: 'element', edge: 'center', box: abs },
      { val: cBottom, minX: cLeft, maxX: cRight, source: 'element', edge: 'bottom', box: abs }
    );
  });

  return { xCandidates, yCandidates, elementBoxes, canvasW, canvasH };
}

/**
 * Finds existing horizontal and vertical spacing intervals between visible elements
 * for Figma/Adobe-style equal-gap snapping.
 */
function findEqualGapSnap(snappedBox, elementBoxes, axis, threshold) {
  if (!elementBoxes || elementBoxes.length < 2) return null;

  if (axis === 'x') {
    const rowNeighbors = elementBoxes
      .filter((b) => Math.min(b.bottom, snappedBox.bottom) - Math.max(b.top, snappedBox.top) > 10)
      .sort((a, b) => a.left - b.left);

    // Measure existing positive horizontal gaps between adjacent row neighbors
    const existingGaps = [];
    for (let i = 0; i < rowNeighbors.length - 1; i++) {
      const a = rowNeighbors[i];
      const b = rowNeighbors[i + 1];
      const gap = Math.round(b.left - a.right);
      if (gap >= 4 && gap <= 240) {
        existingGaps.push({ a, b, gap });
      }
    }
    if (existingGaps.length === 0) return null;

    let best = null;
    let bestDiff = threshold;

    for (const ref of existingGaps) {
      // Case 1: Dragged box placed to the right of `ref.b` with matching gap
      const targetLeftRight = ref.b.right + ref.gap;
      const diffR = Math.abs(snappedBox.left - targetLeftRight);
      if (diffR < bestDiff) {
        bestDiff = diffR;
        best = {
          snapDelta: targetLeftRight - snappedBox.left,
          gap: ref.gap,
          guides: [
            {
              type: 'gap-h',
              x1: ref.a.right,
              x2: ref.b.left,
              y: (Math.max(ref.a.top, ref.b.top) + Math.min(ref.a.bottom, ref.b.bottom)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
            {
              type: 'gap-h',
              x1: ref.b.right,
              x2: targetLeftRight,
              y: (Math.max(ref.b.top, snappedBox.top) + Math.min(ref.b.bottom, snappedBox.bottom)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
          ],
        };
      }

      // Case 2: Dragged box placed to the left of `ref.a` with matching gap
      const targetRightLeft = ref.a.left - ref.gap;
      const diffL = Math.abs(snappedBox.right - targetRightLeft);
      if (diffL < bestDiff) {
        bestDiff = diffL;
        best = {
          snapDelta: targetRightLeft - snappedBox.right,
          gap: ref.gap,
          guides: [
            {
              type: 'gap-h',
              x1: targetRightLeft,
              x2: ref.a.left,
              y: (Math.max(ref.a.top, snappedBox.top) + Math.min(ref.a.bottom, snappedBox.bottom)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
            {
              type: 'gap-h',
              x1: ref.a.right,
              x2: ref.b.left,
              y: (Math.max(ref.a.top, ref.b.top) + Math.min(ref.a.bottom, ref.b.bottom)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
          ],
        };
      }
    }
    return best;
  } else {
    const colNeighbors = elementBoxes
      .filter((b) => Math.min(b.right, snappedBox.right) - Math.max(b.left, snappedBox.left) > 10)
      .sort((a, b) => a.top - b.top);

    const existingGaps = [];
    for (let i = 0; i < colNeighbors.length - 1; i++) {
      const a = colNeighbors[i];
      const b = colNeighbors[i + 1];
      const gap = Math.round(b.top - a.bottom);
      if (gap >= 4 && gap <= 240) {
        existingGaps.push({ a, b, gap });
      }
    }
    if (existingGaps.length === 0) return null;

    let best = null;
    let bestDiff = threshold;

    for (const ref of existingGaps) {
      const targetTopBelow = ref.b.bottom + ref.gap;
      const diffB = Math.abs(snappedBox.top - targetTopBelow);
      if (diffB < bestDiff) {
        bestDiff = diffB;
        best = {
          snapDelta: targetTopBelow - snappedBox.top,
          gap: ref.gap,
          guides: [
            {
              type: 'gap-v',
              y1: ref.a.bottom,
              y2: ref.b.top,
              x: (Math.max(ref.a.left, ref.b.left) + Math.min(ref.a.right, ref.b.right)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
            {
              type: 'gap-v',
              y1: ref.b.bottom,
              y2: targetTopBelow,
              x: (Math.max(ref.b.left, snappedBox.left) + Math.min(ref.b.right, snappedBox.right)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
          ],
        };
      }

      const targetBottomAbove = ref.a.top - ref.gap;
      const diffT = Math.abs(snappedBox.bottom - targetBottomAbove);
      if (diffT < bestDiff) {
        bestDiff = diffT;
        best = {
          snapDelta: targetBottomAbove - snappedBox.bottom,
          gap: ref.gap,
          guides: [
            {
              type: 'gap-v',
              y1: targetBottomAbove,
              y2: ref.a.top,
              x: (Math.max(ref.a.left, snappedBox.left) + Math.min(ref.a.right, snappedBox.right)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
            {
              type: 'gap-v',
              y1: ref.a.bottom,
              y2: ref.b.top,
              x: (Math.max(ref.a.left, ref.b.left) + Math.min(ref.a.right, ref.b.right)) / 2,
              gap: ref.gap,
              isEqualGap: true,
            },
          ],
        };
      }
    }
    return best;
  }
}

/**
 * Computes snapping adjustments and guide lines while DRAGGING elements.
 */
export function computeDragSnap(dragBox, elements, canvasSettings, excludeIdsSet, threshold = 7, parentAbs = null) {
  const { xCandidates, yCandidates, elementBoxes, canvasW, canvasH } = collectSnapTargets(
    elements,
    canvasSettings,
    excludeIdsSet,
    parentAbs
  );

  let snapDeltaX = 0;
  let snapDeltaY = 0;
  const guides = [];

  // 1. X-axis Edge / Center snap
  let bestSnapX = null;
  let minDiffX = threshold;

  for (const cand of xCandidates) {
    const checks = [
      { diff: Math.abs(dragBox.left - cand.val), delta: cand.val - dragBox.left, dragEdge: 'left' },
      { diff: Math.abs(dragBox.centerX - cand.val), delta: cand.val - dragBox.centerX, dragEdge: 'center' },
      { diff: Math.abs(dragBox.right - cand.val), delta: cand.val - dragBox.right, dragEdge: 'right' },
    ];

    for (const c of checks) {
      if (c.diff < minDiffX || (c.diff === minDiffX && cand.source === 'page-edge' && bestSnapX?.source !== 'page-edge')) {
        minDiffX = c.diff;
        let label = cand.label;
        if (!label) {
          if (c.dragEdge === 'center' && cand.edge === 'center') label = 'Yatay Merkez';
          else if ((c.dragEdge === 'left' && cand.edge === 'right') || (c.dragEdge === 'right' && cand.edge === 'left')) label = 'Kenar Teması (0px)';
          else label = c.dragEdge === 'left' ? 'Sol Hiza' : c.dragEdge === 'right' ? 'Sağ Hiza' : 'Merkez Hiza';
        }
        bestSnapX = {
          snapDelta: c.delta,
          lineX: cand.val,
          minY: Math.min(cand.minY, dragBox.top),
          maxY: Math.max(cand.maxY, dragBox.bottom),
          label,
          source: cand.source,
        };
      }
    }
  }

  let equalGapH = null;
  if (bestSnapX) {
    snapDeltaX = bestSnapX.snapDelta;
  } else {
    equalGapH = findEqualGapSnap(dragBox, elementBoxes, 'x', threshold);
    if (equalGapH) {
      snapDeltaX = equalGapH.snapDelta;
    }
  }

  // 2. Y-axis Edge / Center snap
  let bestSnapY = null;
  let minDiffY = threshold;

  for (const cand of yCandidates) {
    const checks = [
      { diff: Math.abs(dragBox.top - cand.val), delta: cand.val - dragBox.top, dragEdge: 'top' },
      { diff: Math.abs(dragBox.centerY - cand.val), delta: cand.val - dragBox.centerY, dragEdge: 'center' },
      { diff: Math.abs(dragBox.bottom - cand.val), delta: cand.val - dragBox.bottom, dragEdge: 'bottom' },
    ];

    for (const c of checks) {
      if (c.diff < minDiffY || (c.diff === minDiffY && cand.source === 'page-edge' && bestSnapY?.source !== 'page-edge')) {
        minDiffY = c.diff;
        let label = cand.label;
        let isSideBySide = false;
        if (!label) {
          if (c.dragEdge === 'center' && cand.edge === 'center') {
            label = '🟢 Merkez Hiza';
            isSideBySide = true;
          } else if ((c.dragEdge === 'top' && cand.edge === 'bottom') || (c.dragEdge === 'bottom' && cand.edge === 'top')) {
            label = 'Kenar Teması (0px)';
          } else {
            label = c.dragEdge === 'top' ? '🟢 Üst Hiza' : '🟢 Alt Hiza';
            isSideBySide = true;
          }
        }
        bestSnapY = {
          snapDelta: c.delta,
          lineY: cand.val,
          minX: Math.min(cand.minX, dragBox.left),
          maxX: Math.max(cand.maxX, dragBox.right),
          label,
          source: cand.source,
          isSideBySide,
        };
      }
    }
  }

  let equalGapV = null;
  if (bestSnapY) {
    snapDeltaY = bestSnapY.snapDelta;
  } else {
    equalGapV = findEqualGapSnap(dragBox, elementBoxes, 'y', threshold);
    if (equalGapV) {
      snapDeltaY = equalGapV.snapDelta;
    }
  }

  // Compute final snapped box for accurate guide positions
  const snappedBox = {
    left: dragBox.left + snapDeltaX,
    right: dragBox.right + snapDeltaX,
    centerX: dragBox.centerX + snapDeltaX,
    top: dragBox.top + snapDeltaY,
    bottom: dragBox.bottom + snapDeltaY,
    centerY: dragBox.centerY + snapDeltaY,
    width: dragBox.width,
    height: dragBox.height,
  };

  if (bestSnapX) {
    guides.push({
      type: 'vertical',
      x: bestSnapX.lineX,
      minY: bestSnapX.source === 'page-edge' || bestSnapX.source === 'page-center' ? 0 : Math.max(0, Math.min(bestSnapX.minY, snappedBox.top) - 16),
      maxY: bestSnapX.source === 'page-edge' || bestSnapX.source === 'page-center' ? canvasH : Math.min(canvasH, Math.max(bestSnapX.maxY, snappedBox.bottom) + 16),
      snapY: snappedBox.centerY,
      label: bestSnapX.label,
      isPageEdge: bestSnapX.source === 'page-edge' || bestSnapX.source === 'parent-edge',
    });
  } else if (equalGapH) {
    guides.push(...equalGapH.guides);
  }

  if (bestSnapY) {
    guides.push({
      type: 'horizontal',
      y: bestSnapY.lineY,
      minX: bestSnapY.source === 'page-edge' || bestSnapY.source === 'page-center' ? 0 : Math.max(0, Math.min(bestSnapY.minX, snappedBox.left) - 16),
      maxX: bestSnapY.source === 'page-edge' || bestSnapY.source === 'page-center' ? canvasW : Math.min(canvasW, Math.max(bestSnapY.maxX, snappedBox.right) + 16),
      snapX: snappedBox.centerX,
      label: bestSnapY.label,
      isSideBySide: bestSnapY.isSideBySide,
      isPageEdge: bestSnapY.source === 'page-edge' || bestSnapY.source === 'parent-edge',
    });
  } else if (equalGapV) {
    guides.push(...equalGapV.guides);
  }

  // 3. Nearest Neighbor Distance Badges (Horizontal & Vertical)
  if (!equalGapH) {
    let nearestLeft = null;
    let nearestRight = null;
    elementBoxes.forEach((b) => {
      const overlapY = Math.min(b.bottom, snappedBox.bottom) - Math.max(b.top, snappedBox.top);
      if (overlapY > 10) {
        if (snappedBox.left >= b.right && snappedBox.left - b.right <= 240) {
          const dist = snappedBox.left - b.right;
          if (!nearestLeft || dist < nearestLeft.dist) nearestLeft = { b, dist };
        } else if (b.left >= snappedBox.right && b.left - snappedBox.right <= 240) {
          const dist = b.left - snappedBox.right;
          if (!nearestRight || dist < nearestRight.dist) nearestRight = { b, dist };
        }
      }
    });
    if (nearestLeft && nearestLeft.dist > 0) {
      const midY = (Math.max(nearestLeft.b.top, snappedBox.top) + Math.min(nearestLeft.b.bottom, snappedBox.bottom)) / 2;
      guides.push({ type: 'gap-h', x1: nearestLeft.b.right, x2: snappedBox.left, y: midY, gap: Math.round(nearestLeft.dist) });
    }
    if (nearestRight && nearestRight.dist > 0) {
      const midY = (Math.max(nearestRight.b.top, snappedBox.top) + Math.min(nearestRight.b.bottom, snappedBox.bottom)) / 2;
      guides.push({ type: 'gap-h', x1: snappedBox.right, x2: nearestRight.b.left, y: midY, gap: Math.round(nearestRight.dist) });
    }
  }

  if (!equalGapV) {
    let nearestAbove = null;
    let nearestBelow = null;
    elementBoxes.forEach((b) => {
      const overlapX = Math.min(b.right, snappedBox.right) - Math.max(b.left, snappedBox.left);
      if (overlapX > 10) {
        if (snappedBox.top >= b.bottom && snappedBox.top - b.bottom <= 240) {
          const dist = snappedBox.top - b.bottom;
          if (!nearestAbove || dist < nearestAbove.dist) nearestAbove = { b, dist };
        } else if (b.top >= snappedBox.bottom && b.top - snappedBox.bottom <= 240) {
          const dist = b.top - snappedBox.bottom;
          if (!nearestBelow || dist < nearestBelow.dist) nearestBelow = { b, dist };
        }
      }
    });
    if (nearestAbove && nearestAbove.dist > 0) {
      const midX = (Math.max(nearestAbove.b.left, snappedBox.left) + Math.min(nearestAbove.b.right, snappedBox.right)) / 2;
      guides.push({ type: 'gap-v', y1: nearestAbove.b.bottom, y2: snappedBox.top, x: midX, gap: Math.round(nearestAbove.dist) });
    }
    if (nearestBelow && nearestBelow.dist > 0) {
      const midX = (Math.max(nearestBelow.b.left, snappedBox.left) + Math.min(nearestBelow.b.right, snappedBox.right)) / 2;
      guides.push({ type: 'gap-v', y1: snappedBox.bottom, y2: nearestBelow.b.top, x: midX, gap: Math.round(nearestBelow.dist) });
    }
  }

  return { snapDeltaX, snapDeltaY, guides };
}

/**
 * Computes exact snapped dimensions and local coordinates while RESIZING
 * using anchored opposite edges so resizing never drifts, flips, or breaks nested offsets.
 */
export function computeResizeSnap({
  handle,
  startAbs,
  parentAbs = { x: 0, y: 0, width: 0, height: 0 },
  dx,
  dy,
  minSize = MIN_ELEMENT_SIZE,
  elements = [],
  canvasSettings = {},
  excludeIdsSet = new Set(),
  threshold = 7,
}) {
  const { xCandidates, yCandidates, canvasW, canvasH } = collectSnapTargets(
    elements,
    canvasSettings,
    excludeIdsSet,
    parentAbs?.width > 0 ? parentAbs : null
  );

  const fixedLeft = Math.round(startAbs.x);
  const fixedRight = Math.round(startAbs.x + startAbs.width);
  const fixedTop = Math.round(startAbs.y);
  const fixedBottom = Math.round(startAbs.y + startAbs.height);

  let finalLeft = fixedLeft;
  let finalRight = fixedRight;
  let finalTop = fixedTop;
  let finalBottom = fixedBottom;

  const guides = [];

  // Horizontal edge resize
  if (handle.includes('e')) {
    const rawRight = Math.max(fixedLeft + minSize, fixedRight + dx);
    let bestCand = null;
    let bestDiff = threshold;

    for (const cand of xCandidates) {
      if (cand.val < fixedLeft + minSize) continue;
      const diff = Math.abs(rawRight - cand.val);
      if (diff < bestDiff || (diff === bestDiff && cand.source === 'page-edge' && bestCand?.source !== 'page-edge')) {
        bestDiff = diff;
        bestCand = cand;
      }
    }

    if (bestCand) {
      finalRight = Math.max(fixedLeft + minSize, Math.round(bestCand.val));
      guides.push({
        type: 'vertical',
        x: finalRight,
        minY: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? 0 : Math.max(0, Math.min(bestCand.minY, fixedTop) - 16),
        maxY: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? canvasH : Math.min(canvasH, Math.max(bestCand.maxY, fixedBottom) + 16),
        snapY: (fixedTop + fixedBottom) / 2,
        label: bestCand.label || 'Sağ Kenar Hizası',
        isPageEdge: bestCand.source === 'page-edge' || bestCand.source === 'parent-edge',
      });
    } else {
      finalRight = Math.max(fixedLeft + minSize, Math.round(rawRight));
    }
  } else if (handle.includes('w')) {
    const rawLeft = Math.min(fixedRight - minSize, fixedLeft + dx);
    let bestCand = null;
    let bestDiff = threshold;

    for (const cand of xCandidates) {
      if (cand.val > fixedRight - minSize) continue;
      const diff = Math.abs(rawLeft - cand.val);
      if (diff < bestDiff || (diff === bestDiff && cand.source === 'page-edge' && bestCand?.source !== 'page-edge')) {
        bestDiff = diff;
        bestCand = cand;
      }
    }

    if (bestCand) {
      finalLeft = Math.min(fixedRight - minSize, Math.round(bestCand.val));
      guides.push({
        type: 'vertical',
        x: finalLeft,
        minY: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? 0 : Math.max(0, Math.min(bestCand.minY, fixedTop) - 16),
        maxY: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? canvasH : Math.min(canvasH, Math.max(bestCand.maxY, fixedBottom) + 16),
        snapY: (fixedTop + fixedBottom) / 2,
        label: bestCand.label || 'Sol Kenar Hizası',
        isPageEdge: bestCand.source === 'page-edge' || bestCand.source === 'parent-edge',
      });
    } else {
      finalLeft = Math.min(fixedRight - minSize, Math.round(rawLeft));
    }
  }

  // Vertical edge resize
  if (handle.includes('s')) {
    const rawBottom = Math.max(fixedTop + minSize, fixedBottom + dy);
    let bestCand = null;
    let bestDiff = threshold;

    for (const cand of yCandidates) {
      if (cand.val < fixedTop + minSize) continue;
      const diff = Math.abs(rawBottom - cand.val);
      if (diff < bestDiff || (diff === bestDiff && cand.source === 'page-edge' && bestCand?.source !== 'page-edge')) {
        bestDiff = diff;
        bestCand = cand;
      }
    }

    if (bestCand) {
      finalBottom = Math.max(fixedTop + minSize, Math.round(bestCand.val));
      guides.push({
        type: 'horizontal',
        y: finalBottom,
        minX: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? 0 : Math.max(0, Math.min(bestCand.minX, finalLeft) - 16),
        maxX: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? canvasW : Math.min(canvasW, Math.max(bestCand.maxX, finalRight) + 16),
        snapX: (finalLeft + finalRight) / 2,
        label: bestCand.label || 'Alt Kenar Hizası',
        isPageEdge: bestCand.source === 'page-edge' || bestCand.source === 'parent-edge',
      });
    } else {
      finalBottom = Math.max(fixedTop + minSize, Math.round(rawBottom));
    }
  } else if (handle.includes('n')) {
    const rawTop = Math.min(fixedBottom - minSize, fixedTop + dy);
    let bestCand = null;
    let bestDiff = threshold;

    for (const cand of yCandidates) {
      if (cand.val > fixedBottom - minSize) continue;
      const diff = Math.abs(rawTop - cand.val);
      if (diff < bestDiff || (diff === bestDiff && cand.source === 'page-edge' && bestCand?.source !== 'page-edge')) {
        bestDiff = diff;
        bestCand = cand;
      }
    }

    if (bestCand) {
      finalTop = Math.min(fixedBottom - minSize, Math.round(bestCand.val));
      guides.push({
        type: 'horizontal',
        y: finalTop,
        minX: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? 0 : Math.max(0, Math.min(bestCand.minX, finalLeft) - 16),
        maxX: bestCand.source === 'page-edge' || bestCand.source === 'page-center' ? canvasW : Math.min(canvasW, Math.max(bestCand.maxX, finalRight) + 16),
        snapX: (finalLeft + finalRight) / 2,
        label: bestCand.label || 'Üst Kenar Hizası',
        isPageEdge: bestCand.source === 'page-edge' || bestCand.source === 'parent-edge',
      });
    } else {
      finalTop = Math.min(fixedBottom - minSize, Math.round(rawTop));
    }
  }

  // Update guide cross-axis spans with final coordinates
  guides.forEach((g) => {
    if (g.type === 'vertical' && !g.isPageEdge) {
      g.minY = Math.max(0, Math.min(g.minY, finalTop));
      g.maxY = Math.min(canvasH, Math.max(g.maxY, finalBottom));
      g.snapY = (finalTop + finalBottom) / 2;
    } else if (g.type === 'horizontal' && !g.isPageEdge) {
      g.minX = Math.max(0, Math.min(g.minX, finalLeft));
      g.maxX = Math.min(canvasW, Math.max(g.maxX, finalRight));
      g.snapX = (finalLeft + finalRight) / 2;
    }
  });

  const width = Math.max(minSize, finalRight - finalLeft);
  const height = Math.max(minSize, finalBottom - finalTop);
  const parentX = Math.round(parentAbs?.x || 0);
  const parentY = Math.round(parentAbs?.y || 0);

  return {
    absLeft: finalLeft,
    absTop: finalTop,
    absRight: finalRight,
    absBottom: finalBottom,
    localX: finalLeft - parentX,
    localY: finalTop - parentY,
    width,
    height,
    guides,
  };
}
