import {
  sanitizeNode,
  sanitizePlainText,
  validateButtonHref,
  validateImageSrc,
} from './schema.js';

/**
 * Section preset üreteci (saf, React'siz).
 * - Masaüstü-öncelikli şema üretir (`responsive.md` / `responsive.sm` yalnızca değişen alanlar).
 * - Hiçbir akış düğümünde sabit `px` yükseklik kullanmaz (`hug`).
 * - Dekoratif serbest katman (`placement: 'layer'`) yalnızca `hero-split` içinde yer alır.
 * - Varsayılan içerikler sektörden bağımsız genel amaçlı Türkçe vitrin temasındadır.
 */

const DEFAULT_HERO_SVG_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="640" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1E1B18"/>
          <stop offset="100%" stop-color="#352B21"/>
        </linearGradient>
        <linearGradient id="accent" x1="170" y1="90" x2="470" y2="370" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F7E5BA"/>
          <stop offset="55%" stop-color="#C99B49"/>
          <stop offset="100%" stop-color="#8A6123"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" rx="28" fill="url(#g1)"/>
      <rect x="88" y="76" width="464" height="288" rx="22" fill="#FFFFFF" fill-opacity="0.06" stroke="#E6C78B" stroke-opacity="0.32" stroke-width="2"/>
      <rect x="120" y="112" width="196" height="142" rx="14" fill="url(#accent)" fill-opacity="0.9"/>
      <rect x="336" y="112" width="184" height="64" rx="12" fill="#FFFFFF" fill-opacity="0.14"/>
      <rect x="336" y="190" width="184" height="64" rx="12" fill="#FFFFFF" fill-opacity="0.09"/>
      <rect x="120" y="274" width="400" height="54" rx="12" fill="#FFFFFF" fill-opacity="0.07"/>
      <text x="52" y="422" fill="#F4E3C1" font-family="Georgia, serif" font-size="16" letter-spacing="1.4">MODERN VİTRİN DÜZENİ</text>
    </svg>`
  );

let fallbackSeq = 0;

function createDefaultIdGen() {
  return (prefix = 'n') => {
    fallbackSeq += 1;
    const cleanPrefix = String(prefix || 'n').replace(/[^a-zA-Z0-9_-]/g, '') || 'n';
    return `${cleanPrefix}-${fallbackSeq}`;
  };
}

function makeUniqueIdFactory(idGen) {
  const fn = typeof idGen === 'function' ? idGen : createDefaultIdGen();
  const used = new Set();
  return (hint = 'node') => {
    const cleanHint = String(hint || 'node').replace(/[^a-zA-Z0-9_-]/g, '') || 'node';
    let candidate = String(fn(cleanHint) || '');
    if (!candidate) {
      fallbackSeq += 1;
      candidate = `${cleanHint}-${fallbackSeq}`;
    }
    if (used.has(candidate)) {
      let suffix = 2;
      while (used.has(`${candidate}-${suffix}`)) {
        suffix += 1;
      }
      candidate = `${candidate}-${suffix}`;
    }
    used.add(candidate);
    return candidate;
  };
}

function cleanText(val, fallback, maxLen = 240) {
  if (typeof val !== 'string') return fallback;
  const cleaned = sanitizePlainText(val, maxLen).trim();
  return cleaned || fallback;
}

function clampList(list, max = 6) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, max);
}

const PRESET_METADATA = {
  'hero-split': {
    name: 'hero-split',
    title: 'İki Sütunlu Hero',
    description: 'Sol tarafta başlık ve CTA butonları, sağda ürün görseli ve dekoratif katman blob içeren açılış bölümü.',
    propsSchema: {
      eyebrow: 'string (maks 80 karakter, opsiyonel)',
      title: 'string (maks 160 karakter)',
      subtitle: 'string (maks 400 karakter)',
      buttonText: 'string (maks 60 karakter)',
      buttonHref: 'güvenli URL veya #çapa',
      secondaryButtonText: 'string (maks 60 karakter, opsiyonel)',
      secondaryButtonHref: 'güvenli URL veya #çapa',
      imageSrc: 'https: veya data:image/ URL',
      imageAlt: 'string (görsel alt metni)',
    },
  },
  'feature-grid-3': {
    name: 'feature-grid-3',
    title: '3 Sütunlu Özellik Izgarası',
    description: 'Masaüstünde 3, tablette 2, mobilde 1 sütuna düşen değer ve hizmet kartları bölümü.',
    propsSchema: {
      eyebrow: 'string (opsiyonel)',
      title: 'string (maks 160 karakter)',
      subtitle: 'string (maks 300 karakter, opsiyonel)',
      items: 'en fazla 6 öğelik [{ title, description, badge? }] listesi',
    },
  },
  'pricing-3col': {
    name: 'pricing-3col',
    title: '3 Sütunlu Fiyatlandırma / Paketler',
    description: 'Farklı ölçeklere yönelik paket ve planları karşılaştıran 3 sütunlu responsive fiyat kartları.',
    propsSchema: {
      eyebrow: 'string (opsiyonel)',
      title: 'string (maks 160 karakter)',
      subtitle: 'string (maks 300 karakter, opsiyonel)',
      plans: 'en fazla 6 öğelik [{ name, price, description, buttonText?, featured? }] listesi',
    },
  },
  testimonial: {
    name: 'testimonial',
    title: 'Müşteri Yorumları / Deneyim',
    description: 'Kullanıcı hikâyeleri ve doğrulanmış alıntıları sunan düzenli referans bölümü.',
    propsSchema: {
      eyebrow: 'string (opsiyonel)',
      title: 'string (maks 160 karakter)',
      items: 'en fazla 6 öğelik [{ quote, author, role? }] listesi',
    },
  },
  'cta-banner': {
    name: 'cta-banner',
    title: 'Harekete Geçirici Bant (CTA)',
    description: 'Hemen başlama veya iletişim yönlendirmesi için yüksek kontrastlı yatay çağrı şeridi.',
    propsSchema: {
      eyebrow: 'string (opsiyonel)',
      title: 'string (maks 160 karakter)',
      subtitle: 'string (maks 280 karakter)',
      buttonText: 'string (maks 60 karakter)',
      buttonHref: 'güvenli URL veya #çapa',
    },
  },
  'footer-4col': {
    name: 'footer-4col',
    title: '4 Sütunlu Altbilgi (Footer)',
    description: 'Marka özeti ve bağlantı kolonlarından oluşan 4 sütunlu altbilgi bölümü (md: 2, sm: 1).',
    propsSchema: {
      brandName: 'string (maks 80 karakter)',
      brandDescription: 'string (maks 240 karakter)',
      copyright: 'string (maks 120 karakter)',
      columns: 'en fazla 6 öğelik [{ title, links: string[] }] listesi',
    },
  },
};

export function listPresets() {
  return Object.values(PRESET_METADATA);
}

function buildHeroSplit(rawProps = {}, nextId) {
  const eyebrow = cleanText(rawProps.eyebrow, 'YENİ NESİL VİTRİN · 2026', 80);
  const title = cleanText(
    rawProps.title,
    'Markanızı Öne Çıkarın',
    160
  );
  const subtitle = cleanText(
    rawProps.subtitle,
    'Fikrinizi birkaç dakika içinde her ekrana uyumlu, düzenli ve etkileyici bir web deneyimine dönüştürün. Temiz bileşen yapısıyla kontrol sizde.',
    400
  );
  const btnText = cleanText(rawProps.buttonText, 'Hemen Başlayın', 60);
  const btnHrefCheck = validateButtonHref(rawProps.buttonHref || '#ozellikler');
  const btnHref = btnHrefCheck.ok ? btnHrefCheck.value : '#ozellikler';

  const secBtnText =
    rawProps.secondaryButtonText !== undefined
      ? cleanText(rawProps.secondaryButtonText, 'İletişime Geç', 60)
      : 'Nasıl Çalışır?';
  const secBtnHrefCheck = validateButtonHref(rawProps.secondaryButtonHref || '#nasil-calisir');
  const secBtnHref = secBtnHrefCheck.ok ? secBtnHrefCheck.value : '#nasil-calisir';

  const srcCheck = validateImageSrc(rawProps.imageSrc);
  const imgSrc = srcCheck.ok ? srcCheck.value : DEFAULT_HERO_SVG_URI;
  const imgAlt = cleanText(rawProps.imageAlt, 'Modern web vitrini soyut tasarım önizlemesi', 200);

  return {
    id: nextId('hero-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xl', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: {
      bg: 'surface',
      borderBottom: '1px solid #E6DDD0',
    },
    children: [
      {
        id: nextId('hero-blob'),
        type: 'blob',
        placement: 'layer',
        pos: { x: 84, y: 14, rot: 14 },
        size: { w: '140px', h: '140px' },
        props: {
          bg: 'accent',
          opacity: 0.25,
          zIndex: 1,
        },
      },
      {
        id: nextId('hero-wrap'),
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
            id: nextId('hero-copy'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', gap: 'md', align: 'start' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('hero-eyebrow'),
                type: 'text',
                placement: 'flow',
                size: { w: 'hug', h: 'hug' },
                props: {
                  tag: 'span',
                  text: eyebrow,
                  fontVariant: 'xs',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: 'accent',
                  bg: '#F2E5CB',
                  padding: 'xs',
                  radius: '999px',
                },
              },
              {
                id: nextId('hero-title'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'h1',
                  text: title,
                  fontVariant: 'h1',
                  fontFamily: 'serif',
                  fontWeight: 600,
                  lineHeight: 1.12,
                  color: 'text',
                },
              },
              {
                id: nextId('hero-subtitle'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'p',
                  text: subtitle,
                  fontVariant: 'body-lg',
                  lineHeight: 1.65,
                  color: 'muted',
                },
              },
              {
                id: nextId('hero-actions'),
                type: 'container',
                placement: 'flow',
                layout: { mode: 'row', gap: 'sm', align: 'center', wrap: 'wrap' },
                size: { w: 'fill', h: 'hug' },
                children: [
                  {
                    id: nextId('hero-btn-primary'),
                    type: 'button',
                    placement: 'flow',
                    size: { w: 'hug', h: 'hug' },
                    props: {
                      label: btnText,
                      href: btnHref,
                      bg: 'primary',
                      color: 'surface',
                      padding: 'xs',
                      radius: '999px',
                      fontWeight: 600,
                    },
                  },
                  {
                    id: nextId('hero-btn-secondary'),
                    type: 'button',
                    placement: 'flow',
                    size: { w: 'hug', h: 'hug' },
                    props: {
                      label: secBtnText,
                      href: secBtnHref,
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
            id: nextId('hero-media'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', align: 'center', justify: 'center' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('hero-image'),
                type: 'image',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  src: imgSrc,
                  alt: imgAlt,
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
  };
}

function buildFeatureGrid3(rawProps = {}, nextId) {
  const eyebrow = cleanText(rawProps.eyebrow, 'HİZMETLERİMİZ', 80);
  const title = cleanText(rawProps.title, 'Neden Biz?', 160);
  const subtitle = rawProps.subtitle
    ? cleanText(rawProps.subtitle, '', 300)
    : 'İlk fikirden yayına kadar her aşamada hız, netlik ve sürdürülebilir kalite sunuyoruz.';

  const defaultItems = [
    {
      badge: '01',
      title: 'Esnek ve Akıllı Düzen',
      description: 'Masaüstü, tablet ve mobil ekranlarda kendiliğinden hizalanan modern bölüm yapısı.',
    },
    {
      badge: '02',
      title: 'Yüksek Performanslı Altyapı',
      description: 'Temiz kod çıktısı ve optimize edilmiş varlıklarla her cihazda hızlı yüklenen sayfalar.',
    },
    {
      badge: '03',
      title: 'Sürdürülebilir Destek',
      description: 'Büyüyen içerik ve ekip ihtiyaçlarınıza kolayca uyum sağlayan güncellenebilir bileşenler.',
    },
  ];

  const inputItems = clampList(rawProps.items || rawProps.cards, 6);
  const items =
    inputItems && inputItems.length > 0
      ? inputItems.map((item, idx) => ({
          badge: cleanText(item?.badge, String(idx + 1).padStart(2, '0'), 16),
          title: cleanText(item?.title, `Özellik ${idx + 1}`, 100),
          description: cleanText(item?.description, 'Modüler bileşen yapısıyla uyumlu içerik detayı.', 300),
        }))
      : defaultItems;

  return {
    id: nextId('feat-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xl', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: { bg: '#FFFFFF' },
    children: [
      {
        id: nextId('feat-wrap'),
        type: 'container',
        placement: 'flow',
        layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
        size: { w: 'fill', h: 'hug' },
        props: { maxWidth: '1120px' },
        children: [
          {
            id: nextId('feat-header'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', gap: 'xs', align: 'start' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('feat-eyebrow'),
                type: 'text',
                placement: 'flow',
                size: { w: 'hug', h: 'hug' },
                props: {
                  tag: 'span',
                  text: eyebrow,
                  fontVariant: 'xs',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'accent',
                },
              },
              {
                id: nextId('feat-title'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'h2',
                  text: title,
                  fontVariant: 'h2',
                  fontFamily: 'serif',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: 'text',
                },
              },
              {
                id: nextId('feat-subtitle'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'p',
                  text: subtitle,
                  fontVariant: 'body',
                  lineHeight: 1.6,
                  color: 'muted',
                },
              },
            ],
          },
          {
            id: nextId('feat-grid'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'grid', columns: 3, gap: 'md' },
            size: { w: 'fill', h: 'hug' },
            responsive: {
              md: { layout: { columns: 2, gap: 'md' } },
              sm: { layout: { columns: 1, gap: 'md' } },
            },
            children: items.map((item) => ({
              id: nextId('feat-card'),
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
                  id: nextId('feat-badge'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'hug', h: 'hug' },
                  props: {
                    tag: 'span',
                    text: item.badge,
                    fontVariant: 'xs',
                    fontWeight: 700,
                    color: 'accent',
                    bg: '#F2E5CB',
                    padding: 'xs',
                    radius: '999px',
                  },
                },
                {
                  id: nextId('feat-card-title'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'h3',
                    text: item.title,
                    fontVariant: 'h3',
                    fontWeight: 600,
                    color: 'text',
                  },
                },
                {
                  id: nextId('feat-card-desc'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'p',
                    text: item.description,
                    fontVariant: 'body',
                    lineHeight: 1.6,
                    color: 'muted',
                  },
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function buildPricing3Col(rawProps = {}, nextId) {
  const eyebrow = cleanText(rawProps.eyebrow, 'PLANLAR VE PAKETLER', 80);
  const title = cleanText(rawProps.title, 'İhtiyacınıza Uygun Planı Seçin', 160);
  const subtitle = cleanText(
    rawProps.subtitle,
    'Küçük ekiplerden büyük organizasyonlara kadar her ölçekte şeffaf ve esnek seçenekler.',
    300
  );

  const defaultPlans = [
    {
      name: 'Başlangıç',
      price: 'Ücretsiz',
      description: 'Kişisel projeler ve temel vitrin sayfaları için gereken tüm çekirdek özellikler.',
      buttonText: 'Planı Seç',
      featured: false,
    },
    {
      name: 'Profesyonel',
      price: '490 ₺ / ay',
      description: 'Büyüyen markalar için çoklu sayfa, gelişmiş bileşenler ve öncelikli destek.',
      buttonText: 'Hemen Başlayın',
      featured: true,
    },
    {
      name: 'Kurumsal',
      price: 'Özel Teklif',
      description: 'Geniş ekipler, özel entegrasyonlar ve kurumsal tasarım standartları için tam paket.',
      buttonText: 'İletişime Geç',
      featured: false,
    },
  ];

  const inputPlans = clampList(rawProps.plans || rawProps.items, 6);
  const plans =
    inputPlans && inputPlans.length > 0
      ? inputPlans.map((p, idx) => ({
          name: cleanText(p?.name || p?.title, `Paket ${idx + 1}`, 80),
          price: cleanText(p?.price, 'Teklif Alın', 40),
          description: cleanText(p?.description, 'Tüm cihazlarla uyumlu responsive tasarım ve standart destek dahildir.', 260),
          buttonText: cleanText(p?.buttonText, 'Seçimi İncele', 50),
          featured: Boolean(p?.featured),
        }))
      : defaultPlans;

  return {
    id: nextId('price-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xl', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: { bg: 'surface' },
    children: [
      {
        id: nextId('price-wrap'),
        type: 'container',
        placement: 'flow',
        layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
        size: { w: 'fill', h: 'hug' },
        props: { maxWidth: '1120px' },
        children: [
          {
            id: nextId('price-header'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', gap: 'xs', align: 'center' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('price-eyebrow'),
                type: 'text',
                placement: 'flow',
                size: { w: 'hug', h: 'hug' },
                props: {
                  tag: 'span',
                  text: eyebrow,
                  fontVariant: 'xs',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'accent',
                  textAlign: 'center',
                },
              },
              {
                id: nextId('price-title'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'h2',
                  text: title,
                  fontVariant: 'h2',
                  fontFamily: 'serif',
                  fontWeight: 600,
                  textAlign: 'center',
                  color: 'text',
                },
              },
              {
                id: nextId('price-sub'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'p',
                  text: subtitle,
                  fontVariant: 'body',
                  textAlign: 'center',
                  color: 'muted',
                },
              },
            ],
          },
          {
            id: nextId('price-grid'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'grid', columns: 3, gap: 'md' },
            size: { w: 'fill', h: 'hug' },
            responsive: {
              md: { layout: { columns: 2, gap: 'md' } },
              sm: { layout: { columns: 1, gap: 'md' } },
            },
            children: plans.map((plan) => ({
              id: nextId('price-card'),
              type: 'container',
              placement: 'flow',
              layout: { mode: 'stack', gap: 'md', padding: 'lg', align: 'start', justify: 'between' },
              size: { w: 'fill', h: 'hug' },
              props: {
                bg: plan.featured ? 'primary' : '#FFFFFF',
                border: plan.featured ? '1px solid accent' : '1px solid #EAE3D9',
                radius: '20px',
                shadow: plan.featured ? 'md' : 'sm',
              },
              children: [
                {
                  id: nextId('price-name'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'span',
                    text: plan.name,
                    fontVariant: 'xs',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: plan.featured ? 'accent' : 'accent',
                  },
                },
                {
                  id: nextId('price-amount'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'h3',
                    text: plan.price,
                    fontVariant: 'h2',
                    fontFamily: 'serif',
                    fontWeight: 600,
                    color: plan.featured ? 'surface' : 'text',
                  },
                },
                {
                  id: nextId('price-desc'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'p',
                    text: plan.description,
                    fontVariant: 'body',
                    lineHeight: 1.6,
                    color: plan.featured ? '#DED8CE' : 'muted',
                  },
                },
                {
                  id: nextId('price-btn'),
                  type: 'button',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    label: plan.buttonText,
                    href: '#iletisim',
                    bg: plan.featured ? 'accent' : 'primary',
                    color: 'surface',
                    padding: 'xs',
                    radius: '999px',
                    fontWeight: 600,
                  },
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function buildTestimonial(rawProps = {}, nextId) {
  const eyebrow = cleanText(rawProps.eyebrow, 'KULLANICI DENEYİMLERİ', 80);
  const title = cleanText(rawProps.title, 'Bizimle Çalışan Ekiplerden Yorumlar', 160);

  const defaultItems = [
    {
      quote: '“Yeni ürünümüzün tanıtım sayfasını saatler içinde yayına aldık; mobil uyumu ve hızı ekipçe çok beğendik.”',
      author: 'Defne Karahan',
      role: 'İstanbul · Ürün Yöneticisi',
    },
    {
      quote: '“İçerikleri güncellemek ve farklı kampanya sayfaları hazırlamak artık çok daha pratik ve tutarlı.”',
      author: 'Kerem Soylu',
      role: 'Ankara · Tasarım Lideri',
    },
  ];

  const inputItems = clampList(rawProps.items, 6);
  let items = defaultItems;
  if (inputItems && inputItems.length > 0) {
    items = inputItems.map((it, idx) => ({
      quote: cleanText(it?.quote, defaultItems[0].quote, 360),
      author: cleanText(it?.author, `Kullanıcı ${idx + 1}`, 80),
      role: cleanText(it?.role, 'Doğrulanmış Kullanıcı', 80),
    }));
  } else if (rawProps.quote) {
    items = [
      {
        quote: cleanText(rawProps.quote, defaultItems[0].quote, 360),
        author: cleanText(rawProps.author, defaultItems[0].author, 80),
        role: cleanText(rawProps.role, defaultItems[0].role, 80),
      },
    ];
  }

  return {
    id: nextId('testi-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xl', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: { bg: '#FFFFFF' },
    children: [
      {
        id: nextId('testi-wrap'),
        type: 'container',
        placement: 'flow',
        layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
        size: { w: 'fill', h: 'hug' },
        props: { maxWidth: '1120px' },
        children: [
          {
            id: nextId('testi-header'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', gap: 'xs', align: 'center' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('testi-eyebrow'),
                type: 'text',
                placement: 'flow',
                size: { w: 'hug', h: 'hug' },
                props: {
                  tag: 'span',
                  text: eyebrow,
                  fontVariant: 'xs',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'accent',
                },
              },
              {
                id: nextId('testi-title'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'h2',
                  text: title,
                  fontVariant: 'h2',
                  fontFamily: 'serif',
                  fontWeight: 600,
                  textAlign: 'center',
                  color: 'text',
                },
              },
            ],
          },
          {
            id: nextId('testi-grid'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'grid', columns: items.length === 1 ? 1 : 2, gap: 'md' },
            size: { w: 'fill', h: 'hug' },
            responsive: {
              sm: { layout: { columns: 1, gap: 'md' } },
            },
            children: items.map((item) => ({
              id: nextId('testi-card'),
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
                  id: nextId('testi-quote'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'p',
                    text: item.quote,
                    fontVariant: 'body-lg',
                    fontFamily: 'serif',
                    lineHeight: 1.55,
                    color: 'text',
                  },
                },
                {
                  id: nextId('testi-author'),
                  type: 'text',
                  placement: 'flow',
                  size: { w: 'fill', h: 'hug' },
                  props: {
                    tag: 'span',
                    text: `${item.author} — ${item.role}`,
                    fontVariant: 'sm',
                    fontWeight: 600,
                    color: 'accent',
                  },
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function buildCtaBanner(rawProps = {}, nextId) {
  const eyebrow = cleanText(rawProps.eyebrow, 'HEMEN BAŞLAYIN', 80);
  const title = cleanText(rawProps.title, 'Projenizi Bugün Hayata Geçirin', 160);
  const subtitle = cleanText(
    rawProps.subtitle,
    'İlk sayfanızı oluşturun, bölümleri ihtiyacınıza göre özelleştirin ve tek tıkla yayına hazırlayın.',
    280
  );
  const btnText = cleanText(rawProps.buttonText, 'Ücretsiz Başlayın', 60);
  const hrefRes = validateButtonHref(rawProps.buttonHref || '#iletisim');
  const btnHref = hrefRes.ok ? hrefRes.value : '#iletisim';

  return {
    id: nextId('cta-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'lg', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: { bg: 'surface' },
    children: [
      {
        id: nextId('cta-box'),
        type: 'container',
        placement: 'flow',
        layout: { mode: 'row', gap: 'lg', padding: 'lg', align: 'center', justify: 'between' },
        size: { w: 'fill', h: 'hug' },
        props: {
          maxWidth: '1120px',
          bg: 'primary',
          radius: '24px',
          shadow: 'md',
        },
        responsive: {
          sm: { layout: { mode: 'stack', gap: 'md', padding: 'md', align: 'start' } },
        },
        children: [
          {
            id: nextId('cta-copy'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'stack', gap: 'xs', align: 'start' },
            size: { w: 'fill', h: 'hug' },
            children: [
              {
                id: nextId('cta-eyebrow'),
                type: 'text',
                placement: 'flow',
                size: { w: 'hug', h: 'hug' },
                props: {
                  tag: 'span',
                  text: eyebrow,
                  fontVariant: 'xs',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'accent',
                },
              },
              {
                id: nextId('cta-title'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'h2',
                  text: title,
                  fontVariant: 'h2',
                  fontFamily: 'serif',
                  fontWeight: 600,
                  color: 'surface',
                },
              },
              {
                id: nextId('cta-sub'),
                type: 'text',
                placement: 'flow',
                size: { w: 'fill', h: 'hug' },
                props: {
                  tag: 'p',
                  text: subtitle,
                  fontVariant: 'body',
                  color: '#DED8CE',
                },
              },
            ],
          },
          {
            id: nextId('cta-btn'),
            type: 'button',
            placement: 'flow',
            size: { w: 'hug', h: 'hug' },
            props: {
              label: btnText,
              href: btnHref,
              bg: 'accent',
              color: 'surface',
              padding: 'sm',
              radius: '999px',
              fontWeight: 600,
            },
          },
        ],
      },
    ],
  };
}

function buildFooter4Col(rawProps = {}, nextId) {
  const brandName = cleanText(rawProps.brandName, 'NOVA STUDIO', 80);
  const brandDesc = cleanText(
    rawProps.brandDescription,
    'Farklı sektörler için hızlı, erişilebilir ve her ekrana uyumlu modern web deneyimleri sunan tasarım platformu.',
    240
  );
  const copyright = cleanText(rawProps.copyright, '© 2026 Nova Studio · Tüm hakları saklıdır.', 120);

  const defaultCols = [
    { title: 'Ürün', links: ['Özellikler', 'Şablonlar', 'Fiyatlandırma'] },
    { title: 'Kaynaklar', links: ['Rehberler', 'SSS', 'Güncellemeler'] },
    { title: 'İletişim', links: ['Destek Merkezi', 'Bize Ulaşın', 'merhaba@novastudio.example'] },
  ];

  const inputCols = clampList(rawProps.columns, 5);
  const columns =
    inputCols && inputCols.length > 0
      ? inputCols.map((col, idx) => ({
          title: cleanText(col?.title, `Bölüm ${idx + 1}`, 60),
          links: (clampList(col?.links, 6) || ['Detay']).map((l) => cleanText(l, 'Bağlantı', 60)),
        }))
      : defaultCols;

  return {
    id: nextId('foot-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xl', align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: {
      bg: 'primary',
      color: 'surface',
    },
    children: [
      {
        id: nextId('foot-wrap'),
        type: 'container',
        placement: 'flow',
        layout: { mode: 'stack', gap: 'lg', align: 'stretch' },
        size: { w: 'fill', h: 'hug' },
        props: { maxWidth: '1120px' },
        children: [
          {
            id: nextId('foot-grid'),
            type: 'container',
            placement: 'flow',
            layout: { mode: 'grid', columns: 4, gap: 'lg' },
            size: { w: 'fill', h: 'hug' },
            responsive: {
              md: { layout: { columns: 2, gap: 'md' } },
              sm: { layout: { columns: 1, gap: 'md' } },
            },
            children: [
              {
                id: nextId('foot-brand-col'),
                type: 'container',
                placement: 'flow',
                layout: { mode: 'stack', gap: 'xs', align: 'start' },
                size: { w: 'fill', h: 'hug' },
                children: [
                  {
                    id: nextId('foot-brand-title'),
                    type: 'text',
                    placement: 'flow',
                    size: { w: 'fill', h: 'hug' },
                    props: {
                      tag: 'h3',
                      text: brandName,
                      fontVariant: 'h3',
                      fontFamily: 'serif',
                      fontWeight: 600,
                      color: 'surface',
                    },
                  },
                  {
                    id: nextId('foot-brand-desc'),
                    type: 'text',
                    placement: 'flow',
                    size: { w: 'fill', h: 'hug' },
                    props: {
                      tag: 'p',
                      text: brandDesc,
                      fontVariant: 'sm',
                      lineHeight: 1.6,
                      color: '#C7BFB4',
                    },
                  },
                ],
              },
              ...columns.map((col) => ({
                id: nextId('foot-col'),
                type: 'container',
                placement: 'flow',
                layout: { mode: 'stack', gap: 'xs', align: 'start' },
                size: { w: 'fill', h: 'hug' },
                children: [
                  {
                    id: nextId('foot-col-title'),
                    type: 'text',
                    placement: 'flow',
                    size: { w: 'fill', h: 'hug' },
                    props: {
                      tag: 'h4',
                      text: col.title,
                      fontVariant: 'sm',
                      fontWeight: 700,
                      color: 'accent',
                    },
                  },
                  ...col.links.map((linkText) => ({
                    id: nextId('foot-link'),
                    type: 'text',
                    placement: 'flow',
                    size: { w: 'hug', h: 'hug' },
                    props: {
                      tag: 'span',
                      text: linkText,
                      fontVariant: 'sm',
                      color: '#DED8CE',
                    },
                  })),
                ],
              })),
            ],
          },
          {
            id: nextId('foot-copy'),
            type: 'text',
            placement: 'flow',
            size: { w: 'fill', h: 'hug' },
            props: {
              tag: 'p',
              text: copyright,
              fontVariant: 'xs',
              color: '#9C948A',
            },
          },
        ],
      },
    ],
  };
}

const BUILDERS = {
  'hero-split': buildHeroSplit,
  'feature-grid-3': buildFeatureGrid3,
  'pricing-3col': buildPricing3Col,
  testimonial: buildTestimonial,
  'cta-banner': buildCtaBanner,
  'footer-4col': buildFooter4Col,
};

/**
 * Verilen preset adından şemaya uygun tam section düğüm ağacı oluşturur.
 */
export function buildPreset(name, props = {}, idGen) {
  const builder = BUILDERS[name];
  if (!builder) return null;
  const nextId = makeUniqueIdFactory(idGen);
  const raw = builder(props || {}, nextId);
  return sanitizeNode(raw);
}
