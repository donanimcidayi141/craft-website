import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Trash2, FileX } from 'lucide-react';
import {
  clearRecentProjectsList,
  discardAutosaveDraft,
  resetLocalSettings,
} from '../../settings/settingsStore';

/**
 * Veri sekmesi: Tüm yıkıcı işlemler iki adımlı ("Emin misin?" 4 sn) onay kullanır.
 * Son proje listesini temizlemek kayıtlı projeleri SİLMEZ.
 */
export default function SettingsDataTab({
  onDismissAutosave,
  onClearRecentListUi,
  onClearApiKeyUi,
}) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [alsoClearApiKey, setAlsoClearApiKey] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const requestConfirmOrRun = (actionId, runFn) => {
    if (confirmAction !== actionId) {
      setConfirmAction(actionId);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmAction(null), 4000);
      return;
    }

    setConfirmAction(null);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    runFn();
  };

  const handleDiscardDraft = () => {
    discardAutosaveDraft();
    onDismissAutosave?.();
    setActionResult('Kayıtsız otomatik taslak temizlendi. Kayıtlı projeleriniz korundu.');
  };

  const handleClearRecentList = () => {
    clearRecentProjectsList();
    onClearRecentListUi?.();
    setActionResult('Son projeler listesi temizlendi. Kayıtlı proje dosyalarınız silinmedi.');
  };

  const handleResetSettings = () => {
    resetLocalSettings(undefined, { includeApiKey: alsoClearApiKey });
    if (alsoClearApiKey) {
      onClearApiKeyUi?.();
    }
    setAlsoClearApiKey(false);
    setActionResult(
      alsoClearApiKey
        ? 'Yerel ayarlar (craftstudio_settings_v1) ve Gemini API anahtarı sıfırlandı.'
        : 'Yerel ayarlar varsayılan değerlere döndürüldü; API anahtarınız korundu.',
    );
  };

  return (
    <div className="wl-settings-panel">
      <div className="wl-settings-data-row">
        <div className="wl-settings-data-row__copy">
          <span className="wl-settings-section__title">Kayıtsız taslağı sil</span>
          <span className="wl-settings-section__desc">
            Yalnızca yerel otomatik kurtarma taslağını temizler; kayıtlı projelere dokunmaz.
          </span>
        </div>

        <button
          type="button"
          className={`welcome-btn ${confirmAction === 'draft' ? 'wl-btn-danger-solid' : 'welcome-btn--ghost'}`}
          onClick={() => requestConfirmOrRun('draft', handleDiscardDraft)}
        >
          <FileX size={14} aria-hidden="true" />
          <span>{confirmAction === 'draft' ? 'Emin misin?' : 'Taslağı Sil'}</span>
        </button>
      </div>

      <div className="wl-settings-data-row">
        <div className="wl-settings-data-row__copy">
          <span className="wl-settings-section__title">Son proje listesini temizle</span>
          <span className="wl-settings-section__desc">
            Karşılama ekranındaki son açılanlar listesini boşaltır; tarayıcıda veya diskteki kayıtlı projelerin KENDİSİNİ silmez.
          </span>
        </div>

        <button
          type="button"
          className={`welcome-btn ${confirmAction === 'recent' ? 'wl-btn-danger-solid' : 'welcome-btn--ghost'}`}
          onClick={() => requestConfirmOrRun('recent', handleClearRecentList)}
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>{confirmAction === 'recent' ? 'Emin misin?' : 'Listeyi Temizle'}</span>
        </button>
      </div>

      <div className="wl-settings-data-row wl-settings-data-row--column">
        <div className="wl-settings-data-row__top">
          <div className="wl-settings-data-row__copy">
            <span className="wl-settings-section__title">Tüm yerel ayarları sıfırla</span>
            <span className="wl-settings-section__desc">
              Görünüm, model ve cihaz tercihlerini (`craftstudio_settings_v1`) varsayılana döndürür.
            </span>
          </div>

          <button
            type="button"
            className={`welcome-btn ${confirmAction === 'reset' ? 'wl-btn-danger-solid' : 'wl-btn-danger-ghost'}`}
            onClick={() => requestConfirmOrRun('reset', handleResetSettings)}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>{confirmAction === 'reset' ? 'Emin misin?' : 'Ayarları Sıfırla'}</span>
          </button>
        </div>

        <label className="wl-settings-checkbox">
          <input
            type="checkbox"
            checked={alsoClearApiKey}
            onChange={(e) => setAlsoClearApiKey(e.target.checked)}
          />
          <span>Gemini API anahtarını da bu cihazdan sil</span>
        </label>
      </div>

      {actionResult && (
        <p role="status" className="wl-settings-feedback wl-settings-feedback--success">
          {actionResult}
        </p>
      )}
    </div>
  );
}
