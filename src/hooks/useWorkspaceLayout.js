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
  MOVABLE_PANEL_ZONES,
  isValidWorkspacePreset,
  resolvePresetModeLayout,
  getPanelConfig,
  resolveCanonicalPanelId,
  isPanelAllowedInMode,
  isPanelAllowedInZone,
  getDefaultRightPanelIdForMode,
  createDefaultPanelZonesForMode,
  createDefaultFloatingPanelState,
  createDefaultFloatingPanelsForMode,
} from '../data/panelRegistry.js';
import {
  getWorkspaceLayoutsByMode,
  saveWorkspaceLayoutsByMode,
  sanitizeWorkspaceLayoutsByMode,
  clampModeLayoutToViewport,
} from '../settings/settingsStore.js';
import { clampFloatingRect } from '../utils/propertySearch.js';

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

function buildNormalizedModeLayoutSlice(modeId, override = {}) {
  const resolvedMode = modeId === 'backend' ? 'backend' : 'design';
  const modeDefault = STUDIO_MODES[resolvedMode].defaultLayout;
  const defaultRightPanelId = getDefaultRightPanelIdForMode(resolvedMode);
  const defaultLeftWidth = modeDefault.leftDrawer.width || (resolvedMode === 'backend' ? 256 : DEFAULT_LEFT_DRAWER_WIDTH);

  const panelZones = createDefaultPanelZonesForMode(resolvedMode);
  if (override?.panelZones && typeof override.panelZones === 'object' && !Array.isArray(override.panelZones)) {
    for (const [rawId, rawZone] of Object.entries(override.panelZones)) {
      const canonicalId = resolveCanonicalPanelId(rawId, resolvedMode);
      if (canonicalId && isPanelAllowedInZone(canonicalId, rawZone)) {
        panelZones[canonicalId] = rawZone;
      }
    }
  }

  const leftActiveTab = override?.leftDrawer?.activeTab !== undefined
    ? override.leftDrawer.activeTab
    : modeDefault.leftDrawer.activeTab;

  let leftTabs = [];
  if (Array.isArray(override?.leftDrawer?.tabs)) {
    for (const t of override.leftDrawer.tabs) {
      const canonicalId = resolveCanonicalPanelId(t, resolvedMode);
      if (canonicalId && panelZones[canonicalId] === 'left' && !leftTabs.includes(canonicalId)) {
        leftTabs.push(canonicalId);
      }
    }
  }
  if (leftActiveTab && !leftTabs.includes(leftActiveTab)) {
    leftTabs.push(leftActiveTab);
  }
  if (!leftActiveTab && !Array.isArray(override?.leftDrawer?.tabs)) {
    leftTabs = [];
  }

  const rightIsOpen = Boolean(override?.rightDock?.isOpen ?? modeDefault.rightDock.isOpen);
  let rightTabs = [];
  if (Array.isArray(override?.rightDock?.tabs)) {
    for (const t of override.rightDock.tabs) {
      const canonicalId = resolveCanonicalPanelId(t, resolvedMode);
      if (canonicalId && panelZones[canonicalId] === 'right' && !rightTabs.includes(canonicalId)) {
        rightTabs.push(canonicalId);
      }
    }
  }
  if (rightTabs.length === 0 && panelZones[defaultRightPanelId] === 'right') {
    rightTabs = [defaultRightPanelId];
  }
  const requestedRightActive = resolveCanonicalPanelId(override?.rightDock?.activeTab, resolvedMode);
  const rightActiveTab =
    requestedRightActive && rightTabs.includes(requestedRightActive)
      ? requestedRightActive
      : rightTabs[0] || null;

  const floatingPanels = createDefaultFloatingPanelsForMode(resolvedMode);
  if (override?.floatingPanels && typeof override.floatingPanels === 'object' && !Array.isArray(override.floatingPanels)) {
    for (const [rawId, rawState] of Object.entries(override.floatingPanels)) {
      const canonicalId = resolveCanonicalPanelId(rawId, resolvedMode);
      if (!canonicalId || !floatingPanels[canonicalId] || !rawState || typeof rawState !== 'object') continue;
      const baseFloat = floatingPanels[canonicalId];
      const panelCfg = getPanelConfig(canonicalId);
      const nextRect = rawState.rect && typeof rawState.rect === 'object'
        ? clampFloatingRect(
            rawState.rect,
            { width: 1440, height: 920 },
            {
              minWidth: panelCfg?.sizeLimits?.minWidth || 220,
              minHeight: panelCfg?.sizeLimits?.minHeight || 260,
            },
          )
        : baseFloat.rect;
      floatingPanels[canonicalId] = {
        isOpen: typeof rawState.isOpen === 'boolean' ? rawState.isOpen : baseFloat.isOpen,
        isMinimized: typeof rawState.isMinimized === 'boolean' ? rawState.isMinimized : baseFloat.isMinimized,
        rect: nextRect,
        zIndex: Number.isFinite(Number(rawState.zIndex)) ? Math.max(40, Math.round(Number(rawState.zIndex))) : baseFloat.zIndex,
      };
    }
  }

  return {
    presetId: isValidWorkspacePreset(override?.presetId) || override?.presetId === 'custom'
      ? override.presetId
      : DEFAULT_WORKSPACE_PRESET_ID,
    panelZones,
    leftDrawer: {
      activeTab: leftActiveTab,
      tabs: leftTabs,
      width: clampLeftDrawerWidth(override?.leftDrawer?.width, defaultLeftWidth),
    },
    rightDock: {
      isOpen: rightIsOpen,
      activeTab: rightActiveTab,
      tabs: rightTabs,
      propertiesTab: override?.rightDock?.propertiesTab || modeDefault.rightDock.propertiesTab,
      width: override?.rightDock?.width || DEFAULT_RIGHT_DOCK_WIDTH,
    },
    floatingPanels,
    aiDock: {
      isMinimized: Boolean(override?.aiDock?.isMinimized ?? modeDefault.aiDock?.isMinimized),
    },
  };
}

export function createModeLayoutsMap(overrides = {}) {
  return {
    design: buildNormalizedModeLayoutSlice('design', overrides?.design),
    backend: buildNormalizedModeLayoutSlice('backend', overrides?.backend),
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

function getMaxFloatingZIndex(floatingPanels = {}) {
  let maxZ = 49;
  for (const state of Object.values(floatingPanels || {})) {
    const z = Number(state?.zIndex);
    if (Number.isFinite(z) && z > maxZ) {
      maxZ = z;
    }
  }
  return maxZ;
}

export function getWorkspacePanelZone(layout, panelName) {
  const modeId = isValidStudioMode(layout?.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return null;
  const curSlice = getActiveModeLayoutSlice(layout);
  return curSlice.panelZones?.[canonicalId] || getPanelConfig(canonicalId)?.defaultZone || null;
}

export function isWorkspacePanelOpen(layout, panelName) {
  const modeId = isValidStudioMode(layout?.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return false;
  if (canonicalId === 'aiAgent') {
    return !layout?.aiDock?.isMinimized;
  }

  const curSlice = getActiveModeLayoutSlice(layout);
  const panelCfg = getPanelConfig(canonicalId);
  const zone = curSlice.panelZones?.[canonicalId] || panelCfg?.defaultZone;

  if (zone === 'left') {
    const matchTabs = Array.isArray(panelCfg?.target?.activeMatchTabs) && panelCfg.target.activeMatchTabs.length > 0
      ? panelCfg.target.activeMatchTabs
      : [canonicalId];
    const activeTab = curSlice.leftDrawer?.activeTab;
    const openTabs = Array.isArray(curSlice.leftDrawer?.tabs) ? curSlice.leftDrawer.tabs : [];
    if (!activeTab && openTabs.length === 0) return false;
    return matchTabs.includes(activeTab) || (Boolean(activeTab) && openTabs.some((t) => matchTabs.includes(t)));
  }

  if (zone === 'right') {
    if (!curSlice.rightDock?.isOpen) return false;
    const openTabs = Array.isArray(curSlice.rightDock?.tabs) && curSlice.rightDock.tabs.length > 0
      ? curSlice.rightDock.tabs
      : [getDefaultRightPanelIdForMode(modeId)];
    return curSlice.rightDock.activeTab === canonicalId || openTabs.includes(canonicalId);
  }

  if (zone === 'floating') {
    const floatOpen = Boolean(curSlice.floatingPanels?.[canonicalId]?.isOpen);
    if (canonicalId === 'attributesAndCss') {
      return floatOpen || Boolean(layout?.modals?.attributesInspector);
    }
    return floatOpen;
  }

  return false;
}

export function updateActiveModeLeftDrawerTab(prevLayout, nextOrUpdater) {
  const modeId = isValidStudioMode(prevLayout.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const nextTab = typeof nextOrUpdater === 'function'
    ? nextOrUpdater(curSlice.leftDrawer.activeTab)
    : nextOrUpdater;
  if (nextTab === curSlice.leftDrawer.activeTab) return prevLayout;

  const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
  let nextTabs = curTabs;
  if (!nextTab) {
    nextTabs = [];
  } else if (curTabs.length <= 1) {
    nextTabs = [nextTab];
  } else if (!curTabs.includes(nextTab)) {
    nextTabs = [...curTabs, nextTab];
  }

  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    leftDrawer: {
      ...curSlice.leftDrawer,
      activeTab: nextTab,
      tabs: nextTabs,
    },
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
    nextDock.activeTab === curDock.activeTab &&
    nextDock.propertiesTab === curDock.propertiesTab &&
    nextDock.width === curDock.width &&
    nextDock.tabs === curDock.tabs
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
  const defaultRightId = getDefaultRightPanelIdForMode(modeId);
  const curTabs = Array.isArray(curDock.tabs) && curDock.tabs.length > 0 ? curDock.tabs : [defaultRightId];

  if (!curDock.isOpen) {
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curDock,
        isOpen: true,
        tabs: curTabs,
        activeTab: curDock.activeTab || curTabs[0] || defaultRightId,
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

export function openWorkspacePanel(
  prevLayout,
  panelName,
  { additive = true, subTab = null } = {},
) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;

  if (canonicalId === 'aiAgent') {
    const wasMinimized = Boolean(prevLayout.aiDock?.isMinimized);
    return {
      ...prevLayout,
      layoutsByMode: {
        ...prevLayout.layoutsByMode,
        [modeId]: {
          ...getActiveModeLayoutSlice(prevLayout),
          aiDock: { isMinimized: false },
        },
      },
      aiDock: {
        isMinimized: false,
        focusSignal: wasMinimized ? (prevLayout.aiDock?.focusSignal || 0) + 1 : (prevLayout.aiDock?.focusSignal || 0),
      },
    };
  }

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const panelCfg = getPanelConfig(canonicalId);
  const zone = curSlice.panelZones?.[canonicalId] || panelCfg?.defaultZone;

  if (zone === 'left') {
    const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
    const nextTabs = additive
      ? (curTabs.includes(canonicalId) ? curTabs : [...curTabs, canonicalId])
      : [canonicalId];
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      leftDrawer: {
        ...curSlice.leftDrawer,
        activeTab: canonicalId,
        tabs: nextTabs,
      },
    });
  }

  if (zone === 'right') {
    const curTabs = Array.isArray(curSlice.rightDock.tabs) ? curSlice.rightDock.tabs : [];
    const nextTabs = additive
      ? (curTabs.includes(canonicalId) ? curTabs : [...curTabs, canonicalId])
      : [canonicalId];
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curSlice.rightDock,
        isOpen: true,
        activeTab: canonicalId,
        tabs: nextTabs,
        propertiesTab: subTab || curSlice.rightDock.propertiesTab,
      },
    });
  }

  if (zone === 'floating') {
    const curFloatMap = curSlice.floatingPanels || {};
    const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
    const nextZ = getMaxFloatingZIndex(curFloatMap) + 1;
    const synced = syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      floatingPanels: {
        ...curFloatMap,
        [canonicalId]: {
          ...curFloat,
          isOpen: true,
          isMinimized: false,
          zIndex: nextZ,
        },
      },
    });
    if (canonicalId === 'attributesAndCss') {
      return {
        ...synced,
        modals: {
          ...synced.modals,
          attributesInspector: true,
        },
      };
    }
    return synced;
  }

  return prevLayout;
}

export function closeWorkspacePanel(prevLayout, panelName) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;

  if (canonicalId === 'aiAgent') {
    return {
      ...prevLayout,
      layoutsByMode: {
        ...prevLayout.layoutsByMode,
        [modeId]: {
          ...getActiveModeLayoutSlice(prevLayout),
          aiDock: { isMinimized: true },
        },
      },
      aiDock: {
        ...prevLayout.aiDock,
        isMinimized: true,
      },
    };
  }

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const panelCfg = getPanelConfig(canonicalId);
  const zone = curSlice.panelZones?.[canonicalId] || panelCfg?.defaultZone;

  if (zone === 'left') {
    const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
    const nextTabs = curTabs.filter((t) => t !== canonicalId);
    const nextActiveTab =
      curSlice.leftDrawer.activeTab === canonicalId
        ? (nextTabs[nextTabs.length - 1] || null)
        : (nextTabs.includes(curSlice.leftDrawer.activeTab) ? curSlice.leftDrawer.activeTab : (nextTabs[0] || null));
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      leftDrawer: {
        ...curSlice.leftDrawer,
        activeTab: nextActiveTab,
        tabs: nextTabs,
      },
    });
  }

  if (zone === 'right') {
    const defaultRightId = getDefaultRightPanelIdForMode(modeId);
    const curTabs = Array.isArray(curSlice.rightDock.tabs) && curSlice.rightDock.tabs.length > 0
      ? curSlice.rightDock.tabs
      : [defaultRightId];
    if (curTabs.length <= 1 && (curTabs[0] === canonicalId || curSlice.rightDock.activeTab === canonicalId)) {
      return syncActiveModeSlice(prevLayout, modeId, {
        ...curSlice,
        rightDock: {
          ...curSlice.rightDock,
          isOpen: false,
        },
      });
    }
    const nextTabs = curTabs.filter((t) => t !== canonicalId);
    const nextActiveTab =
      curSlice.rightDock.activeTab === canonicalId
        ? (nextTabs[nextTabs.length - 1] || null)
        : (nextTabs.includes(curSlice.rightDock.activeTab) ? curSlice.rightDock.activeTab : (nextTabs[0] || null));
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curSlice.rightDock,
        isOpen: nextTabs.length > 0,
        activeTab: nextActiveTab,
        tabs: nextTabs.length > 0 ? nextTabs : [defaultRightId],
      },
    });
  }

  if (zone === 'floating') {
    const curFloatMap = curSlice.floatingPanels || {};
    const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
    const synced = syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      floatingPanels: {
        ...curFloatMap,
        [canonicalId]: {
          ...curFloat,
          isOpen: false,
        },
      },
    });
    if (canonicalId === 'attributesAndCss') {
      return {
        ...synced,
        modals: {
          ...synced.modals,
          attributesInspector: false,
        },
      };
    }
    return synced;
  }

  return prevLayout;
}

export function toggleWorkspacePanel(prevLayout, panelName) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;

  if (canonicalId === 'aiAgent') {
    return prevLayout.aiDock?.isMinimized
      ? openWorkspacePanel(prevLayout, canonicalId)
      : closeWorkspacePanel(prevLayout, canonicalId);
  }

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const panelCfg = getPanelConfig(canonicalId);
  const zone = curSlice.panelZones?.[canonicalId] || panelCfg?.defaultZone;

  if (zone === 'left') {
    if (curSlice.leftDrawer.activeTab === canonicalId) {
      return closeWorkspacePanel(prevLayout, canonicalId);
    }
    // Single-tab left drawer toggle switches activeTab when only 1 default tab was active;
    // when multiple tabs are already pinned in leftDrawer.tabs, activates or adds canonicalId.
    const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
    return openWorkspacePanel(prevLayout, canonicalId, { additive: curTabs.length > 1 });
  }

  if (zone === 'right') {
    if (curSlice.rightDock.isOpen && curSlice.rightDock.activeTab === canonicalId) {
      return closeWorkspacePanel(prevLayout, canonicalId);
    }
    return openWorkspacePanel(prevLayout, canonicalId, { additive: true });
  }

  if (zone === 'floating') {
    return isWorkspacePanelOpen(prevLayout, canonicalId)
      ? closeWorkspacePanel(prevLayout, canonicalId)
      : openWorkspacePanel(prevLayout, canonicalId);
  }

  return prevLayout;
}

export function moveWorkspacePanelToZone(
  prevLayout,
  panelName,
  targetZone,
  { floatingRect = null } = {},
) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId || !MOVABLE_PANEL_ZONES.includes(targetZone)) return prevLayout;
  if (!isPanelAllowedInMode(canonicalId, modeId) || !isPanelAllowedInZone(canonicalId, targetZone)) {
    return prevLayout;
  }

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const panelCfg = getPanelConfig(canonicalId);
  const prevZone = curSlice.panelZones?.[canonicalId] || panelCfg?.defaultZone;

  // 1. Remove from previous zone
  let nextLeftTabs = (Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : []).filter(
    (t) => t !== canonicalId,
  );
  let nextLeftActiveTab =
    curSlice.leftDrawer.activeTab === canonicalId
      ? (nextLeftTabs[nextLeftTabs.length - 1] || null)
      : curSlice.leftDrawer.activeTab;

  let nextRightTabs = (Array.isArray(curSlice.rightDock.tabs) ? curSlice.rightDock.tabs : []).filter(
    (t) => t !== canonicalId,
  );
  let nextRightActiveTab =
    curSlice.rightDock.activeTab === canonicalId
      ? (nextRightTabs[nextRightTabs.length - 1] || null)
      : curSlice.rightDock.activeTab;
  let nextRightIsOpen = prevZone === 'right' ? nextRightTabs.length > 0 : curSlice.rightDock.isOpen;

  const curFloatMap = curSlice.floatingPanels || {};
  const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
  let nextFloatMap = {
    ...curFloatMap,
    [canonicalId]: {
      ...curFloat,
      isOpen: false,
    },
  };

  // 2. Assign new zone & open in targetZone
  const nextPanelZones = {
    ...(curSlice.panelZones || createDefaultPanelZonesForMode(modeId)),
    [canonicalId]: targetZone,
  };

  if (targetZone === 'left') {
    if (!nextLeftTabs.includes(canonicalId)) {
      nextLeftTabs = [...nextLeftTabs, canonicalId];
    }
    nextLeftActiveTab = canonicalId;
  } else if (targetZone === 'right') {
    if (!nextRightTabs.includes(canonicalId)) {
      nextRightTabs = [...nextRightTabs, canonicalId];
    }
    nextRightActiveTab = canonicalId;
    nextRightIsOpen = true;
  } else if (targetZone === 'floating') {
    const nextZ = getMaxFloatingZIndex(curFloatMap) + 1;
    const clampedRect = floatingRect && typeof floatingRect === 'object'
      ? clampFloatingRect(
          floatingRect,
          { width: 1440, height: 920 },
          {
            minWidth: panelCfg?.sizeLimits?.minWidth || 220,
            minHeight: panelCfg?.sizeLimits?.minHeight || 260,
          },
        )
      : curFloat.rect;
    nextFloatMap = {
      ...curFloatMap,
      [canonicalId]: {
        ...curFloat,
        isOpen: true,
        isMinimized: false,
        rect: clampedRect,
        zIndex: nextZ,
      },
    };
  }

  const nextModeSlice = {
    ...curSlice,
    presetId: 'custom',
    panelZones: nextPanelZones,
    leftDrawer: {
      ...curSlice.leftDrawer,
      activeTab: nextLeftActiveTab,
      tabs: nextLeftTabs,
    },
    rightDock: {
      ...curSlice.rightDock,
      isOpen: nextRightIsOpen,
      activeTab: nextRightActiveTab,
      tabs: nextRightTabs,
    },
    floatingPanels: nextFloatMap,
  };

  const synced = syncActiveModeSlice(prevLayout, modeId, nextModeSlice);
  if (canonicalId === 'attributesAndCss') {
    return {
      ...synced,
      modals: {
        ...synced.modals,
        attributesInspector: targetZone === 'floating',
      },
    };
  }
  return synced;
}

export function setWorkspaceDockActiveTab(prevLayout, zone, panelName) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);

  if (zone === 'left') {
    if (panelName === null) {
      return syncActiveModeSlice(prevLayout, modeId, {
        ...curSlice,
        leftDrawer: {
          ...curSlice.leftDrawer,
          activeTab: null,
          tabs: [],
        },
      });
    }
    const canonicalId = resolveCanonicalPanelId(panelName, modeId);
    if (!canonicalId || (curSlice.panelZones?.[canonicalId] || getPanelConfig(canonicalId)?.defaultZone) !== 'left') {
      return prevLayout;
    }
    const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
    const nextTabs = curTabs.includes(canonicalId) ? curTabs : [...curTabs, canonicalId];
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      leftDrawer: {
        ...curSlice.leftDrawer,
        activeTab: canonicalId,
        tabs: nextTabs,
      },
    });
  }

  if (zone === 'right') {
    if (panelName === null) {
      return syncActiveModeSlice(prevLayout, modeId, {
        ...curSlice,
        rightDock: {
          ...curSlice.rightDock,
          isOpen: false,
        },
      });
    }
    const canonicalId = resolveCanonicalPanelId(panelName, modeId);
    if (!canonicalId || (curSlice.panelZones?.[canonicalId] || getPanelConfig(canonicalId)?.defaultZone) !== 'right') {
      return prevLayout;
    }
    const curTabs = Array.isArray(curSlice.rightDock.tabs) ? curSlice.rightDock.tabs : [];
    const nextTabs = curTabs.includes(canonicalId) ? curTabs : [...curTabs, canonicalId];
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curSlice.rightDock,
        isOpen: true,
        activeTab: canonicalId,
        tabs: nextTabs,
      },
    });
  }

  return prevLayout;
}

export function updateWorkspaceFloatingPanelRect(
  prevLayout,
  panelName,
  nextRectOrUpdater,
  viewport = { width: 1440, height: 920 },
) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;
  const panelCfg = getPanelConfig(canonicalId);
  if (!panelCfg?.canFloat) return prevLayout;

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curFloatMap = curSlice.floatingPanels || {};
  const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
  const rawRect = typeof nextRectOrUpdater === 'function'
    ? nextRectOrUpdater(curFloat.rect)
    : nextRectOrUpdater;
  if (!rawRect || typeof rawRect !== 'object') return prevLayout;

  const clampedRect = clampFloatingRect(
    { ...curFloat.rect, ...rawRect },
    {
      width: Number(viewport?.width) > 0 ? Number(viewport.width) : 1440,
      height: Number(viewport?.height) > 0 ? Number(viewport.height) : 920,
    },
    {
      minWidth: panelCfg.sizeLimits?.minWidth || 220,
      minHeight: panelCfg.sizeLimits?.minHeight || 260,
    },
  );

  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    floatingPanels: {
      ...curFloatMap,
      [canonicalId]: {
        ...curFloat,
        rect: clampedRect,
      },
    },
  });
}

export function toggleWorkspaceFloatingPanelMinimized(prevLayout, panelName, forceValue = undefined) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;
  const panelCfg = getPanelConfig(canonicalId);
  if (!panelCfg?.canFloat) return prevLayout;

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curFloatMap = curSlice.floatingPanels || {};
  const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
  const nextMinimized = typeof forceValue === 'boolean' ? forceValue : !curFloat.isMinimized;

  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    floatingPanels: {
      ...curFloatMap,
      [canonicalId]: {
        ...curFloat,
        isMinimized: nextMinimized,
      },
    },
  });
}

export function bringWorkspaceFloatingPanelToFront(prevLayout, panelName) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const canonicalId = resolveCanonicalPanelId(panelName, modeId);
  if (!canonicalId) return prevLayout;
  const panelCfg = getPanelConfig(canonicalId);
  if (!panelCfg?.canFloat) return prevLayout;

  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curFloatMap = curSlice.floatingPanels || {};
  const curFloat = curFloatMap[canonicalId] || createDefaultFloatingPanelState(canonicalId);
  const nextZ = getMaxFloatingZIndex(curFloatMap) + 1;

  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    floatingPanels: {
      ...curFloatMap,
      [canonicalId]: {
        ...curFloat,
        zIndex: nextZ,
      },
    },
  });
}

export function computeEffectiveActivePanels(layout) {
  const modeConfig = getStudioModeConfig(layout?.activeMode);
  const panels = {};

  for (const item of modeConfig.menuPanels || []) {
    panels[item.id] = isWorkspacePanelOpen(layout, item.id);
  }
  return panels;
}

export function applyWorkspacePanelToggle(prevLayout, panelName) {
  return toggleWorkspacePanel(prevLayout, panelName);
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
  const nextModeSlice = buildNormalizedModeLayoutSlice(resolvedMode, {
    presetId,
    panelZones: presetSlice.panelZones,
    leftDrawer: presetSlice.leftDrawer,
    rightDock: presetSlice.rightDock,
    floatingPanels: presetSlice.floatingPanels,
    aiDock: presetSlice.aiDock,
  });
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
