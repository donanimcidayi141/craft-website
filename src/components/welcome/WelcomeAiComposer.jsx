import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Wand2,
  Layers,
  Check,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Building2,
  ShoppingBag,
  Palette,
  Cpu,
  Compass,
  UtensilsCrossed,
  X,
  Zap,
  LayoutTemplate,
  GalleryHorizontal,
  Grid,
  BarChart3,
  CreditCard,
  HelpCircle,
  PanelBottom,
} from 'lucide-react';

const ROTATING_PLACEHOLDERS = [
  'Sitenin amacını yazın... (Örn: Mimarlık ofisi tanıtım sitesi)',
  'Sitenin amacını yazın... (Örn: El yapımı takı mağazası)',
  'Sitenin amacını yazın... (Örn: Yapay zeka uygulaması açılış sayfası)',
  'Sitenin amacını yazın... (Örn: Butik kahve dükkanı sitesi)',
];

const SECTOR_OPTIONS = [
  {
    id: 'kurumsal',
    label: 'Kurumsal',
    sub: 'Ajans & Danışmanlık',
    icon: Building2,
    defaultPalette: 'slate',
    defaultLayers: ['navbar', 'hero', 'features', 'kpi', 'faq', 'footer'],
    defaultHeadline: 'Markanız İçin Ölçeklenebilir Dijital Deneyimler',
    defaultPrompt:
      'Kurumsal bir tasarım ve danışmanlık ajansı için güven veren, modern tipografili tanıtım sitesi',
  },
  {
    id: 'eticaret',
    label: 'E-Ticaret',
    sub: 'Mağaza & Koleksiyon',
    icon: ShoppingBag,
    defaultPalette: 'obsidian',
    defaultLayers: ['navbar', 'hero', 'products', 'slider', 'faq', 'footer'],
    defaultHeadline: 'Zamansız El İşçiliği ve Seçkin Koleksiyon Vitrini',
    defaultPrompt:
      'Seçkin ürünler sunan butik bir mağaza için ürün ızgaralı, koleksiyon vitrinli ve sepet çağrılı e-ticaret sitesi',
  },
  {
    id: 'saas',
    label: 'SaaS & AI',
    sub: 'Yazılım & Ürün',
    icon: Cpu,
    defaultPalette: 'cyber',
    defaultLayers: ['navbar', 'hero', 'features', 'kpi', 'pricing', 'faq', 'footer'],
    defaultHeadline: 'İş Akışlarınızı Yapay Zeka Hızıyla Otomatikleştirin',
    defaultPrompt:
      'Yeni nesil bir yazılım ürünü (SaaS) için hero vitrini, bento özellik ızgarası, KPI metrikleri ve 3 kademeli fiyatlandırma içeren açılış sitesi',
  },
  {
    id: 'portfolyo',
    label: 'Portfolyo',
    sub: 'Kreatif & Stüdyo',
    icon: Palette,
    defaultPalette: 'glass',
    defaultLayers: ['navbar', 'hero', 'products', 'features', 'footer'],
    defaultHeadline: 'Görsel Hikaye Anlatımı ve Seçilmiş Tasarım İşleri',
    defaultPrompt:
      'Bağımsız bir kreatif direktör ve tasarımcı için koyu temalı, seçili projeler vitrini ve iletişim bölümü içeren portfolyo sitesi',
  },
  {
    id: 'mimarlik',
    label: 'Mimarlık',
    sub: 'Emlak & Yapı',
    icon: Compass,
    defaultPalette: 'obsidian',
    defaultLayers: ['navbar', 'hero', 'slider', 'products', 'kpi', 'footer'],
    defaultHeadline: 'Çağdaş Mimari Kurgular ve Prestijli Yaşam Alanları',
    defaultPrompt:
      'Modern konut ve mimari projeler sunan bir ofis için portföy galerisi, proje metrikleri ve randevu çağrılı prestij sitesi',
  },
  {
    id: 'restoran',
    label: 'Restoran',
    sub: 'Gastronomi & Kafe',
    icon: UtensilsCrossed,
    defaultPalette: 'obsidian',
    defaultLayers: ['navbar', 'hero', 'products', 'features', 'footer'],
    defaultHeadline: 'Özel Kavrum Kahveler ve Artizan Tatlar Atölyesi',
    defaultPrompt:
      'Butik bir kafe ve gastronomi mekanı için imza menü vitrini, mekan atmosferi ve rezervasyon/iletişim bilgileri içeren site',
  },
];

const PALETTE_OPTIONS = [
  {
    id: 'obsidian',
    label: 'Obsidyen Altın',
    desc: 'Lüks & Prestij',
    bg: '#0b0a09',
    surface: '#171513',
    text: '#f5f2eb',
    accent: '#d4af37',
    isLight: false,
    navPreset: 'nav-boutique-commerce',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'koyu obsidyen (#0b0a09) zemin ve sıcak altın (#d4af37) vurgulu lüks atmosfer',
  },
  {
    id: 'cyber',
    label: 'Siber Okyanus',
    desc: 'Modern Teknoloji',
    bg: '#0c101b',
    surface: '#151c2e',
    text: '#f1f5f9',
    accent: '#0d99ff',
    isLight: false,
    navPreset: 'nav-saas-split',
    footerPreset: 'footer-modern-directory',
    promptHint: 'derin gece mavisi (#0c101b) zemin ve parlak elektrik mavisi (#0d99ff) vurgulu teknoloji stili',
  },
  {
    id: 'slate',
    label: 'Kurumsal Antrasit',
    desc: 'Keskin & Net',
    bg: '#09090b',
    surface: '#18181b',
    text: '#fafafa',
    accent: '#38bdf8',
    isLight: false,
    navPreset: 'nav-corporate-dark',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'profesyonel antrasit (#09090b) zemin ve yüksek kontrastlı kurumsal tipografi',
  },
  {
    id: 'glass',
    label: 'Kreatif Mor',
    desc: 'Cam & Gradyan',
    bg: '#111018',
    surface: '#1d1b29',
    text: '#f5f3ff',
    accent: '#a855f7',
    isLight: false,
    navPreset: 'nav-floating-glass',
    footerPreset: 'footer-newsletter-cta',
    promptHint: 'yarı saydam cam katmanlar (glassmorphism), koyu mor-antrasit zemin ve canlı gradyan vurgular',
  },
  {
    id: 'emerald',
    label: 'Zümrüt Orman',
    desc: 'Doğal & Modern',
    bg: '#091410',
    surface: '#12241d',
    text: '#ecfdf5',
    accent: '#10b981',
    isLight: false,
    navPreset: 'nav-saas-split',
    footerPreset: 'footer-modern-directory',
    promptHint: 'derin zümrüt yeşili (#091410) zemin ve canlı mint/zümrüt (#10b981) vurgulu modern stil',
  },
  {
    id: 'light',
    label: 'Ferah Editoryal',
    desc: 'Açık & Minimal',
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    accent: '#2563eb',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'ferah açık zemin, güçlü siyah-beyaz tipografi ve editoryal boşluk dengesi',
  },
];

export const STEP_LAYERS = [
  {
    id: 'navbar',
    stepNo: '01',
    label: 'Üst Menü',
    shortTag: 'Logo & Gezinme',
    icon: LayoutTemplate,
    presetKey: 'nav-corporate-dark',
    promptLabel: 'yapışkan üst gezinme çubuğu (Navbar)',
  },
  {
    id: 'hero',
    stepNo: '02',
    label: 'Hero Vitrin',
    shortTag: 'Ana Karşılama',
    icon: Sparkles,
    presetKey: 'block-split-hero',
    promptLabel: 'etkileyici ana karşılama vitrini (Hero bölümü)',
  },
  {
    id: 'slider',
    stepNo: '03',
    label: 'Slayt Vitrin',
    shortTag: 'Etkileşimli Karusel',
    icon: GalleryHorizontal,
    presetKey: 'slider-hero-showcase',
    promptLabel: 'öne çıkan işler veya kampanyalar için etkileşimli vitrin alanı',
  },
  {
    id: 'features',
    stepNo: '04',
    label: 'Özellikler',
    shortTag: '3’lü Bento Izgara',
    icon: Grid,
    presetKey: 'block-features-grid',
    promptLabel: '3 sütunlu özellik ve hizmet bento ızgarası',
  },
  {
    id: 'products',
    stepNo: '05',
    label: 'Ürün / İş Vitrini',
    shortTag: 'Koleksiyon Kartları',
    icon: ShoppingBag,
    presetKey: 'block-product-showcase',
    promptLabel: 'ürün veya proje kartlarından oluşan 3 sütunlu koleksiyon vitrini',
  },
  {
    id: 'kpi',
    stepNo: '06',
    label: 'İstatistikler',
    shortTag: '4’lü Güven Sayacı',
    icon: BarChart3,
    presetKey: 'block-stats-kpi',
    promptLabel: '4 sütunlu sayısal başarı ve güven istatistik şeridi (KPI)',
  },
  {
    id: 'pricing',
    stepNo: '07',
    label: 'Fiyatlandırma',
    shortTag: '3 Paket Tablosu',
    icon: CreditCard,
    presetKey: 'block-pricing-tiers',
    promptLabel: 'önerilen plan vurgulu 3 kademeli fiyatlandırma tablosu',
  },
  {
    id: 'faq',
    stepNo: '08',
    label: 'Soru & Cevap',
    shortTag: 'SSS Akordiyonu',
    icon: HelpCircle,
    presetKey: 'block-faq-accordion',
    promptLabel: 'sıkça sorulan sorular (SSS) bölümü ve harekete geçirici dönüşüm çağrısı',
  },
  {
    id: 'footer',
    stepNo: '09',
    label: 'Alt Bilgi',
    shortTag: 'Bağlantılar & Telif',
    icon: PanelBottom,
    presetKey: 'footer-modern-directory',
    promptLabel: 'çok sütunlu kurumsal alt bilgi (Footer)',
  },
];

const BLUEPRINT_RECIPES = [
  {
    id: 'full-corporate',
    label: 'Kurumsal Paket',
    layers: ['navbar', 'hero', 'features', 'kpi', 'faq', 'footer'],
  },
  {
    id: 'ecommerce-store',
    label: 'E-Ticaret Paketi',
    layers: ['navbar', 'hero', 'products', 'slider', 'faq', 'footer'],
  },
  {
    id: 'saas-product',
    label: 'SaaS Paketi',
    layers: ['navbar', 'hero', 'features', 'kpi', 'pricing', 'faq', 'footer'],
  },
  {
    id: 'fast-landing',
    label: 'Minimal Açılış',
    layers: ['navbar', 'hero', 'features', 'footer'],
  },
];

const WIZARD_STEPS = [
  { num: 1, title: 'Kimlik & Tema' },
  { num: 2, title: 'Sayfa Mimarisi' },
  { num: 3, title: 'Özet & Başlat' },
];

function readOsReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Sağ Panel: Canlı Mimari Önizleme (Sıfır Taşma, Orantılı Mini Site İskeleti)
 */
function LiveWireframePreview({
  palette,
  brandName,
  sector,
  device,
  onSelectDevice,
  orderedLayers,
  onToggleLayer,
  activeStep,
}) {
  const displayBrand = String(brandName || '').trim() || sector?.label || 'CRAFT';
  const headlineText = sector?.defaultHeadline || 'Yeni Nesil Dijital Vitrin';
  const frameWidthClass =
    device === 'mobile'
      ? 'wl-preview-browser--mobile'
      : device === 'tablet'
        ? 'wl-preview-browser--tablet'
        : 'wl-preview-browser--desktop';

  return (
    <aside className="wl-wizard-preview" aria-label="Canlı mimari önizleme">
      <div className="wl-wizard-preview__head">
        <div className="wl-wizard-preview__title">
          <span className="wl-wizard-preview__live-dot" aria-hidden="true" />
          <span>CANLI ÖNİZLEME</span>
        </div>

        <div className="wl-wizard-preview__device-tabs" role="group" aria-label="Önizleme cihazı">
          {[
            { id: 'desktop', label: 'Masaüstü', icon: Monitor },
            { id: 'tablet', label: 'Tablet', icon: Tablet },
            { id: 'mobile', label: 'Mobil', icon: Smartphone },
          ].map((dv) => {
            const Icon = dv.icon;
            const isAct = (device || 'desktop') === dv.id;
            return (
              <button
                key={dv.id}
                type="button"
                title={dv.label}
                className={`wl-wizard-preview__dev-btn ${isAct ? 'is-active' : ''}`}
                onClick={() => onSelectDevice?.(dv.id)}
              >
                <Icon size={12} strokeWidth={2.1} />
                <span>{dv.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wl-wizard-preview__stage">
        <div
          className={`wl-preview-browser ${frameWidthClass}`}
          style={{
            '--pv-bg': palette.bg,
            '--pv-surface': palette.surface,
            '--pv-text': palette.text,
            '--pv-accent': palette.accent,
            '--pv-border': palette.isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)',
            '--pv-muted': palette.isLight ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.52)',
          }}
        >
          <div className="wl-preview-browser__chrome">
            <div className="wl-preview-browser__dots" aria-hidden="true">
              <span className="is-red" />
              <span className="is-yellow" />
              <span className="is-green" />
            </div>
            <div className="wl-preview-browser__url">
              {displayBrand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'stüdyo'}.craft.app
            </div>
            <span className="wl-preview-browser__count">{orderedLayers.length} Katman</span>
          </div>

          <div className="wl-preview-browser__viewport">
            {orderedLayers.map((layer, idx) => (
              <div
                key={layer.id}
                className={`wl-pv-block ${activeStep === 2 ? 'wl-pv-block--clickable' : ''}`}
                onClick={() => activeStep === 2 && onToggleLayer?.(layer.id)}
                title={activeStep === 2 ? `${layer.label} bölümünü kaldır` : layer.label}
              >
                <div className="wl-pv-block__meta">
                  <span className="wl-pv-block__idx">0{idx + 1}</span>
                  <span className="wl-pv-block__name">{layer.label}</span>
                </div>

                {layer.id === 'navbar' && (
                  <div className="wl-pv-nav">
                    <span className="wl-pv-nav__logo">
                      <i className="wl-pv-nav__mark">{displayBrand.charAt(0).toUpperCase()}</i>
                      <b>{displayBrand.slice(0, 12).toUpperCase()}</b>
                    </span>
                    <div className="wl-pv-nav__links">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="wl-pv-nav__cta">Başla</span>
                  </div>
                )}

                {layer.id === 'hero' && (
                  <div className="wl-pv-hero">
                    <div className="wl-pv-hero__copy">
                      <span className="wl-pv-hero__kicker">{sector?.label || 'VİTRİN'}</span>
                      <strong className="wl-pv-hero__headline">{headlineText}</strong>
                      <div className="wl-pv-hero__btns">
                        <span className="wl-pv-hero__btn-primary">Keşfet</span>
                        <span className="wl-pv-hero__btn-ghost">Detay</span>
                      </div>
                    </div>
                    <div className="wl-pv-hero__visual">
                      <Sparkles size={15} />
                    </div>
                  </div>
                )}

                {layer.id === 'slider' && (
                  <div className="wl-pv-slider">
                    <span className="wl-pv-slider__arrow">‹</span>
                    <div className="wl-pv-slider__center">
                      <span className="wl-pv-slider__badge">ETKİLEŞİMLİ KARUSEL</span>
                      <div className="wl-pv-slider__dots">
                        <i className="is-active" />
                        <i />
                        <i />
                      </div>
                    </div>
                    <span className="wl-pv-slider__arrow">›</span>
                  </div>
                )}

                {layer.id === 'features' && (
                  <div className="wl-pv-grid3">
                    {['Hızlı Kurulum', 'Modüler Yapı', 'Tam Uyum'].map((ft) => (
                      <div key={ft} className="wl-pv-card">
                        <span className="wl-pv-card__dot" />
                        <b className="wl-pv-card__title">{ft}</b>
                        <span className="wl-pv-card__sub" />
                      </div>
                    ))}
                  </div>
                )}

                {layer.id === 'products' && (
                  <div className="wl-pv-grid3">
                    {['Koleksiyon 01', 'Koleksiyon 02', 'Koleksiyon 03'].map((pr) => (
                      <div key={pr} className="wl-pv-product">
                        <div className="wl-pv-product__img" />
                        <b className="wl-pv-card__title">{pr}</b>
                      </div>
                    ))}
                  </div>
                )}

                {layer.id === 'kpi' && (
                  <div className="wl-pv-kpi">
                    {['%99.9', '24/7', '12K+', '4.9★'].map((stat) => (
                      <div key={stat} className="wl-pv-kpi__item">
                        <strong>{stat}</strong>
                        <span />
                      </div>
                    ))}
                  </div>
                )}

                {layer.id === 'pricing' && (
                  <div className="wl-pv-grid3">
                    {[
                      { name: 'Başlangıç', price: '₺490', pro: false },
                      { name: 'Pro Studio', price: '₺990', pro: true },
                      { name: 'Kurumsal', price: 'Özel', pro: false },
                    ].map((tier) => (
                      <div
                        key={tier.name}
                        className={`wl-pv-price-card ${tier.pro ? 'wl-pv-price-card--pro' : ''}`}
                      >
                        <b className="wl-pv-card__title">{tier.name}</b>
                        <strong className="wl-pv-price-card__val">{tier.price}</strong>
                        <span className="wl-pv-price-card__btn" />
                      </div>
                    ))}
                  </div>
                )}

                {layer.id === 'faq' && (
                  <div className="wl-pv-faq">
                    <div className="wl-pv-faq__row">
                      <span>Sıkça sorulan sorular ve süreç detayları</span>
                      <b>−</b>
                    </div>
                    <div className="wl-pv-faq__row">
                      <span>Teslimat ve özelleştirme seçenekleri</span>
                      <b>+</b>
                    </div>
                  </div>
                )}

                {layer.id === 'footer' && (
                  <div className="wl-pv-footer">
                    <span className="wl-pv-footer__brand">{displayBrand.slice(0, 12).toUpperCase()}</span>
                    <div className="wl-pv-footer__cols">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="wl-wizard-preview__foot">
        <div className="wl-wizard-preview__foot-left">
          <span
            className="wl-wizard-preview__palette-dot"
            style={{ backgroundColor: palette.accent }}
          />
          <span>{palette.label}</span>
        </div>
        <span className="wl-wizard-preview__pill">
          {sector?.label || 'Kurumsal'} ·{' '}
          {device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '1280px'}
        </span>
      </div>
    </aside>
  );
}

export default function WelcomeAiComposer({
  inputRef,
  promptValue,
  onPromptChange,
  onSubmitPrompt,
  onStartAssembledProject,
  onOpenAiSettings,
  isSubmitting = false,
  isAiConnected = false,
  selectedModelLabel = 'Gemini',
  selectedDevice = 'desktop',
  onSelectDevice,
  reduceMotion = false,
  wizardRequestTick = 0,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(() => readOsReducedMotion());
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [stepDirection, setStepDirection] = useState('forward');

  const [brandName, setBrandName] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('kurumsal');
  const [selectedPaletteId, setSelectedPaletteId] = useState('obsidian');
  const [selectedLayerIds, setSelectedLayerIds] = useState([
    'navbar',
    'hero',
    'features',
    'products',
    'faq',
    'footer',
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setOsReducedMotion(Boolean(mq.matches));
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (wizardRequestTick > 0) {
      setWizardStep(1);
      setStepDirection('forward');
      setWizardOpen(true);
    }
  }, [wizardRequestTick]);

  useEffect(() => {
    if (!wizardOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setWizardOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wizardOpen]);

  const motionReduced = Boolean(reduceMotion || osReducedMotion);
  const hasValue = String(promptValue || '').length > 0;

  useEffect(() => {
    if (motionReduced || isFocused || hasValue || wizardOpen) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const inputEl = inputRef?.current;
      if (inputEl && (document.activeElement === inputEl || inputEl.value.length > 0)) {
        return;
      }
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [motionReduced, isFocused, hasValue, wizardOpen, inputRef]);

  const activePlaceholder = motionReduced
    ? ROTATING_PLACEHOLDERS[0]
    : ROTATING_PLACEHOLDERS[placeholderIndex] || ROTATING_PLACEHOLDERS[0];

  const activeSector =
    SECTOR_OPTIONS.find((s) => s.id === selectedSectorId) || SECTOR_OPTIONS[0];
  const activePalette =
    PALETTE_OPTIONS.find((p) => p.id === selectedPaletteId) || PALETTE_OPTIONS[0];

  const orderedSelectedLayers = STEP_LAYERS.filter((layer) =>
    selectedLayerIds.includes(layer.id)
  );

  const inferSectorFromText = (rawText) => {
    const lower = String(rawText || '').toLowerCase();
    if (!lower) return null;
    if (lower.includes('ticaret') || lower.includes('mağaza') || lower.includes('ürün') || lower.includes('butik') || lower.includes('satış') || lower.includes('takı')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'eticaret');
    }
    if (lower.includes('saas') || lower.includes('yazılım') || lower.includes('uygulama') || lower.includes('yapay zeka') || lower.includes('ai')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'saas');
    }
    if (lower.includes('mimar') || lower.includes('emlak') || lower.includes('inşaat') || lower.includes('konut') || lower.includes('villa')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'mimarlik');
    }
    if (lower.includes('kafe') || lower.includes('kahve') || lower.includes('restoran') || lower.includes('menü') || lower.includes('yemek') || lower.includes('gastronomi')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'restoran');
    }
    if (lower.includes('portfolyo') || lower.includes('tasarımcı') || lower.includes('fotoğraf') || lower.includes('kişisel') || lower.includes('ajans')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'portfolyo');
    }
    return null;
  };

  const applySectorDefaults = (sector) => {
    if (!sector) return;
    setSelectedSectorId(sector.id);
    if (sector.defaultPalette) {
      setSelectedPaletteId(sector.defaultPalette);
    }
    if (Array.isArray(sector.defaultLayers)) {
      setSelectedLayerIds(sector.defaultLayers);
    }
  };

  const handleStartWizardFromHero = (event) => {
    event?.preventDefault?.();
    const raw = String(promptValue || '').trim();
    if (raw) {
      const inferred = inferSectorFromText(raw);
      if (inferred) {
        applySectorDefaults(inferred);
      }
    } else {
      onPromptChange(activeSector.defaultPrompt);
    }
    setWizardStep(1);
    setStepDirection('forward');
    setWizardOpen(true);
  };

  const handlePickSectorChip = (sector) => {
    applySectorDefaults(sector);
    onPromptChange(sector.defaultPrompt);
    setWizardStep(1);
    setStepDirection('forward');
    setWizardOpen(true);
  };

  const handleSelectSectorInsideWizard = (sector) => {
    applySectorDefaults(sector);
    const currentPrompt = String(promptValue || '').trim();
    const isDefaultPrompt = SECTOR_OPTIONS.some((s) => s.defaultPrompt === currentPrompt);
    if (!currentPrompt || isDefaultPrompt) {
      onPromptChange(sector.defaultPrompt);
    }
  };

  const goToStep = (nextStep) => {
    if (nextStep === wizardStep || nextStep < 1 || nextStep > 3) return;
    setStepDirection(nextStep > wizardStep ? 'forward' : 'backward');
    setWizardStep(nextStep);
  };

  const handleToggleLayer = (layerId) => {
    setSelectedLayerIds((prev) => {
      if (prev.includes(layerId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== layerId);
      }
      return [...prev, layerId];
    });
  };

  const buildPresetKeysFromSelection = () => {
    const keys = [];
    orderedSelectedLayers.forEach((layer) => {
      if (layer.id === 'navbar') {
        keys.push(activePalette.navPreset || 'nav-corporate-dark');
      } else if (layer.id === 'footer') {
        keys.push(activePalette.footerPreset || 'footer-modern-directory');
      } else if (layer.id === 'faq') {
        keys.push('block-faq-accordion');
        keys.push('block-cta-banner');
      } else {
        keys.push(layer.presetKey);
      }
    });
    return keys;
  };

  const synthesizeBlueprintPrompt = () => {
    const userRaw = String(promptValue || '').trim();
    const cleanBrand = String(brandName || '').trim();
    const brandClause = cleanBrand ? `"${cleanBrand}" markası için ` : '';
    const baseClause = userRaw || `${brandClause}${activeSector.defaultPrompt}`;
    const layersText =
      orderedSelectedLayers.length > 0
        ? orderedSelectedLayers.map((l, idx) => `${idx + 1}) ${l.promptLabel}`).join(', ')
        : '1) Üst menü (Navbar), 2) Hero vitrini, 3) Özellikler, 4) Alt bilgi (Footer)';

    return `${baseClause}. Görsel stil: ${activePalette.promptHint}. Sayfayı yukarıdan aşağıya şu bölümlerle tane tane kurgula: ${layersText}.`;
  };

  const handleAssembleBlocksNow = () => {
    if (!onStartAssembledProject) return;
    const cleanBrand = String(brandName || '').trim();
    const presetKeys = buildPresetKeysFromSelection();
    setWizardOpen(false);
    onStartAssembledProject({
      name: cleanBrand
        ? `${cleanBrand} — ${activeSector.label}`
        : `${activeSector.label} Sitesi`,
      tabName: 'Anasayfa.craft',
      presetKeys,
      backgroundColor: activePalette.bg,
      device: selectedDevice || 'desktop',
      brandName: cleanBrand || activeSector.label,
      heroHeadline: activeSector.defaultHeadline,
      heroSubtitle: String(promptValue || '').trim() || activeSector.defaultPrompt,
    });
  };

  const handleGenerateWithAi = () => {
    if (isSubmitting) return;
    const finalPrompt = synthesizeBlueprintPrompt();
    onPromptChange(finalPrompt);
    const cleanBrand = String(brandName || '').trim();
    setWizardOpen(false);
    onSubmitPrompt(finalPrompt, {
      projectName: cleanBrand
        ? `${cleanBrand} — ${activeSector.label}`
        : `${activeSector.label} Projesi`,
      backgroundColor: activePalette.bg,
      device: selectedDevice || 'desktop',
      brandName: cleanBrand,
      presetKeys: [],
    });
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? document.querySelector('[data-welcome-root]') || document.body
      : null;

  const wizardModalNode =
    wizardOpen && portalTarget
      ? createPortal(
          <div
            className="wl-wizard-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wl-wizard-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setWizardOpen(false);
            }}
          >
            <div className="wl-wizard-dialog">
              <header className="wl-wizard-header">
                <div className="wl-wizard-brand">
                  <span className="wl-wizard-brand__icon" aria-hidden="true">
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div className="wl-wizard-brand__copy">
                    <div className="wl-wizard-brand__title-row">
                      <span className="wl-wizard-brand__title">Site Kurgulayıcı</span>
                      <span className="wl-wizard-brand__badge">STUDIO AI</span>
                    </div>
                    <span className="wl-wizard-brand__sub">
                      Adım adım mimari ve görsel kurgu stüdyosu
                    </span>
                  </div>
                </div>

                <nav className="wl-wizard-stepper" aria-label="Kurgu adımları">
                  {WIZARD_STEPS.map((st, idx) => {
                    const isActive = wizardStep === st.num;
                    const isDone = wizardStep > st.num;
                    return (
                      <React.Fragment key={st.num}>
                        <button
                          type="button"
                          className={`wl-wizard-step-tab ${isActive ? 'is-active' : ''} ${
                            isDone ? 'is-done' : ''
                          }`}
                          onClick={() => goToStep(st.num)}
                        >
                          <span className="wl-wizard-step-tab__num">
                            {isDone ? <Check size={12} strokeWidth={2.8} /> : `0${st.num}`}
                          </span>
                          <span className="wl-wizard-step-tab__label">{st.title}</span>
                        </button>
                        {idx < WIZARD_STEPS.length - 1 && (
                          <span
                            className={`wl-wizard-step-line ${
                              wizardStep > st.num ? 'is-filled' : ''
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </nav>

                <div className="wl-wizard-header__actions">
                  <span className="wl-wizard-esc-pill" aria-hidden="true">
                    ESC
                  </span>
                  <button
                    type="button"
                    className="wl-wizard-close"
                    onClick={() => setWizardOpen(false)}
                    aria-label="Kapat"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>

              <div className="wl-wizard-body">
                <div className="wl-wizard-stage">
                  <div
                    key={wizardStep}
                    className={`wl-wizard-step-pane wl-wizard-step-pane--${stepDirection}`}
                  >
                    {wizardStep === 1 && (
                      <div className="wl-step-content">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 01 / 03 · PROJE KİMLİĞİ & TEMA
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Projenin kimliğini ve renk temasını seçin
                          </h2>
                        </div>

                        {/* Sitenin Amacı (Prompt) & Marka Adı */}
                        <div className="wl-step1-top-row">
                          <div className="wl-field-box">
                            <label
                              className="wl-field-box__label"
                              htmlFor="wl-goal-prompt-input"
                            >
                              <Sparkles size={12} />
                              <span>Sitenin Amacı / Prompt</span>
                            </label>
                            <input
                              id="wl-goal-prompt-input"
                              type="text"
                              className="wl-field-box__input"
                              placeholder="Örn: Modern mimarlık ofisi portfolyo sitesi..."
                              value={promptValue}
                              onChange={(e) => onPromptChange(e.target.value)}
                            />
                          </div>

                          <div className="wl-field-box">
                            <label
                              className="wl-field-box__label"
                              htmlFor="wl-brand-name-input"
                            >
                              <Building2 size={12} />
                              <span>Marka / Proje Adı</span>
                            </label>
                            <input
                              id="wl-brand-name-input"
                              type="text"
                              className="wl-field-box__input"
                              placeholder="Örn: Aurelia, Nova Studio..."
                              value={brandName}
                              onChange={(e) => setBrandName(e.target.value)}
                              maxLength={32}
                            />
                          </div>
                        </div>

                        {/* Sektör / Site Kategorisi Seçimi */}
                        <div className="wl-field-box">
                          <span className="wl-field-box__label">
                            <Compass size={12} />
                            <span>Site Türü & Sektör</span>
                          </span>
                          <div
                            className="wl-sector-grid"
                            role="radiogroup"
                            aria-label="Sektör seçimi"
                          >
                            {SECTOR_OPTIONS.map((sec) => {
                              const Icon = sec.icon;
                              const isSelected = selectedSectorId === sec.id;
                              return (
                                <button
                                  key={sec.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  className={`wl-sector-card ${isSelected ? 'is-active' : ''}`}
                                  onClick={() => handleSelectSectorInsideWizard(sec)}
                                >
                                  <span className="wl-sector-card__icon">
                                    <Icon size={15} strokeWidth={2} />
                                  </span>
                                  <span className="wl-sector-card__copy">
                                    <b className="wl-sector-card__title">{sec.label}</b>
                                    <small className="wl-sector-card__sub">{sec.sub}</small>
                                  </span>
                                  <span
                                    className={`wl-sector-card__check ${
                                      isSelected ? 'is-visible' : ''
                                    }`}
                                    aria-hidden="true"
                                  >
                                    <Check size={10} strokeWidth={3} />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Renk Teması Seçimi (3x2 Yatay Stüdyo Kartları) */}
                        <div className="wl-field-box">
                          <span className="wl-field-box__label">
                            <Palette size={12} />
                            <span>Görsel Stil & Renk Teması</span>
                          </span>
                          <div
                            className="wl-palette-grid"
                            role="radiogroup"
                            aria-label="Renk teması"
                          >
                            {PALETTE_OPTIONS.map((pal) => {
                              const isSelected = selectedPaletteId === pal.id;
                              return (
                                <button
                                  key={pal.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  className={`wl-palette-card ${isSelected ? 'is-active' : ''}`}
                                  style={{ '--pal-accent': pal.accent }}
                                  onClick={() => setSelectedPaletteId(pal.id)}
                                >
                                  <span
                                    className="wl-palette-card__swatch"
                                    style={{
                                      background: `linear-gradient(135deg, ${pal.bg} 45%, ${pal.surface} 100%)`,
                                    }}
                                    aria-hidden="true"
                                  >
                                    <i
                                      className="wl-palette-card__orb"
                                      style={{
                                        backgroundColor: pal.accent,
                                        boxShadow: `0 0 10px ${pal.accent}`,
                                      }}
                                    />
                                  </span>

                                  <span className="wl-palette-card__copy">
                                    <b className="wl-palette-card__title">{pal.label}</b>
                                    <small className="wl-palette-card__sub">{pal.desc}</small>
                                  </span>

                                  <span className="wl-palette-card__right" aria-hidden="true">
                                    <span className="wl-palette-card__mini-dots">
                                      <i style={{ backgroundColor: pal.bg }} />
                                      <i style={{ backgroundColor: pal.accent }} />
                                    </span>
                                    <span
                                      className={`wl-sector-card__check ${
                                        isSelected ? 'is-visible' : ''
                                      }`}
                                    >
                                      <Check size={10} strokeWidth={3} />
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="wl-step-content">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 02 / 03 · SAYFA MİMARİSİ
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Sitenizde yer alacak bölümleri seçin
                          </h2>
                        </div>

                        <div className="wl-preset-bar">
                          <div
                            className="wl-preset-pills"
                            role="group"
                            aria-label="Hazır paketler"
                          >
                            {BLUEPRINT_RECIPES.map((recipe) => {
                              const isMatch =
                                recipe.layers.length === selectedLayerIds.length &&
                                recipe.layers.every((id) => selectedLayerIds.includes(id));
                              return (
                                <button
                                  key={recipe.id}
                                  type="button"
                                  className={`wl-preset-pill ${isMatch ? 'is-active' : ''}`}
                                  onClick={() => setSelectedLayerIds(recipe.layers)}
                                >
                                  {recipe.label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="wl-preset-all-btn"
                            onClick={() => setSelectedLayerIds(STEP_LAYERS.map((l) => l.id))}
                          >
                            Tümünü Seç ({STEP_LAYERS.length})
                          </button>
                        </div>

                        <div
                          className="wl-layer-toggles-grid"
                          role="group"
                          aria-label="Sayfa katmanları"
                        >
                          {STEP_LAYERS.map((layer) => {
                            const Icon = layer.icon || Layers;
                            const isChecked = selectedLayerIds.includes(layer.id);
                            const orderPos = orderedSelectedLayers.findIndex(
                              (l) => l.id === layer.id
                            );
                            return (
                              <button
                                key={layer.id}
                                type="button"
                                aria-pressed={isChecked}
                                className={`wl-layer-toggle ${isChecked ? 'is-selected' : ''}`}
                                onClick={() => handleToggleLayer(layer.id)}
                              >
                                <span className="wl-layer-toggle__icon-box" aria-hidden="true">
                                  <Icon size={15} strokeWidth={2} />
                                </span>
                                <div className="wl-layer-toggle__copy">
                                  <span className="wl-layer-toggle__title">{layer.label}</span>
                                  <span className="wl-layer-toggle__tag">{layer.shortTag}</span>
                                </div>
                                <span className="wl-layer-toggle__badge" aria-hidden="true">
                                  {isChecked ? `${orderPos + 1}` : '+'}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="wl-summary-flow">
                          <span className="wl-summary-flow__label">
                            Aktif Sayfa Akışı ({orderedSelectedLayers.length} Bölüm):
                          </span>
                          <div className="wl-summary-flow__chips">
                            {orderedSelectedLayers.map((layer, idx) => (
                              <span key={layer.id} className="wl-summary-flow__chip">
                                <b>{idx + 1}.</b> {layer.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="wl-step-content">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 03 / 03 · ONAY & BAŞLATMA
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Kurgunuz hazır, nasıl başlatmak istersiniz?
                          </h2>
                        </div>

                        <div className="wl-summary-strip">
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Marka & Tür</span>
                            <strong className="wl-summary-item__val">
                              {String(brandName || '').trim() || activeSector.label}
                            </strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Renk Teması</span>
                            <strong className="wl-summary-item__val">{activePalette.label}</strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Hedef Ekran</span>
                            <strong className="wl-summary-item__val">
                              {selectedDevice === 'mobile'
                                ? 'Mobil (375px)'
                                : selectedDevice === 'tablet'
                                  ? 'Tablet (768px)'
                                  : 'Masaüstü (1280px)'}
                            </strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Mimari</span>
                            <strong className="wl-summary-item__val">
                              {orderedSelectedLayers.length} Katman Seçili
                            </strong>
                          </div>
                        </div>

                        <div className="wl-summary-flow">
                          <span className="wl-summary-flow__label">Sayfa Akışı:</span>
                          <div className="wl-summary-flow__chips">
                            {orderedSelectedLayers.map((layer, idx) => (
                              <span key={layer.id} className="wl-summary-flow__chip">
                                <b>{idx + 1}.</b> {layer.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="wl-launch-cards">
                          <div className="wl-launch-card wl-launch-card--instant">
                            <div className="wl-launch-card__top">
                              <span className="wl-launch-card__icon wl-launch-card__icon--blue">
                                <Layers size={18} strokeWidth={2} />
                              </span>
                              <span className="wl-launch-card__badge">ANINDA KURULUM</span>
                            </div>
                            <h3 className="wl-launch-card__title">Seçili Katmanları Tuvale Diz</h3>
                            <p className="wl-launch-card__desc">
                              Seçtiğiniz {orderedSelectedLayers.length} modüler bileşeni beklemeden
                              doğrudan tuvale yerleştirir.
                            </p>
                            <button
                              type="button"
                              className="wl-launch-card__btn wl-launch-card__btn--assemble"
                              onClick={handleAssembleBlocksNow}
                            >
                              <Zap size={14} strokeWidth={2.2} />
                              <span>Anında Tuvale Diz</span>
                            </button>
                          </div>

                          <div className="wl-launch-card wl-launch-card--ai">
                            <div className="wl-launch-card__top">
                              <span className="wl-launch-card__icon wl-launch-card__icon--grad">
                                <Wand2 size={18} strokeWidth={2} />
                              </span>
                              <span className="wl-launch-card__badge wl-launch-card__badge--ai">
                                GEMINI AI
                              </span>
                            </div>
                            <h3 className="wl-launch-card__title">Yapay Zeka ile Özel Üret</h3>
                            <p className="wl-launch-card__desc">
                              Girdiğiniz amaca, markaya ve seçili katmanlara özel tasarımı Gemini AI
                              ile sıfırdan üretir.
                            </p>
                            <button
                              type="button"
                              className="wl-launch-card__btn wl-launch-card__btn--ai"
                              disabled={isSubmitting}
                              onClick={handleGenerateWithAi}
                            >
                              <Sparkles size={14} strokeWidth={2.2} />
                              <span>AI ile Üret ve Aç</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <footer className="wl-wizard-footer">
                    <div className="wl-wizard-footer__left">
                      {wizardStep > 1 ? (
                        <button
                          type="button"
                          className="welcome-btn welcome-btn--ghost"
                          onClick={() => goToStep(wizardStep - 1)}
                        >
                          <ArrowLeft size={14} strokeWidth={2.1} />
                          <span>Önceki Adım</span>
                        </button>
                      ) : (
                        <span className="wl-wizard-footer__hint">
                          Seçimleriniz sağdaki canlı önizlemeye anında yansır.
                        </span>
                      )}
                    </div>

                    <div className="wl-wizard-footer__right">
                      {wizardStep < 3 ? (
                        <>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ghost"
                            onClick={handleAssembleBlocksNow}
                          >
                            <Zap size={13} strokeWidth={2.1} />
                            <span>Hızlı Diz</span>
                          </button>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ai-build"
                            onClick={() => goToStep(wizardStep + 1)}
                          >
                            <span>Devam Et</span>
                            <ArrowRight size={14} strokeWidth={2.3} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ghost"
                            onClick={handleAssembleBlocksNow}
                          >
                            <Zap size={13} strokeWidth={2.1} />
                            <span>Katmanları Diz</span>
                          </button>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ai-build"
                            disabled={isSubmitting}
                            onClick={handleGenerateWithAi}
                          >
                            <Sparkles size={14} strokeWidth={2.2} />
                            <span>AI ile Üret</span>
                          </button>
                        </>
                      )}
                    </div>
                  </footer>
                </div>

                <LiveWireframePreview
                  palette={activePalette}
                  brandName={brandName}
                  sector={activeSector}
                  device={selectedDevice || 'desktop'}
                  onSelectDevice={onSelectDevice}
                  orderedLayers={orderedSelectedLayers}
                  onToggleLayer={handleToggleLayer}
                  activeStep={wizardStep}
                />
              </div>
            </div>
          </div>,
          portalTarget
        )
      : null;

  return (
    <section
      className="welcome-hero welcome-hero--spotlight"
      aria-labelledby="welcome-hero-heading"
    >
      <div className="welcome-hero__glow" aria-hidden="true" />
      <div className="welcome-hero__grid" aria-hidden="true" />

      <div className="welcome-hero__center">
        <span className="welcome-hero__kicker-pill">
          <Sparkles size={11} strokeWidth={2.3} aria-hidden="true" />
          <span>AI WEB CRAFTER</span>
        </span>

        <h1 id="welcome-hero-heading" className="welcome-hero__title">
          Hayal et, <span className="welcome-hero__title-accent">tane tane inşa et.</span>
        </h1>

        <div className="welcome-composer-ring">
          <form className="welcome-composer-form" onSubmit={handleStartWizardFromHero}>
            <span className="welcome-composer__icon" aria-hidden="true">
              <Sparkles size={20} strokeWidth={2.1} />
            </span>

            <input
              ref={inputRef}
              type="text"
              className="welcome-composer__input"
              aria-label="Sitenizin amacını yazın"
              value={promptValue}
              onChange={(e) => onPromptChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={activePlaceholder}
            />

            <div className="welcome-composer__actions">
              <button
                type="button"
                className="welcome-gemini-chip"
                onClick={onOpenAiSettings}
                title="Gemini modeli ve API anahtarı"
              >
                <span
                  className={`welcome-status-dot ${isAiConnected ? 'welcome-status-dot--connected' : ''}`}
                  aria-hidden="true"
                />
                <span>{selectedModelLabel}</span>
              </button>

              <button
                type="submit"
                className="welcome-composer__submit"
                disabled={isSubmitting}
              >
                <span>Kurgula</span>
                <ArrowRight size={15} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>

        <div className="welcome-chips" role="group" aria-label="Hızlı kategoriler">
          {SECTOR_OPTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                type="button"
                className="welcome-chip"
                onClick={() => handlePickSectorChip(sec)}
              >
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {wizardModalNode}
    </section>
  );
}
