import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TopMenuBar from './components/TopMenuBar';
import StudioLeftSidebar from './components/StudioLeftSidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import WelcomeScreen from './components/WelcomeScreen';
import TutorialModal from './components/TutorialModal';
import ExportModal from './components/ExportModal';
import TagPickerModal from './components/TagPickerModal';
import ImportReportModal from './components/ImportReportModal';
import FloatingAIChatDock from './components/FloatingAIChatDock';
import PresentationOverlay from './components/PresentationOverlay';
import { runImport } from './utils/importPipeline';
import { useAiChatSession } from './hooks/useAiChatSession';
import { createTagElement } from './data/tagRegistry';
import { CONTENT_PACK_ASSETS } from './data/contentPacks';
import { TEMPLATE_BLUEPRINTS, buildBespokeTemplateElements } from './data/templateBlueprints';
import { INITIAL_ELEMENTS, DEFAULT_UNIVERSAL_PROJECT } from './constants';
import {
  migrateFlatToNestedTree,
  findNodeAndParent,
  getAbsoluteCoords,
  removeNodeFromTree,
  insertNodeIntoTree,
  groupSelectedNodes,
  ungroupSelectedNode,
  cloneSubtreeWithNewIds,
  clonePresetSubtree,
  centerElementsSmart
} from './utils/treeUtils';
import {
  createDefaultCanvasByViewport,
  applyNodeUpdateForViewport,
  applyMultipleUpdatesForViewport,
  syncViewportTreeDiffs,
  reparentNodeForViewport,
  computeBaseFromViewportElement,
  ensureViewportAdapted,
  hasViewportOverrides,
  getViewportPreset,
  wrapNodesForViewport,
  unwrapNodeForViewport,
} from './utils/responsiveUtils';
import { getParentScopeId } from './utils/selectionUtils';
import { executeNodeClickEvent } from './utils/interactionEngine';
import {
  shouldHandleGlobalCanvasShortcut,
  resolveSingleKeyToolShortcut,
  clampCanvasZoom,
} from './utils/canvasInputUtils';
import {
  extractPortableElementStyle,
  mergePortableStyleOntoNode,
  computeElementZOrderUpdate,
} from './utils/canvasToolsUtils';
import {
  buildSerializableProjectSchema,
  parseAndMigrateLoadedProject,
  detectInitializedViewports,
  loadRecentProjects,
  upsertRecentProject,
  removeRecentProject,
  saveProjectToWebStorage,
  loadProjectFromWebStorage,
  deleteProjectFromWebStorage,
  saveAutosaveDraft,
  loadAutosaveDraft,
  clearAutosaveDraft,
  triggerBrowserJsonDownload,
} from './utils/projectStorage';
import AttributesCssInspectorModal from './components/AttributesCssInspectorModal';
import FunctionEditorModal from './components/FunctionEditorModal';
import StudioRightDock from './components/StudioRightDock';
import ProtoApp from './proto/ProtoApp';
import { buildTabState } from './utils/projectAssemblyUtils';
import { useSelection } from './hooks/useSelection';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { useProjectState } from './hooks/useProjectState';
import { useCanvasView } from './hooks/useCanvasView';

function CraftStudioApp() {
  // 1. Workspace Layout (panels, docks, modals, toasts)
  const {
    effectiveActivePanels,
    showWelcomeScreen,
    setShowWelcomeScreen,
    leftSidebarTab,
    setLeftSidebarTab,
    rightDockOpen,
    setRightDockOpen,
    rightPropertiesTab,
    setRightPropertiesTab,
    rightDockWidth,
    setRightDockWidth,
    aiDockMinimized,
    setAiDockMinimized,
    aiFocusSignal,
    setAiFocusSignal,
    showTutorial,
    setShowTutorial,
    showExportModal,
    setShowExportModal,
    showAddTagModal,
    setShowAddTagModal,
    showAttributesInspectorModal,
    setShowAttributesInspectorModal,
    showImportReportModal,
    setShowImportReportModal,
    importReportData,
    setImportReportData,
    functionEditorState,
    setFunctionEditorState,
    handleOpenFunctionEditor,
    previewToast,
    showToastMessage,
    handleSelectRightDockTarget,
    handleDockFloatingInspector,
    togglePanel,
    reset: resetWorkspaceLayout,
  } = useWorkspaceLayout();

  // 2. Project State (tabs, viewportMode, history ring, metadata, functions, pageLinks)
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    viewportMode,
    activeTab,
    rawElements,
    elements,
    activeCanvasByViewport,
    canvasSettings,
    projectMeta,
    setProjectMeta,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    projectFunctions,
    pageLinks,
    history,
    historyIndex,
    updateElementsWithHistory,
    handleCommitHistory,
    setCanvasSettings,
    updateActiveTabElement,
    handleUpdateElementDirect,
    handleUpdateMultipleElements,
    handleRenameElement,
    handleUndo,
    handleRedo,
    handleAddTab,
    handleCloseTab,
    handleRenameTab,
    switchViewportMode,
    handleResetViewportFromDesktop,
    handleRenameProject,
    saveProjectFunction,
    handleDeleteProjectFunction,
    reset: resetProjectState,
  } = useProjectState();

  const [activeTool, setActiveTool] = useState('select');
  const [primaryColor, setPrimaryColor] = useState('#d4af37');
  const [secondaryColor, setSecondaryColor] = useState('#1a1816');

  // Preview Mode & Canvas Helpers
  const [previewMode, setPreviewMode] = useState(false);
  const [showLayoutGrid, setShowLayoutGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [copiedElementStyle, setCopiedElementStyle] = useState(null);

  // 3. Canvas View (zoom, pan, viewport fit, ResizeObserver)
  const {
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    handleResetZoom,
    triggerFit,
    reset: resetCanvasView,
  } = useCanvasView({
    showWelcomeScreen,
    previewMode,
    leftSidebarTab,
    rightDockOpen,
    rightDockWidth,
    activeTabId,
    viewportMode,
    canvasWidth: canvasSettings?.width,
    canvasHeight: canvasSettings?.height,
  });

  // 4. Selection & Clipboard
  const {
    selectedIds,
    setSelectedIds,
    editingGroupId,
    setEditingGroupId,
    clipboard,
    selectedElement,
    handleSelectElements,
    handleToggleElementSelection,
    handleSelectAll,
    handleSelectParent,
    handleSelectChild,
    handleCopy,
    handleCut,
    handlePaste,
    reset: resetSelection,
  } = useSelection({ elements, rawElements, updateElementsWithHistory });

  // Reflect project name & dirty dot (`●`) in browser / Electron window title
  useEffect(() => {
    if (showWelcomeScreen) {
      document.title = 'CraftStudio - Web Tasarımcı & React Oluşturucu';
      return;
    }
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash !== '#/editor') {
      window.location.hash = '#/editor';
    }
    const prefix = hasUnsavedChanges ? '● ' : '';
    document.title = `${prefix}${projectMeta.name || 'CraftStudio Projesi'} — CraftStudio`;
  }, [showWelcomeScreen, hasUnsavedChanges, projectMeta.name]);

  // Project IO refs & persistence lists
  const [previewRuntimeOverrides, setPreviewRuntimeOverrides] = useState({});
  const projectFileInputRef = useRef(null);
  const projectFolderInputRef = useRef(null);
  const [recentProjects, setRecentProjects] = useState(() => loadRecentProjects());
  const [autosaveDraft, setAutosaveDraft] = useState(() => loadAutosaveDraft());

  // Bottom-Center Floating AI Highlight & Welcome Prompt State
  const [aiHighlightedIds, setAiHighlightedIds] = useState([]);
  const aiHighlightTimerRef = useRef(null);
  const [pendingWelcomeAiPrompt, setPendingWelcomeAiPrompt] = useState(null);

  // Direct element modification in active viewport for current selection
  const handleUpdateElement = (updates) => {
    if (selectedIds.length === 0) return;
    updateActiveTabElement(selectedIds[0], updates);
  };

  // Group Selected (Ctrl+G) - Packs selected sibling nodes into a container div
  const handleGroupSelected = () => {
    if (selectedIds.length <= 1) return;
    const newRawElements = groupSelectedNodes(rawElements, selectedIds);
    updateElementsWithHistory(newRawElements);
  };

  // Ungroup Selected (Ctrl+Shift+G) - Lifts children out of container
  const handleUngroupSelected = () => {
    if (selectedIds.length === 0) return;
    let nextTree = rawElements;
    selectedIds.forEach(id => {
      nextTree = ungroupSelectedNode(nextTree, id);
    });
    setEditingGroupId(null);
    updateElementsWithHistory(nextTree);
  };

  // Delete all selected elements (Delete / Backspace)
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    let nextTree = rawElements;
    selectedIds.forEach(id => {
      const { newTree } = removeNodeFromTree(nextTree, id);
      nextTree = newTree;
    });
    updateElementsWithHistory(nextTree);
    setSelectedIds([]);
    setEditingGroupId(null);
  };

  // Duplicate all selected elements (Ctrl+D / UI button)
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    let nextTree = rawElements;
    const newSelectedIds = [];

    selectedIds.forEach(id => {
      const foundRaw = findNodeAndParent(nextTree, id);
      const foundResolved = findNodeAndParent(elements, id);
      if (foundRaw) {
        const cloned = cloneSubtreeWithNewIds(foundRaw.node, 30);
        newSelectedIds.push(cloned.id);
        const parentId = foundRaw.parent ? foundRaw.parent.id : null;
        nextTree = insertNodeIntoTree(nextTree, parentId, cloned, foundRaw.index + 1);
        if (viewportMode !== 'desktop' && foundResolved?.node) {
          nextTree = applyNodeUpdateForViewport(
            nextTree,
            cloned.id,
            {
              x: Math.round((Number(foundResolved.node.x) || 0) + 24),
              y: Math.round((Number(foundResolved.node.y) || 0) + 24),
            },
            viewportMode
          );
        }
      }
    });

    updateElementsWithHistory(nextTree);
    setSelectedIds(newSelectedIds);
  };

  // 📋 Adobe-style Alt+Drag Duplication at exact dropped delta / target container
  const handleAltDuplicateElements = useCallback((draggedIds, dx, dy, targetContainerId = undefined) => {
    if (!Array.isArray(draggedIds) || draggedIds.length === 0) return;
    let nextTree = rawElements;
    const newSelectedIds = [];

    draggedIds.forEach(id => {
      const foundRaw = findNodeAndParent(nextTree, id);
      const foundResolved = findNodeAndParent(elements, id);
      if (!foundRaw?.node || !foundResolved?.node) return;

      const resolvedOrig = foundResolved.node;
      const origAbs = getAbsoluteCoords(elements, id);
      const cloned = cloneSubtreeWithNewIds(foundRaw.node, 0);
      newSelectedIds.push(cloned.id);

      const originalParentId = foundRaw.parent ? foundRaw.parent.id : null;
      // targetContainerId === undefined -> keep inside same parent; null -> root; string -> specific container
      let finalParentId = originalParentId;
      if (targetContainerId !== undefined) {
        if (targetContainerId === null) {
          finalParentId = null;
        } else if (targetContainerId !== id && !draggedIds.includes(targetContainerId)) {
          finalParentId = targetContainerId;
        }
      }

      const absNewX = Math.round((origAbs ? origAbs.x : (Number(resolvedOrig.x) || 0)) + dx);
      const absNewY = Math.round((origAbs ? origAbs.y : (Number(resolvedOrig.y) || 0)) + dy);

      let localX = Math.round((Number(resolvedOrig.x) || 0) + dx);
      let localY = Math.round((Number(resolvedOrig.y) || 0) + dy);
      if (finalParentId !== originalParentId) {
        if (!finalParentId) {
          localX = absNewX;
          localY = absNewY;
        } else {
          const destParentAbs = getAbsoluteCoords(elements, finalParentId);
          if (destParentAbs) {
            localX = Math.round(absNewX - destParentAbs.x);
            localY = Math.round(absNewY - destParentAbs.y);
          }
        }
      }

      if (viewportMode === 'desktop') {
        cloned.x = localX;
        cloned.y = localY;
        // Shift existing responsive coordinates safely within bounds so clones stay visible on tablet/mobile
        for (const vp of ['tablet', 'mobile']) {
          if (cloned.responsive?.[vp]) {
            const vpW = getViewportPreset(vp).width;
            const itemW = Number(cloned.responsive[vp].width) || Number(cloned.width) || 100;
            cloned.responsive[vp] = {
              ...cloned.responsive[vp],
              x: Math.max(0, Math.min(Math.max(0, vpW - itemW), localX)),
              y: Math.max(0, localY),
            };
          }
        }
      } else {
        // Place base Desktop coordinates sanely inside Desktop canvas/parent and apply exact viewport coordinates
        const deskMaxW = finalParentId
          ? Number(findNodeAndParent(nextTree, finalParentId)?.node?.width) || 1280
          : (activeCanvasByViewport.desktop?.width || 1280);
        const deskW = Number(cloned.width) || 120;
        cloned.x = Math.max(0, Math.min(Math.max(0, deskMaxW - deskW), Math.round(localX)));
        cloned.y = Math.max(0, Math.round(localY));
      }

      const insertIdx = finalParentId === originalParentId ? foundRaw.index + 1 : -1;
      nextTree = insertNodeIntoTree(nextTree, finalParentId, cloned, insertIdx);

      if (viewportMode !== 'desktop') {
        nextTree = applyNodeUpdateForViewport(
          nextTree,
          cloned.id,
          {
            x: localX,
            y: localY,
            width: resolvedOrig.width,
            height: resolvedOrig.height,
          },
          viewportMode
        );
      }
    });

    if (newSelectedIds.length > 0) {
      updateElementsWithHistory(nextTree);
      setSelectedIds(newSelectedIds);
    }
  }, [rawElements, elements, viewportMode, activeCanvasByViewport, updateElementsWithHistory]);

  // 🔗 Semantic Wrap / Unwrap (<a> Link, <button>, etc. without forcing background box)
  const handleWrapSelected = (wrapperTag = 'a', withBox = false, overrideIds = null) => {
    const idsToWrap = Array.isArray(overrideIds) && overrideIds.length > 0 ? overrideIds : selectedIds;
    if (idsToWrap.length === 0) return;
    const { newTree, wrapperId } = wrapNodesForViewport(rawElements, idsToWrap, wrapperTag, {
      withBox,
      viewportMode,
    });
    if (!wrapperId) return;
    updateElementsWithHistory(newTree);
    setSelectedIds([wrapperId]);
  };

  const handleUnwrapElement = (wrapperId = null) => {
    const targetId = wrapperId || selectedIds[0];
    if (!targetId) return;
    const { newTree, restoredIds } = unwrapNodeForViewport(rawElements, targetId);
    if (!restoredIds || restoredIds.length === 0) return;
    if (editingGroupId === targetId) {
      setEditingGroupId(getParentScopeId(rawElements, targetId));
    }
    updateElementsWithHistory(newTree);
    setSelectedIds(restoredIds);
  };

  // ⚡ Project Function CRUD & Preview Interactive Runtime Handlers
  const handleSaveProjectFunction = (savedFn) => {
    const cleanFn = saveProjectFunction(savedFn, functionEditorState.bindTargetElementId);
    showToastMessage(`Fonksiyon kaydedildi: ${cleanFn.name}()`, 'success');
  };

  const handlePreviewInputChange = useCallback((nodeId, val) => {
    setPreviewRuntimeOverrides((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), value: val },
    }));
  }, []);

  const handlePreviewExecuteEvent = useCallback((node) => {
    return executeNodeClickEvent(node, {
      elements,
      projectFunctions,
      runtimeOverrides: previewRuntimeOverrides,
      setRuntimeOverrides: setPreviewRuntimeOverrides,
      tabs,
      onNavigateTab: (targetTabId) => {
        setActiveTabId(targetTabId);
        resetSelection();
      },
      onNavigateUrl: (url, openInNewTab) => {
        if (!url) return;
        if (typeof window !== 'undefined') {
          if (openInNewTab) window.open(url, '_blank', 'noopener,noreferrer');
          else showToastMessage(`Dış bağlantı önizleme hedefi: ${url}`, 'info');
        }
      },
      onScrollTo: (targetRef) => {
        const clean = String(targetRef || '').replace(/^#/, '');
        const domEl =
          (typeof document !== 'undefined' && (document.getElementById(clean) || document.getElementById(`canvas-el-${clean}`))) ||
          null;
        if (domEl) {
          domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          showToastMessage(`Hedef öğe bulunamadı: #${clean}`, 'info');
        }
      },
      onNotify: (msg) => showToastMessage(msg, 'info'),
    });
  }, [elements, projectFunctions, previewRuntimeOverrides, tabs, showToastMessage]);

  const handleTogglePreviewMode = useCallback((nextVal) => {
    setPreviewRuntimeOverrides({});
    setPreviewMode((prev) => (typeof nextVal === 'boolean' ? nextVal : !prev));
    triggerFit();
  }, [triggerFit]);

  // Reparent element (moving into another container or canvas root while keeping all viewports anchored)
  const handleReparentElement = (sourceId, targetParentId, targetIndex = -1) => {
    const nextTree = reparentNodeForViewport(rawElements, sourceId, targetParentId, targetIndex);
    updateElementsWithHistory(nextTree);
    setSelectedIds([sourceId]);
  };

  // Alignment: Sayfada veya Ebeveyn İçinde Ortala (isolated per active viewport)
  const handleAlignHorizontalCenter = () => {
    if (selectedIds.length === 0) return;
    const { newTree } = centerElementsSmart(elements, selectedIds, canvasSettings.width, canvasSettings.height, 'x');
    const synced = syncViewportTreeDiffs(rawElements, newTree, viewportMode);
    updateElementsWithHistory(synced);
  };

  const handleAlignVerticalCenter = () => {
    if (selectedIds.length === 0) return;
    const { newTree } = centerElementsSmart(elements, selectedIds, canvasSettings.width, canvasSettings.height, 'y');
    const synced = syncViewportTreeDiffs(rawElements, newTree, viewportMode);
    updateElementsWithHistory(synced);
  };

  // Add Element at specific location (optionally nested inside parentId)
  const handleAddElementAt = (elementData) => {
    const { parentId = null, keepActiveTool = false, ...rest } = elementData || {};
    const rawNewElement = computeBaseFromViewportElement(
      {
        id: `elem-${Date.now()}`,
        positionMode: 'normal',
        zIndex: 1,
        children: [],
        ...rest,
        parentId: parentId || null,
      },
      viewportMode
    );
    const newElements = insertNodeIntoTree(rawElements, parentId || null, rawNewElement);
    updateElementsWithHistory(newElements);
    setSelectedIds([rawNewElement.id]);
    if (!keepActiveTool) {
      setActiveTool('select');
    }
  };

  // Quick tool addition from Left Toolbar - direct add if tag specified, else prompt modal
  const handleQuickAdd = (toolType) => {
    if (toolType && toolType !== 'tag_picker') {
      handleSelectNewTag(toolType);
    } else {
      setShowAddTagModal(true);
    }
  };

  const handleSelectNewTag = (tag) => {
    const canvasW = canvasSettings?.width || 1280;
    const defaultY = Math.max(0, Math.round(-panOffset.y / zoom) + 150);

    if (tag === 'checkbox') {
      const cbEl = createTagElement('input', {
        name: 'Onay Kutusu',
        x: 240,
        y: defaultY,
        width: 24,
        height: 24,
        borderRadius: 6,
        attrs: { type: 'checkbox', checked: true },
        style: { accentColor: primaryColor || '#d4af37', backgroundColor: '#ffffff', padding: '0' },
      });
      handleAddElementAt(cbEl);
      setShowAddTagModal(false);
      return;
    }

    if (tag === 'frame') {
      const frameEl = createTagElement('div', {
        name: 'Çerçeve',
        x: 180,
        y: defaultY,
        width: 480,
        height: 320,
        fillColor: '#ffffff',
        borderWidth: 1,
        borderRadius: 14,
        style: {
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '20px',
        },
      });
      frameEl.type = 'frame';
      handleAddElementAt(frameEl);
      setShowAddTagModal(false);
      return;
    }

    const isFullWidth = ['nav', 'header', 'footer', 'section'].includes(tag);
    const posX = isFullWidth ? 0 : 200;
    const posY = isFullWidth && tag === 'nav' ? 0 : defaultY;

    const newEl = createTagElement(tag, {
      x: posX,
      y: posY,
      width: isFullWidth ? canvasW : undefined,
      positionMode: tag === 'nav' ? 'sticky' : 'normal',
      style: {
        backgroundColor: tag === 'button' ? primaryColor : undefined,
      },
    });
    handleAddElementAt(newEl);
    setShowAddTagModal(false);
  };

  // Add Canva-style preset template / content pack with full ID cloning & smart placement
  const handleAddPreset = (assetElement, assetName, assetMeta = null) => {
    const cloned = clonePresetSubtree(assetElement);
    if (!cloned.name && assetName) cloned.name = assetName;

    const elType = String(cloned.type || '').toLowerCase();
    const elW = Number(cloned.width) || 280;
    const elH = Number(cloned.height) || 120;
    const desktopW = 1280;
    const placement =
      assetMeta?.placement ||
      (elType === 'nav' || elType === 'navbar'
        ? 'top'
        : elType === 'footer'
        ? 'bottom'
        : elW >= 780
        ? 'section'
        : 'inline');

    const maxBottomY = (rawElements || []).reduce(
      (maxY, item) => Math.max(maxY, (Number(item?.y) || 0) + (Number(item?.height) || 0)),
      0
    );

    let nextX = Math.max(0, Math.round((desktopW - elW) / 2));
    let nextY = 96;

    if (placement === 'top') {
      nextX = elW >= desktopW - 20 ? 0 : Math.max(0, Math.round((desktopW - elW) / 2));
      nextY = Number(assetElement?.y) || 0;
    } else if (placement === 'bottom') {
      nextX = elW >= desktopW - 20 ? 0 : Math.max(0, Math.round((desktopW - elW) / 2));
      nextY = maxBottomY > 0 ? maxBottomY + 44 : Math.max(0, (Number(canvasSettings?.height) || 1350) - elH);
    } else if (placement === 'section') {
      nextX = Math.max(0, Math.round((desktopW - elW) / 2));
      nextY = maxBottomY > 0 ? maxBottomY + 36 : 96;
    } else {
      const jitter = Math.round((Math.random() - 0.5) * 32);
      nextX = Math.max(24, Math.min(desktopW - elW - 24, Math.round((desktopW - elW) / 2) + jitter));
      nextY = Math.max(96, Math.round(-panOffset.y / zoom) + 120);
    }

    let preparedNode = {
      ...cloned,
      x: nextX,
      y: nextY,
      positionMode: cloned.positionMode || 'normal',
      zIndex: cloned.zIndex || 2,
    };

    if (viewportMode !== 'desktop') {
      const adapted = ensureViewportAdapted([preparedNode], viewportMode);
      if (adapted?.tree?.[0]) {
        preparedNode = adapted.tree[0];
      }
    }

    const nextElements = [...rawElements, preparedNode];
    updateElementsWithHistory(nextElements);

    const activeResolvedY = Number(preparedNode?.responsive?.[viewportMode]?.y ?? preparedNode.y) || 0;
    const activeResolvedH = Number(preparedNode?.responsive?.[viewportMode]?.height ?? preparedNode.height) || 0;
    const neededStageHeight = activeResolvedY + activeResolvedH + 64;
    if (neededStageHeight > (Number(canvasSettings?.height) || 1350)) {
      setCanvasSettings({ height: Math.min(4800, neededStageHeight) });
    }

    setSelectedIds([preparedNode.id]);
    setActiveTool('select');
    if (
      preparedNode.blockKind ||
      preparedNode.sliderConfig ||
      (Array.isArray(preparedNode.children) && preparedNode.children.length >= 2) ||
      ['nav', 'navbar', 'footer'].includes(elType)
    ) {
      setRightDockOpen(true);
      setRightPropertiesTab('block');
    }
  };

  // Background remover
  const handleRemoveBackground = () => {
    if (selectedIds.length === 0) return;
    const updates = {};
    selectedIds.forEach(id => {
      updates[id] = { fillColor: 'transparent', borderWidth: 0, shadow: 'none' };
    });
    handleUpdateMultipleElements(updates);
  };

  // Sibling-aware Z-Order adjustment ('front' | 'forward' | 'backward' | 'back')
  const handleZOrderSelected = (action, targetIds = selectedIds) => {
    if (!targetIds || targetIds.length === 0) return;
    const updates = computeElementZOrderUpdate(elements, targetIds, action);
    if (Object.keys(updates).length > 0) {
      handleUpdateMultipleElements(updates);
    }
  };

  // Lock / Unlock selected elements
  const handleToggleLockSelected = (targetIds = selectedIds) => {
    if (!targetIds || targetIds.length === 0) return;
    const anyUnlocked = targetIds.some((id) => !findNodeAndParent(elements, id)?.node?.isLocked);
    const updates = {};
    targetIds.forEach((id) => {
      updates[id] = { isLocked: anyUnlocked };
    });
    handleUpdateMultipleElements(updates);
    showToastMessage(anyUnlocked ? 'Öğe kilitlendi' : 'Öğe kilidi açıldı', 'info');
  };

  // Hide / Show selected elements
  const handleToggleHideSelected = (targetIds = selectedIds) => {
    if (!targetIds || targetIds.length === 0) return;
    const anyVisible = targetIds.some((id) => !findNodeAndParent(elements, id)?.node?.isHidden);
    const updates = {};
    targetIds.forEach((id) => {
      updates[id] = { isHidden: anyVisible };
    });
    handleUpdateMultipleElements(updates);
  };

  // Format Painter: Copy & Paste visual style
  const handleCopyElementStyle = ({ activateTool = true, sourceId = null } = {}) => {
    const idToSample = sourceId || selectedIds[0];
    if (!idToSample) {
      showToastMessage('Stil kopyalamak için önce bir öğe seç', 'info');
      return;
    }
    const found = findNodeAndParent(elements, idToSample);
    if (!found?.node) return;
    const extracted = extractPortableElementStyle(found.node);
    if (!extracted) return;
    setCopiedElementStyle(extracted);
    if (activateTool) {
      setActiveTool('format_paint');
      showToastMessage('Biçim kopyalandı — uygulamak için hedef öğeye tıkla', 'success');
    } else {
      showToastMessage('Biçim panoya kopyalandı (Ctrl+Shift+V)', 'success');
    }
  };

  const handlePasteElementStyle = (targetIds = selectedIds) => {
    if (!copiedElementStyle || !targetIds || targetIds.length === 0) return;
    const updates = {};
    targetIds.forEach((id) => {
      const found = findNodeAndParent(elements, id);
      if (found?.node) {
        updates[id] = mergePortableStyleOntoNode(found.node, copiedElementStyle);
      }
    });
    if (Object.keys(updates).length > 0) {
      handleUpdateMultipleElements(updates);
      showToastMessage('Biçim uygulandı', 'success');
    }
  };

  const triggerAiHighlight = useCallback((ids = []) => {
    if (aiHighlightTimerRef.current) clearTimeout(aiHighlightTimerRef.current);
    const valid = (Array.isArray(ids) ? ids : []).filter(Boolean);
    setAiHighlightedIds(valid);
    if (valid.length > 0) {
      aiHighlightTimerRef.current = setTimeout(() => {
        setAiHighlightedIds([]);
      }, 2600);
    }
  }, []);

  const handleCaptureAiSnapshot = useCallback(() => ({
    elements: JSON.parse(JSON.stringify(rawElements || [])),
    canvasByViewport: JSON.parse(JSON.stringify(activeCanvasByViewport || createDefaultCanvasByViewport())),
    selectedIds: [...selectedIds],
  }), [rawElements, activeCanvasByViewport, selectedIds]);

  const handleApplyAiResult = useCallback(({
    nextElements,
    recommendedHeight,
    appliedTargetIds = [],
    effectiveMode = 'full_site',
  }) => {
    const syncedRaw = syncViewportTreeDiffs(rawElements, nextElements, viewportMode);
    let nextCanvasOverride = null;
    if (recommendedHeight > (Number(canvasSettings?.height) || 1350)) {
      nextCanvasOverride = {
        ...activeCanvasByViewport,
        [viewportMode]: {
          ...canvasSettings,
          height: recommendedHeight,
        },
      };
    }
    updateElementsWithHistory(syncedRaw, nextCanvasOverride);
    if (effectiveMode === 'selection' && appliedTargetIds.length > 0) {
      handleSelectElements(appliedTargetIds);
    }
    triggerAiHighlight(appliedTargetIds);
    showToastMessage('AI tasarımı tuvale uygulandı (Ctrl+Z ile geri alabilirsin)');
  }, [rawElements, viewportMode, canvasSettings, activeCanvasByViewport, updateElementsWithHistory, triggerAiHighlight, showToastMessage]);

  const handleRestoreAiSnapshot = useCallback((snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.elements)) return;
    updateElementsWithHistory(snapshot.elements, snapshot.canvasByViewport || null);
    if (Array.isArray(snapshot.selectedIds)) {
      handleSelectElements(snapshot.selectedIds);
    }
    setAiHighlightedIds([]);
    showToastMessage('AI öncesi tasarım geri yüklendi');
  }, [updateElementsWithHistory, showToastMessage]);

  const aiChat = useAiChatSession({
    elements,
    selectedIds,
    canvasSettings,
    onCaptureSnapshot: handleCaptureAiSnapshot,
    onApplyAiResult: handleApplyAiResult,
    onRestoreAiSnapshot: handleRestoreAiSnapshot,
  });

  // Tutorial actions
  const handleTutorialAddBox = () => {
    handleAddElementAt({
      type: 'rectangle',
      name: 'Tutorial Kutusu',
      x: 100,
      y: 200,
      width: 400,
      height: 220,
      fillType: 'solid',
      fillColor: '#d4af37',
      borderWidth: 2,
      borderColor: '#ffffff',
      borderStyle: 'solid',
      borderRadius: 16,
      borderRadiusType: 'single',
      borderRadiusCorners: { tl: 16, tr: 16, br: 16, bl: 16 },
      shadow: '0 10px 30px rgba(0,0,0,0.15)',
    });
  };

  const handleTutorialApplyGradient = () => {
    if (selectedIds.length === 0) return;
    handleUpdateElement({
      fillType: 'gradient',
      gradient: {
        type: 'linear',
        angle: 45,
        color1: '#f59e0b',
        color2: '#78350f',
      }
    });
  };

  const handleTutorialApplyBorderRadius = () => {
    if (selectedIds.length === 0) return;
    handleUpdateElement({
      borderRadius: 24,
      borderRadiusType: 'single',
      borderRadiusCorners: { tl: 24, tr: 24, br: 24, bl: 24 }
    });
  };

  const handleTutorialCenterBox = () => {
    handleAlignHorizontalCenter();
    handleAlignVerticalCenter();
  };

  // Switch between Desktop / Tablet / Mobile & refit canvas viewport
  const handleSwitchViewport = useCallback((nextViewport) => {
    if (!switchViewportMode(nextViewport)) return;
    triggerFit();
  }, [switchViewportMode, triggerFit]);

  const buildCurrentProjectSchema = useCallback((overrides = {}) => {
    return buildSerializableProjectSchema({
      id: projectMeta.id || `proj-${Date.now()}`,
      name: projectMeta.name || 'CraftStudio Projesi',
      filePath: projectMeta.filePath,
      tabs,
      activeTabId,
      viewportMode,
      projectFunctions,
      pageLinks,
      createdAt: projectMeta.createdAt,
      ...overrides,
    });
  }, [projectMeta, tabs, activeTabId, viewportMode, projectFunctions, pageLinks]);

  const flushAutosaveDraft = useCallback(() => {
    const schema = buildCurrentProjectSchema();
    saveAutosaveDraft(schema);
    setAutosaveDraft(schema);
    return schema;
  }, [buildCurrentProjectSchema]);

  // Helper: Apply a parsed & migrated project schema to Studio state
  const applyLoadedProjectSchema = useCallback((rawProjectData, extraMeta = {}) => {
    const schema = parseAndMigrateLoadedProject(rawProjectData);
    const loadedTabs = schema.tabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
      route: tab.route,
      elements: tab.elements,
      canvasByViewport: tab.canvasByViewport,
      initializedViewports: tab.initializedViewports || detectInitializedViewports(tab.elements, true),
    }));

    const nextHistory = {};
    loadedTabs.forEach((tab) => {
      nextHistory[tab.id] = {
        items: [{ elements: tab.elements, canvasByViewport: tab.canvasByViewport }],
        index: 0,
      };
    });

    const resolvedActiveId = loadedTabs.find((t) => t.id === schema.activeTabId)?.id || loadedTabs[0]?.id || 'tab-1';
    const nextFilePath = extraMeta.filePath !== undefined ? extraMeta.filePath : (schema.filePath || null);
    const finalName = extraMeta.name || schema.name || 'Yüklenen Proje';

    resetProjectState({
      tabs: loadedTabs,
      historyByTab: nextHistory,
      activeTabId: resolvedActiveId,
      viewportMode: schema.viewportMode || 'desktop',
      projectFunctions: Array.isArray(schema.projectFunctions) ? schema.projectFunctions : [],
      pageLinks: Array.isArray(schema.pageLinks) ? schema.pageLinks : [],
      projectMeta: {
        id: schema.id,
        name: finalName,
        filePath: nextFilePath,
        createdAt: schema.createdAt || new Date().toISOString(),
      },
      hasUnsavedChanges: Boolean(extraMeta.markUnsaved),
    });
    resetSelection();
    setPreviewMode(false);
    setPreviewRuntimeOverrides({});
    resetWorkspaceLayout({ showWelcomeScreen: false });
    resetCanvasView();

    if (!extraMeta.skipRecentUpdate) {
      const updatedRecent = upsertRecentProject({
        ...schema,
        name: finalName,
        filePath: nextFilePath,
      });
      setRecentProjects(updatedRecent);
    }
  }, [resetProjectState, resetSelection, resetWorkspaceLayout, resetCanvasView]);

  // Debounced autosave draft in localStorage whenever user edits an open project
  useEffect(() => {
    if (showWelcomeScreen || !hasUnsavedChanges) return undefined;
    const timer = setTimeout(() => {
      flushAutosaveDraft();
    }, 1500);
    return () => clearTimeout(timer);
  }, [showWelcomeScreen, hasUnsavedChanges, flushAutosaveDraft]);

  // Synchronous flush + close confirmation when leaving with unsaved changes
  useEffect(() => {
    if (showWelcomeScreen || !hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (e) => {
      flushAutosaveDraft();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showWelcomeScreen, hasUnsavedChanges, flushAutosaveDraft]);

  // Welcome Screen & New Project actions
  const handleStartNewProject = (type) => {
    const newProjId = `proj-${Date.now()}`;
    const newTabId = `tab-${Date.now()}`;
    let nextTab = null;
    let nextViewportMode = 'desktop';
    let nextProjectMeta = null;

    if (type === 'universal' || type === 'jewelry') {
      nextTab = buildTabState(newTabId, 'Web-Sayfasi.craft', DEFAULT_UNIVERSAL_PROJECT, { width: 1280, height: 1350, backgroundColor: '#0b0a09' });
      nextProjectMeta = { id: newProjId, name: 'Aurelia Atelier Vitrini', filePath: null, createdAt: new Date().toISOString() };
    } else if (type === 'blank') {
      nextTab = buildTabState(newTabId, 'Yeni-Tasarim.craft', [], { width: 1280, height: 1200, backgroundColor: '#ffffff' });
      nextProjectMeta = { id: newProjId, name: 'Yeni Boş Proje', filePath: null, createdAt: new Date().toISOString() };
    } else if (type === 'blank-tablet' || type === 'tablet') {
      const byVp = createDefaultCanvasByViewport({ width: 1280, height: 1280, backgroundColor: '#ffffff' });
      nextTab = {
        ...buildTabState(newTabId, 'Tablet-Tasarim.craft', [], byVp),
        initializedViewports: { desktop: true, tablet: true, mobile: false },
      };
      nextViewportMode = 'tablet';
      nextProjectMeta = { id: newProjId, name: 'Tablet Tasarım Projesi', filePath: null, createdAt: new Date().toISOString() };
    } else if (type === 'blank-mobile') {
      const byVp = createDefaultCanvasByViewport({ width: 1280, height: 1200, backgroundColor: '#ffffff' });
      nextTab = {
        ...buildTabState(newTabId, 'Mobil-Tasarim.craft', [], byVp),
        initializedViewports: { desktop: true, tablet: false, mobile: true },
      };
      nextViewportMode = 'mobile';
      nextProjectMeta = { id: newProjId, name: 'Mobil Boş Proje', filePath: null, createdAt: new Date().toISOString() };
    } else if (type === 'mobile') {
      const adapted = ensureViewportAdapted(DEFAULT_UNIVERSAL_PROJECT, 'mobile', { forceReset: true });
      const byVp = createDefaultCanvasByViewport({ width: 1280, height: 1350, backgroundColor: '#0b0a09' });
      byVp.mobile.height = adapted.suggestedHeight;
      nextTab = {
        ...buildTabState(newTabId, 'Mobil-Web.craft', adapted.tree, byVp),
        initializedViewports: { desktop: true, tablet: false, mobile: true },
      };
      nextViewportMode = 'mobile';
      nextProjectMeta = { id: newProjId, name: 'Mobil Tasarım Projesi', filePath: null, createdAt: new Date().toISOString() };
    }

    resetProjectState({
      ...(nextTab ? { tabs: [nextTab], activeTabId: newTabId } : {}),
      viewportMode: nextViewportMode,
      ...(nextProjectMeta ? { projectMeta: nextProjectMeta } : {}),
      hasUnsavedChanges: false,
      projectFunctions: [],
      pageLinks: [],
    });
    setPreviewMode(false);
    setPreviewRuntimeOverrides({});
    resetSelection();
    resetWorkspaceLayout({ showWelcomeScreen: false });
    resetCanvasView();
  };

  // Karşılama ekranındaki Tane Tane Site Kurgulayıcı veya Hazır Blok Kütüphanesinden modüler proje kurar
  const handleStartAssembledProject = useCallback((config = {}) => {
    const {
      name = 'Tane Tane Web Projesi',
      tabName = 'Anasayfa.craft',
      presetKeys = [],
      backgroundColor = '#0b0a09',
      device = 'desktop',
      brandName = '',
      heroHeadline = '',
      heroSubtitle = '',
      aiPrompt = '',
      templateSlug = '',
    } = config;

    const newProjId = `proj-${Date.now()}`;
    const newTabId = `tab-${Date.now()}`;
    const targetVp = device === 'mobile' || device === 'tablet' ? device : 'desktop';
    const cleanBrand = String(brandName || '').trim();
    const cleanHeadline = String(heroHeadline || '').trim();
    const cleanSubtitle = String(heroSubtitle || '').trim();

    const matchedBlueprint =
      (templateSlug && TEMPLATE_BLUEPRINTS[templateSlug]) ||
      Object.values(TEMPLATE_BLUEPRINTS).find(
        (bp) => cleanBrand && bp.brandName.toLowerCase() === cleanBrand.toLowerCase()
      ) ||
      null;

    let currentY = 0;
    let assembledElements = [];

    if (matchedBlueprint) {
      const bespokeTree = buildBespokeTemplateElements(matchedBlueprint);
      if (Array.isArray(bespokeTree) && bespokeTree.length > 0) {
        assembledElements = bespokeTree;
        const lastEl = bespokeTree[bespokeTree.length - 1];
        currentY = (Number(lastEl.y) || 1998) + (Number(lastEl.height) || 268);
      }
    }

    if (assembledElements.length === 0) {
      (Array.isArray(presetKeys) ? presetKeys : []).forEach((key) => {
        const pack = CONTENT_PACK_ASSETS.find((item) => item.presetKey === key);
        if (!pack || !pack.element) return;

        const cloned = clonePresetSubtree(pack.element);
        const elType = String(cloned.type || '').toLowerCase();
        const elW = Number(cloned.width) || 1160;
        const elH = Number(cloned.height) || 320;
        const placement = pack.placement || (elType === 'nav' ? 'top' : elType === 'footer' ? 'bottom' : 'section');

        // Kullanıcı özel marka adı veya başlık girdiyse ilgili alt düğümlere uygula
        if (Array.isArray(cloned.children)) {
          cloned.children = cloned.children.map((child) => {
            const childName = String(child.name || '').toLowerCase();
            if (cleanBrand && (elType === 'nav' || elType === 'footer')) {
              if (
                childName.includes('marka') ||
                childName.includes('mağaza adı') ||
                childName.includes('logo metni')
              ) {
                return {
                  ...child,
                  textContent: cleanBrand.toUpperCase(),
                  content: cleanBrand.toUpperCase(),
                };
              }
            }
            if (cleanHeadline && child.type === 'h1') {
              return { ...child, textContent: cleanHeadline, content: cleanHeadline };
            }
            if (cleanSubtitle && child.type === 'p' && childName.includes('hero')) {
              return { ...child, textContent: cleanSubtitle, content: cleanSubtitle };
            }
            return child;
          });
        }

        let nextX = Math.max(0, Math.round((1280 - elW) / 2));
        let nextY = currentY;

        if (placement === 'top') {
          nextX = elW >= 1260 ? 0 : Math.max(0, Math.round((1280 - elW) / 2));
          nextY = Number(pack.element?.y) || 0;
          currentY = Math.max(currentY, nextY + elH + 32);
        } else if (placement === 'bottom') {
          nextX = elW >= 1260 ? 0 : Math.max(0, Math.round((1280 - elW) / 2));
          nextY = Math.max(currentY + 24, 960);
          currentY = nextY + elH;
        } else {
          nextX = Math.max(0, Math.round((1280 - elW) / 2));
          nextY = Math.max(96, currentY);
          currentY = nextY + elH + 36;
        }

        assembledElements.push({
          ...cloned,
          x: nextX,
          y: nextY,
          positionMode: cloned.positionMode || (elType === 'nav' ? 'sticky' : 'normal'),
          zIndex: cloned.zIndex || (elType === 'nav' ? 100 : 2),
        });
      });
    }

    const totalDesktopHeight = Math.max(1350, currentY + 48);
    const byVp = createDefaultCanvasByViewport({
      width: 1280,
      height: totalDesktopHeight,
      backgroundColor: backgroundColor || '#0b0a09',
    });

    let finalTree = assembledElements;
    const initViewports = { desktop: true, tablet: false, mobile: false };

    if (targetVp !== 'desktop' && assembledElements.length > 0) {
      const adapted = ensureViewportAdapted(assembledElements, targetVp, { forceReset: true });
      finalTree = adapted.tree;
      byVp[targetVp] = {
        ...byVp[targetVp],
        backgroundColor: backgroundColor || '#0b0a09',
        height: Math.max(1200, adapted.suggestedHeight || totalDesktopHeight),
      };
      initViewports[targetVp] = true;
    } else if (targetVp !== 'desktop') {
      byVp[targetVp] = {
        ...byVp[targetVp],
        backgroundColor: backgroundColor || '#0b0a09',
      };
      initViewports[targetVp] = true;
    }

    const newTab = {
      ...buildTabState(newTabId, tabName, finalTree, byVp),
      initializedViewports: initViewports,
    };

    resetProjectState({
      tabs: [newTab],
      activeTabId: newTabId,
      viewportMode: targetVp,
      projectMeta: {
        id: newProjId,
        name: cleanBrand ? `${cleanBrand} — Web Projesi` : name,
        filePath: null,
        createdAt: new Date().toISOString(),
      },
      hasUnsavedChanges: assembledElements.length > 0,
      projectFunctions: [],
      pageLinks: [],
    });
    setPreviewMode(false);
    setPreviewRuntimeOverrides({});
    resetSelection();
    const cleanPrompt = String(aiPrompt || '').trim();
    resetWorkspaceLayout({
      showWelcomeScreen: false,
      leftTab: cleanPrompt ? 'ai' : null,
      aiMinimized: false,
    });
    resetCanvasView();

    if (cleanPrompt) {
      setPendingWelcomeAiPrompt(cleanPrompt);
    } else if (assembledElements.length > 0) {
      showToastMessage(`✓ ${assembledElements.length} modüler katman tuvale yerleştirildi`, 'success');
    }
  }, [resetProjectState, showToastMessage, resetSelection, resetWorkspaceLayout, resetCanvasView]);

  // Karşılama ekranındaki Gemini komut kutusundan boş tuval + ilk AI isteğini başlatır
  const handleStartAiPromptFromWelcome = (promptText, options = null) => {
    const clean = String(promptText || '').trim();
    if (!clean) return;
    if (options && typeof options === 'object') {
      handleStartAssembledProject({
        name: options.projectName || 'AI Web Projesi',
        backgroundColor: options.backgroundColor || '#0b0a09',
        device: options.device || 'desktop',
        brandName: options.brandName || '',
        presetKeys: Array.isArray(options.presetKeys) ? options.presetKeys : [],
        aiPrompt: clean,
      });
      return;
    }
    handleStartNewProject('blank');
    setAiDockMinimized(false);
    setLeftSidebarTab('ai');
    setPendingWelcomeAiPrompt(clean);
  };

  useEffect(() => {
    if (showWelcomeScreen || !pendingWelcomeAiPrompt) return;
    const promptToSend = pendingWelcomeAiPrompt;
    setPendingWelcomeAiPrompt(null);
    aiChat.handleSendPrompt(promptToSend);
  }, [showWelcomeScreen, pendingWelcomeAiPrompt, aiChat]);

  // 💾 Save Project (.craft.json via Electron native dialog OR Web storage + download)
  const handleSaveProject = useCallback(async (saveAs = false) => {
    try {
      const schema = buildCurrentProjectSchema();

      if (window.electronAPI?.saveProjectFile) {
        const res = await window.electronAPI.saveProjectFile({
          filePath: projectMeta.filePath,
          saveAs,
          defaultFileName: `${(schema.name || 'proje').toLowerCase().replace(/[^a-z0-9-_ğüşıöç]+/gi, '-')}.craft.json`,
          content: JSON.stringify({ ...schema, filePath: undefined }, null, 2),
        });
        if (!res || res.canceled) return;
        if (!res.success) {
          showToastMessage(`Kaydetme hatası: ${res.error}`, 'error');
          return;
        }
        const savedToDifferentFile = Boolean(
          saveAs && projectMeta.filePath && res.filePath && res.filePath !== projectMeta.filePath
        );
        const nextId = savedToDifferentFile ? `proj-${Date.now()}` : schema.id;
        const nextName = savedToDifferentFile
          ? (res.name || schema.name)
          : (projectMeta.name || res.name || schema.name);
        const savedSchema = {
          ...schema,
          id: nextId,
          filePath: res.filePath,
          name: nextName,
        };
        setProjectMeta((prev) => ({
          ...prev,
          id: savedSchema.id,
          name: savedSchema.name,
          filePath: res.filePath,
          createdAt: savedSchema.createdAt,
        }));
        saveProjectToWebStorage(savedSchema);
        setRecentProjects(upsertRecentProject(savedSchema));
        clearAutosaveDraft();
        setAutosaveDraft(null);
        setHasUnsavedChanges(false);
        showToastMessage(`✓ Kaydedildi: ${res.fileName}`, 'success');
        return;
      }

      // Web / Browser mode persistence (+ .craft.json file download on Save As)
      saveProjectToWebStorage(schema);
      clearAutosaveDraft();
      setAutosaveDraft(null);
      setRecentProjects(upsertRecentProject(schema));
      setHasUnsavedChanges(false);
      if (saveAs) {
        triggerBrowserJsonDownload(schema);
        showToastMessage(`✓ İndirildi & Kaydedildi: ${schema.name}.craft.json`, 'success');
      } else {
        showToastMessage(`✓ Tarayıcı & Son Projelere kaydedildi (${schema.name})`, 'success');
      }
    } catch (err) {
      showToastMessage(`Kaydetme hatası: ${err.message}`, 'error');
    }
  }, [buildCurrentProjectSchema, projectMeta.filePath, projectMeta.name, showToastMessage]);

  // 📂 Open parsed JSON project object directly
  const handleOpenProject = (importedData) => {
    try {
      applyLoadedProjectSchema(importedData);
      showToastMessage('✓ Proje başarıyla yüklendi.', 'success');
    } catch (err) {
      console.error('Open project error:', err);
      showToastMessage('Proje açılamadı.', 'error');
    }
  };

  // 📂 Open website code (.html, .jsx, .tsx) or .craft.json file via Electron dialog OR browser picker
  const handleOpenProjectFile = useCallback(async () => {
    try {
      if (window.electronAPI?.openProjectFileDialog) {
        const res = await window.electronAPI.openProjectFileDialog();
        if (!res || res.canceled) return;
        const imp = await runImport({ kind: 'electron-file', ...res });
        if (!imp.ok) {
          showToastMessage(imp.error?.message || 'Dosya okunamadı.', 'error');
          return;
        }
        applyLoadedProjectSchema(imp.project, { filePath: res.filePath });
        const warnNote = imp.report.warnings.length > 0 ? ` (${imp.report.warnings.length} uyarı)` : '';
        showToastMessage(`✓ Açıldı: ${res.fileName}${warnNote}`, imp.report.warnings.length > 0 ? 'info' : 'success');
        return;
      }
      projectFileInputRef.current?.click();
    } catch (err) {
      console.error('File open error:', err);
      showToastMessage('Dosya okunamadı.', 'error');
    }
  }, [applyLoadedProjectSchema, showToastMessage]);

  const handleProjectFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const imp = await runImport(files.length === 1 ? files[0] : files);
    if (!imp.ok) {
      showToastMessage(imp.error?.message || 'Dosya okunamadı.', 'error');
      return;
    }
    try {
      applyLoadedProjectSchema(imp.project);
      const warnNote = imp.report.warnings.length > 0 ? ` (${imp.report.warnings.length} uyarı)` : '';
      showToastMessage(`✓ Açıldı: ${files[0].name}${warnNote}`, imp.report.warnings.length > 0 ? 'info' : 'success');
    } catch (err) {
      console.error('Apply loaded file error:', err);
      showToastMessage('Dosya okunamadı.', 'error');
    }
  };

  // 📂 Open Project Folder (Electron IPC veya tarayıcı webkitdirectory seçicisi üzerinden tek runImport hattı)
  const handleOpenProjectFolder = async () => {
    try {
      if (window.electronAPI?.openProjectDialog) {
        const res = await window.electronAPI.openProjectDialog();
        if (!res || res.canceled) return;
        const imp = await runImport({ kind: 'electron-folder', ...res });
        if (!imp.ok) {
          showToastMessage(imp.error?.message || 'Dosya okunamadı.', 'error');
          return;
        }
        setImportReportData({
          ...imp.project,
          summary: `${imp.report.files.length} dosya · ${imp.report.nodes} bileşen · ${imp.report.pages} sayfa`,
          warnings: imp.report.warnings,
          skipped: imp.report.skipped,
          unsupportedCount: imp.report.warnings.length,
          unsupportedDetails: imp.report.warnings.map((w) => ({ type: 'Uyarı', detail: w, file: imp.project.name })),
        });
        setShowImportReportModal(true);
      } else {
        projectFolderInputRef.current?.click();
      }
    } catch (err) {
      console.error('Error opening project folder:', err);
      showToastMessage('Dosya okunamadı.', 'error');
    }
  };

  const handleProjectFolderInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const imp = await runImport({ kind: 'files', files, isFolder: true });
    if (!imp.ok) {
      showToastMessage(imp.error?.message || 'Dosya okunamadı.', 'error');
      return;
    }
    setImportReportData({
      ...imp.project,
      summary: `${imp.report.files.length} dosya · ${imp.report.nodes} bileşen · ${imp.report.pages} sayfa`,
      warnings: imp.report.warnings,
      skipped: imp.report.skipped,
      unsupportedCount: imp.report.warnings.length,
      unsupportedDetails: imp.report.warnings.map((w) => ({ type: 'Uyarı', detail: w, file: imp.project.name })),
    });
    setShowImportReportModal(true);
  };

  const handleConfirmImport = () => {
    if (!importReportData) return;
    try {
      applyLoadedProjectSchema({
        id: importReportData.id || `proj-${Date.now()}`,
        name: importReportData.name || 'İçe Aktarılan Proje',
        canvasSettings: importReportData.canvasSettings,
        canvasByViewport: importReportData.canvasByViewport,
        viewportMode: importReportData.viewportMode || 'desktop',
        tabs: importReportData.tabs || [],
        activeTabId: importReportData.activeTabId,
        projectFunctions: importReportData.projectFunctions || [],
        pageLinks: importReportData.pageLinks || [],
      });
    } catch (err) {
      showToastMessage(`İçe aktarma hatası: ${err.message}`, 'error');
    }
    setShowImportReportModal(false);
  };

  const handleOpenRecentProject = async (proj) => {
    try {
      let fileMissingWarning = false;
      if (proj.filePath && window.electronAPI?.readProjectFile) {
        const res = await window.electronAPI.readProjectFile(proj.filePath);
        if (res && res.success) {
          const imp = await runImport({ kind: 'electron-file', ...res });
          if (imp.ok) {
            applyLoadedProjectSchema(imp.project, { filePath: res.filePath });
            return;
          }
        }
        fileMissingWarning = true;
      }
      if (proj.folderPath && window.electronAPI?.importProjectFolder) {
        const res = await window.electronAPI.importProjectFolder(proj.folderPath);
        if (res && res.success) {
          const imp = await runImport({ kind: 'electron-folder', ...res });
          if (imp.ok) {
            applyLoadedProjectSchema(imp.project);
            return;
          }
        }
      }
      if (proj.snapshot) {
        applyLoadedProjectSchema(proj.snapshot, { filePath: fileMissingWarning ? null : (proj.filePath || null) });
        if (fileMissingWarning) {
          showToastMessage('Diskteki dosya taşınmış/silinmiş; son yerel önbellekten yüklendi.', 'info');
        }
        return;
      }
      const storedFallback = proj.id ? loadProjectFromWebStorage(proj.id) : null;
      if (storedFallback) {
        applyLoadedProjectSchema(storedFallback, { filePath: fileMissingWarning ? null : (proj.filePath || null) });
        return;
      }
      if (proj.elements) {
        applyLoadedProjectSchema({
          id: proj.id,
          name: proj.name,
          elements: proj.elements,
          canvasByViewport: proj.canvasByViewport || { width: proj.width || 1280, height: proj.height || 1350, backgroundColor: '#0f172a' },
        });
        return;
      }
      showToastMessage('Bu son proje kaydının içeriği bulunamadı.', 'error');
    } catch (err) {
      showToastMessage(`Son proje açılamadı: ${err.message}`, 'error');
    }
  };

  const handleDeleteRecentProject = (projectId) => {
    deleteProjectFromWebStorage(projectId);
    setRecentProjects(removeRecentProject(projectId));
  };

  const handleRestoreAutosave = useCallback((draft) => {
    if (!draft) return;
    try {
      applyLoadedProjectSchema(draft, { markUnsaved: true, skipRecentUpdate: true });
      showToastMessage(`✓ Otomatik taslak açıldı: ${draft.name || 'Adsız Proje'}`, 'success');
    } catch (err) {
      showToastMessage(`Taslak açılamadı: ${err.message}`, 'error');
    }
  }, [applyLoadedProjectSchema, showToastMessage]);

  const handleSaveAutosave = useCallback(async (draft) => {
    const targetDraft = draft || autosaveDraft;
    if (!targetDraft) return;
    try {
      const normalized = parseAndMigrateLoadedProject(targetDraft);
      let savedSchema = {
        ...normalized,
        id: targetDraft.id || normalized.id || `proj-${Date.now()}`,
        name: targetDraft.name || normalized.name || 'Adsız Çalışma',
        filePath: targetDraft.filePath || normalized.filePath || undefined,
        updatedAt: new Date().toISOString(),
      };

      if (savedSchema.filePath && window.electronAPI?.saveProjectFile) {
        const res = await window.electronAPI.saveProjectFile({
          filePath: savedSchema.filePath,
          saveAs: false,
          defaultFileName: `${(savedSchema.name || 'proje').toLowerCase().replace(/[^a-z0-9-_ğüşıöç]+/gi, '-')}.craft.json`,
          content: JSON.stringify({ ...savedSchema, filePath: undefined }, null, 2),
        });
        if (res && res.success && res.filePath) {
          savedSchema = { ...savedSchema, filePath: res.filePath };
        }
      }

      saveProjectToWebStorage(savedSchema);
      setRecentProjects(upsertRecentProject(savedSchema));
      clearAutosaveDraft();
      setAutosaveDraft(null);
      setHasUnsavedChanges(false);
      showToastMessage(`✓ Kaydedildi: ${savedSchema.name}`, 'success');
    } catch (err) {
      showToastMessage(`Taslak kaydedilemedi: ${err.message}`, 'error');
    }
  }, [autosaveDraft, showToastMessage]);

  const handleSaveRecentProject = useCallback(async (proj) => {
    if (!proj) return;
    try {
      const rawSource = proj.snapshot || (proj.id ? loadProjectFromWebStorage(proj.id) : null) || proj;
      const schema = parseAndMigrateLoadedProject(rawSource);
      const updatedSchema = {
        ...schema,
        id: proj.id || schema.id,
        name: proj.name || schema.name,
        filePath: proj.filePath || schema.filePath || undefined,
        updatedAt: new Date().toISOString(),
      };

      if (window.electronAPI?.saveProjectFile) {
        const res = await window.electronAPI.saveProjectFile({
          filePath: updatedSchema.filePath,
          saveAs: !updatedSchema.filePath,
          defaultFileName: `${(updatedSchema.name || 'proje').toLowerCase().replace(/[^a-z0-9-_ğüşıöç]+/gi, '-')}.craft.json`,
          content: JSON.stringify({ ...updatedSchema, filePath: undefined }, null, 2),
        });
        if (!res || res.canceled) return;
        if (!res.success) {
          showToastMessage(`Kaydetme hatası: ${res.error}`, 'error');
          return;
        }
        const diskSaved = { ...updatedSchema, filePath: res.filePath };
        saveProjectToWebStorage(diskSaved);
        setRecentProjects(upsertRecentProject(diskSaved));
        showToastMessage(`✓ Kaydedildi: ${res.fileName || diskSaved.name}`, 'success');
        return;
      }

      saveProjectToWebStorage(updatedSchema);
      setRecentProjects(upsertRecentProject(updatedSchema));
      triggerBrowserJsonDownload(updatedSchema);
      showToastMessage(`✓ Kaydedildi: ${updatedSchema.name}.craft.json`, 'success');
    } catch (err) {
      showToastMessage(`Proje kaydedilemedi: ${err.message}`, 'error');
    }
  }, [showToastMessage]);

  const handleDismissAutosave = useCallback(() => {
    clearAutosaveDraft();
    setAutosaveDraft(null);
    showToastMessage('Otomatik taslak temizlendi.', 'info');
  }, [showToastMessage]);

  const handleGoHome = useCallback(() => {
    if (!showWelcomeScreen && hasUnsavedChanges) {
      flushAutosaveDraft();
    }
    setShowWelcomeScreen(true);
  }, [showWelcomeScreen, hasUnsavedChanges, flushAutosaveDraft]);

  // 🌟 GLOBAL KEYBOARD SHORTCUTS (Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+Shift+O, Ctrl+E, Ctrl+A/G/C/X/V, Esc, Enter, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
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
          selectedIds.forEach(id => {
            const found = findNodeAndParent(elements, id);
            if (found && found.node) {
              updatesMap[id] = {
                x: Math.round((found.node.x || 0) + dx),
                y: Math.round((found.node.y || 0) + dy)
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
  }, [
    showWelcomeScreen, selectedIds, editingGroupId, historyIndex, history, previewMode, activeTool, copiedElementStyle,
    showExportModal, showTutorial, showAddTagModal, showImportReportModal,
    showAttributesInspectorModal, functionEditorState?.isOpen,
    elements, rawElements, viewportMode, clipboard, updateElementsWithHistory,
    handleSaveProject, handleOpenProjectFile, handleTogglePreviewMode
  ]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#111113] text-zinc-200 select-none overflow-hidden font-sans relative">
      {/* Hidden browser file & folder pickers for opening .html / .htm / .jsx / .tsx / .craft.json inside workspace */}
      <input
        type="file"
        ref={projectFileInputRef}
        onChange={handleProjectFileInputChange}
        accept=".craft.json,.html,.htm,.jsx,.tsx"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={projectFolderInputRef}
        onChange={handleProjectFolderInputChange}
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/* Global Toast Notification (Save confirmation & Preview notify() feedback) */}
      {previewToast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-4 py-2.5 rounded-md border shadow-2xl text-xs font-medium flex items-center gap-2 backdrop-blur-md transition-all ${
            previewToast.variant === 'error'
              ? 'bg-red-950/90 border-red-500/50 text-red-200'
              : previewToast.variant === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-[#18181b]/95 border-[#0d99ff]/45 text-zinc-100'
          }`}
        >
          <span>{previewToast.message}</span>
        </div>
      )}

      {/* 1. WELCOME SCREEN */}
      {showWelcomeScreen ? (
        <WelcomeScreen
          onNewProject={handleStartNewProject}
          onStartAssembledProject={handleStartAssembledProject}
          onOpenProject={handleOpenProject}
          onOpenProjectFile={handleOpenProjectFile}
          onOpenProjectFolder={handleOpenProjectFolder}
          onOpenRecentProject={handleOpenRecentProject}
          onSaveRecentProject={handleSaveRecentProject}
          onDeleteRecentProject={handleDeleteRecentProject}
          recentProjects={recentProjects}
          autosaveDraft={autosaveDraft}
          onRestoreAutosave={handleRestoreAutosave}
          onSaveAutosave={handleSaveAutosave}
          onDismissAutosave={handleDismissAutosave}
          aiChat={aiChat}
          onStartAiPrompt={handleStartAiPromptFromWelcome}
        />
      ) : (
        <>
          {/* Top Adobe Menubar & Tabs */}
          <TopMenuBar
            zoom={zoom}
            setZoom={setZoom}
            resetZoom={handleResetZoom}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            activePanels={effectiveActivePanels}
            togglePanel={togglePanel}
            tabs={tabs}
            activeTabId={activeTabId}
            setActiveTabId={(nextId) => {
              setActiveTabId(nextId);
              resetSelection();
              setPreviewRuntimeOverrides({});
            }}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
            previewMode={previewMode}
            setPreviewMode={handleTogglePreviewMode}
            onOpenExportModal={() => setShowExportModal(true)}
            onOpenProjectFolder={handleOpenProjectFolder}
            onOpenProjectFile={handleOpenProjectFile}
            onSaveProject={handleSaveProject}
            projectName={projectMeta.name}
            projectFilePath={projectMeta.filePath}
            onRenameProject={handleRenameProject}
            hasUnsavedChanges={hasUnsavedChanges}
            viewportMode={viewportMode}
            setViewportMode={handleSwitchViewport}
            rawElements={rawElements}
            onGoHome={handleGoHome}
            onNewBlankProject={() => handleStartNewProject('blank')}
            onStartTutorial={() => setShowTutorial(true)}
            selectedIds={selectedIds}
            onAlignHorizontalCenter={handleAlignHorizontalCenter}
            onAlignVerticalCenter={handleAlignVerticalCenter}
            onGroupSelected={handleGroupSelected}
            onUngroupSelected={handleUngroupSelected}
          />

          {/* Main Workspace (Toolbar + Canvas + Docked Panels) */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Unified Studio Left Sidebar (Rail + Drawer for Layers, Elements, Templates, Code) */}
            {!previewMode && (
              <StudioLeftSidebar
                activeTab={leftSidebarTab}
                setActiveTab={setLeftSidebarTab}
                elements={elements}
                selectedIds={selectedIds}
                onSelectElement={(id) => handleSelectElements([id])}
                onSelectMultipleElements={handleSelectElements}
                onToggleElementSelection={handleToggleElementSelection}
                onToggleVisibility={(id) => {
                  const found = findNodeAndParent(elements, id);
                  if (found && found.node) {
                    handleUpdateElementDirect(id, { isHidden: !found.node.isHidden });
                  }
                }}
                onToggleLock={(id) => {
                  const found = findNodeAndParent(elements, id);
                  if (found && found.node) {
                    handleUpdateElementDirect(id, { isLocked: !found.node.isLocked });
                  }
                }}
                onRenameElement={handleRenameElement}
                onReparentElement={handleReparentElement}
                onDeleteSelected={handleDeleteSelected}
                onDuplicateSelected={handleDuplicateSelected}
                onGroupSelected={handleGroupSelected}
                onUngroupSelected={handleUngroupSelected}
                onZOrderSelected={handleZOrderSelected}
                onToggleLockSelected={handleToggleLockSelected}
                onAlignHorizontalCenter={handleAlignHorizontalCenter}
                onAlignVerticalCenter={handleAlignVerticalCenter}
                copiedStyle={copiedElementStyle}
                onCopyStyle={handleCopyElementStyle}
                onPasteStyle={() => handlePasteElementStyle()}
                showLayoutGrid={showLayoutGrid}
                setShowLayoutGrid={setShowLayoutGrid}
                showRulers={showRulers}
                setShowRulers={setShowRulers}
                onResetZoom={handleResetZoom}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                primaryColor={primaryColor}
                setPrimaryColor={setPrimaryColor}
                secondaryColor={secondaryColor}
                setSecondaryColor={setSecondaryColor}
                onQuickAdd={handleQuickAdd}
                onRemoveBackground={handleRemoveBackground}
                selectedElement={selectedElement}
                onAddPreset={handleAddPreset}
                onUpdateElement={handleUpdateElement}
                onCommitHistory={handleCommitHistory}
                aiChat={aiChat}
                viewportMode={viewportMode}
              />
            )}

            {/* Center Canvas Column + Bottom-Center Floating AI Chat Dock */}
            <div className="relative flex-1 min-w-0 h-full flex flex-col overflow-hidden">
              <Canvas
                elements={elements}
                selectedIds={selectedIds}
                onSelectElements={handleSelectElements}
                onToggleElementSelection={handleToggleElementSelection}
                onUpdateElement={handleUpdateElement}
                onUpdateMultipleElements={handleUpdateMultipleElements}
                onAltDuplicateElements={handleAltDuplicateElements}
                onCommitHistory={handleCommitHistory}
                onReparentElement={handleReparentElement}
                onSelectParent={handleSelectParent}
                onSelectChild={handleSelectChild}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                zoom={zoom}
                setZoom={setZoom}
                panOffset={panOffset}
                setPanOffset={setPanOffset}
                canvasSettings={canvasSettings}
                onUpdateCanvasSettings={setCanvasSettings}
                previewMode={previewMode}
                previewRuntimeOverrides={previewRuntimeOverrides}
                onPreviewExecuteEvent={handlePreviewExecuteEvent}
                onPreviewInputChange={handlePreviewInputChange}
                primaryColor={primaryColor}
                setPrimaryColor={setPrimaryColor}
                secondaryColor={secondaryColor}
                onAddElementAt={handleAddElementAt}
                editingGroupId={editingGroupId}
                setEditingGroupId={setEditingGroupId}
                viewportMode={viewportMode}
                onResetViewportFromDesktop={handleResetViewportFromDesktop}
                aiHighlightedIds={aiHighlightedIds}
                showLayoutGrid={showLayoutGrid}
                setShowLayoutGrid={setShowLayoutGrid}
                showRulers={showRulers}
                setShowRulers={setShowRulers}
                copiedStyle={copiedElementStyle}
                onCopyStyle={handleCopyElementStyle}
                onPasteStyle={handlePasteElementStyle}
                onDuplicateSelected={handleDuplicateSelected}
                onDeleteSelected={handleDeleteSelected}
                onCopySelected={handleCopy}
                onCutSelected={handleCut}
                onPasteFromClipboard={handlePaste}
                canPasteClipboard={Boolean(clipboard)}
                onGroupSelected={handleGroupSelected}
                onUngroupSelected={handleUngroupSelected}
                onZOrderSelected={handleZOrderSelected}
                onToggleLockSelected={handleToggleLockSelected}
                onToggleHideSelected={handleToggleHideSelected}
                onAlignHorizontalCenter={handleAlignHorizontalCenter}
                onAlignVerticalCenter={handleAlignVerticalCenter}
                onResetZoom={handleResetZoom}
                onNotify={showToastMessage}
              />

              {!previewMode && (
                <FloatingAIChatDock
                  aiChat={aiChat}
                  isMinimized={aiDockMinimized}
                  onSetMinimized={setAiDockMinimized}
                  isLeftAiOpen={leftSidebarTab === 'ai'}
                  onToggleLeftAiPanel={() => setLeftSidebarTab((prev) => (prev === 'ai' ? null : 'ai'))}
                  focusSignal={aiFocusSignal}
                />
              )}
            </div>

            {/* Unified Adobe Right Dock + Vertical Icon Rail */}
            {!previewMode && (
              <StudioRightDock
                isOpen={rightDockOpen}
                activeModule="properties"
                propertiesTab={rightPropertiesTab}
                dockWidth={rightDockWidth}
                onChangeDockWidth={setRightDockWidth}
                onSelectDockTarget={handleSelectRightDockTarget}
                onToggleCollapse={() => setRightDockOpen((prev) => !prev)}
                onOpenFloatingInspector={() => setShowAttributesInspectorModal((prev) => !prev)}
                isFloatingInspectorOpen={showAttributesInspectorModal}
                propertiesContent={(
                  <PropertiesPanel
                    selectedIds={selectedIds}
                    elements={elements}
                    rawElements={rawElements}
                    onSelectElement={(id) => handleSelectElements([id])}
                    onUpdateElement={handleUpdateElement}
                    onUpdateElementDirect={handleUpdateElementDirect}
                    onUpdateResolvedElements={(nextResolved) => {
                      const synced = syncViewportTreeDiffs(rawElements, nextResolved, viewportMode);
                      updateElementsWithHistory(synced);
                    }}
                    onUpdateMultipleElements={handleUpdateMultipleElements}
                    onDeleteSelected={handleDeleteSelected}
                    onDuplicateSelected={handleDuplicateSelected}
                    onGroupSelected={handleGroupSelected}
                    onUngroupSelected={handleUngroupSelected}
                    onWrapSelected={handleWrapSelected}
                    onUnwrapElement={handleUnwrapElement}
                    canvasSettings={canvasSettings}
                    onUpdateCanvasSettings={setCanvasSettings}
                    onCommitHistory={handleCommitHistory}
                    onClose={() => setRightDockOpen(false)}
                    onOpenAttributesInspector={() => setShowAttributesInspectorModal(true)}
                    viewportMode={viewportMode}
                    onResetViewportFromDesktop={handleResetViewportFromDesktop}
                    controlledTab={rightPropertiesTab}
                    onTabChange={setRightPropertiesTab}
                    tabs={tabs}
                    projectFunctions={projectFunctions}
                    onOpenFunctionEditor={handleOpenFunctionEditor}
                    onDeleteProjectFunction={handleDeleteProjectFunction}
                  />
                )}
              />
            )}
          </div>
        </>
      )}

      {/* PowerPoint-style Fullscreen Browser Presentation Overlay ("Sun") */}
      {!showWelcomeScreen && previewMode && (
        <PresentationOverlay
          projectName={projectMeta.name}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={(nextId) => setActiveTabId(nextId)}
          projectFunctions={projectFunctions}
          initialViewport={viewportMode === 'mobile' || viewportMode === 'tablet' ? viewportMode : 'full'}
          onClose={() => handleTogglePreviewMode(false)}
          onOpenExportModal={() => setShowExportModal(true)}
        />
      )}

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onAddSampleBox={handleTutorialAddBox}
        onCenterSampleBox={handleTutorialCenterBox}
        onApplyGradient={handleTutorialApplyGradient}
        onApplyBorderRadius={handleTutorialApplyBorderRadius}
        onTogglePreview={() => handleTogglePreviewMode()}
        onExportReact={() => {
          setShowTutorial(false);
          setShowExportModal(true);
        }}
      />

      {/* Export to React Desktop Project Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        elements={rawElements}
        canvasSettings={activeCanvasByViewport.desktop || canvasSettings}
        canvasByViewport={activeCanvasByViewport}
        tabName={activeTab.name}
        activeTabId={activeTabId}
        viewportMode={viewportMode}
        tabs={tabs}
        projectFunctions={projectFunctions}
        pageLinks={pageLinks}
        projectName={projectMeta.name}
        projectFilePath={projectMeta.filePath || ''}
      />

      {/* ⚡ Hybrid Formula & JavaScript Function Editor Modal */}
      <FunctionEditorModal
        isOpen={functionEditorState.isOpen}
        onClose={() => setFunctionEditorState({ isOpen: false, fnObj: null, bindTargetElementId: null })}
        fnObj={functionEditorState.fnObj}
        elements={elements}
        tabs={tabs}
        onSaveFunction={handleSaveProjectFunction}
      />

      {/* "Bu ne olacak?" HTML Tag Picker Modal */}
      <TagPickerModal
        isOpen={showAddTagModal}
        onClose={() => setShowAddTagModal(false)}
        onSelectTag={handleSelectNewTag}
        title="Bu ne olacak?"
        subtitle="Sayfaya eklemek istediğiniz HTML tag'ini seçin:"
      />

      {/* 🌟 Harici / Craft Projesi İçe Aktarma Rapor Modalı */}
      <ImportReportModal
        isOpen={showImportReportModal}
        onClose={() => setShowImportReportModal(false)}
        importData={importReportData}
        onConfirmOpen={handleConfirmImport}
      />

      {/* 🌟 Genişletilmiş Öznitelikler & CSS Müfettişi (Adobe Yüzen Pencere) */}
      <AttributesCssInspectorModal
        isOpen={showAttributesInspectorModal}
        onClose={() => setShowAttributesInspectorModal(false)}
        element={selectedElement}
        elements={elements}
        onUpdateElement={handleUpdateElement}
        onCommitHistory={handleCommitHistory}
        onDockToRightPanel={handleDockFloatingInspector}
      />
    </div>
  );
}

// Faz 1 izole iframe prototipi için minimal URL giriş noktası (?proto=iframe)
export default function App() {
  const isProtoIframe =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('proto') === 'iframe';
  if (isProtoIframe) {
    return <ProtoApp />;
  }
  return <CraftStudioApp />;
}
