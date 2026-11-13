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
import AIAgentPanel from './components/AIAgentPanel';
import { createTagElement } from './data/tagRegistry';
import { INITIAL_ELEMENTS, DEFAULT_UNIVERSAL_PROJECT } from './constants';
import {
  migrateFlatToNestedTree,
  findNodeAndParent,
  getNodePath,
  getAbsoluteCoords,
  removeNodeFromTree,
  insertNodeIntoTree,
  groupSelectedNodes,
  ungroupSelectedNode,
  cloneSubtreeWithNewIds,
  clonePresetSubtree,
  flattenTree,
  isExplicitContainer,
  centerElementsSmart
} from './utils/treeUtils';
import {
  createDefaultCanvasByViewport,
  resolveTreeForViewport,
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
  buildSerializableProjectSchema,
  parseAndMigrateLoadedProject,
  loadRecentProjects,
  upsertRecentProject,
  removeRecentProject,
  saveProjectToWebStorage,
  saveAutosaveDraft,
  triggerBrowserJsonDownload,
} from './utils/projectStorage';
import AttributesCssInspectorModal from './components/AttributesCssInspectorModal';
import FunctionEditorModal from './components/FunctionEditorModal';
import StudioRightDock, { DEFAULT_RIGHT_DOCK_WIDTH } from './components/StudioRightDock';

function detectInitializedViewports(nodes = [], initialDesktop = true) {
  const result = { desktop: initialDesktop, tablet: false, mobile: false };
  const check = (list) => {
    for (const n of list || []) {
      if (n.responsive?.tablet) result.tablet = true;
      if (n.responsive?.mobile) result.mobile = true;
      if (n.children) check(n.children);
    }
  };
  check(nodes);
  return result;
}

function buildTabState(id, name, elems = [], canvasOrByViewport = {}) {
  const hasPerViewport = canvasOrByViewport && (canvasOrByViewport.desktop || canvasOrByViewport.tablet || canvasOrByViewport.mobile);
  const baseDefaults = createDefaultCanvasByViewport(hasPerViewport ? canvasOrByViewport.desktop : canvasOrByViewport);
  const canvasByViewport = hasPerViewport
    ? {
        desktop: { ...baseDefaults.desktop, ...(canvasOrByViewport.desktop || {}) },
        tablet: { ...baseDefaults.tablet, ...(canvasOrByViewport.tablet || {}) },
        mobile: { ...baseDefaults.mobile, ...(canvasOrByViewport.mobile || {}) },
      }
    : baseDefaults;

  return {
    id,
    name,
    elements: elems,
    canvasByViewport,
    initializedViewports: detectInitializedViewports(elems, true),
  };
}

export default function App() {
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showAttributesInspectorModal, setShowAttributesInspectorModal] = useState(false);

  // External Project Import Report State
  const [importReportData, setImportReportData] = useState(null);
  const [showImportReportModal, setShowImportReportModal] = useState(false);

  // Document Tabs state (each tab carries shared AST + per-viewport canvas geometry)
  const [tabs, setTabs] = useState(() => [
    buildTabState('tab-1', 'Anasayfa.craft', DEFAULT_UNIVERSAL_PROJECT),
    buildTabState('tab-2', 'Özellikler.craft', []),
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [viewportMode, setViewportMode] = useState('desktop');

  // Active Tab & viewport resolution
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const rawElements = activeTab.elements;
  const elements = useMemo(
    () => resolveTreeForViewport(rawElements, viewportMode),
    [rawElements, viewportMode]
  );

  const activeCanvasByViewport = activeTab.canvasByViewport || createDefaultCanvasByViewport();
  const canvasSettings = activeCanvasByViewport[viewportMode] || activeCanvasByViewport.desktop;

  // Project Metadata, Functions, Preview Runtime & Recent Projects
  const [projectMeta, setProjectMeta] = useState({
    id: 'proj-initial',
    name: 'CraftStudio Projesi',
    filePath: null,
    createdAt: null,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [projectFunctions, setProjectFunctions] = useState([]);
  const [functionEditorState, setFunctionEditorState] = useState({
    isOpen: false,
    fnObj: null,
    bindTargetElementId: null,
  });
  const [previewRuntimeOverrides, setPreviewRuntimeOverrides] = useState({});
  const [previewToast, setPreviewToast] = useState(null);
  const previewToastTimerRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const [recentProjects, setRecentProjects] = useState(() => loadRecentProjects());

  const showToastMessage = useCallback((message, variant = 'info') => {
    if (!message) return;
    setPreviewToast({ message: String(message), variant });
    if (previewToastTimerRef.current) {
      clearTimeout(previewToastTimerRef.current);
    }
    previewToastTimerRef.current = setTimeout(() => {
      setPreviewToast(null);
    }, 3500);
  }, []);

  // Per-tab History for Undo / Redo (snapshots preserve elements + per-viewport canvas sizes)
  const [historyByTab, setHistoryByTab] = useState(() => ({
    'tab-1': {
      items: [{ elements: DEFAULT_UNIVERSAL_PROJECT, canvasByViewport: createDefaultCanvasByViewport() }],
      index: 0,
    },
    'tab-2': {
      items: [{ elements: [], canvasByViewport: createDefaultCanvasByViewport() }],
      index: 0,
    },
  }));
  const currentTabHistory = historyByTab[activeTab.id] || {
    items: [{ elements: rawElements, canvasByViewport: activeCanvasByViewport }],
    index: 0,
  };
  const history = currentTabHistory.items;
  const historyIndex = currentTabHistory.index;

  // Synchronous ref snapshot so onCommitHistory immediately after onUpdateElement never reads stale state
  const latestTabSnapshotRef = useRef({});
  useEffect(() => {
    latestTabSnapshotRef.current[activeTab.id] = {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
  }, [activeTab.id, rawElements, activeCanvasByViewport]);

  // 🌟 MULTI-SELECTION & GROUPING STATE
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState(null); // When user double-clicks to deep-edit a group

  const [activeTool, setActiveTool] = useState('select');
  const [primaryColor, setPrimaryColor] = useState('#d4af37');
  const [secondaryColor, setSecondaryColor] = useState('#1a1816');

  // Canvas Viewport
  const [zoom, setZoom] = useState(0.85);
  const [panOffset, setPanOffset] = useState({ x: 80, y: 30 });

  // Unified Left Studio Sidebar tab: 'layers' | 'elements' | 'templates' | 'code' | null
  const [leftSidebarTab, setLeftSidebarTab] = useState('layers');

  // Unified Right Dock state (Adobe resizable palette + vertical rail)
  const [rightDockOpen, setRightDockOpen] = useState(true);
  const [rightDockModule, setRightDockModule] = useState('properties'); // 'properties' | 'aiAgent'
  const [rightPropertiesTab, setRightPropertiesTab] = useState('layout'); // 'style' | 'layout' | 'props' | 'css' | 'code'
  const [rightDockWidth, setRightDockWidth] = useState(DEFAULT_RIGHT_DOCK_WIDTH);

  // Preview Mode
  const [previewMode, setPreviewMode] = useState(false);

  // Clipboard state for Ctrl+C, Ctrl+X, Ctrl+V
  const [clipboard, setClipboard] = useState(null);

  const setTabHistory = useCallback((tabId, snapshot) => {
    setHistoryByTab(prev => ({
      ...prev,
      [tabId]: { items: [snapshot], index: 0 },
    }));
  }, []);

  // Synchronize Tab Elements (and optional canvasByViewport) update with history
  const updateElementsWithHistory = useCallback((newRawElements, nextCanvasByViewport = null) => {
    let resolvedCanvasByVp = nextCanvasByViewport;
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id === activeTabId) {
        const finalCanvasByVp = nextCanvasByViewport || t.canvasByViewport || createDefaultCanvasByViewport();
        resolvedCanvasByVp = finalCanvasByVp;
        latestTabSnapshotRef.current[t.id] = { elements: newRawElements, canvasByViewport: finalCanvasByVp };
        return { ...t, elements: newRawElements, canvasByViewport: finalCanvasByVp };
      }
      return t;
    }));
    setHasUnsavedChanges(true);

    const snapshot = {
      elements: newRawElements,
      canvasByViewport: resolvedCanvasByVp || activeCanvasByViewport,
    };
    setHistoryByTab(prev => {
      const cur = prev[activeTabId] || { items: [{ elements: rawElements, canvasByViewport: activeCanvasByViewport }], index: 0 };
      const updated = cur.items.slice(0, cur.index + 1);
      return {
        ...prev,
        [activeTabId]: {
          items: [...updated, snapshot],
          index: updated.length,
        },
      };
    });
  }, [activeTabId, activeCanvasByViewport, rawElements]);

  // Commit current elements/canvas to history after finishing an interaction (e.g. drag, resize, bottom extender)
  const handleCommitHistory = useCallback(() => {
    const snap = latestTabSnapshotRef.current[activeTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    setHasUnsavedChanges(true);
    setHistoryByTab(prev => {
      const cur = prev[activeTabId] || { items: [snap], index: 0 };
      const updated = cur.items.slice(0, cur.index + 1);
      return {
        ...prev,
        [activeTabId]: {
          items: [...updated, snap],
          index: updated.length,
        },
      };
    });
  }, [activeTabId, rawElements, activeCanvasByViewport]);

  // Direct canvas settings updater for active viewport
  const setCanvasSettings = useCallback((updaterOrPartial) => {
    setHasUnsavedChanges(true);
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const byVp = t.canvasByViewport || createDefaultCanvasByViewport();
      const cur = byVp[viewportMode] || byVp.desktop;
      const patch = typeof updaterOrPartial === 'function' ? updaterOrPartial(cur) : updaterOrPartial;
      const nextByVp = {
        ...byVp,
        [viewportMode]: { ...cur, ...patch },
      };
      latestTabSnapshotRef.current[t.id] = { elements: t.elements, canvasByViewport: nextByVp };
      return { ...t, canvasByViewport: nextByVp };
    }));
  }, [activeTabId, viewportMode]);

  // Direct element modification in active viewport (synchronously updates snapshot ref so immediate commits never go stale)
  const handleUpdateElement = (updates) => {
    if (selectedIds.length === 0) return;
    const targetId = selectedIds[0];
    const currentSnap = latestTabSnapshotRef.current[activeTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    const nextRaw = applyNodeUpdateForViewport(currentSnap.elements, targetId, updates, viewportMode);
    latestTabSnapshotRef.current[activeTabId] = {
      elements: nextRaw,
      canvasByViewport: currentSnap.canvasByViewport,
    };
    setHasUnsavedChanges(true);
    setTabs(prevTabs => prevTabs.map(t => (
      t.id === activeTabId ? { ...t, elements: nextRaw } : t
    )));
  };

  // Direct element modification with history (accepts explicit element id)
  const handleUpdateElementDirect = (id, updates) => {
    const newRaw = applyNodeUpdateForViewport(rawElements, id, updates, viewportMode);
    updateElementsWithHistory(newRaw);
  };

  // Multiple elements modification across the tree for active viewport
  const handleUpdateMultipleElements = (updatesMap) => {
    const currentSnap = latestTabSnapshotRef.current[activeTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    const nextRaw = applyMultipleUpdatesForViewport(currentSnap.elements, updatesMap, viewportMode);
    latestTabSnapshotRef.current[activeTabId] = {
      elements: nextRaw,
      canvasByViewport: currentSnap.canvasByViewport,
    };
    setHasUnsavedChanges(true);
    setTabs(prevTabs => prevTabs.map(t => (
      t.id === activeTabId ? { ...t, elements: nextRaw } : t
    )));
  };

  // Multi-Selection: Set selection cleanly preventing ancestor + descendant coexistence
  const handleSelectElements = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      setSelectedIds([]);
      return;
    }
    // Filter out ancestors if their descendants are in ids
    const allDescendantIds = new Set();
    ids.forEach(id => {
      const found = findNodeAndParent(elements, id);
      if (found && found.node && found.node.children) {
        flattenTree(found.node.children).forEach(d => allDescendantIds.add(d.id));
      }
    });
    // Never allow an ancestor to be selected together with its children
    const cleanIds = ids.filter(id => !allDescendantIds.has(id));
    setSelectedIds(cleanIds);
  }, [elements]);

  // Multi-Selection Toggle with Shift+Click
  const handleToggleElementSelection = useCallback((id) => {
    setSelectedIds(prev => {
      // Find all ancestors of the clicked node
      const nodePath = getNodePath(elements, id);
      const ancestorIds = new Set(nodePath.slice(0, -1).map(n => n.id));

      // Find all descendants of the clicked node
      const found = findNodeAndParent(elements, id);
      const descendantIds = new Set();
      if (found && found.node && found.node.children) {
        flattenTree(found.node.children).forEach(d => descendantIds.add(d.id));
      }

      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        // Strip out any ancestors or descendants of the newly selected element
        const cleanPrev = prev.filter(item => !ancestorIds.has(item) && !descendantIds.has(item));
        return [...cleanPrev, id];
      }
    });
  }, [elements]);

  // Select all (Ctrl+A): Sibling elements at current hierarchy level or root elements
  const handleSelectAll = () => {
    if (selectedIds.length > 0) {
      const parent = findNodeAndParent(elements, selectedIds[0])?.parent;
      const siblings = parent ? (parent.children || []) : elements;
      const visibleSiblingIds = siblings.filter(el => !el.isHidden).map(el => el.id);
      setSelectedIds(visibleSiblingIds);
    } else {
      const rootIds = elements.filter(el => !el.isHidden).map(el => el.id);
      setSelectedIds(rootIds);
    }
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

  // 📋 Copy (Ctrl+C)
  const handleCopy = () => {
    if (selectedIds.length === 0) return;
    const nodes = [];
    const sourceParentMap = {};
    selectedIds.forEach(id => {
      const found = findNodeAndParent(rawElements, id);
      if (found && found.node) {
        nodes.push(found.node);
        sourceParentMap[id] = found.parent ? found.parent.id : null;
      }
    });
    if (nodes.length > 0) {
      setClipboard({ type: 'copy', nodes, sourceParentMap });
    }
  };

  // ✂️ Cut (Ctrl+X)
  const handleCut = () => {
    if (selectedIds.length === 0) return;
    const nodes = [];
    const sourceParentMap = {};
    selectedIds.forEach(id => {
      const found = findNodeAndParent(rawElements, id);
      if (found && found.node) {
        nodes.push(found.node);
        sourceParentMap[id] = found.parent ? found.parent.id : null;
      }
    });
    if (nodes.length === 0) return;

    setClipboard({ type: 'cut', nodes, sourceParentMap });

    let nextTree = rawElements;
    selectedIds.forEach(id => {
      nextTree = removeNodeFromTree(nextTree, id).newTree;
    });
    updateElementsWithHistory(nextTree);
    setSelectedIds([]);
  };

  // 📋 Paste (Ctrl+V)
  const handlePaste = () => {
    if (!clipboard || !clipboard.nodes || clipboard.nodes.length === 0) return;

    let targetParentId = null;
    let targetIndex = -1;

    if (selectedIds.length > 0) {
      const target = findNodeAndParent(rawElements, selectedIds[0]);
      if (target) {
        const isContainer = isExplicitContainer(target.node.type);
        const isSelfOrCopied = clipboard.nodes.some(n => n.id === target.node.id);
        // Only paste INSIDE if target is an explicit container (e.g. div, section) AND not the copied item itself
        if (isContainer && !isSelfOrCopied) {
          targetParentId = target.node.id;
          targetIndex = -1;
        } else if (target.parent) {
          // Otherwise paste as SIBLING in parent
          targetParentId = target.parent.id;
          targetIndex = target.index + 1;
        } else {
          // Canvas root sibling
          targetParentId = null;
          targetIndex = target.index + 1;
        }
      }
    }

    let nextTree = rawElements;
    const newIds = [];

    clipboard.nodes.forEach(node => {
      const sourceParentId = clipboard.sourceParentMap?.[node.id] || null;
      const cloned = cloneSubtreeWithNewIds(node, 0);
      newIds.push(cloned.id);

      // Coordinate placement:
      if (targetParentId === sourceParentId) {
        // Sibling in the same container -> offset 20px from original
        cloned.x = (node.x || 0) + 20;
        cloned.y = (node.y || 0) + 20;
      } else if (!targetParentId) {
        // Target is canvas root -> Convert source's relative coords to canvas-absolute coords!
        const sourceAbs = getAbsoluteCoords(rawElements, node.id);
        const absX = sourceAbs ? sourceAbs.x : (node.x || 0);
        const absY = sourceAbs ? sourceAbs.y : (node.y || 0);
        cloned.x = Math.max(20, absX + 20);
        cloned.y = Math.max(20, absY + 20);
      } else {
        // Target is a different container -> Convert to target container local space
        const sourceAbs = getAbsoluteCoords(rawElements, node.id);
        const targetParentAbs = getAbsoluteCoords(rawElements, targetParentId);
        if (sourceAbs && targetParentAbs) {
          cloned.x = Math.max(10, (sourceAbs.x - targetParentAbs.x) + 20);
          cloned.y = Math.max(10, (sourceAbs.y - targetParentAbs.y) + 20);
        } else {
          cloned.x = (node.x || 0) + 20;
          cloned.y = (node.y || 0) + 20;
        }
      }

      nextTree = insertNodeIntoTree(nextTree, targetParentId, cloned, targetIndex);
      if (targetIndex >= 0) targetIndex++;
    });

    updateElementsWithHistory(nextTree);
    setSelectedIds(newIds);
  };

  // 🪜 Hierarchy Navigation: Esc -> Step out of active editingGroupId, or go up to parent, or deselect
  const handleSelectParent = () => {
    if (editingGroupId) {
      const currentScopeId = editingGroupId;
      const nextScopeId = getParentScopeId(elements, currentScopeId);
      setEditingGroupId(nextScopeId);
      setSelectedIds([currentScopeId]);
      return;
    }
    if (selectedIds.length === 0) return;
    const found = findNodeAndParent(elements, selectedIds[0]);
    if (found && found.parent) {
      setSelectedIds([found.parent.id]);
    } else {
      setSelectedIds([]);
    }
  };

  // 🪜 Hierarchy Navigation: Enter -> Drill into selected container and pick first child
  const handleSelectChild = () => {
    if (selectedIds.length === 0) return;
    const found = findNodeAndParent(elements, selectedIds[0]);
    if (found && found.node && found.node.children && found.node.children.length > 0) {
      setEditingGroupId(found.node.id);
      setSelectedIds([found.node.children[0].id]);
    }
  };

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

  // ⚡ Project Function Editor & Preview Interactive Runtime Handlers
  const handleOpenFunctionEditor = (fnObj = null, bindTargetElementId = null) => {
    const draftFn = fnObj || {
      id: `fn-${Date.now()}`,
      _isNew: true,
      name: 'hesapla',
      params: '',
      editorMode: 'formula',
      formulaSteps: [],
      code: '',
    };
    setFunctionEditorState({
      isOpen: true,
      fnObj: draftFn,
      bindTargetElementId,
    });
  };

  const handleSaveProjectFunction = (savedFn) => {
    const { _isNew, ...cleanFn } = savedFn;
    setProjectFunctions((prev) => {
      const exists = prev.some((f) => f.id === cleanFn.id);
      return exists ? prev.map((f) => (f.id === cleanFn.id ? cleanFn : f)) : [...prev, cleanFn];
    });
    setHasUnsavedChanges(true);

    if (functionEditorState.bindTargetElementId) {
      const targetId = functionEditorState.bindTargetElementId;
      const found = findNodeAndParent(elements, targetId);
      const nextEvents = {
        ...(found?.node?.events || {}),
        onClick: {
          mode: 'function',
          functionId: cleanFn.id,
          functionName: cleanFn.name,
        },
      };
      const nextRaw = applyNodeUpdateForViewport(rawElements, targetId, { events: nextEvents }, viewportMode);
      updateElementsWithHistory(nextRaw);
    }
    showToastMessage(`Fonksiyon kaydedildi: ${cleanFn.name}()`, 'success');
  };

  const handleDeleteProjectFunction = (fnId) => {
    setProjectFunctions((prev) => prev.filter((f) => f.id !== fnId));
    setHasUnsavedChanges(true);
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
        setSelectedIds([]);
        setEditingGroupId(null);
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
  }, []);

  // Reparent element (moving into another container or canvas root while keeping all viewports anchored)
  const handleReparentElement = (sourceId, targetParentId, targetIndex = -1) => {
    const nextTree = reparentNodeForViewport(rawElements, sourceId, targetParentId, targetIndex);
    updateElementsWithHistory(nextTree);
    setSelectedIds([sourceId]);
  };

  // Rename element
  const handleRenameElement = (id, newName) => {
    handleUpdateElementDirect(id, { name: newName });
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

  // Add Element at specific location or default center
  const handleAddElementAt = (elementData) => {
    const rawNewElement = computeBaseFromViewportElement(
      {
        id: `elem-${Date.now()}`,
        positionMode: 'normal',
        zIndex: 1,
        children: [],
        ...elementData,
      },
      viewportMode
    );
    const newElements = [...rawElements, rawNewElement];
    updateElementsWithHistory(newElements);
    setSelectedIds([rawNewElement.id]);
    setActiveTool('select');
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
    const isFullWidth = ['nav', 'header', 'footer', 'section'].includes(tag);
    const canvasW = canvasSettings?.width || 1280;
    const posX = isFullWidth ? 0 : 200;
    const posY = isFullWidth && tag === 'nav' 
      ? 0 
      : Math.max(0, Math.round(-panOffset.y / zoom) + 150);

    const newEl = createTagElement(tag, {
      x: posX,
      y: posY,
      width: isFullWidth ? canvasW : undefined,
      positionMode: tag === 'nav' ? 'sticky' : 'normal',
      style: {
        backgroundColor: tag === 'button' ? primaryColor : undefined,
      }
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

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const snap = history[targetIndex];
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          latestTabSnapshotRef.current[t.id] = snap;
          return { ...t, elements: snap.elements, canvasByViewport: snap.canvasByViewport };
        }
        return t;
      }));
      setHistoryByTab(prev => ({
        ...prev,
        [activeTabId]: { items: history, index: targetIndex },
      }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      const snap = history[targetIndex];
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          latestTabSnapshotRef.current[t.id] = snap;
          return { ...t, elements: snap.elements, canvasByViewport: snap.canvasByViewport };
        }
        return t;
      }));
      setHistoryByTab(prev => ({
        ...prev,
        [activeTabId]: { items: history, index: targetIndex },
      }));
    }
  };

  // Reset Zoom
  const handleResetZoom = () => {
    setZoom(0.85);
    setPanOffset({ x: 80, y: 30 });
  };

  const handleSelectRightDockTarget = (moduleName, subTab = null) => {
    if (!rightDockOpen) {
      setRightDockModule(moduleName);
      if (moduleName === 'properties' && subTab) setRightPropertiesTab(subTab);
      setRightDockOpen(true);
      return;
    }
    if (rightDockModule !== moduleName) {
      setRightDockModule(moduleName);
      if (moduleName === 'properties' && subTab) setRightPropertiesTab(subTab);
      return;
    }
    if (moduleName === 'properties' && subTab && rightPropertiesTab !== subTab) {
      setRightPropertiesTab(subTab);
      return;
    }
    setRightDockOpen(false);
  };

  const handleDockFloatingInspector = (targetTab = 'css') => {
    setShowAttributesInspectorModal(false);
    setRightDockModule('properties');
    setRightPropertiesTab(targetTab || 'css');
    setRightDockOpen(true);
  };

  const togglePanel = (panelName) => {
    if (panelName === 'layers') {
      setLeftSidebarTab(prev => (prev === 'layers' ? null : 'layers'));
      return;
    }
    if (panelName === 'assets') {
      setLeftSidebarTab(prev => (prev === 'templates' ? null : 'templates'));
      return;
    }
    if (panelName === 'attributesAndCss') {
      setShowAttributesInspectorModal(prev => !prev);
      return;
    }
    if (panelName === 'properties' || panelName === 'aiAgent') {
      handleSelectRightDockTarget(panelName);
    }
  };

  const handleAddTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab = buildTabState(newTabId, `Sayfa-${tabs.length + 1}.craft`, []);
    setTabs([...tabs, newTab]);
    setTabHistory(newTabId, { elements: [], canvasByViewport: newTab.canvasByViewport });
    setActiveTabId(newTabId);
    setHasUnsavedChanges(true);
  };

  const handleCloseTab = (tabId) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
    setHasUnsavedChanges(true);
  };

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

  // Switch between Desktop / Tablet / Mobile, auto-adapting on first visit & keeping each device remembered
  const handleSwitchViewport = useCallback((nextViewport) => {
    if (!['desktop', 'tablet', 'mobile'].includes(nextViewport)) return;
    setViewportMode(nextViewport);

    if (nextViewport === 'desktop') return;

    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      const byVp = t.canvasByViewport || createDefaultCanvasByViewport();
      const alreadyInitialized = Boolean(t.initializedViewports?.[nextViewport]);
      const { tree, changed, suggestedHeight } = ensureViewportAdapted(t.elements, nextViewport, {
        forceReset: false,
        desktopWidth: byVp.desktop?.width || 1280,
      });

      if (!changed && alreadyInitialized) {
        return t;
      }

      const nextByVp = !alreadyInitialized
        ? {
            ...byVp,
            [nextViewport]: {
              ...(byVp[nextViewport] || getViewportPreset(nextViewport)),
              height: suggestedHeight,
            },
          }
        : byVp;

      const updatedTab = {
        ...t,
        elements: changed ? tree : t.elements,
        canvasByViewport: nextByVp,
        initializedViewports: {
          ...(t.initializedViewports || { desktop: true }),
          [nextViewport]: true,
        },
      };
      latestTabSnapshotRef.current[t.id] = {
        elements: updatedTab.elements,
        canvasByViewport: updatedTab.canvasByViewport,
      };
      return updatedTab;
    }));
  }, [activeTabId]);

  // Re-adapt current Tablet / Mobile design cleanly from Desktop layout (with Undo support)
  const handleResetViewportFromDesktop = useCallback(() => {
    if (viewportMode === 'desktop') return;
    const { tree, suggestedHeight } = ensureViewportAdapted(rawElements, viewportMode, {
      forceReset: true,
      desktopWidth: activeCanvasByViewport.desktop?.width || 1280,
    });
    const nextByVp = {
      ...activeCanvasByViewport,
      [viewportMode]: {
        ...(activeCanvasByViewport[viewportMode] || getViewportPreset(viewportMode)),
        height: suggestedHeight,
      },
    };
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id !== activeTabId) return t;
      return {
        ...t,
        initializedViewports: { ...(t.initializedViewports || { desktop: true }), [viewportMode]: true },
      };
    }));
    updateElementsWithHistory(tree, nextByVp);
  }, [viewportMode, rawElements, activeCanvasByViewport, activeTabId, updateElementsWithHistory]);

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

    setTabs(loadedTabs);
    setHistoryByTab(nextHistory);
    setActiveTabId(resolvedActiveId);
    setViewportMode(schema.viewportMode || 'desktop');
    setProjectFunctions(Array.isArray(schema.projectFunctions) ? schema.projectFunctions : []);
    setProjectMeta({
      id: schema.id,
      name: finalName,
      filePath: nextFilePath,
      createdAt: schema.createdAt || new Date().toISOString(),
    });
    setHasUnsavedChanges(false);
    setSelectedIds([]);
    setEditingGroupId(null);
    setPreviewMode(false);
    setPreviewRuntimeOverrides({});
    setShowWelcomeScreen(false);

    const updatedRecent = upsertRecentProject({
      ...schema,
      name: finalName,
      filePath: nextFilePath,
    });
    setRecentProjects(updatedRecent);
  }, []);

  // Debounced autosave draft in localStorage whenever user edits an open project
  useEffect(() => {
    if (showWelcomeScreen || !hasUnsavedChanges) return undefined;
    const timer = setTimeout(() => {
      const schema = buildSerializableProjectSchema({
        id: projectMeta.id,
        name: projectMeta.name,
        filePath: projectMeta.filePath,
        tabs,
        activeTabId,
        viewportMode,
        projectFunctions,
        createdAt: projectMeta.createdAt,
      });
      saveAutosaveDraft(schema);
    }, 1500);
    return () => clearTimeout(timer);
  }, [showWelcomeScreen, hasUnsavedChanges, projectMeta, tabs, activeTabId, viewportMode, projectFunctions]);

  // Welcome Screen & New Project actions
  const handleStartNewProject = (type) => {
    const newProjId = `proj-${Date.now()}`;
    const newTabId = `tab-${Date.now()}`;
    setProjectFunctions([]);
    setPreviewMode(false);
    setPreviewRuntimeOverrides({});
    setSelectedIds([]);
    setEditingGroupId(null);
    setHasUnsavedChanges(false);

    if (type === 'universal' || type === 'jewelry') {
      const newTab = buildTabState(newTabId, 'Web-Sayfasi.craft', DEFAULT_UNIVERSAL_PROJECT, { width: 1280, height: 1350, backgroundColor: '#0f172a' });
      setTabs([newTab]);
      setTabHistory(newTabId, { elements: newTab.elements, canvasByViewport: newTab.canvasByViewport });
      setActiveTabId(newTabId);
      setViewportMode('desktop');
      setProjectMeta({ id: newProjId, name: 'Modern Takı & Landing Demosu', filePath: null, createdAt: new Date().toISOString() });
    } else if (type === 'blank') {
      const newTab = buildTabState(newTabId, 'Yeni-Tasarim.craft', [], { width: 1280, height: 1200, backgroundColor: '#ffffff' });
      setTabs([newTab]);
      setTabHistory(newTabId, { elements: [], canvasByViewport: newTab.canvasByViewport });
      setActiveTabId(newTabId);
      setViewportMode('desktop');
      setProjectMeta({ id: newProjId, name: 'Yeni Boş Proje', filePath: null, createdAt: new Date().toISOString() });
    } else if (type === 'mobile') {
      const adapted = ensureViewportAdapted(DEFAULT_UNIVERSAL_PROJECT, 'mobile', { forceReset: true });
      const byVp = createDefaultCanvasByViewport({ width: 1280, height: 1350, backgroundColor: '#0f172a' });
      byVp.mobile.height = adapted.suggestedHeight;
      const newTab = {
        ...buildTabState(newTabId, 'Mobil-Web.craft', adapted.tree, byVp),
        initializedViewports: { desktop: true, tablet: false, mobile: true },
      };
      setTabs([newTab]);
      setTabHistory(newTabId, { elements: newTab.elements, canvasByViewport: newTab.canvasByViewport });
      setActiveTabId(newTabId);
      setViewportMode('mobile');
      setProjectMeta({ id: newProjId, name: 'Mobil Tasarım Projesi', filePath: null, createdAt: new Date().toISOString() });
    }
    setShowWelcomeScreen(false);
  };

  const handleRenameProject = (nextName) => {
    setProjectMeta((prev) => ({ ...prev, name: nextName }));
    setHasUnsavedChanges(true);
  };

  // 💾 Save Project (.craft.json via Electron native dialog OR Web storage + download)
  const handleSaveProject = useCallback(async (saveAs = false) => {
    try {
      const schema = buildSerializableProjectSchema({
        id: projectMeta.id || `proj-${Date.now()}`,
        name: projectMeta.name || 'CraftStudio Projesi',
        filePath: saveAs ? null : projectMeta.filePath,
        tabs,
        activeTabId,
        viewportMode,
        projectFunctions,
        createdAt: projectMeta.createdAt,
      });

      if (window.electronAPI?.saveProjectFile) {
        const res = await window.electronAPI.saveProjectFile({
          filePath: saveAs ? null : projectMeta.filePath,
          saveAs,
          defaultFileName: `${(schema.name || 'proje').toLowerCase().replace(/[^a-z0-9-_ğüşıöç]+/gi, '-')}.craft.json`,
          content: JSON.stringify({ ...schema, filePath: undefined }, null, 2),
        });
        if (!res || res.canceled) return;
        if (!res.success) {
          showToastMessage(`Kaydetme hatası: ${res.error}`, 'error');
          return;
        }
        const savedSchema = { ...schema, filePath: res.filePath, name: projectMeta.name || res.name };
        setProjectMeta((prev) => ({
          ...prev,
          id: savedSchema.id,
          name: savedSchema.name,
          filePath: res.filePath,
          createdAt: savedSchema.createdAt,
        }));
        saveProjectToWebStorage(savedSchema);
        setRecentProjects(upsertRecentProject(savedSchema));
        setHasUnsavedChanges(false);
        showToastMessage(`✓ Kaydedildi: ${res.fileName}`, 'success');
        return;
      }

      // Web / Browser mode persistence (+ file download on Save As)
      saveProjectToWebStorage(schema);
      saveAutosaveDraft(schema);
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
  }, [projectMeta, tabs, activeTabId, viewportMode, projectFunctions, showToastMessage]);

  // 📂 Open parsed JSON project object directly
  const handleOpenProject = (importedData) => {
    try {
      applyLoadedProjectSchema(importedData);
      showToastMessage('✓ Proje başarıyla yüklendi.', 'success');
    } catch (err) {
      showToastMessage(`Proje açılamadı: ${err.message}`, 'error');
    }
  };

  // 📂 Open .craft.json file via Electron dialog OR browser file picker
  const handleOpenProjectFile = useCallback(async () => {
    try {
      if (window.electronAPI?.openProjectFileDialog) {
        const res = await window.electronAPI.openProjectFileDialog();
        if (!res || res.canceled) return;
        if (!res.success) {
          showToastMessage(`Dosya açılamadı: ${res.error}`, 'error');
          return;
        }
        applyLoadedProjectSchema(res.content, { filePath: res.filePath });
        showToastMessage(`✓ Açıldı: ${res.fileName}`, 'success');
        return;
      }
      projectFileInputRef.current?.click();
    } catch (err) {
      showToastMessage(`Dosya açma hatası: ${err.message}`, 'error');
    }
  }, [applyLoadedProjectSchema, showToastMessage]);

  const handleProjectFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyLoadedProjectSchema(ev.target?.result);
        showToastMessage(`✓ Açıldı: ${file.name}`, 'success');
      } catch (err) {
        alert(`Geçersiz proje dosyası: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 📂 Open Project Folder (Supports craft.project.json OR external HTML/JSX with Babel & isolated renderer)
  const handleOpenProjectFolder = async () => {
    try {
      if (window.electronAPI?.openProjectDialog) {
        const res = await window.electronAPI.openProjectDialog();
        if (res && !res.canceled) {
          if (res.error) {
            alert('İçe aktarma hatası: ' + res.error);
            return;
          }
          setImportReportData(res);
          setShowImportReportModal(true);
        }
      } else {
        alert('Klasör içe aktarma masaüstü (Electron) uygulamasında kullanılabilir. Dosya açmak için .craft.json seçebilirsiniz.');
      }
    } catch (err) {
      console.error('Error opening project folder:', err);
      alert('Proje açılırken bir hata oluştu: ' + err.message);
    }
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
      if (proj.filePath && window.electronAPI?.readProjectFile) {
        const res = await window.electronAPI.readProjectFile(proj.filePath);
        if (res && res.success) {
          applyLoadedProjectSchema(res.content, { filePath: res.filePath });
          return;
        }
      }
      if (proj.folderPath && window.electronAPI?.importProjectFolder) {
        const res = await window.electronAPI.importProjectFolder(proj.folderPath);
        if (res && res.success) {
          applyLoadedProjectSchema(res);
          return;
        }
      }
      if (proj.snapshot) {
        applyLoadedProjectSchema(proj.snapshot, { filePath: proj.filePath || null });
        return;
      }
      if (proj.elements) {
        applyLoadedProjectSchema({
          id: proj.id,
          name: proj.name,
          elements: proj.elements,
          canvasByViewport: proj.canvasByViewport || { width: proj.width || 1280, height: proj.height || 1350, backgroundColor: '#0f172a' },
        });
      }
    } catch (err) {
      showToastMessage(`Son proje açılamadı: ${err.message}`, 'error');
    }
  };

  const handleDeleteRecentProject = (projectId) => {
    setRecentProjects(removeRecentProject(projectId));
  };

  // 🌟 GLOBAL KEYBOARD SHORTCUTS (Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+Shift+O, Ctrl+E, Ctrl+A/G/C/X/V, Esc, Enter, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      const isCtrl = e.ctrlKey || e.metaKey;

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

      // 2. Ctrl+C -> Copy
      if (isCtrl && e.key.toLowerCase() === 'c') {
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

      // 4. Ctrl+V -> Paste
      if (isCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
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
        } else {
          handleSelectParent();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectChild();
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'r') {
        setActiveTool('rectangle');
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('hand');
      } else if (e.key.toLowerCase() === 't') {
        setActiveTool('text');
      } else if (isCtrl && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showWelcomeScreen, selectedIds, editingGroupId, historyIndex, history, previewMode,
    showExportModal, showTutorial, showAddTagModal, showImportReportModal,
    showAttributesInspectorModal, functionEditorState?.isOpen,
    elements, rawElements, viewportMode, clipboard, updateElementsWithHistory,
    handleSaveProject, handleOpenProjectFile, handleTogglePreviewMode
  ]);

  // Ensure any tab switched to while already in Tablet/Mobile is initialized for that viewport
  useEffect(() => {
    if (viewportMode !== 'desktop' && !activeTab.initializedViewports?.[viewportMode]) {
      handleSwitchViewport(viewportMode);
    }
  }, [activeTabId, viewportMode, activeTab.initializedViewports, handleSwitchViewport]);

  const selectedElement = selectedIds.length > 0 
    ? findNodeAndParent(elements, selectedIds[0])?.node || null 
    : null;

  const effectiveActivePanels = {
    properties: rightDockOpen && rightDockModule === 'properties',
    aiAgent: rightDockOpen && rightDockModule === 'aiAgent',
    layers: leftSidebarTab === 'layers',
    assets: leftSidebarTab === 'templates' || leftSidebarTab === 'elements',
    attributesAndCss: showAttributesInspectorModal,
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0d12] text-slate-200 select-none overflow-hidden font-sans relative">
      {/* Hidden browser file picker for opening .craft.json inside workspace */}
      <input
        type="file"
        ref={projectFileInputRef}
        onChange={handleProjectFileInputChange}
        accept=".json,.craft"
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
          onOpenProject={handleOpenProject}
          onOpenProjectFile={handleOpenProjectFile}
          onOpenProjectFolder={handleOpenProjectFolder}
          onOpenRecentProject={handleOpenRecentProject}
          onDeleteRecentProject={handleDeleteRecentProject}
          recentProjects={recentProjects}
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
              setSelectedIds([]);
              setEditingGroupId(null);
              setPreviewRuntimeOverrides({});
            }}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
            previewMode={previewMode}
            setPreviewMode={handleTogglePreviewMode}
            onOpenExportModal={() => setShowExportModal(true)}
            onOpenProjectFolder={handleOpenProjectFolder}
            onOpenProjectFile={handleOpenProjectFile}
            onSaveProject={handleSaveProject}
            projectName={projectMeta.name}
            onRenameProject={handleRenameProject}
            hasUnsavedChanges={hasUnsavedChanges}
            viewportMode={viewportMode}
            setViewportMode={handleSwitchViewport}
            rawElements={rawElements}
            onGoHome={() => setShowWelcomeScreen(true)}
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
                onGroupSelected={handleGroupSelected}
                onUngroupSelected={handleUngroupSelected}
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
                onToggleAIAgent={() => togglePanel('aiAgent')}
                isAIAgentOpen={rightDockOpen && rightDockModule === 'aiAgent'}
                viewportMode={viewportMode}
              />
            )}

            {/* Center Canvas */}
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
              secondaryColor={secondaryColor}
              onAddElementAt={handleAddElementAt}
              editingGroupId={editingGroupId}
              setEditingGroupId={setEditingGroupId}
              viewportMode={viewportMode}
              onResetViewportFromDesktop={handleResetViewportFromDesktop}
            />

            {/* Unified Adobe Right Dock + Vertical Icon Rail */}
            {!previewMode && (
              <StudioRightDock
                isOpen={rightDockOpen}
                activeModule={rightDockModule}
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
                aiAgentContent={(
                  <AIAgentPanel
                    elements={elements}
                    onUpdateElements={(nextResolved) => {
                      const synced = syncViewportTreeDiffs(rawElements, nextResolved, viewportMode);
                      updateElementsWithHistory(synced);
                    }}
                    selectedIds={selectedIds}
                    onClose={() => setRightDockOpen(false)}
                  />
                )}
              />
            )}
          </div>
        </>
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
