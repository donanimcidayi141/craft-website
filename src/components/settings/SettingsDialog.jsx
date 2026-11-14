import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Sliders, Palette, Database, Info, X, AlertCircle } from 'lucide-react';
import SettingsAiTab from './SettingsAiTab';
import SettingsGeneralTab from './SettingsGeneralTab';
import SettingsAppearanceTab from './SettingsAppearanceTab';
import SettingsDataTab from './SettingsDataTab';
import SettingsAboutTab from './SettingsAboutTab';

const SETTINGS_TABS = [
  { id: 'ai', label: 'Yapay Zeka', icon: KeyRound },
  { id: 'general', label: 'Genel', icon: Sliders },
  { id: 'appearance', label: 'Görünüm', icon: Palette },
  { id: 'data', label: 'Veri', icon: Database },
  { id: 'about', label: 'Hakkında', icon: Info },
];

function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * CraftStudio Ayarlar Penceresi (~880×560).
 * - Odak tuzağı ve kapanışta tetikleyiciye odak iadesi sağlar.
 * - Kaydedilmemiş API anahtarı değişikliği varken Esc/dış tıklamayla doğrudan kapanmaz; onay ister.
 * - "Dışa Aktarma" sekmesi envanterde kalıcı ayar karşılığı bulunmadığı için gizlenmiştir.
 */
export default function SettingsDialog({
  isOpen,
  initialTab = 'ai',
  contextNote = null,
  settings,
  aiChat,
  onDismissAutosave,
  onClearRecentListUi,
  onClearApiKeyUi,
  onStatusToast,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isAiKeyDirty, setIsAiKeyDirty] = useState(false);
  const [showUnsavedGuard, setShowUnsavedGuard] = useState(false);

  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const activeTabMeta = SETTINGS_TABS.find((t) => t.id === activeTab) || SETTINGS_TABS[0];

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab || 'ai');
    setShowUnsavedGuard(false);
    setIsAiKeyDirty(false);
    previousFocusRef.current = document.activeElement;

    const timer = requestAnimationFrame(() => {
      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    });

    return () => {
      cancelAnimationFrame(timer);
    };
  }, [isOpen, initialTab]);

  const handleCloseConfirmed = () => {
    setShowUnsavedGuard(false);
    setIsAiKeyDirty(false);
    onClose?.();
    requestAnimationFrame(() => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    });
  };

  const requestClose = () => {
    if (isAiKeyDirty) {
      setShowUnsavedGuard(true);
      return;
    }
    handleCloseConfirmed();
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isAiKeyDirty]);

  if (!isOpen) return null;

  return (
    <div
      className="wl-settings-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="wl-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
      >
        {/* Sol 200px Sekme Listesi */}
        <aside className="wl-settings-sidebar">
          <div className="wl-settings-sidebar__head">
            <h2 id="settings-dialog-title" className="wl-settings-dialog__title">
              Ayarlar
            </h2>
          </div>

          <nav
            className="wl-settings-tablist"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Ayar Kategorileri"
          >
            {SETTINGS_TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`settings-tabpanel-${tab.id}`}
                  className="wl-settings-tab"
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = SETTINGS_TABS[(idx + 1) % SETTINGS_TABS.length];
                      setActiveTab(next.id);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prev = SETTINGS_TABS[(idx - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length];
                      setActiveTab(prev.id);
                    }
                  }}
                >
                  <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Sağ İçerik Alanı */}
        <div className="wl-settings-content">
          <header className="wl-settings-content__head">
            <h3 className="wl-settings-content__title">{activeTabMeta.label}</h3>
            <button
              type="button"
              className="welcome-modal-dialog__close"
              aria-label="Ayarları kapat"
              onClick={requestClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          {showUnsavedGuard && (
            <div className="wl-settings-guard" role="alert">
              <div className="wl-settings-guard__msg">
                <AlertCircle size={15} aria-hidden="true" />
                <span>Kaydedilmemiş değişiklik var. Değişiklikleri kaydetmeden çıkmak istiyor musunuz?</span>
              </div>
              <div className="wl-settings-guard__actions">
                <button
                  type="button"
                  className="welcome-btn welcome-btn--ghost"
                  onClick={() => setShowUnsavedGuard(false)}
                >
                  Kal
                </button>
                <button
                  type="button"
                  className="welcome-btn wl-btn-danger-solid"
                  onClick={handleCloseConfirmed}
                >
                  Kaydetmeden Çık
                </button>
              </div>
            </div>
          )}

          {contextNote && activeTab === 'ai' && (
            <p className="wl-settings-context-note" role="status">
              {contextNote}
            </p>
          )}

          <div
            id={`settings-tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
            className="wl-settings-content__scroll"
          >
            {activeTab === 'ai' && (
              <SettingsAiTab
                settings={settings}
                aiChat={aiChat}
                onDirtyChange={setIsAiKeyDirty}
                onStatusToast={onStatusToast}
              />
            )}

            {activeTab === 'general' && (
              <SettingsGeneralTab settings={settings} />
            )}

            {activeTab === 'appearance' && (
              <SettingsAppearanceTab settings={settings} />
            )}

            {activeTab === 'data' && (
              <SettingsDataTab
                onDismissAutosave={onDismissAutosave}
                onClearRecentListUi={onClearRecentListUi}
                onClearApiKeyUi={onClearApiKeyUi}
              />
            )}

            {activeTab === 'about' && <SettingsAboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
