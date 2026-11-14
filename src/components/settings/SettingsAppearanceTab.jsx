import React from 'react';
import { updateSettings } from '../../settings/settingsStore';

/**
 * Görünüm sekmesi: Sağ üst renk alanı görünürlüğü ve hareket azaltma tercihi.
 */
export default function SettingsAppearanceTab({ settings }) {
  const showAmbientBg = settings?.showAmbientBg !== false;
  const reduceMotion = Boolean(settings?.reduceMotion);
  const osReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="wl-settings-panel">
      <div className="wl-settings-switch-row">
        <div className="wl-settings-switch-row__copy">
          <span className="wl-settings-section__title">Renk alanını göster</span>
          <span className="wl-settings-section__desc">
            Karşılama ekranının sağ üstündeki atmosferik renk gradyanını ve varsa kahraman görselini gösterir.
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showAmbientBg}
          aria-label="Renk alanını göster"
          className={`wl-switch ${showAmbientBg ? 'wl-switch--on' : ''}`}
          onClick={() => updateSettings({ showAmbientBg: !showAmbientBg })}
        >
          <span className="wl-switch__thumb" />
        </button>
      </div>

      <div className="wl-settings-switch-row">
        <div className="wl-settings-switch-row__copy">
          <span className="wl-settings-section__title">Hareketi azalt</span>
          <span className="wl-settings-section__desc">
            Geçiş efektlerini ve yumuşak kaydırmayı kapatır.{' '}
            {osReducedMotion ? '(İşletim sistemi "Hareketi azalt" tercihi de etkin.)' : ''}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={reduceMotion || osReducedMotion}
          aria-label="Hareketi azalt"
          className={`wl-switch ${reduceMotion || osReducedMotion ? 'wl-switch--on' : ''}`}
          onClick={() => updateSettings({ reduceMotion: !reduceMotion })}
        >
          <span className="wl-switch__thumb" />
        </button>
      </div>
    </div>
  );
}
