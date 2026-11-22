import assert from 'node:assert/strict';
import { parse as parseBabel } from '@babel/parser';
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
  normalizeProjectTab,
  createDefaultProjectBackend,
  normalizeProjectBackend,
  detectInitializedViewports,
  slugifyTabRoute,
  loadRecentProjects,
  upsertRecentProject,
  removeRecentProject,
  saveProjectToWebStorage,
  loadProjectFromWebStorage,
  deleteProjectFromWebStorage,
  saveAutosaveDraft,
  loadAutosaveDraft,
  clearAutosaveDraft,
} from '../src/utils/projectStorage.js';
import {
  STUDIO_MODES,
  DEFAULT_STUDIO_MODE,
  STUDIO_MODE_LIST,
  isValidStudioMode,
  getStudioModeConfig,
  isToolSupportedInMode,
} from '../src/data/studioModesRegistry.js';
import {
  createInitialWorkspaceLayout,
  updateActiveModeLeftDrawerTab,
  updateActiveModeLeftDrawerWidth,
  clampLeftDrawerWidth,
  resolveEffectiveLeftDrawerWidth,
  updateActiveModeRightDock,
  computeEffectiveActivePanels,
  applyWorkspacePanelToggle,
  applyStudioModeTransition,
  applyWorkspaceLayoutReset,
} from '../src/hooks/useWorkspaceLayout.js';
import {
  computeLeftOccupiedWidth,
} from '../src/hooks/useCanvasView.js';
import {
  applyProjectBackendUpdate,
  resolveResetProjectBackend,
} from '../src/hooks/useProjectState.js';
import {
  dispatchStudioShortcut,
} from '../src/hooks/useShortcuts.js';
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
import {
  clampCanvasZoom,
  resolveWheelPanDelta,
  isEditableElementTarget,
  shouldHandleGlobalCanvasShortcut,
  resolveSingleKeyToolShortcut,
} from '../src/utils/canvasInputUtils.js';
import {
  detectBlockKind,
  findOwningBlock,
  extractBlockInspectorModel,
  applyBlockThemePreset,
  addNavbarLinkItem,
  removeBlockChildById,
  addSliderSlideItem,
  removeSliderSlideItem,
} from '../src/utils/blockCustomizerUtils.js';
import {
  resolveAiTargetScope,
  detectAiRedesignIntent,
  resolveAiTemperature,
  buildAiSystemPrompt,
  buildGeminiRequestContents,
  parseAiJsonResponse,
  sanitizeAiAstNodes,
  applyAiResponseToTree,
} from '../src/utils/aiAgentUtils.js';
import { importSiteCodeToProjectSchema } from '../src/utils/codeFileImporter.js';
import {
  resolveDrawnBox,
  extractPortableElementStyle,
  mergePortableStyleOntoNode,
  computeElementZOrderUpdate,
  computeAltMeasureGuides,
  parseCssColorToHex,
  computeContrastRatio,
  sampleColorAtClientPoint,
} from '../src/utils/canvasToolsUtils.js';
import { buildTabState } from '../src/utils/projectAssemblyUtils.js';

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
  assert.ok(customProj.customElementsCode.includes('9.375%'));
  assert.ok(customProj.customElementsCode.includes('37.5%'));
  assert.ok(customProj.customElementsCode.includes('84px'));
  assert.equal(customProj.appCode.includes("maxWidth: '1280px'"), false);
  assert.ok(customProj.standaloneHtml.includes('max-width:none;'));
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

test('Faz A: Export escapes <18ms / {braces} in JSX, maps rectangle->div, parses all modules via Babel, and enforces 100% viewport fluid width', () => {
  const desktopCanvas = { width: 1280, height: 900, backgroundColor: '#ffffff' };
  const canvasByVp = createDefaultCanvasByViewport(desktopCanvas);
  const kpiPreset = PRESET_ASSETS.find((a) => a.presetKey === 'block-stats-kpi');
  assert.ok(kpiPreset, 'block-stats-kpi preset must exist');
  const kpiPack = clonePresetSubtree(kpiPreset.element, { x: 0, y: 20 });
  const trickyElements = [
    kpiPack,
    {
      id: 'tricky-rect',
      type: 'rectangle',
      x: 64,
      y: 260,
      width: 640,
      height: 120,
      textContent: 'Hız <18ms & {özel} teklif > %99 memnuniyet',
      style: { 'background-color': '#18181b', color: '#fafafa', 'border-radius': '12px' },
    },
    {
      id: 'mobile-only-cta',
      type: 'button',
      x: 20,
      y: 400,
      width: 240,
      height: 44,
      isHidden: true,
      textContent: 'Mobil İletişim',
      style: { backgroundColor: '#2563eb', color: '#ffffff' },
      responsive: {
        mobile: { x: 16, y: 380, width: 343, height: 48, isHidden: false },
      },
    },
  ];

  const proj = generateModularReactProject(trickyElements, desktopCanvas, canvasByVp, {
    projectName: 'Faz A Validation',
    folderSlug: 'faz-a-validation',
    tabs: [{ id: 'tab-main', name: 'Ana Sayfa', route: '/', elements: trickyElements, canvasSettings: desktopCanvas, canvasByViewport: canvasByVp }],
    activeTabId: 'tab-main',
  });

  // 1. All JSX/JS files parse with zero syntax errors under Babel
  const filesToParse = [
    ['main.jsx', proj.mainJsx],
    ['App.jsx', proj.appCode],
    ['CustomElementsSection.jsx', proj.customElementsCode],
    ['Navbar.jsx', proj.navbarCode],
    ['HeroSection.jsx', proj.heroCode],
    ['ProductCard.jsx', proj.productCardCode],
    ['ProductsSection.jsx', proj.productsSectionCode],
    ['Footer.jsx', proj.footerCode],
  ];
  for (const [label, code] of filesToParse) {
    assert.ok(typeof code === 'string' && code.length > 0, `Missing code output for ${label}`);
    assert.doesNotThrow(
      () => parseBabel(code, { sourceType: 'module', plugins: ['jsx'] }),
      `Babel JSX parse failed for ${label}`
    );
  }

  // 2. JSX escaping & rectangle/style normalization
  assert.ok(proj.customElementsCode.includes("{'<'}18ms"));
  assert.ok(proj.customElementsCode.includes("{'{'}özel{'}'}"));
  assert.equal(proj.customElementsCode.includes('<rectangle'), false);
  assert.ok(proj.customElementsCode.includes('"backgroundColor":"#18181b"'));

  // 3. Full viewport fluid width (no 1280px max-width cage) + hidden-on-desktop -> visible-on-mobile rule
  assert.ok(proj.indexCss.includes('overflow-x: clip;'));
  assert.ok(proj.appCode.includes('overflow-x-clip'));
  assert.ok(proj.customElementsCode.includes('relative w-full'));
  assert.equal(proj.indexCss.includes('max-width: 1280px'), false);
  assert.equal(proj.appCode.includes("maxWidth: '1280px'"), false);
  assert.ok(proj.standaloneHtml.includes('max-width:none;'));
  assert.ok(proj.standaloneHtml.includes('display: flex !important;'));
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
// [11] FAZ B: WHEEL PANNING & KEYBOARD SHORTCUT GUARDS
// -----------------------------------------------------------------------------
console.log('\n⌨️ [11] Faz B Wheel Panning & Keyboard Shortcut Guards');

test('resolveWheelPanDelta keeps Shift+Wheel strictly vertical during multi-select while preserving native deltaX', () => {
  const shiftWheel = resolveWheelPanDelta({ deltaX: 0, deltaY: 120, shiftKey: true });
  assert.deepEqual(shiftWheel, { dx: 0, dy: -120 });

  const normalWheel = resolveWheelPanDelta({ deltaX: 0, deltaY: -80, shiftKey: false });
  assert.deepEqual(normalWheel, { dx: 0, dy: 80 });

  const trackpadSwipe = resolveWheelPanDelta({ deltaX: 45, deltaY: 30, shiftKey: true });
  assert.deepEqual(trackpadSwipe, { dx: -45, dy: -30 });
});

test('shouldHandleGlobalCanvasShortcut & resolveSingleKeyToolShortcut block edits inside contentEditable, inputs, modals, and modifier combos', () => {
  assert.equal(isEditableElementTarget({ tagName: 'div', isContentEditable: true }), true);
  assert.equal(isEditableElementTarget({ tagName: 'INPUT', isContentEditable: false }), true);
  assert.equal(isEditableElementTarget({ tagName: 'DIV', isContentEditable: false }), false);

  assert.equal(shouldHandleGlobalCanvasShortcut({ activeElement: { tagName: 'SPAN', isContentEditable: true }, isAnyModalOpen: false }), false);
  assert.equal(shouldHandleGlobalCanvasShortcut({ activeElement: { tagName: 'BODY', isContentEditable: false }, isAnyModalOpen: true }), false);
  assert.equal(shouldHandleGlobalCanvasShortcut({ activeElement: { tagName: 'BODY', isContentEditable: false }, isAnyModalOpen: false }), true);

  assert.equal(resolveSingleKeyToolShortcut('r', {}), 'rectangle');
  assert.equal(resolveSingleKeyToolShortcut('R', {}), 'rectangle');
  assert.equal(resolveSingleKeyToolShortcut('r', { isCtrlOrMeta: true }), null);
  assert.equal(resolveSingleKeyToolShortcut('t', { altKey: true }), null);
  assert.equal(resolveSingleKeyToolShortcut('v', { shiftKey: true }), null);

  assert.equal(clampCanvasZoom(4.2), 3.5);
  assert.equal(clampCanvasZoom(0.05), 0.2);
  assert.equal(clampCanvasZoom(0.95), 0.95);
});

// -----------------------------------------------------------------------------
// [12] FAZ C: EXPANDED CONTENT PACKS & CONTEXTUAL BLOCK CUSTOMIZER
// -----------------------------------------------------------------------------
console.log('\n🧩 [12] Faz C Expanded Content Packs & Block Customizer');

test('CONTENT_PACK_ASSETS contains 5+ Navbars, 4+ Footers, 3+ Sliders, 7+ Content Blocks with unique node IDs', () => {
  const navs = PRESET_ASSETS.filter((a) => a.category === 'Navbar');
  const footers = PRESET_ASSETS.filter((a) => a.category === 'Footer');
  const sliders = PRESET_ASSETS.filter((a) => a.category === 'Slider');
  const blocks = PRESET_ASSETS.filter((a) => a.category === 'İçerik Blokları');

  assert.ok(navs.length >= 5, `Expected >=5 navbars, got ${navs.length}`);
  assert.ok(footers.length >= 4, `Expected >=4 footers, got ${footers.length}`);
  assert.ok(sliders.length >= 3, `Expected >=3 sliders, got ${sliders.length}`);
  assert.ok(blocks.length >= 7, `Expected >=7 blocks, got ${blocks.length}`);

  const presetKeys = CONTENT_PACK_ASSETS.map((p) => p.presetKey);
  assert.equal(new Set(presetKeys).size, CONTENT_PACK_ASSETS.length, 'Duplicate presetKey found in CONTENT_PACK_ASSETS');
});

test('blockCustomizerUtils resolves enclosing navbar/slider, adds/removes links & slides, and rethemes contrast cleanly', () => {
  const nav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-saas-split').element, { x: 0, y: 0 });
  const slider = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-hero-showcase').element, { x: 40, y: 100 });
  const tree = [nav, slider];

  const firstLink = nav.children.find((c) => c.type === 'a');
  const owned = findOwningBlock(tree, firstLink.id);
  assert.equal(owned.blockNode.id, nav.id);
  assert.equal(owned.blockKind, 'navbar');
  assert.equal(owned.isAncestor, true);

  const navModel = extractBlockInspectorModel(nav);
  assert.ok(navModel.brandNode && navModel.brandNode.text === 'STUDIO PRO');
  assert.equal(navModel.linkNodes.length, 4);
  assert.equal(navModel.ctaNodes.length, 2);

  // Add and remove nav link
  const navWith5Links = addNavbarLinkItem(nav, 'Blog', '#blog');
  const navModel5 = extractBlockInspectorModel(navWith5Links);
  assert.equal(navModel5.linkNodes.length, 5);
  const addedLink = navModel5.linkNodes.find((l) => l.text === 'Blog');
  assert.ok(addedLink);

  const navBackTo4 = removeBlockChildById(navWith5Links, addedLink.id);
  assert.equal(extractBlockInspectorModel(navBackTo4).linkNodes.length, 4);

  // Retheme to light
  const lightNav = applyBlockThemePreset(navWith5Links, 'light');
  assert.equal(lightNav.style.backgroundColor, '#ffffff');
  const lightModel = extractBlockInspectorModel(lightNav);
  assert.equal(lightModel.brandNode.color, '#09090b');

  // Slider add & remove slide
  assert.equal(detectBlockKind(slider), 'slider');
  const sliderWith4 = addSliderSlideItem(slider);
  assert.equal(sliderWith4.sliderConfig.totalSlides, 4);
  assert.equal(sliderWith4.sliderConfig.slideIds.length, 4);
  const dots4 = sliderWith4.children.filter((c) => c.events?.onClick?.mode === 'slider_goto');
  assert.equal(dots4.length, 4);
  assert.equal(dots4[3].events.onClick.slideIndex, 3);

  const lastSlideId = sliderWith4.sliderConfig.slideIds[3];
  const sliderBack3 = removeSliderSlideItem(sliderWith4, lastSlideId);
  assert.equal(sliderBack3.sliderConfig.totalSlides, 3);
  assert.equal(sliderBack3.sliderConfig.slideIds.length, 3);
});

// -----------------------------------------------------------------------------
// [13] FAZ D: AI AGENT FULL-SITE & SECTION-SCOPED EDITING
// -----------------------------------------------------------------------------
console.log('\n🤖 [13] Faz D AI Agent Full-Site & Section-Scoped Editing');

test('aiAgentUtils resolves full_site vs selection scope, parses markdown JSON, sanitizes AST tags/styles, and patches ONLY targeted section', () => {
  const nav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-corporate-dark').element, { x: 0, y: 0 });
  const hero = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-split-hero').element, { x: 40, y: 90 });
  const footer = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'footer-enterprise-dark').element, { x: 0, y: 580 });
  const pageTree = [nav, hero, footer];

  // Auto scope with selection -> selection mode targeting ONLY hero
  const selScope = resolveAiTargetScope(pageTree, [hero.id], 'auto');
  assert.equal(selScope.effectiveMode, 'selection');
  assert.deepEqual(selScope.targetIds, [hero.id]);

  // Empty selection with selection mode requested -> falls back to full_site
  const emptyScope = resolveAiTargetScope(pageTree, [], 'selection');
  assert.equal(emptyScope.effectiveMode, 'full_site');

  const promptSel = buildAiSystemPrompt({
    effectiveMode: 'selection',
    elements: pageTree,
    targetNodes: selScope.targetNodes,
    userPrompt: 'Hero arka planını değiştir',
  });
  assert.ok(promptSel.includes('updatedNodes'));
  assert.ok(promptSel.includes(hero.id));

  // Simulated markdown-wrapped Gemini JSON with rectangle + kebab-case CSS + modified hero title
  const fakeAiReply = '```json\n' + JSON.stringify({
    message: 'Hero bölümü yenilendi.',
    updatedNodes: [
      {
        id: hero.id,
        type: 'section',
        name: 'Yeni Hero',
        x: 40,
        y: 90,
        width: 1200,
        height: 460,
        style: { 'background-color': '#1e1b4b', 'border-radius': '24px' },
        children: [
          {
            id: 'ai-hero-box',
            type: 'rectangle',
            x: 40,
            y: 40,
            width: 500,
            height: 80,
            textContent: 'Yapay Zeka İle Güçlendirildi',
            style: { color: '#ffffff' },
          },
        ],
      },
    ],
  }) + '\n```';

  const parsed = parseAiJsonResponse(fakeAiReply);
  const patched = applyAiResponseToTree({
    elements: pageTree,
    parsedResponse: parsed,
    effectiveMode: 'selection',
    targetIds: [hero.id],
    currentStageHeight: 1350,
  });

  // Navbar and Footer must remain completely untouched; Hero updated & rectangle -> div, backgroundColor camelCase
  assert.equal(patched.nextElements.length, 3);
  assert.equal(patched.nextElements[0].id, nav.id);
  assert.deepEqual(patched.nextElements[0], nav);
  assert.deepEqual(patched.nextElements[2], footer);
  assert.equal(patched.nextElements[1].style.backgroundColor, '#1e1b4b');
  assert.equal(patched.nextElements[1].style.borderRadius, '24px');
  assert.equal(patched.nextElements[1].children[0].type, 'div');

  // Full-site sanitization ensures unique IDs and tall stage height
  const sanitizedDup = sanitizeAiAstNodes([
    { id: 'dup', type: 'nav', x: 0, y: 0, width: 1280, height: 72 },
    { id: 'dup', type: 'footer', x: 0, y: 1800, width: 1280, height: 260 },
  ]);
  assert.notEqual(sanitizedDup[0].id, sanitizedDup[1].id);
  const fullResult = applyAiResponseToTree({
    elements: [],
    parsedResponse: { elements: sanitizedDup },
    effectiveMode: 'full_site',
  });
  assert.ok(fullResult.recommendedHeight >= 2140);
});

// -----------------------------------------------------------------------------
// 19. FAZ 2: AUTOSAVE DRAFT RECOVERY, WEB SNAPSHOT FALLBACK & LOSS-FREE SAVE AS
// -----------------------------------------------------------------------------
console.log('\n💾 [19] Faz 2 Autosave Recovery, Save As & Responsive Init Integrity');

test('normalizeProjectTab detects initialized viewports accurately without over-marking tablet/mobile', () => {
  const desktopOnly = createTagElement('text', { id: 'dt-only', textContent: 'Masaüstü' });
  const tabA = normalizeProjectTab({
    id: 't1',
    name: 'Hakkımızda.craft',
    elements: [desktopOnly],
    canvasByViewport: createDefaultCanvasByViewport(),
  }, 1);
  assert.equal(tabA.route, '/hakkimizda');
  assert.deepEqual(tabA.initializedViewports, { desktop: true, tablet: false, mobile: false });
  assert.equal(slugifyTabRoute('Hakkımızda.craft', 0), '/');

  const withMobile = {
    ...desktopOnly,
    responsive: { mobile: { x: 12, y: 20, width: 340 } },
  };
  assert.deepEqual(detectInitializedViewports([withMobile], true), {
    desktop: true,
    tablet: false,
    mobile: true,
  });
});

test('web storage fallback, clearAutosaveDraft & Save As distinct file preservation work end-to-end', () => {
  const map = {};
  const storageWithRemove = {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
  };
  const minimalStorage = {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
  };

  const proj1 = buildSerializableProjectSchema({
    id: 'proj-f2-1',
    name: 'Ana Proje',
    filePath: '/tmp/ana-proje.craft.json',
    tabs: [{ id: 'tab-home', name: 'Anasayfa.craft', elements: [createTagElement('text', { id: 'tx1', textContent: 'Merhaba' })] }],
    pageLinks: [{ label: 'Ana', href: '/' }],
  });

  // Save As creates distinct recent project entry without erasing original path
  const proj2 = buildSerializableProjectSchema({
    ...proj1,
    id: 'proj-f2-2',
    name: 'Ana Proje v2',
    filePath: '/tmp/ana-proje-v2.craft.json',
  });

  upsertRecentProject(proj1, storageWithRemove);
  const afterSaveAs = upsertRecentProject(proj2, storageWithRemove);
  assert.equal(afterSaveAs.length, 2);
  assert.equal(afterSaveAs[0].hasWebSnapshot, true);
  assert.equal(afterSaveAs[1].hasWebSnapshot, true);

  // Saved project can be loaded directly from web storage even if snapshot removed, then deleted
  assert.equal(saveProjectToWebStorage(proj1, storageWithRemove), true);
  const restoredProj = loadProjectFromWebStorage('proj-f2-1', storageWithRemove);
  assert.equal(restoredProj.name, 'Ana Proje');
  assert.equal(restoredProj.pageLinks.length, 1);
  assert.equal(deleteProjectFromWebStorage('proj-f2-1', storageWithRemove), true);
  assert.equal(loadProjectFromWebStorage('proj-f2-1', storageWithRemove), null);

  // Autosave draft save -> load -> clear works with both storage types
  assert.equal(saveAutosaveDraft(proj2, storageWithRemove), true);
  assert.equal(loadAutosaveDraft(storageWithRemove).name, 'Ana Proje v2');
  assert.equal(clearAutosaveDraft(storageWithRemove), true);
  assert.equal(loadAutosaveDraft(storageWithRemove), null);

  assert.equal(saveAutosaveDraft(proj2, minimalStorage), true);
  assert.equal(clearAutosaveDraft(minimalStorage), true);
  assert.equal(loadAutosaveDraft(minimalStorage), null);
});

// -----------------------------------------------------------------------------
// FAZ 4 — EXPANDED PRESET LIBRARY, THUMBNAILS & MULTI-CARD SLIDER EDITING
// -----------------------------------------------------------------------------
console.log('\n🧩 [13] Faz 4 Expanded Content Packs, Multi-Card Sliders & Export Integrity');

test('CONTENT_PACK_ASSETS reaches 6+ Navbars, 5+ Footers, 4+ Interactive Sliders & 7+ Blocks with unique internal node IDs', () => {
  const navs = PRESET_ASSETS.filter((a) => a.category === 'Navbar');
  const footers = PRESET_ASSETS.filter((a) => a.category === 'Footer');
  const sliders = PRESET_ASSETS.filter((a) => a.category === 'Slider');
  const blocks = PRESET_ASSETS.filter((a) => a.category === 'İçerik Blokları');

  assert.ok(navs.length >= 6, `Expected >=6 navbars, got ${navs.length}`);
  assert.ok(footers.length >= 5, `Expected >=5 footers, got ${footers.length}`);
  assert.ok(sliders.length >= 4, `Expected >=4 sliders, got ${sliders.length}`);
  assert.ok(blocks.length >= 7, `Expected >=7 content blocks, got ${blocks.length}`);

  ['nav-ecommerce-search', 'footer-contact-map', 'slider-logo-clients'].forEach((key) => {
    assert.ok(CONTENT_PACK_ASSETS.some((p) => p.presetKey === key), `Missing presetKey ${key}`);
  });

  CONTENT_PACK_ASSETS.forEach((pack) => {
    const flat = flattenTree([pack.element]);
    const ids = flat.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, `Duplicate internal node id inside ${pack.presetKey}`);
  });
});

test('multi-card slider active-slide editing exposes extraTexts & extraImages cleanly', () => {
  const logoSlider = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-logo-clients').element, { x: 60, y: 120 });
  const logoModel = extractBlockInspectorModel(logoSlider);
  assert.equal(logoModel.blockKind, 'slider');
  assert.equal(logoModel.slides.length, 3);
  // Slide 1 has 1 kicker + 4 cards * 3 texts (code, h4, p) -> titleNode (first h4) + descNode (first >10ch p/span) + remaining texts
  assert.ok(logoModel.slides[0].titleNode, 'First client brand heading should be bound to titleNode');
  assert.ok(logoModel.slides[0].extraTexts.length >= 10, `Expected multi-card extraTexts >= 10, got ${logoModel.slides[0].extraTexts.length}`);

  const collectionSlider = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-collection-strip').element, { x: 60, y: 500 });
  const colModel = extractBlockInspectorModel(collectionSlider);
  assert.ok(colModel.slides[0].imgNode, 'Primary card image should populate imgNode');
  assert.equal(colModel.slides[0].extraImages.length, 1, 'Second collection card image should populate extraImages');
  assert.ok(colModel.slides[0].extraTexts.some((t) => t.text.includes('Altın Kolye')), 'Second card title should be directly editable in extraTexts');
});

test('new Faz 4 presets export to valid parseable React JSX and Standalone HTML5', () => {
  const ecomNav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-ecommerce-search').element, { x: 0, y: 0 });
  const clientSlider = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-logo-clients').element, { x: 60, y: 120 });
  const contactFooter = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'footer-contact-map').element, { x: 0, y: 460 });

  const prevBtn = clientSlider.children.find((c) => c.events?.onClick?.mode === 'slider_prev');
  assert.equal(prevBtn.events.onClick.targetElementId, clientSlider.id, 'Cloned slider control targetElementId must remap to cloned slider root');

  const elements = [ecomNav, clientSlider, contactFooter];
  const stage = { width: 1280, height: 750, backgroundColor: '#111113' };
  const samplePageLinks = [
    { id: 'pl-1', sourceElementId: 'nav-link-1', targetTabId: 'tab-about', label: 'Hakkımızda' },
  ];
  const generated = generateModularReactProject(elements, stage, null, {
    projectName: 'Faz4 Vitrin Test',
    tabs: [{ id: 'tab-faz4', name: 'Anasayfa.craft', route: '/', elements }],
    pageLinks: samplePageLinks,
    viewportMode: 'tablet',
    activeTabId: 'tab-faz4',
  });
  const jsxFields = [
    'mainJsx',
    'appCode',
    'navbarCode',
    'heroCode',
    'productCardCode',
    'productsSectionCode',
    'customElementsCode',
    'footerCode',
  ];
  let parsedJsxCount = 0;
  jsxFields.forEach((fieldKey) => {
    const code = generated[fieldKey];
    assert.equal(typeof code, 'string', `${fieldKey} should be generated`);
    assert.ok(code.length > 0, `${fieldKey} should be non-empty`);
    assert.doesNotThrow(
      () => parseBabel(code, { sourceType: 'module', plugins: ['jsx'] }),
      `${fieldKey} JSX parse failed`
    );
    parsedJsxCount++;
  });
  assert.equal(parsedJsxCount, jsxFields.length);
  assert.ok(generated.customElementsCode.includes('KARTAL STORE'), 'Navbar brand missing in generated.customElementsCode');
  assert.ok(generated.customElementsCode.includes('NORDIC LABS'), 'Partner slider content missing in generated.customElementsCode');

  const parsedProjectJson = JSON.parse(generated.craftProjectJson);
  assert.deepEqual(parsedProjectJson.pageLinks, samplePageLinks, 'craftProjectJson must preserve pageLinks');
  assert.equal(parsedProjectJson.viewportMode, 'tablet', 'craftProjectJson must preserve viewportMode');

  assert.ok(generated.standaloneHtml.includes('KARTAL STORE'), 'Navbar brand missing in generated.standaloneHtml');
  assert.ok(generated.standaloneHtml.includes('NORDIC LABS'), 'Partner slider content missing in generated.standaloneHtml');

  const html = buildStandaloneHtmlSite({
    projectName: 'Faz4 Vitrin Test',
    tabs: [{ id: 'tab-faz4', name: 'Anasayfa.craft', route: '/', elements, canvasSettings: stage }],
    elements,
    canvasSettings: stage,
    activeTabId: 'tab-faz4',
  });
  assert.ok(html.includes('KARTAL STORE'), 'Navbar brand missing in standalone HTML');
  assert.ok(html.includes('type="search"'), 'Search input attribute missing in standalone HTML');
  assert.ok(html.includes('NORDIC LABS'), 'Partner slider content missing in standalone HTML');
  assert.ok(html.includes('ÇALIŞMA SAATLERİ'), 'Contact footer content missing in standalone HTML');
  assert.ok(html.includes('switchSlider('), 'Interactive slider runtime missing in standalone HTML');
});

test('addSliderSlideItem and removeSliderSlideItem keep .slideIndex and dots synchronized through 0..N-1', () => {
  const slider = clonePresetSubtree(
    PRESET_ASSETS.find((a) => a.presetKey === 'slider-logo-clients').element,
    { x: 60, y: 120 }
  );

  // Add 4th slide
  const added = addSliderSlideItem(slider, 2);
  assert.equal(added.sliderConfig.activeSlideIndex, 3, 'New slide should become active');
  const addedSlides = added.children.filter((c) => c.sliderRole === 'slide');
  const addedDots = added.children.filter((c) => c.sliderRole === 'dot');
  assert.equal(addedSlides.length, 4);
  assert.equal(addedDots.length, 4);
  assert.deepEqual(addedSlides.map((s) => s.slideIndex), [0, 1, 2, 3], 'Slides must have sequential .slideIndex 0..3');
  assert.deepEqual(addedDots.map((d) => d.slideIndex), [0, 1, 2, 3], 'Dots must have sequential .slideIndex 0..3');
  assert.deepEqual(
    addedDots.map((d) => d.events?.onClick?.slideIndex),
    [0, 1, 2, 3],
    'Dot click events must target sequential slide indices 0..3'
  );

  const inspectorAfterAdd = extractBlockInspectorModel(added);
  assert.equal(inspectorAfterAdd.slides.length, 4);
  assert.deepEqual(inspectorAfterAdd.slides.map((s) => s.slideIndex), [0, 1, 2, 3]);

  // Verify 4th slide renders visibly (no display:none / is-slide-hidden on slide 3)
  const jsxSlide4 = renderAstElementToJsx(added, '  ', { preserveCanvasCoords: true });
  assert.ok(jsxSlide4.includes('data-craft-slide-index="3"'), 'JSX must emit slideIndex 3');
  assert.ok(!jsxSlide4.includes('data-craft-slide-index="3" style={') || !/data-craft-slide-index="3"[^>]*display":"none"/.test(jsxSlide4));
  const htmlSlide4 = buildStandaloneHtmlSite({
    projectName: 'Slider 4 Test',
    tabs: [{ id: 'tab-s4', name: 'Home', route: '/', elements: [added] }],
    elements: [added],
    activeTabId: 'tab-s4',
  });
  const slide4TagMatch = htmlSlide4.match(/<div[^>]*data-craft-slide-index="3"[^>]*>/);
  assert.ok(slide4TagMatch, 'Slide 4 tag must exist in standalone HTML');
  assert.ok(!slide4TagMatch[0].includes('is-slide-hidden'), 'Newly activated Slide 4 must be visible (not is-slide-hidden)');

  // Delete middle slide (index 1, by slideId) -> remaining 3 slides must re-index cleanly to 0, 1, 2
  const removedMid = removeSliderSlideItem(added, addedSlides[1].id);
  const remSlides = removedMid.children.filter((c) => c.sliderRole === 'slide');
  const remDots = removedMid.children.filter((c) => c.sliderRole === 'dot');
  assert.equal(remSlides.length, 3);
  assert.equal(remDots.length, 3);
  assert.deepEqual(remSlides.map((s) => s.slideIndex), [0, 1, 2], 'Remaining slides must re-index to 0..2');
  assert.deepEqual(remDots.map((d) => d.slideIndex), [0, 1, 2], 'Remaining dots must re-index to 0..2');
  assert.deepEqual(
    remDots.map((d) => d.events?.onClick?.slideIndex),
    [0, 1, 2],
    'Dot click indices must re-index to 0..2'
  );
  assert.ok(removedMid.sliderConfig.activeSlideIndex <= 2, 'activeSlideIndex must stay within bounds');
});

test('applyBlockThemePreset rethemes <article>, <blockquote>, <input>, slides and supports light <-> midnight round-trip', () => {
  const collection = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-collection-strip').element);
  const testimonials = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-testimonials').element);
  const ecomNav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-ecommerce-search').element);
  const showcase = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-product-showcase').element);

  const lightCollection = applyBlockThemePreset(collection, 'light');
  const lightArticles = flattenTree([lightCollection]).filter((n) => (n.type || '').toLowerCase() === 'article');
  assert.ok(lightArticles.length >= 2);
  lightArticles.forEach((art) => {
    assert.equal(art.style?.backgroundColor, '#f8fafc', 'Light theme must paint <article> cards with light cardBg');
  });

  const darkAgainCollection = applyBlockThemePreset(lightCollection, 'midnight');
  const darkArticles = flattenTree([darkAgainCollection]).filter((n) => (n.type || '').toLowerCase() === 'article');
  darkArticles.forEach((art) => {
    assert.equal(art.style?.backgroundColor, '#18181c', 'Midnight theme must restore <article> cards after Light theme');
  });

  const lightTestimonials = applyBlockThemePreset(testimonials, 'light');
  const quotes = flattenTree([lightTestimonials]).filter((n) => (n.type || '').toLowerCase() === 'blockquote');
  assert.ok(quotes.length >= 1);
  assert.equal(quotes[0].style?.color, '#09090b', 'Light theme must recolor <blockquote> text to dark ink');
  const slidesAfterLight = flattenTree([lightTestimonials]).filter((n) => n.sliderRole === 'slide');
  assert.ok(slidesAfterLight.every((s) => s.style?.backgroundColor === '#ffffff' && !s.style?.background), 'Light theme must recolor gradient slides');

  const lightNav = applyBlockThemePreset(ecomNav, 'light');
  const searchInput = flattenTree([lightNav]).find((n) => (n.type || '').toLowerCase() === 'input');
  assert.ok(searchInput, 'E-commerce nav must contain <input>');
  assert.equal(searchInput.style?.backgroundColor, '#f4f4f5', 'Light theme must paint <input> with inputBg');
  assert.equal(searchInput.style?.color, '#09090b', 'Light theme must paint <input> text dark');

  const lightShowcase = applyBlockThemePreset(showcase, 'light');
  const showcaseCards = flattenTree([lightShowcase]).filter((n) => (n.name || '').startsWith('Ürün Kartı'));
  assert.equal(showcaseCards.length, 3);
  showcaseCards.forEach((card) => {
    assert.equal(card.style?.backgroundColor, '#f8fafc', 'Showcase cards must switch to light cardBg');
  });

  const clientSlider = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'slider-logo-clients').element);
  const lightClients = applyBlockThemePreset(clientSlider, 'light');
  const clientArticles = flattenTree([lightClients]).filter((n) => (n.type || '').toLowerCase() === 'article');
  assert.ok(clientArticles.length >= 4);
  clientArticles.forEach((card) => {
    assert.equal(card.style?.backgroundColor, '#f8fafc', 'Client logo <article> cards must switch to light cardBg');
  });
});

test('FAQ accordion toggles interactively across AST, React JSX and Standalone HTML and exposes navbar/footer inputs in BlockCustomizer', () => {
  const faq = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-faq-accordion').element, { x: 80, y: 120 });
  const faqFlat = flattenTree([faq]);
  const items = faqFlat.filter((n) => n.accordionRole === 'item');
  assert.equal(items.length, 3, 'FAQ block should contain 3 accordion items');
  assert.equal(items[0].accordionOpen, true, 'First FAQ item starts open');
  assert.equal(items[1].accordionOpen, false, 'Second FAQ item starts collapsed');
  items.forEach((item) => {
    assert.equal(item.events?.onClick?.mode, 'accordion_toggle');
    assert.equal(item.events?.onClick?.targetElementId, item.id, 'clonePresetSubtree must remap accordion_toggle targetElementId');
  });

  // React onClick helper codegen
  assert.equal(buildReactOnClickExpression(items[1].events.onClick), `() => toggleAccordion(${JSON.stringify(items[1].id)})`);

  // Preview mode toggle simulation
  let runtimeOverrides = {};
  const toggleRes = executeNodeClickEvent(items[1], {
    elements: [faq],
    runtimeOverrides,
    setRuntimeOverrides: (next) => {
      runtimeOverrides = next;
    },
  });
  assert.equal(toggleRes.ok, true);
  assert.equal(toggleRes.action, 'accordion_toggle');
  assert.equal(toggleRes.accordionOpen, true, 'Clicking collapsed FAQ item should return accordionOpen: true');
  assert.equal(runtimeOverrides[items[1].id]?.accordionOpen, true, 'runtimeOverrides should record opened state for clicked FAQ item');

  // React JSX & Standalone HTML serialization
  const faqGenerated = generateModularReactProject([faq], { width: 1280, height: 600, backgroundColor: '#111113' }, null, {
    projectName: 'FAQ Export Test',
    tabs: [{ id: 'tab-faq', name: 'FAQ', route: '/', elements: [faq] }],
  });
  assert.doesNotThrow(
    () => parseBabel(faqGenerated.customElementsCode, { sourceType: 'module', plugins: ['jsx'] }),
    'FAQ customElementsCode must parse cleanly as JSX'
  );
  assert.ok(faqGenerated.customElementsCode.includes('const toggleAccordion ='), 'React runtime must include toggleAccordion');
  assert.ok(faqGenerated.customElementsCode.includes('data-craft-accordion-item="1"'), 'React JSX must emit accordion item metadata');
  assert.ok(faqGenerated.standaloneHtml.includes('function toggleAccordion('), 'Standalone HTML must include toggleAccordion');
  assert.ok(faqGenerated.standaloneHtml.includes('data-craft-accordion-toggle='), 'Standalone HTML must include accordion toggle delegates');
  assert.ok(faqGenerated.standaloneHtml.includes('data-craft-accordion-panel="1"'), 'Standalone HTML must include accordion panel markers');

  // BlockCustomizer inputNodes extraction for search nav & newsletter footer
  const ecomNav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-ecommerce-search').element);
  const newsletterFooter = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'footer-newsletter-cta').element);
  const navModel = extractBlockInspectorModel(ecomNav);
  const footerModel = extractBlockInspectorModel(newsletterFooter);
  assert.equal(navModel.inputNodes.length, 1, 'Search navbar must expose 1 inputNode');
  assert.equal(navModel.inputNodes[0].inputType, 'search');
  assert.ok(navModel.inputNodes[0].placeholder.includes('Ürün'), 'Search navbar placeholder must be exposed');
  assert.equal(footerModel.inputNodes.length, 1, 'Newsletter footer must expose 1 inputNode');
  assert.equal(footerModel.inputNodes[0].inputType, 'email');
  assert.equal(footerModel.inputNodes[0].placeholder, 'ornek@marka.com', 'Newsletter placeholder must be exposed');
});

// -----------------------------------------------------------------------------
// 21. FLOATING CONVERSATIONAL AI CHAT: REDESIGN INTENT, MEMORY & UNDO SAFETY
// -----------------------------------------------------------------------------
console.log('\n🤖 [21] Floating Conversational AI & Redesign Intent');

test('AI utils detect redesign critique ("bu olmamış"), build multi-turn contents & preserve section anchor position', () => {
  assert.equal(detectAiRedesignIntent('bu olmamış knk baştan tasarla'), true);
  assert.equal(detectAiRedesignIntent('beğenmedim şurayı'), true);
  assert.equal(detectAiRedesignIntent('başlığı sadece ortala'), false);

  assert.ok(
    resolveAiTemperature({ effectiveMode: 'selection', isRedesign: true }) >
      resolveAiTemperature({ effectiveMode: 'selection', isRedesign: false }),
    'Redesign intent must raise creativity temperature'
  );

  const nav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-corporate-dark').element, { x: 0, y: 0 });
  const hero = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-split-hero').element, { x: 40, y: 520 });
  const promptRedesign = buildAiSystemPrompt({
    effectiveMode: 'selection',
    elements: [nav, hero],
    targetNodes: [hero],
    userPrompt: 'knk burası olmamış, daha lüks yap',
  });
  assert.ok(promptRedesign.includes('YENİDEN TASARIM (REDESIGN) MODU AKTİF'));
  assert.ok(promptRedesign.includes('Tamam knk'));

  const multiTurn = buildGeminiRequestContents({
    conversationHistory: [
      { id: 'welcome', role: 'assistant', text: 'Selam' },
      { id: 'u1', role: 'user', promptText: 'hero olmamış', text: 'hero olmamış' },
      { id: 'a1', role: 'assistant', rawMessage: 'Tamam knk, Hero kısmını yeniledim.', text: 'Tamam knk' },
      { id: 'err1', role: 'assistant', isError: true, text: 'timeout error' },
    ],
    systemPrompt: 'FINAL_LIVE_PROMPT',
  });
  assert.equal(multiTurn.length, 3);
  assert.equal(multiTurn[0].role, 'user');
  assert.equal(multiTurn[1].role, 'model');
  assert.equal(multiTurn[2].role, 'user');
  assert.equal(multiTurn[2].parts[0].text, 'FINAL_LIVE_PROMPT');

  // If AI omits x/y or emits 0/0 while patching lower section, preserve section's original anchor (x:40, y:520)
  const patchedPreserved = applyAiResponseToTree({
    elements: [nav, hero],
    parsedResponse: {
      message: 'Tamam knk, yeniledim.',
      updatedNodes: [{ id: hero.id, type: 'section', height: 480, style: { backgroundColor: '#111113' }, children: [] }],
    },
    effectiveMode: 'selection',
    targetIds: [hero.id],
  });
  assert.equal(patchedPreserved.nextElements[1].x, 40);
  assert.equal(patchedPreserved.nextElements[1].y, 520);
  assert.deepEqual(patchedPreserved.appliedTargetIds, [hero.id]);
  assert.ok(Array.isArray(patchedPreserved.changes) && patchedPreserved.changes.length >= 1, 'AI apply without explicit changes must produce deterministic AST diff bullets');
  assert.ok(patchedPreserved.changes.some((c) => /Hero|arka plan|yükseklik/i.test(c)));

  const withExplicitChanges = applyAiResponseToTree({
    elements: [nav, hero],
    parsedResponse: {
      message: 'Tamam knk, adım adım düzenledim.',
      changes: ['Hero arka planı mat siyaha çekildi', 'Ana başlık boyutu büyütüldü'],
      updatedNodes: [{ id: hero.id, type: 'section', height: 500, style: { backgroundColor: '#111113' }, children: [] }],
    },
    effectiveMode: 'selection',
    targetIds: [hero.id],
  });
  assert.deepEqual(withExplicitChanges.changes, ['Hero arka planı mat siyaha çekildi', 'Ana başlık boyutu büyütüldü']);
  const sysPromptStr = buildAiSystemPrompt({ effectiveMode: 'full_site', elements: [nav], userPrompt: 'Kafe sitesi yap' });
  assert.ok(sysPromptStr.includes('"changes"'), 'AI system prompt must request teker teker changes array');
});

console.log('\n🚀 [22] Publish / Export Reliability Regression Suite');

test('mixed Demo + FAQ/Slider keeps modular template, respects edited hero fillColor, omits removed sections & normalizes custom top offset', () => {
  const clonedStarter = structuredClone(DEFAULT_UNIVERSAL_PROJECT);
  const withoutFooterAndProducts = clonedStarter.filter(
    (el) => el.id !== 'elem-footer' && el.name !== 'Footer' && el.id !== 'elem-features-section' && el.name !== 'FeaturesSection'
  );
  const heroNode = withoutFooterAndProducts.find((el) => el.name === 'HeroSection' || el.id === 'elem-hero' || el.name?.includes('Hero'));
  assert.ok(heroNode, 'Cloned starter should contain Hero node');
  heroNode.fillType = 'solid';
  heroNode.fillColor = '#312e81';

  const faqBlock = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-faq-accordion').element, { x: 60, y: 1400 });
  const floatingBadge = createTagElement('div', {
    x: 24,
    y: 24,
    width: 140,
    height: 36,
    textContent: 'CANLI',
    positionMode: 'fixed',
  });

  const elements = [...withoutFooterAndProducts, faqBlock, floatingBadge];
  const stage = { width: 1440, height: 1800, backgroundColor: '#111113' };
  const generated = generateModularReactProject(elements, stage, null, {
    projectName: 'Karma Vitrin',
    tabs: [{ id: 'tab-home', name: 'Anasayfa', route: '/', elements, canvasSettings: stage }],
    activeTabId: 'tab-missing-fallback',
  });

  assert.equal(generated.usesModularTemplate, true);
  assert.ok(generated.heroCode.includes('#312e81'), 'Edited Hero fillColor must override default starter style.background');
  assert.ok(!generated.appCode.includes('<Footer'), 'Removed Footer must be omitted from App.jsx');
  assert.ok(!generated.appCode.includes('<ProductsSection'), 'Removed ProductsSection must be omitted from App.jsx');
  assert.ok(generated.customElementsCode.includes('"position":"fixed"'), 'positionMode: fixed must stay fixed in CustomElementsSection');
  assert.ok(generated.customElementsCode.includes('"top":"1400px"'), 'Unified modular stage renders custom elements at exact canvas top coordinate');
  assert.ok(generated.standaloneHtml.includes('#312e81') || generated.standaloneHtml.includes('Hero'), 'Standalone HTML must generate cleanly even when activeTabId misses');

  ['mainJsx', 'appCode', 'navbarCode', 'heroCode', 'productCardCode', 'productsSectionCode', 'customElementsCode', 'footerCode'].forEach((key) => {
    assert.doesNotThrow(
      () => parseBabel(generated[key], { sourceType: 'module', plugins: ['jsx'] }),
      `${key} should parse as valid JSX`
    );
  });
});

test('multi-page React SPA routing & Standalone HTML case-insensitive page navigation', () => {
  const homeNav = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'nav-corporate-dark').element, { x: 0, y: 0 });
  const homeHero = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-split-hero').element, { x: 40, y: 120 });
  const aboutFaq = clonePresetSubtree(PRESET_ASSETS.find((a) => a.presetKey === 'block-faq-accordion').element, { x: 40, y: 120 });
  const aboutBtn = createTagElement('button', {
    x: 40,
    y: 40,
    width: 180,
    height: 44,
    textContent: 'Hakkımıza Git',
    style: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
    events: { onClick: { mode: 'navigate_page', targetPageId: 'tab-about' } },
  });

  const tabs = [
    { id: 'tab-home', name: 'Anasayfa', route: '/', elements: [homeNav, homeHero, aboutBtn], canvasSettings: { width: 1280, height: 900, backgroundColor: '#111113' } },
    { id: 'tab-about', name: 'Hakkımızda', route: '/hakkimizda', elements: [aboutFaq], canvasSettings: { width: 1280, height: 900, backgroundColor: '#111113' } },
  ];

  const generated = generateModularReactProject(tabs[0].elements, tabs[0].canvasSettings, null, {
    projectName: 'Çok Sayfalı Site',
    tabs,
    activeTabId: 'tab-home',
  });

  assert.ok(generated.appCode.includes('CRAFT_ROUTES'), 'Multi-page React project must emit CRAFT_ROUTES');
  assert.ok(generated.appCode.includes('handleNavigatePage'), 'Multi-page React project must emit handleNavigatePage');
  assert.ok(generated.customElementsCode.includes('goToPage("tab-about")'), 'Button onClick must emit goToPage("tab-about") handler');
  assert.ok(generated.customElementsCode.includes('Hakkımızda') || generated.customElementsCode.includes('/hakkimizda') || generated.appCode.includes('/hakkimizda'), 'Route metadata for second page must be emitted');
  assert.ok(generated.customElementsCode.includes('"alignItems":"center"'), 'Flex button style should keep alignItems center cleanly');

  ['mainJsx', 'appCode', 'customElementsCode'].forEach((key) => {
    assert.doesNotThrow(
      () => parseBabel(generated[key], { sourceType: 'module', plugins: ['jsx'] }),
      `${key} multi-page JSX must parse cleanly`
    );
  });

  assert.ok(generated.customElementsCode.includes('data-craft-route="/hakkimizda"') || generated.customElementsCode.includes('data-craft-route={"/hakkimizda"}'), 'CustomElementsSection must emit secondary page route');
  const html = buildStandaloneHtmlSite({
    projectName: 'Çok Sayfalı Site',
    tabs,
    activeTabId: 'tab-home',
  });
  assert.ok(html.includes('data-route="/hakkimizda"'), 'Standalone HTML must emit secondary page section');
  assert.ok(html.includes('toLowerCase()'), 'Standalone goToPage should match routes and page names case-insensitively');
  assert.ok(/text-align:\s*center/.test(html) && html.includes('text-align:inherit;') && html.includes('Hakkımıza Git'), 'Standalone HTML flex button label span must center-align cleanly and inherit responsive overrides');
});

test('export sanitizes tricky HTML/JSX attrs, escapes </script> in functions, preserves form inputs & emits responsive CSS rules', () => {
  const textareaNode = createTagElement('textarea', {
    x: 20,
    y: 20,
    width: 240,
    height: 80,
    textContent: 'Merhaba mesaj',
    attrs: { value: 'Merhaba mesaj', placeholder: 'Mesajınız' },
  });
  const checkboxNode = createTagElement('input', {
    x: 280,
    y: 20,
    width: 22,
    height: 22,
    attrs: { type: 'checkbox', checked: true },
  });
  const selectNode = createTagElement('select', {
    x: 20,
    y: 120,
    width: 240,
    height: 40,
    children: [
      createTagElement('option', { x: 0, y: 0, width: 200, height: 30, textContent: 'Seçenek A' }),
    ],
  });
  const trickySvg = createTagElement('svg', {
    x: 20,
    y: 180,
    width: 48,
    height: 48,
    attrs: {
      style: 'padding: 12px 16px; border-radius: 10px;',
      class: 'raw-icon',
      className: 'dup-icon',
      onclick: 'alert(1)',
      'stroke-width': '2',
      viewbox: '0 0 24 24',
    },
    customData: {
      responsive: {
        mobile: {
          opacity: 75,
          fillColor: '#f59e0b',
          borderRadius: 16,
        },
      },
    },
  });
  const actionBtn = createTagElement('button', {
    x: 20,
    y: 250,
    width: 160,
    height: 42,
    textContent: 'Aç',
    events: {
      onClick: { mode: 'open_url', url: 'https://example.com', newTab: true },
    },
  });
  const classBtn = createTagElement('button', {
    x: 200,
    y: 250,
    width: 160,
    height: 42,
    textContent: 'Sınıf',
    events: {
      onClick: { mode: 'add_class', targetElementId: trickySvg.id, className: 'is-active' },
    },
  });

  const functions = [
    {
      id: 'fn-1',
      name: 'Guvenli Fonksiyon',
      steps: [{ type: 'custom_code', code: 'const s = "</script><script>alert(1)</script>";' }],
    },
  ];
  const elements = [textareaNode, checkboxNode, selectNode, trickySvg, actionBtn, classBtn];
  const stage = { width: 1280, height: 800, backgroundColor: '#111113' };

  const jsx = renderAstElementToJsx(trickySvg, 0, { functions });
  assert.ok(!jsx.includes(' onclick='), 'Inline onclick HTML attribute must be stripped from JSX');
  assert.ok(jsx.includes('strokeWidth='), 'SVG stroke-width must convert to strokeWidth');
  assert.ok(jsx.includes('viewBox='), 'SVG viewbox must convert to viewBox');
  assert.equal((jsx.match(/\bclassName=/g) || []).length, 1, 'Duplicate class + className must collapse to one className');

  const checkboxJsx = renderAstElementToJsx(checkboxNode, 0, { functions });
  assert.ok(checkboxJsx.includes('defaultChecked'), 'input checked attribute must convert to defaultChecked in JSX');

  const generated = generateModularReactProject(elements, stage, null, {
    projectName: 'Sanitize Test',
    tabs: [{ id: 't1', name: 'Ana', route: '/', elements, canvasSettings: stage }],
    functions,
    activeTabId: 't1',
  });

  assert.doesNotThrow(
    () => parseBabel(generated.customElementsCode, { sourceType: 'module', plugins: ['jsx'] }),
    'Sanitized tricky attributes & events must parse cleanly in Babel JSX'
  );
  assert.ok(generated.customElementsCode.includes('defaultValue'), 'Form input/textarea value must use defaultValue in JSX');
  assert.ok(generated.customElementsCode.includes('addClass'), 'add_class action helper must be emitted in CustomElementsSection');

  const html = buildStandaloneHtmlSite({
    projectName: 'Sanitize Test',
    tabs: [{ id: 't1', name: 'Ana', route: '/', elements, canvasSettings: stage }],
    functions,
    activeTabId: 't1',
  });
  assert.ok(!html.includes('<textarea[^>]*><span>') && !html.includes('<span>Merhaba mesaj</span></textarea>'), 'Textarea content must be plain text, not wrapped in <span>');
  assert.ok(!html.includes('<span>Seçenek A</span></option>'), 'Option content must be plain text, not wrapped in <span>');
  assert.ok(!html.includes('alert(1)</script>";'), 'Raw </script> inside inline JSON/script must be escaped');
  assert.ok(html.includes('opacity: 0.75'), 'Responsive mobile opacity override must be emitted in standalone CSS');
  assert.ok(html.includes('border-radius: 16px'), 'Responsive mobile borderRadius override must be emitted in standalone CSS');
  assert.ok(html.includes('background-color: #f59e0b'), 'Responsive mobile fillColor override must be emitted in standalone CSS');
});

test('Canvas 1:1 Publish parity: strips position:relative, respects left text align, gradient override, stage min-height & product_card', () => {
  const demoClone = structuredClone(DEFAULT_UNIVERSAL_PROJECT);
  const hero = demoClone.find((n) => n.id === 'elem-hero');
  assert.ok(hero, 'Starter project should have elem-hero');
  hero.style = { ...(hero.style || {}), background: 'linear-gradient(90deg, #000000, #111111)' };
  hero.fillType = 'gradient';
  hero.gradient = { angle: 120, color1: '#ff0080', color2: '#7928ca' };

  const card1Title = flattenTree(demoClone).find((n) => n.id === 'elem-card-1-title');
  assert.ok(card1Title, 'Starter project should have elem-card-1-title');
  card1Title.textContent = '1:1 Özelleştirilmiş Başlık';

  const standaloneProduct = createTagElement('product_card', {
    x: 40,
    y: 2300,
    width: 320,
    height: 360,
    customData: {
      productName: 'Lüks Kolye',
      productDesc: '18K Altın kaplama',
      productPrice: '₺4.900',
      productTag: 'Yeni',
    },
  });
  const allEls = [...demoClone, standaloneProduct];
  const stage = { width: 1280, height: 1350, bgColor: '#faf7f2' };

  const reactProject = generateModularReactProject(allEls, stage, null, {
    projectName: 'Birebir Fidelity',
    tabs: [{ id: 'tab-1', name: 'Anasayfa', route: '/', elements: allEls, canvasSettings: stage }],
    activeTabId: 'tab-1',
  });

  // 1. Starter cards must NOT keep position:relative
  assert.ok(!reactProject.productsSectionCode.includes('"position":"relative"'), 'Published React cards must strip preset position:relative');
  assert.ok(!reactProject.heroCode.includes('"position":"relative"'), 'Published React hero must strip preset position:relative');
  assert.ok(reactProject.heroCode.includes('#ff0080') && reactProject.heroCode.includes('#7928ca'), 'Gradient fill must override stale style.background in JSX');
  assert.ok(reactProject.productsSectionCode.includes('1:1 Özelleştirilmiş Başlık'), 'User edits to starter card AST must propagate into ProductsSection.jsx');
  const heroTitleLine = reactProject.heroCode.split('\n').find((l) => l.includes('data-craft-id="elem-hero-title"'));
  assert.ok(heroTitleLine && heroTitleLine.includes('"textAlign":"left"'), 'Left-aligned Hero heading must emit textAlign:"left" on elem-hero-title');
  assert.ok(reactProject.customElementsCode.includes('Lüks Kolye'), 'Lone product_card must render structured product UI in JSX');

  ['appCode', 'navbarCode', 'heroCode', 'productsSectionCode', 'footerCode', 'customElementsCode'].forEach((k) => {
    assert.doesNotThrow(
      () => parseBabel(reactProject[k], { sourceType: 'module', plugins: ['jsx'] }),
      `${k} must parse cleanly in Babel`
    );
  });

  const html = reactProject.standaloneHtml;
  assert.ok(!html.includes('position:relative;top:') && !html.includes('id="elem-card-1" style="[^"]*position:relative'), 'Standalone cards must use position:absolute');
  assert.ok(!/data-craft-id="elem-card-1"[^>]*style="[^"]*position:relative/.test(html), 'elem-card-1 in HTML must not keep position:relative');
  assert.ok(!/data-craft-id="elem-hero-title"[^>]*style="[^"]*text-align:center/.test(html), 'elem-hero-title must remain left aligned');
  assert.ok(html.includes('#ff0080') && html.includes('#7928ca'), 'Gradient fill must override stale style.background in HTML');
  assert.ok(html.includes('<body style="margin:0;padding:0;background:#faf7f2;">'), 'Standalone HTML body must adopt stage background');
  assert.ok(html.includes('h1, h2, h3, h4, h5, h6, p') && html.includes('margin: 0; padding: 0;'), 'Standalone HTML must reset heading/paragraph default margins to match Canvas Tailwind Preflight');
  assert.ok(html.includes('min-height:2660px'), 'Stage min-height must expand to bottom-most element (2300+360=2660)');
  assert.ok(html.includes('Lüks Kolye') && html.includes('₺4.900'), 'Standalone HTML product_card must render product fields');
});

test('Responsive export fixes: overlaid mobile sliders, compact flat nav, aligned footer columns, zero dot Buton text & React file:// fallback', () => {
  const byKey = (k) => PRESET_ASSETS.find((a) => a.presetKey === k).element;
  const nav = clonePresetSubtree(byKey('nav-boutique-commerce'), { x: 0, y: 0 });
  const slider = clonePresetSubtree(byKey('slider-hero-showcase'), { x: 40, y: 92 });
  const faq = clonePresetSubtree(byKey('block-faq-accordion'), { x: 40, y: 560 });
  const footer = clonePresetSubtree(byKey('footer-newsletter-cta'), { x: 0, y: 1020 });
  const els = [nav, slider, faq, footer];

  const adaptedMob = ensureViewportAdapted(els, 'mobile', { forceReset: true }).tree;
  const resolvedMob = resolveTreeForViewport(adaptedMob, 'mobile');

  const mobNav = resolvedMob[0];
  assert.ok(mobNav.height <= 165, `Mobile boutique navbar must stay compact (got ${mobNav.height}px)`);

  const mobSlider = resolvedMob[1];
  const mobSlides = mobSlider.children.filter((c) => c.sliderRole === 'slide');
  const mobDots = mobSlider.children.filter((c) => c.sliderRole === 'dot');
  assert.ok(mobSlider.height < 950, `Mobile slider must overlay slides instead of stacking vertically (got ${mobSlider.height}px)`);
  mobSlides.forEach((s) => {
    assert.equal(s.x, 0, 'All mobile slides must stay anchored at x=0');
    assert.equal(s.y, 0, 'All mobile slides must stay overlaid at y=0');
  });
  mobDots.forEach((d) => {
    assert.equal(d.width, 10, `Slider dot width must stay 10px on mobile (got ${d.width})`);
  });

  const mobFooter = resolvedMob[3];
  const mobColHeading = mobFooter.children.find((c) => c.textContent === 'KOLEKSİYONLAR');
  assert.ok(mobColHeading && mobColHeading.x <= 24, `Stacked mobile footer column must align left at padX (got x=${mobColHeading?.x})`);

  const stage = { width: 1280, height: 1350, backgroundColor: '#09090b' };
  const reactOut = generateModularReactProject(els, stage, null, { projectName: 'Mobile Parity' });
  const htmlOut = buildStandaloneHtmlSite({ projectName: 'Mobile Parity', elements: els, canvasSettings: stage });

  assert.ok(reactOut.viteConfig.includes("base: './'"), 'Exported vite.config.js must set base: "./"');
  assert.ok(reactOut.indexCss.includes("font-family: 'Inter'"), 'Exported index.css must set Inter base font');
  assert.ok(reactOut.indexHtml.includes("location.protocol === 'file:'"), 'Vite index.html must redirect to live-preview.html if opened via file://');
  assert.ok(!htmlOut.includes('>Buton<'), 'Slider dot buttons must never inject Buton placeholder text in HTML');
  assert.ok(!reactOut.customElementsCode.includes('<span>Buton</span>'), 'Slider dot buttons must never inject Buton placeholder text in React');

  // Re-anchoring check: Cart button inside resized navbar (1280 -> 375) must keep 32% (120px) on mobile instead of desktop 9.375%
  const cartNode = nav.children.find((c) => c.textContent === 'Sepetim (2)');
  assert.ok(cartNode, 'Boutique nav must contain Sepetim (2) button');
  assert.ok(htmlOut.includes(`[data-craft-id="${cartNode.id}"]`) && htmlOut.includes('width: 32% !important'), 'Mobile CSS must re-anchor cart button width to 375px parent');
});

// -----------------------------------------------------------------------------
// 23. CODE FILE IMPORT (.html / .jsx), AI CREATIVITY & AURELIA LUXURY STARTER
// -----------------------------------------------------------------------------
console.log('\n💎 [23] Website Code Importer, AI Creativity & Luxury Starter');

test('importSiteCodeToProjectSchema parses raw HTML, React JSX, and multi-page exported HTML into editable CraftStudio projects', () => {
  const rawHtml = `<!DOCTYPE html>
  <html>
    <head>
      <title>Solstice Takı</title>
      <style>
        .hero-box { background-color: #161311; color: #f5efe6; border-radius: 20px; }
      </style>
    </head>
    <body style="background-color:#0b0a09;">
      <nav style="background:#12100e;color:#f5efe6;">
        <a href="#kolye">Koleksiyon</a>
        <button>Randevu</button>
      </nav>
      <section class="hero-box">
        <h1 style="font-size:48px;color:#d4af37;">El Yapımı Altın Koleksiyon</h1>
        <p>Sınırlı üretim 18K takılar.</p>
        <img src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800" alt="Altın" />
      </section>
      <footer><span>© 2026 Solstice</span></footer>
    </body>
  </html>`;

  const htmlSchema = importSiteCodeToProjectSchema(rawHtml, 'solstice.html');
  assert.equal(htmlSchema.name, 'Solstice Takı');
  assert.equal(htmlSchema.tabs.length, 1);
  const rootEls = htmlSchema.tabs[0].elements;
  assert.ok(rootEls.some((n) => n.type === 'nav'), 'Must import <nav> element');
  const heroSec = rootEls.find((n) => n.type === 'section');
  assert.ok(heroSec && heroSec.fillColor === '#161311', 'Must cascade CSS class rules into fillColor');
  assert.ok(flattenTree(rootEls).some((n) => n.type === 'h1' && n.textContent.includes('El Yapımı Altın')), 'Must extract h1 headline');
  assert.ok(flattenTree(rootEls).some((n) => n.type === 'img' && n.attrs?.src?.includes('unsplash')), 'Must preserve img src attribute');

  // Round-trip exported multi-page standalone HTML
  const exportedMulti = buildStandaloneHtmlSite({
    projectName: 'Multi Roundtrip',
    tabs: [
      { id: 't1', name: 'Anasayfa.craft', route: '/', elements: DEFAULT_UNIVERSAL_PROJECT, canvasSettings: { width: 1280, height: 1350, backgroundColor: '#0b0a09' } },
      { id: 't2', name: 'Hakkimizda.craft', route: '/hakkimizda', elements: [createTagElement('h2', { x: 80, y: 60, width: 600, height: 50, textContent: 'Atölye Tarihi' })], canvasSettings: { width: 1280, height: 900, backgroundColor: '#0b0a09' } },
    ],
  });
  const roundtripSchema = importSiteCodeToProjectSchema(exportedMulti, 'exported.html');
  assert.equal(roundtripSchema.tabs.length, 2, 'Multi-page standalone HTML export must round-trip all tabs');
  assert.equal(roundtripSchema.tabs[1].route, '/hakkimizda');

  // React JSX component file import
  const jsxCode = `
    import React from 'react';
    export default function LandingPage() {
      return (
        <section className="bg-[#12100e] rounded-2xl">
          <h1 className="text-4xl font-bold text-[#e5c465]">Atölye Modern</h1>
          <button>İncele</button>
        </section>
      );
    }
  `;
  const jsxSchema = importSiteCodeToProjectSchema(jsxCode, 'LandingPage.jsx');
  assert.equal(jsxSchema.name, 'LandingPage');
  assert.ok(flattenTree(jsxSchema.tabs[0].elements).some((n) => n.type === 'h1' && n.textContent === 'Atölye Modern'));
  assert.ok(flattenTree(jsxSchema.tabs[0].elements).some((n) => n.type === 'button' && n.textContent === 'İncele'));
});

test('AI prompt system enforces non-cliche creative art direction & higher creative temperatures', () => {
  assert.ok(resolveAiTemperature({ effectiveMode: 'full_site', isRedesign: false }) >= 0.8);
  assert.ok(resolveAiTemperature({ effectiveMode: 'full_site', isRedesign: true }) >= 0.9);
  assert.ok(resolveAiTemperature({ effectiveMode: 'selection', isRedesign: true }) >= 0.8);

  const prompt = buildAiSystemPrompt({
    effectiveMode: 'full_site',
    userPrompt: 'Lüks bir saat markası sitesi tasarla',
  });
  assert.ok(prompt.includes('SANAT YÖNETMENLİĞİ'), 'System prompt must embed creative art direction rules');
  assert.ok(prompt.includes('Playfair Display'), 'System prompt must instruct editorial serif + sans pairings');
  assert.ok(!DEFAULT_UNIVERSAL_PROJECT.find((n) => n.id === 'elem-badge')?.textContent?.includes('🚀'), 'Starter badge must be clean editorial copy without cliché emojis');
  assert.ok(flattenTree(DEFAULT_UNIVERSAL_PROJECT).some((n) => n.id === 'elem-hero-visual' && n.type === 'img'), 'Luxury starter must include hero editorial image');
});

// -----------------------------------------------------------------------------
// [16] CANVAS STUDIO TOOLBOX (Zoom Z, Shapes O/L/F, Eyedropper I, Format Painter, Z-Order, Alt-Measure)
// -----------------------------------------------------------------------------
console.log('\n🧰 [16] Canvas Studio Toolbox & Utility Helpers');

test('resolveSingleKeyToolShortcut maps Zoom (Z), Circle (O), Line (L), Frame (F), Eyedropper (I)', () => {
  assert.equal(resolveSingleKeyToolShortcut('z', {}), 'zoom');
  assert.equal(resolveSingleKeyToolShortcut('Z', {}), 'zoom');
  assert.equal(resolveSingleKeyToolShortcut('o', {}), 'circle');
  assert.equal(resolveSingleKeyToolShortcut('l', {}), 'line');
  assert.equal(resolveSingleKeyToolShortcut('f', {}), 'frame');
  assert.equal(resolveSingleKeyToolShortcut('i', {}), 'eyedropper');
  assert.equal(resolveSingleKeyToolShortcut('z', { isCtrlOrMeta: true }), null);
  assert.equal(resolveSingleKeyToolShortcut('i', { shiftKey: true }), null);
});

test('resolveDrawnBox resolves freeform drag, Shift-constrained square, snapped lines, and click defaults', () => {
  const rectDrag = resolveDrawnBox({ x: 100, y: 100 }, { x: 240, y: 180 });
  assert.deepEqual(rectDrag, { x: 100, y: 100, width: 140, height: 80, wasDrag: true, orientation: 'horizontal' });

  const shiftSquare = resolveDrawnBox({ x: 200, y: 200 }, { x: 140, y: 100 }, { shiftKey: true });
  assert.equal(shiftSquare.width, 100);
  assert.equal(shiftSquare.height, 100);
  assert.equal(shiftSquare.x, 100);
  assert.equal(shiftSquare.y, 100);

  const horizLine = resolveDrawnBox({ x: 50, y: 80 }, { x: 250, y: 92 }, { isLine: true });
  assert.deepEqual(horizLine, { x: 50, y: 80, width: 200, height: 2, wasDrag: true, orientation: 'horizontal' });

  const vertLine = resolveDrawnBox({ x: 50, y: 80 }, { x: 56, y: 210 }, { isLine: true });
  assert.deepEqual(vertLine, { x: 50, y: 80, width: 2, height: 130, wasDrag: true, orientation: 'vertical' });

  const singleClick = resolveDrawnBox({ x: 300, y: 200 }, { x: 301, y: 201 }, { defaultSize: { width: 140, height: 140 } });
  assert.deepEqual(singleClick, { x: 230, y: 130, width: 140, height: 140, wasDrag: false, orientation: 'horizontal' });
});

test('Format Painter extracts visual styles without leaking layout geometry and merges cleanly', () => {
  const source = {
    id: 'src',
    x: 40,
    y: 90,
    width: 300,
    height: 200,
    fillColor: '#0d99ff',
    borderRadius: 18,
    shadow: '0 8px 24px rgba(0,0,0,0.2)',
    style: { left: '40px', top: '90px', width: '300px', fontSize: '20px', color: '#ffffff' },
  };
  const extracted = extractPortableElementStyle(source);
  assert.equal(extracted.fillColor, '#0d99ff');
  assert.equal(extracted.borderRadius, 18);
  assert.equal(extracted.style.left, undefined);
  assert.equal(extracted.style.width, undefined);
  assert.equal(extracted.style.fontSize, '20px');

  const target = { id: 'dst', x: 500, y: 400, width: 120, height: 80, style: { padding: '8px', color: '#000000' } };
  const merged = mergePortableStyleOntoNode(target, extracted);
  assert.equal(merged.fillColor, '#0d99ff');
  assert.equal(merged.x, undefined);
  assert.equal(merged.style.padding, '8px');
  assert.equal(merged.style.color, '#ffffff');
});

test('computeElementZOrderUpdate adjusts sibling zIndex cleanly for front/forward/backward/back', () => {
  const els = [
    { id: 'a', zIndex: 1 },
    { id: 'b', zIndex: 2 },
    { id: 'c', zIndex: 3 },
  ];
  const fwd = computeElementZOrderUpdate(els, ['a'], 'forward');
  assert.equal(fwd.a.zIndex, 2);
  assert.equal(fwd.b.zIndex, 1);

  const front = computeElementZOrderUpdate(els, ['a'], 'front');
  assert.equal(front.a.zIndex, 3);
  assert.equal(front.b.zIndex, 1);
  assert.equal(front.c.zIndex, 2);

  const back = computeElementZOrderUpdate(els, ['c'], 'back');
  assert.equal(back.c.zIndex, 1);
  assert.equal(back.a.zIndex, 2);
});

test('computeAltMeasureGuides & Eyedropper contrast helpers calculate gaps and WCAG ratios accurately', () => {
  const src = { x: 100, y: 100, width: 100, height: 50 };
  const sibling = { x: 260, y: 110, width: 80, height: 40 };
  const siblingGuides = computeAltMeasureGuides(src, sibling, { x: 0, y: 0, width: 1280, height: 800 });
  assert.ok(siblingGuides.some((g) => g.axis === 'x' && g.gap === 60));

  const containerGuides = computeAltMeasureGuides(src, null, { x: 0, y: 0, width: 500, height: 300 });
  assert.ok(containerGuides.some((g) => g.axis === 'x' && g.gap === 100)); // left gap
  assert.ok(containerGuides.some((g) => g.axis === 'x' && g.gap === 300)); // right gap
  assert.ok(containerGuides.some((g) => g.axis === 'y' && g.gap === 100)); // top gap
  assert.ok(containerGuides.some((g) => g.axis === 'y' && g.gap === 150)); // bottom gap

  assert.equal(parseCssColorToHex('rgb(13, 153, 255)'), '#0D99FF');
  assert.equal(parseCssColorToHex('rgba(0, 0, 0, 0)'), null);
  assert.equal(computeContrastRatio('#000000', '#FFFFFF'), 21);
});

// -----------------------------------------------------------------------------
// [17] REFACTOR STAGE 2 UTILS (projectAssemblyUtils)
// -----------------------------------------------------------------------------
console.log('\n🧩 [17] Refactor Stage 2 Pure Utils');

test('buildTabState creates normalized tab with base canvas defaults and detects viewport overrides', () => {
  const emptyTab = buildTabState('tab-a', 'Anasayfa.craft');
  assert.equal(emptyTab.id, 'tab-a');
  assert.equal(emptyTab.name, 'Anasayfa.craft');
  assert.deepEqual(emptyTab.elements, []);
  assert.equal(emptyTab.canvasByViewport.desktop.width, 1280);
  assert.equal(emptyTab.canvasByViewport.tablet.width, 768);
  assert.equal(emptyTab.canvasByViewport.mobile.width, 375);
  assert.deepEqual(emptyTab.initializedViewports, { desktop: true, tablet: false, mobile: false });

  const singleCanvasTab = buildTabState('tab-b', 'Vitrin.craft', [
    { id: 'n1', type: 'div', responsive: { mobile: { width: 320 } } },
  ], { width: 1440, height: 1800, backgroundColor: '#0b0a09' });
  assert.equal(singleCanvasTab.canvasByViewport.desktop.width, 1440);
  assert.equal(singleCanvasTab.canvasByViewport.desktop.height, 1800);
  assert.equal(singleCanvasTab.canvasByViewport.desktop.backgroundColor, '#0b0a09');
  assert.deepEqual(singleCanvasTab.initializedViewports, { desktop: true, tablet: false, mobile: true });
});

test('buildTabState merges explicit per-viewport canvas overrides cleanly', () => {
  const perVpTab = buildTabState('tab-c', 'Ozel.craft', [
    { id: 'n2', type: 'section', children: [{ id: 'n3', type: 'p', responsive: { tablet: { x: 12 } } }] },
  ], {
    desktop: { width: 1280, height: 1500, backgroundColor: '#111111' },
    tablet: { height: 2100 },
    mobile: { backgroundColor: '#222222' },
  });
  assert.equal(perVpTab.canvasByViewport.desktop.height, 1500);
  assert.equal(perVpTab.canvasByViewport.tablet.width, 768);
  assert.equal(perVpTab.canvasByViewport.tablet.height, 2100);
  assert.equal(perVpTab.canvasByViewport.mobile.width, 375);
  assert.equal(perVpTab.canvasByViewport.mobile.backgroundColor, '#222222');
  assert.deepEqual(perVpTab.initializedViewports, { desktop: true, tablet: true, mobile: false });
});

test('sampleColorAtClientPoint safely returns null without DOM and samples background/text colors with DOM', () => {
  assert.equal(sampleColorAtClientPoint(100, 100), null);

  const prevDocDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const prevWinDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const prevGetStyleDesc = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');

  const cardNode = {
    _style: { backgroundColor: 'rgb(13, 153, 255)', color: 'rgb(255, 255, 255)' },
    closest: (sel) => (sel === '[data-element-id]' ? { getAttribute: () => 'elem-card-1' } : null),
  };
  const hudNode = {
    _style: { backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)' },
    closest: (sel) => (sel === '[data-eyedropper-hud]' ? {} : null),
  };
  const artboardEl = {
    _style: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)' },
    contains: (el) => el === cardNode || el === hudNode,
    closest: () => null,
  };

  try {
    const getComputedStyleStub = (el) => el._style || { backgroundColor: 'transparent', color: 'rgb(0, 0, 0)' };
    globalThis.getComputedStyle = getComputedStyleStub;
    globalThis.window = { getComputedStyle: getComputedStyleStub };
    globalThis.document = {
      getElementById: (id) => (id === 'artboard-canvas' ? artboardEl : null),
      elementsFromPoint: () => [hudNode, cardNode, artboardEl],
    };

    const bgSample = sampleColorAtClientPoint(42, 84, false);
    assert.equal(bgSample.hex, '#0D99FF');
    assert.equal(bgSample.targetNodeId, 'elem-card-1');
    assert.ok(bgSample.contrastWithBg > 1);

    const textSample = sampleColorAtClientPoint(42, 84, true);
    assert.equal(textSample.hex, '#FFFFFF');
    assert.equal(textSample.targetNodeId, 'elem-card-1');
    assert.ok(textSample.contrastWithBg > 2);

    globalThis.document.elementsFromPoint = () => [hudNode];
    const fallbackSample = sampleColorAtClientPoint(10, 10, false);
    assert.equal(fallbackSample.hex, '#FFFFFF');
    assert.equal(fallbackSample.targetNodeId, null);
  } finally {
    if (prevDocDesc) Object.defineProperty(globalThis, 'document', prevDocDesc);
    else delete globalThis.document;
    if (prevWinDesc) Object.defineProperty(globalThis, 'window', prevWinDesc);
    else delete globalThis.window;
    if (prevGetStyleDesc) Object.defineProperty(globalThis, 'getComputedStyle', prevGetStyleDesc);
    else delete globalThis.getComputedStyle;
  }
});

// -----------------------------------------------------------------------------
// 18. STUDIO MODES REGISTRY & BACKEND SCHEMA DEFAULTS
// -----------------------------------------------------------------------------
console.log('\n🎛️ [18] Studio Modes Registry & Backend Schema Defaults');

test('STUDIO_MODES defines design & backend modes with complete panel, tool, menu & layout schemas', () => {
  assert.equal(DEFAULT_STUDIO_MODE, 'design');
  assert.equal(STUDIO_MODE_LIST.length, 2);
  assert.equal(isValidStudioMode('design'), true);
  assert.equal(isValidStudioMode('backend'), true);
  assert.equal(isValidStudioMode('unknown'), false);
  assert.equal(getStudioModeConfig('invalid').id, 'design');

  const design = getStudioModeConfig('design');
  assert.equal(design.topBarConfig.showViewportSwitcher, true);
  assert.equal(design.topBarConfig.showPageTabsBar, true);
  assert.equal(design.centerView.supportsFloatingAiDock, true);
  assert.equal(design.menuPanels.length, 5);
  assert.equal(isToolSupportedInMode('design', 'select'), true);
  assert.equal(isToolSupportedInMode('design', 'rectangle'), true);
  assert.equal(isToolSupportedInMode('design', 'eyedropper'), true);

  const backend = getStudioModeConfig('backend');
  assert.equal(backend.topBarConfig.showViewportSwitcher, false);
  assert.equal(backend.topBarConfig.showPageTabsBar, false);
  assert.equal(backend.centerView.supportsFloatingAiDock, true);
  assert.equal(isToolSupportedInMode('backend', 'select'), true);
  assert.equal(isToolSupportedInMode('backend', 'hand'), true);
  assert.equal(isToolSupportedInMode('backend', 'rectangle'), false);
  assert.equal(isToolSupportedInMode('backend', 'eyedropper'), false);
});

test('projectStorage normalizes backend section with backward-compatible empty defaults and never persists activeMode', () => {
  assert.deepEqual(createDefaultProjectBackend(), {
    version: 1,
    flows: [],
    dataModels: [],
    triggers: [],
  });
  assert.deepEqual(normalizeProjectBackend(null), {
    version: 1,
    flows: [],
    dataModels: [],
    triggers: [],
  });

  // Legacy project without backend field
  const migratedLegacy = parseAndMigrateLoadedProject({
    id: 'proj-old',
    name: 'Eski Proje',
    elements: [],
  });
  assert.deepEqual(migratedLegacy.backend, {
    version: 1,
    flows: [],
    dataModels: [],
    triggers: [],
  });
  assert.equal('activeMode' in migratedLegacy, false);

  // Project with explicit backend section & projectFunctions preserved separately
  const customBackend = {
    version: 1,
    flows: [{ id: 'flow-1', name: 'Sipariş Gönder' }],
    dataModels: [{ id: 'model-1', name: 'Müşteriler' }],
    triggers: [{ id: 'trig-1', event: 'onClick', targetElementId: 'btn-1', flowId: 'flow-1' }],
  };
  const saved = buildSerializableProjectSchema({
    id: 'proj-new',
    name: 'Yeni Proje',
    projectFunctions: [{ id: 'fn-1', name: 'hesapla' }],
    backend: customBackend,
  });
  const roundTripped = parseAndMigrateLoadedProject(JSON.stringify(saved));
  assert.deepEqual(roundTripped.backend, customBackend);
  assert.equal(roundTripped.projectFunctions.length, 1);
  assert.equal('activeMode' in roundTripped, false);
});

test('useWorkspaceLayout isolates layoutsByMode per mode, drives menuPanels from registry, and resets to design', () => {
  let state = createInitialWorkspaceLayout();
  assert.equal(state.activeMode, 'design');
  assert.equal(state.layoutsByMode.design.leftDrawer.activeTab, null);
  assert.equal(state.layoutsByMode.backend.leftDrawer.activeTab, 'flows');

  // Verify registry-driven effectiveActivePanels & togglePanel in design mode match exact legacy keys
  assert.deepEqual(computeEffectiveActivePanels(state), {
    properties: true,
    assets: false,
    layers: false,
    aiAgent: true,
    attributesAndCss: false,
  });

  state = applyWorkspacePanelToggle(state, 'layers');
  assert.equal(state.layoutsByMode.design.leftDrawer.activeTab, 'layers');
  assert.equal(computeEffectiveActivePanels(state).layers, true);

  state = updateActiveModeRightDock(state, { isOpen: false, propertiesTab: 'css', width: 410 });
  assert.equal(state.layoutsByMode.design.rightDock.isOpen, false);
  assert.equal(state.layoutsByMode.design.rightDock.propertiesTab, 'css');
  assert.equal(state.layoutsByMode.design.rightDock.width, 410);
  // Backend layout remains untouched while editing design layout
  assert.equal(state.layoutsByMode.backend.leftDrawer.activeTab, 'flows');
  assert.equal(state.layoutsByMode.backend.rightDock.isOpen, true);
  assert.equal(state.layoutsByMode.backend.rightDock.propertiesTab, 'stepConfig');

  // Simulate open design modals, transient popover, activeTool='rectangle', editingGroupId='grp-1', selectedIds=['el-1']
  state = {
    ...state,
    activeTool: 'rectangle',
    openPopover: 'shapes',
    modals: {
      ...state.modals,
      addTag: true,
      attributesInspector: true,
      functionEditor: { isOpen: true, fnObj: { id: 'fn-1' }, bindTargetElementId: 'el-1' },
    },
  };
  let editingGroupId = 'grp-1';
  const selectedIds = ['el-1'];
  let activeTool = 'rectangle';
  let popoversClosed = false;

  // Invalid mode transition should be rejected
  const invalidRes = applyStudioModeTransition(state, 'nonexistent');
  assert.equal(invalidRes.changed, false);
  assert.equal(invalidRes.layout.activeMode, 'design');

  // Switch to backend mode
  const toBackend = applyStudioModeTransition(state, 'backend', {
    setEditingGroupId: (val) => { editingGroupId = val; },
    setActiveTool: (tool) => { activeTool = tool; },
    onClosePopovers: () => { popoversClosed = true; },
  });
  assert.equal(toBackend.changed, true);
  state = toBackend.layout;
  assert.equal(state.activeMode, 'backend');
  assert.equal(editingGroupId, null);
  assert.deepEqual(selectedIds, ['el-1']); // selectedIds preserved
  assert.equal(activeTool, 'select');
  assert.equal(state.activeTool, 'select');
  assert.equal(state.openPopover, null);
  assert.equal(popoversClosed, true);
  assert.equal(state.modals.addTag, false);
  assert.equal(state.modals.attributesInspector, false);
  assert.equal(state.modals.functionEditor.isOpen, false);

  // Modify backend layout & verify registry-driven backend menuPanels
  assert.deepEqual(computeEffectiveActivePanels(state), {
    backendInspector: true,
    flows: true,
    dataModels: false,
    aiAgent: true,
  });
  state = applyWorkspacePanelToggle(state, 'dataModels');
  assert.equal(state.layoutsByMode.backend.leftDrawer.activeTab, 'dataModels');
  assert.equal(computeEffectiveActivePanels(state).dataModels, true);
  // Design layout slice still remembers 'layers' & rightDock width 410
  assert.equal(state.layoutsByMode.design.leftDrawer.activeTab, 'layers');
  assert.equal(state.layoutsByMode.design.rightDock.isOpen, false);
  assert.equal(state.layoutsByMode.design.rightDock.width, 410);

  // Switch back to design mode -> remembers design layout slice
  state = applyStudioModeTransition(state, 'design').layout;
  assert.equal(state.activeMode, 'design');
  assert.equal(state.leftDrawer.activeTab, 'layers');
  assert.equal(state.rightDock.isOpen, false);
  assert.equal(state.rightDock.propertiesTab, 'css');
  assert.equal(state.rightDock.width, 410);

  // Switch to backend and call reset() -> returns activeMode to 'design' while preserving custom dock widths
  state = applyStudioModeTransition(state, 'backend').layout;
  assert.equal(state.activeMode, 'backend');
  state = applyWorkspaceLayoutReset(state, { showWelcomeScreen: false });
  assert.equal(state.activeMode, 'design');
  assert.equal(state.showWelcomeScreen, false);
  assert.equal(state.leftDrawer.activeTab, null);
  assert.equal(state.rightDock.isOpen, true);
  assert.equal(state.rightDock.propertiesTab, 'layout');
  assert.equal(state.rightDock.width, 410);
});

test('useProjectState & useProjectIO backend primitives update, persist across save/open/autosave/recents, default on legacy files, and clear on new project', () => {
  const memStore = (() => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  })();

  // 1. Update primitive merges partial or updater function and normalizes
  let backendState = createDefaultProjectBackend();
  backendState = applyProjectBackendUpdate(backendState, {
    flows: [{ id: 'flow-checkout', name: 'Ödeme Akışı', steps: ['validate', 'charge'] }],
  });
  backendState = applyProjectBackendUpdate(backendState, (prev) => ({
    ...prev,
    dataModels: [{ id: 'tbl-orders', name: 'Siparişler', fields: ['id', 'total'] }],
    triggers: [{ id: 'trig-pay', event: 'onClick', targetId: 'btn-pay', flowId: 'flow-checkout' }],
  }));
  assert.equal(backendState.flows.length, 1);
  assert.equal(backendState.dataModels.length, 1);
  assert.equal(backendState.triggers.length, 1);

  // 2. Save to web storage, autosave draft, and recent projects -> reopen and verify exact match
  const savedSchema = buildSerializableProjectSchema({
    id: 'proj-backend-full',
    name: 'Backend Test Projesi',
    backend: backendState,
  });
  saveProjectToWebStorage(savedSchema, memStore);
  saveAutosaveDraft(savedSchema, memStore);
  upsertRecentProject(savedSchema, memStore);

  const reopenedFromStorage = parseAndMigrateLoadedProject(loadProjectFromWebStorage('proj-backend-full', memStore));
  assert.deepEqual(reopenedFromStorage.backend, backendState);

  const reopenedFromAutosave = parseAndMigrateLoadedProject(loadAutosaveDraft(memStore));
  assert.deepEqual(reopenedFromAutosave.backend, backendState);

  const recentList = loadRecentProjects(memStore);
  assert.equal(recentList.length, 1);
  assert.deepEqual(recentList[0].snapshot.backend, backendState);

  // 3. Legacy file without backend field opens with clean empty default
  const legacyLoaded = parseAndMigrateLoadedProject({
    id: 'proj-legacy-no-backend',
    name: 'Eski Dosya',
    tabs: [{ id: 'tab-1', name: 'Anasayfa.craft', elements: [] }],
  });
  assert.deepEqual(legacyLoaded.backend, createDefaultProjectBackend());
  assert.deepEqual(resolveResetProjectBackend({ backend: legacyLoaded.backend }), createDefaultProjectBackend());

  // 4. Starting a new project resets backend state so old backend data never leaks
  const afterNewProjectReset = resolveResetProjectBackend({
    tabs: [{ id: 'tab-new', name: 'Yeni-Tasarim.craft', elements: [] }],
    projectFunctions: [],
    pageLinks: [],
  });
  assert.deepEqual(afterNewProjectReset, createDefaultProjectBackend());
});

test('useShortcuts mode profile table executes universal keys in both modes and restricts design shortcuts to design mode only', () => {
  const sampleTree = [{ id: 'el-1', type: 'rectangle', x: 100, y: 200, width: 120, height: 80 }];
  const makeContext = (activeMode, overrides = {}) => {
    const calls = [];
    const state = {
      activeMode,
      showWelcomeScreen: false,
      previewMode: false,
      activeTool: 'select',
      selectedIds: ['el-1'],
      elements: sampleTree,
      rawElements: sampleTree,
      viewportMode: 'desktop',
      showExportModal: false,
      showTutorial: false,
      showAddTagModal: false,
      showImportReportModal: false,
      showAttributesInspectorModal: false,
      functionEditorState: { isOpen: false },
      ...overrides,
    };
    const actions = {
      setAiDockMinimized: (v) => calls.push(['setAiDockMinimized', v]),
      setAiFocusSignal: () => calls.push(['setAiFocusSignal']),
      handleSaveProject: (saveAs) => calls.push(['handleSaveProject', saveAs]),
      handleOpenProjectFolder: () => calls.push(['handleOpenProjectFolder']),
      handleOpenProjectFile: () => calls.push(['handleOpenProjectFile']),
      setShowExportModal: (v) => calls.push(['setShowExportModal', v]),
      handleSelectAll: () => calls.push(['handleSelectAll']),
      handleCopyElementStyle: () => calls.push(['handleCopyElementStyle']),
      handleCopy: () => calls.push(['handleCopy']),
      handleCut: () => calls.push(['handleCut']),
      handlePasteElementStyle: () => calls.push(['handlePasteElementStyle']),
      handlePaste: () => calls.push(['handlePaste']),
      handleDuplicateSelected: () => calls.push(['handleDuplicateSelected']),
      handleToggleLockSelected: () => calls.push(['handleToggleLockSelected']),
      handleStartNewProject: (tpl) => calls.push(['handleStartNewProject', tpl]),
      handleAddTab: () => calls.push(['handleAddTab']),
      handleUngroupSelected: () => calls.push(['handleUngroupSelected']),
      handleGroupSelected: () => calls.push(['handleGroupSelected']),
      handleUndo: () => calls.push(['handleUndo']),
      handleRedo: () => calls.push(['handleRedo']),
      handleDeleteSelected: () => calls.push(['handleDeleteSelected']),
      updateElementsWithHistory: () => calls.push(['updateElementsWithHistory']),
      handleTogglePreviewMode: (v) => calls.push(['handleTogglePreviewMode', v]),
      setActiveTool: (t) => calls.push(['setActiveTool', t]),
      handleSelectParent: () => calls.push(['handleSelectParent']),
      handleSelectChild: () => calls.push(['handleSelectChild']),
      setZoom: () => calls.push(['setZoom']),
      handleResetZoom: () => calls.push(['handleResetZoom']),
      handleZOrderSelected: (dir) => calls.push(['handleZOrderSelected', dir]),
      setShowLayoutGrid: () => calls.push(['setShowLayoutGrid']),
      setShowRulers: () => calls.push(['setShowRulers']),
    };
    return { state, actions, calls };
  };

  // Profile Table: { label, event, stateOverrides, expectedDesign, expectedBackend, expectedBackendCalls }
  const profileTable = [
    // Universal shortcuts (design + backend)
    { label: 'Ctrl+K', event: { key: 'k', ctrlKey: true }, expectedDesign: 'ai_dock_focus', expectedBackend: 'ai_dock_focus', expectedBackendCalls: 2 },
    { label: 'Ctrl+S', event: { key: 's', ctrlKey: true }, expectedDesign: 'save', expectedBackend: 'save', expectedBackendCalls: 1 },
    { label: 'Ctrl+Shift+S', event: { key: 's', ctrlKey: true, shiftKey: true }, expectedDesign: 'save_as', expectedBackend: 'save_as', expectedBackendCalls: 1 },
    { label: 'Ctrl+O', event: { key: 'o', ctrlKey: true }, expectedDesign: 'open_file', expectedBackend: 'open_file', expectedBackendCalls: 1 },
    { label: 'Ctrl+Shift+O', event: { key: 'o', ctrlKey: true, shiftKey: true }, expectedDesign: 'open_folder', expectedBackend: 'open_folder', expectedBackendCalls: 1 },
    { label: 'Ctrl+E', event: { key: 'e', ctrlKey: true }, expectedDesign: 'export_modal', expectedBackend: 'export_modal', expectedBackendCalls: 1 },
    { label: 'Escape (previewMode)', event: { key: 'Escape' }, stateOverrides: { previewMode: true }, expectedDesign: 'escape_preview', expectedBackend: 'escape_preview', expectedBackendCalls: 1 },
    { label: 'Escape (hand -> select)', event: { key: 'Escape' }, stateOverrides: { activeTool: 'hand' }, expectedDesign: 'escape_tool', expectedBackend: 'escape_tool', expectedBackendCalls: 1 },
    { label: 'Escape (select -> parent only in design)', event: { key: 'Escape' }, expectedDesign: 'escape_parent', expectedBackend: 'escape_noop', expectedBackendCalls: 0 },

    // Design-only shortcuts (must return null & invoke 0 callbacks in backend mode)
    { label: 'Ctrl+A', event: { key: 'a', ctrlKey: true }, expectedDesign: 'select_all', expectedBackend: null },
    { label: 'Ctrl+C', event: { key: 'c', ctrlKey: true }, expectedDesign: 'copy', expectedBackend: null },
    { label: 'Ctrl+Shift+C', event: { key: 'c', ctrlKey: true, shiftKey: true }, expectedDesign: 'copy_style', expectedBackend: null },
    { label: 'Ctrl+X', event: { key: 'x', ctrlKey: true }, expectedDesign: 'cut', expectedBackend: null },
    { label: 'Ctrl+V', event: { key: 'v', ctrlKey: true }, expectedDesign: 'paste', expectedBackend: null },
    { label: 'Ctrl+Shift+V', event: { key: 'v', ctrlKey: true, shiftKey: true }, expectedDesign: 'paste_style', expectedBackend: null },
    { label: 'Ctrl+D', event: { key: 'd', ctrlKey: true }, expectedDesign: 'duplicate', expectedBackend: null },
    { label: 'Ctrl+Shift+L', event: { key: 'l', ctrlKey: true, shiftKey: true }, expectedDesign: 'toggle_lock', expectedBackend: null },
    { label: 'Ctrl+Shift+N', event: { key: 'n', ctrlKey: true, shiftKey: true }, expectedDesign: 'new_blank_project', expectedBackend: null },
    { label: 'Ctrl+N', event: { key: 'n', ctrlKey: true }, expectedDesign: 'add_tab', expectedBackend: null },
    { label: 'Ctrl+G', event: { key: 'g', ctrlKey: true }, expectedDesign: 'group', expectedBackend: null },
    { label: 'Ctrl+Shift+G', event: { key: 'g', ctrlKey: true, shiftKey: true }, expectedDesign: 'ungroup', expectedBackend: null },
    { label: 'Ctrl+Z', event: { key: 'z', ctrlKey: true }, expectedDesign: 'undo', expectedBackend: null },
    { label: 'Ctrl+Shift+Z', event: { key: 'z', ctrlKey: true, shiftKey: true }, expectedDesign: 'redo', expectedBackend: null },
    { label: 'Ctrl+Y', event: { key: 'y', ctrlKey: true }, expectedDesign: 'redo', expectedBackend: null },
    { label: 'Delete', event: { key: 'Delete' }, expectedDesign: 'delete', expectedBackend: null },
    { label: 'Backspace', event: { key: 'Backspace' }, expectedDesign: 'delete', expectedBackend: null },
    { label: 'ArrowUp', event: { key: 'ArrowUp' }, expectedDesign: 'nudge', expectedBackend: null },
    { label: 'ArrowDown', event: { key: 'ArrowDown' }, expectedDesign: 'nudge', expectedBackend: null },
    { label: 'ArrowLeft', event: { key: 'ArrowLeft' }, expectedDesign: 'nudge', expectedBackend: null },
    { label: 'ArrowRight', event: { key: 'ArrowRight' }, expectedDesign: 'nudge', expectedBackend: null },
    { label: 'Shift+ArrowRight', event: { key: 'ArrowRight', shiftKey: true }, expectedDesign: 'nudge', expectedBackend: null },
    { label: 'Enter', event: { key: 'Enter' }, expectedDesign: 'select_child', expectedBackend: null },
    { label: 'Ctrl+=', event: { key: '=', ctrlKey: true }, expectedDesign: 'zoom_in', expectedBackend: null },
    { label: 'Ctrl++', event: { key: '+', ctrlKey: true }, expectedDesign: 'zoom_in', expectedBackend: null },
    { label: 'Ctrl+-', event: { key: '-', ctrlKey: true }, expectedDesign: 'zoom_out', expectedBackend: null },
    { label: 'Ctrl+0', event: { key: '0', ctrlKey: true }, expectedDesign: 'zoom_reset', expectedBackend: null },
    { label: ']', event: { key: ']', code: 'BracketRight' }, expectedDesign: 'z_order_forward', expectedBackend: null },
    { label: 'Ctrl+]', event: { key: ']', code: 'BracketRight', ctrlKey: true }, expectedDesign: 'z_order_front', expectedBackend: null },
    { label: '[', event: { key: '[', code: 'BracketLeft' }, expectedDesign: 'z_order_backward', expectedBackend: null },
    { label: 'Ctrl+[', event: { key: '[', code: 'BracketLeft', ctrlKey: true }, expectedDesign: 'z_order_back', expectedBackend: null },
    { label: 'Shift+G', event: { key: 'G', shiftKey: true }, expectedDesign: 'toggle_grid', expectedBackend: null },
    { label: 'Shift+R', event: { key: 'R', shiftKey: true }, expectedDesign: 'toggle_rulers', expectedBackend: null },
    { label: 'V', event: { key: 'v' }, expectedDesign: 'tool:select', expectedBackend: null },
    { label: 'H', event: { key: 'h' }, expectedDesign: 'tool:hand', expectedBackend: null },
    { label: 'Z', event: { key: 'z' }, expectedDesign: 'tool:zoom', expectedBackend: null },
    { label: 'R', event: { key: 'r' }, expectedDesign: 'tool:rectangle', expectedBackend: null },
    { label: 'O', event: { key: 'o' }, expectedDesign: 'tool:circle', expectedBackend: null },
    { label: 'L', event: { key: 'l' }, expectedDesign: 'tool:line', expectedBackend: null },
    { label: 'F', event: { key: 'f' }, expectedDesign: 'tool:frame', expectedBackend: null },
    { label: 'T', event: { key: 't' }, expectedDesign: 'tool:text', expectedBackend: null },
    { label: 'I', event: { key: 'i' }, expectedDesign: 'tool:eyedropper', expectedBackend: null },
  ];

  for (const row of profileTable) {
    const designCtx = makeContext('design', row.stateOverrides);
    const designResult = dispatchStudioShortcut(
      { ...row.event, preventDefault: () => {} },
      { activeMode: 'design', state: designCtx.state, actions: designCtx.actions, activeElement: null }
    );
    assert.equal(
      designResult,
      row.expectedDesign,
      `[design] ${row.label} expected "${row.expectedDesign}", got "${designResult}"`
    );
    assert.ok(designCtx.calls.length >= 1, `[design] ${row.label} should invoke at least 1 action callback`);

    const backendCtx = makeContext('backend', row.stateOverrides);
    const backendResult = dispatchStudioShortcut(
      { ...row.event, preventDefault: () => {} },
      { activeMode: 'backend', state: backendCtx.state, actions: backendCtx.actions, activeElement: null }
    );
    assert.equal(
      backendResult,
      row.expectedBackend,
      `[backend] ${row.label} expected "${row.expectedBackend}", got "${backendResult}"`
    );
    const expectedCalls = row.expectedBackendCalls ?? 0;
    assert.equal(
      backendCtx.calls.length,
      expectedCalls,
      `[backend] ${row.label} expected ${expectedCalls} action calls, got ${backendCtx.calls.length}: ${JSON.stringify(backendCtx.calls)}`
    );
  }
});

test('leftDrawer.width state and computeLeftOccupiedWidth pass exact pixel widths per mode and replace the 292/340 estimate', () => {
  let state = createInitialWorkspaceLayout();
  assert.equal(state.layoutsByMode.design.leftDrawer.width, 248);
  assert.equal(state.layoutsByMode.backend.leftDrawer.width, 256);

  // Closed left drawer occupies only the 52px tool rail
  assert.equal(
    computeLeftOccupiedWidth({ previewMode: false, leftSidebarTab: null, leftSidebarWidth: 248 }),
    52
  );
  // Open 'layers' at default 248px occupies 52 + 248 = 300px (no longer the hard-coded 292 estimate)
  assert.equal(
    computeLeftOccupiedWidth({ previewMode: false, leftSidebarTab: 'layers', leftSidebarWidth: 248 }),
    300
  );
  // Open 'ai' enforces minimum 296px drawer width -> 52 + 296 = 348px (or larger if resized > 296)
  assert.equal(
    computeLeftOccupiedWidth({ previewMode: false, leftSidebarTab: 'ai', leftSidebarWidth: 248 }),
    348
  );
  assert.equal(
    computeLeftOccupiedWidth({ previewMode: false, leftSidebarTab: 'ai', leftSidebarWidth: 360 }),
    412
  );
  // Preview mode occupies 0px
  assert.equal(
    computeLeftOccupiedWidth({ previewMode: true, leftSidebarTab: 'layers', leftSidebarWidth: 360 }),
    0
  );

  // Resize design left drawer and clamp within [220, 440]
  state = updateActiveModeLeftDrawerWidth(state, 340);
  assert.equal(state.leftDrawer.width, 340);
  assert.equal(state.layoutsByMode.design.leftDrawer.width, 340);
  assert.equal(state.layoutsByMode.backend.leftDrawer.width, 256);
  assert.equal(
    computeLeftOccupiedWidth({
      previewMode: false,
      leftSidebarTab: 'layers',
      leftSidebarWidth: state.leftDrawer.width,
    }),
    392
  );

  state = updateActiveModeLeftDrawerWidth(state, 999);
  assert.equal(state.leftDrawer.width, 440);
  state = updateActiveModeLeftDrawerWidth(state, 100);
  assert.equal(state.leftDrawer.width, 220);
  assert.equal(clampLeftDrawerWidth(180), 220);
  assert.equal(resolveEffectiveLeftDrawerWidth('ai', 220), 296);

  // Reset preserves custom leftDrawer.width per mode just like rightDock.width
  state = updateActiveModeLeftDrawerWidth(state, 328);
  state = applyWorkspaceLayoutReset(state, { showWelcomeScreen: false });
  assert.equal(state.layoutsByMode.design.leftDrawer.width, 328);
});

test('useShortcuts keeps canvas shortcuts and Escape active when floating CSS inspector (showAttributesInspectorModal) is open', () => {
  const sampleTree = [{ id: 'el-1', type: 'rectangle', x: 100, y: 200, width: 120, height: 80 }];
  const calls = [];
  const state = {
    activeMode: 'design',
    showWelcomeScreen: false,
    previewMode: false,
    activeTool: 'select',
    selectedIds: ['el-1'],
    elements: sampleTree,
    rawElements: sampleTree,
    viewportMode: 'desktop',
    showExportModal: false,
    showTutorial: false,
    showAddTagModal: false,
    showImportReportModal: false,
    showAttributesInspectorModal: true, // Floating CSS window is OPEN
    functionEditorState: { isOpen: false },
  };
  const actions = {
    setActiveTool: (t) => calls.push(['setActiveTool', t]),
    handleDeleteSelected: () => calls.push(['handleDeleteSelected']),
    handleUndo: () => calls.push(['handleUndo']),
    handleSelectParent: () => calls.push(['handleSelectParent']),
  };

  assert.equal(
    dispatchStudioShortcut({ key: 'r', preventDefault: () => {} }, { state, actions, activeElement: null }),
    'tool:rectangle'
  );
  assert.equal(
    dispatchStudioShortcut({ key: 'Delete', preventDefault: () => {} }, { state, actions, activeElement: null }),
    'delete'
  );
  assert.equal(
    dispatchStudioShortcut({ key: 'z', ctrlKey: true, preventDefault: () => {} }, { state, actions, activeElement: null }),
    'undo'
  );
  assert.equal(
    dispatchStudioShortcut({ key: 'Escape', preventDefault: () => {} }, { state, actions, activeElement: null }),
    'escape_parent'
  );
  assert.equal(calls.length, 4);

  // When an input inside the floating CSS window is focused, global canvas shortcuts remain safely blocked
  assert.equal(
    dispatchStudioShortcut(
      { key: 'r', preventDefault: () => {} },
      { state, actions, activeElement: { tagName: 'INPUT', isContentEditable: false } }
    ),
    null
  );

  // When a non-input element (e.g., button) inside the floating CSS window is focused:
  // Delete, Backspace, Arrow keys, Ctrl+D, and Ctrl+X must NOT reach the canvas,
  // while Ctrl+Z/Y and tool keys (V/R) continue to work.
  const floatingBtnFocus = {
    tagName: 'BUTTON',
    isContentEditable: false,
    closest: (sel) => (sel.includes('data-floating-css-inspector') ? {} : null),
  };
  const focusCalls = [];
  const focusActions = {
    ...actions,
    handleDeleteSelected: () => focusCalls.push('delete'),
    handleDuplicateSelected: () => focusCalls.push('duplicate'),
    handleCut: () => focusCalls.push('cut'),
    updateElementsWithHistory: () => focusCalls.push('nudge'),
    handleUndo: () => focusCalls.push('undo'),
    handleRedo: () => focusCalls.push('redo'),
    setActiveTool: (t) => focusCalls.push(`tool:${t}`),
  };
  for (const blockedEvt of [
    { key: 'Delete' },
    { key: 'Backspace' },
    { key: 'ArrowRight' },
    { key: 'ArrowDown' },
    { key: 'd', ctrlKey: true },
    { key: 'x', ctrlKey: true },
  ]) {
    assert.equal(
      dispatchStudioShortcut(
        { ...blockedEvt, preventDefault: () => {} },
        { state, actions: focusActions, activeElement: floatingBtnFocus }
      ),
      null
    );
  }
  assert.deepEqual(focusCalls, []);

  assert.equal(
    dispatchStudioShortcut(
      { key: 'z', ctrlKey: true, preventDefault: () => {} },
      { state, actions: focusActions, activeElement: floatingBtnFocus }
    ),
    'undo'
  );
  assert.equal(
    dispatchStudioShortcut(
      { key: 'y', ctrlKey: true, preventDefault: () => {} },
      { state, actions: focusActions, activeElement: floatingBtnFocus }
    ),
    'redo'
  );
  assert.equal(
    dispatchStudioShortcut(
      { key: 'r', preventDefault: () => {} },
      { state, actions: focusActions, activeElement: floatingBtnFocus }
    ),
    'tool:rectangle'
  );
  assert.deepEqual(focusCalls, ['undo', 'redo', 'tool:rectangle']);
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
