import React, { useState } from 'react';
import {
  ChevronRight,
  FolderOpen,
  Plus,
  Trash2,
  Search,
  Sparkles,
  ArrowUpRight,
  FolderKanban,
  RotateCcw,
  Clock,
  FileCode2,
  Save,
} from 'lucide-react';
import { formatSavedDateLabel } from '../../utils/projectStorage';

const HOME_ROW_LIMIT = 5;

function getCoverIndex(project) {
  const source = String(project?.id || project?.name || 'craft');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 4;
}

function formatRealProjectMeta(project) {
  return formatSavedDateLabel(project?.updatedAt || project?.savedAt || project?.date);
}

export default function WelcomeRecentProjects({
  recentProjects = [],
  autosaveDraft = null,
  onRestoreAutosave = null,
  onSaveAutosave = null,
  onDismissAutosave = null,
  fullPageMode = false,
  onOpenRecentProject,
  onSaveRecentProject = null,
  onDeleteRecentProject,
  onStartBlankProject,
  onExploreTemplates,
  onViewAllProjects,
}) {
  const realItems = Array.isArray(recentProjects) ? recentProjects : [];
  const hasDraft = Boolean(
    autosaveDraft &&
      typeof autosaveDraft === 'object' &&
      (Array.isArray(autosaveDraft.tabs) || Array.isArray(autosaveDraft.elements))
  );

  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const cleanQuery = searchQuery.trim().toLowerCase();

  const matchesDraft =
    hasDraft &&
    (!cleanQuery ||
      String(autosaveDraft.name || 'Adsız Çalışma')
        .toLowerCase()
        .includes(cleanQuery));

  const filteredRealItems = cleanQuery
    ? realItems.filter((item) =>
        String(item.name || '')
          .toLowerCase()
          .includes(cleanQuery)
      )
    : realItems;

  const totalCount = realItems.length + (hasDraft ? 1 : 0);
  const hasMoreThanLimit = !fullPageMode && filteredRealItems.length > HOME_ROW_LIMIT;
  const visibleRealItems =
    fullPageMode || showAll
      ? filteredRealItems
      : filteredRealItems.slice(0, HOME_ROW_LIMIT);

  const isEmpty = !matchesDraft && visibleRealItems.length === 0;

  return (
    <section
      id="welcome-recent"
      className="welcome-section"
      aria-labelledby="welcome-recent-heading"
    >
      {fullPageMode ? (
        <div className="welcome-page-spotlight welcome-page-spotlight--projects">
          <div className="welcome-hero__glow" aria-hidden="true" />
          <div className="welcome-hero__grid" aria-hidden="true" />

          <div className="welcome-page-spotlight__inner">
            <div className="welcome-page-spotlight__copy">
              <span className="welcome-hero__kicker-pill">
                <FolderKanban size={11} strokeWidth={2.3} aria-hidden="true" />
                <span>PROJE STÜDYOSU</span>
              </span>
              <h1 id="welcome-recent-heading" className="welcome-page-spotlight__title">
                Son Projelerim, <span className="welcome-hero__title-accent">her an hazır.</span>
              </h1>
            </div>

            <div className="welcome-page-spotlight__controls">
              {hasDraft && (
                <span className="welcome-draft-notif-badge">
                  <i className="welcome-draft-notif-badge__dot" aria-hidden="true" />
                  <span>1 Kaydedilmemiş Taslak</span>
                </span>
              )}

              <div className="welcome-search-box welcome-search-box--glass">
                <Search size={14} className="welcome-search-box__icon" aria-hidden="true" />
                <input
                  type="search"
                  className="welcome-search-box__input"
                  placeholder="Projelerde ara..."
                  aria-label="Projelerde ara"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="welcome-btn welcome-btn--primary-white"
                onClick={onStartBlankProject}
              >
                <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                <span>Yeni Proje</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="welcome-section__head welcome-section__head--wrap">
          <div className="welcome-section__title-group">
            <h2 id="welcome-recent-heading" className="welcome-section__title">
              Son Projelerim
            </h2>
            <span className="welcome-section__count-pill">{totalCount}</span>
            {hasDraft && (
              <span className="welcome-draft-notif-badge">
                <i className="welcome-draft-notif-badge__dot" aria-hidden="true" />
                <span>Kaydedilmemiş Taslak Var</span>
              </span>
            )}
          </div>

          <div className="welcome-section__controls">
            {hasMoreThanLimit && (
              <button
                type="button"
                className="welcome-section__link"
                onClick={() => setShowAll((prev) => !prev)}
              >
                <span>{showAll ? 'Daralt' : 'Tümünü Göster'}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}

            {onViewAllProjects && totalCount > 0 && (
              <button
                type="button"
                className="welcome-section__link"
                onClick={onViewAllProjects}
              >
                <span>Projelerim Sekmesi</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="welcome-empty-strip">
          <div className="welcome-empty-strip__left">
            <span className="welcome-empty-strip__icon" aria-hidden="true">
              <FolderOpen size={18} strokeWidth={1.8} />
            </span>
            <div className="welcome-empty-strip__copy">
              <p className="welcome-empty-strip__title">
                {cleanQuery
                  ? 'Aramana uygun bir proje bulunamadı'
                  : 'Henüz kayıtlı projen veya açık taslağın yok'}
              </p>
              <p className="welcome-empty-strip__desc">
                Yeni bir boş tuval açabilir veya hazır şablonlardan birini seçerek hemen başlayabilirsin.
              </p>
            </div>
          </div>

          <div className="welcome-empty-strip__actions">
            {onExploreTemplates && (
              <button
                type="button"
                className="welcome-btn welcome-btn--ghost"
                onClick={onExploreTemplates}
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>Şablonlara Göz At</span>
              </button>
            )}

            <button
              type="button"
              className="welcome-btn welcome-btn--primary-white"
              onClick={onStartBlankProject}
            >
              <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Yeni Boş Tuval</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="welcome-project-list" role="list">
          {/* 1. KAYDEDİLMEMİŞ TASLAK SATIRI (Varsa en üstte bildirim rozetiyle gösterilir) */}
          {matchesDraft && onRestoreAutosave && (
            <article
              role="listitem"
              className="welcome-project-row welcome-project-row--draft"
              aria-label="Kaydedilmemiş taslak"
            >
              <div
                className="welcome-project-row__main"
                onClick={() => onRestoreAutosave(autosaveDraft)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRestoreAutosave(autosaveDraft);
                  }
                }}
              >
                <div className="welcome-project-row__thumb welcome-project-row__thumb--draft" aria-hidden="true">
                  <RotateCcw size={18} strokeWidth={2.1} />
                  <span className="welcome-project-row__ping" />
                </div>

                <div className="welcome-project-row__info">
                  <div className="welcome-project-row__title-line">
                    <span className="welcome-project-row__name">
                      {autosaveDraft.name || 'Adsız Çalışma'}
                    </span>
                    <span className="welcome-project-row__badge welcome-project-row__badge--draft">
                      <i className="welcome-draft-notif-badge__dot" aria-hidden="true" />
                      <span>Kaydedilmemiş Taslak</span>
                    </span>
                  </div>

                  <div className="welcome-project-row__meta-line">
                    <span className="welcome-project-row__meta-item">
                      <Clock size={11} aria-hidden="true" />
                      <span>{formatRealProjectMeta(autosaveDraft)}</span>
                    </span>
                    <span className="welcome-project-row__sep">·</span>
                    <span className="welcome-project-row__meta-item">
                      {Array.isArray(autosaveDraft.tabs)
                        ? `${autosaveDraft.tabs.length} Sayfa Sekmesi`
                        : 'Otomatik Yedeklendi'}
                    </span>
                    <span className="welcome-project-row__sep">·</span>
                    <span className="welcome-project-row__meta-highlight">
                      Kaldığın yerden devam etmeye hazır
                    </span>
                  </div>
                </div>
              </div>

              <div className="welcome-project-row__actions">
                <button
                  type="button"
                  className="welcome-row-btn welcome-row-btn--save"
                  title="Taslağı doğrudan kaydet"
                  onClick={() =>
                    onSaveAutosave
                      ? onSaveAutosave(autosaveDraft)
                      : onRestoreAutosave(autosaveDraft)
                  }
                >
                  <Save size={13} strokeWidth={2.2} aria-hidden="true" />
                  <span>Kaydet</span>
                </button>

                <button
                  type="button"
                  className="welcome-row-btn welcome-row-btn--icon-open"
                  aria-label="Taslağı tuvalde aç"
                  title="Tuvalde Aç"
                  onClick={() => onRestoreAutosave(autosaveDraft)}
                >
                  <ArrowUpRight size={16} strokeWidth={2.3} aria-hidden="true" />
                </button>

                {onDismissAutosave && (
                  <button
                    type="button"
                    className="welcome-row-btn welcome-row-btn--delete"
                    aria-label="Kaydedilmemiş taslağı sil"
                    title="Taslağı Sil"
                    onClick={onDismissAutosave}
                  >
                    <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          )}

          {/* 2. KAYITLI PROJELER (Satır Satır Liste) */}
          {visibleRealItems.map((project, index) => {
            const coverVariant = getCoverIndex(project);
            const monogram = String(project.name || 'P').trim().charAt(0).toUpperCase() || 'P';
            const tabCount =
              Number(project.tabsCount) ||
              Number(project.tabCount) ||
              (Array.isArray(project.tabs) ? project.tabs.length : 1);

            return (
              <article
                key={project.id}
                role="listitem"
                className="welcome-project-row"
              >
                <div
                  className="welcome-project-row__main"
                  onClick={() => onOpenRecentProject?.(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenRecentProject?.(project);
                    }
                  }}
                >
                  <div className="welcome-project-row__thumb" aria-hidden="true">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className={`welcome-cover welcome-cover--${coverVariant} welcome-cover--mini`}>
                        <span className="welcome-cover__letter">{monogram}</span>
                      </div>
                    )}
                  </div>

                  <div className="welcome-project-row__info">
                    <div className="welcome-project-row__title-line">
                      <span className="welcome-project-row__name">{project.name}</span>
                      {index === 0 && (
                        <span className="welcome-project-row__badge welcome-project-row__badge--latest">
                          Son Çalışma
                        </span>
                      )}
                    </div>

                    <div className="welcome-project-row__meta-line">
                      <span className="welcome-project-row__meta-item">
                        <Clock size={11} aria-hidden="true" />
                        <span>{formatRealProjectMeta(project)}</span>
                      </span>
                      <span className="welcome-project-row__sep">·</span>
                      <span className="welcome-project-row__meta-item">
                        <FileCode2 size={11} aria-hidden="true" />
                        <span>{tabCount} Sayfa</span>
                      </span>
                      <span className="welcome-project-row__sep">·</span>
                      <span className="welcome-project-row__meta-item">CraftStudio Projesi</span>
                    </div>
                  </div>
                </div>

                <div className="welcome-project-row__actions">
                  {onSaveRecentProject && (
                    <button
                      type="button"
                      className="welcome-row-btn welcome-row-btn--save-ghost"
                      aria-label={`${project.name} projesini kaydet`}
                      title="Projeyi Kaydet (.craft.json)"
                      onClick={() => onSaveRecentProject(project)}
                    >
                      <Save size={13} strokeWidth={2} aria-hidden="true" />
                      <span>Kaydet</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="welcome-row-btn welcome-row-btn--icon-open"
                    aria-label={`${project.name} projesini tuvalde aç`}
                    title="Tuvalde Aç"
                    onClick={() => onOpenRecentProject?.(project)}
                  >
                    <ArrowUpRight size={16} strokeWidth={2.3} aria-hidden="true" />
                  </button>

                  {onDeleteRecentProject && (
                    <button
                      type="button"
                      className="welcome-row-btn welcome-row-btn--delete"
                      aria-label={`${project.name} projesini sil`}
                      title="Projeyi Sil"
                      onClick={() => onDeleteRecentProject(project.id)}
                    >
                      <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
