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

async function sendCtrlShortcut(cdp, keyChar, keyCode, virtualKeyCode, { blurFirst = true } = {}) {
  if (blurFirst) {
    await cdp.evaluate(`document.activeElement?.blur?.()`);
    await new Promise((r) => setTimeout(r, 40));
  }
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

async function sendSingleKey(cdp, keyChar, keyCode, virtualKeyCode, { blurFirst = true } = {}) {
  if (blurFirst) {
    await cdp.evaluate(`document.activeElement?.blur?.()`);
    await new Promise((r) => setTimeout(r, 30));
  }
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    modifiers: 0,
    key: keyChar,
    code: keyCode,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    modifiers: 0,
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
  const dialogEvents = [];
  let nextDialogAccept = true;

  cdp.on('Page.javascriptDialogOpening', async (params) => {
    dialogEvents.push({ type: params.type, message: params.message });
    const accept = nextDialogAccept;
    nextDialogAccept = true;
    try {
      await cdp.send('Page.handleJavaScriptDialog', { accept });
    } catch {}
  });

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

    // 0. Normal üretim (npm run build) yüklemesinde (?test=1 olmadan) window.__craftStudioTestHook tanımlı olmamalı
    await cdp.navigate(preview.url);
    await waitFor(cdp, `Boolean(document.querySelector('#welcome-create'))`);
    const prodHookType = await cdp.evaluate(`typeof window.__craftStudioTestHook`);
    assert.equal(
      prodHookType,
      'undefined',
      `Normal üretim yüklemesinde (?test=1 olmadan) window.__craftStudioTestHook tanımlı olmamalı (bulunan: ${prodHookType}).`
    );

    const testAppUrl = `${preview.url}/?test=1`;
    await cdp.evaluate('localStorage.clear();');
    await cdp.navigate(testAppUrl);

    const welcomeLoaded = await waitFor(
      cdp,
      `Boolean(document.querySelector('#welcome-create'))`
    );
    assert.ok(welcomeLoaded, 'Karşılama ekranı yüklenemedi.');
    const testFlagHookType = await cdp.evaluate(`typeof window.__craftStudioTestHook`);
    assert.equal(
      testFlagHookType,
      'object',
      `?test=1 bayrağı ile yüklendiğinde window.__craftStudioTestHook tanımlı olmalı (bulunan: ${testFlagHookType}).`
    );
    console.log('  ✓ Karşılama ekranı yüklendi (?test=1 olmadan test kancası yok, ?test=1 ile aktif)');

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

    // 1b. Sol panel genişliğinin (leftSidebarWidth) sürüklenerek değiştirilmesi, useCanvasView yatay ortalaması ve çift tıkla 248px varsayılanına sıfırlanması
    // Tuvalin daralan çalışma alanında yatay ortalanmasını (scaledW < wrapperW - 24) ölçmek için 3 kademe uzaklaştır, ardından Katmanlar panelini aç
    await cdp.evaluate(`
      (() => {
        const zoomOutBtn = document.querySelector('button[title^="Uzaklaştır"]');
        zoomOutBtn?.click();
        zoomOutBtn?.click();
        zoomOutBtn?.click();
      })()
    `);
    await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('[data-left-drawer-container="true"]'))`),
      'Sol çekmece genişlik testi için Katmanlar paneli açılamadı.'
    );
    await new Promise((r) => setTimeout(r, 150));
    const beforeLeftResize = await cdp.evaluate(`
      (() => {
        const drawer = document.querySelector('[data-left-drawer-container="true"]');
        const splitter = document.querySelector('[data-left-drawer-splitter="true"]');
        const wrapper = document.getElementById('canvas-wrapper');
        const artboard = document.getElementById('artboard-canvas');
        const sr = splitter?.getBoundingClientRect();
        return {
          drawerW: Math.round(drawer?.getBoundingClientRect().width || 0),
          wrapperW: wrapper?.clientWidth || 0,
          transform: artboard?.parentElement?.style?.transform || '',
          splitterX: sr ? Math.round(sr.left + sr.width / 2) : 0,
          splitterY: sr ? Math.round(sr.top + sr.height / 2) : 0,
        };
      })()
    `);
    assert.equal(beforeLeftResize.drawerW, 248, `Sol çekmece varsayılan genişliği 248px olmalı (bulunan: ${beforeLeftResize.drawerW}).`);

    // Splitter'ı +80px sağa sürükle -> çekmece 328px olmalı, #canvas-wrapper 80px daralmalı ve tuval yatay merkezi güncellenmeli
    await dragOnScreen(cdp, beforeLeftResize.splitterX, beforeLeftResize.splitterY, 80, 0);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 328`
      ),
      'Sol çekmece splitter sürüklemesi genişliği 328px yapmadı.'
    );
    await new Promise((r) => setTimeout(r, 120));
    const afterLeftResize = await cdp.evaluate(`
      (() => {
        const drawer = document.querySelector('[data-left-drawer-container="true"]');
        const wrapper = document.getElementById('canvas-wrapper');
        const artboard = document.getElementById('artboard-canvas');
        return {
          drawerW: Math.round(drawer?.getBoundingClientRect().width || 0),
          wrapperW: wrapper?.clientWidth || 0,
          transform: artboard?.parentElement?.style?.transform || '',
        };
      })()
    `);
    assert.equal(afterLeftResize.drawerW, 328, `Sol çekmece +80px sürükleme sonrası 328px olmalı (bulunan: ${afterLeftResize.drawerW}).`);
    assert.equal(
      beforeLeftResize.wrapperW - afterLeftResize.wrapperW,
      80,
      `Sol çekmece 80px genişlediğinde #canvas-wrapper 80px daralmalı (önce=${beforeLeftResize.wrapperW}, sonra=${afterLeftResize.wrapperW}).`
    );
    assert.notEqual(
      afterLeftResize.transform,
      beforeLeftResize.transform,
      'Sol çekmece genişliği değiştiğinde useCanvasView tuvali yatayda yeniden ortalamadı!'
    );

    // Splitter'a çift tıkla -> 248px varsayılanına dönmeli ve paneli kapat
    await cdp.evaluate(`
      (() => {
        const splitter = document.querySelector('[data-left-drawer-splitter="true"]');
        splitter?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      })()
    `);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 248`
      ),
      'Sol çekmece splitter çift tıklaması genişliği 248px varsayılanına sıfırlamadı.'
    );
    await cdp.evaluate(`document.querySelector('button[title="Sol paneli gizle"]')?.click()`);
    await waitFor(cdp, `!document.querySelector('[data-left-drawer-container="true"]')`);
    await sendCtrlShortcut(cdp, '0', 'Digit0', 48);
    await new Promise((r) => setTimeout(r, 120));
    console.log('  ✓ Sol panel genişliği (248px -> 328px -> 248px) gerçek değerle useCanvasView tuval ortalamasına bağlandı');

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
      await waitFor(cdp, `Boolean(document.querySelector('[data-floating-css-inspector="true"]')) && document.body.innerText.includes('CSS & Nitelik Penceresi')`),
      'Yüzen CSS & Nitelik Penceresi açılamadı.'
    );

    // 4b. Yüzen CSS penceresi açıkken tuval kısayolları (R, V, Escape ile seçim kaldırma) çalışmalı ve seçim kalkınca pencere kaybolmamalı
    await sendSingleKey(cdp, 'r', 'KeyR', 82);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('button[data-tool-id="rectangle"][aria-pressed="true"]')) && Boolean(document.querySelector('[data-floating-css-inspector="true"]'))`
      ),
      'Yüzen CSS penceresi açıkken R tuval kısayolu çalışmadı veya pencere kapandı!'
    );
    await sendSingleKey(cdp, 'v', 'KeyV', 86);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]'))`),
      'Yüzen CSS penceresi açıkken V tuval kısayolu çalışmadı!'
    );

    // Tuvalde seçimi kaldır -> Yüzen CSS penceresi kaybolmamalı, boş durum mesajı ([data-floating-inspector-empty="true"]) göstermeli
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    await new Promise((r) => setTimeout(r, 80));
    if (await cdp.evaluate(`document.body.innerText.includes('seçili')`)) {
      await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    }
    assert.ok(
      await waitFor(
        cdp,
        `!document.body.innerText.includes('seçili') && Boolean(document.querySelector('[data-floating-css-inspector="true"]')) && Boolean(document.querySelector('[data-floating-inspector-empty="true"]'))`
      ),
      'Eleman seçimi kalktığında Yüzen CSS & Nitelik Penceresi kayboldu veya boş durum görünümüne geçmedi!'
    );

    // Yüzen CSS penceresi açıkken Ctrl+A tuval kısayolu ile tekrar seçim yapıldığında pencere içeriği anında güncellenmeli
    await sendCtrlShortcut(cdp, 'a', 'KeyA', 65);
    assert.ok(
      await waitFor(
        cdp,
        `document.body.innerText.includes('seçili') && Boolean(document.querySelector('[data-floating-css-inspector="true"]')) && !document.querySelector('[data-floating-inspector-empty="true"]')`
      ),
      'Yüzen CSS penceresi açıkken Ctrl+A ile tekrar eleman seçildiğinde pencere içeriği güncellenmedi!'
    );

    // 4c-(a): Odak yüzen CSS penceresinin DOM'u içindeyken (bir sekme butonuna odaklanılmış, input değil)
    // Delete, Backspace, ok tuşları, Ctrl+D ve Ctrl+X tuvale gitmemeli; V/R gibi araç tuşları çalışmaya devam etmeli
    const focusedFloatingBtn = await cdp.evaluate(`
      (() => {
        const inspector = document.querySelector('[data-floating-css-inspector="true"]');
        const tabBtn = Array.from(inspector?.querySelectorAll('button') || []).find(
          (b) => b.textContent && b.textContent.includes('HTML Öznitelikleri')
        );
        if (!tabBtn) return false;
        tabBtn.focus();
        return inspector.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON';
      })()
    `);
    assert.ok(focusedFloatingBtn, 'Yüzen CSS penceresi içindeki sekme butonuna odaklanılamadı.');

    const beforeFloatingFocusKeys = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return {
          count: document.querySelectorAll('#artboard-canvas [data-element-id]').length,
          left: el?.style?.left || '',
          top: el?.style?.top || '',
        };
      })()
    `);

    await sendSingleKey(cdp, 'Delete', 'Delete', 46, { blurFirst: false });
    await sendSingleKey(cdp, 'Backspace', 'Backspace', 8, { blurFirst: false });
    await sendSingleKey(cdp, 'ArrowRight', 'ArrowRight', 39, { blurFirst: false });
    await sendSingleKey(cdp, 'ArrowDown', 'ArrowDown', 40, { blurFirst: false });
    await sendCtrlShortcut(cdp, 'd', 'KeyD', 68, { blurFirst: false });
    await sendCtrlShortcut(cdp, 'x', 'KeyX', 88, { blurFirst: false });
    await new Promise((r) => setTimeout(r, 100));

    const afterFloatingFocusKeys = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${dragTarget.id}"]');
        return {
          count: document.querySelectorAll('#artboard-canvas [data-element-id]').length,
          left: el?.style?.left || '',
          top: el?.style?.top || '',
        };
      })()
    `);
    assert.deepEqual(
      afterFloatingFocusKeys,
      beforeFloatingFocusKeys,
      `Odak yüzen CSS penceresi içindeyken basılan Delete/Backspace/Oklar/Ctrl+D/Ctrl+X tuvali etkiledi: ${JSON.stringify({ beforeFloatingFocusKeys, afterFloatingFocusKeys })}`
    );

    // Aynı odak durumunda R ve V araç tuşları mevcut davranışta çalışmaya devam etmeli
    await sendSingleKey(cdp, 'r', 'KeyR', 82, { blurFirst: false });
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="rectangle"][aria-pressed="true"]'))`),
      'Odak yüzen CSS penceresi butonundayken R araç tuşu çalışmadı.'
    );
    await sendSingleKey(cdp, 'v', 'KeyV', 86, { blurFirst: false });
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]'))`),
      'Odak yüzen CSS penceresi butonundayken V araç tuşu çalışmadı.'
    );
    console.log('  ✓ Odak yüzen CSS penceresi içindeyken Delete/Backspace/Oklar/Ctrl+D/Ctrl+X tuvale gitmedi, V/R araç tuşları çalıştı');

    // 4c-(b): Odak yüzen CSS penceresi içindeyken ve aktif araç 'rectangle' (R) + seçim aktifken Escape'e basıldığında
    // YALNIZCA yüzen pencere kapanmalı; useShortcuts Escape dalı (aracı select yapma veya seçimi kaldırma) ÇALIŞMAMALI
    await sendSingleKey(cdp, 'r', 'KeyR', 82, { blurFirst: false });
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="rectangle"][aria-pressed="true"]'))`),
      'Yüzen CSS Escape testi öncesi R aracına geçilemedi.'
    );
    const stillFocusedInsideInspector = await cdp.evaluate(`
      (() => {
        const inspector = document.querySelector('[data-floating-css-inspector="true"]');
        return Boolean(inspector && inspector.contains(document.activeElement));
      })()
    `);
    assert.ok(stillFocusedInsideInspector, 'Escape testi öncesi odak yüzen CSS penceresi içinde değil.');

    await sendSingleKey(cdp, 'Escape', 'Escape', 27, { blurFirst: false });
    assert.ok(
      await waitFor(cdp, `!document.querySelector('[data-floating-css-inspector="true"]')`),
      'Odak yüzen CSS penceresi içindeyken Escape pencereyi kapatmadı!'
    );
    const afterInspectorEscState = await cdp.evaluate(`
      (() => ({
        isRectangleToolStillActive: Boolean(document.querySelector('button[data-tool-id="rectangle"][aria-pressed="true"]')),
        hasSelection: document.body.innerText.includes('seçili'),
      }))()
    `);
    assert.deepEqual(
      afterInspectorEscState,
      { isRectangleToolStillActive: true, hasSelection: true },
      `Yüzen CSS penceresinde Escape pencereyi kapatırken aynı anda tuval aracını veya seçimi de değiştirdi: ${JSON.stringify(afterInspectorEscState)}`
    );

    // Pencere kapandıktan sonra tuvalde Escape tekrar aracı 'select'e döndürmeli
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]'))`),
      'Yüzen CSS penceresi kapandıktan sonraki Escape aktif aracı select yapmadı.'
    );
    console.log('  ✓ Yüzen CSS & Nitelik penceresi açılıp kapatıldı (pencere açıkken tuval kısayolları çalışıyor, seçim kalkınca pencere kaybolmuyor, pencerede Escape yalnızca pencereyi kapatıyor)');

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

    // 10. Sekme kapatma onayı (dolu sekmede onay ister, iptalde kapanmaz, onayda kapanır; boş sekme onaysız kapanır) + yeniden açılan sekmenin Tablete adaptasyonu
    await cdp.evaluate(`document.querySelector('button[title^="Masaüstü Tasarımı"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `document.getElementById('artboard-canvas')?.style.width === '1280px'`),
      'Sekme kapatma testi öncesi masaüstüne dönülemedi.'
    );

    // 10a. Boş bir sekme aç (Sayfa-3.craft) ve onaysız kapandığını doğrula
    await cdp.evaluate(`document.querySelector('button[title="Yeni Sayfa Sekmesi Ekle"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('div[title^="Sayfa-3.craft"]'))`),
      'Boş test sekmesi (Sayfa-3.craft) açılamadı.'
    );
    const dialogCountBeforeEmptyClose = dialogEvents.length;
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-3.craft"] button')?.click()`);
    assert.ok(
      await waitFor(cdp, `!document.querySelector('div[title^="Sayfa-3.craft"]')`),
      'Boş sekme (Sayfa-3.craft) kapatılamadı.'
    );
    assert.equal(
      dialogEvents.length,
      dialogCountBeforeEmptyClose,
      'Boş sekme kapatılırken onay diyaloğu açılmamalıydı.'
    );

    // 10b. Eleman içeren Sayfa-2.craft sekmesini kapatırken onay istemeli; İptal (accept=false) seçilince kapanmamalı
    const dialogCountBeforeCancel = dialogEvents.length;
    nextDialogAccept = false;
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-2.craft"] button')?.click()`);
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(dialogEvents.length, dialogCountBeforeCancel + 1, 'Dolu sekme kapatılırken confirm diyaloğu açılmadı.');
    assert.equal(
      dialogEvents[dialogEvents.length - 1].message,
      'Bu sayfa silinecek, emin misin?',
      'Sekme kapatma onay mesajı beklenen metinle eşleşmedi.'
    );
    assert.ok(
      await cdp.evaluate(`Boolean(document.querySelector('div[title^="Sayfa-2.craft"]'))`),
      'Onay reddedildiği halde dolu sekme kapandı!'
    );

    // 10c. Sayfa-2.craft aktifken bir eleman seç ("1 seçili"), ardından aktif sekmeyi kapat (accept=true) -> sekme kapanmalı ve seçim sıfırlanmalı
    await cdp.evaluate(`document.querySelector('div[title^="Sayfa-2.craft"]')?.click()`);
    await new Promise((r) => setTimeout(r, 150));
    const activeTabElPt = await findVisiblePointForElement(cdp, tab2ElInitial.id);
    assert.ok(activeTabElPt, 'Sayfa-2.craft üzerinde seçilecek eleman bulunamadı.');
    await dragOnScreen(cdp, activeTabElPt.cx, activeTabElPt.cy, 0, 0);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('1 seçili')`),
      'Aktif sekme kapatılmadan önce eleman seçilemedi.'
    );

    nextDialogAccept = true;
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
      'Sayfa-2.craft sekmesi onay sonrası kapatılamadı.'
    );
    assert.ok(
      await waitFor(cdp, `!document.body.innerText.includes('seçili')`),
      'Aktif sekme kapatıldığında seçim (selectedIds) sıfırlanmadı!'
    );
    console.log('  ✓ Sekme kapatma onayı (boş sekme onaysız, dolu sekmede onay/iptal kontrolü) doğrulandı');
    console.log('  ✓ Aktif sekme kapatıldığında seçimin (resetSelection) sıfırlandığı doğrulandı');

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

    // 12. Otomatik taslak: eleman düzenle, 2 sn bekle, sayfayı yeniden yükle, karşılamada "Kaydedilmemiş Taslak" görünsün, geri yükle ile elemanlar geri gelsin
    await cdp.evaluate(`document.querySelector('button[data-tool-id="rectangle"]')?.click()`);
    const draftDrawOrigin = await cdp.evaluate(`
      (() => {
        const art = document.getElementById('artboard-canvas');
        const r = art?.getBoundingClientRect();
        return r ? { x: Math.round(r.left + 90), y: Math.round(r.top + 90) } : null;
      })()
    `);
    assert.ok(draftDrawOrigin, 'Otomatik taslak çizim koordinatı alınamadı.');
    await dragOnScreen(cdp, draftDrawOrigin.x, draftDrawOrigin.y, 130, 80);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 1`),
      'Otomatik taslak için eleman çizilemedi.'
    );
    await cdp.evaluate(`document.querySelector('button[data-tool-id="select"]')?.click()`);
    const draftElementBeforeReload = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id]');
        return el ? { id: el.getAttribute('data-element-id'), left: el.style.left, top: el.style.top } : null;
      })()
    `);
    assert.ok(draftElementBeforeReload?.id, 'Otomatik taslak elemanı okunamadı.');

    // 1500ms debounce'un tetiklenmesi için 2 saniye bekle
    await new Promise((r) => setTimeout(r, 2000));

    // Sayfayı yeniden yükle -> karşılama ekranında "Kaydedilmemiş Taslak" görünmeli
    await cdp.navigate(testAppUrl);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('.welcome-project-row--draft')) && document.body.innerText.includes('Kaydedilmemiş Taslak')`
      ),
      'Sayfa yeniden yüklendiğinde karşılama ekranında "Kaydedilmemiş Taslak" görünmedi.'
    );

    await cdp.evaluate(`document.querySelector('.welcome-project-row--draft .welcome-project-row__main')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('#artboard-canvas > [data-element-id="${draftElementBeforeReload.id}"]'))`
      ),
      'Otomatik taslak geri yüklendiğinde çizilen eleman tuvale geri gelmedi.'
    );
    const draftElementAfterRestore = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id="${draftElementBeforeReload.id}"]');
        return el ? { id: el.getAttribute('data-element-id'), left: el.style.left, top: el.style.top } : null;
      })()
    `);
    assert.deepEqual(
      draftElementAfterRestore,
      draftElementBeforeReload,
      'Geri yüklenen otomatik taslak elemanının konumu eşleşmedi.'
    );
    console.log('  ✓ Otomatik taslak (2sn debounce -> sayfa yenileme -> Kaydedilmemiş Taslak -> Geri Yükle) doğrulandı');

    // 13. Klavye kısayolları (useShortcuts): V/H/R/O/T araç tuşları, input içinde yazarken araç değişmemesi, Ctrl+C/V, Ctrl+D, Delete, Ctrl+Z/Y ve Ctrl+S
    const toolShortcutChecks = [
      { key: 'h', code: 'KeyH', vk: 72, expectedTool: 'hand' },
      { key: 'r', code: 'KeyR', vk: 82, expectedTool: 'rectangle' },
      { key: 'o', code: 'KeyO', vk: 79, expectedTool: 'circle' },
      { key: 't', code: 'KeyT', vk: 84, expectedTool: 'text' },
      { key: 'v', code: 'KeyV', vk: 86, expectedTool: 'select' },
    ];
    for (const item of toolShortcutChecks) {
      await sendSingleKey(cdp, item.key, item.code, item.vk);
      assert.ok(
        await waitFor(
          cdp,
          `Boolean(document.querySelector('button[data-tool-id="${item.expectedTool}"][aria-pressed="true"]'))`
        ),
        `"${item.key.toUpperCase()}" kısayolu aktif aracı "${item.expectedTool}" yapmadı.`
      );
    }

    // Bir input'a yazarken harf tuşlarının (V/H/R/O/T) araç değiştirmediğini doğrula
    const focusedInput = await cdp.evaluate(`
      (() => {
        const inp = document.querySelector('input[title="Proje adını düzenle"]');
        if (!inp) return false;
        inp.focus();
        return document.activeElement === inp;
      })()
    `);
    assert.ok(focusedInput, 'Proje adı input alanı odaklanamadı.');
    for (const item of [
      { key: 'h', code: 'KeyH', vk: 72 },
      { key: 'r', code: 'KeyR', vk: 82 },
      { key: 'o', code: 'KeyO', vk: 79 },
      { key: 't', code: 'KeyT', vk: 84 },
    ]) {
      await sendSingleKey(cdp, item.key, item.code, item.vk, { blurFirst: false });
    }
    await new Promise((r) => setTimeout(r, 120));
    const stillSelectToolWhileTyping = await cdp.evaluate(
      `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]'))`
    );
    assert.ok(stillSelectToolWhileTyping, 'Input içine harf yazarken aktif araç değişti!');
    await cdp.evaluate(`document.activeElement?.blur?.()`);

    // Geri yüklenen taslaktaki tek elemanı seç, Ctrl+C / Ctrl+V, Ctrl+D, Delete, Ctrl+Z, Ctrl+Y ve Ctrl+S kısayollarını doğrula
    const shortcutTargetPt = await findVisiblePointForElement(cdp, draftElementBeforeReload.id);
    assert.ok(shortcutTargetPt, 'Kısayol testi için tuvaldeki eleman tıklanabilir bulunamadı.');
    await dragOnScreen(cdp, shortcutTargetPt.cx, shortcutTargetPt.cy, 0, 0);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('1 seçili')`),
      'Kısayol testi için eleman seçilemedi.'
    );

    // Ctrl+C ve Ctrl+V -> eleman sayısı 1'den 2'ye çıkmalı
    await sendCtrlShortcut(cdp, 'c', 'KeyC', 67);
    await new Promise((r) => setTimeout(r, 60));
    await sendCtrlShortcut(cdp, 'v', 'KeyV', 86);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 2`),
      'Ctrl+C / Ctrl+V sonrası eleman yapıştırılamadı (beklenen=2).'
    );

    // Ctrl+D -> eleman sayısı 2'den 3'e çıkmalı
    await sendCtrlShortcut(cdp, 'd', 'KeyD', 68);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 3`),
      'Ctrl+D sonrası seçili eleman çoğaltılamadı (beklenen=3).'
    );

    // Delete -> seçili çoğaltılan eleman silinmeli, sayı 3'ten 2'ye düşmeli
    await sendSingleKey(cdp, 'Delete', 'Delete', 46);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 2`),
      'Delete tuşu seçili elemanı silmedi (beklenen=2).'
    );

    // Ctrl+Z -> silme geri alınmalı (3), Ctrl+Y -> silme ileri alınmalı (2)
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 3`),
      'Ctrl+Z silinen elemanı geri getirmedi (beklenen=3).'
    );
    await sendCtrlShortcut(cdp, 'y', 'KeyY', 89);
    assert.ok(
      await waitFor(cdp, `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 2`),
      'Ctrl+Y silme işlemini ileri almadı (beklenen=2).'
    );

    // Madde 3: Ctrl+V ile yeni eleman yapıştır (sayı 3 olur ve yeni eleman "1 seçili" olur), ardından Ctrl+Z ile geri al -> ağaçtan silinen ID selectedIds'den ayıklanmalı
    await sendCtrlShortcut(cdp, 'v', 'KeyV', 86);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 3 && document.body.innerText.includes('1 seçili')`
      ),
      'Undo seçim ayıklama testi öncesi Ctrl+V ile yeni eleman seçili olarak eklenemedi.'
    );
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#artboard-canvas > [data-element-id]').length === 2 && !document.body.innerText.includes('seçili')`
      ),
      'Undo (Ctrl+Z) sonrası ağaçtan silinen elemanın IDsi selectedIds içinden ayıklanmadı!'
    );
    console.log('  ✓ Undo/Redo sonrası ağaçta olmayan seçili eleman IDlerinin ayıklandığı doğrulandı');

    // Ctrl+S -> projeyi klavyeden kaydetmeli ("✓ Kaydedildi" rozeti görünmeli)
    await sendCtrlShortcut(cdp, 's', 'KeyS', 83);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('✓ Kaydedildi')`),
      'Ctrl+S klavye kısayolu projeyi kaydetmedi.'
    );
    console.log('  ✓ Klavye kısayolları (V/H/R/O/T, input koruması, Ctrl+C/V, Ctrl+D, Delete, Ctrl+Z/Y, Ctrl+S) doğrulandı');

    // Madde 4: Sağ tık menüsü açıkken Escape yalnızca menüyü kapatmalı, aktif aracı veya seçimi değiştirmemeli
    await sendSingleKey(cdp, 'h', 'KeyH', 72);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="hand"][aria-pressed="true"]'))`),
      'Sağ tık Escape testi öncesi El (H) aracına geçilemedi.'
    );
    const openedCtxMenu = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas > [data-element-id]');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.round(r.left + 20),
          clientY: Math.round(r.top + 20),
          button: 2,
        }));
        return true;
      })()
    `);
    assert.ok(openedCtxMenu, 'Tuval elemanı üzerinde sağ tık olayı tetiklenemedi.');
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('[data-canvas-context-menu]')) && document.body.innerText.includes('1 seçili')`
      ),
      'Sağ tık bağlam menüsü açılmadı veya hedef elemanı seçmedi.'
    );

    // Escape'e bas -> yalnızca sağ tık menüsü kapanmalı; El (hand) aracı ve "1 seçili" durumu korunmalı
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    assert.ok(
      await waitFor(cdp, `!document.querySelector('[data-canvas-context-menu]')`),
      'Escape tuşu sağ tık bağlam menüsünü kapatmadı.'
    );
    const afterCtxEscState = await cdp.evaluate(`
      (() => ({
        isHandActive: Boolean(document.querySelector('button[data-tool-id="hand"][aria-pressed="true"]')),
        hasSelection: document.body.innerText.includes('1 seçili'),
      }))()
    `);
    assert.deepEqual(
      afterCtxEscState,
      { isHandActive: true, hasSelection: true },
      `Sağ tık menüsü açıkken Escape aktif aracı veya seçimi değiştirdi: ${JSON.stringify(afterCtxEscState)}`
    );

    // Sağ tık menüsü kapandıktan sonra Escape dinleyicisi kalkmış olmalı:
    // 2. Escape -> El (hand) aracından Seçim (select) aracına dönmeli (seçim korunmalı)
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]')) && document.body.innerText.includes('1 seçili')`
      ),
      'Sağ tık menüsü kapandıktan sonraki 2. Escape aktif aracı select yapmadı (Escape yutuldu!).'
    );

    // 3. Escape -> Seçim aracındayken seçimi üst kapsama çıkarmalı / temizlemeli ("1 seçili" kalkmalı)
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);
    assert.ok(
      await waitFor(cdp, `!document.body.innerText.includes('seçili')`),
      'Sağ tık menüsü kapandıktan sonraki 3. Escape seçimi üst kapsama çıkarmadı (Escape yutuldu!).'
    );
    console.log('  ✓ Sağ tık menüsü açıkken Escape yalnızca menüyü kapattı; menü kapalıyken Escape araç ve seçim zincirini çalıştırdı');

    // 14. .craft.json dosyasını tarayıcı file-input yoluyla içe aktar (cdp.setFileInputFiles)
    const craftJsonFixturePath = path.join(ROOT_DIR, 'scripts', 'fixtures', 'import', 'project.craft.json');
    assert.ok(fs.existsSync(craftJsonFixturePath), 'project.craft.json fixture dosyası bulunamadı.');
    await cdp.setFileInputFiles('input[type="file"][accept*=".craft.json"]', [craftJsonFixturePath]);
    assert.ok(
      await waitFor(
        cdp,
        `document.body.innerText.includes('✓ Açıldı: project.craft.json') && document.querySelectorAll('#artboard-canvas [data-element-id]').length > 5`
      ),
      '.craft.json dosyası tarayıcı file-input yoluyla içe aktarılamadı.'
    );
    console.log('  ✓ .craft.json dosyası tarayıcı file-input (setFileInputFiles) yoluyla içe aktarıldı');

    // 15. Backend verisini programatik doldur -> otomatik taslağın taşıdığını, sayfa yenileyip "Geri Yükle" ile geldiğini ve Son Projeler'den açınca korunduğunu doğrula
    const expectedBackendPayload = {
      version: 1,
      flows: [{ id: 'flow-smoke-1', name: 'İletişim Formu Gönder' }],
      dataModels: [{ id: 'model-smoke-1', name: 'Mesajlar' }],
      triggers: [{ id: 'trig-smoke-1', event: 'onClick', targetElementId: 'btn-submit', flowId: 'flow-smoke-1' }],
    };
    const hookCalled = await cdp.evaluate(`
      (() => {
        if (!window.__craftStudioTestHook?.updateProjectBackend) return false;
        window.__craftStudioTestHook.updateProjectBackend(${JSON.stringify(expectedBackendPayload)});
        return true;
      })()
    `);
    assert.ok(hookCalled, 'window.__craftStudioTestHook.updateProjectBackend bulunamadı.');
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('● Kaydedilmedi')`),
      'Backend verisi değiştiğinde hasUnsavedChanges (● Kaydedilmedi) aktif olmadı.'
    );
    const appliedBackend = await cdp.evaluate(`window.__craftStudioTestHook?.getProjectBackend?.()`);
    assert.deepEqual(
      appliedBackend,
      expectedBackendPayload,
      'Test kancası üzerinden backend verisi güncellenemedi.'
    );

    // 1500ms otomatik taslak debounce'u için 2 saniye bekle ve localStorage taslağında backend verisini doğrula
    await new Promise((r) => setTimeout(r, 2000));
    const draftBackendInStorage = await cdp.evaluate(`
      (() => {
        const raw = localStorage.getItem('craftstudio.autosaveDraft.v1');
        return raw ? JSON.parse(raw).backend : null;
      })()
    `);
    assert.deepEqual(
      draftBackendInStorage,
      expectedBackendPayload,
      'Otomatik taslak (autosaveDraft) backend verisini localStorage içine taşımadı!'
    );

    // Sayfayı yenile -> karşılama ekranında "Kaydedilmemiş Taslak"tan geri yükle -> backend verisinin geri geldiğini doğrula
    await cdp.navigate(testAppUrl);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('.welcome-project-row--draft'))`),
      'Backend taslak testi sırasında sayfa yenilenince Kaydedilmemiş Taslak satırı görünmedi.'
    );
    await cdp.evaluate(`document.querySelector('.welcome-project-row--draft .welcome-project-row__main')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Backend taslağı geri yüklenirken atölye tuvali açılmadı.'
    );
    const restoredDraftBackend = await cdp.evaluate(`window.__craftStudioTestHook?.getProjectBackend?.()`);
    assert.deepEqual(
      restoredDraftBackend,
      expectedBackendPayload,
      'Otomatik taslaktan Geri Yükle sonrası backend verisi korunmadı!'
    );

    // Projeyi kaydet (Ctrl+S), Karşılama ekranına dön ve Son Projeler'den tekrar aç -> backend verisi korunmalı
    await sendCtrlShortcut(cdp, 's', 'KeyS', 83);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('✓ Kaydedildi')`),
      'Backend verili proje Ctrl+S ile kaydedilemedi.'
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
      await waitFor(
        cdp,
        `document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)').length > 0`
      ),
      'Karşılama ekranında Son Projeler listesi görünmedi.'
    );
    await cdp.evaluate(`
      document.querySelector('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft) .welcome-project-row__main')?.click()
    `);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Son Projeler listesinden proje tekrar açılamadı.'
    );
    const reopenedRecentBackend = await cdp.evaluate(`window.__craftStudioTestHook?.getProjectBackend?.()`);
    assert.deepEqual(
      reopenedRecentBackend,
      expectedBackendPayload,
      'Son Projeler listesinden açılan projede backend verisi korunmadı!'
    );
    console.log('  ✓ Backend verisinin otomatik taslak, Geri Yükle ve Son Projeler kaydet/aç akışında korunduğu doğrulandı');

    // 15b. Adım 3a: Tasarım | Backend mod anahtarı, yer tutucu ekran, her modun kendi panel durumunu hatırlaması,
    // previewMode otomatik kapanışı, tuval zoom/pan/seçim korunumu ve kaydet/aç sonrası 'design' modunda açılış
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('button[data-studio-mode="design"][aria-selected="true"]'))`
      ),
      'Proje açıldığında varsayılan olarak Tasarım (design) modunda başlamadı.'
    );

    // 1) Önce Sun (previewMode) açıkken Backend moduna geçişte previewMode'un otomatik kapandığını doğrula, sonra Tasarım'a dön
    await cdp.evaluate(`
      (() => {
        const sunBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Sun'
        );
        sunBtn?.click();
      })()
    `);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('Düzenlemeye Dön')`),
      'Mod geçişi öncesi Önizleme (Sun) modu açılamadı.'
    );
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('button[data-studio-mode="backend"][aria-selected="true"]')) && !document.body.innerText.includes('Düzenlemeye Dön')`
      ),
      'Sun (previewMode) açıkken Backend moduna geçildiğinde previewMode otomatik kapanmadı.'
    );
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="design"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Önizleme kapanış testi sonrası Tasarım moduna dönülemedi.'
    );
    await new Promise((r) => setTimeout(r, 120));

    // 2) Tasarım modunda: sol çekmeceyi Katmanlar (layers) ve sağ dock sekmesini Stil (style) yap, bir eleman seç ve zoom'u bir kademe artır
    const isLayersAlreadyOpen = await cdp.evaluate(
      `Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]'))`
    );
    if (!isLayersAlreadyOpen) {
      await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
      assert.ok(
        await waitFor(cdp, `Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]'))`),
        'Mod testi öncesi Tasarım modunda Katmanlar çekmecesi açılamadı.'
      );
    }
    await cdp.evaluate(`
      (() => {
        const styleRailBtn = document.querySelector('button[data-right-rail-tab="style"]');
        styleRailBtn?.click();
        const zoomInBtn = document.querySelector('button[title="Yakınlaştır"]');
        zoomInBtn?.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 150));
    const modeTestElId = await cdp.evaluate(
      `document.querySelector('#artboard-canvas [data-element-id]')?.getAttribute('data-element-id') || null`
    );
    assert.ok(modeTestElId, 'Mod testi için tuvalde seçilecek eleman bulunamadı.');
    const modeTestPt = await findVisiblePointForElement(cdp, modeTestElId);
    assert.ok(modeTestPt, 'Mod testi için eleman görünür noktası bulunamadı.');
    await dragOnScreen(cdp, modeTestPt.cx, modeTestPt.cy, 0, 0);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('1 seçili')`),
      'Mod testi öncesi Tasarım modunda eleman seçilemedi.'
    );

    const designSnapshotBeforeSwitch = await cdp.evaluate(`
      (() => {
        const artboard = document.getElementById('artboard-canvas');
        const projectInput = document.querySelector('input[title="Proje adını düzenle"]');
        const undoBtn = document.querySelector('button[title="Geri Al (Ctrl+Z)"]');
        const redoBtn = document.querySelector('button[title="İleri Al (Ctrl+Y)"]');
        return {
          transform: artboard?.parentElement?.style?.transform || '',
          projectName: projectInput?.value || '',
          isSavedBadge: document.body.innerText.includes('✓ Kaydedildi'),
          undoDisabled: Boolean(undoBtn?.disabled),
          redoDisabled: Boolean(redoBtn?.disabled),
          leftLayersOpen: Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]')),
        };
      })()
    `);
    assert.ok(designSnapshotBeforeSwitch.transform.includes('scale('), 'Tasarım tuvali transform (zoom/pan) okunamadı.');
    assert.ok(designSnapshotBeforeSwitch.leftLayersOpen, 'Tasarım modunda Katmanlar paneli açık değil.');

    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('button[data-studio-mode="backend"][aria-selected="true"]')) && Boolean(document.querySelector('[data-backend-workspace]'))`
      ),
      'Backend moduna geçilemedi veya Backend çalışma alanı yer tutucusu render edilmedi.'
    );

    const backendViewCheck = await cdp.evaluate(`
      (() => {
        const ws = document.querySelector('[data-backend-workspace]');
        const flowsCount = document.querySelector('[data-backend-count="flows"]')?.textContent?.trim();
        const modelsCount = document.querySelector('[data-backend-count="dataModels"]')?.textContent?.trim();
        const triggersCount = document.querySelector('[data-backend-count="triggers"]')?.textContent?.trim();
        const projectInput = document.querySelector('input[title="Proje adını düzenle"]');
        const undoBtn = document.querySelector('button[title="Geri Al (Ctrl+Z)"]');
        const redoBtn = document.querySelector('button[title="İleri Al (Ctrl+Y)"]');
        return {
          previewClosed: !document.body.innerText.includes('Düzenlemeye Dön'),
          hasHeading: Boolean(ws && ws.textContent.includes('Backend çalışma alanı, yakında')),
          flowsCount,
          modelsCount,
          triggersCount,
          canvasUnmounted: !document.getElementById('artboard-canvas'),
          pageTabsHidden: !document.querySelector('button[title="Yeni Sayfa Sekmesi (Ctrl+N)"]'),
          aiDockVisible: Boolean(document.querySelector('[data-ai-dock="true"]') || document.querySelector('button[title*="Gemini Sohbet Kutusunu Aç"]')),
          leftDrawer: document.querySelector('[data-backend-left-drawer]')?.getAttribute('data-backend-left-drawer') || null,
          rightDockTab: document.querySelector('[data-backend-right-dock]')?.getAttribute('data-backend-right-dock') || null,
          projectName: projectInput?.value || '',
          isSavedBadge: document.body.innerText.includes('✓ Kaydedildi'),
          undoDisabled: Boolean(undoBtn?.disabled),
          redoDisabled: Boolean(redoBtn?.disabled),
        };
      })()
    `);
    assert.equal(backendViewCheck.previewClosed, true, 'Backend moduna geçerken açık olan previewMode kapatılmadı.');
    assert.equal(backendViewCheck.hasHeading, true, '"Backend çalışma alanı, yakında" başlığı görünmedi.');
    assert.equal(backendViewCheck.flowsCount, '1', 'Backend yer tutucusunda İş Akışları sayısı 1 değil.');
    assert.equal(backendViewCheck.modelsCount, '1', 'Backend yer tutucusunda Veri Modelleri sayısı 1 değil.');
    assert.equal(backendViewCheck.triggersCount, '1', 'Backend yer tutucusunda Tetikleyiciler sayısı 1 değil.');
    assert.equal(backendViewCheck.canvasUnmounted, true, 'Backend modunda tasarım tuvali unmount olmadı.');
    assert.equal(backendViewCheck.pageTabsHidden, true, 'Backend modunda sayfa sekmeleri gizlenmedi.');
    assert.equal(backendViewCheck.aiDockVisible, true, 'Backend modunda yüzen AI sohbet kutusu görünür değil.');
    assert.equal(backendViewCheck.leftDrawer, 'flows', 'Backend modunda varsayılan sol çekmece "flows" olarak açılmadı.');
    assert.equal(backendViewCheck.rightDockTab, 'stepConfig', 'Backend modunda varsayılan sağ dock sekmesi "stepConfig" olarak açılmadı.');
    assert.equal(backendViewCheck.projectName, designSnapshotBeforeSwitch.projectName, 'Mod değişiminde proje adı değişti.');
    assert.equal(backendViewCheck.isSavedBadge, designSnapshotBeforeSwitch.isSavedBadge, 'Mod değişiminde kaydedilme rozeti değişti.');
    assert.equal(backendViewCheck.undoDisabled, designSnapshotBeforeSwitch.undoDisabled, 'Mod değişiminde Geri Al durumu değişti.');
    assert.equal(backendViewCheck.redoDisabled, designSnapshotBeforeSwitch.redoDisabled, 'Mod değişiminde İleri Al durumu değişti.');

    // Pencere menüsünün Backend modunda registry'deki menuPanels öğelerini listelediğini doğrula
    await cdp.evaluate(`
      (() => {
        const menuBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Pencere'
        );
        menuBtn?.click();
      })()
    `);
    const backendWindowMenuIds = await cdp.evaluate(`
      Array.from(document.querySelectorAll('[data-window-menu-panel]')).map((el) => el.getAttribute('data-window-menu-panel'))
    `);
    assert.deepEqual(
      backendWindowMenuIds,
      ['backendInspector', 'flows', 'dataModels', 'aiAgent'],
      `Backend modunda Pencere menüsü öğeleri beklenenle eşleşmedi: ${JSON.stringify(backendWindowMenuIds)}`
    );
    await sendSingleKey(cdp, 'Escape', 'Escape', 27);

    // Backend modunda sol çekmeceyi "dataModels" ve sağ dock sekmesini "dataBinding" olarak değiştir
    await cdp.evaluate(`
      (() => {
        document.querySelector('button[data-left-panel-id="dataModels"]')?.click();
        document.querySelector('button[data-backend-right-tab="dataBinding"]')?.click();
      })()
    `);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelector('[data-backend-left-drawer]')?.getAttribute('data-backend-left-drawer') === 'dataModels' && document.querySelector('[data-backend-right-dock]')?.getAttribute('data-backend-right-dock') === 'dataBinding'`
      ),
      'Backend modunda sol çekmece (dataModels) veya sağ dock sekmesi (dataBinding) değiştirilemedi.'
    );

    // Tasarım moduna geri dön -> zoom/pan (transform), seçim ("1 seçili") ve Tasarım modunun kendi sol/sağ panelleri korunmalı
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="design"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.getElementById('artboard-canvas')) && Boolean(document.querySelector('button[data-studio-mode="design"][aria-selected="true"]'))`
      ),
      'Tasarım moduna geri dönüldüğünde tuval remount olmadı.'
    );
    await new Promise((r) => setTimeout(r, 120));
    const designSnapshotAfterReturn = await cdp.evaluate(`
      (() => ({
        transform: document.getElementById('artboard-canvas')?.parentElement?.style?.transform || '',
        hasSelection: document.body.innerText.includes('1 seçili'),
        leftLayersOpen: Boolean(document.querySelector('input[placeholder="Katmanlarda ara..."]')),
      }))()
    `);
    assert.equal(
      designSnapshotAfterReturn.transform,
      designSnapshotBeforeSwitch.transform,
      `Tasarım moduna dönüldüğünde zoom/panOffset bozuldu (beklenen: ${designSnapshotBeforeSwitch.transform}, bulunan: ${designSnapshotAfterReturn.transform}).`
    );
    assert.equal(designSnapshotAfterReturn.hasSelection, true, 'Tasarım moduna dönüldüğünde seçili eleman korunmadı.');
    assert.equal(designSnapshotAfterReturn.leftLayersOpen, true, 'Tasarım modu kendi sol panel durumunu (Katmanlar) hatırlamadı.');

    // Tekrar Backend moduna geç -> Backend modunun kendi sol (dataModels) ve sağ (dataBinding) panel durumunu hatırladığını doğrula
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelector('[data-backend-left-drawer]')?.getAttribute('data-backend-left-drawer') === 'dataModels' && document.querySelector('[data-backend-right-dock]')?.getAttribute('data-backend-right-dock') === 'dataBinding'`
      ),
      'Backend moduna tekrar geçildiğinde Backend modu kendi sol/sağ panel durumunu hatırlamadı.'
    );

    // Backend modundayken projeyi kaydet (Ctrl+S), Projeler'e dön ve Son Projeler'den tekrar aç -> proje 'design' modunda açılmalı
    await sendCtrlShortcut(cdp, 's', 'KeyS', 83);
    await cdp.evaluate(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Projeler'
        );
        homeBtn?.click();
      })()
    `);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)').length > 0`
      ),
      'Mod testi sonrası Karşılama ekranında Son Projeler listesi görünmedi.'
    );
    await cdp.evaluate(`
      document.querySelector('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft) .welcome-project-row__main')?.click()
    `);
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.getElementById('artboard-canvas')) && Boolean(document.querySelector('button[data-studio-mode="design"][aria-selected="true"]'))`
      ),
      'Backend modunda kaydedilen proje tekrar açıldığında varsayılan Tasarım (design) modunda açılmadı!'
    );
    console.log('  ✓ Adım 3a: Mod anahtarı, Backend yer tutucu ekranı, mod bazlı panel hafızası, zoom/pan korunumu ve design modunda açılış doğrulandı');

    // 15c. Adım 3b: Kısayolların moda göre ayrılması (Backend modunda tasarım kısayolları ve Ctrl+Z/Y devre dışı, Ctrl+S aktif; Tasarım'a dönünce seçim ve kısayollar aktif)
    const shortcutModeElId = await cdp.evaluate(
      `document.querySelector('#artboard-canvas [data-element-id]')?.getAttribute('data-element-id') || null`
    );
    assert.ok(shortcutModeElId, 'Adım 3b kısayol testi için tuvalde eleman bulunamadı.');
    const shortcutModePt = await findVisiblePointForElement(cdp, shortcutModeElId);
    assert.ok(shortcutModePt, 'Adım 3b kısayol testi için elemanın tıklanabilir noktası bulunamadı.');
    await dragOnScreen(cdp, shortcutModePt.cx, shortcutModePt.cy, 0, 0);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('1 seçili')`),
      'Adım 3b testi öncesi Tasarım modunda eleman seçilemedi.'
    );

    // Geri al geçmişinde en az 1 adım olması ve "● Kaydedilmedi" rozetinin aktif olması için Tasarım modunda ArrowRight ile 1px kaydır
    await sendSingleKey(cdp, 'ArrowRight', 'ArrowRight', 39);
    assert.ok(
      await waitFor(
        cdp,
        `document.body.innerText.includes('● Kaydedilmedi') && !document.querySelector('button[title="Geri Al (Ctrl+Z)"]')?.disabled`
      ),
      'Adım 3b testi öncesi Tasarım modunda ok tuşuyla geri al geçmişi oluşturulamadı.'
    );

    const beforeBackendShortcutState = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${shortcutModeElId}"]');
        const undoBtn = document.querySelector('button[title="Geri Al (Ctrl+Z)"]');
        return {
          totalElements: document.querySelectorAll('#artboard-canvas [data-element-id]').length,
          left: el?.style?.left || '',
          top: el?.style?.top || '',
          undoDisabled: Boolean(undoBtn?.disabled),
          isSelectTool: Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]')),
        };
      })()
    `);
    assert.equal(beforeBackendShortcutState.undoDisabled, false, 'Backend geçişi öncesi Geri Al butonu aktif olmalı.');
    assert.equal(beforeBackendShortcutState.isSelectTool, true, 'Backend geçişi öncesi aktif araç select olmalı.');

    // Backend moduna geç
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-studio-mode="backend"][aria-selected="true"]'))`),
      'Adım 3b testi için Backend moduna geçilemedi.'
    );

    // Backend modunda Delete, Backspace, Ctrl+D, Ctrl+Z, Ctrl+Y, ok tuşları ve R tuşuna bas
    await sendSingleKey(cdp, 'Delete', 'Delete', 46);
    await sendSingleKey(cdp, 'Backspace', 'Backspace', 8);
    await sendCtrlShortcut(cdp, 'd', 'KeyD', 68);
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    await sendCtrlShortcut(cdp, 'y', 'KeyY', 89);
    await sendSingleKey(cdp, 'ArrowRight', 'ArrowRight', 39);
    await sendSingleKey(cdp, 'ArrowDown', 'ArrowDown', 40);
    await sendSingleKey(cdp, 'r', 'KeyR', 82);
    await new Promise((r) => setTimeout(r, 120));

    const duringBackendShortcutState = await cdp.evaluate(`
      (() => {
        const undoBtn = document.querySelector('button[title="Geri Al (Ctrl+Z)"]');
        return {
          undoDisabled: Boolean(undoBtn?.disabled),
          isSelectTool: Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]')),
          isDirtyBadge: document.body.innerText.includes('● Kaydedilmedi'),
        };
      })()
    `);
    assert.equal(duringBackendShortcutState.undoDisabled, false, 'Backend modunda Ctrl+Z tasarım geçmişini tüketti!');
    assert.equal(duringBackendShortcutState.isSelectTool, true, 'Backend modunda R tuşu aktif aracı değiştirdi!');
    assert.equal(duringBackendShortcutState.isDirtyBadge, true, 'Backend modunda Ctrl+Z kaydedilmemiş değişiklik durumunu bozdu!');

    // Evrensel Ctrl+S kısayolunun Backend modunda çalıştığını doğrula
    await sendCtrlShortcut(cdp, 's', 'KeyS', 83);
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('✓ Kaydedildi')`),
      'Evrensel Ctrl+S kısayolu Backend modunda projeyi kaydetmedi!'
    );

    // Tasarım moduna geri dön: seçim korunmuş, eleman sayısı/konumu/aktif araç/geri al geçmişi değişmemiş ve tasarım kısayolları tekrar çalışıyor olmalı
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="design"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Adım 3b testi sonrası Tasarım moduna dönülemedi.'
    );

    const afterBackendShortcutState = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('#artboard-canvas [data-element-id="${shortcutModeElId}"]');
        const undoBtn = document.querySelector('button[title="Geri Al (Ctrl+Z)"]');
        return {
          hasSelection: document.body.innerText.includes('1 seçili'),
          totalElements: document.querySelectorAll('#artboard-canvas [data-element-id]').length,
          left: el?.style?.left || '',
          top: el?.style?.top || '',
          undoDisabled: Boolean(undoBtn?.disabled),
          isSelectTool: Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]')),
        };
      })()
    `);
    assert.equal(afterBackendShortcutState.hasSelection, true, 'Tasarım moduna dönüldüğünde seçim korunmadı.');
    assert.equal(
      afterBackendShortcutState.totalElements,
      beforeBackendShortcutState.totalElements,
      'Backend modunda basılan Delete/Backspace/Ctrl+D eleman sayısını değiştirdi!'
    );
    assert.equal(
      afterBackendShortcutState.left,
      beforeBackendShortcutState.left,
      'Backend modunda basılan ok tuşları veya Ctrl+Z elemanın X konumunu değiştirdi!'
    );
    assert.equal(
      afterBackendShortcutState.top,
      beforeBackendShortcutState.top,
      'Backend modunda basılan ok tuşları elemanın Y konumunu değiştirdi!'
    );
    assert.equal(afterBackendShortcutState.undoDisabled, false, 'Tasarım moduna dönüldüğünde geri al geçmişi korunmadı.');
    assert.equal(afterBackendShortcutState.isSelectTool, true, 'Tasarım moduna dönüldüğünde aktif araç select değil.');

    // Tasarım modunda kısayolların (R, V ve Ctrl+Z) tekrar çalıştığını doğrula
    await sendSingleKey(cdp, 'r', 'KeyR', 82);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="rectangle"][aria-pressed="true"]'))`),
      'Tasarım moduna dönüldükten sonra R kısayolu çalışmadı.'
    );
    await sendSingleKey(cdp, 'v', 'KeyV', 86);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-tool-id="select"][aria-pressed="true"]'))`),
      'Tasarım moduna dönüldükten sonra V kısayolu çalışmadı.'
    );
    await sendCtrlShortcut(cdp, 'z', 'KeyZ', 90);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelector('#artboard-canvas [data-element-id="${shortcutModeElId}"]')?.style?.left !== ${JSON.stringify(beforeBackendShortcutState.left)}`
      ),
      'Tasarım moduna dönüldükten sonra Ctrl+Z geri alma kısayolu çalışmadı.'
    );
    await sendCtrlShortcut(cdp, 's', 'KeyS', 83);
    console.log('  ✓ Adım 3b: Backend modunda tasarım kısayolları (Delete/Backspace/Ctrl+D/Ctrl+Z/oklar/R) etkisiz, Ctrl+S aktif; Tasarım moduna dönünce seçim ve kısayollar aktif');

    // 15d. Adım 2b: Moda göre pencere düzeninin settingsStore'da saklanması, sayfa yenileyince her iki modda korunması,
    // Hazır Düzenler (Tasarım Odaklı, Geniş Tuval) + "Düzeni sıfırla" ve düzen değişiminin "● Kaydedilmedi" rozetini tetiklememesi
    assert.ok(
      await waitFor(cdp, `document.body.innerText.includes('✓ Kaydedildi')`),
      'Adım 2b testi öncesi proje kaydedilmiş durumda değil.'
    );

    // 1) Tasarım modunda Katmanlar panelini aç ve genişliğini 248px -> 328px (+80px) yap
    const layersOpenFor2b = await cdp.evaluate(`Boolean(document.querySelector('[data-left-drawer-container="true"]'))`);
    if (!layersOpenFor2b) {
      await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
      assert.ok(
        await waitFor(cdp, `Boolean(document.querySelector('[data-left-drawer-container="true"]'))`),
        'Adım 2b için Tasarım modunda Katmanlar çekmecesi açılamadı.'
      );
    }
    const designSpl = await cdp.evaluate(`
      (() => {
        const s = document.querySelector('[data-left-drawer-splitter="true"]');
        const r = s?.getBoundingClientRect();
        return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
      })()
    `);
    assert.ok(designSpl, 'Tasarım sol çekmece splitter koordinatı alınamadı.');
    await dragOnScreen(cdp, designSpl.x, designSpl.y, 80, 0);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 328`
      ),
      'Adım 2b: Tasarım sol çekmecesi 328px genişliğe getirilemedi.'
    );

    // 2) Backend moduna geç ve Backend sol çekmecesinin genişliğini 256px -> 316px (+60px) yap
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.querySelector('button[data-studio-mode="backend"][aria-selected="true"]'))`),
      'Adım 2b için Backend moduna geçilemedi.'
    );
    const backendDrawerOpen = await cdp.evaluate(`Boolean(document.querySelector('[data-left-drawer-container="true"]'))`);
    if (!backendDrawerOpen) {
      await cdp.evaluate(`document.querySelector('button[data-left-panel-id="flows"]')?.click()`);
      assert.ok(
        await waitFor(cdp, `Boolean(document.querySelector('[data-left-drawer-container="true"]'))`),
        'Adım 2b için Backend sol çekmecesi açılamadı.'
      );
    }
    const backendSpl = await cdp.evaluate(`
      (() => {
        const s = document.querySelector('[data-left-drawer-splitter="true"]');
        const r = s?.getBoundingClientRect();
        return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
      })()
    `);
    assert.ok(backendSpl, 'Backend sol çekmece splitter koordinatı alınamadı.');
    await dragOnScreen(cdp, backendSpl.x, backendSpl.y, 60, 0);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 316`
      ),
      'Adım 2b: Backend sol çekmecesi 316px genişliğe getirilemedi.'
    );

    // Düzen değişikliklerinin "● Kaydedilmedi" rozetini tetiklemediğini doğrula ("✓ Kaydedildi" kalmalı)
    const stillSavedAfterLayoutChange = await cdp.evaluate(`document.body.innerText.includes('✓ Kaydedildi')`);
    assert.equal(
      stillSavedAfterLayoutChange,
      true,
      'Panel genişliği veya mod düzeni değiştiğinde "● Kaydedilmedi" rozeti yandı (hasUnsavedChanges tetiklenmemeli)!'
    );

    // 3) Sayfayı yenile -> Son Projeler'den projeyi aç -> hem Tasarım (328px) hem Backend (316px) genişliklerinin korunduğunu ve "✓ Kaydedildi" rozetinin bozulmadığını doğrula
    await cdp.navigate(testAppUrl);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)').length > 0`
      ),
      'Sayfa yenileme sonrası Son Projeler listesi görünmedi.'
    );
    await cdp.evaluate(`
      document.querySelector('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft) .welcome-project-row__main')?.click()
    `);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Sayfa yenileme sonrası proje tekrar açılamadı.'
    );
    assert.equal(
      await cdp.evaluate(`document.body.innerText.includes('✓ Kaydedildi')`),
      true,
      'Kaydet/aç sonrası projede "● Kaydedilmedi" rozeti yandı!'
    );

    // Tasarım modunda Katmanlar panelini aç -> genişlik 328px olarak hatırlanmalı
    await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 328`
      ),
      'Sayfa yenileme sonrası Tasarım modu sol panel genişliği (328px) settingsStore üzerinden korunmadı!'
    );

    // Backend moduna geç -> genişlik 316px olarak bağımsız hatırlanmalı
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 316`
      ),
      'Sayfa yenileme sonrası Backend modu sol panel genişliği (316px) settingsStore üzerinden korunmadı!'
    );

    // 4) Tasarım moduna dön, Pencere menüsünden Hazır Düzenleri (Geniş Tuval, Tasarım Odaklı) ve "Düzeni sıfırla" aksiyonunu doğrula
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="design"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Hazır düzen testi için Tasarım moduna dönülemedi.'
    );

    await clickWindowMenuItem(cdp, 'Geniş Tuval');
    assert.ok(
      await waitFor(
        cdp,
        `!document.querySelector('[data-left-drawer-container="true"]') && Boolean(document.querySelector('button[title="Sağ Paneli Aç"]')) && Boolean(document.querySelector('button[title*="Gemini Sohbet Kutusunu Aç"]'))`
      ),
      '"Geniş Tuval" hazır düzeni sol çekmeceyi, sağ docku ve AI sohbet kutusunu daraltmadı!'
    );

    await clickWindowMenuItem(cdp, 'Tasarım Odaklı');
    assert.ok(
      await waitFor(
        cdp,
        `Boolean(document.querySelector('[data-left-drawer-container="true"]')) && Boolean(document.querySelector('button[title="Sağ Paneli Daralt"]')) && Boolean(document.querySelector('[data-ai-dock="true"]'))`
      ),
      '"Tasarım Odaklı" hazır düzeni Katmanlar ve Sağ Özellikler panellerini açmadı!'
    );

    // 60 pointermove hareketiyle splitter sürüklenirken settingsStore'a (craftstudio_settings_v1)
    // her harekette değil, yalnızca bırakınca (pointerup) 1 kez yazıldığını doğrula
    const dragWriteResult = await cdp.evaluate(`
      new Promise((resolve) => {
        const s = document.querySelector('[data-left-drawer-splitter="true"]');
        const r = s?.getBoundingClientRect();
        if (!s || !r) return resolve({ ok: false, writes: -1 });
        const startX = Math.round(r.left + r.width / 2);
        const startY = Math.round(r.top + r.height / 2);
        let settingsWrites = 0;
        const origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, val) {
          if (key === 'craftstudio_settings_v1') settingsWrites += 1;
          return origSetItem.call(this, key, val);
        };
        s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: startX, clientY: startY }));
        requestAnimationFrame(() => {
          for (let i = 1; i <= 60; i++) {
            const dx = Math.round((80 * i) / 60);
            window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: startX + dx, clientY: startY }));
          }
          requestAnimationFrame(() => {
            const writesDuringMove = settingsWrites;
            window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: startX + 80, clientY: startY }));
            Storage.prototype.setItem = origSetItem;
            resolve({ ok: true, writesDuringMove, totalWritesAfterUp: settingsWrites });
          });
        });
      })
    `);
    assert.equal(dragWriteResult.ok, true, 'Splitter 60 hareket testi başlatılamadı.');
    assert.equal(
      dragWriteResult.writesDuringMove,
      0,
      `Splitter sürüklenirken 60 pointermove sırasında localStorage'a yazılmamalıydı (yazılan: ${dragWriteResult.writesDuringMove}).`
    );
    assert.equal(
      dragWriteResult.totalWritesAfterUp,
      1,
      `60 pointermove + 1 pointerup sonunda settingsStore'a tam 1 kez yazılmalıydı (yazılan: ${dragWriteResult.totalWritesAfterUp}).`
    );
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 328`
      ),
      'Düzen sıfırlama öncesi sol çekmece 328px yapılamadı.'
    );

    await clickWindowMenuItem(cdp, 'Düzeni sıfırla');
    assert.ok(
      await waitFor(
        cdp,
        `!document.querySelector('[data-left-drawer-container="true"]') && Boolean(document.querySelector('button[title="Sağ Paneli Daralt"]'))`
      ),
      '"Düzeni sıfırla" sonrası Standart düzene (sol çekmece kapalı, sağ dock açık) dönülmedi!'
    );

    // Katmanlar'ı açıp genişliğin fabrika varsayılanı olan 248px'e döndüğünü doğrula, sonra kapat
    await clickWindowMenuItem(cdp, 'Katmanlar (Layers)');
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 248`
      ),
      '"Düzeni sıfırla" sonrası sol çekmece genişliği 248px varsayılanına dönmedi!'
    );
    await cdp.evaluate(`document.querySelector('button[title="Sol paneli gizle"]')?.click()`);

    // Tasarım modunda "Düzeni sıfırla" yapıldıktan sonra Backend moduna geçildiğinde Backend düzeninin (316px) korunduğunu doğrula
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="backend"]')?.click()`);
    assert.ok(
      await waitFor(
        cdp,
        `Math.round(document.querySelector('[data-left-drawer-container="true"]')?.getBoundingClientRect().width || 0) === 316`
      ),
      'Tasarım modunda "Düzeni sıfırla" çağrıldığında Backend modunun özel genişliği (316px) sıfırlandı (yalnızca aktif mod sıfırlanmalı)!'
    );
    await cdp.evaluate(`document.querySelector('button[data-studio-mode="design"]')?.click()`);
    assert.ok(
      await waitFor(cdp, `Boolean(document.getElementById('artboard-canvas'))`),
      'Backend kontrolü sonrası Tasarım moduna dönülemedi.'
    );
    assert.equal(
      await cdp.evaluate(`document.body.innerText.includes('✓ Kaydedildi')`),
      true,
      'Hazır düzen veya Düzeni sıfırla işlemi "● Kaydedilmedi" rozetini tetikledi!'
    );
    console.log('  ✓ Adım 2b: Moda göre düzenin settingsStore kaydı (60 hareket -> 1 yazma), sayfa yenilemede korunması, Hazır Düzenler, aktif mod Düzeni sıfırla ve Kaydedilmedi rozeti izolasyonu doğrulandı');

    // 16. Son Projeler'den bir projeyi sil ve listeden kaybolduğunu doğrula
    await cdp.evaluate(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.trim() === 'Projeler'
        );
        homeBtn?.click();
      })()
    `);
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)').length > 0`
      ),
      'Son Projeler listesinde silinecek kayıtlı proje bulunamadı.'
    );

    const beforeDeleteInfo = await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)'));
        const firstRow = rows[0];
        const firstName = firstRow?.querySelector('.welcome-project-row__name')?.textContent?.trim() || '';
        const delBtn = firstRow?.querySelector('button[title="Projeyi Sil"]');
        delBtn?.click();
        return { count: rows.length, deletedName: firstName, clicked: Boolean(delBtn) };
      })()
    `);
    assert.ok(beforeDeleteInfo.clicked, 'Projeyi Sil butonu tıklanamadı.');
    assert.ok(
      await waitFor(
        cdp,
        `document.querySelectorAll('#welcome-recent .welcome-project-row:not(.welcome-project-row--draft)').length === ${beforeDeleteInfo.count - 1}`
      ),
      'Silinen proje Son Projeler listesinden kaybolmadı.'
    );
    console.log('  ✓ Son Projeler listesinden bir proje silindi ve listeden kaybolduğu doğrulandı');

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
