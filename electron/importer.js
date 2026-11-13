const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

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
 * Helper to scan directory recursively for files matching extensions.
 * Ignores node_modules, .git, dist, build, .next, etc.
 */
function scanDirectory(dir, extensions = ['.html', '.jsx', '.tsx', '.js'], maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];
  const results = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vscode', '.idea']);

  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      if (item.isDirectory()) {
        if (!ignoreDirs.has(item.name) && !item.name.startsWith('.')) {
          results.push(...scanDirectory(path.join(dir, item.name), extensions, maxDepth, currentDepth + 1));
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(path.join(dir, item.name));
        }
      }
    }
  } catch (err) {
    console.warn('Error reading directory:', dir, err.message);
  }

  return results;
}

/**
 * 🌟 EXTRACT COMPUTED STYLES & LAYOUT FROM HTML FILE IN ISOLATED HIDDEN WINDOW
 * Uses getComputedStyle and getBoundingClientRect - zero manual Tailwind parsing!
 * Imported code NEVER executes in the studio's main window.
 */
async function extractStylesFromHtmlFile(htmlFilePath) {
  const worker = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  try {
    await worker.loadFile(htmlFilePath);
    // Allow layout & CSS rendering
    await new Promise(resolve => setTimeout(resolve, 250));

    const extracted = await worker.webContents.executeJavaScript(`
      (() => {
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

        let elemCounter = 1;
        const pageLinks = [];

        function extractElement(el, parentRect = null) {
          if (el.nodeType !== Node.ELEMENT_NODE) return null;
          const tag = el.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'meta', 'link', 'title'].includes(tag)) return null;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0 && el.children.length === 0) return null;

          const style = window.getComputedStyle(el);

          // Relative coordinates calculation
          const relX = parentRect ? Math.round(rect.left - parentRect.left) : Math.round(rect.left);
          const relY = parentRect ? Math.round(rect.top - parentRect.top) : Math.round(rect.top);

          const attrs = {};
          for (const attr of el.attributes) {
            if (!attr.name.startsWith('on')) {
              attrs[attr.name] = attr.value;
            }
          }

          // Link detection
          if (tag === 'a' && el.getAttribute('href')) {
            pageLinks.push({
              href: el.getAttribute('href'),
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
          links: pageLinks
        };
      })()
    `);

    return extracted;
  } catch (err) {
    console.error('Error in isolated style extractor:', err);
    return null;
  } finally {
    try {
      worker.close();
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

    // 4. Collect top-level function components
    FunctionDeclaration(p) {
      const name = p.node.id?.name;
      if (name && /^[A-Z]/.test(name)) {
        componentDecls.push({ name, node: p.node, file: filePath });
      }
    },
    VariableDeclarator(p) {
      const name = p.node.id?.name;
      if (name && /^[A-Z]/.test(name) && (p.node.init?.type === 'ArrowFunctionExpression' || p.node.init?.type === 'FunctionExpression')) {
        componentDecls.push({ name, node: p.node.init, file: filePath });
      }
    }
  });

  return { routes, links, unsupported, componentDecls };
}

/**
 * 🌟 RECURSIVELY CONVERTS A BABEL JSX AST NODE TO CRAFT AST NODE
 * Wraps unsupported expressions into locked "Kod Bileşeni" boxes.
 */
function convertBabelJsxToCraftNode(jsxNode, codeSnippetFn) {
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

  if (jsxNode.type !== 'JSXElement') return null;

  const opening = jsxNode.openingElement;
  const tagName = opening.name?.name || 'div';
  const tag = tagName.toLowerCase();

  const attrs = {};
  const style = {};

  if (opening.attributes) {
    for (const attr of opening.attributes) {
      if (attr.type === 'JSXAttribute') {
        const attrName = attr.name?.name;
        if (!attrName || attrName.startsWith('on')) continue;

        if (attrName === 'className') {
          attrs.class = attr.value?.value || '';
        } else if (attrName === 'style' && attr.value?.type === 'JSXExpressionContainer' && attr.value.expression?.type === 'ObjectExpression') {
          for (const prop of attr.value.expression.properties) {
            if (prop.key?.name && prop.value?.value !== undefined) {
              style[prop.key.name] = prop.value.value;
            }
          }
        } else if (attr.value?.type === 'StringLiteral') {
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
        const childAst = convertBabelJsxToCraftNode(child, codeSnippetFn);
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
 * Reads a folder, checks craft.project.json, or parses HTML / React routes & files.
 */
async function importProjectFromFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Klasör bulunamadı: ${folderPath}`);
  }

  // 1. STAGE 1: Check for craft.project.json (Lossless Studio Schema)
  const craftJsonPath = path.join(folderPath, 'craft.project.json');
  if (fs.existsSync(craftJsonPath)) {
    try {
      const content = fs.readFileSync(craftJsonPath, 'utf8');
      const projectData = JSON.parse(content);
      return {
        type: 'craft-native',
        success: true,
        source: 'craft.project.json',
        folderPath,
        id: projectData.id || undefined,
        name: projectData.name || path.basename(folderPath),
        createdAt: projectData.createdAt || undefined,
        updatedAt: projectData.updatedAt || undefined,
        canvasSettings: projectData.canvasSettings || { width: 1280, height: 1350, backgroundColor: '#0f172a' },
        canvasByViewport: projectData.canvasByViewport || null,
        viewportMode: projectData.viewportMode || 'desktop',
        initializedViewports: projectData.initializedViewports || undefined,
        tabs: projectData.tabs || [],
        activeTabId: projectData.activeTabId || (projectData.tabs?.[0]?.id) || 'tab-1',
        projectFunctions: Array.isArray(projectData.projectFunctions) ? projectData.projectFunctions : [],
        pageLinks: projectData.pageLinks || [],
        unsupportedCount: 0,
        unsupportedDetails: [],
        summary: `Proje '${projectData.name}' craft.project.json ile kayıpsız yüklendi (${projectData.tabs?.length || 0} sayfa).`
      };
    } catch (err) {
      console.warn('craft.project.json parse error, falling back to scanner:', err.message);
    }
  }

  // 2. STAGE 2: craft.project.json NOT FOUND -> SCAN FILES
  const htmlFiles = scanDirectory(folderPath, ['.html']);
  const jsxFiles = scanDirectory(folderPath, ['.jsx', '.tsx', '.js']);

  const allUnsupported = [];
  const allPageLinks = [];
  const generatedTabs = [];

  // Case A: HTML files present -> Extract computed styles in isolated hidden window
  if (htmlFiles.length > 0) {
    for (let i = 0; i < htmlFiles.length; i++) {
      const htmlFile = htmlFiles[i];
      const relName = path.relative(folderPath, htmlFile);
      const tabName = path.basename(htmlFile, path.extname(htmlFile));
      const routePath = tabName === 'index' ? '/' : `/${tabName}`;

      const extracted = await extractStylesFromHtmlFile(htmlFile);
      if (extracted && extracted.elements && extracted.elements.length > 0) {
        generatedTabs.push({
          id: `tab-html-${i + 1}`,
          name: `${tabName}.craft`,
          route: routePath,
          elements: extracted.elements
        });

        if (extracted.links) {
          extracted.links.forEach(l => {
            allPageLinks.push({
              fromTab: `tab-html-${i + 1}`,
              targetRoute: l.href,
              label: l.text
            });
          });
        }
      }
    }
  }

  // Case B: React / JSX files present -> Babel parser for routes, links, unsupported features
  if (jsxFiles.length > 0) {
    for (const jsxFile of jsxFiles) {
      try {
        const code = fs.readFileSync(jsxFile, 'utf8');
        const parsed = parseReactJsxFile(code, jsxFile);

        if (parsed.unsupported) {
          allUnsupported.push(...parsed.unsupported);
        }

        if (parsed.links) {
          allPageLinks.push(...parsed.links);
        }

        // If routes found, generate tabs for each route
        if (parsed.routes && parsed.routes.length > 0) {
          for (let rIdx = 0; rIdx < parsed.routes.length; rIdx++) {
            const route = parsed.routes[rIdx];
            const tabId = `tab-route-${generatedTabs.length + 1}`;
            const tabName = route.componentName || `Sayfa-${rIdx + 1}`;

            // Find matching component declaration
            const comp = parsed.componentDecls.find(c => c.name === route.componentName);
            let rootElements = [];

            if (comp) {
              // Extract return JSX
              let returnJsx = null;
              traverse(comp.node, {
                ReturnStatement(retPath) {
                  if (retPath.node.argument && (retPath.node.argument.type === 'JSXElement' || retPath.node.argument.type === 'JSXFragment')) {
                    returnJsx = retPath.node.argument;
                  }
                }
              }, comp.node);

              if (returnJsx) {
                const converted = convertBabelJsxToCraftNode(returnJsx);
                if (converted) rootElements = [converted];
              }
            }

            generatedTabs.push({
              id: tabId,
              name: `${tabName}.craft`,
              route: route.path,
              elements: rootElements
            });
          }
        }
      } catch (err) {
        console.warn('Error parsing JSX file:', jsxFile, err.message);
      }
    }
  }

  // If no tabs could be generated, create an empty default tab
  if (generatedTabs.length === 0) {
    generatedTabs.push({
      id: 'tab-imported-empty',
      name: 'Icerik.craft',
      route: '/',
      elements: []
    });
  }

  return {
    type: 'external-scanned',
    success: true,
    source: 'Babel AST & Sandboxed Layout Engine',
    folderPath,
    name: path.basename(folderPath),
    canvasSettings: { width: 1280, height: 1350, backgroundColor: '#0f172a' },
    tabs: generatedTabs,
    activeTabId: generatedTabs[0]?.id || 'tab-1',
    pageLinks: allPageLinks,
    unsupportedCount: allUnsupported.length,
    unsupportedDetails: allUnsupported,
    summary: `Harici proje ayrıştırıldı: ${generatedTabs.length} sayfa sekmesi oluşturuldu, ${allPageLinks.length} bağlantı bulundu. ${allUnsupported.length} adet desteklenmeyen dinamik kod (Hook/.map) güvenle 'Kod Bileşeni' olarak kilitlendi.`
  };
}

module.exports = {
  createCraftProjectSchema,
  importProjectFromFolder,
  extractStylesFromHtmlFile,
  parseReactJsxFile
};
