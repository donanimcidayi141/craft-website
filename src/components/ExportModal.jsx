import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  FolderCheck,
  FileCode2,
  Copy,
  CheckCircle2,
  Monitor,
  Tablet,
  Smartphone,
  Globe,
  ExternalLink,
  Download,
  AlertTriangle,
  Play,
  Square,
  Layers,
  RefreshCw,
  Eye,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { generateModularReactProject, slugifyProjectFolderName } from '../utils/generateReactCode';
import { flattenTree } from '../utils/treeUtils';

function formatByteSize(text = '') {
  const bytes = typeof text === 'number' ? text : new TextEncoder().encode(String(text)).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function joinPathDisplay(baseDir, slug) {
  if (!baseDir) return slug || 'yayinlanan-react-site';
  const sep = baseDir.includes('\\') ? '\\' : '/';
  const trimmed = baseDir.replace(/[\\/]+$/, '');
  return `${trimmed}${sep}${slug}`;
}

function triggerBrowserDownload(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportModal({
  isOpen,
  onClose,
  elements = [],
  canvasSettings = { width: 1280, height: 1350, bgColor: '#0b0f19' },
  canvasByViewport = null,
  tabName = 'Anasayfa.craft',
  activeTabId = 'tab-1',
  viewportMode = 'desktop',
  tabs = [],
  projectFunctions = [],
  pageLinks = [],
  projectName = 'CraftStudio Projesi',
  projectFilePath = '',
}) {
  const hasElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.exportToDesktop);

  const [rightTab, setRightTab] = useState('preview'); // 'preview' | 'structure' | 'code'
  const [buildMode, setBuildMode] = useState('html'); // 'html' | 'react'
  const [folderNameInput, setFolderNameInput] = useState('');
  const [targetBaseDir, setTargetBaseDir] = useState('');
  const [defaultsInfo, setDefaultsInfo] = useState({ desktopPath: '', documentsPath: '', homePath: '' });
  const [targetCheck, setTargetCheck] = useState({ exists: false, fileCount: 0, targetPath: '' });

  const [previewViewport, setPreviewViewport] = useState(
    viewportMode === 'mobile' || viewportMode === 'tablet' ? viewportMode : 'desktop'
  );
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const previewContainerRef = useRef(null);
  const backdropMouseDownRef = useRef(false);
  const prevIsOpenRef = useRef(false);
  const [previewContainerSize, setPreviewContainerSize] = useState({ width: 720, height: 500 });

  const [activeFileKey, setActiveFileKey] = useState('liveHtml');
  const [copiedKey, setCopiedKey] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [liveServerInfo, setLiveServerInfo] = useState({ running: false, url: '', port: null, error: null });

  const normalizedSlug = useMemo(
    () => slugifyProjectFolderName(folderNameInput || projectName || 'yayinlanan-react-site'),
    [folderNameInput, projectName]
  );

  // Generate React source bundle + pixel-accurate multi-page Standalone HTML safely
  const { projectFiles, buildError } = useMemo(() => {
    if (!isOpen) return { projectFiles: null, buildError: null };
    try {
      const files = generateModularReactProject(elements, canvasSettings, canvasByViewport, {
        projectFunctions,
        tabs,
        pageLinks,
        viewportMode,
        activeTabId,
        projectName,
        folderSlug: normalizedSlug,
      });
      return { projectFiles: files, buildError: null };
    } catch (err) {
      console.error('Yayın paketi derleme hatası:', err);
      return {
        projectFiles: null,
        buildError: err?.message || 'Yayın paketi derlenirken beklenmedik bir hata oluştu.',
      };
    }
  }, [isOpen, elements, canvasSettings, canvasByViewport, projectFunctions, tabs, pageLinks, viewportMode, activeTabId, projectName, normalizedSlug]);

  // Reset modal session & load OS defaults only when transitioning open
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      backdropMouseDownRef.current = false;
      return;
    }
    const justOpened = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;
    if (!justOpened) return;

    setExportResult(null);
    setLiveServerInfo((prev) => ({ ...prev, error: null }));
    setFolderNameInput(slugifyProjectFolderName(projectName || 'yayinlanan-react-site'));
    setPreviewViewport(viewportMode === 'mobile' || viewportMode === 'tablet' ? viewportMode : 'desktop');
    setRightTab('preview');

    if (hasElectron && window.electronAPI?.getExportDefaults) {
      window.electronAPI.getExportDefaults(projectName).then((info) => {
        if (!info) return;
        setDefaultsInfo({
          desktopPath: info.desktopPath || '',
          documentsPath: info.documentsPath || '',
          homePath: info.homePath || '',
        });
        setTargetBaseDir((prev) => prev || info.desktopPath || '');
      }).catch(() => {});
    }
  }, [isOpen, hasElectron, projectName, viewportMode]);

  // Live check target directory collision whenever directory or slug changes
  useEffect(() => {
    if (!isOpen || !hasElectron || !window.electronAPI?.checkExportTarget) return;
    let cancelled = false;
    window.electronAPI
      .checkExportTarget({ targetBaseDir, folderName: normalizedSlug })
      .then((res) => {
        if (!cancelled && res) setTargetCheck(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasElectron, targetBaseDir, normalizedSlug, exportResult]);

  // Esc closes modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Measure live preview stage for 1:1 media-query accurate scaling
  useEffect(() => {
    if (!isOpen || rightTab !== 'preview' || !previewContainerRef.current) return;
    const el = previewContainerRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPreviewContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isOpen, rightTab]);

  // Metrics & flat node count
  const stats = useMemo(() => {
    if (!isOpen) return { pages: 1, roots: 0, totalNodes: 0, hasOverrides: false };
    const flat = flattenTree(elements || []);
    const hasOverrides = flat.some(
      (n) =>
        (n?.responsive?.tablet && Object.keys(n.responsive.tablet).length > 0) ||
        (n?.responsive?.mobile && Object.keys(n.responsive.mobile).length > 0)
    );
    return {
      pages: Array.isArray(tabs) && tabs.length > 0 ? tabs.length : 1,
      roots: Array.isArray(elements) ? elements.length : 0,
      totalNodes: flat.length,
      hasOverrides,
    };
  }, [isOpen, elements, tabs]);

  // Build ordered file list based on selected output profile & modular usage
  const outputManifest = useMemo(() => {
    if (!projectFiles) return [];
    const list = [
      {
        key: 'liveHtml',
        path: buildMode === 'html' ? 'index.html' : 'live-preview.html',
        downloadName: buildMode === 'html' ? 'index.html' : `${normalizedSlug}-canli-site.html`,
        mime: 'text/html;charset=utf-8',
        role:
          buildMode === 'html'
            ? 'Çift tıklayınca doğrudan açılan çok sayfalı hazır web sitesi'
            : 'Kurulumsuz canlı çok sayfalı HTML5 önizleme',
        content: projectFiles.standaloneHtml,
      },
    ];

    if (buildMode === 'react') {
      list.push(
        {
          key: 'app',
          path: 'src/App.jsx',
          downloadName: 'App.jsx',
          mime: 'text/javascript;charset=utf-8',
          role: projectFiles.usesModularTemplate
            ? 'Modüler orkestratör & rota yönetimi'
            : 'Özel 1:1 tuval kök bileşeni',
          content: projectFiles.appCode,
        },
        {
          key: 'customElements',
          path: 'src/components/CustomElementsSection.jsx',
          downloadName: 'CustomElementsSection.jsx',
          mime: 'text/javascript;charset=utf-8',
          role: 'Bileşen AST & JavaScript çalışma motoru',
          content: projectFiles.customElementsCode,
        }
      );

      if (projectFiles.usesModularTemplate) {
        list.push(
          { key: 'navbar', path: 'src/components/Navbar.jsx', downloadName: 'Navbar.jsx', role: 'Üst navigasyon bileşeni', content: projectFiles.navbarCode },
          { key: 'hero', path: 'src/components/HeroSection.jsx', downloadName: 'HeroSection.jsx', role: 'Hero vitrin bileşeni', content: projectFiles.heroCode },
          { key: 'productsSection', path: 'src/components/ProductsSection.jsx', downloadName: 'ProductsSection.jsx', role: 'Responsive kart ızgara alanı', content: projectFiles.productsSectionCode },
          { key: 'productCard', path: 'src/components/ProductCard.jsx', downloadName: 'ProductCard.jsx', role: 'Tekil vitrin kartı', content: projectFiles.productCardCode },
          { key: 'footer', path: 'src/components/Footer.jsx', downloadName: 'Footer.jsx', role: 'Alt bilgi bileşeni', content: projectFiles.footerCode }
        );
      }

      list.push(
        { key: 'indexCss', path: 'src/index.css', downloadName: 'index.css', role: 'Tailwind v4 + responsive @media kuralları', content: projectFiles.indexCss },
        { key: 'main', path: 'src/main.jsx', downloadName: 'main.jsx', role: 'React 19 giriş noktası', content: projectFiles.mainJsx },
        { key: 'indexHtml', path: 'index.html', downloadName: 'index.html', role: 'Vite SPA HTML kabuğu', content: projectFiles.indexHtml },
        { key: 'vite', path: 'vite.config.js', downloadName: 'vite.config.js', role: 'Vite + Tailwind eklenti yapılandırması', content: projectFiles.viteConfig },
        { key: 'pkg', path: 'package.json', downloadName: 'package.json', role: 'Bağımlılık ve script bildirimi', content: projectFiles.packageJson },
        { key: 'craftJson', path: 'craft.project.json', downloadName: `${normalizedSlug}.craft.json`, mime: 'application/json;charset=utf-8', role: 'CraftStudio kayıpsız proje şeması', content: projectFiles.craftProjectJson }
      );
    } else {
      list.push({
        key: 'craftJson',
        path: 'craft.project.json',
        downloadName: `${normalizedSlug}.craft.json`,
        mime: 'application/json;charset=utf-8',
        role: 'CraftStudio kayıpsız yeniden içe aktarma şeması',
        content: projectFiles.craftProjectJson,
      });
    }

    return list;
  }, [projectFiles, buildMode, normalizedSlug]);

  // Keep selected file valid when buildMode changes
  useEffect(() => {
    if (!outputManifest.some((f) => f.key === activeFileKey) && outputManifest[0]) {
      setActiveFileKey(outputManifest[0].key);
    }
  }, [outputManifest, activeFileKey]);

  const activeFileItem = outputManifest.find((f) => f.key === activeFileKey) || outputManifest[0] || null;

  const resolvedTargetPath = useMemo(() => {
    if (!hasElectron) return `Tarayıcı İndirme · ${normalizedSlug}.html`;
    return targetCheck?.targetPath || joinPathDisplay(targetBaseDir || defaultsInfo.desktopPath, normalizedSlug);
  }, [hasElectron, targetCheck, targetBaseDir, defaultsInfo.desktopPath, normalizedSlug]);

  const handleBrowseFolder = useCallback(async () => {
    if (!hasElectron || !window.electronAPI?.selectExportDirectory) return;
    const res = await window.electronAPI.selectExportDirectory(targetBaseDir || defaultsInfo.desktopPath);
    if (res && !res.canceled && res.directoryPath) {
      setTargetBaseDir(res.directoryPath);
    }
  }, [hasElectron, targetBaseDir, defaultsInfo.desktopPath]);

  const handleCopyCode = useCallback(() => {
    if (!activeFileItem?.content) return;
    navigator.clipboard.writeText(activeFileItem.content);
    setCopiedKey(activeFileItem.key);
    setTimeout(() => setCopiedKey(null), 1800);
  }, [activeFileItem]);

  const buildExportPayload = useCallback(
    (openFolderAfter = false) => ({
      title: projectName,
      folderName: normalizedSlug,
      targetBaseDir: targetBaseDir || defaultsInfo.desktopPath,
      openFolderAfter,
      mode: buildMode,
      tabName,
      activeTabId,
      viewportMode,
      canvasSettings,
      canvasByViewport,
      elements,
      tabs,
      projectFunctions,
      pageLinks,
      standaloneHtml: projectFiles?.standaloneHtml || '',
      files:
        buildMode === 'html'
          ? { standaloneHtml: projectFiles?.standaloneHtml || '', usesModularTemplate: false }
          : projectFiles,
    }),
    [
      projectFiles,
      projectName,
      normalizedSlug,
      targetBaseDir,
      defaultsInfo.desktopPath,
      buildMode,
      tabName,
      activeTabId,
      viewportMode,
      canvasSettings,
      canvasByViewport,
      elements,
      tabs,
      projectFunctions,
      pageLinks,
    ]
  );

  const handleBuildAndExport = useCallback(async (openFolderAfter = false) => {
    if (!projectFiles) return;
    setIsExporting(true);
    setExportResult(null);

    try {
      if (hasElectron && window.electronAPI?.exportToDesktop) {
        const res = await window.electronAPI.exportToDesktop(buildExportPayload(openFolderAfter));
        setExportResult(res);
        return res;
      }

      // Honest Browser mode: download standalone interactive HTML5 build directly
      const fileName = `${normalizedSlug}.html`;
      triggerBrowserDownload(fileName, projectFiles.standaloneHtml, 'text/html;charset=utf-8');
      const webRes = {
        success: true,
        webMode: true,
        folderPath: `İndirilenler / ${fileName}`,
        writtenFiles: [
          {
            path: fileName,
            bytes: new TextEncoder().encode(projectFiles.standaloneHtml).length,
          },
        ],
      };
      setExportResult(webRes);
      return webRes;
    } catch (err) {
      const errRes = { success: false, error: err?.message || 'Dışa aktarım sırasında beklenmedik bir hata oluştu.' };
      setExportResult(errRes);
      return errRes;
    } finally {
      setIsExporting(false);
    }
  }, [projectFiles, hasElectron, normalizedSlug, buildExportPayload]);

  const handleOpenLiveInBrowser = useCallback(async () => {
    if (!projectFiles?.standaloneHtml) return;
    if (hasElectron && window.electronAPI?.launchLiveServer) {
      setIsExporting(true);
      setLiveServerInfo((prev) => ({ ...prev, error: null }));
      try {
        let resolvedFolder = targetCheck?.targetPath || targetBaseDir || defaultsInfo.desktopPath || '';
        if (window.electronAPI?.exportToDesktop) {
          const exportRes = await window.electronAPI.exportToDesktop(buildExportPayload(false));
          if (exportRes) {
            setExportResult(exportRes);
            if (exportRes.success && exportRes.folderPath) {
              resolvedFolder = exportRes.folderPath;
            }
          }
        }

        const srvRes = await window.electronAPI.launchLiveServer({
          targetDir: resolvedFolder,
          htmlContent: projectFiles.standaloneHtml,
          openInBrowser: true,
        });
        if (srvRes?.success) {
          setLiveServerInfo({
            running: true,
            url: srvRes.url,
            port: srvRes.port,
            error: srvRes.openWarning ? `Sunucu açık (${srvRes.url}), tarayıcı otomatik açılamadı: ${srvRes.openWarning}` : null,
          });
        } else {
          setLiveServerInfo({ running: false, url: '', port: null, error: srvRes?.error || 'Yerel canlı sunucu başlatılamadı.' });
        }
      } catch (err) {
        setLiveServerInfo({
          running: false,
          url: '',
          port: null,
          error: err?.message || 'Canlı önizleme sunucusu başlatılırken hata oluştu.',
        });
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // Browser mode: launch live Blob preview window cleanly
    const blob = new Blob([projectFiles.standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      setLiveServerInfo((prev) => ({
        ...prev,
        error: 'Tarayıcı açılır pencereyi engelledi. İzin verin veya "Canlı Siteyi İndir (.html)" butonunu kullanın.',
      }));
    } else {
      setLiveServerInfo((prev) => ({ ...prev, error: null }));
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [
    projectFiles,
    hasElectron,
    targetCheck?.targetPath,
    targetBaseDir,
    defaultsInfo.desktopPath,
    buildExportPayload,
  ]);

  const handleStopLiveServer = useCallback(async () => {
    if (!hasElectron || !window.electronAPI?.stopLiveServer) return;
    await window.electronAPI.stopLiveServer();
    setLiveServerInfo({ running: false, url: '', port: null, error: null });
  }, [hasElectron]);

  const handleDownloadReactBundle = useCallback(() => {
    if (!projectFiles) return;
    const bundle = {
      studio: 'CraftStudio',
      projectName,
      folderSlug: normalizedSlug,
      generatedAt: new Date().toISOString(),
      files: outputManifest.reduce((acc, item) => {
        acc[item.path] = item.content;
        return acc;
      }, {}),
    };
    triggerBrowserDownload(
      `${normalizedSlug}-react-paketi.json`,
      JSON.stringify(bundle, null, 2),
      'application/json;charset=utf-8'
    );
  }, [projectFiles, projectName, normalizedSlug, outputManifest]);

  if (!isOpen) return null;

  if (buildError || !projectFiles) {
    return (
      <div
        data-testid="export-modal-backdrop"
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-3"
        onMouseDown={(e) => {
          backdropMouseDownRef.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          const startedOnBackdrop = backdropMouseDownRef.current;
          backdropMouseDownRef.current = false;
          if (startedOnBackdrop && e.target === e.currentTarget) onClose?.();
        }}
      >
        <div className="w-full max-w-md bg-[#18181b] border border-red-500/40 rounded-md shadow-2xl p-5 text-zinc-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-300 font-semibold text-[13px]">
              <AlertTriangle size={16} />
              <span>Yayın Paketi Oluşturulamadı</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Kapat"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-[12px] text-zinc-300 font-mono bg-[#101013] border border-[#2c2c31] rounded p-3 break-all">
            {buildError || 'Proje dosyaları derlenemedi.'}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-zinc-100"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Virtual viewport dimensions & proportional scale for faithful media query testing
  const activeStageCanvas = canvasByViewport?.[previewViewport] || canvasSettings || {};
  const virtualViewportWidth = previewViewport === 'mobile' ? 375 : previewViewport === 'tablet' ? 768 : Math.max(960, Number(activeStageCanvas?.width || canvasSettings?.width) || 1280);
  const virtualStageHeight = Number(activeStageCanvas?.height || canvasSettings?.height) || 1350;
  const virtualStageBg = activeStageCanvas?.bgColor || activeStageCanvas?.backgroundColor || canvasSettings?.bgColor || canvasSettings?.backgroundColor || '#ffffff';
  const availW = Math.max(260, previewContainerSize.width - 36);
  const availH = Math.max(240, previewContainerSize.height - 64);
  const previewScale = Math.min(1, availW / virtualViewportWidth);
  const virtualIframeHeight = Math.max(520, Math.round(availH / previewScale));

  return (
    <div
      data-testid="export-modal-backdrop"
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-3"
      onMouseDown={(e) => {
        backdropMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const startedOnBackdrop = backdropMouseDownRef.current;
        backdropMouseDownRef.current = false;
        if (startedOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-[96vw] max-w-[1280px] h-[88vh] min-h-[580px] max-h-[860px] bg-[#18181b] border border-[#2c2c31] rounded-md shadow-2xl flex flex-col overflow-hidden text-zinc-200 select-text">
        {/* Top Workstation Header */}
        <div className="h-11 px-4 bg-[#141417] border-b border-[#2c2c31] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 rounded bg-[#0d99ff]/15 border border-[#0d99ff]/40 text-[#38bdf8] flex items-center justify-center shrink-0">
              <Globe size={13} strokeWidth={1.75} />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[13px] font-semibold text-zinc-100 tracking-tight truncate">
                Canlıya Al ve Yayınla
              </h2>
              <span className="text-zinc-600">/</span>
              <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[220px]" title={projectFilePath || projectName}>
                {projectName || 'İsimsiz Proje'}
              </span>
            </div>
            <span
              className={`ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
                hasElectron
                  ? 'bg-[#1c1c21] border-[#2e2e35] text-zinc-300'
                  : 'bg-[#1a1f29] border-[#2c3a52] text-[#7dd3fc]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hasElectron ? 'bg-emerald-400' : 'bg-[#0d99ff]'}`} />
              {hasElectron ? 'Yerel Masaüstü Derleyici' : 'Tarayıcı Web Modu'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {liveServerInfo.running && liveServerInfo.url && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <button
                  type="button"
                  onClick={() => window.electronAPI?.openExternalUrl?.(liveServerInfo.url)}
                  className="hover:underline flex items-center gap-1"
                >
                  <span>{liveServerInfo.url}</span>
                  <ExternalLink size={10} />
                </button>
                <button
                  type="button"
                  onClick={handleStopLiveServer}
                  title="Canlı Sunucuyu Durdur"
                  className="ml-1 p-0.5 rounded hover:bg-emerald-500/20 text-emerald-200"
                >
                  <Square size={10} fill="currentColor" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Kapat (Esc)"
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Main 2-Pane Engineering Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT PANE: Build Spec, Target Path & Output Controls */}
          <aside className="w-[380px] shrink-0 bg-[#141417] border-r border-[#2c2c31] flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* 1. Target Identity & Directory */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                    1. Hedef Konum ve Proje Kimliği
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">UTF-8</span>
                </div>

                {/* Folder / Package Slug */}
                <div className="space-y-1">
                  <label className="block text-[11px] text-zinc-300 font-medium" htmlFor="export-folder-slug">
                    Çıktı Klasör / Paket Adı
                  </label>
                  <input
                    id="export-folder-slug"
                    type="text"
                    value={folderNameInput}
                    onChange={(e) => setFolderNameInput(e.target.value)}
                    placeholder="ornek-web-projesi"
                    className="w-full h-8 px-2.5 bg-[#0f0f12] border border-[#2e2e35] focus:border-[#0d99ff] rounded text-[12px] font-mono text-zinc-100 focus:outline-none transition-colors"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-0.5">
                    <span>Normalize paket adı:</span>
                    <span className="text-zinc-300">{normalizedSlug}</span>
                  </div>
                </div>

                {/* Parent Directory Selector (Electron) or Web Notice */}
                {hasElectron ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-zinc-300 font-medium">Üst Dizin</label>
                      <div className="flex items-center gap-1">
                        {defaultsInfo.desktopPath && (
                          <button
                            type="button"
                            onClick={() => setTargetBaseDir(defaultsInfo.desktopPath)}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                              targetBaseDir === defaultsInfo.desktopPath
                                ? 'bg-[#0d99ff]/15 border-[#0d99ff]/50 text-[#7dd3fc]'
                                : 'bg-[#1a1a1f] border-[#2c2c31] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            Masaüstü
                          </button>
                        )}
                        {defaultsInfo.documentsPath && (
                          <button
                            type="button"
                            onClick={() => setTargetBaseDir(defaultsInfo.documentsPath)}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                              targetBaseDir === defaultsInfo.documentsPath
                                ? 'bg-[#0d99ff]/15 border-[#0d99ff]/50 text-[#7dd3fc]'
                                : 'bg-[#1a1a1f] border-[#2c2c31] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            Belgeler
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex-1 h-8 px-2.5 bg-[#0f0f12] border border-[#2c2c31] rounded flex items-center text-[11px] font-mono text-zinc-300 truncate"
                        title={targetBaseDir || defaultsInfo.desktopPath}
                      >
                        {targetBaseDir || defaultsInfo.desktopPath || 'Masaüstü'}
                      </div>
                      <button
                        type="button"
                        onClick={handleBrowseFolder}
                        className="h-8 px-2.5 bg-[#202026] hover:bg-[#282830] border border-[#32323a] rounded text-[11px] font-medium text-zinc-100 flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        <FolderOpen size={13} className="text-zinc-300" />
                        <span>Gözat</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-[#101218] border border-[#272c38] text-[11px] text-zinc-400 leading-relaxed">
                    Tarayıcı ortamındasınız. Doğrudan disk klasörü yazımı masaüstü uygulamasında aktiftir; burada eksiksiz{' '}
                    <strong className="text-zinc-200">kurulumsuz canlı HTML5 build</strong> indirebilir veya yeni sekmede çalıştırabilirsiniz.
                  </div>
                )}

                {/* Resolved Full Path Preview Box */}
                <div className="p-2.5 rounded bg-[#0f0f12] border border-[#27272d] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="uppercase tracking-wider font-semibold">Oluşturulacak Tam Yol</span>
                    {hasElectron && (
                      targetCheck.exists ? (
                        <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                          <AlertTriangle size={10} />
                          <span>Mevcut ({targetCheck.fileCount} öğe)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Yeni Klasör</span>
                        </span>
                      )
                    )}
                  </div>
                  <div
                    data-testid="resolved-export-path"
                    className="text-[11px] font-mono text-zinc-100 break-all select-all leading-snug"
                  >
                    {resolvedTargetPath}
                  </div>
                </div>
              </section>

              {/* 2. Output Profile */}
              <section className="space-y-2">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  2. Yayınlama Formatı
                </span>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#0f0f12] border border-[#27272c] rounded">
                  <button
                    type="button"
                    onClick={() => setBuildMode('html')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                      buildMode === 'html'
                        ? 'bg-[#25252c] text-zinc-100 border border-[#3a3a44]'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    Hazır Site (index.html)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildMode('react')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                      buildMode === 'react'
                        ? 'bg-[#25252c] text-zinc-100 border border-[#3a3a44]'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    React + Vite Projesi
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {buildMode === 'html'
                    ? 'Kurulumsuz tek tıkla çalışan index.html üretir; tarayıcıda doğrudan açılır ve sunucuya yüklenmeye hazırdır.'
                    : 'Tam React + Vite kaynak kodunu (npm run dev) ve doğrudan açılabilir live-preview.html dosyasını birlikte üretir.'}
                </p>
              </section>

              {/* 3. Telemetry & Build Architecture */}
              <section className="space-y-2">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  3. Derleme Telemetrisi
                </span>
                <div className="bg-[#0f0f12] border border-[#27272c] rounded divide-y divide-[#1f1f24] text-[11px]">
                  <div className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-zinc-400">Aktif / Toplam Sayfa</span>
                    <span className="font-mono tabular-nums text-zinc-200">{tabName} ({stats.pages})</span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-zinc-400">DOM Kök / Alt Öğe</span>
                    <span className="font-mono tabular-nums text-zinc-200">{stats.roots} / {stats.totalNodes}</span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-zinc-400">Bağlı JS / Formül</span>
                    <span className="font-mono tabular-nums text-zinc-200">{projectFunctions.length} fonksiyon</span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-zinc-400">Render Mimarisi</span>
                    <span className="font-mono text-zinc-200">
                      {projectFiles.usesModularTemplate ? 'Modüler + 1:1 AST' : 'Özel Tuval 1:1 AST'}
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-zinc-400">Üretilecek Dosya</span>
                    <span className="font-mono tabular-nums text-zinc-200">{outputManifest.length} dosya</span>
                  </div>
                </div>
              </section>

              {/* 4. Build Result & Manifest Output */}
              {exportResult && (
                <section
                  className={`p-3 rounded border space-y-2 ${
                    exportResult.success
                      ? 'bg-[#101a15] border-emerald-500/35'
                      : 'bg-[#1c1113] border-red-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    {exportResult.success ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span className="text-emerald-300">Yayın Paketi Oluşturuldu</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-red-400 shrink-0" />
                        <span className="text-red-300">İşlem Başarısız</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-300 break-all">
                    {exportResult.success ? exportResult.folderPath : exportResult.error}
                  </p>
                  {Array.isArray(exportResult.writtenFiles) && exportResult.writtenFiles.length > 0 && (
                    <div className="max-h-28 overflow-y-auto border-t border-white/[0.08] pt-1.5 space-y-0.5 font-mono text-[10px] text-zinc-400">
                      {exportResult.writtenFiles.map((wf) => (
                        <div key={wf.path} className="flex items-center justify-between">
                          <span className="truncate text-zinc-300">{wf.path}</span>
                          <span className="tabular-nums text-zinc-500 shrink-0 ml-2">{formatByteSize(wf.bytes)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {liveServerInfo.error && (
                <div className="p-2.5 rounded bg-[#1c1113] border border-red-500/40 text-[11px] text-red-300">
                  {liveServerInfo.error}
                </div>
              )}
            </div>

            {/* Bottom Build Action Console */}
            <div className="p-3.5 border-t border-[#2c2c31] bg-[#16161a] space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => handleBuildAndExport(false)}
                disabled={isExporting}
                className="w-full h-9 px-3 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] disabled:opacity-50 text-white text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {hasElectron ? <FolderCheck size={14} /> : <Download size={14} />}
                <span>
                  {isExporting
                    ? 'Paket Hazırlanıyor...'
                    : hasElectron
                      ? 'Projeyi Hedefe Oluştur'
                      : 'Canlı Siteyi İndir (.html)'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenLiveInBrowser}
                  disabled={isExporting}
                  className="h-8 px-2.5 rounded bg-[#222229] hover:bg-[#2a2a33] border border-[#34343e] text-zinc-100 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play size={12} className="text-[#38bdf8]" />
                  <span>{hasElectron ? 'Tarayıcıda Canlı Aç' : 'Yeni Sekmede Aç'}</span>
                </button>

                {hasElectron ? (
                  <button
                    type="button"
                    disabled={!exportResult?.folderPath && !targetCheck?.exists}
                    onClick={() => window.electronAPI?.openDesktopFolder?.(exportResult?.folderPath || resolvedTargetPath)}
                    className="h-8 px-2.5 rounded bg-[#1b1b20] hover:bg-[#23232a] disabled:opacity-40 border border-[#2e2e36] text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderOpen size={12} className="text-zinc-400" />
                    <span>Klasörü Aç</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadReactBundle}
                    className="h-8 px-2.5 rounded bg-[#1b1b20] hover:bg-[#23232a] border border-[#2e2e36] text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileCode2 size={12} className="text-zinc-400" />
                    <span>Kaynak Paketi (.json)</span>
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT PANE: Live Multi-Viewport Preview, File Manifest, Source Inspector */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#111113]">
            {/* Inspection Header Toolbar */}
            <div className="h-10 px-3 bg-[#18181b] border-b border-[#2c2c31] flex items-center justify-between gap-3 shrink-0">
              {/* View Mode Switcher */}
              <div className="flex items-center bg-[#0f0f12] border border-[#27272c] rounded p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setRightTab('preview')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                    rightTab === 'preview' ? 'bg-[#25252c] text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Eye size={12} />
                  <span>Canlı Ön İzleme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('structure')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                    rightTab === 'structure' ? 'bg-[#25252c] text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Layers size={12} />
                  <span>Hedef Dosya Ağacı</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('code')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                    rightTab === 'code' ? 'bg-[#25252c] text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileCode2 size={12} />
                  <span>Kaynak Kod</span>
                </button>
              </div>

              {/* Right Contextual Controls */}
              {rightTab === 'preview' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#0f0f12] border border-[#27272c] rounded p-0.5 gap-0.5">
                    {[
                      { id: 'desktop', label: 'Masaüstü', px: `${canvasSettings?.width || 1280}px`, icon: Monitor },
                      { id: 'tablet', label: 'Tablet', px: '768px', icon: Tablet },
                      { id: 'mobile', label: 'Mobil', px: '375px', icon: Smartphone },
                    ].map((vp) => {
                      const VpIcon = vp.icon;
                      const active = previewViewport === vp.id;
                      return (
                        <button
                          key={vp.id}
                          type="button"
                          onClick={() => setPreviewViewport(vp.id)}
                          title={`${vp.label} (${vp.px})`}
                          className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                            active ? 'bg-[#0d99ff] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <VpIcon size={11} />
                          <span>{vp.px}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400 px-1.5 py-0.5 rounded bg-[#0f0f12] border border-[#27272c]">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewRefreshKey((k) => k + 1)}
                    title="Önizlemeyi Yenile"
                    className="p-1.5 rounded bg-[#0f0f12] border border-[#27272c] text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              )}

              {rightTab === 'code' && activeFileItem && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerBrowserDownload(activeFileItem.downloadName, activeFileItem.content, activeFileItem.mime || 'text/plain;charset=utf-8')}
                    className="px-2.5 py-1 rounded bg-[#202026] hover:bg-[#2a2a33] border border-[#32323a] text-[11px] font-medium text-zinc-200 flex items-center gap-1.5"
                  >
                    <Download size={11} />
                    <span>İndir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-[11px] font-semibold text-white flex items-center gap-1.5"
                  >
                    <Copy size={11} />
                    <span>{copiedKey === activeFileItem.key ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Inspection Body */}
            {rightTab === 'preview' && (
              <div
                ref={previewContainerRef}
                className="flex-1 min-h-0 bg-[#0d0d10] p-4 flex flex-col items-center justify-start overflow-auto"
                style={{
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                {/* Simulated Browser Chrome Bezel */}
                <div
                  style={{ width: `${Math.round(virtualViewportWidth * previewScale)}px` }}
                  className="bg-[#18181b] border border-[#2c2c31] rounded-md shadow-2xl overflow-hidden shrink-0 transition-[width] duration-150"
                >
                  <div className="h-7 px-3 bg-[#141417] border-b border-[#27272c] flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <div className="flex items-center gap-2 truncate">
                      <Globe size={11} className="text-[#38bdf8] shrink-0" />
                      <span className="truncate text-zinc-300">
                        {liveServerInfo.running && liveServerInfo.url
                          ? liveServerInfo.url
                          : `preview://${normalizedSlug}/`}
                      </span>
                    </div>
                    <span className="tabular-nums text-zinc-500 shrink-0 ml-2">
                      {virtualViewportWidth} × {virtualStageHeight}px
                    </span>
                  </div>

                  {/* Proportional Viewport Stage so media queries match device widths */}
                  <div
                    style={{
                      width: `${Math.round(virtualViewportWidth * previewScale)}px`,
                      height: `${Math.round(virtualIframeHeight * previewScale)}px`,
                      overflow: 'hidden',
                      position: 'relative',
                      background: virtualStageBg,
                    }}
                  >
                    <iframe
                      key={`${previewRefreshKey}-${previewViewport}`}
                      title="Canlı Yayın Önizlemesi"
                      srcDoc={projectFiles.standaloneHtml}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                      style={{
                        width: `${virtualViewportWidth}px`,
                        height: `${virtualIframeHeight}px`,
                        border: 'none',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        background: virtualStageBg,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {rightTab === 'structure' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-[#101013] custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-[#27272c] pb-3">
                    <div>
                      <h3 className="text-[12px] font-semibold text-zinc-100">Hedef Klasör & Paket Yapısı</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono break-all">
                        {resolvedTargetPath}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-zinc-400 bg-[#18181b] border border-[#2c2c31] px-2.5 py-1 rounded">
                      {outputManifest.length} dosya planlandı
                    </span>
                  </div>

                  <div className="bg-[#141417] border border-[#27272c] rounded overflow-hidden divide-y divide-[#202026]">
                    <div className="px-3.5 py-2 bg-[#18181c] flex items-center gap-2 text-[11px] font-mono text-zinc-200">
                      <Folder size={13} className="text-[#38bdf8]" />
                      <span>{normalizedSlug}/</span>
                    </div>
                    {outputManifest.map((file) => (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => {
                          setActiveFileKey(file.key);
                          setRightTab('code');
                        }}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-[#1b1b21] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={12} className="text-zinc-500 group-hover:text-[#38bdf8] shrink-0" />
                          <span className="font-mono text-[11px] text-zinc-200 truncate">{file.path}</span>
                          <span className="text-[10px] text-zinc-500 truncate hidden sm:inline">
                            — {file.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="font-mono tabular-nums text-[10px] text-zinc-400">
                            {formatByteSize(file.content)}
                          </span>
                          <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {rightTab === 'code' && (
              <div className="flex-1 flex min-h-0 overflow-hidden bg-[#0c0c0e]">
                {/* File Tree Left Sidebar */}
                <div className="w-60 shrink-0 bg-[#141417] border-r border-[#27272c] overflow-y-auto py-2 px-1.5 space-y-0.5 custom-scrollbar">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Dosya Gezgini ({outputManifest.length})
                  </div>
                  {outputManifest.map((file) => {
                    const active = activeFileItem?.key === file.key;
                    return (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => setActiveFileKey(file.key)}
                        className={`w-full px-2 py-1.5 rounded text-left font-mono text-[11px] flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-[#0d99ff]/15 text-white border border-[#0d99ff]/40'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <span className="truncate">{file.path}</span>
                        <span className="text-[9px] tabular-nums text-zinc-500 ml-1 shrink-0">
                          {formatByteSize(file.content)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Code Content Pane */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  {activeFileItem && (
                    <div className="h-8 px-3 bg-[#141417] border-b border-[#242429] flex items-center justify-between text-[11px] font-mono text-zinc-400 shrink-0">
                      <span className="text-zinc-200">{activeFileItem.path}</span>
                      <span className="tabular-nums">{formatByteSize(activeFileItem.content)}</span>
                    </div>
                  )}
                  <pre className="flex-1 p-4 overflow-auto text-[11px] font-mono text-zinc-200 leading-relaxed select-text custom-scrollbar">
                    <code>{activeFileItem?.content || ''}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
