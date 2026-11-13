import { isVoidTag } from '../data/tagRegistry.js';

/**
 * Serializes an element into clean, formatted HTML code.
 */
export function elementToHtml(el) {
  if (!el) return '';
  const tag = (el.type || 'div').toLowerCase();
  const isVoid = isVoidTag(tag);

  // Collect attributes
  const attrs = { ...(el.attrs || {}) };
  
  // Format attributes into string
  const attrParts = [];
  
  // Ensure id and class are first if present
  if (attrs.id) {
    attrParts.push(`id="${escapeAttr(attrs.id)}"`);
  }
  if (attrs.class) {
    attrParts.push(`class="${escapeAttr(attrs.class)}"`);
  }

  // Other attributes
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'id' || key === 'class') return;
    if (val === undefined || val === null || val === false || val === '') return;
    if (val === true) {
      attrParts.push(key);
    } else {
      attrParts.push(`${key}="${escapeAttr(String(val))}"`);
    }
  });

  const attrStr = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  if (isVoid) {
    return `<${tag}${attrStr} />`;
  }

  const content = el.textContent !== undefined && el.textContent !== null ? el.textContent : '';
  const hasChildren = Array.isArray(el.children) && el.children.length > 0;

  if (hasChildren) {
    const childrenHtml = el.children.map(child => elementToHtml(child).split('\n').map(l => '  ' + l).join('\n')).join('\n');
    const contentPart = content ? `\n  ${content}\n` : '\n';
    return `<${tag}${attrStr}>${content ? contentPart + childrenHtml : '\n' + childrenHtml + '\n'}</${tag}>`;
  }

  // If content has multiple lines or is long
  if (content.length > 40 || content.includes('\n')) {
    return `<${tag}${attrStr}>\n  ${content}\n</${tag}>`;
  }

  return `<${tag}${attrStr}>${content}</${tag}>`;
}

/**
 * Parses an HTML string into AST element data { type, attrs, textContent }.
 */
export function htmlToElementData(htmlString) {
  if (!htmlString || !htmlString.trim()) return null;

  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString.trim(), 'text/html');
      const root = doc.body.firstElementChild;
      if (root) {
        const type = root.tagName.toLowerCase();
        const attrs = {};

        for (let i = 0; i < root.attributes.length; i++) {
          const a = root.attributes[i];
          attrs[a.name] = a.value === '' ? true : a.value;
        }

        const textContent = isVoidTag(type) ? '' : root.textContent.trim();

        return {
          type,
          attrs,
          textContent
        };
      }
    }
  } catch (err) {
    // continue to fallback
  }

  // Fallback regex parser for Node / non-DOM environments
  try {
    const trimmed = htmlString.trim();
    const tagMatch = trimmed.match(/^<([a-zA-Z0-9_-]+)([^>]*)>(?:([\s\S]*?)<\/\1>)?$/i) 
      || trimmed.match(/^<([a-zA-Z0-9_-]+)([^>]*?)\/?>$/i);

    if (!tagMatch) return null;

    const type = tagMatch[1].toLowerCase();
    const rawAttrs = tagMatch[2] || '';
    const textContent = isVoidTag(type) ? '' : (tagMatch[3] || '').trim();

    const attrs = {};
    const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:["']([^"']*)["']|([^>\s]+)))?/g;
    let match;
    while ((match = attrRegex.exec(rawAttrs)) !== null) {
      const name = match[1];
      const val = match[2] !== undefined ? match[2] : match[3];
      attrs[name] = val !== undefined ? val : true;
    }

    return {
      type,
      attrs,
      textContent
    };
  } catch (err) {
    console.warn('HTML parse error:', err);
    return null;
  }
}

/**
 * Serializes a style object into standard CSS declarations string.
 */
export function styleObjectToCss(style = {}) {
  if (!style) return '';

  return Object.entries(style)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      // camelCase to kebab-case
      const kebab = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebab}: ${v};`;
    })
    .join('\n');
}

/**
 * Parses CSS declarations string into a style object (camelCase keys).
 */
export function cssToStyleObject(cssString = '') {
  if (!cssString) return {};

  const style = {};
  const rules = cssString.split(';');

  for (const rule of rules) {
    const colonIdx = rule.indexOf(':');
    if (colonIdx !== -1) {
      const prop = rule.slice(0, colonIdx).trim();
      const val = rule.slice(colonIdx + 1).trim();
      if (prop && val) {
        // kebab-case to camelCase
        const camel = prop.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        style[camel] = val;
      }
    }
  }

  return style;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
