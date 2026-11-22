import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
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

  const rawLeftActive = override?.leftDrawer?.activeTab !== undefined
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
  const canonicalLeftActive = rawLeftActive ? resolveCanonicalPanelId(rawLeftActive, resolvedMode) : null;
  let leftActiveTab = canonicalLeftActive && panelZones[canonicalLeftActive] === 'left'
    ? canonicalLeftActive
    : null;

  if (leftActiveTab && !leftTabs.includes(leftActiveTab)) {
    leftTabs.push(leftActiveTab);
  }
  if (!leftActiveTab) {
    if (rawLeftActive === null) {
      leftTabs = [];
    } else if (leftTabs.length > 0) {
      leftActiveTab = leftTabs[0];
    } else {
      leftTabs = [];
    }
  }

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
  const rightIsOpen = rightTabs.length > 0
    ? Boolean(override?.rightDock?.isOpen ?? modeDefault.rightDock.isOpen)
    : false;

  const floatingPanels = createDefaultFloatingPanelsForMode(resolvedMode);
  if (override?.floatingPanels && typeof override.floatingPanels === 'object' && !Array.isArray(override.floatingPanels)) {
    for (const [rawId, rawState] of Object.entries(override.floatingPanels)) {
      const canonicalId = resolveCanonicalPanelId(rawId, resolvedMode);
      if (!canonicalId || !floatingPanels[canonicalId] || !rawState || typeof rawState !== 'object') continue;
      const baseFloat = floatingPanels[canonicalId];
      const panelCfg = getPanelConfig(canonicalId);
      const nextRect = rawState.rect && typeof rawState.rect === 'object'
        ? {
            x: Number.isFinite(Number(rawState.rect.x)) ? Math.round(Number(rawState.rect.x)) : baseFloat.rect.x,
            y: Number.isFinite(Number(rawState.rect.y)) ? Math.round(Number(rawState.rect.y)) : baseFloat.rect.y,
            width: Number.isFinite(Number(rawState.rect.width))
              ? Math.max(panelCfg?.sizeLimits?.minWidth || 220, Math.min(panelCfg?.sizeLimits?.maxWidth || 960, Math.round(Number(rawState.rect.width))))
              : baseFloat.rect.width,
            height: Number.isFinite(Number(rawState.rect.height))
              ? Math.max(panelCfg?.sizeLimits?.minHeight || 260, Math.min(panelCfg?.sizeLimits?.maxHeight || 880, Math.round(Number(rawState.rect.height))))
              : baseFloat.rect.height,
          }
        : baseFloat.rect;
      const isAllowedOpenFloating = panelZones[canonicalId] === 'floating';
      floatingPanels[canonicalId] = {
        isOpen: isAllowedOpenFloating && typeof rawState.isOpen === 'boolean' ? rawState.isOpen : false,
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
      attributesInspector: Boolean(
        activeMode === 'design' &&
        currentSlice.panelZones?.attributesAndCss === 'floating' &&
        currentSlice.floatingPanels?.attributesAndCss?.isOpen,
      ),
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
  const isDesignMode = nextLayout.activeMode === 'design';
  const attrZone = currentActiveSlice.panelZones?.attributesAndCss || 'floating';
  const attrFloatOpen = Boolean(currentActiveSlice.floatingPanels?.attributesAndCss?.isOpen);
  return {
    ...nextLayout,
    layoutsByMode: nextLayoutsByMode,
    leftDrawer: currentActiveSlice.leftDrawer,
    rightDock: currentActiveSlice.rightDock,
    aiDock: {
      ...nextLayout.aiDock,
      isMinimized: Boolean(currentActiveSlice.aiDock?.isMinimized),
    },
    modals: {
      ...nextLayout.modals,
      attributesInspector: isDesignMode && attrZone === 'floating' ? attrFloatOpen : false,
    },
  };
}

/**
 * Validates that all legacy bridge fields (`leftDrawer.activeTab`, `leftDrawer.width`,
 * `rightDock.isOpen`, `rightDock.propertiesTab`, `rightDock.width`, `aiDock.isMinimized`,
 * `modals.attributesInspector`, `computeEffectiveActivePanels`) are 100% consistent with
 * the multi-zone tabbed panel model (`panelZones`, `leftDrawer.tabs`, `rightDock.tabs`,
 * `rightDock.activeTab`, `floatingPanels`).
 * Returns `{ ok: true, errors: [] }` or `{ ok: false, errors: [...] }`.
 */
export function validateWorkspaceLayoutBridgeInvariant(layout) {
  const errors = [];
  if (!layout || typeof layout !== 'object') {
    return { ok: false, errors: ['Layout state is null or not an object'] };
  }

  const modeId = isValidStudioMode(layout.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
  const activeSlice = layout.layoutsByMode?.[modeId];
  if (!activeSlice) {
    errors.push(`Missing layoutsByMode slice for activeMode "${modeId}"`);
    return { ok: false, errors };
  }

  // 1. Top-level compatibility aliases must match active mode slice
  if (layout.leftDrawer !== activeSlice.leftDrawer) {
    errors.push('layout.leftDrawer reference does not match layoutsByMode[activeMode].leftDrawer');
  }
  if (layout.rightDock !== activeSlice.rightDock) {
    errors.push('layout.rightDock reference does not match layoutsByMode[activeMode].rightDock');
  }
  if (Boolean(layout.aiDock?.isMinimized) !== Boolean(activeSlice.aiDock?.isMinimized)) {
    errors.push(
      `layout.aiDock.isMinimized (${layout.aiDock?.isMinimized}) !== activeSlice.aiDock.isMinimized (${activeSlice.aiDock?.isMinimized})`,
    );
  }

  // 2. Left drawer tabs vs activeTab vs panelZones
  const leftTabs = Array.isArray(activeSlice.leftDrawer?.tabs) ? activeSlice.leftDrawer.tabs : [];
  const leftActive = activeSlice.leftDrawer?.activeTab ?? null;
  if (leftActive === null && leftTabs.length !== 0) {
    errors.push(`leftDrawer.activeTab is null but leftDrawer.tabs is non-empty: ${JSON.stringify(leftTabs)}`);
  }
  if (leftActive !== null && !leftTabs.includes(leftActive)) {
    errors.push(`leftDrawer.activeTab "${leftActive}" is not included in leftDrawer.tabs ${JSON.stringify(leftTabs)}`);
  }
  if (new Set(leftTabs).size !== leftTabs.length) {
    errors.push(`leftDrawer.tabs contains duplicate panel IDs: ${JSON.stringify(leftTabs)}`);
  }
  for (const tabId of leftTabs) {
    if (!isPanelAllowedInMode(tabId, modeId)) {
      errors.push(`leftDrawer.tabs contains panel "${tabId}" not allowed in mode "${modeId}"`);
    }
    if (activeSlice.panelZones?.[tabId] !== 'left') {
      errors.push(
        `leftDrawer.tabs contains "${tabId}" whose panelZones entry is "${activeSlice.panelZones?.[tabId]}" instead of "left"`,
      );
    }
  }

  // 3. Right dock tabs vs activeTab vs isOpen vs panelZones
  const rightTabs = Array.isArray(activeSlice.rightDock?.tabs) ? activeSlice.rightDock.tabs : [];
  const rightActive = activeSlice.rightDock?.activeTab ?? null;
  const rightOpen = Boolean(activeSlice.rightDock?.isOpen);
  if (new Set(rightTabs).size !== rightTabs.length) {
    errors.push(`rightDock.tabs contains duplicate panel IDs: ${JSON.stringify(rightTabs)}`);
  }
  if (rightOpen && rightTabs.length === 0) {
    errors.push('rightDock.isOpen is true but rightDock.tabs is empty');
  }
  if (rightOpen && (!rightActive || !rightTabs.includes(rightActive))) {
    errors.push(
      `rightDock.isOpen is true but rightDock.activeTab "${rightActive}" is not in rightDock.tabs ${JSON.stringify(rightTabs)}`,
    );
  }
  for (const tabId of rightTabs) {
    if (!isPanelAllowedInMode(tabId, modeId)) {
      errors.push(`rightDock.tabs contains panel "${tabId}" not allowed in mode "${modeId}"`);
    }
    if (activeSlice.panelZones?.[tabId] !== 'right') {
      errors.push(
        `rightDock.tabs contains "${tabId}" whose panelZones entry is "${activeSlice.panelZones?.[tabId]}" instead of "right"`,
      );
    }
  }

  // 4. Floating panels & showAttributesInspectorModal consistency
  const floatMap = activeSlice.floatingPanels || {};
  for (const [panelId, floatState] of Object.entries(floatMap)) {
    if (floatState?.isOpen) {
      if (activeSlice.panelZones?.[panelId] !== 'floating') {
        errors.push(
          `floatingPanels["${panelId}"].isOpen is true but panelZones["${panelId}"] is "${activeSlice.panelZones?.[panelId]}"`,
        );
      }
      if (leftTabs.includes(panelId) || rightTabs.includes(panelId)) {
        errors.push(`Floating open panel "${panelId}" also appears in dock tabs`);
      }
    }
  }

  const expectedAttrModal =
    modeId === 'design' &&
    activeSlice.panelZones?.attributesAndCss === 'floating' &&
    Boolean(floatMap.attributesAndCss?.isOpen);
  if (Boolean(layout.modals?.attributesInspector) !== expectedAttrModal) {
    errors.push(
      `modals.attributesInspector (${layout.modals?.attributesInspector}) !== expected (${expectedAttrModal})`,
    );
  }

  // 5. computeEffectiveActivePanels vs isWorkspacePanelOpen
  const effectiveMap = computeEffectiveActivePanels(layout);
  const modeConfig = getStudioModeConfig(modeId);
  for (const item of modeConfig.menuPanels || []) {
    const expectedOpen = isWorkspacePanelOpen(layout, item.id);
    if (Boolean(effectiveMap[item.id]) !== expectedOpen) {
      errors.push(
        `computeEffectiveActivePanels["${item.id}"] (${effectiveMap[item.id]}) !== isWorkspacePanelOpen (${expectedOpen})`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertWorkspaceLayoutBridgeInvariant(layout, contextLabel = '') {
  const result = validateWorkspaceLayoutBridgeInvariant(layout);
  if (!result.ok) {
    const prefix = contextLabel ? `[BridgeInvariant: ${contextLabel}] ` : '[BridgeInvariant] ';
    throw new Error(`${prefix}${result.errors.join(' | ')}`);
  }
  return true;
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

  if (!nextTab) {
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      leftDrawer: {
        ...curSlice.leftDrawer,
        activeTab: null,
        tabs: [],
      },
    });
  }

  const canonicalId = resolveCanonicalPanelId(nextTab, modeId);
  if (!canonicalId || !isPanelAllowedInZone(canonicalId, 'left')) {
    return prevLayout;
  }

  const currentZone = curSlice.panelZones?.[canonicalId] || getPanelConfig(canonicalId)?.defaultZone;
  if (currentZone !== 'left') {
    return moveWorkspacePanelToZone(prevLayout, canonicalId, 'left');
  }

  const curTabs = Array.isArray(curSlice.leftDrawer.tabs) ? curSlice.leftDrawer.tabs : [];
  let nextTabs = curTabs;
  if (curTabs.length <= 1) {
    nextTabs = [canonicalId];
  } else if (!curTabs.includes(canonicalId)) {
    nextTabs = [...curTabs, canonicalId];
  }

  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    leftDrawer: {
      ...curSlice.leftDrawer,
      activeTab: canonicalId,
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
  let nextDock = { ...curDock, ...patch };
  if (
    nextDock.isOpen === curDock.isOpen &&
    nextDock.activeTab === curDock.activeTab &&
    nextDock.propertiesTab === curDock.propertiesTab &&
    nextDock.width === curDock.width &&
    nextDock.tabs === curDock.tabs
  ) {
    return prevLayout;
  }

  // Ensure rightDock.isOpen === true always has at least one valid right-zone tab & activeTab
  if (nextDock.isOpen) {
    const validRightTabs = (Array.isArray(nextDock.tabs) ? nextDock.tabs : []).filter(
      (t) => isPanelAllowedInMode(t, modeId) && curSlice.panelZones?.[t] === 'right',
    );
    if (validRightTabs.length === 0) {
      const defaultRightId = getDefaultRightPanelIdForMode(modeId);
      const movedBack = moveWorkspacePanelToZone(prevLayout, defaultRightId, 'right');
      const movedSlice = getActiveModeLayoutSlice(movedBack);
      return syncActiveModeSlice(movedBack, modeId, {
        ...movedSlice,
        rightDock: {
          ...movedSlice.rightDock,
          propertiesTab: nextDock.propertiesTab || movedSlice.rightDock.propertiesTab,
          width: nextDock.width || movedSlice.rightDock.width,
        },
      });
    }
    const resolvedActive =
      nextDock.activeTab && validRightTabs.includes(nextDock.activeTab)
        ? nextDock.activeTab
        : validRightTabs[0];
    nextDock = {
      ...nextDock,
      tabs: validRightTabs,
      activeTab: resolvedActive,
    };
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

  if (!curDock.isOpen) {
    const validRightTabs = (Array.isArray(curDock.tabs) ? curDock.tabs : []).filter(
      (t) => isPanelAllowedInMode(t, modeId) && curSlice.panelZones?.[t] === 'right',
    );
    if (validRightTabs.length === 0) {
      const movedBack = moveWorkspacePanelToZone(prevLayout, defaultRightId, 'right');
      const movedSlice = getActiveModeLayoutSlice(movedBack);
      return syncActiveModeSlice(movedBack, modeId, {
        ...movedSlice,
        rightDock: {
          ...movedSlice.rightDock,
          propertiesTab: subTab || movedSlice.rightDock.propertiesTab,
        },
      });
    }
    return syncActiveModeSlice(prevLayout, modeId, {
      ...curSlice,
      rightDock: {
        ...curDock,
        isOpen: true,
        tabs: validRightTabs,
        activeTab: curDock.activeTab && validRightTabs.includes(curDock.activeTab)
          ? curDock.activeTab
          : validRightTabs[0],
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

export function updateActiveModeAiDockMinimized(prevLayout, nextOrUpdater) {
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  const curVal = Boolean(prevLayout?.aiDock?.isMinimized);
  const nextVal = Boolean(typeof nextOrUpdater === 'function' ? nextOrUpdater(curVal) : nextOrUpdater);
  if (nextVal === curVal && Boolean(curSlice.aiDock?.isMinimized) === nextVal) {
    return prevLayout;
  }
  return syncActiveModeSlice(prevLayout, modeId, {
    ...curSlice,
    aiDock: { isMinimized: nextVal },
  });
}

export function updateWorkspaceAttributesInspectorModal(prevLayout, nextOrUpdater) {
  const curOpen = Boolean(prevLayout?.modals?.attributesInspector);
  const nextOpen = Boolean(typeof nextOrUpdater === 'function' ? nextOrUpdater(curOpen) : nextOrUpdater);
  const modeId = isValidStudioMode(prevLayout?.activeMode) ? prevLayout.activeMode : DEFAULT_STUDIO_MODE;
  if (modeId !== 'design') {
    return curOpen ? { ...prevLayout, modals: { ...prevLayout.modals, attributesInspector: false } } : prevLayout;
  }
  if (nextOpen) {
    const curSlice = getActiveModeLayoutSlice(prevLayout);
    if (curSlice.panelZones?.attributesAndCss !== 'floating') {
      return moveWorkspacePanelToZone(prevLayout, 'attributesAndCss', 'floating');
    }
    return openWorkspacePanel(prevLayout, 'attributesAndCss');
  }
  const curSlice = getActiveModeLayoutSlice(prevLayout);
  if (curSlice.panelZones?.attributesAndCss === 'floating') {
    return closeWorkspacePanel(prevLayout, 'attributesAndCss');
  }
  return curOpen ? { ...prevLayout, modals: { ...prevLayout.modals, attributesInspector: false } } : prevLayout;
}

export function dockWorkspaceFloatingInspector(prevLayout, targetTab = 'css') {
  const closed = updateWorkspaceAttributesInspectorModal(prevLayout, false);
  return updateActiveModeRightDock(closed, {
    isOpen: true,
    propertiesTab: targetTab || 'css',
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
  const prevDesignSlice = prevLayout.layoutsByMode?.design || INITIAL_WORKSPACE_LAYOUT.layoutsByMode.design;
  const closedDesignSlice = prevDesignSlice?.floatingPanels?.attributesAndCss?.isOpen
    ? {
        ...prevDesignSlice,
        floatingPanels: {
          ...prevDesignSlice.floatingPanels,
          attributesAndCss: {
            ...prevDesignSlice.floatingPanels.attributesAndCss,
            isOpen: false,
          },
        },
      }
    : prevDesignSlice;
  const nextLayoutsByMode = {
    ...prevLayout.layoutsByMode,
    design: closedDesignSlice,
  };
  const targetSlice = nextLayoutsByMode[nextModeId]
    || INITIAL_WORKSPACE_LAYOUT.layoutsByMode[nextModeId];

  const nextLayout = {
    ...prevLayout,
    activeMode: nextModeId,
    activeTool: defaultToolId,
    openPopover: null,
    layoutsByMode: nextLayoutsByMode,
    leftDrawer: targetSlice.leftDrawer,
    rightDock: targetSlice.rightDock,
    aiDock: {
      ...prevLayout.aiDock,
      isMinimized: Boolean(targetSlice.aiDock?.isMinimized),
    },
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
      aiDock: { isMinimized: Boolean(aiMinimized) },
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
      aiDock: { isMinimized: Boolean(aiMinimized) },
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
  // - Continuous splitter width / floating rect drags are debounced (180ms) and flushed once on pointerup/mouseup/beforeunload
  //   so 60 pointermove events during a drag produce only 1 storage write instead of 60.
  // - Uses useLayoutEffect so pendingPersistPayloadRef is populated synchronously before pointerup can arrive.
  // - Always persists the user's intrinsic (unclamped) widths so shrinking & re-expanding the window restores original widths.
  useLayoutEffect(() => {
    const modeId = isValidStudioMode(layout.activeMode) ? layout.activeMode : DEFAULT_STUDIO_MODE;
    const activeModeSlice = layout.layoutsByMode?.[modeId];
    const toPersist = {
      ...layout.layoutsByMode,
      [modeId]: {
        ...activeModeSlice,
        aiDock: { isMinimized: Boolean(layout.aiDock?.isMinimized) },
      },
    };
    const serializeFloatingStructural = (floatMap) => {
      const summary = {};
      for (const [id, st] of Object.entries(floatMap || {})) {
        summary[id] = {
          o: Boolean(st?.isOpen),
          m: Boolean(st?.isMinimized),
          z: Number(st?.zIndex) || 50,
        };
      }
      return summary;
    };
    const nonWidthKey = JSON.stringify({
      activeMode: modeId,
      designTab: toPersist.design?.leftDrawer?.activeTab ?? null,
      designLeftTabs: toPersist.design?.leftDrawer?.tabs || [],
      designOpen: Boolean(toPersist.design?.rightDock?.isOpen),
      designRightActive: toPersist.design?.rightDock?.activeTab ?? null,
      designRightTabs: toPersist.design?.rightDock?.tabs || [],
      designPropTab: toPersist.design?.rightDock?.propertiesTab ?? 'layout',
      designPreset: toPersist.design?.presetId ?? 'standard',
      designZones: toPersist.design?.panelZones || {},
      designFloating: serializeFloatingStructural(toPersist.design?.floatingPanels),
      designAiMin: Boolean(toPersist.design?.aiDock?.isMinimized),
      backendTab: toPersist.backend?.leftDrawer?.activeTab ?? null,
      backendLeftTabs: toPersist.backend?.leftDrawer?.tabs || [],
      backendOpen: Boolean(toPersist.backend?.rightDock?.isOpen),
      backendRightActive: toPersist.backend?.rightDock?.activeTab ?? null,
      backendRightTabs: toPersist.backend?.rightDock?.tabs || [],
      backendPropTab: toPersist.backend?.rightDock?.propertiesTab ?? 'stepConfig',
      backendPreset: toPersist.backend?.presetId ?? 'standard',
      backendZones: toPersist.backend?.panelZones || {},
      backendFloating: serializeFloatingStructural(toPersist.backend?.floatingPanels),
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
    setLayout((prev) => updateActiveModeAiDockMinimized(prev, nextOrUpdater));
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
    setLayout((prev) => updateWorkspaceAttributesInspectorModal(prev, nextOrUpdater));
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
    setLayout((prev) => dockWorkspaceFloatingInspector(prev, targetTab));
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
