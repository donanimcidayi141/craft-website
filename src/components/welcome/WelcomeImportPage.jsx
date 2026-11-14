import React, { useRef, useState } from 'react';
import {
  Upload,
  FileCode2,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import '../../styles/welcome-import.css';

const SUPPORTED_FORMATS = ['.html', '.htm', '.jsx', '.tsx', '.craft.json'];

const STEP_LABELS = {
  okunuyor: 'Okunuyor',
  analiz: 'Analiz ediliyor',
  yerleştiriliyor: 'Yerleştiriliyor',
};

/**
 * Sürüklenen DataTransfer nesnesinden (klasörler dahil) özyinelemeli dosya listesi toplar.
 * Tarayıcı `webkitGetAsEntry()` API'sini desteklemiyorsa veya hata verirse güvenli yedek yolunu bildirir.
 */
async function collectDroppedFilesWithEntries(dataTransfer, maxDepth = 8, maxFiles = 200) {
  const items = Array.from(dataTransfer?.items || []);
  const rawFiles = Array.from(dataTransfer?.files || []);

  const hasEntryApi = items.some((it) => typeof it.webkitGetAsEntry === 'function');
  if (!hasEntryApi) {
    // Bazı ortamlarda klasör bırakıldığında dosya boyutu 0 / tipi boş sahte giriş gelir
    const suspectedFolder = rawFiles.some((f) => f && f.size === 0 && f.type === '' && !f.name.includes('.'));
    if (suspectedFolder) {
      return { folderFallbackRequired: true, files: [] };
    }
    return { folderFallbackRequired: false, files: rawFiles.map((f) => ({ file: f, name: f.name, relativePath: f.name, size: f.size, depth: 0 })) };
  }

  const collected = [];
  const skipped = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

  const readFileEntry = (fileEntry) => new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });

  const readAllDirectoryEntries = (dirReader) => new Promise((resolve, reject) => {
    const all = [];
    const readBatch = () => {
      dirReader.readEntries((entries) => {
        if (!entries || entries.length === 0) {
          resolve(all);
        } else {
          all.push(...entries);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });

  const walkEntry = async (entry, relPrefix, depth) => {
    if (!entry) return;
    if (entry.isFile) {
      if (collected.length >= maxFiles + 10) {
        skipped.push({
          name: `${relPrefix}${entry.name}`,
          reason: `Maksimum dosya sınırı aşıldı (en fazla ${maxFiles}).`,
        });
        return;
      }
      const file = await readFileEntry(entry);
      const relPath = `${relPrefix}${entry.name}`;
      collected.push({
        file,
        name: file.name || entry.name,
        relativePath: relPath,
        size: file.size,
        depth,
      });
      return;
    }

    if (entry.isDirectory) {
      if (ignoreDirs.has(entry.name)) return;
      if (depth >= maxDepth) {
        skipped.push({
          name: `${relPrefix}${entry.name}/`,
          reason: `Klasör derinliği sınırı aşıldı (en fazla ${maxDepth}).`,
        });
        return;
      }
      const reader = entry.createReader();
      const children = await readAllDirectoryEntries(reader);
      for (const child of children) {
        await walkEntry(child, `${relPrefix}${entry.name}/`, depth + 1);
      }
    }
  };

  let sawDirectory = false;
  try {
    const rootEntries = items.map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
    if (rootEntries.length === 0 && rawFiles.length > 0) {
      return {
        folderFallbackRequired: false,
        files: rawFiles.map((f) => ({ file: f, name: f.name, relativePath: f.name, size: f.size, depth: 0 })),
      };
    }
    for (const rootEntry of rootEntries) {
      if (rootEntry.isDirectory) sawDirectory = true;
      await walkEntry(rootEntry, '', 0);
    }
    if (sawDirectory && collected.length === 0 && skipped.length === 0) {
      return { folderFallbackRequired: true, files: [] };
    }
    return { folderFallbackRequired: false, files: collected, skipped, isFolder: sawDirectory };
  } catch (err) {
    console.warn('[CraftImport] Sürüklenen klasör okunamadı, yedek dosya moduna düşüldü:', err);
    if (sawDirectory) {
      return { folderFallbackRequired: true, files: [] };
    }
    return {
      folderFallbackRequired: false,
      files: rawFiles.map((f) => ({ file: f, name: f.name, relativePath: f.name, size: f.size, depth: 0 })),
    };
  }
}

/**
 * #/ice-aktar rotasında görüntülenen özel İçe Aktar çalışma alanı.
 */
export default function WelcomeImportPage({
  importState,
  onPickFiles,
  onPickFolder,
  onRunDroppedSource,
  onCancelImport,
  onResetReport,
  onOpenImportedInEditor,
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dropWarning, setDropWarning] = useState(null);
  const dragDepthRef = useRef(0);

  const isRunning = importState.status === 'running';
  const hasReport = importState.status === 'success' || importState.status === 'error';
  const progress = importState.progress || { step: 'okunuyor', current: 0, total: 1 };
  const progressPct = progress.total > 0
    ? Math.min(100, Math.max(8, Math.round((progress.current / progress.total) * 100)))
    : 20;

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setDropWarning(null);
    if (isRunning) return;

    const extracted = await collectDroppedFilesWithEntries(e.dataTransfer);
    if (extracted.folderFallbackRequired) {
      setDropWarning('Bu tarayıcıda klasör sürükle-bırak okunamadı. Lütfen aşağıdaki "Klasör Seç" düğmesini kullanın.');
      return;
    }
    if (!extracted.files || extracted.files.length === 0) {
      if (extracted.skipped && extracted.skipped.length > 0) {
        onRunDroppedSource({ kind: 'files', files: [], skipped: extracted.skipped, isFolder: true });
        return;
      }
      setDropWarning('Bırakılan öğeler arasında okunabilir bir dosya bulunamadı. Klasörler için "Klasör Seç" düğmesini kullanabilirsiniz.');
      return;
    }

    onRunDroppedSource({
      kind: 'files',
      files: extracted.files,
      skipped: extracted.skipped || [],
      isFolder: Boolean(extracted.isFolder || extracted.files.length > 1),
    });
  };

  const report = importState.report || { files: [], nodes: 0, pages: 0, warnings: [], skipped: [] };

  return (
    <section className="import-page" aria-label="Site veya Proje İçe Aktar">
      {/* Ekran okuyucu canlı bildirim bölgeleri */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-import-live-polite>
        {importState.livePolite || ''}
      </div>
      {importState.status === 'error' && (
        <div className="sr-only" aria-live="assertive" aria-atomic="true" data-import-live-assertive>
          {importState.error?.message || ''}
        </div>
      )}

      {/* Spotlight Sürükle-Bırak Sahnesi */}
      <div
        data-import-dropzone
        className={`import-dropzone ${isDragActive ? 'import-dropzone--active' : ''} ${isRunning ? 'import-dropzone--busy' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="welcome-hero__glow" aria-hidden="true" />
        <div className="welcome-hero__grid" aria-hidden="true" />

        <div className="import-dropzone__content">
          <span className="welcome-hero__kicker-pill">
            <Upload size={11} strokeWidth={2.3} aria-hidden="true" />
            <span>KOD & PROJE AKTARIMI</span>
          </span>

          {/* Görsel Kod -> Tuval İllüstrasyonu */}
          <div className="import-visual-bridge" aria-hidden="true">
            <div className="import-visual-bridge__code">
              <span className="l-blue" />
              <span className="l-purple" />
              <span className="l-green" />
            </div>
            <span className="import-visual-bridge__arrow">→</span>
            <div className="import-visual-bridge__canvas">
              <span className="c-head" />
              <div className="c-grid">
                <i />
                <i />
              </div>
            </div>
          </div>

          <h1 className="import-dropzone__heading">
            {isDragActive ? (
              'Bırakarak içe aktarın'
            ) : (
              <>
                Kodunu bırak, <span className="welcome-hero__title-accent">tuvale dönüşsün.</span>
              </>
            )}
          </h1>

          <div className="import-dropzone__chips" aria-label="Desteklenen dosya biçimleri">
            {SUPPORTED_FORMATS.map((fmt) => (
              <span key={fmt} className="import-format-chip">
                {fmt}
              </span>
            ))}
          </div>

          <div className="import-dropzone__actions">
            <button
              type="button"
              className="import-btn-primary"
              disabled={isRunning}
              onClick={onPickFiles}
              data-import-pick-file
            >
              <FileCode2 size={16} aria-hidden="true" />
              <span>Dosya Seç</span>
            </button>

            <button
              type="button"
              className="import-btn-secondary"
              disabled={isRunning}
              onClick={onPickFolder}
              data-import-pick-folder
            >
              <FolderOpen size={16} aria-hidden="true" />
              <span>Klasör Seç</span>
            </button>
          </div>
        </div>
      </div>

      {dropWarning && (
        <div role="alert" className="import-report-card import-report-card--error">
          <p className="import-report-card__error-msg">{dropWarning}</p>
        </div>
      )}

      {/* İlerleme Durumu */}
      {isRunning && (
        <div className="import-progress-card" data-import-progress>
          <div className="import-progress-card__top">
            <span className="import-progress-card__step">
              <Loader2 size={16} aria-hidden="true" />
              <span>{STEP_LABELS[progress.step] || 'İşleniyor'}</span>
            </span>
            <span className="import-progress-card__count">
              {progress.current} / {Math.max(1, progress.total)}
            </span>
          </div>
          <div
            className="import-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label="İçe aktarma ilerlemesi"
          >
            <div className="import-progress-bar__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="import-report-card__actions">
            <button
              type="button"
              className="import-btn-secondary"
              onClick={onCancelImport}
              data-import-cancel
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* İçe Aktarma Raporu */}
      {hasReport && (
        <div
          data-import-report
          data-import-status={importState.status}
          className={`import-report-card ${importState.status === 'success' ? 'import-report-card--success' : 'import-report-card--error'}`}
          role="region"
          aria-label="İçe Aktarma Raporu"
        >
          <div className="import-report-card__header">
            <div className="import-report-card__title-row">
              {importState.status === 'success' ? (
                <CheckCircle2 size={20} className="import-report-card__status-icon--success" aria-hidden="true" />
              ) : (
                <XCircle size={20} className="import-report-card__status-icon--error" aria-hidden="true" />
              )}
              <div>
                <h3 className="import-report-card__title">
                  {importState.status === 'success' ? 'İçe Aktarma Raporu' : 'İçe Aktarma Başarısız'}
                </h3>
                <p className="import-report-card__summary" data-import-summary>
                  {report.files.length} dosya · {report.nodes} bileşen · {report.pages} sayfa
                </p>
              </div>
            </div>
          </div>

          {importState.status === 'error' && importState.error?.message && (
            <p className="import-report-card__error-msg" role="alert" data-import-report-error>
              {importState.error.message}
            </p>
          )}

          {report.files.length > 0 && (
            <div className="import-report-section">
              <p className="import-report-section__label">İşlenen Dosyalar ({report.files.length})</p>
              <div className="import-report-files">
                {report.files.slice(0, 12).map((f, idx) => (
                  <span key={`${f.relativePath || f.name}-${idx}`} className="import-file-pill">
                    {f.relativePath || f.name}
                  </span>
                ))}
                {report.files.length > 12 && (
                  <span className="import-file-pill">+{report.files.length - 12} dosya daha</span>
                )}
              </div>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="import-report-section">
              <p className="import-report-section__label">Uyarılar ve Güvenlik Temizliği ({report.warnings.length})</p>
              <ul className="import-report-list">
                {report.warnings.map((w, idx) => (
                  <li key={idx} className="import-report-list__item import-report-list__item--warn">
                    <AlertTriangle size={14} aria-hidden="true" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.skipped.length > 0 && (
            <div className="import-report-section">
              <p className="import-report-section__label">Atlanan Dosyalar ({report.skipped.length})</p>
              <ul className="import-report-list">
                {report.skipped.slice(0, 15).map((s, idx) => (
                  <li key={idx} className="import-report-list__item">
                    <span>{s.name}</span>
                    <span>—</span>
                    <span>{s.reason}</span>
                  </li>
                ))}
                {report.skipped.length > 15 && (
                  <li className="import-report-list__item">
                    <span>+{report.skipped.length - 15} ek atlanan dosya</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="import-report-card__actions">
            {importState.status === 'error' ? (
              <button
                type="button"
                className="import-btn-primary"
                onClick={onResetReport}
                data-import-retry
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>Tekrar dene</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="import-btn-secondary"
                  onClick={onResetReport}
                  data-import-cancel-report
                >
                  İptal
                </button>
                <button
                  type="button"
                  className="import-btn-primary"
                  onClick={onOpenImportedInEditor}
                  data-import-open-editor
                >
                  <span>Düzenleyicide Aç</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3 Görsel Biçim Kartı */}
      <div className="import-format-grid" aria-hidden="true">
        <div className="import-format-card">
          <div className="import-format-card__visual import-format-card__visual--orange">
            <span className="import-format-card__tag">&lt;html&gt;</span>
          </div>
          <div className="import-format-card__meta">
            <strong>HTML5 Sayfaları</strong>
            <span>.html · .htm</span>
          </div>
        </div>

        <div className="import-format-card">
          <div className="import-format-card__visual import-format-card__visual--blue">
            <span className="import-format-card__tag">&lt;App /&gt;</span>
          </div>
          <div className="import-format-card__meta">
            <strong>React Bileşenleri</strong>
            <span>.jsx · .tsx</span>
          </div>
        </div>

        <div className="import-format-card">
          <div className="import-format-card__visual import-format-card__visual--purple">
            <span className="import-format-card__tag">Cs JSON</span>
          </div>
          <div className="import-format-card__meta">
            <strong>Stüdyo Projeleri</strong>
            <span>.craft.json</span>
          </div>
        </div>
      </div>

      {/* Bilinen Sınırlar Sabit Bilgi Kutusu */}
      <aside className="import-limits-box" data-import-limitations aria-label="Bilinen sınırlar">
        <Info size={16} className="import-limits-box__icon" aria-hidden="true" />
        <p className="import-limits-box__text">
          <strong>Bilinen sınırlar:</strong> Esnek (flex/grid) düzenler tuvale konumlu katmanlar olarak aktarılır.
        </p>
      </aside>
    </section>
  );
}
