import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { runImport } from '../utils/importPipeline';
import { INITIAL_MODELS } from '../hooks/useAiChatSession';
import {
  getApiKey,
  getSettings,
  subscribe as subscribeSettings,
  updateSettings,
} from '../settings/settingsStore';
import { getWelcomeAsset } from './welcomeAssets';
import SettingsDialog from './settings/SettingsDialog';
import '../styles/welcome-tokens.css';
import WelcomeSidebar from './welcome/WelcomeSidebar';
import WelcomeTopBar from './welcome/WelcomeTopBar';
import WelcomeAiComposer from './welcome/WelcomeAiComposer';
import WelcomeCreateSection from './welcome/WelcomeCreateSection';
import WelcomeRecentProjects from './welcome/WelcomeRecentProjects';
import WelcomeTemplatesSection from './welcome/WelcomeTemplatesSection';
import WelcomeFooterBar from './welcome/WelcomeFooterBar';
import WelcomeImportPage from './welcome/WelcomeImportPage';

/**
 * Geliştirici/ekran görüntüsü önizleme anahtarı.
 * Varsayılan olarak kapalıdır; ?mock=1 sorgu parametresiyle de etkinleştirilebilir.
 */
const USE_MOCK_RECENTS = false;

function isMockModeActive() {
  if (USE_MOCK_RECENTS) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
}

function resolveNavFromHash(rawHash = '') {
  const h = String(rawHash || '').toLowerCase();
  if (h === '#/ice-aktar' || h === '#ice-aktar') return 'import';
  if (h === '#/projeler' || h === '#projeler') return 'projects';
  if (h === '#/sablonlar' || h === '#sablonlar') return 'templates';
  return 'home';
}

const NAV_HASH_MAP = {
  home: '#/',
  projects: '#/projeler',
  templates: '#/sablonlar',
  import: '#/ice-aktar',
};

const INITIAL_IMPORT_STATE = {
  status: 'idle',
  progress: null,
  report: null,
  error: null,
  project: null,
  livePolite: '',
};

export default function WelcomeScreen({
  onNewProject,
  onStartAssembledProject = null,
  onOpenProject,
  onOpenProjectFile = null,
  onOpenProjectFolder = null,
  onOpenRecentProject,
  onSaveRecentProject = null,
  onDeleteRecentProject = null,
  recentProjects = [],
  autosaveDraft = null,
  onRestoreAutosave = null,
  onSaveAutosave = null,
  onDismissAutosave = null,
  aiChat = null,
  onStartAiPrompt = null,
}) {
  void onOpenProjectFile;
  void onOpenProjectFolder;

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const composerInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [settings, setSettings] = useState(() => getSettings());
  const [storedApiKey, setStoredApiKey] = useState(() => getApiKey());
  const [recentListCleared, setRecentListCleared] = useState(false);

  const [activeNav, setActiveNav] = useState(() =>
    resolveNavFromHash(typeof window !== 'undefined' ? window.location.hash : ''),
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [wizardRequestTick, setWizardRequestTick] = useState(0);
  const [fileError, setFileError] = useState(null);
  const [infoNotice, setInfoNotice] = useState(null);
  const [importState, setImportState] = useState(INITIAL_IMPORT_STATE);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('ai');
  const [settingsContextNote, setSettingsContextNote] = useState(null);

  const useMockRecents = isMockModeActive();
  const isAiConnected = Boolean(storedApiKey || aiChat?.apiKey);
  const heroBgUrl = getWelcomeAsset('hero-bg');

  // settingsStore abonelik senkronizasyonu (yeniden mount gerektirmeden günceller)
  useEffect(() => {
    return subscribeSettings((snapshot) => {
      setSettings(snapshot.settings);
      setStoredApiKey(snapshot.apiKey);
    });
  }, []);

  // Seçili model ayarını mevcut aiChat oturumuyla eşitle
  useEffect(() => {
    if (aiChat?.setModel && settings.defaultModel && aiChat.model !== settings.defaultModel) {
      aiChat.setModel(settings.defaultModel);
    }
  }, [settings.defaultModel]);

  // Ctrl+, / Cmd+, ile Ayarlar penceresini aç
  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        setSettingsInitialTab('ai');
        setSettingsContextNote(null);
        setSettingsDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // recentProjects prop'u dışarıdan yeni projelerle güncellenirse temizleme bayrağını sıfırla
  useEffect(() => {
    if (Array.isArray(recentProjects) && recentProjects.length > 0) {
      setRecentListCleared(false);
    }
  }, [recentProjects]);

  const effectiveRecentProjects = recentListCleared ? [] : recentProjects;

  const modelCatalog =
    Array.isArray(aiChat?.availableModels) && aiChat.availableModels.length > 0
      ? aiChat.availableModels
      : INITIAL_MODELS;
  const activeModelId = settings.defaultModel || aiChat?.model || INITIAL_MODELS[0].id;
  const selectedModelLabel =
    modelCatalog.find((item) => item.id === activeModelId)?.label || 'Gemini';

  const handleScroll = (event) => {
    const nextScrolled = event.currentTarget.scrollTop > 8;
    if (nextScrolled !== isScrolled) {
      setIsScrolled(nextScrolled);
    }
  };

  const scrollBehavior = settings.reduceMotion ? 'auto' : 'smooth';

  // Karşılama ekranı açıkken tarayıcı/Electron penceresinin dosya sürüklemeyle file:// açmasını önle
  useEffect(() => {
    const handleWindowDragOver = (event) => {
      event.preventDefault();
      if (event.dataTransfer && !event.target?.closest?.('[data-import-dropzone]')) {
        event.dataTransfer.dropEffect = 'none';
      }
    };
    const handleWindowDrop = (event) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      abortControllerRef.current?.abort();
    };
  }, []);

  // URL hash değişimlerini (#/, #/projeler, #/sablonlar, #/ice-aktar) bağımsız görünüm durumuyla senkronize et
  useEffect(() => {
    const handleHashChange = () => {
      const next = resolveNavFromHash(window.location.hash);
      setActiveNav(next);
      if (next === 'import') {
        setImportState((prev) => (prev.status === 'running' ? prev : INITIAL_IMPORT_STATE));
      }
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: scrollBehavior });
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [scrollBehavior]);

  const navigateToImportPage = () => {
    setActiveNav('import');
    if (typeof window !== 'undefined' && window.location.hash !== '#/ice-aktar') {
      window.location.hash = '#/ice-aktar';
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: scrollBehavior });
  };

  // Tüm içe aktarma girişlerini (dosya, klasör, sürükle-bırak) tek runImport hattından çalıştır
  const runWelcomeImport = async (source) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFileError(null);
    setInfoNotice(null);
    navigateToImportPage();
    setImportState({
      status: 'running',
      progress: { step: 'okunuyor', current: 0, total: 1 },
      report: null,
      error: null,
      project: null,
      livePolite: 'İçe aktarma başlatıldı.',
    });

    const result = await runImport(source, {
      signal: controller.signal,
      onProgress: (prog) => {
        if (controller.signal.aborted) return;
        setImportState((prev) => (prev.status === 'running' ? { ...prev, progress: prog } : prev));
      },
    });

    if (abortControllerRef.current !== controller) return;

    if (result.ok) {
      setImportState({
        status: 'success',
        progress: null,
        report: result.report,
        error: null,
        project: result.project,
        livePolite: `İçe aktarma tamamlandı: ${result.report.files.length} dosya, ${result.report.nodes} bileşen, ${result.report.pages} sayfa.`,
      });
    } else {
      setImportState({
        status: 'error',
        progress: null,
        report: result.report,
        error: result.error,
        project: null,
        livePolite: result.error?.message || 'İçe aktarma tamamlanamadı.',
      });
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    runWelcomeImport(files.length === 1 ? files[0] : files);
  };

  const handleFolderChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    runWelcomeImport({ kind: 'files', files, isFolder: true });
  };

  const triggerOpenProjectFile = async () => {
    if (window.electronAPI?.openProjectFileDialog) {
      try {
        const res = await window.electronAPI.openProjectFileDialog();
        if (!res || res.canceled) return;
        await runWelcomeImport({ kind: 'electron-file', ...res });
      } catch (err) {
        console.error('[CraftImport] Electron dosya iletişim hatası:', err);
        setImportState({
          status: 'error',
          progress: null,
          report: { files: [], nodes: 0, pages: 0, warnings: [], skipped: [] },
          error: { code: 'DOSYA_OKUNAMADI', message: 'Dosya okunamadı.' },
          project: null,
          livePolite: 'Dosya okunamadı.',
        });
        navigateToImportPage();
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const triggerOpenProjectFolder = async () => {
    if (window.electronAPI?.openProjectDialog) {
      try {
        const res = await window.electronAPI.openProjectDialog();
        if (!res || res.canceled) return;
        await runWelcomeImport({ kind: 'electron-folder', ...res });
      } catch (err) {
        console.error('[CraftImport] Electron klasör iletişim hatası:', err);
        setImportState({
          status: 'error',
          progress: null,
          report: { files: [], nodes: 0, pages: 0, warnings: [], skipped: [] },
          error: { code: 'DOSYA_OKUNAMADI', message: 'Dosya okunamadı.' },
          project: null,
          livePolite: 'Dosya okunamadı.',
        });
        navigateToImportPage();
      }
      return;
    }
    folderInputRef.current?.click();
  };

  const handleSelectNav = (section) => {
    setActiveNav(section);
    const nextHash = NAV_HASH_MAP[section] || '#/';
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: scrollBehavior });
  };

  const openSettingsDialog = (tab = 'ai', note = null) => {
    setSettingsInitialTab(tab);
    setSettingsContextNote(typeof note === 'string' ? note : null);
    setSettingsDialogOpen(true);
  };

  const handleSubmitAiPrompt = (trimmedPrompt, metaOptions = null) => {
    if (!isAiConnected) {
      openSettingsDialog(
        'ai',
        'AI ile site üretmek için önce Gemini API anahtarınızı kaydedin (veya API anahtarı olmadan "Seçili Katmanları Tuvale Diz" butonunu kullanın). Yazdığınız istem kutuda korunacaktır.',
      );
      return;
    }
    if (onStartAiPrompt) {
      onStartAiPrompt(trimmedPrompt, metaOptions);
      return;
    }
    onNewProject('blank');
  };

  const handleSelectTemplatePrompt = (templatePrompt) => {
    setPromptValue(templatePrompt);
    setActiveNav('home');
    if (typeof window !== 'undefined' && window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: scrollBehavior });
    setWizardRequestTick((prev) => prev + 1);
  };

  const handleQuickCreateFocus = () => {
    setActiveNav('home');
    if (typeof window !== 'undefined' && window.location.hash !== '#/') {
      window.location.hash = '#/';
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: scrollBehavior });
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const handleSelectDevice = (deviceId) => {
    updateSettings({ defaultDevice: deviceId });
  };

  const handleQuickModularStart = () => {
    if (onStartAssembledProject) {
      onStartAssembledProject({
        name: 'Studio Pro — SaaS & AI Platformu',
        tabName: 'Anasayfa.craft',
        templateSlug: 'saas',
        presetKeys: [
          'nav-saas-split',
          'block-split-hero',
          'block-features-grid',
          'footer-modern-directory',
        ],
        backgroundColor: '#060a14',
        device: settings.defaultDevice || 'desktop',
      });
      return;
    }
    onNewProject('universal');
  };

  const handleAureliaTemplateStart = () => {
    if (onStartAssembledProject) {
      onStartAssembledProject({
        name: 'Aurelia Atelier — Lüks Mücevher Vitrini',
        tabName: 'Anasayfa.craft',
        templateSlug: 'eticaret',
        backgroundColor: '#0b0a08',
        device: settings.defaultDevice || 'desktop',
      });
      return;
    }
    onNewProject('universal');
  };

  const hasAutosaveDraft = Boolean(
    autosaveDraft &&
      typeof autosaveDraft === 'object' &&
      (Array.isArray(autosaveDraft.tabs) || Array.isArray(autosaveDraft.elements))
  );

  return (
    <div
      data-welcome-root
      data-reduce-motion={settings.reduceMotion ? 'true' : undefined}
      lang="tr"
    >
      {/* HTML, JSX/TSX ve .craft.json dosyalarını içe aktarmak için gizli dosya ve klasör seçiciler */}
      <input
        ref={fileInputRef}
        data-import-file-input
        type="file"
        multiple
        onChange={handleFileChange}
        accept=".craft.json,.html,.htm,.jsx,.tsx"
        hidden
      />
      <input
        ref={folderInputRef}
        data-import-folder-input
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        onChange={handleFolderChange}
        hidden
      />

      <div className="welcome-shell">
        <WelcomeSidebar
          activeNav={activeNav}
          onSelectNav={handleSelectNav}
          onOpenImport={() => handleSelectNav('import')}
          onOpenSettings={() => openSettingsDialog('ai', null)}
          onQuickCreate={handleQuickCreateFocus}
          isAiConnected={isAiConnected}
          selectedModelLabel={selectedModelLabel}
          recentCount={effectiveRecentProjects.length}
          hasAutosave={hasAutosaveDraft}
        />

        <div className="welcome-workspace">
          {settings.showAmbientBg && (
            heroBgUrl ? (
              <div
                className="welcome-hero-bg-image"
                style={{ backgroundImage: `url(${heroBgUrl})` }}
                aria-hidden="true"
              />
            ) : (
              <div className="welcome-ambient-wash" aria-hidden="true" />
            )
          )}

          <div
            ref={scrollAreaRef}
            className="welcome-scroll"
            onScroll={handleScroll}
          >
            <WelcomeTopBar
              scrolled={isScrolled}
              activeNav={activeNav}
              onOpenSiteOrFile={triggerOpenProjectFile}
              onOpenFolder={triggerOpenProjectFolder}
              onNewBlankProject={() => onNewProject('blank')}
            />

            <main className="welcome-container">
              {fileError && (
                <div role="alert" className="welcome-alert welcome-alert--error">
                  <span className="welcome-alert__body">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>{fileError}</span>
                  </span>
                  <button
                    type="button"
                    className="welcome-alert__close"
                    aria-label="Hata bildirimini kapat"
                    onClick={() => setFileError(null)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              {infoNotice && (
                <div role="status" className="welcome-alert welcome-alert--info">
                  <span className="welcome-alert__body">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>{infoNotice}</span>
                  </span>
                  <button
                    type="button"
                    className="welcome-alert__close"
                    aria-label="Bilgi bildirimini kapat"
                    onClick={() => setInfoNotice(null)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              {activeNav === 'import' ? (
                <WelcomeImportPage
                  importState={importState}
                  onPickFiles={triggerOpenProjectFile}
                  onPickFolder={triggerOpenProjectFolder}
                  onRunDroppedSource={runWelcomeImport}
                  onCancelImport={() => abortControllerRef.current?.abort()}
                  onResetReport={() => setImportState(INITIAL_IMPORT_STATE)}
                  onOpenImportedInEditor={() => {
                    if (importState.project) {
                      onOpenProject(importState.project);
                    }
                  }}
                />
              ) : activeNav === 'projects' ? (
                <WelcomeRecentProjects
                  recentProjects={effectiveRecentProjects}
                  autosaveDraft={hasAutosaveDraft ? autosaveDraft : null}
                  onRestoreAutosave={onRestoreAutosave}
                  onSaveAutosave={onSaveAutosave}
                  onDismissAutosave={onDismissAutosave}
                  fullPageMode={true}
                  onOpenRecentProject={onOpenRecentProject}
                  onSaveRecentProject={onSaveRecentProject}
                  onDeleteRecentProject={onDeleteRecentProject}
                  onStartBlankProject={() => onNewProject('blank')}
                  onExploreTemplates={() => handleSelectNav('templates')}
                />
              ) : activeNav === 'templates' ? (
                <WelcomeTemplatesSection
                  fullPageMode={true}
                  onSelectTemplate={handleSelectTemplatePrompt}
                  onStartAssembledProject={onStartAssembledProject}
                />
              ) : (
                <>
                  <WelcomeAiComposer
                    inputRef={composerInputRef}
                    promptValue={promptValue}
                    onPromptChange={setPromptValue}
                    onSubmitPrompt={handleSubmitAiPrompt}
                    onStartAssembledProject={onStartAssembledProject}
                    onOpenAiSettings={() => openSettingsDialog('ai', null)}
                    isSubmitting={Boolean(aiChat?.isLoading)}
                    isAiConnected={isAiConnected}
                    selectedModelLabel={selectedModelLabel}
                    selectedDevice={settings.defaultDevice}
                    onSelectDevice={handleSelectDevice}
                    reduceMotion={Boolean(settings.reduceMotion)}
                    wizardRequestTick={wizardRequestTick}
                  />

                  <WelcomeCreateSection
                    selectedDevice={settings.defaultDevice}
                    onSelectDevice={handleSelectDevice}
                    onStartBlank={() => onNewProject('blank')}
                    onStartTablet={() => onNewProject('blank-tablet')}
                    onStartMobile={() => onNewProject('blank-mobile')}
                    onStartQuickModular={handleQuickModularStart}
                    onStartTemplate={handleAureliaTemplateStart}
                    onOpenCodeOrProject={triggerOpenProjectFile}
                  />

                  <WelcomeRecentProjects
                    recentProjects={effectiveRecentProjects}
                    autosaveDraft={hasAutosaveDraft ? autosaveDraft : null}
                    onRestoreAutosave={onRestoreAutosave}
                    onSaveAutosave={onSaveAutosave}
                    onDismissAutosave={onDismissAutosave}
                    fullPageMode={false}
                    onOpenRecentProject={onOpenRecentProject}
                    onSaveRecentProject={onSaveRecentProject}
                    onDeleteRecentProject={onDeleteRecentProject}
                    onStartBlankProject={() => onNewProject('blank')}
                    onExploreTemplates={() => handleSelectNav('templates')}
                    onViewAllProjects={() => handleSelectNav('projects')}
                  />

                  <WelcomeTemplatesSection
                    fullPageMode={false}
                    onSelectTemplate={handleSelectTemplatePrompt}
                    onStartAssembledProject={onStartAssembledProject}
                    onViewAllTemplates={() => handleSelectNav('templates')}
                  />
                </>
              )}
            </main>
          </div>

          <WelcomeFooterBar />
        </div>
      </div>

      <SettingsDialog
        isOpen={settingsDialogOpen}
        initialTab={settingsInitialTab}
        contextNote={settingsContextNote}
        settings={settings}
        aiChat={aiChat}
        onDismissAutosave={onDismissAutosave}
        onClearRecentListUi={() => setRecentListCleared(true)}
        onClearApiKeyUi={() => aiChat?.handleSaveApiKey?.('')}
        onStatusToast={(msg) => setInfoNotice(msg)}
        onClose={() => {
          setSettingsDialogOpen(false);
          setSettingsContextNote(null);
        }}
      />
    </div>
  );
}
