import React, { useState, useRef, useEffect } from 'react';
import {
  Minus, Plus, RotateCcw, RotateCw, Eye, EyeOff,
  Layers, Sliders, Box, X, ChevronDown, Check,
  Monitor, Smartphone, Tablet, Home, Sparkles,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  FolderCheck, HelpCircle, Group, Ungroup, Tag as TagIcon, Save,
  FolderOpen, FilePlus2, FileCode2, FileText, CopyPlus
} from 'lucide-react';
import { hasViewportOverrides } from '../utils/responsiveUtils';

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
  onRenameProject = null,
  hasUnsavedChanges = false,
  selectedIds = [],
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  onGroupSelected,
  onUngroupSelected
}) {
  const [openMenu, setOpenMenu] = useState(null);
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
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#121215] border border-[#27272d] text-zinc-200 font-semibold text-[11px] shrink-0">
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
                        <span>Proje Dosyası Aç (.craft.json)...</span>
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
                  <button
                    type="button"
                    onClick={() => { togglePanel('properties'); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders size={12} className="text-zinc-300" />
                      <span>Özellikler &amp; Hizalama</span>
                    </span>
                    {activePanels.properties && <Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { togglePanel('assets'); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Box size={12} className="text-zinc-300" />
                      <span>Assetler &amp; Şablonlar</span>
                    </span>
                    {activePanels.assets && <Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { togglePanel('layers'); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={12} className="text-zinc-300" />
                      <span>Katmanlar (Layers)</span>
                    </span>
                    {activePanels.layers && <Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { togglePanel('aiAgent'); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={12} className="text-zinc-300" />
                      <span>AI Ajanı (Gemini)</span>
                    </span>
                    {activePanels.aiAgent && <Check size={12} className="text-[#0d99ff]" />}
                  </button>
                  <div className="h-px bg-[#27272d] my-1 mx-1" />
                  <button
                    type="button"
                    onClick={() => { togglePanel('attributesAndCss'); setOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#23232a] flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <TagIcon size={12} className="text-zinc-300" />
                      <span>Yüzen CSS &amp; Nitelik Penceresi</span>
                    </span>
                    {activePanels.attributesAndCss && <Check size={12} className="text-[#0d99ff]" />}
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
                className="bg-transparent text-zinc-100 font-medium text-[11px] w-28 sm:w-36 focus:w-44 transition-all focus:outline-none truncate"
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
              title={hasUnsavedChanges ? 'Kaydedilmemiş değişiklikler var (Ctrl+S)' : 'Tüm değişiklikler kaydedildi'}
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
        </div>

        {/* Center: Responsive Device Switcher */}
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
            title="Gemini AI Tasarım Ajanı"
            className={`flex items-center gap-1.5 px-2 py-1 rounded font-medium text-[11px] transition-colors border ${
              activePanels.aiAgent
                ? 'bg-[#25252c] border-[#0d99ff]/50 text-white'
                : 'bg-[#202026] hover:bg-[#27272f] border-[#2c2c34] text-zinc-300 hover:text-white'
            }`}
          >
            <Sparkles size={11} className="text-[#38bdf8]" />
            <span className="hidden lg:inline">AI Ajan</span>
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

          {/* Live Preview */}
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-[11px] transition-colors border ${
              previewMode
                ? 'bg-[#0d99ff]/18 text-[#7dd3fc] border-[#0d99ff]/60'
                : 'bg-[#202026] hover:bg-[#282830] border-[#32323c] text-zinc-100'
            }`}
          >
            {previewMode ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{previewMode ? 'Editöre Dön' : 'Canlı Önizle'}</span>
          </button>

          {/* Publish / Canlıya Al */}
          <button
            type="button"
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold text-[11px] transition-colors"
          >
            <FolderCheck size={12} />
            <span>Canlıya Al · Yayınla</span>
          </button>
        </div>
      </div>

      {/* 2. Document Tabs Bar + Contextual Selection Strip */}
      <div className="flex items-center justify-between h-8 bg-[#141417] px-3 gap-2">
        {/* Left: Page Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center h-6 px-2.5 rounded-sm text-[11px] cursor-pointer transition-colors border shrink-0 ${
                  isActive
                    ? 'bg-[#1e1e24] text-white border-[#34343d] font-medium'
                    : 'bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-[#0d99ff]' : 'bg-zinc-600'}`} />
                <span className="truncate max-w-[140px]">{tab.name}</span>
                {tabs.length > 1 && (
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
    </div>
  );
}
