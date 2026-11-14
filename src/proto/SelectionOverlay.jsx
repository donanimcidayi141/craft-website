import React, { useEffect, useRef, useState } from 'react';

/**
 * Ana belgede iframe'in hemen üzerinde (`position: absolute`) konumlanan
 * hover, seçim ve flow bırakma göstergesi katmanı.
 * - Konumu iframe içi `el.getBoundingClientRect()` + iframe ofseti üzerinden hesaplar.
 * - Koordinatları gerçek zoom ölçeğine göre normalize eder.
 * - Ekleme çizgisi / hedef çerçevesi yalnızca burada çizilir; iframe DOM'una ve CSS'ine ASLA girmez.
 */

function queryNodeElement(doc, nodeId) {
  if (!doc || !nodeId) return null;
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(String(nodeId))
      : String(nodeId).replace(/"/g, '\\"');
  return doc.querySelector(`[data-node-id="${escaped}"]`);
}

function getScaleAndOffset(iframeEl, overlayEl, fallbackZoom) {
  const overlayRect = overlayEl.getBoundingClientRect();
  const iframeRect = iframeEl.getBoundingClientRect();
  const actualScale =
    iframeEl.offsetWidth > 0 ? iframeRect.width / iframeEl.offsetWidth : fallbackZoom || 1;
  return {
    actualScale,
    offsetX: iframeRect.left - overlayRect.left,
    offsetY: iframeRect.top - overlayRect.top,
  };
}

function normalizeRect(rawRect, metrics) {
  if (!rawRect) return null;
  return {
    left: metrics.offsetX + rawRect.left * metrics.actualScale,
    top: metrics.offsetY + rawRect.top * metrics.actualScale,
    width: rawRect.width * metrics.actualScale,
    height: rawRect.height * metrics.actualScale,
  };
}

function measureNodeRect(el, metrics) {
  if (!el) return null;
  const elRect = el.getBoundingClientRect();
  if (elRect.width <= 0 && elRect.height <= 0) return null;
  return normalizeRect(elRect, metrics);
}

function boxesEqual(a, b) {
  return (
    a?.left === b?.left &&
    a?.top === b?.top &&
    a?.width === b?.width &&
    a?.height === b?.height
  );
}

export function SelectionOverlay({
  iframeRef,
  selectedId,
  hoveredId,
  editingId = null,
  dropIndicator = null,
  viewport,
  zoom = 1,
  tree,
  readyTick = 0,
  overlayTick = 0,
}) {
  const overlayRef = useRef(null);
  const [boxes, setBoxes] = useState({
    selected: null,
    hovered: null,
    dropLine: null,
    dropContainer: null,
  });

  useEffect(() => {
    const iframeEl = iframeRef?.current;
    const overlayEl = overlayRef.current;
    const doc = iframeEl?.contentDocument;
    const win = iframeEl?.contentWindow;

    if (!iframeEl || !overlayEl || !doc) {
      setBoxes({ selected: null, hovered: null, dropLine: null, dropContainer: null });
      return undefined;
    }

    let rafId = null;

    const computeAndCommit = () => {
      const activeIframe = iframeRef?.current;
      const activeOverlay = overlayRef.current;
      const activeDoc = activeIframe?.contentDocument;
      if (!activeIframe || !activeOverlay || !activeDoc) return;

      const metrics = getScaleAndOffset(activeIframe, activeOverlay, zoom);
      const selectedEl = selectedId ? queryNodeElement(activeDoc, selectedId) : null;
      const hoveredEl =
        !dropIndicator && !editingId && hoveredId && hoveredId !== selectedId
          ? queryNodeElement(activeDoc, hoveredId)
          : null;

      const nextSelected = measureNodeRect(selectedEl, metrics);
      const nextHovered = measureNodeRect(hoveredEl, metrics);
      const nextDropLine = dropIndicator
        ? {
            ...normalizeRect(dropIndicator, metrics),
            orientation: dropIndicator.orientation,
          }
        : null;
      const nextDropContainer = dropIndicator?.parentRect
        ? normalizeRect(dropIndicator.parentRect, metrics)
        : null;

      setBoxes((prev) => {
        if (
          boxesEqual(prev.selected, nextSelected) &&
          boxesEqual(prev.hovered, nextHovered) &&
          boxesEqual(prev.dropLine, nextDropLine) &&
          prev.dropLine?.orientation === nextDropLine?.orientation &&
          boxesEqual(prev.dropContainer, nextDropContainer)
        ) {
          return prev;
        }
        return {
          selected: nextSelected,
          hovered: nextHovered,
          dropLine: nextDropLine,
          dropContainer: nextDropContainer,
        };
      });
    };

    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeAndCommit();
      });
    };

    computeAndCommit();
    scheduleMeasure();

    doc.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true });
    win?.addEventListener('scroll', scheduleMeasure, { passive: true });
    win?.addEventListener('resize', scheduleMeasure);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true });

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleMeasure);
      ro.observe(overlayEl);
      ro.observe(iframeEl);

      const mountRoot = doc.getElementById('proto-mount-root');
      if (mountRoot) ro.observe(mountRoot);

      const selectedEl = selectedId ? queryNodeElement(doc, selectedId) : null;
      const hoveredEl =
        hoveredId && hoveredId !== selectedId ? queryNodeElement(doc, hoveredId) : null;
      if (selectedEl) ro.observe(selectedEl);
      if (hoveredEl) ro.observe(hoveredEl);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      doc.removeEventListener('scroll', scheduleMeasure, { capture: true });
      win?.removeEventListener('scroll', scheduleMeasure);
      win?.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, { capture: true });
      ro?.disconnect();
    };
  }, [
    iframeRef,
    selectedId,
    hoveredId,
    editingId,
    dropIndicator,
    viewport,
    zoom,
    tree,
    readyTick,
    overlayTick,
  ]);

  const isEditingSelected = Boolean(editingId && editingId === selectedId);

  return (
    <div
      ref={overlayRef}
      data-proto-selection-overlay="true"
      className="pointer-events-none absolute inset-0 overflow-hidden z-20"
    >
      {/* Flow bırakma hedef kabı vurgusu */}
      {boxes.dropContainer && (
        <div
          data-proto-drop-target="true"
          style={{
            position: 'absolute',
            left: `${boxes.dropContainer.left}px`,
            top: `${boxes.dropContainer.top}px`,
            width: `${boxes.dropContainer.width}px`,
            height: `${boxes.dropContainer.height}px`,
            border: '1.5px dashed rgba(16, 185, 129, 0.78)',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Flow bırakma ekleme çizgisi */}
      {boxes.dropLine && (
        <div
          data-proto-drop-indicator="true"
          data-orientation={boxes.dropLine.orientation}
          style={{
            position: 'absolute',
            left:
              boxes.dropLine.orientation === 'vertical'
                ? `${boxes.dropLine.left - 1.5}px`
                : `${boxes.dropLine.left}px`,
            top:
              boxes.dropLine.orientation === 'horizontal'
                ? `${boxes.dropLine.top - 1.5}px`
                : `${boxes.dropLine.top}px`,
            width:
              boxes.dropLine.orientation === 'vertical'
                ? '3px'
                : `${Math.max(16, boxes.dropLine.width)}px`,
            height:
              boxes.dropLine.orientation === 'horizontal'
                ? '3px'
                : `${Math.max(16, boxes.dropLine.height)}px`,
            backgroundColor: '#10b981',
            borderRadius: '999px',
            boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 10px rgba(16, 185, 129, 0.55)',
          }}
        />
      )}

      {/* Hover vurgusu */}
      {boxes.hovered && (
        <div
          data-proto-hover-box="true"
          style={{
            position: 'absolute',
            left: `${boxes.hovered.left}px`,
            top: `${boxes.hovered.top}px`,
            width: `${boxes.hovered.width}px`,
            height: `${boxes.hovered.height}px`,
            border: '1.5px dashed rgba(56, 189, 248, 0.92)',
            backgroundColor: 'rgba(56, 189, 248, 0.06)',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: boxes.hovered.top < 22 ? 4 : -20,
              fontSize: '10px',
              lineHeight: '16px',
              padding: '0 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(14, 165, 233, 0.92)',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {hoveredId}
          </span>
        </div>
      )}

      {/* Seçim çerçevesi */}
      {boxes.selected && (
        <div
          data-proto-selected-box="true"
          style={{
            position: 'absolute',
            left: `${boxes.selected.left}px`,
            top: `${boxes.selected.top}px`,
            width: `${boxes.selected.width}px`,
            height: `${boxes.selected.height}px`,
            border: isEditingSelected ? '2px solid #8b5cf6' : '2px solid #0ea5e9',
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.75)',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: boxes.selected.top < 24 ? 4 : -22,
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: '18px',
              padding: '0 7px',
              borderRadius: '4px',
              backgroundColor: isEditingSelected ? '#7c3aed' : '#0284c7',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
            }}
          >
            #{selectedId}
            {isEditingSelected ? ' · düzenleniyor' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export default SelectionOverlay;
