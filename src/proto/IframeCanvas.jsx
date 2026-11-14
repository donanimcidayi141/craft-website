import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compileStyles } from './compileStyles.js';
import { findNode } from './treeOps.js';
import { renderTree } from './renderTree';
import { useDragDrop } from './useDragDrop';

/**
 * İzole iframe tuvali (srcdoc + React Portal):
 * - Viewport genişliğini (sm: 375, md: 768, lg: 1280) doğrudan iframe'e uygular.
 * - Zoom ölçeğini (0.5–1) dış sarmalayıcıya `transform: scale()` ile uygular.
 * - Editör davranışlarını (hover, flow/layer sürükleme, çift tık satır içi metin düzenleme,
 *   kısayol köprüsü) yalnızca native iframe dinleyicileri ve `EDITOR_ONLY_CSS` üzerinden ekler.
 * - Ağaç veya stil değişince yalnızca <style> ve React portalı güncellenir; iframe yeniden yüklenmez.
 */

export const VIEWPORT_WIDTHS = {
  sm: 375,
  md: 768,
  lg: 1280,
};

// Sabit ilk srcdoc: prop/state değişimlerinde iframe'in yeniden yüklenmesini önler
const INITIAL_IFRAME_SRCDOC = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style data-proto-styles="true"></style>
    <style data-proto-editor-styles="true"></style>
  </head>
  <body>
    <div id="proto-mount-root"></div>
  </body>
</html>`;

// Tüm editör-only stiller tek sabit altında toplanır (compileStyles çıktısına asla karışmaz)
export const EDITOR_ONLY_CSS = `
html, body {
  user-select: none;
  -webkit-user-select: none;
}
img {
  -webkit-user-drag: none;
}
a:not([data-node-id]) {
  pointer-events: none;
}
a[data-node-id], button[data-node-id] {
  cursor: default !important;
}
[contenteditable], [contenteditable] * {
  user-select: text !important;
  -webkit-user-select: text !important;
  cursor: text !important;
  outline: none !important;
}
`;

function buildDynamicEditorCss(mode, dragStyle) {
  if (mode !== 'edit') return '';
  if (!dragStyle?.id) return EDITOR_ONLY_CSS;

  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(dragStyle.id)
      : dragStyle.id;

  if (dragStyle.kind === 'flow') {
    return `${EDITOR_ONLY_CSS}
html, body, body * {
  cursor: grabbing !important;
}
.n-${escaped} {
  opacity: 0.42 !important;
  pointer-events: none !important;
}`;
  }

  return `${EDITOR_ONLY_CSS}
html, body, body * {
  cursor: grabbing !important;
}`;
}

function insertPlainTextAtCaret(doc, win, text) {
  const sel = win.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const textNode = doc.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function IframeCanvas({
  tree,
  theme = null,
  selectedId = null,
  viewport = 'lg',
  zoom = 1,
  editingId = null,
  aiBusy = false,
  mode = 'edit',
  frameHeight = 680,
  iframeRef: externalIframeRef = null,
  onSelectNode = null,
  onHoverNode = null,
  onMoveNode = null,
  onUpdateNode = null,
  onSetEditingId = null,
  onDropIndicatorChange = null,
  onIframeKeyDown = null,
  onOverlaySync = null,
  onLoadCountChange = null,
  onReadyChange = null,
}) {
  const internalIframeRef = useRef(null);
  const loadCountRef = useRef(0);
  const lastHoveredIdRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragStyle, setDragStyle] = useState(null);
  const [mountNode, setMountNode] = useState(null);

  const latestPropsRef = useRef({
    tree,
    editingId,
    aiBusy,
    onSelectNode,
    onHoverNode,
    onUpdateNode,
    onSetEditingId,
    onIframeKeyDown,
    onOverlaySync,
    onLoadCountChange,
    onReadyChange,
  });

  useEffect(() => {
    latestPropsRef.current = {
      tree,
      editingId,
      aiBusy,
      onSelectNode,
      onHoverNode,
      onUpdateNode,
      onSetEditingId,
      onIframeKeyDown,
      onOverlaySync,
      onLoadCountChange,
      onReadyChange,
    };
  }, [
    tree,
    editingId,
    aiBusy,
    onSelectNode,
    onHoverNode,
    onUpdateNode,
    onSetEditingId,
    onIframeKeyDown,
    onOverlaySync,
    onLoadCountChange,
    onReadyChange,
  ]);

  const setCombinedIframeRef = (el) => {
    internalIframeRef.current = el;
    if (externalIframeRef) {
      if (typeof externalIframeRef === 'function') {
        externalIframeRef(el);
      } else {
        externalIframeRef.current = el;
      }
    }
  };

  const viewportWidth = VIEWPORT_WIDTHS[viewport] || VIEWPORT_WIDTHS.lg;
  const clampedZoom = Math.min(1, Math.max(0.5, Number(zoom) || 1));

  // Saf CSS ve saf React çıktıları (`tree`, `theme` ve `mode` değişmediğinde referans korunur, caret bozulmaz)
  const compiledCss = useMemo(() => compileStyles(tree, { theme }), [tree, theme]);
  const renderedChildren = useMemo(() => renderTree(tree, { mode }), [tree, mode]);
  const editorCssText = useMemo(() => buildDynamicEditorCss(mode, dragStyle), [mode, dragStyle]);

  const syncIframeDocument = (iframeEl) => {
    const doc = iframeEl?.contentDocument;
    if (!doc) return null;

    let styleEl = doc.querySelector('style[data-proto-styles]');
    if (!styleEl && doc.head) {
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-proto-styles', 'true');
      doc.head.appendChild(styleEl);
    }
    if (styleEl && styleEl.textContent !== compiledCss) {
      styleEl.textContent = compiledCss;
    }

    let editorStyleEl = doc.querySelector('style[data-proto-editor-styles]');
    if (!editorStyleEl && doc.head) {
      editorStyleEl = doc.createElement('style');
      editorStyleEl.setAttribute('data-proto-editor-styles', 'true');
      doc.head.appendChild(editorStyleEl);
    }
    if (editorStyleEl && editorStyleEl.textContent !== editorCssText) {
      editorStyleEl.textContent = editorCssText;
    }

    let rootEl = doc.getElementById('proto-mount-root');
    if (!rootEl && doc.body) {
      rootEl = doc.createElement('div');
      rootEl.id = 'proto-mount-root';
      doc.body.appendChild(rootEl);
    }
    return rootEl;
  };

  const handleIframeLoad = () => {
    const iframeEl = internalIframeRef.current;
    if (!iframeEl) return;

    loadCountRef.current += 1;
    const nextCount = loadCountRef.current;
    console.info(`[CraftProto/IframeCanvas] iframe yüklendi. Yükleme sayacı: ${nextCount}`);

    const rootEl = syncIframeDocument(iframeEl);
    setMountNode(rootEl);
    latestPropsRef.current.onLoadCountChange?.(nextCount);
    latestPropsRef.current.onReadyChange?.((prev) => prev + 1);
  };

  useEffect(() => {
    const iframeEl = internalIframeRef.current;
    if (!iframeEl) return;
    const doc = iframeEl.contentDocument;
    if (!doc) return;

    if (!mountNode && doc.readyState === 'complete') {
      const rootEl = doc.getElementById('proto-mount-root');
      if (rootEl) {
        syncIframeDocument(iframeEl);
        setMountNode(rootEl);
        latestPropsRef.current.onReadyChange?.((prev) => prev + 1);
        return;
      }
    }

    if (mountNode) {
      syncIframeDocument(iframeEl);
      latestPropsRef.current.onReadyChange?.((prev) => prev + 1);
    }
  }, [compiledCss, editorCssText, mode, mountNode]);

  // Sayfa sekmesi değiştiğinde editör kaydırma konumunu sıfırla (iframe yeniden yüklemeden)
  const treeRootId = tree?.id;
  useEffect(() => {
    const win = internalIframeRef.current?.contentWindow;
    if (win && typeof win.scrollTo === 'function') {
      win.scrollTo(0, 0);
    }
  }, [treeRootId]);

  // Adım 2 & 3: Flow sürükle-bırak ve % konumlu layer taşıma
  const handleSetEditorDragStyle = useMemo(
    () => (id, kind) => {
      const next = id ? { id, kind } : null;
      const doc = internalIframeRef.current?.contentDocument;
      const editorStyleEl = doc?.querySelector('style[data-proto-editor-styles]');
      if (editorStyleEl) {
        editorStyleEl.textContent = buildDynamicEditorCss(mode, next);
      }
      setDragStyle(next);
    },
    [mode]
  );

  useDragDrop({
    iframeRef: internalIframeRef,
    mountNode,
    tree,
    selectedId,
    viewport,
    editingId,
    aiBusy,
    suppressClickRef,
    mode,
    onSelectNode,
    onMoveNode,
    onUpdateNode,
    onSetEditorDragStyle: handleSetEditorDragStyle,
    onDropIndicatorChange,
    onOverlaySync,
  });

  // Hover, link koruması, satır içi metin düzenleme (Adım 4) ve klavye kısayol köprüsü
  useEffect(() => {
    const iframeEl = internalIframeRef.current;
    const doc = iframeEl?.contentDocument;
    const win = iframeEl?.contentWindow;
    if (!doc || !win || !mountNode || mode !== 'edit') return undefined;

    let activeEdit = null;

    const findNearestNodeId = (rawTarget) => {
      if (!rawTarget || typeof rawTarget.closest !== 'function') return null;
      const nodeEl = rawTarget.closest('[data-node-id]');
      return nodeEl ? nodeEl.getAttribute('data-node-id') : null;
    };

    const normalizeEditedText = (el, nodeType, originalText) => {
      let text = el.innerText ?? el.textContent ?? '';
      text = text.replace(/\r\n/g, '\n');
      if (nodeType === 'button') {
        text = text.replace(/\n+/g, ' ').trim();
      } else if (text.endsWith('\n') && !originalText.endsWith('\n')) {
        text = text.slice(0, -1);
      }
      return text;
    };

    const stopInlineEdit = (shouldCommit) => {
      if (!activeEdit || activeEdit.closed) return;
      activeEdit.closed = true;

      const cur = activeEdit;
      activeEdit = null;

      cur.el.removeEventListener('keydown', cur.onKeyDown, true);
      cur.el.removeEventListener('blur', cur.onBlur);
      cur.el.removeEventListener('paste', cur.onPaste);
      cur.el.removeEventListener('input', cur.onInput);

      const nextText = shouldCommit
        ? normalizeEditedText(cur.el, cur.nodeType, cur.originalText)
        : cur.originalText;

      cur.el.removeAttribute('contenteditable');
      // React fiber DOM yapısını korumak için çıkarken tekil metin düğümünü temizle
      cur.el.textContent = cur.originalText;

      latestPropsRef.current.onSetEditingId?.(null);

      if (shouldCommit && nextText !== cur.originalText) {
        latestPropsRef.current.onUpdateNode?.(cur.nodeId, {
          props: { [cur.propKey]: nextText },
        });
      }
      latestPropsRef.current.onOverlaySync?.();
    };

    const startInlineEdit = (el, node) => {
      if (activeEdit && activeEdit.nodeId === node.id) return;
      if (activeEdit) stopInlineEdit(true);

      const propKey =
        node.type === 'button' && node.props?.label !== undefined ? 'label' : 'text';
      const originalText = String(node.props?.[propKey] ?? el.textContent ?? '');

      el.setAttribute('contenteditable', 'plaintext-only');
      const supportsPlaintext = el.contentEditable === 'plaintext-only';
      if (!supportsPlaintext) {
        el.setAttribute('contenteditable', 'true');
      }

      const onPaste = (e) => {
        if (supportsPlaintext) return;
        e.preventDefault();
        const plain = e.clipboardData?.getData('text/plain') || '';
        insertPlainTextAtCaret(doc, win, plain);
        latestPropsRef.current.onOverlaySync?.();
      };

      const onInput = () => {
        latestPropsRef.current.onOverlaySync?.();
      };

      const onBlur = () => {
        stopInlineEdit(true);
      };

      const onKeyDown = (e) => {
        // Düzenleme sırasında Delete/Backspace ve diğer kısayolların dışarı sızmasını engelle
        e.stopPropagation();

        if (e.key === 'Escape') {
          e.preventDefault();
          stopInlineEdit(false);
          return;
        }

        if (e.key === 'Enter') {
          if (node.type === 'text' && e.shiftKey) {
            if (!supportsPlaintext) {
              e.preventDefault();
              insertPlainTextAtCaret(doc, win, '\n');
              latestPropsRef.current.onOverlaySync?.();
            }
            return;
          }
          e.preventDefault();
          stopInlineEdit(true);
        }
      };

      activeEdit = {
        nodeId: node.id,
        nodeType: node.type,
        propKey,
        originalText,
        el,
        closed: false,
        onKeyDown,
        onBlur,
        onPaste,
        onInput,
      };

      el.addEventListener('keydown', onKeyDown, true);
      el.addEventListener('blur', onBlur);
      el.addEventListener('paste', onPaste);
      el.addEventListener('input', onInput);

      latestPropsRef.current.onSelectNode?.(node.id);
      latestPropsRef.current.onSetEditingId?.(node.id);

      el.focus();
      try {
        const range = doc.createRange();
        range.selectNodeContents(el);
        const sel = win.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {}
    };

    const handlePointerMove = (e) => {
      if (latestPropsRef.current.editingId) return;
      const id = findNearestNodeId(e.target);
      if (lastHoveredIdRef.current !== id) {
        lastHoveredIdRef.current = id;
        latestPropsRef.current.onHoverNode?.(id);
      }
    };

    const handlePointerLeave = () => {
      if (lastHoveredIdRef.current !== null) {
        lastHoveredIdRef.current = null;
        latestPropsRef.current.onHoverNode?.(null);
      }
    };

    const handleClick = (e) => {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('a, button')) {
        e.preventDefault();
      }
      // Aktif sürükleme veya Esc ile iptal edilen sürükleme sonrası sentetik click'i yoksay
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      // Düzenleme dışarı tıklanarak kapandıysa tıklanan yeni öğeyi doğrudan seç
      if (!activeEdit && !latestPropsRef.current.editingId) {
        const id = findNearestNodeId(e.target);
        if (id) latestPropsRef.current.onSelectNode?.(id);
      }
    };

    const handleDoubleClick = (e) => {
      if (latestPropsRef.current.aiBusy) return;
      const hitEl =
        e.target && typeof e.target.closest === 'function'
          ? e.target.closest('[data-node-id]')
          : null;
      const hitId = hitEl ? hitEl.getAttribute('data-node-id') : null;
      if (!hitId) return;

      const node = findNode(latestPropsRef.current.tree, hitId);
      if (!node || (node.type !== 'text' && node.type !== 'button')) return;

      e.preventDefault();
      e.stopPropagation();
      startInlineEdit(hitEl, node);
    };

    const handleDocKeyDown = (e) => {
      if (activeEdit || latestPropsRef.current.editingId || latestPropsRef.current.aiBusy) return;
      latestPropsRef.current.onIframeKeyDown?.(e);
    };

    doc.addEventListener('pointermove', handlePointerMove, { passive: true });
    doc.documentElement?.addEventListener('mouseleave', handlePointerLeave);
    doc.addEventListener('click', handleClick, true);
    doc.addEventListener('dblclick', handleDoubleClick, true);
    doc.addEventListener('keydown', handleDocKeyDown);

    return () => {
      if (activeEdit) stopInlineEdit(false);
      doc.removeEventListener('pointermove', handlePointerMove);
      doc.documentElement?.removeEventListener('mouseleave', handlePointerLeave);
      doc.removeEventListener('click', handleClick, true);
      doc.removeEventListener('dblclick', handleDoubleClick, true);
      doc.removeEventListener('keydown', handleDocKeyDown);
    };
  }, [mountNode, mode]);

  const scaledWidth = Math.round(viewportWidth * clampedZoom);
  const scaledHeight = Math.round(frameHeight * clampedZoom);

  return (
    <div
      data-proto-iframe-stage="true"
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Zoom yalnızca dış sarmalayıcıya uygulanır; iframe genişliği her zaman viewport genişliğindedir */}
      <div
        data-proto-zoom-wrapper="true"
        style={{
          width: `${viewportWidth}px`,
          height: `${frameHeight}px`,
          transform: `scale(${clampedZoom})`,
          transformOrigin: 'top left',
        }}
      >
        <iframe
          ref={setCombinedIframeRef}
          title="CraftStudio İzole Önizleme Tuvali"
          srcDoc={INITIAL_IFRAME_SRCDOC}
          onLoad={handleIframeLoad}
          style={{
            width: `${viewportWidth}px`,
            height: `${frameHeight}px`,
            border: 0,
            display: 'block',
            backgroundColor: '#ffffff',
          }}
        />
      </div>

      {mountNode ? createPortal(renderedChildren, mountNode) : null}
    </div>
  );
}

export default IframeCanvas;
