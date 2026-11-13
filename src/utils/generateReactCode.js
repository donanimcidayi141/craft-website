import { isVoidTag } from '../data/tagRegistry.js';
import { flattenTree } from './treeUtils.js';
import {
  buildReactOnClickExpression,
  getEffectiveFunctionCode,
  sanitizeFunctionIdentifier,
} from './interactionEngine.js';

/**
 * Produces a safe URL / filesystem slug for project folders and npm package names.
 */
export function slugifyProjectFolderName(name = 'yayinlanan-react-site') {
  const trMap = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  const replaced = String(name || '')
    .split('')
    .map((ch) => trMap[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return replaced || 'yayinlanan-react-site';
}

// HTML to JSX Attribute Name Mapping
export const HTML_TO_JSX_ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
  allowfullscreen: 'allowFullScreen',
  frameborder: 'frameBorder',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
};

export function convertHtmlAttrToJsx(attrName) {
  if (!attrName) return '';
  const lower = String(attrName).toLowerCase();
  return HTML_TO_JSX_ATTR_MAP[lower] || attrName;
}

function camelToKebabCase(str) {
  return String(str).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function buildResponsiveCssRules(flatList) {
  const tabletRules = [];
  const mobileRules = [];

  const pushRulesForVp = (node, vp, targetArr) => {
    const ov = node.responsive?.[vp];
    if (!ov || Object.keys(ov).length === 0) return;

    const decls = [];
    if (ov.isHidden === true) {
      decls.push('display: none !important;');
    } else if (ov.isHidden === false && node.isHidden) {
      decls.push('display: flex !important;');
    }

    if (ov.opacity !== undefined) decls.push(`opacity: ${(Number(ov.opacity) / 100).toFixed(2)} !important;`);
    if (ov.zIndex !== undefined) decls.push(`z-index: ${ov.zIndex} !important;`);
    if (ov.fillColor !== undefined) decls.push(`background-color: ${ov.fillColor} !important;`);
    if (ov.borderRadius !== undefined) decls.push(`border-radius: ${ov.borderRadius}px !important;`);

    if (ov.style && typeof ov.style === 'object') {
      for (const [k, v] of Object.entries(ov.style)) {
        if (v !== null && v !== undefined && v !== '') {
          decls.push(`${camelToKebabCase(k)}: ${v} !important;`);
        }
      }
    }

    if (decls.length > 0) {
      targetArr.push(`  [data-craft-id="${node.id}"] {\n    ${decls.join('\n    ')}\n  }`);
    }
  };

  for (const node of flatList || []) {
    pushRulesForVp(node, 'tablet', tabletRules);
    pushRulesForVp(node, 'mobile', mobileRules);
  }

  let css = '';
  if (tabletRules.length > 0) {
    css += `\n/* Responsive Tablet Overrides (<= 1023px) */\n@media (max-width: 1023px) {\n${tabletRules.join('\n')}\n}\n`;
  }
  if (mobileRules.length > 0) {
    css += `\n/* Responsive Mobile Overrides (<= 639px) */\n@media (max-width: 639px) {\n${mobileRules.join('\n')}\n}\n`;
  }
  return css;
}

function buildExportedRuntimeScript(projectFunctions = []) {
  const fnDefs = (projectFunctions || [])
    .map((fnObj) => {
      const safeName = sanitizeFunctionIdentifier(fnObj?.name);
      const params = (fnObj?.params || '').trim();
      const bodyCode = getEffectiveFunctionCode(fnObj) || '// boş';
      const indentedBody = bodyCode
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');
      return `  function ${safeName}(${params}) {\n${indentedBody}\n  }`;
    })
    .join('\n\n');

  return `  const findDomEl = (ref) => {
    const clean = String(ref || '').replace(/^#/, '').trim();
    if (!clean || typeof document === 'undefined') return null;
    return (
      document.getElementById(clean) ||
      document.querySelector(\`[data-craft-node="\${clean}"]\`) ||
      document.querySelector(\`[data-craft-id="\${clean}"]\`)
    );
  };
  const getValue = (ref) => {
    const target = findDomEl(ref);
    if (!target) return '';
    if ('value' in target && target.value !== undefined) return target.value;
    return target.textContent || '';
  };
  const setValue = (ref, val) => {
    const target = findDomEl(ref);
    if (target && 'value' in target) target.value = String(val ?? '');
  };
  const setText = (ref, txt) => {
    const target = findDomEl(ref);
    if (target) target.textContent = String(txt ?? '');
  };
  const setStyle = (ref, stylePatch) => {
    const target = findDomEl(ref);
    if (target && stylePatch && typeof stylePatch === 'object') {
      Object.assign(target.style, stylePatch);
    }
  };
  const show = (ref) => {
    const target = findDomEl(ref);
    if (target) target.style.display = '';
  };
  const hide = (ref) => {
    const target = findDomEl(ref);
    if (target) target.style.display = 'none';
  };
  const toggleVisible = (ref) => {
    const target = findDomEl(ref);
    if (target) target.style.display = target.style.display === 'none' ? '' : 'none';
  };
  const scrollToElement = (ref) => {
    const target = findDomEl(ref);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };
  const goToPage = (routeOrId) => {
    const clean = String(routeOrId || '');
    if (clean.startsWith('#')) return scrollToElement(clean);
    notify(\`Sayfa yönlendirmesi: \${clean}\`);
  };
  const switchSlider = (sliderRef, action = 'next', targetIdx = 0) => {
    const root = findDomEl(sliderRef);
    if (!root) return;
    const slides = Array.from(root.querySelectorAll('[data-craft-slide-index]'));
    const total = Math.max(1, slides.length);
    const cur = Number(root.getAttribute('data-craft-active-slide') || 0);
    let next = 0;
    if (action === 'prev') next = (cur - 1 + total) % total;
    else if (action === 'goto') next = ((Number(targetIdx) || 0) % total + total) % total;
    else next = (cur + 1) % total;
    root.setAttribute('data-craft-active-slide', String(next));
    slides.forEach((slideEl) => {
      if (!slideEl.dataset.craftOrigDisplay) {
        slideEl.dataset.craftOrigDisplay = slideEl.style.display && slideEl.style.display !== 'none' ? slideEl.style.display : 'flex';
      }
      const sIdx = Number(slideEl.getAttribute('data-craft-slide-index') || 0);
      slideEl.style.display = sIdx === next ? slideEl.dataset.craftOrigDisplay : 'none';
    });
    const dots = Array.from(root.querySelectorAll('[data-craft-slider-dot]'));
    dots.forEach((dotEl) => {
      const dIdx = Number(dotEl.getAttribute('data-craft-slider-dot') || 0);
      dotEl.style.opacity = dIdx === next ? '1' : '0.45';
      dotEl.style.transform = dIdx === next ? 'scale(1.22)' : 'scale(1)';
    });
  };
  const notify = (msg) => {
    const text = String(msg ?? '');
    if (typeof onNotify === 'function') onNotify(text);
    else if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text);
  };
  const alert = notify;
${fnDefs ? `\n${fnDefs}` : ''}`;
}

/**
 * Serializes an AST element into pure JSX with className, htmlFor, style object, etc.
 */
export function renderAstElementToJsx(el, indent = '      ', options = {}) {
  if (!el) return '';
  const { projectFunctions = [], tabs = [], includeNodeDataId = false, preserveCanvasCoords = false, parentSliderActiveIdx = null } = options || {};
  const rawTag = (el.type || 'div').toLowerCase();
  const tag = rawTag === 'text' ? 'span' : rawTag;
  const isVoid = isVoidTag(tag);

  // Convert attributes
  const jsxAttrParts = [];
  const attrs = { ...(el.attrs || {}) };
  if (el.id && ((el.responsive && (el.responsive.tablet || el.responsive.mobile)) || preserveCanvasCoords || el.sliderConfig)) {
    attrs['data-craft-id'] = el.id;
  }
  if (includeNodeDataId && el.id && !attrs.id && !attrs['data-craft-id']) {
    attrs['data-craft-node'] = el.id;
  }
  const ownSliderIdx = el.sliderConfig ? Number(el.sliderConfig.activeSlideIndex || 0) : null;
  if (ownSliderIdx !== null) {
    attrs['data-craft-slider-root'] = el.id;
    attrs['data-craft-active-slide'] = String(ownSliderIdx);
  }
  if (el.sliderRole === 'slide') {
    attrs['data-craft-slide-index'] = String(el.slideIndex || 0);
  }
  if (el.sliderRole === 'dot') {
    attrs['data-craft-slider-dot'] = String(el.slideIndex || 0);
  }

  // Append animation classes if present
  if (el.animation?.className || el.animation?.hoverClassName) {
    const animCls = [el.animation?.className, el.animation?.hoverClassName].filter(Boolean).join(' ');
    attrs.class = attrs.class ? `${attrs.class} ${animCls}` : animCls;
  }

  Object.entries(attrs).forEach(([key, val]) => {
    if (val === undefined || val === null || val === false || val === '') return;
    const jsxKey = convertHtmlAttrToJsx(key);
    if (val === true) {
      jsxAttrParts.push(jsxKey);
    } else {
      jsxAttrParts.push(`${jsxKey}="${String(val).replace(/"/g, '&quot;')}"`);
    }
  });

  // Handle style & underline CSS custom properties
  const styleObj = { ...(el.style || {}) };
  if (preserveCanvasCoords) {
    if (!styleObj.position) {
      styleObj.position = el.positionMode === 'sticky' ? 'sticky' : 'absolute';
      if (el.positionMode === 'sticky' && styleObj.top === undefined) styleObj.top = '0px';
    }
    if (typeof el.x === 'number' && styleObj.left === undefined) styleObj.left = `${el.x}px`;
    if (typeof el.y === 'number' && el.positionMode !== 'sticky' && styleObj.top === undefined) styleObj.top = `${el.y}px`;
    if (typeof el.width === 'number' && styleObj.width === undefined) styleObj.width = `${el.width}px`;
    if (typeof el.height === 'number' && styleObj.height === undefined) styleObj.height = `${el.height}px`;
    if (typeof el.zIndex === 'number' && styleObj.zIndex === undefined) styleObj.zIndex = el.zIndex;
    if (el.opacity !== undefined && el.opacity !== 100 && styleObj.opacity === undefined) {
      styleObj.opacity = Number(el.opacity) / 100;
    }
    if (el.fillType === 'gradient' && el.gradient && !styleObj.background) {
      styleObj.background = `linear-gradient(${el.gradient.angle || 90}deg, ${el.gradient.color1 || '#d4af37'}, ${el.gradient.color2 || '#2c2523'})`;
    }
    if (el.borderRadiusType === 'custom' && el.borderRadiusCorners && !styleObj.borderRadius) {
      const { tl = 0, tr = 0, br = 0, bl = 0 } = el.borderRadiusCorners;
      styleObj.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    }
    if (el.shadow && el.shadow !== 'none' && !styleObj.boxShadow) {
      styleObj.boxShadow = el.shadow;
    }
    if (el.textColor && !styleObj.color) styleObj.color = el.textColor;
    if (el.fontSize && !styleObj.fontSize) styleObj.fontSize = `${el.fontSize}px`;
    if (el.fontWeight && !styleObj.fontWeight) styleObj.fontWeight = el.fontWeight;
    if (el.textAlign && !styleObj.textAlign) styleObj.textAlign = el.textAlign;
    styleObj.boxSizing = styleObj.boxSizing || 'border-box';
  }
  if (el.fillColor && el.fillColor !== 'transparent' && !styleObj.background && !styleObj.backgroundColor) {
    styleObj.backgroundColor = el.fillColor;
  }
  if (el.borderWidth > 0 && !styleObj.border) {
    styleObj.border = `${el.borderWidth}px solid ${el.borderColor || '#cbd5e1'}`;
  }
  if (el.borderRadius > 0 && !styleObj.borderRadius) {
    styleObj.borderRadius = `${el.borderRadius}px`;
  }
  if (el.animation?.hoverLineColor) styleObj['--craft-line-color'] = el.animation.hoverLineColor;
  if (el.animation?.hoverLineHeight) styleObj['--craft-line-height'] = `${el.animation.hoverLineHeight}px`;
  if (el.animation?.hoverLineDuration) styleObj['--craft-line-duration'] = `${el.animation.hoverLineDuration}s`;
  if (el.sliderRole === 'slide' && parentSliderActiveIdx !== null && Number(el.slideIndex || 0) !== Number(parentSliderActiveIdx)) {
    styleObj.display = 'none';
  }
  if (el.sliderRole === 'dot' && parentSliderActiveIdx !== null) {
    const isActiveDot = Number(el.slideIndex || 0) === Number(parentSliderActiveIdx);
    styleObj.opacity = isActiveDot ? 1 : 0.45;
    if (isActiveDot) styleObj.transform = 'scale(1.22)';
  }

  let styleProp = '';
  if (Object.keys(styleObj).length > 0) {
    styleProp = ` style={${JSON.stringify(styleObj)}}`;
  }

  const onClickExpr = buildReactOnClickExpression(el.events?.onClick, projectFunctions, tabs);
  const onClickProp = onClickExpr ? ` onClick={${onClickExpr}}` : '';

  const attrsStr = jsxAttrParts.length > 0 ? ` ${jsxAttrParts.join(' ')}` : '';

  if (isVoid) {
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp} />`;
  }

  const text = el.textContent || el.content || '';
  const hasChildren = Array.isArray(el.children) && el.children.length > 0;
  const childOptions = ownSliderIdx !== null ? { ...options, parentSliderActiveIdx: ownSliderIdx } : options;

  if (hasChildren) {
    const childrenJsx = el.children.map(child => renderAstElementToJsx(child, indent + '  ', childOptions)).join('\n');
    const textPart = text ? `${indent}  ${text}\n` : '';
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>\n${textPart}${childrenJsx}\n${indent}</${tag}>`;
  }

  if (text.includes('\n') || text.length > 40) {
    return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>\n${indent}  ${text}\n${indent}</${tag}>`;
  }

  return `${indent}<${tag}${attrsStr}${styleProp}${onClickProp}>${text}</${tag}>`;
}

// Generates a fully modular, responsive, Flexbox & Grid based universal React project
export function generateModularReactProject(
  elements = [],
  canvasSettings = {},
  canvasByViewport = null,
  projectContext = {}
) {
  const { projectFunctions = [], tabs = [], projectName = 'CraftStudio Projesi', folderSlug, activeTabId } = projectContext || {};
  const resolvedSlug = slugifyProjectFolderName(folderSlug || projectName || 'yayinlanan-react-site');
  // Flatten tree to find standard elements across any depth
  const flatElements = flattenTree(elements);

  // Extract navbar elements & texts dynamically from OOP AST
  const navEl = flatElements.find(el => el.type === 'nav' || el.type === 'navbar');
  const logoTextEl = flatElements.find(el => el.id === 'elem-nav-logo-text');
  const logoText = logoTextEl?.textContent || logoTextEl?.content || navEl?.logoText || 'CRAFT • STUDIO';

  const navLinkNodes = flatElements.filter(el => el.id && el.id.startsWith('elem-nav-link-'));
  const navLinks = navLinkNodes.length > 0
    ? navLinkNodes.map(el => el.textContent || el.content || '').filter(Boolean)
    : (navEl?.navLinks || ['Özellikler', 'Çözümler', 'Şablonlar', 'Fiyatlandırma', 'İletişim']);

  const navCtaEl = flatElements.find(el => el.id === 'elem-nav-cta-btn');
  const navCtaText = navCtaEl?.textContent || navCtaEl?.content || '';

  // Extract hero elements & texts dynamically
  const badgeEl = flatElements.find(el => el.id === 'elem-badge' || el.type === 'badge');
  const badgeText = badgeEl?.textContent || badgeEl?.content || '🚀 Yeni Nesil Web Tasarımcısı v2.0';

  const titleEl = flatElements.find(el => el.id === 'elem-hero-title' || el.type === 'h1' || (el.type === 'text' && el.fontSize >= 32));
  const titleText = titleEl?.textContent || titleEl?.content || 'Hayalinizdeki Web Sitesini Özgürce Tasarlayın';

  const descEl = flatElements.find(el => el.id === 'elem-hero-desc' || el.type === 'p');
  const descText = descEl?.textContent || descEl?.content || 'Görsel düzenleme kolaylığı, canlı HTML/CSS senkronizasyonu ve tek tıkla modüler React çıktısı ile projelerinizi dakikalar içinde hayata geçirin.';

  const ctaEl = flatElements.find(el => el.id === 'elem-hero-btn' || el.type === 'button');
  const heroCtaText = ctaEl?.textContent || ctaEl?.content || 'Hemen Başlayın 🚀';

  const extLinkEl = flatElements.find(el => el.id === 'elem-google-link');
  const extLinkText = extLinkEl?.textContent || extLinkEl?.content || "Google'a Git ↗";
  const extLinkHref = extLinkEl?.attrs?.href || 'https://www.google.com';

  // Extract features elements & texts dynamically
  const secTitleEl = flatElements.find(el => el.id === 'elem-sec-title' || el.type === 'h2');
  const secTitleText = secTitleEl?.textContent || secTitleEl?.content || '⚡ Neden CraftStudio?';

  const secDescEl = flatElements.find(el => el.id === 'elem-sec-desc');
  const secDescText = secDescEl?.textContent || secDescEl?.content || 'Görsel düzenleme kolaylığı ve modüler React bileşenleriyle modern web siteleri tasarlayın.';

  // Extract Card elements (elem-card-1, elem-card-2, elem-card-3 or any article)
  const cardIds = ['elem-card-1', 'elem-card-2', 'elem-card-3'];
  const cardContainers = cardIds.map(id => flatElements.find(el => el.id === id)).filter(Boolean);
  const cardEls = cardContainers.length > 0 
    ? cardContainers 
    : flatElements.filter(el => el.type === 'article' || el.type === 'product_card');

  const defaultCards = [
    {
      id: 'f1',
      name: 'Veriye Dayalı HTML5 AST',
      desc: 'Bileşenler gerçek HTML5 etiketleriyle veriye dayalı iç içe ağaç olarak saklanır.',
      tag: 'DOM Mimarisi',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    },
    {
      id: 'f2',
      name: 'Çift Yönlü Canlı Kod',
      desc: 'Sol panelde yapılan her değişiklik anında canlı kod ve DOM ağacıyla senkronize olur.',
      tag: 'Canlı Senkron',
      image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    },
    {
      id: 'f3',
      name: 'Modüler React Çıktısı',
      desc: 'Tek tıkla masaüstüne Vite + Tailwind destekli modüler React projesi üretir.',
      tag: 'Üretime Hazır',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      btnText: 'Detayları İncele ↗'
    }
  ];

  const cardsToUse = cardEls.length > 0
    ? cardEls.map((c, idx) => {
        const imgChild = flatElements.find(e => e.id === `${c.id}-img`) || c.children?.find(ch => ch.type === 'img');
        const badgeChild = flatElements.find(e => e.id === `${c.id}-badge`) || c.children?.find(ch => ch.type === 'span');
        const titleChild = flatElements.find(e => e.id === `${c.id}-title`) || c.children?.find(ch => ch.type === 'h3' || ch.type === 'h4');
        const descChild = flatElements.find(e => e.id === `${c.id}-desc`) || c.children?.find(ch => ch.type === 'p');
        const btnChild = flatElements.find(e => e.id === `${c.id}-btn`) || c.children?.find(ch => ch.type === 'button');

        return {
          id: c.id || `f-${idx + 1}`,
          name: titleChild?.textContent || titleChild?.content || c.productName || c.name || `Özellik ${idx + 1}`,
          desc: descChild?.textContent || descChild?.content || c.productDesc || 'Modern web standartlarıyla tasarlanmış özellik bileşeni.',
          tag: badgeChild?.textContent || badgeChild?.content || c.productTag || 'Özellik',
          image: imgChild?.attrs?.src || c.productImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
          btnText: btnChild?.textContent || btnChild?.content || 'Detayları İncele ↗'
        };
      })
    : defaultCards;

  // Extract Footer elements & texts dynamically
  const footerBrandTitle = flatElements.find(el => el.id === 'elem-footer-brand-title')?.textContent || 'CRAFT STUDIO';
  const footerBrandDesc = flatElements.find(el => el.id === 'elem-footer-brand-desc')?.textContent || 'Yeni nesil web siteleri, SaaS panelleri ve modern arayüzler tasarlamak için yaratıcı geliştirme stüdyosu.';

  const col1Title = flatElements.find(el => el.id === 'elem-footer-col1-title')?.textContent || 'Ürünler';
  const col1Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col1-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol1 = col1Links.length > 0 ? col1Links : ['Web Stüdyosu', 'React Şablonları', 'UI Bileşenleri'];

  const col2Title = flatElements.find(el => el.id === 'elem-footer-col2-title')?.textContent || 'Şirket';
  const col2Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col2-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol2 = col2Links.length > 0 ? col2Links : ['Hakkımızda', 'Kariyer & Ekip', 'İletişim & Destek'];

  const col3Title = flatElements.find(el => el.id === 'elem-footer-col3-title')?.textContent || 'Topluluk';
  const col3Links = flatElements.filter(el => el.id && el.id.startsWith('elem-footer-col3-link')).map(el => el.textContent || el.content || '').filter(Boolean);
  const linksCol3 = col3Links.length > 0 ? col3Links : ['Discord Topluluğu', 'GitHub Deposu', 'Gizlilik İlkeleri'];

  const copyrightText = flatElements.find(el => el.id === 'elem-footer-copyright')?.textContent || '© 2026 CraftStudio Inc. Tüm hakları saklıdır. Nesneye yönelik modüler mimari ile oluşturulmuştur.';

  // Any custom AST elements designed on the canvas outside default presets (top level)
  const standardIds = new Set([
    'elem-nav', 'elem-nav-brand', 'elem-nav-logo-icon', 'elem-nav-logo-text', 'elem-nav-menu',
    'elem-nav-link-1', 'elem-nav-link-2', 'elem-nav-link-3', 'elem-nav-link-4', 'elem-nav-link-5', 'elem-nav-cta-btn',
    'elem-hero', 'elem-badge', 'elem-hero-title', 'elem-hero-desc', 'elem-hero-btn', 'elem-google-link',
    'elem-features-section', 'elem-sec-title', 'elem-sec-desc', 'elem-cards-grid',
    'elem-card-1', 'elem-card-1-img', 'elem-card-1-badge', 'elem-card-1-title', 'elem-card-1-desc', 'elem-card-1-btn',
    'elem-card-2', 'elem-card-2-img', 'elem-card-2-badge', 'elem-card-2-title', 'elem-card-2-desc', 'elem-card-2-btn',
    'elem-card-3', 'elem-card-3-img', 'elem-card-3-badge', 'elem-card-3-title', 'elem-card-3-desc', 'elem-card-3-btn',
    'elem-footer', 'elem-footer-brand-box', 'elem-footer-brand-title', 'elem-footer-brand-desc',
    'elem-footer-col-1', 'elem-footer-col1-title', 'elem-footer-col1-link1', 'elem-footer-col1-link2', 'elem-footer-col1-link3',
    'elem-footer-col-2', 'elem-footer-col2-title', 'elem-footer-col2-link1', 'elem-footer-col2-link2', 'elem-footer-col2-link3',
    'elem-footer-col-3', 'elem-footer-col3-title', 'elem-footer-col3-link1', 'elem-footer-col3-link2', 'elem-footer-col3-link3',
    'elem-footer-copyright'
  ]);
  const usesModularTemplate = Boolean(
    navEl && flatElements.some((el) => el.id === 'elem-hero' || el.id === 'hero-sec')
  );
  const customElements = usesModularTemplate
    ? elements.filter(el => !standardIds.has(el.id))
    : elements;

  // 1. src/components/Navbar.jsx
  const navbarCode = `import React, { useState } from 'react';
import { Search, Menu, X, Sparkles, ArrowRight } from 'lucide-react';

export default function Navbar({ onCtaClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = ${JSON.stringify(navLinks)};

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#0f172a]/95 border-b border-[#1e293b] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md font-bold">
            <Sparkles size={17} />
          </div>
          <span className="font-bold tracking-wider text-sm sm:text-base text-white font-sans">
            ${logoText}
          </span>
        </div>

        {/* Desktop Nav Links (Hidden on Mobile 375px, Visible on Desktop 1440px) */}
        <nav className="hidden md:flex items-center gap-8 text-xs text-slate-300 font-medium">
          {navLinks.map((link, idx) => (
            <a 
              key={idx} 
              href="#" 
              className="hover:text-blue-400 transition-colors py-1 relative group"
            >
              {link}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            aria-label="Arama"
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Search size={17} />
          </button>

          {navCtaText && (
            <button 
              onClick={onCtaClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>{navCtaText}</span>
              <ArrowRight size={13} />
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
            aria-label="Menüyü Aç"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0b1120] border-b border-[#1e293b] px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link, idx) => (
            <a 
              key={idx} 
              href="#" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200 hover:text-blue-400 font-medium border-b border-[#1e293b] last:border-none"
            >
              {link}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
`;

  // 2. src/components/HeroSection.jsx
  const heroCode = `import React from 'react';
import { Sparkles, ArrowRight, ExternalLink } from 'lucide-react';

export default function HeroSection({ onCtaClick }) {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-14">
      {/* Flex container with modern indigo gradient matching canvas */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
        }}
        className="w-full border border-[#312e81] p-6 sm:p-12 md:p-16 flex flex-col items-start justify-center text-left relative overflow-hidden"
      >
        {/* Subtle background ambient glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-xs font-semibold mb-4 sm:mb-6">
          <Sparkles size={13} className="text-indigo-400" />
          <span>${badgeText}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#f8fafc] tracking-tight leading-tight max-w-3xl mb-4 sm:mb-6">
          ${titleText}
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base md:text-lg text-[#94a3b8] max-w-2xl leading-relaxed mb-6 sm:mb-8">
          ${descText}
        </p>

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onCtaClick}
            style={{
              background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
            }}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-white font-bold text-sm sm:text-base hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span>${heroCtaText}</span>
            <ArrowRight size={17} />
          </button>

          {/* External Link */}
          <a
            href="${extLinkHref}"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-sm font-medium transition-all"
          >
            <span>${extLinkText}</span>
            <ExternalLink size={14} className="text-blue-400" />
          </a>
        </div>
      </div>
    </section>
  );
}
`;

  // 3. src/components/ProductCard.jsx (Feature Card in Dark SaaS Theme)
  const productCardCode = `import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function ProductCard({ 
  name, 
  desc, 
  tag, 
  image, 
  btnText,
  onAction 
}) {
  return (
    <article className="group bg-[#1e293b] rounded-2xl border border-[#334155] shadow-lg hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden p-5">
      {/* Feature Image Box */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-4">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        {tag && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 text-white shadow-md">
            {tag}
          </span>
        )}
      </div>

      {/* Info & Action */}
      <div className="flex flex-col gap-3 flex-1 justify-between">
        <div>
          <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
            {name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {desc}
          </p>
        </div>

        <button
          onClick={onAction}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-98 shadow-md cursor-pointer mt-3"
        >
          <span>{btnText || 'Detayları İncele ↗'}</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
`;

  // 4. src/components/ProductsSection.jsx (Features Section)
  const productsSectionCode = `import React from 'react';
import ProductCard from './ProductCard';

export default function ProductsSection({ onAction }) {
  const items = ${JSON.stringify(cardsToUse, null, 2)};

  return (
    <section id="ozellikler" className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-16">
      {/* Container Box matching canvas #0f172a / border-[#1e293b] */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl p-6 sm:p-10 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 gap-4">
          <div>
            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase block mb-1">
              GÜÇLÜ ALTYAPI
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-sans">
              ${secTitleText}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            ${secDescText}
          </p>
        </div>

        {/* Responsive Grid: 1 col on mobile (375px), 2 cols on tablet, 3 cols on desktop (1440px) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              name={item.name}
              desc={item.desc}
              tag={item.tag}
              image={item.image}
              btnText={item.btnText}
              onAction={() => onAction && onAction(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
`;

  // 5. Custom Elements Section (renders any custom user tags + interactive projectFunctions)
  const jsxRenderOptions = {
    projectFunctions,
    tabs,
    preserveCanvasCoords: !usesModularTemplate,
    includeNodeDataId: !usesModularTemplate || projectFunctions.length > 0 || flatElements.some((n) => n?.events?.onClick && n.events.onClick.mode !== 'none'),
  };
  const customElementsRuntimeCode = buildExportedRuntimeScript(projectFunctions);
  const sectionStageHeight = Number(canvasSettings?.height) || 1350;
  const customElementsCode = `import React from 'react';

export default function CustomElementsSection({ onNotify }) {
${customElementsRuntimeCode}

  return (
    <section ${usesModularTemplate ? 'className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"' : `className="relative w-full" style={{ minHeight: '${sectionStageHeight}px' }}`}>
${customElements.map(el => renderAstElementToJsx(el, '      ', jsxRenderOptions)).join('\n')}
    </section>
  );
}
`;

  // 6. src/components/Footer.jsx
  const footerCode = `import React from 'react';
import { Sparkles, Mail, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#0f172a] text-slate-300 border-t border-[#1e293b] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 sm:gap-12 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold">
                <Sparkles size={15} />
              </div>
              <span className="text-base font-bold text-white tracking-wider font-sans">
                ${footerBrandTitle}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              ${footerBrandDesc}
            </p>
          </div>

          {/* Sütun 1: Ürünler */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${col1Title}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol1.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${l}</a></li>`).join('\n              ')}
            </ul>
          </div>

          {/* Sütun 2: Şirket */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${col2Title}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol2.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${l}</a></li>`).join('\n              ')}
            </ul>
          </div>

          {/* Sütun 3: Topluluk */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">${col3Title}</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              ${linksCol3.map(l => `<li><a href="#" className="hover:text-blue-400 transition-colors">${l}</a></li>`).join('\n              ')}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#1e293b] pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>${copyrightText}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-400">Gizlilik Politikası</a>
            <a href="#" className="hover:text-slate-400">Kullanım Koşulları</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
`;

  // 7. src/App.jsx (Uses Modular Demo Shell only when template sections actually exist; otherwise renders user's faithful custom canvas)
  const hasCustomElements = customElements.length > 0;
  const stageBgColor = canvasSettings?.bgColor || canvasSettings?.backgroundColor || '#0b0f19';
  const stageWidth = Number(canvasSettings?.width) || 1280;
  const stageHeight = Number(canvasSettings?.height) || 1350;

  const appCode = usesModularTemplate
    ? `import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import ProductsSection from './components/ProductsSection';
${hasCustomElements ? "import CustomElementsSection from './components/CustomElementsSection';" : ''}
import Footer from './components/Footer';

export default function App() {
  const [notification, setNotification] = useState('');

  const handleAction = (item) => {
    setNotification(\`"\${item.name}" inceleniyor...\`);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleScrollToFeatures = () => {
    const el = document.getElementById('ozellikler');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e293b] text-blue-300 border border-blue-500/40 px-4 py-2.5 rounded-md shadow-2xl text-xs font-medium">
          {notification}
        </div>
      )}

      {/* 1. Modular Navbar (Sticky) */}
      <Navbar onCtaClick={handleScrollToFeatures} />

      {/* 2. Main Content */}
      <main className="flex-1 w-full flex flex-col items-center">
        {/* Modular Hero Section */}
        <HeroSection onCtaClick={handleScrollToFeatures} />

        ${hasCustomElements ? '{/* Custom User-Designed Elements */}\n        <CustomElementsSection onNotify={(msg) => {\n          setNotification(msg);\n          setTimeout(() => setNotification(\'\'), 3500);\n        }} />\n' : ''}
        {/* Modular Features Grid Section */}
        <ProductsSection onAction={handleAction} />
      </main>

      {/* 3. Modular Footer */}
      <Footer />
    </div>
  );
}
`
    : `import React, { useState } from 'react';
${hasCustomElements ? "import CustomElementsSection from './components/CustomElementsSection';" : ''}

export default function App() {
  const [notification, setNotification] = useState('');

  return (
    <div
      style={{ backgroundColor: '${stageBgColor}', minHeight: '100vh' }}
      className="w-full text-slate-100 flex flex-col items-center selection:bg-blue-600 selection:text-white"
    >
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18181b] text-slate-100 border border-blue-500/50 px-4 py-2.5 rounded-md shadow-2xl text-xs font-medium">
          {notification}
        </div>
      )}

      <main
        style={{ width: '100%', maxWidth: '${stageWidth}px', minHeight: '${stageHeight}px' }}
        className="relative flex-1 overflow-x-hidden"
      >
        ${hasCustomElements
          ? `<CustomElementsSection onNotify={(msg) => {\n          setNotification(msg);\n          setTimeout(() => setNotification(''), 3500);\n        }} />`
          : `<div className="w-full py-24 text-center text-sm text-slate-400">Bu sayfada henüz yayınlanacak bileşen bulunmuyor.</div>`}
      </main>
    </div>
  );
}
`;

  // 8. package.json
  const packageJson = {
    name: resolvedSlug,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    dependencies: {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^1.16.0"
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      "tailwindcss": "^4.0.0",
      "vite": "^6.1.0"
    }
  };

  // 9. vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;

  // 10. index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CraftStudio • Yayınlanan Modern Web Sitesi</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body class="m-0 p-0 antialiased font-sans bg-[#0b0f19] text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

  // 11. src/index.css
  const indexCss = `@import "tailwindcss";

@layer base {
  body {
    overflow-x: hidden;
  }
}

/* Studio Animation Keyframes & Classes */
@keyframes studioFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes studioSlideUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes studioSlideDown { from { opacity: 0; transform: translateY(-32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes studioSlideLeft { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: translateX(0); } }
@keyframes studioSlideRight { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: translateX(0); } }
@keyframes studioZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes studioBounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 0.9; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
@keyframes studioFloatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes studioPulseGlow { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.3)); } 50% { opacity: 0.85; filter: drop-shadow(0 0 16px rgba(59, 130, 246, 0.75)); } }

.animate-fade-in { animation: studioFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-up { animation: studioSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-down { animation: studioSlideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-left { animation: studioSlideLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-right { animation: studioSlideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-zoom-in { animation: studioZoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-bounce-in { animation: studioBounceIn 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
.animate-float { animation: studioFloatSlow 3.2s ease-in-out infinite; }
.animate-pulse-glow { animation: studioPulseGlow 2.5s ease-in-out infinite; }

/* Link / Navbar Underline & Hover Effects */
.hover-underline-left,
.hover-underline-center,
.hover-underline-right,
.hover-underline-slide,
.hover-text-fill-bar {
  position: relative;
  overflow: visible !important;
  transition: color var(--craft-line-duration, 0.28s) ease, transform var(--craft-line-duration, 0.28s) ease;
}

.hover-underline-left::after,
.hover-underline-center::after,
.hover-underline-right::after,
.hover-underline-slide::after,
.hover-text-fill-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: var(--craft-line-height, 2px);
  background: var(--craft-line-color, #fbbf24);
  border-radius: 999px;
  pointer-events: none;
  transform: scaleX(0);
  transition: transform var(--craft-line-duration, 0.28s) cubic-bezier(0.22, 1, 0.36, 1), height var(--craft-line-duration, 0.28s) ease, opacity var(--craft-line-duration, 0.28s) ease;
}

.hover-underline-left::after { transform-origin: left center; }
.hover-underline-left:hover::after { transform: scaleX(1); }
.hover-underline-center::after { transform-origin: center center; }
.hover-underline-center:hover::after { transform: scaleX(1); }
.hover-underline-right::after { transform-origin: right center; }
.hover-underline-right:hover::after { transform: scaleX(1); }
.hover-underline-slide::after { transform-origin: right center; }
.hover-underline-slide:hover::after { transform-origin: left center; transform: scaleX(1); }
.hover-text-fill-bar::after { bottom: -1px; opacity: 0.2; transform: scaleX(1); }
.hover-text-fill-bar:hover::after { height: 6px; opacity: 0.45; }
.hover-text-fill-bar:hover { transform: translateY(-2px); }
${buildResponsiveCssRules(flatElements)}
`;

  // 12. src/main.jsx
  const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  // 13. craft.project.json (Full Studio Schema incl. multi-viewport, tabs & projectFunctions)
  const serializedTabs = (Array.isArray(tabs) && tabs.length > 0)
    ? tabs
    : [
        {
          id: 'tab-1',
          name: 'Anasayfa.craft',
          route: '/',
          elements: elements,
          canvasByViewport: canvasByViewport || undefined,
        }
      ];

  const craftProjectJson = JSON.stringify({
    schemaVersion: '1.1.0',
    studio: 'CraftStudio',
    name: projectName || 'CraftStudio Projesi',
    createdAt: new Date().toISOString(),
    canvasSettings: canvasSettings || { width: 1280, height: 1350, backgroundColor: '#0f172a' },
    canvasByViewport: canvasByViewport || undefined,
    tabs: serializedTabs,
    projectFunctions: projectFunctions || [],
    pageLinks: []
  }, null, 2);

  const standaloneHtml = buildStandaloneHtmlSite({
    projectName,
    tabs: serializedTabs,
    activeTabId,
    elements,
    canvasSettings,
    canvasByViewport,
    projectFunctions,
  });

  return {
    usesModularTemplate,
    folderSlug: resolvedSlug,
    packageJson: JSON.stringify(packageJson, null, 2),
    viteConfig,
    indexHtml,
    indexCss,
    mainJsx,
    appCode,
    navbarCode,
    heroCode,
    productCardCode,
    productsSectionCode,
    customElementsCode,
    footerCode,
    craftProjectJson,
    standaloneHtml,
  };
}

function escapeHtmlText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  return escapeHtmlText(str).replace(/"/g, '&quot;');
}

function styleObjectToInlineString(styleObj) {
  return Object.entries(styleObj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const prop = k.startsWith('--') ? k : camelToKebabCase(k);
      return `${prop}:${String(v).replace(/"/g, "'")}`;
    })
    .join(';');
}

function buildStandaloneNodeHtml(node, depth, options) {
  if (!node || node.isHidden) return '';
  const { projectFunctions = [], tabs = [], seenHtmlIds } = options;
  const rawTag = (node.type || 'div').toLowerCase();
  const mappedTag = rawTag === 'text' || rawTag === 'badge'
    ? 'span'
    : rawTag === 'navbar'
      ? 'nav'
      : rawTag === 'image'
        ? 'img'
        : rawTag === 'product_card'
          ? 'article'
          : rawTag;
  const voidTag = isVoidTag(mappedTag);

  const styleObj = { ...(node.style || {}) };
  if (!styleObj.position) {
    styleObj.position = node.positionMode === 'sticky' ? 'sticky' : 'absolute';
    if (node.positionMode === 'sticky' && styleObj.top === undefined) styleObj.top = '0px';
  }
  if (typeof node.x === 'number' && styleObj.left === undefined && node.positionMode !== 'sticky') {
    styleObj.left = `${node.x}px`;
  }
  if (typeof node.y === 'number' && styleObj.top === undefined && node.positionMode !== 'sticky') {
    styleObj.top = `${node.y}px`;
  }
  if (typeof node.width === 'number' && styleObj.width === undefined) styleObj.width = `${node.width}px`;
  if (typeof node.height === 'number' && styleObj.height === undefined) styleObj.height = `${node.height}px`;
  if (styleObj.zIndex === undefined) {
    styleObj.zIndex = node.zIndex || (node.positionMode === 'sticky' || node.positionMode === 'fixed' ? 100 : depth + 1);
  }
  styleObj.boxSizing = 'border-box';

  if (node.fillType === 'gradient' && node.gradient) {
    styleObj.background = `linear-gradient(${node.gradient.angle || 90}deg, ${node.gradient.color1 || '#d4af37'}, ${node.gradient.color2 || '#2c2523'})`;
  } else if (node.fillColor && node.fillColor !== 'transparent' && !styleObj.background && !styleObj.backgroundColor) {
    styleObj.backgroundColor = node.fillColor;
  }

  if (node.borderRadiusType === 'custom' && node.borderRadiusCorners && !styleObj.borderRadius) {
    const { tl = 0, tr = 0, br = 0, bl = 0 } = node.borderRadiusCorners;
    styleObj.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
  } else if (node.borderRadius > 0 && !styleObj.borderRadius) {
    styleObj.borderRadius = `${node.borderRadius}px`;
  }

  if (!styleObj.border && node.borderWidth > 0) {
    styleObj.border = `${node.borderWidth}px ${node.borderStyle || 'solid'} ${node.borderColor || '#cbd5e1'}`;
  }
  if (node.shadow && node.shadow !== 'none' && !styleObj.boxShadow) {
    styleObj.boxShadow = node.shadow;
  }
  if (node.opacity !== undefined && node.opacity !== 100 && styleObj.opacity === undefined) {
    styleObj.opacity = Math.max(0, Math.min(1, Number(node.opacity) / 100));
  }

  const isPureTextNode = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'text', 'badge'].includes(rawTag);
  if (!styleObj.display && !voidTag) {
    styleObj.display = 'flex';
    styleObj.flexDirection = styleObj.flexDirection || 'column';
    styleObj.alignItems = styleObj.alignItems || (isPureTextNode || rawTag === 'button' ? 'center' : 'flex-start');
    styleObj.justifyContent = styleObj.justifyContent || (rawTag === 'button' ? 'center' : 'flex-start');
  }
  if (node.textColor && !styleObj.color) styleObj.color = node.textColor;
  if (node.fontSize && !styleObj.fontSize) styleObj.fontSize = `${node.fontSize}px`;
  if (node.fontWeight && !styleObj.fontWeight) styleObj.fontWeight = node.fontWeight;
  if (node.textAlign && !styleObj.textAlign) styleObj.textAlign = node.textAlign;
  if (rawTag === 'a' && !styleObj.textDecoration) styleObj.textDecoration = 'none';

  if (node.animation?.hoverLineColor) styleObj['--craft-line-color'] = node.animation.hoverLineColor;
  if (node.animation?.hoverLineHeight) styleObj['--craft-line-height'] = `${node.animation.hoverLineHeight}px`;
  if (node.animation?.hoverLineDuration) styleObj['--craft-line-duration'] = `${node.animation.hoverLineDuration}s`;

  const attrs = { ...(node.attrs || {}) };
  if (mappedTag === 'img' && !attrs.src) {
    attrs.src = node.imageUrl || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80';
    if (!attrs.alt) attrs.alt = 'Görsel';
    styleObj.objectFit = styleObj.objectFit || 'cover';
  }
  if (attrs.id) {
    if (seenHtmlIds.has(attrs.id)) delete attrs.id;
    else seenHtmlIds.add(attrs.id);
  }
  attrs['data-craft-id'] = node.id;

  const parentSliderActiveIdx = options.parentSliderActiveIdx ?? null;
  const ownSliderIdx = node.sliderConfig ? Number(node.sliderConfig.activeSlideIndex || 0) : null;
  if (ownSliderIdx !== null) {
    attrs['data-craft-slider-root'] = node.id;
    attrs['data-craft-active-slide'] = String(ownSliderIdx);
  }
  if (node.sliderRole === 'slide') {
    attrs['data-craft-slide-index'] = String(node.slideIndex || 0);
  }
  if (node.sliderRole === 'dot') {
    attrs['data-craft-slider-dot'] = String(node.slideIndex || 0);
  }

  const isSlideHidden = node.sliderRole === 'slide' && parentSliderActiveIdx !== null && Number(node.slideIndex || 0) !== Number(parentSliderActiveIdx);
  const isActiveDot = node.sliderRole === 'dot' && parentSliderActiveIdx !== null && Number(node.slideIndex || 0) === Number(parentSliderActiveIdx);
  const animCls = [
    node.animation?.className,
    node.animation?.hoverClassName,
    isSlideHidden ? 'is-slide-hidden' : '',
    isActiveDot ? 'is-active-dot' : '',
  ].filter(Boolean).join(' ');
  if (animCls) attrs.class = attrs.class ? `${attrs.class} ${animCls}` : animCls;

  const onClickEv = node.events?.onClick;
  let onClickAttr = '';
  if (onClickEv && onClickEv.mode && onClickEv.mode !== 'none') {
    styleObj.cursor = styleObj.cursor || 'pointer';
    if (onClickEv.mode === 'function' && (onClickEv.functionName || onClickEv.functionId)) {
      const fnObj = (projectFunctions || []).find(
        (f) => f.id === onClickEv.functionId || sanitizeFunctionIdentifier(f.name) === sanitizeFunctionIdentifier(onClickEv.functionName)
      );
      const safeName = sanitizeFunctionIdentifier(fnObj?.name || onClickEv.functionName || '');
      if (safeName) onClickAttr = ` data-craft-fn="${escapeHtmlAttr(safeName)}"`;
    } else if ((onClickEv.mode === 'navigate' || onClickEv.mode === 'navigate_page') && (onClickEv.targetTabId || onClickEv.targetPageId)) {
      const targetKey = onClickEv.targetPageId || onClickEv.targetTabId;
      const targetTab = (tabs || []).find((t) => t.id === targetKey || t.route === targetKey);
      const targetRoute = targetTab?.route || onClickEv.targetRoute || targetKey;
      onClickAttr = ` data-craft-nav="${escapeHtmlAttr(targetRoute)}"`;
    } else if ((onClickEv.mode === 'url' || onClickEv.mode === 'navigate_url') && onClickEv.url) {
      onClickAttr = ` data-craft-url="${escapeHtmlAttr(onClickEv.url)}" data-craft-blank="${onClickEv.openInNewTab !== false ? '1' : '0'}"`;
    } else if (onClickEv.mode === 'alert' && onClickEv.message) {
      onClickAttr = ` data-craft-alert="${escapeHtmlAttr(onClickEv.message)}"`;
    } else if (onClickEv.mode === 'scroll_to' && onClickEv.targetElementId) {
      onClickAttr = ` data-craft-scroll="${escapeHtmlAttr(onClickEv.targetElementId)}"`;
    } else if ((onClickEv.mode === 'toggle' || onClickEv.mode === 'toggle_visibility') && (onClickEv.targetId || onClickEv.targetElementId)) {
      onClickAttr = ` data-craft-toggle="${escapeHtmlAttr(onClickEv.targetElementId || onClickEv.targetId)}"`;
    } else if (onClickEv.mode === 'set_text' && onClickEv.targetElementId) {
      onClickAttr = ` data-craft-set-text-target="${escapeHtmlAttr(onClickEv.targetElementId)}" data-craft-set-text-val="${escapeHtmlAttr(onClickEv.newText ?? '')}"`;
    } else if (
      (onClickEv.mode === 'slider_prev' || onClickEv.mode === 'slider_next' || onClickEv.mode === 'slider_goto') &&
      onClickEv.targetElementId
    ) {
      const actionKey = onClickEv.mode.replace('slider_', '');
      onClickAttr = ` data-craft-slider-action="${escapeHtmlAttr(actionKey)}" data-craft-slider-target="${escapeHtmlAttr(onClickEv.targetElementId)}" data-craft-slide-idx="${Number(onClickEv.slideIndex) || 0}"`;
    }
  } else if (mappedTag === 'a' && attrs.href && String(attrs.href).startsWith('#/')) {
    onClickAttr = ` data-craft-nav="${escapeHtmlAttr(String(attrs.href).slice(1))}"`;
  }

  const attrStr = Object.entries(attrs)
    .filter(([, val]) => val !== undefined && val !== null && val !== false && val !== '')
    .map(([key, val]) => (val === true ? key : `${key}="${escapeHtmlAttr(val)}"`))
    .join(' ');

  const styleCss = styleObjectToInlineString(styleObj);
  const stylePart = styleCss ? ` style="${escapeHtmlAttr(styleCss)}"` : '';

  if (voidTag) {
    return `<${mappedTag}${attrStr ? ' ' + attrStr : ''}${stylePart}${onClickAttr} />`;
  }

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const textContent = node.textContent ?? node.content ?? '';
  const textHtml = textContent
    ? `<span style="width:100%;display:block;white-space:pre-wrap;pointer-events:none;${styleObj.textAlign ? `text-align:${escapeHtmlAttr(styleObj.textAlign)};` : ''}">${escapeHtmlText(textContent)}</span>`
    : '';
  const childOptions = ownSliderIdx !== null ? { ...options, parentSliderActiveIdx: ownSliderIdx } : options;
  const childrenHtml = hasChildren
    ? node.children.map((ch) => buildStandaloneNodeHtml(ch, depth + 1, childOptions)).join('')
    : '';

  return `<${mappedTag}${attrStr ? ' ' + attrStr : ''}${stylePart}${onClickAttr}>${textHtml}${childrenHtml}</${mappedTag}>`;
}

function buildStandaloneResponsiveCss(flatList, tabScopeSelector, pageCanvasByViewport) {
  const tabletRules = [];
  const mobileRules = [];

  if (pageCanvasByViewport?.tablet?.height) {
    tabletRules.push(`${tabScopeSelector} { min-height: ${pageCanvasByViewport.tablet.height}px !important; }`);
  }
  if (pageCanvasByViewport?.mobile?.height) {
    mobileRules.push(`${tabScopeSelector} { min-height: ${pageCanvasByViewport.mobile.height}px !important; }`);
  }

  const pushNodeRules = (node, vp, targetArr) => {
    const ov = node.responsive?.[vp];
    if (!ov || Object.keys(ov).length === 0) return;
    const decls = [];
    if (ov.isHidden === true) {
      decls.push('display: none !important;');
    } else {
      if (ov.isHidden === false) decls.push('display: flex !important;');
      if (ov.x !== undefined) decls.push(`left: ${ov.x}px !important;`);
      if (ov.y !== undefined) decls.push(`top: ${ov.y}px !important;`);
      if (ov.width !== undefined) decls.push(`width: ${ov.width}px !important;`);
      if (ov.height !== undefined) decls.push(`height: ${ov.height}px !important;`);
      if (ov.style && typeof ov.style === 'object') {
        Object.entries(ov.style).forEach(([prop, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            decls.push(`${camelToKebabCase(prop)}: ${val} !important;`);
          }
        });
      }
    }
    if (decls.length > 0) {
      targetArr.push(`${tabScopeSelector} [data-craft-id="${node.id}"] { ${decls.join(' ')} }`);
    }
  };

  flatList.forEach((node) => {
    pushNodeRules(node, 'tablet', tabletRules);
    pushNodeRules(node, 'mobile', mobileRules);
  });

  return `${tabletRules.length ? `@media (max-width: 1023px) {\n  ${tabletRules.join('\n  ')}\n}` : ''}
${mobileRules.length ? `@media (max-width: 639px) {\n  ${mobileRules.join('\n  ')}\n}` : ''}`;
}

/**
 * Generates a 100% self-contained, zero-dependency, multi-page, responsive interactive HTML5 site
 * matching the Studio canvas geometry & functions 1:1. Used by Live Preview iframe, Local Live Server, and Web Download.
 */
export function buildStandaloneHtmlSite(input = {}) {
  const {
    projectName = 'CraftStudio Sitesi',
    tabs = [],
    activeTabId = null,
    elements = [],
    canvasSettings = { width: 1280, height: 1350, bgColor: '#ffffff' },
    canvasByViewport = null,
    projectFunctions = [],
  } = input || {};

  const normalizedTabs = (Array.isArray(tabs) && tabs.length > 0)
    ? tabs.map((t, idx) => {
        const isActive = activeTabId ? t.id === activeTabId : idx === 0;
        const tabEls = isActive && Array.isArray(elements) ? elements : (t.elements || []);
        const tabCanvasByVp = (isActive && canvasByViewport) ? canvasByViewport : (t.canvasByViewport || null);
        const tabDesktopCanvas = tabCanvasByVp?.desktop || t.canvasSettings || canvasSettings || { width: 1280, height: 1350, bgColor: '#ffffff' };
        return {
          id: t.id || `tab-${idx + 1}`,
          name: t.name || `Sayfa ${idx + 1}`,
          route: t.route || (idx === 0 ? '/' : `/${slugifyProjectFolderName(t.name || `sayfa-${idx + 1}`)}`),
          elements: tabEls,
          canvasByViewport: tabCanvasByVp,
          canvasSettings: tabDesktopCanvas,
        };
      })
    : [
        {
          id: 'tab-1',
          name: 'Anasayfa.craft',
          route: '/',
          elements: Array.isArray(elements) ? elements : [],
          canvasByViewport,
          canvasSettings: canvasByViewport?.desktop || canvasSettings || { width: 1280, height: 1350, bgColor: '#ffffff' },
        },
      ];

  const initialTab = normalizedTabs.find((t) => t.id === activeTabId) || normalizedTabs[0];
  const responsiveCssBlocks = [];
  const pagesHtml = normalizedTabs.map((tab, idx) => {
    const seenHtmlIds = new Set();
    const deskW = Number(tab.canvasSettings?.width) || 1280;
    const deskH = Number(tab.canvasSettings?.height) || 1350;
    const deskBg = tab.canvasSettings?.bgColor || tab.canvasSettings?.backgroundColor || '#ffffff';
    const tabSelector = `#craft-page-${slugifyProjectFolderName(tab.id || `p${idx}`)}`;
    const flatList = flattenTree(tab.elements || []);
    const respCss = buildStandaloneResponsiveCss(flatList, `${tabSelector} .craft-stage`, tab.canvasByViewport);
    if (respCss.trim()) responsiveCssBlocks.push(respCss);

    const nodesHtml = (tab.elements || [])
      .map((el) => buildStandaloneNodeHtml(el, 0, { projectFunctions, tabs: normalizedTabs, seenHtmlIds }))
      .join('\n');

    const emptyNotice = flatList.length === 0
      ? '<div style="display:flex;align-items:center;justify-content:center;min-height:420px;color:#64748b;font-size:13px;font-family:Inter,sans-serif;">Bu sayfada henüz bileşen yok.</div>'
      : '';

    const activeCls = tab.id === initialTab.id ? ' is-active' : '';
    return `  <section id="craft-page-${slugifyProjectFolderName(tab.id || `p${idx}`)}" data-route="${escapeHtmlAttr(tab.route)}" class="craft-page${activeCls}" style="background:${escapeHtmlAttr(deskBg)};min-height:100vh;">
    <div class="craft-stage" style="position:relative;width:100%;max-width:${deskW}px;min-height:${deskH}px;margin:0 auto;background:${escapeHtmlAttr(deskBg)};overflow-x:hidden;">
${nodesHtml || emptyNotice}
    </div>
  </section>`;
  }).join('\n');

  const compiledFnBlocks = (projectFunctions || [])
    .map((fn) => {
      const fnName = sanitizeFunctionIdentifier(fn.name);
      if (!fnName) return '';
      const fnBody = getEffectiveFunctionCode(fn);
      return `window.__craftFunctions[${JSON.stringify(fnName)}] = function() {\n${fnBody}\n};`;
    })
    .filter(Boolean)
    .join('\n\n');

  const routeMapJson = JSON.stringify(
    normalizedTabs.map((t) => ({ id: t.id, route: t.route, domId: `craft-page-${slugifyProjectFolderName(t.id)}` }))
  );

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlText(projectName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Playfair+Display:wght@500;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
    .craft-page { display: none; width: 100%; }
    .craft-page.is-active { display: block; }
    .craft-toast {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: #18181b; color: #f4f4f5; border: 1px solid rgba(59,130,246,0.55);
      padding: 10px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,0.45); opacity: 0; pointer-events: none;
      transform: translateY(8px); transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .craft-toast.is-open { opacity: 1; transform: translateY(0); }

    .hover-underline-center, .hover-underline-left, .hover-underline-right, .hover-underline-slide, .hover-text-fill-bar { position: relative; }
    .hover-underline-center::after, .hover-underline-left::after, .hover-underline-right::after, .hover-underline-slide::after, .hover-text-fill-bar::after {
      content: ''; position: absolute; bottom: -2px; left: 0; width: 100%;
      height: var(--craft-line-height, 2px); background: var(--craft-line-color, #3b82f6);
      transform: scaleX(0); transition: transform var(--craft-line-duration, 0.26s) cubic-bezier(0.22, 1, 0.36, 1), height var(--craft-line-duration, 0.26s) ease, opacity var(--craft-line-duration, 0.26s) ease;
      pointer-events: none;
    }
    .hover-underline-center::after { transform-origin: center; }
    .hover-underline-left::after { transform-origin: left; }
    .hover-underline-right::after { transform-origin: right; }
    .hover-underline-slide::after { transform-origin: right center; }
    .hover-underline-slide:hover::after { transform-origin: left center; transform: scaleX(1); }
    .hover-underline-center:hover::after, .hover-underline-left:hover::after, .hover-underline-right:hover::after { transform: scaleX(1); }
    .hover-text-fill-bar::after { bottom: -1px; opacity: 0.2; transform: scaleX(1); }
    .hover-text-fill-bar:hover::after { height: 6px; opacity: 0.45; }
    .hover-text-fill-bar:hover { transform: translateY(-2px); }
    .hover-lift { transition: transform 0.22s ease, box-shadow 0.22s ease; }
    .hover-lift:hover { transform: translateY(-3px); }
    .hover-glow { transition: box-shadow 0.22s ease, filter 0.22s ease; }
    .hover-glow:hover { filter: brightness(1.08); box-shadow: 0 0 18px rgba(59,130,246,0.35); }
    .is-slide-hidden { display: none !important; }
    [data-craft-slider-dot] { transition: transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease; opacity: 0.45; }
    [data-craft-slider-dot].is-active-dot { opacity: 1 !important; transform: scale(1.22); }
    @media (max-width: 1023px) { .craft-stage { max-width: 768px !important; } }
    @media (max-width: 639px) { .craft-stage { max-width: 375px !important; } }
    ${responsiveCssBlocks.join('\n    ')}
  </style>
</head>
<body>
${pagesHtml}
  <div id="craft-toast" class="craft-toast"></div>
  <script>
    (function() {
      var routes = ${routeMapJson};
      var toastTimer = null;
      window.__craftFunctions = window.__craftFunctions || {};

      function findEl(idOrSelector) {
        if (!idOrSelector) return null;
        return document.getElementById(idOrSelector)
          || document.querySelector('[data-craft-id="' + idOrSelector + '"]')
          || (String(idOrSelector).startsWith('#') || String(idOrSelector).startsWith('.') ? document.querySelector(idOrSelector) : null);
      }
      function getValue(id) {
        var el = findEl(id);
        if (!el) return '';
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return el.value;
        return el.textContent || '';
      }
      function setValue(id, val) {
        var el = findEl(id);
        if (!el) return;
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) el.value = String(val ?? '');
        else el.textContent = String(val ?? '');
      }
      function setText(id, val) {
        var el = findEl(id);
        if (!el) return;
        var innerSpan = el.querySelector('span');
        if (innerSpan && el.children.length === 1) innerSpan.textContent = String(val ?? '');
        else el.textContent = String(val ?? '');
      }
      function setStyle(id, prop, val) {
        var el = findEl(id);
        if (el && prop) el.style[prop] = val;
      }
      function showElement(id) {
        var el = findEl(id);
        if (el) el.style.display = el.dataset.prevDisplay || 'flex';
      }
      function hideElement(id) {
        var el = findEl(id);
        if (el) {
          if (el.style.display && el.style.display !== 'none') el.dataset.prevDisplay = el.style.display;
          el.style.display = 'none';
        }
      }
      function toggleVisible(id) {
        var el = findEl(id);
        if (!el) return;
        if (getComputedStyle(el).display === 'none') showElement(id);
        else hideElement(id);
      }
      function addClass(id, cls) {
        var el = findEl(id);
        if (el && cls) el.classList.add(cls);
      }
      function removeClass(id, cls) {
        var el = findEl(id);
        if (el && cls) el.classList.remove(cls);
      }
      function notify(msg) {
        var toast = document.getElementById('craft-toast');
        if (!toast) return;
        toast.textContent = String(msg ?? '');
        toast.classList.add('is-open');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() { toast.classList.remove('is-open'); }, 3200);
      }
      var alert = notify;
      function goToPage(routeOrTabId) {
        var norm = String(routeOrTabId || '/');
        var found = routes.find(function(r) { return r.route === norm || r.id === norm; });
        if (!found) {
          notify('Sayfa bulunamadı: ' + norm);
          return;
        }
        document.querySelectorAll('.craft-page').forEach(function(sec) {
          sec.classList.toggle('is-active', sec.id === found.domId);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      function switchSlider(targetRef, action, gotoIdx) {
        var root = findEl(targetRef);
        if (!root) return;
        var slides = Array.from(root.querySelectorAll('[data-craft-slide-index]'));
        var total = Math.max(1, slides.length);
        var cur = Number(root.getAttribute('data-craft-active-slide') || 0);
        var next = 0;
        if (action === 'prev') next = (cur - 1 + total) % total;
        else if (action === 'goto') next = ((Number(gotoIdx) || 0) % total + total) % total;
        else next = (cur + 1) % total;
        root.setAttribute('data-craft-active-slide', String(next));
        slides.forEach(function(slideEl) {
          var sIdx = Number(slideEl.getAttribute('data-craft-slide-index') || 0);
          slideEl.classList.toggle('is-slide-hidden', sIdx !== next);
        });
        Array.from(root.querySelectorAll('[data-craft-slider-dot]')).forEach(function(dotEl) {
          var dIdx = Number(dotEl.getAttribute('data-craft-slider-dot') || 0);
          dotEl.classList.toggle('is-active-dot', dIdx === next);
        });
      }

      ${compiledFnBlocks}

      document.addEventListener('click', function(e) {
        var target = e.target && e.target.closest ? e.target.closest('[data-craft-fn],[data-craft-nav],[data-craft-url],[data-craft-alert],[data-craft-toggle],[data-craft-scroll],[data-craft-set-text-target],[data-craft-slider-action]') : null;
        if (!target) return;
        var fnName = target.getAttribute('data-craft-fn');
        if (fnName) {
          e.preventDefault();
          var fn = window.__craftFunctions[fnName];
          if (typeof fn === 'function') {
            try { fn(); } catch (err) { notify('Fonksiyon hatası (' + fnName + '): ' + err.message); }
          }
          return;
        }
        var sliderAction = target.getAttribute('data-craft-slider-action');
        if (sliderAction) {
          e.preventDefault();
          switchSlider(
            target.getAttribute('data-craft-slider-target'),
            sliderAction,
            target.getAttribute('data-craft-slide-idx')
          );
          return;
        }
        var navRoute = target.getAttribute('data-craft-nav');
        if (navRoute) {
          e.preventDefault();
          goToPage(navRoute);
          return;
        }
        var scrollTarget = target.getAttribute('data-craft-scroll');
        if (scrollTarget) {
          e.preventDefault();
          var sEl = findEl(scrollTarget);
          if (sEl) sEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        var url = target.getAttribute('data-craft-url');
        if (url) {
          e.preventDefault();
          var blank = target.getAttribute('data-craft-blank') !== '0';
          if (blank) window.open(url, '_blank', 'noopener,noreferrer');
          else window.location.href = url;
          return;
        }
        var alertMsg = target.getAttribute('data-craft-alert');
        if (alertMsg) {
          e.preventDefault();
          notify(alertMsg);
          return;
        }
        var setTextTarget = target.getAttribute('data-craft-set-text-target');
        if (setTextTarget) {
          e.preventDefault();
          setText(setTextTarget, target.getAttribute('data-craft-set-text-val') || '');
          return;
        }
        var toggleId = target.getAttribute('data-craft-toggle');
        if (toggleId) {
          e.preventDefault();
          toggleVisible(toggleId);
        }
      });
    })();
  </script>
</body>
</html>`;
}

