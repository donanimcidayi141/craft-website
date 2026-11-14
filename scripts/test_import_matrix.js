import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getFreePort,
  launchChromiumCdp,
  startStaticServer,
  startVitePreview,
} from './_cdpHelper.js';
import { importSiteCodeToProjectSchema } from '../src/utils/codeFileImporter.js';
import { flattenTree } from '../src/utils/treeUtils.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts', 'fixtures', 'import');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'docs', 'import-artifacts');

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1];
const hasPipelineFile = fs.existsSync(path.join(ROOT_DIR, 'src', 'utils', 'importPipeline.js'));
const MODE = modeArg || (hasPipelineFile ? 'pipeline' : 'legacy');
const SKIP_CDP = args.includes('--no-cdp');

let runImportFn = null;
if (MODE === 'pipeline') {
  if (!hasPipelineFile) {
    console.error('❌ --mode=pipeline istendi ancak src/utils/importPipeline.js henüz mevcut değil.');
    process.exit(1);
  }
  const mod = await import('../src/utils/importPipeline.js');
  runImportFn = mod.runImport;
}

function discoverFixtures() {
  const ordered = [
    { id: 'basic.html', kind: 'file', relPath: 'basic.html', expectOk: true },
    { id: 'landing-flex.html', kind: 'file', relPath: 'landing-flex.html', expectOk: true },
    { id: 'inline-styles.html', kind: 'file', relPath: 'inline-styles.html', expectOk: true },
    { id: 'with-script.html', kind: 'file', relPath: 'with-script.html', expectOk: true },
    { id: 'component.jsx', kind: 'file', relPath: 'component.jsx', expectOk: true },
    { id: 'component.tsx', kind: 'file', relPath: 'component.tsx', expectOk: true },
    { id: 'project.craft.json', kind: 'file', relPath: 'project.craft.json', expectOk: true },
    { id: 'folder-site', kind: 'folder', relPath: 'folder-site', expectOk: true },
    { id: 'invalid.html', kind: 'file', relPath: 'invalid.html', expectOk: true },
    { id: 'empty.html', kind: 'file', relPath: 'empty.html', expectOk: false },
    { id: 'bom-turkce.html', kind: 'file', relPath: 'bom-turkce.html', expectOk: true },
    { id: 'big.html', kind: 'file', relPath: 'big.html', expectOk: true },
    { id: 'huge.html', kind: 'file', relPath: 'huge.html', expectOk: false },
  ];

  const userDir = path.join(FIXTURES_DIR, 'user');
  if (fs.existsSync(userDir)) {
    const entries = fs.readdirSync(userDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        ordered.push({
          id: `user/${entry.name}`,
          kind: 'folder',
          relPath: path.join('user', entry.name),
          expectOk: null,
        });
      } else if (entry.isFile()) {
        ordered.push({
          id: `user/${entry.name}`,
          kind: 'file',
          relPath: path.join('user', entry.name),
          expectOk: null,
        });
      }
    }
  }

  return ordered.map((item) => ({
    ...item,
    absPath: path.join(FIXTURES_DIR, item.relPath),
  }));
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function tokenizeNormalizedWords(text) {
  return decodeBasicEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .split(/[\s,.;:!?()[\]{}"'«»/\\|<>+=*~`]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function collectFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function extractSourceExpectations(fixture) {
  const filesToRead = fixture.kind === 'folder'
    ? collectFilesRecursive(fixture.absPath)
    : [fixture.absPath];

  const uniqueWordSet = new Set();
  const trCharSet = new Set();
  let expectedImageCount = 0;
  let hasDataUriImage = false;
  let hasRelativeSvgImage = false;

  const collectWordsAndTr = (txt) => {
    for (const w of tokenizeNormalizedWords(txt)) uniqueWordSet.add(w);
    const matches = txt.match(/[çğıöşüÇĞİÖŞÜ]/g);
    if (matches) {
      for (const ch of matches) trCharSet.add(ch);
    }
  };

  for (const fp of filesToRead) {
    const ext = path.extname(fp).toLowerCase();
    const text = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');

    if (ext === '.html' || ext === '.htm') {
      const bodyOnly = (text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? text)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
        .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, ' ')
        .replace(/<embed\b[^>]*>/gi, ' ');
      const imgMatches = [...bodyOnly.matchAll(/<img\b[^>]*>/gi)];
      for (const im of imgMatches) {
        const tagStr = im[0];
        const src = tagStr.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] || '';
        if (/^\s*javascript:/i.test(src)) continue;
        expectedImageCount += 1;
        if (src.startsWith('data:')) hasDataUriImage = true;
        if (src.endsWith('.svg') && !src.startsWith('data:')) hasRelativeSvgImage = true;
      }
      const plain = bodyOnly
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ');
      collectWordsAndTr(plain);
    } else if (ext === '.jsx' || ext === '.tsx') {
      const returnMatch = text.match(/return\s*\(([\s\S]*)\)\s*;?/);
      const jsxSection = returnMatch ? returnMatch[1] : text;
      const withoutComments = jsxSection
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
      const tagTexts = [];
      const betweenTags = withoutComments
        .replace(/<[^>]+>/g, '\n')
        .split('\n');
      for (const chunk of betweenTags) {
        const strippedExpr = chunk.replace(/\{[^}]*\}/g, ' ');
        tagTexts.push(strippedExpr);
        const exprMatches = chunk.matchAll(/\{([^}]+)\}/g);
        for (const em of exprMatches) {
          const strLiterals = em[1].matchAll(/['"]([^'"]{2,})['"]/g);
          for (const sl of strLiterals) tagTexts.push(sl[1]);
        }
      }
      collectWordsAndTr(tagTexts.join(' '));
    } else if (ext === '.json' || fp.endsWith('.craft.json')) {
      try {
        const parsed = JSON.parse(text);
        const tabs = Array.isArray(parsed.tabs) ? parsed.tabs : [];
        const parts = [];
        for (const tab of tabs) {
          for (const node of flattenTree(tab.elements || [])) {
            if (node.textContent) parts.push(node.textContent);
            if (node.content && node.content !== node.textContent) parts.push(node.content);
            if (node.productName) parts.push(node.productName);
            if (node.type === 'img' && (node.attrs?.src || node.imageUrl)) expectedImageCount += 1;
          }
        }
        collectWordsAndTr(parts.join(' '));
      } catch {
        // Geçersiz JSON
      }
    }
  }

  return {
    uniqueSourceWords: [...uniqueWordSet],
    trChars: [...trCharSet],
    expectedImageCount,
    hasDataUriImage,
    hasRelativeSvgImage,
  };
}

function analyzeImportedProject(project, sourceExpectations, fixtureId) {
  if (!project || !Array.isArray(project.tabs)) {
    return {
      nodeCount: 0,
      pageCount: 0,
      turkishIntact: null,
      imagesPreserved: null,
      securityViolations: [],
      textCoveragePct: 0,
    };
  }

  let nodeCount = 0;
  const pageCount = project.tabs.length;
  const outputTextParts = [];
  const imgNodes = [];
  const violationSet = new Set();

  for (const tab of project.tabs) {
    const flat = flattenTree(tab.elements || []);
    nodeCount += flat.length;
    for (const node of flat) {
      if (node.textContent) outputTextParts.push(node.textContent);
      if (node.content && node.content !== node.textContent) outputTextParts.push(node.content);
      if (node.productName) outputTextParts.push(node.productName);
      if (node.productPrice) outputTextParts.push(node.productPrice);
      if (node.productTag) outputTextParts.push(node.productTag);
      if (node.attrs?.alt) outputTextParts.push(node.attrs.alt);
      if (node.attrs?.placeholder) outputTextParts.push(node.attrs.placeholder);

      const tag = String(node.type || '').toLowerCase();
      if (['script', 'iframe', 'object', 'embed'].includes(tag)) {
        violationSet.add(`yasak-etiket:<${tag}>`);
      }

      if (tag === 'img' || tag === 'image') {
        imgNodes.push({
          src: node.attrs?.src || node.imageUrl || '',
          alt: node.attrs?.alt || '',
        });
      }

      if (node.attrs && typeof node.attrs === 'object') {
        for (const [k, v] of Object.entries(node.attrs)) {
          if (/^on[a-z]/i.test(k)) {
            violationSet.add(`on-oznitelik:${k}`);
          }
          if (typeof v === 'string') {
            const normUrl = v.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
            if (normUrl.startsWith('javascript:')) {
              violationSet.add(`javascript-url:${k}`);
            }
          }
        }
      }
      if (typeof node.imageUrl === 'string') {
        const normImg = node.imageUrl.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
        if (normImg.startsWith('javascript:')) {
          violationSet.add('javascript-url:imageUrl');
        }
      }
    }
  }

  // Büyük projelerde de hızlı güvenlik taraması (yalnızca bir kez serialize et)
  const serialized = JSON.stringify(project);
  if (/<script\b/i.test(serialized)) violationSet.add('ham-json:<script');
  if (/javascript:/i.test(serialized)) violationSet.add('ham-json:javascript:');

  const outputCombined = outputTextParts.join(' ');
  const outputWords = new Set(tokenizeNormalizedWords(outputCombined));

  let textCoveragePct = 100;
  if (sourceExpectations.uniqueSourceWords.length > 0) {
    let matched = 0;
    const outputLower = outputCombined.toLocaleLowerCase('tr-TR');
    for (const w of sourceExpectations.uniqueSourceWords) {
      if (outputWords.has(w) || outputLower.includes(w)) matched += 1;
    }
    textCoveragePct = Math.round((matched / sourceExpectations.uniqueSourceWords.length) * 100);
  } else if (nodeCount === 0) {
    textCoveragePct = 0;
  }

  const hasReplacementChar = outputCombined.includes('\uFFFD') || serialized.includes('\uFFFD');
  let turkishIntact = null;
  if (sourceExpectations.trChars.length > 0) {
    const missingChars = sourceExpectations.trChars.filter((ch) => !outputCombined.includes(ch));
    turkishIntact = !hasReplacementChar && missingChars.length === 0;
  } else if (hasReplacementChar) {
    turkishIntact = false;
  }

  let imagesPreserved = null;
  if (sourceExpectations.expectedImageCount > 0) {
    if (fixtureId === 'with-script.html') {
      const keptDangerous = imgNodes.some((im) => /^\s*javascript:/i.test(im.src));
      imagesPreserved = !keptDangerous;
    } else if (sourceExpectations.hasDataUriImage) {
      imagesPreserved = imgNodes.some((im) => im.src.startsWith('data:image/'));
    } else if (sourceExpectations.hasRelativeSvgImage) {
      imagesPreserved = imgNodes.some((im) => im.src.startsWith('data:image/svg+xml'));
    } else {
      imagesPreserved = imgNodes.length >= sourceExpectations.expectedImageCount && imgNodes.every((im) => Boolean(im.src));
    }
  }

  return {
    nodeCount,
    pageCount,
    turkishIntact,
    imagesPreserved,
    securityViolations: [...violationSet],
    textCoveragePct,
  };
}

/**
 * Node seviyesinde test çalıştırır (legacy modda büyük dosyaları alt süreç zaman aşımıyla korur).
 */
async function runNodeCheck(fixture, expectations) {
  const t0 = performance.now();
  try {
    if (MODE === 'legacy') {
      if (fixture.kind === 'folder') {
        const electronImporter = require(path.join(ROOT_DIR, 'electron', 'importer.js'));
        const res = await electronImporter.importProjectFromFolder(fixture.absPath);
        const dt = Math.round(performance.now() - t0);
        const analysis = analyzeImportedProject(res, expectations, fixture.id);
        return {
          ok: Boolean(res?.success),
          errorText: res?.error || null,
          durationMs: dt,
          ...analysis,
          warnings: [],
          note: 'electron/importer.js Node ortamında BrowserWindow olmadan çalıştı',
        };
      }

      const fileSize = fs.statSync(fixture.absPath).size;
      if (fileSize > 6 * 1024 * 1024) {
        // Legacy importer'ın >6MB dosyada donup donmadığını alt süreçte 7 sn zaman aşımıyla ölç
        const sub = spawnSync(process.execPath, [
          '--input-type=module',
          '-e',
          `import fs from 'node:fs'; import { importSiteCodeToProjectSchema } from './src/utils/codeFileImporter.js'; const s = fs.readFileSync(${JSON.stringify(fixture.absPath)}, 'utf8'); importSiteCodeToProjectSchema(s, ${JSON.stringify(path.basename(fixture.absPath))});`,
        ], {
          cwd: ROOT_DIR,
          timeout: 7000,
          encoding: 'utf8',
        });
        const dt = Math.round(performance.now() - t0);
        if (sub.error?.code === 'ETIMEDOUT' || sub.signal === 'SIGTERM') {
          return {
            ok: false,
            errorText: `ZAMAN_ASIMI (>${dt}ms donma)`,
            durationMs: dt,
            nodeCount: 0,
            pageCount: 0,
            turkishIntact: null,
            imagesPreserved: null,
            securityViolations: [],
            textCoveragePct: 0,
            warnings: [],
          };
        }
      }

      const rawStr = fs.readFileSync(fixture.absPath, 'utf8');
      const project = importSiteCodeToProjectSchema(rawStr, path.basename(fixture.absPath), fixture.absPath);
      const dt = Math.round(performance.now() - t0);
      const analysis = analyzeImportedProject(project, expectations, fixture.id);
      return {
        ok: true,
        errorText: null,
        durationMs: dt,
        ...analysis,
        warnings: [],
      };
    }

    // Pipeline modu: src/utils/importPipeline.js
    let source;
    if (fixture.kind === 'folder') {
      const files = collectFilesRecursive(fixture.absPath).map((fp) => ({
        name: path.basename(fp),
        relativePath: path.relative(fixture.absPath, fp).replace(/\\/g, '/'),
        bytes: fs.readFileSync(fp),
      }));
      source = { kind: 'files', files, folderName: path.basename(fixture.absPath) };
    } else {
      source = {
        kind: 'file',
        file: {
          name: path.basename(fixture.absPath),
          path: fixture.absPath,
          bytes: fs.readFileSync(fixture.absPath),
        },
      };
    }

    const res = await runImportFn(source);
    const dt = Math.round(performance.now() - t0);
    if (!res.ok) {
      return {
        ok: false,
        errorCode: res.error?.code || 'BILINMEYEN',
        errorText: res.error?.message || 'Hata',
        durationMs: dt,
        nodeCount: 0,
        pageCount: 0,
        turkishIntact: null,
        imagesPreserved: null,
        securityViolations: [],
        textCoveragePct: 0,
        warnings: res.report?.warnings || [],
        skipped: res.report?.skipped || [],
      };
    }

    const analysis = analyzeImportedProject(res.project, expectations, fixture.id);
    return {
      ok: true,
      errorText: null,
      durationMs: dt,
      ...analysis,
      warnings: res.report?.warnings || [],
      skipped: res.report?.skipped || [],
    };
  } catch (err) {
    return {
      ok: false,
      errorText: err?.message || String(err),
      durationMs: Math.round(performance.now() - t0),
      nodeCount: 0,
      pageCount: 0,
      turkishIntact: null,
      imagesPreserved: null,
      securityViolations: [],
      textCoveragePct: 0,
      warnings: [],
    };
  }
}

async function runBrowserCheck(cdp, baseUrl, fixture, expectations) {
  let crashed = false;
  let jsDialogMessage = null;
  const pageErrors = [];

  const offException = cdp.on('Runtime.exceptionThrown', (p) => {
    pageErrors.push(p.exceptionDetails?.text || p.exceptionDetails?.exception?.description || 'Runtime exception');
  });
  const offDialog = cdp.on('Page.javascriptDialogOpening', async (p) => {
    jsDialogMessage = p.message;
    try { await cdp.send('Page.handleJavaScriptDialog', { accept: false }); } catch {}
  });
  const offCrash = cdp.on('Inspector.targetCrashed', () => {
    crashed = true;
  });

  try {
    const startUrl = MODE === 'pipeline' ? `${baseUrl}/#/ice-aktar` : `${baseUrl}/`;
    await cdp.navigate(startUrl);
    await cdp.evaluate(`
      localStorage.clear();
      sessionStorage.clear();
      window.__xssExecuted = false;
      window.__onloadExecuted = false;
    `);
    await cdp.navigate(startUrl);

    if (MODE === 'legacy' && fixture.kind === 'folder') {
      const t0 = performance.now();
      await cdp.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Klasör İçe Aktar'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 350));
      const uiState = await cdp.evaluate(`
        (() => {
          const toast = document.querySelector('.fixed.bottom-6.right-6');
          const alertEl = document.querySelector('[role="alert"]');
          const errBoundary = document.body.innerText.includes('Bir Şeyler Ters Gitti');
          return {
            shownError: alertEl?.innerText?.trim() || toast?.innerText?.trim() || 'sessiz',
            errBoundary,
          };
        })()
      `);
      return {
        ok: false,
        shownError: uiState.shownError,
        durationMs: Math.round(performance.now() - t0),
        nodeCount: 0,
        pageCount: 0,
        turkishIntact: null,
        imagesPreserved: null,
        securityViolations: [],
        textCoveragePct: 0,
        crashed: crashed || uiState.errBoundary || pageErrors.length > 0,
      };
    }

    const t0 = performance.now();

    if (MODE === 'pipeline' && fixture.kind === 'folder') {
      const folderFiles = collectFilesRecursive(fixture.absPath);
      await cdp.setFileInputFiles('[data-import-folder-input]', folderFiles);
    } else {
      const inputSelector = MODE === 'pipeline' ? '[data-import-file-input]' : '[data-welcome-root] input[type="file"]';
      await cdp.setFileInputFiles(inputSelector, [fixture.absPath]);
    }

    let state = null;
    const waitStart = Date.now();
    const maxWaitMs = MODE === 'legacy' && fixture.id === 'huge.html' ? 8000 : 15000;
    while (Date.now() - waitStart < maxWaitMs) {
      try {
        state = await cdp.evaluate(`
          (() => {
            const errBoundary = document.body.innerText.includes('Bir Şeyler Ters Gitti');
            const alertEl = document.querySelector('[role="alert"]');
            const reportEl = document.querySelector('[data-import-report]');
            const toastEl = document.querySelector('.fixed.bottom-6.right-6');
            const welcomeRoot = document.querySelector('[data-welcome-root]');
            const canvasNodes = document.querySelectorAll('[data-element-id]').length;
            const canvasText = !welcomeRoot ? (document.querySelector('[data-canvas-stage], main')?.innerText || document.body.innerText || '') : '';
            const recentRaw = localStorage.getItem('craftstudio.recentProjects.v1');
            const recent = recentRaw ? JSON.parse(recentRaw) : [];
            const latestEntry = recent[0] || null;
            return {
              errBoundary,
              alertText: alertEl?.innerText?.trim() || null,
              hasReport: Boolean(reportEl),
              reportError: reportEl?.querySelector('[data-import-report-error]')?.innerText?.trim() || null,
              reportStatus: reportEl?.getAttribute('data-import-status') || null,
              toastText: toastEl?.innerText?.trim() || null,
              inEditor: !welcomeRoot,
              canvasNodes,
              canvasText: canvasText.slice(0, 8000),
              latestEntryMeta: latestEntry ? { elementsCount: latestEntry.elementsCount, tabsCount: latestEntry.tabsCount } : null,
              latestSnap: latestEntry?.snapshot || null,
              xssRan: Boolean(window.__xssExecuted || window.__onloadExecuted || document.body.getAttribute('data-script-ran')),
            };
          })()
        `);
      } catch (evalErr) {
        return {
          ok: false,
          shownError: `DONMA/ZAMAN_ASIMI: ${evalErr.message}`,
          durationMs: Math.round(performance.now() - t0),
          nodeCount: 0,
          pageCount: 0,
          turkishIntact: null,
          imagesPreserved: null,
          securityViolations: [],
          textCoveragePct: 0,
          crashed: true,
        };
      }

      if (state.errBoundary) break;
      if (MODE === 'legacy') {
        if (state.alertText || state.inEditor) break;
      } else {
        if (state.hasReport || state.alertText) break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const dt = Math.round(performance.now() - t0);
    if (!state) {
      return {
        ok: false,
        shownError: 'ZAMAN_ASIMI (render kilitlendi)',
        durationMs: dt,
        nodeCount: 0,
        pageCount: 0,
        turkishIntact: null,
        imagesPreserved: null,
        securityViolations: [],
        textCoveragePct: 0,
        crashed: true,
      };
    }

    let projectSchema = state.latestSnap || null;
    let openedInEditor = Boolean(state.inEditor);
    let canvasNodesCount = state.canvasNodes || 0;
    let canvasTextSample = state.canvasText || '';

    if (MODE === 'pipeline' && state.hasReport && state.reportStatus === 'success') {
      await cdp.evaluate(`
        (() => {
          const btn = document.querySelector('[data-import-open-editor]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 350));
      const afterOpen = await cdp.evaluate(`
        (() => {
          const recentRaw = localStorage.getItem('craftstudio.recentProjects.v1');
          const recent = recentRaw ? JSON.parse(recentRaw) : [];
          const latestEntry = recent[0] || null;
          return {
            inEditor: !document.querySelector('[data-welcome-root]'),
            canvasNodes: document.querySelectorAll('[data-element-id]').length,
            canvasText: (document.body.innerText || '').slice(0, 8000),
            latestEntryMeta: latestEntry ? { elementsCount: latestEntry.elementsCount, tabsCount: latestEntry.tabsCount } : null,
            latestSnap: latestEntry?.snapshot || null,
          };
        })()
      `);
      projectSchema = afterOpen.latestSnap;
      openedInEditor = afterOpen.inEditor;
      canvasNodesCount = afterOpen.canvasNodes;
      canvasTextSample = afterOpen.canvasText;
    }

    const ok = MODE === 'legacy'
      ? Boolean(openedInEditor && !state.alertText)
      : Boolean(state.reportStatus === 'success' && openedInEditor);

    const shownError = ok
      ? null
      : (state.reportError || state.alertText || state.toastText || (dt >= maxWaitMs ? 'ZAMAN_ASIMI (yanıtsız)' : 'sessiz'));

    let analysis;
    if (ok && projectSchema) {
      analysis = analyzeImportedProject(projectSchema, expectations, fixture.id);
    } else if (ok && !projectSchema) {
      // localStorage 5MB kotası nedeniyle snapshot kırpıldıysa (örn. big.html), tuval DOM'undan ölç
      const words = new Set(tokenizeNormalizedWords(canvasTextSample));
      let matched = 0;
      const lower = canvasTextSample.toLocaleLowerCase('tr-TR');
      for (const w of expectations.uniqueSourceWords) {
        if (words.has(w) || lower.includes(w)) matched += 1;
      }
      const cov = expectations.uniqueSourceWords.length
        ? Math.round((matched / expectations.uniqueSourceWords.length) * 100)
        : 100;
      analysis = {
        nodeCount: state.latestEntryMeta?.elementsCount || canvasNodesCount,
        pageCount: state.latestEntryMeta?.tabsCount || 1,
        turkishIntact: expectations.trChars.length ? expectations.trChars.every((c) => canvasTextSample.includes(c)) : null,
        imagesPreserved: null,
        securityViolations: [],
        textCoveragePct: cov,
      };
    } else {
      analysis = {
        nodeCount: 0,
        pageCount: 0,
        turkishIntact: null,
        imagesPreserved: null,
        securityViolations: [],
        textCoveragePct: 0,
      };
    }

    if (state.xssRan || jsDialogMessage) {
      analysis.securityViolations.push(`tarayici-calisan-betik:${jsDialogMessage || 'script'}`);
    }

    return {
      ok,
      shownError,
      durationMs: dt,
      ...analysis,
      crashed: crashed || Boolean(state.errBoundary) || pageErrors.length > 0 || (MODE === 'legacy' && fixture.id === 'huge.html' && dt >= maxWaitMs),
      pageErrors,
    };
  } finally {
    offException();
    offDialog();
    offCrash();
  }
}

async function measureLayoutFidelity(cdp, appUrl, staticUrl) {
  const layoutTargets = [
    { id: 'basic.html', urlPath: 'basic.html', fixtureRel: 'basic.html' },
    { id: 'landing-flex.html', urlPath: 'landing-flex.html', fixtureRel: 'landing-flex.html' },
    { id: 'inline-styles.html', urlPath: 'inline-styles.html', fixtureRel: 'inline-styles.html' },
    { id: 'folder-site/index.html', urlPath: 'folder-site/index.html', fixtureRel: 'folder-site/index.html' },
  ];

  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: 'https://*' }, { urlPattern: 'http://fonts.*' }],
  });
  const offFetch = cdp.on('Fetch.requestPaused', async (ev) => {
    try {
      await cdp.send('Fetch.failRequest', { requestId: ev.requestId, errorReason: 'Failed' });
    } catch {}
  });

  const results = [];
  try {
    for (const target of layoutTargets) {
      const slug = target.id.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
      await cdp.setViewport(1280, 1200);
      await cdp.navigate(`${staticUrl}/${target.urlPath}`);
      await new Promise((r) => setTimeout(r, 200));

      const origBlocks = await cdp.evaluate(`
        (() => {
          const selectors = 'nav, header, section, article, footer, h1, h2, h3, p, img, button';
          const list = [];
          document.querySelectorAll(selectors).forEach((el, idx) => {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return;
            list.push({
              idx,
              tag: el.tagName.toLowerCase(),
              text: (el.innerText || el.getAttribute('alt') || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
              x: Math.round(r.left),
              y: Math.round(r.top),
              width: Math.round(r.width),
              height: Math.round(r.height),
            });
          });
          return {
            bodyHeight: Math.round(document.body.scrollHeight),
            blocks: list,
          };
        })()
      `);
      const origShotPath = path.join(ARTIFACTS_DIR, `d-orig-${slug}.png`);
      const origBase64 = await cdp.screenshot(origShotPath);

      await cdp.setViewport(1440, 1000);
      const startUrl = MODE === 'pipeline' ? `${appUrl}/#/ice-aktar` : `${appUrl}/`;
      await cdp.navigate(startUrl);
      await cdp.evaluate('localStorage.clear();');
      await cdp.navigate(startUrl);

      const filePath = path.join(FIXTURES_DIR, target.fixtureRel);
      const inputSelector = MODE === 'pipeline' ? '[data-import-file-input]' : '[data-welcome-root] input[type="file"]';
      await cdp.setFileInputFiles(inputSelector, [filePath]);

      const waitStart = Date.now();
      while (Date.now() - waitStart < 10000) {
        const ready = await cdp.evaluate(`
          (() => {
            if (${MODE === 'pipeline'}) {
              const btn = document.querySelector('[data-import-open-editor]');
              if (btn) { btn.click(); return true; }
              return !document.querySelector('[data-welcome-root]');
            }
            return !document.querySelector('[data-welcome-root]');
          })()
        `);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 120));
      }
      await new Promise((r) => setTimeout(r, 450));

      const importedBlocks = await cdp.evaluate(`
        (() => {
          const recentRaw = localStorage.getItem('craftstudio.recentProjects.v1');
          const recent = recentRaw ? JSON.parse(recentRaw) : [];
          const snap = recent[0]?.snapshot || null;
          const activeTab = snap?.tabs?.[0];
          const flat = [];
          function walk(nodes, ax = 0, ay = 0) {
            for (const n of nodes || []) {
              const x = ax + (Number(n.x) || 0);
              const y = ay + (Number(n.y) || 0);
              flat.push({
                id: n.id,
                tag: String(n.type || 'div').toLowerCase(),
                text: String(n.textContent || n.attrs?.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(Number(n.width) || 0),
                height: Math.round(Number(n.height) || 0),
              });
              if (Array.isArray(n.children)) walk(n.children, x, y);
            }
          }
          walk(activeTab?.elements || [], 0, 0);
          return {
            canvasHeight: activeTab?.canvasByViewport?.desktop?.height || 1350,
            blocks: flat,
          };
        })()
      `);
      const editorShotPath = path.join(ARTIFACTS_DIR, `d-editor-${slug}-${MODE}.png`);
      const editorBase64 = await cdp.screenshot(editorShotPath);

      const compareShotPath = path.join(ARTIFACTS_DIR, `d-compare-${slug}-${MODE}.png`);
      const compareBase64 = await cdp.evaluate(`
        (async () => {
          const loadImg = (src) => new Promise((res) => {
            const im = new Image();
            im.onload = () => res(im);
            im.src = src;
          });
          const [im1, im2] = await Promise.all([
            loadImg('data:image/png;base64,${origBase64}'),
            loadImg('data:image/png;base64,${editorBase64}'),
          ]);
          const h = Math.max(im1.height, im2.height);
          const canvas = document.createElement('canvas');
          canvas.width = im1.width + im2.width + 16;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(im1, 0, 0);
          ctx.drawImage(im2, im1.width + 16, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        })()
      `);
      fs.writeFileSync(compareShotPath, Buffer.from(compareBase64, 'base64'));

      const blockDiffs = [];
      const usedImpIdx = new Set();
      for (const ob of origBlocks.blocks) {
        if (!['nav', 'header', 'section', 'article', 'footer', 'h1', 'h2', 'img', 'button'].includes(ob.tag)) continue;
        let bestIdx = -1;
        for (let i = 0; i < importedBlocks.blocks.length; i += 1) {
          if (usedImpIdx.has(i)) continue;
          const ib = importedBlocks.blocks[i];
          const tagMatch = ib.tag === ob.tag || (ob.tag === 'header' && ib.tag === 'div');
          if (!tagMatch) continue;
          if (ob.text && ib.text && (ib.text.includes(ob.text.slice(0, 12)) || ob.text.includes(ib.text.slice(0, 12)))) {
            bestIdx = i;
            break;
          }
          if (!ob.text && bestIdx === -1) bestIdx = i;
        }
        if (bestIdx === -1) {
          blockDiffs.push({
            tag: ob.tag,
            text: ob.text,
            matched: false,
            orig: { x: ob.x, y: ob.y, w: ob.width, h: ob.height },
            imported: null,
          });
        } else {
          usedImpIdx.add(bestIdx);
          const ib = importedBlocks.blocks[bestIdx];
          blockDiffs.push({
            tag: ob.tag,
            text: ob.text,
            matched: true,
            orig: { x: ob.x, y: ob.y, w: ob.width, h: ob.height },
            imported: { x: ib.x, y: ib.y, w: ib.width, h: ib.height },
            dx: ib.x - ob.x,
            dy: ib.y - ob.y,
            dw: ib.width - ob.width,
            dh: ib.height - ob.height,
          });
        }
      }

      const matchedDiffs = blockDiffs.filter((d) => d.matched);
      const meanAbsDx = matchedDiffs.length
        ? Math.round(matchedDiffs.reduce((s, d) => s + Math.abs(d.dx), 0) / matchedDiffs.length)
        : 0;
      const meanAbsDy = matchedDiffs.length
        ? Math.round(matchedDiffs.reduce((s, d) => s + Math.abs(d.dy), 0) / matchedDiffs.length)
        : 0;
      const meanAbsDw = matchedDiffs.length
        ? Math.round(matchedDiffs.reduce((s, d) => s + Math.abs(d.dw), 0) / matchedDiffs.length)
        : 0;
      const meanAbsDh = matchedDiffs.length
        ? Math.round(matchedDiffs.reduce((s, d) => s + Math.abs(d.dh), 0) / matchedDiffs.length)
        : 0;

      results.push({
        fixture: target.id,
        origBlockCount: origBlocks.blocks.length,
        importedBlockCount: importedBlocks.blocks.length,
        meanAbsDx,
        meanAbsDy,
        meanAbsDw,
        meanAbsDh,
        unmatchedMajorBlocks: blockDiffs.filter((d) => !d.matched).length,
        blockDiffs: blockDiffs.slice(0, 12),
        screenshots: {
          orig: path.relative(ROOT_DIR, origShotPath),
          editor: path.relative(ROOT_DIR, editorShotPath),
          compare: path.relative(ROOT_DIR, compareShotPath),
        },
      });
    }
  } finally {
    offFetch();
    try { await cdp.send('Fetch.disable'); } catch {}
  }

  return results;
}

async function main() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const fixtures = discoverFixtures();
  console.log(`\n🔬 İçe Aktarma Teşhis Matrisi [mod=${MODE}] — ${fixtures.length} fixture\n`);

  const rows = [];
  for (const fx of fixtures) {
    process.stdout.write(`  • Node ölçülüyor: ${fx.id}... `);
    const expectations = extractSourceExpectations(fx);
    const nodeRes = await runNodeCheck(fx, expectations);
    console.log(`${nodeRes.ok ? 'OK' : 'HATA'} (${nodeRes.durationMs}ms, ${nodeRes.nodeCount} düğüm)`);
    rows.push({
      id: fx.id,
      kind: fx.kind,
      expectOk: fx.expectOk,
      bytes: fx.kind === 'file' ? fs.statSync(fx.absPath).size : null,
      expectations: {
        wordCount: expectations.uniqueSourceWords.length,
        trChars: expectations.trChars.join(''),
        expectedImages: expectations.expectedImageCount,
      },
      node: nodeRes,
      browser: null,
    });
  }

  let layoutFidelity = [];
  if (!SKIP_CDP) {
    console.log('\n🌐 Tarayıcı (CDP) ölçümleri başlıyor...');
    const previewPort = await getFreePort();
    const staticPort = await getFreePort();
    const previewSrv = await startVitePreview(ROOT_DIR, previewPort);
    const staticSrv = await startStaticServer(FIXTURES_DIR, staticPort);
    let cdp = await launchChromiumCdp({ width: 1920, height: 1200 });

    try {
      for (const row of rows) {
        process.stdout.write(`  • CDP ölçülüyor: ${row.id}... `);
        const fx = fixtures.find((f) => f.id === row.id);
        const expectations = extractSourceExpectations(fx);
        row.browser = await runBrowserCheck(cdp, previewSrv.url, fx, expectations);
        console.log(`${row.browser.ok ? 'OK' : 'HATA'} (${row.browser.durationMs}ms, hata=${row.browser.shownError || '-'})`);
        // Legacy huge.html tarayıcıyı kilitlediyse yeni temiz CDP oturumu aç
        if (row.browser.crashed) {
          await cdp.close();
          cdp = await launchChromiumCdp({ width: 1920, height: 1200 });
        }
      }
      console.log('\n📐 D Sınıfı düzen sadakati ölçülüyor...');
      layoutFidelity = await measureLayoutFidelity(cdp, previewSrv.url, staticSrv.url);
    } finally {
      await cdp.close();
      await previewSrv.close();
      await staticSrv.close();
    }
  }

  console.log('\nFixture              | Node  | Tarayıcı | Hata Metni                | Süre(ms) | Düğüm | TR  | Görsel | Güvenlik | Kapsama');
  console.log('---------------------|-------|----------|---------------------------|----------|-------|-----|--------|----------|--------');
  for (const r of rows) {
    const nOk = r.node.ok ? 'OK   ' : 'HATA ';
    const bOk = r.browser ? (r.browser.ok ? 'OK      ' : 'HATA    ') : 'ATLANDI ';
    const errTxt = (r.browser?.shownError || r.node.errorText || '-').slice(0, 25).padEnd(25);
    const ms = String(r.browser?.durationMs ?? r.node.durationMs).padStart(8);
    const nodes = String(r.browser?.ok ? r.browser.nodeCount : r.node.nodeCount).padStart(5);
    const trFlag = (r.browser?.ok ? r.browser.turkishIntact : r.node.turkishIntact);
    const trStr = trFlag === null ? 'n/a' : (trFlag ? 'OK ' : 'BOZ');
    const imgFlag = (r.browser?.ok ? r.browser.imagesPreserved : r.node.imagesPreserved);
    const imgStr = imgFlag === null ? 'n/a   ' : (imgFlag ? 'OK    ' : 'KAYIP ');
    const secCount = (r.browser?.securityViolations?.length ?? 0) + (r.node.securityViolations?.length ?? 0);
    const secStr = (secCount === 0 ? 'TEMİZ' : `İHLAL(${secCount})`).padEnd(8);
    const cov = `${r.browser?.ok ? r.browser.textCoveragePct : r.node.textCoveragePct}%`;
    console.log(`${r.id.padEnd(20)} | ${nOk} | ${bOk} | ${errTxt} | ${ms} | ${nodes} | ${trStr} | ${imgStr} | ${secStr} | ${cov}`);
  }

  if (layoutFidelity.length > 0) {
    console.log('\n📐 D Sınıfı Düzen Sadakati Özeti:');
    for (const lf of layoutFidelity) {
      console.log(`  - ${lf.fixture}: ort |Δx|=${lf.meanAbsDx}px, |Δy|=${lf.meanAbsDy}px, |Δw|=${lf.meanAbsDw}px, |Δh|=${lf.meanAbsDh}px, eşleşmeyen=${lf.unmatchedMajorBlocks}`);
    }
  }

  const outJsonPath = path.join(ARTIFACTS_DIR, `matrix-${MODE}.json`);
  fs.writeFileSync(outJsonPath, JSON.stringify({ mode: MODE, timestamp: new Date().toISOString(), rows, layoutFidelity }, null, 2), 'utf8');
  console.log(`\n📄 Detaylı çıktı kaydedildi: ${path.relative(ROOT_DIR, outJsonPath)}`);

  if (MODE === 'pipeline') {
    for (const r of rows) {
      assert.equal(r.browser?.crashed, false, `${r.id} tarayıcıda çökmemeli`);
      assert.equal(r.node.securityViolations.length, 0, `${r.id} Node çıktısında güvenlik ihlali olmamalı: ${r.node.securityViolations.join(', ')}`);
      if (r.browser) {
        assert.equal(r.browser.securityViolations.length, 0, `${r.id} Tarayıcı çıktısında güvenlik ihlali olmamalı: ${r.browser.securityViolations.join(', ')}`);
      }
      if (r.expectOk === true) {
        assert.equal(r.node.ok, true, `${r.id} Node içe aktarmada başarılı olmalı: ${r.node.errorText}`);
        if (r.browser) assert.equal(r.browser.ok, true, `${r.id} Tarayıcı içe aktarmada başarılı olmalı: ${r.browser.shownError}`);
      } else if (r.expectOk === false) {
        assert.equal(r.node.ok, false, `${r.id} Node içe aktarmada reddedilmeli`);
        if (r.browser) {
          assert.equal(r.browser.ok, false, `${r.id} Tarayıcı içe aktarmada reddedilmeli`);
          assert.notEqual(r.browser.shownError, 'sessiz', `${r.id} hata mesajı sessiz kalmamalı`);
        }
      }
    }
    console.log('\n✅ Pipeline modu tüm matris kabullerini geçti!');
  }
}

main().catch((err) => {
  console.error('❌ Test matrisi hatası:', err);
  process.exit(1);
});
