import { CONTENT_PACK_ASSETS } from '../data/contentPacks.js';
import {
  DEFAULT_THEME_COLORS,
  inspectTreeIssues,
  sanitizeNode,
  sanitizePlainText,
  validateButtonHref,
  validateColor,
  validateImageSrc,
} from './schema.js';

/**
 * Eski mutlak koordinatlı `CONTENT_PACK_ASSETS` paketlerini akış tabanlı v2 şemasına çeviren saf adaptör.
 * - Girdi nesnelerini ASLA mutasyona uğratmaz (derin okuma yapar).
 * - XY-Cut (yatay/dikey şerit bölme) stratejisiyle satır (`row` / `grid`) ve sütun (`stack`) düzeni üretir.
 * - Akış düğümlerine sabit `px` yükseklik veya `position: absolute` koymaz; dekoratif öğeleri section % katmanı yapar.
 * - Birebir eşlenemeyen tüm stilleri/öğeleri (gradient, rgba, slider kontrol/ok, input vb.) `warnings` dizisinde raporlar.
 */

const DATA_IMAGE_SINGLE_LIMIT_BYTES = 512 * 1024;
const DATA_IMAGE_TOTAL_LIMIT_BYTES = 2 * 1024 * 1024;
const VALID_TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'span', 'div']);

function safeCloneReadOnly(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => safeCloneReadOnly(item));
  const out = {};
  for (const key of Object.keys(value)) {
    const val = value[key];
    if (typeof val === 'function') continue;
    out[key] = safeCloneReadOnly(val);
  }
  return out;
}

function countPackElements(el) {
  if (!el || typeof el !== 'object') return 0;
  let total = 1;
  if (Array.isArray(el.children)) {
    for (const child of el.children) {
      total += countPackElements(child);
    }
  }
  return total;
}

function toPackSlugId(pack, fallbackIdx = 0) {
  return String(pack?.presetKey || `pack-${fallbackIdx}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
}

/**
 * Kullanılabilir içerik paketlerinin özet envanterini döndürür.
 */
export function listContentPacks() {
  return CONTENT_PACK_ASSETS.map((pack, idx) => ({
    id: toPackSlugId(pack, idx),
    presetKey: pack.presetKey || toPackSlugId(pack, idx),
    name: pack.name || `Paket ${idx + 1}`,
    category: pack.category || 'Genel',
    description: pack.description || '',
    itemCount: countPackElements(pack.element),
  }));
}

function rgbToHex(r, g, b) {
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function parseHexToRgb(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function closestThemeOrHex(hexValue, preferToken = false) {
  const check = validateColor(hexValue, { allowTokens: true });
  if (!check.ok) return null;
  if (!preferToken) return check.value;

  const rgb = parseHexToRgb(check.value);
  if (!rgb) return check.value;

  let bestToken = null;
  let bestDist = Infinity;
  for (const [token, tokenHex] of Object.entries(DEFAULT_THEME_COLORS)) {
    const trgb = parseHexToRgb(tokenHex);
    if (!trgb) continue;
    const d = Math.hypot(rgb[0] - trgb[0], rgb[1] - trgb[1], rgb[2] - trgb[2]);
    if (d < bestDist) {
      bestDist = d;
      bestToken = token;
    }
  }
  return bestDist <= 18 ? bestToken : check.value;
}

function convertCssColor(rawColor, { nodeId, fieldName, fallbackBgHex = '#111116', warnings, preferToken = false }) {
  if (!rawColor || typeof rawColor !== 'string') return null;
  const trimmed = rawColor.trim();
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') return null;

  if (trimmed.toLowerCase().includes('gradient(')) {
    const hexMatch = trimmed.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    warnings.push(
      `Öğe '${nodeId}' (${fieldName}): linear-gradient akış şemasında düz renge ('${hexMatch ? hexMatch[0] : fallbackBgHex}') sadeleştirildi.`
    );
    return hexMatch ? hexMatch[0] : fallbackBgHex;
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i
  );
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
    const baseRgb = parseHexToRgb(fallbackBgHex) || [17, 17, 22];
    const blended = rgbToHex(
      r * a + baseRgb[0] * (1 - a),
      g * a + baseRgb[1] * (1 - a),
      b * a + baseRgb[2] * (1 - a)
    );
    warnings.push(
      `Öğe '${nodeId}' (${fieldName}): yarı saydam '${trimmed}' rengi '${blended}' hex değerine yaklaştırıldı.`
    );
    return blended;
  }

  const res = validateColor(trimmed, { allowTokens: true });
  if (res.ok) {
    return closestThemeOrHex(res.value, preferToken);
  }

  warnings.push(
    `Öğe '${nodeId}' (${fieldName}): desteklenmeyen renk ('${sanitizePlainText(trimmed, 40)}') atlandı.`
  );
  return null;
}

function parsePxNumber(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val !== 'string') return null;
  const m = val.trim().match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  return m ? Number(m[1]) : null;
}

function mapPxToSpaceToken(px, fallback = 'md') {
  if (!Number.isFinite(px)) return fallback;
  if (px <= 10) return 'xs';
  if (px <= 18) return 'sm';
  if (px <= 28) return 'md';
  if (px <= 44) return 'lg';
  return 'xl';
}

function mapFontSizeToVariant(rawSize, tag = 'p') {
  const px = parsePxNumber(rawSize);
  if (!Number.isFinite(px)) {
    if (tag === 'h1') return 'h1';
    if (tag === 'h2') return 'h2';
    if (tag === 'h3' || tag === 'h4') return 'h3';
    if (tag === 'span') return 'sm';
    return 'body';
  }
  if (px >= 36) return 'display';
  if (px >= 28) return 'h1';
  if (px >= 22) return 'h2';
  if (px >= 18) return 'h3';
  if (px >= 15) return 'body-lg';
  if (px >= 13) return 'body';
  if (px >= 12) return 'sm';
  return 'xs';
}

function extractSafeRadius(rawRadius, nodeId, warnings) {
  if (!rawRadius || typeof rawRadius !== 'string') return null;
  const trimmed = rawRadius.trim();
  if (/^(?:0|[1-9]\d*(?:\.\d+)?|0\.\d+)(?:px|rem|em|%)$/.test(trimmed)) {
    return trimmed;
  }
  warnings.push(`Öğe '${nodeId}' (borderRadius): çoklu değer '${trimmed}' en yakın tek değerle değiştirildi.`);
  const firstPx = trimmed.match(/\d+(?:\.\d+)?px/);
  return firstPx ? firstPx[0] : '12px';
}

function extractSafeBorder(rawBorder, { nodeId, fieldName, fallbackBgHex, warnings }) {
  if (!rawBorder || typeof rawBorder !== 'string') return null;
  const trimmed = rawBorder.trim();
  if (!trimmed || trimmed === 'none') return null;

  const pxMatch = trimmed.match(/^([1-8]px)\s+solid\s+(.+)$/i);
  if (!pxMatch) {
    warnings.push(`Öğe '${nodeId}' (${fieldName}): kenarlık biçimi '${trimmed}' atlandı.`);
    return null;
  }
  const color = convertCssColor(pxMatch[2].trim(), {
    nodeId,
    fieldName,
    fallbackBgHex,
    warnings,
  });
  if (!color) return null;
  return `${pxMatch[1]} solid ${color}`;
}

function computeGcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function computeAspectRatio(w, h) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '16 / 10';
  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  const g = computeGcd(rw, rh);
  return `${Math.round(rw / g)} / ${Math.round(rh / g)}`;
}

function estimateDataUriBytes(dataUri) {
  const commaIdx = String(dataUri).indexOf(',');
  if (commaIdx === -1) return String(dataUri).length;
  const payload = String(dataUri).slice(commaIdx + 1);
  if (String(dataUri).slice(0, commaIdx).includes(';base64')) {
    return Math.floor((payload.length * 3) / 4);
  }
  return payload.length;
}

function extractRotationDeg(rawEl) {
  if (Number.isFinite(Number(rawEl?.rotation))) {
    return Number(rawEl.rotation);
  }
  const transform = rawEl?.style?.transform;
  if (typeof transform === 'string') {
    const m = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i);
    if (m) return Number(m[1]);
  }
  return 0;
}

function rectOverlapArea(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

function splitDecorativeLayers(items) {
  if (!Array.isArray(items) || items.length <= 1) {
    return { flowItems: items || [], layerItems: [] };
  }
  const flowItems = [];
  const layerItems = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const rot = extractRotationDeg(item);
    const area = Math.max(1, Number(item.width || 0) * Number(item.height || 0));
    let maxOverlapRatio = 0;
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;
      const other = items[j];
      if (other.sliderRole) continue;
      const overlap = rectOverlapArea(
        { x: item.x || 0, y: item.y || 0, width: item.width || 0, height: item.height || 0 },
        { x: other.x || 0, y: other.y || 0, width: other.width || 0, height: other.height || 0 }
      );
      if (overlap > 0) {
        const ratio = overlap / area;
        if (ratio > maxOverlapRatio) maxOverlapRatio = ratio;
      }
    }
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const isSmallOrRotatedOverlay =
      rot !== 0 || (!hasChildren && maxOverlapRatio >= 0.55 && !item.sliderRole);

    if (isSmallOrRotatedOverlay) {
      layerItems.push(item);
    } else {
      flowItems.push(item);
    }
  }
  return { flowItems, layerItems };
}

function boundsOf(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const it of items) {
    const x1 = Number(it.x || 0);
    const y1 = Number(it.y || 0);
    const x2 = x1 + Math.max(1, Number(it.width || 0));
    const y2 = y1 + Math.max(1, Number(it.height || 0));
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Y-ekseni projeksiyonuna göre yatay bantlara ayırır (üstten alta boşluk varsa böl).
 */
function partitionByY(items) {
  if (items.length <= 1) return [items];
  const sorted = [...items].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  const groups = [];
  let curGroup = [sorted[0]];
  let curMaxY = (sorted[0].y || 0) + Math.max(4, Number(sorted[0].height || 0));

  for (let i = 1; i < sorted.length; i += 1) {
    const it = sorted[i];
    const y1 = Number(it.y || 0);
    const y2 = y1 + Math.max(4, Number(it.height || 0));
    // Çok küçük sınır çakışması (<= 2px) ayrımı engellemesin
    if (y1 < curMaxY - 2) {
      curGroup.push(it);
      if (y2 > curMaxY) curMaxY = y2;
    } else {
      groups.push(curGroup);
      curGroup = [it];
      curMaxY = y2;
    }
  }
  groups.push(curGroup);
  return groups;
}

/**
 * X-ekseni projeksiyonuna göre dikey sütunlara ayırır (soldan sağa boşluk varsa böl).
 */
function partitionByX(items) {
  if (items.length <= 1) return [items];
  const sorted = [...items].sort((a, b) => (a.x || 0) - (b.x || 0) || (a.y || 0) - (b.y || 0));
  const groups = [];
  let curGroup = [sorted[0]];
  let curMaxX = (sorted[0].x || 0) + Math.max(4, Number(sorted[0].width || 0));

  for (let i = 1; i < sorted.length; i += 1) {
    const it = sorted[i];
    const x1 = Number(it.x || 0);
    const x2 = x1 + Math.max(4, Number(it.width || 0));
    if (x1 < curMaxX - 2) {
      curGroup.push(it);
      if (x2 > curMaxX) curMaxX = x2;
    } else {
      groups.push(curGroup);
      curGroup = [it];
      curMaxX = x2;
    }
  }
  groups.push(curGroup);
  return groups;
}

function isRowCardLikeGrid(colGroups) {
  if (colGroups.length < 3) return false;
  const widths = colGroups.map((g) => {
    const b = boundsOf(g);
    return b.maxX - b.minX;
  });
  const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
  // Nav link grupları dar (< 150px) olabilir; kart/sütun ızgaraları genelde >= 150px ve benzer genişliktedir
  if (avg < 150) return false;
  const maxDiff = Math.max(...widths.map((w) => Math.abs(w - avg)));
  return maxDiff <= Math.max(60, avg * 0.45);
}

function estimateGapToken(gapsPx, fallback = 'md') {
  const positives = gapsPx.filter((g) => Number.isFinite(g) && g >= 0);
  if (positives.length === 0) return fallback;
  const sorted = [...positives].sort((a, b) => a - b);
  return mapPxToSpaceToken(sorted[Math.floor(sorted.length / 2)], fallback);
}

function convertSingleElement(rawEl, ctx) {
  const { idGen, warnings, parentBgHex, sectionBox, dataImageStats } = ctx;
  const nodeId = idGen(rawEl.type || 'node');
  const style = rawEl.style || {};
  const tag = String(rawEl.type || 'div').toLowerCase();
  const rawSourceId = rawEl.id || nodeId;

  if (rawEl.animation) {
    warnings.push(
      `Öğe '${rawSourceId}': hover/giriş animasyonu statik akış şemasında atlandı.`
    );
  }
  if (rawEl.events) {
    warnings.push(
      `Öğe '${rawSourceId}': etkileşim olayı (akordiyon/slider tıklama) statik akışa sadeleştirildi.`
    );
  }
  if (rawEl.accordionRole || rawEl.accordionExpandedHeight) {
    warnings.push(
      `Öğe '${rawSourceId}': akordiyon aç/kapa yüksekliği akış içeriğinde açık gösterime dönüştürüldü.`
    );
  }
  if (style.backdropFilter) {
    warnings.push(
      `Öğe '${rawSourceId}': backdrop-filter bulanıklık efekti şema dışı olduğu için atlandı.`
    );
  }

  const localBgHex =
    convertCssColor(style.background || style.backgroundColor, {
      nodeId: rawSourceId,
      fieldName: 'background',
      fallbackBgHex: parentBgHex,
      warnings,
    }) || parentBgHex;

  // İnce yatay bölücü çizgisi (ör. footer divider: width >= 300, height <= 4)
  if (
    tag === 'div' &&
    (!rawEl.children || rawEl.children.length === 0) &&
    !rawEl.textContent &&
    Number(rawEl.height || 0) <= 4 &&
    Number(rawEl.width || 0) >= 200
  ) {
    return {
      id: nodeId,
      type: 'container',
      placement: 'flow',
      size: { w: 'fill', h: 'hug' },
      props: {
        borderBottom: `1px solid ${localBgHex || '#27272d'}`,
      },
      children: [],
    };
  }

  // Input öğeleri şemada yok -> salt okunur yer tutucu kutusuna dönüştür + uyar
  if (tag === 'input') {
    warnings.push(
      `Öğe '${rawSourceId}' (input): akış şemasında form girişi desteklenmediğinden salt okunur arama/giriş kutusuna dönüştürüldü.`
    );
    const placeholder = sanitizePlainText(
      rawEl.attrs?.placeholder || rawEl.textContent || 'Giriş alanı',
      160
    );
    const boxBg =
      convertCssColor(style.backgroundColor, {
        nodeId: rawSourceId,
        fieldName: 'background',
        fallbackBgHex: parentBgHex,
        warnings,
      }) || '#18181c';
    const textColor =
      convertCssColor(style.color, {
        nodeId: rawSourceId,
        fieldName: 'color',
        fallbackBgHex: boxBg,
        warnings,
      }) || '#a1a1aa';
    const border = extractSafeBorder(style.border, {
      nodeId: rawSourceId,
      fieldName: 'border',
      fallbackBgHex: boxBg,
      warnings,
    });
    return {
      id: nodeId,
      type: 'container',
      placement: 'flow',
      layout: { mode: 'row', padding: 'xs', align: 'center' },
      size: { w: 'fill', h: 'hug' },
      props: {
        bg: boxBg,
        radius: extractSafeRadius(style.borderRadius, rawSourceId, warnings) || '8px',
        ...(border ? { border } : { border: '1px solid #2c2c34' }),
      },
      children: [
        {
          id: idGen('txt'),
          type: 'text',
          placement: 'flow',
          size: { w: 'fill', h: 'hug' },
          props: {
            tag: 'span',
            text: placeholder,
            fontVariant: 'sm',
            color: textColor,
          },
        },
      ],
    };
  }

  // Görsel
  if (tag === 'img') {
    const rawSrc = rawEl.attrs?.src || rawEl.imageUrl || '';
    const srcRes = validateImageSrc(rawSrc);
    let safeSrc = '';
    if (srcRes.ok) {
      safeSrc = srcRes.value;
      if (safeSrc.toLowerCase().startsWith('https://')) {
        warnings.push(
          `Görsel '${rawSourceId}': harici URL ('${safeSrc.slice(0, 60)}') çevrimdışı önizlemede yüklenmeyebilir.`
        );
      } else if (safeSrc.toLowerCase().startsWith('data:image/')) {
        const bytes = estimateDataUriBytes(safeSrc);
        dataImageStats.totalBytes += bytes;
        if (bytes > DATA_IMAGE_SINGLE_LIMIT_BYTES) {
          warnings.push(
            `Görsel '${rawSourceId}': tekil veri URI boyutu 512 KB sınırını aşıyor (${Math.round(bytes / 1024)} KB).`
          );
        }
        if (dataImageStats.totalBytes > DATA_IMAGE_TOTAL_LIMIT_BYTES && !dataImageStats.warnedTotal) {
          dataImageStats.warnedTotal = true;
          warnings.push(
            `Paket toplam veri URI boyutu 2 MB sınırını aşıyor (${Math.round(dataImageStats.totalBytes / 1024)} KB).`
          );
        }
      }
    } else {
      warnings.push(
        `Görsel '${rawSourceId}': geçersiz veya güvensiz kaynak ('${sanitizePlainText(rawSrc, 60)}') atlandı.`
      );
    }

    let safeAlt = sanitizePlainText(rawEl.attrs?.alt || rawEl.name || '', 300).trim();
    if (!safeAlt) {
      safeAlt = 'Paket görseli';
      warnings.push(`Görsel '${rawSourceId}': eksik alt metin varsayılan açıklamayla dolduruldu.`);
    }

    const radius = extractSafeRadius(style.borderRadius, rawSourceId, warnings);
    const border = extractSafeBorder(style.border, {
      nodeId: rawSourceId,
      fieldName: 'border',
      fallbackBgHex: parentBgHex,
      warnings,
    });
    return {
      id: nodeId,
      type: 'image',
      placement: 'flow',
      size: { w: 'fill', h: 'auto' },
      props: {
        ...(safeSrc ? { src: safeSrc } : {}),
        alt: safeAlt,
        aspectRatio: computeAspectRatio(rawEl.width, rawEl.height),
        objectFit: style.objectFit === 'contain' ? 'contain' : 'cover',
        ...(radius ? { radius } : { radius: '12px' }),
        ...(border ? { border } : {}),
      },
    };
  }

  // Buton veya bağlantı
  if (tag === 'button' || tag === 'a') {
    const label = sanitizePlainText(rawEl.textContent || rawEl.content || rawEl.name || 'Buton', 200).trim() || 'Buton';
    const rawHref = tag === 'a' ? rawEl.attrs?.href || '#' : rawEl.attrs?.href;
    let safeHref;
    if (rawHref !== undefined) {
      const hrefCheck = validateButtonHref(rawHref);
      if (hrefCheck.ok) {
        safeHref = hrefCheck.value;
      } else {
        safeHref = '#';
        warnings.push(`Bağlantı '${rawSourceId}': geçersiz href ('${rawHref}') '#' olarak temizlendi.`);
      }
    }
    const btnBg = convertCssColor(style.background || style.backgroundColor, {
      nodeId: rawSourceId,
      fieldName: 'background',
      fallbackBgHex: parentBgHex,
      warnings,
    });
    const btnColor =
      convertCssColor(style.color, {
        nodeId: rawSourceId,
        fieldName: 'color',
        fallbackBgHex: btnBg || parentBgHex,
        warnings,
      }) || '#f4f4f5';
    const radius = extractSafeRadius(style.borderRadius, rawSourceId, warnings);
    const border = extractSafeBorder(style.border, {
      nodeId: rawSourceId,
      fieldName: 'border',
      fallbackBgHex: btnBg || parentBgHex,
      warnings,
    });
    return {
      id: nodeId,
      type: 'button',
      placement: 'flow',
      size: { w: 'hug', h: 'hug' },
      props: {
        label,
        ...(safeHref !== undefined ? { href: safeHref } : {}),
        ...(btnBg ? { bg: btnBg } : {}),
        color: btnColor,
        fontVariant: mapFontSizeToVariant(style.fontSize, tag),
        ...(style.fontWeight ? { fontWeight: Number(style.fontWeight) || 600 } : { fontWeight: 600 }),
        ...(radius ? { radius } : { radius: '8px' }),
        ...(border ? { border } : {}),
      },
    };
  }

  // Yaprak metin veya alıntı öğeleri
  const hasKids = Array.isArray(rawEl.children) && rawEl.children.length > 0;
  if (!hasKids && (VALID_TEXT_TAGS.has(tag) || tag === 'blockquote')) {
    if (tag === 'blockquote') {
      warnings.push(`Öğe '${rawSourceId}': 'blockquote' etiketi akış şemasında 'p' paragrafına çevrildi.`);
    }
    const textTag = VALID_TEXT_TAGS.has(tag) ? tag : 'p';
    const textStr = sanitizePlainText(rawEl.textContent || rawEl.content || rawEl.name || '', 1500);
    const txtBg = convertCssColor(style.background || style.backgroundColor, {
      nodeId: rawSourceId,
      fieldName: 'background',
      fallbackBgHex: parentBgHex,
      warnings,
    });
    const txtColor =
      convertCssColor(style.color, {
        nodeId: rawSourceId,
        fieldName: 'color',
        fallbackBgHex: txtBg || parentBgHex,
        warnings,
      }) || '#f4f4f5';
    const radius = extractSafeRadius(style.borderRadius, rawSourceId, warnings);
    const border = extractSafeBorder(style.border, {
      nodeId: rawSourceId,
      fieldName: 'border',
      fallbackBgHex: txtBg || parentBgHex,
      warnings,
    });

    // Arka planlı rozet/etiket ise küçük padding ekle
    const hasBadgeBox = Boolean(txtBg);
    return {
      id: nodeId,
      type: 'text',
      placement: 'flow',
      size: { w: tag === 'span' && hasBadgeBox ? 'hug' : 'fill', h: 'hug' },
      props: {
        tag: textTag,
        text: textStr,
        fontVariant: mapFontSizeToVariant(style.fontSize, textTag),
        ...(style.fontWeight ? { fontWeight: Number(style.fontWeight) || 400 } : {}),
        ...(style.lineHeight ? { lineHeight: Number(style.lineHeight) || 1.5 } : {}),
        ...(style.textAlign && ['left', 'center', 'right'].includes(style.textAlign)
          ? { textAlign: style.textAlign }
          : {}),
        color: txtColor,
        ...(txtBg ? { bg: txtBg, padding: 'xs' } : {}),
        ...(radius ? { radius } : {}),
        ...(border ? { border } : {}),
      },
    };
  }

  // Kapsayıcı / kart (`div`, `article`, `section` vb.)
  const boxBg = convertCssColor(style.background || style.backgroundColor, {
    nodeId: rawSourceId,
    fieldName: 'background',
    fallbackBgHex: parentBgHex,
    warnings,
  });
  const effectiveBgHex = boxBg || parentBgHex;
  const radius = extractSafeRadius(style.borderRadius, rawSourceId, warnings);
  const border = extractSafeBorder(style.border, {
    nodeId: rawSourceId,
    fieldName: 'border',
    fallbackBgHex: effectiveBgHex,
    warnings,
  });

  if (hasKids) {
    const childResult = convertChildrenByXY(rawEl.children, {
      ...ctx,
      parentBgHex: effectiveBgHex,
      containerWidth: Number(rawEl.width || sectionBox.width),
      isNavLike: tag === 'nav',
      allowLayerExtraction: false,
    });
    return {
      id: nodeId,
      type: 'container',
      placement: 'flow',
      layout: childResult.layout,
      ...(childResult.responsive ? { responsive: childResult.responsive } : {}),
      size: { w: 'fill', h: 'hug' },
      props: {
        ...(boxBg ? { bg: boxBg } : {}),
        padding: mapPxToSpaceToken(style.padding ? parsePxNumber(style.padding) : 20, 'sm'),
        ...(radius ? { radius } : {}),
        ...(border ? { border } : {}),
      },
      children: childResult.children,
    };
  }

  // İçi boş dekoratif/simge kutu (ör. logo mark harfi varsa metinli kutu)
  const fallbackText = sanitizePlainText(rawEl.textContent || '', 60);
  if (fallbackText) {
    const color =
      convertCssColor(style.color, {
        nodeId: rawSourceId,
        fieldName: 'color',
        fallbackBgHex: effectiveBgHex,
        warnings,
      }) || '#ffffff';
    return {
      id: nodeId,
      type: 'container',
      placement: 'flow',
      layout: { mode: 'stack', align: 'center', justify: 'center', padding: 'xs' },
      size: { w: 'hug', h: 'hug' },
      props: {
        ...(boxBg ? { bg: boxBg } : {}),
        ...(radius ? { radius } : {}),
        ...(border ? { border } : {}),
      },
      children: [
        {
          id: idGen('mark'),
          type: 'text',
          placement: 'flow',
          size: { w: 'hug', h: 'hug' },
          props: {
            tag: 'span',
            text: fallbackText,
            color,
            fontVariant: mapFontSizeToVariant(style.fontSize, 'span'),
            fontWeight: 700,
          },
        },
      ],
    };
  }

  return {
    id: nodeId,
    type: 'container',
    placement: 'flow',
    layout: { mode: 'stack', padding: 'xs' },
    size: { w: 'fill', h: 'hug' },
    props: {
      ...(boxBg ? { bg: boxBg } : {}),
      ...(radius ? { radius } : {}),
      ...(border ? { border } : {}),
    },
    children: [],
  };
}

function convertLayerElement(rawEl, ctx) {
  const { idGen, warnings, parentBgHex, sectionBox } = ctx;
  const rot = Math.max(-180, Math.min(180, Math.round(extractRotationDeg(rawEl))));
  const secW = Math.max(1, Number(sectionBox.width || 1200));
  const secH = Math.max(1, Number(sectionBox.height || 400));
  const cx = Number(rawEl.x || 0) + Number(rawEl.width || 40) / 2;
  const cy = Number(rawEl.y || 0) + Number(rawEl.height || 40) / 2;
  const xPct = Math.max(0, Math.min(100, Number(((cx / secW) * 100).toFixed(2))));
  const yPct = Math.max(0, Math.min(100, Number(((cy / secH) * 100).toFixed(2))));

  const layerW = `${Math.max(24, Math.min(600, Math.round(Number(rawEl.width || 80))))}px`;
  const layerH = `${Math.max(24, Math.min(600, Math.round(Number(rawEl.height || 80))))}px`;
  const bg = convertCssColor(rawEl.style?.background || rawEl.style?.backgroundColor, {
    nodeId: rawEl.id || 'layer',
    fieldName: 'background',
    fallbackBgHex: parentBgHex,
    warnings,
  });

  if (String(rawEl.type || '').toLowerCase() === 'img') {
    const srcRes = validateImageSrc(rawEl.attrs?.src || rawEl.imageUrl || '');
    return {
      id: idGen('layer-img'),
      type: 'image',
      placement: 'layer',
      pos: { x: xPct, y: yPct, rot },
      size: { w: layerW, h: layerH },
      props: {
        ...(srcRes.ok ? { src: srcRes.value } : {}),
        alt: sanitizePlainText(rawEl.attrs?.alt || rawEl.name || 'Dekoratif görsel', 200) || 'Dekoratif görsel',
        objectFit: 'cover',
        opacity: 0.9,
      },
    };
  }

  return {
    id: idGen('layer-blob'),
    type: 'blob',
    placement: 'layer',
    pos: { x: xPct, y: yPct, rot },
    size: { w: layerW, h: layerH },
    props: {
      bg: bg || 'accent',
      radius: extractSafeRadius(rawEl.style?.borderRadius, rawEl.id || 'layer', warnings) || '999px',
      opacity: 0.35,
    },
  };
}

function buildRowGroup(colGroups, ctx) {
  const { idGen, isNavLike } = ctx;
  const childNodes = [];
  const gapsPx = [];
  let prevMaxX = null;

  for (let i = 0; i < colGroups.length; i += 1) {
    const grp = colGroups[i];
    const b = boundsOf(grp);
    if (prevMaxX !== null) {
      gapsPx.push(b.minX - prevMaxX);
    }
    prevMaxX = b.maxX;

    if (grp.length === 1) {
      const converted = convertSingleElement(grp[0], ctx);
      // Row içindeki tekil sütun kart/kolon ise genişlik doldursun
      if (converted.type === 'text' || converted.type === 'image' || converted.type === 'container') {
        converted.size = { ...(converted.size || {}), w: 'fill' };
      }
      childNodes.push(converted);
    } else {
      const stackSub = convertFlowGroup(grp, ctx);
      childNodes.push(stackSub);
    }
  }

  const useGrid = !isNavLike && isRowCardLikeGrid(colGroups);
  const avgGap = estimateGapToken(gapsPx, 'md');
  const firstGapBig = gapsPx.length === 1 && gapsPx[0] > 120;

  if (useGrid) {
    const cols = Math.min(6, Math.max(2, colGroups.length));
    return {
      id: idGen('grid'),
      type: 'container',
      placement: 'flow',
      layout: { mode: 'grid', columns: cols, gap: avgGap, align: 'stretch' },
      responsive: {
        md: { layout: { columns: Math.min(2, cols) } },
        sm: { layout: { columns: 1 } },
      },
      size: { w: 'fill', h: 'hug' },
      children: childNodes,
    };
  }

  const allSmallButtons = childNodes.every((c) => c.type === 'button' || (c.type === 'text' && c.props?.tag === 'span'));
  const responsive = allSmallButtons
    ? undefined
    : {
        sm: { layout: { mode: 'stack', align: 'stretch' } },
      };

  return {
    id: idGen('row'),
    type: 'container',
    placement: 'flow',
    layout: {
      mode: 'row',
      gap: avgGap,
      align: isNavLike || allSmallButtons ? 'center' : 'start',
      justify: isNavLike || firstGapBig ? 'between' : 'start',
      wrap: 'wrap',
    },
    ...(responsive ? { responsive } : {}),
    size: { w: isNavLike ? 'fill' : allSmallButtons ? 'hug' : 'fill', h: 'hug' },
    children: childNodes,
  };
}

function convertFlowGroup(items, ctx, depth = 0) {
  const { idGen } = ctx;
  if (items.length === 1) {
    return convertSingleElement(items[0], ctx);
  }
  if (depth > 8) {
    const sorted = [...items].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
    return {
      id: idGen('stack'),
      type: 'container',
      placement: 'flow',
      layout: { mode: 'stack', gap: 'sm' },
      size: { w: 'fill', h: 'hug' },
      children: sorted.map((el) => convertSingleElement(el, ctx)),
    };
  }

  // 1) Yatay kesim (yukardan aşağı ayrı şeritler)
  const yBands = partitionByY(items);
  if (yBands.length > 1) {
    const bandNodes = [];
    const gaps = [];
    let prevMaxY = null;
    for (const band of yBands) {
      const b = boundsOf(band);
      if (prevMaxY !== null) gaps.push(b.minY - prevMaxY);
      prevMaxY = b.maxY;
      bandNodes.push(convertFlowGroup(band, ctx, depth + 1));
    }
    return {
      id: idGen('stack'),
      type: 'container',
      placement: 'flow',
      layout: { mode: 'stack', gap: estimateGapToken(gaps, 'sm'), align: 'stretch' },
      size: { w: 'fill', h: 'hug' },
      children: bandNodes,
    };
  }

  // 2) Dikey kesim (soldan sağa ayrık sütunlar)
  const xCols = partitionByX(items);
  if (xCols.length > 1) {
    return buildRowGroup(xCols, ctx);
  }

  // 3) Kalan çakışan öğeler için güvenli y-sıralı dikey stack
  ctx.warnings.push(
    `Grup (${items.map((x) => x.id || x.type).join(', ')}): yatay/dikey tam ayrılmayan koordinatlar dikey akışa sıralandı.`
  );
  const sorted = [...items].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  return {
    id: idGen('stack'),
    type: 'container',
    placement: 'flow',
    layout: { mode: 'stack', gap: 'sm', align: 'stretch' },
    size: { w: 'fill', h: 'hug' },
    children: sorted.map((el) => convertSingleElement(el, ctx)),
  };
}

function convertChildrenByXY(rawChildren, ctx) {
  const { flowItems, layerItems } = ctx.allowLayerExtraction
    ? splitDecorativeLayers(rawChildren)
    : { flowItems: rawChildren, layerItems: [] };

  const layers = layerItems.map((l) => convertLayerElement(l, ctx));

  if (flowItems.length === 0) {
    return {
      layout: { mode: 'stack', gap: 'md' },
      children: layers,
    };
  }

  const yBands = partitionByY(flowItems);
  if (yBands.length > 1) {
    const flowNodes = [];
    const gaps = [];
    let prevMaxY = null;
    for (const band of yBands) {
      const b = boundsOf(band);
      if (prevMaxY !== null) gaps.push(b.minY - prevMaxY);
      prevMaxY = b.maxY;
      flowNodes.push(convertFlowGroup(band, ctx, 1));
    }
    return {
      layout: { mode: 'stack', gap: estimateGapToken(gaps, 'md'), align: 'stretch' },
      children: [...layers, ...flowNodes],
    };
  }

  const xCols = partitionByX(flowItems);
  if (xCols.length > 1) {
    const rowGroup = buildRowGroup(xCols, ctx);
    return {
      layout: rowGroup.layout,
      responsive: rowGroup.responsive,
      children: [...layers, ...rowGroup.children],
    };
  }

  const grouped = convertFlowGroup(flowItems, ctx, 1);
  return {
    layout: { mode: 'stack', gap: 'md', align: 'stretch' },
    children: [...layers, grouped],
  };
}

/**
 * Slider köklü paketi üst üste binmiş slaytlar yerine ardışık temiz akış kartlarına çevirir.
 */
function convertSliderChildren(rawChildren, ctx) {
  const slides = [];
  for (const child of rawChildren) {
    if (child.sliderRole === 'control' || child.sliderRole === 'dot') {
      ctx.warnings.push(
        `Öğe '${child.id || child.type}' (${child.sliderRole}): statik akışta etkileşimli slider kontrolleri desteklenmediğinden atlandı.`
      );
      continue;
    }
    if (child.sliderRole === 'slide') {
      slides.push(child);
    } else {
      slides.push(child);
    }
  }
  ctx.warnings.push(
    `Slider paketi '${ctx.packKey}': çoklu slaytlar statik akışta alt alta bloklara dönüştürüldü.`
  );
  const convertedSlides = slides.map((slideEl) => convertSingleElement(slideEl, ctx));
  return {
    layout: { mode: 'stack', gap: 'md', align: 'stretch' },
    children: convertedSlides,
  };
}

/**
 * Seçilen içerik paketini akış tabanlı v2 düğüm ağacına (section listesi) çevirir.
 * @param {string|object} packOrKey - `CONTENT_PACK_ASSETS` presetKey değeri veya paket nesnesi
 * @param {Function} idGen - Proje geneli benzersiz ID üreteci `(hint) => string`
 * @returns {{ nodes: Array<object>, warnings: Array<string> }}
 */
export function packToNodes(packOrKey, idGen) {
  let rawPack = null;
  if (typeof packOrKey === 'string') {
    const needle = packOrKey.trim();
    rawPack =
      CONTENT_PACK_ASSETS.find(
        (p, idx) => p.presetKey === needle || toPackSlugId(p, idx) === needle
      ) || null;
  } else if (packOrKey && typeof packOrKey === 'object') {
    rawPack = packOrKey;
  }

  if (!rawPack || !rawPack.element) {
    return {
      nodes: [],
      warnings: [`İçerik paketi bulunamadı: "${String(packOrKey)}".`],
    };
  }

  const safeIdGen = typeof idGen === 'function' ? idGen : (() => {
    let i = 0;
    return (h = 'pack') => `${h}-${++i}`;
  })();

  // Girdiyi ASLA mutasyona uğratmamak için tam derin salt kopya oluştur
  const clonedPack = safeCloneReadOnly(rawPack);
  const rootEl = clonedPack.element;
  const packKey = clonedPack.presetKey || clonedPack.name || 'pack';
  const warnings = [];
  const style = rootEl.style || {};
  const tag = String(rootEl.type || 'section').toLowerCase();

  const dataImageStats = { totalBytes: 0, warnedTotal: false };
  const sectionBg = convertCssColor(style.background || style.backgroundColor, {
    nodeId: rootEl.id || packKey,
    fieldName: 'background',
    fallbackBgHex: '#111116',
    warnings,
  });
  const effectiveSectionBg = sectionBg || '#111116';

  const border = extractSafeBorder(style.border, {
    nodeId: rootEl.id || packKey,
    fieldName: 'border',
    fallbackBgHex: effectiveSectionBg,
    warnings,
  });
  const borderBottom = extractSafeBorder(style.borderBottom, {
    nodeId: rootEl.id || packKey,
    fieldName: 'borderBottom',
    fallbackBgHex: effectiveSectionBg,
    warnings,
  });

  if (rootEl.positionMode === 'sticky' || rootEl.positionMode === 'fixed') {
    warnings.push(
      `Paket '${packKey}' (${rootEl.positionMode}): akış düzeninde sabitlenmiş/yapışkan konum yerine normal bölüm akışına yerleştirildi.`
    );
  }
  if (style.backdropFilter) {
    warnings.push(`Paket '${packKey}': backdrop-filter bulanıklık efekti şema dışı olduğu için atlandı.`);
  }

  const ctx = {
    idGen: safeIdGen,
    warnings,
    packKey,
    parentBgHex: effectiveSectionBg,
    sectionBox: {
      width: Number(rootEl.width || 1200),
      height: Number(rootEl.height || 320),
    },
    isNavLike: tag === 'nav',
    allowLayerExtraction: true,
    dataImageStats,
  };

  const rawChildren = Array.isArray(rootEl.children) ? rootEl.children : [];
  const isSlider = Boolean(rootEl.sliderConfig) || rawChildren.some((c) => c?.sliderRole);
  const converted = isSlider
    ? convertSliderChildren(rawChildren, ctx)
    : convertChildrenByXY(rawChildren, ctx);

  const paddingToken = tag === 'nav' ? 'sm' : tag === 'footer' ? 'lg' : 'lg';

  const innerContainer = {
    id: safeIdGen('wrap'),
    type: 'container',
    placement: 'flow',
    layout: converted.layout,
    ...(converted.responsive ? { responsive: converted.responsive } : {}),
    size: { w: 'fill', h: 'hug' },
    props: {
      maxWidth: '1200px',
    },
    children: converted.children,
  };

  const sectionNodeRaw = {
    id: safeIdGen('pack-sec'),
    type: 'section',
    placement: 'flow',
    layout: { mode: 'stack', padding: paddingToken, align: 'center' },
    size: { w: 'fill', h: 'hug' },
    props: {
      ...(sectionBg ? { bg: sectionBg } : { bg: effectiveSectionBg }),
      ...(border ? { border } : {}),
      ...(borderBottom ? { borderBottom } : {}),
    },
    children: [innerContainer],
  };

  const cleanSection = sanitizeNode(sectionNodeRaw);
  const remainingIssues = inspectTreeIssues(cleanSection);
  if (remainingIssues.length > 0) {
    for (const issue of remainingIssues) {
      warnings.push(`Şema doğrulama notu (${issue.nodeId}): ${issue.message}`);
    }
  }

  return {
    nodes: [cleanSection],
    warnings,
  };
}
