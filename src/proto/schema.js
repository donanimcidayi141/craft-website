/**
 * Saf şema doğrulayıcı ve sanitizasyon modülü (React bağımsız).
 * - Tüm izinli enum, token, URL, renk ve ölçü kuralları tek yerden yönetilir.
 * - Doğrulama fonksiyonları ASLA throw etmez; `{ ok: false, error }` döndürür.
 * - Sanitizasyon fonksiyonları geçersiz değerleri güvenli varsayılanlara düşürür.
 */

export const GAP_PADDING_TOKENS = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl']);
export const ALIGN_TOKENS = Object.freeze(['start', 'center', 'end', 'stretch', 'baseline']);
export const JUSTIFY_TOKENS = Object.freeze(['start', 'center', 'end', 'between', 'around', 'evenly']);
export const LAYOUT_MODES = Object.freeze(['stack', 'row', 'grid']);
export const WRAP_MODES = Object.freeze(['nowrap', 'wrap', 'wrap-reverse']);
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 6;

export const NODE_TYPES = Object.freeze(['page', 'section', 'container', 'text', 'image', 'button', 'blob']);
export const PLACEMENT_TYPES = Object.freeze(['flow', 'layer']);
export const RESPONSIVE_BREAKPOINTS = Object.freeze(['md', 'sm']);

export const TEXT_TAGS = Object.freeze(['h1', 'h2', 'h3', 'h4', 'p', 'span', 'div']);
export const FONT_FAMILIES = Object.freeze(['sans', 'serif', 'mono']);
export const FONT_VARIANTS = Object.freeze(['display', 'h1', 'h2', 'h3', 'body-lg', 'body', 'sm', 'xs']);
export const TEXT_ALIGNS = Object.freeze(['left', 'center', 'right']);
export const OBJECT_FITS = Object.freeze(['cover', 'contain', 'fill', 'scale-down']);
export const COLOR_TOKENS = Object.freeze(['primary', 'accent', 'surface', 'text', 'muted']);
export const SHADOW_TOKENS = Object.freeze(['none', 'sm', 'md', 'lg']);

export const DEFAULT_THEME_COLORS = Object.freeze({
  primary: '#1A1816',
  accent: '#9C7330',
  surface: '#FAF8F5',
  text: '#1A1816',
  muted: '#575049',
});

export const SAFE_DEFAULTS = Object.freeze({
  layoutMode: 'stack',
  gap: 'md',
  padding: 'md',
  columns: 3,
  align: 'start',
  justify: 'start',
  w: 'fill',
  h: 'hug',
  fontFamily: 'sans',
  fontVariant: 'body',
  color: 'text',
  bg: 'surface',
});

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const CSS_LENGTH_RE = /^(?:0|[1-9]\d*(?:\.\d+)?|0\.\d+)(?:px|rem|em|%|vw|vh)$/;
const RADIUS_RE = /^(?:0|[1-9]\d*(?:\.\d+)?|0\.\d+)(?:px|rem|em|%)$/;
const ASPECT_RATIO_RE = /^[1-9]\d*(?:\s*\/\s*[1-9]\d*)?$/;
const SAFE_SHADOW_CSS_RE = /^(?:none|(?:0|-?\d+px)\s+(?:(?:0|-?\d+px)\s+){1,3}rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/;
const UNSAFE_CSS_CHARS_RE = /[;{}<>\\]|url\s*\(|expression\s*\(|javascript:/i;

const SPACE_SET = new Set(GAP_PADDING_TOKENS);
const ALIGN_SET = new Set(ALIGN_TOKENS);
const JUSTIFY_SET = new Set(JUSTIFY_TOKENS);
const MODE_SET = new Set(LAYOUT_MODES);
const WRAP_SET = new Set(WRAP_MODES);
const TYPE_SET = new Set(NODE_TYPES);
const PLACEMENT_SET = new Set(PLACEMENT_TYPES);
const BP_SET = new Set(RESPONSIVE_BREAKPOINTS);
const TEXT_TAG_SET = new Set(TEXT_TAGS);
const FONT_FAMILY_SET = new Set(FONT_FAMILIES);
const FONT_VARIANT_SET = new Set(FONT_VARIANTS);
const TEXT_ALIGN_SET = new Set(TEXT_ALIGNS);
const OBJECT_FIT_SET = new Set(OBJECT_FITS);
const COLOR_TOKEN_SET = new Set(COLOR_TOKENS);
const SHADOW_TOKEN_SET = new Set(SHADOW_TOKENS);

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

export function clampNumber(val, min, max, fallback = min) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function isValidCssLength(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || UNSAFE_CSS_CHARS_RE.test(trimmed)) return false;
  return CSS_LENGTH_RE.test(trimmed);
}

export function isFixedPxLength(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value !== 'string') return false;
  return /^\d+(?:\.\d+)?px$/i.test(value.trim());
}

export function validateColor(value, { allowTokens = true } = {}) {
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: `Renk değeri string olmalıdır (${COLOR_TOKENS.join(',')} veya #rgb/#rrggbb).`,
    };
  }
  const trimmed = value.trim();
  if (HEX_COLOR_RE.test(trimmed)) {
    return { ok: true, value: trimmed };
  }
  if (allowTokens && COLOR_TOKEN_SET.has(trimmed)) {
    return { ok: true, value: trimmed };
  }
  const allowedText = allowTokens
    ? `token (${COLOR_TOKENS.join(',')}) veya #rgb/#rrggbb`
    : `#rgb/#rrggbb`;
  return {
    ok: false,
    error: `Geçersiz renk değeri ("${trimmed}"). İzin verilen biçim: ${allowedText}.`,
  };
}

export function resolveSafeColorCss(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const check = validateColor(value, { allowTokens: true });
  if (!check.ok) return fallback;
  if (COLOR_TOKEN_SET.has(check.value)) {
    return `var(--color-${check.value})`;
  }
  return check.value;
}

export function validateBorderValue(value) {
  if (typeof value !== 'string') {
    return { ok: false, error: 'border değeri string olmalıdır.' };
  }
  const trimmed = value.trim();
  if (trimmed === 'none') return { ok: true, value: 'none' };
  if (UNSAFE_CSS_CHARS_RE.test(trimmed)) {
    return { ok: false, error: 'border içinde yasaklı karakter veya ifade var.' };
  }
  const match = trimmed.match(/^([1-8]px)\s+solid\s+([^\s;]+)$/i);
  if (!match) {
    return {
      ok: false,
      error: 'border biçimi "1px solid <renk>" veya "none" olmalıdır.',
    };
  }
  const colorRes = validateColor(match[2], { allowTokens: true });
  if (!colorRes.ok) {
    return { ok: false, error: `border rengi geçersiz: ${colorRes.error}` };
  }
  return { ok: true, value: `${match[1]} solid ${colorRes.value}` };
}

export function resolveSafeBorderCss(value) {
  const check = validateBorderValue(value);
  if (!check.ok) return null;
  if (check.value === 'none') return 'none';
  const parts = check.value.split(/\s+/);
  const colorCss = resolveSafeColorCss(parts[2], '#E5DFD5');
  return `${parts[0]} ${parts[1]} ${colorCss}`;
}

export function validateImageSrc(src) {
  if (typeof src !== 'string') {
    return { ok: false, error: 'Görsel src alanı string olmalıdır.' };
  }
  const trimmed = src.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, error: 'Görsel src boş veya kontrol karakteri içeriyor.' };
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('https://')) {
    if (trimmed.length > 32000) {
      return { ok: false, error: 'Görsel URL uzunluğu 32000 karakter sınırını aşıyor.' };
    }
    return { ok: true, value: trimmed };
  }
  if (lower.startsWith('data:image/')) {
    // Tekil data:image URI'ler için 4M karakter (~3MB binary) üst sınırı
    if (trimmed.length > 4_000_000) {
      return { ok: false, error: 'Görsel veri URI boyutu çok büyük (üst sınır ~3 MB).' };
    }
    if (lower.startsWith('data:image/svg+xml')) {
      let decoded = lower;
      try {
        decoded = decodeURIComponent(lower);
      } catch {
        // decode edilemezse ham lower string'i denetle
      }
      if (/<script|\son[a-z]+\s*=|javascript:/i.test(decoded)) {
        return { ok: false, error: 'SVG veri URI içeriğinde güvensiz betik algılandı.' };
      }
    }
    return { ok: true, value: trimmed };
  }
  return {
    ok: false,
    error: 'Görsel src yalnızca "https:" veya "data:image/" ile başlayabilir.',
  };
}

export const PAGE_HREF_RE = /^page:([a-zA-Z0-9_-]{1,64})$/;

export function parsePageHref(href) {
  if (typeof href !== 'string') return null;
  const match = href.trim().match(PAGE_HREF_RE);
  return match ? match[1] : null;
}

export function validateButtonHref(href, options = {}) {
  if (href === undefined || href === null || href === '') {
    return { ok: true, value: '#' };
  }
  if (typeof href !== 'string') {
    return { ok: false, error: 'Buton href alanı string olmalıdır.' };
  }
  const trimmed = href.trim();
  if (!trimmed || trimmed.length > 1000 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, error: 'Buton href geçersiz veya kontrol karakteri içeriyor.' };
  }
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('page:')) {
    const pageId = parsePageHref(trimmed);
    if (!pageId) {
      return {
        ok: false,
        error: 'Sayfa bağlantısı "page:<sayfaId>" biçiminde olmalı ve yalnızca harf, rakam, tire veya alt çizgi içermelidir.',
      };
    }
    const validIds = options?.validPageIds;
    if (validIds) {
      const hasPage =
        typeof validIds.has === 'function'
          ? validIds.has(pageId)
          : Array.isArray(validIds)
            ? validIds.includes(pageId)
            : false;
      if (!hasPage) {
        return {
          ok: false,
          error: `Hedef sayfa ("${pageId}") projede bulunamadı.`,
        };
      }
    }
    return { ok: true, value: `page:${pageId}` };
  }

  const isAllowed =
    trimmed.startsWith('#') ||
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:');
  if (!isAllowed) {
    return {
      ok: false,
      error: 'Buton href yalnızca https:, http:, mailto:, tel:, # veya page:<sayfaId> içerebilir.',
    };
  }
  return { ok: true, value: trimmed };
}

export function sanitizePlainText(text, maxLength = 2000) {
  if (text === undefined || text === null) return '';
  const cleaned = String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function validateLayoutPatch(layout) {
  if (!isPlainObject(layout)) {
    return { ok: false, error: 'layout alanı bir nesne olmalıdır.' };
  }
  const clean = {};
  const allowedKeys = new Set(['mode', 'gap', 'padding', 'align', 'justify', 'columns', 'wrap']);

  for (const key of Object.keys(layout)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Bilinmeyen layout alanı: ${key}` };
    }
    const val = layout[key];
    if (val === undefined) continue;

    if (key === 'mode') {
      if (!MODE_SET.has(val)) {
        return { ok: false, error: `layout.mode için geçerli değerler: ${LAYOUT_MODES.join(',')}` };
      }
      clean.mode = val;
    } else if (key === 'gap' || key === 'padding') {
      if (!SPACE_SET.has(val)) {
        return { ok: false, error: `${key} için geçerli değerler: ${GAP_PADDING_TOKENS.join(',')}` };
      }
      clean[key] = val;
    } else if (key === 'align') {
      if (!ALIGN_SET.has(val)) {
        return { ok: false, error: `align için geçerli değerler: ${ALIGN_TOKENS.join(',')}` };
      }
      clean.align = val;
    } else if (key === 'justify') {
      if (!JUSTIFY_SET.has(val)) {
        return { ok: false, error: `justify için geçerli değerler: ${JUSTIFY_TOKENS.join(',')}` };
      }
      clean.justify = val;
    } else if (key === 'wrap') {
      if (!WRAP_SET.has(val)) {
        return { ok: false, error: `wrap için geçerli değerler: ${WRAP_MODES.join(',')}` };
      }
      clean.wrap = val;
    } else if (key === 'columns') {
      if (!Number.isInteger(val) || val < MIN_COLUMNS || val > MAX_COLUMNS) {
        return {
          ok: false,
          error: `columns değeri ${MIN_COLUMNS} ile ${MAX_COLUMNS} arasında tamsayı olmalıdır.`,
        };
      }
      clean.columns = val;
    }
  }

  return { ok: true, value: clean };
}

export function validateSizePatch(size) {
  if (!isPlainObject(size)) {
    return { ok: false, error: 'size alanı bir nesne olmalıdır.' };
  }
  const clean = {};
  const allowedKeys = new Set(['w', 'h']);

  for (const key of Object.keys(size)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Bilinmeyen size alanı: ${key}` };
    }
    const val = size[key];
    if (val === undefined) continue;

    if (key === 'w') {
      if (val === 'fill' || val === 'hug') {
        clean.w = val;
      } else if (typeof val === 'number' && Number.isFinite(val) && val > 0 && val <= 4000) {
        clean.w = Math.round(val);
      } else if (isValidCssLength(val)) {
        clean.w = val.trim();
      } else {
        return {
          ok: false,
          error: 'size.w için geçerli değerler: fill, hug, pozitif sayı veya geçerli CSS uzunluğu.',
        };
      }
    } else if (key === 'h') {
      if (val === 'hug' || val === 'auto') {
        clean.h = val;
      } else if (isValidCssLength(val)) {
        clean.h = val.trim();
      } else {
        return {
          ok: false,
          error: 'size.h için geçerli değerler: hug, auto veya geçerli CSS uzunluğu.',
        };
      }
    }
  }

  return { ok: true, value: clean };
}

export function validatePosPatch(pos) {
  if (!isPlainObject(pos)) {
    return { ok: false, error: 'pos alanı bir nesne olmalıdır.' };
  }
  const clean = {};
  const allowedKeys = new Set(['x', 'y', 'rot']);

  for (const key of Object.keys(pos)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Bilinmeyen pos alanı: ${key}` };
    }
    const num = Number(pos[key]);
    if (!Number.isFinite(num)) {
      return { ok: false, error: `pos.${key} sonlu bir sayı olmalıdır.` };
    }
    if (key === 'x' || key === 'y') {
      clean[key] = Number(clampNumber(num, 0, 100, 50).toFixed(2));
    } else if (key === 'rot') {
      clean.rot = Number(clampNumber(num, -180, 180, 0).toFixed(2));
    }
  }
  return { ok: true, value: clean };
}

export function validateThemeTokens(tokens) {
  if (!isPlainObject(tokens)) {
    return { ok: false, error: 'Tema nesnesi olmalıdır.' };
  }
  const clean = {};
  const allowedKeys = new Set([...COLOR_TOKENS, 'fontFamily']);
  for (const key of Object.keys(tokens)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Bilinmeyen tema alanı: ${key}` };
    }
    const val = tokens[key];
    if (val === undefined) continue;
    if (key === 'fontFamily') {
      if (!FONT_FAMILY_SET.has(val)) {
        return { ok: false, error: `fontFamily için geçerli değerler: ${FONT_FAMILIES.join(',')}` };
      }
      clean.fontFamily = val;
    } else {
      const col = validateColor(val, { allowTokens: false });
      if (!col.ok) {
        return { ok: false, error: `theme.${key} için ${col.error}` };
      }
      clean[key] = col.value;
    }
  }
  return { ok: true, value: clean };
}

export function validatePropsPatch(props) {
  if (!isPlainObject(props)) {
    return { ok: false, error: 'props alanı bir nesne olmalıdır.' };
  }
  const clean = {};
  const allowedKeys = new Set([
    'text',
    'label',
    'tag',
    'src',
    'alt',
    'href',
    'bg',
    'color',
    'radius',
    'border',
    'borderBottom',
    'shadow',
    'padding',
    'fontVariant',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'opacity',
    'maxWidth',
    'minHeight',
    'aspectRatio',
    'objectFit',
    'zIndex',
    'theme',
  ]);

  for (const key of Object.keys(props)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Bilinmeyen props alanı: ${key}` };
    }
    const val = props[key];
    if (val === undefined) continue;

    if (key === 'text' || key === 'label' || key === 'alt') {
      if (typeof val !== 'string') {
        return { ok: false, error: `props.${key} string olmalıdır.` };
      }
      clean[key] = sanitizePlainText(val, 2000);
    } else if (key === 'tag') {
      if (!TEXT_TAG_SET.has(val)) {
        return { ok: false, error: `props.tag için geçerli değerler: ${TEXT_TAGS.join(',')}` };
      }
      clean.tag = val;
    } else if (key === 'src') {
      const res = validateImageSrc(val);
      if (!res.ok) return res;
      clean.src = res.value;
    } else if (key === 'href') {
      const res = validateButtonHref(val);
      if (!res.ok) return res;
      clean.href = res.value;
    } else if (key === 'bg' || key === 'color') {
      const res = validateColor(val, { allowTokens: true });
      if (!res.ok) return res;
      clean[key] = res.value;
    } else if (key === 'padding') {
      if (!SPACE_SET.has(val)) {
        return { ok: false, error: `props.padding için geçerli değerler: ${GAP_PADDING_TOKENS.join(',')}` };
      }
      clean.padding = val;
    } else if (key === 'radius') {
      if (typeof val !== 'string' || !RADIUS_RE.test(val.trim())) {
        return { ok: false, error: 'props.radius geçerli CSS yarıçap uzunluğu (ör. "20px") olmalıdır.' };
      }
      clean.radius = val.trim();
    } else if (key === 'border' || key === 'borderBottom') {
      const res = validateBorderValue(val);
      if (!res.ok) return res;
      clean[key] = res.value;
    } else if (key === 'shadow') {
      if (typeof val !== 'string' || (!SHADOW_TOKEN_SET.has(val) && !SAFE_SHADOW_CSS_RE.test(val.trim()))) {
        return {
          ok: false,
          error: `props.shadow için geçerli değerler: ${SHADOW_TOKENS.join(',')} veya güvenli CSS gölge.`,
        };
      }
      clean.shadow = val.trim();
    } else if (key === 'fontVariant') {
      if (!FONT_VARIANT_SET.has(val)) {
        return { ok: false, error: `fontVariant için geçerli değerler: ${FONT_VARIANTS.join(',')}` };
      }
      clean.fontVariant = val;
    } else if (key === 'fontFamily') {
      if (!FONT_FAMILY_SET.has(val)) {
        return { ok: false, error: `fontFamily için geçerli değerler: ${FONT_FAMILIES.join(',')}` };
      }
      clean.fontFamily = val;
    } else if (key === 'fontWeight') {
      const num = Number(val);
      if (!Number.isInteger(num) || num < 100 || num > 900) {
        return { ok: false, error: 'fontWeight 100-900 arası tamsayı olmalıdır.' };
      }
      clean.fontWeight = num;
    } else if (key === 'lineHeight') {
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0.8 || num > 3) {
        return { ok: false, error: 'lineHeight 0.8-3 arası sayı olmalıdır.' };
      }
      clean.lineHeight = Number(num.toFixed(2));
    } else if (key === 'letterSpacing') {
      if (typeof val !== 'string' || !/^-?(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|em|rem)$/.test(val.trim())) {
        return { ok: false, error: 'letterSpacing geçerli CSS uzunluğu (ör. "0.12em") olmalıdır.' };
      }
      clean.letterSpacing = val.trim();
    } else if (key === 'textAlign') {
      if (!TEXT_ALIGN_SET.has(val)) {
        return { ok: false, error: `textAlign için geçerli değerler: ${TEXT_ALIGNS.join(',')}` };
      }
      clean.textAlign = val;
    } else if (key === 'opacity') {
      const num = Number(val);
      if (!Number.isFinite(num)) {
        return { ok: false, error: 'opacity sayı olmalıdır.' };
      }
      clean.opacity = Number(clampNumber(num, 0, 1, 1).toFixed(2));
    } else if (key === 'maxWidth' || key === 'minHeight') {
      if (!isValidCssLength(val)) {
        return { ok: false, error: `${key} geçerli CSS uzunluğu olmalıdır.` };
      }
      clean[key] = val.trim();
    } else if (key === 'aspectRatio') {
      if (typeof val !== 'string' || !ASPECT_RATIO_RE.test(val.trim())) {
        return { ok: false, error: 'aspectRatio örneğin "4 / 3" biçiminde olmalıdır.' };
      }
      clean.aspectRatio = val.trim();
    } else if (key === 'objectFit') {
      if (!OBJECT_FIT_SET.has(val)) {
        return { ok: false, error: `objectFit için geçerli değerler: ${OBJECT_FITS.join(',')}` };
      }
      clean.objectFit = val;
    } else if (key === 'zIndex') {
      const num = Number(val);
      if (!Number.isInteger(num) || num < 0 || num > 50) {
        return { ok: false, error: 'zIndex 0-50 arası tamsayı olmalıdır.' };
      }
      clean.zIndex = num;
    } else if (key === 'theme') {
      const res = validateThemeTokens(val);
      if (!res.ok) return res;
      clean.theme = res.value;
    }
  }

  return { ok: true, value: clean };
}

export function validateResponsivePatch(responsive) {
  if (!isPlainObject(responsive)) {
    return { ok: false, error: 'responsive alanı bir nesne olmalıdır.' };
  }
  const clean = {};

  for (const bp of Object.keys(responsive)) {
    if (!BP_SET.has(bp)) {
      return {
        ok: false,
        error: `Geçersiz responsive breakpoint ("${bp}"). İzin verilenler: ${RESPONSIVE_BREAKPOINTS.join(',')}`,
      };
    }
    const bpPatch = responsive[bp];
    if (!isPlainObject(bpPatch)) {
      return { ok: false, error: `responsive.${bp} nesne olmalıdır.` };
    }
    const bpClean = {};
    for (const field of Object.keys(bpPatch)) {
      if (field === 'layout') {
        const res = validateLayoutPatch(bpPatch.layout);
        if (!res.ok) return res;
        bpClean.layout = res.value;
      } else if (field === 'size') {
        const res = validateSizePatch(bpPatch.size);
        if (!res.ok) return res;
        bpClean.size = res.value;
      } else if (field === 'props') {
        const res = validatePropsPatch(bpPatch.props);
        if (!res.ok) return res;
        bpClean.props = res.value;
      } else {
        return { ok: false, error: `responsive.${bp} içinde bilinmeyen alan: ${field}` };
      }
    }
    clean[bp] = bpClean;
  }

  return { ok: true, value: clean };
}

/**
 * Bir düğüm yaması (`layout`, `size`, `props`, `pos`, `placement`, `responsive`) için
 * tam doğrulama yapar. ASLA throw etmez; `{ ok: true, value }` veya `{ ok: false, error }` döner.
 */
export function validateNodePatch(patch) {
  if (!isPlainObject(patch)) {
    return { ok: false, error: 'Yama (patch) nesne olmalıdır.' };
  }
  const clean = {};
  const allowedTop = new Set(['placement', 'pos', 'layout', 'size', 'props', 'responsive']);

  for (const key of Object.keys(patch)) {
    if (!allowedTop.has(key)) {
      return { ok: false, error: `Değiştirilemeyen veya bilinmeyen alan: ${key}` };
    }
    const val = patch[key];
    if (val === undefined) continue;

    if (key === 'placement') {
      if (!PLACEMENT_SET.has(val)) {
        return { ok: false, error: `placement için geçerli değerler: ${PLACEMENT_TYPES.join(',')}` };
      }
      clean.placement = val;
    } else if (key === 'pos') {
      const res = validatePosPatch(val);
      if (!res.ok) return res;
      clean.pos = res.value;
    } else if (key === 'layout') {
      const res = validateLayoutPatch(val);
      if (!res.ok) return res;
      clean.layout = res.value;
    } else if (key === 'size') {
      const res = validateSizePatch(val);
      if (!res.ok) return res;
      clean.size = res.value;
    } else if (key === 'props') {
      const res = validatePropsPatch(val);
      if (!res.ok) return res;
      clean.props = res.value;
    } else if (key === 'responsive') {
      const res = validateResponsivePatch(val);
      if (!res.ok) return res;
      clean.responsive = res.value;
    }
  }

  return { ok: true, value: clean };
}

export function sanitizeLayout(layout) {
  if (!isPlainObject(layout)) return undefined;
  const clean = {};
  if (layout.mode !== undefined) {
    clean.mode = MODE_SET.has(layout.mode) ? layout.mode : SAFE_DEFAULTS.layoutMode;
  }
  if (layout.gap !== undefined) {
    clean.gap = SPACE_SET.has(layout.gap) ? layout.gap : SAFE_DEFAULTS.gap;
  }
  if (layout.padding !== undefined) {
    clean.padding = SPACE_SET.has(layout.padding) ? layout.padding : SAFE_DEFAULTS.padding;
  }
  if (layout.align !== undefined) {
    clean.align = ALIGN_SET.has(layout.align) ? layout.align : SAFE_DEFAULTS.align;
  }
  if (layout.justify !== undefined) {
    clean.justify = JUSTIFY_SET.has(layout.justify) ? layout.justify : SAFE_DEFAULTS.justify;
  }
  if (layout.wrap !== undefined && WRAP_SET.has(layout.wrap)) {
    clean.wrap = layout.wrap;
  }
  if (layout.columns !== undefined) {
    const col = Number(layout.columns);
    clean.columns = Number.isFinite(col)
      ? clampNumber(Math.round(col), MIN_COLUMNS, MAX_COLUMNS, SAFE_DEFAULTS.columns)
      : SAFE_DEFAULTS.columns;
  }
  return clean;
}

export function sanitizeSize(size) {
  if (!isPlainObject(size)) return undefined;
  const clean = {};
  if (size.w !== undefined) {
    if (size.w === 'fill' || size.w === 'hug') {
      clean.w = size.w;
    } else if (typeof size.w === 'number' && Number.isFinite(size.w) && size.w > 0) {
      clean.w = clampNumber(Math.round(size.w), 1, 4000, 320);
    } else if (isValidCssLength(size.w)) {
      clean.w = size.w.trim();
    } else {
      clean.w = SAFE_DEFAULTS.w;
    }
  }
  if (size.h !== undefined) {
    if (size.h === 'hug' || size.h === 'auto') {
      clean.h = size.h;
    } else if (isValidCssLength(size.h)) {
      clean.h = size.h.trim();
    } else {
      clean.h = SAFE_DEFAULTS.h;
    }
  }
  return clean;
}

export function sanitizeProps(props) {
  if (!isPlainObject(props)) return undefined;
  const clean = {};

  if (props.text !== undefined) clean.text = sanitizePlainText(props.text, 2000);
  if (props.label !== undefined) clean.label = sanitizePlainText(props.label, 300);
  if (props.alt !== undefined) clean.alt = sanitizePlainText(props.alt, 500);
  if (props.tag !== undefined) {
    clean.tag = TEXT_TAG_SET.has(props.tag) ? props.tag : 'p';
  }
  if (props.src !== undefined) {
    const res = validateImageSrc(props.src);
    if (res.ok) clean.src = res.value;
  }
  if (props.href !== undefined) {
    const res = validateButtonHref(props.href);
    clean.href = res.ok ? res.value : '#';
  }
  if (props.bg !== undefined) {
    const res = validateColor(props.bg, { allowTokens: true });
    if (res.ok) clean.bg = res.value;
  }
  if (props.color !== undefined) {
    const res = validateColor(props.color, { allowTokens: true });
    if (res.ok) clean.color = res.value;
  }
  if (props.padding !== undefined) {
    clean.padding = SPACE_SET.has(props.padding) ? props.padding : SAFE_DEFAULTS.padding;
  }
  if (props.radius !== undefined && typeof props.radius === 'string' && RADIUS_RE.test(props.radius.trim())) {
    clean.radius = props.radius.trim();
  }
  if (props.border !== undefined) {
    const res = validateBorderValue(props.border);
    if (res.ok) clean.border = res.value;
  }
  if (props.borderBottom !== undefined) {
    const res = validateBorderValue(props.borderBottom);
    if (res.ok) clean.borderBottom = res.value;
  }
  if (props.shadow !== undefined && typeof props.shadow === 'string') {
    const trimmed = props.shadow.trim();
    if (SHADOW_TOKEN_SET.has(trimmed) || SAFE_SHADOW_CSS_RE.test(trimmed)) {
      clean.shadow = trimmed;
    }
  }
  if (props.fontVariant !== undefined) {
    clean.fontVariant = FONT_VARIANT_SET.has(props.fontVariant) ? props.fontVariant : SAFE_DEFAULTS.fontVariant;
  }
  if (props.fontFamily !== undefined) {
    clean.fontFamily = FONT_FAMILY_SET.has(props.fontFamily) ? props.fontFamily : SAFE_DEFAULTS.fontFamily;
  }
  if (props.fontWeight !== undefined) {
    const num = Number(props.fontWeight);
    if (Number.isFinite(num)) clean.fontWeight = clampNumber(Math.round(num), 100, 900, 400);
  }
  if (props.lineHeight !== undefined) {
    const num = Number(props.lineHeight);
    if (Number.isFinite(num)) clean.lineHeight = Number(clampNumber(num, 0.8, 3, 1.5).toFixed(2));
  }
  if (
    props.letterSpacing !== undefined &&
    typeof props.letterSpacing === 'string' &&
    /^-?(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|em|rem)$/.test(props.letterSpacing.trim())
  ) {
    clean.letterSpacing = props.letterSpacing.trim();
  }
  if (props.textAlign !== undefined && TEXT_ALIGN_SET.has(props.textAlign)) {
    clean.textAlign = props.textAlign;
  }
  if (props.opacity !== undefined) {
    const num = Number(props.opacity);
    if (Number.isFinite(num)) clean.opacity = Number(clampNumber(num, 0, 1, 1).toFixed(2));
  }
  if (props.maxWidth !== undefined && isValidCssLength(props.maxWidth)) {
    clean.maxWidth = props.maxWidth.trim();
  }
  if (props.minHeight !== undefined && isValidCssLength(props.minHeight)) {
    clean.minHeight = props.minHeight.trim();
  }
  if (props.aspectRatio !== undefined && typeof props.aspectRatio === 'string' && ASPECT_RATIO_RE.test(props.aspectRatio.trim())) {
    clean.aspectRatio = props.aspectRatio.trim();
  }
  if (props.objectFit !== undefined && OBJECT_FIT_SET.has(props.objectFit)) {
    clean.objectFit = props.objectFit;
  }
  if (props.zIndex !== undefined) {
    const num = Number(props.zIndex);
    if (Number.isFinite(num)) clean.zIndex = clampNumber(Math.round(num), 0, 50, 1);
  }
  if (isPlainObject(props.theme)) {
    const themeClean = {};
    for (const k of COLOR_TOKENS) {
      if (props.theme[k] !== undefined) {
        const res = validateColor(props.theme[k], { allowTokens: false });
        if (res.ok) themeClean[k] = res.value;
      }
    }
    if (props.theme.fontFamily !== undefined && FONT_FAMILY_SET.has(props.theme.fontFamily)) {
      themeClean.fontFamily = props.theme.fontFamily;
    }
    if (Object.keys(themeClean).length > 0) clean.theme = themeClean;
  }

  return clean;
}

/**
 * Bir düğümü ve alt düğümlerini güvenli değerlere temizler; geçersiz değerleri varsayılana düşürür.
 * Asla throw etmez.
 */
export function sanitizeNode(node) {
  if (!isPlainObject(node)) return null;

  const safeType = TYPE_SET.has(node.type) ? node.type : 'container';
  const safePlacement = PLACEMENT_SET.has(node.placement) ? node.placement : 'flow';

  const clean = {
    id: sanitizePlainText(node.id || 'node', 120),
    type: safeType,
    placement: safePlacement,
  };

  if (safePlacement === 'layer' || isPlainObject(node.pos)) {
    const rawPos = isPlainObject(node.pos) ? node.pos : {};
    clean.pos = {
      x: Number(clampNumber(rawPos.x, 0, 100, 50).toFixed(2)),
      y: Number(clampNumber(rawPos.y, 0, 100, 50).toFixed(2)),
      rot: Number(clampNumber(rawPos.rot, -180, 180, 0).toFixed(2)),
    };
  }

  const layoutClean = sanitizeLayout(node.layout);
  if (layoutClean && Object.keys(layoutClean).length > 0) {
    clean.layout = layoutClean;
  }

  const sizeClean = sanitizeSize(node.size);
  if (sizeClean && Object.keys(sizeClean).length > 0) {
    clean.size = sizeClean;
  }

  const propsClean = sanitizeProps(node.props);
  if (propsClean && Object.keys(propsClean).length > 0) {
    clean.props = propsClean;
  }

  if (isPlainObject(node.responsive)) {
    const respClean = {};
    for (const bp of RESPONSIVE_BREAKPOINTS) {
      const bpObj = node.responsive[bp];
      if (!isPlainObject(bpObj)) continue;
      const entry = {};
      const bpLayout = sanitizeLayout(bpObj.layout);
      if (bpLayout && Object.keys(bpLayout).length > 0) entry.layout = bpLayout;
      const bpSize = sanitizeSize(bpObj.size);
      if (bpSize && Object.keys(bpSize).length > 0) entry.size = bpSize;
      const bpProps = sanitizeProps(bpObj.props);
      if (bpProps && Object.keys(bpProps).length > 0) entry.props = bpProps;
      if (Object.keys(entry).length > 0) respClean[bp] = entry;
    }
    if (Object.keys(respClean).length > 0) clean.responsive = respClean;
  }

  if (Array.isArray(node.children)) {
    clean.children = node.children.map((c) => sanitizeNode(c)).filter(Boolean);
  }

  return clean;
}

/**
 * Ağaçtaki her düğüm için doğrulama sorunlarını tarar (validate_project aracı ve testler için).
 */
export function inspectTreeIssues(node, issues = [], options = {}) {
  if (!isPlainObject(node)) return issues;

  if (!TYPE_SET.has(node.type)) {
    issues.push({
      nodeId: node.id || 'unknown',
      kind: 'invalid_token',
      message: `Bilinmeyen düğüm türü: ${node.type}`,
    });
  }

  if (node.type === 'section') {
    const flowKids = (node.children || []).filter((c) => c && c.placement !== 'layer');
    if (flowKids.length === 0) {
      issues.push({
        nodeId: node.id,
        kind: 'empty_section',
        message: `"${node.id}" bölümünde hiç içerik (akış düğümü) yok.`,
      });
    }
  }

  if (node.placement !== 'layer') {
    if (node.size?.h !== undefined && isFixedPxLength(node.size.h)) {
      issues.push({
        nodeId: node.id,
        kind: 'fixed_px_height',
        message: `"${node.id}" akış düğümünde sabit px yüksekliği ("${node.size.h}") yerine hug/auto kullanılmalıdır.`,
      });
    }
    for (const bp of RESPONSIVE_BREAKPOINTS) {
      const rh = node.responsive?.[bp]?.size?.h;
      if (rh !== undefined && isFixedPxLength(rh)) {
        issues.push({
          nodeId: node.id,
          kind: 'fixed_px_height',
          message: `"${node.id}" (${bp}) sabit px yüksekliği ("${rh}") kullanıyor.`,
        });
      }
    }
  }

  if (node.type === 'image') {
    if (!node.props?.alt || !String(node.props.alt).trim()) {
      issues.push({
        nodeId: node.id,
        kind: 'missing_alt',
        message: `"${node.id}" görselinde alt metin (alt) eksik.`,
      });
    }
    const srcRes = validateImageSrc(node.props?.src);
    if (!srcRes.ok) {
      issues.push({
        nodeId: node.id,
        kind: 'invalid_token',
        message: `"${node.id}": ${srcRes.error}`,
      });
    }
  }

  if (node.type === 'button' && node.props?.href !== undefined) {
    const hrefRes = validateButtonHref(node.props.href, { validPageIds: options?.validPageIds });
    if (!hrefRes.ok) {
      issues.push({
        nodeId: node.id,
        kind: parsePageHref(node.props.href) ? 'broken_page_link' : 'invalid_token',
        message: `"${node.id}": ${hrefRes.error}`,
      });
    }
  }

  if (node.placement === 'layer') {
    const px = Number(node.pos?.x);
    const py = Number(node.pos?.y);
    const rot = node.pos?.rot !== undefined ? Number(node.pos.rot) : 0;
    if (!Number.isFinite(px) || px < 0 || px > 100 || !Number.isFinite(py) || py < 0 || py > 100) {
      issues.push({
        nodeId: node.id,
        kind: 'layer_out_of_range',
        message: `"${node.id}" katman konumu 0-100 aralığı dışında.`,
      });
    }
    if (!Number.isFinite(rot) || rot < -180 || rot > 180) {
      issues.push({
        nodeId: node.id,
        kind: 'layer_out_of_range',
        message: `"${node.id}" katman açısı -180..180 aralığı dışında.`,
      });
    }
  }

  const patchCheck = validateNodePatch({
    ...(node.placement !== undefined ? { placement: node.placement } : {}),
    ...(node.layout !== undefined ? { layout: node.layout } : {}),
    ...(node.size !== undefined ? { size: node.size } : {}),
    ...(node.props !== undefined ? { props: node.props } : {}),
    ...(node.responsive !== undefined ? { responsive: node.responsive } : {}),
  });
  if (!patchCheck.ok) {
    issues.push({
      nodeId: node.id || 'unknown',
      kind: 'invalid_token',
      message: patchCheck.error,
    });
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      inspectTreeIssues(child, issues, options);
    }
  }

  return issues;
}
