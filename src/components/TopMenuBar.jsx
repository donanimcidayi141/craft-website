import React, { useState, useRef, useEffect } from 'react';
import {
  Minus, Plus, RotateCcw, RotateCw, Eye, EyeOff,
  Layers, Sliders, Box, X, ChevronDown, Check,
  Monitor, Smartphone, Tablet, Home, Sparkles,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  FolderCheck, HelpCircle, Group, Ungroup, Tag as TagIcon, Save,
  FolderOpen, FilePlus2, FileCode2, FileText, CopyPlus,
  Workflow, Database, Zap, Palette, LayoutGrid
} from 'lucide-react';
import { hasViewportOverrides } from '../utils/responsiveUtils';
import { STUDIO_MODE_LIST, getStudioModeConfig } from '../data/studioModesRegistry';
import { WORKSPACE_PRESET_LIST, DEFAULT_WORKSPACE_PRESET_ID } from '../data/panelRegistry';

const MENU_PANEL_ICON_MAP = {
  Sliders,
  Box,
  Layers,
  Sparkles,
  Tag: TagIcon,
  Workflow,
  Database,
  Zap,
};

export default function TopMenuBar({
  zoom,
  setZoom,
  resetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activePanels,
  togglePanel,
  tabs,
  activeTabId,
  setActiveTabId,
  onAddTab,
  onCloseTab,
  previewMode,
  setPreviewMode,
  onOpenExportModal,
  viewportMode,
  setViewportMode,
  rawElements = [],
  onGoHome,
  onNewBlankProject,
  onStartTutorial,
  onOpenProjectFolder,
  onOpenProjectFile = null,
  onSaveProject = null,
  projectName = 'Adsız Proje',
  projectFilePath = null,
  onRenameProject = null,
  onRenameTab = null,
  hasUnsavedChanges = false,
  selectedIds = [],
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  onGroupSelected,
  onUngroupSelected,
  activeMode = 'design',
  onSelectStudioMode = null,
  modeConfig = null,
  activePresetId = DEFAULT_WORKSPACE_PRESET_ID,
  onSelectWorkspacePreset = null,
  onResetWorkspaceLayout = null,
}) {
  const resolvedModeConfig = modeConfig || getStudioModeConfig(activeMode);
  const resolvedMenuPanels = resolvedModeConfig.menuPanels || [];
  const showViewportSwitcher = resolvedModeConfig.topBarConfig?.showViewportSwitcher !== false;
  const showPageTabsBar = resolvedModeConfig.topBarConfig?.showPageTabsBar !== false;
  const [openMenu, setOpenMenu] = useState(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape' && openMenu) {
        e.stopPropagation();
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc, true);
    };
  }, [openMenu]);

  const kbdClass =
    'text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-slate-400';

  return (
    <div className="flex flex-col bg-[#18181b] border-b border-[#2c2c32] select-none text-xs text-zinc-300 z-40">
      {/* 1. Primary Studio Command Bar */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[#24242a] gap-2 min-w-0" ref={menuRef}>
        {/* Left: Navigation, Brand, Project Identity & Menus */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Home / Projects Hub */}
          <button
            type="button"
            onClick={onGoHome}
            title="Projeler & Başlangıç Ekranına Dön"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#202026] hover:bg-[#282830] border border-[#2f2f37] text-zinc-200 hover:text-white font-medium transition-colors shrink-0"
          >
            <Home size={12} />
            <span className="text-[11px] font-medium">Projeler</span>
          </button>

          {/* Compact Studio Mark */}
          <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#121215] border border-[#27272d] text-zinc-200 font-semibold text-[11px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0d99ff]" />
            <span className="tracking-tight">CraftStudio</span>
          </div>

          <div className="w-px h-4 bg-[#2c2c32] mx-0.5 shrink-0" />

          {/* Menus */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Dosya */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'dosya' ? null : 'dosya')}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  openMenu === 'dosya'
                    ? 'bg-[#25252c] text-white'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span>Dosya</span>
                <ChevronDown size={11} className={`text-zinc-500 transition-transform ${openMenu === 'dosya' ? 'rotate-180 text-[#38bdf8]' : ''}`} />
              </button>
              {openMenu === 'dosya' && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#18181b] border border-[#2f2f38] shadow-2xl rounded-md p-1 z-50 space-y-0.5">
                  {onSaveProject && (
                    <>
                      <button
                        type="button"
                        onClick={() => { onSaveProject(false); setOpenMenu(null); }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-emerald-300 font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Save size={12} className="text-emerald-400" />
                          <span>Projeyi Kaydet (.craft.json)</span>
                        </span>
                        <kbd className={kbdClass}>Ctrl+S</kbd>
                      </button>
                      <button
                        type="button"
                        onClick={() => { onSaveProject(true); setOpenMenu(null); }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <CopyPlus size={12} className="text-zinc-400" />
                          <span>Farklı Kaydet...</span>
                        </span>
                        <kbd className={kbdClass}>Ctrl+Shift+S</kbd>
                      </button>
                      <div className="h-px bg-[#27272d] my-1 mx-1" />
                    </>
                  )}
                  {onOpenProjectFile && (
                    <button
                      type="button"
                      onClick={() => { onOpenProjectFile(); setOpenMenu(null); }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FileCode2 size={12} className="text-[#38bdf8]" />
                        <span>Site / Proje Aç (.html, .jsx, .craft)...</span>
                      </span>
                      <kbd className={kbdClass}>Ctrl+O</kbd>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { onOpenProjectFolder ? onOpenProjectFolder() : null; setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen size={12} className="text-zinc-400" />
                      <span>Klasör / React-HTML İçe Aktar...</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+Shift+O</kbd>
                  </button>
                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <button
                    type="button"
                    onClick={() => { onNewBlankProject ? onNewBlankProject() : onAddTab(); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FilePlus2 size={12} className="text-zinc-300" />
                      <span>Yeni Boş Proje</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+Shift+N</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => { onAddTab(); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={12} className="text-zinc-400" />
                      <span>Yeni Sayfa Sekmesi</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+N</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => { onGoHome(); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Home size={12} className="text-zinc-400" />
                      <span>Başlangıç Ekranı &amp; Şablonlar</span>
                    </span>
                  </button>
                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <button
                    type="button"
                    onClick={() => { onOpenExportModal(); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#0d99ff]/15 flex items-center justify-between text-[#7dd3fc] font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FolderCheck size={12} className="text-[#0d99ff]" />
                      <span>Canlıya Al &amp; Yayınla (React / HTML)</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+E</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Düzenle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'duzenle' ? null : 'duzenle')}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  openMenu === 'duzenle'
                    ? 'bg-[#25252c] text-white'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span>Düzenle</span>
                <ChevronDown size={11} className={`text-zinc-500 transition-transform ${openMenu === 'duzenle' ? 'rotate-180 text-[#38bdf8]' : ''}`} />
              </button>
              {openMenu === 'duzenle' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#18181b] border border-[#2f2f38] shadow-2xl rounded-md p-1 z-50 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { onUndo(); setOpenMenu(null); }}
                    disabled={!canUndo}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] disabled:opacity-35 flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw size={12} className="text-zinc-400" />
                      <span>Geri Al</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+Z</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => { onRedo(); setOpenMenu(null); }}
                    disabled={!canRedo}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] disabled:opacity-35 flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCw size={12} className="text-zinc-400" />
                      <span>İleri Al</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+Y</kbd>
                  </button>
                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <button
                    type="button"
                    onClick={() => { onGroupSelected(); setOpenMenu(null); }}
                    disabled={selectedIds.length <= 1}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] disabled:opacity-35 flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Group size={12} className="text-[#38bdf8]" />
                      <span>Grupla</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+G</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => { onUngroupSelected(); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Ungroup size={12} className="text-zinc-400" />
                      <span>Grubu Çöz</span>
                    </span>
                    <kbd className={kbdClass}>Ctrl+Shift+G</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Pencere */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'pencere' ? null : 'pencere')}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  openMenu === 'pencere'
                    ? 'bg-[#25252c] text-white'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span>Pencere</span>
                <ChevronDown size={11} className={`text-zinc-500 transition-transform ${openMenu === 'pencere' ? 'rotate-180 text-[#38bdf8]' : ''}`} />
              </button>
              {openMenu === 'pencere' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#18181b] border border-[#2f2f38] shadow-2xl rounded-md p-1 z-50 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Çalışma Alanı Panelleri
                  </div>
                  {resolvedMenuPanels.map((panel) => {
                    const PanelIcon = MENU_PANEL_ICON_MAP[panel.icon] || Sliders;
                    const isPanelActive = Boolean(activePanels?.[panel.id]);
                    return (
                      <React.Fragment key={panel.id}>
                        {panel.dividerBefore && <div className="h-px bg-[#27272d] my-1 mx-1" />}
                        <button
                          type="button"
                          data-window-menu-panel={panel.id}
                          onClick={() => { togglePanel(panel.id); setOpenMenu(null); }}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <PanelIcon size={12} className="text-zinc-300" />
                            <span>{panel.label}</span>
                          </span>
                          {panel.shortcutHint ? (
                            <span className="flex items-center gap-1.5">
                              <kbd className="text-[9.5px] font-mono text-zinc-500">{panel.shortcutHint}</kbd>
                              {isPanelActive && <Check size={12} className="text-[#0d99ff]" />}
                            </span>
                          ) : (
                            isPanelActive && <Check size={12} className="text-[#0d99ff]" />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}

                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Hazır Düzenler
                  </div>
                  {WORKSPACE_PRESET_LIST.map((preset) => {
                    const isPresetSelected = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-workspace-preset={preset.id}
                        onClick={() => {
                          onSelectWorkspacePreset?.(preset.id);
                          setOpenMenu(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <LayoutGrid size={12} className="text-zinc-400" />
                          <span>{preset.label}</span>
                        </span>
                        {isPresetSelected && <Check size={12} className="text-[#0d99ff]" />}
                      </button>
                    );
                  })}

                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <button
                    type="button"
                    data-reset-workspace-layout="true"
                    onClick={() => {
                      onResetWorkspaceLayout?.();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-amber-300 font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw size={12} className="text-amber-400" />
                      <span>Düzeni sıfırla</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-4 bg-[#2c2c32] mx-0.5 shrink-0" />

          {/* Project Title & Save Status */}
          <div className="flex items-center gap-1.5 bg-[#101013] border border-[#27272d] rounded px-2 py-0.5 min-w-0">
            {onRenameProject ? (
              <input
                type="text"
                value={projectName}
                onChange={(e) => onRenameProject(e.target.value)}
                title="Proje adını düzenle"
                className="bg-transparent text-zinc-100 font-medium text-[11px] w-36 sm:w-44 xl:w-48 focus:w-56 transition-all focus:outline-none truncate"
              />
            ) : (
              <span className="text-zinc-100 font-medium text-[11px] max-w-[140px] truncate">{projectName}</span>
            )}
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${
                hasUnsavedChanges
                  ? 'bg-[#1c1a14] text-amber-300 border-amber-500/30'
                  : 'bg-[#101c16] text-emerald-300 border-emerald-500/30'
              }`}
              title={
                hasUnsavedChanges
                  ? 'Kaydedilmemiş değişiklikler var (Ctrl+S)'
                  : projectFilePath
                    ? `Kaydedildi: ${projectFilePath}`
                    : 'Tüm değişiklikler kaydedildi'
              }
            >
              {hasUnsavedChanges ? '● Kaydedilmedi' : '✓ Kaydedildi'}
            </span>
            {onSaveProject && (
              <button
                type="button"
                onClick={() => onSaveProject(false)}
                title="Projeyi Kaydet (Ctrl+S)"
                className="p-1 rounded text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors shrink-0"
              >
                <Save size={12} />
              </button>
            )}
          </div>

          {/* Studio Mode Switcher: Tasarım | Backend */}
          {onSelectStudioMode && (
            <div
              role="tablist"
              aria-label="Atölye modu seçici"
              data-studio-mode-switcher
              className="flex items-center gap-0.5 bg-[#101013] p-0.5 rounded border border-[#27272d] shrink-0"
            >
              {STUDIO_MODE_LIST.map((modeItem) => {
                const isModeActive = activeMode === modeItem.id;
                const ModeIcon = modeItem.id === 'backend' ? Workflow : Palette;
                return (
                  <button
                    key={modeItem.id}
                    type="button"
                    role="tab"
                    aria-selected={isModeActive}
                    data-studio-mode={modeItem.id}
                    onClick={() => onSelectStudioMode(modeItem.id)}
                    title={modeItem.description}
                    className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                      isModeActive
                        ? modeItem.id === 'backend'
                          ? 'bg-[#14261f] text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#25252c] text-white border border-[#3a3a44]'
                        : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    <ModeIcon size={11} />
                    <span>{modeItem.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: Responsive Device Switcher */}
        {showViewportSwitcher ? (
          <div className="flex items-center gap-0.5 bg-[#101013] p-0.5 rounded border border-[#27272d] shrink-0">
          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            title="Masaüstü Tasarımı (1280px)"
            className={`px-2 py-1 rounded-sm flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              viewportMode === 'desktop'
                ? 'bg-[#25252c] text-white border border-[#3a3a44]'
                : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
            }`}
          >
            <Monitor size={11} />
            <span>PC</span>
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('tablet')}
            title="Tablet Tasarımı (768px) — Ayrı kaydedilir"
            className={`relative px-2 py-1 rounded-sm flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              viewportMode === 'tablet'
                ? 'bg-[#25252c] text-[#7dd3fc] border border-[#3a3a44]'
                : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
            }`}
          >
            <Tablet size={11} />
            <span>Tablet</span>
            {rawElements.some(el => hasViewportOverrides(el, 'tablet', true)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d99ff]" title="Tablet özelleştirmeleri mevcut" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            title="Mobil Tasarımı (375px) — Ayrı kaydedilir"
            className={`relative px-2 py-1 rounded-sm flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              viewportMode === 'mobile'
                ? 'bg-[#25252c] text-emerald-300 border border-[#3a3a44]'
                : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
            }`}
          >
            <Smartphone size={11} />
            <span>Mobil</span>
            {rawElements.some(el => hasViewportOverrides(el, 'mobile', true)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Mobil özelleştirmeleri mevcut" />
            )}
          </button>
        </div>
        ) : (
          <div />
        )}

        {/* Right: Quick History, Zoom, AI, Tutorial, Preview & Publish */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo / Redo */}
          <div className="flex items-center bg-[#101013] border border-[#27272d] rounded p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Geri Al (Ctrl+Z)"
              className="p-1 rounded-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="İleri Al (Ctrl+Y)"
              className="p-1 rounded-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <RotateCw size={12} />
            </button>
          </div>

          {/* Zoom Capsule */}
          <div className="flex items-center bg-[#101013] px-1 py-0.5 rounded border border-[#27272d]">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2)))}
              title="Uzaklaştır (Ctrl + Tekerlek Geri)"
              className="p-0.5 text-zinc-400 hover:text-white transition-colors"
            >
              <Minus size={11} />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title="Sığdır / %100 Yap (Ctrl+0)"
              className="px-1.5 text-[11px] font-mono tabular-nums text-zinc-300 hover:text-white font-medium min-w-[44px] text-center"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(3.5, +(z + 0.1).toFixed(2)))}
              title="Yakınlaştır (Ctrl + Tekerlek İleri)"
              className="p-0.5 text-zinc-400 hover:text-white transition-colors"
            >
              <Plus size={11} />
            </button>
          </div>

          {/* AI Assistant */}
          <button
            type="button"
            onClick={() => togglePanel('aiAgent')}
            title="AI Sohbet Kutusunu Aç/Kapat (Ctrl+K)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded font-medium text-[11px] transition-colors border ${
              activePanels.aiAgent
                ? 'bg-[#25252c] border-[#0d99ff]/50 text-white'
                : 'bg-[#202026] hover:bg-[#27272f] border-[#2c2c34] text-zinc-300 hover:text-white'
            }`}
          >
            <Sparkles size={11} className="text-[#38bdf8]" />
            <span className="hidden lg:inline">AI Sohbet</span>
          </button>

          {/* Tutorial Guide */}
          <button
            type="button"
            onClick={onStartTutorial}
            title="İnteraktif Rehber & Tutorial"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#202026] hover:bg-[#27272f] border border-[#2c2c34] text-zinc-300 hover:text-white font-medium transition-colors"
          >
            <HelpCircle size={12} className="text-zinc-400" />
            <span className="hidden xl:inline text-[11px]">Rehber</span>
          </button>

          {/* Live Browser Presentation (PowerPoint-style) */}
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            title={previewMode ? 'Düzenleme moduna dön (Esc)' : 'Tam Ekran Tarayıcı Sunumu (PowerPoint Modu)'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold text-[11px] transition-colors border whitespace-nowrap ${
              previewMode
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/55'
                : 'bg-[#202026] hover:bg-[#282830] border-[#32323c] text-zinc-100'
            }`}
          >
            {previewMode ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{previewMode ? 'Editöre Dön' : 'Sun'}</span>
          </button>

          {/* Publish / Canlıya Al */}
          <button
            type="button"
            onClick={onOpenExportModal}
            title="Canlıya Al & React / HTML Yayınla (Ctrl+E)"
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold text-[11px] transition-colors whitespace-nowrap"
          >
            <FolderCheck size={12} />
            <span>Yayınla</span>
          </button>
        </div>
      </div>

      {/* 2. Document Tabs Bar + Contextual Selection Strip */}
      {showPageTabsBar && (
      <div className="flex items-center justify-between h-8 bg-[#141417] px-3 gap-2">
        {/* Left: Page Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;
            const commitRename = () => {
              const trimmed = editingTabName.trim();
              if (trimmed && trimmed !== tab.name && onRenameTab) {
                onRenameTab(tab.id, trimmed);
              }
              setEditingTabId(null);
            };
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => {
                  if (!onRenameTab) return;
                  setEditingTabId(tab.id);
                  setEditingTabName(tab.name);
                }}
                title={onRenameTab ? `${tab.name} (Ad değiştirmek için çift tıklayın)` : tab.name}
                className={`group flex items-center h-6 px-2.5 rounded-sm text-[11px] cursor-pointer transition-colors border shrink-0 ${
                  isActive
                    ? 'bg-[#1e1e24] text-white border-[#34343d] font-medium'
                    : 'bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-[#0d99ff]' : 'bg-zinc-600'}`} />
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingTabName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingTabName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingTabId(null);
                      }
                    }}
                    className="bg-[#101013] border border-[#0d99ff] rounded px-1 py-0 text-[11px] text-white w-28 focus:outline-none"
                  />
                ) : (
                  <span className="truncate max-w-[140px]">{tab.name}</span>
                )}
                {tabs.length > 1 && !isEditing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="ml-2 p-0.5 rounded hover:bg-white/[0.1] text-zinc-500 hover:text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddTab}
            title="Yeni Sayfa Sekmesi Ekle"
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Right: Contextual Selection Alignment & Group Quick Actions */}
        {!previewMode && selectedIds.length > 0 && (
          <div className="flex items-center gap-1 shrink-0 bg-[#1a1a20] border border-[#2c2c34] rounded px-1.5 py-0.5">
            <span className="text-[10px] font-mono tabular-nums text-zinc-400 px-1.5">
              {selectedIds.length} seçili
            </span>
            <div className="w-px h-3 bg-[#2e2e36]" />
            {selectedIds.length > 1 && (
              <button
                type="button"
                onClick={onGroupSelected}
                title="Grupla (Ctrl+G)"
                className="px-2 py-0.5 rounded-sm hover:bg-white/[0.08] text-zinc-200 font-medium flex items-center gap-1 transition-colors text-[10px]"
              >
                <Group size={11} />
                <span>Grupla</span>
              </button>
            )}
            <button
              type="button"
              onClick={onAlignHorizontalCenter}
              title="Yatayda Ortala (Tuval veya Ebeveynde)"
              className="px-2 py-0.5 rounded-sm hover:bg-white/[0.08] text-zinc-200 hover:text-white font-medium flex items-center gap-1 transition-colors text-[10px]"
            >
              <AlignHorizontalJustifyCenter size={11} />
              <span>Yatay Ortala</span>
            </button>
            <button
              type="button"
              onClick={onAlignVerticalCenter}
              title="Dikeyde Ortala (Tuval veya Ebeveynde)"
              className="px-2 py-0.5 rounded-sm hover:bg-white/[0.08] text-zinc-200 hover:text-white font-medium flex items-center gap-1 transition-colors text-[10px]"
            >
              <AlignVerticalJustifyCenter size={11} />
              <span>Dikey Ortala</span>
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
