import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  ZoomIn,
  ArrowLeft,
  Layers,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Code2,
  Plus,
  Home,
  Package,
  Link2,
  Check,
  Pencil,
  MoreVertical,
} from 'lucide-react';
import sampleTree from './sampleTree.js';
import { findNode } from './treeOps.js';
import { validateButtonHref, parsePageHref } from './schema.js';
import { getPageFileName } from './project.js';
import { listContentPacks } from './packAdapter.js';
import { useTreeStore } from './useTreeStore.js';
import { IframeCanvas, VIEWPORT_WIDTHS } from './IframeCanvas';
import { SelectionOverlay } from './SelectionOverlay';
import { ProtoAiDock } from './ProtoAiDock';
import { exportStatic } from './exportStatic.js';
import { exportReact } from './exportReact.js';
import { zipStore } from './zipStore.js';

function downloadBlob(bytes, filename, mimeType = 'application/zip') {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Faz 4b prototipi ana kabuğu.
 * - Çoklu sayfa proje durumunu `useTreeStore` (100 adımlı undo/redo) ile yönetir.
 * - Sayfa sekmeleri, buton sayfa/URL bağlantı editörü, içerik paketi ekleme,
 *   viewport/zoom, tek kaynak yayın önizleme ve çoklu sayfa ZIP export içerir.
 */

export const ProtoStoreContext = createContext(null);

export function useProtoStore() {
  const ctx = useContext(ProtoStoreContext);
  if (!ctx) {
    throw new Error('useProtoStore yalnızca ProtoApp içinde kullanılabilir.');
  }
  return ctx;
}

const VIEWPORT_OPTIONS = [
  { id: 'sm', label: '375px', title: 'Mobil (sm)', Icon: Smartphone },
  { id: 'md', label: '768px', title: 'Tablet (md)', Icon: Tablet },
  { id: 'lg', label: '1280px', title: 'Masaüstü (lg)', Icon: Monitor },
];

export function ProtoApp() {
  const store = useTreeStore(sampleTree);
  const { state, activePage, actions, canUndo, canRedo, handleShortcutKeyDown } = store;

  const iframeRef = useRef(null);
  const [readyTick, setReadyTick] = useState(0);
  const [overlayTick, setOverlayTick] = useState(0);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  const [previewPageId, setPreviewPageId] = useState(() => state.project.activePageId);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [exportWarnings, setExportWarnings] = useState([]);
  const [exportStatus, setExportStatus] = useState(null);

  // Sayfa sekmesi yönetim arayüzü durumları (window.prompt kullanılmaz)
  const [showAddPageForm, setShowAddPageForm] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('Yeni Sayfa');
  const [pageMenuId, setPageMenuId] = useState(null);
  const [renamingPageId, setRenamingPageId] = useState(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [pageActionError, setPageActionError] = useState(null);

  // İçerik paketi ekleyici durumu
  const [showPackPicker, setShowPackPicker] = useState(false);
  const [packCategoryFilter, setPackCategoryFilter] = useState('Tümü');
  const contentPacks = useMemo(() => listContentPacks(), []);
  const packCategories = useMemo(
    () => ['Tümü', ...Array.from(new Set(contentPacks.map((p) => p.category)))],
    [contentPacks]
  );

  // Seçili buton link editörü durumları
  const selectedNode = useMemo(
    () => findNode(state.tree, state.selectedId),
    [state.tree, state.selectedId]
  );
  const [linkMode, setLinkMode] = useState('url');
  const [linkPageTarget, setLinkPageTarget] = useState('');
  const [linkUrlInput, setLinkUrlInput] = useState('#');
  const [linkError, setLinkError] = useState(null);

  useEffect(() => {
    setLinkError(null);
    if (selectedNode?.type !== 'button') return;
    const rawHref = selectedNode.props?.href || '#';
    const linkedPage = parsePageHref(rawHref);
    if (linkedPage) {
      setLinkMode('page');
      setLinkPageTarget(linkedPage);
      setLinkUrlInput('#');
    } else {
      setLinkMode('url');
      setLinkPageTarget(state.project.pages[0]?.id || '');
      setLinkUrlInput(rawHref);
    }
  }, [selectedNode, state.project.pages]);

  // Önizlenen sayfa silinirse veya mevcut değilse aktif sayfaya düş
  const effectivePreviewPage = useMemo(() => {
    return (
      state.project.pages.find((p) => p.id === previewPageId) ||
      activePage ||
      state.project.pages[0]
    );
  }, [state.project.pages, previewPageId, activePage]);

  const publishPreview = useMemo(() => {
    if (!showPublishPreview || !effectivePreviewPage) return null;
    return exportStatic(state.project, {
      inlineCss: true,
      targetPageId: effectivePreviewPage.id,
    });
  }, [showPublishPreview, state.project, effectivePreviewPage]);

  const handleTogglePreview = useCallback(() => {
    setShowAdvancedMenu(false);
    setShowPackPicker(false);
    setPageMenuId(null);
    const next = !showPublishPreview;
    setShowPublishPreview(next);
    if (next) {
      const targetId = activePage?.id || state.project.pages[0]?.id;
      setPreviewPageId(targetId);
      const res = exportStatic(state.project, {
        inlineCss: true,
        targetPageId: targetId,
      });
      setExportWarnings(res.warnings);
    }
  }, [showPublishPreview, state.project, activePage]);

  const handleDownloadStaticZip = useCallback(() => {
    setShowAdvancedMenu(false);
    const result = exportStatic(state.project, { inlineCss: false });
    const zipBytes = zipStore(result.files);
    downloadBlob(zipBytes, 'craftstudio-site.zip');
    setExportWarnings(result.warnings);
    setExportStatus(
      `Statik site indirildi (${state.project.pages.length} sayfa): craftstudio-site.zip`
    );
  }, [state.project]);

  const handleDownloadReactZip = useCallback(() => {
    setShowAdvancedMenu(false);
    const result = exportReact(state.project);
    const zipBytes = zipStore(result.files);
    downloadBlob(zipBytes, 'craftstudio-react-vite.zip');
    setExportWarnings(result.warnings);
    setExportStatus(
      `React/Vite projesi indirildi (${state.project.pages.length} sayfa): craftstudio-react-vite.zip`
    );
  }, [state.project]);

  const handleCreatePage = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (state.aiBusy) return;
      setPageActionError(null);
      const res = actions.addPage({ title: newPageTitle });
      if (!res.ok) {
        setPageActionError(res.error || 'Sayfa eklenemedi.');
        return;
      }
      if (res.page?.id) {
        actions.switchPage(res.page.id);
      }
      setShowAddPageForm(false);
      setNewPageTitle('Yeni Sayfa');
    },
    [actions, newPageTitle, state.aiBusy]
  );

  const handleCommitRenamePage = useCallback(
    (pageId) => {
      if (state.aiBusy) return;
      setPageActionError(null);
      const res = actions.renamePage(pageId, renameTitleInput);
      if (!res.ok) {
        setPageActionError(res.error || 'Sayfa adı değiştirilemedi.');
        return;
      }
      setRenamingPageId(null);
      setPageMenuId(null);
    },
    [actions, renameTitleInput, state.aiBusy]
  );

  const handleRemovePage = useCallback(
    (pageId) => {
      if (state.aiBusy) return;
      setPageActionError(null);
      const res = actions.removePage(pageId);
      setPageMenuId(null);
      if (!res.ok) {
        setPageActionError(res.error || 'Sayfa silinemedi.');
        return;
      }
      if (Array.isArray(res.warnings) && res.warnings.length > 0) {
        setExportWarnings(res.warnings);
        setExportStatus('Sayfa silindi; silinen sayfaya bağlı buton bağlantıları güncellendi.');
      }
    },
    [actions, state.aiBusy]
  );

  const handleInsertContentPack = useCallback(
    (pack) => {
      if (state.aiBusy) return;
      const res = actions.insertContentPack(pack.id, {
        afterNodeId: state.selectedId,
      });
      setShowPackPicker(false);
      if (!res.ok) {
        setExportWarnings(res.warnings || []);
        setExportStatus(`İçerik paketi eklenemedi: ${pack.name}`);
        return;
      }
      setExportWarnings(res.warnings || []);
      setExportStatus(
        `İçerik paketi eklendi: "${pack.name}"${
          res.warnings?.length ? ` (${res.warnings.length} uyarlamayla)` : ''
        }`
      );
    },
    [actions, state.aiBusy, state.selectedId]
  );

  const handleApplyButtonLink = useCallback(
    (modeOverride, pageIdOverride, urlOverride) => {
      if (!selectedNode || selectedNode.type !== 'button' || state.aiBusy) return;
      setLinkError(null);
      const mode = modeOverride ?? linkMode;
      const validPageIds = new Set(state.project.pages.map((p) => p.id));

      if (mode === 'page') {
        const targetPageId = pageIdOverride ?? linkPageTarget;
        if (!targetPageId || !validPageIds.has(targetPageId)) {
          setLinkError('Geçerli bir hedef sayfa seçin.');
          return;
        }
        actions.updateNode(selectedNode.id, {
          props: { href: `page:${targetPageId}` },
        });
        return;
      }

      const rawUrl = String(urlOverride ?? linkUrlInput).trim();
      const check = validateButtonHref(rawUrl, { validPageIds });
      if (!check.ok) {
        setLinkError(check.error || 'Geçersiz bağlantı adresi.');
        return;
      }
      actions.updateNode(selectedNode.id, {
        props: { href: check.value },
      });
    },
    [selectedNode, state.aiBusy, state.project.pages, linkMode, linkPageTarget, linkUrlInput, actions]
  );

  const bumpOverlaySync = useCallback(() => {
    setOverlayTick((prev) => prev + 1);
  }, []);

  const handleExitProto = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('proto');
    window.location.href = url.toString();
  };

  const activeWidth = VIEWPORT_WIDTHS[state.viewport] || 1280;
  const canDeleteSelected = Boolean(
    !state.aiBusy && selectedNode && selectedNode.id !== state.tree.id && !state.editingId
  );

  const commitActiveInlineEdit = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const editableEl = doc.querySelector('[contenteditable]');
    if (editableEl && typeof editableEl.blur === 'function') {
      editableEl.blur();
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }, []);

  return (
    <ProtoStoreContext.Provider value={store}>
      <div className="h-screen w-screen flex flex-col bg-[#111113] text-neutral-200 overflow-hidden select-none">
        {/* Üst Araç Çubuğu */}
        <header className="min-h-14 shrink-0 px-4 py-1.5 bg-[#18181b] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 relative z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleExitProto}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 transition-colors cursor-pointer"
              title="Mevcut CraftStudio editörüne dön"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Editöre Dön</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-100 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
              <span>İzole İframe Tuval (Faz 4b)</span>
            </div>

            <div className="h-5 w-px bg-white/10 mx-1" />

            {/* Undo / Redo / Delete Kontrolleri */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                data-proto-undo="true"
                disabled={!canUndo}
                onClick={actions.undo}
                title="Geri Al (Ctrl/Cmd+Z)"
                className="p-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none text-neutral-200 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-proto-redo="true"
                disabled={!canRedo}
                onClick={actions.redo}
                title="Yinele (Ctrl/Cmd+Shift+Z)"
                className="p-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none text-neutral-200 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-proto-delete="true"
                disabled={!canDeleteSelected}
                onClick={() => actions.removeNode(state.selectedId)}
                title="Seçili Düğümü Sil (Delete)"
                className="p-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-400/40 disabled:opacity-35 disabled:pointer-events-none text-neutral-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Orta Kontroller: Viewport (375 / 768 / 1280) + Zoom (%50–%100) */}
          <div className="flex items-center gap-3">
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-[#101013] border border-white/10"
              role="group"
              aria-label="Viewport seçici"
            >
              {VIEWPORT_OPTIONS.map(({ id, label, title, Icon }) => {
                const active = state.viewport === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={title}
                    onClick={() => actions.setViewport(id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <ZoomIn className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={state.zoom}
                onChange={(e) => actions.setZoom(e.target.value)}
                className="studio-slider w-24"
                aria-label="Tuval yakınlaştırma"
              />
              <span className="w-9 text-right font-mono text-[11px] text-neutral-200">
                {Math.round(state.zoom * 100)}%
              </span>
            </label>
          </div>

          {/* Sağ Bilgi Etiketleri: Seçili Düğüm, Commit Sayacı, İframe Yükleme Sayacı */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              data-proto-selected-pill="true"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#101013] border border-white/10 text-xs"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-neutral-400">Seçili:</span>
              <span className="font-mono text-sky-300 truncate max-w-[140px]">
                {selectedNode ? `#${selectedNode.id}` : 'yok'}
              </span>
              {selectedNode && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                  {selectedNode.type}
                  {selectedNode.placement === 'layer' && selectedNode.pos
                    ? ` · ${selectedNode.pos.x}%,${selectedNode.pos.y}%`
                    : ''}
                </span>
              )}
            </div>

            <div
              data-proto-commit-counter="true"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] font-mono text-sky-300"
              title="Ağaca işlenen toplam commit (geçmiş adımı) sayısı"
            >
              <span>Commit: {state.commitCount}</span>
            </div>

            <div
              data-proto-load-counter="true"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-300"
              title="Tüm işlemler boyunca iframe yükleme sayacı 1 kalmalıdır"
            >
              <span>Yükleme: {state.iframeLoadCount}</span>
            </div>

            <div className="h-5 w-px bg-white/10 mx-0.5" />

            {/* Yayınlama ve Önizleme Araçları */}
            <button
              type="button"
              data-proto-publish-preview-btn="true"
              onClick={handleTogglePreview}
              aria-pressed={showPublishPreview}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
                showPublishPreview
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-[#101013] border-white/10 text-neutral-200 hover:bg-white/10'
              }`}
              title="Editörün yanında salt okunur sandbox yayın önizlemesini aç/kapat"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Yayın önizleme</span>
            </button>

            <button
              type="button"
              data-proto-download-zip-btn="true"
              onClick={handleDownloadStaticZip}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 transition"
              title="index.html + styles.css statik sitesini ZIP olarak indir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Zip indir</span>
            </button>

            <div className="relative">
              <button
                type="button"
                data-proto-advanced-btn="true"
                onClick={() => setShowAdvancedMenu((prev) => !prev)}
                aria-expanded={showAdvancedMenu}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-[#101013] hover:bg-white/10 border border-white/10 text-neutral-300 transition"
                title="Gelişmiş dışa aktarma seçenekleri"
              >
                <span>Gelişmiş</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showAdvancedMenu && (
                <div
                  data-proto-advanced-menu="true"
                  className="absolute right-0 mt-1.5 w-48 rounded-lg bg-[#18181b] border border-white/15 shadow-2xl p-1 z-50"
                >
                  <button
                    type="button"
                    data-proto-download-react-btn="true"
                    onClick={handleDownloadReactZip}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs text-neutral-200 hover:bg-white/10 transition"
                  >
                    <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>React/Vite (.zip)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Sayfa Sekmeleri, İçerik Paketi Seçici ve Buton Bağlantı Çubuğu */}
        <div
          data-proto-page-bar="true"
          className="min-h-10 shrink-0 px-4 py-1 bg-[#141418] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 relative z-20"
        >
          {/* Sol: Sayfa Sekmeleri */}
          <div className="flex flex-wrap items-center gap-1.5">
            {state.project.pages.map((page, idx) => {
              const isActive = page.id === activePage?.id;
              const isRenaming = renamingPageId === page.id;
              const isMenuOpen = pageMenuId === page.id;

              return (
                <div key={page.id} className="relative flex items-center">
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCommitRenamePage(page.id);
                      }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#101013] border border-sky-500/60"
                    >
                      <input
                        type="text"
                        data-proto-rename-page-input={page.id}
                        value={renameTitleInput}
                        autoFocus
                        onChange={(e) => setRenameTitleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setRenamingPageId(null);
                          }
                        }}
                        className="w-28 bg-transparent text-xs text-neutral-100 focus:outline-none"
                      />
                      <button
                        type="submit"
                        data-proto-rename-page-save={page.id}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Kaydet"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingPageId(null)}
                        className="p-0.5 text-neutral-400 hover:text-white cursor-pointer"
                        title="İptal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div
                      className={`inline-flex items-center rounded-md border text-xs transition ${
                        isActive
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-100'
                          : 'bg-[#101013] border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        data-proto-page-tab={page.id}
                        aria-current={isActive ? 'page' : undefined}
                        disabled={state.aiBusy}
                        onClick={() => {
                          setPageMenuId(null);
                          actions.switchPage(page.id);
                        }}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 disabled:opacity-50 cursor-pointer"
                        title={`${page.title} (${getPageFileName(page)})`}
                      >
                        {page.isHome && (
                          <Home className="w-3 h-3 text-amber-400 shrink-0" title="Ana Sayfa" />
                        )}
                        <span className="max-w-[140px] truncate">{page.title}</span>
                      </button>
                      <button
                        type="button"
                        data-proto-page-menu-btn={page.id}
                        disabled={state.aiBusy}
                        onClick={() => setPageMenuId(isMenuOpen ? null : page.id)}
                        className="pr-1.5 pl-0.5 py-1 text-neutral-400 hover:text-white disabled:opacity-40 cursor-pointer"
                        title="Sayfa işlemleri"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {isMenuOpen && !isRenaming && (
                    <div
                      data-proto-page-menu={page.id}
                      className="absolute left-0 top-full mt-1 w-44 rounded-lg bg-[#18181b] border border-white/15 shadow-2xl p-1 z-50 text-xs"
                    >
                      <button
                        type="button"
                        data-proto-page-rename={page.id}
                        disabled={state.aiBusy}
                        onClick={() => {
                          setRenamingPageId(page.id);
                          setRenameTitleInput(page.title);
                          setPageMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-neutral-200 hover:bg-white/10 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-sky-400" />
                        <span>Yeniden adlandır</span>
                      </button>

                      {!page.isHome && (
                        <button
                          type="button"
                          data-proto-page-sethome={page.id}
                          disabled={state.aiBusy}
                          onClick={() => {
                            actions.setHomePage(page.id);
                            setPageMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-neutral-200 hover:bg-white/10 cursor-pointer"
                        >
                          <Home className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ana sayfa yap</span>
                        </button>
                      )}

                      <button
                        type="button"
                        data-proto-page-move-left={page.id}
                        disabled={state.aiBusy || idx === 0}
                        onClick={() => {
                          actions.movePage(page.id, idx - 1);
                          setPageMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-neutral-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sola taşı</span>
                      </button>

                      <button
                        type="button"
                        data-proto-page-move-right={page.id}
                        disabled={state.aiBusy || idx === state.project.pages.length - 1}
                        onClick={() => {
                          actions.movePage(page.id, idx + 1);
                          setPageMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-neutral-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>Sağa taşı</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        type="button"
                        data-proto-page-remove={page.id}
                        disabled={state.aiBusy || state.project.pages.length <= 1}
                        onClick={() => handleRemovePage(page.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Sayfayı sil</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Yeni Sayfa Ekle (+ butonu & satır içi form) */}
            {showAddPageForm ? (
              <form
                onSubmit={handleCreatePage}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#101013] border border-sky-500/50"
              >
                <input
                  type="text"
                  data-proto-add-page-input="true"
                  value={newPageTitle}
                  autoFocus
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAddPageForm(false);
                    }
                  }}
                  placeholder="Sayfa adı..."
                  className="w-28 bg-transparent text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                />
                <button
                  type="submit"
                  data-proto-add-page-confirm="true"
                  disabled={state.aiBusy}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium cursor-pointer"
                >
                  Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPageForm(false)}
                  className="p-0.5 text-neutral-400 hover:text-white cursor-pointer"
                  title="Vazgeç"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                data-proto-add-page-btn="true"
                disabled={state.aiBusy}
                onClick={() => {
                  setPageActionError(null);
                  setPageMenuId(null);
                  setShowAddPageForm(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-white/20 hover:border-sky-400/60 hover:bg-sky-500/10 text-xs text-neutral-300 disabled:opacity-40 cursor-pointer"
                title="Projeye yeni sayfa ekle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sayfa</span>
              </button>
            )}
          </div>

          {/* Sağ: Buton Link Editörü (seçiliyse) & İçerik Paketi Ekle */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedNode?.type === 'button' && (
              <div
                data-proto-link-editor="true"
                className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#101013] border border-sky-500/35 text-xs"
              >
                <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-neutral-400 text-[11px]">Bağlantı:</span>
                <select
                  data-proto-link-mode="true"
                  value={linkMode}
                  disabled={state.aiBusy}
                  onChange={(e) => {
                    const nextMode = e.target.value;
                    setLinkMode(nextMode);
                    setLinkError(null);
                    if (nextMode === 'page') {
                      const fallbackPageId = linkPageTarget || state.project.pages[0]?.id;
                      setLinkPageTarget(fallbackPageId);
                      if (fallbackPageId) handleApplyButtonLink('page', fallbackPageId);
                    }
                  }}
                  className="bg-[#18181b] border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-neutral-200 focus:outline-none"
                >
                  <option value="page">Sayfaya bağla</option>
                  <option value="url">Harici / # URL</option>
                </select>

                {linkMode === 'page' ? (
                  <select
                    data-proto-link-page-select="true"
                    value={linkPageTarget}
                    disabled={state.aiBusy}
                    onChange={(e) => {
                      const nextPid = e.target.value;
                      setLinkPageTarget(nextPid);
                      handleApplyButtonLink('page', nextPid);
                    }}
                    className="bg-[#18181b] border border-white/10 rounded px-2 py-0.5 text-[11px] text-sky-200 focus:outline-none"
                  >
                    {state.project.pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({getPageFileName(p)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      data-proto-link-url-input="true"
                      value={linkUrlInput}
                      disabled={state.aiBusy}
                      onChange={(e) => setLinkUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyButtonLink('url');
                        }
                      }}
                      placeholder="#bolum veya https://..."
                      className="w-40 bg-[#18181b] border border-white/10 rounded px-2 py-0.5 text-[11px] text-neutral-100 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      data-proto-link-apply-btn="true"
                      disabled={state.aiBusy}
                      onClick={() => handleApplyButtonLink('url')}
                      className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] cursor-pointer"
                    >
                      Uygula
                    </button>
                  </div>
                )}

                {linkError && (
                  <span data-proto-link-error="true" className="text-[11px] text-rose-400">
                    {linkError}
                  </span>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                data-proto-content-pack-btn="true"
                disabled={state.aiBusy}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setPageMenuId(null);
                  setShowPackPicker((prev) => !prev);
                }}
                aria-expanded={showPackPicker}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 disabled:opacity-40 cursor-pointer"
                title="Hazır içerik paketlerini akış şemasına dönüştürerek sayfaya ekle"
              >
                <Package className="w-3.5 h-3.5" />
                <span>İçerik paketi ekle</span>
              </button>

              {showPackPicker && (
                <div
                  data-proto-pack-picker="true"
                  className="absolute right-0 top-full mt-1.5 w-80 max-h-96 flex flex-col rounded-xl bg-[#18181d] border border-white/15 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-white/10 bg-[#111115] flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-100">
                      Hazır İçerik Paketleri ({contentPacks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPackPicker(false)}
                      className="p-0.5 text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-2.5 py-1.5 border-b border-white/10 flex flex-wrap gap-1">
                    {packCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPackCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                          packCategoryFilter === cat
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-y-auto p-2 space-y-1.5">
                    {contentPacks
                      .filter(
                        (p) => packCategoryFilter === 'Tümü' || p.category === packCategoryFilter
                      )
                      .map((pack) => (
                        <button
                          key={pack.id}
                          type="button"
                          data-proto-pack-item={pack.id}
                          onClick={() => handleInsertContentPack(pack)}
                          className="w-full text-left p-2 rounded-lg bg-[#101013] hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-400/40 transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-neutral-100 truncate">
                              {pack.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 shrink-0">
                              {pack.category} · {pack.itemCount} öğe
                            </span>
                          </div>
                          {pack.description && (
                            <p className="mt-0.5 text-[10px] text-neutral-400 line-clamp-2">
                              {pack.description}
                            </p>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orta Tuval Alanı */}
        <main
          className="flex-1 overflow-auto p-6"
          style={{
            backgroundColor: '#121216',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <div className="mb-3 text-center text-[11px] font-mono text-neutral-400">
            Sayfa: {activePage?.title || 'Ana Sayfa'} ({state.project.pages.length} sayfa) · İframe:{' '}
            {activeWidth}px · Ölçek: {Math.round(state.zoom * 100)}%
            {state.editingId ? ` · Düzenleniyor: #${state.editingId}` : ''}
            {!state.editingId && state.hoveredId ? ` · Hover: #${state.hoveredId}` : ''}
            {showPublishPreview ? ' · Yan yana Yayın Önizleme açık' : ''}
          </div>

          {(exportStatus || exportWarnings.length > 0 || pageActionError || state.warnings?.length > 0) && (
            <div
              data-proto-export-feedback="true"
              className="mx-auto mb-3 max-w-3xl rounded-lg border border-white/10 bg-[#18181b]/90 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {(pageActionError || exportWarnings.length > 0 || state.warnings?.length > 0) && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="text-neutral-200 truncate">
                    {pageActionError ||
                      exportStatus ||
                      `${exportWarnings.length || state.warnings?.length} uyarı bulundu.`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportStatus(null);
                    setExportWarnings([]);
                    setPageActionError(null);
                    actions.clearWarnings();
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white shrink-0"
                  title="Bildirimi kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {(exportWarnings.length > 0 || state.warnings?.length > 0) && (
                <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-[11px] text-amber-300 max-h-28 overflow-y-auto">
                  {(exportWarnings.length > 0 ? exportWarnings : state.warnings).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Dikkat: IframeCanvas ağaçta aynı konumda tutulur ki sayfa/önizleme değişince iframeLoadCount 1 kalsın */}
          <div
            className={
              showPublishPreview ? 'flex flex-wrap items-start justify-center gap-6' : 'block'
            }
          >
            <div
              className={`relative rounded-lg shadow-2xl ring-1 ring-white/15 bg-white overflow-hidden ${
                showPublishPreview ? '' : 'mx-auto'
              }`}
              style={{ width: 'fit-content' }}
            >
              <IframeCanvas
                iframeRef={iframeRef}
                tree={state.tree}
                theme={state.project.theme}
                selectedId={state.selectedId}
                viewport={state.viewport}
                zoom={state.zoom}
                editingId={state.editingId}
                aiBusy={state.aiBusy}
                mode="edit"
                frameHeight={680}
                onSelectNode={actions.selectNode}
                onHoverNode={actions.hoverNode}
                onMoveNode={actions.moveNode}
                onUpdateNode={actions.updateNode}
                onSetEditingId={actions.setEditingId}
                onDropIndicatorChange={setDropIndicator}
                onIframeKeyDown={handleShortcutKeyDown}
                onOverlaySync={bumpOverlaySync}
                onLoadCountChange={actions.setLoadCount}
                onReadyChange={setReadyTick}
              />
              <SelectionOverlay
                iframeRef={iframeRef}
                selectedId={state.selectedId}
                hoveredId={state.hoveredId}
                editingId={state.editingId}
                dropIndicator={dropIndicator}
                viewport={state.viewport}
                zoom={state.zoom}
                tree={state.tree}
                readyTick={readyTick}
                overlayTick={overlayTick}
              />
            </div>

            {showPublishPreview && publishPreview && effectivePreviewPage && (
              <section
                data-proto-publish-preview-panel="true"
                className="rounded-lg shadow-2xl ring-1 ring-emerald-500/30 bg-[#18181b] overflow-hidden"
                style={{ width: 'fit-content', maxWidth: `${Math.round(activeWidth * state.zoom)}px` }}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#101013] border-b border-white/10 text-[11px] font-mono text-emerald-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <span>Yayın Önizleme · {activeWidth}px</span>
                    <select
                      data-proto-publish-page-select="true"
                      value={effectivePreviewPage.id}
                      onChange={(e) => setPreviewPageId(e.target.value)}
                      className="rounded bg-[#18181b] border border-emerald-500/30 px-1.5 py-0.5 text-[11px] text-emerald-200 focus:outline-none"
                      aria-label="Önizlenen sayfa"
                    >
                      {state.project.pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({getPageFileName(p)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPublishPreview(false)}
                    className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white shrink-0"
                    title="Yayın önizlemeyi kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div
                  data-proto-publish-sandbox-note="true"
                  className="px-3 py-1 bg-[#141418] border-b border-white/10 text-[10px] text-amber-300/90"
                >
                  Not: Önizleme sandbox=&quot;&quot; içindedir; iç sayfa bağlantılarına tıklamak yerine yukarıdaki sayfa seçiciyi kullanın (indirilen ZIP içinde tüm bağlantılar çalışır).
                </div>
                <div
                  className="bg-white overflow-hidden"
                  style={{
                    width: `${Math.round(activeWidth * state.zoom)}px`,
                    height: `${Math.round(680 * state.zoom)}px`,
                  }}
                >
                  <iframe
                    data-proto-publish-iframe="true"
                    title="CraftStudio Yayın Önizleme"
                    sandbox=""
                    srcDoc={
                      publishPreview.files[getPageFileName(effectivePreviewPage)] ||
                      publishPreview.files['index.html']
                    }
                    style={{
                      width: `${activeWidth}px`,
                      height: '680px',
                      border: 0,
                      display: 'block',
                      background: '#ffffff',
                      transform: `scale(${state.zoom})`,
                      transformOrigin: 'top left',
                    }}
                  />
                </div>
              </section>
            )}
          </div>
        </main>

        {/* Yüzen Gemini AI Tasarım Dock'u */}
        <ProtoAiDock onCommitBeforeAi={commitActiveInlineEdit} />

        {/* Alt Kısayol Çubuğu */}
        <footer className="h-7 shrink-0 px-4 bg-[#151518] border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
          <span>
            Sürükle: Flow sırala / Layer taşı · Çift Tıkla: Metni düzenle · Enter: Kaydet · Shift+Enter: Yeni satır
          </span>
          <span>Del/Backspace: Sil · Ctrl/Cmd+Z: Geri Al · Ctrl/Cmd+Shift+Z: Yinele · Esc: İptal</span>
        </footer>
      </div>
    </ProtoStoreContext.Provider>
  );
}

export default ProtoApp;
