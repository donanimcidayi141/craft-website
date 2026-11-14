import React from 'react';
import {
  TEXT_TAGS,
  parsePageHref,
  sanitizePlainText,
  validateButtonHref,
  validateImageSrc,
} from './schema.js';

/**
 * Saf ağaç dönüştürücü çekirdeği (JSX içermez; Node, SSR ve tarayıcıda ek derleme gerektirmeden çalışır).
 * - `mode: 'edit'`: seçim/eşleştirme için `data-node-id` ekler, editör etkileşim korumalarını uygular (`page:` yönlendirmesi yapmaz).
 * - `mode: 'publish'`: `data-node-id` ve editör öznitelikleri OLMADAN yalnızca `.n-<id>` ve semantik HTML üretir; `linkMap` varsa `page:<id>` bağlarını yayın hedefine çözer.
 */

const SAFE_TEXT_TAGS = new Set(TEXT_TAGS);

export function resolveTextTag(props) {
  if (SAFE_TEXT_TAGS.has(props?.tag)) return props.tag;
  const lvl = Number(props?.level);
  if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 4) {
    return `h${lvl}`;
  }
  return 'p';
}

export function resolvePublishedHref(rawHref, mode, linkMap = null) {
  if (mode === 'edit') {
    const targetPageId = parsePageHref(rawHref);
    if (targetPageId) return '#';
  }
  const hrefRes = validateButtonHref(rawHref);
  if (!hrefRes.ok) return '#';
  const targetPageId = parsePageHref(hrefRes.value);
  if (targetPageId) {
    if (linkMap && Object.prototype.hasOwnProperty.call(linkMap, targetPageId)) {
      return linkMap[targetPageId];
    }
    return '#';
  }
  return hrefRes.value;
}

function renderChildren(children, mode, linkMap) {
  if (!Array.isArray(children) || children.length === 0) return null;
  return children.map((child) => renderNode(child, mode, linkMap));
}

function renderNode(node, mode, linkMap) {
  if (!node || !node.id) return null;

  const isEdit = mode === 'edit';
  const props = node.props || {};
  const commonProps = {
    key: node.id,
    className: `n-${node.id}`,
  };
  if (isEdit) {
    commonProps['data-node-id'] = node.id;
  }

  switch (node.type) {
    case 'page':
      return React.createElement('main', commonProps, renderChildren(node.children, mode, linkMap));

    case 'section':
      return React.createElement('section', commonProps, renderChildren(node.children, mode, linkMap));

    case 'container':
      return React.createElement('div', commonProps, renderChildren(node.children, mode, linkMap));

    case 'text': {
      const tag = resolveTextTag(props);
      const content =
        props.text !== undefined
          ? sanitizePlainText(props.text, 2000)
          : renderChildren(node.children, mode, linkMap);
      return React.createElement(tag, commonProps, content);
    }

    case 'button': {
      const safeLabel = sanitizePlainText(props.label || props.text || 'Buton', 300);
      if (props.href !== undefined && props.href !== '') {
        const safeHref = resolvePublishedHref(props.href, mode, linkMap);
        const anchorProps = {
          ...commonProps,
          href: safeHref,
        };
        if (isEdit) anchorProps.tabIndex = -1;
        return React.createElement('a', anchorProps, safeLabel);
      }
      const btnProps = {
        ...commonProps,
        type: 'button',
      };
      if (isEdit) btnProps.tabIndex = -1;
      return React.createElement('button', btnProps, safeLabel);
    }

    case 'image': {
      const srcRes = validateImageSrc(props.src);
      const safeSrc = srcRes.ok ? srcRes.value : '';
      const safeAlt = sanitizePlainText(props.alt || '', 500);
      const imgProps = {
        ...commonProps,
        alt: safeAlt,
      };
      if (safeSrc) {
        imgProps.src = safeSrc;
      }
      if (isEdit) {
        imgProps.draggable = false;
      } else {
        imgProps.loading = 'lazy';
      }
      return React.createElement('img', imgProps);
    }

    case 'blob':
      return React.createElement('div', { ...commonProps, 'aria-hidden': 'true' });

    default:
      return React.createElement('div', commonProps, renderChildren(node.children, mode, linkMap));
  }
}

/**
 * Ağacı saf React eleman ağacına dönüştürür.
 * @param {object|Array} tree
 * @param {{ mode?: 'edit' | 'publish', linkMap?: Record<string, string> }} [options]
 */
export function renderTree(tree, options = {}) {
  const { mode = 'publish', linkMap = null } = options;
  if (!tree) return null;
  if (Array.isArray(tree)) {
    return tree.map((node) => renderNode(node, mode, linkMap));
  }
  return renderNode(tree, mode, linkMap);
}

export default renderTree;
