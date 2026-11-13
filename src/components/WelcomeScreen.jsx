import React, { useRef, useState } from 'react';
import {
  Plus, FolderOpen, Clock, Smartphone, Search, X,
  ArrowRight, Layers, FileCode, CheckCircle2, ChevronRight,
  Trash2, FilePlus, Keyboard, LayoutGrid, RotateCcw
} from 'lucide-react';
import { formatSavedDateLabel, countProjectElements } from '../utils/projectStorage';
import { importSiteCodeToProjectSchema } from '../utils/codeFileImporter';

export default function WelcomeScreen({
  onNewProject,
  onOpenProject,
  onOpenProjectFile = null,
  onOpenProjectFolder,
  onOpenRecentProject,
  onDeleteRecentProject = null,
  recentProjects = [],
  autosaveDraft = null,
  onRestoreAutosave = null,
  onDismissAutosave = null,
}) {
  const fileInputRef = useRef(null);
  const [recentQuery, setRecentQuery] = useState('');
  const [fileError, setFileError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const schema = importSiteCodeToProjectSchema(event.target?.result, file.name);
        setFileError(null);
        onOpenProject(schema);
      } catch (err) {
        setFileError(`Dosya içe aktarılamadı (${file.name}): ${err?.message || 'Lütfen geçerli bir .html, .jsx, .tsx veya .craft.json dosyası seçin.'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const triggerOpenProjectFile = () => {
    if (window.electronAPI?.openProjectFileDialog && onOpenProjectFile) {
      onOpenProjectFile();
    } else {
      fileInputRef.current?.click();
    }
  };

  const normalizedQuery = recentQuery.trim().toLowerCase();
  const filteredRecent = normalizedQuery
    ? recentProjects.filter((p) => (p.name || '').toLowerCase().includes(normalizedQuery))
    : recentProjects;

  const PRIMARY_CHOICES = [
    {
      id: 'blank',
      title: 'Yeni Boş Tuval',
      spec: '1280 × 1350 px',
      description: 'Hazır stil içermeyen sıfırdan temiz DOM tuvali ile tam kontrollü sayfa mimarisi oluşturun.',
      icon: Plus,
      btnText: 'Boş Proje Başlat',
      primary: true,
      action: () => onNewProject('blank'),
      wireframe: (
        <div className="h-20 rounded bg-[#0f0f12] border border-[#27272d] p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span>viewport: desktop</span>
            <span>0 node</span>
          </div>
          <div className="flex-1 mt-1.5 rounded-sm border border-dashed border-[#34343d] bg-[#141418] flex items-center justify-center">
            <Plus size={14} className="text-zinc-500" />
          </div>
        </div>
      ),
    },
    {
      id: 'demo',
      title: 'Örnek Vitrin Şablonu',
      spec: 'Multi-Section AST',
      description: 'Sticky navigasyon, hero alanı, duyarlı kart ızgarası ve alt bilgi içeren başlangıç düzenini inceleyin.',
      icon: LayoutGrid,
      btnText: 'Demo Projeyi Yükle',
      primary: false,
      action: () => onNewProject('universal'),
      wireframe: (
        <div className="h-20 rounded bg-[#0f0f12] border border-[#27272d] p-2 flex flex-col gap-1.5">
          <div className="h-2.5 rounded-sm bg-[#1c1c22] border border-[#2a2a32] flex items-center justify-between px-1.5">
            <span className="w-6 h-1 bg-[#0d99ff]/80 rounded-full" />
            <div className="flex gap-1">
              <span className="w-3 h-1 bg-zinc-600 rounded-full" />
              <span className="w-3 h-1 bg-zinc-600 rounded-full" />
            </div>
          </div>
          <div className="flex-1 rounded-sm bg-[#16161b] border border-[#26262e] px-2 flex flex-col justify-center gap-1">
            <span className="w-16 h-1.5 bg-zinc-400/70 rounded-full" />
            <span className="w-24 h-1 bg-zinc-600 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-1 h-4">
            <div className="rounded-sm bg-[#19191f] border border-[#26262e]" />
            <div className="rounded-sm bg-[#19191f] border border-[#26262e]" />
            <div className="rounded-sm bg-[#19191f] border border-[#26262e]" />
          </div>
        </div>
      ),
    },
    {
      id: 'open',
      title: 'Koddan Site / Proje Aç',
      spec: '.html · .jsx · .tsx · .craft.json',
      description: 'Mevcut bir HTML sayfasını, React bileşenini (.jsx/.tsx) veya .craft.json projesini doğrudan tuvalde açıp düzenleyin.',
      icon: FolderOpen,
      btnText: 'Site / Dosya Seç',
      primary: false,
      action: triggerOpenProjectFile,
      wireframe: (
        <div className="h-20 rounded bg-[#0f0f12] border border-[#27272d] p-2.5 flex flex-col justify-center gap-1.5 font-mono text-[10px]">
          <div className="flex items-center gap-2 text-zinc-300">
            <FileCode size={12} className="text-amber-400 shrink-0" />
            <span className="truncate">index.html · App.jsx</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500 pl-3">
            <ChevronRight size={10} />
            <span className="truncate">proje.craft.json</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#111113] text-zinc-200 flex flex-col overflow-y-auto select-none">
      {/* Hidden file input for opening HTML/JSX/craft.json websites */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.craft,.craft.json,.html,.htm,.jsx,.tsx"
        className="hidden"
      />

      {/* Precision Top Application Bar */}
      <header className="h-12 px-6 border-b border-[#27272c] bg-[#161619] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#1f1f25] border border-[#32323a] flex items-center justify-center text-[#0d99ff]">
            <Layers size={15} strokeWidth={1.8} />
          </div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-semibold text-zinc-100 text-[13px] tracking-tight">CraftStudio</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101013] text-zinc-400 border border-[#27272d]">
              v2.0 · AST Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerOpenProjectFile}
            className="h-8 flex items-center gap-1.5 px-3 rounded bg-[#1c1c21] hover:bg-[#24242a] text-zinc-200 text-[11px] font-medium border border-[#2c2c33] transition-colors"
          >
            <FilePlus size={13} className="text-amber-400" />
            <span>Site / Dosya Aç</span>
          </button>
          {onOpenProjectFolder && (
            <button
              type="button"
              onClick={onOpenProjectFolder}
              className="h-8 flex items-center gap-1.5 px-3 rounded bg-[#1c1c21] hover:bg-[#24242a] text-zinc-200 text-[11px] font-medium border border-[#2c2c33] transition-colors"
            >
              <FolderOpen size={13} className="text-zinc-400" />
              <span>Klasör İçe Aktar</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNewProject('blank')}
            className="h-8 flex items-center gap-1.5 px-3.5 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white text-[11px] font-semibold transition-colors"
          >
            <Plus size={13} />
            <span>Yeni Proje</span>
          </button>
        </div>
      </header>

      {/* Workstation Workspace Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-7 space-y-7">
        {fileError && (
          <div className="bg-red-950/50 border border-red-500/40 rounded-md px-4 py-2.5 flex items-center justify-between gap-3 text-[11px] text-red-200">
            <span>{fileError}</span>
            <button
              type="button"
              onClick={() => setFileError(null)}
              className="text-red-300 hover:text-white p-0.5 rounded"
              title="Kapat"
            >
              <X size={13} />
            </button>
          </div>
        )}
        {/* Compact Workspace Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#222227] pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500 block mb-1">
              Proje Yöneticisi
            </span>
            <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
              Nasıl başlamak istersiniz?
            </h2>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
            <span>HTML5 AST Engine</span>
            <span className="text-zinc-700">|</span>
            <span>Desktop · Tablet · Mobile</span>
          </div>
        </div>

        {/* 0. Autosave Draft Recovery Banner (if an unsaved local session exists) */}
        {autosaveDraft && (
          <div className="bg-[#151820] border border-[#0d99ff]/40 rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded bg-[#0d99ff]/15 border border-[#0d99ff]/35 flex items-center justify-center text-[#38bdf8] shrink-0">
                <RotateCcw size={14} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-zinc-100 truncate">
                    Kurtarılabilir Otomatik Taslak: {autosaveDraft.name || 'Adsız Proje'}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    ● Kaydedilmemiş Oturum
                  </span>
                </div>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                  {formatSavedDateLabel(autosaveDraft.updatedAt)} • {autosaveDraft.tabs?.length || 1} sayfa • {countProjectElements(autosaveDraft.tabs)} bileşen
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onDismissAutosave && (
                <button
                  type="button"
                  onClick={onDismissAutosave}
                  className="h-8 px-3 rounded bg-[#1d2029] hover:bg-red-500/15 hover:text-red-300 border border-[#2c313f] hover:border-red-500/30 text-zinc-400 text-[11px] font-medium transition-colors"
                >
                  Taslağı Sil
                </button>
              )}
              {onRestoreAutosave && (
                <button
                  type="button"
                  onClick={() => onRestoreAutosave(autosaveDraft)}
                  className="h-8 px-3.5 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>Kaldığım Yerden Kurtar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. Workspace Presets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {PRIMARY_CHOICES.map((choice) => {
            const Icon = choice.icon;
            return (
              <div
                key={choice.id}
                onClick={choice.action}
                className="group bg-[#18181b] hover:bg-[#1c1c20] border border-[#27272d] hover:border-[#3e3e48] rounded-md p-4 cursor-pointer transition-colors flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-[#111114] border border-[#2c2c34] flex items-center justify-center text-zinc-300 group-hover:text-[#0d99ff] transition-colors">
                        <Icon size={14} strokeWidth={1.75} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-zinc-100">
                        {choice.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 bg-[#111114] border border-[#24242a] px-1.5 py-0.5 rounded">
                      {choice.spec}
                    </span>
                  </div>

                  {choice.wireframe}

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {choice.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    choice.action();
                  }}
                  className={`w-full h-8 flex items-center justify-center gap-1.5 rounded text-[11px] font-semibold transition-colors ${
                    choice.primary
                      ? 'bg-[#0d99ff] hover:bg-[#1fa3ff] text-white'
                      : 'bg-[#222228] hover:bg-[#2a2a32] text-zinc-200 border border-[#32323c]'
                  }`}
                >
                  <span>{choice.btnText}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* 2. Recent Projects Data Table & System Utilities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Projects List (Span 2) */}
          <div className="lg:col-span-2 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 flex items-center gap-1.5">
                <Clock size={12} className="text-zinc-400" />
                <span>Son Çalışılan Projeler</span>
              </h4>
              {recentProjects.length > 2 ? (
                <div className="flex items-center gap-1.5 bg-[#18181b] border border-[#2c2c34] rounded px-2 h-7 w-52 focus-within:border-[#0d99ff]">
                  <Search size={11} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={recentQuery}
                    onChange={(e) => setRecentQuery(e.target.value)}
                    placeholder="Proje filtrele..."
                    className="w-full bg-transparent text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  />
                  {recentQuery && (
                    <button
                      type="button"
                      onClick={() => setRecentQuery('')}
                      className="text-zinc-500 hover:text-zinc-200"
                      title="Temizle"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-zinc-500">Doğrudan açmak için tıklayın</span>
              )}
            </div>

            <div className="bg-[#18181b] border border-[#27272d] rounded-md overflow-hidden divide-y divide-[#222228]">
              {recentProjects.length === 0 ? (
                <div className="px-5 py-8 text-center text-[11px] text-zinc-500">
                  Henüz kaydedilmiş bir proje bulunmuyor. Editörde <span className="font-mono text-zinc-300">Ctrl+S</span> ile projenizi kaydedebilirsiniz.
                </div>
              ) : filteredRecent.length === 0 ? (
                <div className="px-5 py-6 text-center text-[11px] text-zinc-500">
                  &quot;{recentQuery}&quot; ile eşleşen proje bulunamadı.
                </div>
              ) : (
                filteredRecent.map((proj, idx) => (
                  <div
                    key={proj.id || idx}
                    onClick={() => onOpenRecentProject(proj)}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#1f1f25] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded bg-[#111114] border border-[#2c2c34] flex items-center justify-center text-zinc-400 group-hover:text-[#0d99ff] shrink-0">
                        <FileCode size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-zinc-100 text-[12px] group-hover:text-white transition-colors truncate">
                            {proj.name}
                          </h5>
                          {proj.filePath ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#111114] text-emerald-400 border border-[#28332c]">Dosya</span>
                          ) : proj.folderPath ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#111114] text-sky-400 border border-[#27313d]">Klasör</span>
                          ) : proj.hasWebSnapshot ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#111114] text-zinc-300 border border-[#2c2c34]">Kayıtlı</span>
                          ) : null}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 block truncate mt-0.5">
                          {proj.date || 'Bugün'} • {proj.tabsCount || 1} sayfa • {proj.elementsCount ?? 0} bileşen
                          {proj.functionsCount > 0 ? ` • ${proj.functionsCount} fonksiyon` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
                      <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded bg-[#111114] border border-[#25252c] text-zinc-400">
                        {proj.width || 1280} × {proj.height || 1350}
                      </span>
                      <span className="text-zinc-400 group-hover:text-[#0d99ff] font-medium text-[11px] flex items-center gap-0.5 transition-colors">
                        Aç <ChevronRight size={12} />
                      </span>
                      {onDeleteRecentProject && proj.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRecentProject(proj.id);
                          }}
                          title="Son projelerden kaldır"
                          className="p-1 rounded hover:bg-red-500/15 text-zinc-500 hover:text-red-400 opacity-70 group-hover:opacity-100 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Reference Column */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 flex items-center gap-1.5">
              <Smartphone size={12} className="text-zinc-400" />
              <span>Hızlı Başlangıç &amp; Kısayollar</span>
            </h4>

            <div
              onClick={() => onNewProject('mobile')}
              className="bg-[#18181b] hover:bg-[#1c1c20] border border-[#27272d] hover:border-[#3e3e48] rounded-md p-3.5 cursor-pointer transition-colors space-y-2.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-zinc-100">
                  Mobil Şablon (375px)
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-[#111114] border border-[#27272d] px-1.5 py-0.5 rounded">
                  375 × 1200
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Mobil dikey kırılım için hazırlanmış çalışma alanını başlatın.
              </p>
              <div className="flex items-center justify-end text-[11px] font-medium text-zinc-300 group-hover:text-[#0d99ff] pt-1 border-t border-[#222228]">
                <span className="flex items-center gap-1">
                  Başlat <ArrowRight size={12} />
                </span>
              </div>
            </div>

            <div className="bg-[#18181b] border border-[#27272d] rounded-md p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                <Keyboard size={12} className="text-zinc-400" />
                <span>Çalışma Kısayolları</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Projeyi Kaydet</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#101013] border border-[#27272d] text-[10px] font-mono text-zinc-200">Ctrl+S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Öğe Çoğalt</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#101013] border border-[#27272d] text-[10px] font-mono text-zinc-200">Alt+Sürükle</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tuval Kaydır</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#101013] border border-[#27272d] text-[10px] font-mono text-zinc-200">Alt / Space</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Status Footer */}
        <div className="px-4 py-2.5 bg-[#161619] rounded-md border border-[#24242a] flex flex-wrap items-center justify-between gap-4 text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>Gemini Stüdyo Ajanı</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-[#0d99ff] shrink-0" />
            <span>140+ Standart HTML5 &amp; Özel Sarmalama Motoru</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-zinc-400 shrink-0" />
            <span>React 19 + Standalone HTML5 Canlı Yayın</span>
          </div>
        </div>
      </main>
    </div>
  );
}
