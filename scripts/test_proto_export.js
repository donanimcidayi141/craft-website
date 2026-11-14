import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from '@babel/parser';
import { renderToStaticMarkup } from 'react-dom/server';
import sampleTree from '../src/proto/sampleTree.js';
import { compileStyles } from '../src/proto/compileStyles.js';
import { renderTree } from '../src/proto/renderTreeCore.js';
import { sanitizeNode } from '../src/proto/schema.js';
import { buildPreset, listPresets } from '../src/proto/presets.js';
import { exportStatic } from '../src/proto/exportStatic.js';
import { exportReact } from '../src/proto/exportReact.js';
import { computeCrc32, zipStore } from '../src/proto/zipStore.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function makeDetIdGen(prefixBase = 'exp') {
  let seq = 0;
  return (hint = 'n') => `${prefixBase}-${hint}-${++seq}`;
}

async function main() {
  console.log('\n🧪 CraftProto Faz 4a Yayın Hattı (Export, ZIP, React/Vite) Testleri');

  await test('exportStatic: sampleTree için sıfır editör sızıntısı, sıfır uyarı ve semantik HTML', () => {
    const res = exportStatic(sampleTree);
    assert.deepEqual(res.warnings, []);
    const html = res.files['index.html'];
    const css = res.files['styles.css'];

    assert.ok(html && html.includes('<!doctype html>'));
    assert.ok(html.includes('<html lang="tr">'));
    assert.ok(html.includes('<meta name="viewport"'));
    assert.ok(html.includes('<link rel="stylesheet" href="styles.css" />'));
    assert.ok(html.includes('<main class="n-page-home">'));
    assert.ok(html.includes('aria-hidden="true"'));
    assert.ok(html.includes('loading="lazy"'));

    // Editör-only iz ve script sızıntısı yok
    const lowerHtml = html.toLowerCase();
    assert.equal(lowerHtml.includes('<script'), false);
    assert.equal(html.includes('data-node-id'), false);
    assert.equal(html.includes('proto-'), false);
    assert.equal(html.includes('tabindex='), false);
    assert.equal(html.includes('draggable='), false);
    assert.equal(html.includes('contenteditable'), false);

    assert.equal(css.includes('data-node-id'), false);
    assert.equal(css.includes('proto-'), false);
    assert.equal(css.includes('user-select'), false);
    assert.equal(css.includes('-webkit-user-drag'), false);
    assert.equal(css.includes('[contenteditable]'), false);
    assert.equal(/\bhover\b/i.test(css), false);
    assert.equal(/\bselected\b/i.test(css), false);

    // Editör modu renderTree davranışını bozmadığını doğrula
    const editMarkup = renderToStaticMarkup(renderTree(sampleTree, { mode: 'edit' }));
    assert.ok(editMarkup.includes('data-node-id="page-home"'));
  });

  await test('exportStatic & exportReact: tüm 6 preset sıfır uyarı ile derlenir', () => {
    const idGen = makeDetIdGen('preset');
    const combinedTree = {
      ...sampleTree,
      children: [...sampleTree.children, ...listPresets().map((name) => buildPreset(name, {}, idGen))],
    };

    const statRes = exportStatic(combinedTree);
    assert.deepEqual(statRes.warnings, []);
    assert.ok(statRes.files['index.html'].length > 500);

    const reactRes = exportReact(combinedTree);
    assert.deepEqual(reactRes.warnings, []);
    assert.equal(reactRes.files['src/styles.css'], statRes.files['styles.css']);
  });

  await test('enjekte saldırı dayanımı: script/style/attr/CSS kaçışları ve tehlikeli URL reddi', () => {
    const attackTree = {
      id: 'page-sec',
      type: 'page',
      children: [
        {
          id: 'sec-attack',
          type: 'section',
          layout: { mode: 'stack', gap: 'md', padding: 'lg' },
          size: { w: 'fill', h: 'hug' },
          children: [
            {
              id: 'txt-xss',
              type: 'text',
              props: {
                tag: 'h1',
                text: '</style><script>alert(1)</script> & {injected}',
                fontFamily: '}</style><script>bad()</script>',
              },
            },
            {
              id: 'btn-xss',
              type: 'button',
              props: {
                label: '"><img src=x onerror=alert(1)>',
                href: 'javascript:alert(1)',
              },
            },
            {
              id: 'img-local',
              type: 'image',
              props: {
                src: './assets/secret.png',
                alt: '" onerror="alert(2)',
              },
            },
            {
              id: 'img-js',
              type: 'image',
              props: {
                src: 'javascript:alert(3)',
                alt: 'Zararlı görsel',
              },
            },
          ],
        },
      ],
    };

    const metaOpts = {
      title: '</title><script>alert(9)</script>"',
      lang: 'tr" onload="alert(1)',
      description: '"><img src=x onerror=alert(8)>',
      inlineCss: true,
    };

    const statRes = exportStatic(attackTree, metaOpts);
    const html = statRes.files['index.html'];
    const css = statRes.files['styles.css'];

    assert.equal(html.toLowerCase().includes('<script'), false);
    assert.equal(html.includes('javascript:'), false);
    // Tırnaklı öznitelik değerleri çıkarıldığında etiketlerde gerçek onerror=/onload= özniteliği olmamalıdır
    const htmlWithoutQuotedAttrValues = html.replace(/"[^"]*"/g, '""');
    assert.equal(/<[^>]*\son(?:error|load)\s*=/i.test(htmlWithoutQuotedAttrValues), false);
    assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('alt="&quot; onerror=&quot;alert(2)"'));
    assert.equal(html.includes('src=""'), false);
    assert.equal(css.includes('}</style>'), false);
    assert.ok(html.includes('&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('href="#"'));

    // Uyarılar her iki geçersiz görsel kaynağını da raporlamalı
    assert.equal(statRes.warnings.length, 2);
    assert.ok(statRes.warnings.some((w) => w.includes('img-local')));
    assert.ok(statRes.warnings.some((w) => w.includes('img-js')));

    const reactRes = exportReact(attackTree, metaOpts);
    const ast = parse(reactRes.files['src/App.jsx'], {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    assert.equal(ast.type, 'File');
    assert.equal(reactRes.files['src/App.jsx'].includes('javascript:'), false);
    assert.equal(reactRes.files['src/App.jsx'].includes('dangerouslySetInnerHTML'), false);
    assert.equal(reactRes.files['index.html'].toLowerCase().includes('<script type="module"'), true);
    assert.equal(reactRes.files['index.html'].includes('alert(9)'), true); // metin olarak escaped
    assert.equal(reactRes.files['index.html'].includes('<script>alert(9)</script>'), false);
  });

  await test('uyarılar: akışta sabit piksel yükseklik uyarır, layer boyutu uyarmaz', () => {
    const warnTree = {
      id: 'page-warn',
      type: 'page',
      children: [
        {
          id: 'sec-warn',
          type: 'section',
          layout: { mode: 'stack', gap: 'md', padding: 'md' },
          size: { w: 'fill', h: '260px' },
          responsive: {
            sm: { size: { h: '180px' } },
          },
          children: [
            {
              id: 'layer-ok',
              type: 'blob',
              placement: 'layer',
              pos: { x: 50, y: 50 },
              size: { w: '240px', h: '240px' },
              props: {},
            },
          ],
        },
      ],
    };

    const res = exportStatic(warnTree);
    assert.equal(res.warnings.length, 2);
    assert.ok(res.warnings.some((w) => w.includes('260px')));
    assert.ok(res.warnings.some((w) => w.includes('180px')));
    assert.equal(res.warnings.some((w) => w.includes('layer-ok')), false);
  });

  await test('zipStore: PK başlıkları, CRC-32, UTF-8 bayrağı ve sistem unzip doğrulaması', () => {
    const statRes = exportStatic(sampleTree);
    const files = {
      ...statRes.files,
      'notlar/örnek-bölüm.txt': 'Merhaba dünya ğüşıöç İıĞÜŞÖÇ\n',
    };

    const zipBytes = zipStore(files);
    const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

    // Local File Header imzası: PK\x03\x04
    assert.equal(view.getUint32(0, true), 0x04034b50);
    // General purpose bit flag: UTF-8 (0x0800)
    assert.equal(view.getUint16(6, true), 0x0800);
    // Compression method: 0 (STORE)
    assert.equal(view.getUint16(8, true), 0);

    // CRC-32 kontrolü
    const hello = new TextEncoder().encode('123456789');
    assert.equal(computeCrc32(hello), 0xcbf43926);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-zip-test-'));
    try {
      const zipPath = path.join(tmpDir, 'site.zip');
      const extractDir = path.join(tmpDir, 'out');
      fs.mkdirSync(extractDir);
      fs.writeFileSync(zipPath, zipBytes);

      const testOut = execFileSync('unzip', ['-t', zipPath], { encoding: 'utf8' });
      assert.ok(testOut.includes('No errors detected'));

      execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir], { encoding: 'utf8' });
      assert.equal(
        fs.readFileSync(path.join(extractDir, 'index.html'), 'utf8'),
        files['index.html']
      );
      assert.equal(
        fs.readFileSync(path.join(extractDir, 'styles.css'), 'utf8'),
        files['styles.css']
      );
      assert.equal(
        fs.readFileSync(path.join(extractDir, 'notlar/örnek-bölüm.txt'), 'utf8'),
        files['notlar/örnek-bölüm.txt']
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await test('exportReact: dosya yapısı, package.json sürümleri ve @babel/parser JSX AST doğrulaması', () => {
    const res = exportReact(sampleTree);
    assert.deepEqual(res.warnings, []);
    assert.deepEqual(
      Object.keys(res.files).sort(),
      [
        'index.html',
        'package.json',
        'src/App.jsx',
        'src/main.jsx',
        'src/styles.css',
        'vite.config.js',
      ].sort()
    );

    const pkg = JSON.parse(res.files['package.json']);
    assert.equal(pkg.dependencies.react, '^19.0.0');
    assert.equal(pkg.dependencies['react-dom'], '^19.0.0');
    assert.equal(pkg.devDependencies.vite, '^6.1.0');
    assert.equal(pkg.devDependencies['@vitejs/plugin-react'], '^4.3.4');

    const appJsx = res.files['src/App.jsx'];
    assert.ok(appJsx.includes('export default function App()'));
    assert.ok(appJsx.includes('n-page-home'));
    assert.equal(appJsx.includes('data-node-id'), false);
    assert.equal(appJsx.includes('dangerouslySetInnerHTML'), false);

    const ast = parse(appJsx, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    assert.equal(ast.type, 'File');
    assert.ok(ast.program.body.some((stmt) => stmt.type === 'ExportDefaultDeclaration'));

    const expectedCss = compileStyles(sanitizeNode(sampleTree), { includeBase: true });
    assert.equal(res.files['src/styles.css'], expectedCss);
  });

  console.log(`\nSonuç: ${passed}/6 test geçti.\n`);
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

main();
