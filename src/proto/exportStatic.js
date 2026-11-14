import { renderToStaticMarkup } from 'react-dom/server';
import { compileStyles } from './compileStyles.js';
import { renderTree } from './renderTreeCore.js';
import { ensureUniqueSlug, isProject, slugifyTitle } from './project.js';
import {
  isFixedPxLength,
  parsePageHref,
  sanitizeNode,
  sanitizePlainText,
  validateButtonHref,
  validateImageSrc,
} from './schema.js';

/**
 * Tek kaynaklı statik site dışa aktarma modülü (React/Node uyumlu).
 * - HTML gövdesini `renderToStaticMarkup(renderTree(tree, { mode: 'publish' }))` ile üretir.
 * - CSS'i doğrudan `compileStyles(tree)` çıktısından alır (editör-only kural yoktur).
 * - Yayın çıktısında hiç `<script>` etiketi üretmez.
 */

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

export function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sanitizeDocumentMeta(options = {}) {
  const {
    title = 'CraftStudio Sitesi',
    lang = 'tr',
    description = 'CraftStudio ile oluşturulan modern duyarlı web sitesi.',
  } = options || {};

  const safeTitle = sanitizePlainText(title || 'CraftStudio Sitesi', 160).trim() || 'CraftStudio Sitesi';
  const safeLang =
    String(lang || 'tr')
      .trim()
      .replace(/[^a-zA-Z-]/g, '')
      .slice(0, 12) || 'tr';
  const safeDescription = sanitizePlainText(description || '', 300).trim();

  return { safeTitle, safeLang, safeDescription };
}

export function collectExportWarnings(rawNode, sanitizedNode, warnings, options = {}) {
  if (!rawNode || typeof rawNode !== 'object') return;

  if (rawNode.type === 'image') {
    const rawSrc = rawNode.props?.src;
    if (typeof rawSrc === 'string' && rawSrc.trim()) {
      const check = validateImageSrc(rawSrc);
      if (!check.ok) {
        warnings.push(
          `Görsel '${rawNode.id}' desteklenmeyen veya yerel kaynak ('${sanitizePlainText(
            rawSrc,
            80
          )}') içeriyor; güvenlik nedeniyle atlandı.`
        );
      }
    }
  }

  if (rawNode.type === 'button' && rawNode.props?.href !== undefined && rawNode.props.href !== '') {
    const brokenPageId = parsePageHref(rawNode.props.href);
    if (brokenPageId) {
      const hrefCheck = validateButtonHref(rawNode.props.href, {
        validPageIds: options?.validPageIds,
      });
      if (!hrefCheck.ok) {
        warnings.push(
          `Düğüm '${rawNode.id}': silinen veya geçersiz sayfa bağlantısı ('page:${brokenPageId}') '#' olarak değiştirildi.`
        );
      }
    }
  }

  if (rawNode.placement !== 'layer') {
    const hBase = rawNode.size?.h;
    if (hBase !== undefined && isFixedPxLength(hBase)) {
      warnings.push(
        `Düğüm '${rawNode.id}' akış içinde sabit piksel yükseklik (height:${hBase}) tanımlıyor.`
      );
    }
    for (const bp of ['md', 'sm']) {
      const hBp = rawNode.responsive?.[bp]?.size?.h;
      if (hBp !== undefined && isFixedPxLength(hBp)) {
        warnings.push(
          `Düğüm '${rawNode.id}' (${bp}) sabit piksel yükseklik (height:${hBp}) tanımlıyor.`
        );
      }
    }
  }

  // Temizlenen düğüm ile ham düğüm arasında fark yoksa çocuklara geç
  if (Array.isArray(rawNode.children)) {
    const cleanKids = Array.isArray(sanitizedNode?.children) ? sanitizedNode.children : [];
    for (let i = 0; i < rawNode.children.length; i += 1) {
      collectExportWarnings(rawNode.children[i], cleanKids[i], warnings, options);
    }
  }
}

export function normalizeExportPages(input, baseTitle = 'CraftStudio Sitesi') {
  if (!isProject(input)) {
    return {
      isMultiPage: false,
      theme: input?.props?.theme || null,
      pages: [
        {
          id: input?.id || 'page-home',
          safeSlug: 'index',
          fileName: 'index.html',
          hashRoute: '#/',
          safeTitle: sanitizeDocumentMeta({ title: baseTitle }).safeTitle,
          rawTree: input,
        },
      ],
      validPageIds: new Set(input?.id ? [input.id] : []),
    };
  }

  const usedSlugs = new Set(['index']);
  let homeAssigned = false;
  const pages = [];
  const validPageIds = new Set();

  for (let i = 0; i < input.pages.length; i += 1) {
    const p = input.pages[i];
    if (!p || !p.tree) continue;
    const isHome = Boolean(p.isHome) && !homeAssigned;
    if (isHome) homeAssigned = true;

    // Slug yol kaçışına (../, /) veya XSS'e karşı her zaman ASCII güvenilir üretilir
    const safeSlug = isHome
      ? 'index'
      : ensureUniqueSlug(slugifyTitle(p.slug || p.title || `sayfa-${i + 1}`, 'sayfa'), usedSlugs, false);
    if (!isHome) usedSlugs.add(safeSlug);

    const safeTitle = sanitizeDocumentMeta({ title: p.title || baseTitle }).safeTitle;
    if (p.id) validPageIds.add(p.id);
    pages.push({
      id: p.id || `page-${i + 1}`,
      safeSlug,
      fileName: isHome ? 'index.html' : `${safeSlug}.html`,
      hashRoute: isHome ? '#/' : `#/${safeSlug}`,
      safeTitle,
      isHome,
      rawTree: p.tree,
    });
  }

  // Güvenlik: hiç isHome yoksa ilk sayfayı index.html yap
  if (pages.length > 0 && !homeAssigned) {
    pages[0].safeSlug = 'index';
    pages[0].fileName = 'index.html';
    pages[0].hashRoute = '#/';
    pages[0].isHome = true;
  }

  return {
    isMultiPage: true,
    theme: input.theme || null,
    pages,
    validPageIds,
  };
}

function buildHtmlDocument({ safeLang, safeTitle, safeDescription, styleBlock, bodyHtml }) {
  const metaDescTag = safeDescription
    ? `\n    <meta name="description" content="${escapeHtmlAttr(safeDescription)}" />`
    : '';

  return [
    '<!doctype html>',
    `<html lang="${escapeHtmlAttr(safeLang)}">`,
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escapeHtmlText(safeTitle)}</title>${metaDescTag}`,
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `    <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />`,
    `    ${styleBlock}`,
    '  </head>',
    '  <body>',
    `    ${bodyHtml}`,
    '  </body>',
    '</html>',
  ].join('\n');
}

/**
 * Tek ağaçtan veya çoklu sayfa projesinden tek kaynaklı statik HTML + ortak `styles.css` üretir.
 */
export function exportStatic(treeOrProject, options = {}) {
  const { inlineCss = false, targetPageId = null } = options || {};
  const { safeTitle, safeLang, safeDescription } = sanitizeDocumentMeta(options);
  const warnings = [];

  const ctx = normalizeExportPages(treeOrProject, safeTitle);
  const sanitizedPages = ctx.pages.map((p) => {
    const cleanTree = sanitizeNode(p.rawTree);
    collectExportWarnings(p.rawTree, cleanTree, warnings, {
      validPageIds: ctx.validPageIds,
    });
    return { ...p, cleanTree };
  });

  const compileInput = ctx.isMultiPage
    ? {
        schemaVersion: 2,
        theme: ctx.theme,
        pages: sanitizedPages.map((p) => ({
          id: p.id,
          slug: p.safeSlug,
          title: p.safeTitle,
          isHome: p.isHome,
          tree: p.cleanTree,
        })),
      }
    : sanitizedPages[0]?.cleanTree;

  const stylesCss = compileStyles(compileInput, { includeBase: true });
  const styleBlock = inlineCss
    ? `<style>${stylesCss.replace(/<\/style/gi, '<\\/style')}</style>`
    : '<link rel="stylesheet" href="styles.css" />';

  const linkMap = {};
  for (const p of sanitizedPages) {
    linkMap[p.id] = p.fileName;
  }

  const files = {};
  const pagesToRender =
    targetPageId && ctx.isMultiPage
      ? sanitizedPages.filter((p) => p.id === targetPageId)
      : sanitizedPages;

  for (const p of pagesToRender) {
    const bodyHtml = p.cleanTree
      ? renderToStaticMarkup(
          renderTree(p.cleanTree, { mode: 'publish', linkMap: ctx.isMultiPage ? linkMap : null })
        )
      : '';
    const htmlStr = buildHtmlDocument({
      safeLang,
      safeTitle: ctx.isMultiPage ? p.safeTitle : safeTitle,
      safeDescription,
      styleBlock,
      bodyHtml,
    });
    files[p.fileName] = htmlStr;
    if (targetPageId && ctx.isMultiPage) {
      // Tekil sayfa önizleme çağrısında index.html anahtarı üzerinden kolay okuma
      files['index.html'] = htmlStr;
    }
  }

  files['styles.css'] = stylesCss;

  return {
    files,
    warnings,
  };
}

export default exportStatic;
