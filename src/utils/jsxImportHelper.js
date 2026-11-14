/**
 * JSX/TSX ayrıştırma, güvenlik temizliği ve biçim doğrulama yardımcıları.
 * Güvenlik gereği hiçbir içe aktarılan kod çalıştırılmaz (eval / Function / dinamik import yok).
 */

export const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'applet',
  'base',
]);

export const SAFE_VOID_TAGS = new Set([
  'img', 'input', 'br', 'hr', 'source', 'meta', 'link', 'wbr', 'col', 'area', 'track',
]);

const URL_ATTR_KEYS = new Set([
  'href', 'src', 'action', 'formaction', 'data', 'poster', 'xlink:href', 'cite', 'background',
]);

/**
 * Verilen URL veya öznitelik değerinin javascript:/vbscript:/data:text/html içerip içermediğini kontrol eder.
 */
export function isUnsafeUrl(rawVal) {
  if (typeof rawVal !== 'string') return false;
  // Kontrol karakterlerini ve boşlukları temizleyip protokolü denetle (ör. "java\tscript:")
  const normalized = rawVal
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith('javascript:')
    || normalized.startsWith('vbscript:')
    || normalized.startsWith('data:text/html')
  );
}

/**
 * Öznitelik haritasını zararlı olaylardan (on*) ve javascript: URL'lerinden temizler.
 */
export function sanitizeElementAttrs(rawAttrs = {}, stats = null) {
  const clean = {};
  for (const [k, v] of Object.entries(rawAttrs || {})) {
    const lowerKey = k.toLowerCase();
    // Olay dinleyicilerini (onclick, onload, onClick, vb.) ve srcdoc'u tamamen kaldır
    if (/^on[a-z]/i.test(k) || lowerKey === 'srcdoc') {
      if (stats) stats.removedEventAttrs += 1;
      continue;
    }
    const strVal = typeof v === 'string' ? v : '';
    if ((URL_ATTR_KEYS.has(lowerKey) || lowerKey.endsWith('href') || lowerKey.endsWith('src')) && isUnsafeUrl(strVal)) {
      if (stats) stats.removedJsUrls += 1;
      continue;
    }
    if (lowerKey === 'style' && isUnsafeUrl(strVal)) {
      if (stats) stats.removedJsUrls += 1;
      clean[k] = strVal.replace(/url\s*\(\s*(['"]?)\s*(?:javascript|vbscript):[^)]*\1\s*\)/gi, 'none');
      continue;
    }
    clean[k] = v;
  }
  return clean;
}

/**
 * CSS stil nesnesindeki tehlikeli değerleri (javascript:, expression(), -moz-binding) ayıklar.
 */
export function sanitizeCssStyleObj(styleObj = {}, stats = null) {
  const out = {};
  for (const [k, v] of Object.entries(styleObj || {})) {
    if (typeof v === 'string') {
      const compact = v.replace(/[\u0000-\u001f\s]+/g, '').toLowerCase();
      if (compact.includes('javascript:') || compact.includes('vbscript:') || /expression\s*\(|-moz-binding\s*:/i.test(v)) {
        if (stats) stats.removedJsUrls += 1;
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

/**
 * İçe aktarılan tüm CraftStudio proje şemasını (JSON dahil) son bir derin güvenlik temizliğinden geçirir.
 */
export function sanitizeCraftProjectSchema(schema, stats = null) {
  if (!schema || typeof schema !== 'object') return schema;

  const walkElements = (list = []) => {
    const out = [];
    for (const node of list) {
      if (!node || typeof node !== 'object') continue;
      const nodeType = String(node.type || 'div').toLowerCase();
      if (DANGEROUS_TAGS.has(nodeType)) {
        if (stats) {
          if (nodeType === 'script') stats.removedScripts += 1;
          else stats.removedEmbeds += 1;
        }
        continue;
      }
      const nextNode = { ...node };
      if (nextNode.attrs && typeof nextNode.attrs === 'object') {
        nextNode.attrs = sanitizeElementAttrs(nextNode.attrs, stats);
      }
      if (typeof nextNode.imageUrl === 'string' && isUnsafeUrl(nextNode.imageUrl)) {
        if (stats) stats.removedJsUrls += 1;
        delete nextNode.imageUrl;
      }
      if (nextNode.style && typeof nextNode.style === 'object') {
        nextNode.style = sanitizeCssStyleObj(nextNode.style, stats);
      }
      // HTML ham gömülü parçacıklar içinde <script veya on* izi varsa temizle
      if (typeof nextNode.textContent === 'string' && /<script\b/i.test(nextNode.textContent)) {
        nextNode.textContent = nextNode.textContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
        if (stats) stats.removedScripts += 1;
      }
      if (typeof nextNode.content === 'string' && /<script\b/i.test(nextNode.content)) {
        nextNode.content = nextNode.content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
      }
      if (Array.isArray(nextNode.children)) {
        nextNode.children = walkElements(nextNode.children);
      }
      out.push(nextNode);
    }
    return out;
  };

  if (Array.isArray(schema.tabs)) {
    schema.tabs = schema.tabs.map((tab) => ({
      ...tab,
      elements: walkElements(tab.elements || []),
    }));
  }
  if (Array.isArray(schema.elements)) {
    schema.elements = walkElements(schema.elements);
  }
  return schema;
}

/**
 * İçeriğin HTML veya JSX/TSX olarak ayrıştırılabilir olup olmadığını kontrol eder.
 * Yalnızca gerçekten bozuk sözdizimini reddeder (eksik opsiyonel kapanış etiketli normal HTML'i engellemez).
 */
export function validateMarkupSyntaxHealth(rawContent, ext) {
  const str = String(rawContent || '');
  if (!str.trim()) {
    return { ok: false, code: 'ICERIK_YOK', reason: 'Dosya içeriği boş.' };
  }
  // NUL veya belirgin ikili dosya baytları
  if (/\u0000/.test(str)) {
    return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'İkili (binary) veya geçersiz karakter içeriyor.' };
  }

  const lowerExt = String(ext || '').toLowerCase();
  if (lowerExt === 'html' || lowerExt === 'htm') {
    // Ham script/style/yorum bloklarını temizleyerek işaretleme gövdesini denetle
    const markupOnly = str
      .replace(/<!DOCTYPE[^>]*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

    if (!/<[a-zA-Z][a-zA-Z0-9.:_-]*/.test(str)) {
      return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'Geçerli HTML etiketi bulunamadı.' };
    }

    // Açık kalan `<etiket ...` başlığı kapanmadan yeni `<` başlıyorsa veya `<<<` / `>>>` bozulma imi varsa reddet
    if (/<<<|>>>/.test(markupOnly)) {
      return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'Bozuk işaretleme imleri (<<< / >>>) saptandı.' };
    }

    // Bir açılış etiketi (`<img src="x"`) `>` görmeden yeni `<etiket` ile kesilmiş mi tara
    let inTag = false;
    let quote = null;
    for (let i = 0; i < markupOnly.length; i += 1) {
      const ch = markupOnly[i];
      if (!inTag) {
        if (ch === '<' && (markupOnly[i + 1] === '/' || /[a-zA-Z!]/.test(markupOnly[i + 1] || ''))) {
          inTag = true;
          quote = null;
        }
      } else {
        if (quote) {
          if (ch === quote && markupOnly[i - 1] !== '\\') quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          inTag = false;
        } else if (ch === '<') {
          return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'Kapanmamış etiket sözdizimi saptandı.' };
        }
      }
    }
    if (inTag) {
      return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'Dosya sonunda kapatılmamış etiket başlığı var.' };
    }
  } else if (lowerExt === 'jsx' || lowerExt === 'tsx') {
    const blocks = extractJsxBlocksFromSource(str);
    if (blocks.length === 0) {
      return { ok: false, code: 'AYRISTIRMA_HATASI', reason: 'Dosyada geçerli JSX return bloğu bulunamadı.' };
    }
  }

  return { ok: true };
}

/**
 * Basit JS/TS dizge, sayı, boolean, dizi ve nesne değişmezlerini (literal) eval kullanmadan ayrıştırır.
 */
function parseSafeJsLiteral(rawExpr) {
  const src = String(rawExpr || '').trim();
  if (!src) return { ok: false };
  let idx = 0;

  const skipWs = () => {
    while (idx < src.length && /\s/.test(src[idx])) idx += 1;
  };

  const parseValue = (depth = 0) => {
    if (depth > 8) return { ok: false };
    skipWs();
    if (idx >= src.length) return { ok: false };
    const ch = src[idx];

    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      idx += 1;
      let out = '';
      while (idx < src.length) {
        const c = src[idx];
        if (c === '\\' && idx + 1 < src.length) {
          const next = src[idx + 1];
          out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          idx += 2;
          continue;
        }
        if (c === q) {
          idx += 1;
          return { ok: true, value: out };
        }
        out += c;
        idx += 1;
      }
      return { ok: false };
    }

    if (ch === '[') {
      idx += 1;
      const arr = [];
      skipWs();
      while (idx < src.length && src[idx] !== ']') {
        const item = parseValue(depth + 1);
        if (!item.ok) break;
        arr.push(item.value);
        skipWs();
        if (src[idx] === ',') idx += 1;
        skipWs();
      }
      if (src[idx] === ']') idx += 1;
      return { ok: true, value: arr };
    }

    if (ch === '{') {
      idx += 1;
      const obj = {};
      skipWs();
      while (idx < src.length && src[idx] !== '}') {
        skipWs();
        let key = null;
        if (src[idx] === '"' || src[idx] === "'") {
          const kRes = parseValue(depth + 1);
          if (!kRes.ok) break;
          key = String(kRes.value);
        } else {
          const start = idx;
          while (idx < src.length && /[a-zA-Z0-9_$-]/.test(src[idx])) idx += 1;
          key = src.slice(start, idx);
        }
        if (!key) break;
        skipWs();
        if (src[idx] !== ':') break;
        idx += 1;
        const valRes = parseValue(depth + 1);
        if (!valRes.ok) break;
        obj[key] = valRes.value;
        skipWs();
        if (src[idx] === ',') idx += 1;
        skipWs();
      }
      if (src[idx] === '}') idx += 1;
      return { ok: true, value: obj };
    }

    if (src.startsWith('true', idx) && !/[a-zA-Z0-9_$]/.test(src[idx + 4] || '')) {
      idx += 4;
      return { ok: true, value: true };
    }
    if (src.startsWith('false', idx) && !/[a-zA-Z0-9_$]/.test(src[idx + 5] || '')) {
      idx += 5;
      return { ok: true, value: false };
    }
    if (src.startsWith('null', idx) && !/[a-zA-Z0-9_$]/.test(src[idx + 4] || '')) {
      idx += 4;
      return { ok: true, value: null };
    }
    const numMatch = src.slice(idx).match(/^-?\d+(?:\.\d+)?/);
    if (numMatch) {
      idx += numMatch[0].length;
      return { ok: true, value: Number(numMatch[0]) };
    }
    return { ok: false };
  };

  return parseValue(0);
}

/**
 * Bileşen başlığındaki sabit `const` verileri, varsayılan prop'ları ve `useState(...)` ilk değerlerini toplar.
 */
export function parseStaticJsxScope(source = '') {
  const scope = {};
  const str = String(source || '');

  // 1. Üst seviye `const NAME = [...]` veya literal tanımları (dengeli köşeli parantez ile)
  const constRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:[^=]+)?\s*=\s*/g;
  let cm;
  while ((cm = constRe.exec(str)) !== null) {
    const varName = cm[1];
    let pos = cm.index + cm[0].length;
    while (pos < str.length && /\s/.test(str[pos])) pos += 1;
    const ch = str[pos];
    if (ch === '[' || ch === '{' || ch === '"' || ch === "'" || /[-0-9tfn]/.test(ch || '')) {
      const sliceEnd = findBalancedExprEnd(str, pos);
      const rawLit = str.slice(pos, sliceEnd);
      const parsed = parseSafeJsLiteral(rawLit);
      if (parsed.ok) scope[varName] = parsed.value;
    }
  }

  // 2. Destructured prop varsayılanları: `{ baslik = 'Seçkin Takılar', indirimVar = true }`
  const propDefRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|true|false|null|\[\]|\d+(?:\.\d+)?)/g;
  let pm;
  while ((pm = propDefRe.exec(str)) !== null) {
    if (pm[1] in scope) continue;
    const parsed = parseSafeJsLiteral(pm[2]);
    if (parsed.ok) scope[pm[1]] = parsed.value;
  }

  // 3. `const [x, setX] = useState<...>(initial)`
  const stateRe = /\bconst\s*\[\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\]\s*=\s*useState(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  let sm;
  while ((sm = stateRe.exec(str)) !== null) {
    const parsed = parseSafeJsLiteral(sm[2]);
    if (parsed.ok) scope[sm[1]] = parsed.value;
  }

  return scope;
}

function findBalancedExprEnd(str, startPos) {
  const open = str[startPos];
  if (open === '"' || open === "'" || open === '`') {
    let i = startPos + 1;
    while (i < str.length) {
      if (str[i] === '\\') { i += 2; continue; }
      if (str[i] === open) return i + 1;
      i += 1;
    }
    return str.length;
  }
  if (open === '[' || open === '{' || open === '(') {
    const closeMap = { '[': ']', '{': '}', '(': ')' };
    const stack = [closeMap[open]];
    let i = startPos + 1;
    while (i < str.length && stack.length > 0) {
      const c = str[i];
      if (c === '"' || c === "'" || c === '`') {
        i = findBalancedExprEnd(str, i);
        continue;
      }
      if (c === '/' && str[i + 1] === '/') {
        const nl = str.indexOf('\n', i);
        i = nl === -1 ? str.length : nl + 1;
        continue;
      }
      if (c === '/' && str[i + 1] === '*') {
        const endC = str.indexOf('*/', i + 2);
        i = endC === -1 ? str.length : endC + 2;
        continue;
      }
      if (closeMap[c]) stack.push(closeMap[c]);
      else if (c === stack[stack.length - 1]) stack.pop();
      i += 1;
    }
    return i;
  }
  let i = startPos;
  while (i < str.length && !/[\s,;)\]}:]/.test(str[i])) i += 1;
  return i;
}

/**
 * Dengeli JSX başlangıç etiketinden başlayarak tam JSX öğesini sonuna kadar tarar.
 */
function findBalancedJsxElementEnd(str, startPos) {
  let pos = startPos;
  const depthTags = [];
  const limit = str.length;
  let guard = 0;

  while (pos < limit && guard < 100000) {
    guard += 1;
    if (str[pos] !== '<') {
      if (str[pos] === '{') {
        pos = findBalancedExprEnd(str, pos);
        continue;
      }
      pos += 1;
      continue;
    }

    // Fragment kapanışı </>
    if (str.startsWith('</>', pos)) {
      if (depthTags.length > 0) depthTags.pop();
      pos += 3;
      if (depthTags.length === 0) return pos;
      continue;
    }
    // Fragment açılışı <>
    if (str.startsWith('<>', pos)) {
      depthTags.push('__fragment');
      pos += 2;
      continue;
    }

    const isClose = str[pos + 1] === '/';
    let p = isClose ? pos + 2 : pos + 1;
    const tagStart = p;
    while (p < limit && /[A-Za-z0-9_.:-]/.test(str[p])) p += 1;
    const tagName = str.slice(tagStart, p);
    if (!tagName) {
      pos += 1;
      continue;
    }

    // Etiket özniteliklerini (dizge ve `{...}` ifadeleri dahil) tara
    let selfClosing = false;
    while (p < limit) {
      const ch = str[p];
      if (ch === '"' || ch === "'" || ch === '`') {
        p = findBalancedExprEnd(str, p);
        continue;
      }
      if (ch === '{') {
        p = findBalancedExprEnd(str, p);
        continue;
      }
      if (ch === '/' && str[p + 1] === '>') {
        selfClosing = true;
        p += 2;
        break;
      }
      if (ch === '>') {
        p += 1;
        break;
      }
      p += 1;
    }

    if (isClose) {
      for (let d = depthTags.length - 1; d >= 0; d -= 1) {
        if (depthTags[d] === tagName) {
          depthTags.length = d;
          break;
        }
      }
      if (depthTags.length === 0) return p;
    } else if (!selfClosing) {
      depthTags.push(tagName);
    } else if (depthTags.length === 0) {
      return p;
    }
    pos = p;
  }

  return limit;
}

/**
 * Kaynak JSX/TSX metninden tüm `return (...)` veya `return <...>` bloklarını güvenle çıkarır.
 */
export function extractJsxBlocksFromSource(rawJsx = '') {
  const str = String(rawJsx || '');
  const blocks = [];
  let i = 0;

  while (i < str.length) {
    const ch = str[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = findBalancedExprEnd(str, i);
      continue;
    }
    if (ch === '/' && str[i + 1] === '/') {
      const nl = str.indexOf('\n', i);
      i = nl === -1 ? str.length : nl + 1;
      continue;
    }
    if (ch === '/' && str[i + 1] === '*') {
      const endC = str.indexOf('*/', i + 2);
      i = endC === -1 ? str.length : endC + 2;
      continue;
    }

    // `return` anahtar sözcüğünü yakala
    if (
      str.startsWith('return', i)
      && (i === 0 || !/[A-Za-z0-9_$]/.test(str[i - 1]))
      && !/[A-Za-z0-9_$]/.test(str[i + 6] || '')
    ) {
      let j = i + 6;
      while (j < str.length && /\s/.test(str[j])) j += 1;
      if (str[j] === '(') {
        const endParen = findBalancedExprEnd(str, j);
        const inner = str.slice(j + 1, endParen - 1).trim();
        if (inner.startsWith('<')) {
          blocks.push(inner);
          i = endParen;
          continue;
        }
      } else if (str[j] === '<') {
        const endTag = findBalancedJsxElementEnd(str, j);
        blocks.push(str.slice(j, endTag).trim());
        i = endTag;
        continue;
      }
    }
    i += 1;
  }

  // Hiç `return` yoksa doğrudan JSX parçası yapıştırılmış olabilir
  const trimmed = str.trim();
  if (blocks.length === 0 && trimmed.startsWith('<') && /<\/[A-Za-z>]|\/>/.test(trimmed)) {
    blocks.push(trimmed);
  }

  return blocks;
}

function resolveExpressionPath(expr, scope) {
  const clean = String(expr || '').trim();
  if (!clean) return undefined;
  const parts = clean.split('.');
  let cur = scope;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Bir `{expr}` ifadesini statik kapsama göre metne veya iç içe JSX bloklarına dönüştürür.
 */
function splitTopLevelBinaryOrTernary(expr, op) {
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '"' || c === "'" || c === '`') {
      i = findBalancedExprEnd(expr, i) - 1;
      continue;
    }
    if (c === '(') depthParen += 1;
    else if (c === ')') depthParen -= 1;
    else if (c === '{') depthBrace += 1;
    else if (c === '}') depthBrace -= 1;
    else if (c === '[') depthBracket += 1;
    else if (c === ']') depthBracket -= 1;
    else if (depthParen === 0 && depthBrace === 0 && depthBracket === 0 && expr.startsWith(op, i)) {
      return i;
    }
  }
  return -1;
}

/**
 * JSX sözdizimini doğrudan CraftStudio soyut DOM ağacına (`absNode`) ayrıştırır.
 */
export function parseJsxToAbstractTree(jsxInput, baseScope = {}, stats = null) {
  const src = String(jsxInput || '').trim();
  let pos = 0;

  const parseAttrMap = (attrStr, scope) => {
    const attrs = {};
    let p = 0;
    while (p < attrStr.length) {
      while (p < attrStr.length && /\s/.test(attrStr[p])) p += 1;
      if (p >= attrStr.length) break;
      if (attrStr.startsWith('{...', p)) {
        p = findBalancedExprEnd(attrStr, p);
        continue;
      }
      const kStart = p;
      while (p < attrStr.length && /[A-Za-z0-9_.:-]/.test(attrStr[p])) p += 1;
      const key = attrStr.slice(kStart, p);
      if (!key) { p += 1; continue; }
      while (p < attrStr.length && /\s/.test(attrStr[p])) p += 1;

      let val = true;
      if (attrStr[p] === '=') {
        p += 1;
        while (p < attrStr.length && /\s/.test(attrStr[p])) p += 1;
        const ch = attrStr[p];
        if (ch === '"' || ch === "'") {
          const end = findBalancedExprEnd(attrStr, p);
          val = attrStr.slice(p + 1, end - 1);
          p = end;
        } else if (ch === '{') {
          const end = findBalancedExprEnd(attrStr, p);
          const expr = attrStr.slice(p + 1, end - 1).trim();
          p = end;
          if (expr.startsWith('{') && expr.endsWith('}')) {
            val = expr;
          } else {
            const lit = parseSafeJsLiteral(expr);
            if (lit.ok) val = String(lit.value);
            else {
              const resolved = resolveExpressionPath(expr, scope);
              val = resolved !== undefined ? String(resolved) : '';
            }
          }
        }
      }
      attrs[key] = val;
    }
    return sanitizeElementAttrs(attrs, stats);
  };

  const evalJsxExpr = (rawExpr, scope, depth) => {
    const expr = rawExpr.trim();
    if (!expr || expr.startsWith('/*')) return [];

    // 1. `.map((item) => (<JSX>))` veya `.map((item: Type) => ...)`
    const mapDotIdx = expr.indexOf('.map(');
    if (mapDotIdx > 0) {
      const targetExpr = expr.slice(0, mapDotIdx).trim();
      const mapCallStart = mapDotIdx + 4;
      const mapCallEnd = findBalancedExprEnd(expr, mapCallStart);
      const innerCallback = expr.slice(mapCallStart + 1, mapCallEnd - 1).trim();
      const arrowIdx = innerCallback.indexOf('=>');
      if (arrowIdx !== -1) {
        const paramRaw = innerCallback.slice(0, arrowIdx).trim().replace(/^\(|\)$/g, '');
        const firstParam = paramRaw.split(',')[0].split(':')[0].trim() || 'item';
        let bodyRaw = innerCallback.slice(arrowIdx + 2).trim();
        if (bodyRaw.startsWith('(') && bodyRaw.endsWith(')')) bodyRaw = bodyRaw.slice(1, -1).trim();
        if (bodyRaw.startsWith('{') && bodyRaw.includes('return')) {
          const innerBlocks = extractJsxBlocksFromSource(bodyRaw);
          bodyRaw = innerBlocks[0] || '';
        }
        if (bodyRaw.startsWith('<')) {
          const arrData = resolveExpressionPath(targetExpr, scope);
          if (Array.isArray(arrData) && arrData.length > 0) {
            const out = [];
            for (const row of arrData.slice(0, 25)) {
              const childTree = parseJsxToAbstractTree(bodyRaw, { ...scope, [firstParam]: row }, stats);
              out.push(...(childTree.children || []));
            }
            return out;
          }
          // Dizi prop'u boşsa en az bir şablon kartı koru
          const fallbackTree = parseJsxToAbstractTree(bodyRaw, scope, stats);
          return fallbackTree.children || [];
        }
      }
    }

    // 2. Koşullu `cond && expr`
    const andIdx = splitTopLevelBinaryOrTernary(expr, '&&');
    if (andIdx !== -1) {
      const right = expr.slice(andIdx + 2).trim();
      if (right.startsWith('(') && right.endsWith(')')) {
        const unwrapped = right.slice(1, -1).trim();
        if (unwrapped.startsWith('<')) return parseJsxToAbstractTree(unwrapped, scope, stats).children || [];
      }
      if (right.startsWith('<')) return parseJsxToAbstractTree(right, scope, stats).children || [];
      return evalJsxExpr(right, scope, depth + 1);
    }

    // 3. Üçlü koşul `cond ? a : b`
    const qIdx = splitTopLevelBinaryOrTernary(expr, '?');
    if (qIdx !== -1) {
      const rest = expr.slice(qIdx + 1);
      const colonIdx = splitTopLevelBinaryOrTernary(rest, ':');
      if (colonIdx !== -1) {
        const condName = expr.slice(0, qIdx).trim();
        const condVal = resolveExpressionPath(condName, scope);
        let branchA = rest.slice(0, colonIdx).trim();
        let branchB = rest.slice(colonIdx + 1).trim();
        const unwrap = (b) => (b.startsWith('(') && b.endsWith(')') ? b.slice(1, -1).trim() : b);
        branchA = unwrap(branchA);
        branchB = unwrap(branchB);
        // JSX kolu varsa null olmayan JSX kolunu içe aktar (ör. footer koşullu bloğu)
        if (branchA.startsWith('<') && branchB === 'null') return parseJsxToAbstractTree(branchA, scope, stats).children || [];
        if (branchB.startsWith('<') && branchA === 'null') return parseJsxToAbstractTree(branchB, scope, stats).children || [];
        const chosen = condVal ? branchA : branchB;
        if (chosen === 'null' || chosen === 'undefined' || chosen === 'false') return [];
        if (chosen.startsWith('<')) return parseJsxToAbstractTree(chosen, scope, stats).children || [];
        const lit = parseSafeJsLiteral(chosen);
        if (lit.ok && lit.value != null) return [{ __text: String(lit.value) }];
        return [{ __text: chosen }];
      }
    }

    // 4. Nullish `x ?? 'Yok'` veya mantıksal OR `x || 'Yok'`
    const nullishIdx = splitTopLevelBinaryOrTernary(expr, '??');
    if (nullishIdx !== -1) {
      const leftVal = resolveExpressionPath(expr.slice(0, nullishIdx), scope);
      if (leftVal != null) return [{ __text: String(leftVal) }];
      const rightLit = parseSafeJsLiteral(expr.slice(nullishIdx + 2));
      return [{ __text: rightLit.ok ? String(rightLit.value) : expr.slice(nullishIdx + 2).trim() }];
    }

    // 5. Düz literal veya kapsam değişkeni
    const lit = parseSafeJsLiteral(expr);
    if (lit.ok && lit.value != null) return [{ __text: String(lit.value) }];
    const resolved = resolveExpressionPath(expr, scope);
    if (resolved !== undefined && resolved !== null) return [{ __text: String(resolved) }];
    if (/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(expr)) return [{ __text: expr }];
    return [];
  };

  const root = { tag: 'body', attrs: {}, children: [], textParts: [] };
  const stack = [root];

  while (pos < src.length) {
    if (src[pos] === '<') {
      if (src.startsWith('<!--', pos)) {
        const endHtmlComment = src.indexOf('-->', pos + 4);
        pos = endHtmlComment === -1 ? src.length : endHtmlComment + 3;
        continue;
      }
      if (src.startsWith('</>', pos)) {
        for (let s = stack.length - 1; s > 0; s -= 1) {
          if (stack[s].tag === 'div' && stack[s].__isFragment) {
            stack.length = s;
            break;
          }
        }
        pos += 3;
        continue;
      }
      if (src.startsWith('<>', pos)) {
        const frag = { tag: 'div', attrs: {}, children: [], textParts: [], __isFragment: true };
        stack[stack.length - 1].children.push(frag);
        stack.push(frag);
        pos += 2;
        continue;
      }

      const isClose = src[pos + 1] === '/';
      let p = isClose ? pos + 2 : pos + 1;
      const tStart = p;
      while (p < src.length && /[A-Za-z0-9_.:-]/.test(src[p])) p += 1;
      const rawTag = src.slice(tStart, p);
      if (!rawTag) {
        pos += 1;
        continue;
      }
      const tag = /^[A-Z]/.test(rawTag) ? 'div' : rawTag.toLowerCase();

      const attrStart = p;
      let selfClosing = false;
      while (p < src.length) {
        const c = src[p];
        if (c === '"' || c === "'" || c === '`') {
          p = findBalancedExprEnd(src, p);
          continue;
        }
        if (c === '{') {
          p = findBalancedExprEnd(src, p);
          continue;
        }
        if (c === '/' && src[p + 1] === '>') {
          selfClosing = true;
          p += 2;
          break;
        }
        if (c === '>') {
          p += 1;
          break;
        }
        p += 1;
      }
      const rawAttrSlice = src.slice(attrStart, selfClosing ? p - 2 : p - 1);
      pos = p;

      if (isClose) {
        for (let s = stack.length - 1; s > 0; s -= 1) {
          if (stack[s].tag === tag) {
            stack.length = s;
            break;
          }
        }
        continue;
      }

      if (DANGEROUS_TAGS.has(tag)) {
        if (stats) {
          if (tag === 'script') stats.removedScripts += 1;
          else stats.removedEmbeds += 1;
        }
        if (!selfClosing) {
          const closeRe = new RegExp(`</${tag}\\s*>`, 'i');
          const cm = closeRe.exec(src.slice(pos));
          if (cm) pos += cm.index + cm[0].length;
        }
        continue;
      }

      const attrs = parseAttrMap(rawAttrSlice, baseScope);
      const node = { tag, attrs, children: [], textParts: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing && !SAFE_VOID_TAGS.has(tag)) stack.push(node);
      continue;
    }

    if (src[pos] === '{') {
      const endBrace = findBalancedExprEnd(src, pos);
      const innerExpr = src.slice(pos + 1, endBrace - 1);
      pos = endBrace;
      const results = evalJsxExpr(innerExpr, baseScope, 0);
      const parent = stack[stack.length - 1];
      for (const r of results) {
        if (r?.__text) {
          const cleanTxt = r.__text.replace(/\s+/g, ' ').trim();
          if (cleanTxt) parent.textParts.push(cleanTxt);
        } else if (r) {
          parent.children.push(r);
        }
      }
      continue;
    }

    // Düz metin parçası
    const textStart = pos;
    while (pos < src.length && src[pos] !== '<' && src[pos] !== '{') pos += 1;
    const rawTxt = src.slice(textStart, pos).replace(/\s+/g, ' ').trim();
    if (rawTxt) {
      stack[stack.length - 1].textParts.push(rawTxt);
    }
  }

  return root;
}
