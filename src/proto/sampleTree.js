/**
 * Faz 1 prototipi için örnek akış + katman şeması ağacı.
 * İçerik:
 * 1) hero-split section: metin + görsel (row -> sm'de stack) + yüzde konumlu dekoratif blob layer
 * 2) feature-grid-3 section: 3 sütunlu özellik ızgarası (md: 3 sütun, sm: 1 sütun)
 * Not: Akış düğümlerinde sabit piksel yükseklik (px) kullanılmaz; varsayılan hug/min-height kullanılır.
 */

// Çevrimdışı ve sandbox iframe içinde sorunsuz çalışan yerleşik SVG illüstrasyon veri URL'si
const HERO_VISUAL_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="640" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1E1B18"/>
          <stop offset="55%" stop-color="#2D251E"/>
          <stop offset="100%" stop-color="#141312"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="48%">
          <stop offset="0%" stop-color="#E6C78B" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#E6C78B" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="accentCard" x1="120" y1="100" x2="340" y2="270" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F6E2B3"/>
          <stop offset="55%" stop-color="#C99B49"/>
          <stop offset="100%" stop-color="#8A6123"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" rx="28" fill="url(#bg)"/>
      <circle cx="320" cy="220" r="210" fill="url(#glow)"/>
      <rect x="86" y="74" width="468" height="292" rx="22" fill="#FFFFFF" fill-opacity="0.06" stroke="#E6C78B" stroke-opacity="0.32" stroke-width="2"/>
      <rect x="118" y="108" width="198" height="146" rx="14" fill="url(#accentCard)" fill-opacity="0.9"/>
      <rect x="336" y="108" width="186" height="66" rx="12" fill="#FFFFFF" fill-opacity="0.14"/>
      <rect x="336" y="188" width="186" height="66" rx="12" fill="#FFFFFF" fill-opacity="0.09"/>
      <rect x="118" y="274" width="404" height="58" rx="12" fill="#FFFFFF" fill-opacity="0.07"/>
      <rect x="44" y="388" width="224" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.08" stroke="#E6C78B" stroke-opacity="0.35"/>
      <text x="68" y="415" fill="#F4E3C1" font-family="Georgia, serif" font-size="16" letter-spacing="1.2">MODERN VİTRİN DÜZENİ</text>
    </svg>`
  );

export const sampleTree = {
  id: 'page-home',
  type: 'page',
  placement: 'flow',
  layout: { mode: 'stack' },
  size: { w: 'fill', h: 'hug' },
  props: {
    bg: 'surface',
    color: 'text',
    theme: {
      primary: '#1A1816',
      accent: '#9C7330',
      surface: '#FAF8F5',
      text: '#1A1816',
      muted: '#575049',
      fontFamily: 'sans',
    },
  },
  children: [
    {
      id: 'hero-section',
      type: 'section',
      placement: 'flow',
      layout: { mode: 'stack', padding: 'xl', align: 'center' },
      size: { w: 'fill', h: 'hug' },
      props: {
        bg: '#F7EFE2',
        borderBottom: '1px solid #E6DDD0',
      },
      children: [
        // Section'a göre yüzde konumlu dekoratif serbest katman
        {
          id: 'hero-blob',
          type: 'blob',
          placement: 'layer',
          pos: { x: 82, y: 10, rot: 15 },
          size: { w: '140px', h: '140px' },
          props: {
            bg: '#D4AF37',
            opacity: 0.35,
            zIndex: 3,
          },
        },
        {
          id: 'hero-container',
          type: 'container',
          placement: 'flow',
          layout: { mode: 'row', gap: 'xl', align: 'center', justify: 'between' },
          size: { w: 'fill', h: 'hug' },
          props: {
            maxWidth: '1120px',
            zIndex: 2,
          },
          responsive: {
            sm: {
              layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
            },
          },
          children: [
            {
              id: 'hero-copy',
              type: 'container',
              placement: 'flow',
              layout: { mode: 'stack', gap: 'md', align: 'start' },
              size: { w: 'fill', h: 'hug' },
              children: [
                {
                  id: 'hero-eyebrow',
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'hug', h: 'hug' },
                  props: {
                    tag: 'span',
                    text: 'MODERN WEB DENEYİMİ · 2026',
                    fontVariant: 'xs',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    color: 'accent',
                    bg: '#F2E5CB',
                    padding: 'xs',
                    radius: '999px',
                  },
                },
                {
                  id: 'hero-title',
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'h1',
                    text: 'Markanızı Öne Çıkarın',
                    fontVariant: 'h1',
                    fontFamily: 'serif',
                    fontWeight: 600,
                    lineHeight: 1.12,
                    color: 'text',
                  },
                },
                {
                  id: 'hero-subtitle',
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'p',
                    text: 'Fikirlerinizi birkaç dakikada her ekrana uyumlu, hızlı ve düzenli web sayfalarına dönüştürün. Akış tabanlı tasarım düzeniyle her cihazda kusursuz görünür.',
                    fontVariant: 'body-lg',
                    lineHeight: 1.65,
                    color: 'muted',
                  },
                },
                {
                  id: 'hero-actions',
                  type: 'container',
                  placement: 'flow',
                  layout: { mode: 'row', gap: 'sm', align: 'center', wrap: 'wrap' },
                  size: { w: 'fill', h: 'hug' },
                  children: [
                    {
                      id: 'hero-cta-primary',
                      type: 'button',
                      placement: 'flow',
                      size: { w: 'hug', h: 'hug' },
                      props: {
                        label: 'Hemen Başlayın',
                        href: '#ozellikler',
                        bg: 'primary',
                        color: 'surface',
                        padding: 'xs',
                        radius: '999px',
                        fontWeight: 600,
                      },
                    },
                    {
                      id: 'hero-cta-secondary',
                      type: 'button',
                      placement: 'flow',
                      size: { w: 'hug', h: 'hug' },
                      props: {
                        label: 'Nasıl Çalışır?',
                        href: '#hikaye',
                        bg: 'surface',
                        color: 'primary',
                        border: '1px solid #C8BFB4',
                        padding: 'xs',
                        radius: '999px',
                        fontWeight: 500,
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'hero-media',
              type: 'container',
              placement: 'flow',
              layout: { mode: 'stack', align: 'center', justify: 'center' },
              size: { w: 'fill', h: 'hug' },
              children: [
                {
                  id: 'hero-image',
                  type: 'image',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    src: HERO_VISUAL_DATA_URI,
                    alt: 'Modern web vitrini soyut tasarım önizlemesi',
                    radius: '24px',
                    shadow: 'lg',
                    aspectRatio: '4 / 3',
                    objectFit: 'cover',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'features-section',
      type: 'section',
      placement: 'flow',
      layout: { mode: 'stack', padding: 'xl', align: 'center' },
      size: { w: 'fill', h: 'hug' },
      props: {
        bg: '#FFFFFF',
      },
      children: [
        {
          id: 'features-container',
          type: 'container',
          placement: 'flow',
          layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
          size: { w: 'fill', h: 'hug' },
          props: {
            maxWidth: '1120px',
          },
          children: [
            {
              id: 'features-header',
              type: 'container',
              placement: 'flow',
              layout: { mode: 'stack', gap: 'xs', align: 'start' },
              size: { w: 'fill', h: 'hug' },
              children: [
                {
                  id: 'features-eyebrow',
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'hug', h: 'hug' },
                  props: {
                    tag: 'span',
                    text: 'HİZMETLERİMİZ',
                    fontVariant: 'xs',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: '#9C7330',
                  },
                },
                {
                  id: 'features-title',
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'h2',
                    text: 'Neden Biz?',
                    fontVariant: 'h2',
                    fontFamily: 'serif',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: '#1A1816',
                  },
                },
              ],
            },
            {
              id: 'features-grid',
              type: 'container',
              placement: 'flow',
              layout: {
                mode: 'grid',
                columns: 3,
                gap: 'md',
              },
              size: { w: 'fill', h: 'hug' },
              responsive: {
                md: {
                  layout: { columns: 2, gap: 'md' },
                },
                sm: {
                  layout: { columns: 1, gap: 'md' },
                },
              },
              children: [
                {
                  id: 'feature-card-1',
                  type: 'container',
                  placement: 'flow',
                  layout: { mode: 'stack', gap: 'sm', padding: 'lg', align: 'start' },
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    bg: 'surface',
                    border: '1px solid #EAE3D9',
                    radius: '20px',
                  },
                  children: [
                    {
                      id: 'feature-card-1-num',
                      type: 'text',
                      size: { w: 'hug', h: 'hug' },
                      props: {
                        tag: 'span',
                        text: '01',
                        fontVariant: 'xs',
                        fontWeight: 700,
                        color: 'accent',
                        bg: '#F2E5CB',
                        padding: 'xs',
                        radius: '999px',
                      },
                    },
                    {
                      id: 'feature-card-1-title',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'h3',
                        text: 'Esnek Bölüm Akışı',
                        fontVariant: 'h3',
                        fontWeight: 600,
                        color: 'text',
                      },
                    },
                    {
                      id: 'feature-card-1-desc',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'p',
                        text: 'Masaüstü, tablet ve mobil görünüm kurallarına uyumlu akıllı grid ve yığın düzenleri.',
                        fontVariant: 'body',
                        lineHeight: 1.6,
                        color: 'muted',
                      },
                    },
                  ],
                },
                {
                  id: 'feature-card-2',
                  type: 'container',
                  placement: 'flow',
                  layout: { mode: 'stack', gap: 'sm', padding: 'lg', align: 'start' },
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    bg: 'surface',
                    border: '1px solid #EAE3D9',
                    radius: '20px',
                  },
                  children: [
                    {
                      id: 'feature-card-2-num',
                      type: 'text',
                      size: { w: 'hug', h: 'hug' },
                      props: {
                        tag: 'span',
                        text: '02',
                        fontVariant: 'xs',
                        fontWeight: 700,
                        color: 'accent',
                        bg: '#F2E5CB',
                        padding: 'xs',
                        radius: '999px',
                      },
                    },
                    {
                      id: 'feature-card-2-title',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'h3',
                        text: 'Hızlı Özelleştirme',
                        fontVariant: 'h3',
                        fontWeight: 600,
                        color: 'text',
                      },
                    },
                    {
                      id: 'feature-card-2-desc',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'p',
                        text: 'Tipografi, renk paleti ve içerik bloklarını kod yazmadan tek noktadan kolayca uyarlayın.',
                        fontVariant: 'body',
                        lineHeight: 1.6,
                        color: 'muted',
                      },
                    },
                  ],
                },
                {
                  id: 'feature-card-3',
                  type: 'container',
                  placement: 'flow',
                  layout: { mode: 'stack', gap: 'sm', padding: 'lg', align: 'start' },
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    bg: 'surface',
                    border: '1px solid #EAE3D9',
                    radius: '20px',
                  },
                  children: [
                    {
                      id: 'feature-card-3-num',
                      type: 'text',
                      size: { w: 'hug', h: 'hug' },
                      props: {
                        tag: 'span',
                        text: '03',
                        fontVariant: 'xs',
                        fontWeight: 700,
                        color: 'accent',
                        bg: '#F2E5CB',
                        padding: 'xs',
                        radius: '999px',
                      },
                    },
                    {
                      id: 'feature-card-3-title',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'h3',
                        text: 'Tek Kaynak Çıktı',
                        fontVariant: 'h3',
                        fontWeight: 600,
                        color: 'text',
                      },
                    },
                    {
                      id: 'feature-card-3-desc',
                      type: 'text',
                      size: { w: 'fill', h: 'hug' },
                      props: {
                        tag: 'p',
                        text: 'Editörde gördüğünüz tasarım ile yayınlanan sayfa arasında piksel düzeyinde tutarlılık sağlar.',
                        fontVariant: 'body',
                        lineHeight: 1.6,
                        color: 'muted',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export default sampleTree;
