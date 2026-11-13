import { parseAndMigrateLoadedProject, buildSerializableProjectSchema } from './projectStorage.js';
import { ensureViewportAdapted, createDefaultCanvasByViewport } from './responsiveUtils.js';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'meta', 'link', 'head', 'title', 'br', 'hr']);
const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'source', 'meta', 'link']);
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

function parseStyleBlockRules(htmlDocOrStr) {
  const ruleMap = { tags: {}, classes: {}, ids: {} };
  const cssBlocks = [];
  if (typeof htmlDocOrStr === 'string') {
    const matches = htmlDocOrStr.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
    for (const m of matches) cssBlocks.push(m[1] || '');
  } else if (htmlDocOrStr?.querySelectorAll) {
    htmlDocOrStr.querySelectorAll('style').forEach((s) => cssBlocks.push(s.textContent || ''));
  }

  const combined = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[\s\S]*?\}\s*\}/g, '');
  const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(combined)) !== null) {
    const selectors = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const props = parseInlineCss(match[2]);
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

/** Lightweight fallback HTML/JSX tree parser for non-DOM environments (Node tests). */
function parseMarkupFallback(markup) {
  const cleaned = String(markup || '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const root = { tag: 'body', attrs: {}, children: [], textParts: [] };
  const stack = [root];
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9.:_-]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g;
  let m;

  while ((m = tokenRe.exec(cleaned)) !== null) {
    if (m[5]) {
      const txt = m[5].replace(/\s+/g, ' ').trim();
      if (txt) stack[stack.length - 1].textParts.push(txt);
      continue;
    }

    const isClose = m[1] === '/';
    const tag = (m[2] || 'div').toLowerCase();
    const rawAttrStr = m[3] || '';
    const selfClosing = m[4] === '/' || VOID_TAGS.has(tag);

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs = {};
    const attrRe = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\{([\s\S]*?)\}\}|\{([^}]*)\}))?/g;
    let am;
    while ((am = attrRe.exec(rawAttrStr)) !== null) {
      const key = am[1];
      if (!key) continue;
      if (am[2] !== undefined) attrs[key] = am[2];
      else if (am[3] !== undefined) attrs[key] = am[3];
      else if (am[4] !== undefined) attrs[key] = `{${am[4]}}`;
      else if (am[5] !== undefined) attrs[key] = am[5].trim().replace(/^["']|["']$/g, '');
      else attrs[key] = true;
    }

    const node = { tag, attrs, children: [], textParts: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
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
  const withoutComments = String(rawJsx || '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const match = withoutComments.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?/);
  let jsxBody = match ? match[1] : withoutComments;
  jsxBody = jsxBody.replace(/<>/g, '<div>').replace(/<\/>/g, '</div>');
  return jsxBody;
}

function domNodeToAbstract(el) {
  if (!el) return null;
  if (el.nodeType === 3) {
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return txt ? { __text: txt } : null;
  }
  if (el.nodeType !== 1) return null;
  const tag = (el.tagName || 'div').toLowerCase();
  if (SKIP_TAGS.has(tag)) return null;

  const attrs = {};
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i += 1) {
      const a = el.attributes[i];
      attrs[a.name] = a.value;
    }
  }
  if (attrs.id === 'craft-toast') return null;

  const children = [];
  const textParts = [];
  el.childNodes.forEach((ch) => {
    if (ch.nodeType === 3) {
      const txt = (ch.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) textParts.push(txt);
    } else if (ch.nodeType === 1) {
      const sub = domNodeToAbstract(ch);
      if (sub) children.push(sub);
    }
  });
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

function convertAbstractNodeToAst(absNode, ruleMap, parentWidth = 1280, cursorY = 0, depth = 0, isHorizontalChild = false, inheritedColor = null) {
  if (!absNode || absNode.__text) return null;
  const tag = SKIP_TAGS.has(absNode.tag) ? 'div' : absNode.tag;
  const rawAttrs = { ...(absNode.attrs || {}) };

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
  const styleObj = { ...mergedStyle, ...twHints, ...inlineCss };
  const hintedHorizontal = Boolean(styleObj._horizontal || styleObj.display === 'flex' || styleObj.display === 'grid')
    && styleObj.flexDirection !== 'column';
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

    validAbsChildren.forEach((childAbs, cIdx) => {
      const childAst = convertAbstractNodeToAst(
        childAbs,
        ruleMap,
        width,
        childCursorY,
        depth + 1,
        horizontalContainer,
        nextInheritedColor
      );
      if (!childAst) return;

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
    });
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

  const textValue = astChildren.length === 0
    ? (directText || (normalizedType === 'a' || normalizedType === 'button' ? 'Buton' : ''))
    : (directText && validAbsChildren.every((c) => c.tag === 'span') ? directText : '');

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
    imageUrl: tag === 'img' ? (rawAttrs.src || undefined) : undefined,
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

function buildTabFromHtmlBody(bodyNode, ruleMap, tabName = 'Anasayfa.craft', route = '/', bodyBg = '#0b0a09') {
  const rawNodes = [];
  let cursorY = 0;
  const bodyCss = parseInlineCss(bodyNode?.attrs?.style || '');
  const bodyTextColor = bodyCss.color || ruleMap.tags?.body?.color || null;

  (bodyNode.children || []).forEach((childAbs) => {
    if (!childAbs || childAbs.__text) return;
    const cls = String(childAbs.attrs?.class || childAbs.attrs?.className || '');
    const stageChild = cls.split(/\s+/).includes('craft-stage')
      ? (childAbs.children || [])
      : [childAbs];

    stageChild.forEach((item) => {
      const converted = convertAbstractNodeToAst(item, ruleMap, 1280, cursorY, 0, false, bodyTextColor);
      if (!converted) return;
      const inline = normalizeJsxAttrStyle(item.attrs?.style || '');
      const hasExplicitY = parseCssPx(inline.top, 860) !== null;
      if (!hasExplicitY) {
        converted.y = cursorY;
        cursorY += converted.height + 24;
      } else {
        cursorY = Math.max(cursorY, converted.y + converted.height + 24);
      }
      rawNodes.push(converted);
    });
  });

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
 * Imports any `.craft.json`, `.json`, `.html`, `.htm`, `.jsx`, `.tsx` website file
 * directly into an editable multi-page CraftStudio project schema.
 */
export function importSiteCodeToProjectSchema(rawContent, fileName = 'site.html', filePath = null) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  const contentStr = String(rawContent || '').trim();

  if (!contentStr) {
    throw new Error('Seçilen dosya boş görünüyor.');
  }

  // 1. Native CraftStudio JSON / .craft format
  if (ext === 'json' || ext === 'craft' || (!/<[a-zA-Z]/.test(contentStr) && contentStr.startsWith('{'))) {
    return parseAndMigrateLoadedProject(contentStr);
  }

  // 2. React JSX / TSX single file
  let htmlSource = contentStr;
  if (ext === 'jsx' || ext === 'tsx' || ext === 'js' || ext === 'ts') {
    htmlSource = `<html><body>${extractReactJsxMarkup(contentStr)}</body></html>`;
  }

  // 3. HTML / HTM (via browser DOMParser when present, or resilient fallback parser)
  let bodyAbs = null;
  let titleText = '';
  let ruleMap = { tags: {}, classes: {}, ids: {} };

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlSource, 'text/html');
    titleText = (doc.querySelector('title')?.textContent || '').trim();
    ruleMap = parseStyleBlockRules(doc);
    bodyAbs = domNodeToAbstract(doc.body);
  } else {
    const titleMatch = htmlSource.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    titleText = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    ruleMap = parseStyleBlockRules(htmlSource);
    const bodyMatch = htmlSource.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    bodyAbs = parseMarkupFallback(bodyMatch ? bodyMatch[1] : htmlSource);
  }

  const bodyBg =
    parseInlineCss(bodyAbs?.attrs?.style || '').backgroundColor ||
    ruleMap.tags?.body?.backgroundColor ||
    '#0b0a09';

  const craftPages = findCraftPageRoots(bodyAbs);
  const tabs = craftPages.length > 0
    ? craftPages.map((pg, idx) => {
        const route = pg.attrs?.['data-route'] || (idx === 0 ? '/' : `/sayfa-${idx + 1}`);
        const cleanRoute = route === '/' ? 'Anasayfa' : route.replace(/^\/+/, '');
        const pgBg = parseInlineCss(pg.attrs?.style || '').backgroundColor || bodyBg;
        return buildTabFromHtmlBody(pg, ruleMap, `${cleanRoute}.craft`, route, pgBg);
      })
    : [buildTabFromHtmlBody(bodyAbs || { tag: 'body', attrs: {}, children: [], textParts: [] }, ruleMap, 'Anasayfa.craft', '/', bodyBg)];

  const cleanFileName = String(fileName || 'Site').replace(/\.(html?|jsx|tsx|js|ts|craft\.json|json)$/i, '');

  return buildSerializableProjectSchema({
    id: `proj-${Date.now()}`,
    name: titleText || cleanFileName || 'İçe Aktarılan Site',
    filePath: filePath || null,
    viewportMode: 'desktop',
    tabs,
    activeTabId: tabs[0]?.id,
    projectFunctions: [],
    pageLinks: [],
  });
}
