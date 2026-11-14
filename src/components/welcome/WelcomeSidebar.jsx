import React from 'react';
import {
  Home,
  FolderKanban,
  LayoutTemplate,
  Upload,
  Settings,
  Sparkles,
} from 'lucide-react';

export default function WelcomeSidebar({
  activeNav,
  onSelectNav,
  onOpenImport,
  onOpenSettings,
  onQuickCreate,
  isAiConnected = false,
  selectedModelLabel = 'Gemini',
  recentCount = 0,
  hasAutosave = false,
}) {
  const totalProjectCount = recentCount + (hasAutosave ? 1 : 0);
  const navItems = [
    {
      id: 'home',
      label: 'Ana Sayfa',
      icon: Home,
      onClick: () => onSelectNav('home'),
    },
    {
      id: 'projects',
      label: 'Projelerim',
      icon: FolderKanban,
      badge: totalProjectCount > 0 ? String(totalProjectCount) : null,
      hasNotif: hasAutosave,
      onClick: () => onSelectNav('projects'),
    },
    {
      id: 'templates',
      label: 'Şablon & Bloklar',
      icon: LayoutTemplate,
      badge: '22',
      onClick: () => onSelectNav('templates'),
    },
    {
      id: 'import',
      label: 'İçe Aktar',
      icon: Upload,
      onClick: onOpenImport,
    },
  ];

  return (
    <aside className="welcome-sidebar" aria-label="Karşılama Menüsü">
      <div className="welcome-sidebar__top">
        <div className="welcome-brand">
          <span className="welcome-brand__cs-tile" aria-hidden="true">
            <span className="welcome-brand__cs-letters">Cs</span>
          </span>
          <div className="welcome-brand__meta">
            <div className="welcome-brand__title-row">
              <span className="welcome-brand__title">CraftStudio</span>
              <span className="welcome-brand__version">PRO</span>
            </div>
            <span className="welcome-brand__sub">CREATIVE SUITE</span>
          </div>
        </div>

        {onQuickCreate && (
          <button
            type="button"
            className="welcome-sidebar__cta"
            onClick={onQuickCreate}
          >
            <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Yeni Site Kurgula</span>
          </button>
        )}

        <nav className="welcome-nav" aria-label="Bölüm Gezinmesi">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="welcome-nav__btn"
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                onClick={item.onClick}
              >
                <span className="welcome-nav__icon-wrap" aria-hidden="true">
                  <Icon size={16} strokeWidth={1.9} />
                  {item.hasNotif && (
                    <span className="welcome-nav__notif-dot" title="Kaydedilmemiş taslak bildirimi" />
                  )}
                </span>
                <span className="welcome-nav__label">{item.label}</span>
                {item.badge && (
                  <span className={`welcome-nav__badge ${item.hasNotif ? 'welcome-nav__badge--warn' : 'welcome-nav__badge--muted'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="welcome-sidebar__bottom">
        <button
          type="button"
          className="welcome-settings-btn"
          onClick={onOpenSettings}
          title="Stüdyo & AI Ayarları (Ctrl+,)"
          aria-label={`Ayarlar — ${isAiConnected ? 'Gemini bağlı' : 'Gemini anahtarı yok'}`}
        >
          <span className="welcome-settings-btn__label">
            <Settings size={15} strokeWidth={1.9} aria-hidden="true" />
            <span className="welcome-settings-btn__text">Ayarlar · {selectedModelLabel}</span>
          </span>
          <span
            className={`welcome-status-dot ${isAiConnected ? 'welcome-status-dot--connected' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
