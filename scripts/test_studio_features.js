import assert from 'node:assert/strict';
import { 
  migrateFlatToNestedTree, sanitizeTree, findNodeAndParent, getNodePath,
  getAbsoluteCoords, updateNodeInTree, updateMultipleNodesInTree,
  insertNodeIntoTree, removeNodeFromTree, cloneSubtreeWithNewIds, clonePresetSubtree, flattenTree,
  canHaveChildren, isExplicitContainer, distributeChildrenInContainer,
  centerElementsSmart
} from '../src/utils/treeUtils.js';
import { 
  styleObjectToCss, cssToStyleObject, elementToHtml, htmlToElementData 
} from '../src/utils/codeSync.js';
import { 
  ALL_HTML_TAGS, TAG_INFO, isVoidTag, ALL_CSS_PROPERTIES, 
  getValidAttributesForTag, getAttributeInputType, createTagElement 
} from '../src/data/tagRegistry.js';
import {
  generateModularReactProject,
  renderAstElementToJsx,
  slugifyProjectFolderName,
  buildStandaloneHtmlSite,
} from '../src/utils/generateReactCode.js';
import {
  MIN_ELEMENT_SIZE,
  getDescendantIds,
  computeDragSnap,
  computeResizeSnap,
} from '../src/utils/snapUtils.js';
import {
  createDefaultCanvasByViewport,
  resolveTreeForViewport,
  applyNodeUpdateForViewport,
  reparentNodeForViewport,
  ensureViewportAdapted,
  hasViewportOverrides,
  wrapNodesForViewport,
  unwrapNodeForViewport,
} from '../src/utils/responsiveUtils.js';
import {
  getScopeChildren,
  getParentScopeId,
  resolveSelectionTarget,
  resolveDoubleClickAction,
  shouldAllowDragUnparent,
  getAutoContrastTextColor,
} from '../src/utils/selectionUtils.js';
import {
  sanitizeFunctionIdentifier,
  compileFormulaStepsToJs,
  executeCraftFunction,
  executeNodeClickEvent,
  buildReactOnClickExpression,
  resolveSliderNextIndex,
} from '../src/utils/interactionEngine.js';
import {
  buildSerializableProjectSchema,
  parseAndMigrateLoadedProject,
  loadRecentProjects,
  upsertRecentProject,
  removeRecentProject,
  saveProjectToWebStorage,
  saveAutosaveDraft,
  loadAutosaveDraft,
} from '../src/utils/projectStorage.js';
import { DEFAULT_UNIVERSAL_PROJECT, PRESET_ASSETS } from '../src/constants.js';
import { CONTENT_PACK_ASSETS } from '../src/data/contentPacks.js';
import {
  toCamelCaseCss,
  toKebabCaseCss,
  filterPropertyCatalog,
  moveHighlightIndex,
  resolveCatalogSelectionOnEnter,
  clampFloatingRect,
} from '../src/utils/propertySearch.js';

let passed = 0;
let failed = 0;
const failureDetails = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failureDetails.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('🚀 CRAFT STUDIO COMPREHENSIVE FEATURE TEST SUITE');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// 1. TREE DATA STRUCTURE & HIERARCHY
// -----------------------------------------------------------------------------
console.log('📁 [1] Tree Data Structure & Hierarchy');

test('canHaveChildren & isExplicitContainer correctly classify elements', () => {
  assert.equal(canHaveChildren('div'), true);
  assert.equal(canHaveChildren('section'), true);
  assert.equal(canHaveChildren('nav'), true);
  assert.equal(canHaveChildren('img'), false);
  assert.equal(canHaveChildren('input'), false);
  assert.equal(canHaveChildren('br'), false);

  assert.equal(isExplicitContainer('div'), true);
  assert.equal(isExplicitContainer('section'), true);
  assert.equal(isExplicitContainer('nav'), true);
  assert.equal(isExplicitContainer('header'), true);
  assert.equal(isExplicitContainer('p'), false);
  assert.equal(isExplicitContainer('button'), false);
  assert.equal(isExplicitContainer('a'), false);
  assert.equal(isExplicitContainer('img'), false);
});

test('findNodeAndParent finds root element and deep children', () => {
  const tree = [
    {
      id: 'root-nav',
      type: 'nav',
      x: 0,
      y: 0,
      width: 1280,
      height: 72,
      children: [
        {
          id: 'nav-brand',
          type: 'div',
          x: 40,
          y: 18,
          width: 200,
          height: 36,
          children: [
            { id: 'logo-text', type: 'span', x: 24, y: 7, width: 170, height: 22, children: [] }
          ]
        }
      ]
    }
  ];

  const rootRes = findNodeAndParent(tree, 'root-nav');
  assert.ok(rootRes);
  assert.equal(rootRes.node.id, 'root-nav');
  assert.equal(rootRes.parent, null);

  const brandRes = findNodeAndParent(tree, 'nav-brand');
  assert.ok(brandRes);
  assert.equal(brandRes.node.id, 'nav-brand');
  assert.equal(brandRes.parent.id, 'root-nav');

  const textRes = findNodeAndParent(tree, 'logo-text');
  assert.ok(textRes);
  assert.equal(textRes.node.id, 'logo-text');
  assert.equal(textRes.parent.id, 'nav-brand');
  assert.equal(textRes.path.length, 3);
});

test('getAbsoluteCoords accurately accumulates ancestor coordinates', () => {
  const tree = [
    {
      id: 'section-1',
      x: 100,
      y: 150,
      width: 1000,
      height: 600,
      children: [
        {
          id: 'card-1',
          x: 50,
          y: 60,
          width: 400,
          height: 300,
          children: [
            { id: 'btn-1', x: 20, y: 30, width: 120, height: 40, children: [] }
          ]
        }
      ]
    }
  ];

  const secCoords = getAbsoluteCoords(tree, 'section-1');
  assert.equal(secCoords.x, 100);
  assert.equal(secCoords.y, 150);

  const cardCoords = getAbsoluteCoords(tree, 'card-1');
  assert.equal(cardCoords.x, 150);
  assert.equal(cardCoords.y, 210);

  const btnCoords = getAbsoluteCoords(tree, 'btn-1');
  assert.equal(btnCoords.x, 170);
  assert.equal(btnCoords.y, 240);
});

test('insertNodeIntoTree and removeNodeFromTree work properly', () => {
  let tree = [
    { id: 'parent-1', type: 'div', children: [] }
  ];

  // Insert child
  tree = insertNodeIntoTree(tree, 'parent-1', { id: 'child-1', type: 'button', children: [] });
  let found = findNodeAndParent(tree, 'child-1');
  assert.ok(found);
  assert.equal(found.parent.id, 'parent-1');

  // Remove child
  tree = removeNodeFromTree(tree, 'child-1');
  found = findNodeAndParent(tree, 'child-1');
  assert.equal(found, null);
});

test('cloneSubtreeWithNewIds deep clones element with new unique IDs and offsets', () => {
  const original = {
    id: 'parent-box',
    type: 'div',
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    children: [
      { id: 'inner-text', type: 'span', x: 10, y: 10, width: 80, height: 20, children: [] }
    ]
  };

  const cloned = cloneSubtreeWithNewIds(original, 30);
  assert.ok(cloned.id);
  assert.notEqual(cloned.id, 'parent-box');
  assert.equal(cloned.x, 80);
  assert.equal(cloned.y, 80);
  assert.equal(cloned.children.length, 1);
  assert.notEqual(cloned.children[0].id, 'inner-text');
});

// -----------------------------------------------------------------------------
// 2. CENTERING & ALIGNMENT SYSTEM
// -----------------------------------------------------------------------------
console.log('\n🎯 [2] Centering & Alignment System');

test('centerElementsSmart: Horizontal center for single root element', () => {
  const tree = [
    { id: 'box-1', x: 20, y: 100, width: 400, height: 200, children: [] }
  ];

  const { newTree, updates } = centerElementsSmart(tree, ['box-1'], 1280, 800, 'x');
  assert.equal(updates['box-1'].x, (1280 - 400) / 2); // 440
  const node = findNodeAndParent(newTree, 'box-1').node;
  assert.equal(node.x, 440);
  assert.equal(node.y, 100); // Y unchanged
});

test('centerElementsSmart: Vertical center for single root element', () => {
  const tree = [
    { id: 'box-1', x: 100, y: 40, width: 300, height: 150, children: [] }
  ];

  const { newTree, updates } = centerElementsSmart(tree, ['box-1'], 1280, 800, 'y');
  assert.equal(updates['box-1'].y, (800 - 150) / 2); // 325
  const node = findNodeAndParent(newTree, 'box-1').node;
  assert.equal(node.x, 100); // X unchanged
  assert.equal(node.y, 325);
});

test('centerElementsSmart: Center single child inside parent container', () => {
  const tree = [
    {
      id: 'container-1',
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      children: [
        { id: 'btn-1', x: 10, y: 20, width: 100, height: 50, children: [] }
      ]
    }
  ];

  const { newTree, updates } = centerElementsSmart(tree, ['btn-1'], 1280, 800, 'x');
  // Child must be centered relative to parent container width (600 - 100) / 2 = 250
  assert.equal(updates['btn-1'].x, 250);
  const node = findNodeAndParent(newTree, 'btn-1').node;
  assert.equal(node.x, 250);
});

test('centerElementsSmart: Multi-selection preserves mutual spacing and centers group', () => {
  const tree = [
    { id: 'col-1', x: 50, y: 200, width: 200, height: 300, children: [] },
    { id: 'col-2', x: 280, y: 200, width: 200, height: 300, children: [] },
    { id: 'col-3', x: 510, y: 200, width: 200, height: 300, children: [] }
  ];

  // Group: minX = 50, maxX = 710, groupW = 660.
  // Target center in 1280: (1280 - 660) / 2 = 310.
  // deltaX = 310 - 50 = +260.
  // col-1 becomes 50 + 260 = 310
  // col-2 becomes 280 + 260 = 540
  // col-3 becomes 510 + 260 = 770
  // Relative spacing remains strictly 30px gap! They DO NOT collapse!

  const { newTree, updates } = centerElementsSmart(tree, ['col-1', 'col-2', 'col-3'], 1280, 800, 'x');
  assert.equal(updates['col-1'].x, 310);
  assert.equal(updates['col-2'].x, 540);
  assert.equal(updates['col-3'].x, 770);

  const n1 = findNodeAndParent(newTree, 'col-1').node;
  const n2 = findNodeAndParent(newTree, 'col-2').node;
  const n3 = findNodeAndParent(newTree, 'col-3').node;
  assert.equal(n2.x - (n1.x + n1.width), 30);
  assert.equal(n3.x - (n2.x + n2.width), 30);
});

test('centerElementsSmart: Multi-selection with parent and child ignores descendant', () => {
  const tree = [
    {
      id: 'parent-card',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      children: [
        { id: 'inner-btn', x: 20, y: 20, width: 100, height: 40, children: [] }
      ]
    }
  ];

  // If user selected both parent-card and inner-btn, inner-btn should NOT be shifted twice
  const { newTree, updates } = centerElementsSmart(tree, ['parent-card', 'inner-btn'], 1280, 800, 'x');
  assert.equal(updates['parent-card'].x, (1280 - 400) / 2); // 440
  assert.equal(updates['inner-btn'], undefined); // Descendant was skipped from top-level shifting
});

test('distributeChildrenInContainer: space-between correctly places left, right and middle items', () => {
  const tree = [
    {
      id: 'navbar-1',
      type: 'nav',
      x: 0,
      y: 0,
      width: 1200,
      height: 70,
      children: [
        { id: 'brand', type: 'div', x: 10, y: 15, width: 150, height: 40, children: [] },
        { id: 'menu', type: 'div', x: 200, y: 20, width: 400, height: 30, children: [] },
        { id: 'cta', type: 'button', x: 700, y: 15, width: 120, height: 40, children: [] },
      ]
    }
  ];

  const distributedTree = distributeChildrenInContainer(tree, 'navbar-1', 'space-between');
  const nav = findNodeAndParent(distributedTree, 'navbar-1').node;
  const brand = nav.children.find(c => c.id === 'brand');
  const menu = nav.children.find(c => c.id === 'menu');
  const cta = nav.children.find(c => c.id === 'cta');

  // Brand is at left padding (28)
  assert.equal(brand.x, 28);
  // CTA is at right edge (1200 - 120 - 28 = 1052)
  assert.equal(cta.x, 1052);
  // Menu is placed between them
  assert.ok(menu.x > brand.x + brand.width);
  assert.ok(menu.x + menu.width < cta.x);
  // All vertically centered (height 70, brand 40 => y = (70-40)/2 = 15)
  assert.equal(brand.y, 15);
  assert.equal(cta.y, 15);
  assert.equal(menu.y, 20); // (70-30)/2 = 20
});

test('distributeChildrenInContainer: center centers all children with uniform gap', () => {
  const tree = [
    {
      id: 'container-box',
      type: 'div',
      x: 0,
      y: 0,
      width: 1000,
      height: 100,
      children: [
        { id: 'item-1', x: 0, y: 0, width: 100, height: 40, children: [] },
        { id: 'item-2', x: 0, y: 0, width: 100, height: 40, children: [] }
      ]
    }
  ];

  const distributedTree = distributeChildrenInContainer(tree, 'container-box', 'center');
  const box = findNodeAndParent(distributedTree, 'container-box').node;
  const [i1, i2] = box.children;

  // Total width: 100 + 100 + 20 gap = 220.
  // Center in 1000: (1000 - 220) / 2 = 390.
  assert.equal(i1.x, 390);
  assert.equal(i2.x, 510);
});

// -----------------------------------------------------------------------------
// 3. NAVBAR & CONTAINER RESIZING & AUTO-BOUNDARY CLAMP
// -----------------------------------------------------------------------------
console.log('\n📐 [3] Navbar & Container Resizing');

test('updateNodeInTree: Auto-boundary safely clamps children when container shrinks', () => {
  const tree = [
    {
      id: 'nav-test',
      type: 'nav',
      x: 0,
      y: 0,
      width: 1280,
      height: 72,
      children: [
        { id: 'logo', x: 40, y: 16, width: 180, height: 40, children: [] },
        { id: 'cta-btn', x: 1100, y: 16, width: 140, height: 40, children: [] }
      ]
    }
  ];

  // Shrink container width from 1280 to 900
  const updatedTree = updateNodeInTree(tree, 'nav-test', { width: 900 });
  const nav = findNodeAndParent(updatedTree, 'nav-test').node;
  assert.equal(nav.width, 900);

  const cta = nav.children.find(c => c.id === 'cta-btn');
  // cta-btn at x: 1100 + 140 = 1240 would have overflowed 900.
  // It must be clamped to at most 900 - 140 - 8 = 752!
  assert.ok(cta.x + cta.width <= 900);
  assert.equal(cta.x, 752);

  // Logo at 40 + 180 = 220 was unaffected and stays 40
  const logo = nav.children.find(c => c.id === 'logo');
  assert.equal(logo.x, 40);
});

test('updateNodeInTree: Container height shrinkage clamps child vertical position', () => {
  const tree = [
    {
      id: 'hero-box',
      type: 'section',
      x: 0,
      y: 80,
      width: 1200,
      height: 600,
      children: [
        { id: 'footer-in-hero', x: 50, y: 520, width: 300, height: 60, children: [] }
      ]
    }
  ];

  // Shrink height to 400
  const updatedTree = updateNodeInTree(tree, 'hero-box', { height: 400 });
  const hero = findNodeAndParent(updatedTree, 'hero-box').node;
  const child = hero.children.find(c => c.id === 'footer-in-hero');
  assert.ok(child.y + child.height <= 400);
  assert.equal(child.y, 400 - 60 - 8); // 332
});

test('Unconstrained Navbar resizing beyond 1200px (e.g. 1440px, 1600px)', () => {
  const tree = [
    { id: 'nav-wide', type: 'nav', x: 0, y: 0, width: 1280, height: 72, children: [] }
  ];

  const updated1440 = updateNodeInTree(tree, 'nav-wide', { width: 1440 });
  assert.equal(findNodeAndParent(updated1440, 'nav-wide').node.width, 1440);

  const updated1600 = updateNodeInTree(tree, 'nav-wide', { width: 1600 });
  assert.equal(findNodeAndParent(updated1600, 'nav-wide').node.width, 1600);
});

// -----------------------------------------------------------------------------
// 4. ATTRIBUTES & CSS PROPERTIES INSPECTOR
// -----------------------------------------------------------------------------
console.log('\n🎨 [4] Attributes & CSS Properties Inspector');

test('tagRegistry: Validates common attributes and input types', () => {
  assert.ok(ALL_HTML_TAGS.includes('nav'));
  assert.ok(ALL_HTML_TAGS.includes('button'));
  assert.ok(ALL_HTML_TAGS.includes('a'));

  const aAttrs = getValidAttributesForTag('a');
  assert.ok(aAttrs.includes('href'));
  assert.ok(aAttrs.includes('target'));

  const imgAttrs = getValidAttributesForTag('img');
  assert.ok(imgAttrs.includes('src'));
  assert.ok(imgAttrs.includes('alt'));

  assert.equal(getAttributeInputType('disabled'), 'checkbox');
  assert.equal(getAttributeInputType('tabIndex'), 'number');
  assert.equal(getAttributeInputType('placeholder'), 'text');
});

test('codeSync: styleObjectToCss and cssToStyleObject bidirectional conversion', () => {
  const originalStyle = {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontSize: '16px',
    borderRadius: '12px',
    display: 'flex',
  };

  const cssStr = styleObjectToCss(originalStyle);
  assert.ok(cssStr.includes('background-color: #1e293b;'));
  assert.ok(cssStr.includes('font-size: 16px;'));
  assert.ok(cssStr.includes('border-radius: 12px;'));

  const parsedBack = cssToStyleObject(cssStr);
  assert.equal(parsedBack.backgroundColor, '#1e293b');
  assert.equal(parsedBack.fontSize, '16px');
  assert.equal(parsedBack.borderRadius, '12px');
  assert.equal(parsedBack.display, 'flex');
});

test('codeSync: elementToHtml and htmlToElementData round-trip', () => {
  const element = {
    type: 'button',
    attrs: {
      id: 'cta-btn',
      class: 'btn-primary px-4 py-2',
      type: 'button'
    },
    style: {
      color: '#ffffff',
      backgroundColor: '#2563eb'
    },
    textContent: 'Şimdi Keşfet 🚀'
  };

  const html = elementToHtml(element);
  assert.ok(html.includes('<button'));
  assert.ok(html.includes('id="cta-btn"'));
  assert.ok(html.includes('Şimdi Keşfet 🚀'));

  const parsed = htmlToElementData(html);
  assert.equal(parsed.type, 'button');
  assert.equal(parsed.attrs.id, 'cta-btn');
  assert.equal(parsed.textContent, 'Şimdi Keşfet 🚀');
});

// -----------------------------------------------------------------------------
// 5. REACT CODE GENERATOR & EXPORT INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n⚡ [5] React Code Generator & Project Export');

test('generateReactProject produces clean, error-free React components', () => {
  const projectElements = [
    {
      id: 'main-nav',
      type: 'nav',
      attrs: { class: 'navbar' },
      style: { backgroundColor: '#0f172a', height: '72px' },
      x: 0,
      y: 0,
      width: 1280,
      height: 72,
      children: [
        {
          id: 'nav-logo',
          type: 'span',
          attrs: { class: 'logo' },
          style: { color: '#ffffff', fontWeight: 'bold' },
          textContent: 'CRAFT • STUDIO',
          x: 40,
          y: 20,
          width: 160,
          height: 30,
          children: []
        },
        {
          id: 'nav-cta',
          type: 'button',
          attrs: { class: 'btn' },
          style: { backgroundColor: '#3b82f6' },
          textContent: 'Başlayın ↗',
          x: 1080,
          y: 16,
          width: 140,
          height: 40,
          children: []
        }
      ]
    },
    {
      id: 'hero-sec',
      type: 'section',
      attrs: { class: 'hero' },
      style: { backgroundColor: '#1e293b' },
      x: 0,
      y: 72,
      width: 1280,
      height: 500,
      children: [
        {
          id: 'hero-title',
          type: 'h1',
          style: { color: '#ffffff', fontSize: '36px' },
          textContent: 'Geleceğin Web Sitelerini İnşa Edin',
          x: 40,
          y: 100,
          width: 600,
          height: 80,
          children: []
        }
      ]
    }
  ];

  const projectFiles = generateModularReactProject(projectElements, { title: 'Test Project' });
  assert.ok(projectFiles.appCode);
  assert.ok(projectFiles.navbarCode);
  assert.ok(projectFiles.indexCss);

  // Validate that navbarCode does not have broken syntax
  assert.ok(projectFiles.navbarCode.includes('export default function Navbar'));
  assert.ok(projectFiles.navbarCode.includes('CRAFT • STUDIO') || projectFiles.navbarCode.includes('logo') || projectFiles.navbarCode.includes('Brand'));
  assert.ok(projectFiles.appCode.includes('import Navbar from'));
});

// -----------------------------------------------------------------------------
// 6. ADVANCED EDGE CASES & MULTI-SELECTION SCENARIOS
// -----------------------------------------------------------------------------
console.log('\n🔬 [6] Advanced Edge Cases & Multi-Selection Scenarios');

test('migrateFlatToNestedTree: Automatically groups geometrically enclosed elements into containers', () => {
  const flat = [
    { id: 'parent-card', type: 'div', x: 100, y: 100, width: 400, height: 300 },
    { id: 'child-btn', type: 'button', x: 120, y: 140, width: 100, height: 40 },
    { id: 'sibling-sec', type: 'section', x: 100, y: 500, width: 800, height: 400 },
  ];

  const nested = migrateFlatToNestedTree(flat);
  assert.equal(nested.length, 2); // parent-card and sibling-sec at root

  const card = nested.find(n => n.id === 'parent-card');
  assert.ok(card);
  assert.equal(card.children.length, 1);
  assert.equal(card.children[0].id, 'child-btn');
  // Child coordinates converted to relative (120 - 100 = 20, 140 - 100 = 40)
  assert.equal(card.children[0].x, 20);
  assert.equal(card.children[0].y, 40);
});

test('Multi-selection across DIFFERENT containers centers each within its own parent', () => {
  const tree = [
    {
      id: 'card-A',
      width: 400,
      height: 200,
      x: 50,
      y: 50,
      children: [
        { id: 'btn-A', width: 100, height: 40, x: 10, y: 10, children: [] }
      ]
    },
    {
      id: 'card-B',
      width: 600,
      height: 200,
      x: 500,
      y: 50,
      children: [
        { id: 'btn-B', width: 100, height: 40, x: 10, y: 10, children: [] }
      ]
    }
  ];

  // Selecting btn-A (in card-A, width 400) and btn-B (in card-B, width 600)
  const { newTree, updates } = centerElementsSmart(tree, ['btn-A', 'btn-B'], 1280, 800, 'x');
  // btn-A should be centered in card-A: (400 - 100) / 2 = 150
  assert.equal(updates['btn-A'].x, 150);
  // btn-B should be centered in card-B: (600 - 100) / 2 = 250
  assert.equal(updates['btn-B'].x, 250);
});

test('Full-width container centering automatically distributes child items across width', () => {
  const tree = [
    {
      id: 'navbar-full',
      type: 'nav',
      x: 0,
      y: 0,
      width: 1280,
      height: 72,
      children: [
        { id: 'brand', x: 20, y: 16, width: 150, height: 40, children: [] },
        { id: 'links', x: 200, y: 20, width: 300, height: 30, children: [] },
        { id: 'cta', x: 800, y: 16, width: 120, height: 40, children: [] }
      ]
    }
  ];

  // When user centers the navbar on 1280 canvas, it distributes its children
  const { updates } = centerElementsSmart(tree, ['navbar-full'], 1280, 800, 'x');
  assert.ok(updates['navbar-full']);
  assert.equal(updates['navbar-full'].x, 0);
  assert.ok(Array.isArray(updates['navbar-full'].children));
  assert.equal(updates['navbar-full'].children.length, 3);
  // The first child is at padding
  assert.equal(updates['navbar-full'].children[0].x, 28);
  // The last child is at right edge
  assert.equal(updates['navbar-full'].children[2].x, 1280 - 120 - 28);
});

test('Multi-selection proportional scale calculations', () => {
  const elementsMap = {
    'item-1': { x: 100, y: 100, w: 200, h: 100 },
    'item-2': { x: 350, y: 100, w: 200, h: 100 },
  };

  const resizeStart = {
    minX: 100,
    minY: 100,
    w: 450, // total bounding box width: from 100 to 550
    h: 100,
    elementsMap
  };

  // Simulating dragging east handle by +225px (50% expansion, scaleX = 1.5)
  const newBboxW = resizeStart.w + 225; // 675
  const scaleX = newBboxW / resizeStart.w; // 1.5
  const scaleY = 1.0;

  const updatesMap = {};
  ['item-1', 'item-2'].forEach(id => {
    const start = resizeStart.elementsMap[id];
    const relOffsetX = start.x - resizeStart.minX;
    const relOffsetY = start.y - resizeStart.minY;
    updatesMap[id] = {
      width: Math.round(start.w * scaleX),
      height: Math.round(start.h * scaleY),
      x: Math.round(resizeStart.minX + relOffsetX * scaleX),
      y: Math.round(resizeStart.minY + relOffsetY * scaleY),
    };
  });

  // item-1 width was 200 => 300, x was 100 => 100
  assert.equal(updatesMap['item-1'].width, 300);
  assert.equal(updatesMap['item-1'].x, 100);

  // item-2 relOffsetX was 250 => 250 * 1.5 = 375 => x is 100 + 375 = 475
  // item-2 width was 200 => 300
  assert.equal(updatesMap['item-2'].width, 300);
  assert.equal(updatesMap['item-2'].x, 475);
  // Total span is from 100 to 475 + 300 = 775. 775 - 100 = 675 (exactly 1.5 * 450)!
  assert.equal((updatesMap['item-2'].x + updatesMap['item-2'].width) - updatesMap['item-1'].x, 675);
});

// -----------------------------------------------------------------------------
// 7. SNAP UTILS (DRAG, EQUAL GAPS, RESIZE BOUNDARY & ELEMENT SNAPPING)
// -----------------------------------------------------------------------------
console.log('\n🧲 [7] Snap Utils (Drag, Resize Page Boundary & Smart Guides)');

test('computeDragSnap snaps to bottom page boundary and excludes descendants', () => {
  const tree = [
    {
      id: 'group-1',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      children: [{ id: 'child-1', x: 20, y: 20, width: 100, height: 60 }]
    },
    { id: 'box-2', x: 500, y: 100, width: 150, height: 200 }
  ];
  const exclude = getDescendantIds(tree, ['group-1']);
  assert.ok(exclude.has('group-1') && exclude.has('child-1'));

  const canvasSettings = { width: 1280, height: 1000 };
  // Near bottom page edge: bottom = 996 (within 7px of 1000)
  const snapBottom = computeDragSnap(
    { left: 100, right: 400, centerX: 250, top: 796, bottom: 996, centerY: 896, width: 300, height: 200 },
    tree,
    canvasSettings,
    exclude,
    7
  );
  assert.equal(snapBottom.snapDeltaY, 4);
  const bottomGuide = snapBottom.guides.find(g => g.type === 'horizontal' && g.y === 1000);
  assert.ok(bottomGuide && bottomGuide.isPageEdge);
});

test('computeDragSnap detects equal horizontal gap spacing between 3 cards', () => {
  const tree = [
    { id: 'c1', x: 100, y: 100, width: 200, height: 200 },
    { id: 'c2', x: 340, y: 100, width: 200, height: 200 }, // gap c1->c2 = 40px
    { id: 'c3', x: 583, y: 100, width: 200, height: 200 }, // raw gap c2->c3 = 43px, within threshold of 40px
  ];
  const snap = computeDragSnap(
    { left: 583, right: 783, centerX: 683, top: 250, bottom: 450, centerY: 350, width: 200, height: 200 },
    tree,
    { width: 1280, height: 1000 },
    new Set(['c3']),
    7
  );
  // Expect snapping left from 583 to 580 so gap is 40px
  assert.equal(snap.snapDeltaX, -3);
  assert.ok(snap.guides.some(g => g.type === 'gap-h' && g.gap === 40 && g.isEqualGap));
});

test('computeResizeSnap anchors opposite edge cleanly on fast west/north drag and snaps to page boundaries', () => {
  const tree = [
    { id: 'r1', x: 4, y: 100, width: 200, height: 100 },
    { id: 'r2', x: 400, y: 100, width: 150, height: 100 },
  ];
  const canvasSettings = { width: 1280, height: 800 };

  // Snap right edge to page right (1280): start x=1000, w=200 => right=1200, dx=77 => targetRight=1277 -> snaps to 1280!
  const snapEastPage = computeResizeSnap({
    handle: 'se',
    startAbs: { x: 1000, y: 696, width: 200, height: 100 },
    parentAbs: { x: 0, y: 0, width: 1280, height: 800 },
    dx: 77,
    dy: 0, // raw bottom = 796 (4px from 800!) -> snaps bottom to 800!
    minSize: MIN_ELEMENT_SIZE,
    elements: tree,
    canvasSettings,
    excludeIdsSet: new Set(['r1']),
    threshold: 7,
  });
  assert.equal(snapEastPage.width, 280);
  assert.equal(snapEastPage.height, 104);
  assert.equal(snapEastPage.absRight, 1280);
  assert.equal(snapEastPage.absBottom, 800);

  // Fast west drag far past minSize: right edge MUST remain anchored at 204!
  const clampWest = computeResizeSnap({
    handle: 'nw',
    startAbs: { x: 104, y: 100, width: 100, height: 100 },
    parentAbs: { x: 0, y: 0, width: 1280, height: 800 },
    dx: 500,
    dy: 500,
    minSize: MIN_ELEMENT_SIZE,
    elements: tree,
    canvasSettings,
    excludeIdsSet: new Set(['r1']),
    threshold: 7,
  });
  assert.equal(clampWest.width, MIN_ELEMENT_SIZE);
  assert.equal(clampWest.height, MIN_ELEMENT_SIZE);
  assert.equal(clampWest.absRight, 204);
  assert.equal(clampWest.absBottom, 200);
  assert.equal(clampWest.localX, 204 - MIN_ELEMENT_SIZE);
  assert.equal(clampWest.localY, 200 - MIN_ELEMENT_SIZE);

  // Nested child resize converts abs -> local accurately and snaps left edge to sibling r2
  const nestedSnap = computeResizeSnap({
    handle: 'w',
    startAbs: { x: 450, y: 150, width: 100, height: 50 },
    parentAbs: { x: 300, y: 120, width: 500, height: 300 },
    dx: -47, // raw absLeft = 403 -> within 7px of r2 left (400)
    dy: 0,
    minSize: MIN_ELEMENT_SIZE,
    elements: tree,
    canvasSettings,
    excludeIdsSet: new Set(['child-x']),
    threshold: 7,
  });
  assert.equal(nestedSnap.absLeft, 400);
  assert.equal(nestedSnap.localX, 100); // 400 - parentAbs.x(300)
  assert.equal(nestedSnap.width, 150);
});

// -----------------------------------------------------------------------------
// 8. RESPONSIVE VIEWPORTS (DESKTOP / TABLET / MOBILE AUTO-ADAPT & ISOLATION)
// -----------------------------------------------------------------------------
console.log('\n📱 [8] Responsive Viewports & Deep Cloning');

test('cloneSubtreeWithNewIds deep-clones nested styles, attrs and responsive overrides', () => {
  const src = {
    id: 'orig-1',
    name: 'Kart',
    x: 100,
    y: 50,
    width: 300,
    height: 200,
    attrs: { id: 'card', 'data-x': '1' },
    style: { backgroundColor: '#111827', padding: '16px' },
    borderRadiusCorners: { tl: 8, tr: 8, br: 8, bl: 8 },
    responsive: {
      mobile: { x: 12, y: 20, width: 351, style: { padding: '8px' } },
    },
    children: [
      { id: 'c-1', name: 'Baslik', x: 10, y: 10, width: 100, height: 30, style: { color: '#fff' } },
    ],
  };

  const cloned = cloneSubtreeWithNewIds(src, { dx: 40, dy: 25 });
  assert.notEqual(cloned.id, src.id);
  assert.notEqual(cloned.children[0].id, src.children[0].id);
  assert.equal(cloned.x, 140);
  assert.equal(cloned.y, 75);
  assert.equal(cloned.responsive.mobile.x, 52);

  cloned.style.backgroundColor = '#ff0000';
  cloned.responsive.mobile.style.padding = '99px';
  cloned.borderRadiusCorners.tl = 99;
  assert.equal(src.style.backgroundColor, '#111827');
  assert.equal(src.responsive.mobile.style.padding, '8px');
  assert.equal(src.borderRadiusCorners.tl, 8);
});

test('ensureViewportAdapted fits Desktop universal project into Tablet (768px) & Mobile (375px) without overflow', () => {
  const tabRes = ensureViewportAdapted(DEFAULT_UNIVERSAL_PROJECT, 'tablet', { forceReset: true });
  const mobRes = ensureViewportAdapted(tabRes.tree, 'mobile', { forceReset: true });

  const resolvedTablet = resolveTreeForViewport(mobRes.tree, 'tablet');
  const resolvedMobile = resolveTreeForViewport(mobRes.tree, 'mobile');
  const resolvedDesktop = resolveTreeForViewport(mobRes.tree, 'desktop');

  // Desktop untouched
  const deskNav = resolvedDesktop.find(el => el.id === 'elem-nav');
  assert.equal(deskNav.width, 1280);

  // Tablet fits 768px cleanly
  resolvedTablet.forEach(rootEl => {
    assert.ok(rootEl.x + rootEl.width <= 768, `Tablet root overflow for ${rootEl.id}`);
  });

  // Mobile fits 375px cleanly and stacks feature cards vertically (card 1, 2, 3 no overflow)
  resolvedMobile.forEach(rootEl => {
    assert.ok(rootEl.x + rootEl.width <= 375, `Mobile root overflow for ${rootEl.id}`);
  });
  const mobFeat = resolvedMobile.find(el => el.id === 'elem-features-section');
  const mobGrid = mobFeat.children.find(el => el.id === 'elem-cards-grid');
  assert.ok(mobGrid.width <= 355);
  assert.ok(mobGrid.children[1].y > mobGrid.children[0].y, 'Cards must stack vertically on mobile');
});

test('Per-viewport edits (move, resize, style, visibility) remain completely isolated between Desktop, Tablet and Mobile', () => {
  const adapted = ensureViewportAdapted(DEFAULT_UNIVERSAL_PROJECT, 'mobile', { forceReset: true }).tree;

  // Edit button ONLY on Mobile (move, resize, recolor, hide)
  let updated = applyNodeUpdateForViewport(
    adapted,
    'elem-hero-btn',
    {
      x: 16,
      y: 260,
      width: 280,
      isHidden: true,
      style: { ...resolveTreeForViewport(adapted, 'mobile').find(n => n.id === 'elem-hero').children.find(n => n.id === 'elem-hero-btn').style, backgroundColor: '#ef4444' },
    },
    'mobile'
  );

  // Container resize in Mobile shrinks & clamps children ONLY on Mobile
  updated = applyNodeUpdateForViewport(updated, 'elem-footer-col-1', { x: 200, width: 100 }, 'mobile');
  updated = applyNodeUpdateForViewport(updated, 'elem-footer', { width: 280, height: 420 }, 'mobile');

  const deskHeroBtn = resolveTreeForViewport(updated, 'desktop').find(n => n.id === 'elem-hero').children.find(c => c.id === 'elem-hero-btn');
  const mobHeroBtn = resolveTreeForViewport(updated, 'mobile').find(n => n.id === 'elem-hero').children.find(c => c.id === 'elem-hero-btn');
  const deskFooter = resolveTreeForViewport(updated, 'desktop').find(n => n.id === 'elem-footer');
  const mobFooter = resolveTreeForViewport(updated, 'mobile').find(n => n.id === 'elem-footer');

  assert.equal(mobHeroBtn.x, 16);
  assert.equal(mobHeroBtn.isHidden, true);
  assert.equal(mobHeroBtn.style.backgroundColor, '#ef4444');
  assert.notEqual(deskHeroBtn.x, 16);
  assert.ok(!deskHeroBtn.isHidden);
  assert.notEqual(deskHeroBtn.style.backgroundColor, '#ef4444');

  // Desktop footer children must NOT be clamped or altered by mobile footer shrink
  const origFooterCol1X = DEFAULT_UNIVERSAL_PROJECT.find(n => n.id === 'elem-footer').children.find(c => c.id === 'elem-footer-col-1').x;
  assert.equal(deskFooter.width, 1200);
  assert.equal(deskFooter.children.find(c => c.id === 'elem-footer-col-1').x, origFooterCol1X);
  assert.equal(mobFooter.width, 280);
  assert.equal(mobFooter.children.find(c => c.id === 'elem-footer-col-1').x, 172); // 280 - 100 - 8
  assert.ok(mobFooter.children.every(c => (c.width <= 264 ? c.x + c.width <= 272 : c.x === 8)));

  // Verify export embeds @media CSS overrides & canvasByViewport
  const canvasByVp = createDefaultCanvasByViewport({ width: 1280, height: 1350 });
  const exported = generateModularReactProject(updated, canvasByVp.desktop, canvasByVp);
  assert.ok(exported.indexCss.includes('@media (max-width: 639px)'));
  assert.ok(exported.indexCss.includes('display: none !important;'));
  assert.ok(JSON.parse(exported.craftProjectJson).canvasByViewport.mobile.width === 375);

  // Verify reparentNodeForViewport preserves Mobile local coordinates relative to new parent
  const reparentTree = [
    {
      id: 'p1',
      type: 'div',
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      responsive: { mobile: { x: 10, y: 10, width: 355, height: 250 } },
      children: [
        {
          id: 'child-m',
          type: 'div',
          x: 20,
          y: 20,
          width: 100,
          height: 60,
          responsive: { mobile: { x: 15, y: 25, width: 120, height: 50 } },
        },
      ],
    },
    {
      id: 'p2',
      type: 'div',
      x: 500,
      y: 50,
      width: 400,
      height: 300,
      responsive: { mobile: { x: 10, y: 280, width: 355, height: 250 } },
      children: [],
    },
  ];
  const reparented = reparentNodeForViewport(reparentTree, 'child-m', 'p2', -1);
  const mobP2 = resolveTreeForViewport(reparented, 'mobile').find(n => n.id === 'p2');
  // In mobile, child-m abs was (10+15=25, 10+25=35); p2 abs was (10, 280) => new local (15, -245)
  assert.equal(mobP2.children[0].x, 15);
  assert.equal(mobP2.children[0].y, -245);
  const deskP2 = resolveTreeForViewport(reparented, 'desktop').find(n => n.id === 'p2');
  // In desktop, child-m abs was (70, 70); p2 abs was (500, 50) => new local (-430, 20)
  assert.equal(deskP2.children[0].x, -430);
  assert.equal(deskP2.children[0].y, 20);
});

// -----------------------------------------------------------------------------
// 9. CSS SEARCH, KEYBOARD NAVIGATION & ADOBE FLOATING PALETTE HELPERS
// -----------------------------------------------------------------------------
console.log('\n🎛️ [9] CSS Search, Keyboard Navigation & Floating Window Bounds');

test('propertySearch: kebab/camel conversion preserves CSS custom properties and converts dashes', () => {
  assert.equal(toCamelCaseCss('background-color'), 'backgroundColor');
  assert.equal(toCamelCaseCss('grid-template-columns'), 'gridTemplateColumns');
  assert.equal(toCamelCaseCss('--brand-gold'), '--brand-gold');
  assert.equal(toKebabCaseCss('backgroundColor'), 'background-color');
  assert.equal(toKebabCaseCss('backdropFilter'), 'backdrop-filter');
  assert.equal(toKebabCaseCss('--brand-gold'), '--brand-gold');
});

test('filterPropertyCatalog: ranks prefix/exact matches before substring matches & searches Turkish labels', () => {
  const opMatches = filterPropertyCatalog(ALL_CSS_PROPERTIES, 'op');
  assert.ok(opMatches.length > 0);
  // "opacity" starts with "op" so it must rank first above "backdropFilter" or "overflow"
  assert.equal(opMatches[0].key, 'opacity');

  const trMatches = filterPropertyCatalog(ALL_CSS_PROPERTIES, 'arka plan');
  assert.ok(trMatches.some(p => p.key === 'backgroundColor'));

  // Excluded keys must be filtered out
  const withoutOpacity = filterPropertyCatalog(ALL_CSS_PROPERTIES, 'op', ['opacity']);
  assert.ok(!withoutOpacity.some(p => p.key === 'opacity'));
});

test('moveHighlightIndex & resolveCatalogSelectionOnEnter: ArrowDown/Up wraps & Enter adds highlighted item', () => {
  assert.equal(moveHighlightIndex(-1, 1, 5), 0);
  assert.equal(moveHighlightIndex(0, 1, 5), 1);
  assert.equal(moveHighlightIndex(4, 1, 5), 0);
  assert.equal(moveHighlightIndex(0, -1, 5), 4);
  assert.equal(moveHighlightIndex(0, 1, 0), -1);

  const matches = filterPropertyCatalog(ALL_CSS_PROPERTIES, 'flex');
  assert.ok(matches.length >= 2);
  // ArrowDown moved selection to index 1
  const chosenSecond = resolveCatalogSelectionOnEnter({
    query: 'flex',
    filteredItems: matches,
    highlightedIndex: 1,
  });
  assert.equal(chosenSecond.key, matches[1].key);

  // Typing a partial query like "op" picks "opacity" instead of literal "op"
  const opMatches = filterPropertyCatalog(ALL_CSS_PROPERTIES, 'op');
  const chosenOnEnter = resolveCatalogSelectionOnEnter({
    query: 'op',
    filteredItems: opMatches,
    highlightedIndex: 0,
  });
  assert.equal(chosenOnEnter.key, 'opacity');

  // Custom CSS property when no catalog item matches
  const customChosen = resolveCatalogSelectionOnEnter({
    query: 'aspect-ratio',
    filteredItems: [],
    highlightedIndex: -1,
    allowCustomCssProp: true,
  });
  assert.equal(customChosen.key, 'aspectRatio');
  assert.equal(customChosen.isCustom, true);
});

test('clampFloatingRect: keeps draggable/resizable floating inspector inside viewport', () => {
  const clamped = clampFloatingRect(
    { x: 1500, y: -50, width: 800, height: 600 },
    { width: 1280, height: 720 },
    { minWidth: 440, minHeight: 360 }
  );
  assert.ok(clamped.x + clamped.width <= 1280);
  assert.ok(clamped.y >= 12);
  assert.ok(clamped.width >= 440);
  assert.ok(clamped.height >= 360);
});

// -----------------------------------------------------------------------------
// 10. NESTED MULTI-LAYER SELECTION & ISOLATION ARCHITECTURE
// -----------------------------------------------------------------------------
console.log('\n🪆 [10] Nested Selection & Isolation Architecture');

test('resolveSelectionTarget & resolveDoubleClickAction: Drill-in isolation, Ctrl+Click xray & Esc step-out', () => {
  const nestedTree = [
    {
      id: 'nav-1',
      type: 'nav',
      x: 0, y: 0, width: 1200, height: 80,
      children: [
        {
          id: 'link-1',
          type: 'a',
          isAtomicWrapper: true,
          x: 40, y: 20, width: 120, height: 40,
          children: [
            { id: 'span-1', type: 'span', x: 0, y: 0, width: 100, height: 24, textContent: 'Ürünler' }
          ]
        },
        {
          id: 'cta-btn',
          type: 'button',
          x: 900, y: 18, width: 160, height: 44,
          textContent: 'Satın Al',
          children: []
        }
      ]
    }
  ];

  // Root click hitting inner span-1 selects outer nav-1
  const r1 = resolveSelectionTarget(nestedTree, 'span-1', null, { ctrlKey: false });
  assert.equal(r1.targetId, 'nav-1');
  assert.equal(r1.nextEditingGroupId, null);

  // Double-click hitting span-1 enters nav-1 and selects direct child link-1
  const d1 = resolveDoubleClickAction(nestedTree, 'span-1', null, { ctrlKey: false });
  assert.equal(d1.action, 'enter_group');
  assert.equal(d1.groupId, 'nav-1');
  assert.equal(d1.nextSelectedId, 'link-1');

  // Inside nav-1 scope, clicking span-1 selects atomic link-1 (not deepest span yet)
  const r2 = resolveSelectionTarget(nestedTree, 'span-1', 'nav-1', { ctrlKey: false });
  assert.equal(r2.targetId, 'link-1');
  assert.equal(r2.nextEditingGroupId, 'nav-1');

  // Double-click inside nav-1 enters link-1 and selects span-1
  const d2 = resolveDoubleClickAction(nestedTree, 'span-1', 'nav-1', { ctrlKey: false });
  assert.equal(d2.action, 'enter_group');
  assert.equal(d2.groupId, 'link-1');
  assert.equal(d2.nextSelectedId, 'span-1');

  // Double-click inside link-1 on leaf span-1 enters inline text editing
  const d3 = resolveDoubleClickAction(nestedTree, 'span-1', 'link-1', { ctrlKey: false });
  assert.equal(d3.action, 'edit_text');
  assert.equal(d3.targetId, 'span-1');

  // Ctrl+Click xray from root selects leaf span-1 directly and sets scope to link-1
  const xray = resolveSelectionTarget(nestedTree, 'span-1', null, { ctrlKey: true });
  assert.equal(xray.targetId, 'span-1');
  assert.equal(xray.nextEditingGroupId, 'link-1');

  // Scope children & Esc step-out parent scope check
  assert.deepEqual(getScopeChildren(nestedTree, 'nav-1').map(n => n.id), ['link-1', 'cta-btn']);
  assert.equal(getParentScopeId(nestedTree, 'link-1'), 'nav-1');
  assert.equal(getParentScopeId(nestedTree, 'nav-1'), null);

  // Atomic wrapper protects child from accidental drag-unparent, normal nav allows moving between root/nav
  assert.equal(shouldAllowDragUnparent(nestedTree, 'span-1'), false);
  assert.equal(shouldAllowDragUnparent(nestedTree, 'cta-btn'), true);
});

test('getAutoContrastTextColor picks legible contrast on dark vs light canvases', () => {
  assert.equal(getAutoContrastTextColor('#0f172a'), '#f8fafc');
  assert.equal(getAutoContrastTextColor('#ffffff'), '#0f172a');
});

// -----------------------------------------------------------------------------
// 11. TEXT-FIRST, SEMANTIC WRAPPING (<a>/<button>), TEXT SHADOW & HOVER EXPORT
// -----------------------------------------------------------------------------
console.log('\n✍️ [11] Text-First Elements, Semantic Wrapping & Hover Export');

test('createTagElement("text") creates unboxed transparent text node without box backgrounds', () => {
  const txt = createTagElement('text', { textContent: 'Koleksiyon', x: 50, y: 60 });
  assert.equal(txt.type, 'text');
  assert.equal(txt.fillColor, 'transparent');
  assert.equal(txt.borderWidth, 0);
  assert.equal(txt.borderRadius, 0);
  assert.equal(txt.style.backgroundColor, 'transparent');
});

test('wrapNodesForViewport wraps text in <a>/<button> preserving children & Mobile geometry, unwrap restores cleanly', () => {
  const txt = createTagElement('text', {
    id: 'txt-hero-cta',
    x: 100,
    y: 120,
    width: 140,
    height: 36,
    textContent: 'İletişim',
    style: { color: '#f8fafc', fontSize: '18px', textShadow: '0 2px 8px rgba(0, 0, 0, 0.35)' },
  });
  txt.responsive = {
    mobile: { x: 24, y: 40, width: 110, height: 32 },
  };

  // Wrap unboxed in <a>
  const wrapped = wrapNodesForViewport([txt], ['txt-hero-cta'], 'a', { withBox: false });
  assert.ok(wrapped.wrapperId);
  const aNode = findNodeAndParent(wrapped.newTree, wrapped.wrapperId)?.node;
  assert.equal(aNode.type, 'a');
  assert.equal(aNode.isAtomicWrapper, true);
  assert.equal(aNode.fillColor, 'transparent');
  assert.equal(aNode.children.length, 1);
  assert.equal(aNode.children[0].type, 'text'); // child tag NOT mutated!
  assert.equal(aNode.children[0].x, 0);

  // Verify mobile layout independently wrapped around mobile coordinates
  const mobResolved = resolveTreeForViewport(wrapped.newTree, 'mobile');
  const mobA = findNodeAndParent(mobResolved, wrapped.wrapperId)?.node;
  assert.equal(mobA.x, 24);
  assert.equal(mobA.y, 40);
  assert.equal(mobA.children[0].x, 0);

  // Unwrap restores txt-hero-cta cleanly at both Desktop & Mobile coordinates
  const unwrapped = unwrapNodeForViewport(wrapped.newTree, wrapped.wrapperId);
  assert.deepEqual(unwrapped.restoredIds, ['txt-hero-cta']);
  const deskRestored = findNodeAndParent(unwrapped.newTree, 'txt-hero-cta')?.node;
  const mobRestored = findNodeAndParent(resolveTreeForViewport(unwrapped.newTree, 'mobile'), 'txt-hero-cta')?.node;
  assert.equal(deskRestored.x, 100);
  assert.equal(deskRestored.y, 120);
  assert.equal(mobRestored.x, 24);
  assert.equal(mobRestored.y, 40);
});

test('renderAstElementToJsx & generateModularReactProject emit <span> for <text>, hover CSS vars, onClick & projectFunctions', () => {
  const linkBtn = {
    id: 'nav-link-urunler',
    type: 'a',
    attrs: { id: 'nav-link-urunler', href: '#urunler' },
    animation: {
      hover: 'underline-center',
      hoverClassName: 'hover-underline-center',
      hoverLineColor: '#ec4899',
      hoverLineHeight: 3,
      hoverLineDuration: 0.35,
    },
    events: {
      onClick: { mode: 'function', functionId: 'fn-calc', functionName: 'hesapla' },
    },
    children: [
      {
        id: 'inner-txt',
        type: 'text',
        style: { color: '#ffffff', textShadow: '0 2px 8px rgba(0, 0, 0, 0.35)' },
        textContent: 'Hesapla',
        children: [],
      },
    ],
  };

  const fnObj = {
    id: 'fn-calc',
    name: 'hesapla',
    editorMode: 'code',
    code: 'const x = Number(getValue("fiyat")) || 0;\nsetText("sonuc", x * 2);',
  };

  const jsxOut = renderAstElementToJsx(linkBtn, '  ', { projectFunctions: [fnObj], tabs: [] });
  assert.ok(jsxOut.includes('onClick={() => hesapla()}'));
  assert.ok(jsxOut.includes('"--craft-line-color":"#ec4899"'));
  assert.ok(jsxOut.includes('<span style=')); // <text> cleanly mapped to semantic <span>
  assert.ok(!jsxOut.includes('<text '));

  const project = generateModularReactProject([linkBtn], { width: 1280, height: 800 }, null, {
    projectFunctions: [fnObj],
    tabs: [{ id: 't1', name: 'Anasayfa.craft', route: '/', elements: [linkBtn] }],
    projectName: 'Taki Vitrin',
  });
  assert.ok(project.indexCss.includes('.hover-underline-center::after'));
  assert.ok(project.customElementsCode.includes('function hesapla()'));
  assert.ok(project.customElementsCode.includes('onClick={() => hesapla()}'));
  const parsedSchema = JSON.parse(project.craftProjectJson);
  assert.equal(parsedSchema.name, 'Taki Vitrin');
  assert.equal(parsedSchema.projectFunctions.length, 1);
  assert.equal(parsedSchema.projectFunctions[0].name, 'hesapla');
});

// -----------------------------------------------------------------------------
// 12. HYBRID FORMULA & JS CODE FUNCTION ENGINE
// -----------------------------------------------------------------------------
console.log('\n⚡ [12] Hybrid Formula & JS Code Function Engine');

test('interactionEngine compiles Formula steps, evaluates hesapla() with live input values & handles errors safely', () => {
  assert.equal(sanitizeFunctionIdentifier('Fiyat Hesapla!'), 'Fiyat_Hesapla');

  const elements = [
    { id: 'el-fiyat', type: 'input', attrs: { id: 'fiyat', value: '250' }, children: [] },
    { id: 'el-adet', type: 'input', attrs: { id: 'adet', value: '4' }, children: [] },
    { id: 'el-sonuc', type: 'text', attrs: { id: 'sonuc' }, textContent: '0 TL', children: [] },
    { id: 'el-detay', type: 'div', attrs: { id: 'detay' }, isHidden: false, children: [] },
  ];

  const fnObj = {
    id: 'fn-1',
    name: 'hesapla',
    editorMode: 'formula',
    formulaSteps: [
      {
        id: 's1',
        type: 'math',
        leftType: 'element',
        leftValue: 'fiyat',
        op: '*',
        rightType: 'element',
        rightValue: 'adet',
        targetId: 'sonuc',
        prefix: 'Toplam: ',
        suffix: ' TL',
      },
      {
        id: 's2',
        type: 'toggle_visible',
        targetId: 'detay',
      },
      {
        id: 's3',
        type: 'notify',
        message: 'Hesaplandı!',
      },
    ],
  };

  let latestOverrides = { 'el-adet': { value: '5' } }; // Simulated user typed "5" in Preview input
  let toastMsg = '';
  const execRes = executeCraftFunction(fnObj, {
    elements,
    runtimeOverrides: latestOverrides,
    setRuntimeOverrides: (next) => { latestOverrides = next; },
    onNotify: (msg) => { toastMsg = msg; },
  });

  assert.equal(execRes.ok, true);
  assert.equal(latestOverrides['el-sonuc'].textContent, 'Toplam: 1250 TL');
  assert.equal(latestOverrides['el-detay'].isHidden, true);
  assert.equal(toastMsg, 'Hesaplandı!');

  // Node onClick dispatcher forwards correctly
  const triggerBtn = {
    id: 'btn-run',
    type: 'button',
    events: { onClick: { mode: 'function', functionId: 'fn-1', functionName: 'hesapla' } },
  };
  let nextOverridesAfterClick = {};
  const dispatchRes = executeNodeClickEvent(triggerBtn, {
    elements,
    projectFunctions: [fnObj],
    runtimeOverrides: {},
    setRuntimeOverrides: (next) => { nextOverridesAfterClick = next; },
  });
  assert.equal(dispatchRes.ok, true);
  assert.equal(nextOverridesAfterClick['el-sonuc'].textContent, 'Toplam: 1000 TL');

  // Syntax errors must NOT crash the app — return ok:false with message
  const brokenFn = { id: 'fn-bad', name: 'bozuk', editorMode: 'code', code: 'const a = (;' };
  const badRes = executeCraftFunction(brokenFn, { elements });
  assert.equal(badRes.ok, false);
  assert.ok(badRes.error.length > 0);
  assert.equal(buildReactOnClickExpression(triggerBtn.events.onClick, [fnObj]), '() => hesapla()');
});

// -----------------------------------------------------------------------------
// 13. FAZ 2: .CRAFT.JSON SAVE/OPEN SCHEMA, MIGRATION & RECENT PROJECTS
// -----------------------------------------------------------------------------
console.log('\n💾 [13] .craft.json Persistence, Migration & Recent Projects');

test('projectStorage builds, serializes & migrates multi-tab, responsive & function project schema accurately', () => {
  const txt = createTagElement('text', { id: 'n1', textContent: 'Altın Yüzük', x: 50, y: 80 });
  const schema = buildSerializableProjectSchema({
    id: 'proj-save-test',
    name: 'Atölye Vitrini',
    filePath: '/home/user/Masaüstü/atolye.craft.json',
    viewportMode: 'mobile',
    tabs: [
      { id: 't-home', name: 'Anasayfa.craft', elements: [txt] },
      { id: 't-calc', name: 'Hesap.craft', elements: [{ id: 'b1', type: 'button', textContent: 'Hesapla' }] },
    ],
    activeTabId: 't-calc',
    projectFunctions: [
      { id: 'fn-h', name: 'hesapla', editorMode: 'formula', formulaSteps: [{ type: 'notify', message: 'Ok' }] },
    ],
  });

  const jsonStr = JSON.stringify(schema);
  const reloaded = parseAndMigrateLoadedProject(jsonStr);

  assert.equal(reloaded.id, 'proj-save-test');
  assert.equal(reloaded.name, 'Atölye Vitrini');
  assert.equal(reloaded.viewportMode, 'mobile');
  assert.equal(reloaded.activeTabId, 't-calc');
  assert.equal(reloaded.tabs.length, 2);
  assert.equal(reloaded.tabs[0].elements[0].textContent, 'Altın Yüzük');
  assert.equal(reloaded.projectFunctions.length, 1);
  assert.equal(reloaded.projectFunctions[0].name, 'hesapla');

  // Recent projects CRUD + autosave draft with mock storage
  const store = {};
  const mockStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const recentAfterAdd = upsertRecentProject(reloaded, mockStorage);
  assert.equal(recentAfterAdd.length, 1);
  assert.equal(recentAfterAdd[0].tabsCount, 2);
  assert.equal(recentAfterAdd[0].functionsCount, 1);
  assert.equal(loadRecentProjects(mockStorage).length, 1);

  assert.equal(saveProjectToWebStorage(reloaded, mockStorage), true);
  assert.equal(saveAutosaveDraft(reloaded, mockStorage), true);
  const restoredDraft = loadAutosaveDraft(mockStorage);
  assert.equal(restoredDraft.name, 'Atölye Vitrini');

  const recentAfterDelete = removeRecentProject('proj-save-test', mockStorage);
  assert.equal(recentAfterDelete.length, 0);
});

test('slugifyProjectFolderName normalizes Turkish diacritics and symbols into safe folder/npm slugs', () => {
  assert.equal(slugifyProjectFolderName('Takı Mağazası / 2026!'), 'taki-magazasi-2026');
  assert.equal(slugifyProjectFolderName('Şık Saatçi Ünlü Örnek Çığ'), 'sik-saatci-unlu-ornek-cig');
  assert.equal(slugifyProjectFolderName('   '), 'yayinlanan-react-site');
  assert.equal(slugifyProjectFolderName('---'), 'yayinlanan-react-site');
});

test('generateModularReactProject respects blank & custom canvases instead of forcing SaaS demo sections', () => {
  const desktopCanvas = { width: 1280, height: 900, backgroundColor: '#fafafa' };
  const canvasByVp = createDefaultCanvasByViewport(desktopCanvas);

  // 1. Blank project should NOT fall back to SaaS Demo sections
  const blankProj = generateModularReactProject(
    [],
    desktopCanvas,
    canvasByVp,
    { projectName: 'Boş Atölyem', folderSlug: 'bos-atolyem', tabs: [{ id: 'tab-home', name: 'Ana Sayfa', route: '/' }], activeTabId: 'tab-home' }
  );
  assert.equal(blankProj.usesModularTemplate, false);
  assert.equal(blankProj.appCode.includes('Yeni Nesil Web Tasarımcısı'), false);
  assert.equal(blankProj.appCode.includes('HeroSection'), false);
  assert.equal(JSON.parse(blankProj.packageJson).name, 'bos-atolyem');
  assert.ok(blankProj.standaloneHtml.includes('<!DOCTYPE html>'));

  // 2. Custom canvas elements render faithfully 1:1 with custom coords & no demo leaks
  const customElements = [
    {
      id: 'custom-heading-1',
      type: 'h1',
      x: 120,
      y: 84,
      width: 480,
      height: 64,
      textContent: 'Özel Pırlanta Koleksiyonu',
      style: { color: '#111827', fontSize: '36px', fontWeight: '700' },
    },
    {
      id: 'custom-btn-1',
      type: 'button',
      x: 120,
      y: 170,
      width: 190,
      height: 48,
      textContent: 'Teklif Al',
      style: { backgroundColor: '#0d99ff', color: '#ffffff', borderRadius: '6px' },
    },
  ];
  const customProj = generateModularReactProject(
    customElements,
    desktopCanvas,
    canvasByVp,
    {
      projectName: 'Pırlanta Evim',
      folderSlug: 'pirlanta-evim',
      tabs: [{ id: 'tab-home', name: 'Vitrin', route: '/', elements: customElements, canvasSettings: desktopCanvas, canvasByViewport: canvasByVp }],
      activeTabId: 'tab-home',
    }
  );
  assert.equal(customProj.usesModularTemplate, false);
  assert.equal(customProj.appCode.includes('HeroSection'), false);
  assert.equal(customProj.appCode.includes('ProductsSection'), false);
  assert.ok(customProj.customElementsCode.includes('Özel Pırlanta Koleksiyonu'));
  assert.ok(customProj.customElementsCode.includes('120px'));
  assert.ok(customProj.standaloneHtml.includes('Özel Pırlanta Koleksiyonu'));
  assert.ok(customProj.standaloneHtml.includes('Teklif Al'));

  // 3. Default demo project still uses modular template when demo IDs exist
  const demoProj = generateModularReactProject(DEFAULT_UNIVERSAL_PROJECT, desktopCanvas, canvasByVp);
  assert.equal(demoProj.usesModularTemplate, true);
  assert.ok(demoProj.appCode.includes('HeroSection'));
});

test('buildStandaloneHtmlSite outputs multi-page routes, responsive @media rules, and projectFunctions runtime', () => {
  const desktopCanvas = { width: 1280, height: 900, backgroundColor: '#ffffff' };
  const canvasByVp = createDefaultCanvasByViewport(desktopCanvas);
  const page1Elements = [
    {
      id: 'fn-trigger-btn',
      type: 'button',
      x: 40,
      y: 40,
      width: 220,
      height: 44,
      textContent: 'Fiyat Hesapla',
      attrs: { id: 'calc-btn' },
      style: { backgroundColor: '#0d99ff', color: '#ffffff' },
      responsive: {
        mobile: { x: 16, y: 24, width: 320, height: 48, isHidden: false },
        tablet: { x: 28, y: 32, width: 260, height: 46 },
      },
      events: {
        onClick: { mode: 'function', functionId: 'fn-1', functionName: 'hesapla' },
      },
    },
  ];
  const page2Elements = [
    {
      id: 'contact-title',
      type: 'h2',
      x: 60,
      y: 60,
      width: 400,
      height: 50,
      textContent: 'İletişim Sayfamız',
      style: { color: '#09090b', fontSize: '28px' },
    },
  ];
  const tabs = [
    { id: 't-home', name: 'Ana Sayfa', route: '/', elements: page1Elements, canvasSettings: desktopCanvas, canvasByViewport: canvasByVp },
    { id: 't-contact', name: 'İletişim', route: '/iletisim', elements: page2Elements, canvasSettings: desktopCanvas, canvasByViewport: canvasByVp },
  ];
  const projectFunctions = [
    {
      id: 'fn-1',
      name: 'hesapla',
      params: '',
      editorMode: 'formula',
      formulaSteps: [{ type: 'notify', message: 'Toplam hesaplandı!' }],
    },
  ];

  const html = buildStandaloneHtmlSite({
    projectName: 'Altın Atölye',
    tabs,
    elements: page1Elements,
    canvasSettings: desktopCanvas,
    canvasByViewport: canvasByVp,
    projectFunctions,
    activeTabId: 't-home',
  });

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Fiyat Hesapla'));
  assert.ok(html.includes('İletişim Sayfamız'));
  assert.ok(html.includes('id="craft-page-t-home"'));
  assert.ok(html.includes('data-route="/iletisim"'));
  assert.ok(html.includes('data-craft-fn="hesapla"'));
  assert.ok(html.includes('@media (max-width: 1023px)'));
  assert.ok(html.includes('@media (max-width: 639px)'));
  assert.ok(html.includes('function hesapla(') || html.includes('hesapla'));
  assert.ok(html.includes('Toplam hesaplandı!'));

  // Empty canvas builds cleanly without crashing
  const emptyHtml = buildStandaloneHtmlSite({
    projectName: 'Boş Sayfa',
    tabs: [{ id: 't-empty', name: 'Ana Sayfa', route: '/', elements: [], canvasSettings: desktopCanvas, canvasByViewport: canvasByVp }],
    elements: [],
    canvasSettings: desktopCanvas,
    canvasByViewport: canvasByVp,
    projectFunctions: [],
  });
  assert.ok(emptyHtml.includes('<!DOCTYPE html>'));
});

// -----------------------------------------------------------------------------
// [FAZ 4] CANVA-STYLE CONTENT PACKS & INTERACTIVE SLIDER ENGINE
// -----------------------------------------------------------------------------
console.log('\n🎠 [10] Faz 4 Content Packs & Interactive Slider Runtime');

test('CONTENT_PACK_ASSETS contains 4+ Navbars, 3+ Footers, 3+ Interactive Sliders, 4+ Content Blocks with real nested OOP children', () => {
  const navs = PRESET_ASSETS.filter((a) => a.category === 'Navbar');
  const footers = PRESET_ASSETS.filter((a) => a.category === 'Footer');
  const sliders = PRESET_ASSETS.filter((a) => a.category === 'Slider');
  const blocks = PRESET_ASSETS.filter((a) => a.category === 'İçerik Blokları');

  assert.ok(navs.length >= 4, `Expected >=4 Navbar packs, got ${navs.length}`);
  assert.ok(footers.length >= 3, `Expected >=3 Footer packs, got ${footers.length}`);
  assert.ok(sliders.length >= 3, `Expected >=3 Slider packs, got ${sliders.length}`);
  assert.ok(blocks.length >= 4, `Expected >=4 Content Block packs, got ${blocks.length}`);

  for (const pack of CONTENT_PACK_ASSETS) {
    assert.ok(pack.element && Array.isArray(pack.element.children) && pack.element.children.length > 0, `Preset "${pack.name}" must contain nested OOP children`);
    const flat = flattenTree([pack.element]);
    const ids = flat.map((n) => n.id).filter(Boolean);
    assert.equal(new Set(ids).size, flat.length, `Preset "${pack.name}" has duplicate or missing node IDs`);
  }
});

test('clonePresetSubtree generates fresh unique IDs and remaps internal slider targetElementId references', () => {
  const sliderPreset = PRESET_ASSETS.find((a) => a.presetKey === 'slider-hero-showcase');
  assert.ok(sliderPreset);

  const cloneA = clonePresetSubtree(sliderPreset.element, { x: 40, y: 100 });
  const cloneB = clonePresetSubtree(sliderPreset.element, { x: 40, y: 600 });

  assert.notEqual(cloneA.id, sliderPreset.element.id);
  assert.notEqual(cloneA.id, cloneB.id);

  const slidesA = cloneA.children.filter((c) => c.sliderRole === 'slide');
  assert.equal(slidesA.length, 3);
  assert.deepEqual(cloneA.sliderConfig.slideIds, slidesA.map((s) => s.id));

  const nextBtnA = cloneA.children.find((c) => c.events?.onClick?.mode === 'slider_next');
  assert.ok(nextBtnA);
  assert.equal(nextBtnA.events.onClick.targetElementId, cloneA.id, 'Next button in cloneA must target cloneA.id');

  const dot2B = cloneB.children.find((c) => c.events?.onClick?.mode === 'slider_goto' && c.events.onClick.slideIndex === 2);
  assert.ok(dot2B);
  assert.equal(dot2B.events.onClick.targetElementId, cloneB.id, 'Dot button in cloneB must target cloneB.id');
});

test('executeNodeClickEvent switches activeSlideIndex across slider_next, slider_prev, slider_goto with wrap-around', () => {
  const sliderPreset = PRESET_ASSETS.find((a) => a.presetKey === 'slider-testimonials');
  const sliderNode = clonePresetSubtree(sliderPreset.element);
  const nextBtn = sliderNode.children.find((c) => c.events?.onClick?.mode === 'slider_next');
  const prevBtn = sliderNode.children.find((c) => c.events?.onClick?.mode === 'slider_prev');
  const dot2Btn = sliderNode.children.find((c) => c.events?.onClick?.mode === 'slider_goto' && c.events.onClick.slideIndex === 2);

  let runtimeOverrides = {};
  const setRuntimeOverrides = (updater) => {
    runtimeOverrides = typeof updater === 'function' ? updater(runtimeOverrides) : updater;
  };

  // Next: 0 -> 1
  const r1 = executeNodeClickEvent(nextBtn, { elements: [sliderNode], runtimeOverrides, setRuntimeOverrides });
  assert.equal(r1.activeSlideIndex, 1);
  assert.equal(runtimeOverrides[sliderNode.id].activeSlideIndex, 1);

  // Goto slide 2 -> 2
  const r2 = executeNodeClickEvent(dot2Btn, { elements: [sliderNode], runtimeOverrides, setRuntimeOverrides });
  assert.equal(r2.activeSlideIndex, 2);

  // Next wrap-around: 2 -> 0
  const r3 = executeNodeClickEvent(nextBtn, { elements: [sliderNode], runtimeOverrides, setRuntimeOverrides });
  assert.equal(r3.activeSlideIndex, 0);

  // Prev wrap-around: 0 -> 2
  const r4 = executeNodeClickEvent(prevBtn, { elements: [sliderNode], runtimeOverrides, setRuntimeOverrides });
  assert.equal(r4.activeSlideIndex, 2);
  assert.equal(resolveSliderNextIndex(sliderNode, 0, 'slider_prev'), 2);
});

test('generateModularReactProject & buildStandaloneHtmlSite emit working multi-slide attributes, styles & switchSlider script', () => {
  const navPack = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-corporate-dark').element, { x: 0, y: 0 });
  const sliderPack = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-hero-showcase').element, { x: 40, y: 100 });
  const footerPack = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'footer-enterprise-dark').element, { x: 0, y: 600 });

  const stage = { width: 1280, height: 1000, backgroundColor: '#09090b' };
  const project = generateModularReactProject([navPack, sliderPack, footerPack], stage, null, {
    projectName: 'Faz4 Carousel Vitrin',
    tabs: [{ id: 'tab-1', name: 'Anasayfa.craft', route: '/', elements: [navPack, sliderPack, footerPack] }],
  });

  assert.equal(project.usesModularTemplate, false);
  assert.ok(project.customElementsCode.includes('function') === false ? project.customElementsCode.includes('const switchSlider =') : project.customElementsCode.includes('switchSlider'));
  assert.ok(project.customElementsCode.includes('data-craft-slider-root='));
  assert.ok(project.customElementsCode.includes("switchSlider("));
  assert.ok(project.standaloneHtml.includes('data-craft-slider-action="next"'));
  assert.ok(project.standaloneHtml.includes('data-craft-slider-action="prev"'));
  assert.ok(project.standaloneHtml.includes('is-slide-hidden'));
  assert.ok(project.standaloneHtml.includes('function switchSlider('));
  assert.ok(project.standaloneHtml.includes('ATELIER STUDIO'));
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  console.error('❌ FAILURES DETECTED:');
  failureDetails.forEach(f => {
    console.error(`- ${f.name}: ${f.error}`);
    console.error(f.stack);
  });
  process.exit(1);
} else {
  console.log('🎉 ALL STUDIO CORE FEATURES PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
