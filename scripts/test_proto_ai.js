import assert from 'node:assert/strict';
import sampleTree from '../src/proto/sampleTree.js';
import { compileStyles } from '../src/proto/compileStyles.js';
import {
  COLOR_TOKENS,
  GAP_PADDING_TOKENS,
  inspectTreeIssues,
  sanitizeNode,
  validateButtonHref,
  validateColor,
  validateImageSrc,
  validateNodePatch,
} from '../src/proto/schema.js';
import { buildPreset, listPresets } from '../src/proto/presets.js';
import { TOOL_DECLARATIONS, executeTool } from '../src/proto/aiTools.js';
import { MAX_AGENT_TURNS, runAgent } from '../src/proto/geminiAgent.js';
import { findNode } from '../src/proto/treeOps.js';
import { createInitialStoreState, treeStoreReducer } from '../src/proto/useTreeStore.js';

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

function makeDetIdGen(prefixBase = 'det') {
  let seq = 0;
  return (hint = 'n') => `${prefixBase}-${hint}-${++seq}`;
}

async function main() {
  console.log('\n🧪 CraftProto Faz 3 Schema, Presets, AI Tools, Gemini Agent & Store Testleri');

  await test('schema: bilinmeyen token reddi, pos kırpma, tehlikeli href/src ve geçersiz renk reddi', () => {
    assert.deepEqual(GAP_PADDING_TOKENS, ['xs', 'sm', 'md', 'lg', 'xl']);
    assert.deepEqual(COLOR_TOKENS, ['primary', 'accent', 'surface', 'text', 'muted']);

    const badGap = validateNodePatch({ layout: { gap: 'huge' } });
    assert.equal(badGap.ok, false);
    assert.ok(badGap.error.includes('gap'));

    const badCol = validateNodePatch({ layout: { columns: 9 } });
    assert.equal(badCol.ok, false);

    const badBp = validateNodePatch({ responsive: { xl: { layout: { gap: 'sm' } } } });
    assert.equal(badBp.ok, false);

    assert.equal(validateButtonHref('javascript:alert(1)').ok, false);
    assert.equal(validateButtonHref('data:text/html,<script>').ok, false);
    assert.equal(validateButtonHref('https://example.com').ok, true);
    assert.equal(validateButtonHref('http://example.com').ok, true);
    assert.equal(validateButtonHref('mailto:a@b.com').ok, true);
    assert.equal(validateButtonHref('tel:+905551112233').ok, true);
    assert.equal(validateButtonHref('#iletisim').ok, true);

    assert.equal(validateImageSrc('javascript:alert(1)').ok, false);
    assert.equal(validateImageSrc('http://insecure.example.com/a.jpg').ok, false);
    assert.equal(validateImageSrc('ftp://files.example.com/a.jpg').ok, false);
    assert.equal(validateImageSrc('https://cdn.example.com/ring.jpg').ok, true);
    assert.equal(validateImageSrc('data:image/png;base64,AAA').ok, true);
    assert.equal(
      validateImageSrc('data:image/svg+xml;utf8,<svg><script>alert(1)</script></svg>').ok,
      false
    );

    assert.equal(validateColor('red').ok, false);
    assert.equal(validateColor('rgb(255,0,0)').ok, false);
    assert.equal(validateColor('#12345').ok, false);
    assert.equal(validateColor('primary').ok, true);
    assert.equal(validateColor('#A1B2C3').ok, true);
    assert.equal(validateColor('#abc').ok, true);

    const dirtyLayer = sanitizeNode({
      id: 'b1',
      type: 'blob',
      placement: 'layer',
      pos: { x: 150, y: -30, rot: 260 },
      props: { href: 'javascript:evil()', bg: 'red' },
    });
    assert.deepEqual(dirtyLayer.pos, { x: 100, y: 0, rot: 180 });
    assert.equal(dirtyLayer.props.bg, undefined);

    const dirtyTree = {
      id: 'p1',
      type: 'page',
      children: [
        {
          id: 's1',
          type: 'section',
          layout: { mode: 'stack', gap: 'huge', padding: 'massive' },
          size: { w: 'fill', h: 'hug' },
          props: { bg: 'javascript:evil()', border: '1px solid red' },
          children: [
            {
              id: 'btn1',
              type: 'button',
              props: { label: 'Ara', href: 'javascript:alert(1)' },
            },
          ],
        },
      ],
    };
    const css = compileStyles(dirtyTree, { includeBase: false });
    assert.equal(css.includes('huge'), false);
    assert.equal(css.includes('massive'), false);
    assert.equal(css.includes('javascript:'), false);
    assert.ok(css.includes('gap: var(--space-md);'));
    assert.deepEqual(inspectTreeIssues(sampleTree), []);
  });

  await test('presets: 6 preset benzersiz deterministik id üretir, şemadan geçer ve sabit px yükseklik içermez', () => {
    const meta = listPresets();
    assert.deepEqual(
      meta.map((m) => m.name),
      ['hero-split', 'feature-grid-3', 'pricing-3col', 'testimonial', 'cta-banner', 'footer-4col']
    );

    const collectAllIdsAndVerify = (node, ids, isHero) => {
      assert.ok(node.id, 'Her düğümün id alanı olmalı');
      assert.equal(ids.has(node.id), false, `Yinelenen id tespit edildi: ${node.id}`);
      ids.add(node.id);
      if (node.placement !== 'layer') {
        assert.notEqual(typeof node.size?.h === 'string' && node.size.h.endsWith('px'), true);
      }
      if (!isHero) {
        assert.notEqual(node.placement, 'layer', 'Dekoratif layer yalnızca hero presette olabilir');
      }
      for (const child of node.children || []) {
        collectAllIdsAndVerify(child, ids, isHero);
      }
    };

    for (const preset of meta) {
      const built = buildPreset(preset.name, {}, makeDetIdGen(preset.name));
      assert.ok(built);
      assert.equal(built.type, 'section');
      const ids = new Set();
      collectAllIdsAndVerify(built, ids, preset.name === 'hero-split');
      const issues = inspectTreeIssues(built);
      assert.deepEqual(issues, [], `${preset.name} şema/proje kontrolünden sorunsuz geçmeli`);
    }
  });

  await test('executeTool: tüm araçlar, immutability, kabul kuralları ve son section koruması', () => {
    assert.ok(Array.isArray(TOOL_DECLARATIONS) && TOOL_DECLARATIONS.length >= 15);
    const idGen = makeDetIdGen('t');

    const outlineRes = executeTool(sampleTree, 'get_project_outline', {}, idGen);
    assert.equal(outlineRes.result.ok, true);
    assert.equal(outlineRes.tree, sampleTree);
    assert.equal(outlineRes.result.outline.id, 'page-home');

    const selRes = executeTool(sampleTree, 'get_selection', {}, idGen, { selectedId: 'hero-title' });
    assert.equal(selRes.result.ok, true);
    assert.equal(selRes.result.selection.id, 'hero-title');

    const nullSel = executeTool(sampleTree, 'get_selection', {}, idGen, { selectedId: null });
    assert.equal(nullSel.result.selection, null);

    const missingNode = executeTool(sampleTree, 'get_node', { id: 'yok' }, idGen);
    assert.equal(missingNode.result.ok, false);
    assert.equal(missingNode.tree, sampleTree);

    // Kabul kuralı: section başka bir container altına taşınamaz
    const invalidMove = executeTool(
      sampleTree,
      'move_node',
      { id: 'features-section', targetParentId: 'hero-copy', index: 0 },
      idGen
    );
    assert.equal(invalidMove.result.ok, false);
    assert.equal(invalidMove.tree, sampleTree);

    // Yaprak düğüme layout / taşıma engeli
    const invalidLayout = executeTool(
      sampleTree,
      'set_layout',
      { id: 'hero-title', layout: { mode: 'row' } },
      idGen
    );
    assert.equal(invalidLayout.result.ok, false);
    assert.equal(invalidLayout.tree, sampleTree);

    // Son section silinemez
    const r1 = executeTool(sampleTree, 'remove_node', { id: 'features-section' }, idGen);
    assert.equal(r1.result.ok, true);
    const r2 = executeTool(r1.tree, 'remove_node', { id: 'hero-section' }, idGen);
    assert.equal(r2.result.ok, false);
    assert.equal(r2.tree, r1.tree);

    // add_section, replace_section, set_text, set_image, set_layout, set_size, set_responsive, apply_theme, validate_project
    const a1 = executeTool(sampleTree, 'add_section', { preset: 'pricing-3col', props: { title: 'Yeni Paketler' } }, idGen);
    assert.equal(a1.result.ok, true);
    assert.notEqual(a1.tree, sampleTree);
    assert.equal(sampleTree.children.length, 2); // immutability

    const rep = executeTool(a1.tree, 'replace_section', { id: a1.result.addedSectionId, preset: 'footer-4col' }, idGen);
    assert.equal(rep.result.ok, true);

    const txtOk = executeTool(rep.tree, 'set_text', { id: 'hero-title', text: 'Yeni Başlık' }, idGen);
    assert.equal(txtOk.result.ok, true);
    assert.equal(findNode(txtOk.tree, 'hero-title').props.text, 'Yeni Başlık');

    const imgBad = executeTool(txtOk.tree, 'set_image', { id: 'hero-image', src: 'http://bad.com/x.jpg', alt: 'Test' }, idGen);
    assert.equal(imgBad.result.ok, false);
    assert.equal(imgBad.tree, txtOk.tree);

    const imgOk = executeTool(txtOk.tree, 'set_image', { id: 'hero-image', src: 'https://cdn.example.com/ring.jpg', alt: 'Altın Yüzük' }, idGen);
    assert.equal(imgOk.result.ok, true);

    const layOk = executeTool(imgOk.tree, 'set_layout', { id: 'hero-copy', layout: { gap: 'lg' } }, idGen);
    assert.equal(layOk.result.ok, true);

    const sizeOk = executeTool(layOk.tree, 'set_size', { id: 'hero-copy', size: { w: 'fill', h: 'hug' } }, idGen);
    assert.equal(sizeOk.result.ok, true);

    const respOk = executeTool(sizeOk.tree, 'set_responsive', { id: 'features-grid', breakpoint: 'sm', patch: { layout: { columns: 1 } } }, idGen);
    assert.equal(respOk.result.ok, true);

    const themeOk = executeTool(respOk.tree, 'apply_theme', { tokens: { primary: '#112233', accent: '#AA7722', fontFamily: 'serif' } }, idGen);
    assert.equal(themeOk.result.ok, true);
    assert.equal(themeOk.tree.props.theme.primary, '#112233');

    const valOk = executeTool(themeOk.tree, 'validate_project', {}, idGen);
    assert.equal(valOk.result.ok, true);
    assert.equal(valOk.result.issueCount, 0);
  });

  await test('geminiAgent: a) paralel çağrı tek user turu b) thought gizleme c) thoughtSignature derin koruma', async () => {
    const SECRET_KEY = 'AIzaFakeSecretKey_MUST_NOT_LEAK_12345';
    const capturedRequests = [];

    const thoughtContentTurn1 = {
      role: 'model',
      parts: [
        { thought: true, text: 'İçsel düşünce gizli kalmalı' },
        {
          functionCall: { name: 'get_project_outline', args: {} },
          thoughtSignature: 'sig_turn1_parallel_a',
        },
        {
          functionCall: { name: 'list_section_presets', args: {} },
          thoughtSignature: 'sig_turn1_parallel_b',
        },
      ],
    };

    const fakeFetch = async (url, init) => {
      const body = JSON.parse(init.body);
      capturedRequests.push({ url, headers: init.headers, body });

      if (capturedRequests.length === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: thoughtContentTurn1, finishReason: 'STOP' }],
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                role: 'model',
                parts: [
                  { thought: true, text: 'Gizli son düşünce metni' },
                  { text: 'Sayfa özeti okundu ve presetler listelendi.' },
                ],
              },
            },
          ],
        }),
      };
    };

    const res = await runAgent({
      prompt: 'Proje yapısını ve presetleri incele',
      baseTree: sampleTree,
      selectedId: 'hero-title',
      apiKey: SECRET_KEY,
      fetchImpl: fakeFetch,
      retryDelayMs: 0,
    });

    assert.equal(res.ok, true);
    assert.equal(capturedRequests.length, 2);

    // Anahtar URL'de değil x-goog-api-key header'da ve responseMimeType eklenmiyor
    assert.equal(capturedRequests[0].url.includes(SECRET_KEY), false);
    assert.equal(capturedRequests[0].headers['x-goog-api-key'], SECRET_KEY);
    assert.equal(capturedRequests[0].body.generationConfig.responseMimeType, undefined);

    // c) thoughtSignature taşıyan model content nesnesi bir sonraki istek geçmişinde AYNEN bulunur
    assert.deepEqual(capturedRequests[1].body.contents[1], thoughtContentTurn1);

    // a) Aynı turdaki 2 paralel functionCall -> TEK user turunda 2 functionResponse
    const userTurn2 = capturedRequests[1].body.contents[2];
    assert.equal(userTurn2.role, 'user');
    assert.equal(userTurn2.parts.length, 2);
    assert.equal(userTurn2.parts[0].functionResponse.name, 'get_project_outline');
    assert.equal(userTurn2.parts[1].functionResponse.name, 'list_section_presets');

    // b) thought:true parçaları finalText'e karışmaz
    assert.equal(res.finalText, 'Sayfa özeti okundu ve presetler listelendi.');
    assert.equal(res.finalText.includes('Gizli'), false);
    assert.equal(JSON.stringify(res).includes(SECRET_KEY), false);
  });

  await test('geminiAgent: d) geçersiz argümanı hata cevabıyla 2. turda düzeltme ve uçtan uca 4 bölümlü sayfa', async () => {
    const SECRET_KEY = 'AIzaSecretKey_EndToEnd_987654';
    const requests = [];

    const fakeFetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      const turn = requests.length;

      if (turn === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'set_layout',
                        args: { id: 'features-grid', layout: { gap: 'huge' } },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      if (turn === 2) {
        // Model ilk turdan gelen { ok: false, error } yanıtını gördü mü?
        const lastUserParts = body.contents[body.contents.length - 1].parts;
        assert.equal(lastUserParts[0].functionResponse.response.ok, false);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'set_layout',
                        args: { id: 'features-grid', layout: { gap: 'lg' } },
                      },
                    },
                    {
                      functionCall: {
                        name: 'add_section',
                        args: { preset: 'pricing-3col', props: { title: 'Fiyatlandırma' } },
                      },
                    },
                    {
                      functionCall: {
                        name: 'add_section',
                        args: { preset: 'footer-4col', props: { brandName: 'Atölye Lumina' } },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      if (turn === 3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  role: 'model',
                  parts: [{ functionCall: { name: 'validate_project', args: {} } }],
                },
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                role: 'model',
                parts: [
                  {
                    text: 'Hero, özellikler, fiyatlandırma ve footer bölümleri başarıyla kuruldu ve doğrulandı.',
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const res = await runAgent({
      prompt: 'Hero + özellikler + fiyatlandırma + footer olan bir sayfa kur',
      baseTree: sampleTree,
      apiKey: SECRET_KEY,
      fetchImpl: fakeFetch,
      idGen: makeDetIdGen('e2e'),
      retryDelayMs: 0,
    });

    assert.equal(res.ok, true);
    assert.equal(res.steps[0].ok, false);
    assert.equal(res.steps[1].ok, true);
    assert.equal(res.draftTree.children.length, 4);
    assert.deepEqual(inspectTreeIssues(res.draftTree), []);
    const css = compileStyles(res.draftTree);
    assert.equal(css.includes('huge'), false);
    assert.equal(css.includes('javascript:'), false);
    assert.equal(JSON.stringify(res).includes(SECRET_KEY), false);
  });

  await test('geminiAgent: e) 12 tur sınırı, 429 yeniden deneme, AbortSignal iptali ve anahtar sızıntısı koruması', async () => {
    const SECRET_KEY = 'AIzaLeakedCandidateSecret99999';

    // 1) 12 tur sınırı
    let loopCalls = 0;
    const infiniteToolFetch = async () => {
      loopCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                role: 'model',
                parts: [{ functionCall: { name: 'get_project_outline', args: {} } }],
              },
            },
          ],
        }),
      };
    };
    const limitRes = await runAgent({
      prompt: 'Sonsuz döngü',
      baseTree: sampleTree,
      apiKey: SECRET_KEY,
      fetchImpl: infiniteToolFetch,
      retryDelayMs: 0,
    });
    assert.equal(loopCalls, MAX_AGENT_TURNS);
    assert.equal(limitRes.ok, false);
    assert.ok(limitRes.error.includes('adım sınırı'));
    assert.ok(limitRes.draftTree);

    // 2) 429 sonrası tek yeniden deneme + 4xx/5xx hata mesajında anahtar temizleme
    let retryCount = 0;
    const retryFetch = async () => {
      retryCount += 1;
      if (retryCount === 1) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: `Rate limit for ${SECRET_KEY}` } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: { role: 'model', parts: [{ text: 'Yeniden deneme başarılı.' }] },
            },
          ],
        }),
      };
    };
    const retryRes = await runAgent({
      prompt: 'Kısa deneme',
      baseTree: sampleTree,
      apiKey: SECRET_KEY,
      fetchImpl: retryFetch,
      retryDelayMs: 1,
    });
    assert.equal(retryRes.ok, true);
    assert.equal(retryCount, 2);

    // 400 hata gövdesi içindeki anahtarı sızdırmama
    const badKeyLeakFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: `Invalid key ${SECRET_KEY}` } }),
    });
    const badRes = await runAgent({
      prompt: 'Hata testi',
      baseTree: sampleTree,
      apiKey: SECRET_KEY,
      fetchImpl: badKeyLeakFetch,
      retryDelayMs: 0,
    });
    assert.equal(badRes.ok, false);
    assert.equal(badRes.draftTree, null);
    assert.equal(badRes.error.includes(SECRET_KEY), false);

    // 3) AbortSignal ile iptal -> taslak dönmüyor
    const ac = new AbortController();
    const abortFetch = async (_url, init) => {
      ac.abort();
      if (init.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const abortRes = await runAgent({
      prompt: 'İptal et',
      baseTree: sampleTree,
      apiKey: SECRET_KEY,
      signal: ac.signal,
      fetchImpl: abortFetch,
    });
    assert.equal(abortRes.ok, false);
    assert.equal(abortRes.aborted, true);
    assert.equal(abortRes.draftTree, null);
  });

  await test('store: APPLY_AI_DRAFT tek geçmiş adımı, sürüm çakışması reddi, aiBusy kilidi ve seçim uzlaştırma', () => {
    const init = createInitialStoreState(sampleTree, 'hero-title');
    assert.equal(init.treeVersion, 0);

    // aiBusy iken mutasyonlar engellenir
    const busyState = treeStoreReducer(init, { type: 'SET_AI_BUSY', aiBusy: true });
    assert.equal(treeStoreReducer(busyState, { type: 'REMOVE_NODE', id: 'hero-title' }), busyState);
    assert.equal(treeStoreReducer(busyState, { type: 'SET_EDITING_ID', nodeId: 'hero-title' }), busyState);

    // Taslak hazırla (hero-title silinmiş + 1 yeni section eklenmiş)
    const draft1 = executeTool(sampleTree, 'remove_node', { id: 'hero-title' }, makeDetIdGen('s')).tree;
    const draft2 = executeTool(draft1, 'add_section', { preset: 'cta-banner' }, makeDetIdGen('s')).tree;

    // Sürüm uyuşmazlığında reddedilir
    const movedManually = treeStoreReducer(init, {
      type: 'UPDATE_NODE',
      id: 'hero-subtitle',
      patch: { props: { text: 'Manuel güncelleme' } },
    });
    assert.equal(movedManually.treeVersion, 1);
    const conflictState = treeStoreReducer(movedManually, {
      type: 'APPLY_AI_DRAFT',
      tree: draft2,
      baseVersion: 0,
    });
    assert.equal(conflictState.tree, movedManually.tree);
    assert.equal(conflictState.aiConflict, true);

    // Uyumlu sürümde TEK geçmiş adımı + seçili öğe ağaçta yoksa null uzlaştırması
    const applied = treeStoreReducer(init, {
      type: 'APPLY_AI_DRAFT',
      tree: draft2,
      baseVersion: init.treeVersion,
    });
    assert.equal(applied.tree, draft2);
    assert.equal(applied.history.past.length, 1);
    assert.equal(applied.commitCount, 1);
    assert.equal(applied.treeVersion, 1);
    assert.equal(applied.selectedId, null); // hero-title silindiği için temizlendi

    // Tek UNDO ile başa dön
    const undone = treeStoreReducer(applied, { type: 'UNDO' });
    assert.equal(undone.tree, sampleTree);
    assert.equal(undone.history.past.length, 0);
    assert.equal(undone.selectedId, null);
  });

  console.log(`\n🎉 Toplam ${passed} Faz 3 AI testi başarıyla geçti!\n`);
}

main();
