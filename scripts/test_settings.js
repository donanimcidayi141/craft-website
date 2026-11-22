import assert from 'node:assert/strict';
import {
  AUTOSAVE_STORAGE_KEY,
  clearApiKey,
  clearRecentProjectsList,
  DEFAULT_SETTINGS,
  discardAutosaveDraft,
  GEMINI_API_KEY_STORAGE_KEY,
  getApiKey,
  getSettings,
  maskApiKey,
  RECENT_PROJECTS_STORAGE_KEY,
  redactApiKeyFromText,
  resetLocalSettings,
  SAVED_PROJECTS_STORAGE_KEY,
  setApiKey,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  subscribe,
  testGeminiKey,
  updateSettings,
} from '../src/settings/settingsStore.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    _dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log(`  ✓ ${name}`);
  passed += 1;
}

console.log('\n🧪 SettingsStore & Ayarlar Güvenliği Testleri');

await test('varsayılanlar ve bozuk JSON durumunda güvenli dönüş', () => {
  const emptyStorage = createMemoryStorage();
  assert.deepEqual(getSettings(emptyStorage), { ...DEFAULT_SETTINGS });

  const brokenStorage = createMemoryStorage({
    [SETTINGS_STORAGE_KEY]: '{bozuk-json!!!',
  });
  assert.deepEqual(getSettings(brokenStorage), { ...DEFAULT_SETTINGS });
});

await test('eski sürüm (v0) ayar nesnesinden v1 şemasına göç', () => {
  const legacyStorage = createMemoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      version: 0,
      model: 'gemini-pro-latest',
      device: 'mobile',
      ambientBackground: false,
      reduceMotion: true,
    }),
  });
  const migrated = getSettings(legacyStorage);
  assert.equal(migrated.version, SETTINGS_SCHEMA_VERSION);
  assert.equal(migrated.defaultModel, 'gemini-pro-latest');
  assert.equal(migrated.defaultDevice, 'mobile');
  assert.equal(migrated.showAmbientBg, false);
  assert.equal(migrated.reduceMotion, true);
});

await test('geriye uyumlu craft_gemini_api_key okuma/yazma ve doğrulama kuralları', () => {
  const sampleValidKey = 'AIzaSyD1234567890abcdefghijklmnopqrstuv'; // 39 chars
  const storage = createMemoryStorage();

  // Boşluk veya satır sonu reddi
  const withSpace = setApiKey('AIzaSy1234 567890', storage);
  assert.equal(withSpace.ok, false);
  assert.equal(storage.getItem(GEMINI_API_KEY_STORAGE_KEY), null);

  const withNewline = setApiKey('AIzaSy1234\n567890', storage);
  assert.equal(withNewline.ok, false);
  assert.equal(storage.getItem(GEMINI_API_KEY_STORAGE_KEY), null);

  const emptyRes = setApiKey('   ', storage);
  assert.equal(emptyRes.ok, false);

  // Standart dışı formatta yalnızca uyarı ver, kaydet
  const nonStd = setApiKey('  custom-test-token-123  ', storage);
  assert.equal(nonStd.ok, true);
  assert.ok(nonStd.warning && nonStd.warning.includes('39'));
  assert.equal(storage.getItem(GEMINI_API_KEY_STORAGE_KEY), 'custom-test-token-123');

  // Standart 39 karakterlik AIza anahtarında uyarı yok
  const stdRes = setApiKey(` ${sampleValidKey} `, storage);
  assert.equal(stdRes.ok, true);
  assert.equal(stdRes.warning, null);
  assert.equal(getApiKey(storage), sampleValidKey);
  assert.equal(storage.getItem(GEMINI_API_KEY_STORAGE_KEY), sampleValidKey);

  // Maskeleme
  assert.equal(maskApiKey(sampleValidKey), 'AIza••••••••stuv');
  assert.equal(redactApiKeyFromText(`Hata: ${sampleValidKey} geçersiz`, sampleValidKey), 'Hata: [GİZLİ] geçersiz');

  clearApiKey(storage);
  assert.equal(getApiKey(storage), '');
  assert.equal(storage.getItem(GEMINI_API_KEY_STORAGE_KEY), null);
});

await test('testGeminiKey: x-goog-api-key başlığı, HTTP 200/400/403/429, ağ/zaman aşımı, iptal ve anahtar gizliliği', async () => {
  const fakeKey = 'AIzaSyFakeKeyForUnitTest0000000000009999';

  // 200 OK ve başlık kontrolü
  let capturedUrl = '';
  let capturedHeaders = {};
  const okRes = await testGeminiKey(fakeKey, {
    fetchImpl: async (url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      return { status: 200 };
    },
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.message, 'Bağlantı başarılı');
  assert.ok(!capturedUrl.includes(fakeKey), 'API anahtarı URL query içine sızmamalı');
  assert.equal(capturedHeaders['x-goog-api-key'], fakeKey);

  // 400 / 403
  for (const status of [400, 403]) {
    const badRes = await testGeminiKey(fakeKey, {
      fetchImpl: async () => ({ status }),
    });
    assert.equal(badRes.ok, false);
    assert.equal(badRes.message, 'Anahtar geçersiz veya yetkisiz');
    assert.ok(!badRes.message.includes(fakeKey));
  }

  // 429
  const quotaRes = await testGeminiKey(fakeKey, {
    fetchImpl: async () => ({ status: 429 }),
  });
  assert.equal(quotaRes.ok, false);
  assert.equal(quotaRes.message, 'Kota aşıldı, biraz sonra dene');

  // Ağ hatası (hata mesajı ham anahtarı içerse bile sızdırmamalı)
  const netRes = await testGeminiKey(fakeKey, {
    fetchImpl: async () => {
      throw new Error(`ENOTFOUND key=${fakeKey}`);
    },
  });
  assert.equal(netRes.ok, false);
  assert.equal(netRes.message, 'Bağlanılamadı, internet bağlantını kontrol et');
  assert.ok(!netRes.message.includes(fakeKey));

  // Zaman aşımı simülasyonu
  const timeoutRes = await testGeminiKey(fakeKey, {
    timeoutMs: 15,
    fetchImpl: (_url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  });
  assert.equal(timeoutRes.ok, false);
  assert.equal(timeoutRes.message, 'Bağlanılamadı, internet bağlantını kontrol et');

  // Dış iptal
  const externalAc = new AbortController();
  const cancelPromise = testGeminiKey(fakeKey, {
    signal: externalAc.signal,
    fetchImpl: (_url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });
  externalAc.abort();
  const cancelRes = await cancelPromise;
  assert.equal(cancelRes.ok, false);
  assert.equal(cancelRes.aborted, true);
});

await test('yıkıcı eylemler kayıtlı projelere ve diğer anahtarlara dokunmaz', () => {
  const savedPayload = JSON.stringify({ 'proj-1': { id: 'proj-1', name: 'Altın Vitrini' } });
  const convPayload = JSON.stringify([{ id: 'conv-1', messages: [{ role: 'user', text: 'selam' }] }]);
  const storage = createMemoryStorage({
    [SAVED_PROJECTS_STORAGE_KEY]: savedPayload,
    [RECENT_PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'proj-1', name: 'Altın Vitrini' }]),
    [AUTOSAVE_STORAGE_KEY]: JSON.stringify({ id: 'draft-1', name: 'Taslak' }),
    craft_ai_conversations_v1: convPayload,
    [GEMINI_API_KEY_STORAGE_KEY]: 'AIzaSyProtectedKey0000000000000000001234',
  });
  updateSettings({ showAmbientBg: false, defaultDevice: 'mobile' }, storage);

  // Taslak sil -> sadece autosave silinir
  discardAutosaveDraft(storage);
  assert.equal(storage.getItem(AUTOSAVE_STORAGE_KEY), null);
  assert.equal(storage.getItem(SAVED_PROJECTS_STORAGE_KEY), savedPayload);

  // Son listeyi temizle -> sadece recent listesi silinir, savedProjects ve key kalır!
  clearRecentProjectsList(storage);
  assert.equal(storage.getItem(RECENT_PROJECTS_STORAGE_KEY), null);
  assert.equal(storage.getItem(SAVED_PROJECTS_STORAGE_KEY), savedPayload);
  assert.equal(storage.getItem('craft_ai_conversations_v1'), convPayload);
  assert.ok(getApiKey(storage).endsWith('1234'));

  // Ayarları sıfırla (API anahtarı korunarak)
  resetLocalSettings(storage, { includeApiKey: false });
  assert.equal(getSettings(storage).defaultDevice, 'desktop');
  assert.ok(getApiKey(storage).endsWith('1234'));
  assert.equal(storage.getItem(SAVED_PROJECTS_STORAGE_KEY), savedPayload);

  // Ayarları sıfırla (API anahtarıyla birlikte) -> savedProjects yine korunur!
  resetLocalSettings(storage, { includeApiKey: true });
  assert.equal(getApiKey(storage), '');
  assert.equal(storage.getItem(SAVED_PROJECTS_STORAGE_KEY), savedPayload);
});

await test('subscribe değişiklikleri aynı oturum içinde bildirir', () => {
  const storage = createMemoryStorage();
  let calls = 0;
  let lastSnapshot = null;
  const unsub = subscribe((snap) => {
    calls += 1;
    lastSnapshot = snap;
  });

  updateSettings({ showAmbientBg: false }, storage);
  assert.equal(calls, 1);
  assert.equal(lastSnapshot.settings.showAmbientBg, false);

  setApiKey('AIzaSySubscribeTest000000000000000001122', storage);
  assert.equal(calls, 2);
  assert.ok(lastSnapshot.apiKey.endsWith('1122'));

  unsub();
  updateSettings({ reduceMotion: true }, storage);
  assert.equal(calls, 2);
});

await test('v2 -> v3 kayıpsız göç, çok bölgeli panelZones/tabs/floatingPanels kaydı ve okuma anı ekran kırpması', () => {
  assert.equal(SETTINGS_SCHEMA_VERSION, 3);
  const v2Storage = createMemoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      version: 2,
      defaultModel: 'gemini-3-flash-preview',
      defaultDevice: 'desktop',
      showAmbientBg: true,
      reduceMotion: false,
      workspaceLayoutsByMode: {
        design: {
          presetId: 'custom',
          leftDrawer: { activeTab: 'layers', width: 340 },
          rightDock: { isOpen: true, propertiesTab: 'css', width: 420 },
          aiDock: { isMinimized: false },
          floatingRect: { x: 980, y: 110, width: 700, height: 520 },
        },
        backend: {
          presetId: 'custom',
          leftDrawer: { activeTab: 'dataModels', width: 312 },
          rightDock: { isOpen: false, propertiesTab: 'testRun', width: 360 },
          aiDock: { isMinimized: true },
        },
      },
    }),
  });

  const migrated = getSettings(v2Storage);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.workspaceLayoutsByMode.design.leftDrawer.width, 340);
  assert.equal(migrated.workspaceLayoutsByMode.design.leftDrawer.activeTab, 'layers');
  assert.deepEqual(migrated.workspaceLayoutsByMode.design.leftDrawer.tabs, ['layers']);
  assert.equal(migrated.workspaceLayoutsByMode.design.rightDock.width, 420);
  assert.equal(migrated.workspaceLayoutsByMode.design.rightDock.propertiesTab, 'css');
  assert.deepEqual(migrated.workspaceLayoutsByMode.design.rightDock.tabs, ['properties']);
  assert.deepEqual(migrated.workspaceLayoutsByMode.design.floatingPanels.attributesAndCss.rect, {
    x: 980,
    y: 110,
    width: 700,
    height: 520,
  });
  assert.equal(migrated.workspaceLayoutsByMode.backend.leftDrawer.width, 312);
  assert.deepEqual(migrated.workspaceLayoutsByMode.backend.leftDrawer.tabs, ['dataModels']);
  assert.equal(migrated.workspaceLayoutsByMode.backend.rightDock.isOpen, false);
  assert.equal(migrated.workspaceLayoutsByMode.backend.rightDock.propertiesTab, 'testRun');
  assert.equal(migrated.workspaceLayoutsByMode.backend.aiDock.isMinimized, true);
});

console.log(`\n🎉 Toplam ${passed}/7 settingsStore testi başarıyla geçti!\n`);
