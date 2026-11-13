/**
 * Shared CSS & attribute catalog search and keyboard navigation helpers.
 * Used by both the docked PropertiesPanel and the floating AttributesCssInspectorModal.
 */

/**
 * Convert a kebab-case CSS property name to React camelCase style key.
 * Preserves CSS custom properties (`--foo-bar`) unchanged.
 * @param {string} prop
 * @returns {string}
 */
export const toCamelCaseCss = (prop = '') => {
  const trimmed = String(prop).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('--')) return trimmed;
  return trimmed.replace(/-([a-z0-9])/gi, (_, char) => char.toUpperCase());
};

/**
 * Convert a React camelCase CSS property key to standard kebab-case.
 * Preserves CSS custom properties (`--foo-bar`) unchanged.
 * @param {string} prop
 * @returns {string}
 */
export const toKebabCaseCss = (prop = '') => {
  const trimmed = String(prop).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('--')) return trimmed;
  return trimmed.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
};

const normalizeSearchText = (text = '') =>
  String(text)
    .toLocaleLowerCase('tr-TR')
    .replace(/[-_]+/g, ' ')
    .trim();

const scoreCatalogMatch = (item, rawQuery) => {
  const qLower = rawQuery.toLowerCase().trim();
  const qNorm = normalizeSearchText(rawQuery);
  if (!qLower) return 1;

  const key = String(item.key || '');
  const kebab = toKebabCaseCss(key);
  const label = String(item.label || item.key || '');
  const description = String(item.description || '');

  const keyLower = key.toLowerCase();
  const kebabLower = kebab.toLowerCase();
  const labelLower = label.toLocaleLowerCase('tr-TR');
  const descLower = description.toLocaleLowerCase('tr-TR');

  if (keyLower === qLower || kebabLower === qLower) return 100;
  if (kebabLower.startsWith(qLower) || keyLower.startsWith(qLower)) return 90;

  const normalizedKey = normalizeSearchText(kebab);
  if (normalizedKey.startsWith(qNorm)) return 85;

  const labelWords = labelLower.split(/[\s()/-]+/).filter(Boolean);
  if (labelWords.some((word) => word.startsWith(qLower) || word.startsWith(qNorm))) {
    return 75;
  }

  if (
    kebabLower.includes(qLower) ||
    keyLower.includes(qLower) ||
    normalizedKey.includes(qNorm)
  ) {
    return 60;
  }

  if (labelLower.includes(qLower) || normalizeSearchText(label).includes(qNorm)) {
    return 50;
  }

  if (descLower && (descLower.includes(qLower) || normalizeSearchText(description).includes(qNorm))) {
    return 35;
  }

  return 0;
};

/**
 * Filter and rank catalog entries (`{ key, label, ... }`) for a search query.
 * Excluded keys are omitted before scoring.
 * @param {Array<{key: string, label?: string}>} catalog
 * @param {string} query
 * @param {string[]|Set<string>} excludedKeys
 * @returns {Array}
 */
export const filterPropertyCatalog = (catalog = [], query = '', excludedKeys = []) => {
  const excludedSet =
    excludedKeys instanceof Set
      ? excludedKeys
      : new Set((excludedKeys || []).map((k) => String(k)));

  const q = String(query || '').trim();
  const scored = [];

  for (let i = 0; i < catalog.length; i += 1) {
    const item = catalog[i];
    if (!item || !item.key || excludedSet.has(item.key)) continue;
    const score = scoreCatalogMatch(item, q);
    if (score > 0) {
      scored.push({ item, score, index: i });
    }
  }

  if (q) {
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));
  }

  return scored.map((entry) => entry.item);
};

/**
 * Wrap-around index movement for ArrowDown (+1) / ArrowUp (-1).
 * @param {number} currentIndex
 * @param {number} delta
 * @param {number} itemCount
 * @returns {number}
 */
export const moveHighlightIndex = (currentIndex, delta, itemCount) => {
  if (!itemCount || itemCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return delta >= 0 ? 0 : itemCount - 1;
  }
  return (currentIndex + delta + itemCount) % itemCount;
};

/**
 * Determine which catalog entry (or custom property) should be added on Enter.
 * Returns null if nothing valid can be added.
 * @param {object} params
 * @returns {object|null}
 */
export const resolveCatalogSelectionOnEnter = ({
  query = '',
  filteredItems = [],
  highlightedIndex = 0,
  allowCustomCssProp = true,
} = {}) => {
  if (filteredItems.length > 0) {
    const safeIdx =
      highlightedIndex >= 0 && highlightedIndex < filteredItems.length ? highlightedIndex : 0;
    return filteredItems[safeIdx];
  }

  const trimmed = String(query || '').trim();
  if (!allowCustomCssProp || !trimmed) return null;

  // Accept valid CSS identifier or custom property (`--var-name`)
  if (/^(--)?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed)) {
    return {
      key: toCamelCaseCss(trimmed),
      label: toKebabCaseCss(trimmed),
      type: 'text',
      default: '',
      isCustom: true,
    };
  }

  return null;
};

/**
 * Clamp and move/resize a floating palette rectangle within viewport bounds.
 * Keeps title bar accessible even when the browser window resizes.
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @param {{width: number, height: number}} viewport
 * @param {{minWidth?: number, minHeight?: number}} limits
 */
export const clampFloatingRect = (
  rect,
  viewport = { width: 1280, height: 800 },
  limits = { minWidth: 360, minHeight: 340 }
) => {
  const vw = Math.max(320, Number(viewport?.width) || 1280);
  const vh = Math.max(240, Number(viewport?.height) || 800);
  const minW = Math.min(limits.minWidth || 360, vw - 24);
  const minH = Math.min(limits.minHeight || 340, vh - 24);

  const width = Math.min(Math.max(Number(rect?.width) || 520, minW), vw - 24);
  const height = Math.min(Math.max(Number(rect?.height) || 560, minH), vh - 24);
  const maxX = Math.max(12, vw - width - 12);
  const maxY = Math.max(12, vh - height - 12);
  const x = Math.min(Math.max(Number(rect?.x) || 24, 12), maxX);
  const y = Math.min(Math.max(Number(rect?.y) || 64, 12), maxY);

  return { x, y, width, height };
};
