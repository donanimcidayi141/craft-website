import { compileStyles } from './compileStyles.js';
import {
  GOOGLE_FONTS_HREF,
  collectExportWarnings,
  escapeHtmlAttr,
  escapeHtmlText,
  normalizeExportPages,
  sanitizeDocumentMeta,
} from './exportStatic.js';
import { resolvePublishedHref, resolveTextTag } from './renderTreeCore.js';
import { sanitizeNode, sanitizePlainText, validateImageSrc } from './schema.js';

/**
 * Tek kaynaklı React + Vite proje dışa aktarma modülü.
 * - `src/styles.css` doğrudan `compileStyles(tree)` çıktısıdır.
 * - `src/App.jsx` yalnızca `.n-<id>` ve semantik JSX etiketleri üretir (editör izi yoktur).
 * - Hiç `dangerouslySetInnerHTML`, `data-node-id` veya inline `<script>` üretmez.
 */

const SAFE_JSX_ATTR_RE = /^[a-zA-Z0-9_.:/?#&=+% -]*$/;
const SAFE_JSX_TEXT_RE = /^[^<>{}&\r\n]+$/;

function formatJsxAttr(name, value) {
  const str = String(value ?? '');
  if (SAFE_JSX_ATTR_RE.test(str)) {
    return `${name}="${str}"`;
  }
  return `${name}={${JSON.stringify(str)}}`;
}

function formatJsxText(value) {
  const str = String(value ?? '');
  if (str.length > 0 && SAFE_JSX_TEXT_RE.test(str) && str.trim() === str) {
    return str;
  }
  return `{${JSON.stringify(str)}}`;
}

function serializeChildren(children, indentLevel, linkMap) {
  if (!Array.isArray(children) || children.length === 0) return [];
  return children
    .map((child) => serializeNodeToJsx(child, indentLevel, linkMap))
    .filter(Boolean);
}

function serializeElement(tag, attrs, childLines, indentLevel, textChild = null) {
  const pad = '  '.repeat(indentLevel);
  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

  if (textChild !== null) {
    return `${pad}<${tag}${attrStr}>${formatJsxText(textChild)}</${tag}>`;
  }
  if (!childLines || childLines.length === 0) {
    return `${pad}<${tag}${attrStr} />`;
  }
  return `${pad}<${tag}${attrStr}>\n${childLines.join('\n')}\n${pad}</${tag}>`;
}

function serializeNodeToJsx(node, indentLevel = 2, linkMap = null) {
  if (!node || !node.id) return '';

  const props = node.props || {};
  const classAttr = formatJsxAttr('className', `n-${node.id}`);

  switch (node.type) {
    case 'page': {
      const children = serializeChildren(node.children, indentLevel + 1, linkMap);
      return serializeElement('main', [classAttr], children, indentLevel);
    }

    case 'section': {
      const children = serializeChildren(node.children, indentLevel + 1, linkMap);
      return serializeElement('section', [classAttr], children, indentLevel);
    }

    case 'container': {
      const children = serializeChildren(node.children, indentLevel + 1, linkMap);
      return serializeElement('div', [classAttr], children, indentLevel);
    }

    case 'text': {
      const tag = resolveTextTag(props);
      if (props.text !== undefined) {
        const content = sanitizePlainText(props.text, 2000);
        return serializeElement(tag, [classAttr], null, indentLevel, content);
      }
      const children = serializeChildren(node.children, indentLevel + 1, linkMap);
      return serializeElement(tag, [classAttr], children, indentLevel);
    }

    case 'button': {
      const safeLabel = sanitizePlainText(props.label || props.text || 'Buton', 300);
      if (props.href !== undefined && props.href !== '') {
        const safeHref = resolvePublishedHref(props.href, 'publish', linkMap);
        return serializeElement(
          'a',
          [classAttr, formatJsxAttr('href', safeHref)],
          null,
          indentLevel,
          safeLabel
        );
      }
      return serializeElement(
        'button',
        [classAttr, 'type="button"'],
        null,
        indentLevel,
        safeLabel
      );
    }

    case 'image': {
      const srcRes = validateImageSrc(props.src);
      const safeSrc = srcRes.ok ? srcRes.value : '';
      const safeAlt = sanitizePlainText(props.alt || '', 500);
      const imgAttrs = [classAttr];
      if (safeSrc) {
        imgAttrs.push(formatJsxAttr('src', safeSrc));
      }
      imgAttrs.push(formatJsxAttr('alt', safeAlt), 'loading="lazy"');
      return serializeElement('img', imgAttrs, null, indentLevel);
    }

    case 'blob':
      return serializeElement('div', [classAttr, 'aria-hidden="true"'], null, indentLevel);

    default: {
      const children = serializeChildren(node.children, indentLevel + 1, linkMap);
      return serializeElement('div', [classAttr], children, indentLevel);
    }
  }
}

function buildSinglePageComponent(fnName, sanitizedTree, linkMap = null) {
  let bodyJsx = '    <main />';
  if (Array.isArray(sanitizedTree)) {
    const items = sanitizedTree.map((n) => serializeNodeToJsx(n, 3, linkMap)).filter(Boolean);
    bodyJsx = items.length > 0 ? `    <>\n${items.join('\n')}\n    </>` : '    <main />';
  } else if (sanitizedTree) {
    bodyJsx = serializeNodeToJsx(sanitizedTree, 2, linkMap) || '    <main />';
  }

  return [
    "import React from 'react';",
    '',
    `export default function ${fnName}() {`,
    '  return (',
    bodyJsx,
    '  );',
    '}',
    '',
  ].join('\n');
}

function buildMultiPageRouterAppJsx(pageEntries) {
  const imports = pageEntries.map(
    (entry) => `import ${entry.componentName} from './pages/${entry.fileBase}.jsx';`
  );
  const routeLines = pageEntries.map(
    (entry) =>
      `  { route: ${JSON.stringify(entry.hashRoute)}, title: ${JSON.stringify(
        entry.safeTitle
      )}, isHome: ${entry.isHome ? 'true' : 'false'}, Component: ${entry.componentName} },`
  );

  return [
    "import React, { useEffect, useState } from 'react';",
    ...imports,
    '',
    'const ROUTES = [',
    ...routeLines,
    '];',
    '',
    'function normalizeHash(rawHash) {',
    "  const h = String(rawHash || '').trim();",
    "  if (!h || h === '#' || h === '#/') return '#/';",
    "  return h.startsWith('#/') ? h : `#/${h.replace(/^#+\\/*/, '')}`;",
    '}',
    '',
    'function resolveRoute(hashVal) {',
    '  const normalized = normalizeHash(hashVal);',
    '  return ROUTES.find((r) => r.route === normalized) || ROUTES.find((r) => r.isHome) || ROUTES[0];',
    '}',
    '',
    'export default function App() {',
    "  const [currentHash, setCurrentHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : '#/'));",
    '',
    '  useEffect(() => {',
    '    const onHashChange = () => {',
    '      setCurrentHash(window.location.hash);',
    '      window.scrollTo(0, 0);',
    '    };',
    "    window.addEventListener('hashchange', onHashChange);",
    "    return () => window.removeEventListener('hashchange', onHashChange);",
    '  }, []);',
    '',
    '  const activeRoute = resolveRoute(currentHash);',
    '  const PageComponent = activeRoute.Component;',
    '',
    '  useEffect(() => {',
    "    if (typeof document !== 'undefined' && activeRoute?.title) {",
    '      document.title = activeRoute.title;',
    '    }',
    '  }, [activeRoute]);',
    '',
    '  return <PageComponent />;',
    '}',
    '',
  ].join('\n');
}

/**
 * Tek ağaçtan veya çoklu sayfa projesinden tek kaynaklı React + Vite projesi üretir.
 * @param {object|Array} treeOrProject
 * @param {{ title?: string, lang?: string, description?: string }} [options]
 */
export function exportReact(treeOrProject, options = {}) {
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

  const linkMap = {};
  for (const p of sanitizedPages) {
    linkMap[p.id] = p.hashRoute;
  }

  const pageFiles = {};
  let appJsx;
  let htmlTitle = safeTitle;

  if (!ctx.isMultiPage) {
    appJsx = buildSinglePageComponent('App', sanitizedPages[0]?.cleanTree, null);
  } else {
    const pageEntries = sanitizedPages.map((p, idx) => {
      const componentName = `Page${idx}`;
      const slugPart = String(p.safeSlug || `sayfa-${idx}`).replace(/[^a-z0-9_-]/g, '-');
      const fileBase = `page-${idx}-${slugPart}`;
      pageFiles[`src/pages/${fileBase}.jsx`] = buildSinglePageComponent(
        componentName,
        p.cleanTree,
        linkMap
      );
      return {
        ...p,
        componentName,
        fileBase,
      };
    });
    appJsx = buildMultiPageRouterAppJsx(pageEntries);
    const home = pageEntries.find((e) => e.isHome) || pageEntries[0];
    if (home?.safeTitle) htmlTitle = home.safeTitle;
  }

  const packageJson = JSON.stringify(
    {
      name: 'craftstudio-site',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^6.1.0',
      },
    },
    null,
    2
  );

  const viteConfigJs = [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    '',
    'export default defineConfig({',
    '  plugins: [react()],',
    '});',
    '',
  ].join('\n');

  const metaDescTag = safeDescription
    ? `\n    <meta name="description" content="${escapeHtmlAttr(safeDescription)}" />`
    : '';

  const indexHtml = [
    '<!doctype html>',
    `<html lang="${escapeHtmlAttr(safeLang)}">`,
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escapeHtmlText(htmlTitle)}</title>${metaDescTag}`,
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `    <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />`,
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.jsx"></script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  const mainJsx = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import App from './App.jsx';",
    "import './styles.css';",
    '',
    "ReactDOM.createRoot(document.getElementById('root')).render(",
    '  <React.StrictMode>',
    '    <App />',
    '  </React.StrictMode>',
    ');',
    '',
  ].join('\n');

  return {
    files: {
      'package.json': `${packageJson}\n`,
      'vite.config.js': viteConfigJs,
      'index.html': indexHtml,
      'src/main.jsx': mainJsx,
      'src/App.jsx': appJsx,
      ...pageFiles,
      'src/styles.css': stylesCss,
    },
    warnings,
  };
}

export default exportReact;
