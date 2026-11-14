import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from '@babel/parser';

import sampleTree from '../src/proto/sampleTree.js';
import { CONTENT_PACK_ASSETS } from '../src/data/contentPacks.js';
import { inspectTreeIssues } from '../src/proto/schema.js';
import { findNode } from '../src/proto/treeOps.js';
import {
  PROJECT_SCHEMA_VERSION,
  addPage,
  fromLegacyTree,
  getActivePage,
  getActiveTree,
  getPageFileName,
  movePage,
  removePage,
  renamePage,
  setHome,
  slugifyTitle,
  switchPage,
  updateActiveTree,
  validateProject,
} from '../src/proto/project.js';
import { createInitialStoreState, treeStoreReducer } from '../src/proto/useTreeStore.js';
import { listContentPacks, packToNodes } from '../src/proto/packAdapter.js';
import { exportStatic } from '../src/proto/exportStatic.js';
import { exportReact } from '../src/proto/exportReact.js';
import { zipStore } from '../src/proto/zipStore.js';
import { executeTool } from '../src/proto/aiTools.js';
import { runAgent } from '../src/proto/geminiAgent.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed += 1;
  }
}

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

function walkNodes(node, cb) {
  if (!node || typeof node !== 'object') return;
  cb(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkNodes(child, cb);
  }
}

async function main() {
  console.log('\n🧪 CraftProto Faz 4b Çoklu Sayfa, İçerik Paketleri & Export Testleri');

  await test('project: fromLegacyTree, Türkçe slug, çakışma -2, setHome, movePage ve validateProject kuralları', () => {
    const project = fromLegacyTree(sampleTree);
    assert.equal(project.schemaVersion, PROJECT_SCHEMA_VERSION);
    assert.equal(project.pages.length, 1);
    assert.equal(project.pages[0].isHome, true);
    assert.equal(project.pages[0].slug, 'index');
    assert.equal(project.theme.primary, sampleTree.props.theme.primary);
    assert.equal(validateProject(project).ok, true);

    assert.equal(slugifyTitle('Hakkımızda & İş Ortakları Şükrü'), 'hakkimizda-is-ortaklari-sukru');

    const p1 = addPage(project, { title: 'Hakkımızda' });
    assert.equal(p1.ok, true);
    assert.equal(p1.page.slug, 'hakkimizda');
    assert.equal(p1.page.isHome, false);

    // Aynı başlıkla 2. kez ekleyince benzersiz -2 almalı
    const p2 = addPage(p1.project, { title: 'Hakkımızda' });
    assert.equal(p2.ok, true);
    assert.equal(p2.page.slug, 'hakkimizda-2');

    // Yeniden adlandırma
    const ren = renamePage(p2.project, p2.page.id, 'İletişim & Atölye');
    assert.equal(ren.ok, true);
    assert.equal(ren.page.slug, 'iletisim-atolye');

    // Ana sayfa değiştirince yeni ana sayfa slug:'index', eski ana sayfa ise kendi slugına geçmeli
    const homeSwapped = setHome(ren.project, p1.page.id);
    assert.equal(homeSwapped.ok, true);
    const homePages = homeSwapped.project.pages.filter((p) => p.isHome);
    assert.equal(homePages.length, 1);
    assert.equal(homePages[0].id, p1.page.id);
    assert.equal(homePages[0].slug, 'index');
    const oldHome = homeSwapped.project.pages.find((p) => p.id === project.pages[0].id);
    assert.equal(oldHome.isHome, false);
    assert.notEqual(oldHome.slug, 'index');
    assert.equal(validateProject(homeSwapped.project).ok, true);

    // Sıralama
    const moved = movePage(homeSwapped.project, p2.page.id, 0);
    assert.equal(moved.ok, true);
    assert.equal(moved.project.pages[0].id, p2.page.id);

    // validateProject: tekrar eden ID, 0/2 isHome ve kırık page: linki yakalamalı
    const dupNodeIdProject = structuredClone(p1.project);
    dupNodeIdProject.pages[1].tree.children[0].id = 'hero-title'; // page-home içindeki ID ile çakışma
    const dupRes = validateProject(dupNodeIdProject);
    assert.equal(dupRes.ok, false);
    assert.ok(dupRes.errors.some((e) => e.includes('hero-title')));

    const twoHomes = structuredClone(p1.project);
    twoHomes.pages[1].isHome = true;
    twoHomes.pages[1].slug = 'index';
    assert.equal(validateProject(twoHomes).ok, false);

    const zeroHomes = structuredClone(p1.project);
    zeroHomes.pages[0].isHome = false;
    assert.equal(validateProject(zeroHomes).ok, false);
  });

  await test('project: removePage son sayfa reddi ve silinen sayfaya bağlı page: linklerinin # sıfırlanması', () => {
    const base = fromLegacyTree(sampleTree);
    const onlyHomeDelete = removePage(base, base.pages[0].id);
    assert.equal(onlyHomeDelete.ok, false);

    const added = addPage(base, { title: 'Koleksiyon' });
    assert.equal(added.ok, true);

    // Ana sayfadaki CTA butonunu yeni Koleksiyon sayfasına bağla
    const homeTree = added.project.pages[0].tree;
    const withLink = {
      ...homeTree,
      children: homeTree.children.map((sec) => {
        if (!findNode(sec, 'hero-cta')) return sec;
        return {
          ...sec,
          children: sec.children.map((c) => c),
        };
      }),
    };
    const linkedTree = executeTool(added.project, 'link_to_page', {
      buttonId: 'hero-cta-primary',
      pageId: added.page.id,
    }).project;
    assert.equal(findNode(linkedTree.pages[0].tree, 'hero-cta-primary').props.href, `page:${added.page.id}`);
    assert.equal(validateProject(linkedTree).issues.length, 0);

    // Koleksiyon sayfasını silince hero-cta-primary linki '#' olarak sıfırlanmalı ve uyarı vermeli
    const deleted = removePage(linkedTree, added.page.id);
    assert.equal(deleted.ok, true);
    assert.equal(deleted.project.pages.length, 1);
    assert.equal(deleted.warnings.length, 1);
    assert.ok(deleted.warnings[0].includes('hero-cta-primary'));
    assert.equal(findNode(deleted.project.pages[0].tree, 'hero-cta-primary').props.href, '#');
    assert.equal(validateProject(deleted.project).issues.length, 0);
  });

  await test('store: SWITCH_PAGE 0 geçmiş adımı, page add/remove + undo/redo, APPLY_AI_DRAFT sayfa koruma & aiBusy kilidi', () => {
    let st = createInitialStoreState(sampleTree, 'hero-title');
    assert.equal(st.history.past.length, 0);

    // Sayfa ekle -> 1 geçmiş adımı
    st = treeStoreReducer(st, { type: 'ADD_PAGE', title: 'Hakkımızda' });
    assert.equal(st.project.pages.length, 2);
    assert.equal(st.history.past.length, 1);
    assert.equal(st.commitCount, 1);

    const hakId = st.project.pages[1].id;

    // Sayfa değiştir -> 0 geçmiş adımı ve selection sıfırlanmalı
    const prevCommits = st.commitCount;
    const prevPastLen = st.history.past.length;
    st = treeStoreReducer(st, { type: 'SWITCH_PAGE', pageId: hakId });
    assert.equal(st.project.activePageId, hakId);
    assert.equal(st.commitCount, prevCommits);
    assert.equal(st.history.past.length, prevPastLen);
    assert.equal(st.selectedId, null);
    assert.equal(st.editingId, null);

    // Ana sayfaya geri dön ve Hakkımızda üzerinde AI taslağı uygula -> kullanıcının aktif sayfası korunmalı
    const homeId = st.project.pages[0].id;
    st = treeStoreReducer(st, { type: 'SWITCH_PAGE', pageId: homeId });
    const aiDraft = executeTool(st.project, 'switch_page', { pageId: hakId }).project;
    const aiDraft2 = executeTool(aiDraft, 'add_section', {
      preset: 'cta-banner',
      props: { title: 'Atölyemizi Ziyaret Edin' },
    }).project;

    st = treeStoreReducer(st, {
      type: 'APPLY_AI_DRAFT',
      project: aiDraft2,
      baseVersion: st.projectVersion,
    });
    assert.equal(st.aiConflict, false);
    // AI taslağı hakId'ye switch yapmıştı ama kullanıcı homeId'de idi -> homeId korunur!
    assert.equal(st.project.activePageId, homeId);
    assert.equal(st.project.pages[1].tree.children.length, 2);

    // Tek Undo ile AI değişikliği geri alınır
    st = treeStoreReducer(st, { type: 'UNDO' });
    assert.equal(st.project.pages[1].tree.children.length, 1);

    // Sayfadayken Undo yapıldığında silinmiş sayfadaysa aktif sayfa güvenli fallback yapar
    st = treeStoreReducer(st, { type: 'SWITCH_PAGE', pageId: hakId });
    assert.equal(st.project.activePageId, hakId);
    st = treeStoreReducer(st, { type: 'UNDO' }); // ADD_PAGE geri alındı!
    assert.equal(st.project.pages.length, 1);
    assert.equal(st.project.activePageId, homeId);
    assert.equal(st.selectedId, null);

    // aiBusy açıkken sayfa ekleme ve geçiş engellenir
    const busySt = treeStoreReducer(st, { type: 'SET_AI_BUSY', aiBusy: true });
    const blockedAdd = treeStoreReducer(busySt, { type: 'ADD_PAGE', title: 'Engelli' });
    assert.equal(blockedAdd.project.pages.length, 1);

    // İçerik paketi ekleme 1 geçmiş adımı üretir
    const beforePackCommits = st.commitCount;
    st = treeStoreReducer(st, { type: 'INSERT_CONTENT_PACK', packKey: 'nav-saas-split' });
    assert.equal(st.commitCount, beforePackCommits + 1);
    assert.ok(st.project.pages[0].tree.children.length > sampleTree.children.length);
  });

  await test('packAdapter: 22 paketin tamamı dondurulmuş girdide çalışır, inspectTreeIssues=[], sabit px/absolute yok + sentetik testler', () => {
    const packs = listContentPacks();
    assert.equal(packs.length, 22);
    assert.equal(CONTENT_PACK_ASSETS.length, 22);

    let seq = 1;
    const idGen = (hint = 'n') => `${hint}-${seq++}`;

    for (const rawPack of CONTENT_PACK_ASSETS) {
      const frozenPack = deepFreeze(structuredClone(rawPack));
      const { nodes, warnings } = packToNodes(frozenPack, idGen);
      assert.equal(nodes.length, 1, `Paket '${rawPack.presetKey}' 1 section üretmeli`);
      const section = nodes[0];
      assert.equal(section.type, 'section');

      const issues = inspectTreeIssues(section);
      assert.deepEqual(issues, [], `Paket '${rawPack.presetKey}' şema hatası vermemeli`);

      // Akışta sabit px height veya placement:'absolute' yok
      walkNodes(section, (n) => {
        if (n.placement !== 'layer') {
          assert.notEqual(n.placement, 'absolute');
          if (n.size?.h) {
            assert.equal(/^\d+(\.\d+)?px$/i.test(String(n.size.h)), false);
          }
        }
      });

      // Bilinen karmaşık paketler uyarı üretmeli
      if (['nav-ecommerce-search', 'footer-newsletter-cta'].includes(rawPack.presetKey)) {
        assert.ok(warnings.some((w) => w.toLowerCase().includes('input')));
      }
      if (rawPack.presetKey.startsWith('slider-')) {
        assert.ok(warnings.some((w) => w.toLowerCase().includes('slider')));
      }
      if (rawPack.presetKey === 'nav-floating-glass') {
        assert.ok(warnings.some((w) => w.includes('backdrop-filter')));
      }
    }

    // Sentetik test 1: Döndürülmüş / üst üste binen dekoratif eleman layer çıkarılmalı
    const syntheticBadgePack = {
      presetKey: 'synthetic-hero-badge',
      name: 'Sentetik Rozetli Hero',
      category: 'İçerik Blokları',
      element: {
        id: 'syn-sec',
        type: 'section',
        width: 1200,
        height: 400,
        style: { backgroundColor: '#18181b' },
        children: [
          {
            id: 'syn-h1',
            type: 'h1',
            x: 80,
            y: 120,
            width: 520,
            height: 60,
            textContent: 'El Yapımı Koleksiyon',
            style: { color: '#ffffff' },
          },
          {
            id: 'syn-blob',
            type: 'div',
            x: 560,
            y: 100,
            width: 140,
            height: 140,
            rotation: 24,
            style: { backgroundColor: '#c9a96e', borderRadius: '999px' },
            children: [],
          },
        ],
      },
    };
    const badgeOut = packToNodes(syntheticBadgePack, idGen);
    assert.equal(inspectTreeIssues(badgeOut.nodes[0]).length, 0);
    let foundLayer = null;
    walkNodes(badgeOut.nodes[0], (n) => {
      if (n.placement === 'layer') foundLayer = n;
    });
    assert.ok(foundLayer, 'Döndürülmüş üst üste binen eleman layer olarak çıkarılmalı');
    assert.equal(foundLayer.pos.rot, 24);
    assert.ok(foundLayer.pos.x >= 0 && foundLayer.pos.x <= 100);
    assert.ok(foundLayer.pos.y >= 0 && foundLayer.pos.y <= 100);

    // Sentetik test 2: >512 KB ve >2 MB data:image/png görselleri boyut uyarısı üretmeli
    const payload600K = 'A'.repeat(810_000);
    const payload2_2M = 'B'.repeat(3_000_000);
    const largeDataPack = {
      presetKey: 'synthetic-large-img',
      name: 'Büyük Görsel Paketi',
      category: 'İçerik Blokları',
      element: {
        id: 'lg-sec',
        type: 'section',
        width: 1200,
        height: 360,
        style: { backgroundColor: '#111116' },
        children: [
          {
            id: 'img-550',
            type: 'img',
            x: 40,
            y: 40,
            width: 400,
            height: 240,
            attrs: { src: `data:image/png;base64,${payload600K}`, alt: 'Orta büyük görsel' },
            style: {},
          },
          {
            id: 'img-2200',
            type: 'img',
            x: 500,
            y: 40,
            width: 400,
            height: 240,
            attrs: { src: `data:image/png;base64,${payload2_2M}`, alt: 'Çok büyük görsel' },
            style: {},
          },
        ],
      },
    };
    const largeOut = packToNodes(largeDataPack, idGen);
    assert.ok(largeOut.warnings.some((w) => w.includes('512 KB') || w.includes('KB')));
    assert.ok(largeOut.warnings.some((w) => w.includes('2 MB')));
  });

  await test('exportStatic & exportReact: çoklu sayfa ZIP/unzip, hash router, paylaşılan tema, kırık link & enjeksiyon direnci', () => {
    let project = fromLegacyTree(sampleTree);
    const about = addPage(project, { title: 'Hakkımızda' });
    project = about.project;
    const contact = addPage(project, { title: 'İletişim' });
    project = contact.project;

    // Ana sayfadaki butonu Hakkımızda'ya bağla
    project = executeTool(project, 'link_to_page', {
      buttonId: 'hero-cta-primary',
      pageId: about.page.id,
    }).project;

    // Ortak tema güncelle (proje geneli)
    project = executeTool(project, 'apply_theme', {
      tokens: { primary: '#1A3A2E', accent: '#D4A853', fontFamily: 'serif' },
    }).project;

    // 3 sayfayı da statik export et
    const stat = exportStatic(project, { inlineCss: false });
    assert.equal(stat.warnings.length, 0);
    assert.ok(stat.files['index.html']);
    assert.ok(stat.files['hakkimizda.html']);
    assert.ok(stat.files['iletisim.html']);
    assert.ok(stat.files['styles.css']);
    assert.equal(stat.files['styles.css'].includes('#1A3A2E'), true);
    assert.equal(stat.files['styles.css'].includes(':root'), true);

    // Sıfır script ve doğru sayfa linki
    for (const fileName of ['index.html', 'hakkimizda.html', 'iletisim.html']) {
      assert.equal(stat.files[fileName].toLowerCase().includes('<script'), false);
    }
    assert.ok(stat.files['index.html'].includes('href="hakkimizda.html"'));

    // ZIP + sistem unzip -t doğrulaması
    const zipBytes = zipStore(stat.files);
    const tmpZip = path.join(os.tmpdir(), `craftproto-multi-${Date.now()}.zip`);
    fs.writeFileSync(tmpZip, zipBytes);
    try {
      const unzipOut = execFileSync('unzip', ['-t', tmpZip], { encoding: 'utf8' });
      assert.ok(unzipOut.includes('No errors detected'));
    } finally {
      fs.unlinkSync(tmpZip);
    }

    // Kırık page: linki '#' olur ve uyarı üretir
    const brokenProj = structuredClone(project);
    findNode(brokenProj.pages[0].tree, 'hero-actions').children.push({
      id: 'btn-broken-page',
      type: 'button',
      placement: 'flow',
      size: { w: 'hug', h: 'hug' },
      props: { label: 'Kırık Link', href: 'page:silinmis-sayfa' },
    });
    const brokenStat = exportStatic(brokenProj);
    assert.ok(brokenStat.warnings.some((w) => w.includes('silinmis-sayfa')));
    assert.ok(brokenStat.files['index.html'].includes('href="#"'));

    // Kötü niyetli sayfa başlığı ve slug enjeksiyon testi
    const evilProj = structuredClone(project);
    evilProj.pages[1].title = '</title><script>alert(1)</script>"';
    evilProj.pages[1].slug = '../../evil<script>';
    const evilStat = exportStatic(evilProj);
    const exportedKeys = Object.keys(evilStat.files);
    assert.equal(exportedKeys.some((k) => k.includes('..') || k.includes('/')), false);
    for (const k of exportedKeys) {
      if (k.endsWith('.html')) {
        assert.equal(evilStat.files[k].toLowerCase().includes('<script'), false);
      }
    }

    // React/Vite çoklu sayfa export: hash router + ayrı bileşen dosyaları + parse edilebilir AST
    const react = exportReact(project);
    assert.equal(react.warnings.length, 0);
    assert.ok(react.files['src/styles.css']);
    assert.ok(react.files['src/App.jsx']);
    const pkgJson = JSON.parse(react.files['package.json']);
    assert.equal(Boolean(pkgJson.dependencies['react-router-dom']), false);
    const appAst = parse(react.files['src/App.jsx'], {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    assert.equal(appAst.type, 'File');
    assert.ok(react.files['src/App.jsx'].includes('hashchange'));
    assert.ok(react.files['src/App.jsx'].includes('#/hakkimizda'));

    const pageJsxFiles = Object.keys(react.files).filter((k) => k.startsWith('src/pages/page-'));
    assert.equal(pageJsxFiles.length, 3);
    for (const pFile of pageJsxFiles) {
      const pAst = parse(react.files[pFile], { sourceType: 'module', plugins: ['jsx'] });
      assert.equal(pAst.type, 'File');
    }
    const homeComponentFile = pageJsxFiles.find((f) => f.includes('-index.jsx'));
    assert.ok(react.files[homeComponentFile].includes('href="#/hakkimizda"'));
  });

  await test('aiTools: yeni çoklu sayfa araçları, içerik paketi ve çapraz sayfa düğüm reddi', () => {
    const project = fromLegacyTree(sampleTree);
    let seq = 1;
    const idGen = (h = 'ai') => `${h}-${seq++}`;

    const outlineRes = executeTool(project, 'get_project_outline', {}, idGen);
    assert.equal(outlineRes.result.ok, true);
    assert.equal(outlineRes.result.pages.length, 1);

    const added = executeTool(project, 'add_page', { title: 'İletişim' }, idGen);
    assert.equal(added.result.ok, true);
    const iletisimId = added.result.page.id;
    const iletisimSectionId = added.result.page.rootSectionId;

    // Henüz Ana Sayfa aktifken İletişim içindeki düğüme müdahale reddedilmeli
    const blockedCross = executeTool(added.project, 'set_layout', {
      id: iletisimSectionId,
      layout: { gap: 'lg' },
    }, idGen);
    assert.equal(blockedCross.result.ok, false);
    assert.ok(blockedCross.result.error.includes('önce switch_page çağır'));

    // switch_page sonrası aynı işlem başarılı olmalı
    const switched = executeTool(blockedCross.project, 'switch_page', { pageId: iletisimId }, idGen);
    assert.equal(switched.result.ok, true);
    const layoutOk = executeTool(switched.project, 'set_layout', {
      id: iletisimSectionId,
      layout: { gap: 'lg' },
    }, idGen);
    assert.equal(layoutOk.result.ok, true);

    // İletişim sayfasına hazır içerik paketi ekle
    const packsList = executeTool(layoutOk.project, 'list_content_packs', {}, idGen);
    assert.equal(packsList.result.ok, true);
    assert.equal(packsList.result.packs.length, 22);

    const packed = executeTool(
      layoutOk.project,
      'insert_content_pack',
      { packId: 'block-cta-banner', targetSectionId: iletisimSectionId },
      idGen
    );
    assert.equal(packed.result.ok, true);
    assert.equal(getActiveTree(packed.project).children.length, 2);

    // Ana sayfaya dönüp butonu İletişim'e bağla ve proje temasını uygula
    const backHome = executeTool(packed.project, 'switch_page', {
      pageId: packed.project.pages[0].id,
    }, idGen);
    const linked = executeTool(
      backHome.project,
      'link_to_page',
      { buttonId: 'hero-cta-primary', pageId: iletisimId },
      idGen
    );
    assert.equal(linked.result.ok, true);
    assert.equal(linked.result.href, `page:${iletisimId}`);

    const themed = executeTool(
      linked.project,
      'apply_theme',
      { tokens: { primary: '#203040', accent: '#E0B050', fontFamily: 'serif' } },
      idGen
    );
    assert.equal(themed.result.ok, true);
    assert.equal(themed.project.theme.primary, '#203040');

    const val = executeTool(themed.project, 'validate_project', {}, idGen);
    assert.equal(val.result.ok, true);
    assert.equal(val.result.errorCount, 0);
    assert.equal(val.result.issueCount, 0);
  });

  await test('geminiAgent: sahte çoklu turlu add_page -> switch_page -> add_section -> link_to_page + thoughtSignature', async () => {
    const baseProject = fromLegacyTree(sampleTree);
    const homeId = baseProject.pages[0].id;
    const reqs = [];
    let hakkimizdaPageId = null;

    const fakeFetch = async (url, init) => {
      const body = JSON.parse(init.body);
      reqs.push(body);

      if (reqs.length === 1) {
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
                    { thought: true, text: 'Çoklu sayfa planlanıyor' },
                    {
                      functionCall: { name: 'add_page', args: { title: 'Hakkımızda' } },
                      thoughtSignature: 'sig_multi_1',
                    },
                    {
                      functionCall: {
                        name: 'apply_theme',
                        args: { tokens: { accent: '#B8860B' } },
                      },
                      thoughtSignature: 'sig_multi_2',
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      if (reqs.length === 2) {
        const lastUserParts = body.contents[body.contents.length - 1].parts;
        hakkimizdaPageId = lastUserParts[0].functionResponse.response.page.id;
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
                      functionCall: { name: 'switch_page', args: { pageId: hakkimizdaPageId } },
                      thoughtSignature: 'sig_multi_3',
                    },
                    {
                      functionCall: {
                        name: 'add_section',
                        args: {
                          preset: 'feature-grid-3',
                          props: { title: 'Atölye Hikayemiz' },
                        },
                      },
                      thoughtSignature: 'sig_multi_4',
                    },
                    {
                      functionCall: { name: 'switch_page', args: { pageId: homeId } },
                      thoughtSignature: 'sig_multi_5',
                    },
                    {
                      functionCall: {
                        name: 'link_to_page',
                        args: { buttonId: 'hero-cta-primary', pageId: hakkimizdaPageId },
                      },
                      thoughtSignature: 'sig_multi_6',
                    },
                    {
                      functionCall: { name: 'validate_project', args: {} },
                      thoughtSignature: 'sig_multi_7',
                    },
                  ],
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
                  { thought: true, text: 'Gizli son düşünce' },
                  { text: 'Hakkımızda sayfası oluşturuldu ve ana sayfadan bağlandı.' },
                ],
              },
            },
          ],
        }),
      };
    };

    const res = await runAgent({
      prompt: 'Hakkımızda sayfası ekle, özellikler bölümü koy ve ana sayfadan bağla',
      baseProject,
      apiKey: 'AIzaTestFakeSecretMultiPageKey987',
      fetchImpl: fakeFetch,
      retryDelayMs: 0,
    });

    assert.equal(res.ok, true);
    assert.ok(res.draftProject);
    assert.equal(res.draftProject.pages.length, 2);
    assert.equal(res.draftProject.pages[1].tree.children.length, 2);
    assert.equal(
      findNode(res.draftProject.pages[0].tree, 'hero-cta-primary').props.href,
      `page:${hakkimizdaPageId}`
    );
    assert.equal(res.draftProject.theme.accent, '#B8860B');
    assert.equal(res.finalText, 'Hakkımızda sayfası oluşturuldu ve ana sayfadan bağlandı.');
    assert.equal(res.finalText.includes('Gizli'), false);

    // 2. ve 3. istekte thoughtSignature korunmuş olmalı
    const savedModelParts1 = reqs[1].contents[1].parts;
    assert.equal(savedModelParts1[1].thoughtSignature, 'sig_multi_1');
    assert.equal(savedModelParts1[2].thoughtSignature, 'sig_multi_2');
    const savedModelParts2 = reqs[2].contents[3].parts;
    assert.equal(savedModelParts2.length, 5);
    assert.equal(savedModelParts2[4].thoughtSignature, 'sig_multi_7');
  });

  console.log(`\nSonuç: ${passed}/${passed + failed} test geçti.\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
