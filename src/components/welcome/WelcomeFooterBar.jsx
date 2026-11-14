import React from 'react';

export default function WelcomeFooterBar() {
  return (
    <footer className="welcome-footer" aria-label="Kısayollar">
      <div className="welcome-shortcuts">
        <span className="welcome-shortcut">
          <kbd className="welcome-kbd">Ctrl+O</kbd>
          <span>Aç</span>
        </span>
        <span className="welcome-shortcut">
          <kbd className="welcome-kbd">Ctrl+S</kbd>
          <span>Kaydet</span>
        </span>
        <span className="welcome-shortcut">
          <kbd className="welcome-kbd">Ctrl+,</kbd>
          <span>Ayarlar</span>
        </span>
      </div>

      <span className="welcome-footer__status">CraftStudio</span>
    </footer>
  );
}
