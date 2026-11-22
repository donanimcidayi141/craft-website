import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_STUDIO_MODE,
  DEFAULT_LEFT_DRAWER_WIDTH,
  MIN_LEFT_DRAWER_WIDTH,
  MAX_LEFT_DRAWER_WIDTH,
  MIN_AI_LEFT_DRAWER_WIDTH,
  LEFT_RAIL_WIDTH,
  DEFAULT_RIGHT_DOCK_WIDTH,
  STUDIO_MODES,
  getStudioModeConfig,
  isValidStudioMode,
} from '../data/studioModesRegistry.js';
import {
  DEFAULT_WORKSPACE_PRESET_ID,
  isValidWorkspacePreset,
  resolvePresetModeLayout,
} from '../data/panelRegistry.js';
import {
  getWorkspaceLayoutsByMode,
  saveWorkspaceLayoutsByMode,
  sanitizeWorkspaceLayoutsByMode,
  clampModeLayoutToViewport,
} from '../settings/settingsStore.js';

export const INITIAL_FUNCTION_EDITOR_STATE = {
  isOpen: false,
  fnObj: null,
  bindTargetElementId: null,
};

export function clampLeftDrawerWidth(width, fallback = DEFAULT_LEFT_DRAWER_WIDTH) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(MIN_LEFT_DRAWER_WIDTH, Math.min(MAX_LEFT_DRAWER_WIDTH, Math.round(numeric)));
}

export function resolveEffectiveLeftDrawerWidth(activeTab, rawWidth = DEFAULT_LEFT_DRAWER_WIDTH) {
  const clamped = clampLeftDrawerWidth(rawWidth);
  return activeTab === 'ai' ? Math.max(clamped, MIN_AI_LEFT_DRAWER_WIDTH) : clamped;
}

export function createModeLayoutsMap(overrides = {}) {
  const designDefault = STUDIO_MODES.design.defaultLayout;
  const backendDefault = STUDIO_MODES.backend.defaultLayout;
  return {
    design: {
      presetId: isValidWorkspacePreset(overrides.design?.presetId) || overrides.design?.presetId === 'custom'
        ? overrides.design.presetId
        : DEFAULT_WORKSPACE_PRESET_ID,
      leftDrawer: {
        activeTab: overrides.design?.leftDrawer?.activeTab !== undefined
          ? overrides.design.leftDrawer.activeTab
          : designDefault.leftDrawer.activeTab,
        width: clampLeftDrawerWidth(
          overrides.design?.leftDrawer?.width,
          designDefault.leftDrawer.width || DEFAULT_LEFT_DRAWER_WIDTH
        ),
      },
      rightDock: {
        isOpen: overrides.design?.rightDock?.isOpen ?? designDefault.rightDock.isOpen,
        propertiesTab: overrides.design?.rightDock?.propertiesTab || designDefault.rightDock.propertiesTab,
        width: overrides.design?.rightDock?.width || DEFAULT_RIGHT_DOCK_WIDTH,
      },
      aiDock: {
        isMinimized: Boolean(overrides.design?.aiDock?.isMinimized ?? designDefault.aiDock?.isMinimized),
      },
    },
    backend: {
      presetId: isValidWorkspacePreset(overrides.backend?.presetId) || overrides.backend?.presetId === 'custom'
        ? overrides.backend.presetId
        : DEFAULT_WORKSPACE_PRESET_ID,
      leftDrawer: {
        activeTab: overrides.backend?.leftDrawer?.activeTab !== undefined
          ? overrides.backend.leftDrawer.activeTab
          : backendDefault.leftDrawer.activeTab,
        width: clampLeftDrawerWidth(
          overrides.backend?.leftDrawer?.width,
          backendDefault.leftDrawer.width || 256
        ),
      },
      rightDock: {
        isOpen: overrides.backend?.rightDock?.isOpen ?? backendDefault.rightDock.isOpen,
        propertiesTab: overrides.backend?.rightDock?.propertiesTab || backendDefault.rightDock.propertiesTab,
        width: overrides.backend?.rightDock?.width || DEFAULT_RIGHT_DOCK_WIDTH,
      },
      aiDock: {
        isMinimized: Boolean(overrides.backend?.aiDock?.isMinimized ?? backendDefault.aiDock?.isMinimized),
      },
    },
  };
}

export function createInitialWorkspaceLayout({ storage = null, usePersistedSettings = false } = {}) {
  const persistedOverrides = usePersistedSettings ? getWorkspaceLayoutsByMode(storage) : {};
  const layoutsByMode = createModeLayoutsMap(persistedOverrides);
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
      isMinimized: Boolean(currentSlice.aiDock?.isMinimized),
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

export function updateActiveModeLeftDrawerWidth(prevLayout, nextOrUpdater) {
  const modeId = isValidStudioMode(prevLayout.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curWidth = curSlice.leftDrawer.width || DEFAULT_LEFT_DRAWER_WIDTH;
  const rawNext = typeof nextOrUpdater === 'function' ? nextOrUpdater(curWidth) : nextOrUpdater;
  const nextWidth = clampLeftDrawerWidth(rawNext, curWidth);
  if (nextWidth === curWidth) return prevLayout;
  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    leftDrawer: { ...curSlice.leftDrawer, width: nextWidth },
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

export function applyWorkspacePresetToLayout(
  prevLayout,
  presetId = DEFAULT_WORKSPACE_PRESET_ID,
  modeId = prevLayout?.activeMode,
) {
  if (!isValidWorkspacePreset(presetId)) return prevLayout;
  const resolvedMode = isValidStudioMode(modeId) ? modeId : DEFAULT_STUDIO_MODE;
  const presetSlice = resolvePresetModeLayout(presetId, resolvedMode);
  const nextModeSlice = {
    presetId,
    leftDrawer: { ...presetSlice.leftDrawer },
    rightDock: { ...presetSlice.rightDock },
    aiDock: { isMinimized: Boolean(presetSlice.aiDock?.isMinimized) },
  };
  const synced = syncActiveModeSlice(prevLayout, resolvedMode, nextModeSlice);
  const isCurrentMode = resolvedMode === synced.activeMode;
  return {
    ...synced,
    aiDock: isCurrentMode
      ? {
          ...synced.aiDock,
          isMinimized: Boolean(presetSlice.aiDock?.isMinimized),
        }
      : synced.aiDock,
    modals: isCurrentMode
      ? {
          ...synced.modals,
          attributesInspector: Boolean(presetSlice.modals?.attributesInspector),
        }
      : synced.modals,
  };
}

export function resetModeWorkspaceLayout(prevLayout, modeId = prevLayout?.activeMode) {
  return applyWorkspacePresetToLayout(prevLayout, DEFAULT_WORKSPACE_PRESET_ID, modeId);
}

export function applyWorkspaceLayoutReset(prevLayout, {
  showWelcomeScreen = false,
  leftTab = null,
  aiMinimized = false,
} = {}) {
  const prevDesignLeftWidth = prevLayout?.layoutsByMode?.design?.leftDrawer?.width
    || prevLayout?.leftDrawer?.width
    || DEFAULT_LEFT_DRAWER_WIDTH;
  const prevBackendLeftWidth = prevLayout?.layoutsByMode?.backend?.leftDrawer?.width
    || STUDIO_MODES.backend.defaultLayout.leftDrawer.width
    || 256;
  const prevDesignWidth = prevLayout?.layoutsByMode?.design?.rightDock?.width
    || prevLayout?.rightDock?.width
    || DEFAULT_RIGHT_DOCK_WIDTH;
  const prevBackendWidth = prevLayout?.layoutsByMode?.backend?.rightDock?.width
    || DEFAULT_RIGHT_DOCK_WIDTH;

  const nextLayoutsByMode = createModeLayoutsMap({
    design: {
      leftDrawer: { activeTab: leftTab, width: prevDesignLeftWidth },
      rightDock: {
        ...STUDIO_MODES.design.defaultLayout.rightDock,
        width: prevDesignWidth,
      },
    },
    backend: {
      leftDrawer: {
        ...STUDIO_MODES.backend.defaultLayout.leftDrawer,
        width: prevBackendLeftWidth,
      },
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

  const [layout, setLayout] = useState(() =>
    createInitialWorkspaceLayout({ usePersistedSettings: true })
  );
  const [viewportSize, setViewportSize] = useState(() => ({
    viewportWidth: typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1440,
    viewportHeight: typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 920,
  }));
  const [previewToast, setPreviewToast] = useState(null);
  const previewToastTimerRef = useRef(null);
  const pendingPersistPayloadRef = useRef(null);
  const persistDebounceTimerRef = useRef(null);
  const lastPersistedNonWidthKeyRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setViewportSize({
        viewportWidth: window.innerWidth > 0 ? window.innerWidth : 1440,
        viewportHeight: window.innerHeight > 0 ? window.innerHeight : 920,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist per-mode workspace layouts (design & backend) to settingsStore (`craftstudio_settings_v1`).
  // - Discrete panel/tab/preset/reset transitions write immediately (1 write).
  // - Continuous splitter width drags are debounced (180ms) and flushed once on pointerup/mouseup/beforeunload
  //   so 60 pointermove events during a drag produce only 1 storage write instead of 60.
  // - Always persists the user's intrinsic (unclamped) widths so shrinking & re-expanding the window restores original widths.
  useEffect(() => {
    const modeId = isValidStudioMode(layout.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
    const activeModeSlice = layout.layoutsByMode?.[modeId];
    const toPersist = {
      ...layout.layoutsByMode,
      [modeId]: {
        ...activeModeSlice,
        aiDock: { isMinimized: Boolean(layout.aiDock?.isMinimized) },
      },
    };
    const nonWidthKey = JSON.stringify({
      activeMode: modeId,
      designTab: toPersist.design?.leftDrawer?.activeTab ?? null,
      designOpen: Boolean(toPersist.design?.rightDock?.isOpen),
      designPropTab: toPersist.design?.rightDock?.propertiesTab ?? 'layout',
      designPreset: toPersist.design?.presetId ?? 'standard',
      designAiMin: Boolean(toPersist.design?.aiDock?.isMinimized),
      backendTab: toPersist.backend?.leftDrawer?.activeTab ?? null,
      backendOpen: Boolean(toPersist.backend?.rightDock?.isOpen),
      backendPropTab: toPersist.backend?.rightDock?.propertiesTab ?? 'stepConfig',
      backendPreset: toPersist.backend?.presetId ?? 'standard',
      backendAiMin: Boolean(toPersist.backend?.aiDock?.isMinimized),
    });

    const isWidthOnlyChange =
      lastPersistedNonWidthKeyRef.current !== null &&
      lastPersistedNonWidthKeyRef.current === nonWidthKey;
    lastPersistedNonWidthKeyRef.current = nonWidthKey;

    if (!isWidthOnlyChange) {
      if (persistDebounceTimerRef.current) {
        clearTimeout(persistDebounceTimerRef.current);
        persistDebounceTimerRef.current = null;
      }
      pendingPersistPayloadRef.current = null;
      saveWorkspaceLayoutsByMode(toPersist);
      return undefined;
    }

    pendingPersistPayloadRef.current = toPersist;
    if (persistDebounceTimerRef.current) {
      clearTimeout(persistDebounceTimerRef.current);
    }
    persistDebounceTimerRef.current = setTimeout(() => {
      persistDebounceTimerRef.current = null;
      if (pendingPersistPayloadRef.current) {
        const payload = pendingPersistPayloadRef.current;
        pendingPersistPayloadRef.current = null;
        saveWorkspaceLayoutsByMode(payload);
      }
    }, 180);
    return undefined;
  }, [layout.layoutsByMode, layout.activeMode, layout.aiDock?.isMinimized]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const flushPendingLayoutPersist = () => {
      if (persistDebounceTimerRef.current) {
        clearTimeout(persistDebounceTimerRef.current);
        persistDebounceTimerRef.current = null;
      }
      if (pendingPersistPayloadRef.current) {
        const payload = pendingPersistPayloadRef.current;
        pendingPersistPayloadRef.current = null;
        saveWorkspaceLayoutsByMode(payload);
      }
    };
    window.addEventListener('pointerup', flushPendingLayoutPersist);
    window.addEventListener('mouseup', flushPendingLayoutPersist);
    window.addEventListener('beforeunload', flushPendingLayoutPersist);
    return () => {
      flushPendingLayoutPersist();
      window.removeEventListener('pointerup', flushPendingLayoutPersist);
      window.removeEventListener('mouseup', flushPendingLayoutPersist);
      window.removeEventListener('beforeunload', flushPendingLayoutPersist);
    };
  }, []);

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

  const setLeftSidebarWidth = useCallback((nextOrUpdater) => {
    setLayout((prev) => updateActiveModeLeftDrawerWidth(prev, nextOrUpdater));
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

  const applyWorkspacePreset = useCallback((presetId) => {
    setLayout((prev) => applyWorkspacePresetToLayout(prev, presetId, prev.activeMode));
  }, []);

  const resetWorkspaceLayoutToStandard = useCallback((targetMode = null) => {
    setLayout((prev) => resetModeWorkspaceLayout(prev, targetMode || prev.activeMode));
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

  const rawActiveSlice = getActiveModeLayoutSlice(layout);
  const activeSlice = useMemo(
    () => clampModeLayoutToViewport(rawActiveSlice, viewportSize),
    [rawActiveSlice, viewportSize]
  );
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
    leftSidebarWidth: activeSlice.leftDrawer.width || DEFAULT_LEFT_DRAWER_WIDTH,
    setLeftSidebarWidth,
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
    activePresetId: activeSlice.presetId || DEFAULT_WORKSPACE_PRESET_ID,
    applyWorkspacePreset,
    resetWorkspaceLayoutToStandard,
    reset,
  };
}
