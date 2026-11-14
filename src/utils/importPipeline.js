/**
 * CraftStudio tek merkezli dosya, klasör ve sürükle-bırak içe aktarma hattı.
 * Tüm giriş yolları (dosya seçici, klasör seçici, sürükle-bırak, Electron IPC)
 * yalnızca `runImport` üzerinden geçer ve asla ham istisna (throw) fırlatmaz.
 */

import {
  importSiteCodeToProjectSchema,
  validateMarkupSyntaxHealth,
  sanitizeCraftProjectSchema,
} from './codeFileImporter.js';
import { parseAndMigrateLoadedProject } from './projectStorage.js';
import { flattenTree } from './treeUtils.js';

export const IMPORT_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024, // Dosya başına 5 MB
  MAX_TOTAL_BYTES: 20 * 1024 * 1024, // Toplam 20 MB
  MAX_FILE_COUNT: 200, // En fazla 200 dosya
  MAX_FOLDER_DEPTH: 8, // En fazla 8 klasör derinliği
};

export const IMPORT_ERRORS = {
  DOSYA_OKUNAMADI: 'Dosya okunamadı.',
  BICIM_DESTEKLENMIYOR: 'Bu dosya biçimi desteklenmiyor.',
  COK_BUYUK: 'Dosya çok büyük (en fazla 5 MB).',
  AYRISTIRMA_HATASI: 'Dosya ayrıştırılamadı: içerik geçerli bir HTML/JSX değil.',
  ICERIK_YOK: 'İçe aktarılacak görünür içerik bulunamadı.',
  IPTAL: 'İçe aktarma iptal edildi.',
};

const CODE_EXTENSIONS = new Set(['html', 'htm', 'jsx', 'tsx']);
const ASSET_MIME_MAP = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  ico: 'image/x-icon',
};
const VISIBLE_NON_TEXT_TYPES = new Set([
  'img', 'image', 'input', 'textarea', 'select', 'button', 'svg', 'video', 'canvas',
]);

export function getImportErrorMessage(code) {
  return IMPORT_ERRORS[code] || IMPORT_ERRORS.DOSYA_OKUNAMADI;
}

function createErrorResult(code, report, overrideMessage = null) {
  return {
    ok: false,
    report,
    error: {
      code,
      message: overrideMessage || getImportErrorMessage(code),
    },
  };
}

function yieldMicroTurn() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function getFileExtensionInfo(fileName = '') {
  const lower = String(fileName || '').trim().toLowerCase();
  if (!lower) return { kind: 'unknown', ext: '' };
  if (lower.endsWith('.craft.json')) return { kind: 'craft', ext: 'craft.json' };
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1 || dotIdx === lower.length - 1) return { kind: 'unknown', ext: '' };
  const ext = lower.slice(dotIdx + 1);
  if (CODE_EXTENSIONS.has(ext)) return { kind: 'code', ext };
  if (ext === 'css') return { kind: 'css', ext };
  if (ext in ASSET_MIME_MAP) return { kind: 'asset', ext };
  return { kind: 'unsupported', ext };
}

function calculateRelativeDepth(relPath = '') {
  const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return 0;
  const parts = normalized.split('/').filter(Boolean);
  // "klasor/index.html" -> kök göreli ise derinlik 0 veya 1 kabul edilir;
  // en üst kök klasör adını çıkararak alt klasör sayısını ölç:
  return Math.max(0, parts.length - 2);
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  return '';
}

/**
 * Bayt dizisinden veya ham dizgeden UTF-8 çözümü yapar, BOM başlığını atar ve bozuk kodlamayı bildirir.
 */
function decodeTextInput(rawInput, byteData = null) {
  if (byteData instanceof Uint8Array) {
    let view = byteData;
    if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
      view = view.subarray(3);
    }
    let hasInvalidUtf8 = false;
    try {
      const strictDecoder = new TextDecoder('utf-8', { fatal: true });
      const text = strictDecoder.decode(view);
      return { text, hasInvalidUtf8: false };
    } catch {
      hasInvalidUtf8 = true;
      const lenientDecoder = new TextDecoder('utf-8', { fatal: false });
      return { text: lenientDecoder.decode(view), hasInvalidUtf8 };
    }
  }
  const str = String(rawInput ?? '');
  const stripped = str.startsWith('\uFEFF') ? str.slice(1) : str;
  const hasReplacement = stripped.includes('\uFFFD');
  return { text: stripped, hasInvalidUtf8: hasReplacement };
}

async function readItemBytes(item) {
  if (item.bytes instanceof Uint8Array) return item.bytes;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(item.bytes)) {
    return new Uint8Array(item.bytes);
  }
  if (item.file && typeof item.file.arrayBuffer === 'function') {
    const ab = await item.file.arrayBuffer();
    return new Uint8Array(ab);
  }
  if (typeof item.text === 'string' || typeof item.content === 'string') {
    const txt = item.text ?? item.content;
    return new TextEncoder().encode(txt);
  }
  throw new Error('Dosya içeriği okunamadı.');
}

function normalizeSourceToList(source) {
  if (!source) return { mode: 'empty', items: [], preSkipped: [], preWarnings: [] };

  // Electron klasör içe aktarma sonucu doğrudan gelmişse
  if (source.kind === 'electron-folder') {
    return {
      mode: 'electron-folder',
      payload: source,
      items: [],
      preSkipped: [],
      preWarnings: [],
    };
  }

  // Electron tek dosya okuma sonucu
  if (source.kind === 'electron-file') {
    return {
      mode: 'single',
      isFolder: false,
      items: [
        {
          name: source.fileName || (source.filePath ? String(source.filePath).split(/[\\/]/).pop() : 'dosya.html'),
          relativePath: source.fileName || '',
          filePath: source.filePath || null,
          size: Number.isFinite(source.size)
            ? source.size
            : (source.bytes ? source.bytes.length : new TextEncoder().encode(String(source.content || '')).length),
          content: source.content,
          bytes: source.bytes || null,
          readErrorCode: source.errorCode || null,
        },
      ],
      preSkipped: [],
      preWarnings: [],
    };
  }

  const wrapItem = (entry, idx = 0) => {
    // Tarayıcı File nesnesi veya sarmalanmış öğe
    const unwrapped = entry?.kind === 'file' && entry?.file ? entry.file : entry;
    const rawFile = unwrapped?.file || unwrapped;
    const isDomFile = typeof File !== 'undefined' && rawFile instanceof File;
    const name = unwrapped?.name || rawFile?.name || entry?.name || `dosya-${idx + 1}`;
    const relativePath = unwrapped?.relativePath || rawFile?.webkitRelativePath || entry?.relativePath || entry?.webkitRelativePath || name;
    const bytes = unwrapped?.bytes || rawFile?.bytes || entry?.bytes || null;
    const text = unwrapped?.text ?? unwrapped?.content ?? entry?.text ?? entry?.content ?? null;
    const size = Number.isFinite(unwrapped?.size)
      ? unwrapped.size
      : (Number.isFinite(entry?.size)
        ? entry.size
        : (isDomFile ? rawFile.size : (bytes?.byteLength ?? bytes?.length ?? new TextEncoder().encode(String(text ?? '')).length)));
    const depth = Number.isFinite(unwrapped?.depth)
      ? unwrapped.depth
      : (Number.isFinite(entry?.depth) ? entry.depth : calculateRelativeDepth(relativePath));
    return {
      name,
      relativePath,
      filePath: unwrapped?.filePath || unwrapped?.path || rawFile?.path || entry?.filePath || null,
      size,
      depth,
      file: isDomFile ? rawFile : (unwrapped?.file instanceof Object ? unwrapped.file : null),
      bytes,
      text,
    };
  };

  if (source.kind === 'file' && source.file) {
    return {
      mode: 'single',
      isFolder: false,
      items: [wrapItem(source.file, 0)],
      preSkipped: [],
      preWarnings: [],
    };
  }

  if (source.kind === 'files' && Array.isArray(source.files)) {
    const items = source.files.map(wrapItem);
    const hasDirHint = Boolean(source.isFolder || source.folderName) || items.some((it) => String(it.relativePath || '').includes('/'));
    return {
      mode: hasDirHint || items.length > 1 ? 'multi' : 'single',
      isFolder: hasDirHint,
      items,
      preSkipped: Array.isArray(source.skipped) ? [...source.skipped] : [],
      preWarnings: Array.isArray(source.warnings) ? [...source.warnings] : [],
    };
  }

  if (typeof FileList !== 'undefined' && source instanceof FileList) {
    const arr = Array.from(source).map(wrapItem);
    const hasDirHint = arr.some((it) => String(it.relativePath || '').includes('/'));
    return { mode: hasDirHint || arr.length > 1 ? 'multi' : 'single', isFolder: hasDirHint, items: arr, preSkipped: [], preWarnings: [] };
  }

  if (Array.isArray(source)) {
    const arr = source.map(wrapItem);
    const hasDirHint = arr.some((it) => String(it.relativePath || '').includes('/'));
    return { mode: hasDirHint || arr.length > 1 ? 'multi' : 'single', isFolder: hasDirHint, items: arr, preSkipped: [], preWarnings: [] };
  }

  // Tekil File veya plain nesne
  const single = wrapItem(source, 0);
  return {
    mode: 'single',
    isFolder: false,
    items: [single],
    preSkipped: [],
    preWarnings: [],
  };
}

function hasVisibleProjectContent(project) {
  if (!project || !Array.isArray(project.tabs) || project.tabs.length === 0) return false;
  for (const tab of project.tabs) {
    const allNodes = flattenTree(tab.elements || []);
    for (const n of allNodes) {
      if (String(n.textContent || n.content || n.productName || '').trim()) return true;
      if (VISIBLE_NON_TEXT_TYPES.has(String(n.type || '').toLowerCase())) return true;
      if (n.imageUrl || n.attrs?.src || n.attrs?.placeholder) return true;
      if (n.fillColor && n.fillColor !== 'transparent') return true;
    }
  }
  return false;
}

function buildWarningsFromStats(stats, extraWarnings = []) {
  const warnings = [...extraWarnings];
  if (stats.removedScripts > 0) {
    warnings.push(`${stats.removedScripts} betik etiketi kaldırıldı`);
  }
  if (stats.removedEventAttrs > 0) {
    warnings.push(`${stats.removedEventAttrs} olay özniteliği (on*) kaldırıldı`);
  }
  if (stats.removedJsUrls > 0) {
    warnings.push(`${stats.removedJsUrls} zararlı javascript: bağlantısı kaldırıldı`);
  }
  if (stats.removedEmbeds > 0) {
    warnings.push(`${stats.removedEmbeds} gömülü çerçeve (iframe/object/embed) kaldırıldı`);
  }
  if (stats.missingImages.length > 0) {
    const uniq = Array.from(new Set(stats.missingImages));
    const head = uniq.slice(0, 4).join(', ');
    const more = uniq.length > 4 ? ` (+${uniq.length - 4})` : '';
    warnings.push(`Eksik görsel bağlantısı (${uniq.length}): ${head}${more}`);
  }
  if (stats.truncatedNodes > 0) {
    warnings.push(`Performans sınırı nedeniyle ${stats.truncatedNodes} ek öğe atlandı.`);
  }
  if (stats.hasConditionalJsx) {
    warnings.push('Koşullu JSX ifadeleri statik önizleme olarak içe aktarıldı.');
  }
  if (stats.hasComplexLayout) {
    warnings.push('Karmaşık düzenler tuvale konumlu kutular olarak aktarılır; esnek (flex/grid) düzenler birebir korunmayabilir.');
  }
  return Array.from(new Set(warnings));
}

/**
 * Tüm dosya, klasör ve sürükle-bırak içe aktarma işlemlerinin tek giriş noktası.
 */
export async function runImport(source, { onProgress, signal } = {}) {
  const report = {
    files: [],
    nodes: 0,
    pages: 0,
    warnings: [],
    skipped: [],
  };

  const checkCancelled = () => Boolean(signal && signal.aborted);
  const emitProgress = (step, current, total) => {
    try {
      if (typeof onProgress === 'function') {
        onProgress({ step, current, total });
      }
    } catch {
      // İlerleme geri çağrısındaki hatalar içe aktarmayı kesmemeli
    }
  };

  try {
    if (checkCancelled()) return createErrorResult('IPTAL', report);

    const normalized = normalizeSourceToList(source);

    // 0. Electron klasör sonucu ön işlenmiş olarak geldiyse normalize ve sanitize et
    if (normalized.mode === 'electron-folder') {
      emitProgress('analiz', 1, 2);
      const p = normalized.payload;
      if (p?.canceled) return createErrorResult('IPTAL', report);
      if (p?.errorCode) {
        return createErrorResult(p.errorCode, report);
      }
      if (!p?.success || !p?.project) {
        return createErrorResult('DOSYA_OKUNAMADI', report);
      }
      const stats = {
        removedScripts: p.stats?.removedScripts || 0,
        removedEventAttrs: p.stats?.removedEventAttrs || 0,
        removedJsUrls: p.stats?.removedJsUrls || 0,
        removedEmbeds: p.stats?.removedEmbeds || 0,
        missingImages: Array.isArray(p.stats?.missingImages) ? [...p.stats.missingImages] : [],
        truncatedNodes: p.stats?.truncatedNodes || 0,
        hasComplexLayout: Boolean(p.stats?.hasComplexLayout),
        hasConditionalJsx: Boolean(p.stats?.hasConditionalJsx),
      };
      const sanitized = sanitizeCraftProjectSchema(parseAndMigrateLoadedProject(JSON.stringify(p.project)), stats);
      report.pages = Array.isArray(sanitized.tabs) ? sanitized.tabs.length : 1;
      report.nodes = (sanitized.tabs || []).reduce((acc, t) => acc + flattenTree(t.elements || []).length, 0);
      report.files = Array.isArray(p.files) ? p.files : [];
      report.skipped = Array.isArray(p.skipped) ? p.skipped : [];
      report.warnings = buildWarningsFromStats(stats, p.warnings || []);
      if (!hasVisibleProjectContent(sanitized)) {
        return createErrorResult('ICERIK_YOK', report);
      }
      emitProgress('yerleştiriliyor', 2, 2);
      return { ok: true, project: sanitized, report };
    }

    report.skipped.push(...normalized.preSkipped);
    const warningsCollector = [...normalized.preWarnings];

    if (!normalized.items || normalized.items.length === 0) {
      return createErrorResult('DOSYA_OKUNAMADI', report);
    }

    const stats = {
      removedScripts: 0,
      removedEventAttrs: 0,
      removedJsUrls: 0,
      removedEmbeds: 0,
      missingImages: [],
      truncatedNodes: 0,
      hasComplexLayout: false,
      hasConditionalJsx: false,
    };

    const totalItems = normalized.items.length;
    emitProgress('okunuyor', 0, totalItems);

    const codeItems = [];
    const cssTexts = [];
    const assetDataUrlMap = new Map();
    let craftItem = null;
    let totalBytes = 0;

    for (let i = 0; i < totalItems; i += 1) {
      if (checkCancelled()) return createErrorResult('IPTAL', report);
      if (i > 0 && i % 15 === 0) await yieldMicroTurn();
      if (checkCancelled()) return createErrorResult('IPTAL', report);

      const item = normalized.items[i];
      emitProgress('okunuyor', i + 1, totalItems);

      // Electron'dan ön-hata ile geldiyse
      if (item.readErrorCode) {
        return createErrorResult(item.readErrorCode, report);
      }

      // Dosya sayısı sınırı (en fazla 200)
      if (report.files.length >= IMPORT_LIMITS.MAX_FILE_COUNT) {
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: `Maksimum dosya sınırı aşıldı (en fazla ${IMPORT_LIMITS.MAX_FILE_COUNT}).`,
        });
        warningsCollector.push(`En fazla ${IMPORT_LIMITS.MAX_FILE_COUNT} dosya sınırı aşıldı; fazla dosyalar atlandı.`);
        continue;
      }

      // Klasör derinliği sınırı (en fazla 8)
      if ((item.depth || 0) > IMPORT_LIMITS.MAX_FOLDER_DEPTH) {
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: `Klasör derinliği sınırı aşıldı (en fazla ${IMPORT_LIMITS.MAX_FOLDER_DEPTH}).`,
        });
        warningsCollector.push(`Klasör derinliği ${IMPORT_LIMITS.MAX_FOLDER_DEPTH} seviyesini aşan dosyalar atlandı.`);
        continue;
      }

      const extInfo = getFileExtensionInfo(item.name);

      // Tekil dosyada dosya başı boyut sınırı
      if ((item.size || 0) > IMPORT_LIMITS.MAX_FILE_BYTES) {
        if (normalized.mode === 'single') {
          return createErrorResult('COK_BUYUK', report);
        }
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: IMPORT_ERRORS.COK_BUYUK,
        });
        warningsCollector.push(`${item.name}: Dosya çok büyük (en fazla 5 MB) olduğu için atlandı.`);
        continue;
      }

      // Toplam boyut sınırı (en fazla 20 MB)
      if (totalBytes + (item.size || 0) > IMPORT_LIMITS.MAX_TOTAL_BYTES) {
        if (normalized.mode === 'single' || (codeItems.length === 0 && !craftItem)) {
          return createErrorResult('COK_BUYUK', report);
        }
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: 'Toplam 20 MB içe aktarma sınırı aşıldı.',
        });
        warningsCollector.push('Toplam 20 MB boyut sınırı aşıldığı için kalan dosyalar atlandı.');
        continue;
      }

      if (extInfo.kind === 'unsupported' || extInfo.kind === 'unknown') {
        const suffixLabel = extInfo.ext ? `.${extInfo.ext}` : 'uzantısız';
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: `Desteklenmeyen biçim: ${suffixLabel}`,
        });
        if (normalized.mode === 'single') {
          return createErrorResult('BICIM_DESTEKLENMIYOR', report);
        }
        continue;
      }

      // Tekil dosya modunda salt CSS veya görsel bırakıldıysa net biçim hatası ver
      if (normalized.mode === 'single' && (extInfo.kind === 'css' || extInfo.kind === 'asset')) {
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: `Desteklenmeyen biçim: .${extInfo.ext}`,
        });
        return createErrorResult('BICIM_DESTEKLENMIYOR', report);
      }

      let rawBytes;
      try {
        rawBytes = await readItemBytes(item);
      } catch (readErr) {
        console.error('[CraftImport] Dosya okuma hatası:', item.name, readErr);
        if (normalized.mode === 'single') {
          return createErrorResult('DOSYA_OKUNAMADI', report);
        }
        report.skipped.push({ name: item.relativePath || item.name, reason: IMPORT_ERRORS.DOSYA_OKUNAMADI });
        continue;
      }

      const actualSize = rawBytes.byteLength;
      if (actualSize > IMPORT_LIMITS.MAX_FILE_BYTES) {
        if (normalized.mode === 'single') return createErrorResult('COK_BUYUK', report);
        report.skipped.push({ name: item.relativePath || item.name, reason: IMPORT_ERRORS.COK_BUYUK });
        continue;
      }

      if (totalBytes + actualSize > IMPORT_LIMITS.MAX_TOTAL_BYTES) {
        if (normalized.mode === 'single' || (codeItems.length === 0 && !craftItem)) {
          return createErrorResult('COK_BUYUK', report);
        }
        report.skipped.push({
          name: item.relativePath || item.name,
          reason: 'Toplam 20 MB içe aktarma sınırı aşıldı.',
        });
        warningsCollector.push('Toplam 20 MB boyut sınırı aşıldığı için kalan dosyalar atlandı.');
        continue;
      }

      totalBytes += actualSize;
      report.files.push({
        name: item.name,
        relativePath: item.relativePath || item.name,
        bytes: actualSize,
        kind: extInfo.kind,
      });

      if (extInfo.kind === 'asset') {
        const mime = ASSET_MIME_MAP[extInfo.ext] || 'application/octet-stream';
        const dataUrl = `data:${mime};base64,${uint8ToBase64(rawBytes)}`;
        const cleanRel = String(item.relativePath || item.name).replace(/\\/g, '/').replace(/^\/+/, '');
        // Hem klasör adıyla hem görece klasör-içi yolla hem dosya adıyla indeksle
        const parts = cleanRel.split('/').filter(Boolean);
        assetDataUrlMap.set(cleanRel.toLowerCase(), dataUrl);
        if (parts.length > 1) {
          assetDataUrlMap.set(parts.slice(1).join('/').toLowerCase(), dataUrl);
        }
        assetDataUrlMap.set(item.name.toLowerCase(), dataUrl);
        continue;
      }

      const decoded = decodeTextInput(item.text, rawBytes);
      if (decoded.hasInvalidUtf8) {
        warningsCollector.push(`${item.name}: Geçersiz UTF-8 dizileri saptandı; olası karakter kayıpları olabilir.`);
      }

      if (extInfo.kind === 'css') {
        cssTexts.push(decoded.text);
        continue;
      }

      if (extInfo.kind === 'craft') {
        if (!craftItem) {
          craftItem = { ...item, decodedText: decoded.text, extInfo };
        }
        continue;
      }

      codeItems.push({ ...item, decodedText: decoded.text, extInfo });
    }

    if (checkCancelled()) return createErrorResult('IPTAL', report);

    // 1. Eğer .craft.json varsa öncelikle onu doğrula ve aç
    if (craftItem) {
      emitProgress('analiz', 1, 2);
      if (!craftItem.decodedText || !craftItem.decodedText.trim()) {
        return createErrorResult('ICERIK_YOK', report);
      }
      let parsedJson;
      try {
        parsedJson = JSON.parse(craftItem.decodedText);
      } catch (jsonErr) {
        console.error('[CraftImport] JSON ayrıştırma hatası:', jsonErr);
        return createErrorResult('AYRISTIRMA_HATASI', report);
      }
      const looksLikeProject = parsedJson
        && typeof parsedJson === 'object'
        && ((Array.isArray(parsedJson.tabs) && parsedJson.tabs.length > 0) || Array.isArray(parsedJson.elements));
      if (!looksLikeProject) {
        return createErrorResult('AYRISTIRMA_HATASI', report);
      }

      emitProgress('yerleştiriliyor', 2, 2);
      const schema = importSiteCodeToProjectSchema(
        craftItem.decodedText,
        craftItem.name,
        craftItem.filePath || null,
        { stats }
      );
      if (!hasVisibleProjectContent(schema)) {
        return createErrorResult('ICERIK_YOK', report);
      }
      report.pages = schema.tabs.length;
      report.nodes = schema.tabs.reduce((acc, t) => acc + flattenTree(t.elements || []).length, 0);
      report.warnings = buildWarningsFromStats(stats, warningsCollector);
      return { ok: true, project: schema, report };
    }

    // 2. HTML / HTM / JSX / TSX kod dosyaları yoksa uygun hata kodunu döndür
    if (codeItems.length === 0) {
      if (report.skipped.length > 0) {
        const hasTooLarge = report.skipped.some((s) => s.reason === IMPORT_ERRORS.COK_BUYUK);
        if (hasTooLarge) return createErrorResult('COK_BUYUK', report);
        return createErrorResult('BICIM_DESTEKLENMIYOR', report);
      }
      return createErrorResult('ICERIK_YOK', report);
    }

    // Sayfaları sırala (index.html ilk sırada olacak şekilde)
    codeItems.sort((a, b) => {
      const aIndex = /^index\.html?$/i.test(a.name) ? 0 : 1;
      const bIndex = /^index\.html?$/i.test(b.name) ? 0 : 1;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return String(a.relativePath || a.name).localeCompare(String(b.relativePath || b.name));
    });

    const combinedCssText = cssTexts.join('\n');
    const mergedTabs = [];
    let firstProjectMeta = null;

    for (let idx = 0; idx < codeItems.length; idx += 1) {
      if (checkCancelled()) return createErrorResult('IPTAL', report);
      const cItem = codeItems[idx];
      emitProgress('analiz', idx + 1, codeItems.length);

      const health = validateMarkupSyntaxHealth(cItem.decodedText, cItem.extInfo.ext);
      if (!health.ok) {
        if (normalized.mode === 'single' || codeItems.length === 1) {
          return createErrorResult(health.code || 'AYRISTIRMA_HATASI', report);
        }
        report.skipped.push({
          name: cItem.relativePath || cItem.name,
          reason: IMPORT_ERRORS[health.code] || IMPORT_ERRORS.AYRISTIRMA_HATASI,
        });
        warningsCollector.push(`${cItem.name}: Geçersiz sözdizimi nedeniyle atlandı.`);
        continue;
      }

      if (idx > 0 && idx % 5 === 0) await yieldMicroTurn();
      if (checkCancelled()) return createErrorResult('IPTAL', report);

      const baseStem = cItem.name.replace(/\.(html?|jsx|tsx)$/i, '');
      const isHome = idx === 0 && /^(index|anasayfa|home|app|main)$/i.test(baseStem);
      const tabRoute = isHome ? '/' : `/${baseStem.toLowerCase().replace(/[^a-z0-9-_]+/g, '-')}`;
      const tabName = isHome ? 'Anasayfa.craft' : `${baseStem}.craft`;

      const relDir = String(cItem.relativePath || '').includes('/')
        ? String(cItem.relativePath).split('/').slice(0, -1).join('/')
        : '';

      const pageSchema = importSiteCodeToProjectSchema(
        cItem.decodedText,
        cItem.name,
        cItem.filePath || null,
        {
          stats,
          extraCssText: combinedCssText,
          assetDataUrlMap,
          baseDirPath: relDir,
          tabName,
          route: tabRoute,
          maxNodesPerTab: 600,
        }
      );

      if (!firstProjectMeta) firstProjectMeta = pageSchema;
      if (Array.isArray(pageSchema.tabs)) {
        mergedTabs.push(...pageSchema.tabs);
      }
    }

    if (checkCancelled()) return createErrorResult('IPTAL', report);
    emitProgress('yerleştiriliyor', 1, 1);

    if (!firstProjectMeta || mergedTabs.length === 0) {
      return createErrorResult('ICERIK_YOK', report);
    }

    const finalProject = {
      ...firstProjectMeta,
      tabs: mergedTabs,
      activeTabId: mergedTabs[0]?.id,
    };

    if (!hasVisibleProjectContent(finalProject)) {
      return createErrorResult('ICERIK_YOK', report);
    }

    report.pages = finalProject.tabs.length;
    report.nodes = finalProject.tabs.reduce((acc, t) => acc + flattenTree(t.elements || []).length, 0);
    report.warnings = buildWarningsFromStats(stats, warningsCollector);

    return { ok: true, project: finalProject, report };
  } catch (unexpectedErr) {
    console.error('[CraftImport] Beklenmeyen içe aktarma hatası:', unexpectedErr);
    return createErrorResult('DOSYA_OKUNAMADI', report);
  }
}
