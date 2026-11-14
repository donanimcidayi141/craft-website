const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ELECTRON_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_TOTAL_BYTES: 20 * 1024 * 1024,
  MAX_FILE_COUNT: 200,
  MAX_FOLDER_DEPTH: 8,
  EXTRACT_TIMEOUT_MS: 5000,
};

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'frame', 'frameset', 'applet', 'base',
]);

function isUnsafeUrl(val) {
  if (typeof val !== 'string') return false;
  const compact = val.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
  return (
    compact.startsWith('javascript:')
    || compact.startsWith('vbscript:')
    || compact.startsWith('data:text/html')
  );
}

function stripBomAndReadUtf8(filePath) {
  const buf = fs.readFileSync(filePath);
  const view = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    ? buf.subarray(3)
    : buf;
  return view.toString('utf8').replace(/^\uFEFF/, '');
}

function sanitizeNodeTree(nodes = [], stats = null) {
  const out = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const tag = String(node.type || 'div').toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) {
      if (stats) {
        if (tag === 'script') stats.removedScripts += 1;
        else stats.removedEmbeds += 1;
      }
      continue;
    }
    const cleanAttrs = {};
    for (const [k, v] of Object.entries(node.attrs || {})) {
      const lk = k.toLowerCase();
      if (/^on[a-z]/i.test(k) || lk === 'srcdoc') {
        if (stats) stats.removedEventAttrs += 1;
        continue;
      }
      if (typeof v === 'string' && isUnsafeUrl(v)) {
        if (stats) stats.removedJsUrls += 1;
        continue;
      }
      cleanAttrs[k] = v;
    }
    const nextNode = { ...node, attrs: cleanAttrs };
    if (typeof nextNode.imageUrl === 'string' && isUnsafeUrl(nextNode.imageUrl)) {
      if (stats) stats.removedJsUrls += 1;
      delete nextNode.imageUrl;
    }
    if (Array.isArray(nextNode.children)) {
      nextNode.children = sanitizeNodeTree(nextNode.children, stats);
    }
    out.push(nextNode);
  }
  return out;
}

/**
 * 🌟 CRAFT PROJECT SCHEMA EXPORTER
 * Generates craft.project.json for lossless re-import.
 */
function createCraftProjectSchema(options = {}) {
  const {
    id = undefined,
    name = 'CraftStudio Projesi',
    canvasSettings = { width: 1280, height: 1350, backgroundColor: '#0f172a' },
    canvasByViewport = null,
    viewportMode = 'desktop',
    initializedViewports = { desktop: true, tablet: false, mobile: false },
    tabs = [],
    activeTabId = 'tab-1',
    projectFunctions = [],
    pageLinks = [],
    createdAt = undefined,
  } = options;

  return {
    schemaVersion: '1.1.0',
    studio: 'CraftStudio',
    generator: 'CraftStudio v2.0 Native Importer/Exporter',
    ...(id ? { id } : {}),
    name,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvasSettings,
    canvasByViewport: canvasByViewport || undefined,
    viewportMode,
    initializedViewports,
    activeTabId,
    tabs: tabs.map(tab => ({
      id: tab.id,
      name: tab.name,
      route: tab.route || (tab.id === 'tab-1' ? '/' : `/${tab.name.replace(/\.craft$/, '').toLowerCase()}`),
      elements: tab.elements || [],
      canvasSettings: tab.canvasSettings || undefined,
      canvasByViewport: tab.canvasByViewport || undefined,
      initializedViewports: tab.initializedViewports || undefined,
    })),
    projectFunctions: projectFunctions || [],
    pageLinks: pageLinks || []
  };
}

/**
 * Klasörü dosya sayısı (200), klasör derinliği (8) ve boyut sınırlarına (5 MB / 20 MB) göre tarar.
 */
function scanDirectoryWithLimits(rootDir) {
  const results = [];
  const skipped = [];
  const warnings = [];
  let totalBytes = 0;
  let stoppedForLimit = false;
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vscode', '.idea']);

  const walk = (dir, currentDepth) => {
    if (!fs.existsSync(dir)) return;
    let list;
    try {
      list = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      console.warn('Klasör okunamadı:', dir, err.message);
      return;
    }

    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (item.isDirectory()) {
        if (ignoreDirs.has(item.name) || item.name.startsWith('.')) continue;
        if (currentDepth + 1 > ELECTRON_LIMITS.MAX_FOLDER_DEPTH) {
          skipped.push({ name: relPath, reason: `Klasör derinliği sınırı aşıldı (en fazla ${ELECTRON_LIMITS.MAX_FOLDER_DEPTH}).` });
          continue;
        }
        walk(fullPath, currentDepth + 1);
      } else if (item.isFile()) {
        if (results.length >= ELECTRON_LIMITS.MAX_FILE_COUNT) {
          skipped.push({ name: relPath, reason: `Maksimum dosya sınırı aşıldı (en fazla ${ELECTRON_LIMITS.MAX_FILE_COUNT}).` });
          if (!stoppedForLimit) {
            warnings.push(`En fazla ${ELECTRON_LIMITS.MAX_FILE_COUNT} dosya sınırı aşıldığı için fazla dosyalar atlandı.`);
            stoppedForLimit = true;
          }
          continue;
        }
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          skipped.push({ name: relPath, reason: 'Dosya okunamadı.' });
          continue;
        }
        if (stat.size > ELECTRON_LIMITS.MAX_FILE_BYTES) {
          skipped.push({ name: relPath, reason: 'Dosya çok büyük (en fazla 5 MB).' });
          warnings.push(`${item.name}: Dosya çok büyük (en fazla 5 MB) olduğu için atlandı.`);
          continue;
        }
        if (totalBytes + stat.size > ELECTRON_LIMITS.MAX_TOTAL_BYTES) {
          skipped.push({ name: relPath, reason: 'Toplam 20 MB içe aktarma sınırı aşıldı.' });
          warnings.push('Toplam 20 MB boyut sınırı aşıldığı için kalan dosyalar atlandı.');
          continue;
        }
        const lowerName = item.name.toLowerCase();
        const ext = lowerName.endsWith('.craft.json') ? '.craft.json' : path.extname(lowerName);
        totalBytes += stat.size;
        results.push({ fullPath, relPath, name: item.name, ext, size: stat.size });
      }
    }
  };

  walk(rootDir, 0);
  return { entries: results, skipped, warnings, totalBytes };
}

/**
 * 🌟 EXTRACT COMPUTED STYLES & LAYOUT FROM HTML FILE IN ISOLATED HIDDEN WINDOW
 * İçe aktarılan koddaki betikler ASLA çalıştırılmaz (javascript: false).
 */
async function extractStylesFromHtmlFile(htmlFilePath, stats = null) {
  if (typeof BrowserWindow !== 'function') {
    throw new Error('BrowserWindow ortamı kullanılabilir değil.');
  }
  const worker = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  });

  try {
    await Promise.race([
      worker.loadFile(htmlFilePath),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Zaman aşımı')), ELECTRON_LIMITS.EXTRACT_TIMEOUT_MS)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const extracted = await Promise.race([
      worker.webContents.executeJavaScript(`
      (() => {
        const DANGEROUS = new Set(['script', 'iframe', 'object', 'embed', 'frame', 'frameset', 'applet', 'base']);
        const statsDelta = { removedScripts: 0, removedEventAttrs: 0, removedJsUrls: 0, removedEmbeds: 0 };
        statsDelta.removedScripts = document.querySelectorAll('script').length;
        statsDelta.removedEmbeds = document.querySelectorAll('iframe,object,embed,frame,frameset,applet').length;

        function rgbToHex(rgb) {
          if (!rgb || rgb === 'transparent') return 'transparent';
          const match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
          if (!match) return rgb;
          const r = parseInt(match[1]).toString(16).padStart(2, '0');
          const g = parseInt(match[2]).toString(16).padStart(2, '0');
          const b = parseInt(match[3]).toString(16).padStart(2, '0');
          if (match[4] !== undefined && parseFloat(match[4]) < 1) {
            return rgb;
          }
          return '#' + r + g + b;
        }

        function isBadUrl(v) {
          const c = String(v || '').replace(/[\\u0000-\\u001f\\s]+/g, '').toLowerCase();
          return c.startsWith('javascript:') || c.startsWith('vbscript:') || c.startsWith('data:text/html');
        }

        let elemCounter = 1;
        const pageLinks = [];

        function extractElement(el, parentRect = null) {
          if (el.nodeType !== Node.ELEMENT_NODE) return null;
          const tag = el.tagName.toLowerCase();
          if (DANGEROUS.has(tag) || ['style', 'noscript', 'meta', 'link', 'title', 'template'].includes(tag)) return null;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0 && el.children.length === 0) return null;

          const style = window.getComputedStyle(el);

          const relX = parentRect ? Math.round(rect.left - parentRect.left) : Math.round(rect.left);
          const relY = parentRect ? Math.round(rect.top - parentRect.top) : Math.round(rect.top);

          const attrs = {};
          for (const attr of el.attributes) {
            const lk = attr.name.toLowerCase();
            if (/^on[a-z]/i.test(attr.name) || lk === 'srcdoc') {
              statsDelta.removedEventAttrs += 1;
              continue;
            }
            if ((lk === 'href' || lk === 'src' || lk === 'action' || lk === 'data' || lk === 'formaction') && isBadUrl(attr.value)) {
              statsDelta.removedJsUrls += 1;
              continue;
            }
            attrs[attr.name] = attr.value;
          }

          if (tag === 'a' && attrs.href) {
            pageLinks.push({
              href: attrs.href,
              text: el.innerText?.trim() || 'Bağlantı'
            });
          }

          let directText = '';
          for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              directText += child.textContent;
            }
          }
          directText = directText.trim();

          const cleanStyle = {};
          if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            cleanStyle.backgroundColor = rgbToHex(style.backgroundColor);
          }
          if (style.color && style.color !== 'rgba(0, 0, 0, 0)') {
            cleanStyle.color = rgbToHex(style.color);
          }
          if (style.fontSize && style.fontSize !== '16px') {
            cleanStyle.fontSize = style.fontSize;
          }
          if (style.fontWeight && style.fontWeight !== '400') {
            cleanStyle.fontWeight = style.fontWeight;
          }
          if (style.borderRadius && style.borderRadius !== '0px') {
            cleanStyle.borderRadius = style.borderRadius;
          }
          if (style.borderWidth && style.borderWidth !== '0px') {
            cleanStyle.border = style.border;
          }
          if (style.display && style.display !== 'block' && style.display !== 'inline') {
            cleanStyle.display = style.display;
          }
          if (style.flexDirection && style.flexDirection !== 'row') {
            cleanStyle.flexDirection = style.flexDirection;
          }
          if (style.alignItems && style.alignItems !== 'normal') {
            cleanStyle.alignItems = style.alignItems;
          }
          if (style.justifyContent && style.justifyContent !== 'normal') {
            cleanStyle.justifyContent = style.justifyContent;
          }
          if (style.boxShadow && style.boxShadow !== 'none') {
            cleanStyle.boxShadow = style.boxShadow;
          }

          const nodeName = el.id ? '#' + el.id : (attrs.class ? '.' + attrs.class.split(' ')[0] : tag);

          // Recursively extract children relative to this parent element
          const children = [];
          for (const child of el.children) {
            const childNode = extractElement(child, rect);
            if (childNode) children.push(childNode);
          }

          return {
            id: 'elem-ext-' + (elemCounter++),
            name: nodeName,
            type: tag,
            attrs,
            style: cleanStyle,
            x: Math.max(0, relX),
            y: Math.max(0, relY),
            width: Math.max(20, Math.round(rect.width)),
            height: Math.max(20, Math.round(rect.height)),
            positionMode: 'normal',
            zIndex: 1,
            textContent: directText || undefined,
            children
          };
        }

        const rootElements = [];
        for (const child of document.body.children) {
          const rootNode = extractElement(child, null);
          if (rootNode) rootElements.push(rootNode);
        }

        return {
          title: document.title || 'Sayfa',
          elements: rootElements,
          links: pageLinks,
          statsDelta,
        };
      })()
    `),
      new Promise((_, reject) => setTimeout(() => reject(new Error('HTML çözümleme zaman aşımı')), ELECTRON_LIMITS.EXTRACT_TIMEOUT_MS)),
    ]);

    if (extracted?.statsDelta && stats) {
      stats.removedScripts += extracted.statsDelta.removedScripts || 0;
      stats.removedEventAttrs += extracted.statsDelta.removedEventAttrs || 0;
      stats.removedJsUrls += extracted.statsDelta.removedJsUrls || 0;
      stats.removedEmbeds += extracted.statsDelta.removedEmbeds || 0;
    }

    return extracted;
  } catch (err) {
    console.error('Error in isolated style extractor:', err);
    return null;
  } finally {
    try {
      if (!worker.isDestroyed()) worker.close();
    } catch (e) {}
  }
}

/**
 * 🌟 PARSE REACT JSX & EXTRACT ROUTES, LINKS & UNSUPPORTED CONSTRUCTS (BABEL)
 */
function parseReactJsxFile(code, filePath) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    return { error: err.message, routes: [], links: [], unsupported: [] };
  }

  const routes = [];
  const links = [];
  const unsupported = [];
  const componentDecls = [];

  traverse(ast, {
    // 1. Detect unsupported hooks (useState, useEffect, etc.)
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee && callee.name && /^use[A-Z0-9]/.test(callee.name)) {
        unsupported.push({
          type: 'React Hook',
          detail: callee.name,
          line: p.node.loc?.start?.line,
          file: path.basename(filePath)
        });
      }
    },

    // 2. Detect Routes & Links
    JSXElement(p) {
      const opening = p.node.openingElement;
      const tagName = opening.name?.name;

      // react-router-dom <Route path="..." element={<Comp />} />
      if (tagName === 'Route') {
        const pathAttr = opening.attributes?.find(a => a.name?.name === 'path');
        const elementAttr = opening.attributes?.find(a => a.name?.name === 'element' || a.name?.name === 'Component');
        const routePath = pathAttr?.value?.value || '/';
        let compName = 'Page';
        if (elementAttr?.value?.expression?.openingElement?.name?.name) {
          compName = elementAttr.value.expression.openingElement.name.name;
        } else if (elementAttr?.value?.expression?.name) {
          compName = elementAttr.value.expression.name;
        }
        routes.push({
          path: routePath,
          componentName: compName,
          file: filePath
        });
      }

      // <Link to="..."> or <NavLink to="...">
      if (tagName === 'Link' || tagName === 'NavLink') {
        const toAttr = opening.attributes?.find(a => a.name?.name === 'to');
        const toVal = toAttr?.value?.value || toAttr?.value?.expression?.value;
        if (toVal) {
          links.push({
            to: toVal,
            type: 'react-router',
            label: 'Sayfa Bağlantısı',
            fromFile: path.basename(filePath)
          });
        }
      } else if (tagName === 'a') {
        const hrefAttr = opening.attributes?.find(a => a.name?.name === 'href');
        const hrefVal = hrefAttr?.value?.value;
        if (hrefVal) {
          links.push({
            to: hrefVal,
            type: 'html-link',
            label: 'Web Bağlantısı',
            fromFile: path.basename(filePath)
          });
        }
      }
    },

    // 3. Detect unsupported .map and conditional rendering in JSX
    JSXExpressionContainer(p) {
      const expr = p.node.expression;
      if (expr.type === 'ConditionalExpression') {
        unsupported.push({
          type: 'Koşullu Render (? :)',
          detail: 'Ternary Render İfadesi',
          line: p.node.loc?.start?.line,
          file: path.basename(filePath)
        });
      } else if (expr.type === 'LogicalExpression' && (expr.operator === '&&' || expr.operator === '||')) {
        unsupported.push({
          type: 'Koşullu Render (&&)',
          detail: 'Mantıksal Kısa Devre Render',
          line: p.node.loc?.start?.line,
          file: path.basename(filePath)
        });
      } else if (expr.type === 'CallExpression' && expr.callee?.property?.name === 'map') {
        unsupported.push({
          type: 'Dinamik Dizi (.map)',
          detail: 'Dinamik Liste Render',
          line: p.node.loc?.start?.line,
          file: path.basename(filePath)
        });
      }
    },

    // 4. Collect top-level function components and their direct return JSX AST
    FunctionDeclaration(p) {
      const name = p.node.id?.name;
      if (name && /^[A-Z]/.test(name)) {
        let returnJsx = null;
        p.traverse({
          ReturnStatement(retPath) {
            if (!returnJsx && retPath.node.argument && (retPath.node.argument.type === 'JSXElement' || retPath.node.argument.type === 'JSXFragment')) {
              returnJsx = retPath.node.argument;
            }
          },
        });
        componentDecls.push({ name, node: p.node, returnJsx, file: filePath });
      }
    },
    VariableDeclarator(p) {
      const name = p.node.id?.name;
      if (name && /^[A-Z]/.test(name) && (p.node.init?.type === 'ArrowFunctionExpression' || p.node.init?.type === 'FunctionExpression')) {
        let returnJsx = null;
        if (p.node.init.body?.type === 'JSXElement' || p.node.init.body?.type === 'JSXFragment') {
          returnJsx = p.node.init.body;
        } else {
          p.get('init').traverse({
            ReturnStatement(retPath) {
              if (!returnJsx && retPath.node.argument && (retPath.node.argument.type === 'JSXElement' || retPath.node.argument.type === 'JSXFragment')) {
                returnJsx = retPath.node.argument;
              }
            },
          });
        }
        componentDecls.push({ name, node: p.node.init, returnJsx, file: filePath });
      }
    },
  });

  return { routes, links, unsupported, componentDecls };
}

/**
 * 🌟 RECURSIVELY CONVERTS A BABEL JSX AST NODE TO CRAFT AST NODE
 * Wraps unsupported expressions into locked "Kod Bileşeni" boxes.
 */
function convertBabelJsxToCraftNode(jsxNode, codeSnippetFn, stats = null) {
  if (!jsxNode) return null;

  if (jsxNode.type === 'JSXText') {
    const text = jsxNode.value.trim();
    if (!text) return null;
    return {
      id: `elem-text-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'span',
      name: 'Metin',
      textContent: text,
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      children: []
    };
  }

  if (jsxNode.type === 'JSXExpressionContainer') {
    // Unsupported dynamic code block -> Locked Code Component!
    return {
      id: `elem-unsupported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'div',
      name: 'Kod Bileşeni (Kilitli)',
      attrs: { class: 'unsupported-code-component' },
      style: {
        backgroundColor: '#18181b',
        border: '1px dashed #f59e0b',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#fbbf24',
        fontSize: '12px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      },
      textContent: '🔒 Dinamik Kod Bileşeni (.map / Hook / Koşul)',
      isLocked: true,
      isCodeComponent: true,
      children: []
    };
  }

  if (jsxNode.type === 'JSXFragment') {
    const children = [];
    for (const child of (jsxNode.children || [])) {
      const childAst = convertBabelJsxToCraftNode(child, codeSnippetFn, stats);
      if (childAst) children.push(childAst);
    }
    return {
      id: `elem-jsx-frag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'div',
      name: 'Fragment',
      attrs: {},
      style: {},
      x: 0,
      y: 0,
      width: 600,
      height: 120,
      positionMode: 'normal',
      zIndex: 1,
      children,
    };
  }

  if (jsxNode.type !== 'JSXElement') return null;

  const opening = jsxNode.openingElement;
  const tagName = opening.name?.name || 'div';
  const tag = tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(tag)) {
    if (stats) {
      if (tag === 'script') stats.removedScripts += 1;
      else stats.removedEmbeds += 1;
    }
    return null;
  }

  const attrs = {};
  const style = {};

  if (opening.attributes) {
    for (const attr of opening.attributes) {
      if (attr.type === 'JSXAttribute') {
        const attrName = attr.name?.name;
        if (!attrName) continue;
        if (/^on[a-z]/i.test(attrName) || attrName.toLowerCase() === 'srcdoc') {
          if (stats) stats.removedEventAttrs += 1;
          continue;
        }

        if (attrName === 'className') {
          attrs.class = attr.value?.value || '';
        } else if (attrName === 'style' && attr.value?.type === 'JSXExpressionContainer' && attr.value.expression?.type === 'ObjectExpression') {
          for (const prop of attr.value.expression.properties) {
            if (prop.key?.name && prop.value?.value !== undefined) {
              const rawVal = prop.value.value;
              if (typeof rawVal === 'string' && isUnsafeUrl(rawVal)) {
                if (stats) stats.removedJsUrls += 1;
                continue;
              }
              style[prop.key.name] = rawVal;
            }
          }
        } else if (attr.value?.type === 'StringLiteral') {
          if (isUnsafeUrl(attr.value.value)) {
            if (stats) stats.removedJsUrls += 1;
            continue;
          }
          attrs[attrName] = attr.value.value;
        } else if (attr.value === null) {
          attrs[attrName] = true;
        }
      }
    }
  }

  const children = [];
  let directText = '';

  if (jsxNode.children) {
    for (const child of jsxNode.children) {
      if (child.type === 'JSXText') {
        const t = child.value.trim();
        if (t) directText += (directText ? ' ' : '') + t;
      } else {
        const childAst = convertBabelJsxToCraftNode(child, codeSnippetFn, stats);
        if (childAst) children.push(childAst);
      }
    }
  }

  return {
    id: `elem-jsx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type: tag,
    name: attrs.id ? `#${attrs.id}` : (attrs.class ? `.${attrs.class.split(' ')[0]}` : tag),
    attrs,
    style,
    x: 0,
    y: 0,
    width: 300,
    height: 100,
    positionMode: 'normal',
    zIndex: 1,
    textContent: directText || undefined,
    children
  };
}

/**
 * 🌟 MAIN IMPORT CONTROLLER:
 * Klasörü okur; craft.project.json / *.craft.json veya HTML/HTM/React dosyalarını ayrıştırır.
 */
async function importProjectFromFolder(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, errorCode: 'DOSYA_OKUNAMADI', error: 'Dosya okunamadı.' };
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

  // 1. AŞAMA: Kök veya alt dizindeki .craft.json proje dosyasını kontrol et
  const scan = scanDirectoryWithLimits(folderPath);
  const nativeJsonEntry = scan.entries.find((e) => e.name.toLowerCase() === 'craft.project.json' || e.ext === '.craft.json');
  if (nativeJsonEntry) {
    try {
      const content = stripBomAndReadUtf8(nativeJsonEntry.fullPath);
      const projectData = JSON.parse(content);
      const sanitizedTabs = (projectData.tabs || []).map((tab) => ({
        ...tab,
        elements: sanitizeNodeTree(tab.elements || [], stats),
      }));
      return {
        type: 'craft-native',
        success: true,
        source: nativeJsonEntry.name,
        folderPath,
        id: projectData.id || undefined,
        name: projectData.name || path.basename(folderPath),
        createdAt: projectData.createdAt || undefined,
        updatedAt: projectData.updatedAt || undefined,
        canvasSettings: projectData.canvasSettings || { width: 1280, height: 1350, backgroundColor: '#0f172a' },
        canvasByViewport: projectData.canvasByViewport || null,
        viewportMode: projectData.viewportMode || 'desktop',
        initializedViewports: projectData.initializedViewports || undefined,
        tabs: sanitizedTabs,
        activeTabId: projectData.activeTabId || (sanitizedTabs?.[0]?.id) || 'tab-1',
        projectFunctions: Array.isArray(projectData.projectFunctions) ? projectData.projectFunctions : [],
        pageLinks: projectData.pageLinks || [],
        files: scan.entries.map((e) => ({ name: e.name, relativePath: e.relPath, bytes: e.size, kind: 'craft' })),
        skipped: scan.skipped,
        warnings: scan.warnings,
        stats,
        unsupportedCount: 0,
        unsupportedDetails: [],
        summary: `Proje '${projectData.name}' kayıpsız yüklendi (${sanitizedTabs.length} sayfa).`,
      };
    } catch (err) {
      console.warn('Craft JSON ayrıştırma hatası, klasör taramasına geçiliyor:', err.message);
    }
  }

  // 2. AŞAMA: Desteklenen web dosyalarını filtrele (.html, .htm, .jsx, .tsx)
  const htmlFiles = [];
  const jsxFiles = [];
  const skipped = [...scan.skipped];
  const warnings = [...scan.warnings];
  const processedFiles = [];

  for (const entry of scan.entries) {
    if (entry.ext === '.html' || entry.ext === '.htm') {
      htmlFiles.push(entry);
      processedFiles.push({ name: entry.name, relativePath: entry.relPath, bytes: entry.size, kind: 'code' });
    } else if (entry.ext === '.jsx' || entry.ext === '.tsx' || entry.ext === '.js') {
      jsxFiles.push(entry);
      processedFiles.push({ name: entry.name, relativePath: entry.relPath, bytes: entry.size, kind: 'code' });
    } else if (entry.ext === '.css') {
      processedFiles.push({ name: entry.name, relativePath: entry.relPath, bytes: entry.size, kind: 'css' });
    } else if (['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(entry.ext)) {
      processedFiles.push({ name: entry.name, relativePath: entry.relPath, bytes: entry.size, kind: 'asset' });
    } else {
      skipped.push({ name: entry.relPath, reason: `Desteklenmeyen biçim: ${entry.ext || 'uzantısız'}` });
    }
  }

  const allUnsupported = [];
  const allPageLinks = [];
  const generatedTabs = [];

  // Durum A: HTML / HTM dosyaları (gizli pencerede javascript: false ile stil çıkar)
  if (htmlFiles.length > 0) {
    htmlFiles.sort((a, b) => (/^index\.html?$/i.test(a.name) ? 0 : 1) - (/^index\.html?$/i.test(b.name) ? 0 : 1));
    for (let i = 0; i < htmlFiles.length; i += 1) {
      const entry = htmlFiles[i];
      const tabName = path.basename(entry.name, path.extname(entry.name));
      const routePath = i === 0 && /^index$/i.test(tabName) ? '/' : `/${tabName}`;

      const extracted = await extractStylesFromHtmlFile(entry.fullPath, stats);
      if (extracted && extracted.elements && extracted.elements.length > 0) {
        generatedTabs.push({
          id: `tab-html-${i + 1}`,
          name: i === 0 && /^index$/i.test(tabName) ? 'Anasayfa.craft' : `${tabName}.craft`,
          route: routePath,
          elements: sanitizeNodeTree(extracted.elements, stats),
        });

        if (extracted.links) {
          extracted.links.forEach((l) => {
            allPageLinks.push({
              fromTab: `tab-html-${i + 1}`,
              targetRoute: l.href,
              label: l.text,
            });
          });
        }
      }
    }
  }

  // Durum B: React / JSX / TSX dosyaları
  if (jsxFiles.length > 0) {
    for (const entry of jsxFiles) {
      try {
        const code = stripBomAndReadUtf8(entry.fullPath);
        const parsed = parseReactJsxFile(code, entry.fullPath);

        if (parsed.unsupported) allUnsupported.push(...parsed.unsupported);
        if (parsed.links) allPageLinks.push(...parsed.links);

        if (parsed.routes && parsed.routes.length > 0) {
          for (let rIdx = 0; rIdx < parsed.routes.length; rIdx += 1) {
            const route = parsed.routes[rIdx];
            const tabId = `tab-route-${generatedTabs.length + 1}`;
            const tabName = route.componentName || `Sayfa-${rIdx + 1}`;
            const comp = parsed.componentDecls.find((c) => c.name === route.componentName);
            let rootElements = [];
            if (comp?.returnJsx) {
              const converted = convertBabelJsxToCraftNode(comp.returnJsx, null, stats);
              if (converted) rootElements = sanitizeNodeTree([converted], stats);
            }
            generatedTabs.push({
              id: tabId,
              name: `${tabName}.craft`,
              route: route.path,
              elements: rootElements,
            });
          }
        } else if (parsed.componentDecls && parsed.componentDecls.length > 0) {
          // Route tanımı yoksa doğrudan dışa aktarılan ilk bileşeni sayfa olarak oluştur
          const primaryComp = parsed.componentDecls.find((c) => c.returnJsx);
          if (primaryComp?.returnJsx) {
            const converted = convertBabelJsxToCraftNode(primaryComp.returnJsx, null, stats);
            if (converted) {
              generatedTabs.push({
                id: `tab-jsx-${generatedTabs.length + 1}`,
                name: `${primaryComp.name}.craft`,
                route: generatedTabs.length === 0 ? '/' : `/${primaryComp.name.toLowerCase()}`,
                elements: sanitizeNodeTree([converted], stats),
              });
            }
          }
        }
      } catch (err) {
        console.warn('JSX ayrıştırma uyarısı:', entry.relPath, err.message);
      }
    }
  }

  if (generatedTabs.length === 0) {
    return {
      type: 'external-scanned',
      success: false,
      errorCode: processedFiles.length > 0 ? 'ICERIK_YOK' : 'BICIM_DESTEKLENMIYOR',
      error: processedFiles.length > 0 ? 'İçe aktarılacak görünür içerik bulunamadı.' : 'Bu dosya biçimi desteklenmiyor.',
      files: processedFiles,
      skipped,
      warnings,
      stats,
    };
  }

  return {
    type: 'external-scanned',
    success: true,
    source: 'Babel AST & Yalıtılmış HTML Çözümleyici',
    folderPath,
    name: path.basename(folderPath),
    canvasSettings: { width: 1280, height: 1350, backgroundColor: '#0f172a' },
    tabs: generatedTabs,
    activeTabId: generatedTabs[0]?.id || 'tab-1',
    pageLinks: allPageLinks,
    files: processedFiles,
    skipped,
    warnings,
    stats,
    unsupportedCount: allUnsupported.length,
    unsupportedDetails: allUnsupported,
    summary: `Harici proje ayrıştırıldı: ${generatedTabs.length} sayfa sekmesi oluşturuldu, ${allPageLinks.length} bağlantı bulundu.`,
  };
}

module.exports = {
  createCraftProjectSchema,
  importProjectFromFolder,
  extractStylesFromHtmlFile,
  parseReactJsxFile,
  scanDirectoryWithLimits,
  sanitizeNodeTree,
};
