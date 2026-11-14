import React from 'react';
import { FolderOpen, Folder, Plus } from 'lucide-react';

/**
 * Sadeleştirilmiş üst eylem çubuğu.
 */
export default function WelcomeTopBar({
  scrolled = false,
  onOpenSiteOrFile,
  onOpenFolder,
  onNewBlankProject,
}) {
  return (
    <header
      className={`welcome-topbar ${scrolled ? 'welcome-topbar--scrolled' : ''}`}
      aria-label="Proje İşlemleri"
    >
      <div className="welcome-topbar__inner">
        <div className="welcome-topbar__left" />

        <div className="welcome-topbar__actions">
          <button
            type="button"
            className="welcome-btn welcome-btn--ghost"
            onClick={onOpenSiteOrFile}
            title="HTML, JSX, TSX veya .craft.json dosyası aç (Ctrl+O)"
          >
            <FolderOpen size={15} strokeWidth={1.9} aria-hidden="true" />
            <span>Dosya Aç</span>
          </button>

          <button
            type="button"
            className="welcome-btn welcome-btn--ghost"
            onClick={onOpenFolder}
            title="Klasör içe aktar (Ctrl+Shift+O)"
          >
            <Folder size={15} strokeWidth={1.9} aria-hidden="true" />
            <span>Klasör Aç</span>
          </button>

          <button
            type="button"
            className="welcome-btn welcome-btn--primary-white"
            onClick={onNewBlankProject}
            title="Boş tuval başlat (Ctrl+Shift+N)"
          >
            <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
            <span>Yeni Tuval</span>
          </button>
        </div>
      </div>
    </header>
  );
}
