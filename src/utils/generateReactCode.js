import { isVoidTag } from '../data/tagRegistry.js';
import { flattenTree } from './treeUtils.js';
import {
  buildReactOnClickExpression,
  getEffectiveFunctionCode,
  sanitizeFunctionIdentifier,
} from './interactionEngine.js';
import {
  createDefaultCanvasByViewport,
  ensureViewportAdapted,
  hasViewportOverrides,
} from './responsiveUtils.js';

/**
 * Produces a safe URL / filesystem slug for project folders and npm package names.
 */
export function slugifyProjectFolderName(name = 'yayinlanan-react-site') {
  const trMap = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  const replaced = String(name || '')
    .split('')
    .map((ch) => trMap[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return replaced || 'yayinlanan-react-site';
}

// HTML to JSX Attribute Name Mapping
export const HTML_TO_JSX_ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
  allowfullscreen: 'allowFullScreen',
  frameborder: 'frameBorder',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-opacity': 'strokeOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'fill-opacity': 'fillOpacity',
  'clip-path': 'clipPath',
  patternunits: 'patternUnits',
};

export function convertHtmlAttrToJsx(attrName) {
  if (!attrName) return '';
  const lower = String(attrName).toLowerCase();
  return HTML_TO_JSX_ATTR_MAP[lower] || attrName;
}

function escapeScriptContent(jsCode) {
  return String(jsCode ?? '').replace(/<\/(script)/gi, '<\\/$1');
}

function parseInlineStyleString(styleStr) {
  const parsed = {};
  if (typeof styleStr !== 'string' || !styleStr.trim()) return parsed;
  styleStr.split(';').forEach((decl) => {
    const colonIdx = decl.indexOf(':');
    if (colonIdx <= 0) return;
    const rawKey = decl.slice(0, colonIdx).trim();
    const rawVal = decl.slice(colonIdx + 1).trim();
    if (!rawKey || !rawVal) return;
    const key = rawKey.startsWith('--') ? rawKey : kebabToCamelCase(rawKey.toLowerCase());
    parsed[key] = rawVal;
  });
  return parsed;
}

const COORDINATE_STYLE_KEYS = [
  'position', 'left', 'right', 'top', 'bottom', 'width', 'height', 'zIndex',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
];
const PURE_TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'text', 'badge']);

function stripCanvasCoordinateStyles(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return styleObj;
  COORDINATE_STYLE_KEYS.forEach((key) => {
    delete styleObj[key];
  });
  return styleObj;
}

function hasExplicitStylePadding(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return false;
  return (
    styleObj.padding !== undefined ||
    styleObj.paddingTop !== undefined ||
    styleObj.paddingRight !== undefined ||
    styleObj.paddingBottom !== undefined ||
    styleObj.paddingLeft !== undefined ||
    styleObj.paddingInline !== undefined ||
    styleObj.paddingBlock !== undefined
  );
}

function buildProductCardFallbackHtml(node) {
  const imgUrl = node.productImage || node.imageUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80';
  const tagText = node.productTag ? `<span style="position:absolute;top:12px;left:12px;padding:4px 10px;border-radius:999px;background:rgba(15,23,42,0.86);color:#f8fafc;font-size:11px;font-weight:600;">${escapeHtmlText(node.productTag)}</span>` : '';
  const descHtml = node.productDesc ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtmlText(node.productDesc)}</p>` : '';
  const priceHtml = node.productPrice ? `<span style="font-size:14px;font-weight:700;color:#2563eb;">${escapeHtmlText(node.productPrice)}</span>` : '';
  return `<div style="position:relative;width:100%;height:56%;min-height:140px;overflow:hidden;background:#0f172a;"><img src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(node.productName || 'Ürün')}" style="width:100%;height:100%;object-fit:cover;display:block;" />${tagText}</div><div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:16px;gap:8px;width:100%;"><div style="display:flex;flex-direction:column;gap:6px;"><h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtmlText(node.productName || 'Özel Ürün')}</h3>${descHtml}</div><div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;">${priceHtml}<span style="font-size:12px;font-weight:600;color:#2563eb;">İncele ↗</span></div></div>`;
}

function applyNodeVisualStyles(styleObj, node, isPlainHtml = false) {
  if (!node || typeof node !== 'object') return styleObj;

  if (node.fillType === 'gradient' && node.gradient) {
    styleObj.background = `linear-gradient(${node.gradient.angle ?? 90}deg, ${node.gradient.color1 || '#d4af37'}, ${node.gradient.color2 || '#2c2523'})`;
    delete styleObj.backgroundColor;
  } else if (node.fillType === 'solid' && node.fillColor && node.fillColor !== 'transparent') {
    styleObj.backgroundColor = node.fillColor;
    delete styleObj.background;
  } else if (node.fillColor && node.fillColor !== 'transparent' && !styleObj.background && !styleObj.backgroundColor) {
    styleObj.backgroundColor = node.fillColor;
  }

  if (node.borderRadiusType === 'custom' && node.borderRadiusCorners && !styleObj.borderRadius) {
    const { tl = 0, tr = 0, br = 0, bl = 0 } = node.borderRadiusCorners;
    styleObj.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
  } else if (node.borderRadius > 0 && !styleObj.borderRadius) {
    styleObj.borderRadius = `${node.borderRadius}px`;
  }

  if (node.borderWidth > 0 && !styleObj.border) {
    styleObj.border = `${node.borderWidth}px ${node.borderStyle || 'solid'} ${node.borderColor || '#cbd5e1'}`;
  }

  if (node.shadow && node.shadow !== 'none' && !styleObj.boxShadow) {
    styleObj.boxShadow = node.shadow;
  }

  if (node.opacity !== undefined && node.opacity !== 100 && styleObj.opacity === undefined) {
    const numOp = Number(node.opacity) / 100;
    styleObj.opacity = isPlainHtml ? Math.max(0, Math.min(1, numOp)) : numOp;
  }

  const rawTag = String(node.type || '').toLowerCase();
  if (rawTag !== 'img' && rawTag !== 'image' && node.imageUrl && !styleObj.backgroundImage && !styleObj.background) {
    styleObj.backgroundImage = `url(${node.imageUrl})`;
    styleObj.backgroundSize = styleObj.backgroundSize || 'cover';
    styleObj.backgroundPosition = styleObj.backgroundPosition || 'center';
  }

  if (node.textColor && !styleObj.color) styleObj.color = node.textColor;
  if (node.fontSize && !styleObj.fontSize) styleObj.fontSize = `${node.fontSize}px`;
  if (node.fontWeight && !styleObj.fontWeight) styleObj.fontWeight = node.fontWeight;
  if (node.textAlign && !styleObj.textAlign) styleObj.textAlign = node.textAlign;
  if (node.fontFamily && !styleObj.fontFamily) styleObj.fontFamily = node.fontFamily;
  if (node.lineHeight && !styleObj.lineHeight) styleObj.lineHeight = node.lineHeight;
  if (node.letterSpacing && !styleObj.letterSpacing) styleObj.letterSpacing = node.letterSpacing;
  if (node.fontStyle && !styleObj.fontStyle) styleObj.fontStyle = node.fontStyle;
  if (node.textTransform && !styleObj.textTransform) styleObj.textTransform = node.textTransform;
  if (node.textShadow && node.textShadow !== 'none' && !styleObj.textShadow) styleObj.textShadow = node.textShadow;

  if (node.animation?.hoverLineColor) styleObj['--craft-line-color'] = node.animation.hoverLineColor;
  if (node.animation?.hoverLineHeight) styleObj['--craft-line-height'] = `${node.animation.hoverLineHeight}px`;
  if (node.animation?.hoverLineDuration) styleObj['--craft-line-duration'] = `${node.animation.hoverLineDuration}s`;

  return styleObj;
}

function resolveCanvasParityStyle({
  styleObj,
  node,
  rawTag,
  mappedTag,
  isVoid,
  isFormField,
  hasChildren,
  parentWidth,
  topOffsetPx = 0,
  depth = 0,
  accordionLayoutOverride = null,
  accLayout = null,
  applyCanvasCoords = true,
  isPlainHtml = false,
}) {
  const isPureTextNode = PURE_TEXT_TAGS.has(rawTag);
  const hasExplicitPadding = hasExplicitStylePadding(styleObj);
  const hasHoverUnderline = Boolean(
    node.animation?.hoverClassName && /hover-underline|hover-text-fill-bar/.test(String(node.animation.hoverClassName))
  );

  if (applyCanvasCoords) {
    stripCanvasCoordinateStyles(styleObj);
    styleObj.position = node.positionMode === 'sticky' ? 'sticky' : (node.positionMode === 'fixed' ? 'fixed' : 'absolute');
    if ((node.positionMode === 'sticky' || node.positionMode === 'fixed') && styleObj.top === undefined) {
      styleObj.top = '0px';
    }
    if (node.positionMode === 'sticky' && typeof node.x === 'number' && node.x > 0) {
      styleObj.marginLeft = toPercentCss(node.x, parentWidth);
    }
    if (node.positionMode === 'fixed' && typeof node.x === 'number') {
      styleObj.left = toPercentCss(node.x, parentWidth);
    }
    if (typeof node.x === 'number' && node.positionMode !== 'sticky' && node.positionMode !== 'fixed') {
      styleObj.left = toPercentCss(node.x, parentWidth);
    }
    if (typeof node.y === 'number' && node.positionMode !== 'sticky' && node.positionMode !== 'fixed') {
      const resolvedY = accordionLayoutOverride ? accordionLayoutOverride.resolvedY : node.y;
      styleObj.top = `${resolvedY - topOffsetPx}px`;
    }
    if (typeof node.width === 'number') {
      styleObj.width = isFixedSquareIconNode(node) ? `${node.width}px` : toPercentCss(node.width, parentWidth);
    }
    if (typeof node.height === 'number') {
      const baseItemHeight = accordionLayoutOverride
        ? accordionLayoutOverride.resolvedH
        : (node.accordionRole === 'item' ? getAccordionItemResolvedHeight(node) : node.height);
      const resolvedHeight = accLayout && accLayout.extraHeight > 0 ? baseItemHeight + accLayout.extraHeight : baseItemHeight;
      styleObj.height = `${resolvedHeight}px`;
    }
    if (typeof node.zIndex === 'number') {
      styleObj.zIndex = node.zIndex;
    } else if (isPlainHtml) {
      styleObj.zIndex = node.positionMode === 'sticky' || node.positionMode === 'fixed' ? 100 : depth + 1;
    }

    if (!styleObj.display && !isVoid && mappedTag !== 'textarea' && mappedTag !== 'select') {
      styleObj.display = 'flex';
      styleObj.flexDirection = styleObj.flexDirection || 'column';
      styleObj.alignItems = styleObj.alignItems || (rawTag === 'button' ? 'center' : (isPureTextNode ? 'stretch' : 'flex-start'));
      styleObj.justifyContent = styleObj.justifyContent || (rawTag === 'button' ? 'center' : 'flex-start');
    }
    if (!styleObj.overflow && !isVoid && !isFormField) {
      styleObj.overflow = (hasChildren || hasHoverUnderline || isPureTextNode) ? 'visible' : 'hidden';
    }
    if (!hasExplicitPadding && !isFormField && rawTag !== 'button') {
      styleObj.padding = '0px';
    }
    if (isFormField) {
      if (styleObj.padding === undefined) styleObj.padding = mappedTag === 'textarea' ? '10px' : '8px 14px';
      if (styleObj.outline === undefined) styleObj.outline = 'none';
    }
    if (mappedTag === 'a' && !styleObj.textDecoration) styleObj.textDecoration = 'none';
    if (mappedTag === 'img' && !styleObj.objectFit) styleObj.objectFit = 'cover';
    styleObj.boxSizing = styleObj.boxSizing || 'border-box';
  }

  applyNodeVisualStyles(styleObj, node, isPlainHtml);

  if (isFormField) {
    if (!styleObj.color) styleObj.color = '#1a1816';
    if (!styleObj.fontSize) styleObj.fontSize = '14px';
  } else if (rawTag === 'button') {
    if (!styleObj.color) styleObj.color = '#ffffff';
    if (!styleObj.fontSize) styleObj.fontSize = '14px';
    if (!styleObj.fontWeight) styleObj.fontWeight = 600;
    if (!styleObj.textAlign) styleObj.textAlign = 'center';
    if (!styleObj.cursor) styleObj.cursor = 'pointer';
  } else if (isPureTextNode) {
    if (!styleObj.color) styleObj.color = '#1f2937';
    if (!styleObj.textAlign) styleObj.textAlign = 'left';
    if (!styleObj.lineHeight) styleObj.lineHeight = '1.4';
  } else if (!isVoid && !styleObj.textAlign) {
    styleObj.textAlign = 'left';
  }

  const textAlignVal = styleObj.textAlign || node.textAlign || (rawTag === 'button' ? 'center' : 'left');
  const innerTextPadding = isPureTextNode && !hasExplicitPadding ? (rawTag === 'text' ? '2px 4px' : '4px') : '';
  const innerLineHeight = isPureTextNode ? String(styleObj.lineHeight || '1.4') : '';

  return { isPureTextNode, textAlignVal, innerTextPadding, innerLineHeight };
}

function adaptPublishTabViewports(tabEls, tabDesktopCanvas, tabCanvasByVp, initializedViewports) {
  if (!Array.isArray(tabEls) || tabEls.length === 0) {
    return { elements: tabEls, canvasByViewport: tabCanvasByVp };
  }
  const desktopWidth = Number(tabDesktopCanvas?.width) || 1280;
  let adaptedEls = tabEls;
  let nextCanvasByVp = tabCanvasByVp ? { ...tabCanvasByVp } : createDefaultCanvasByViewport(tabDesktopCanvas);

  ['tablet', 'mobile'].forEach((vp) => {
    const alreadyReady = Boolean(initializedViewports?.[vp]) || hasViewportOverrides(adaptedEls, vp);
    if (alreadyReady) return;
    const res = ensureViewportAdapted(adaptedEls, vp, { desktopWidth });
    if (res?.tree) adaptedEls = res.tree;
    if (res?.suggestedHeight) {
      const fallbackVp = {
        width: vp === 'mobile' ? 375 : 768,
        height: res.suggestedHeight,
        bgColor: tabDesktopCanvas?.bgColor || tabDesktopCanvas?.backgroundColor || '#ffffff',
      };
      nextCanvasByVp[vp] = {
        ...fallbackVp,
        ...(nextCanvasByVp[vp] || {}),
        height: Math.max(Number(nextCanvasByVp[vp]?.height) || 0, res.suggestedHeight),
      };
    }
  });

  return { elements: adaptedEls, canvasByViewport: nextCanvasByVp };
}

function normalizePublishTabs({ tabs = [], activeTabId = null, elements = null, canvasSettings = null, canvasByViewport = null } = {}) {
  const defaultCanvas = canvasSettings || { width: 1280, height: 1350, backgroundColor: '#0f172a' };
  if (!Array.isArray(tabs) || tabs.length === 0) {
    const rawEls = Array.isArray(elements) ? elements.filter(Boolean) : [];
    const desktopCanvas = canvasByViewport?.desktop || defaultCanvas;
    const adapted = adaptPublishTabViewports(rawEls, desktopCanvas, canvasByViewport, null);
    return [
      {
        id: 'tab-1',
        name: 'Anasayfa.craft',
        route: '/',
        domId: 'craft-page-tab-1',
        elements: adapted.elements,
        canvasByViewport: adapted.canvasByViewport,
        canvasSettings: desktopCanvas,
      },
    ];
  }

  const matchedIdx = activeTabId ? tabs.findIndex((t) => t && t.id === activeTabId) : 0;
  const effectiveActiveIdx = matchedIdx >= 0 ? matchedIdx : 0;
  const seenDomIds = new Set();

  return tabs.map((t, idx) => {
    const tab = t || {};
    const isActive = idx === effectiveActiveIdx;
    const rawTabEls = (isActive && Array.isArray(elements) ? elements : (tab.elements || [])).filter(Boolean);
    const rawTabCanvasByVp = (isActive && canvasByViewport) ? canvasByViewport : (tab.canvasByViewport || undefined);
    const tabDesktopCanvas = rawTabCanvasByVp?.desktop || tab.canvasSettings || defaultCanvas;
    const adapted = adaptPublishTabViewports(rawTabEls, tabDesktopCanvas, rawTabCanvasByVp, tab.initializedViewports);
    const idStr = tab.id || `tab-${idx + 1}`;
    let baseDomId = `craft-page-${slugifyProjectFolderName(idStr)}`;
    if (seenDomIds.has(baseDomId)) {
      baseDomId = `${baseDomId}-${idx + 1}`;
    }
    seenDomIds.add(baseDomId);

    const fallbackSlug = slugifyProjectFolderName(String(tab.name || `sayfa-${idx + 1}`).replace(/\.craft$/i, ''));
    return {
      ...tab,
      id: idStr,
      name: tab.name || `Sayfa ${idx + 1}`,
      route: tab.route || (idx === 0 ? '/' : `/${fallbackSlug}`),
      domId: baseDomId,
      elements: adapted.elements,
      canvasByViewport: adapted.canvasByViewport,
      canvasSettings: tabDesktopCanvas,
    };
  });
}

const CUSTOM_TYPE_TAG_MAP = {
  text: 'span',
  badge: 'span',
  navbar: 'nav',
  image: 'img',
  product_card: 'article',
  rectangle: 'div',
  circle: 'div',
  box: 'div',
  frame: 'div',
  card: 'div',
  container: 'div',
};

export function resolveHtmlTagName(rawType) {
  const lower = String(rawType || 'div').trim().toLowerCase();
  if (CUSTOM_TYPE_TAG_MAP[lower]) return CUSTOM_TYPE_TAG_MAP[lower];
  const safe = lower.replace(/[^a-z0-9-]/g, '');
  return safe || 'div';
}

export function escapeJsxText(value) {
  return String(value ?? '').replace(/[{}<>]/g, (ch) => ({
    '{': "{'{'}",
    '}': "{'}'}",
    '<': "{'<'}",
    '>': "{'>'}",
  }[ch]));
}

function camelToKebabCase(str) {
  return String(str).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function kebabToCamelCase(str) {
  if (!str || str.startsWith('--')) return str;
  return String(str).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function normalizeStyleForReact(styleObj = {}) {
  const out = {};
  Object.entries(styleObj || {}).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    const normKey = key.startsWith('--') ? key : kebabToCamelCase(key);
    out[normKey] = val;
  });
  return out;
}

function isFixedSquareIconNode(node = {}) {
  const w = Number(node.width);
  const h = Number(node.height);
  if (node.sliderRole === 'dot') return true;
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && Math.abs(w - h) <= 2 && w <= 64;
}

function toPercentCss(value, parentWidth = 1280) {
  const num = Number(value);
  const denom = Math.max(1, Number(parentWidth) || 1280);
  if (!Number.isFinite(num)) return String(value ?? '0px');
  const pct = Number(((num / denom) * 100).toFixed(4));
  return `${pct}%`;
}

function buildParentWidthMap(elements = [], rootWidths = { desktop: 1280, tablet: 768, mobile: 375 }) {
  const map = new Map();
  const walk = (nodes, parentWidths) => {
    for (const node of nodes || []) {
      if (!node || !node.id) continue;
      map.set(node.id, parentWidths);
      if (Array.isArray(node.children) && node.children.length > 0) {
        const nextWidths = {
          desktop: Number(node.width) || parentWidths.desktop,
          tablet: Number(node.responsive?.tablet?.width) || Number(node.width) || parentWidths.tablet,
          mobile: Number(node.responsive?.mobile?.width) || Number(node.width) || parentWidths.mobile,
        };
        walk(node.children, nextWidths);
      }
    }
  };
  walk(elements, rootWidths);
  return map;
}

function collectResponsiveDeclarations(ov, node, vpParentW, forceShowDisplay = 'flex', deskParentW = null) {
  const decls = [];
  const hasOv = Boolean(ov && typeof ov === 'object' && Object.keys(ov).length > 0);
  const safeOv = hasOv ? ov : {};
  const parentResized = Boolean(
    deskParentW &&
      vpParentW &&
      deskParentW !== vpParentW &&
      Math.abs(vpParentW - deskParentW) / Math.max(1, deskParentW) > 0.08
  );

  if (!hasOv && !parentResized) return decls;

  if (safeOv.isHidden === true) {
    decls.push('display: none !important;');
  } else {
    if (safeOv.isHidden === false) {
      const targetDisplay = safeOv.style?.display || node.style?.display || forceShowDisplay;
      decls.push(`display: ${targetDisplay} !important;`);
    }
    if (safeOv.x !== undefined && node.positionMode !== 'sticky' && node.positionMode !== 'fixed') {
      decls.push(`left: ${toPercentCss(safeOv.x, vpParentW)} !important;`);
    } else if (safeOv.x !== undefined && node.positionMode === 'sticky') {
      decls.push(`margin-left: ${Number(safeOv.x) > 0 ? toPercentCss(safeOv.x, vpParentW) : '0px'} !important;`);
    }
    if (safeOv.y !== undefined && node.positionMode !== 'sticky' && node.positionMode !== 'fixed') {
      decls.push(`top: ${safeOv.y}px !important;`);
    }
    if (safeOv.width !== undefined) {
      const effH = safeOv.height !== undefined ? safeOv.height : node.height;
      const squareFixed = isFixedSquareIconNode({ ...node, width: safeOv.width, height: effH });
      decls.push(`width: ${squareFixed ? `${safeOv.width}px` : toPercentCss(safeOv.width, vpParentW)} !important;`);
    } else if (parentResized && typeof node.width === 'number') {
      // Desktop uses percentage width relative to deskParentW; re-anchor to vpParentW when parent container shrank
      const squareFixed = isFixedSquareIconNode(node);
      if (!squareFixed) {
        const clampedPx = Math.min(node.width, vpParentW);
        decls.push(`width: ${toPercentCss(clampedPx, vpParentW)} !important;`);
      }
    }
    if (safeOv.height !== undefined) {
      decls.push(`height: ${safeOv.height}px !important;`);
    }
  }

  if (safeOv.opacity !== undefined) {
    decls.push(`opacity: ${Math.max(0, Math.min(1, Number(safeOv.opacity) / 100)).toFixed(2)} !important;`);
  }
  if (safeOv.zIndex !== undefined) decls.push(`z-index: ${safeOv.zIndex} !important;`);

  if (safeOv.fillType === 'gradient' && safeOv.gradient) {
    decls.push(`background: linear-gradient(${safeOv.gradient.angle || 90}deg, ${safeOv.gradient.color1 || '#d4af37'}, ${safeOv.gradient.color2 || '#2c2523'}) !important;`);
  } else if (safeOv.fillColor !== undefined && safeOv.fillColor !== 'transparent') {
    decls.push(`background-color: ${safeOv.fillColor} !important;`);
  }

  if (safeOv.borderRadiusCorners && typeof safeOv.borderRadiusCorners === 'object') {
    const { tl = 0, tr = 0, br = 0, bl = 0 } = safeOv.borderRadiusCorners;
    decls.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px !important;`);
  } else if (safeOv.borderRadius !== undefined) {
    decls.push(`border-radius: ${safeOv.borderRadius}px !important;`);
  }

  if (safeOv.borderWidth !== undefined && Number(safeOv.borderWidth) > 0) {
    decls.push(`border: ${safeOv.borderWidth}px ${safeOv.borderStyle || node.borderStyle || 'solid'} ${safeOv.borderColor || node.borderColor || '#cbd5e1'} !important;`);
  }
  if (safeOv.shadow !== undefined) {
    decls.push(`box-shadow: ${safeOv.shadow === 'none' ? 'none' : safeOv.shadow} !important;`);
  }

  if (safeOv.style && typeof safeOv.style === 'object') {
    for (const [k, v] of Object.entries(safeOv.style)) {
      if (v !== null && v !== undefined && v !== '') {
        decls.push(`${k.startsWith('--') ? k : camelToKebabCase(k)}: ${v} !important;`);
      }
    }
  }
  return decls;
}

function buildResponsiveCssRules(flatList, elements = [], canvasByViewport = null) {
  const tabletRules = [];
  const mobileRules = [];
  const rootWidths = {
    desktop: Number(canvasByViewport?.desktop?.width) || 1280,
    tablet: Number(canvasByViewport?.tablet?.width) || 768,
    mobile: Number(canvasByViewport?.mobile?.width) || 375,
  };
  const parentWidthMap = buildParentWidthMap(elements, rootWidths);

  const pushRulesForVp = (node, vp, targetArr) => {
    const ov = node.responsive?.[vp];
    const parentEntry = parentWidthMap.get(node.id);
    const vpParentW = parentEntry?.[vp] || rootWidths[vp];
    const deskParentW = parentEntry?.desktop || rootWidths.desktop;
    const decls = collectResponsiveDeclarations(ov, node, vpParentW, 'flex', deskParentW);

    if (decls.length > 0) {
      targetArr.push(`  [data-craft-id="${node.id}"] {\n    ${decls.join('\n    ')}\n  }`);
    }
  };

  for (const node of flatList || []) {
    pushRulesForVp(node, 'tablet', tabletRules);
    pushRulesForVp(node, 'mobile', mobileRules);
  }

  let css = '';
  if (tabletRules.length > 0) {
    css += `\n/* Responsive Tablet Overrides (<= 1023px) */\n@media (max-width: 1023px) {\n${tabletRules.join('\n')}\n}\n`;
  }
  if (mobileRules.length > 0) {
    css += `\n/* Responsive Mobile Overrides (<= 639px) */\n@media (max-width: 639px) {\n${mobileRules.join('\n')}\n}\n`;
  }
  return css;
}

function getAccordionItemResolvedHeight(node) {
  if (node?.accordionRole !== 'item') return Number(node?.height) || 0;
  const isOpen = node.accordionOpen !== false;
  if (isOpen) return Number(node.accordionExpandedHeight || node.height) || 108;
  return Number(node.accordionCollapsedHeight || node.height) || 58;
}

function computeAccordionContainerLayout(parentNode) {
  const children = Array.isArray(parentNode?.children) ? parentNode.children : [];
  if (!children.some((ch) => ch?.accordionRole === 'item')) {
    return { extraHeight: 0, itemMap: null };
  }
  let deltaY = 0;
  const itemMap = new Map();
  children.forEach((ch) => {
    if (ch?.accordionRole === 'item') {
      const isOpen = ch.accordionOpen !== false;
      const resolvedH = getAccordionItemResolvedHeight(ch);
      const baseH = Number(ch.height) || resolvedH;
      itemMap.set(ch.id, {
        isOpen,
        baseY: Number(ch.y) || 0,
        baseH,
        resolvedY: (Number(ch.y) || 0) + deltaY,
        resolvedH,
      });
      deltaY += resolvedH - baseH;
    }
  });
  return { extraHeight: Math.max(0, deltaY), itemMap };
}

function computeResolvedStageHeight(elements = [], baseHeight = 1350) {
  const maxBottom = (Array.isArray(elements) ? elements : []).reduce((max, el) => {
    if (!el || el.isHidden) return max;
    const acc = computeAccordionContainerLayout(el);
    const h = (Number(el.height) || 0) + (acc?.extraHeight || 0);
    return Math.max(max, (Number(el.y) || 0) + h);
  }, 0);
  return Math.max(Number(baseHeight) || 0, maxBottom);
}

function buildAccordionToggleBody(findFnName = 'findDomEl') {
  return `    var itemEl = ${findFnName}(targetRef);
    if (!itemEl) return;
    var wasOpen = itemEl.getAttribute('data-craft-accordion-open') === '1';
    itemEl.setAttribute('data-craft-accordion-open', wasOpen ? '0' : '1');
    var parent = itemEl.parentElement;
    if (parent) {
      var children = Array.from(parent.children || []);
      var deltaY = 0;
      children.forEach(function(ch) {
        if (!ch.getAttribute || ch.getAttribute('data-craft-accordion-item') !== '1') return;
        var isOpen = ch.getAttribute('data-craft-accordion-open') === '1';
        var rawBaseY = ch.getAttribute('data-craft-accordion-base-y');
        var rawBaseH = ch.getAttribute('data-craft-accordion-base-h');
        var baseY = rawBaseY !== null && rawBaseY !== '' ? Number(rawBaseY) : NaN;
        var baseH = rawBaseH !== null && rawBaseH !== '' ? Number(rawBaseH) : NaN;
        var colH = Number(ch.getAttribute('data-craft-accordion-collapsed')) || baseH || 58;
        var expH = Number(ch.getAttribute('data-craft-accordion-expanded')) || baseH || 108;
        var targetH = isOpen ? expH : colH;
        if (!Number.isNaN(baseY)) ch.style.top = (baseY + deltaY) + 'px';
        ch.style.height = targetH + 'px';
        if (!Number.isNaN(baseH)) deltaY += (targetH - baseH);
        Array.from(ch.querySelectorAll('[data-craft-accordion-panel]')).forEach(function(panelEl) {
          if (!panelEl.dataset.craftOrigDisplay) {
            panelEl.dataset.craftOrigDisplay = panelEl.style.display && panelEl.style.display !== 'none' ? panelEl.style.display : 'flex';
          }
          panelEl.style.display = isOpen ? panelEl.dataset.craftOrigDisplay : 'none';
        });
        Array.from(ch.querySelectorAll('[data-craft-accordion-indicator]')).forEach(function(indEl) {
          var innerSpan = indEl.querySelector('span');
          var nextGlyph = isOpen ? '\\u2212' : '+';
          if (innerSpan && indEl.children.length === 1) innerSpan.textContent = nextGlyph;
          else indEl.textContent = nextGlyph;
        });
      });
      var rawParentBaseH = parent.getAttribute('data-craft-accordion-base-h');
      var parentBaseH = rawParentBaseH !== null && rawParentBaseH !== '' ? Number(rawParentBaseH) : NaN;
      if (!Number.isNaN(parentBaseH) && parentBaseH > 0) {
        parent.style.height = Math.max(parentBaseH, parentBaseH + deltaY) + 'px';
      }
    }`;
}

function buildExportedRuntimeScript(projectFunctions = []) {
  const fnDefs = (projectFunctions || [])
    .map((fnObj) => {
      const safeName = sanitizeFunctionIdentifier(fnObj?.name);
      const params = (fnObj?.params || '').trim();
      const bodyCode = getEffectiveFunctionCode(fnObj) || '// boş';
      const indentedBody = bodyCode
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');
      return `  function ${safeName}(${params}) {\n${indentedBody}\n  }`;
    })
    .join('\n\n');

  return `  const findDomEl = (ref) => {
    const clean = String(ref || '').replace(/^#/, '').trim();
    if (!clean || typeof document === 'undefined') return null;
    return (
      document.getElementById(clean) ||
      document.querySelector(\`[data-craft-node="\${clean}"]\`) ||
      document.querySelector(\`[data-craft-id="\${clean}"]\`)
    );
  };
  const getValue = (ref) => {
    const target = findDomEl(ref);
    if (!target) return '';
    if ('value' in target && target.value !== undefined) return target.value;
    return target.textContent || '';
  };
  const setValue = (ref, val) => {
    const target = findDomEl(ref);
    if (target && 'value' in target) target.value = String(val ?? '');
  };
  const setText = (ref, txt) => {
    const target = findDomEl(ref);
    if (target) target.textContent = String(txt ?? '');
  };
  const setStyle = (ref, stylePatch) => {
    const target = findDomEl(ref);
    if (target && stylePatch && typeof stylePatch === 'object') {
      Object.assign(target.style, stylePatch);
    }
  };
  const show = (ref) => {
    const target = findDomEl(ref);
    if (target) target.style.display = target.dataset.prevDisplay || 'flex';
  };
  const hide = (ref) => {
    const target = findDomEl(ref);
    if (target) {
      if (target.style.display && target.style.display !== 'none') target.dataset.prevDisplay = target.style.display;
      target.style.display = 'none';
    }
  };
  const toggleVisible = (ref) => {
    const target = findDomEl(ref);
    if (target) {
      const isHiddenNow = target.style.display === 'none' || getComputedStyle(target).display === 'none';
      if (isHiddenNow) show(ref);
      else hide(ref);
    }
  };
  const addClass = (ref, cls) => {
    const target = findDomEl(ref);
    if (target && cls) target.classList.add(String(cls));
  };
  const removeClass = (ref, cls) => {
    const target = findDomEl(ref);
    if (target && cls) target.classList.remove(String(cls));
  };
  const scrollToElement = (ref) => {
    const target = findDomEl(ref);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };
  const openUrl = (url, newTab = true) => {
    if (!url || typeof window === 'undefined') return;
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.href = url;
  };
  const goToPage = (routeOrId) => {
    const clean = String(routeOrId || '').trim();
    if (clean.startsWith('#') && !clean.startsWith('#/')) return scrollToElement(clean);
    if (typeof onNavigatePage === 'function') {
      const handled = onNavigatePage(clean.startsWith('#/') ? clean.slice(1) : clean);
      if (handled) return;
    }
    notify(\`Sayfa yönlendirmesi: \${clean}\`);
  };
  const toggleAccordion = (targetRef) => {
${buildAccordionToggleBody('findDomEl')}
  };
  const switchSlider = (sliderRef, action = 'next', targetIdx = 0) => {
    const root = findDomEl(sliderRef);
    if (!root) return;
    const slides = Array.from(root.querySelectorAll('[data-craft-slide-index]'));
    const total = Math.max(1, slides.length);
    const cur = Number(root.getAttribute('data-craft-active-slide') || 0);
    let next = 0;
    if (action === 'prev') next = (cur - 1 + total) % total;
    else if (action === 'goto') next = ((Number(targetIdx) || 0) % total + total) % total;
    else next = (cur + 1) % total;
    root.setAttribute('data-craft-active-slide', String(next));
    slides.forEach((slideEl) => {
      if (!slideEl.dataset.craftOrigDisplay) {
        slideEl.dataset.craftOrigDisplay = slideEl.style.display && slideEl.style.display !== 'none' ? slideEl.style.display : 'flex';
      }
      const sIdx = Number(slideEl.getAttribute('data-craft-slide-index') || 0);
      const isVisible = sIdx === next;
      slideEl.classList.toggle('is-slide-hidden', !isVisible);
      slideEl.style.display = isVisible ? slideEl.dataset.craftOrigDisplay : 'none';
    });
    const dots = Array.from(root.querySelectorAll('[data-craft-slider-dot]'));
    dots.forEach((dotEl) => {
      const dIdx = Number(dotEl.getAttribute('data-craft-slider-dot') || 0);
      const active = dIdx === next;
      dotEl.classList.toggle('is-active-dot', active);
      dotEl.style.opacity = active ? '1' : '0.45';
      dotEl.style.transform = active ? 'scale(1.22)' : 'scale(1)';
    });
  };
  const notify = (msg) => {
    const text = String(msg ?? '');
    if (typeof onNotify === 'function') onNotify(text);
    else if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text);
  };
  const alert = notify;
${fnDefs ? `\n${fnDefs}` : ''}`;
}

/**
 * Serializes an AST element into pure JSX with className, htmlFor, style object, etc.
 */
export function renderAstElementToJsx(el, indent = '      ', options = {}) {
  if (!el || typeof el !== 'object') return '';
  const {
    projectFunctions = [],
    tabs = [],
    includeNodeDataId = false,
    preserveCanvasCoords = false,
    parentSliderActiveIdx = null,
    parentAccordionOpen = null,
    accordionLayoutOverride = null,
    parentWidth = 1280,
    topOffsetPx = 0,
  } = options || {};
  const rawTag = (el.type || 'div').toLowerCase();
  const tag = resolveHtmlTagName(rawTag);
  const isVoid = isVoidTag(tag);
  const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select';
  const accLayout = computeAccordionContainerLayout(el);

  // Convert attributes safely (deduping class/className, parsing inline style string, converting form props)
  const jsxAttrParts = [];
  const rawAttrs = { ...(el.attrs || {}) };
  let parsedAttrStyle = {};
  if (typeof rawAttrs.style === 'string') {
    parsedAttrStyle = parseInlineStyleString(rawAttrs.style);
  } else if (rawAttrs.style && typeof rawAttrs.style === 'object') {
    parsedAttrStyle = normalizeStyleForReact(rawAttrs.style);
  }
  delete rawAttrs.style;

  const mergedClasses = [rawAttrs.class, rawAttrs.className, el.animation?.className, el.animation?.hoverClassName]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .trim();
  delete rawAttrs.class;
  delete rawAttrs.className;

  const isSlideHidden = el.sliderRole === 'slide' && parentSliderActiveIdx !== null && Number(el.slideIndex || 0) !== Number(parentSliderActiveIdx);
  const isActiveDot = el.sliderRole === 'dot' && parentSliderActiveIdx !== null && Number(el.slideIndex || 0) === Number(parentSliderActiveIdx);
  const finalClassList = [
    mergedClasses,
    isSlideHidden ? 'is-slide-hidden' : '',
    isActiveDot ? 'is-active-dot' : '',
  ].filter(Boolean).join(' ').trim();

  const attrs = {};
  Object.entries(rawAttrs).forEach(([key, val]) => {
    if (!key || !/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(key)) return;
    if (/^on[a-z]+$/i.test(key)) return;
    if (isFormField && key === 'value' && rawAttrs.defaultValue === undefined) {
      attrs.defaultValue = val;
      return;
    }
    if (tag === 'input' && key === 'checked' && rawAttrs.defaultChecked === undefined) {
      attrs.defaultChecked = val;
      return;
    }
    attrs[key] = val;
  });

  if (finalClassList) {
    attrs.className = finalClassList;
  }
  if (tag === 'img' && !attrs.src) {
    attrs.src = el.imageUrl || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80';
    if (!attrs.alt) attrs.alt = 'Görsel';
  }
  if (el.id && ((el.responsive && (el.responsive.tablet || el.responsive.mobile)) || preserveCanvasCoords || el.sliderConfig || el.accordionRole)) {
    attrs['data-craft-id'] = el.id;
  }
  if (includeNodeDataId && el.id && !attrs.id && !attrs['data-craft-id']) {
    attrs['data-craft-node'] = el.id;
  }
  const ownSliderIdx = el.sliderConfig ? Number(el.sliderConfig.activeSlideIndex || 0) : null;
  if (ownSliderIdx !== null) {
    attrs['data-craft-slider-root'] = el.id;
    attrs['data-craft-active-slide'] = String(ownSliderIdx);
  }
  if (el.sliderRole === 'slide') {
    attrs['data-craft-slide-index'] = String(el.slideIndex || 0);
  }
  if (el.sliderRole === 'dot') {
    attrs['data-craft-slider-dot'] = String(el.slideIndex || 0);
  }
  if (accLayout.itemMap && typeof el.height === 'number') {
    attrs['data-craft-accordion-base-h'] = String(el.height);
  }
  if (el.accordionRole === 'item') {
    const isItemOpen = el.accordionOpen !== false;
    const collapsedH = Number(el.accordionCollapsedHeight) || Number(el.height) || 58;
    const expandedH = Number(el.accordionExpandedHeight) || Number(el.height) || 108;
    attrs['data-craft-accordion-item'] = '1';
    attrs['data-craft-accordion-open'] = isItemOpen ? '1' : '0';
    attrs['data-craft-accordion-collapsed'] = String(collapsedH);
    attrs['data-craft-accordion-expanded'] = String(expandedH);
    if (typeof el.y === 'number') attrs['data-craft-accordion-base-y'] = String(el.y - topOffsetPx);
    if (typeof el.height === 'number') attrs['data-craft-accordion-base-h'] = String(el.height);
  }
  if (el.accordionRole === 'panel') {
    attrs['data-craft-accordion-panel'] = '1';
  }
  if (el.accordionRole === 'indicator') {
    attrs['data-craft-accordion-indicator'] = '1';
  }

  const validChildren = Array.isArray(el.children) ? el.children.filter(Boolean) : [];
  const hasChildren = validChildren.length > 0;
  const rawText = (el.accordionRole === 'indicator' && parentAccordionOpen !== null)
    ? (parentAccordionOpen ? '−' : '+')
    : (rawTag === 'button' && el.sliderRole !== 'dot' && !hasChildren && !el.textContent && !el.content)
      ? 'Buton'
      : (el.textContent || el.content || '');
  if (tag === 'textarea' && rawText && attrs.defaultValue === undefined) {
    attrs.defaultValue = rawText;
  }

  Object.entries(attrs).forEach(([key, val]) => {
    if (val === undefined || val === null || val === false || val === '') return;
    const jsxKey = convertHtmlAttrToJsx(key);
    if (val === true) {
      jsxAttrParts.push(jsxKey);
    } else {
      jsxAttrParts.push(`${jsxKey}="${String(val).replace(/"/g, '&quot;')}"`);
    }
  });

  // Handle style & visual properties with 1:1 Canvas fidelity
  const styleObj = { ...parsedAttrStyle, ...normalizeStyleForReact(el.style || {}) };
  const { isPureTextNode, textAlignVal, innerTextPadding, innerLineHeight } = resolveCanvasParityStyle({
    styleObj,
    node: el,
    rawTag,
    mappedTag: tag,
    isVoid,
    isFormField,
    hasChildren,
    parentWidth,
    topOffsetPx,
    accordionLayoutOverride,
    accLayout,
    applyCanvasCoords: preserveCanvasCoords,
    isPlainHtml: false,
  });

  if (el.isHidden) {
    styleObj.display = 'none';
  }
  if (el.accordionRole === 'panel' && parentAccordionOpen === false) {
    styleObj.display = 'none';
  }
  if (el.sliderRole === 'dot' && parentSliderActiveIdx !== null) {
    styleObj.opacity = isActiveDot ? 1 : 0.45;
    if (isActiveDot) styleObj.transform = 'scale(1.22)';
  }

  let onClickExpr = buildReactOnClickExpression(el.events?.onClick, projectFunctions, tabs);
  if (!onClickExpr && tag === 'a' && attrs.href && String(attrs.href).startsWith('#/')) {
    const internalRoute = String(attrs.href).slice(1);
    onClickExpr = `(e) => { e.preventDefault(); goToPage(${JSON.stringify(internalRoute)}); }`;
  }
  if (onClickExpr && !styleObj.cursor) styleObj.cursor = 'pointer';

  const safeText = escapeJsxText(rawText);
  const isRawTextTag = tag === 'option' || tag === 'title';
  const wrapTextSpan = Boolean(rawText) && !isRawTextTag && (isPureTextNode || (preserveCanvasCoords && !hasChildren));
  if (wrapTextSpan && !styleObj.textAlign) {
    styleObj.textAlign = textAlignVal;
  }

  let styleProp = '';
  if (Object.keys(styleObj).length > 0) {
    styleProp = ` style={${JSON.stringify(styleObj)}}`;
  }

  const onClickProp = onClickExpr ? ` onClick={${onClickExpr}}` : '';

  const attrsStr = jsxAttrParts.length > 0 ? ` ${jsxAttrParts.join(' ')}` : '';

  if (isVoid || tag === 'textarea') {
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp} />`;
  }
  const innerSpanStyle = wrapTextSpan
    ? {
        width: '100%',
        display: 'block',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
        textAlign: 'inherit',
        ...(innerTextPadding ? { padding: innerTextPadding } : {}),
        ...(innerLineHeight ? { lineHeight: innerLineHeight } : {}),
      }
    : null;
  const renderedTextNode = safeText
    ? (wrapTextSpan ? `<span style={${JSON.stringify(innerSpanStyle)}}>${safeText}</span>` : safeText)
    : '';
  const nextParentWidth = Number(el.width) || parentWidth;
  const nextAccordionOpen = el.accordionRole === 'item' ? (el.accordionOpen !== false) : parentAccordionOpen;
  const childOptions = {
    ...options,
    topOffsetPx: 0,
    parentSliderActiveIdx: ownSliderIdx !== null ? ownSliderIdx : parentSliderActiveIdx,
    parentAccordionOpen: nextAccordionOpen,
    parentWidth: nextParentWidth,
  };

  if (hasChildren) {
    const childrenJsx = validChildren.map((child) => {
      const childLayoutOverride = accLayout.itemMap ? (accLayout.itemMap.get(child.id) || null) : null;
      return renderAstElementToJsx(child, indent + '  ', { ...childOptions, accordionLayoutOverride: childLayoutOverride });
    }).join('\n');
    const textPart = renderedTextNode ? `${indent}  ${renderedTextNode}\n` : '';
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>\n${textPart}${childrenJsx}\n${indent}</${tag}>`;
  }

  if ((rawTag === 'product_card' || (rawTag === 'article' && el.productName)) && !rawText) {
    const productImg = el.productImage || el.imageUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80';
    const cardTitle = escapeJsxText(el.productName || 'Özel Ürün');
    const cardDesc = el.productDesc ? `<p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#64748b' }}>${escapeJsxText(el.productDesc)}</p>` : '';
    const cardTag = el.productTag ? `<span style={{ position: 'absolute', top: '12px', left: '12px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(15,23,42,0.86)', color: '#f8fafc', fontSize: '11px', fontWeight: 600 }}>${escapeJsxText(el.productTag)}</span>` : '';
    const cardPrice = el.productPrice ? `<span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>${escapeJsxText(el.productPrice)}</span>` : '<span />';
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>\n${indent}  <div style={{ position: 'relative', width: '100%', height: '56%', minHeight: '140px', overflow: 'hidden', background: '#0f172a' }}><img src={${JSON.stringify(productImg)}} alt={${JSON.stringify(el.productName || 'Ürün')}} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />${cardTag}</div>\n${indent}  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', gap: '8px', width: '100%' }}><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>${cardTitle}</h3>${cardDesc}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>${cardPrice}<span style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>İncele ↗</span></div></div>\n${indent}</${tag}>`;
  }

  if (!wrapTextSpan && (rawText.includes('\n') || rawText.length > 40)) {
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>\n${indent}  ${renderedTextNode}\n${indent}</${tag}>`;
  }

  return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>${renderedTextNode}</${tag}>`;
}

// Generates a fully modular, responsive, Flexbox & Grid based universal React project
export function generateModularReactProject(
  elements = [],
  canvasSettings = {},
  canvasByViewport = null,
  projectContext = {}
) {
  const {
    projectFunctions = [],
    tabs = [],
    pageLinks = [],
    viewportMode = 'desktop',
    projectName = 'CraftStudio Projesi',
    folderSlug,
    activeTabId,
  } = projectContext || {};
  const resolvedSlug = slugifyProjectFolderName(folderSlug || projectName || 'yayinlanan-react-site');
  const safeElements = Array.isArray(elements) ? elements.filter(Boolean) : [];
  const normalizedTabs = normalizePublishTabs({
    tabs,
    activeTabId,
    elements: safeElements,
    canvasSettings,
    canvasByViewport,
  });
  const activeNormalizedTab = normalizedTabs.find((t) => t.id === activeTabId) || normalizedTabs[0];
  // Flatten tree to find standard elements across any depth
  const flatElements = flattenTree(safeElements);
  const allTabFlatElements = normalizedTabs.flatMap((t) => flattenTree(t.elements || []));
  const allTabRootElements = normalizedTabs.flatMap((t) => t.elements || []);

  // Extract navbar elements & texts dynamically from OOP AST
  const navEl = flatElements.find(el => el.type === 'nav' || el.type === 'navbar');
  const logoTextEl = flatElements.find(el => el.id === 'elem-nav-logo-text');
  const logoText = logoTextEl?.textContent || logoTextEl?.content || navEl?.logoText || 'CRAFT • STUDIO';

  const navLinkNodes = flatElements.filter(el => el.id && el.id.startsWith('elem-nav-link-'));
  const navLinks = navLinkNodes.length > 0
    ? navLinkNodes.map(el => el.textContent || el.content || '').filter(Boolean)
    : (navEl?.navLinks || ['Özellikler', 'Çözümler', 'Şablonlar', 'Fiyatlandırma', 'İletişim']);

  const navCtaEl = flatElements.find(el => el.id === 'elem-nav-cta-btn');
  const navCtaText = navCtaEl?.textContent || navCtaEl?.content || '';

  // Extract hero elements & texts dynamically
  const badgeEl = flatElements.find(el => el.id === 'elem-badge' || el.type === 'badge');
  const badgeText = badgeEl?.textContent || badgeEl?.content || '🚀 Yeni Nesil Web Tasarımcısı v2.0';

  const titleEl = flatElements.find(el => el.id === 'elem-hero-title' || el.type === 'h1' || (el.type === 'text' && el.fontSize >= 32));
  const titleText = titleEl?.textContent || titleEl?.content || 'Hayalinizdeki Web Sitesini Özgürce Tasarlayın';

  const descEl = flatElements.find(el => el.id === 'elem-hero-desc' || el.type === 'p');
  const descText = descEl?.textContent || descEl?.content || 'Görsel düzenleme kolaylığı, canlı HTML/CSS senkronizasyonu ve tek tıkla modüler React çıktısı ile projelerinizi dakikalar içinde hayata geçirin.';

  const ctaEl = flatElements.find(el => el.id === 'elem-hero-btn' || el.type === 'button');
  const heroCtaText = ctaEl?.textContent || ctaEl?.content || 'Hemen Başlayın 🚀';

  const extLinkEl = flatElements.find(el => el.id === 'elem-google-link');
  const extLinkText = extLinkEl?.textContent || extLinkEl?.content || "Google'a Git ↗";
  const extLinkHref = extLinkEl?.attrs?.href || 'https://www.google.com';

  // Extract features elements & texts dynamically
  const secTitleEl = flatElements.find(el => el.id === 'elem-sec-title' || el.type === 'h2');
  const secTitleText = secTitleEl?.textContent || secTitleEl?.content || '⚡ Neden CraftStudio?';

  const secDescEl = flatElements.find(el => el.id === 'elem-sec-desc');
  const secDescText = secDescEl?.textContent || secDescEl?.content || 'Görsel düzenleme kolaylığı ve modüler React bileşenleriyle modern web siteleri tasarlayın.';

  // Extract Card elements (elem-card-1, elem-card-2, elem-card-3 or any article)
  const cardIds = ['elem-card-1', 'elem-card-2', 'elem-card-3'];
  const cardContainers = cardIds.map(id => flatElements.find(el => el.id === id)).filter(Boolean);
  const cardEls = cardContainers.length > 0 
    ? cardContainers 
    : flatElements.filter(el => el.type === 'article' || el.type === 'product_card');

  const defaultCards = [
    {
      id: 'f1',
      name: 'Veriye Dayalı HTML5 AST',
      desc: 'Bileşenler gerçek HTML5 etiketleriyle veriye dayalı iç içe ağaç olarak saklanır.',
      tag: 'DOM Mimarisi',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    },
    {
      id: 'f2',
      name: 'Çift Yönlü Canlı Kod',
      desc: 'Sol panelde yapılan her değişiklik anında canlı kod ve DOM ağacıyla senkronize olur.',
      tag: 'Canlı Senkron',
      image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    },
    {
      id: 'f3',
      name: 'Modüler React Çıktısı',
      desc: 'Tek tıkla masaüstüne Vite + Tailwind destekli modüler React projesi üretir.',
      tag: 'Üretime Hazır',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    }
  ];

  const cardsToUse = cardEls.length > 0
    ? cardEls.map((c, idx) => {
        const imgChild = flatElements.find(e => e.id === `${c.id}-img`) || c.children?.find(ch => ch.type === 'img');
        const badgeChild = flatElements.find(e => e.id === `${c.id}-badge`) || c.children?.find(ch => ch.type === 'span');
        const titleChild = flatElements.find(e => e.id === `${c.id}-title`) || c.children?.find(ch => ch.type === 'h3' || ch.type === 'h4');
        const descChild = flatElements.find(e => e.id === `${c.id}-desc`) || c.children?.find(ch => ch.type === 'p');
        const btnChild = flatElements.find(e => e.id === `${c.id}-btn`) || c.children?.find(ch => ch.type === 'button');

        return {
          id: c.id || `f-${idx + 1}`,
          name: titleChild?.textContent || titleChild?.content || c.productName || c.name || `Özellik ${idx + 1}`,
          desc: descChild?.textContent || descChild?.content || c.productDesc || 'Modern web standartlarıyla tasarlanmış özellik bileşeni.',
          tag: badgeChild?.textContent || badgeChild?.content || c.productTag || 'Özellik',
          image: imgChild?.attrs?.src || c.productImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
          btnText: btnChild?.textContent || btnChild?.content || 'Detayları İncele ↗'
        };
      })
    : defaultCards;

  // Extract Footer elements & texts dynamically
  const footerBrandTitle = flatElements.find(el => el.id === 'elem-footer-brand-title')?.textContent || 'CRAFT STUDIO';
  const footerBrandDesc = flatElements.find(el => el.id === 'elem-footer-brand-desc')?.textContent || 'Yeni nesil web siteleri, SaaS panelleri ve modern arayüzler tasarlamak için yaratıcı geliştirme stüdyosu.';

  const col1Title = flatElements.find(el => el.id === 'elem-footer-col1-title')?.textContent || 'Ürünler';
  const col1Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col1-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol1 = col1Links.length > 0 ? col1Links : ['Web Stüdyosu', 'React Şablonları', 'UI Bileşenleri'];

  const col2Title = flatElements.find(el => el.id === 'elem-footer-col2-title')?.textContent || 'Şirket';
  const col2Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col2-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol2 = col2Links.length > 0 ? col2Links : ['Hakkımızda', 'Kariyer & Ekip', 'İletişim & Destek'];

  const col3Title = flatElements.find(el => el.id === 'elem-footer-col3-title')?.textContent || 'Topluluk';
  const col3Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col3-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol3 = col3Links.length > 0 ? col3Links : ['Discord Topluluğu', 'GitHub Deposu', 'Gizlilik İlkeleri'];

  const copyrightText = flatElements.find(el => el.id === 'elem-footer-copyright')?.textContent || '© 2026 CraftStudio Inc. Tüm hakları saklıdır. Nesneye yönelik modüler mimari ile oluşturulmuştur.';

  // Any custom AST elements designed on the canvas outside default presets (top level)
  const standardIds = new Set([
    'elem-nav', 'elem-nav-brand', 'elem-nav-logo-icon', 'elem-nav-logo-text', 'elem-nav-menu',
    'elem-nav-link-1', 'elem-nav-link-2', 'elem-nav-link-3', 'elem-nav-link-4', 'elem-nav-link-5', 'elem-nav-cta-btn',
    'elem-hero', 'elem-badge', 'elem-hero-title', 'elem-hero-desc', 'elem-hero-btn', 'elem-google-link', 'elem-hero-visual',
    'elem-features-section', 'elem-sec-title', 'elem-sec-desc', 'elem-cards-grid',
    'elem-card-1', 'elem-card-1-img', 'elem-card-1-badge', 'elem-card-1-title', 'elem-card-1-desc', 'elem-card-1-btn',
    'elem-card-2', 'elem-card-2-img', 'elem-card-2-badge', 'elem-card-2-title', 'elem-card-2-desc', 'elem-card-2-btn',
    'elem-card-3', 'elem-card-3-img', 'elem-card-3-badge', 'elem-card-3-title', 'elem-card-3-desc', 'elem-card-3-btn',
    'elem-footer', 'elem-footer-brand-box', 'elem-footer-brand-title', 'elem-footer-brand-desc',
    'elem-footer-col-1', 'elem-footer-col1-title', 'elem-footer-col1-link1', 'elem-footer-col1-link2', 'elem-footer-col1-link3',
    'elem-footer-col-2', 'elem-footer-col2-title', 'elem-footer-col2-link1', 'elem-footer-col2-link2', 'elem-footer-col2-link3',
    'elem-footer-col-3', 'elem-footer-col3-title', 'elem-footer-col3-link1', 'elem-footer-col3-link2', 'elem-footer-col3-link3',
    'elem-footer-copyright'
  ]);
  const hasMultiPages = normalizedTabs.length > 1;
  const heroEl = flatElements.find((el) => el.id === 'elem-hero' || el.id === 'hero-sec');
  const navRoot = safeElements.find((el) => el.id === 'elem-nav' || el.type === 'nav' || el.type === 'navbar') || null;
  const heroRoot = safeElements.find((el) => el.id === 'elem-hero' || el.id === 'hero-sec') || null;
  const featuresRoot = safeElements.find((el) => el.id === 'elem-features-section') || safeElements.find((el) => el.id === 'elem-cards-grid');
  const footerRoot = safeElements.find((el) => el.id === 'elem-footer' || el.type === 'footer');

  const usesModularTemplate = Boolean(navRoot && heroRoot && !hasMultiPages);
  const hasFeaturesSection = usesModularTemplate
    ? Boolean(featuresRoot)
    : flatElements.some(
        (el) => el.id === 'elem-features-section' || el.id === 'elem-cards-grid' || el.id === 'elem-card-1' || el.type === 'article' || el.type === 'product_card'
      );
  const hasFooterSection = usesModularTemplate
    ? Boolean(footerRoot)
    : flatElements.some((el) => el.id === 'elem-footer' || el.type === 'footer');
  const handledModularIds = new Set([navRoot?.id, heroRoot?.id, featuresRoot?.id, footerRoot?.id].filter(Boolean));
  const customElements = usesModularTemplate
    ? safeElements.filter((el) => !handledModularIds.has(el.id))
    : safeElements;

  const initialTab = normalizedTabs.find((t) => t.id === activeTabId) || normalizedTabs[0];
  const stageBgColor = initialTab.canvasSettings?.bgColor || initialTab.canvasSettings?.backgroundColor || canvasSettings?.bgColor || canvasSettings?.backgroundColor || '#0b0f19';
  const stageWidth = Number(initialTab.canvasSettings?.width || canvasSettings?.width) || 1280;
  const stageHeight = Number(initialTab.canvasSettings?.height || canvasSettings?.height) || 1350;
  const resolvedStageHeight = computeResolvedStageHeight(safeElements, stageHeight);

  const customElementsRuntimeCode = buildExportedRuntimeScript(projectFunctions);
  const stageJsxOptions = {
    projectFunctions,
    tabs: normalizedTabs,
    preserveCanvasCoords: true,
    topOffsetPx: 0,
    parentWidth: stageWidth,
    includeNodeDataId: true,
  };

  const buildModularAstSectionCode = (componentName, propsSig, astNode) => `import React from 'react';

export default function ${componentName}(${propsSig}) {
${customElementsRuntimeCode}

  return (
    <>
${renderAstElementToJsx(astNode, '      ', stageJsxOptions)}
    </>
  );
}
`;

  const navBg = navEl?.fillColor || navEl?.style?.backgroundColor || '#0f172a';
  const heroBackground = (heroEl?.fillType === 'gradient' && heroEl?.gradient)
    ? `linear-gradient(${heroEl.gradient.angle || 135}deg, ${heroEl.gradient.color1 || '#0f172a'} 0%, ${heroEl.gradient.color2 || '#1e1b4b'} 100%)`
    : (heroEl?.fillColor && heroEl.fillColor !== 'transparent' ? heroEl.fillColor : (heroEl?.style?.background || 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'));
  const heroRadius = heroEl?.borderRadius ? `${heroEl.borderRadius}px` : '24px';
  const heroBtnBackground = (ctaEl?.fillType === 'gradient' && ctaEl?.gradient)
    ? `linear-gradient(${ctaEl.gradient.angle || 90}deg, ${ctaEl.gradient.color1 || '#3b82f6'} 0%, ${ctaEl.gradient.color2 || '#2563eb'} 100%)`
    : (ctaEl?.fillColor && ctaEl.fillColor !== 'transparent' ? ctaEl.fillColor : (ctaEl?.style?.background || 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'));

  // 1. src/components/Navbar.jsx
  const navbarCode = usesModularTemplate && navRoot
    ? buildModularAstSectionCode('Navbar', '{ onCtaClick, onNotify, onNavigatePage }', navRoot)
    : `import React, { useState } from 'react';
import { Search, Menu, X, Sparkles, ArrowRight } from 'lucide-react';

export default function Navbar({ onCtaClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = ${JSON.stringify(navLinks)};

  return (
    <header style={{ backgroundColor: ${JSON.stringify(navBg)} }} className="sticky top-0 z-50 w-full backdrop-blur-md border-b border-[#1e293b] transition-all">
      <div className="w-full px-4 sm:px-8 lg:px-14 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md font-bold">
            <Sparkles size={17} />
          </div>
          <span className="font-bold tracking-wider text-sm sm:text-base text-white font-sans">
            ${escapeJsxText(logoText)}
          </span>
        </div>

        {/* Desktop Nav Links (Hidden on Mobile 375px, Visible on Desktop 1440px) */}
        <nav className="hidden md:flex items-center gap-8 text-xs text-slate-300 font-medium">
          {navLinks.map((link, idx) => (
            <a 
              key={idx} 
              href="#" 
              className="hover:text-blue-400 transition-colors py-1 relative group"
            >
              {link}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            aria-label="Arama"
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Search size={17} />
          </button>

          {navCtaText && (
            <button 
              onClick={onCtaClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>{navCtaText}</span>
              <ArrowRight size={13} />
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
            aria-label="Menüyü Aç"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0b1120] border-b border-[#1e293b] px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link, idx) => (
            <a 
              key={idx} 
              href="#" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200 hover:text-blue-400 font-medium border-b border-[#1e293b] last:border-none"
            >
              {link}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
`;

  // 2. src/components/HeroSection.jsx
  const heroCode = usesModularTemplate && heroRoot
    ? buildModularAstSectionCode('HeroSection', '{ onCtaClick, onNotify, onNavigatePage }', heroRoot)
    : `import React from 'react';
import { Sparkles, ArrowRight, ExternalLink } from 'lucide-react';

export default function HeroSection({ onCtaClick }) {
  return (
    <section className="w-full px-4 sm:px-8 lg:px-14 py-8 sm:py-14">
      {/* Flex container with modern indigo gradient matching canvas */}
      <div 
        style={{
          background: ${JSON.stringify(heroBackground)},
          borderRadius: ${JSON.stringify(heroRadius)},
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
        }}
        className="w-full border border-[#312e81] p-6 sm:p-12 md:p-16 flex flex-col items-start justify-center text-left relative overflow-hidden"
      >
        {/* Subtle background ambient glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-xs font-semibold mb-4 sm:mb-6">
          <Sparkles size={13} className="text-indigo-400" />
          <span>${escapeJsxText(badgeText)}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#f8fafc] tracking-tight leading-tight max-w-4xl mb-4 sm:mb-6">
          ${escapeJsxText(titleText)}
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base md:text-lg text-[#94a3b8] max-w-3xl leading-relaxed mb-6 sm:mb-8">
          ${escapeJsxText(descText)}
        </p>

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onCtaClick}
            style={{
              background: ${JSON.stringify(heroBtnBackground)},
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
            }}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-white font-bold text-sm sm:text-base hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span>${escapeJsxText(heroCtaText)}</span>
            <ArrowRight size={17} />
          </button>

          {/* External Link */}
          <a
            href={${JSON.stringify(extLinkHref)}}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-sm font-medium transition-all"
          >
            <span>${escapeJsxText(extLinkText)}</span>
            <ExternalLink size={14} className="text-blue-400" />
          </a>
        </div>
      </div>
    </section>
  );
}
`;

  // 3. src/components/ProductCard.jsx (Feature Card in Dark SaaS Theme)
  const productCardCode = `import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function ProductCard({ 
  name, 
  desc, 
  tag, 
  image, 
  btnText,
  onAction 
}) {
  return (
    <article className="group bg-[#1e293b] rounded-2xl border border-[#334155] shadow-lg hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden p-5">
      {/* Feature Image Box */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-4">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        {tag && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 text-white shadow-md">
            {tag}
          </span>
        )}
      </div>

      {/* Info & Action */}
      <div className="flex flex-col gap-3 flex-1 justify-between">
        <div>
          <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
            {name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {desc}
          </p>
        </div>

        <button
          onClick={onAction}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-98 shadow-md cursor-pointer mt-3"
        >
          <span>{btnText || 'Detayları İncele ↗'}</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
`;

  // 4. src/components/ProductsSection.jsx (Features Section)
  const productsSectionCode = usesModularTemplate && featuresRoot
    ? buildModularAstSectionCode('ProductsSection', '{ onAction, onNotify, onNavigatePage }', featuresRoot)
    : `import React from 'react';
import ProductCard from './ProductCard';

export default function ProductsSection({ onAction }) {
  const items = ${JSON.stringify(cardsToUse, null, 2)};

  return (
    <section id="ozellikler" className="w-full px-4 sm:px-8 lg:px-14 py-8 sm:py-16">
      {/* Container Box matching canvas #0f172a / border-[#1e293b] */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl p-6 sm:p-10 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 gap-4">
          <div>
            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase block mb-1">
              GÜÇLÜ ALTYAPI
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-sans">
              ${escapeJsxText(secTitleText)}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            ${escapeJsxText(secDescText)}
          </p>
        </div>

        {/* Responsive Grid: 1 col on mobile (375px), 2 cols on tablet, 3 cols on desktop (1440px) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              name={item.name}
              desc={item.desc}
              tag={item.tag}
              image={item.image}
              btnText={item.btnText}
              onAction={() => onAction && onAction(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
`;

  // 5. Custom Elements Section (renders any custom user tags + multi-page tabs + interactive projectFunctions)
  const sectionStageHeight = resolvedStageHeight;
  let customSectionBodyJsx = '';

  if (hasMultiPages) {
    customSectionBodyJsx = normalizedTabs
      .map((tab) => {
        const tabWidth = Number(tab.canvasSettings?.width) || stageWidth;
        const tabHeight = computeResolvedStageHeight(tab.elements || [], Number(tab.canvasSettings?.height) || stageHeight);
        const tabBg = tab.canvasSettings?.bgColor || tab.canvasSettings?.backgroundColor || stageBgColor;
        const tabJsxOptions = {
          projectFunctions,
          tabs: normalizedTabs,
          preserveCanvasCoords: true,
          parentWidth: tabWidth,
          includeNodeDataId: true,
        };
        const tabChildrenJsx = (tab.elements || [])
          .map((el) => renderAstElementToJsx(el, '        ', tabJsxOptions))
          .join('\n');
        return `      <div
        data-craft-page-id=${JSON.stringify(tab.id)}
        data-craft-route=${JSON.stringify(tab.route)}
        className="relative w-full"
        style={{
          display: activePageId === ${JSON.stringify(tab.id)} ? 'block' : 'none',
          minHeight: '${tabHeight}px',
          backgroundColor: ${JSON.stringify(tabBg)},
        }}
      >
${tabChildrenJsx || '        <div className="w-full py-24 text-center text-sm text-slate-400">Bu sayfada henüz bileşen bulunmuyor.</div>'}
      </div>`;
      })
      .join('\n');
  } else {
    const jsxRenderOptions = {
      projectFunctions,
      tabs: normalizedTabs,
      preserveCanvasCoords: true,
      topOffsetPx: 0,
      parentWidth: stageWidth,
      includeNodeDataId: true,
    };
    const renderedCustomChildren = customElements
      .map((el) => renderAstElementToJsx(el, '      ', jsxRenderOptions))
      .join('\n');
    customSectionBodyJsx = usesModularTemplate
      ? `    <>\n${renderedCustomChildren}\n    </>`
      : `    <section className="relative w-full" style={{ minHeight: '${sectionStageHeight}px' }}>\n${renderedCustomChildren}\n    </section>`;
  }

  const customElementsCode = `import React from 'react';

export default function CustomElementsSection({ onNotify, activePageId, onNavigatePage }) {
${customElementsRuntimeCode}

  return (
${hasMultiPages ? `    <div className="w-full relative overflow-x-clip">\n${customSectionBodyJsx}\n    </div>` : customSectionBodyJsx}
  );
}
`;

  // 6. src/components/Footer.jsx
  const footerCode = usesModularTemplate && footerRoot
    ? buildModularAstSectionCode('Footer', '{ onNotify, onNavigatePage }', footerRoot)
    : `import React from 'react';
import { Sparkles, Mail, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#0f172a] text-slate-300 border-t border-[#1e293b] mt-16">
      <div className="w-full px-4 sm:px-8 lg:px-14 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 sm:gap-12 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold">
                <Sparkles size={15} />
              </div>
              <span className="text-base font-bold text-white tracking-wider font-sans">
                ${escapeJsxText(footerBrandTitle)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              ${escapeJsxText(footerBrandDesc)}
            </p>
          </div>

          {/* Sütun 1: Ürünler */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${escapeJsxText(col1Title)}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol1.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${escapeJsxText(l)}</a></li>`).join('\n              ')}
            </ul>
          </div>

          {/* Sütun 2: Şirket */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${escapeJsxText(col2Title)}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol2.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${escapeJsxText(l)}</a></li>`).join('\n              ')}
            </ul>
          </div>

          {/* Sütun 3: Topluluk */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${escapeJsxText(col3Title)}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol3.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${escapeJsxText(l)}</a></li>`).join('\n              ')}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#1e293b] pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>${escapeJsxText(copyrightText)}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-400">Gizlilik Politikası</a>
            <a href="#" className="hover:text-slate-400">Kullanım Koşulları</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
`;

  // 7. src/App.jsx (Renders 1:1 Studio AST inside modular section components or multi-page tabs)
  const hasCustomElements = customElements.length > 0 || hasMultiPages;
  const routeEntriesMeta = normalizedTabs.map((t) => ({
    id: t.id,
    route: t.route,
    name: String(t.name || '').replace(/\.craft$/i, ''),
    bgColor: t.canvasSettings?.bgColor || t.canvasSettings?.backgroundColor || stageBgColor,
    height: computeResolvedStageHeight(t.elements || [], Number(t.canvasSettings?.height) || stageHeight),
  }));

  const appCode = usesModularTemplate
    ? `import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
${hasFeaturesSection ? "import ProductsSection from './components/ProductsSection';" : ''}
${hasCustomElements ? "import CustomElementsSection from './components/CustomElementsSection';" : ''}
${hasFooterSection ? "import Footer from './components/Footer';" : ''}

export default function App() {
  const [notification, setNotification] = useState('');

  const handleNotify = (msg) => {
    setNotification(String(msg ?? ''));
    setTimeout(() => setNotification(''), 3500);
  };

  const handleAction = (item) => {
    handleNotify(\`"\${item?.name || 'Bileşen'}" inceleniyor...\`);
  };

  const handleScrollToFeatures = () => {
    const el = document.getElementById('elem-features-section') || document.getElementById('ozellikler');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      style={{ backgroundColor: ${JSON.stringify(stageBgColor)}, minHeight: '100vh' }}
      className="w-full flex flex-col selection:bg-blue-600 selection:text-white"
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e293b] text-blue-300 border border-blue-500/40 px-4 py-2.5 rounded-md shadow-2xl text-xs font-medium">
          {notification}
        </div>
      )}

      {/* 1:1 Canvas Stage composed from modular section components */}
      <main
        className="relative flex-1 w-full overflow-x-clip"
        style={{ backgroundColor: ${JSON.stringify(stageBgColor)}, minHeight: '${resolvedStageHeight}px' }}
      >
        <Navbar onCtaClick={handleScrollToFeatures} onNotify={handleNotify} />
        <HeroSection onCtaClick={handleScrollToFeatures} onNotify={handleNotify} />
        ${hasCustomElements ? '<CustomElementsSection onNotify={handleNotify} />\n        ' : ''}${hasFeaturesSection ? '<ProductsSection onAction={handleAction} onNotify={handleNotify} />\n        ' : ''}${hasFooterSection ? '<Footer onNotify={handleNotify} />' : ''}
      </main>
    </div>
  );
}
`
    : `import React, { useState } from 'react';
${hasCustomElements ? "import CustomElementsSection from './components/CustomElementsSection';" : ''}

const CRAFT_ROUTES = ${JSON.stringify(routeEntriesMeta, null, 2)};

export default function App() {
  const [notification, setNotification] = useState('');
  const [activePageId, setActivePageId] = useState(${JSON.stringify(initialTab.id)});

  const activePageMeta = CRAFT_ROUTES.find((r) => r.id === activePageId) || CRAFT_ROUTES[0];

  const handleNavigatePage = (targetRef) => {
    const clean = String(targetRef || '').trim();
    const normLower = clean.toLowerCase();
    const strippedLower = normLower.replace(/^\\//, '').replace(/\\.craft$/i, '');
    const found = CRAFT_ROUTES.find(
      (r) =>
        r.id === clean ||
        r.route === clean ||
        r.route.toLowerCase() === normLower ||
        r.name.toLowerCase() === normLower ||
        r.name.toLowerCase() === strippedLower
    );
    if (!found) return false;
    setActivePageId(found.id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  return (
    <div
      style={{ backgroundColor: activePageMeta?.bgColor || ${JSON.stringify(stageBgColor)}, minHeight: '100vh' }}
      className="w-full flex flex-col items-center selection:bg-blue-600 selection:text-white"
    >
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18181b] text-slate-100 border border-blue-500/50 px-4 py-2.5 rounded-md shadow-2xl text-xs font-medium">
          {notification}
        </div>
      )}

      <main
        style={{ width: '100%', minHeight: \`\${activePageMeta?.height || ${resolvedStageHeight}}px\` }}
        className="relative flex-1 overflow-x-clip"
      >
        ${hasCustomElements
          ? `<CustomElementsSection\n          activePageId={activePageId}\n          onNavigatePage={handleNavigatePage}\n          onNotify={(msg) => {\n            setNotification(msg);\n            setTimeout(() => setNotification(''), 3500);\n          }}\n        />`
          : `<div className="w-full py-24 text-center text-sm text-slate-400">Bu sayfada henüz yayınlanacak bileşen bulunmuyor.</div>`}
      </main>
    </div>
  );
}
`;

  // 8. package.json
  const packageJson = {
    name: resolvedSlug,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    dependencies: {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^1.16.0"
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.1.18",
      "@vitejs/plugin-react": "^4.3.4",
      "tailwindcss": "^4.1.18",
      "vite": "^6.1.0"
    }
  };

  // 9. vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
`;

  // 10. index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CraftStudio • Yayınlanan Modern Web Sitesi</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body style="margin:0;padding:0;background:${escapeHtmlAttr(stageBgColor)};font-family:'Inter',system-ui,-apple-system,sans-serif;" class="antialiased font-sans">
    <div id="root"></div>
    <script>if (window.location && window.location.protocol === 'file:') { window.location.replace('./live-preview.html'); }</script>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

  // 11. src/index.css
  const indexCss = `@import "tailwindcss";

@layer base {
  html, body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow-x: clip;
  }
}

/* Studio Animation Keyframes & Classes */
@keyframes studioFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes studioSlideUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes studioSlideDown { from { opacity: 0; transform: translateY(-32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes studioSlideLeft { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: translateX(0); } }
@keyframes studioSlideRight { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: translateX(0); } }
@keyframes studioZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes studioBounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 0.9; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
@keyframes studioFloatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes studioPulseGlow { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.3)); } 50% { opacity: 0.85; filter: drop-shadow(0 0 16px rgba(59, 130, 246, 0.75)); } }

.animate-fade-in { animation: studioFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-up { animation: studioSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-down { animation: studioSlideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-left { animation: studioSlideLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-right { animation: studioSlideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-zoom-in { animation: studioZoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-bounce-in { animation: studioBounceIn 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
.animate-float { animation: studioFloatSlow 3.2s ease-in-out infinite; }
.animate-pulse-glow { animation: studioPulseGlow 2.5s ease-in-out infinite; }

/* Link / Navbar Underline & Hover Effects */
.hover-underline-left,
.hover-underline-center,
.hover-underline-right,
.hover-underline-slide,
.hover-text-fill-bar {
  position: relative;
  overflow: visible !important;
  transition: color var(--craft-line-duration, 0.28s) ease, transform var(--craft-line-duration, 0.28s) ease;
}

.hover-underline-left::after,
.hover-underline-center::after,
.hover-underline-right::after,
.hover-underline-slide::after,
.hover-text-fill-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: var(--craft-line-height, 2px);
  background: var(--craft-line-color, #fbbf24);
  border-radius: 999px;
  pointer-events: none;
  transform: scaleX(0);
  transition: transform var(--craft-line-duration, 0.28s) cubic-bezier(0.22, 1, 0.36, 1), height var(--craft-line-duration, 0.28s) ease, opacity var(--craft-line-duration, 0.28s) ease;
}

.hover-underline-left::after { transform-origin: left center; }
.hover-underline-left:hover::after { transform: scaleX(1); }
.hover-underline-center::after { transform-origin: center center; }
.hover-underline-center:hover::after { transform: scaleX(1); }
.hover-underline-right::after { transform-origin: right center; }
.hover-underline-right:hover::after { transform: scaleX(1); }
.hover-underline-slide::after { transform-origin: right center; }
.hover-underline-slide:hover::after { transform-origin: left center; transform: scaleX(1); }
.hover-text-fill-bar::after { bottom: -1px; opacity: 0.2; transform: scaleX(1); }
.hover-text-fill-bar:hover::after { height: 6px; opacity: 0.45; }
.hover-text-fill-bar:hover { transform: translateY(-2px); }
.is-slide-hidden { display: none !important; }
[data-craft-slider-dot] { transition: transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease; opacity: 0.45; }
[data-craft-slider-dot].is-active-dot { opacity: 1 !important; transform: scale(1.22); }
${buildResponsiveCssRules(allTabFlatElements, allTabRootElements, activeNormalizedTab?.canvasByViewport || canvasByViewport)}
`;

  // 12. src/main.jsx
  const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  // 13. craft.project.json (Full Studio Schema incl. multi-viewport, tabs & projectFunctions)
  const serializedTabs = normalizedTabs.map(({ domId, ...restTab }) => restTab);

  const craftProjectJson = JSON.stringify({
    schemaVersion: '1.1.0',
    studio: 'CraftStudio',
    name: projectName || 'CraftStudio Projesi',
    createdAt: new Date().toISOString(),
    activeTabId: activeTabId || undefined,
    viewportMode: viewportMode || 'desktop',
    canvasSettings: canvasSettings || { width: 1280, height: 1350, backgroundColor: '#0f172a' },
    canvasByViewport: canvasByViewport || undefined,
    tabs: serializedTabs,
    projectFunctions: projectFunctions || [],
    pageLinks: Array.isArray(pageLinks) ? pageLinks : []
  }, null, 2);

  const standaloneHtml = buildStandaloneHtmlSite({
    projectName,
    tabs: normalizedTabs,
    activeTabId: activeNormalizedTab?.id || activeTabId,
    elements: activeNormalizedTab?.elements,
    canvasSettings: activeNormalizedTab?.canvasSettings || canvasSettings,
    canvasByViewport: activeNormalizedTab?.canvasByViewport || canvasByViewport,
    projectFunctions,
  });

  return {
    usesModularTemplate,
    folderSlug: resolvedSlug,
    packageJson: JSON.stringify(packageJson, null, 2),
    viteConfig,
    indexHtml,
    indexCss,
    mainJsx,
    appCode,
    navbarCode,
    heroCode,
    productCardCode,
    productsSectionCode,
    customElementsCode,
    footerCode,
    craftProjectJson,
    standaloneHtml,
  };
}

function escapeHtmlText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  return escapeHtmlText(str).replace(/"/g, '&quot;');
}

function styleObjectToInlineString(styleObj) {
  return Object.entries(styleObj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const prop = k.startsWith('--') ? k : camelToKebabCase(k);
      return `${prop}:${String(v).replace(/"/g, "'")}`;
    })
    .join(';');
}

function buildStandaloneNodeHtml(node, depth, options) {
  if (!node || typeof node !== 'object') return '';
  const shownInResponsive = node?.responsive?.tablet?.isHidden === false || node?.responsive?.mobile?.isHidden === false;
  const canToggleVisible = Boolean(options?.hasProjectFunctions || options?.toggleTargetIds?.has(node?.id));
  if (node.isHidden && !shownInResponsive && !canToggleVisible) return '';
  const {
    projectFunctions = [],
    tabs = [],
    seenHtmlIds,
    parentWidth = 1280,
    parentAccordionOpen = null,
    accordionLayoutOverride = null,
  } = options;
  const rawTag = (node.type || 'div').toLowerCase();
  const mappedTag = resolveHtmlTagName(rawTag);
  const voidTag = isVoidTag(mappedTag);
  const accLayout = computeAccordionContainerLayout(node);

  const rawAttrs = { ...(node.attrs || {}) };
  let parsedAttrStyle = {};
  if (typeof rawAttrs.style === 'string') {
    parsedAttrStyle = parseInlineStyleString(rawAttrs.style);
  } else if (rawAttrs.style && typeof rawAttrs.style === 'object') {
    parsedAttrStyle = rawAttrs.style;
  }
  delete rawAttrs.style;

  const validChildren = Array.isArray(node.children) ? node.children.filter(Boolean) : [];
  const hasChildren = validChildren.length > 0;
  const isFormField = mappedTag === 'input' || mappedTag === 'textarea' || mappedTag === 'select';
  const styleObj = { ...parsedAttrStyle, ...(node.style || {}) };
  const { isPureTextNode, textAlignVal, innerTextPadding, innerLineHeight } = resolveCanvasParityStyle({
    styleObj,
    node,
    rawTag,
    mappedTag,
    isVoid: voidTag,
    isFormField,
    hasChildren,
    parentWidth,
    topOffsetPx: 0,
    depth,
    accordionLayoutOverride,
    accLayout,
    applyCanvasCoords: true,
    isPlainHtml: true,
  });
  if (node.isHidden) styleObj.display = 'none';

  const attrs = { ...rawAttrs };
  const mergedBaseClass = [attrs.class, attrs.className].filter((v) => typeof v === 'string' && v.trim()).join(' ').trim();
  delete attrs.className;
  if (mergedBaseClass) attrs.class = mergedBaseClass;

  if (mappedTag === 'img' && !attrs.src) {
    attrs.src = node.imageUrl || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80';
    if (!attrs.alt) attrs.alt = 'Görsel';
    styleObj.objectFit = styleObj.objectFit || 'cover';
  }
  if (attrs.id) {
    if (seenHtmlIds.has(attrs.id)) delete attrs.id;
    else seenHtmlIds.add(attrs.id);
  }
  attrs['data-craft-id'] = node.id;

  const parentSliderActiveIdx = options.parentSliderActiveIdx ?? null;
  const ownSliderIdx = node.sliderConfig ? Number(node.sliderConfig.activeSlideIndex || 0) : null;
  if (ownSliderIdx !== null) {
    attrs['data-craft-slider-root'] = node.id;
    attrs['data-craft-active-slide'] = String(ownSliderIdx);
  }
  if (node.sliderRole === 'slide') {
    attrs['data-craft-slide-index'] = String(node.slideIndex || 0);
  }
  if (node.sliderRole === 'dot') {
    attrs['data-craft-slider-dot'] = String(node.slideIndex || 0);
  }
  if (accLayout.itemMap && typeof node.height === 'number') {
    attrs['data-craft-accordion-base-h'] = String(node.height);
  }
  if (node.accordionRole === 'item') {
    const isItemOpen = node.accordionOpen !== false;
    const collapsedH = Number(node.accordionCollapsedHeight) || Number(node.height) || 58;
    const expandedH = Number(node.accordionExpandedHeight) || Number(node.height) || 108;
    attrs['data-craft-accordion-item'] = '1';
    attrs['data-craft-accordion-open'] = isItemOpen ? '1' : '0';
    attrs['data-craft-accordion-collapsed'] = String(collapsedH);
    attrs['data-craft-accordion-expanded'] = String(expandedH);
    if (typeof node.y === 'number') attrs['data-craft-accordion-base-y'] = String(node.y);
    if (typeof node.height === 'number') attrs['data-craft-accordion-base-h'] = String(node.height);
  }
  if (node.accordionRole === 'panel') {
    attrs['data-craft-accordion-panel'] = '1';
    if (parentAccordionOpen === false) styleObj.display = 'none';
  }
  if (node.accordionRole === 'indicator') {
    attrs['data-craft-accordion-indicator'] = '1';
  }

  const isSlideHidden = node.sliderRole === 'slide' && parentSliderActiveIdx !== null && Number(node.slideIndex || 0) !== Number(parentSliderActiveIdx);
  const isActiveDot = node.sliderRole === 'dot' && parentSliderActiveIdx !== null && Number(node.slideIndex || 0) === Number(parentSliderActiveIdx);
  const animCls = [
    node.animation?.className,
    node.animation?.hoverClassName,
    isSlideHidden ? 'is-slide-hidden' : '',
    isActiveDot ? 'is-active-dot' : '',
  ].filter(Boolean).join(' ');
  if (animCls) attrs.class = attrs.class ? `${attrs.class} ${animCls}` : animCls;

  const onClickEv = node.events?.onClick;
  let onClickAttr = '';
  if (onClickEv && onClickEv.mode && onClickEv.mode !== 'none') {
    styleObj.cursor = styleObj.cursor || 'pointer';
    if (onClickEv.mode === 'function' && (onClickEv.functionName || onClickEv.functionId)) {
      const fnObj = (projectFunctions || []).find(
        (f) => f.id === onClickEv.functionId || sanitizeFunctionIdentifier(f.name) === sanitizeFunctionIdentifier(onClickEv.functionName)
      );
      const safeName = sanitizeFunctionIdentifier(fnObj?.name || onClickEv.functionName || '');
      if (safeName) onClickAttr = ` data-craft-fn="${escapeHtmlAttr(safeName)}"`;
    } else if ((onClickEv.mode === 'navigate' || onClickEv.mode === 'navigate_page') && (onClickEv.targetTabId || onClickEv.targetPageId)) {
      const targetKey = onClickEv.targetPageId || onClickEv.targetTabId;
      const targetTab = (tabs || []).find((t) => t.id === targetKey || t.route === targetKey);
      const targetRoute = targetTab?.route || onClickEv.targetRoute || targetKey;
      onClickAttr = ` data-craft-nav="${escapeHtmlAttr(targetRoute)}"`;
    } else if ((onClickEv.mode === 'url' || onClickEv.mode === 'navigate_url') && onClickEv.url) {
      onClickAttr = ` data-craft-url="${escapeHtmlAttr(onClickEv.url)}" data-craft-blank="${onClickEv.openInNewTab !== false ? '1' : '0'}"`;
    } else if (onClickEv.mode === 'alert' && onClickEv.message) {
      onClickAttr = ` data-craft-alert="${escapeHtmlAttr(onClickEv.message)}"`;
    } else if (onClickEv.mode === 'scroll_to' && onClickEv.targetElementId) {
      onClickAttr = ` data-craft-scroll="${escapeHtmlAttr(onClickEv.targetElementId)}"`;
    } else if ((onClickEv.mode === 'toggle' || onClickEv.mode === 'toggle_visibility') && (onClickEv.targetId || onClickEv.targetElementId)) {
      onClickAttr = ` data-craft-toggle="${escapeHtmlAttr(onClickEv.targetElementId || onClickEv.targetId)}"`;
    } else if (onClickEv.mode === 'set_text' && onClickEv.targetElementId) {
      onClickAttr = ` data-craft-set-text-target="${escapeHtmlAttr(onClickEv.targetElementId)}" data-craft-set-text-val="${escapeHtmlAttr(onClickEv.newText ?? '')}"`;
    } else if (
      (onClickEv.mode === 'slider_prev' || onClickEv.mode === 'slider_next' || onClickEv.mode === 'slider_goto') &&
      onClickEv.targetElementId
    ) {
      const actionKey = onClickEv.mode.replace('slider_', '');
      onClickAttr = ` data-craft-slider-action="${escapeHtmlAttr(actionKey)}" data-craft-slider-target="${escapeHtmlAttr(onClickEv.targetElementId)}" data-craft-slide-idx="${Number(onClickEv.slideIndex) || 0}"`;
    } else if (onClickEv.mode === 'accordion_toggle' && (onClickEv.targetElementId || node.id)) {
      onClickAttr = ` data-craft-accordion-toggle="${escapeHtmlAttr(onClickEv.targetElementId || node.id)}"`;
    }
  } else if (mappedTag === 'a' && attrs.href && String(attrs.href).startsWith('#/')) {
    onClickAttr = ` data-craft-nav="${escapeHtmlAttr(String(attrs.href).slice(1))}"`;
  }

  const attrStr = Object.entries(attrs)
    .filter(([, val]) => val !== undefined && val !== null && val !== false && val !== '')
    .map(([key, val]) => (val === true ? key : `${key}="${escapeHtmlAttr(val)}"`))
    .join(' ');

  const styleCss = styleObjectToInlineString(styleObj);
  const stylePart = styleCss ? ` style="${escapeHtmlAttr(styleCss)}"` : '';

  if (voidTag) {
    return `<${mappedTag}${attrStr ? ' ' + attrStr : ''}${stylePart}${onClickAttr} />`;
  }

  const rawTextVal = (node.accordionRole === 'indicator' && parentAccordionOpen !== null)
    ? (parentAccordionOpen ? '−' : '+')
    : (node.textContent ?? node.content ?? '');
  const textContent = (rawTag === 'button' && node.sliderRole !== 'dot' && !hasChildren && !rawTextVal) ? 'Buton' : rawTextVal;
  const isRawTextTag = mappedTag === 'textarea' || mappedTag === 'option' || mappedTag === 'title';
  const spanStyleDecl = [
    'width:100%',
    'display:block',
    'white-space:pre-wrap',
    'pointer-events:none',
    'text-align:inherit',
    innerTextPadding ? `padding:${escapeHtmlAttr(innerTextPadding)}` : '',
    innerLineHeight ? `line-height:${escapeHtmlAttr(innerLineHeight)}` : '',
  ].filter(Boolean).join(';');
  const textHtml = textContent
    ? isRawTextTag
      ? escapeHtmlText(textContent)
      : `<span style="${spanStyleDecl};">${escapeHtmlText(textContent)}</span>`
    : (rawTag === 'product_card' || (rawTag === 'article' && node.productName)) && !hasChildren
      ? buildProductCardFallbackHtml(node)
      : '';
  const nextParentWidth = Number(node.width) || parentWidth;
  const nextAccordionOpen = node.accordionRole === 'item' ? (node.accordionOpen !== false) : parentAccordionOpen;
  const childOptions = {
    ...options,
    parentSliderActiveIdx: ownSliderIdx !== null ? ownSliderIdx : parentSliderActiveIdx,
    parentAccordionOpen: nextAccordionOpen,
    parentWidth: nextParentWidth,
  };
  const childrenHtml = hasChildren
    ? validChildren.map((ch) => {
        const childLayoutOverride = accLayout.itemMap ? (accLayout.itemMap.get(ch.id) || null) : null;
        return buildStandaloneNodeHtml(ch, depth + 1, { ...childOptions, accordionLayoutOverride: childLayoutOverride });
      }).join('')
    : '';

  return `<${mappedTag}${attrStr ? ' ' + attrStr : ''}${stylePart}${onClickAttr}>${textHtml}${childrenHtml}</${mappedTag}>`;
}

function buildStandaloneResponsiveCss(flatList, tabScopeSelector, pageCanvasByViewport, tabElements = []) {
  const tabletRules = [];
  const mobileRules = [];
  const rootWidths = {
    desktop: Number(pageCanvasByViewport?.desktop?.width) || 1280,
    tablet: Number(pageCanvasByViewport?.tablet?.width) || 768,
    mobile: Number(pageCanvasByViewport?.mobile?.width) || 375,
  };
  const parentWidthMap = buildParentWidthMap(tabElements, rootWidths);

  if (pageCanvasByViewport?.tablet?.height) {
    tabletRules.push(`${tabScopeSelector} { min-height: ${pageCanvasByViewport.tablet.height}px !important; }`);
  }
  if (pageCanvasByViewport?.mobile?.height) {
    mobileRules.push(`${tabScopeSelector} { min-height: ${pageCanvasByViewport.mobile.height}px !important; }`);
  }

  const pushNodeRules = (node, vp, targetArr) => {
    const ov = node.responsive?.[vp];
    const parentEntry = parentWidthMap.get(node.id);
    const vpParentW = parentEntry?.[vp] || rootWidths[vp];
    const deskParentW = parentEntry?.desktop || rootWidths.desktop;
    const decls = collectResponsiveDeclarations(ov, node, vpParentW, 'flex', deskParentW);
    if (decls.length > 0) {
      targetArr.push(`${tabScopeSelector} [data-craft-id="${node.id}"] { ${decls.join(' ')} }`);
    }
  };

  flatList.forEach((node) => {
    pushNodeRules(node, 'tablet', tabletRules);
    pushNodeRules(node, 'mobile', mobileRules);
  });

  return `${tabletRules.length ? `@media (max-width: 1023px) {\n  ${tabletRules.join('\n  ')}\n}` : ''}
${mobileRules.length ? `@media (max-width: 639px) {\n  ${mobileRules.join('\n  ')}\n}` : ''}`;
}

/**
 * Generates a 100% self-contained, zero-dependency, multi-page, responsive interactive HTML5 site
 * matching the Studio canvas geometry & functions 1:1. Used by Live Preview iframe, Local Live Server, and Web Download.
 */
export function buildStandaloneHtmlSite(input = {}) {
  const {
    projectName = 'CraftStudio Sitesi',
    tabs = [],
    activeTabId = null,
    elements = null,
    canvasSettings = { width: 1280, height: 1350, bgColor: '#ffffff' },
    canvasByViewport = null,
    projectFunctions = [],
  } = input || {};

  const normalizedTabs = normalizePublishTabs({
    tabs,
    activeTabId,
    elements,
    canvasSettings,
    canvasByViewport,
  });

  const initialTab = normalizedTabs.find((t) => t.id === activeTabId) || normalizedTabs[0];
  const initialBg = initialTab.canvasSettings?.bgColor || initialTab.canvasSettings?.backgroundColor || '#ffffff';
  const responsiveCssBlocks = [];
  const pagesHtml = normalizedTabs.map((tab) => {
    const seenHtmlIds = new Set();
    const deskW = Number(tab.canvasSettings?.width) || 1280;
    const baseDeskH = Number(tab.canvasSettings?.height) || 1350;
    const deskH = computeResolvedStageHeight(tab.elements || [], baseDeskH);
    const deskBg = tab.canvasSettings?.bgColor || tab.canvasSettings?.backgroundColor || '#ffffff';
    const tabSelector = `#${tab.domId}`;
    const flatList = flattenTree(tab.elements || []);
    const toggleTargetIds = new Set();
    flatList.forEach((n) => {
      const ev = n?.events?.onClick;
      if ((ev?.mode === 'toggle' || ev?.mode === 'toggle_visibility') && (ev.targetElementId || ev.targetId)) {
        toggleTargetIds.add(ev.targetElementId || ev.targetId);
      }
    });
    const respCss = buildStandaloneResponsiveCss(flatList, `${tabSelector} .craft-stage`, tab.canvasByViewport, tab.elements || []);
    if (respCss.trim()) responsiveCssBlocks.push(respCss);

    const nodesHtml = (tab.elements || [])
      .map((el) =>
        buildStandaloneNodeHtml(el, 0, {
          projectFunctions,
          tabs: normalizedTabs,
          seenHtmlIds,
          parentWidth: deskW,
          toggleTargetIds,
          hasProjectFunctions: (projectFunctions || []).length > 0,
        })
      )
      .join('\n');

    const emptyNotice = flatList.length === 0
      ? '<div style="display:flex;align-items:center;justify-content:center;min-height:420px;color:#64748b;font-size:13px;font-family:Inter,sans-serif;">Bu sayfada henüz bileşen yok.</div>'
      : '';

    const activeCls = tab.id === initialTab.id ? ' is-active' : '';
    return `  <section id="${tab.domId}" data-route="${escapeHtmlAttr(tab.route)}" class="craft-page${activeCls}" style="background:${escapeHtmlAttr(deskBg)};min-height:100vh;">
    <div class="craft-stage" style="position:relative;width:100%;max-width:none;min-height:${deskH}px;margin:0;background:${escapeHtmlAttr(deskBg)};overflow-x:clip;">
${nodesHtml || emptyNotice}
    </div>
  </section>`;
  }).join('\n');

  const compiledFnBlocks = escapeScriptContent(
    (projectFunctions || [])
      .map((fn) => {
        const fnName = sanitizeFunctionIdentifier(fn?.name);
        if (!fnName) return '';
        const fnBody = getEffectiveFunctionCode(fn);
        return `window.__craftFunctions[${JSON.stringify(fnName)}] = function() {\n${fnBody}\n};`;
      })
      .filter(Boolean)
      .join('\n\n')
  );

  const routeMapJson = escapeScriptContent(
    JSON.stringify(
      normalizedTabs.map((t) => ({
        id: t.id,
        route: t.route,
        name: String(t.name || '').replace(/\.craft$/i, ''),
        domId: t.domId,
        bgColor: t.canvasSettings?.bgColor || t.canvasSettings?.backgroundColor || initialBg,
      }))
    )
  );

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlText(projectName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: clip; }
    h1, h2, h3, h4, h5, h6, p, blockquote, figure, pre, dl, dd, ul, ol { margin: 0; padding: 0; }
    ul, ol { list-style: none; }
    img, svg, video, canvas { display: block; max-width: 100%; }
    .craft-page { display: none; width: 100%; }
    .craft-page.is-active { display: block; }
    .craft-toast {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: #18181b; color: #f4f4f5; border: 1px solid rgba(59,130,246,0.55);
      padding: 10px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,0.45); opacity: 0; pointer-events: none;
      transform: translateY(8px); transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .craft-toast.is-open { opacity: 1; transform: translateY(0); }

    @keyframes studioFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes studioSlideUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes studioSlideDown { from { opacity: 0; transform: translateY(-32px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes studioSlideLeft { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes studioSlideRight { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes studioZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    @keyframes studioBounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 0.9; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes studioFloatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes studioPulseGlow { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.3)); } 50% { opacity: 0.85; filter: drop-shadow(0 0 16px rgba(59, 130, 246, 0.75)); } }
    .animate-fade-in { animation: studioFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-slide-up { animation: studioSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-slide-down { animation: studioSlideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-slide-left { animation: studioSlideLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-slide-right { animation: studioSlideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-zoom-in { animation: studioZoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-bounce-in { animation: studioBounceIn 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .animate-float { animation: studioFloatSlow 3.2s ease-in-out infinite; }
    .animate-pulse-glow { animation: studioPulseGlow 2.5s ease-in-out infinite; }

    .hover-underline-center, .hover-underline-left, .hover-underline-right, .hover-underline-slide, .hover-text-fill-bar { position: relative; }
    .hover-underline-center::after, .hover-underline-left::after, .hover-underline-right::after, .hover-underline-slide::after, .hover-text-fill-bar::after {
      content: ''; position: absolute; bottom: -2px; left: 0; width: 100%;
      height: var(--craft-line-height, 2px); background: var(--craft-line-color, #3b82f6);
      transform: scaleX(0); transition: transform var(--craft-line-duration, 0.26s) cubic-bezier(0.22, 1, 0.36, 1), height var(--craft-line-duration, 0.26s) ease, opacity var(--craft-line-duration, 0.26s) ease;
      pointer-events: none;
    }
    .hover-underline-center::after { transform-origin: center; }
    .hover-underline-left::after { transform-origin: left; }
    .hover-underline-right::after { transform-origin: right; }
    .hover-underline-slide::after { transform-origin: right center; }
    .hover-underline-slide:hover::after { transform-origin: left center; transform: scaleX(1); }
    .hover-underline-center:hover::after, .hover-underline-left:hover::after, .hover-underline-right:hover::after { transform: scaleX(1); }
    .hover-text-fill-bar::after { bottom: -1px; opacity: 0.2; transform: scaleX(1); }
    .hover-text-fill-bar:hover::after { height: 6px; opacity: 0.45; }
    .hover-text-fill-bar:hover { transform: translateY(-2px); }
    .hover-lift, .hover\\:-translate-y-1 { transition: transform 0.22s ease, box-shadow 0.22s ease; }
    .hover-lift:hover { transform: translateY(-3px); }
    .hover\\:-translate-y-1:hover { transform: translateY(-4px); }
    .hover\\:scale-105 { transition: transform 0.22s ease; }
    .hover\\:scale-105:hover { transform: scale(1.05); }
    .hover\\:rotate-1 { transition: transform 0.22s ease; }
    .hover\\:rotate-1:hover { transform: rotate(2deg); }
    .hover\\:shadow-lg:hover { box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32) !important; }
    .hover-glow { transition: box-shadow 0.22s ease, filter 0.22s ease; }
    .hover-glow:hover { filter: brightness(1.08); box-shadow: 0 0 18px rgba(59,130,246,0.35); }
    .transition-transform { transition: transform 0.2s ease; }
    .transition-shadow { transition: box-shadow 0.2s ease; }
    .duration-200 { transition-duration: 0.2s; }
    .is-slide-hidden { display: none !important; }
    [data-craft-slider-dot] { transition: transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease; opacity: 0.45; }
    [data-craft-slider-dot].is-active-dot { opacity: 1 !important; transform: scale(1.22); }
    ${responsiveCssBlocks.join('\n    ')}
  </style>
</head>
<body style="margin:0;padding:0;background:${escapeHtmlAttr(initialBg)};">
${pagesHtml}
  <div id="craft-toast" class="craft-toast"></div>
  <script>
    (function() {
      var routes = ${routeMapJson};
      var toastTimer = null;
      window.__craftFunctions = window.__craftFunctions || {};

      function findEl(idOrSelector) {
        if (!idOrSelector) return null;
        return document.getElementById(idOrSelector)
          || document.querySelector('[data-craft-id="' + idOrSelector + '"]')
          || (String(idOrSelector).startsWith('#') || String(idOrSelector).startsWith('.') ? document.querySelector(idOrSelector) : null);
      }
      function getValue(id) {
        var el = findEl(id);
        if (!el) return '';
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return el.value;
        return el.textContent || '';
      }
      function setValue(id, val) {
        var el = findEl(id);
        if (!el) return;
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) el.value = String(val ?? '');
        else el.textContent = String(val ?? '');
      }
      function setText(id, val) {
        var el = findEl(id);
        if (!el) return;
        var innerSpan = el.querySelector('span');
        if (innerSpan && el.children.length === 1) innerSpan.textContent = String(val ?? '');
        else el.textContent = String(val ?? '');
      }
      function setStyle(id, prop, val) {
        var el = findEl(id);
        if (el && prop) el.style[prop] = val;
      }
      function showElement(id) {
        var el = findEl(id);
        if (el) el.style.display = el.dataset.prevDisplay || 'flex';
      }
      function hideElement(id) {
        var el = findEl(id);
        if (el) {
          if (el.style.display && el.style.display !== 'none') el.dataset.prevDisplay = el.style.display;
          el.style.display = 'none';
        }
      }
      function toggleVisible(id) {
        var el = findEl(id);
        if (!el) return;
        if (getComputedStyle(el).display === 'none') showElement(id);
        else hideElement(id);
      }
      function addClass(id, cls) {
        var el = findEl(id);
        if (el && cls) el.classList.add(cls);
      }
      function removeClass(id, cls) {
        var el = findEl(id);
        if (el && cls) el.classList.remove(cls);
      }
      function notify(msg) {
        var toast = document.getElementById('craft-toast');
        if (!toast) return;
        toast.textContent = String(msg ?? '');
        toast.classList.add('is-open');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() { toast.classList.remove('is-open'); }, 3200);
      }
      var alert = notify;
      function goToPage(routeOrTabId) {
        var norm = String(routeOrTabId || '/').trim();
        var normLower = norm.toLowerCase();
        var strippedLower = normLower.replace(/^\\//, '').replace(/\\.craft$/i, '');
        var found = routes.find(function(r) {
          return (
            r.route === norm ||
            r.id === norm ||
            String(r.route || '').toLowerCase() === normLower ||
            String(r.name || '').toLowerCase() === normLower ||
            String(r.name || '').toLowerCase() === strippedLower
          );
        });
        if (!found) {
          notify('Sayfa bulunamadı: ' + norm);
          return;
        }
        document.querySelectorAll('.craft-page').forEach(function(sec) {
          sec.classList.toggle('is-active', sec.id === found.domId);
        });
        if (found.bgColor) document.body.style.background = found.bgColor;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'craft-active-page', route: found.route, id: found.id, name: found.name }, '*');
          }
        } catch (err) {}
      }
      function switchSlider(targetRef, action, gotoIdx) {
        var root = findEl(targetRef);
        if (!root) return;
        var slides = Array.from(root.querySelectorAll('[data-craft-slide-index]'));
        var total = Math.max(1, slides.length);
        var cur = Number(root.getAttribute('data-craft-active-slide') || 0);
        var next = 0;
        if (action === 'prev') next = (cur - 1 + total) % total;
        else if (action === 'goto') next = ((Number(gotoIdx) || 0) % total + total) % total;
        else next = (cur + 1) % total;
        root.setAttribute('data-craft-active-slide', String(next));
        slides.forEach(function(slideEl) {
          var sIdx = Number(slideEl.getAttribute('data-craft-slide-index') || 0);
          slideEl.classList.toggle('is-slide-hidden', sIdx !== next);
        });
        Array.from(root.querySelectorAll('[data-craft-slider-dot]')).forEach(function(dotEl) {
          var dIdx = Number(dotEl.getAttribute('data-craft-slider-dot') || 0);
          dotEl.classList.toggle('is-active-dot', dIdx === next);
        });
      }
      function toggleAccordion(targetRef) {
${buildAccordionToggleBody('findEl')}
      }

      ${compiledFnBlocks}

      document.addEventListener('click', function(e) {
        var target = e.target && e.target.closest ? e.target.closest('[data-craft-fn],[data-craft-nav],[data-craft-url],[data-craft-alert],[data-craft-toggle],[data-craft-scroll],[data-craft-set-text-target],[data-craft-slider-action],[data-craft-accordion-toggle]') : null;
        if (!target) return;
        var fnName = target.getAttribute('data-craft-fn');
        if (fnName) {
          e.preventDefault();
          var fn = window.__craftFunctions[fnName];
          if (typeof fn === 'function') {
            try { fn(); } catch (err) { notify('Fonksiyon hatası (' + fnName + '): ' + err.message); }
          }
          return;
        }
        var accordionTarget = target.getAttribute('data-craft-accordion-toggle');
        if (accordionTarget) {
          e.preventDefault();
          toggleAccordion(accordionTarget);
          return;
        }
        var sliderAction = target.getAttribute('data-craft-slider-action');
        if (sliderAction) {
          e.preventDefault();
          switchSlider(
            target.getAttribute('data-craft-slider-target'),
            sliderAction,
            target.getAttribute('data-craft-slide-idx')
          );
          return;
        }
        var navRoute = target.getAttribute('data-craft-nav');
        if (navRoute) {
          e.preventDefault();
          goToPage(navRoute);
          return;
        }
        var scrollTarget = target.getAttribute('data-craft-scroll');
        if (scrollTarget) {
          e.preventDefault();
          var sEl = findEl(scrollTarget);
          if (sEl) sEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        var url = target.getAttribute('data-craft-url');
        if (url) {
          e.preventDefault();
          var blank = target.getAttribute('data-craft-blank') !== '0';
          if (blank) window.open(url, '_blank', 'noopener,noreferrer');
          else window.location.href = url;
          return;
        }
        var alertMsg = target.getAttribute('data-craft-alert');
        if (alertMsg) {
          e.preventDefault();
          notify(alertMsg);
          return;
        }
        var setTextTarget = target.getAttribute('data-craft-set-text-target');
        if (setTextTarget) {
          e.preventDefault();
          setText(setTextTarget, target.getAttribute('data-craft-set-text-val') || '');
          return;
        }
        var toggleId = target.getAttribute('data-craft-toggle');
        if (toggleId) {
          e.preventDefault();
          toggleVisible(toggleId);
        }
      });

      window.addEventListener('message', function(evt) {
        if (evt && evt.data && evt.data.type === 'craft-goto-page' && evt.data.target) {
          goToPage(evt.data.target);
        }
      });
    })();
  </script>
</body>
</html>`;
}

