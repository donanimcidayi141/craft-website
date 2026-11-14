import { parseAndMigrateLoadedProject, buildSerializableProjectSchema } from './projectStorage.js';
import { ensureViewportAdapted, createDefaultCanvasByViewport } from './responsiveUtils.js';
import {
  DANGEROUS_TAGS,
  isUnsafeUrl,
  sanitizeElementAttrs,
  sanitizeCssStyleObj,
  sanitizeCraftProjectSchema,
  parseStaticJsxScope,
  extractJsxBlocksFromSource,
  parseJsxToAbstractTree,
  validateMarkupSyntaxHealth,
} from './jsxImportHelper.js';

export { validateMarkupSyntaxHealth, sanitizeCraftProjectSchema };

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'meta', 'link', 'head', 'title', 'br', 'hr',
  'template', 'iframe', 'object', 'embed', 'frame', 'frameset', 'applet', 'base',
]);
const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'source', 'meta', 'link', 'wbr']);
const TEXT_LEAF_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li', 'blockquote', 'strong', 'em']);
const SECTION_TAGS = new Set(['nav', 'header', 'section', 'main', 'footer', 'article', 'aside', 'form']);

let importUid = 1;
function nextNodeId(prefix = 'imp') {
  importUid += 1;
  return `${prefix}-${Date.now().toString(36)}-${importUid}`;
}

function kebabToCamel(prop = '') {
  return String(prop)
    .trim()
    .toLowerCase()
    .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function parseInlineCss(styleStr = '') {
  const out = {};
  if (!styleStr || typeof styleStr !== 'string') return out;
  styleStr.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx <= 0) return;
    const rawKey = decl.slice(0, idx).trim();
    const rawVal = decl.slice(idx + 1).trim();
    if (!rawKey || !rawVal) return;
    const key = rawKey.startsWith('--') ? rawKey : kebabToCamel(rawKey);
    out[key] = rawVal.replace(/\s*!important$/i, '').trim();
  });
  return out;
}

function parseCssPx(val, relativeBase = 1280) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? Math.round((pct / 100) * relativeBase) : null;
  }
  if (trimmed.endsWith('px')) {
    const px = parseFloat(trimmed);
    return Number.isFinite(px) ? Math.round(px) : null;
  }
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    const rem = parseFloat(trimmed);
    return Number.isFinite(rem) ? Math.round(rem * 16) : null;
  }
  if (trimmed.endsWith('vh')) {
    const vh = parseFloat(trimmed);
    return Number.isFinite(vh) ? Math.round((vh / 100) * 860) : null;
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) && /^[\d.]+$/.test(trimmed) ? Math.round(num) : null;
}

function extractTailwindHints(className = '') {
  const hints = {};
  if (!className || typeof className !== 'string') return hints;
  const tokens = className.split(/\s+/).filter(Boolean);

  for (const tok of tokens) {
    const bgMatch = tok.match(/^bg-\[([^\]]+)\]$/);
    if (bgMatch) hints.backgroundColor = bgMatch[1].replace(/_/g, ' ');
    const textColMatch = tok.match(/^text-\[(#[0-9a-fA-F]{3,8}|rgb[^\]]+)\]$/);
    if (textColMatch) hints.color = textColMatch[1].replace(/_/g, ' ');
    const textSizeMatch = tok.match(/^text-\[(\d+(?:\.\d+)?)px\]$/);
    if (textSizeMatch) hints.fontSize = `${textSizeMatch[1]}px`;
    const borderColMatch = tok.match(/^border-\[([^\]]+)\]$/);
    if (borderColMatch) hints.border = `1px solid ${borderColMatch[1].replace(/_/g, ' ')}`;
    const roundedMatch = tok.match(/^rounded-\[([^\]]+)\]$/);
    if (roundedMatch) hints.borderRadius = roundedMatch[1];

    if (tok === 'flex-row' || tok === 'grid' || tok === 'md:grid-cols-3' || tok === 'md:grid-cols-2' || tok === 'sm:flex-row') {
      hints._horizontal = true;
    }
    if (tok === 'text-center') hints.textAlign = 'center';
    if (tok === 'text-right') hints.textAlign = 'right';
    if (tok === 'font-bold') hints.fontWeight = '700';
    if (tok === 'font-extrabold') hints.fontWeight = '800';
    if (tok === 'font-semibold') hints.fontWeight = '600';
    if (tok === 'font-medium') hints.fontWeight = '500';
    if (tok === 'text-xs') hints.fontSize = '12px';
    if (tok === 'text-sm') hints.fontSize = '14px';
    if (tok === 'text-base') hints.fontSize = '16px';
    if (tok === 'text-lg') hints.fontSize = '18px';
    if (tok === 'text-xl') hints.fontSize = '20px';
    if (tok === 'text-2xl') hints.fontSize = '24px';
    if (tok === 'text-3xl') hints.fontSize = '30px';
    if (tok === 'text-4xl') hints.fontSize = '36px';
    if (tok === 'text-5xl') hints.fontSize = '48px';
    if (tok === 'rounded-lg') hints.borderRadius = '8px';
    if (tok === 'rounded-xl') hints.borderRadius = '12px';
    if (tok === 'rounded-2xl') hints.borderRadius = '16px';
    if (tok === 'rounded-full') hints.borderRadius = '999px';
    if (tok === 'text-white') hints.color = '#ffffff';
    if (tok === 'bg-white') hints.backgroundColor = '#ffffff';
    if (tok === 'bg-black') hints.backgroundColor = '#09090b';
  }
  return hints;
}

function parseStyleBlockRules(htmlDocOrStr, extraCssText = '', stats = null) {
  const ruleMap = { tags: {}, classes: {}, ids: {} };
  const cssBlocks = [];
  if (extraCssText && typeof extraCssText === 'string') {
    cssBlocks.push(extraCssText);
  }
  if (typeof htmlDocOrStr === 'string') {
    const matches = htmlDocOrStr.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
    for (const m of matches) cssBlocks.push(m[1] || '');
  } else if (htmlDocOrStr?.querySelectorAll) {
    htmlDocOrStr.querySelectorAll('style').forEach((s) => cssBlocks.push(s.textContent || ''));
  }

  const combinedRaw = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  if (stats && /display\s*:\s*(?:flex|inline-flex|grid|inline-grid)|grid-template-columns/i.test(combinedRaw)) {
    stats.hasComplexLayout = true;
  }
  const combined = combinedRaw.replace(/@media[\s\S]*?\}\s*\}/g, '');
  const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(combined)) !== null) {
    const selectors = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const props = sanitizeCssStyleObj(parseInlineCss(match[2]), stats);
    selectors.forEach((sel) => {
      if (/^#[a-zA-Z0-9_-]+$/.test(sel)) {
        const key = sel.slice(1);
        ruleMap.ids[key] = { ...(ruleMap.ids[key] || {}), ...props };
      } else if (/^\.[a-zA-Z0-9_-]+$/.test(sel)) {
        const key = sel.slice(1);
        ruleMap.classes[key] = { ...(ruleMap.classes[key] || {}), ...props };
      } else if (/^[a-zA-Z0-9]+$/.test(sel)) {
        const key = sel.toLowerCase();
        ruleMap.tags[key] = { ...(ruleMap.tags[key] || {}), ...props };
      }
    });
  }
  return ruleMap;
}

const RAW_SKIP_CONTAINER_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'frame', 'frameset', 'applet',
]);

/** Node veya DOMParser olmayan ortamlar için dayanıklı işaretleme ayrıştırıcısı. */
function parseMarkupFallback(markup, stats = null, budget = null) {
  const cleaned = String(markup || '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const root = { tag: 'body', attrs: {}, children: [], textParts: [] };
  const stack = [root];
  let pos = 0;
  const len = cleaned.length;

  while (pos < len) {
    if (budget && budget.abstractCount >= budget.maxAbstract) {
      if (stats) stats.truncatedNodes += 1;
      break;
    }

    const lt = cleaned.indexOf('<', pos);
    if (lt === -1) {
      const tailTxt = cleaned.slice(pos).replace(/\s+/g, ' ').trim();
      if (tailTxt) stack[stack.length - 1].textParts.push(tailTxt);
      break;
    }

    if (lt > pos) {
      const txt = cleaned.slice(pos, lt).replace(/\s+/g, ' ').trim();
      if (txt) stack[stack.length - 1].textParts.push(txt);
    }

    const isClose = cleaned[lt + 1] === '/';
    let p = isClose ? lt + 2 : lt + 1;
    const tagStart = p;
    while (p < len && /[a-zA-Z0-9.:_-]/.test(cleaned[p])) p += 1;
    const rawTag = cleaned.slice(tagStart, p);

    // Geçerli etiket adı başlamıyorsa düz karakter olarak atla
    if (!rawTag || !/^[a-zA-Z]/.test(rawTag)) {
      pos = lt + 1;
      continue;
    }

    const tag = rawTag.toLowerCase();
    // Tırnaklara duyarlı ve kapanmamış `<` kesilmelerini izleyen öznitelik tarayıcısı
    const attrStart = p;
    let quote = null;
    let interruptedByLt = false;
    let selfClosing = false;
    let closeBracketPos = -1;

    while (p < len) {
      const ch = cleaned[p];
      if (quote) {
        if (ch === quote && cleaned[p - 1] !== '\\') quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '<') {
        // Açılış başlığı `>` görmeden yeni `<` başladıysa başlığı burada kes
        interruptedByLt = true;
        closeBracketPos = p;
        break;
      } else if (ch === '>') {
        selfClosing = cleaned[p - 1] === '/' || VOID_TAGS.has(tag);
        closeBracketPos = p + 1;
        break;
      }
      p += 1;
    }

    if (closeBracketPos === -1) {
      pos = len;
      break;
    }

    const rawAttrSlice = interruptedByLt
      ? cleaned.slice(attrStart, p)
      : cleaned.slice(attrStart, selfClosing && cleaned[p - 1] === '/' ? p - 1 : p);
    pos = closeBracketPos;

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    // Tehlikeli / ham metin kapsayıcılarının (özellikle <script>/<style>/<iframe>) gövdesini tamamen atla
    if (RAW_SKIP_CONTAINER_TAGS.has(tag) || DANGEROUS_TAGS.has(tag)) {
      if (stats) {
        if (tag === 'script') stats.removedScripts += 1;
        else if (DANGEROUS_TAGS.has(tag)) stats.removedEmbeds += 1;
      }
      if (!selfClosing && !interruptedByLt) {
        const endRe = new RegExp(`</${tag}\\s*>`, 'i');
        const em = endRe.exec(cleaned.slice(pos));
        if (em) pos += em.index + em[0].length;
      }
      continue;
    }

    if (SKIP_TAGS.has(tag)) continue;

    const rawAttrs = {};
    const attrRe = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\{([\s\S]*?)\}\}|\{([^}]*)\}))?/g;
    let am;
    while ((am = attrRe.exec(rawAttrSlice)) !== null) {
      const key = am[1];
      if (!key) continue;
      if (am[2] !== undefined) rawAttrs[key] = am[2];
      else if (am[3] !== undefined) rawAttrs[key] = am[3];
      else if (am[4] !== undefined) rawAttrs[key] = `{${am[4]}}`;
      else if (am[5] !== undefined) rawAttrs[key] = am[5].trim().replace(/^["']|["']$/g, '');
      else rawAttrs[key] = true;
    }

    const attrs = sanitizeElementAttrs(rawAttrs, stats);
    if (attrs.id === 'craft-toast') continue;

    if (budget) budget.abstractCount += 1;
    const node = { tag, attrs, children: [], textParts: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !interruptedByLt) stack.push(node);
  }
  return root;
}

function normalizeJsxAttrStyle(rawStyleVal) {
  if (!rawStyleVal || typeof rawStyleVal !== 'string') return {};
  const trimmed = rawStyleVal.trim();
  if (!trimmed.startsWith('{')) return parseInlineCss(trimmed);

  const out = {};
  const inner = trimmed.replace(/^\{+/, '').replace(/\}+$/, '');
  const pairRe = /([a-zA-Z0-9_]+)\s*:\s*(?:'([^']*)'|"([^"]*)"|([\d.]+))/g;
  let pm;
  while ((pm = pairRe.exec(inner)) !== null) {
    const key = pm[1];
    const val = pm[2] ?? pm[3] ?? (pm[4] ? `${pm[4]}px` : '');
    if (key && val !== '') out[key] = val;
  }
  return out;
}

function extractReactJsxMarkup(rawJsx = '') {
  const blocks = extractJsxBlocksFromSource(rawJsx);
  return blocks.length > 0 ? blocks[0] : '';
}

function domNodeToAbstract(el, stats = null, budget = null) {
  if (!el) return null;
  if (el.nodeType === 3) {
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return txt ? { __text: txt } : null;
  }
  if (el.nodeType !== 1) return null;
  const tag = (el.tagName || 'div').toLowerCase();
  if (DANGEROUS_TAGS.has(tag)) {
    if (stats) {
      if (tag === 'script') stats.removedScripts += 1;
      else stats.removedEmbeds += 1;
    }
    return null;
  }
  if (SKIP_TAGS.has(tag)) return null;
  if (budget) {
    if (budget.abstractCount >= budget.maxAbstract) {
      if (stats) stats.truncatedNodes += 1;
      return null;
    }
    budget.abstractCount += 1;
  }

  const rawAttrs = {};
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i += 1) {
      const a = el.attributes[i];
      rawAttrs[a.name] = a.value;
    }
  }
  if (rawAttrs.id === 'craft-toast') return null;
  const attrs = sanitizeElementAttrs(rawAttrs, stats);

  const children = [];
  const textParts = [];
  for (let idx = 0; idx < el.childNodes.length; idx += 1) {
    if (budget && budget.abstractCount >= budget.maxAbstract) {
      if (stats) stats.truncatedNodes += 1;
      break;
    }
    const ch = el.childNodes[idx];
    if (ch.nodeType === 3) {
      const txt = (ch.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) textParts.push(txt);
    } else if (ch.nodeType === 1) {
      const sub = domNodeToAbstract(ch, stats, budget);
      if (sub) children.push(sub);
    }
  }
  return { tag, attrs, children, textParts };
}

function findCraftPageRoots(absNode) {
  if (!absNode) return [];
  const cls = String(absNode.attrs?.class || absNode.attrs?.className || '');
  if (absNode.tag === 'section' && cls.split(/\s+/).includes('craft-page')) {
    return [absNode];
  }
  const found = [];
  (absNode.children || []).forEach((ch) => {
    found.push(...findCraftPageRoots(ch));
  });
  return found;
}

function collectInlineSpanText(absNode) {
  if (!absNode) return '';
  const chunks = [];
  if (Array.isArray(absNode.textParts) && absNode.textParts.length > 0) {
    chunks.push(absNode.textParts.join(' '));
  }
  (absNode.children || []).forEach((ch) => {
    const subTxt = collectInlineSpanText(ch);
    if (subTxt) chunks.push(subTxt);
  });
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function resolveRelativeAssetUrl(rawSrc, assetDataUrlMap = null, baseDirPath = '') {
  if (!rawSrc || typeof rawSrc !== 'string') return { url: rawSrc, missing: false };
  const trimmed = rawSrc.trim();
  if (!trimmed || isUnsafeUrl(trimmed)) return { url: '', missing: false };
  if (/^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(trimmed)) {
    return { url: trimmed, missing: false };
  }
  if (assetDataUrlMap && assetDataUrlMap instanceof Map && assetDataUrlMap.size > 0) {
    const cleanRel = trimmed.replace(/^\.\//, '').replace(/^\/+/, '');
    const joined = baseDirPath ? `${baseDirPath.replace(/\/+$/, '')}/${cleanRel}` : cleanRel;
    const baseName = cleanRel.split('/').pop();
    const hit = assetDataUrlMap.get(joined.toLowerCase())
      || assetDataUrlMap.get(cleanRel.toLowerCase())
      || (baseName ? assetDataUrlMap.get(baseName.toLowerCase()) : null);
    if (hit) return { url: hit, missing: false };
  }
  return { url: trimmed, missing: true };
}

function convertAbstractNodeToAst(absNode, ruleMap, parentWidth = 1280, cursorY = 0, depth = 0, isHorizontalChild = false, inheritedColor = null, ctx = null) {
  if (!absNode || absNode.__text) return null;
  if (DANGEROUS_TAGS.has(absNode.tag) || SKIP_TAGS.has(absNode.tag)) return null;
  if (ctx && ctx.count >= ctx.maxNodes) {
    if (ctx.stats) ctx.stats.truncatedNodes += 1;
    return null;
  }
  if (ctx) ctx.count += 1;

  const tag = absNode.tag || 'div';
  const rawAttrs = sanitizeElementAttrs(absNode.attrs || {}, ctx?.stats || null);

  const idAttr = rawAttrs.id ? String(rawAttrs.id) : '';
  const classAttr = String(rawAttrs.class || rawAttrs.className || '');
  const classes = classAttr.split(/\s+/).filter(Boolean);

  // Merge cascade: tag rule -> class rules -> id rule -> Tailwind hints -> inline style
  const mergedStyle = { ...(ruleMap.tags[tag] || {}) };
  classes.forEach((cls) => {
    if (ruleMap.classes[cls]) Object.assign(mergedStyle, ruleMap.classes[cls]);
  });
  if (idAttr && ruleMap.ids[idAttr]) Object.assign(mergedStyle, ruleMap.ids[idAttr]);

  const twHints = extractTailwindHints(classAttr);
  const inlineCss = rawAttrs.style ? normalizeJsxAttrStyle(rawAttrs.style) : {};
  const styleObj = sanitizeCssStyleObj({ ...mergedStyle, ...twHints, ...inlineCss }, ctx?.stats || null);
  const hintedHorizontal = Boolean(styleObj._horizontal || styleObj.display === 'flex' || styleObj.display === 'grid')
    && styleObj.flexDirection !== 'column';
  if (ctx?.stats && (hintedHorizontal || styleObj.display === 'flex' || styleObj.display === 'grid' || styleObj.gridTemplateColumns)) {
    ctx.stats.hasComplexLayout = true;
  }
  delete styleObj._horizontal;

  const nextInheritedColor = styleObj.color || inheritedColor || null;
  if (!styleObj.color && inheritedColor && tag !== 'button') {
    styleObj.color = inheritedColor;
  }
  if (tag === 'button' && !styleObj.backgroundColor && !styleObj.background) {
    styleObj.backgroundColor = '#d4af37';
    if (!styleObj.color) styleObj.color = '#12100d';
    if (!styleObj.borderRadius) styleObj.borderRadius = '999px';
    if (!styleObj.border) styleObj.border = 'none';
    if (!styleObj.fontWeight) styleObj.fontWeight = '600';
    if (!styleObj.display) styleObj.display = 'inline-flex';
    if (!styleObj.alignItems) styleObj.alignItems = 'center';
    if (!styleObj.justifyContent) styleObj.justifyContent = 'center';
  }

  // Recover explicit CraftStudio percentage / px coords if present
  const explicitW = parseCssPx(styleObj.width, parentWidth);
  const explicitH = parseCssPx(styleObj.height, 860);
  const explicitX = parseCssPx(styleObj.left, parentWidth);
  const explicitY = parseCssPx(styleObj.top, 860);

  const isTextTag = TEXT_LEAF_TAGS.has(tag);
  const isNavLike = tag === 'nav' || tag === 'header';
  const isFooterLike = tag === 'footer';
  const isSectionLike = SECTION_TAGS.has(tag);

  let width = explicitW;
  if (!width) {
    if (depth === 0) {
      width = isNavLike || isFooterLike ? parentWidth : Math.min(parentWidth, 1280);
    } else if (isHorizontalChild) {
      width = tag === 'a' || tag === 'button' ? 120 : Math.max(180, Math.round((parentWidth - 80) / 3));
    } else if (tag === 'img') {
      width = Math.min(parentWidth - 40, 560);
    } else if (tag === 'button') {
      width = 180;
    } else {
      width = Math.max(180, parentWidth - (depth === 0 ? 0 : 48));
    }
  }
  width = Math.max(24, Math.min(parentWidth, width));

  const x = explicitX !== null
    ? Math.max(0, Math.min(parentWidth - width, explicitX))
    : depth === 0
      ? Math.round((parentWidth - width) / 2)
      : (isHorizontalChild ? 0 : 24);

  const directText = (absNode.textParts || []).join(' ').trim();
  const validAbsChildren = (absNode.children || []).filter((c) => c && !c.__text);

  // Convert nested children cleanly
  const astChildren = [];
  let childCursorY = isNavLike ? 16 : 28;
  let childCursorX = isNavLike ? 36 : 24;
  const horizontalContainer = hintedHorizontal || isNavLike || classes.some((c) => /grid|cards|menu|links|nav/i.test(c));

  if (validAbsChildren.length > 0 && !(isTextTag && validAbsChildren.every((c) => c.tag === 'span'))) {
    const innerAvailW = Math.max(120, width - 48);
    const colCount = Math.min(4, Math.max(1, validAbsChildren.length));
    const cellW = Math.max(110, Math.floor((innerAvailW - (colCount - 1) * 20) / colCount));

    for (let cIdx = 0; cIdx < validAbsChildren.length; cIdx += 1) {
      if (ctx && ctx.count >= ctx.maxNodes) {
        if (ctx.stats) ctx.stats.truncatedNodes += (validAbsChildren.length - cIdx);
        break;
      }
      const childAbs = validAbsChildren[cIdx];
      const childAst = convertAbstractNodeToAst(
        childAbs,
        ruleMap,
        width,
        childCursorY,
        depth + 1,
        horizontalContainer,
        nextInheritedColor,
        ctx
      );
      if (!childAst) continue;

      const childHasExplicitX = parseCssPx(normalizeJsxAttrStyle(childAbs.attrs?.style || '').left, width) !== null;
      const childHasExplicitY = parseCssPx(normalizeJsxAttrStyle(childAbs.attrs?.style || '').top, 860) !== null;

      if (!childHasExplicitX && !childHasExplicitY) {
        if (horizontalContainer) {
          if (childAst.width > cellW && isNavLike) {
            childAst.width = Math.min(260, Math.max(96, childAst.width));
          } else if (childAst.width > cellW && validAbsChildren.length <= 4) {
            childAst.width = cellW;
          }
          if (childCursorX + childAst.width > width - 20) {
            childCursorX = 24;
            childCursorY += (isNavLike ? 42 : Math.max(56, childAst.height + 16));
          }
          childAst.x = childCursorX;
          childAst.y = childCursorY;
          childCursorX += childAst.width + (isNavLike ? 18 : 20);
        } else {
          childAst.x = Math.min(Math.max(0, width - childAst.width), 24);
          childAst.y = childCursorY;
          childCursorY += childAst.height + 16;
        }
      }
      astChildren.push(childAst);
    }
  }

  let height = explicitH;
  if (!height) {
    if (astChildren.length > 0) {
      const maxChildBottom = Math.max(...astChildren.map((ch) => (ch.y || 0) + (ch.height || 40)));
      height = Math.max(isNavLike ? 72 : 140, maxChildBottom + (isNavLike ? 16 : 28));
    } else if (tag === 'img') {
      height = 240;
    } else if (tag === 'button') {
      height = isHorizontalChild ? 38 : 44;
    } else if (tag === 'input' || tag === 'select') {
      height = 44;
    } else if (tag === 'textarea') {
      height = 110;
    } else {
      const fSize = parseCssPx(styleObj.fontSize, 16) || (tag === 'h1' ? 42 : tag === 'h2' ? 32 : tag === 'h3' ? 22 : 16);
      const chars = Math.max(1, directText.length);
      const charsPerLine = Math.max(12, Math.floor((width - 16) / (fSize * 0.54)));
      const estLines = Math.max(1, Math.ceil(chars / charsPerLine));
      height = Math.max(isSectionLike ? 180 : 32, Math.round(estLines * fSize * 1.48 + (isTextTag ? 12 : 24)));
    }
  }

  const normalizedType = tag === 'header' ? 'div' : tag;
  const fillBg = styleObj.backgroundColor || (typeof styleObj.background === 'string' && !styleObj.background.includes('gradient') ? styleObj.background : '');
  const cleanedAttrs = { ...rawAttrs };
  delete cleanedAttrs.style;
  if (cleanedAttrs.className && !cleanedAttrs.class) {
    cleanedAttrs.class = cleanedAttrs.className;
    delete cleanedAttrs.className;
  }

  // Göreli görsel bağlantısını klasör varlıklarıyla (data: URI) eşleştir veya eksik uyarısı kaydet
  let resolvedImgUrl;
  if (tag === 'img') {
    const rawImgSrc = cleanedAttrs.src;
    if (rawImgSrc) {
      const resolved = resolveRelativeAssetUrl(rawImgSrc, ctx?.assetDataUrlMap, ctx?.baseDirPath);
      if (resolved.url) {
        cleanedAttrs.src = resolved.url;
        resolvedImgUrl = resolved.url;
      } else {
        delete cleanedAttrs.src;
      }
      if (resolved.missing && ctx?.stats) {
        ctx.stats.missingImages.push(rawImgSrc);
      }
    }
  }

  // Satır içi <span> veya karışık çocuklu (<p>...<a>...</a>...</p>) metin kaybını önle
  const collapsedSpanText = (astChildren.length === 0 && validAbsChildren.length > 0 && validAbsChildren.every((c) => c.tag === 'span'))
    ? collectInlineSpanText(absNode)
    : '';
  const textValue = astChildren.length === 0
    ? (collapsedSpanText || directText || (normalizedType === 'a' || normalizedType === 'button' ? 'Buton' : ''))
    : (directText || '');

  const cleanedStyle = { ...styleObj };
  delete cleanedStyle.position;
  delete cleanedStyle.left;
  delete cleanedStyle.top;
  delete cleanedStyle.width;
  delete cleanedStyle.height;

  if (!cleanedStyle.fontSize && tag === 'h1') cleanedStyle.fontSize = '42px';
  if (!cleanedStyle.fontSize && tag === 'h2') cleanedStyle.fontSize = '30px';
  if (!cleanedStyle.fontSize && tag === 'h3') cleanedStyle.fontSize = '22px';

  const nodeId = rawAttrs['data-craft-id'] || idAttr || nextNodeId(normalizedType);

  return {
    id: nodeId,
    name: `${tag.toUpperCase()} ${textValue ? `• ${textValue.slice(0, 22)}` : ''}`.trim(),
    type: normalizedType,
    attrs: cleanedAttrs,
    style: cleanedStyle,
    fillType: typeof styleObj.background === 'string' && styleObj.background.includes('gradient') ? 'gradient' : 'solid',
    fillColor: fillBg || (isNavLike || isFooterLike ? '#131110' : isSectionLike ? 'transparent' : undefined),
    textColor: styleObj.color || undefined,
    fontSize: parseCssPx(styleObj.fontSize, 16) || undefined,
    fontWeight: styleObj.fontWeight || undefined,
    borderRadius: parseCssPx(styleObj.borderRadius, 16) || undefined,
    imageUrl: tag === 'img' ? resolvedImgUrl : undefined,
    textContent: textValue || undefined,
    content: textValue || undefined,
    x,
    y: explicitY !== null ? explicitY : cursorY,
    width,
    height: Math.max(20, height),
    positionMode: isNavLike || styleObj.position === 'sticky' ? 'sticky' : 'normal',
    zIndex: depth + 1,
    opacity: 100,
    children: astChildren,
  };
}

function buildTabFromHtmlBody(bodyNode, ruleMap, tabName = 'Anasayfa.craft', route = '/', bodyBg = '#0b0a09', ctx = null) {
  const rawNodes = [];
  let cursorY = 0;
  const bodyCss = parseInlineCss(bodyNode?.attrs?.style || '');
  const bodyTextColor = bodyCss.color || ruleMap.tags?.body?.color || null;

  const topChildren = [...(bodyNode?.children || [])];
  // <body> altında doğrudan metin düğümü varsa sessizce yutmak yerine <p> olarak ekle
  if (Array.isArray(bodyNode?.textParts) && bodyNode.textParts.length > 0) {
    topChildren.unshift({ tag: 'p', attrs: {}, children: [], textParts: bodyNode.textParts });
  }

  for (let i = 0; i < topChildren.length; i += 1) {
    if (ctx && ctx.count >= ctx.maxNodes) {
      if (ctx.stats) ctx.stats.truncatedNodes += (topChildren.length - i);
      break;
    }
    const childAbs = topChildren[i];
    if (!childAbs || childAbs.__text) continue;
    const cls = String(childAbs.attrs?.class || childAbs.attrs?.className || '');
    const stageChild = cls.split(/\s+/).includes('craft-stage')
      ? (childAbs.children || [])
      : [childAbs];

    for (let j = 0; j < stageChild.length; j += 1) {
      if (ctx && ctx.count >= ctx.maxNodes) {
        if (ctx.stats) ctx.stats.truncatedNodes += (stageChild.length - j);
        break;
      }
      const item = stageChild[j];
      const converted = convertAbstractNodeToAst(item, ruleMap, 1280, cursorY, 0, false, bodyTextColor, ctx);
      if (!converted) continue;
      const inline = normalizeJsxAttrStyle(item.attrs?.style || '');
      const hasExplicitY = parseCssPx(inline.top, 860) !== null;
      if (!hasExplicitY) {
        converted.y = cursorY;
        cursorY += converted.height + 24;
      } else {
        cursorY = Math.max(cursorY, converted.y + converted.height + 24);
      }
      rawNodes.push(converted);
    }
  }

  const stageH = Math.max(1350, rawNodes.reduce((m, n) => Math.max(m, (n.y || 0) + (n.height || 0) + 80), 0));
  const tabletAdapted = ensureViewportAdapted(rawNodes, 'tablet', { forceReset: true, desktopWidth: 1280 });
  const mobileAdapted = ensureViewportAdapted(tabletAdapted.tree, 'mobile', { forceReset: true, desktopWidth: 1280 });
  const canvasByViewport = createDefaultCanvasByViewport({ width: 1280, height: stageH, backgroundColor: bodyBg });
  canvasByViewport.tablet.height = tabletAdapted.suggestedHeight;
  canvasByViewport.mobile.height = mobileAdapted.suggestedHeight;

  return {
    id: nextNodeId('tab'),
    name: tabName,
    route,
    elements: mobileAdapted.tree,
    canvasByViewport,
    initializedViewports: { desktop: true, tablet: true, mobile: true },
  };
}

/**
 * Herhangi bir .craft.json, .json, .html, .htm, .jsx, .tsx web sitesi dosyasını
 * temizlenmiş çok sayfalı CraftStudio proje şemasına dönüştürür.
 */
export function importSiteCodeToProjectSchema(rawContent, fileName = 'site.html', filePath = null, options = {}) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  const contentStr = String(rawContent || '').replace(/^\uFEFF/, '').trim();
  const stats = options.stats || {
    removedScripts: 0,
    removedEventAttrs: 0,
    removedJsUrls: 0,
    removedEmbeds: 0,
    missingImages: [],
    truncatedNodes: 0,
    hasComplexLayout: false,
    hasConditionalJsx: false,
  };
  const maxNodesPerTab = Number.isFinite(options.maxNodesPerTab) ? options.maxNodesPerTab : 600;
  const baseDirPath = options.baseDirPath || '';
  const assetDataUrlMap = options.assetDataUrlMap || null;
  const extraCssText = options.extraCssText || '';

  if (!contentStr) {
    throw new Error('Seçilen dosya boş görünüyor.');
  }

  // 1. Doğal CraftStudio JSON / .craft biçimi
  if (ext === 'json' || ext === 'craft' || (!/<[a-zA-Z]/.test(contentStr) && contentStr.startsWith('{'))) {
    const schema = parseAndMigrateLoadedProject(contentStr);
    return sanitizeCraftProjectSchema(schema, stats);
  }

  const budget = { abstractCount: 0, maxAbstract: maxNodesPerTab * 4 };
  let bodyAbs = null;
  let titleText = '';
  let ruleMap = parseStyleBlockRules('', extraCssText, stats);

  // 2. React JSX / TSX dosyası (dengeli JSX ayrıştırıcısı ile eval olmadan)
  if (ext === 'jsx' || ext === 'tsx' || ext === 'js' || ext === 'ts') {
    const scope = parseStaticJsxScope(contentStr);
    const jsxBlocks = extractJsxBlocksFromSource(contentStr);
    const mainJsx = jsxBlocks.length > 0 ? jsxBlocks[jsxBlocks.length - 1] : '';
    if (jsxBlocks.length > 0 && /&&|\?/.test(mainJsx)) {
      stats.hasConditionalJsx = true;
    }
    bodyAbs = mainJsx
      ? parseJsxToAbstractTree(mainJsx, scope, stats)
      : { tag: 'body', attrs: {}, children: [], textParts: [] };
  } else {
    // 3. HTML / HTM (tarayıcıda DOMParser, Node'da fallback ayrıştırıcı)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(contentStr, 'text/html');
      titleText = (doc.querySelector('title')?.textContent || '').trim();
      // <head> içindeki gömülü script / embed öğelerini istatistiğe kaydet (body ayrıca taranacak)
      if (doc.head) {
        stats.removedScripts += doc.head.querySelectorAll('script').length;
        stats.removedEmbeds += doc.head.querySelectorAll('iframe, object, embed, frame, frameset, applet').length;
      }
      ruleMap = parseStyleBlockRules(doc, extraCssText, stats);
      bodyAbs = domNodeToAbstract(doc.body, stats, budget);
    } else {
      const titleMatch = contentStr.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      titleText = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
      ruleMap = parseStyleBlockRules(contentStr, extraCssText, stats);
      // <head> içinde kalan betik etiketlerini ayrıca say
      const headMatch = contentStr.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        const headScripts = headMatch[1].match(/<script\b/gi);
        if (headScripts) stats.removedScripts += headScripts.length;
      }
      const bodyMatch = contentStr.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i);
      bodyAbs = parseMarkupFallback(bodyMatch ? bodyMatch[2] : contentStr, stats, budget);
      if (bodyMatch && bodyMatch[1]) {
        const bodyHeaderAbs = parseMarkupFallback(`<div ${bodyMatch[1]}></div>`, stats, null);
        if (bodyHeaderAbs?.children?.[0]?.attrs) {
          bodyAbs.attrs = bodyHeaderAbs.children[0].attrs;
        }
      }
    }
  }

  const bodyBg =
    parseInlineCss(bodyAbs?.attrs?.style || '').backgroundColor ||
    ruleMap.tags?.body?.backgroundColor ||
    '#0b0a09';

  const ctx = {
    maxNodes: maxNodesPerTab,
    count: 0,
    stats,
    assetDataUrlMap,
    baseDirPath,
  };

  const craftPages = findCraftPageRoots(bodyAbs);
  const tabs = craftPages.length > 0
    ? craftPages.map((pg, idx) => {
        ctx.count = 0;
        const route = pg.attrs?.['data-route'] || (idx === 0 ? '/' : `/sayfa-${idx + 1}`);
        const cleanRoute = route === '/' ? 'Anasayfa' : route.replace(/^\/+/, '');
        const pgBg = parseInlineCss(pg.attrs?.style || '').backgroundColor || bodyBg;
        return buildTabFromHtmlBody(pg, ruleMap, `${cleanRoute}.craft`, route, pgBg, ctx);
      })
    : [buildTabFromHtmlBody(bodyAbs || { tag: 'body', attrs: {}, children: [], textParts: [] }, ruleMap, options.tabName || 'Anasayfa.craft', options.route || '/', bodyBg, ctx)];

  const cleanFileName = String(fileName || 'Site').replace(/\.(html?|jsx|tsx|js|ts|craft\.json|json)$/i, '');

  const schema = buildSerializableProjectSchema({
    id: `proj-${Date.now()}`,
    name: titleText || cleanFileName || 'İçe Aktarılan Site',
    filePath: filePath || null,
    viewportMode: 'desktop',
    tabs,
    activeTabId: tabs[0]?.id,
    projectFunctions: [],
    pageLinks: [],
  });

  return sanitizeCraftProjectSchema(schema, stats);
}
