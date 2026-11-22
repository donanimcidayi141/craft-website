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

async function sendCtrlShortcut(cdp, keyChar, keyCode, virtualKeyCode) {
  await cdp.evaluate(`document.activeElement?.blur?.()`);
  await new Promise((r) => setTimeout(r, 40));
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    modifiers: 2, // Ctrl
    key: keyChar,
    code: keyCode,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    modifiers: 2,
    key: keyChar,
    code: keyCode,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
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

    // 1. Katmanlar panelini aç & kapat
    await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
    const layersVisible = await waitFor(
      cdp,
      `Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]'))`
    );
    assert.ok(layersVisible, 'Katmanlar çekmecesi açılamadı.');

    await cdp.evaluate(`document.querySelector('button[title="Sol paneli gizle"]')?.click()`);
    const layersClosed = await waitFor(
      cdp,
      `!document.querySelector('input[placeholder="Katmanlarda ara..."]')`
    );
    assert.ok(layersClosed, 'Katmanlar çekmecesi kapatılamadı.');
    console.log('  ✓ Katmanlar paneli açılıp kapatıldı');

    // 2. Şablonlar & Assetler panelini aç, hazır blok ekle (handleAddPreset), sonra kapat
    await clickWindowMenuItem(cdp, 'Assetler');
    const assetsVisible = await waitFor(
      cdp,
      `Boolean(document.querySelector('input[placeholder="Şablon veya blok ara..."]'))`
    );
    assert.ok(assetsVisible, 'Assetler & Şablonlar çekmecesi açılamadı.');

    const beforePresetCount = await cdp.evaluate(
      `document.querySelectorAll('#artboard-canvas > [data-element-id]').length`
    );
    const clickedPreset = await cdp.evaluate(`
      (() => {
        const addBtns = Array.from(document.querySelectorAll('button'));
        const sayfaEkleBtn = addBtns.find((b) => b.textContent && b.textContent.includes('Sayfaya Ekle'));
        const card = sayfaEkleBtn?.closest('div.cursor-pointer') || sayfaEkleBtn;
        if (!card) return false;
        card.click();
        return true;
      })()
    `);
    assert.ok(clickedPreset, 'Hazır blok ekleme kartı bulunamadı.');

    const presetAdded = await waitFor(
      cdp,
      `document.querySelectorAll('#artboard-canvas > [data-element-id]').length > ${beforePresetCount}`
    );
    assert.ok(presetAdded, 'Hazır blok (handleAddPreset) tuvale eklenemedi.');

    await clickWindowMenuItem(cdp, 'Assetler');
    const assetsClosed = await waitFor(
      cdp,
      `!document.querySelector('input[placeholder="Şablon veya blok ara..."]')`
    );
    assert.ok(assetsClosed, 'Assetler & Şablonlar çekmecesi kapatılamadı.');
    console.log('  ✓ Hazır blok eklendi (handleAddPreset) ve Assetler paneli kapatıldı');

    // 3. Bir elemanı taşı (CDP gerçek fare sürüklemesi) + Ctrl+Z / Ctrl+Y
    const dragTarget = await cdp.evaluate(`
      (() => {
        const nodes = Array.from(document.querySelectorAll('#artboard-canvas > [data-element-id]'));
        const target = nodes[nodes.length - 1];
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        return {
          id: target.getAttribute('data-element-id'),
          cx: Math.round(rect.left + Math.min(rect.width / 2, 60)),
          cy: Math.round(rect.top + Math.min(rect.height / 2, 30)),
          left: target.style.left,
          top: target.style.top,
        };
      })()
    `);
    assert.ok(dragTarget && dragTarget.id, 'Taşınacak eleman bulunamadı.');

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragTarget.cx, y: dragTarget.cy });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: dragTarget.cx,
      y: dragTarget.cy,
      button: 'left',
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 40));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: dragTarget.cx + 25,
      y: dragTarget.cy + 15,
      button: 'left',
    });
    await new Promise((r) => setTimeout(r, 30));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: dragTarget.cx + 55,
      y: dragTarget.cy + 35,
      button: 'left',
    });
    await new Promise((r) => setTimeout(r, 40));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: dragTarget.cx + 55,
      y: dragTarget.cy + 35,
      button: 'left',
      clickCount: 1,
    });

    const moved = await waitFor(
      cdp,
      `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return Boolean(el) && (el.style.left !== ${JSON.stringify(dragTarget.left)} || el.style.top !== ${JSON.stringify(dragTarget.top)});
      })()`
    );
    assert.ok(moved, 'Eleman sürüklenerek taşınamadı.');
    const movedPos = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return { left: el?.style.left, top: el?.style.top };
      })()
    `);
    console.log('  ✓ Eleman sürüklenerek taşındı');

    // Ctrl+Z -> eski konuma dönmeli, Ctrl+Y -> taşınmış konuma gitmeli
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    const undone = await waitFor(
      cdp,
      `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return Boolean(el) && el.style.left === ${JSON.stringify(dragTarget.left)} && el.style.top === ${JSON.stringify(dragTarget.top)};
      })()`
    );
    assert.ok(undone, 'Ctrl+Z sonrası eleman eski konumuna dönmedi.');

    await sendCtrlShortcut(cdp, 'y', 'KeyY', 89);
    const redone = await waitFor(
      cdp,
      `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return Boolean(el) && el.style.left === ${JSON.stringify(movedPos.left)} && el.style.top === ${JSON.stringify(movedPos.top)};
      })()`
    );
    assert.ok(redone, 'Ctrl+Y sonrası eleman taşınan konumuna geri gelmedi.');
    console.log('  ✓ Ctrl+Z (Geri Al) ve Ctrl+Y (İleri Al) doğrulandı');

    // 4. Sağ Özellikler Dock'unu daralt & tekrar aç, Yüzen CSS & Nitelik Penceresi aç & kapat
    const rightToggled = await cdp.evaluate(`
      (() => {
        const collapseBtn = document.querySelector('button[title="Sağ Paneli Daralt"], button[title="Sağ paneli daralt"]');
        if (!collapseBtn) return false;
        collapseBtn.click();
        return true;
      })()
    `);
    assert.ok(rightToggled, 'Sağ dock daraltma butonu bulunamadı.');
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[title="Sağ Paneli Aç"]'))`),
      'Sağ dock daraltılamadı.'
    );
    await cdp.evaluate(`document.querySelector('button[title="Sağ Paneli Aç"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[title="Sağ Paneli Daralt"], button[title="Sağ paneli daralt"]'))`),
      'Sağ dock tekrar açılamadı.'
    );
    console.log('  ✓ Sağ Özellikler dock kapatılıp açıldı');

    await cdp.evaluate(`document.querySelector('button[title="Yüzen CSS & Nitelik Penceresi"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('CSS & Nitelik Penceresi')`),
      'Yüzen CSS & Nitelik Penceresi açılamadı.'
    );
    await cdp.evaluate(`document.querySelector('button[title="Yüzen CSS & Nitelik Penceresi"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `!document.body.innerText.includes('CSS & Nitelik Penceresi')`),
      'Yüzen CSS & Nitelik Penceresi kapatılamadı.'
    );
    console.log('  ✓ Yüzen CSS & Nitelik penceresi açılıp kapatıldı');

    // 5. Sol ray araçları ve Izgara/Cetvel açma-kapama
    await cdp.evaluate(`
      (() => {
        document.querySelector('button[data-tool-id="zoom"]')?.click();
        document.querySelector('button[data-tool-id="select"]')?.click();
        document.querySelector('button[data-rail-popover="view"]')?.click();
      })()
    `);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-toggle-grid]'))`),
      'Görünüm popover açılamadı.'
    );
    await cdp.evaluate(`
      (() => {
        document.querySelector('button[data-toggle-grid]')?.click();
        document.querySelector('button[data-toggle-rulers]')?.click();
      })()
    `);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('[data-layout-grid-overlay]')) && Boolean(document.querySelector('[data-ruler="top"]'))`),
      'Izgara veya cetvel overlay açılamadı.'
    );
    console.log('  ✓ Araç rayı, ızgara ve cetvel kontrolleri doğrulandı');

    // 6. Yeni sekme ekle ve sekmeler arası geç
    await cdp.evaluate(`document.querySelector('button[title="Yeni Sayfa Sekmesi Ekle"]')?.click()`);
    const newTabReady = await waitFor(
      cdp,
      `document.body.innerText.includes('Sayfa-2.craft') && document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 0`
    );
    assert.ok(newTabReady, 'Yeni sayfa sekmesi (Sayfa-2.craft) eklenemedi.');

    await cdp.evaluate(`
      (() => {
        const tab = document.querySelector('div[title^="Anasayfa.craft"]');
        tab?.click();
      })()
    `);
    const switchedBackToFirst = await waitFor(
      cdp,
      `document.querySelectorAll('#artboard-canvas > [data-element-id]').length > 0`
    );
    assert.ok(switchedBackToFirst, 'İlk sekmeye geri geçilemedi.');
    console.log('  ✓ Yeni sekme eklendi ve sekmeler arası geçiş doğrulandı');

    // 7. Viewport Tablet -> Mobil -> Masaüstü geçişleri
    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Tablet viewport (768px) geçişi başarısız.'
    );
    await cdp.evaluate(`document.querySelector('button[title^="Mobil Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '375px'`),
      'Mobil viewport (375px) geçişi başarısız.'
    );
    await cdp.evaluate(`document.querySelector('button[title^="Masaüstü Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '1280px'`),
      'Masaüstü viewport (1280px) dönüşü başarısız.'
    );
    console.log('  ✓ Tablet / Mobil / Masaüstü viewport geçişleri doğrulandı');

    // 8. Projeyi kaydet, ana sayfaya dön ve son projelerden tekrar aç
    const savedRootCount = await cdp.evaluate(
      `document.querySelectorAll('#artboard-canvas > [data-element-id]').length`
    );
    await cdp.evaluate(`document.querySelector('button[title="Projeyi Kaydet (Ctrl+S)"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('✓ Kaydedildi')`),
      'Proje kaydedildi durumu görülmedi.'
    );

    await cdp.evaluate(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Projeler'
        );
        homeBtn?.click();
      })()
    `);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('#welcome-recent .welcome-project-row__main'))`),
      'Ana sayfada kaydedilen son proje satırı bulunamadı.'
    );

    await cdp.evaluate(`document.querySelector('#welcome-recent .welcome-project-row__main')?.click()`);
    const reopened = await waitFor(
      cdp,
      `Boolean(document.getElementById('artboard-canvas')) && document.body.innerText.includes('Sayfa-2.craft') && document.querySelectorAll('#artboard-canvas > [data-element-id]').length === ${savedRootCount}`
    );
    assert.ok(reopened, 'Kaydedilen proje tekrar açıldığında sekmeler veya eleman sayısı eşleşmedi.');
    console.log('  ✓ Proje kaydedilip son projelerden tekrar açıldı');

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
