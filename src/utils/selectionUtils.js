import { findNodeAndParent, getNodePath } from './treeUtils.js';

export const ATOMIC_WRAPPER_TAGS = new Set(['a', 'button', 'label']);

export const TEXT_EDITABLE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'button', 'label',
  'blockquote', 'text', 'badge',
]);

/**
 * Returns true if the HTML tag acts as an atomic semantic wrapper (e.g. <a>, <button>)
 * whose children must stay bound unless explicitly unwrapped or reparented from Layers.
 */
export function isAtomicWrapperTag(tag) {
  return ATOMIC_WRAPPER_TAGS.has(String(tag || '').toLowerCase());
}

/**
 * Returns true if a node supports inline text editing directly on its own textContent
 * (i.e. it does not wrap child elements).
 */
export function isLeafTextEditable(node) {
  if (!node) return false;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (hasChildren) return false;
  const tag = String(node.type || '').toLowerCase();
  return (
    TEXT_EDITABLE_TAGS.has(tag) ||
    typeof node.textContent === 'string' ||
    typeof node.content === 'string'
  );
}

/**
 * Computes the sibling array visible at the active isolation scope (`editingGroupId`).
 */
export function getScopeChildren(elements = [], editingGroupId = null) {
  if (!editingGroupId) return Array.isArray(elements) ? elements : [];
  const found = findNodeAndParent(elements, editingGroupId);
  if (found && found.node && Array.isArray(found.node.children)) {
    return found.node.children;
  }
  return Array.isArray(elements) ? elements : [];
}

/**
 * Computes the parent scope ID one level above `editingGroupId` (used by Esc / Breadcrumb).
 */
export function getParentScopeId(elements = [], editingGroupId = null) {
  if (!editingGroupId) return null;
  const found = findNodeAndParent(elements, editingGroupId);
  return found?.parent ? found.parent.id : null;
}

/**
 * Resolves which element in a nested tree should be targeted when the pointer hits
 * `deepestClickedId`, respecting isolation scope (`editingGroupId`) and Ctrl+Click xray selection.
 */
export function resolveSelectionTarget(elements = [], deepestClickedId, editingGroupId = null, options = {}) {
  const { ctrlKey = false } = options;
  if (!deepestClickedId) {
    return { targetId: null, nextEditingGroupId: editingGroupId || null, path: [] };
  }

  const path = getNodePath(elements, deepestClickedId);
  if (!path || path.length === 0) {
    return { targetId: null, nextEditingGroupId: null, path: [] };
  }

  // Ctrl+Click (Direct Deep Select): bypass wrappers straight to the deepest node under cursor
  if (ctrlKey) {
    const parentInPath = path.length >= 2 ? path[path.length - 2].id : null;
    return {
      targetId: deepestClickedId,
      nextEditingGroupId: parentInPath,
      path,
    };
  }

  if (editingGroupId) {
    const scopeIdx = path.findIndex(n => n.id === editingGroupId);
    if (scopeIdx >= 0 && scopeIdx < path.length - 1) {
      return {
        targetId: path[scopeIdx + 1].id,
        nextEditingGroupId: editingGroupId,
        path,
      };
    }
    if (scopeIdx === path.length - 1) {
      return {
        targetId: editingGroupId,
        nextEditingGroupId: editingGroupId,
        path,
      };
    }
    // Clicked outside the active scope -> cleanly exit to root level and select outermost container
    return {
      targetId: path[0].id,
      nextEditingGroupId: null,
      path,
    };
  }

  return {
    targetId: path[0].id,
    nextEditingGroupId: null,
    path,
  };
}

/**
 * Determines double-click behavior on a nested tree:
 * - Containers/wrappers with children step one layer deeper (enter isolation scope & select clicked child)
 * - Leaf text nodes open inline text editing
 * - Ctrl+DoubleClick drills immediately to the deepest leaf text node
 */
export function resolveDoubleClickAction(elements = [], deepestClickedId, editingGroupId = null, options = {}) {
  const { ctrlKey = false } = options;
  const path = getNodePath(elements, deepestClickedId);
  if (!path || path.length === 0) return { action: 'none' };

  if (ctrlKey) {
    const leafNode = path[path.length - 1];
    const parentId = path.length >= 2 ? path[path.length - 2].id : null;
    if (isLeafTextEditable(leafNode)) {
      return {
        action: 'edit_text',
        targetId: leafNode.id,
        nextEditingGroupId: parentId,
      };
    }
    return {
      action: 'select',
      targetId: leafNode.id,
      nextEditingGroupId: parentId,
    };
  }

  const { targetId, nextEditingGroupId } = resolveSelectionTarget(
    elements,
    deepestClickedId,
    editingGroupId,
    { ctrlKey: false }
  );
  if (!targetId) return { action: 'none' };

  const targetIndex = path.findIndex(n => n.id === targetId);
  const targetNode = targetIndex >= 0 ? path[targetIndex] : findNodeAndParent(elements, targetId)?.node;
  if (!targetNode) return { action: 'none' };

  const hasChildren = Array.isArray(targetNode.children) && targetNode.children.length > 0;
  if (hasChildren) {
    const childAlongPath = targetIndex >= 0 && targetIndex + 1 < path.length
      ? path[targetIndex + 1]
      : targetNode.children[0];
    return {
      action: 'enter_group',
      groupId: targetNode.id,
      nextSelectedId: childAlongPath?.id || targetNode.id,
    };
  }

  if (isLeafTextEditable(targetNode)) {
    return {
      action: 'edit_text',
      targetId: targetNode.id,
      nextEditingGroupId,
    };
  }

  return {
    action: 'select',
    targetId: targetNode.id,
    nextEditingGroupId,
  };
}

/**
 * Prevents accidental drag-unparenting out of atomic semantic wrappers like <a> and <button>.
 */
export function shouldAllowDragUnparent(elements = [], draggedId) {
  if (!draggedId) return false;
  const found = findNodeAndParent(elements, draggedId);
  if (!found || !found.parent) return false;
  if (found.parent.isAtomicWrapper || isAtomicWrapperTag(found.parent.type)) {
    return false;
  }
  return true;
}

/**
 * Computes a legible default text color based on a background color hex string.
 */
export function getAutoContrastTextColor(bgColor = '#ffffff') {
  const str = String(bgColor || '').trim();
  const hexMatch = str.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);
  if (!hexMatch) {
    if (str.includes('#0f172a') || str.includes('#18181b') || str.includes('#000')) {
      return '#f8fafc';
    }
    return '#0f172a';
  }
  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.52 ? '#f8fafc' : '#0f172a';
}
