import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_RIGHT_DOCK_WIDTH } from '../components/StudioRightDock';

const INITIAL_FUNCTION_EDITOR_STATE = {
  isOpen: false,
  fnObj: null,
  bindTargetElementId: null,
};

const INITIAL_WORKSPACE_LAYOUT = {
  showWelcomeScreen: true,
  leftDrawer: {
    activeTab: null, // 'layers' | 'elements' | 'templates' | 'code' | 'ai' | null
  },
  rightDock: {
    isOpen: true,
    propertiesTab: 'layout', // 'block' | 'style' | 'layout' | 'props' | 'css' | 'code'
    width: DEFAULT_RIGHT_DOCK_WIDTH,
  },
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

/**
 * Unified workspace layout, panel/dock, modal, and toast controller.
 * Input:  none (title/hash sync lives at App orchestration layer until useAppShell)
 * Output: {
 *   layout, setLayout, effectiveActivePanels,
 *   showWelcomeScreen, setShowWelcomeScreen,
 *   leftSidebarTab, setLeftSidebarTab,
 *   rightDockOpen, setRightDockOpen, rightPropertiesTab, setRightPropertiesTab, rightDockWidth, setRightDockWidth,
 *   aiDockMinimized, setAiDockMinimized, aiFocusSignal, setAiFocusSignal,
 *   showTutorial, setShowTutorial, showExportModal, setShowExportModal, showAddTagModal, setShowAddTagModal,
 *   showAttributesInspectorModal, setShowAttributesInspectorModal,
 *   showImportReportModal, setShowImportReportModal, importReportData, setImportReportData,
 *   functionEditorState, setFunctionEditorState, handleOpenFunctionEditor,
 *   previewToast, showToastMessage,
 *   handleSelectRightDockTarget, handleDockFloatingInspector, togglePanel,
 *   reset,
 * }
 */
export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(INITIAL_WORKSPACE_LAYOUT);
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

  const setLeftSidebarTab = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.leftDrawer.activeTab) : nextOrUpdater;
      return next === prev.leftDrawer.activeTab
        ? prev
        : { ...prev, leftDrawer: { ...prev.leftDrawer, activeTab: next } };
    });
  }, []);

  const setRightDockOpen = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.rightDock.isOpen) : nextOrUpdater;
      return next === prev.rightDock.isOpen
        ? prev
        : { ...prev, rightDock: { ...prev.rightDock, isOpen: next } };
    });
  }, []);

  const setRightPropertiesTab = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.rightDock.propertiesTab) : nextOrUpdater;
      return next === prev.rightDock.propertiesTab
        ? prev
        : { ...prev, rightDock: { ...prev.rightDock, propertiesTab: next } };
    });
  }, []);

  const setRightDockWidth = useCallback((nextOrUpdater) => {
    setLayout((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.rightDock.width) : nextOrUpdater;
      return next === prev.rightDock.width
        ? prev
        : { ...prev, rightDock: { ...prev.rightDock, width: next } };
    });
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

  const handleSelectRightDockTarget = useCallback((_moduleName, subTab = null) => {
    setLayout((prev) => {
      if (!prev.rightDock.isOpen) {
        return {
          ...prev,
          rightDock: {
            ...prev.rightDock,
            isOpen: true,
            propertiesTab: subTab || prev.rightDock.propertiesTab,
          },
        };
      }
      if (subTab && prev.rightDock.propertiesTab !== subTab) {
        return {
          ...prev,
          rightDock: {
            ...prev.rightDock,
            propertiesTab: subTab,
          },
        };
      }
      return {
        ...prev,
        rightDock: {
          ...prev.rightDock,
          isOpen: false,
        },
      };
    });
  }, []);

  const handleDockFloatingInspector = useCallback((targetTab = 'css') => {
    setLayout((prev) => ({
      ...prev,
      modals: {
        ...prev.modals,
        attributesInspector: false,
      },
      rightDock: {
        ...prev.rightDock,
        isOpen: true,
        propertiesTab: targetTab || 'css',
      },
    }));
  }, []);

  const togglePanel = useCallback((panelName) => {
    if (panelName === 'properties') {
      handleSelectRightDockTarget('properties');
      return;
    }
    setLayout((prev) => {
      if (panelName === 'layers') {
        return {
          ...prev,
          leftDrawer: {
            ...prev.leftDrawer,
            activeTab: prev.leftDrawer.activeTab === 'layers' ? null : 'layers',
          },
        };
      }
      if (panelName === 'assets') {
        return {
          ...prev,
          leftDrawer: {
            ...prev.leftDrawer,
            activeTab: prev.leftDrawer.activeTab === 'templates' ? null : 'templates',
          },
        };
      }
      if (panelName === 'attributesAndCss') {
        return {
          ...prev,
          modals: {
            ...prev.modals,
            attributesInspector: !prev.modals.attributesInspector,
          },
        };
      }
      if (panelName === 'aiAgent') {
        const nextMinimized = !prev.aiDock.isMinimized;
        return {
          ...prev,
          aiDock: {
            isMinimized: nextMinimized,
            focusSignal: !nextMinimized ? prev.aiDock.focusSignal + 1 : prev.aiDock.focusSignal,
          },
        };
      }
      return prev;
    });
  }, [handleSelectRightDockTarget]);

  const effectiveActivePanels = useMemo(() => ({
    properties: layout.rightDock.isOpen,
    aiAgent: !layout.aiDock.isMinimized,
    layers: layout.leftDrawer.activeTab === 'layers',
    assets: layout.leftDrawer.activeTab === 'templates' || layout.leftDrawer.activeTab === 'elements',
    attributesAndCss: layout.modals.attributesInspector,
  }), [
    layout.rightDock.isOpen,
    layout.aiDock.isMinimized,
    layout.leftDrawer.activeTab,
    layout.modals.attributesInspector,
  ]);

  const reset = useCallback(({ showWelcomeScreen = false, leftTab = null, aiMinimized = false } = {}) => {
    setLayout((prev) => ({
      ...INITIAL_WORKSPACE_LAYOUT,
      showWelcomeScreen,
      leftDrawer: {
        activeTab: leftTab,
      },
      rightDock: {
        ...INITIAL_WORKSPACE_LAYOUT.rightDock,
        width: prev.rightDock.width,
      },
      aiDock: {
        isMinimized: aiMinimized,
        focusSignal: prev.aiDock.focusSignal,
      },
    }));
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

  return {
    layout,
    setLayout,
    effectiveActivePanels,
    showWelcomeScreen: layout.showWelcomeScreen,
    setShowWelcomeScreen,
    leftSidebarTab: layout.leftDrawer.activeTab,
    setLeftSidebarTab,
    rightDockOpen: layout.rightDock.isOpen,
    setRightDockOpen,
    rightPropertiesTab: layout.rightDock.propertiesTab,
    setRightPropertiesTab,
    rightDockWidth: layout.rightDock.width,
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
