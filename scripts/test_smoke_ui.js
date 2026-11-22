import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getFreePort,
  launchChromiumCdp,
  startVitePreview,
} from './_cdpHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function waitFor(cdp, jsPredicate, timeoutMs = 10000, stepMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await cdp.evaluate(jsPredicate);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

async function clickWindowMenuItem(cdp, itemSubstring) {
  const openedMenu = await cdp.evaluate(`
    (() => {
      const menuBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.trim() === 'Pencere'
      );
      if (!menuBtn) return false;
      menuBtn.click();
      return true;
    })()
  `);
  assert.ok(openedMenu, 'Pencere menü butonu bulunamadı.');

  const clickedItem = await waitFor(
    cdp,
    `(() => {
      const item = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes(${JSON.stringify(itemSubstring)})
      );
      if (!item) return false;
      item.click();
      return true;
    })()`
  );
  assert.ok(clickedItem, `Pencere > ${itemSubstring} menü öğesi bulunamadı.`);
}

async function main() {
  const distIndex = path.join(ROOT_DIR, 'dist', 'index.html');
  assert.ok(fs.existsSync(distIndex), 'dist/index.html bulunamadı; önce npm run build çalıştırılmalı.');

  const port = await getFreePort();
  const preview = await startVitePreview(ROOT_DIR, port);
  const cdp = await launchChromiumCdp({ width: 1440, height: 960 });

  const consoleErrors = [];
  const uncaughtExceptions = [];

  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      const text = (params.args || [])
        .map((a) => a.value ?? a.description ?? '')
        .join(' ');
      consoleErrors.push(text || 'Console error');
    }
  });

  cdp.on('Runtime.exceptionThrown', (params) => {
    const desc =
      params.exceptionDetails?.exception?.description ||
      params.exceptionDetails?.text ||
      'Uncaught exception';
    uncaughtExceptions.push(desc);
  });

  try {
    console.log('\n🧪 CraftStudio UI Smoke Test (Headless Chromium CDP)');

    await cdp.navigate(preview.url);
    await cdp.evaluate('localStorage.clear();');
    await cdp.navigate(preview.url);

    const welcomeLoaded = await waitFor(
      cdp,
      `Boolean(document.querySelector('#welcome-create'))`
    );
    assert.ok(welcomeLoaded, 'Karşılama ekranı yüklenemedi.');
    console.log('  ✓ Karşılama ekranı yüklendi');

    const enteredStudio = await cdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('#welcome-create button'));
        const templateBtn = btns.find((b) => b.textContent && b.textContent.includes('Aurelia Vitrin'));
        if (!templateBtn) return false;
        templateBtn.click();
        return true;
      })()
    `);
    assert.ok(enteredStudio, 'Aurelia Vitrin başlatma butonu bulunamadı.');

    const artboardReady = await waitFor(
      cdp,
      `Boolean(document.getElementById('artboard-canvas')) && !document.querySelector('#welcome-create')`
    );
    assert.ok(artboardReady, 'Atölye tuvali (#artboard-canvas) açılamadı.');
    console.log('  ✓ Atölyeye giriş yapıldı ve tuval görüntülendi');

    // 1. Katmanlar panelini aç, bir öğe seç, sonra paneli kapat
    await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
    const layersVisible = await waitFor(
      cdp,
      `Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]'))`
    );
    assert.ok(layersVisible, 'Katmanlar çekmecesi açılamadı.');

    await cdp.evaluate(`
      (() => {
        const firstEl = document.querySelector('#artboard-canvas [data-element-id]');
        if (firstEl) {
          firstEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
          firstEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
        }
      })()
    `);

    await cdp.evaluate(`document.querySelector('button[title="Sol paneli gizle"]')?.click()`);
    const layersClosed = await waitFor(
      cdp,
      `!document.querySelector('input[placeholder="Katmanlarda ara..."]')`
    );
    assert.ok(layersClosed, 'Katmanlar çekmecesi kapatılamadı.');
    console.log('  ✓ Katmanlar paneli açılıp kapatıldı');

    // 2. Şablonlar & Assetler panelini aç & kapat
    await clickWindowMenuItem(cdp, 'Assetler');
    const assetsVisible = await waitFor(
      cdp,
      `Boolean(document.querySelector('input[placeholder="Şablon veya blok ara..."]'))`
    );
    assert.ok(assetsVisible, 'Assetler & Şablonlar çekmecesi açılamadı.');

    await clickWindowMenuItem(cdp, 'Assetler');
    const assetsClosed = await waitFor(
      cdp,
      `!document.querySelector('input[placeholder="Şablon veya blok ara..."]')`
    );
    assert.ok(assetsClosed, 'Assetler & Şablonlar çekmecesi kapatılamadı.');
    console.log('  ✓ Şablonlar & Assetler paneli açılıp kapatıldı');

    // 3. Sağ Özellikler Dock'unu daralt & tekrar aç
    const rightToggled = await cdp.evaluate(`
      (() => {
        const collapseBtn = document.querySelector('button[title="Sağ Paneli Daralt"], button[title="Sağ paneli daralt"]');
        if (!collapseBtn) return false;
        collapseBtn.click();
        return true;
      })()
    `);
    assert.ok(rightToggled, 'Sağ dock daraltma butonu bulunamadı.');
    const rightCollapsed = await waitFor(
      cdp,
      `Boolean(document.querySelector('button[title="Sağ Paneli Aç"]'))`
    );
    assert.ok(rightCollapsed, 'Sağ dock daraltılamadı.');

    await cdp.evaluate(`document.querySelector('button[title="Sağ Paneli Aç"]')?.click()`);
    const rightReopened = await waitFor(
      cdp,
      `Boolean(document.querySelector('button[title="Sağ Paneli Daralt"], button[title="Sağ paneli daralt"]'))`
    );
    assert.ok(rightReopened, 'Sağ dock tekrar açılamadı.');
    console.log('  ✓ Sağ Özellikler dock kapatılıp açıldı');

    // 4. Yüzen CSS & Nitelik Penceresini aç & kapat
    await cdp.evaluate(`document.querySelector('button[title="Yüzen CSS & Nitelik Penceresi"]')?.click()`);
    const floatingOpened = await waitFor(
      cdp,
      `document.body.innerText.includes('CSS & Nitelik Penceresi')`
    );
    assert.ok(floatingOpened, 'Yüzen CSS & Nitelik Penceresi açılamadı.');
    await cdp.evaluate(`document.querySelector('button[title="Yüzen CSS & Nitelik Penceresi"]')?.click()`);
    const floatingClosed = await waitFor(
      cdp,
      `!document.body.innerText.includes('CSS & Nitelik Penceresi')`
    );
    assert.ok(floatingClosed, 'Yüzen CSS & Nitelik Penceresi kapatılamadı.');
    console.log('  ✓ Yüzen CSS & Nitelik penceresi açılıp kapatıldı');

    // 5. Sol ray araçları ve Izgara/Cetvel açma-kapama
    await cdp.evaluate(`
      (() => {
        document.querySelector('button[data-tool-id="zoom"]')?.click();
        document.querySelector('button[data-tool-id="select"]')?.click();
        document.querySelector('button[data-rail-popover="view"]')?.click();
      })()
    `);
    const viewPopoverOpen = await waitFor(
      cdp,
      `Boolean(document.querySelector('button[data-toggle-grid]'))`
    );
    assert.ok(viewPopoverOpen, 'Görünüm popover açılamadı.');

    await cdp.evaluate(`
      (() => {
        document.querySelector('button[data-toggle-grid]')?.click();
        document.querySelector('button[data-toggle-rulers]')?.click();
      })()
    `);
    const gridAndRulerVisible = await waitFor(
      cdp,
      `Boolean(document.querySelector('[data-layout-grid-overlay]')) && Boolean(document.querySelector('[data-ruler="top"]'))`
    );
    assert.ok(gridAndRulerVisible, 'Izgara veya cetvel overlay açılamadı.');
    console.log('  ✓ Araç rayı, ızgara ve cetvel kontrolleri doğrulandı');

    await new Promise((r) => setTimeout(r, 250));

    assert.deepEqual(uncaughtExceptions, [], `Yakalanmayan JS hatası oluştu: ${uncaughtExceptions.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `Konsol hatası oluştu: ${consoleErrors.join(' | ')}`);
    console.log('  ✓ Konsol hatası ve ReferenceError yok (0 hata)');
    console.log('\n🎉 UI SMOKE TEST BAŞARIYLA GEÇTİ!\n');
  } finally {
    await cdp.close();
    await preview.close();
  }
}

main().catch((err) => {
  console.error('\n❌ UI SMOKE TEST HATASI:', err);
  process.exit(1);
});
