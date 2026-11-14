import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass,
  Building2,
  Newspaper,
  Users,
  ShoppingBag,
  Cpu,
  UtensilsCrossed,
  Sparkles,
  Layers,
  Wand2,
  Plus,
  Check,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  LayoutTemplate,
  X,
  Eye,
  Palette,
} from 'lucide-react';
import { CONTENT_PACK_ASSETS } from '../../data/contentPacks';
import { TEMPLATE_BLUEPRINT_LIST } from '../../data/templateBlueprints';
import { WelcomeLiveSiteArtboard } from './WelcomeMockThumbnails';

const ICON_BY_SLUG = {
  seyahat: Compass,
  emlak: Building2,
  haber: Newspaper,
  topluluk: Users,
  eticaret: ShoppingBag,
  saas: Cpu,
  restoran: UtensilsCrossed,
  portfolyo: Sparkles,
};

export const TEMPLATE_CARDS = TEMPLATE_BLUEPRINT_LIST.map((bp) => ({
  ...bp,
  icon: ICON_BY_SLUG[bp.slug] || Compass,
}));

const BLOCK_CATEGORIES = ['Tümü', 'Navbar', 'İçerik Blokları', 'Slider', 'Footer'];

/**
 * Her modüler blok için kendi bileşen yapısını (menü, hero, slider, fiyat, SSS, footer)
 * gerçekçi mikro-arayüz detaylarıyla yansıtan görsel önizleme sahnesi.
 */
function BlockMiniWireframe({ pack }) {
  const key = String(pack?.presetKey || '');
  const cat = String(pack?.category || '');

  if (cat === 'Navbar') {
    return (
      <div className="wl-bwire wl-bwire--nav" aria-hidden="true">
        <span className="wl-bwire__brand">
          <i className="wl-bwire__dot" />
          <b>STUDIO</b>
        </span>
        <div className="wl-bwire__links">
          <span>Ürün</span>
          <span>Vitrin</span>
          <span>Fiyat</span>
        </div>
        <span className="wl-bwire__cta">Başla</span>
      </div>
    );
  }

  if (cat === 'Slider') {
    return (
      <div className="wl-bwire wl-bwire--slider" aria-hidden="true">
        <span className="wl-bwire__arrow">‹</span>
        <div className="wl-bwire__card" />
        <div className="wl-bwire__card wl-bwire__card--focus">
          <b>01</b>
          <span />
        </div>
        <div className="wl-bwire__card" />
        <span className="wl-bwire__arrow">›</span>
      </div>
    );
  }

  if (cat === 'Footer') {
    return (
      <div className="wl-bwire wl-bwire--footer" aria-hidden="true">
        <div className="wl-bwire__fcol">
          <b>CRAFT</b>
          <i />
          <i className="short" />
        </div>
        <div className="wl-bwire__fcol">
          <span />
          <i />
          <i />
        </div>
        <div className="wl-bwire__fcol">
          <span />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (key.includes('hero')) {
    return (
      <div className="wl-bwire wl-bwire--hero" aria-hidden="true">
        <div className="wl-bwire__copy">
          <b>YENİ NESİL</b>
          <span />
          <span className="short" />
          <i />
        </div>
        <div className="wl-bwire__art">
          <span>✦</span>
        </div>
      </div>
    );
  }

  if (key.includes('kpi') || key.includes('stats')) {
    return (
      <div className="wl-bwire wl-bwire--kpi" aria-hidden="true">
        <div>
          <b>%99.9</b>
          <i />
        </div>
        <div>
          <b>4.9★</b>
          <i />
        </div>
        <div>
          <b>24K+</b>
          <i />
        </div>
      </div>
    );
  }

  if (key.includes('pricing')) {
    return (
      <div className="wl-bwire wl-bwire--kpi" aria-hidden="true">
        <div>
          <b>₺0</b>
          <i />
        </div>
        <div className="is-pro">
          <b>PRO</b>
          <i />
        </div>
        <div>
          <b>EKİP</b>
          <i />
        </div>
      </div>
    );
  }

  if (key.includes('faq')) {
    return (
      <div className="wl-bwire wl-bwire--faq" aria-hidden="true">
        <div className="wl-bwire__faqrow is-open">
          <span />
          <b>−</b>
        </div>
        <div className="wl-bwire__faqrow">
          <span />
          <b>+</b>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-bwire wl-bwire--grid" aria-hidden="true">
      <div>
        <b />
        <span />
      </div>
      <div className="is-focus">
        <b />
        <span />
      </div>
      <div>
        <b />
        <span />
      </div>
    </div>
  );
}

export default function WelcomeTemplatesSection({
  fullPageMode = false,
  onSelectTemplate,
  onStartAssembledProject,
  onViewAllTemplates,
}) {
  const [libraryTab, setLibraryTab] = useState('templates');
  const [blockCategory, setBlockCategory] = useState('Tümü');
  const [selectedBlockKeys, setSelectedBlockKeys] = useState([
    'nav-saas-split',
    'block-split-hero',
    'block-features-grid',
    'footer-modern-directory',
  ]);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewBlock, setPreviewBlock] = useState(null);

  const visibleTemplates = fullPageMode ? TEMPLATE_CARDS : TEMPLATE_CARDS.slice(0, 4);

  const filteredBlocks = useMemo(() => {
    if (blockCategory === 'Tümü') return CONTENT_PACK_ASSETS;
    return CONTENT_PACK_ASSETS.filter((b) => b.category === blockCategory);
  }, [blockCategory]);

  const handleToggleBlockKey = (presetKey) => {
    setSelectedBlockKeys((prev) =>
      prev.includes(presetKey)
        ? prev.filter((k) => k !== presetKey)
        : [...prev, presetKey]
    );
  };

  const handleLaunchTemplateBlocks = (tpl) => {
    if (!onStartAssembledProject) {
      onSelectTemplate?.(tpl.prompt);
      return;
    }
    onStartAssembledProject({
      name: `${tpl.title} Projesi`,
      tabName: 'Anasayfa.craft',
      presetKeys: tpl.presetKeys,
      backgroundColor: tpl.backgroundColor || '#0b0a09',
      brandName: tpl.brandName || '',
      heroHeadline: tpl.content?.heroHeadline || '',
      heroSubtitle: tpl.content?.heroSubtitle || '',
      templateSlug: tpl.slug,
    });
  };

  const handleLaunchSelectedCustomBlocks = () => {
    if (!onStartAssembledProject || selectedBlockKeys.length === 0) return;
    onStartAssembledProject({
      name: `Özel Blok Kurgusu (${selectedBlockKeys.length} Katman)`,
      tabName: 'Anasayfa.craft',
      presetKeys: selectedBlockKeys,
      backgroundColor: '#0b0a09',
    });
  };

  const handleLaunchSingleBlock = (pack) => {
    if (!onStartAssembledProject) return;
    onStartAssembledProject({
      name: `${pack.name} — Çalışma`,
      tabName: 'Anasayfa.craft',
      presetKeys: [pack.presetKey],
      backgroundColor: '#0b0a09',
    });
  };

  const librarySubTabsNode = (
    <div className="welcome-subtabs" role="tablist" aria-label="Kütüphane görünümü">
      <button
        type="button"
        role="tab"
        aria-selected={libraryTab === 'templates'}
        className={`welcome-subtab ${libraryTab === 'templates' ? 'welcome-subtab--active' : ''}`}
        onClick={() => setLibraryTab('templates')}
      >
        <span>Tam Şablonlar</span>
        <span className="welcome-subtab__count">{TEMPLATE_CARDS.length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={libraryTab === 'blocks'}
        className={`welcome-subtab ${libraryTab === 'blocks' ? 'welcome-subtab--active' : ''}`}
        onClick={() => setLibraryTab('blocks')}
      >
        <Layers size={11} aria-hidden="true" />
        <span>Modüler Bloklar</span>
        <span className="welcome-subtab__count">{CONTENT_PACK_ASSETS.length}</span>
      </button>
    </div>
  );

  return (
    <section
      id="welcome-templates"
      className="welcome-section"
      aria-labelledby="welcome-templates-heading"
    >
      {fullPageMode ? (
        <div className="welcome-page-spotlight welcome-page-spotlight--templates">
          <div className="welcome-hero__glow" aria-hidden="true" />
          <div className="welcome-hero__grid" aria-hidden="true" />

          <div className="welcome-page-spotlight__inner">
            <div className="welcome-page-spotlight__copy">
              <span className="welcome-hero__kicker-pill">
                <LayoutTemplate size={11} strokeWidth={2.3} aria-hidden="true" />
                <span>TASARIM KÜTÜPHANESİ</span>
              </span>
              <h1 id="welcome-templates-heading" className="welcome-page-spotlight__title">
                Hazır şablonlar, <span className="welcome-hero__title-accent">modüler bloklar.</span>
              </h1>
            </div>

            <div className="welcome-page-spotlight__controls">
              {librarySubTabsNode}
            </div>
          </div>
        </div>
      ) : (
        <div className="welcome-section__head welcome-section__head--wrap">
          <div className="welcome-section__title-group">
            <h2 id="welcome-templates-heading" className="welcome-section__title">
              Hazır Şablonlar & Bloklar
            </h2>
            <span className="welcome-section__count-pill">{TEMPLATE_CARDS.length} Şablon</span>
          </div>

          <div className="welcome-section__controls">
            {librarySubTabsNode}

            {onViewAllTemplates && (
              <button
                type="button"
                className="welcome-section__link"
                onClick={onViewAllTemplates}
              >
                <span>Tüm Şablonlar</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {libraryTab === 'templates' ? (
        <div
          className={`welcome-templates-grid ${
            fullPageMode ? 'welcome-templates-grid--full' : ''
          }`}
        >
          {visibleTemplates.map((tpl) => (
            <article
              key={tpl.slug}
              className="welcome-tpl-card welcome-tpl-card--interactive"
              onClick={() => setPreviewTemplate(tpl)}
              role="button"
              tabIndex={0}
              aria-label={`${tpl.title} şablon bilgisini görüntüle`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPreviewTemplate(tpl);
                }
              }}
            >
              <div className="welcome-tpl-card__thumb">
                <WelcomeLiveSiteArtboard
                  slug={tpl.slug}
                  fallbackAssetKey={tpl.coverAsset}
                />
              </div>

              <div className="welcome-tpl-card__body">
                <div className="welcome-tpl-card__head">
                  <div className="welcome-tpl-card__title-row">
                    <span className="welcome-tpl-card__title">{tpl.title}</span>
                    {Array.isArray(tpl.palette) && (
                      <span className="welcome-tpl-card__palette" aria-label="Renk paleti">
                        {tpl.palette.slice(0, 3).map((hex, pIdx) => (
                          <i
                            key={`${tpl.slug}-c-${pIdx}`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {tpl.subtitle && (
                    <p className="welcome-tpl-card__sub">{tpl.subtitle}</p>
                  )}
                </div>

                <div className="welcome-tpl-card__footer">
                  <span className="welcome-tpl-card__meta-pill">
                    {tpl.category} · {tpl.presetKeys.length} Katman
                  </span>

                  <span className="welcome-tpl-card__inspect-pill">
                    <Eye size={12} strokeWidth={2.1} aria-hidden="true" />
                    <span>İncele</span>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="welcome-blocks-library">
          <div className="welcome-blocks-toolbar">
            <div className="welcome-blocks-categories" role="group" aria-label="Blok kategorileri">
              {BLOCK_CATEGORIES.map((cat) => {
                const count =
                  cat === 'Tümü'
                    ? CONTENT_PACK_ASSETS.length
                    : CONTENT_PACK_ASSETS.filter((b) => b.category === cat).length;
                const isActive = blockCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`welcome-chip ${isActive ? 'welcome-chip--active' : ''}`}
                    onClick={() => setBlockCategory(cat)}
                  >
                    <span>{cat}</span>
                    <span className="welcome-chip__count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="welcome-blocks-toolbar__right">
              {selectedBlockKeys.length > 0 && (
                <button
                  type="button"
                  className="welcome-text-btn"
                  onClick={() => setSelectedBlockKeys([])}
                >
                  Temizle
                </button>
              )}

              <button
                type="button"
                className="welcome-btn welcome-btn--emerald"
                disabled={selectedBlockKeys.length === 0}
                onClick={handleLaunchSelectedCustomBlocks}
              >
                <Layers size={14} strokeWidth={2.1} aria-hidden="true" />
                <span>Seçilenleri Diz ({selectedBlockKeys.length})</span>
                <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="welcome-blocks-grid">
            {filteredBlocks.map((pack) => {
              const isSelected = selectedBlockKeys.includes(pack.presetKey);
              const orderIndex = selectedBlockKeys.indexOf(pack.presetKey);

              return (
                <article
                  key={pack.presetKey}
                  className={`welcome-block-card ${isSelected ? 'welcome-block-card--selected' : ''}`}
                  onClick={() => setPreviewBlock(pack)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pack.name} blok bilgisini görüntüle`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPreviewBlock(pack);
                    }
                  }}
                >
                  <div className="welcome-block-card__visual">
                    {isSelected && (
                      <span className="welcome-block-card__order">{orderIndex + 1}</span>
                    )}
                    <BlockMiniWireframe pack={pack} />
                  </div>

                  <div className="welcome-block-card__bottom">
                    <div className="welcome-block-card__copy">
                      <h3 className="welcome-block-card__title">{pack.name}</h3>
                      <span className="welcome-block-card__sub">{pack.category}</span>
                    </div>

                    <div
                      className="welcome-block-card__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={`welcome-tpl-btn ${
                          isSelected ? 'welcome-tpl-btn--selected' : 'welcome-tpl-btn--primary'
                        }`}
                        onClick={() => handleToggleBlockKey(pack.presetKey)}
                      >
                        {isSelected ? (
                          <>
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                            <span>Seçildi</span>
                          </>
                        ) : (
                          <>
                            <Plus size={12} strokeWidth={2.3} aria-hidden="true" />
                            <span>Seç</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="welcome-tpl-btn welcome-tpl-btn--icon-open"
                        title="Detayları İncele"
                        aria-label={`${pack.name} detaylarını incele`}
                        onClick={() => setPreviewBlock(pack)}
                      >
                        <Eye size={14} strokeWidth={2.1} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ŞABLON DETAY & ONAY MODALI ("İlk bilgi versin, okeylenince açılsın") */}
      {previewTemplate &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="wl-tpl-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wl-tpl-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewTemplate(null);
            }}
          >
            <div className="wl-tpl-modal">
              <header className="wl-tpl-modal__header">
                <div className="wl-tpl-modal__header-left">
                  <span className="wl-tpl-modal__cat-badge">{previewTemplate.category}</span>
                  <span className="wl-tpl-modal__brand-tag">{previewTemplate.brandName}</span>
                </div>
                <button
                  type="button"
                  className="wl-wizard-close"
                  aria-label="Kapat"
                  onClick={() => setPreviewTemplate(null)}
                >
                  <X size={17} />
                </button>
              </header>

              <div className="wl-tpl-modal__body">
                <div className="wl-tpl-modal__visual-col">
                  <div className="wl-tpl-modal__artboard">
                    <WelcomeLiveSiteArtboard
                      slug={previewTemplate.slug}
                      fallbackAssetKey={previewTemplate.coverAsset}
                    />
                  </div>

                  {Array.isArray(previewTemplate.palette) && (
                    <div className="wl-tpl-modal__palette-grid">
                      {previewTemplate.palette.slice(0, 3).map((hex, idx) => {
                        const roleLabels = ['Ana Zemin', 'Kart Yüzeyi', 'Vurgu Rengi'];
                        return (
                          <div
                            key={`${previewTemplate.slug}-sw-${idx}`}
                            className="wl-tpl-modal__swatch-card"
                          >
                            <span
                              className="wl-tpl-modal__swatch-color"
                              style={{ backgroundColor: hex }}
                              aria-hidden="true"
                            />
                            <div className="wl-tpl-modal__swatch-meta">
                              <span className="wl-tpl-modal__swatch-role">
                                {roleLabels[idx] || `Renk ${idx + 1}`}
                              </span>
                              <code className="wl-tpl-modal__swatch-hex">{hex.toUpperCase()}</code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {Array.isArray(previewTemplate.content?.kpis) && (
                    <div className="wl-tpl-modal__kpis">
                      {previewTemplate.content.kpis.slice(0, 3).map((kpi, idx) => (
                        <div key={idx} className="wl-tpl-modal__kpi-card">
                          <strong>{kpi.val}</strong>
                          <span>{kpi.lbl}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="wl-tpl-modal__info-col">
                  <div className="wl-tpl-modal__head">
                    <h2 id="wl-tpl-modal-title" className="wl-tpl-modal__title">
                      {previewTemplate.title}
                    </h2>
                    <p className="wl-tpl-modal__desc">{previewTemplate.subtitle}</p>
                  </div>

                  {previewTemplate.content?.heroHeadline && (
                    <div className="wl-tpl-modal__quote">
                      <span className="wl-tpl-modal__quote-label">ÖRNEK VİTRİN BAŞLIĞI</span>
                      <strong>“{previewTemplate.content.heroHeadline}”</strong>
                    </div>
                  )}

                  <div className="wl-tpl-modal__layers-box">
                    <div className="wl-tpl-modal__layers-head">
                      <span>ŞABLON KATMANLARI</span>
                      <span>{(previewTemplate.layerLabels || []).length} Bölüm</span>
                    </div>
                    <div className="wl-tpl-modal__layers-grid">
                      {(previewTemplate.layerLabels || []).map((lbl, idx) => (
                        <div key={lbl} className="wl-tpl-modal__layer-item">
                          <span className="wl-tpl-modal__layer-num">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="wl-tpl-modal__layer-name">{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <footer className="wl-tpl-modal__footer">
                <button
                  type="button"
                  className="welcome-btn welcome-btn--ghost"
                  onClick={() => setPreviewTemplate(null)}
                >
                  <span>Vazgeç</span>
                </button>

                <div className="wl-tpl-modal__footer-actions">
                  <button
                    type="button"
                    className="welcome-btn welcome-btn--ghost"
                    onClick={() => {
                      const prompt = previewTemplate.prompt;
                      setPreviewTemplate(null);
                      onSelectTemplate?.(prompt);
                    }}
                  >
                    <Wand2 size={14} strokeWidth={2} aria-hidden="true" />
                    <span>AI Sihirbazı ile Kurgula</span>
                  </button>

                  <button
                    type="button"
                    className="welcome-btn welcome-btn--ai-build"
                    onClick={() => {
                      const chosen = previewTemplate;
                      setPreviewTemplate(null);
                      handleLaunchTemplateBlocks(chosen);
                    }}
                  >
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    <span>Onayla ve Tuvalde Aç</span>
                    <ArrowUpRight size={14} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.querySelector('[data-welcome-root]') || document.body
        )}

      {/* MODÜLER BLOK DETAY & ONAY MODALI */}
      {previewBlock &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="wl-tpl-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wl-block-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewBlock(null);
            }}
          >
            <div className="wl-tpl-modal wl-tpl-modal--compact">
              <header className="wl-tpl-modal__header">
                <div className="wl-tpl-modal__header-left">
                  <span className="wl-tpl-modal__cat-badge">{previewBlock.category}</span>
                  <span className="wl-tpl-modal__brand-tag">Modüler Bileşen</span>
                </div>
                <button
                  type="button"
                  className="wl-wizard-close"
                  aria-label="Kapat"
                  onClick={() => setPreviewBlock(null)}
                >
                  <X size={17} />
                </button>
              </header>

              <div className="wl-tpl-modal__compact-body">
                <div className="welcome-block-card__visual welcome-block-card__visual--large">
                  <BlockMiniWireframe pack={previewBlock} />
                </div>

                <div className="wl-tpl-modal__head">
                  <h2 id="wl-block-modal-title" className="wl-tpl-modal__title">
                    {previewBlock.name}
                  </h2>
                  <p className="wl-tpl-modal__desc">
                    {previewBlock.description ||
                      `${previewBlock.category} kategorisinde yer alan bu modüler bileşeni kendi kurguna ekleyebilir veya doğrudan tuvalde açarak düzenleyebilirsin.`}
                  </p>
                </div>
              </div>

              <footer className="wl-tpl-modal__footer">
                <button
                  type="button"
                  className="welcome-btn welcome-btn--ghost"
                  onClick={() => setPreviewBlock(null)}
                >
                  <span>Vazgeç</span>
                </button>

                <div className="wl-tpl-modal__footer-actions">
                  <button
                    type="button"
                    className="welcome-btn welcome-btn--ghost"
                    onClick={() => {
                      handleToggleBlockKey(previewBlock.presetKey);
                      setPreviewBlock(null);
                    }}
                  >
                    <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>
                      {selectedBlockKeys.includes(previewBlock.presetKey)
                        ? 'Seçimden Çıkar'
                        : 'Kurgu Listesine Ekle'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="welcome-btn welcome-btn--ai-build"
                    onClick={() => {
                      const chosen = previewBlock;
                      setPreviewBlock(null);
                      handleLaunchSingleBlock(chosen);
                    }}
                  >
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    <span>Onayla ve Tuvalde Aç</span>
                    <ArrowUpRight size={14} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.querySelector('[data-welcome-root]') || document.body
        )}
    </section>
  );
}
