import React from 'react';
import { version as PACKAGE_VERSION } from '../../../package.json';
import { ALL_HTML_TAGS } from '../../data/tagRegistry';

const SHORTCUT_ITEMS = [
  { keys: 'Ctrl+S', desc: 'Projeyi Kaydet' },
  { keys: 'Alt+Sürükle', desc: 'Öğe Çoğalt' },
  { keys: 'Alt / Space', desc: 'Tuval Kaydır' },
  { keys: 'Ctrl+,', desc: 'Ayarları Aç (Karşılama Ekranı)' },
];

/**
 * Hakkında sekmesi: Uygulama sürümü (package.json), klavye kısayolları ve yerel depolama notu.
 */
export default function SettingsAboutTab() {
  return (
    <div className="wl-settings-panel">
      <div className="wl-settings-section">
        <h3 className="wl-settings-section__title">CraftStudio</h3>
        <p className="wl-settings-section__desc">
          Sürüm {PACKAGE_VERSION || '1.0.0'} · {ALL_HTML_TAGS.length} HTML5 Bileşen · React 19 + Statik HTML Yayın
        </p>
      </div>

      <div className="wl-settings-section">
        <h3 className="wl-settings-section__title">Klavye Kısayolları</h3>
        <ul className="wl-settings-shortcuts-list">
          {SHORTCUT_ITEMS.map((item) => (
            <li key={item.keys} className="wl-settings-shortcuts-list__item">
              <span>{item.desc}</span>
              <kbd className="welcome-kbd">{item.keys}</kbd>
            </li>
          ))}
        </ul>
      </div>

      <div className="wl-settings-privacy">
        <p>Veriler bu cihazda saklanır.</p>
      </div>
    </div>
  );
}
