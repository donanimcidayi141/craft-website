import { useState, useRef, useCallback, useEffect } from 'react';
import { runImport } from '../utils/importPipeline';
import { CONTENT_PACK_ASSETS } from '../data/contentPacks';
import { TEMPLATE_BLUEPRINTS, buildBespokeTemplateElements } from '../data/templateBlueprints';
import { DEFAULT_UNIVERSAL_PROJECT } from '../constants';
import { clonePresetSubtree } from '../utils/treeUtils';
import {
  createDefaultCanvasByViewport,
  ensureViewportAdapted,
} from '../utils/responsiveUtils';
import {
  buildSerializableProjectSchema,
  parseAndMigrateLoadedProject,
  createDefaultProjectBackend,
  normalizeProjectBackend,
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
} from '../utils/projectStorage';
import { buildTabState } from '../utils/projectAssemblyUtils';

/**
 * Project persistence, file/folder import, autosave draft, recent projects, and starter assembly hook.
 * Calls no other custom hooks directly; receives state snapshot and cross-hook actions/resetForProject coordinator.
 *
 * Input: {
 *   state: {
 *     projectMeta,
 *     tabs,
 *     activeTabId,
 *     viewportMode,
 *     projectFunctions,
 *     pageLinks,
 *     hasUnsavedChanges,
 *     showWelcomeScreen,
 *     importReportData,
 *   },
 *   actions: {
 *     resetForProject,
 *     resetWorkspaceLayout,
 *     setProjectMeta,
 *     setHasUnsavedChanges,
 *     setImportReportData,
 *     setShowImportReportModal,
 *     showToastMessage,
 *     setPendingWelcomeAiPrompt,
 *   },
 * }
 *
 * Output: {
 *   recentProjects,
 *   autosaveDraft,
 *   projectFileInputRef,
 *   projectFolderInputRef,
 *   buildCurrentProjectSchema,
 *   flushAutosaveDraft,
 *   applyLoadedProjectSchema,
 *   handleStartNewProject,
 *   handleStartAssembledProject,
 *   handleStartAiPromptFromWelcome,
 *   handleGoHome,
 *   handleSaveProject,
 *   handleOpenProject,
 *   handleOpenProjectFile,
 *   handleProjectFileInputChange,
 *   handleOpenProjectFolder,
 *   handleProjectFolderInputChange,
 *   handleConfirmImport,
 *   handleOpenRecentProject,
 *   handleSaveRecentProject,
 *   handleDeleteRecentProject,
 *   handleRestoreAutosave,
 *   handleSaveAutosave,
 *   handleDismissAutosave,
 * }
 */
export function useProjectIO({ state, actions }) {
  const {
    projectMeta,
    tabs,
    activeTabId,
    viewportMode,
    projectFunctions,
    pageLinks,
    projectBackend,
    hasUnsavedChanges,
    showWelcomeScreen,
    importReportData,
  } = state;

  const {
    resetForProject,
    resetWorkspaceLayout,
    setProjectMeta,
    setHasUnsavedChanges,
    setImportReportData,
    setShowImportReportModal,
    showToastMessage,
    setPendingWelcomeAiPrompt,
  } = actions;

  const projectFileInputRef = useRef(null);
  const projectFolderInputRef = useRef(null);
  const [recentProjects, setRecentProjects] = useState(() => loadRecentProjects());
  const [autosaveDraft, setAutosaveDraft] = useState(() => loadAutosaveDraft());

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
      backend: projectBackend,
      createdAt: projectMeta.createdAt,
      ...overrides,
    });
  }, [projectMeta, tabs, activeTabId, viewportMode, projectFunctions, pageLinks, projectBackend]);

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

    resetForProject({
      project: {
        tabs: loadedTabs,
        historyByTab: nextHistory,
        activeTabId: resolvedActiveId,
        viewportMode: schema.viewportMode || 'desktop',
        projectFunctions: Array.isArray(schema.projectFunctions) ? schema.projectFunctions : [],
        pageLinks: Array.isArray(schema.pageLinks) ? schema.pageLinks : [],
        backend: normalizeProjectBackend(schema.backend),
        projectMeta: {
          id: schema.id,
          name: finalName,
          filePath: nextFilePath,
          createdAt: schema.createdAt || new Date().toISOString(),
        },
        hasUnsavedChanges: Boolean(extraMeta.markUnsaved),
      },
      layout: { showWelcomeScreen: false },
      selectionOrder: 'beforePreview',
    });

    if (!extraMeta.skipRecentUpdate) {
      const updatedRecent = upsertRecentProject({
        ...schema,
        name: finalName,
        filePath: nextFilePath,
      });
      setRecentProjects(updatedRecent);
    }
  }, [resetForProject]);

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
  const handleStartNewProject = useCallback((type, layoutOverrides = {}) => {
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

    resetForProject({
      project: {
        ...(nextTab ? { tabs: [nextTab], activeTabId: newTabId } : {}),
        viewportMode: nextViewportMode,
        ...(nextProjectMeta ? { projectMeta: nextProjectMeta } : {}),
        hasUnsavedChanges: false,
        projectFunctions: [],
        pageLinks: [],
        backend: createDefaultProjectBackend(),
      },
      layout: { showWelcomeScreen: false, ...layoutOverrides },
      selectionOrder: 'afterPreview',
    });
  }, [resetForProject]);

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

    const cleanPrompt = String(aiPrompt || '').trim();
    resetForProject({
      project: {
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
        backend: createDefaultProjectBackend(),
      },
      layout: {
        showWelcomeScreen: false,
        leftTab: cleanPrompt ? 'ai' : null,
        aiMinimized: false,
      },
      selectionOrder: 'afterPreview',
    });

    if (cleanPrompt) {
      setPendingWelcomeAiPrompt(cleanPrompt);
    } else if (assembledElements.length > 0) {
      showToastMessage(`✓ ${assembledElements.length} modüler katman tuvale yerleştirildi`, 'success');
    }
  }, [resetForProject, showToastMessage, setPendingWelcomeAiPrompt]);

  // Karşılama ekranındaki Gemini komut kutusundan boş tuval + ilk AI isteğini başlatır
  const handleStartAiPromptFromWelcome = useCallback((promptText, options = null) => {
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
    handleStartNewProject('blank', { leftTab: 'ai', aiMinimized: false });
    setPendingWelcomeAiPrompt(clean);
  }, [handleStartAssembledProject, handleStartNewProject, setPendingWelcomeAiPrompt]);

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
  }, [buildCurrentProjectSchema, projectMeta.filePath, projectMeta.name, setProjectMeta, setHasUnsavedChanges, showToastMessage]);

  // 📂 Open parsed JSON project object directly
  const handleOpenProject = useCallback((importedData) => {
    try {
      applyLoadedProjectSchema(importedData);
      showToastMessage('✓ Proje başarıyla yüklendi.', 'success');
    } catch (err) {
      console.error('Open project error:', err);
      showToastMessage('Proje açılamadı.', 'error');
    }
  }, [applyLoadedProjectSchema, showToastMessage]);

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

  const handleProjectFileInputChange = useCallback(async (e) => {
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
  }, [applyLoadedProjectSchema, showToastMessage]);

  // 📂 Open Project Folder (Electron IPC veya tarayıcı webkitdirectory seçicisi üzerinden tek runImport hattı)
  const handleOpenProjectFolder = useCallback(async () => {
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
  }, [setImportReportData, setShowImportReportModal, showToastMessage]);

  const handleProjectFolderInputChange = useCallback(async (e) => {
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
  }, [setImportReportData, setShowImportReportModal, showToastMessage]);

  const handleConfirmImport = useCallback(() => {
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
        backend: importReportData.backend,
      });
    } catch (err) {
      showToastMessage(`İçe aktarma hatası: ${err.message}`, 'error');
    }
    setShowImportReportModal(false);
  }, [importReportData, applyLoadedProjectSchema, showToastMessage, setShowImportReportModal]);

  const handleOpenRecentProject = useCallback(async (proj) => {
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
          backend: proj.backend,
        });
        return;
      }
      showToastMessage('Bu son proje kaydının içeriği bulunamadı.', 'error');
    } catch (err) {
      showToastMessage(`Son proje açılamadı: ${err.message}`, 'error');
    }
  }, [applyLoadedProjectSchema, showToastMessage]);

  const handleDeleteRecentProject = useCallback((projectId) => {
    deleteProjectFromWebStorage(projectId);
    setRecentProjects(removeRecentProject(projectId));
  }, []);

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
  }, [autosaveDraft, setHasUnsavedChanges, showToastMessage]);

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
    resetWorkspaceLayout({ showWelcomeScreen: true });
  }, [showWelcomeScreen, hasUnsavedChanges, flushAutosaveDraft, resetWorkspaceLayout]);

  return {
    recentProjects,
    autosaveDraft,
    projectFileInputRef,
    projectFolderInputRef,
    buildCurrentProjectSchema,
    flushAutosaveDraft,
    applyLoadedProjectSchema,
    handleStartNewProject,
    handleStartAssembledProject,
    handleStartAiPromptFromWelcome,
    handleGoHome,
    handleSaveProject,
    handleOpenProject,
    handleOpenProjectFile,
    handleProjectFileInputChange,
    handleOpenProjectFolder,
    handleProjectFolderInputChange,
    handleConfirmImport,
    handleOpenRecentProject,
    handleSaveRecentProject,
    handleDeleteRecentProject,
    handleRestoreAutosave,
    handleSaveAutosave,
    handleDismissAutosave,
  };
}
