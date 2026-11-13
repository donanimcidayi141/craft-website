import { htmlTagNames } from 'html-tag-names';
import { htmlVoidElements } from 'html-void-elements';
import { htmlElementAttributes } from 'html-element-attributes';

// 1. Exclude forbidden or internal tags (script, style, etc.)
const EXCLUDED_TAGS = new Set(['script', 'style', 'noscript', 'template', 'slot']);

// Filter all valid HTML tag names
export const ALL_HTML_TAGS = htmlTagNames.filter(tag => !EXCLUDED_TAGS.has(tag));

// 2. Set of Void Elements (Cannot have children or textContent)
export const VOID_TAGS_SET = new Set(htmlVoidElements);

export function isVoidTag(tag) {
  if (!tag) return false;
  const str = typeof tag === 'string' ? tag : (tag.type || '');
  return VOID_TAGS_SET.has(String(str).toLowerCase());
}

// 3. Categorized Tags with Turkish labels and descriptions
export const TAG_CATEGORIES = {
  popular: {
    name: 'Yaygın Kullanılanlar',
    tags: [
      'div', 'section', 'header', 'nav', 'footer', 'main', 'article',
      'h1', 'h2', 'h3', 'p', 'span', 'button', 'a', 'img', 'input', 'textarea', 'form', 'ul', 'li'
    ]
  },
  containers: {
    name: 'Kapsayıcı & Yapı',
    tags: [
      'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 
      'main', 'form', 'fieldset', 'figure', 'figcaption', 'ul', 'ol', 'li', 'details', 'summary'
    ]
  },
  typography: {
    name: 'Metin & Başlıklar',
    tags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 
      'b', 'i', 'small', 'blockquote', 'cite', 'code', 'pre', 'label', 'mark'
    ]
  },
  interactive: {
    name: 'Etkileşimli & Form',
    tags: [
      'button', 'a', 'input', 'textarea', 'select', 'option', 'form', 'label', 'output'
    ]
  },
  media: {
    name: 'Görsel & Medya',
    tags: [
      'img', 'video', 'audio', 'iframe', 'canvas', 'svg', 'picture', 'source'
    ]
  },
  tables: {
    name: 'Tablolar',
    tags: [
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'
    ]
  }
};

// Turkish descriptive labels for common tags
export const TAG_INFO = {
  div: { label: 'Kutu / Kapsayıcı (div)', desc: 'Genel amaçlı blok kapsayıcı', isContainer: true },
  section: { label: 'Bölüm (section)', desc: 'Sayfanın bağımsız tematik bölümü', isContainer: true },
  header: { label: 'Üst Başlık Alanı (header)', desc: 'Sayfa veya kart üst başlık alanı', isContainer: true },
  nav: { label: 'Gezinme Menüsü (nav)', desc: 'Navigasyon bağlantıları kapsayıcısı', isContainer: true },
  footer: { label: 'Alt Bilgi (footer)', desc: 'Sayfa veya bölüm alt bilgi alanı', isContainer: true },
  main: { label: 'Ana İçerik (main)', desc: 'Sayfanın merkezi içeriği', isContainer: true },
  article: { label: 'Kart / Makale (article)', desc: 'Bağımsız özellik veya içerik kartı', isContainer: true },
  aside: { label: 'Kenar Çubuğu (aside)', desc: 'Yan menü veya ikincil içerik alanı', isContainer: true },
  form: { label: 'Form Alanı (form)', desc: 'Kullanıcı veri toplama formu', isContainer: true },
  h1: { label: 'Ana Başlık 1 (h1)', desc: 'Sayfanın en önemli ana başlığı', isContainer: true },
  h2: { label: 'Alt Başlık 2 (h2)', desc: 'Bölüm ve kategori başlığı', isContainer: true },
  h3: { label: 'Küçük Başlık 3 (h3)', desc: 'Kart ve özellik başlığı', isContainer: true },
  h4: { label: 'Detay Başlığı 4 (h4)', desc: 'Alt detay başlığı', isContainer: true },
  p: { label: 'Paragraf (p)', desc: 'Açıklama ve gövde metni bloğu', isContainer: true },
  span: { label: 'Satır İçi Metin (span)', desc: 'Kutusuz, sade satır içi metin veya vurgu', isContainer: true },
  text: { label: 'Özgür Metin (text)', desc: 'Kutudan bağımsız, şeffaf saf metin öğesi', isContainer: true },
  button: { label: 'Eylem Butonu (button)', desc: 'Fonksiyon veya tıklama eylemi taşıyan buton', isContainer: true },
  a: { label: 'Köprü / Link (a)', desc: 'Bağlantı sarmalayıcı veya link (örn: Sayfa / URL)', isContainer: true },
  img: { label: 'Görsel / Resim (img)', desc: 'Web görseli (boş/void eleman)', isContainer: false },
  input: { label: 'Girdi Kutusu (input)', desc: 'Kullanıcı veri giriş alanı', isContainer: false },
  textarea: { label: 'Çok Satırlı Metin (textarea)', desc: 'Geniş mesaj / yorum giriş kutusu', isContainer: true },
  select: { label: 'Açılır Seçim Listesi (select)', desc: 'Açılır menü seçimi', isContainer: true },
  option: { label: 'Seçenek (option)', desc: 'Açılır liste seçeneği', isContainer: true },
  ul: { label: 'Madde İşaretli Liste (ul)', desc: 'Sırasız madde listesi', isContainer: true },
  ol: { label: 'Numaralı Liste (ol)', desc: 'Sıralı adım listesi', isContainer: true },
  li: { label: 'Liste Maddesi (li)', desc: 'Tekil liste öğesi', isContainer: true },
  blockquote: { label: 'Alıntı Bloğu (blockquote)', desc: 'Vurgulu söz veya referans alıntısı', isContainer: true },
  table: { label: 'Veri Tablosu (table)', desc: 'Satır ve sütunlu tablo', isContainer: true },
  video: { label: 'Video Oynatıcı (video)', desc: 'Gömülü video medya oynatıcı', isContainer: true },
  audio: { label: 'Ses Oynatıcı (audio)', desc: 'Gömülü ses oynatıcı', isContainer: true },
  iframe: { label: 'Gömülü Çerçeve (iframe)', desc: 'Harici web sayfası çerçevesi', isContainer: true },
  hr: { label: 'Ayırıcı Çizgi (hr)', desc: 'Yatay bölücü çizgi', isContainer: false },
  br: { label: 'Satır Sonu (br)', desc: 'Alt satıra geçiş', isContainer: false },
};

// 4. Common Attributes Definition per Tag
export const COMMON_ATTRIBUTES_PER_TAG = {
  a: [
    { name: 'href', type: 'text', label: 'Hedef URL (href)', default: 'https://www.google.com' },
    { name: 'target', type: 'select', label: 'Hedef Pencere (target)', options: ['_blank', '_self', '_parent', '_top'], default: '_blank' },
    { name: 'rel', type: 'text', label: 'İlişki (rel)', default: 'noopener noreferrer' },
    { name: 'download', type: 'text', label: 'İndirme Dosya Adı' },
  ],
  button: [
    { name: 'type', type: 'select', label: 'Buton Tipi (type)', options: ['button', 'submit', 'reset'], default: 'button' },
    { name: 'disabled', type: 'checkbox', label: 'Devre Dışı (disabled)', default: false },
    { name: 'name', type: 'text', label: 'Eleman İsmi (name)', default: 'actionBtn' },
    { name: 'value', type: 'text', label: 'Değer (value)' },
  ],
  img: [
    { name: 'src', type: 'text', label: 'Görsel URL (src)', default: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80' },
    { name: 'alt', type: 'text', label: 'Alternatif Açıklama (alt)', default: 'Modern Çalışma Alanı ve Teknoloji' },
    { name: 'loading', type: 'select', label: 'Yükleme Stratejisi', options: ['lazy', 'eager', 'auto'], default: 'lazy' },
    { name: 'width', type: 'text', label: 'Genişlik (width)', default: '100%' },
    { name: 'height', type: 'text', label: 'Yükseklik (height)', default: 'auto' },
  ],
  input: [
    { name: 'type', type: 'select', label: 'Girdi Tipi (type)', options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url', 'checkbox', 'radio', 'date', 'file', 'button', 'submit'], default: 'text' },
    { name: 'placeholder', type: 'text', label: 'Yer Tutucu (placeholder)', default: 'E-posta veya arama metni giriniz...' },
    { name: 'value', type: 'text', label: 'Değer (value)', default: '' },
    { name: 'name', type: 'text', label: 'Alan İsmi (name)', default: 'userInput' },
    { name: 'disabled', type: 'checkbox', label: 'Devre Dışı (disabled)', default: false },
    { name: 'required', type: 'checkbox', label: 'Zorunlu Alan (required)', default: false },
    { name: 'checked', type: 'checkbox', label: 'İşaretli (checked)', default: false },
    { name: 'readonly', type: 'checkbox', label: 'Salt Okunur (readonly)', default: false },
  ],
  textarea: [
    { name: 'placeholder', type: 'text', label: 'Yer Tutucu (placeholder)', default: 'Görüş ve mesajınızı buraya yazın...' },
    { name: 'rows', type: 'number', label: 'Satır Sayısı (rows)', default: 4 },
    { name: 'name', type: 'text', label: 'Alan İsmi (name)', default: 'userMessage' },
    { name: 'disabled', type: 'checkbox', label: 'Devre Dışı', default: false },
    { name: 'required', type: 'checkbox', label: 'Zorunlu', default: false },
  ],
  select: [
    { name: 'name', type: 'text', label: 'Seçim İsmi (name)', default: 'categorySelect' },
    { name: 'disabled', type: 'checkbox', label: 'Devre Dışı', default: false },
    { name: 'required', type: 'checkbox', label: 'Zorunlu', default: false },
    { name: 'multiple', type: 'checkbox', label: 'Çoklu Seçim', default: false },
  ],
  option: [
    { name: 'value', type: 'text', label: 'Değer (value)', default: 'option-1' },
    { name: 'selected', type: 'checkbox', label: 'Varsayılan Seçili', default: false },
    { name: 'disabled', type: 'checkbox', label: 'Seçilemez (disabled)', default: false },
  ],
  form: [
    { name: 'action', type: 'text', label: 'Form Hedefi (action)', default: '/api/submit' },
    { name: 'method', type: 'select', label: 'HTTP Metodu', options: ['POST', 'GET'], default: 'POST' },
    { name: 'target', type: 'select', label: 'Hedef Pencere', options: ['_self', '_blank'], default: '_self' },
  ],
  label: [
    { name: 'for', type: 'text', label: 'Bağlı Eleman ID (for)', default: 'input-id' }
  ],
  video: [
    { name: 'src', type: 'text', label: 'Video URL (src)', default: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'controls', type: 'checkbox', label: 'Oynatıcı Kontrolleri (controls)', default: true },
    { name: 'autoplay', type: 'checkbox', label: 'Otomatik Oynat (autoplay)', default: false },
    { name: 'loop', type: 'checkbox', label: 'Sürekli Döngü (loop)', default: false },
    { name: 'muted', type: 'checkbox', label: 'Sessiz (muted)', default: false },
    { name: 'poster', type: 'text', label: 'Kapak Görseli URL (poster)', default: '' },
  ],
  audio: [
    { name: 'src', type: 'text', label: 'Ses URL (src)', default: 'https://www.w3schools.com/html/horse.mp3' },
    { name: 'controls', type: 'checkbox', label: 'Kontroller (controls)', default: true },
    { name: 'autoplay', type: 'checkbox', label: 'Otomatik Oynat', default: false },
    { name: 'loop', type: 'checkbox', label: 'Döngü', default: false },
  ],
  iframe: [
    { name: 'src', type: 'text', label: 'Gömülü URL (src)', default: 'https://www.wikipedia.org' },
    { name: 'title', type: 'text', label: 'Çerçeve Başlığı (title)', default: 'Wikipedia Bilgi Çerçevesi' },
    { name: 'allowfullscreen', type: 'checkbox', label: 'Tam Ekran İzni', default: true },
  ],
};

// 5. Helper to get all valid attributes for any tag
const BOOLEAN_ATTR_NAMES = new Set([
  'disabled', 'required', 'checked', 'readonly', 'multiple', 'controls', 
  'autoplay', 'loop', 'muted', 'hidden', 'autofocus', 'novalidate', 
  'allowfullscreen', 'ismap', 'reversed', 'selected', 'open', 'defer', 'async', 'default'
]);

export function getValidAttributesForTag(tag) {
  const normalizedTag = (tag || '').toLowerCase();
  const tagAttrs = htmlElementAttributes[normalizedTag] || [];
  const universalAttrs = htmlElementAttributes['*'] || [];

  const combined = Array.from(new Set([...universalAttrs, ...tagAttrs]));

  // Exclude style, script, and any attribute starting with 'on'
  const filtered = combined.filter(attr => {
    if (!attr) return false;
    const lower = attr.toLowerCase();
    if (lower === 'style' || lower === 'script') return false;
    if (lower.startsWith('on')) return false;
    return true;
  });

  return filtered.sort();
}

// Attribute Input Type Guesser
export function getAttributeInputType(attrName) {
  const lower = (attrName || '').toLowerCase();
  if (BOOLEAN_ATTR_NAMES.has(lower)) {
    return 'checkbox';
  }
  if (lower === 'type' || lower === 'target' || lower === 'method' || lower === 'loading' || lower === 'decoding') {
    return 'select';
  }
  if (['rows', 'cols', 'minlength', 'maxlength', 'tabindex', 'size', 'span', 'step', 'min', 'max'].includes(lower)) {
    return 'number';
  }
  return 'text';
}

// 6. Common Styles Configuration per Tag Category
export const COMMON_STYLES_PER_TAG = {
  containers: [
    'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
    'backgroundColor', 'padding', 'margin', 'borderRadius', 'borderWidth',
    'borderColor', 'borderStyle', 'boxShadow', 'overflow', 'opacity'
  ],
  typography: [
    'color', 'fontSize', 'fontWeight', 'fontFamily', 'textAlign',
    'lineHeight', 'letterSpacing', 'textDecoration', 'textTransform',
    'textShadow', 'margin', 'padding', 'backgroundColor'
  ],
  button: [
    'backgroundColor', 'color', 'fontSize', 'fontWeight', 'padding',
    'borderRadius', 'borderWidth', 'borderColor', 'borderStyle',
    'cursor', 'boxShadow', 'textShadow', 'display', 'justifyContent', 'alignItems', 'gap'
  ],
  media: [
    'objectFit', 'borderRadius', 'borderWidth', 'borderColor',
    'borderStyle', 'boxShadow', 'opacity', 'display', 'margin'
  ],
  inputs: [
    'fontSize', 'color', 'backgroundColor', 'padding', 'borderRadius',
    'borderWidth', 'borderColor', 'borderStyle', 'outline'
  ]
};

export function getCommonStyleKeysForTag(tag) {
  const lower = (tag || '').toLowerCase();
  if (lower === 'button') return COMMON_STYLES_PER_TAG.button;
  if (['img', 'video', 'audio', 'iframe'].includes(lower)) return COMMON_STYLES_PER_TAG.media;
  if (['input', 'textarea', 'select'].includes(lower)) return COMMON_STYLES_PER_TAG.inputs;
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'text', 'badge', 'strong', 'em', 'b', 'i', 'label', 'blockquote', 'small'].includes(lower)) {
    return COMMON_STYLES_PER_TAG.typography;
  }
  return COMMON_STYLES_PER_TAG.containers;
}

// 7. Full Comprehensive List of CSS Properties for "+ Ekle" Searchable Picker
export const ALL_CSS_PROPERTIES = [
  { key: 'display', label: 'Görünüm (display)', type: 'select', options: ['block', 'flex', 'grid', 'inline-block', 'inline-flex', 'inline', 'none'], default: 'flex' },
  { key: 'flexDirection', label: 'Flex Yönü (flex-direction)', type: 'select', options: ['row', 'column', 'row-reverse', 'column-reverse'], default: 'row' },
  { key: 'justifyContent', label: 'Yatay Hizalama (justify-content)', type: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], default: 'center' },
  { key: 'alignItems', label: 'Dikey Hizalama (align-items)', type: 'select', options: ['stretch', 'center', 'flex-start', 'flex-end', 'baseline'], default: 'center' },
  { key: 'gap', label: 'Öğe Aralığı (gap)', type: 'text', default: '16px' },
  { key: 'flexWrap', label: 'Flex Satır Sarmalama (flex-wrap)', type: 'select', options: ['nowrap', 'wrap', 'wrap-reverse'], default: 'wrap' },
  
  { key: 'backgroundColor', label: 'Arka Plan Rengi (background-color)', type: 'color', default: '#ffffff' },
  { key: 'color', label: 'Yazı Rengi (color)', type: 'color', default: '#0f172a' },
  
  { key: 'fontSize', label: 'Yazı Boyutu (font-size)', type: 'text', default: '16px' },
  { key: 'fontWeight', label: 'Yazı Kalınlığı (font-weight)', type: 'select', options: ['300', '400', '500', '600', '700', '800', '900'], default: '500' },
  { key: 'fontFamily', label: 'Yazı Tipi (font-family)', type: 'select', options: ['Inter, sans-serif', 'serif', 'Cinzel, serif', 'monospace', 'system-ui'], default: 'Inter, sans-serif' },
  { key: 'textAlign', label: 'Metin Hizası (text-align)', type: 'select', options: ['left', 'center', 'right', 'justify'], default: 'left' },
  { key: 'lineHeight', label: 'Satır Yüksekliği (line-height)', type: 'text', default: '1.5' },
  { key: 'letterSpacing', label: 'Harf Aralığı (letter-spacing)', type: 'text', default: '0.02em' },
  { key: 'textDecoration', label: 'Metin Çizgisi (text-decoration)', type: 'select', options: ['none', 'underline', 'line-through', 'overline'], default: 'none' },
  { key: 'textTransform', label: 'Büyük/Küçük Harf (text-transform)', type: 'select', options: ['none', 'capitalize', 'uppercase', 'lowercase'], default: 'none' },
  
  { key: 'padding', label: 'İç Boşluk (padding)', type: 'text', default: '16px' },
  { key: 'paddingTop', label: 'Üst İç Boşluk (padding-top)', type: 'text', default: '16px' },
  { key: 'paddingRight', label: 'Sağ İç Boşluk (padding-right)', type: 'text', default: '16px' },
  { key: 'paddingBottom', label: 'Alt İç Boşluk (padding-bottom)', type: 'text', default: '16px' },
  { key: 'paddingLeft', label: 'Sol İç Boşluk (padding-left)', type: 'text', default: '16px' },
  
  { key: 'margin', label: 'Dış Boşluk (margin)', type: 'text', default: '0px' },
  { key: 'marginTop', label: 'Üst Dış Boşluk (margin-top)', type: 'text', default: '0px' },
  { key: 'marginRight', label: 'Sağ Dış Boşluk (margin-right)', type: 'text', default: '0px' },
  { key: 'marginBottom', label: 'Alt Dış Boşluk (margin-bottom)', type: 'text', default: '0px' },
  { key: 'marginLeft', label: 'Sol Dış Boşluk (margin-left)', type: 'text', default: '0px' },
  
  { key: 'borderRadius', label: 'Köşe Yuvarlama (border-radius)', type: 'text', default: '12px' },
  { key: 'borderWidth', label: 'Kenarlık Kalınlığı (border-width)', type: 'text', default: '1px' },
  { key: 'borderColor', label: 'Kenarlık Rengi (border-color)', type: 'color', default: '#e2e8f0' },
  { key: 'borderStyle', label: 'Kenarlık Deseni (border-style)', type: 'select', options: ['none', 'solid', 'dashed', 'dotted', 'double'], default: 'solid' },
  
  { key: 'boxShadow', label: 'Kutu Gölgesi (box-shadow)', type: 'select', options: ['none', '0 4px 12px rgba(0, 0, 0, 0.08)', '0 10px 25px rgba(0, 0, 0, 0.12)', '0 20px 40px rgba(0, 0, 0, 0.25)', '0 4px 16px rgba(37, 99, 235, 0.25)'], default: '0 10px 25px rgba(0, 0, 0, 0.08)' },
  { key: 'textShadow', label: 'Metin Gölgesi (text-shadow)', type: 'text', default: '0 2px 10px rgba(0, 0, 0, 0.4)' },
  { key: 'transition', label: 'Geçiş Süresi (transition)', type: 'text', default: 'all 0.25s ease' },
  { key: 'transform', label: 'Dönüşüm (transform)', type: 'text', default: 'none' },
  { key: 'opacity', label: 'Opaklık / Şeffaflık (opacity)', type: 'text', default: '1' },
  { key: 'overflow', label: 'Taşma Durumu (overflow)', type: 'select', options: ['visible', 'hidden', 'scroll', 'auto'], default: 'hidden' },
  { key: 'cursor', label: 'İmleç Tipi (cursor)', type: 'select', options: ['default', 'pointer', 'text', 'move', 'not-allowed'], default: 'pointer' },
  { key: 'zIndex', label: 'Katman Sırası (z-index)', type: 'text', default: '10' },
  { key: 'objectFit', label: 'Görsel Yerleşimi (object-fit)', type: 'select', options: ['cover', 'contain', 'fill', 'none', 'scale-down'], default: 'cover' },
  { key: 'outline', label: 'Dış Kenarlık (outline)', type: 'text', default: 'none' },
];

// 8. Element Factory: Create a clean, universal, data-driven element based on Tag
export function createTagElement(tag, overrides = {}) {
  const cleanTag = (tag || 'div').toLowerCase();
  const id = overrides.id || `elem-${cleanTag}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const isVoid = isVoidTag(cleanTag);
  
  // Base attributes
  const attrs = {
    id: cleanTag + '-' + id.slice(-4),
    class: '',
    ...(overrides.attrs || {})
  };

  // Base styles
  let style = {
    boxSizing: 'border-box',
    ...(overrides.style || {})
  };

  let textContent = '';
  let defaultWidth = 320;
  let defaultHeight = 160;

  // Meaningful, authentic, realistic default configurations for EVERY tag
  if (cleanTag === 'a') {
    // 🌐 Link: e.g. "Google'a Git ↗" with href="https://www.google.com"
    textContent = overrides.textContent || "Google'a Git ↗";
    attrs.href = overrides.attrs?.href || 'https://www.google.com';
    attrs.target = overrides.attrs?.target || '_blank';
    attrs.rel = overrides.attrs?.rel || 'noopener noreferrer';
    attrs.class = overrides.attrs?.class || 'font-medium hover:underline text-blue-600';
    style = {
      color: '#2563eb',
      fontSize: '15px',
      fontWeight: '600',
      textDecoration: 'underline',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      ...style
    };
    defaultWidth = 160;
    defaultHeight = 40;
  } else if (cleanTag === 'button') {
    // 🔘 Button: e.g. "Hemen Başlayın 🚀"
    textContent = overrides.textContent || 'Hemen Başlayın 🚀';
    attrs.type = overrides.attrs?.type || 'button';
    attrs.class = overrides.attrs?.class || 'btn-primary';
    style = {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '600',
      padding: '12px 24px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      ...style
    };
    defaultWidth = 190;
    defaultHeight = 48;
  } else if (cleanTag === 'img') {
    // 🖼️ Image: realistic modern tech/landscape workspace photo
    attrs.src = overrides.attrs?.src || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80';
    attrs.alt = overrides.attrs?.alt || 'Modern Teknoloji ve Tasarım Çalışma Masası';
    attrs.loading = 'lazy';
    style = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
      ...style
    };
    defaultWidth = 360;
    defaultHeight = 240;
  } else if (cleanTag === 'input') {
    // 📝 Input: universal search or email field
    attrs.type = overrides.attrs?.type || 'email';
    attrs.placeholder = overrides.attrs?.placeholder || 'E-posta adresinizi giriniz...';
    attrs.name = overrides.attrs?.name || 'userEmail';
    style = {
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontSize: '14px',
      padding: '10px 16px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      outline: 'none',
      ...style
    };
    defaultWidth = 280;
    defaultHeight = 44;
  } else if (cleanTag === 'textarea') {
    // 📄 Textarea: multi-line message
    attrs.placeholder = overrides.attrs?.placeholder || 'Görüş, öneri veya mesajınızı buraya yazın...';
    attrs.rows = overrides.attrs?.rows || 4;
    attrs.name = overrides.attrs?.name || 'message';
    style = {
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontSize: '14px',
      padding: '12px 16px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      outline: 'none',
      ...style
    };
    defaultWidth = 340;
    defaultHeight = 110;
  } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(cleanTag)) {
    // ✍️ Headings: modern typography
    const configMap = {
      h1: { size: '40px', weight: '800', text: 'Yaratıcı Fikirlerinizi Web Sitesine Dönüştürün', w: 680, h: 70 },
      h2: { size: '28px', weight: '700', text: 'Güçlü Özellikler & Kolay Yönetim', w: 520, h: 50 },
      h3: { size: '22px', weight: '600', text: 'Hızlı Performans & Temiz Altyapı', w: 420, h: 44 },
      h4: { size: '18px', weight: '600', text: 'Özelleştirilebilir Modüler Bileşenler', w: 360, h: 36 },
      h5: { size: '16px', weight: '600', text: 'Detaylı İstatistikler & Raporlar', w: 320, h: 32 },
      h6: { size: '14px', weight: '600', text: 'Son Güncelleme Notları', w: 280, h: 28 },
    };
    const conf = configMap[cleanTag] || configMap.h2;
    textContent = overrides.textContent || conf.text;
    style = {
      color: '#0f172a',
      fontSize: conf.size,
      fontWeight: conf.weight,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'left',
      margin: '0',
      lineHeight: '1.25',
      ...style
    };
    defaultWidth = conf.w;
    defaultHeight = conf.h;
  } else if (cleanTag === 'p') {
    // 📑 Paragraph: informative descriptive text
    textContent = overrides.textContent || 'Modern web standartlarıyla tasarlanmış, tam duyarlı (responsive) ve temiz kod yapısına sahip sayfaları dakikalar içinde oluşturun.';
    style = {
      color: '#475569',
      fontSize: '15px',
      fontWeight: '400',
      lineHeight: '1.65',
      margin: '0',
      ...style
    };
    defaultWidth = 540;
    defaultHeight = 70;
  } else if (cleanTag === 'span') {
    // 🏷️ Span: inline text (boxless by default; user decides fill/box optionally)
    textContent = overrides.textContent || 'Satır içi metin';
    style = {
      color: '#0f172a',
      backgroundColor: 'transparent',
      fontSize: '16px',
      fontWeight: '500',
      padding: '2px 4px',
      display: 'inline-flex',
      alignItems: 'center',
      textShadow: 'none',
      ...style
    };
    defaultWidth = 150;
    defaultHeight = 34;
  } else if (cleanTag === 'text') {
    // ✍️ Pure Text Element (Text-first: no forced white box!)
    textContent = overrides.textContent || 'Yeni Metin';
    style = {
      color: '#0f172a',
      backgroundColor: 'transparent',
      fontSize: '18px',
      fontWeight: '500',
      fontFamily: 'Inter, sans-serif',
      lineHeight: '1.35',
      padding: '2px 4px',
      margin: '0',
      border: 'none',
      boxShadow: 'none',
      textShadow: 'none',
      ...style
    };
    defaultWidth = 150;
    defaultHeight = 36;
  } else if (cleanTag === 'blockquote') {
    // 💬 Blockquote: famous design quote
    textContent = overrides.textContent || '“Tasarım sadece nasıl göründüğü veya hissettirdiği değildir; nasıl çalıştığıdır.” — Steve Jobs';
    style = {
      color: '#334155',
      fontSize: '15px',
      fontStyle: 'italic',
      borderLeft: '4px solid #2563eb',
      paddingLeft: '16px',
      margin: '0',
      lineHeight: '1.6',
      ...style
    };
    defaultWidth = 480;
    defaultHeight = 65;
  } else if (cleanTag === 'nav' || cleanTag === 'header') {
    // 🧭 Navbar: Universal SaaS / Corporate Header
    style = {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderBottom: '1px solid #1e293b',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      ...style
    };
    defaultWidth = 1280;
    defaultHeight = 70;
  } else if (cleanTag === 'footer') {
    // 👣 Footer: Universal Clean Modern Footer
    style = {
      backgroundColor: '#0f172a',
      color: '#94a3b8',
      borderTop: '1px solid #1e293b',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      ...style
    };
    defaultWidth = 1280;
    defaultHeight = 220;
  } else if (cleanTag === 'section') {
    // 📦 Section: clean, unstyled standard HTML5 section
    style = {
      backgroundColor: '#f8fafc',
      padding: '32px',
      borderRadius: '0px',
      border: 'none',
      boxShadow: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      ...style
    };
    defaultWidth = 1200;
    defaultHeight = 400;
  } else if (cleanTag === 'article') {
    // 📰 Article: clean, unstyled standard HTML article container
    style = {
      backgroundColor: '#ffffff',
      borderRadius: '0px',
      border: 'none',
      boxShadow: 'none',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      ...style
    };
    defaultWidth = 360;
    defaultHeight = 240;
  } else if (cleanTag === 'video') {
    // 🎬 Video: demo clip
    attrs.src = overrides.attrs?.src || 'https://www.w3schools.com/html/mov_bbb.mp4';
    attrs.controls = true;
    style = {
      width: '100%',
      height: '100%',
      borderRadius: '16px',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
      ...style
    };
    defaultWidth = 440;
    defaultHeight = 250;
  } else if (cleanTag === 'iframe') {
    // 🌐 Iframe: Wikipedia
    attrs.src = overrides.attrs?.src || 'https://www.wikipedia.org';
    attrs.title = overrides.attrs?.title || 'Wikipedia Bilgi Çerçevesi';
    attrs.allowfullscreen = true;
    style = {
      width: '100%',
      height: '100%',
      borderRadius: '14px',
      border: '1px solid #cbd5e1',
      ...style
    };
    defaultWidth = 500;
    defaultHeight = 320;
  } else if (cleanTag === 'ul' || cleanTag === 'ol') {
    // 📋 List: feature items
    textContent = overrides.textContent || '⚡ Hızlı Performans • 🎨 Kolay Tasarım • 📦 React Çıktısı';
    style = {
      color: '#334155',
      fontSize: '14px',
      fontWeight: '500',
      padding: '12px 20px',
      backgroundColor: '#f1f5f9',
      borderRadius: '10px',
      ...style
    };
    defaultWidth = 380;
    defaultHeight = 50;
  } else if (cleanTag === 'li') {
    textContent = overrides.textContent || '⚡ Yüksek performanslı ve ölçeklenebilir altyapı';
    style = {
      color: '#334155',
      fontSize: '14px',
      padding: '4px 8px',
      ...style
    };
    defaultWidth = 340;
    defaultHeight = 36;
  } else if (cleanTag === 'hr') {
    style = {
      border: 'none',
      borderTop: '1px solid #cbd5e1',
      width: '100%',
      ...style
    };
    defaultWidth = 400;
    defaultHeight = 2;
  } else {
    // Generic div container: pure, clean, unopinionated HTML div (No forced radius or borders!)
    style = {
      backgroundColor: '#ffffff',
      borderRadius: '0px',
      border: 'none',
      boxShadow: 'none',
      padding: '16px',
      ...style
    };
  }

  return {
    id,
    name: overrides.name || (TAG_INFO[cleanTag]?.label || `<${cleanTag}>`),
    type: cleanTag, // exact HTML tag
    attrs,
    style,
    textContent: isVoid ? '' : (overrides.textContent !== undefined ? overrides.textContent : textContent),
    x: overrides.x ?? 100,
    y: overrides.y ?? 100,
    width: overrides.width ?? defaultWidth,
    height: overrides.height ?? defaultHeight,
    zIndex: overrides.zIndex ?? 1,
    positionMode: overrides.positionMode || 'normal',
    fillColor: overrides.fillColor ?? style.backgroundColor ?? 'transparent',
    borderWidth: overrides.borderWidth ?? 0,
    borderRadius: overrides.borderRadius ?? 0,
    shadow: overrides.shadow ?? style.boxShadow ?? 'none',
    isAtomicWrapper: overrides.isAtomicWrapper ?? (cleanTag === 'a' || cleanTag === 'button'),
    events: overrides.events || undefined,
    groupId: overrides.groupId || null,
    groupName: overrides.groupName || null,
    children: Array.isArray(overrides.children) ? overrides.children : [],
    ...(overrides.customData || {})
  };
}
