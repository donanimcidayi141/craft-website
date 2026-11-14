import { useEffect, useRef } from 'react';
import {
  canAcceptChild,
  findNode,
  findNodeAndLocation,
  findParent,
  getEffectiveLayoutMode,
  isDescendant,
} from './treeOps.js';

/**
 * Faz 2 sürükle-bırak kancası: Flow (akış içi taşıma/sıralama) + Layer (% konumlu serbest taşıma).
 * - iframe.contentDocument içindeki native pointer olaylarıyla çalışır ve pointerdown'da setPointerCapture alır.
 * - Hit-test ve rect ölçümlerini zoom'suz iframe CSS piksel uzayında yapar.
 * - Flow sürüklemede kardeş rect'lerini önbelleğe alır, rAF ile indeks hesaplar, scroll'da önbelleği sıfırlar.
 * - Layer sürüklemede yalnızca DOM inline left/top günceller, pointerup'ta TEK updateNode commit'i yapar.
 */

const DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_EDGE_PX = 36;
const AUTO_SCROLL_SPEED_PX = 9;

function findNearestNodeEl(target) {
  if (!target || typeof target.closest !== 'function') return null;
  return target.closest('[data-node-id]');
}

function clampPercent(val) {
  return Math.min(100, Math.max(0, val));
}

function mapFlowSlotToChildrenIndex(parentNode, draggedId, targetFlowSlot) {
  const remaining = (parentNode.children || []).filter((c) => c.id !== draggedId);
  let seenFlow = 0;
  for (let i = 0; i < remaining.length; i += 1) {
    if (seenFlow >= targetFlowSlot) {
      return i;
    }
    if (remaining[i]?.placement !== 'layer') {
      seenFlow += 1;
    }
  }
  return remaining.length;
}

export function useDragDrop({
  iframeRef,
  mountNode,
  tree,
  selectedId,
  viewport,
  editingId,
  aiBusy = false,
  suppressClickRef,
  mode = 'edit',
  onSelectNode,
  onMoveNode,
  onUpdateNode,
  onSetEditorDragStyle,
  onDropIndicatorChange,
  onOverlaySync,
}) {
  const latestRef = useRef({
    tree,
    selectedId,
    viewport,
    editingId,
    aiBusy,
    suppressClickRef,
    onSelectNode,
    onMoveNode,
    onUpdateNode,
    onSetEditorDragStyle,
    onDropIndicatorChange,
    onOverlaySync,
  });

  useEffect(() => {
    latestRef.current = {
      tree,
      selectedId,
      viewport,
      editingId,
      aiBusy,
      suppressClickRef,
      onSelectNode,
      onMoveNode,
      onUpdateNode,
      onSetEditorDragStyle,
      onDropIndicatorChange,
      onOverlaySync,
    };
  }, [
    tree,
    selectedId,
    viewport,
    editingId,
    aiBusy,
    suppressClickRef,
    onSelectNode,
    onMoveNode,
    onUpdateNode,
    onSetEditorDragStyle,
    onDropIndicatorChange,
    onOverlaySync,
  ]);

  useEffect(() => {
    const iframeEl = iframeRef?.current;
    const doc = iframeEl?.contentDocument;
    const win = iframeEl?.contentWindow;
    if (!doc || !win || !mountNode || mode !== 'edit') return undefined;

    let session = null;
    let siblingCache = new Map();
    let moveRafId = null;
    let pendingPoint = null;
    let autoScrollRafId = null;
    let autoScrollVelocity = 0;
    let suppressClearTimer = null;

    const clearSuppressTimer = () => {
      if (suppressClearTimer !== null) {
        clearTimeout(suppressClearTimer);
        suppressClearTimer = null;
      }
    };

    const scheduleClearSuppressClick = () => {
      clearSuppressTimer();
      suppressClearTimer = setTimeout(() => {
        suppressClearTimer = null;
        if (latestRef.current.suppressClickRef) {
          latestRef.current.suppressClickRef.current = false;
        }
      }, 50);
    };

    const invalidateCache = () => {
      siblingCache.clear();
    };

    const stopAutoScroll = () => {
      autoScrollVelocity = 0;
      if (autoScrollRafId !== null) {
        cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
      }
    };

    const runAutoScrollLoop = () => {
      if (!session?.active || autoScrollVelocity === 0) {
        autoScrollRafId = null;
        return;
      }
      win.scrollBy(0, autoScrollVelocity);
      invalidateCache();
      if (pendingPoint && session.dragType === 'flow') {
        updateFlowDropPreview(pendingPoint.clientX, pendingPoint.clientY);
      }
      autoScrollRafId = requestAnimationFrame(runAutoScrollLoop);
    };

    const syncAutoScrollForY = (clientY) => {
      if (!session?.active || session.dragType !== 'flow') {
        stopAutoScroll();
        return;
      }
      const viewH = doc.documentElement?.clientHeight || win.innerHeight || 0;
      const canScroll = (doc.documentElement?.scrollHeight || 0) > viewH + 2;
      if (!canScroll) {
        stopAutoScroll();
        return;
      }

      if (clientY < AUTO_SCROLL_EDGE_PX && win.scrollY > 0) {
        autoScrollVelocity = -AUTO_SCROLL_SPEED_PX;
      } else if (clientY > viewH - AUTO_SCROLL_EDGE_PX) {
        autoScrollVelocity = AUTO_SCROLL_SPEED_PX;
      } else {
        stopAutoScroll();
        return;
      }

      if (autoScrollRafId === null) {
        autoScrollRafId = requestAnimationFrame(runAutoScrollLoop);
      }
    };

    const cleanupVisuals = () => {
      stopAutoScroll();
      if (moveRafId !== null) {
        cancelAnimationFrame(moveRafId);
        moveRafId = null;
      }
      pendingPoint = null;
      invalidateCache();

      if (session?.captureEl && session?.pointerId !== undefined) {
        try {
          if (session.captureEl.hasPointerCapture?.(session.pointerId)) {
            session.captureEl.releasePointerCapture(session.pointerId);
          }
        } catch {}
      }

      latestRef.current.onSetEditorDragStyle?.(null, null);
      latestRef.current.onDropIndicatorChange?.(null);
    };

    const restoreLayerInlineStyle = () => {
      if (session?.dragType === 'layer' && session.dragEl) {
        session.dragEl.style.left = session.prevInlineLeft ?? '';
        session.dragEl.style.top = session.prevInlineTop ?? '';
        latestRef.current.onOverlaySync?.();
      }
    };

    const getCachedParentMetrics = (targetParentNode) => {
      const existing = siblingCache.get(targetParentNode.id);
      if (existing) return existing;

      const parentEl = doc.querySelector(`[data-node-id="${CSS.escape(targetParentNode.id)}"]`);
      if (!parentEl) return null;

      const parentRect = parentEl.getBoundingClientRect();
      const layoutMode = getEffectiveLayoutMode(targetParentNode, latestRef.current.viewport);
      const flowChildren = (targetParentNode.children || []).filter((c) => c.placement !== 'layer');
      const items = flowChildren
        .map((child, flowIndex) => {
          const childEl = doc.querySelector(`[data-node-id="${CSS.escape(child.id)}"]`);
          if (!childEl) return null;
          const r = childEl.getBoundingClientRect();
          return {
            id: child.id,
            flowIndex,
            rect: {
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            },
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2,
          };
        })
        .filter(Boolean);

      const metrics = {
        parentId: targetParentNode.id,
        layoutMode,
        parentRect: {
          left: parentRect.left,
          top: parentRect.top,
          right: parentRect.right,
          bottom: parentRect.bottom,
          width: parentRect.width,
          height: parentRect.height,
        },
        items,
      };
      siblingCache.set(targetParentNode.id, metrics);
      return metrics;
    };

    const resolveDropParentNode = (clientX, clientY, draggedNode, sourceParentId) => {
      const { tree: activeTree } = latestRef.current;
      const hit = doc.elementFromPoint(clientX, clientY);
      let cursorEl = findNearestNodeEl(hit);

      while (cursorEl) {
        const candidateId = cursorEl.getAttribute('data-node-id');
        const candidateNode = candidateId ? findNode(activeTree, candidateId) : null;

        if (
          candidateNode &&
          candidateNode.placement !== 'layer' &&
          candidateNode.id !== draggedNode.id &&
          !isDescendant(activeTree, draggedNode.id, candidateNode.id)
        ) {
          // Aynı ebeveyndeki kardeş container üzerine gelindiğinde içine hapsetmek yerine ebeveynde yeniden sırala
          const candidateParent = findParent(activeTree, candidateNode.id);
          const isSiblingContainer =
            candidateParent?.id === sourceParentId && candidateNode.type === 'container';

          if (!isSiblingContainer && canAcceptChild(candidateNode.type, draggedNode.type)) {
            return candidateNode;
          }
        }

        cursorEl = findNearestNodeEl(cursorEl.parentElement);
      }

      return null;
    };

    const computeInsertionForParent = (targetParentNode, clientX, clientY, draggedId, sourceParentId) => {
      const metrics = getCachedParentMetrics(targetParentNode);
      if (!metrics) return null;

      const { items, layoutMode, parentRect } = metrics;
      const sameParent = targetParentNode.id === sourceParentId;

      if (items.length === 0) {
        return {
          targetParentId: targetParentNode.id,
          targetIndex: mapFlowSlotToChildrenIndex(targetParentNode, draggedId, 0),
          indicator: {
            orientation: layoutMode === 'row' ? 'vertical' : 'horizontal',
            left: parentRect.left + 8,
            top: parentRect.top + Math.min(16, parentRect.height / 2),
            width: Math.max(24, parentRect.width - 16),
            height: Math.max(24, parentRect.height - 16),
            parentRect,
          },
        };
      }

      let visualSlot = items.length;
      let indicator = null;

      if (layoutMode === 'row') {
        for (let i = 0; i < items.length; i += 1) {
          if (clientX < items[i].cx) {
            visualSlot = i;
            break;
          }
        }
        const prev = visualSlot > 0 ? items[visualSlot - 1] : null;
        const next = visualSlot < items.length ? items[visualSlot] : null;
        const lineX =
          prev && next
            ? (prev.rect.right + next.rect.left) / 2
            : next
              ? next.rect.left - 3
              : prev.rect.right + 3;
        const top = (next || prev).rect.top;
        const height = (next || prev).rect.height;
        indicator = {
          orientation: 'vertical',
          left: lineX,
          top,
          width: 3,
          height: Math.max(20, height),
          parentRect,
        };
      } else if (layoutMode === 'grid') {
        // Grid satır-sütun okuma sırası: en yakın hücreyi seç
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < items.length; i += 1) {
          const dist = Math.hypot(clientX - items[i].cx, clientY - items[i].cy);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        const closest = items[closestIdx];
        const isSingleColumn =
          items.length === 1 || items.every((item) => Math.abs(item.cx - items[0].cx) < 8);

        if (isSingleColumn) {
          const after = clientY >= closest.cy;
          visualSlot = after ? closestIdx + 1 : closestIdx;
          const prev = visualSlot > 0 ? items[visualSlot - 1] : null;
          const next = visualSlot < items.length ? items[visualSlot] : null;
          const lineY =
            prev && next
              ? (prev.rect.bottom + next.rect.top) / 2
              : next
                ? next.rect.top - 4
                : prev.rect.bottom + 4;
          indicator = {
            orientation: 'horizontal',
            left: (next || prev).rect.left,
            top: lineY,
            width: Math.max(32, (next || prev).rect.width),
            height: 3,
            parentRect,
          };
        } else {
          const after = clientX >= closest.cx;
          visualSlot = after ? closestIdx + 1 : closestIdx;
          const lineX = after ? closest.rect.right + 4 : closest.rect.left - 4;
          indicator = {
            orientation: 'vertical',
            left: lineX,
            top: closest.rect.top,
            width: 3,
            height: Math.max(24, closest.rect.height),
            parentRect,
          };
        }
      } else {
        // stack düzeni: y orta noktalarına göre dikey ekleme
        for (let i = 0; i < items.length; i += 1) {
          if (clientY < items[i].cy) {
            visualSlot = i;
            break;
          }
        }
        const prev = visualSlot > 0 ? items[visualSlot - 1] : null;
        const next = visualSlot < items.length ? items[visualSlot] : null;
        const lineY =
          prev && next
            ? (prev.rect.bottom + next.rect.top) / 2
            : next
              ? next.rect.top - 4
              : prev.rect.bottom + 4;
        indicator = {
          orientation: 'horizontal',
          left: (next || prev).rect.left,
          top: lineY,
          width: Math.max(32, (next || prev).rect.width),
          height: 3,
          parentRect,
        };
      }

      const draggedFlowItem = items.find((item) => item.id === draggedId);
      const oldFlowIndex = draggedFlowItem ? draggedFlowItem.flowIndex : -1;
      const adjustedFlowSlot =
        sameParent && oldFlowIndex !== -1 && oldFlowIndex < visualSlot
          ? visualSlot - 1
          : visualSlot;
      const targetIndex = mapFlowSlotToChildrenIndex(targetParentNode, draggedId, adjustedFlowSlot);

      return {
        targetParentId: targetParentNode.id,
        targetIndex,
        indicator,
      };
    };

    const updateFlowDropPreview = (clientX, clientY) => {
      if (!session || !session.active || session.dragType !== 'flow') return;
      const { tree: activeTree } = latestRef.current;
      const draggedLoc = findNodeAndLocation(activeTree, session.dragId);
      if (!draggedLoc || !draggedLoc.parent) {
        session.dropTarget = null;
        latestRef.current.onDropIndicatorChange?.(null);
        return;
      }

      const targetParentNode = resolveDropParentNode(
        clientX,
        clientY,
        draggedLoc.node,
        draggedLoc.parent.id
      );
      if (!targetParentNode) {
        session.dropTarget = null;
        latestRef.current.onDropIndicatorChange?.(null);
        return;
      }

      const plan = computeInsertionForParent(
        targetParentNode,
        clientX,
        clientY,
        draggedLoc.node.id,
        draggedLoc.parent.id
      );
      session.dropTarget = plan;
      latestRef.current.onDropIndicatorChange?.(plan ? plan.indicator : null);
    };

    const updateLayerPreview = (clientX, clientY) => {
      if (!session || !session.active || session.dragType !== 'layer') return;
      const { tree: activeTree } = latestRef.current;
      const parentNode = findParent(activeTree, session.dragId);
      if (!parentNode || !session.dragEl) return;

      const sectionEl = doc.querySelector(`[data-node-id="${CSS.escape(parentNode.id)}"]`);
      if (!sectionEl) return;

      const secRect = sectionEl.getBoundingClientRect();
      if (secRect.width <= 0 || secRect.height <= 0) return;

      const dxPx = clientX - session.startX;
      const dyPx = clientY - session.startY;
      const nextX = Number(clampPercent(session.startPos.x + (dxPx / secRect.width) * 100).toFixed(2));
      const nextY = Number(clampPercent(session.startPos.y + (dyPx / secRect.height) * 100).toFixed(2));

      session.latestLayerPos = { x: nextX, y: nextY };
      session.dragEl.style.left = `${nextX}%`;
      session.dragEl.style.top = `${nextY}%`;
      latestRef.current.onOverlaySync?.();
    };

    const resolveInitialCandidate = (hitId) => {
      const { tree: activeTree, selectedId: curSelectedId } = latestRef.current;
      if (!hitId || hitId === activeTree.id) return null;

      // Seçili öğe bir container ise (grid hariç), içindeki yaprak öğeden sürüklerken container kartını taşı
      if (curSelectedId && curSelectedId !== activeTree.id && curSelectedId !== hitId) {
        const selectedNode = findNode(activeTree, curSelectedId);
        const hitNode = findNode(activeTree, hitId);
        if (
          selectedNode &&
          selectedNode.placement !== 'layer' &&
          selectedNode.type === 'container' &&
          selectedNode.layout?.mode !== 'grid' &&
          hitNode?.type !== 'container' &&
          isDescendant(activeTree, curSelectedId, hitId)
        ) {
          return selectedNode;
        }
      }
      return findNode(activeTree, hitId);
    };

    const handlePointerDown = (e) => {
      if (e.button !== 0 || latestRef.current.editingId || latestRef.current.aiBusy) return;

      clearSuppressTimer();
      if (latestRef.current.suppressClickRef) {
        latestRef.current.suppressClickRef.current = false;
      }

      const hitEl = findNearestNodeEl(e.target);
      const hitId = hitEl ? hitEl.getAttribute('data-node-id') : null;
      const candidateNode = resolveInitialCandidate(hitId);
      const captureEl = e.target && typeof e.target.setPointerCapture === 'function' ? e.target : hitEl;

      if (captureEl && typeof captureEl.setPointerCapture === 'function') {
        try {
          captureEl.setPointerCapture(e.pointerId);
        } catch {}
      }

      session = {
        pointerId: e.pointerId,
        captureEl,
        clickId: hitId,
        dragId: candidateNode ? candidateNode.id : null,
        dragType: candidateNode?.placement === 'layer' ? 'layer' : 'flow',
        dragEl: candidateNode
          ? doc.querySelector(`[data-node-id="${CSS.escape(candidateNode.id)}"]`)
          : null,
        startX: e.clientX,
        startY: e.clientY,
        startPos: {
          x: candidateNode?.pos?.x ?? 50,
          y: candidateNode?.pos?.y ?? 50,
        },
        prevInlineLeft: '',
        prevInlineTop: '',
        latestLayerPos: null,
        dropTarget: null,
        active: false,
      };
    };

    const handlePointerMove = (e) => {
      if (!session || e.pointerId !== session.pointerId) return;
      if (latestRef.current.editingId || !session.dragId) return;

      if (!session.active) {
        const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
        if (dist < DRAG_THRESHOLD_PX) return;

        session.active = true;
        clearSuppressTimer();
        if (latestRef.current.suppressClickRef) {
          latestRef.current.suppressClickRef.current = true;
        }
        latestRef.current.onSelectNode?.(session.dragId);

        if (session.dragType === 'layer' && session.dragEl) {
          session.prevInlineLeft = session.dragEl.style.left || '';
          session.prevInlineTop = session.dragEl.style.top || '';
          latestRef.current.onSetEditorDragStyle?.(session.dragId, 'layer');
        } else {
          invalidateCache();
          latestRef.current.onSetEditorDragStyle?.(session.dragId, 'flow');
        }
      }

      if (session.dragType === 'layer') {
        updateLayerPreview(e.clientX, e.clientY);
        return;
      }

      pendingPoint = { clientX: e.clientX, clientY: e.clientY };
      syncAutoScrollForY(e.clientY);
      if (moveRafId === null) {
        moveRafId = requestAnimationFrame(() => {
          moveRafId = null;
          if (pendingPoint && session?.active) {
            updateFlowDropPreview(pendingPoint.clientX, pendingPoint.clientY);
          }
        });
      }
    };

    const finishDrag = (e, cancelled = false) => {
      if (!session) return;
      if (e && e.pointerId !== undefined && e.pointerId !== session.pointerId) return;

      const cur = session;
      if (cur.active && e) {
        scheduleClearSuppressClick();
      }
      if (cancelled || !cur.active) {
        restoreLayerInlineStyle();
        cleanupVisuals();
        session = null;
        if (!cancelled && cur.clickId && !latestRef.current.editingId) {
          latestRef.current.onSelectNode?.(cur.clickId);
        }
        return;
      }

      if (cur.dragType === 'layer') {
        const finalPos = cur.latestLayerPos;
        restoreLayerInlineStyle();
        cleanupVisuals();
        session = null;
        if (
          finalPos &&
          (finalPos.x !== cur.startPos.x || finalPos.y !== cur.startPos.y)
        ) {
          latestRef.current.onUpdateNode?.(cur.dragId, { pos: finalPos });
        }
        return;
      }

      const drop = cur.dropTarget;
      cleanupVisuals();
      session = null;
      if (drop?.targetParentId !== undefined && drop?.targetParentId !== null) {
        latestRef.current.onMoveNode?.(cur.dragId, drop.targetParentId, drop.targetIndex);
      }
    };

    const handlePointerUp = (e) => {
      if (!session) {
        if (latestRef.current.suppressClickRef?.current) {
          scheduleClearSuppressClick();
        }
        return;
      }
      finishDrag(e, false);
    };
    const handlePointerCancel = (e) => {
      if (!session) {
        if (latestRef.current.suppressClickRef?.current) {
          scheduleClearSuppressClick();
        }
        return;
      }
      finishDrag(e, true);
    };

    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && session?.active) {
        e.preventDefault();
        e.stopPropagation();
        finishDrag(null, true);
      }
    };

    doc.addEventListener('pointerdown', handlePointerDown);
    doc.addEventListener('pointermove', handlePointerMove, { passive: true });
    doc.addEventListener('pointerup', handlePointerUp);
    doc.addEventListener('pointercancel', handlePointerCancel);
    doc.addEventListener('scroll', invalidateCache, { passive: true, capture: true });
    doc.addEventListener('keydown', handleEscapeKey, true);
    window.addEventListener('keydown', handleEscapeKey, true);

    return () => {
      clearSuppressTimer();
      restoreLayerInlineStyle();
      cleanupVisuals();
      session = null;
      doc.removeEventListener('pointerdown', handlePointerDown);
      doc.removeEventListener('pointermove', handlePointerMove);
      doc.removeEventListener('pointerup', handlePointerUp);
      doc.removeEventListener('pointercancel', handlePointerCancel);
      doc.removeEventListener('scroll', invalidateCache, { capture: true });
      doc.removeEventListener('keydown', handleEscapeKey, true);
      window.removeEventListener('keydown', handleEscapeKey, true);
    };
  }, [iframeRef, mountNode, mode]);
}

export default useDragDrop;
