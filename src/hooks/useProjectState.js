import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_UNIVERSAL_PROJECT } from '../constants';
import { findNodeAndParent } from '../utils/treeUtils';
import {
  createDefaultCanvasByViewport,
  resolveTreeForViewport,
  applyNodeUpdateForViewport,
  applyMultipleUpdatesForViewport,
  ensureViewportAdapted,
  getViewportPreset,
} from '../utils/responsiveUtils';
import { slugifyTabRoute } from '../utils/projectStorage';
import { buildTabState } from '../utils/projectAssemblyUtils';

const INITIAL_PROJECT_META = {
  id: 'proj-initial',
  name: 'CraftStudio Projesi',
  filePath: null,
  createdAt: null,
};

function createInitialTabs() {
  return [
    buildTabState('tab-1', 'Anasayfa.craft', DEFAULT_UNIVERSAL_PROJECT),
    buildTabState('tab-2', 'Özellikler.craft', []),
  ];
}

function createInitialHistoryByTab() {
  return {
    'tab-1': {
      items: [{ elements: DEFAULT_UNIVERSAL_PROJECT, canvasByViewport: createDefaultCanvasByViewport() }],
      index: 0,
    },
    'tab-2': {
      items: [{ elements: [], canvasByViewport: createDefaultCanvasByViewport() }],
      index: 0,
    },
  };
}

function createHistoryMapFromTabs(tabList) {
  const historyMap = {};
  tabList.forEach((tab) => {
    historyMap[tab.id] = {
      items: [{ elements: tab.elements, canvasByViewport: tab.canvasByViewport }],
      index: 0,
    };
  });
  return historyMap;
}

/**
 * Project tabs, active viewport resolution, undo/redo history ring, and metadata hook.
 * Owns `latestTabSnapshotRef + setTabs + historyByTab` atomically so live drags and commits never drift.
 * Input:  none (calls no other hooks; cross-hook side effects stay in App.jsx coordinators)
 * Output: {
 *   tabs, setTabs, activeTabId, setActiveTabId, viewportMode, setViewportMode,
 *   activeTab, rawElements, elements, activeCanvasByViewport, canvasSettings,
 *   projectMeta, setProjectMeta, hasUnsavedChanges, setHasUnsavedChanges,
 *   projectFunctions, setProjectFunctions, pageLinks, setPageLinks,
 *   historyByTab, setHistoryByTab, history, historyIndex,
 *   setTabHistory, updateElementsWithHistory, handleCommitHistory, setCanvasSettings,
 *   updateActiveTabElement, handleUpdateElementDirect, handleUpdateMultipleElements, handleRenameElement,
 *   handleUndo, handleRedo,
 *   handleAddTab, handleCloseTab, handleRenameTab,
 *   switchViewportMode, handleResetViewportFromDesktop,
 *   handleRenameProject, saveProjectFunction, handleDeleteProjectFunction,
 *   reset,
 * }
 */
export function useProjectState() {
  const [tabs, setTabs] = useState(createInitialTabs);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [viewportMode, setViewportMode] = useState('desktop');

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const rawElements = activeTab.elements;
  const elements = useMemo(
    () => resolveTreeForViewport(rawElements, viewportMode),
    [rawElements, viewportMode]
  );

  const activeCanvasByViewport = activeTab.canvasByViewport || createDefaultCanvasByViewport();
  const canvasSettings = activeCanvasByViewport[viewportMode] || activeCanvasByViewport.desktop;

  const [projectMeta, setProjectMeta] = useState(INITIAL_PROJECT_META);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [projectFunctions, setProjectFunctions] = useState([]);
  const [pageLinks, setPageLinks] = useState([]);

  const [historyByTab, setHistoryByTab] = useState(createInitialHistoryByTab);
  const currentTabHistory = historyByTab[activeTab.id] || {
    items: [{ elements: rawElements, canvasByViewport: activeCanvasByViewport }],
    index: 0,
  };
  const history = currentTabHistory.items;
  const historyIndex = currentTabHistory.index;

  // Synchronous ref snapshot + loop guard kept private inside the project state capsule
  const latestTabSnapshotRef = useRef({});
  const autoAdaptedPairsRef = useRef(new Set());
  const tabIdSeqRef = useRef(0);

  useEffect(() => {
    latestTabSnapshotRef.current[activeTab.id] = {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
  }, [activeTab.id, rawElements, activeCanvasByViewport]);

  const setTabHistory = useCallback((tabId, snapshot) => {
    latestTabSnapshotRef.current[tabId] = snapshot;
    setHistoryByTab((prev) => ({
      ...prev,
      [tabId]: { items: [snapshot], index: 0 },
    }));
  }, []);

  const updateElementsWithHistory = useCallback((newRawElements, nextCanvasByViewport = null) => {
    const targetTabId = activeTab.id;
    let resolvedCanvasByVp = nextCanvasByViewport;
    setTabs((prevTabs) => prevTabs.map((t) => {
      if (t.id === targetTabId) {
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
    setHistoryByTab((prev) => {
      const cur = prev[targetTabId] || { items: [{ elements: rawElements, canvasByViewport: activeCanvasByViewport }], index: 0 };
      const updated = cur.items.slice(0, cur.index + 1);
      return {
        ...prev,
        [targetTabId]: {
          items: [...updated, snapshot],
          index: updated.length,
        },
      };
    });
  }, [activeTab.id, activeCanvasByViewport, rawElements]);

  const handleCommitHistory = useCallback(() => {
    const targetTabId = activeTab.id;
    const snap = latestTabSnapshotRef.current[targetTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    setHasUnsavedChanges(true);
    setHistoryByTab((prev) => {
      const cur = prev[targetTabId] || { items: [snap], index: 0 };
      const updated = cur.items.slice(0, cur.index + 1);
      return {
        ...prev,
        [targetTabId]: {
          items: [...updated, snap],
          index: updated.length,
        },
      };
    });
  }, [activeTab.id, rawElements, activeCanvasByViewport]);

  const setCanvasSettings = useCallback((updaterOrPartial) => {
    const targetTabId = activeTab.id;
    setHasUnsavedChanges(true);
    setTabs((prevTabs) => prevTabs.map((t) => {
      if (t.id !== targetTabId) return t;
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
  }, [activeTab.id, viewportMode]);

  const updateActiveTabElement = useCallback((targetId, updates) => {
    if (!targetId) return;
    const targetTabId = activeTab.id;
    const currentSnap = latestTabSnapshotRef.current[targetTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    const nextRaw = applyNodeUpdateForViewport(currentSnap.elements, targetId, updates, viewportMode);
    latestTabSnapshotRef.current[targetTabId] = {
      elements: nextRaw,
      canvasByViewport: currentSnap.canvasByViewport,
    };
    setHasUnsavedChanges(true);
    setTabs((prevTabs) => prevTabs.map((t) => (
      t.id === targetTabId ? { ...t, elements: nextRaw } : t
    )));
  }, [activeTab.id, rawElements, activeCanvasByViewport, viewportMode]);

  const handleUpdateElementDirect = useCallback((id, updates) => {
    const newRaw = applyNodeUpdateForViewport(rawElements, id, updates, viewportMode);
    updateElementsWithHistory(newRaw);
  }, [rawElements, viewportMode, updateElementsWithHistory]);

  const handleUpdateMultipleElements = useCallback((updatesMap) => {
    const targetTabId = activeTab.id;
    const currentSnap = latestTabSnapshotRef.current[targetTabId] || {
      elements: rawElements,
      canvasByViewport: activeCanvasByViewport,
    };
    const nextRaw = applyMultipleUpdatesForViewport(currentSnap.elements, updatesMap, viewportMode);
    latestTabSnapshotRef.current[targetTabId] = {
      elements: nextRaw,
      canvasByViewport: currentSnap.canvasByViewport,
    };
    setHasUnsavedChanges(true);
    setTabs((prevTabs) => prevTabs.map((t) => (
      t.id === targetTabId ? { ...t, elements: nextRaw } : t
    )));
  }, [activeTab.id, rawElements, activeCanvasByViewport, viewportMode]);

  const handleRenameElement = useCallback((id, newName) => {
    handleUpdateElementDirect(id, { name: newName });
  }, [handleUpdateElementDirect]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetTabId = activeTab.id;
      const targetIndex = historyIndex - 1;
      const snap = history[targetIndex];
      latestTabSnapshotRef.current[targetTabId] = snap;
      setTabs((prevTabs) => prevTabs.map((t) => (
        t.id === targetTabId
          ? { ...t, elements: snap.elements, canvasByViewport: snap.canvasByViewport }
          : t
      )));
      setHistoryByTab((prev) => ({
        ...prev,
        [targetTabId]: { items: history, index: targetIndex },
      }));
    }
  }, [activeTab.id, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetTabId = activeTab.id;
      const targetIndex = historyIndex + 1;
      const snap = history[targetIndex];
      latestTabSnapshotRef.current[targetTabId] = snap;
      setTabs((prevTabs) => prevTabs.map((t) => (
        t.id === targetTabId
          ? { ...t, elements: snap.elements, canvasByViewport: snap.canvasByViewport }
          : t
      )));
      setHistoryByTab((prev) => ({
        ...prev,
        [targetTabId]: { items: history, index: targetIndex },
      }));
    }
  }, [activeTab.id, history, historyIndex]);

  const handleAddTab = useCallback(() => {
    tabIdSeqRef.current += 1;
    const newTabId = `tab-${Date.now()}-${tabIdSeqRef.current}`;
    const newTab = buildTabState(newTabId, `Sayfa-${tabs.length + 1}.craft`, []);
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setTabHistory(newTabId, { elements: [], canvasByViewport: newTab.canvasByViewport });
    setActiveTabId(newTabId);
    setHasUnsavedChanges(true);
  }, [tabs.length, setTabHistory]);

  const handleCloseTab = useCallback((tabId) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === tabs.length) return;
    delete latestTabSnapshotRef.current[tabId];
    for (const key of Array.from(autoAdaptedPairsRef.current)) {
      if (key.startsWith(`${tabId}:`)) {
        autoAdaptedPairsRef.current.delete(key);
      }
    }
    setHistoryByTab((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, tabId)) return prev;
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
    setHasUnsavedChanges(true);
  }, [tabs, activeTabId]);

  const handleRenameTab = useCallback((tabId, nextName) => {
    const cleaned = String(nextName || '').trim();
    if (!cleaned) return;
    setTabs((prevTabs) =>
      prevTabs.map((t, idx) =>
        t.id === tabId
          ? { ...t, name: cleaned, route: slugifyTabRoute(cleaned, idx) }
          : t
      )
    );
    setHasUnsavedChanges(true);
  }, []);

  const switchViewportMode = useCallback((nextViewport) => {
    if (!['desktop', 'tablet', 'mobile'].includes(nextViewport)) return false;
    setViewportMode(nextViewport);

    if (nextViewport === 'desktop') return true;

    const targetTabId = activeTab.id;
    setTabs((prevTabs) => prevTabs.map((t) => {
      if (t.id !== targetTabId) return t;
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

    return true;
  }, [activeTab.id]);

  // Ensure any tab switched to while already in Tablet/Mobile is adapted at most once per (tabId, viewportMode)
  useEffect(() => {
    if (viewportMode === 'desktop') return;
    if (activeTab.initializedViewports?.[viewportMode]) return;
    const pairKey = `${activeTab.id}:${viewportMode}`;
    if (autoAdaptedPairsRef.current.has(pairKey)) return;
    autoAdaptedPairsRef.current.add(pairKey);
    switchViewportMode(viewportMode);
  }, [activeTab.id, viewportMode, activeTab.initializedViewports, switchViewportMode]);

  const handleResetViewportFromDesktop = useCallback(() => {
    if (viewportMode === 'desktop') return;
    const targetTabId = activeTab.id;
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
    setTabs((prevTabs) => prevTabs.map((t) => {
      if (t.id !== targetTabId) return t;
      return {
        ...t,
        initializedViewports: { ...(t.initializedViewports || { desktop: true }), [viewportMode]: true },
      };
    }));
    updateElementsWithHistory(tree, nextByVp);
  }, [viewportMode, rawElements, activeCanvasByViewport, activeTab.id, updateElementsWithHistory]);

  const handleRenameProject = useCallback((nextName) => {
    setProjectMeta((prev) => ({ ...prev, name: nextName }));
    setHasUnsavedChanges(true);
  }, []);

  const saveProjectFunction = useCallback((savedFn, bindTargetElementId = null) => {
    const { _isNew, ...cleanFn } = savedFn;
    setProjectFunctions((prev) => {
      const exists = prev.some((f) => f.id === cleanFn.id);
      return exists ? prev.map((f) => (f.id === cleanFn.id ? cleanFn : f)) : [...prev, cleanFn];
    });
    setHasUnsavedChanges(true);

    if (bindTargetElementId) {
      const found = findNodeAndParent(elements, bindTargetElementId);
      const nextEvents = {
        ...(found?.node?.events || {}),
        onClick: {
          mode: 'function',
          functionId: cleanFn.id,
          functionName: cleanFn.name,
        },
      };
      const nextRaw = applyNodeUpdateForViewport(rawElements, bindTargetElementId, { events: nextEvents }, viewportMode);
      updateElementsWithHistory(nextRaw);
    }

    return cleanFn;
  }, [elements, rawElements, viewportMode, updateElementsWithHistory]);

  const handleDeleteProjectFunction = useCallback((fnId) => {
    setProjectFunctions((prev) => prev.filter((f) => f.id !== fnId));
    setHasUnsavedChanges(true);
  }, []);

  const reset = useCallback((nextState = {}) => {
    const resolvedTabs = Array.isArray(nextState.tabs) && nextState.tabs.length > 0
      ? nextState.tabs
      : createInitialTabs();
    const resolvedActiveTabId = nextState.activeTabId
      && resolvedTabs.some((t) => t.id === nextState.activeTabId)
      ? nextState.activeTabId
      : resolvedTabs[0].id;
    const resolvedHistory = nextState.historyByTab || createHistoryMapFromTabs(resolvedTabs);

    const snapshotMap = {};
    resolvedTabs.forEach((tab) => {
      snapshotMap[tab.id] = {
        elements: tab.elements,
        canvasByViewport: tab.canvasByViewport,
      };
    });
    latestTabSnapshotRef.current = snapshotMap;
    autoAdaptedPairsRef.current.clear();

    setTabs(resolvedTabs);
    setHistoryByTab(resolvedHistory);
    setActiveTabId(resolvedActiveTabId);
    setViewportMode(nextState.viewportMode || 'desktop');
    setProjectMeta(nextState.projectMeta ? { ...nextState.projectMeta } : { ...INITIAL_PROJECT_META });
    setHasUnsavedChanges(Boolean(nextState.hasUnsavedChanges));
    setProjectFunctions(Array.isArray(nextState.projectFunctions) ? nextState.projectFunctions : []);
    setPageLinks(Array.isArray(nextState.pageLinks) ? nextState.pageLinks : []);
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    viewportMode,
    setViewportMode,
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
    setProjectFunctions,
    pageLinks,
    setPageLinks,
    historyByTab,
    setHistoryByTab,
    history,
    historyIndex,
    setTabHistory,
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
    reset,
  };
}
