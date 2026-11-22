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

async function findVisiblePointForElement(cdp, elementId = null) {
  return cdp.evaluate(`
    (() => {
      const candidates = ${elementId
        ? `[document.querySelector('#artboard-canvas > [data-element-id="${elementId}"]')].filter(Boolean)`
        : `Array.from(document.querySelectorAll('#artboard-canvas > [data-element-id]'))`};
      for (const el of candidates) {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 16) continue;
        const sampleFractions = [
          [0.5, 0.5],
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.5, 0.2],
        ];
        for (const [fx, fy] of sampleFractions) {
          const px = Math.round(rect.left + rect.width * fx);
          const py = Math.round(rect.top + rect.height * fy);
          const hit = document.elementFromPoint(px, py);
          const hitNode = hit?.closest?.('[data-element-id]');
          if (hit === el || hitNode === el) {
            return {
              id: el.getAttribute('data-element-id'),
              left: el.style.left,
              top: el.style.top,
              width: el.style.width,
              height: el.style.height,
              cx: px,
              cy: py,
            };
          }
        }
      }
      return null;
    })()
  `);
}

async function dragOnScreen(cdp, fromX, fromY, dx, dy) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fromX, y: fromY });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: fromX,
    y: fromY,
    button: 'left',
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 40));
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(fromX + dx / 2),
    y: Math.round(fromY + dy / 2),
    button: 'left',
  });
  await new Promise((r) => setTimeout(r, 30));
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(fromX + dx),
    y: Math.round(fromY + dy),
    button: 'left',
  });
  await new Promise((r) => setTimeout(r, 40));
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(fromX + dx),
    y: Math.round(fromY + dy),
    button: 'left',
    clickCount: 1,
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

    // 6. Yeni sekmede tablete geçiş + sayfa yüksekliği uyumu + iki sekmede bağımsız düzenleme ve Ctrl+Z izolasyonu
    await cdp.evaluate(`document.querySelector('button[title="Yeni Sayfa Sekmesi Ekle"]')?.click()`);
    const newTabReady = await waitFor(
      cdp,
      `document.body.innerText.includes('Sayfa-2.craft') && document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 0`
    );
    assert.ok(newTabReady, 'Yeni sayfa sekmesi (Sayfa-2.craft) eklenemedi.');

    // Yeni sekme (Sayfa-2.craft) aktifken tablete geç ve sayfa yüksekliğinin canvas viewport'una sığdığını doğrula
    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Yeni sekmede Tablet viewport (768px) geçişi başarısız.'
    );
    await new Promise((r) => setTimeout(r, 250));
    const newTabTabletFit = await cdp.evaluate(`
      (() => {
        const art = document.getElementById('artboard-canvas');
        const wrap = document.getElementById('canvas-wrapper');
        if (!art || !wrap) return null;
        const artRect = art.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        return {
          styleWidth: parseFloat(art.style.width) || 0,
          styleHeight: parseFloat(art.style.height) || 0,
          artRectW: artRect.width,
          artRectH: artRect.height,
          wrapRectW: wrapRect.width,
          wrapRectH: wrapRect.height,
        };
      })()
    `);
    assert.ok(newTabTabletFit, 'Yeni sekmede artboard veya canvas wrapper ölçülemedi.');
    assert.ok(
      newTabTabletFit.styleHeight >= 1650 &&
      newTabTabletFit.artRectH > 0 &&
      newTabTabletFit.artRectH <= newTabTabletFit.wrapRectH &&
      newTabTabletFit.artRectW <= newTabTabletFit.wrapRectW,
      `Yeni sekmede tablet sayfa yüksekliği canvas alanına sığmadı: ${JSON.stringify(newTabTabletFit)}`
    );
    console.log('  ✓ Yeni sekmede tablete geçildi ve sayfa yüksekliğinin canvasa sığdığı doğrulandı');

    // Masaüstüne dönüp Sayfa-2.craft içine Dikdörtgen aracıyla bir eleman çiz
    await cdp.evaluate(`document.querySelector('button[title^="Masaüstü Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '1280px'`),
      'Sayfa-2 masaüstü dönüşü başarısız.'
    );
    await new Promise((r) => setTimeout(r, 200));

    await cdp.evaluate(`document.querySelector('button[data-tool-id="rectangle"]')?.click()`);
    const drawOrigin = await cdp.evaluate(`
      (() => {
        const art = document.getElementById('artboard-canvas');
        const r = art?.getBoundingClientRect();
        return r ? { x: Math.round(r.left + 80), y: Math.round(r.top + 80) } : null;
      })()
    `);
    assert.ok(drawOrigin, 'Sayfa-2 çizim koordinatı alınamadı.');
    await dragOnScreen(cdp, drawOrigin.x, drawOrigin.y, 120, 70);

    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 1`),
      'Sayfa-2.craft üzerine çizilen eleman oluşturulamadı.'
    );
    await cdp.evaluate(`document.querySelector('button[data-tool-id="select"]')?.click()`);
    const tab2ElInitial = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id]');
        if (!el) return null;
        return { id: el.getAttribute('data-element-id'), left: el.style.left, top: el.style.top };
      })()
    `);
    assert.ok(tab2ElInitial?.id, 'Sayfa-2.craft elemanı okunamadı.');

    // İlk sekmeye geç, görünür/tıklanabilir bir elemanı seçip taşı (Tab 1 edit)
    await cdp.evaluate(`document.querySelector('div[title^="Anasayfa.craft"]')?.click()`);
    const switchedBackToFirst = await waitFor(
      cdp,
      `Boolean(document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]')) && document.querySelectorAll('#artboard-canvas > [data-element-id]').length > 1`
    );
    assert.ok(switchedBackToFirst, 'İlk sekmeye geri geçilemedi.');
    await new Promise((r) => setTimeout(r, 250));

    // Eğer Görünüm popover açık kaldıysa kapat
    await cdp.evaluate(`
      (() => {
        if (document.querySelector('button[data-toggle-grid]')) {
          document.querySelector('button[data-rail-popover="view"]')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 100));

    const tab1Target = (await findVisiblePointForElement(cdp, dragTarget.id)) || (await findVisiblePointForElement(cdp, null));
    assert.ok(tab1Target && tab1Target.id, 'Anasayfa.craft üzerinde sürüklenebilir eleman noktası bulunamadı.');
    const tab1TargetId = tab1Target.id;

    // Container içine oto-parenting düşebileceğinden descendant dahil [data-element-id] ile izle
    await dragOnScreen(cdp, tab1Target.cx, tab1Target.cy, -24, -14);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${tab1TargetId}"]');
        return Boolean(el) && (el.style.left !== ${JSON.stringify(tab1Target.left)} || el.style.top !== ${JSON.stringify(tab1Target.top)});
      })()`, 3000),
      `Anasayfa.craft üzerindeki bağımsız düzenleme uygulanamadı (target=${tab1TargetId}, before=${tab1Target.left},${tab1Target.top}).`
    );
    const tab1MovedPos = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${tab1TargetId}"]');
        return { left: el?.style.left, top: el?.style.top };
      })()
    `);

    // Tekrar Sayfa-2.craft'a dön, kendi elemanının korunduğunu gör ve taşı, sonra Ctrl+Z yap
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-2.craft"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]')) && document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 1`),
      'Sayfa-2.craft elemanları sekmeler arası geçişte korunmadı.'
    );
    await new Promise((r) => setTimeout(r, 250));
    const tab2Target = await findVisiblePointForElement(cdp, tab2ElInitial.id);
    assert.ok(tab2Target, 'Sayfa-2.craft üzerinde eleman noktası bulunamadı.');
    await dragOnScreen(cdp, tab2Target.cx, tab2Target.cy, 44, 28);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return Boolean(el) && (el.style.left !== ${JSON.stringify(tab2ElInitial.left)} || el.style.top !== ${JSON.stringify(tab2ElInitial.top)});
      })()`),
      'Sayfa-2.craft elemanı taşınamadı.'
    );

    // Ctrl+Z -> yalnızca Sayfa-2.craft geri alınmalı, Anasayfa.craft değişikliği aynen kalmalı
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return Boolean(el) && el.style.left === ${JSON.stringify(tab2ElInitial.left)} && el.style.top === ${JSON.stringify(tab2ElInitial.top)};
      })()`),
      'Ctrl+Z aktif sekmede (Sayfa-2.craft) elemanı eski konumuna almadı.'
    );

    await cdp.evaluate(`document.querySelector('div[title^="Anasayfa.craft"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('#artboard-canvas [data-element-id="${tab1TargetId}"]'))`),
      'Anasayfa.craft sekmesine geçilemedi.'
    );
    const tab1AfterTab2Undo = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${tab1TargetId}"]');
        return { left: el?.style.left, top: el?.style.top };
      })()
    `);
    assert.deepEqual(
      tab1AfterTab2Undo,
      tab1MovedPos,
      'Diğer sekmedeki Ctrl+Z işlemi Anasayfa.craft elemanını da etkiledi!'
    );

    // Şimdi Anasayfa.craft'ta Ctrl+Z -> yalnızca Anasayfa.craft geri alınmalı
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${tab1TargetId}"]');
        return Boolean(el) && el.style.left === ${JSON.stringify(tab1Target.left)} && el.style.top === ${JSON.stringify(tab1Target.top)};
      })()`),
      'Anasayfa.craft içinde Ctrl+Z çalışmadı.'
    );
    console.log('  ✓ İki sekmede bağımsız düzenleme ve per-tab Ctrl+Z izolasyonu doğrulandı');

    // 7. Tablet / Masaüstü override bağımsızlığı (konum + boyut) & Mobil/Masaüstü geçişleri
    // Sayfa-2.craft üzerinde tek eleman ile oto-parenting riski olmadan test edilir
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-2.craft"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]'))`),
      'Step 7 için Sayfa-2.craft sekmesine geçilemedi.'
    );
    await new Promise((r) => setTimeout(r, 200));
    const desktopGeoBefore = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);
    assert.ok(desktopGeoBefore, 'Masaüstü eleman geometrisi okunamadı.');

    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Tablet viewport (768px) geçişi başarısız.'
    );
    await new Promise((r) => setTimeout(r, 250));

    const tabletGeoBefore = await findVisiblePointForElement(cdp, tab2ElInitial.id);
    assert.ok(tabletGeoBefore, 'Tablet modunda hedef eleman görünür/tıklanabilir bulunamadı.');

    // Tablet modunda konum değiştir (tıkla + sürükle)
    await dragOnScreen(cdp, tabletGeoBefore.cx, tabletGeoBefore.cy, 42, 26);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return Boolean(el) && (el.style.left !== ${JSON.stringify(tabletGeoBefore.left)} || el.style.top !== ${JSON.stringify(tabletGeoBefore.top)});
      })()`),
      'Tablet modunda eleman konumu değiştirilemedi.'
    );

    // Tablet modunda SE tutamacıyla boyut değiştir
    const seHandlePt = await waitFor(
      cdp,
      `Boolean(Array.from(document.querySelectorAll('#artboard-canvas div')).find((d) => d.style.cursor === 'nwse-resize' && d.style.bottom === '-5px' && d.style.right === '-5px'))`
    ).then(async (found) => {
      if (!found) return null;
      return cdp.evaluate(`
        (() => {
          const handle = Array.from(document.querySelectorAll('#artboard-canvas div')).find(
            (d) => d.style.cursor === 'nwse-resize' && d.style.bottom === '-5px' && d.style.right === '-5px'
          );
          handle?.scrollIntoView?.({ block: 'center', inline: 'center' });
          const r = handle?.getBoundingClientRect();
          return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
        })()
      `);
    });
    assert.ok(seHandlePt, 'Tablet modunda güneydoğu (se) boyutlandırma tutamacı bulunamadı.');
    await dragOnScreen(cdp, seHandlePt.x, seHandlePt.y, 32, 20);
    assert.ok(
      await waitFor(cdp, `(() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return Boolean(el) && (el.style.width !== ${JSON.stringify(tabletGeoBefore.width)} || el.style.height !== ${JSON.stringify(tabletGeoBefore.height)});
      })()`),
      'Tablet modunda eleman boyutu değiştirilemedi.'
    );

    const tabletGeoAfter = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);

    // Masaüstüne dön -> masaüstü değerinin hiç DEĞİŞMEDİĞİNİ doğrula
    await cdp.evaluate(`document.querySelector('button[title^="Masaüstü Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '1280px'`),
      'Masaüstü dönüşü başarısız.'
    );
    const desktopGeoAfter = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);
    assert.deepEqual(
      desktopGeoAfter,
      desktopGeoBefore,
      `Tablette yapılan düzenleme masaüstü geometrisini değiştirdi! Önce: ${JSON.stringify(desktopGeoBefore)}, Sonra: ${JSON.stringify(desktopGeoAfter)}`
    );

    // Tekrar Tablete dön -> tabletteki yeni boyut/konumun korunduğunu doğrula
    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Tablete ikinci geçiş başarısız.'
    );
    const tabletGeoPersisted = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);
    assert.deepEqual(
      tabletGeoPersisted,
      tabletGeoAfter,
      `Masaüstüne geçip dönünce tabletteki override kayboldu! Beklenen: ${JSON.stringify(tabletGeoAfter)}, Gelen: ${JSON.stringify(tabletGeoPersisted)}`
    );

    // Mobil ve tekrar Masaüstü kontrolü; ardından Step 8 kaydı için Anasayfa.craft sekmesine dön
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
    await cdp.evaluate(`document.querySelector('div[title^="Anasayfa.craft"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length > 1`),
      'Anasayfa.craft sekmesine dönüş başarısız.'
    );
    console.log('  ✓ Tablet/Masaüstü override bağımsızlığı ve Mobil/Masaüstü viewport geçişleri doğrulandı');

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

    // 9. Yeniden açılan projede Tablette düzenlenmiş elemanın tablet değerinin korunduğunu ve masaüstünün değişmediğini doğrula
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-2.craft"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]'))`),
      'Yeniden açılan projede Sayfa-2.craft sekmesine geçilemedi.'
    );
    await new Promise((r) => setTimeout(r, 200));
    const reopenedDesktopGeo = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);
    assert.deepEqual(
      reopenedDesktopGeo,
      desktopGeoBefore,
      `Kaydet/Yeniden Aç sonrası masaüstü geometrisi değişti! Beklenen: ${JSON.stringify(desktopGeoBefore)}, Gelen: ${JSON.stringify(reopenedDesktopGeo)}`
    );

    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Yeniden açılan projede Tablet viewport geçişi başarısız.'
    );
    await new Promise((r) => setTimeout(r, 200));
    const reopenedTabletGeo = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${tab2ElInitial.id}"]');
        return el ? { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height } : null;
      })()
    `);
    assert.deepEqual(
      reopenedTabletGeo,
      tabletGeoAfter,
      `Kaydet/Yeniden Aç sonrası tablet override değeri korunmadı! Beklenen: ${JSON.stringify(tabletGeoAfter)}, Gelen: ${JSON.stringify(reopenedTabletGeo)}`
    );
    console.log('  ✓ Kaydet ve yeniden aç sonrası Tablet override korundu, Masaüstü değişmedi');

    // 10. Sekme kapat, Ctrl+Z ile geri gelmediğini doğrula, yeniden sekme açıp Tablete geçişte doğru adapte olduğunu doğrula
    await cdp.evaluate(`document.querySelector('button[title^="Masaüstü Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '1280px'`),
      'Sekme kapatma testi öncesi masaüstüne dönülemedi.'
    );
    const closedTabClicked = await cdp.evaluate(`
      (() => {
        const tabDiv = document.querySelector('div[title^="Sayfa-2.craft"]');
        const closeBtn = tabDiv?.querySelector('button');
        if (!closeBtn) return false;
        closeBtn.click();
        return true;
      })()
    `);
    assert.ok(closedTabClicked, 'Sayfa-2.craft sekme kapatma butonu bulunamadı.');
    assert.ok(
      await waitFor(cdp, `!document.querySelector('div[title^="Sayfa-2.craft"]')`),
      'Sayfa-2.craft sekmesi kapatılamadı.'
    );

    // Ctrl+Z sekme kapatmayı geri almamalı (history sekme bazlı AST geçmişidir)
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    await new Promise((r) => setTimeout(r, 150));
    const tabStillClosedAfterUndo = await cdp.evaluate(`!document.querySelector('div[title^="Sayfa-2.craft"]')`);
    assert.ok(tabStillClosedAfterUndo, 'Ctrl+Z kapatılan sekmeyi beklenmedik şekilde geri getirdi.');

    // Yeniden sekme aç (yine Sayfa-2.craft adını alır), masaüstünde geniş bir kutu çiz ve Tablete geçince adapte olduğunu doğrula
    await cdp.evaluate(`document.querySelector('button[title="Yeni Sayfa Sekmesi Ekle"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('div[title^="Sayfa-2.craft"]')) && document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 0`),
      'Kapatılan sekme sonrası yeni Sayfa-2.craft sekmesi açılamadı.'
    );
    await new Promise((r) => setTimeout(r, 200));

    await cdp.evaluate(`document.querySelector('button[data-tool-id="rectangle"]')?.click()`);
    const reopenedTabDrawOrigin = await cdp.evaluate(`
      (() => {
        const art = document.getElementById('artboard-canvas');
        const r = art?.getBoundingClientRect();
        return r ? { x: Math.round(r.left + Math.min(r.width * 0.65, r.width - 120)), y: Math.round(r.top + 90) } : null;
      })()
    `);
    assert.ok(reopenedTabDrawOrigin, 'Yeniden açılan sekmede çizim başlangıç noktası alınamadı.');
    await dragOnScreen(cdp, reopenedTabDrawOrigin.x, reopenedTabDrawOrigin.y, 110, 65);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 1`),
      'Yeniden açılan sekmede eleman çizilemedi.'
    );
    await cdp.evaluate(`document.querySelector('button[data-tool-id="select"]')?.click()`);

    await cdp.evaluate(`document.querySelector('button[title^="Tablet Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '768px'`),
      'Kapatılıp yeniden açılan sekmede Tablet geçişi başarısız.'
    );
    await new Promise((r) => setTimeout(r, 250));
    const reopenedTabAdaptation = await cdp.evaluate(`
      (() => {
        const art = document.getElementById('artboard-canvas');
        const wrap = document.getElementById('canvas-wrapper');
        const el = document.querySelector('#artboard-canvas > [data-element-id]');
        if (!art || !wrap || !el) return null;
        const artRect = art.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const left = parseFloat(el.style.left) || 0;
        const width = parseFloat(el.style.width) || 0;
        return {
          artW: parseFloat(art.style.width) || 0,
          artH: parseFloat(art.style.height) || 0,
          elRight: left + width,
          fitsCanvasH: artRect.height <= wrapRect.height,
          fitsCanvasW: artRect.width <= wrapRect.width,
        };
      })()
    `);
    assert.ok(reopenedTabAdaptation, 'Yeniden açılan sekmede tablet adaptasyon ölçümü alınamadı.');
    assert.ok(
      reopenedTabAdaptation.artW === 768 &&
      reopenedTabAdaptation.elRight <= 768 &&
      reopenedTabAdaptation.fitsCanvasH &&
      reopenedTabAdaptation.fitsCanvasW,
      `Kapatılıp açılan sekme tablette doğru adapte olmadı: ${JSON.stringify(reopenedTabAdaptation)}`
    );
    console.log('  ✓ Sekme kapatılıp yeniden açıldığında yeni sekmenin Tablete doğru adapte olduğu doğrulandı');

    // 11. Bir elemanı düzenle, "Yeni Boş Proje" başlat, eski elemanların/sekmelerin/seçimin/geçmişin (Ctrl+Z) temizlendiğini doğrula
    const preNewProjTarget = await findVisiblePointForElement(cdp, null);
    assert.ok(preNewProjTarget, 'Yeni proje öncesi düzenlenecek eleman bulunamadı.');
    await dragOnScreen(cdp, preNewProjTarget.cx, preNewProjTarget.cy, 25, 20);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[title="Geri Al (Ctrl+Z)"]:not([disabled])'))`),
      'Yeni proje öncesi eleman düzenlemesi history yığınına girmedi.'
    );

    const clickedNewBlankProject = await cdp.evaluate(`
      (() => {
        const dosyaBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Dosya'
        );
        if (!dosyaBtn) return false;
        dosyaBtn.click();
        return true;
      })()
    `);
    assert.ok(clickedNewBlankProject, 'Dosya menüsü açılamadı.');
    assert.ok(
      await waitFor(cdp, `
        (() => {
          const item = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Yeni Boş Proje')
          );
          if (!item) return false;
          item.click();
          return true;
        })()
      `),
      'Dosya > Yeni Boş Proje menü öğesi tıklanamadı.'
    );

    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 0 && Boolean(document.querySelector('div[title^="Yeni-Tasarim.craft"]'))`
      ),
      'Yeni Boş Proje başlatıldığında tuval veya sekme sıfırlanmadı.'
    );

    // Ctrl+Z hiçbir eski elemanı geri getirmemeli
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    await new Promise((r) => setTimeout(r, 150));

    const cleanProjectState = await cdp.evaluate(`
      (() => {
        const elementCount = document.querySelectorAll('#artboard-canvas [data-element-id]').length;
        const hasOldTab1 = Boolean(document.querySelector('div[title^="Anasayfa.craft"]'));
        const hasOldTab2 = Boolean(document.querySelector('div[title^="Sayfa-2.craft"]'));
        const hasNewTab = Boolean(document.querySelector('div[title^="Yeni-Tasarim.craft"]'));
        const undoDisabled = Boolean(document.querySelector('button[title="Geri Al (Ctrl+Z)"]')?.disabled);
        const hasSelectionBadge = document.body.innerText.includes('seçili');
        return { elementCount, hasOldTab1, hasOldTab2, hasNewTab, undoDisabled, hasSelectionBadge };
      })()
    `);
    assert.deepEqual(
      cleanProjectState,
      {
        elementCount: 0,
        hasOldTab1: false,
        hasOldTab2: false,
        hasNewTab: true,
        undoDisabled: true,
        hasSelectionBadge: false,
      },
      `Yeni Boş Proje sonrası eski elemanlar, sekmeler, seçim veya geçmiş temizlenmedi: ${JSON.stringify(cleanProjectState)}`
    );
    console.log('  ✓ Yeni Boş Proje başlatıldığında eski elemanların, sekmelerin, seçimin ve Ctrl+Z geçmişinin temizlendiği doğrulandı');

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
