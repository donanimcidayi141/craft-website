import assert from 'node:assert/strict';
import sampleTree from '../src/proto/sampleTree.js';
import { compileStyles } from '../src/proto/compileStyles.js';
import {
  findNode,
  findParent,
  isDescendant,
  canNodeAcceptChildren,
  canAcceptChild,
  getEffectiveLayoutMode,
  moveNode,
  updateNode,
  removeNode,
} from '../src/proto/treeOps.js';
import {
  createInitialStoreState,
  treeStoreReducer,
  MAX_HISTORY_STEPS,
} from '../src/proto/useTreeStore.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n🧪 CraftProto treeOps, Store & CSS Temizlik Testleri');

test('findNode, findParent ve isDescendant temel ağaç sorguları', () => {
  assert.equal(findNode(sampleTree, 'hero-title')?.type, 'text');
  assert.equal(findNode(sampleTree, 'olmayan-id'), null);
  assert.equal(findParent(sampleTree, 'page-home'), null);
  assert.equal(findParent(sampleTree, 'feature-card-2')?.id, 'features-grid');
  assert.equal(isDescendant(sampleTree, 'hero-section', 'hero-cta-primary'), true);
  assert.equal(isDescendant(sampleTree, 'hero-section', 'feature-card-1'), false);
  assert.equal(isDescendant(sampleTree, 'hero-copy', 'hero-copy'), false);
});

test('Kabul kuralları: yaprak düğümler çocuk alamaz, section kök dışında taşınamaz', () => {
  assert.equal(canNodeAcceptChildren('page'), true);
  assert.equal(canNodeAcceptChildren('section'), true);
  assert.equal(canNodeAcceptChildren('container'), true);
  for (const leaf of ['text', 'image', 'button', 'blob']) {
    assert.equal(canNodeAcceptChildren(leaf), false);
    assert.equal(canAcceptChild(leaf, 'text'), false);
    assert.equal(canAcceptChild(leaf, 'container'), false);
  }
  assert.equal(canAcceptChild('page', 'section'), true);
  assert.equal(canAcceptChild('page', 'container'), false);
  assert.equal(canAcceptChild('container', 'section'), false);
  assert.equal(canAcceptChild('section', 'section'), false);
  assert.equal(canAcceptChild('container', 'container'), true);
  assert.equal(canAcceptChild('container', 'text'), true);
});

test('moveNode: döngü engelleme (kendi alt soyuna ve kendisine taşıma reddi)', () => {
  const sameRef1 = moveNode(sampleTree, 'hero-container', 'hero-copy', 0);
  assert.equal(sameRef1, sampleTree);

  const sameRef2 = moveNode(sampleTree, 'hero-copy', 'hero-copy', 0);
  assert.equal(sameRef2, sampleTree);

  const sectionIntoContainer = moveNode(sampleTree, 'features-section', 'hero-container', 0);
  assert.equal(sectionIntoContainer, sampleTree);

  const intoLeaf = moveNode(sampleTree, 'feature-card-1', 'hero-title', 0);
  assert.equal(intoLeaf, sampleTree);
});

test('moveNode: aynı ebeveynde önce çıkar sonra ekle index kaydırması ve immutability', () => {
  const beforeCard1 = findNode(sampleTree, 'feature-card-1');
  // Grid çocukları başlangıçta: [feature-card-1, feature-card-2, feature-card-3]
  const movedForward = moveNode(sampleTree, 'feature-card-1', 'features-grid', 2);
  assert.notEqual(movedForward, sampleTree);
  const gridForward = findNode(movedForward, 'features-grid').children.map((c) => c.id);
  assert.deepEqual(gridForward, ['feature-card-2', 'feature-card-3', 'feature-card-1']);

  // Dokunulmayan kardeş section aynı referansı korumalı (structural sharing)
  assert.equal(findNode(movedForward, 'hero-section'), findNode(sampleTree, 'hero-section'));
  assert.equal(beforeCard1, findNode(sampleTree, 'feature-card-1'));

  // Geriye taşıma: card-1'i indeks 1'e al
  const movedMiddle = moveNode(movedForward, 'feature-card-1', 'features-grid', 1);
  const gridMiddle = findNode(movedMiddle, 'features-grid').children.map((c) => c.id);
  assert.deepEqual(gridMiddle, ['feature-card-2', 'feature-card-1', 'feature-card-3']);

  // Aynı indeks: no-op ve aynı referans
  const noop = moveNode(sampleTree, 'feature-card-1', 'features-grid', 0);
  assert.equal(noop, sampleTree);
});

test('moveNode: farklı container arası taşıma ve kök seviyede section sıralama', () => {
  const movedToCopy = moveNode(sampleTree, 'feature-card-1', 'hero-copy', 1);
  assert.equal(findNode(movedToCopy, 'features-grid').children.length, 2);
  assert.equal(findNode(movedToCopy, 'hero-copy').children[1].id, 'feature-card-1');

  const reorderedSections = moveNode(sampleTree, 'features-section', 'page-home', 0);
  assert.deepEqual(
    reorderedSections.children.map((s) => s.id),
    ['features-section', 'hero-section']
  );
});

test('updateNode: derin birleştirme (props, pos, layout) ve immutability', () => {
  const updated = updateNode(sampleTree, 'hero-blob', { pos: { x: 45, y: 60 } });
  assert.notEqual(updated, sampleTree);
  const updatedBlob = findNode(updated, 'hero-blob');
  assert.equal(updatedBlob.pos.x, 45);
  assert.equal(updatedBlob.pos.y, 60);
  assert.equal(updatedBlob.pos.rot, 15); // Mevcut açı korunmalı
  assert.equal(findNode(sampleTree, 'hero-blob').pos.x, 82); // Eski ağaç bozulmamalı
  assert.equal(findNode(updated, 'features-section'), findNode(sampleTree, 'features-section'));
});

test('removeNode: silme ve kök düğüm koruması', () => {
  const rootUnchanged = removeNode(sampleTree, 'page-home');
  assert.equal(rootUnchanged, sampleTree);

  const removed = removeNode(sampleTree, 'feature-card-2');
  assert.equal(findNode(removed, 'feature-card-2'), null);
  assert.equal(findNode(removed, 'features-grid').children.length, 2);
  assert.notEqual(findNode(sampleTree, 'feature-card-2'), null);
});

test('getEffectiveLayoutMode masaüstü-öncelikli kırılım çözümü', () => {
  const heroContainer = findNode(sampleTree, 'hero-container');
  assert.equal(getEffectiveLayoutMode(heroContainer, 'lg'), 'row');
  assert.equal(getEffectiveLayoutMode(heroContainer, 'md'), 'row');
  assert.equal(getEffectiveLayoutMode(heroContainer, 'sm'), 'stack');
});

test('treeStoreReducer: undo/redo tek adım, Delete silme ve max 100 geçmiş sınırı', () => {
  let state = createInitialStoreState(sampleTree, 'hero-title');

  // 1) Tek güncelleme = tek undo adımı
  state = treeStoreReducer(state, {
    type: 'UPDATE_NODE',
    id: 'hero-title',
    patch: { props: { text: 'Yeni Başlık' } },
  });
  assert.equal(state.history.past.length, 1);
  assert.equal(state.commitCount, 1);
  assert.equal(findNode(state.tree, 'hero-title').props.text, 'Yeni Başlık');

  // 2) Undo -> eski metne tek adımda dön
  state = treeStoreReducer(state, { type: 'UNDO' });
  assert.equal(findNode(state.tree, 'hero-title').props.text, findNode(sampleTree, 'hero-title').props.text);
  assert.equal(state.history.future.length, 1);

  // 3) Redo -> yeni metne geri dön
  state = treeStoreReducer(state, { type: 'REDO' });
  assert.equal(findNode(state.tree, 'hero-title').props.text, 'Yeni Başlık');

  // 4) Delete (REMOVE_NODE) ve Undo ile geri alma
  state = treeStoreReducer(state, { type: 'SELECT_NODE', nodeId: 'feature-card-3' });
  state = treeStoreReducer(state, { type: 'REMOVE_NODE' });
  assert.equal(findNode(state.tree, 'feature-card-3'), null);
  assert.equal(state.selectedId, null);

  state = treeStoreReducer(state, { type: 'UNDO' });
  assert.notEqual(findNode(state.tree, 'feature-card-3'), null);

  // 5) 105 art arda işlemde geçmiş en fazla 100 adım tutmalı
  for (let i = 0; i < 105; i += 1) {
    state = treeStoreReducer(state, {
      type: 'UPDATE_NODE',
      id: 'hero-title',
      patch: { props: { text: `Başlık ${i}` } },
    });
  }
  assert.equal(state.history.past.length, MAX_HISTORY_STEPS);
});

test('Adım 0 & Adım 5: masaüstü-öncelikli @media CSS ve sıfır editör sızıntısı', () => {
  const css = compileStyles(sampleTree);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*1024px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*repeat\(1,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.n-hero-section[\s\S]*overflow-x:\s*clip/);
  assert.match(css, /\.n-hero-blob[\s\S]*translate\(-50%,\s*-50%\)\s*rotate\(15deg\)/);

  // Editör-only ifadeler compileStyles çıktısında kesinlikle bulunmamalı
  for (const forbidden of ['proto-', 'drag', 'hover', 'selected']) {
    assert.equal(
      css.toLowerCase().includes(forbidden),
      false,
      `compileStyles çıktısı '${forbidden}' ifadesini içermemeli`
    );
  }
});

if (process.exitCode && process.exitCode !== 0) {
  console.error('\n❌ Bazı testler başarısız oldu.');
} else {
  console.log(`\n🎉 Toplam ${passed} test başarıyla geçti!\n`);
}
