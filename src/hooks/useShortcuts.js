import { useEffect, useRef } from 'react';
import { findNodeAndParent } from '../utils/treeUtils.js';
import { applyMultipleUpdatesForViewport } from '../utils/responsiveUtils.js';
import {
  shouldHandleGlobalCanvasShortcut,
  isInsideFloatingInspector,
  resolveSingleKeyToolShortcut,
  clampCanvasZoom,
} from '../utils/canvasInputUtils.js';

/**
 * Pure mode-aware keyboard shortcut dispatcher used by `useShortcuts` and unit tests.
 * Universal shortcuts (active in both 'design' and 'backend' modes):
 *   Ctrl+K, Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+Shift+O, Ctrl+E, Escape.
 * Design-only shortcuts (active ONLY when activeMode === 'design'):
 *   V/H/R/O/L/F/T/Z/I tool keys, Delete/Backspace, Ctrl+D, Ctrl+G, Ctrl+Shift+G,
 *   Ctrl+C/X/V, Ctrl+A, Ctrl+Shift+C/V, arrow keys, Shift+G, Shift+R,
 *   z-order ([ ] Ctrl+[ ]), Ctrl+Shift+L, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y,
 *   Ctrl+N, Ctrl+Shift+N, Enter, Ctrl+=/+/-/0.
 * In 'backend' mode, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y is a no-op and never touches design history.
 */
export function dispatchStudioShortcut(
  e,
  { activeMode: topLevelMode, state = {}, actions = {}, activeElement, isFloatingInspectorFocused } = {}
) {
  const {
    activeMode: stateMode,
    showWelcomeScreen = false,
    previewMode = false,
    activeTool = 'select',
    selectedIds = [],
    elements = [],
    rawElements = [],
    viewportMode = 'desktop',
    showExportModal = false,
    showTutorial = false,
    showAddTagModal = false,
    showImportReportModal = false,
    showAttributesInspectorModal = false,
    functionEditorState = null,
  } = state;

  const resolvedMode = topLevelMode || stateMode || 'design';
  const isDesignMode = resolvedMode === 'design';

  const {
    setAiDockMinimized,
    setAiFocusSignal,
    handleSaveProject,
    handleOpenProjectFolder,
    handleOpenProjectFile,
    setShowExportModal,
    handleSelectAll,
    handleCopyElementStyle,
    handleCopy,
    handleCut,
    handlePasteElementStyle,
    handlePaste,
    handleDuplicateSelected,
    handleToggleLockSelected,
    handleStartNewProject,
    handleAddTab,
    handleUngroupSelected,
    handleGroupSelected,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    updateElementsWithHistory,
    handleTogglePreviewMode,
    setActiveTool,
    handleSelectParent,
    handleSelectChild,
    setZoom,
    handleResetZoom,
    handleZOrderSelected,
    setShowLayoutGrid,
    setShowRulers,
  } = actions;

  // Note: showAttributesInspectorModal is a non-blocking floating palette, NOT a modal dialog.
  // Keeping it out of isAnyModalOpen allows canvas shortcuts (V/R/Delete/Ctrl+Z/Escape) to keep working while the floating inspector is open.
  const isAnyModalOpen = Boolean(
    showExportModal ||
    showTutorial ||
    showAddTagModal ||
    showImportReportModal ||
    functionEditorState?.isOpen
  );
  const isCtrl = Boolean(e.ctrlKey || e.metaKey);
  const keyLower = typeof e.key === 'string' ? e.key.toLowerCase() : '';

  // Universal: Ctrl+K -> Focus / Open Floating AI Chat Dock
  if (isCtrl && !e.shiftKey && keyLower === 'k') {
    if (!isAnyModalOpen && !showWelcomeScreen && !previewMode) {
      e.preventDefault?.();
      setAiDockMinimized?.(false);
      setAiFocusSignal?.((s) => s + 1);
      return 'ai_dock_focus';
    }
  }

  const resolvedActiveElement =
    activeElement !== undefined
      ? activeElement
      : typeof document !== 'undefined'
        ? document.activeElement
        : null;

  if (!shouldHandleGlobalCanvasShortcut({
    activeElement: resolvedActiveElement,
    eventTarget: e.target,
    isAnyModalOpen,
  })) {
    return null;
  }

  const floatingInspectorFocused =
    typeof isFloatingInspectorFocused === 'boolean'
      ? isFloatingInspectorFocused
      : isInsideFloatingInspector(resolvedActiveElement) || isInsideFloatingInspector(e.target);

  // Universal: Save Project (Ctrl+Shift+S -> Save As, Ctrl+S -> Save)
  if (isCtrl && e.shiftKey && keyLower === 's') {
    e.preventDefault?.();
    if (!showWelcomeScreen) handleSaveProject?.(true);
    return 'save_as';
  }
  if (isCtrl && !e.shiftKey && keyLower === 's') {
    e.preventDefault?.();
    if (!showWelcomeScreen) handleSaveProject?.(false);
    return 'save';
  }

  // Universal: Open Project (Ctrl+Shift+O -> Open Folder, Ctrl+O -> Open .craft.json File)
  if (isCtrl && e.shiftKey && keyLower === 'o') {
    e.preventDefault?.();
    handleOpenProjectFolder?.();
    return 'open_folder';
  }
  if (isCtrl && !e.shiftKey && keyLower === 'o') {
    e.preventDefault?.();
    handleOpenProjectFile?.();
    return 'open_file';
  }

  // Universal: Ctrl+E -> Export React Modal
  if (isCtrl && keyLower === 'e') {
    e.preventDefault?.();
    if (!showWelcomeScreen) setShowExportModal?.(true);
    return 'export_modal';
  }

  if (showWelcomeScreen) return null;

  // Universal: Escape -> Close previewMode, reset activeTool to 'select', or (in design mode) step out to parent
  if (e.key === 'Escape') {
    if (isAnyModalOpen) {
      return null;
    }
    if (previewMode) {
      handleTogglePreviewMode?.(false);
      return 'escape_preview';
    }
    if (activeTool !== 'select') {
      setActiveTool?.('select');
      return 'escape_tool';
    }
    if (isDesignMode) {
      handleSelectParent?.();
      return 'escape_parent';
    }
    return 'escape_noop';
  }

  // All remaining shortcuts below are strictly design-mode only
  if (!isDesignMode) {
    if (isCtrl && (keyLower === 'z' || keyLower === 'y')) {
      e.preventDefault?.();
    }
    return null;
  }

  // 1. Ctrl+A -> Select All
  if (isCtrl && keyLower === 'a') {
    e.preventDefault?.();
    handleSelectAll?.();
    return 'select_all';
  }

  // 2. Ctrl+Shift+C -> Copy Style, Ctrl+C -> Copy
  if (isCtrl && e.shiftKey && keyLower === 'c') {
    e.preventDefault?.();
    handleCopyElementStyle?.({ activateTool: false });
    return 'copy_style';
  }
  if (isCtrl && !e.shiftKey && keyLower === 'c') {
    e.preventDefault?.();
    handleCopy?.();
    return 'copy';
  }

  // 3. Ctrl+X -> Cut (blocked when focus is inside floating inspector DOM)
  if (isCtrl && keyLower === 'x') {
    if (floatingInspectorFocused) return null;
    e.preventDefault?.();
    handleCut?.();
    return 'cut';
  }

  // 4. Ctrl+Shift+V -> Paste Style, Ctrl+V -> Paste
  if (isCtrl && e.shiftKey && keyLower === 'v') {
    e.preventDefault?.();
    handlePasteElementStyle?.();
    return 'paste_style';
  }
  if (isCtrl && !e.shiftKey && keyLower === 'v') {
    e.preventDefault?.();
    handlePaste?.();
    return 'paste';
  }

  // Ctrl+D -> Duplicate Selected (blocked when focus is inside floating inspector DOM)
  if (isCtrl && !e.shiftKey && keyLower === 'd') {
    if (floatingInspectorFocused) return null;
    e.preventDefault?.();
    handleDuplicateSelected?.();
    return 'duplicate';
  }

  // Ctrl+Shift+L -> Toggle Lock Selected
  if (isCtrl && e.shiftKey && keyLower === 'l') {
    e.preventDefault?.();
    handleToggleLockSelected?.();
    return 'toggle_lock';
  }

  // Ctrl+Shift+N -> Yeni Boş Proje (Temiz Tuval)
  if (isCtrl && e.shiftKey && keyLower === 'n') {
    e.preventDefault?.();
    handleStartNewProject?.('blank');
    return 'new_blank_project';
  }

  // Ctrl+N -> Yeni Sayfa Sekmesi
  if (isCtrl && !e.shiftKey && keyLower === 'n') {
    e.preventDefault?.();
    handleAddTab?.();
    return 'add_tab';
  }

  // 5. Ctrl+Shift+G -> Ungroup
  if (isCtrl && e.shiftKey && keyLower === 'g') {
    e.preventDefault?.();
    handleUngroupSelected?.();
    return 'ungroup';
  }

  // 6. Ctrl+G -> Group
  if (isCtrl && !e.shiftKey && keyLower === 'g') {
    e.preventDefault?.();
    handleGroupSelected?.();
    return 'group';
  }

  // 7. Undo / Redo
  if (isCtrl && keyLower === 'z') {
    e.preventDefault?.();
    if (e.shiftKey) {
      handleRedo?.();
      return 'redo';
    }
    handleUndo?.();
    return 'undo';
  }
  if (isCtrl && keyLower === 'y') {
    e.preventDefault?.();
    handleRedo?.();
    return 'redo';
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (floatingInspectorFocused) return null;
    if (selectedIds.length > 0) {
      e.preventDefault?.();
      handleDeleteSelected?.();
      return 'delete';
    }
    return null;
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) {
    if (floatingInspectorFocused) return null;
    if (selectedIds.length > 0) {
      e.preventDefault?.();
      const step = e.shiftKey ? 10 : 1;
      const dx = keyLower === 'arrowleft' ? -step : keyLower === 'arrowright' ? step : 0;
      const dy = keyLower === 'arrowup' ? -step : keyLower === 'arrowdown' ? step : 0;

      const updatesMap = {};
      selectedIds.forEach((id) => {
        const found = findNodeAndParent(elements, id);
        if (found && found.node) {
          updatesMap[id] = {
            x: Math.round((found.node.x || 0) + dx),
            y: Math.round((found.node.y || 0) + dy),
          };
        }
      });
      const newRawElements = applyMultipleUpdatesForViewport(rawElements, updatesMap, viewportMode);
      updateElementsWithHistory?.(newRawElements);
      return 'nudge';
    }
    return null;
  }
  if (e.key === 'Enter' && !isCtrl && !e.altKey && !e.shiftKey) {
    e.preventDefault?.();
    handleSelectChild?.();
    return 'select_child';
  }
  if (isCtrl && (e.key === '=' || e.key === '+')) {
    e.preventDefault?.();
    setZoom?.((z) => clampCanvasZoom(z + 0.1));
    return 'zoom_in';
  }
  if (isCtrl && e.key === '-') {
    e.preventDefault?.();
    setZoom?.((z) => clampCanvasZoom(z - 0.1));
    return 'zoom_out';
  }
  if (isCtrl && e.key === '0') {
    e.preventDefault?.();
    handleResetZoom?.();
    return 'zoom_reset';
  }
  if (!e.altKey && (e.key === ']' || e.code === 'BracketRight')) {
    if (selectedIds.length > 0) {
      e.preventDefault?.();
      handleZOrderSelected?.(isCtrl ? 'front' : 'forward');
      return isCtrl ? 'z_order_front' : 'z_order_forward';
    }
    return null;
  }
  if (!e.altKey && (e.key === '[' || e.code === 'BracketLeft')) {
    if (selectedIds.length > 0) {
      e.preventDefault?.();
      handleZOrderSelected?.(isCtrl ? 'back' : 'backward');
      return isCtrl ? 'z_order_back' : 'z_order_backward';
    }
    return null;
  }
  if (!isCtrl && !e.altKey && e.shiftKey && keyLower === 'g') {
    e.preventDefault?.();
    setShowLayoutGrid?.((v) => !v);
    return 'toggle_grid';
  }
  if (!isCtrl && !e.altKey && e.shiftKey && keyLower === 'r') {
    e.preventDefault?.();
    setShowRulers?.((v) => !v);
    return 'toggle_rulers';
  }

  const nextTool = resolveSingleKeyToolShortcut(e.key, {
    isCtrlOrMeta: isCtrl,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
  });
  if (nextTool) {
    setActiveTool?.(nextTool);
    return `tool:${nextTool}`;
  }
  return null;
}

/**
 * Global studio keyboard shortcuts hook (`keydown` on `window`).
 * Calls no other custom hooks directly; receives `{ activeMode, state, actions }` and reads the latest
 * references through a synchronous ref so event handlers never suffer from stale closures.
 */
export function useShortcuts({ activeMode, state, actions }) {
  const latestRef = useRef({ activeMode, state, actions });
  latestRef.current = { activeMode, state, actions };

  useEffect(() => {
    const handleKeyDown = (e) => {
      dispatchStudioShortcut(e, latestRef.current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
