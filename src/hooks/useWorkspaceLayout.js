import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_STUDIO_MODE,
  DEFAULT_RIGHT_DOCK_WIDTH,
  STUDIO_MODES,
  getStudioModeConfig,
  isValidStudioMode,
} from '../data/studioModesRegistry.js';

export const INITIAL_FUNCTION_EDITOR_STATE = {
  isOpen: false,
  fnObj: null,
  bindTargetElementId: null,
};

export function createModeLayoutsMap(overrides = {}) {
  const designDefault = STUDIO_MODES.design.defaultLayout;
  const backendDefault = STUDIO_MODES.backend.defaultLayout;
  return {
    design: {
      leftDrawer: {
        activeTab: overrides.design?.leftDrawer?.activeTab !== undefined
          ? overrides.design.leftDrawer.activeTab
          : designDefault.leftDrawer.activeTab,
      },
      rightDock: {
        isOpen: overrides.design?.rightDock?.isOpen ?? designDefault.rightDock.isOpen,
        propertiesTab: overrides.design?.rightDock?.propertiesTab || designDefault.rightDock.propertiesTab,
        width: overrides.design?.rightDock?.width || DEFAULT_RIGHT_DOCK_WIDTH,
      },
    },
    backend: {
      leftDrawer: {
        activeTab: overrides.backend?.leftDrawer?.activeTab !== undefined
          ? overrides.backend.leftDrawer.activeTab
          : backendDefault.leftDrawer.activeTab,
      },
      rightDock: {
        isOpen: overrides.backend?.rightDock?.isOpen ?? backendDefault.rightDock.isOpen,
        propertiesTab: overrides.backend?.rightDock?.propertiesTab || backendDefault.rightDock.propertiesTab,
        width: overrides.backend?.rightDock?.width || DEFAULT_RIGHT_DOCK_WIDTH,
      },
    },
  };
}

export function createInitialWorkspaceLayout() {
  const layoutsByMode = createModeLayoutsMap();
  const activeMode = DEFAULT_STUDIO_MODE;
  const currentSlice = layoutsByMode[activeMode];
  return {
    showWelcomeScreen: true,
    activeMode,
    activeTool: STUDIO_MODES[activeMode].tools?.defaultToolId || 'select',
    openPopover: null,
    layoutsByMode,
    // Compatibility aliases synced with layoutsByMode[activeMode]
    leftDrawer: currentSlice.leftDrawer,
    rightDock: currentSlice.rightDock,
    aiDock: {
      isMinimized: false,
      focusSignal: 0,
    },
    modals: {
      tutorial: false,
      export: false,
      addTag: false,
      attributesInspector: false,
      importReport: false,
      importReportData: null,
      functionEditor: INITIAL_FUNCTION_EDITOR_STATE,
    },
  };
}

export const INITIAL_WORKSPACE_LAYOUT = createInitialWorkspaceLayout();

function syncActiveModeSlice(nextLayout, modeId, nextModeSlice) {
  const nextLayoutsByMode = {
    ...nextLayout.layoutsByMode,
    [modeId]: nextModeSlice,
  };
  const currentActiveSlice = nextLayoutsByMode[nextLayout.activeMode];
  return {
    ...nextLayout,
    layoutsByMode: nextLayoutsByMode,
    leftDrawer: currentActiveSlice.leftDrawer,
    rightDock: currentActiveSlice.rightDock,
  };
}

export function getActiveModeLayoutSlice(layout) {
  const modeId = isValidStudioMode(layout?.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
  return layout?.layoutsByMode?.[modeId] || INITIAL_WORKSPACE_LAYOUT.layoutsByMode[modeId];
}

export function updateActiveModeLeftDrawerTab(prevLayout, nextOrUpdater) {
  const modeId = isValidStudioMode(prevLayout.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const nextTab = typeof nextOrUpdater === 'function'
    ? nextOrUpdater(curSlice.leftDrawer.activeTab)
    : nextOrUpdater;
  if (nextTab === curSlice.leftDrawer.activeTab) return prevLayout;
  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    leftDrawer: { ...curSlice.leftDrawer, activeTab: nextTab },
  });
}

export function updateActiveModeRightDock(prevLayout, updaterOrPartial) {
  const modeId = isValidStudioMode(prevLayout.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curDock = curSlice.rightDock;
  const patch = typeof updaterOrPartial === 'function' ? updaterOrPartial(curDock) : updaterOrPartial;
  if (!patch || typeof patch !== 'object') return prevLayout;
  const nextDock = { ...curDock, ...patch };
  if (
    nextDock.isOpen === curDock.isOpen &&
    nextDock.propertiesTab === curDock.propertiesTab &&
    nextDock.width === curDock.width
  ) {
    return prevLayout;
  }
  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    rightDock: nextDock,
  });
}

export function applyRightDockTargetSelection(prevLayout, _moduleName, subTab = null) {
  const modeId = isValidStudioMode(prevLayout.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curDock = curSlice.rightDock;

  if (!curDock.isOpen) {
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curDock,
        isOpen: true,
        propertiesTab: subTab || curDock.propertiesTab,
      },
    });
  }
  if (subTab && curDock.propertiesTab !== subTab) {
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curDock,
        propertiesTab: subTab,
      },
    });
  }
  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    rightDock: {
      ...curDock,
      isOpen: false,
    },
  });
}

export function computeEffectiveActivePanels(layout) {
  const modeConfig = getStudioModeConfig(layout?.activeMode);
  const curSlice = getActiveModeLayoutSlice(layout);
  const panels = {};

  for (const item of modeConfig.menuPanels || []) {
    const target = item.target || {};
    if (target.area === 'rightDock') {
      panels[item.id] = Boolean(curSlice.rightDock.isOpen);
    } else if (target.area === 'leftDrawer') {
      const matchTabs = Array.isArray(target.activeMatchTabs) && target.activeMatchTabs.length > 0
        ? target.activeMatchTabs
        : [target.tabId];
      panels[item.id] = matchTabs.includes(curSlice.leftDrawer.activeTab);
    } else if (target.area === 'aiDock') {
      panels[item.id] = !layout.aiDock.isMinimized;
    } else if (target.area === 'modal') {
      panels[item.id] = Boolean(layout.modals?.[target.modalKey]);
    }
  }
  return panels;
}

export function applyWorkspacePanelToggle(prevLayout, panelName) {
  const modeConfig = getStudioModeConfig(prevLayout?.activeMode);
  const panelDef = (modeConfig.menuPanels || []).find((p) => p.id === panelName);
  if (!panelDef || !panelDef.target) return prevLayout;

  const { target } = panelDef;
  if (target.area === 'rightDock') {
    return applyRightDockTargetSelection(prevLayout, 'properties', null);
  }
  if (target.area === 'leftDrawer') {
    const curSlice = getActiveModeLayoutSlice(prevLayout);
    const nextTab = curSlice.leftDrawer.activeTab === target.tabId ? null : target.tabId;
    return updateActiveModeLeftDrawerTab(prevLayout, nextTab);
  }
  if (target.area === 'modal' && target.modalKey) {
    return {
      ...prevLayout,
      modals: {
        ...prevLayout.modals,
        [target.modalKey]: !prevLayout.modals[target.modalKey],
      },
    };
  }
  if (target.area === 'aiDock') {
    const nextMinimized = !prevLayout.aiDock.isMinimized;
    return {
      ...prevLayout,
      aiDock: {
        isMinimized: nextMinimized,
        focusSignal: !nextMinimized ? prevLayout.aiDock.focusSignal + 1 : prevLayout.aiDock.focusSignal,
      },
    };
  }
  return prevLayout;
}

/**
 * Pure state transition + side-effect orchestrator for switching studio modes ('design' | 'backend').
 * - Validates modeId against STUDIO_MODES registry.
 * - Preserves each mode's layout slice in `layoutsByMode` independently.
 * - Closes design-specific modals (`addTag`, `attributesInspector`, `functionEditor`) and transient popovers.
 * - Resets `editingGroupId` to `null` while leaving `selectedIds` intact.
 * - Resets `activeTool` to the target mode's `tools.defaultToolId` ('select').
 */
export function applyStudioModeTransition(prevLayout, nextModeId, callbacks = {}) {
  if (!isValidStudioMode(nextModeId)) {
    return { changed: false, layout: prevLayout, defaultToolId: prevLayout?.activeTool || 'select' };
  }

  const targetConfig = getStudioModeConfig(nextModeId);
  const defaultToolId = targetConfig.tools?.defaultToolId || 'select';
  const targetSlice = prevLayout.layoutsByMode?.[nextModeId]
    || INITIAL_WORKSPACE_LAYOUT.layoutsByMode[nextModeId];

  const nextLayout = {
    ...prevLayout,
    activeMode: nextModeId,
    activeTool: defaultToolId,
    openPopover: null,
    leftDrawer: targetSlice.leftDrawer,
    rightDock: targetSlice.rightDock,
    modals: {
      ...prevLayout.modals,
      addTag: false,
      attributesInspector: false,
      functionEditor: INITIAL_FUNCTION_EDITOR_STATE,
    },
  };

  callbacks.setEditingGroupId?.(null);
  callbacks.onResetEditingGroup?.(null);
  callbacks.setActiveTool?.(defaultToolId);
  callbacks.onResetActiveTool?.(defaultToolId);
  callbacks.onClosePopovers?.();

  return { changed: true, layout: nextLayout, defaultToolId };
}

export function applyWorkspaceLayoutReset(prevLayout, {
  showWelcomeScreen = false,
  leftTab = null,
  aiMinimized = false,
} = {}) {
  const prevDesignWidth = prevLayout?.layoutsByMode?.design?.rightDock?.width
    || prevLayout?.rightDock?.width
    || DEFAULT_RIGHT_DOCK_WIDTH;
  const prevBackendWidth = prevLayout?.layoutsByMode?.backend?.rightDock?.width
    || DEFAULT_RIGHT_DOCK_WIDTH;

  const nextLayoutsByMode = createModeLayoutsMap({
    design: {
      leftDrawer: { activeTab: leftTab },
      rightDock: {
        ...STUDIO_MODES.design.defaultLayout.rightDock,
        width: prevDesignWidth,
      },
    },
    backend: {
      leftDrawer: { ...STUDIO_MODES.backend.defaultLayout.leftDrawer },
      rightDock: {
        ...STUDIO_MODES.backend.defaultLayout.rightDock,
        width: prevBackendWidth,
      },
    },
  });

  const activeMode = DEFAULT_STUDIO_MODE;
  const activeSlice = nextLayoutsByMode[activeMode];

  return {
    ...INITIAL_WORKSPACE_LAYOUT,
    showWelcomeScreen,
    activeMode,
    activeTool: STUDIO_MODES[activeMode].tools?.defaultToolId || 'select',
    openPopover: null,
    layoutsByMode: nextLayoutsByMode,
    leftDrawer: activeSlice.leftDrawer,
    rightDock: activeSlice.rightDock,
    aiDock: {
      isMinimized: aiMinimized,
      focusSignal: prevLayout?.aiDock?.focusSignal || 0,
    },
  };
}

/**
 * Unified workspace layout, mode-aware panel/dock, modal, and toast controller.
 * Input:  optional { setEditingGroupId, setActiveTool, onClosePopovers }
 */
export function useWorkspaceLayout(options = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [layout, setLayout] = useState(createInitialWorkspaceLayout);
  const [previewToast, setPreviewToast] = useState(null);
  const previewToastTimerRef = useRef(null);

  useEffect(() => () => {
    if (previewToastTimerRef.current) {
      clearTimeout(previewToastTimerRef.current);
    }
  }, []);

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

  const setShowWelcomeScreen = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.showWelcomeScreen) : nextOrUpdater;
      return next === prev.showWelcomeScreen ? prev : { ...prev, showWelcomeScreen: next };
    });
  }, []);

  const setStudioMode = useCallback((nextModeId, callCallbacks = {}) => {
    if (!isValidStudioMode(nextModeId)) return false;
    const mergedCallbacks = { ...(optionsRef.current || {}), ...(callCallbacks || {}) };
    const targetConfig = getStudioModeConfig(nextModeId);
    const defaultToolId = targetConfig.tools?.defaultToolId || 'select';

    setLayout((prev) => applyStudioModeTransition(prev, nextModeId).layout);

    mergedCallbacks.setEditingGroupId?.(null);
    mergedCallbacks.onResetEditingGroup?.(null);
    mergedCallbacks.setActiveTool?.(defaultToolId);
    mergedCallbacks.onResetActiveTool?.(defaultToolId);
    mergedCallbacks.onClosePopovers?.();
    return true;
  }, []);

  const setLeftSidebarTab = useCallback((nextOrUpdater) => {
    setLayout((prev) => updateActiveModeLeftDrawerTab(prev, nextOrUpdater));
  }, []);

  const setRightDockOpen = useCallback((nextOrUpdater) => {
    setLayout((prev) => updateActiveModeRightDock(prev, (dock) => ({
      isOpen: typeof nextOrUpdater === 'function' ? nextOrUpdater(dock.isOpen) : nextOrUpdater,
    })));
  }, []);

  const setRightPropertiesTab = useCallback((nextOrUpdater) => {
    setLayout((prev) => updateActiveModeRightDock(prev, (dock) => ({
      propertiesTab: typeof nextOrUpdater === 'function' ? nextOrUpdater(dock.propertiesTab) : nextOrUpdater,
    })));
  }, []);

  const setRightDockWidth = useCallback((nextOrUpdater) => {
    setLayout((prev) => updateActiveModeRightDock(prev, (dock) => ({
      width: typeof nextOrUpdater === 'function' ? nextOrUpdater(dock.width) : nextOrUpdater,
    })));
  }, []);

  const setAiDockMinimized = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.aiDock.isMinimized) : nextOrUpdater;
      return next === prev.aiDock.isMinimized
        ? prev
        : { ...prev, aiDock: { ...prev.aiDock, isMinimized: next } };
    });
  }, []);

  const setAiFocusSignal = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.aiDock.focusSignal) : nextOrUpdater;
      return next === prev.aiDock.focusSignal
        ? prev
        : { ...prev, aiDock: { ...prev.aiDock, focusSignal: next } };
    });
  }, []);

  const setShowTutorial = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.modals.tutorial) : nextOrUpdater;
      return next === prev.modals.tutorial
        ? prev
        : { ...prev, modals: { ...prev.modals, tutorial: next } };
    });
  }, []);

  const setShowExportModal = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.modals.export) : nextOrUpdater;
      return next === prev.modals.export
        ? prev
        : { ...prev, modals: { ...prev.modals, export: next } };
    });
  }, []);

  const setShowAddTagModal = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.modals.addTag) : nextOrUpdater;
      return next === prev.modals.addTag
        ? prev
        : { ...prev, modals: { ...prev.modals, addTag: next } };
    });
  }, []);

  const setShowAttributesInspectorModal = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function'
        ? nextOrUpdater(prev.modals.attributesInspector)
        : nextOrUpdater;
      return next === prev.modals.attributesInspector
        ? prev
        : { ...prev, modals: { ...prev.modals, attributesInspector: next } };
    });
  }, []);

  const setShowImportReportModal = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.modals.importReport) : nextOrUpdater;
      return next === prev.modals.importReport
        ? prev
        : { ...prev, modals: { ...prev.modals, importReport: next } };
    });
  }, []);

  const setImportReportData = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function'
        ? nextOrUpdater(prev.modals.importReportData)
        : nextOrUpdater;
      return { ...prev, modals: { ...prev.modals, importReportData: next } };
    });
  }, []);

  const setFunctionEditorState = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function'
        ? nextOrUpdater(prev.modals.functionEditor)
        : nextOrUpdater;
      return { ...prev, modals: { ...prev.modals, functionEditor: next } };
    });
  }, []);

  const handleOpenFunctionEditor = useCallback((fnObj = null, bindTargetElementId = null) => {
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
  }, [setFunctionEditorState]);

  const handleSelectRightDockTarget = useCallback((moduleName, subTab = null) => {
    setLayout((prev) => applyRightDockTargetSelection(prev, moduleName, subTab));
  }, []);

  const handleDockFloatingInspector = useCallback((targetTab = 'css') => {
    setLayout((prev) => {
      const withClosedModal = {
        ...prev,
        modals: {
          ...prev.modals,
          attributesInspector: false,
        },
      };
      return updateActiveModeRightDock(withClosedModal, {
        isOpen: true,
        propertiesTab: targetTab || 'css',
      });
    });
  }, []);

  const togglePanel = useCallback((panelName) => {
    setLayout((prev) => applyWorkspacePanelToggle(prev, panelName));
  }, []);

  const effectiveActivePanels = useMemo(
    () => computeEffectiveActivePanels(layout),
    [layout]
  );

  const reset = useCallback((resetOptions = {}) => {
    setLayout((prev) => applyWorkspaceLayoutReset(prev, resetOptions));
  }, []);

  useEffect(() => {
    const handleAppHashChange = () => {
      const h = String(window.location.hash || '').toLowerCase();
      if (h === '#/ice-aktar' || h === '#ice-aktar' || h === '#/projeler' || h === '#projeler' || h === '#/sablonlar' || h === '#sablonlar' || h === '#/') {
        setShowWelcomeScreen(true);
      }
    };
    window.addEventListener('hashchange', handleAppHashChange);
    return () => window.removeEventListener('hashchange', handleAppHashChange);
  }, [setShowWelcomeScreen]);

  const activeSlice = getActiveModeLayoutSlice(layout);
  const currentModeConfig = getStudioModeConfig(layout.activeMode);

  return {
    layout,
    setLayout,
    activeMode: layout.activeMode,
    currentModeConfig,
    layoutsByMode: layout.layoutsByMode,
    setStudioMode,
    effectiveActivePanels,
    showWelcomeScreen: layout.showWelcomeScreen,
    setShowWelcomeScreen,
    leftSidebarTab: activeSlice.leftDrawer.activeTab,
    setLeftSidebarTab,
    rightDockOpen: activeSlice.rightDock.isOpen,
    setRightDockOpen,
    rightPropertiesTab: activeSlice.rightDock.propertiesTab,
    setRightPropertiesTab,
    rightDockWidth: activeSlice.rightDock.width,
    setRightDockWidth,
    aiDockMinimized: layout.aiDock.isMinimized,
    setAiDockMinimized,
    aiFocusSignal: layout.aiDock.focusSignal,
    setAiFocusSignal,
    showTutorial: layout.modals.tutorial,
    setShowTutorial,
    showExportModal: layout.modals.export,
    setShowExportModal,
    showAddTagModal: layout.modals.addTag,
    setShowAddTagModal,
    showAttributesInspectorModal: layout.modals.attributesInspector,
    setShowAttributesInspectorModal,
    showImportReportModal: layout.modals.importReport,
    setShowImportReportModal,
    importReportData: layout.modals.importReportData,
    setImportReportData,
    functionEditorState: layout.modals.functionEditor,
    setFunctionEditorState,
    handleOpenFunctionEditor,
    previewToast,
    showToastMessage,
    handleSelectRightDockTarget,
    handleDockFloatingInspector,
    togglePanel,
    reset,
  };
}
