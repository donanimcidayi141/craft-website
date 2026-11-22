import { useEffect, useRef } from 'react';
import { findNodeAndParent } from '../utils/treeUtils';
import { applyMultipleUpdatesForViewport } from '../utils/responsiveUtils';
import {
  shouldHandleGlobalCanvasShortcut,
  resolveSingleKeyToolShortcut,
  clampCanvasZoom,
} from '../utils/canvasInputUtils';

/**
 * Global studio keyboard shortcuts hook (`keydown` on `window`).
 * Calls no other custom hooks directly; receives `{ state, actions }` and reads the latest
 * references through a synchronous ref so event handlers never suffer from stale closures.
 *
 * Input: {
 *   state: {
 *     showWelcomeScreen,
 *     previewMode,
 *     activeTool,
 *     selectedIds,
 *     elements,
 *     rawElements,
 *     viewportMode,
 *     showExportModal,
 *     showTutorial,
 *     showAddTagModal,
 *     showImportReportModal,
 *     showAttributesInspectorModal,
 *     functionEditorState,
 *   },
 *   actions: {
 *     setAiDockMinimized,
 *     setAiFocusSignal,
 *     handleSaveProject,
 *     handleOpenProjectFolder,
 *     handleOpenProjectFile,
 *     setShowExportModal,
 *     handleSelectAll,
 *     handleCopyElementStyle,
 *     handleCopy,
 *     handleCut,
 *     handlePasteElementStyle,
 *     handlePaste,
 *     handleDuplicateSelected,
 *     handleToggleLockSelected,
 *     handleStartNewProject,
 *     handleAddTab,
 *     handleUngroupSelected,
 *     handleGroupSelected,
 *     handleUndo,
 *     handleRedo,
 *     handleDeleteSelected,
 *     updateElementsWithHistory,
 *     handleTogglePreviewMode,
 *     setActiveTool,
 *     handleSelectParent,
 *     handleSelectChild,
 *     setZoom,
 *     handleResetZoom,
 *     handleZOrderSelected,
 *     setShowLayoutGrid,
 *     setShowRulers,
 *   },
 * }
 */
export function useShortcuts({ state, actions }) {
  const latestRef = useRef({ state, actions });
  latestRef.current = { state, actions };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const { state: curState, actions: curActions } = latestRef.current;
      const {
        showWelcomeScreen,
        previewMode,
        activeTool,
        selectedIds,
        elements,
        rawElements,
        viewportMode,
        showExportModal,
        showTutorial,
        showAddTagModal,
        showImportReportModal,
        showAttributesInspectorModal,
        functionEditorState,
      } = curState;

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
      } = curActions;

      const isAnyModalOpen = Boolean(
        showExportModal ||
        showTutorial ||
        showAddTagModal ||
        showImportReportModal ||
        showAttributesInspectorModal ||
        functionEditorState?.isOpen
      );
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+K -> Focus / Open Floating AI Chat Dock
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (!isAnyModalOpen && !showWelcomeScreen && !previewMode) {
          e.preventDefault();
          setAiDockMinimized(false);
          setAiFocusSignal((s) => s + 1);
          return;
        }
      }

      if (!shouldHandleGlobalCanvasShortcut({
        activeElement: document.activeElement,
        eventTarget: e.target,
        isAnyModalOpen,
      })) {
        return;
      }

      // Save Project: Ctrl+Shift+S -> Save As, Ctrl+S -> Save
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!showWelcomeScreen) handleSaveProject(true);
        return;
      }
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!showWelcomeScreen) handleSaveProject(false);
        return;
      }

      // Open Project: Ctrl+Shift+O -> Open Folder, Ctrl+O -> Open .craft.json File
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProjectFolder();
        return;
      }
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProjectFile();
        return;
      }

      // Ctrl+E -> Export React Modal
      if (isCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (!showWelcomeScreen) setShowExportModal(true);
        return;
      }

      if (showWelcomeScreen) return;

      // 1. Ctrl+A -> Select All
      if (isCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // 2. Ctrl+Shift+C -> Copy Style, Ctrl+C -> Copy
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyElementStyle({ activateTool: false });
        return;
      }
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // 3. Ctrl+X -> Cut
      if (isCtrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // 4. Ctrl+Shift+V -> Paste Style, Ctrl+V -> Paste
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteElementStyle();
        return;
      }
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+D -> Duplicate Selected
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Ctrl+Shift+L -> Toggle Lock Selected
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleToggleLockSelected();
        return;
      }

      // Ctrl+Shift+N -> Yeni Boş Proje (Temiz Tuval)
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleStartNewProject('blank');
        return;
      }

      // Ctrl+N -> Yeni Sayfa Sekmesi
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
        return;
      }

      // 5. Ctrl+Shift+G -> Ungroup
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUngroupSelected();
        return;
      }

      // 6. Ctrl+G -> Group
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGroupSelected();
        return;
      }

      // 7. Undo / Redo
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const k = e.key.toLowerCase();
          const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
          const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;

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
          updateElementsWithHistory(newRawElements);
          return;
        }
      } else if (e.key === 'Escape') {
        if (
          showExportModal ||
          showTutorial ||
          showAddTagModal ||
          showImportReportModal ||
          showAttributesInspectorModal ||
          functionEditorState?.isOpen
        ) {
          return;
        }
        if (previewMode) {
          handleTogglePreviewMode(false);
        } else if (activeTool !== 'select') {
          setActiveTool('select');
        } else {
          handleSelectParent();
        }
      } else if (e.key === 'Enter' && !isCtrl && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handleSelectChild();
      } else if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom((z) => clampCanvasZoom(z + 0.1));
      } else if (isCtrl && e.key === '-') {
        e.preventDefault();
        setZoom((z) => clampCanvasZoom(z - 0.1));
      } else if (isCtrl && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (!e.altKey && (e.key === ']' || e.code === 'BracketRight')) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleZOrderSelected(isCtrl ? 'front' : 'forward');
        }
      } else if (!e.altKey && (e.key === '[' || e.code === 'BracketLeft')) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleZOrderSelected(isCtrl ? 'back' : 'backward');
        }
      } else if (!isCtrl && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowLayoutGrid((v) => !v);
      } else if (!isCtrl && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowRulers((v) => !v);
      } else {
        const nextTool = resolveSingleKeyToolShortcut(e.key, {
          isCtrlOrMeta: isCtrl,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        });
        if (nextTool) {
          setActiveTool(nextTool);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
