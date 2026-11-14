import React from 'react';
import { TEMPLATE_BLUEPRINTS } from '../../data/templateBlueprints';
import { getWelcomeAsset } from '../welcomeAssets';

export const MOCK_RECENT_PROJECTS = [
  {
    id: 'mock-doga',
    templateSlug: 'eticaret',
    name: 'Aurelia Zümrüt Takı Atölyesi',
    category: 'Lüks Mağaza',
    meta: '7 Bölüm · Şampanya Altını',
    accentColor: TEMPLATE_BLUEPRINTS.eticaret.accentColor,
    assetKey: 'cover-demo-1',
    variant: '1',
    featured: true,
    presetKeys: TEMPLATE_BLUEPRINTS.eticaret.presetKeys,
    backgroundColor: TEMPLATE_BLUEPRINTS.eticaret.backgroundColor,
    brandName: TEMPLATE_BLUEPRINTS.eticaret.brandName,
    heroHeadline: TEMPLATE_BLUEPRINTS.eticaret.content.heroHeadline,
  },
  {
    id: 'mock-villa',
    templateSlug: 'emlak',
    name: 'Nova Villa & Mimarlık Vitrini',
    category: 'Gayrimenkul',
    meta: '7 Bölüm · Kehribar & Koyu',
    accentColor: TEMPLATE_BLUEPRINTS.emlak.accentColor,
    assetKey: 'cover-demo-2',
    variant: '2',
    featured: false,
    presetKeys: TEMPLATE_BLUEPRINTS.emlak.presetKeys,
    backgroundColor: TEMPLATE_BLUEPRINTS.emlak.backgroundColor,
    brandName: TEMPLATE_BLUEPRINTS.emlak.brandName,
    heroHeadline: TEMPLATE_BLUEPRINTS.emlak.content.heroHeadline,
  },
  {
    id: 'mock-bulten',
    templateSlug: 'haber',
    name: 'Lumen Editoryal Dergi & Blog',
    category: 'Medya & Dergi',
    meta: '7 Bölüm · Editoryal Serif',
    accentColor: TEMPLATE_BLUEPRINTS.haber.accentColor,
    assetKey: 'cover-demo-3',
    variant: '3',
    featured: false,
    presetKeys: TEMPLATE_BLUEPRINTS.haber.presetKeys,
    backgroundColor: TEMPLATE_BLUEPRINTS.haber.backgroundColor,
    brandName: TEMPLATE_BLUEPRINTS.haber.brandName,
    heroHeadline: TEMPLATE_BLUEPRINTS.haber.content.heroHeadline,
  },
  {
    id: 'mock-topluluk',
    templateSlug: 'saas',
    name: 'Studio Pro SaaS & AI Platformu',
    category: 'SaaS & AI',
    meta: '7 Bölüm · Siber Okyanus',
    accentColor: TEMPLATE_BLUEPRINTS.saas.accentColor,
    assetKey: 'cover-demo-4',
    variant: '4',
    featured: false,
    presetKeys: TEMPLATE_BLUEPRINTS.saas.presetKeys,
    backgroundColor: TEMPLATE_BLUEPRINTS.saas.backgroundColor,
    brandName: TEMPLATE_BLUEPRINTS.saas.brandName,
    heroHeadline: TEMPLATE_BLUEPRINTS.saas.content.heroHeadline,
  },
  {
    id: 'mock-gastronomi',
    templateSlug: 'restoran',
    name: 'Sora Gastronomi & Şef Restoranı',
    category: 'Fine Dining',
    meta: '7 Bölüm · Bakır & Espresso',
    accentColor: TEMPLATE_BLUEPRINTS.restoran.accentColor,
    assetKey: 'cover-demo-1',
    variant: '5',
    featured: false,
    presetKeys: TEMPLATE_BLUEPRINTS.restoran.presetKeys,
    backgroundColor: TEMPLATE_BLUEPRINTS.restoran.backgroundColor,
    brandName: TEMPLATE_BLUEPRINTS.restoran.brandName,
    heroHeadline: TEMPLATE_BLUEPRINTS.restoran.content.heroHeadline,
  },
];

/**
 * Her şablon ve vitrin projesi için gerçek fotoğraf, marka tipografisi,
 * mini üst menü, hero sahnesi ve 3'lü vitrin kartlarından oluşan canlı mini-site önizlemesi.
 */
export function WelcomeLiveSiteArtboard({ slug = 'eticaret', fallbackAssetKey = 'cover-demo-1' }) {
  const bp = TEMPLATE_BLUEPRINTS[slug] || TEMPLATE_BLUEPRINTS.eticaret;
  const c = bp.content || {};
  const fallbackUrl = getWelcomeAsset(fallbackAssetKey || bp.coverAsset || 'cover-demo-1');
  const heroPhoto = c.heroImage || fallbackUrl;
  const shortBrand = String(bp.brandName || 'CRAFT').split('•')[0].trim();
  const topStat = c.kpis?.[0]?.val || '';

  return (
    <div
      className="wl-live-artboard"
      style={{
        '--ab-bg': bp.backgroundColor || '#0b0a09',
        '--ab-hero': bp.heroGradient || 'linear-gradient(135deg, #12100d, #1b1713)',
        '--ab-card': bp.cardBg || '#171410',
        '--ab-border': bp.borderColor || '#2d261e',
        '--ab-accent': bp.accentColor || '#e5c465',
        '--ab-accent2': bp.accentSecondary || '#f3dc99',
        '--ab-heading': bp.headingColor || '#f8fafc',
        '--ab-muted': bp.mutedColor || '#a1a1aa',
        '--ab-font': bp.fontHeading || "'Inter', system-ui, sans-serif",
      }}
      aria-hidden="true"
    >
      {/* Sade Üst Menü Şeridi */}
      <div className="wl-live-artboard__nav">
        <span className="wl-live-artboard__brand">
          <i className="wl-live-artboard__mark">{bp.brandInitial || 'A'}</i>
          <b>{shortBrand}</b>
        </span>
        <div className="wl-live-artboard__navdots">
          <i />
          <i />
          <i />
        </div>
        <span className="wl-live-artboard__navcta">{c.navCta || 'Başla'}</span>
      </div>

      {/* Ferah Split Hero Sahnesi */}
      <div className="wl-live-artboard__hero">
        <div className="wl-live-artboard__herocopy">
          <span className="wl-live-artboard__kicker">{bp.category}</span>
          <strong className="wl-live-artboard__headline">{c.heroHeadline}</strong>
          <div className="wl-live-artboard__actions">
            <span className="wl-live-artboard__btn-pri">{c.heroPrimaryCta}</span>
            {topStat && <span className="wl-live-artboard__stat">{topStat}</span>}
          </div>
        </div>

        <div className="wl-live-artboard__herophoto">
          {heroPhoto && (
            <img
              src={heroPhoto}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                if (fallbackUrl && e.currentTarget.src !== fallbackUrl) {
                  e.currentTarget.src = fallbackUrl;
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function WelcomeMockThumbnailSvg({ variant = '1', accentColor = null }) {
  void variant;
  void accentColor;
  return <WelcomeLiveSiteArtboard slug="eticaret" />;
}
