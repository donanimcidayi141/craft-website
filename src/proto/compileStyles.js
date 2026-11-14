import {
  DEFAULT_THEME_COLORS,
  GAP_PADDING_TOKENS,
  clampNumber,
  resolveSafeBorderCss,
  resolveSafeColorCss,
  sanitizeLayout,
  sanitizeProps,
  sanitizeSize,
  validateColor,
} from './schema.js';

/**
 * Saf stil derleyici: Akış + serbest katman ağacını (veya çoklu sayfa projesini) tek kaynaklı CSS metnine çevirir.
 * - Her düğüm için `.n-<id>` seçicisi üretir.
 * - Boşluk, renk ve tipografi token'larını CSS değişkeni olarak tanımlar (`theme` verilirse proje düzeyinde `:root` güncellenir).
 * - `responsive` (md: 1024px, sm: 640px) için `@media (max-width: ...)` kuralları üretir.
 * - Geçersiz/bilinmeyen tüm alanları `schema.js` doğrulayıcısıyla güvenli varsayılanlara düşürür.
 * - Editör arayüzüne özgü kurallar (seçim, sürükleme vb.) bu dosyaya KESİNLİKLE eklenmez.
 */

const VALID_THEME_FONTS = new Set(['sans', 'serif', 'mono']);

function resolveThemeColors(theme) {
  const colors = { ...DEFAULT_THEME_COLORS };
  if (theme && typeof theme === 'object') {
    for (const key of ['primary', 'accent', 'surface', 'text', 'muted']) {
      if (theme[key] !== undefined) {
        const res = validateColor(theme[key], { allowTokens: false });
        if (res.ok) colors[key] = res.value;
      }
    }
  }
  return colors;
}

function buildTokenDefinitions(theme) {
  const colors = resolveThemeColors(theme);
  return `:root {
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;

  --color-primary: ${colors.primary};
  --color-accent: ${colors.accent};
  --color-surface: ${colors.surface};
  --color-text: ${colors.text};
  --color-muted: ${colors.muted};

  --font-family-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-serif: 'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-family-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --font-display: clamp(2rem, 3.8vw + 0.75rem, 3.5rem);
  --font-h1: clamp(1.85rem, 2.9vw + 0.85rem, 3.15rem);
  --font-h2: clamp(1.45rem, 2.1vw + 0.7rem, 2.3rem);
  --font-h3: clamp(1.125rem, 1vw + 0.65rem, 1.375rem);
  --font-body-lg: clamp(1rem, 0.45vw + 0.88rem, 1.15rem);
  --font-body: clamp(0.9375rem, 0.25vw + 0.85rem, 1.02rem);
  --font-sm: clamp(0.8125rem, 0.2vw + 0.75rem, 0.875rem);
  --font-xs: clamp(0.7rem, 0.15vw + 0.66rem, 0.78rem);
}`;
}

const TOKEN_DEFINITIONS = buildTokenDefinitions(null);

function buildBaseCss(theme) {
  const fontKey = theme?.fontFamily && VALID_THEME_FONTS.has(theme.fontFamily)
    ? theme.fontFamily
    : 'sans';
  return `/* Temel sıfırlama (baseCss) */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  font-family: var(--font-family-${fontKey});
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, p {
  margin: 0;
}

img, svg {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
}`;
}

// İframe için bağımsız temel sıfırlama (Tailwind sızıntısı olmadan temiz başlangıç)
export const BASE_CSS = buildBaseCss(null);

const SPACE_TOKENS = new Set(GAP_PADDING_TOKENS);

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const FONT_FAMILY_MAP = {
  sans: 'var(--font-family-sans)',
  serif: 'var(--font-family-serif)',
  mono: 'var(--font-family-mono)',
};

const FONT_VARIANT_MAP = {
  display: 'var(--font-display)',
  h1: 'var(--font-h1)',
  h2: 'var(--font-h2)',
  h3: 'var(--font-h3)',
  'body-lg': 'var(--font-body-lg)',
  body: 'var(--font-body)',
  sm: 'var(--font-sm)',
  xs: 'var(--font-xs)',
};

const SHADOW_MAP = {
  none: 'none',
  sm: '0 4px 16px rgba(26, 24, 22, 0.06)',
  md: '0 12px 32px rgba(26, 24, 22, 0.1)',
  lg: '0 24px 60px rgba(26, 24, 22, 0.16)',
};

function resolveSpaceTokenCss(value) {
  if (!value || !SPACE_TOKENS.has(value)) return null;
  return `var(--space-${value})`;
}

function escapeClassId(id) {
  const str = String(id || 'node');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function resolveNumericColumns(columns) {
  if (typeof columns === 'number' && Number.isFinite(columns) && columns >= 1) {
    return Math.min(6, Math.max(1, Math.round(columns)));
  }
  return null;
}

function buildLayoutDeclarations(node, rawLayout, isBase) {
  const decls = [];
  const layout = sanitizeLayout(rawLayout);
  if (!layout) return decls;

  if (layout.mode === 'stack') {
    decls.push(['display', 'flex']);
    decls.push(['flex-direction', 'column']);
  } else if (layout.mode === 'row') {
    decls.push(['display', 'flex']);
    decls.push(['flex-direction', 'row']);
    if (layout.wrap) decls.push(['flex-wrap', layout.wrap]);
  } else if (layout.mode === 'grid') {
    decls.push(['display', 'grid']);
  }

  const baseLayout = sanitizeLayout(node.layout);
  const effectiveMode = layout.mode || baseLayout?.mode;
  if (effectiveMode === 'grid') {
    const colCount = resolveNumericColumns(layout.columns);
    if (colCount !== null) {
      decls.push(['grid-template-columns', `repeat(${colCount}, minmax(0, 1fr))`]);
    } else if (isBase && baseLayout?.columns !== undefined) {
      const baseCols = resolveNumericColumns(baseLayout.columns);
      if (baseCols !== null) {
        decls.push(['grid-template-columns', `repeat(${baseCols}, minmax(0, 1fr))`]);
      }
    }
  }

  const gapVal = resolveSpaceTokenCss(layout.gap);
  if (gapVal) decls.push(['gap', gapVal]);

  if (layout.align && ALIGN_MAP[layout.align]) {
    decls.push(['align-items', ALIGN_MAP[layout.align]]);
  }
  if (layout.justify && JUSTIFY_MAP[layout.justify]) {
    decls.push(['justify-content', JUSTIFY_MAP[layout.justify]]);
  }

  if (layout.padding !== undefined) {
    const padVal = resolveSpaceTokenCss(layout.padding);
    if (padVal) {
      if (node.type === 'section') {
        decls.push(['padding', `${padVal} var(--space-md)`]);
      } else {
        decls.push(['padding', padVal]);
      }
    }
  }

  return decls;
}

function buildSizeDeclarations(node, rawSize, parentLayoutMode, isBase) {
  const decls = [];
  const size = sanitizeSize(rawSize);
  const baseSize = isBase ? sanitizeSize(node.size) : null;
  const effectiveSize = size || baseSize;
  if (!effectiveSize && isBase) return decls;

  const w = effectiveSize?.w;
  if (w !== undefined) {
    if (w === 'fill') {
      if (parentLayoutMode === 'row') {
        decls.push(['flex', '1 1 0%']);
        decls.push(['width', 'auto']);
        decls.push(['min-width', '0']);
      } else {
        decls.push(['flex', '0 0 auto']);
        decls.push(['width', '100%']);
        decls.push(['min-width', '0']);
      }
    } else if (w === 'hug') {
      decls.push(['width', 'fit-content']);
      decls.push(['max-width', '100%']);
      if (parentLayoutMode === 'row') {
        decls.push(['flex', '0 0 auto']);
      }
    } else if (typeof w === 'number') {
      decls.push(['width', `${w}px`]);
      decls.push(['max-width', '100%']);
      if (parentLayoutMode === 'row') decls.push(['flex', '0 0 auto']);
    } else {
      decls.push(['width', String(w)]);
      decls.push(['max-width', '100%']);
      if (parentLayoutMode === 'row') decls.push(['flex', '0 0 auto']);
    }
  }

  const h = effectiveSize?.h;
  if (isBase || h !== undefined) {
    if (!h || h === 'hug' || h === 'auto') {
      decls.push(['height', 'auto']);
    } else {
      decls.push(['min-height', String(h)]);
      decls.push(['height', 'auto']);
    }
  }

  return decls;
}

function buildPropsDeclarations(node, rawProps) {
  const decls = [];
  const props = sanitizeProps(rawProps);
  if (!props) return decls;

  if (props.theme) {
    for (const key of ['primary', 'accent', 'surface', 'text', 'muted']) {
      if (props.theme[key]) {
        decls.push([`--color-${key}`, props.theme[key]]);
      }
    }
    if (props.theme.fontFamily && FONT_FAMILY_MAP[props.theme.fontFamily]) {
      decls.push(['font-family', FONT_FAMILY_MAP[props.theme.fontFamily]]);
    }
  }

  const bgCss = resolveSafeColorCss(props.bg, null);
  if (bgCss) decls.push(['background', bgCss]);

  const colorCss = resolveSafeColorCss(props.color, null);
  if (colorCss) decls.push(['color', colorCss]);

  if (props.radius) decls.push(['border-radius', props.radius]);

  if (props.border) {
    const borderCss = resolveSafeBorderCss(props.border);
    if (borderCss) decls.push(['border', borderCss]);
  }
  if (props.borderBottom) {
    const borderBottomCss = resolveSafeBorderCss(props.borderBottom);
    if (borderBottomCss) decls.push(['border-bottom', borderBottomCss]);
  }
  if (props.shadow) {
    decls.push(['box-shadow', SHADOW_MAP[props.shadow] || props.shadow]);
  }
  if (props.padding !== undefined && !node.layout?.padding) {
    const pad = resolveSpaceTokenCss(props.padding);
    if (pad) {
      if (node.type === 'button') {
        decls.push(['padding', `${pad} calc(${pad} * 1.6)`]);
      } else {
        decls.push(['padding', pad]);
      }
    }
  }
  if (props.fontVariant && FONT_VARIANT_MAP[props.fontVariant]) {
    decls.push(['font-size', FONT_VARIANT_MAP[props.fontVariant]]);
  }
  if (props.fontFamily && FONT_FAMILY_MAP[props.fontFamily]) {
    decls.push(['font-family', FONT_FAMILY_MAP[props.fontFamily]]);
  }
  if (props.fontWeight !== undefined) decls.push(['font-weight', String(props.fontWeight)]);
  if (props.lineHeight !== undefined) decls.push(['line-height', String(props.lineHeight)]);
  if (props.letterSpacing !== undefined) decls.push(['letter-spacing', props.letterSpacing]);
  if (props.textAlign) decls.push(['text-align', props.textAlign]);
  if (props.opacity !== undefined) decls.push(['opacity', String(props.opacity)]);
  if (props.maxWidth) {
    decls.push(['max-width', props.maxWidth]);
    decls.push(['margin-inline', 'auto']);
  }
  if (props.minHeight) decls.push(['min-height', props.minHeight]);
  if (props.aspectRatio) decls.push(['aspect-ratio', props.aspectRatio]);
  if (props.objectFit) decls.push(['object-fit', props.objectFit]);
  if (props.zIndex !== undefined) {
    decls.push(['position', node.placement === 'layer' ? 'absolute' : 'relative']);
    decls.push(['z-index', String(props.zIndex)]);
  }

  return decls;
}

function buildPlacementAndBaseTypeDeclarations(node) {
  const decls = [];

  if (node.type === 'page') {
    decls.push(['width', '100%']);
    decls.push(['min-height', '100vh']);
    decls.push(['overflow-x', 'clip']);
  } else if (node.type === 'section') {
    decls.push(['position', 'relative']);
    decls.push(['width', '100%']);
    decls.push(['overflow-x', 'clip']);
  } else if (node.type === 'button') {
    decls.push(['display', 'inline-flex']);
    decls.push(['align-items', 'center']);
    decls.push(['justify-content', 'center']);
    decls.push(['padding', 'var(--space-xs) var(--space-md)']);
    decls.push(['text-decoration', 'none']);
    decls.push(['cursor', 'pointer']);
    decls.push(['line-height', '1.2']);
    decls.push(['transition', 'transform 150ms ease, opacity 150ms ease']);
  } else if (node.type === 'blob') {
    decls.push(['border-radius', '44% 56% 62% 38% / 41% 39% 61% 59%']);
    decls.push(['aspect-ratio', '1 / 1']);
  }

  // Serbest katman merkezi ebeveyn section kutusuna göre yüzde ile sabitlenir
  if (node.placement === 'layer' && node.pos) {
    decls.push(['position', 'absolute']);
    const safeX = clampNumber(node.pos.x, 0, 100, 50);
    const safeY = clampNumber(node.pos.y, 0, 100, 50);
    const safeRot = clampNumber(node.pos.rot ?? 0, -180, 180, 0);
    decls.push(['left', `${Number(safeX.toFixed(2))}%`]);
    decls.push(['top', `${Number(safeY.toFixed(2))}%`]);
    decls.push(['transform', `translate(-50%, -50%) rotate(${Number(safeRot.toFixed(2))}deg)`]);
  }

  return decls;
}

function formatRule(selector, decls, indent = '') {
  if (!decls || decls.length === 0) return '';
  const deduped = new Map();
  for (const [prop, val] of decls) {
    if (val !== undefined && val !== null && val !== '') {
      deduped.set(prop, val);
    }
  }
  if (deduped.size === 0) return '';
  const body = Array.from(deduped.entries())
    .map(([prop, val]) => `${indent}  ${prop}: ${val};`)
    .join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

function collectRules(node, parentModes = { base: 'stack', md: 'stack', sm: 'stack' }, buckets) {
  if (!node || !node.id) return;

  const selector = `.n-${escapeClassId(node.id)}`;
  const baseParentMode = parentModes.base;
  const mdParentMode = parentModes.md;
  const smParentMode = parentModes.sm;

  const baseDecls = [
    ...buildPlacementAndBaseTypeDeclarations(node),
    ...buildLayoutDeclarations(node, node.layout, true),
    ...buildSizeDeclarations(node, node.size, baseParentMode, true),
    ...buildPropsDeclarations(node, node.props),
  ];
  const baseRule = formatRule(selector, baseDecls);
  if (baseRule) buckets.base.push(baseRule);

  const sanitizedBaseLayout = sanitizeLayout(node.layout);
  const sanitizedMdLayout = sanitizeLayout(node.responsive?.md?.layout);
  const sanitizedSmLayout = sanitizeLayout(node.responsive?.sm?.layout);

  const selfBaseMode = sanitizedBaseLayout?.mode || 'stack';
  const selfMdMode = sanitizedMdLayout?.mode || selfBaseMode;
  const selfSmMode = sanitizedSmLayout?.mode || selfMdMode;

  const mdPatch = node.responsive?.md;
  const mdLayout = mdPatch?.layout || null;
  const mdSizeOverride =
    mdPatch?.size || (node.size?.w === 'fill' && mdParentMode !== baseParentMode ? node.size : null);
  const mdDecls = [
    ...buildLayoutDeclarations(node, mdLayout, false),
    ...(mdSizeOverride ? buildSizeDeclarations(node, mdSizeOverride, mdParentMode, false) : []),
    ...buildPropsDeclarations(node, mdPatch?.props),
  ];
  const mdRule = formatRule(selector, mdDecls, '  ');
  if (mdRule) buckets.md.push(mdRule);

  const smPatch = node.responsive?.sm;
  const smLayout = smPatch?.layout || null;
  const effectiveParentBeforeSm = mdParentMode;
  const smSizeOverride =
    smPatch?.size || (node.size?.w === 'fill' && smParentMode !== effectiveParentBeforeSm ? node.size : null);
  const smDecls = [
    ...buildLayoutDeclarations(node, smLayout, false),
    ...(smSizeOverride ? buildSizeDeclarations(node, smSizeOverride, smParentMode, false) : []),
    ...buildPropsDeclarations(node, smPatch?.props),
  ];
  const smRule = formatRule(selector, smDecls, '  ');
  if (smRule) buckets.sm.push(smRule);

  if (Array.isArray(node.children)) {
    const nextParentModes = {
      base: selfBaseMode,
      md: selfMdMode,
      sm: selfSmMode,
    };
    for (const child of node.children) {
      collectRules(child, nextParentModes, buckets);
    }
  }
}

export function compileBaseCss(theme = null) {
  if (!theme) {
    return `${TOKEN_DEFINITIONS}\n\n${BASE_CSS}`;
  }
  return `${buildTokenDefinitions(theme)}\n\n${buildBaseCss(theme)}`;
}

function isProjectLike(val) {
  return Boolean(
    val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      Number(val.schemaVersion) === 2 &&
      Array.isArray(val.pages)
  );
}

/**
 * Ağacı veya çoklu sayfa projesini eksiksiz CSS metnine derler.
 * @param {object} treeOrProject - Sayfa/bölüm kök düğümü veya schemaVersion:2 proje
 * @param {{ includeBase?: boolean, theme?: object }} [options]
 * @returns {string}
 */
export function compileStyles(treeOrProject, options = {}) {
  const { includeBase = true, theme = null } = options;
  const buckets = { base: [], md: [], sm: [] };

  let effectiveTheme = theme;
  if (isProjectLike(treeOrProject)) {
    effectiveTheme = effectiveTheme || treeOrProject.theme || null;
    for (const page of treeOrProject.pages) {
      if (page?.tree) {
        collectRules(page.tree, { base: 'stack', md: 'stack', sm: 'stack' }, buckets);
      }
    }
  } else if (Array.isArray(treeOrProject)) {
    for (const item of treeOrProject) {
      collectRules(item, { base: 'stack', md: 'stack', sm: 'stack' }, buckets);
    }
  } else if (treeOrProject) {
    collectRules(treeOrProject, { base: 'stack', md: 'stack', sm: 'stack' }, buckets);
  }

  const parts = [];
  if (includeBase) {
    parts.push(compileBaseCss(effectiveTheme));
  }
  if (buckets.base.length > 0) {
    parts.push(`/* Düğüm stilleri */\n${buckets.base.join('\n\n')}`);
  }

  const mdBlock =
    buckets.md.length > 0 ? `@media (max-width: 1024px) {\n${buckets.md.join('\n\n')}\n}` : '';
  const smRules = [
    `  :root {\n    --space-xl: 2.75rem;\n    --space-lg: 1.75rem;\n  }`,
    ...buckets.sm,
  ].filter(Boolean);
  const smBlock =
    smRules.length > 0 ? `@media (max-width: 640px) {\n${smRules.join('\n\n')}\n}` : '';

  if (mdBlock) parts.push(mdBlock);
  if (smBlock) parts.push(smBlock);

  return parts.join('\n\n');
}

export default compileStyles;
