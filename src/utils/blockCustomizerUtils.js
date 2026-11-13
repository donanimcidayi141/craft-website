import {
  getNodePath,
  flattenTree,
  clonePresetSubtree,
} from './treeUtils.js';

export const BLOCK_THEME_PRESETS = [
  {
    id: 'midnight',
    label: 'Gece Koyu',
    shortLabel: 'Koyu',
    previewBg: '#09090b',
    previewAccent: '#0d99ff',
    containerBg: 'rgba(12, 12, 15, 0.94)',
    cardBg: '#18181c',
    inputBg: '#101013',
    borderColor: '#27272d',
    headingColor: '#fafafa',
    mutedColor: '#a1a1aa',
    linkColor: '#d4d4d8',
    hoverColor: '#38bdf8',
    ctaBg: '#0d99ff',
    ctaColor: '#ffffff',
  },
  {
    id: 'light',
    label: 'Minimal Açık',
    shortLabel: 'Açık',
    previewBg: '#ffffff',
    previewAccent: '#09090b',
    containerBg: '#ffffff',
    cardBg: '#f8fafc',
    inputBg: '#f4f4f5',
    borderColor: '#e4e4e7',
    headingColor: '#09090b',
    mutedColor: '#52525b',
    linkColor: '#3f3f46',
    hoverColor: '#0d99ff',
    ctaBg: '#09090b',
    ctaColor: '#ffffff',
  },
  {
    id: 'ocean',
    label: 'Okyanus',
    shortLabel: 'Okyanus',
    previewBg: '#0f172a',
    previewAccent: '#38bdf8',
    containerBg: 'linear-gradient(135deg, #0f172a 0%, #172554 100%)',
    cardBg: 'rgba(15, 23, 42, 0.78)',
    inputBg: '#0f172a',
    borderColor: '#1e3a8a',
    headingColor: '#f8fafc',
    mutedColor: '#cbd5e1',
    linkColor: '#e2e8f0',
    hoverColor: '#38bdf8',
    ctaBg: '#2563eb',
    ctaColor: '#ffffff',
  },
  {
    id: 'boutique',
    label: 'Altın Butik',
    shortLabel: 'Butik',
    previewBg: '#121014',
    previewAccent: '#fbbf24',
    containerBg: '#121014',
    cardBg: '#1b171d',
    inputBg: '#141016',
    borderColor: '#3a2f3b',
    headingColor: '#fef3c7',
    mutedColor: '#d6d3d1',
    linkColor: '#e4e4e7',
    hoverColor: '#fbbf24',
    ctaBg: '#fbbf24',
    ctaColor: '#18130c',
  },
  {
    id: 'glass',
    label: 'Cam / Glass',
    shortLabel: 'Cam',
    previewBg: '#18181b',
    previewAccent: '#6366f1',
    containerBg: 'rgba(20, 20, 27, 0.78)',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    inputBg: 'rgba(15, 23, 42, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    headingColor: '#ffffff',
    mutedColor: '#cbd5e1',
    linkColor: '#e4e4e7',
    hoverColor: '#818cf8',
    ctaBg: '#6366f1',
    ctaColor: '#ffffff',
    backdropFilter: 'blur(14px)',
  },
];

/**
 * Classifies an AST node into a contextual block kind when applicable.
 */
export function detectBlockKind(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.sliderConfig && typeof node.sliderConfig === 'object') return 'slider';
  if (node.blockKind === 'navbar' || node.blockKind === 'footer' || node.blockKind === 'slider' || node.blockKind === 'section') {
    return node.blockKind;
  }

  const tag = String(node.type || '').toLowerCase();
  const name = String(node.name || '').toLowerCase();

  if (['nav', 'navbar', 'header'].includes(tag) || name.includes('navbar') || name.includes('üst menü')) {
    return 'navbar';
  }
  if (tag === 'footer' || name.includes('footer') || name.includes('alt bilgi')) {
    return 'footer';
  }
  if (
    Array.isArray(node.children) &&
    node.children.length >= 2 &&
    ['section', 'div', 'article', 'main', 'aside'].includes(tag)
  ) {
    return 'section';
  }
  return null;
}

/**
 * Resolves the active block root for either a selected block or a child inside one.
 */
export function findOwningBlock(elements, selectedId) {
  if (!Array.isArray(elements) || !selectedId) return null;
  const path = getNodePath(elements, selectedId);
  if (!Array.isArray(path) || path.length === 0) return null;

  const selected = path[path.length - 1];
  const directKind = detectBlockKind(selected);
  if (directKind === 'slider' || directKind === 'navbar' || directKind === 'footer') {
    return { blockNode: selected, blockKind: directKind, isAncestor: false };
  }

  // Prefer enclosing semantic block (navbar / footer / slider) when editing any child inside it
  for (let i = path.length - 2; i >= 0; i -= 1) {
    const k = detectBlockKind(path[i]);
    if (k === 'slider' || k === 'navbar' || k === 'footer') {
      return { blockNode: path[i], blockKind: k, isAncestor: true };
    }
  }

  if (directKind === 'section') {
    return { blockNode: selected, blockKind: 'section', isAncestor: false };
  }

  for (let i = path.length - 2; i >= 0; i -= 1) {
    const k = detectBlockKind(path[i]);
    if (k === 'section') {
      return { blockNode: path[i], blockKind: 'section', isAncestor: true };
    }
  }

  return null;
}

function isBrandCandidate(node, blockKind) {
  if (!node) return false;
  const id = String(node.id || '').toLowerCase();
  const name = String(node.name || '').toLowerCase();
  if (id.includes('brand') || id.includes('logo-text') || name.includes('marka')) return true;
  if (blockKind === 'navbar' && (Number(node.x) || 0) <= 220 && ['a', 'span', 'h2', 'h3', 'p'].includes((node.type || '').toLowerCase())) {
    const fs = parseInt(node.style?.fontSize || '14', 10);
    if (fs >= 15 || Number(node.style?.fontWeight) >= 700) return true;
  }
  return false;
}

/**
 * Extracts a flat, friendly inspector model from any nested block AST subtree.
 */
export function extractBlockInspectorModel(blockNode) {
  const blockKind = detectBlockKind(blockNode) || 'section';
  const flatChildren = flattenTree(blockNode?.children || []);

  let brandNode = null;
  const linkNodes = [];
  const ctaNodes = [];
  const textNodes = [];
  const inputNodes = [];
  const imageNodes = [];
  const slides = [];

  if (blockKind === 'slider' && Array.isArray(blockNode?.children)) {
    const slideNodes = blockNode.children.filter((c) => c.sliderRole === 'slide');
    slideNodes.forEach((slide, idx) => {
      const slideFlat = flattenTree(slide.children || []);
      const titleNode = slideFlat.find((n) => ['h1', 'h2', 'h3', 'h4'].includes((n.type || '').toLowerCase()))
        || slideFlat.find((n) => (n.textContent || n.content) && (n.type || '').toLowerCase() !== 'button');
      const descNode = slideFlat.find((n) => n.id !== titleNode?.id && ['p', 'span'].includes((n.type || '').toLowerCase()) && (n.textContent || '').length > 10);
      const ctaNode = slideFlat.find((n) => (n.type || '').toLowerCase() === 'button');
      const imgNode = slideFlat.find((n) => (n.type || '').toLowerCase() === 'img');
      const usedTextIds = new Set([titleNode?.id, descNode?.id].filter(Boolean));
      const extraTexts = slideFlat
        .filter((n) => !usedTextIds.has(n.id) && (n.textContent || n.content) && !['button', 'img', 'input', 'textarea', 'select'].includes((n.type || '').toLowerCase()))
        .map((n) => ({
          id: n.id,
          name: n.name || (n.type || 'metin').toUpperCase(),
          tag: (n.type || 'div').toLowerCase(),
          text: n.textContent || n.content || '',
        }));
      const extraImages = slideFlat
        .filter((n) => n.id !== imgNode?.id && (n.type || '').toLowerCase() === 'img')
        .map((n) => ({
          id: n.id,
          name: n.name || 'Görsel',
          src: n.attrs?.src || n.imageUrl || '',
        }));
      slides.push({
        id: slide.id,
        index: idx,
        slideIndex: typeof slide.slideIndex === 'number' ? slide.slideIndex : idx,
        name: slide.name || `Slayt ${idx + 1}`,
        bg: slide.style?.background || slide.style?.backgroundColor || '#18181b',
        titleNode: titleNode ? { id: titleNode.id, text: titleNode.textContent || titleNode.content || '' } : null,
        descNode: descNode ? { id: descNode.id, text: descNode.textContent || descNode.content || '' } : null,
        ctaNode: ctaNode ? { id: ctaNode.id, text: ctaNode.textContent || ctaNode.content || '' } : null,
        imgNode: imgNode ? { id: imgNode.id, src: imgNode.attrs?.src || imgNode.imageUrl || '' } : null,
        extraTexts,
        extraImages,
      });
    });
  }

  for (const child of flatChildren) {
    if (child.sliderRole || child.accordionRole === 'indicator') continue;
    const tag = String(child.type || 'div').toLowerCase();
    const text = child.textContent || child.content || '';

    if (tag === 'img') {
      imageNodes.push({
        id: child.id,
        name: child.name || 'Görsel',
        src: child.attrs?.src || child.imageUrl || '',
        alt: child.attrs?.alt || '',
      });
      continue;
    }

    if (['input', 'textarea'].includes(tag)) {
      inputNodes.push({
        id: child.id,
        tag,
        name: child.name || (tag === 'textarea' ? 'Metin Alanı' : 'Giriş Alanı'),
        inputType: child.attrs?.type || 'text',
        placeholder: child.attrs?.placeholder || '',
        value: child.attrs?.value || '',
      });
      continue;
    }

    if (!brandNode && (blockKind === 'navbar' || blockKind === 'footer') && isBrandCandidate(child, blockKind)) {
      brandNode = {
        id: child.id,
        name: child.name || 'Marka',
        text,
        color: child.style?.color || '#ffffff',
        href: child.attrs?.href || '#',
        type: tag,
      };
      continue;
    }

    if (tag === 'button') {
      ctaNodes.push({
        id: child.id,
        name: child.name || 'Buton',
        text,
        bg: child.style?.backgroundColor || child.style?.background || '#0d99ff',
        color: child.style?.color || '#ffffff',
      });
      continue;
    }

    if (tag === 'a') {
      linkNodes.push({
        id: child.id,
        name: child.name || text || 'Link',
        text,
        href: child.attrs?.href || '#',
        color: child.style?.color || '#d4d4d8',
      });
      continue;
    }

    if (text && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'blockquote'].includes(tag)) {
      textNodes.push({
        id: child.id,
        tag,
        name: child.name || tag.toUpperCase(),
        text,
        color: child.style?.color || '',
      });
    }
  }

  return {
    blockId: blockNode?.id,
    blockName: blockNode?.name || 'Bileşen',
    blockKind,
    theme: {
      background: blockNode?.style?.background || blockNode?.style?.backgroundColor || '#141417',
      height: Number(blockNode?.height) || 72,
      width: Number(blockNode?.width) || 1280,
      sticky: blockNode?.positionMode === 'sticky',
      borderRadius: blockNode?.style?.borderRadius || '0px',
    },
    brandNode,
    linkNodes,
    ctaNodes,
    textNodes: textNodes.slice(0, 12),
    inputNodes,
    imageNodes,
    slides,
    activeSlideIndex: Number(blockNode?.sliderConfig?.activeSlideIndex) || 0,
  };
}

/**
 * Applies a curated color & contrast theme cohesively across a block subtree.
 */
export function applyBlockThemePreset(blockNode, presetId) {
  const preset = BLOCK_THEME_PRESETS.find((p) => p.id === presetId);
  if (!blockNode || !preset) return blockNode;

  const blockKind = detectBlockKind(blockNode);
  const rethemeChild = (child) => {
    const tag = String(child.type || 'div').toLowerCase();
    const nextStyle = { ...(child.style || {}) };
    const nextAnim = child.animation ? { ...child.animation } : undefined;
    const isSlide = child.sliderRole === 'slide';
    const isDivider = tag === 'div' && ((Number(child.height) || 999) <= 4 || (Number(child.width) || 999) <= 4);
    const isSmallBadge = (Number(child.width) || 999) <= 52 && (Number(child.height) || 999) <= 52;
    const isCard =
      !isSlide &&
      !isDivider &&
      !isSmallBadge &&
      ['div', 'article', 'section', 'aside', 'details'].includes(tag) &&
      Boolean(child.style?.backgroundColor || child.style?.background || child.style?.border);

    let nextFillType = child.fillType;
    let nextFillColor = child.fillColor;

    if (isSlide) {
      if (preset.containerBg.includes('gradient')) {
        nextStyle.background = preset.containerBg;
        delete nextStyle.backgroundColor;
      } else {
        delete nextStyle.background;
        nextStyle.backgroundColor = preset.containerBg;
        if (nextFillType === 'gradient') nextFillType = 'solid';
        if (nextFillColor !== undefined) nextFillColor = preset.containerBg;
      }
      nextStyle.border = `1px solid ${preset.borderColor}`;
    } else if (isDivider) {
      nextStyle.backgroundColor = preset.borderColor;
    } else if (tag === 'button' && !child.sliderRole) {
      delete nextStyle.background;
      nextStyle.backgroundColor = preset.ctaBg;
      nextStyle.color = preset.ctaColor;
      if (nextFillType === 'gradient') nextFillType = 'solid';
      if (nextFillColor !== undefined) nextFillColor = preset.ctaBg;
    } else if (tag === 'a') {
      nextStyle.color = isBrandCandidate(child, blockKind) ? preset.headingColor : preset.linkColor;
      if (nextAnim) nextAnim.hoverLineColor = preset.hoverColor;
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'summary'].includes(tag)) {
      nextStyle.color = preset.headingColor;
    } else if (['p', 'span', 'label', 'li'].includes(tag)) {
      if (child.accordionRole === 'indicator') {
        nextStyle.color = preset.hoverColor;
        nextStyle.border = `1px solid ${preset.borderColor}`;
      } else {
        nextStyle.color = isBrandCandidate(child, blockKind) ? preset.headingColor : preset.mutedColor;
        if (tag === 'span' && typeof child.style?.backgroundColor === 'string' && /^#[0-3]/.test(child.style.backgroundColor)) {
          nextStyle.backgroundColor = preset.cardBg;
          if (child.style?.border) nextStyle.border = `1px solid ${preset.borderColor}`;
        }
      }
    } else if (['input', 'textarea', 'select'].includes(tag)) {
      delete nextStyle.background;
      nextStyle.backgroundColor = preset.inputBg;
      nextStyle.color = preset.headingColor;
      nextStyle.border = `1px solid ${preset.borderColor}`;
      if (nextFillColor !== undefined) nextFillColor = preset.inputBg;
    } else if (isCard) {
      delete nextStyle.background;
      nextStyle.backgroundColor = preset.cardBg;
      nextStyle.border = `1px solid ${preset.borderColor}`;
      if (nextFillType === 'gradient') nextFillType = 'solid';
      if (nextFillColor !== undefined) nextFillColor = preset.cardBg;
    }

    return {
      ...child,
      ...(nextFillType !== child.fillType ? { fillType: nextFillType } : {}),
      ...(nextFillColor !== child.fillColor ? { fillColor: nextFillColor } : {}),
      style: nextStyle,
      ...(nextAnim ? { animation: nextAnim } : {}),
      children: Array.isArray(child.children) ? child.children.map(rethemeChild) : [],
    };
  };

  const rootStyle = { ...(blockNode.style || {}) };
  let rootFillType = blockNode.fillType;
  let rootFillColor = blockNode.fillColor;
  if (preset.containerBg.includes('gradient')) {
    rootStyle.background = preset.containerBg;
    delete rootStyle.backgroundColor;
  } else {
    delete rootStyle.background;
    rootStyle.backgroundColor = preset.containerBg;
    if (rootFillType === 'gradient') rootFillType = 'solid';
    if (rootFillColor !== undefined) rootFillColor = preset.containerBg;
  }
  rootStyle.border = `1px solid ${preset.borderColor}`;
  if (preset.backdropFilter) rootStyle.backdropFilter = preset.backdropFilter;
  else delete rootStyle.backdropFilter;

  return {
    ...blockNode,
    ...(rootFillType !== blockNode.fillType ? { fillType: rootFillType } : {}),
    ...(rootFillColor !== blockNode.fillColor ? { fillColor: rootFillColor } : {}),
    style: rootStyle,
    children: Array.isArray(blockNode.children) ? blockNode.children.map(rethemeChild) : [],
  };
}

/**
 * Adds a new navigation link inside a Navbar container positioned neatly after existing links.
 */
export function addNavbarLinkItem(navNode, label = 'Yeni Sayfa', href = '#yeni') {
  if (!navNode) return navNode;
  const children = Array.isArray(navNode.children) ? [...navNode.children] : [];
  const existingLinks = children.filter((c) => {
    const tag = String(c.type || '').toLowerCase();
    return tag === 'a' && !isBrandCandidate(c, 'navbar');
  });

  const reference = existingLinks[existingLinks.length - 1];
  const sampleStyle = reference?.style || {
    color: '#d4d4d8',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
  };
  const navW = Number(navNode.width) || 1280;
  const navH = Number(navNode.height) || 72;
  const rightCtas = children.filter((c) => String(c.type || '').toLowerCase() === 'button');
  const maxRightEdge = rightCtas.length > 0
    ? Math.min(...rightCtas.map((b) => Number(b.x) || navW)) - 14
    : navW - 24;

  const newWidth = Math.max(76, Math.min(130, label.length * 9 + 24));
  const preferredX = reference
    ? (Number(reference.x) || 400) + (Number(reference.width) || 90) + 12
    : Math.round(navW * 0.35);
  const clampedX = Math.max(200, Math.min(maxRightEdge - newWidth, preferredX));
  const y = reference ? Number(reference.y) : Math.max(8, Math.round((navH - 32) / 2));

  const newLink = {
    id: `nav-link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'a',
    name: label,
    x: clampedX,
    y,
    width: newWidth,
    height: reference ? Number(reference.height) : 32,
    textContent: label,
    attrs: { href },
    style: { ...sampleStyle },
    animation: reference?.animation ? { ...reference.animation } : {
      hoverClassName: 'hover-underline-left',
      hoverLineColor: '#38bdf8',
      hoverLineHeight: 2,
      hoverLineDuration: 0.25,
    },
    children: [],
  };

  // Insert right before first CTA button if present so DOM/layer order matches left-to-right layout
  const firstBtnIdx = children.findIndex((c) => String(c.type || '').toLowerCase() === 'button');
  if (firstBtnIdx >= 0) {
    children.splice(firstBtnIdx, 0, newLink);
  } else {
    children.push(newLink);
  }

  return { ...navNode, children };
}

/**
 * Removes any descendant node cleanly from a block subtree by ID.
 */
export function removeBlockChildById(blockNode, targetId) {
  if (!blockNode || !targetId) return blockNode;
  const filterTree = (list = []) =>
    list
      .filter((item) => item.id !== targetId)
      .map((item) => ({
        ...item,
        children: Array.isArray(item.children) ? filterTree(item.children) : [],
      }));

  return {
    ...blockNode,
    children: filterTree(blockNode.children || []),
  };
}

const isSlideNode = (c) => c?.sliderRole === 'slide';
const isDotNode = (c) => c?.sliderRole === 'dot' || c?.events?.onClick?.mode === 'slider_goto';

function normalizeSliderDots(dots = [], sliderId) {
  return dots.map((dot, idx) => ({
    ...dot,
    name: `Nokta ${idx + 1}`,
    sliderRole: 'dot',
    slideIndex: idx,
    sliderTargetId: sliderId,
    events: {
      ...(dot.events || {}),
      onClick: {
        ...(dot.events?.onClick || {}),
        mode: 'slider_goto',
        targetElementId: sliderId,
        slideIndex: idx,
      },
    },
  }));
}

/**
 * Appends a cloned customizable slide + synced pagination dot onto any interactive Slider block.
 */
export function addSliderSlideItem(sliderNode) {
  if (!sliderNode || !sliderNode.sliderConfig || !Array.isArray(sliderNode.children)) return sliderNode;
  const slides = sliderNode.children.filter(isSlideNode);
  if (slides.length === 0) return sliderNode;

  const templateSlide = slides[slides.length - 1];
  const newSlideIdx = slides.length;
  const newSlide = clonePresetSubtree(templateSlide);
  newSlide.name = `Slayt ${newSlideIdx + 1}`;
  newSlide.sliderRole = 'slide';
  newSlide.slideIndex = newSlideIdx;
  newSlide.style = { ...(newSlide.style || {}) };

  const nextSlides = [...slides, newSlide].map((slide, idx) => ({
    ...slide,
    sliderRole: 'slide',
    slideIndex: idx,
  }));

  const dots = sliderNode.children.filter(isDotNode);
  const rawNextDots = [...dots];
  if (dots.length > 0) {
    const lastDot = dots[dots.length - 1];
    const dotStep = dots.length >= 2
      ? Math.max(12, (Number(lastDot.x) || 0) - (Number(dots[dots.length - 2].x) || 0))
      : (Number(lastDot.width) || 10) + 8;
    const newDot = clonePresetSubtree(lastDot, {
      x: (Number(lastDot.x) || 0) + dotStep,
      y: Number(lastDot.y) || 0,
    });
    rawNextDots.push(newDot);
  }
  const nextDots = normalizeSliderDots(rawNextDots, sliderNode.id);
  const others = sliderNode.children.filter((c) => !isSlideNode(c) && !isDotNode(c));

  return {
    ...sliderNode,
    sliderConfig: {
      ...sliderNode.sliderConfig,
      totalSlides: nextSlides.length,
      slideIds: nextSlides.map((s) => s.id),
      activeSlideIndex: newSlideIdx,
    },
    children: [...nextSlides, ...others, ...nextDots],
  };
}

/**
 * Removes a slide from an interactive Slider block while keeping at least 1 slide intact.
 */
export function removeSliderSlideItem(sliderNode, slideId) {
  if (!sliderNode || !sliderNode.sliderConfig || !Array.isArray(sliderNode.children)) return sliderNode;
  const slides = sliderNode.children.filter(isSlideNode);
  if (slides.length <= 1) return sliderNode;

  const removedIdx = slides.findIndex((s) => s.id === slideId);
  const nextSlides = slides
    .filter((s) => s.id !== slideId)
    .map((slide, idx) => ({
      ...slide,
      sliderRole: 'slide',
      slideIndex: idx,
    }));

  const dots = sliderNode.children.filter(isDotNode);
  const nextDots = normalizeSliderDots(dots.slice(0, nextSlides.length), sliderNode.id);
  const others = sliderNode.children.filter((c) => !isSlideNode(c) && !isDotNode(c));

  const curActive = Number(sliderNode.sliderConfig.activeSlideIndex) || 0;
  const nextActive = removedIdx >= 0 && removedIdx < curActive
    ? Math.max(0, curActive - 1)
    : Math.min(curActive, nextSlides.length - 1);

  return {
    ...sliderNode,
    sliderConfig: {
      ...sliderNode.sliderConfig,
      totalSlides: nextSlides.length,
      slideIds: nextSlides.map((s) => s.id),
      activeSlideIndex: nextActive,
    },
    children: [...nextSlides, ...others, ...nextDots],
  };
}
