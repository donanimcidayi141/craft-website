import React from 'react';
import {
  Plus,
  Monitor,
  Tablet,
  Smartphone,
  ArrowUpRight,
} from 'lucide-react';

const DEVICE_OPTIONS = [
  { id: 'desktop', label: 'Masaüstü', dims: '1280px', icon: Monitor },
  { id: 'tablet', label: 'Tablet', dims: '768px', icon: Tablet },
  { id: 'mobile', label: 'Mobil', dims: '375px', icon: Smartphone },
];

export default function WelcomeCreateSection({
  selectedDevice,
  onSelectDevice,
  onStartBlank,
  onStartTablet,
  onStartMobile,
  onStartQuickModular,
  onStartTemplate,
  onOpenCodeOrProject,
}) {
  const activeOption =
    DEVICE_OPTIONS.find((item) => item.id === selectedDevice) || DEVICE_OPTIONS[0];

  const handleLaunchBlankCard = () => {
    if (selectedDevice === 'mobile') {
      onStartMobile?.();
      return;
    }
    if (selectedDevice === 'tablet' && onStartTablet) {
      onStartTablet();
      return;
    }
    onStartBlank?.();
  };

  return (
    <section
      id="welcome-create"
      className="welcome-section"
      aria-labelledby="welcome-create-heading"
    >
      <div className="welcome-section__head">
        <h2 id="welcome-create-heading" className="welcome-section__title">
          Tuval Başlat
        </h2>
      </div>

      <div className="welcome-create-grid welcome-create-grid--visual">
        {/* Kart 1: Boş Tuval + Canlı Cihaz Oranı Önizlemesi */}
        <article className="welcome-art-card">
          <div className="welcome-art-card__visual welcome-art-card__visual--purple">
            <div
              className={`welcome-mini-canvas welcome-mini-canvas--${selectedDevice || 'desktop'}`}
              aria-hidden="true"
            >
              <span className="welcome-mini-canvas__plus">
                <Plus size={15} strokeWidth={2.2} />
              </span>
            </div>

            <div
              className="welcome-device-switch welcome-device-switch--floating"
              role="group"
              aria-label="Başlangıç cihaz boyutu"
            >
              {DEVICE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = (selectedDevice || 'desktop') === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="welcome-device-switch__btn"
                    aria-pressed={isSelected}
                    aria-label={option.label}
                    title={`${option.label} (${option.dims})`}
                    onClick={() => onSelectDevice?.(option.id)}
                  >
                    <Icon size={12.5} strokeWidth={2} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="welcome-art-card__launch"
            onClick={handleLaunchBlankCard}
          >
            <div className="welcome-art-card__meta">
              <span className="welcome-art-card__title">Boş Tuval</span>
              <span className="welcome-art-card__tag">{activeOption.dims}</span>
            </div>
            <ArrowUpRight size={15} className="welcome-art-card__arrow" aria-hidden="true" />
          </button>
        </article>

        {/* Kart 2: Modüler Site İskeleti (Görsel 4 Katman Yığını) */}
        {onStartQuickModular && (
          <article className="welcome-art-card">
            <div className="welcome-art-card__visual welcome-art-card__visual--emerald" aria-hidden="true">
              <div className="welcome-mini-stack">
                <span className="welcome-mini-stack__nav" />
                <span className="welcome-mini-stack__hero" />
                <div className="welcome-mini-stack__bento">
                  <i />
                  <i />
                  <i />
                </div>
                <span className="welcome-mini-stack__foot" />
              </div>
            </div>

            <button
              type="button"
              className="welcome-art-card__launch"
              onClick={onStartQuickModular}
            >
              <div className="welcome-art-card__meta">
                <span className="welcome-art-card__title">Hazır İskelet</span>
                <span className="welcome-art-card__tag welcome-art-card__tag--emerald">4 Katman</span>
              </div>
              <ArrowUpRight size={15} className="welcome-art-card__arrow" aria-hidden="true" />
            </button>
          </article>
        )}

        {/* Kart 3: Aurelia Lüks Vitrin (Obsidyen & Altın Görsel Kompozisyon) */}
        <article className="welcome-art-card">
          <div className="welcome-art-card__visual welcome-art-card__visual--gold" aria-hidden="true">
            <div className="welcome-mini-luxury">
              <div className="welcome-mini-luxury__top">
                <span className="welcome-mini-luxury__dot" />
                <span className="welcome-mini-luxury__line" />
              </div>
              <div className="welcome-mini-luxury__hero">
                <div className="welcome-mini-luxury__copy">
                  <span />
                  <span className="is-short" />
                  <i />
                </div>
                <div className="welcome-mini-luxury__card" />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="welcome-art-card__launch"
            onClick={onStartTemplate}
          >
            <div className="welcome-art-card__meta">
              <span className="welcome-art-card__title">Aurelia Vitrin</span>
              <span className="welcome-art-card__tag welcome-art-card__tag--orange">Şablon</span>
            </div>
            <ArrowUpRight size={15} className="welcome-art-card__arrow" aria-hidden="true" />
          </button>
        </article>

        {/* Kart 4: Koddan Tuvale (Split Code -> UI Görsel Önizleme) */}
        <article className="welcome-art-card">
          <div className="welcome-art-card__visual welcome-art-card__visual--blue" aria-hidden="true">
            <div className="welcome-mini-code">
              <div className="welcome-mini-code__left">
                <span className="c-1" />
                <span className="c-2" />
                <span className="c-3" />
              </div>
              <span className="welcome-mini-code__sep">→</span>
              <div className="welcome-mini-code__right">
                <span className="u-top" />
                <span className="u-box" />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="welcome-art-card__launch"
            onClick={onOpenCodeOrProject}
          >
            <div className="welcome-art-card__meta">
              <span className="welcome-art-card__title">Dosya İçe Aktar</span>
              <span className="welcome-art-card__tag">HTML · JSX</span>
            </div>
            <ArrowUpRight size={15} className="welcome-art-card__arrow" aria-hidden="true" />
          </button>
        </article>
      </div>
    </section>
  );
}
