import React from 'react';
import { Monitor, Tablet, Smartphone, Info } from 'lucide-react';
import { updateSettings } from '../../settings/settingsStore';

const DEVICE_CHOICES = [
  {
    id: 'desktop',
    label: 'Masaüstü',
    detail: '1280 × 1350 px',
    supported: true,
    icon: Monitor,
  },
  {
    id: 'tablet',
    label: 'Tablet',
    detail: 'Yakında',
    supported: false,
    icon: Tablet,
  },
  {
    id: 'mobile',
    label: 'Mobil',
    detail: '375 × 1200 px',
    supported: true,
    icon: Smartphone,
  },
];

/**
 * Genel sekmesi: Yeni projeler için varsayılan başlangıç cihaz boyutu.
 * Karşılama ekranındaki seçiciyle iki yönlü senkronizedir.
 */
export default function SettingsGeneralTab({ settings }) {
  const activeDevice = settings?.defaultDevice || 'desktop';

  return (
    <div className="wl-settings-panel">
      <div className="wl-settings-section">
        <h3 className="wl-settings-section__title">Varsayılan Başlangıç Cihazı</h3>
        <p className="wl-settings-section__desc">
          "Boş Tuval" kartındaki cihaz seçiciyle eş zamanlı çalışır.
        </p>

        <div className="wl-settings-device-grid" role="group" aria-label="Varsayılan başlangıç cihaz boyutu">
          {DEVICE_CHOICES.map((opt) => {
            const Icon = opt.icon;
            const isSelected = activeDevice === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`wl-settings-choice-card ${isSelected ? 'wl-settings-choice-card--active' : ''}`}
                aria-pressed={opt.supported ? isSelected : undefined}
                disabled={!opt.supported}
                title={opt.supported ? opt.detail : 'Tablet şablonu henüz desteklenmiyor'}
                onClick={() => opt.supported && updateSettings({ defaultDevice: opt.id })}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span className="wl-settings-choice-card__label">{opt.label}</span>
                <span className="wl-settings-choice-card__meta">{opt.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wl-settings-privacy">
        <Info size={16} aria-hidden="true" />
        <p>
          Editörde yapılan değişiklikler otomatik kurtarma taslağı olarak yerel depolamada
          korunur; kaydettiğiniz projeleri kaybetmemek için Ctrl+S kısayolunu kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
