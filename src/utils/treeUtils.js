import { isVoidTag } from '../data/tagRegistry.js';

// Non-container tags that should not become automatic parents
const NON_CONTAINER_TAGS = new Set([
  'input', 'img', 'hr', 'br', 'button', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
  'a', 'strong', 'em', 'b', 'i', 'small', 'textarea', 'label', 'video', 'audio'
]);

export function canHaveChildren(tagOrNode) {
  if (!tagOrNode) return true;
  const tag = typeof tagOrNode === 'string' ? tagOrNode : (tagOrNode.type || 'div');
  const lower = String(tag).toLowerCase();
  if (isVoidTag(lower)) return false;
  return true;
}

export function isExplicitContainer(tagOrNode) {
  if (!tagOrNode) return true;
  const tag = typeof tagOrNode === 'string' ? tagOrNode : (tagOrNode.type || 'div');
  const lower = String(tag).toLowerCase();
  if (isVoidTag(lower)) return false;
  if (NON_CONTAINER_TAGS.has(lower)) return false;
  return true;
}

/**
 * 🔄 MIGRATION FUNCTION:
 * Converts flat array of elements (with canvas-absolute x, y) into a true nested tree.
 * Preserves relative coordinates: child.x and child.y are relative to parent.
 */
export function migrateFlatToNestedTree(elements) {
  if (!Array.isArray(elements) || elements.length === 0) return [];

  // Check if elements are already a tree with children
  const alreadyNested = elements.some(el => Array.isArray(el.children) && el.children.length > 0);
  if (alreadyNested) {
    // Ensure all elements have children array initialized
    return sanitizeTree(elements);
  }

  // Deep clone elements to avoid mutating original objects
  const cloned = elements.map(el => ({
    ...el,
    children: Array.isArray(el.children) ? [...el.children] : []
  }));

  // Sort candidate containers by area descending (largest container encloses others)
  // Non-containers cannot be parents in auto-migration
  const containerCandidates = cloned.filter(el => isExplicitContainer(el.type));
  containerCandidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  const parentMap = {}; // childId -> parentId
  const assignedAsChildren = new Set();

  cloned.forEach(child => {
    // Find the smallest enclosing container
    let bestParent = null;
    let smallestParentArea = Infinity;

    containerCandidates.forEach(parent => {
      if (parent.id === child.id) return;
      // Geometric containment check
      const isContained = (
        child.x >= parent.x - 5 &&
        child.y >= parent.y - 5 &&
        (child.x + child.width) <= (parent.x + parent.width + 15) &&
        (child.y + child.height) <= (parent.y + parent.height + 15)
      );

      if (isContained) {
        const area = parent.width * parent.height;
        if (area < smallestParentArea) {
          smallestParentArea = area;
          bestParent = parent;
        }
      }
    });

    if (bestParent) {
      parentMap[child.id] = bestParent.id;
      assignedAsChildren.add(child.id);
    }
  });

  // Convert child absolute coordinates to relative coordinates
  cloned.forEach(child => {
    const parentId = parentMap[child.id];
    if (parentId) {
      const parent = cloned.find(p => p.id === parentId);
      if (parent) {
        child.x = Math.round(child.x - parent.x);
        child.y = Math.round(child.y - parent.y);
        parent.children.push(child);
      }
    }
  });

  // Return only root level elements
  const roots = cloned.filter(el => !assignedAsChildren.has(el.id));
  return sanitizeTree(roots);
}

/**
 * Ensures all nodes in the tree have valid children: [] arrays and necessary defaults.
 */
export function sanitizeTree(tree) {
  if (!Array.isArray(tree)) return [];
  return tree.map(node => {
    const sanitizedNode = {
      ...node,
      children: Array.isArray(node.children) ? sanitizeTree(node.children) : []
    };
    return sanitizedNode;
  });
}

/**
 * Finds a node, its parent, index among siblings, and path of ancestors.
 */
export function findNodeAndParent(tree, id, parent = null, index = 0, currentPath = []) {
  if (!Array.isArray(tree) || !id) return null;

  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    const path = [...currentPath, node];

    if (node.id === id) {
      return { node, parent, index: i, path };
    }

    if (node.children && node.children.length > 0) {
      const found = findNodeAndParent(node.children, id, node, i, path);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Returns array of ancestor nodes from root to target node: [RootNode, Section, Card, Button]
 */
export function getNodePath(tree, id) {
  const result = findNodeAndParent(tree, id);
  return result ? result.path : [];
}

/**
 * Computes canvas-absolute coordinates by summing relative x/y up through ancestors.
 */
export function getAbsoluteCoords(tree, id) {
  const result = findNodeAndParent(tree, id);
  if (!result) return { x: 0, y: 0, width: 0, height: 0 };

  const { path } = result;
  let absX = 0;
  let absY = 0;

  const toNum = (val, fallback = 0) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  path.forEach(item => {
    absX += toNum(item.x, 0);
    absY += toNum(item.y, 0);
  });

  const target = path[path.length - 1];
  return {
    x: absX,
    y: absY,
    width: toNum(target?.width, 100),
    height: toNum(target?.height, 40)
  };
}

/**
 * Immutably updates a node in the tree by ID.
 */
export function updateNodeInTree(tree, id, updatesOrFn) {
  if (!Array.isArray(tree)) return [];

  return tree.map(node => {
    if (node.id === id) {
      const updates = typeof updatesOrFn === 'function' ? updatesOrFn(node) : updatesOrFn;
      let newChildren = updates.children !== undefined ? updates.children : node.children;

      // Auto-boundary safety: if container width/height was changed, ensure direct children don't overflow
      if (Array.isArray(newChildren) && newChildren.length > 0) {
        const newW = updates.width !== undefined ? updates.width : node.width;
        const newH = updates.height !== undefined ? updates.height : node.height;
        if (typeof newW === 'number' && newW > 0) {
          newChildren = newChildren.map(c => {
            let cx = c.x;
            let cy = c.y;
            if (typeof cx === 'number' && typeof c.width === 'number' && cx + c.width > newW - 8) {
              cx = Math.max(8, Math.round(newW - c.width - 8));
            }
            if (typeof newH === 'number' && newH > 0 && typeof cy === 'number' && typeof c.height === 'number' && cy + c.height > newH - 8) {
              cy = Math.max(8, Math.round(newH - c.height - 8));
            }
            if (cx !== c.x || cy !== c.y) {
              return { ...c, x: cx, y: cy };
            }
            return c;
          });
        }
      }

      return {
        ...node,
        ...updates,
        children: newChildren
      };
    }

    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, id, updatesOrFn)
      };
    }

    return node;
  });
}

/**
 * Immutably updates multiple nodes across the tree using a map: { [id]: updates }
 */
export function updateMultipleNodesInTree(tree, updatesMap) {
  if (!Array.isArray(tree) || !updatesMap) return tree;

  return tree.map(node => {
    let updatedNode = node;
    if (updatesMap[node.id]) {
      updatedNode = { ...node, ...updatesMap[node.id] };
    }

    if (updatedNode.children && updatedNode.children.length > 0) {
      updatedNode = {
        ...updatedNode,
        children: updateMultipleNodesInTree(updatedNode.children, updatesMap)
      };
    }

    return updatedNode;
  });
}

/**
 * Removes a node by ID from anywhere in the tree.
 * Returns { newTree, removedNode }
 */
export function removeNodeFromTree(tree, id) {
  if (!Array.isArray(tree)) return { newTree: [], removedNode: null };

  let removedNode = null;

  function filterTree(nodes) {
    const nextNodes = [];
    for (const node of nodes) {
      if (node.id === id) {
        removedNode = node;
        continue;
      }
      if (node.children && node.children.length > 0) {
        const { newTree: filteredChildren, removedNode: childRemoved } = removeNodeFromTree(node.children, id);
        if (childRemoved) removedNode = childRemoved;
        nextNodes.push({ ...node, children: filteredChildren });
      } else {
        nextNodes.push(node);
      }
    }
    return nextNodes;
  }

  const newTree = filterTree(tree);
  return { newTree, removedNode };
}

/**
 * Inserts a node into a target parent (or root level if targetParentId is null/undefined)
 */
export function insertNodeIntoTree(tree, targetParentId, node, index = -1) {
  if (!node) return tree;

  // Insert at root level
  if (!targetParentId) {
    const nextTree = [...tree];
    if (index >= 0 && index <= nextTree.length) {
      nextTree.splice(index, 0, node);
    } else {
      nextTree.push(node);
    }
    return nextTree;
  }

  return tree.map(item => {
    if (item.id === targetParentId) {
      const nextChildren = [...(item.children || [])];
      if (index >= 0 && index <= nextChildren.length) {
        nextChildren.splice(index, 0, node);
      } else {
        nextChildren.push(node);
      }
      return { ...item, children: nextChildren };
    }

    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: insertNodeIntoTree(item.children, targetParentId, node, index)
      };
    }

    return item;
  });
}

/**
 * Moves / reparents a node in the tree.
 * Automatically recalculates relative coordinates so visual screen position does not jump!
 */
export function reparentNodeInTree(tree, sourceId, targetParentId, targetIndex = -1) {
  // 1. Get source absolute coordinates
  const sourceAbs = getAbsoluteCoords(tree, sourceId);
  const found = findNodeAndParent(tree, sourceId);
  if (!found) return tree;

  const currentParentId = found.parent ? found.parent.id : null;
  if (currentParentId === targetParentId && targetIndex === found.index) {
    return tree; // No change needed
  }

  // 2. Remove node from old location
  const { newTree: treeWithoutNode, removedNode } = removeNodeFromTree(tree, sourceId);
  if (!removedNode) return tree;

  // 3. Calculate new relative coordinates
  let newRelX = sourceAbs.x;
  let newRelY = sourceAbs.y;

  if (targetParentId) {
    const targetParentAbs = getAbsoluteCoords(treeWithoutNode, targetParentId);
    newRelX = Math.round(sourceAbs.x - targetParentAbs.x);
    newRelY = Math.round(sourceAbs.y - targetParentAbs.y);
  }

  const updatedNode = {
    ...removedNode,
    x: newRelX,
    y: newRelY
  };

  // 4. Insert at new location
  return insertNodeIntoTree(treeWithoutNode, targetParentId, updatedNode, targetIndex);
}

/**
 * Flattens all nodes in the tree into a single array (preorder traversal).
 */
export function flattenTree(tree) {
  const result = [];
  function traverse(nodes) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  }
  traverse(tree);
  return result;
}

/**
 * Deep clones a plain JSON-serializable object safely.
 */
function deepClonePlain(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClonePlain);
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    copy[k] = deepClonePlain(v);
  }
  return copy;
}

let _cloneSeq = 0;

function generateFreshNodeId() {
  _cloneSeq = (_cloneSeq + 1) % 100000;
  return `elem-${Date.now()}-${_cloneSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

function collectSubtreeIdMap(node, idMap = new Map()) {
  if (!node || typeof node !== 'object') return idMap;
  if (node.id) {
    idMap.set(node.id, generateFreshNodeId());
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectSubtreeIdMap(child, idMap));
  }
  return idMap;
}

function cloneNodeUsingIdMap(node, offset = 0, idMap = new Map(), { appendCopySuffix = true } = {}) {
  const newId = (node.id && idMap.get(node.id)) || generateFreshNodeId();
  const dx = typeof offset === 'object' && offset !== null ? (offset.dx || 0) : (offset || 0);
  const dy = typeof offset === 'object' && offset !== null ? (offset.dy || 0) : (offset || 0);

  const clonedResponsive = node.responsive ? deepClonePlain(node.responsive) : undefined;
  if (clonedResponsive && (dx !== 0 || dy !== 0)) {
    for (const vp of Object.keys(clonedResponsive)) {
      if (clonedResponsive[vp] && typeof clonedResponsive[vp] === 'object') {
        if (typeof clonedResponsive[vp].x === 'number') {
          clonedResponsive[vp].x = Math.round(clonedResponsive[vp].x + dx);
        }
        if (typeof clonedResponsive[vp].y === 'number') {
          clonedResponsive[vp].y = Math.round(clonedResponsive[vp].y + dy);
        }
      }
    }
  }

  const baseName = node.name || node.type || 'Öğe';
  const nextName = appendCopySuffix
    ? (baseName.endsWith('(Kopya)') ? baseName : `${baseName} (Kopya)`)
    : baseName;

  const clonedEvents = node.events ? deepClonePlain(node.events) : undefined;
  if (clonedEvents?.onClick?.targetElementId && idMap.has(clonedEvents.onClick.targetElementId)) {
    clonedEvents.onClick.targetElementId = idMap.get(clonedEvents.onClick.targetElementId);
  }

  const clonedSliderConfig = node.sliderConfig ? deepClonePlain(node.sliderConfig) : undefined;
  if (clonedSliderConfig && Array.isArray(clonedSliderConfig.slideIds)) {
    clonedSliderConfig.slideIds = clonedSliderConfig.slideIds.map((sid) => idMap.get(sid) || sid);
  }

  const remappedSliderTargetId = node.sliderTargetId && idMap.has(node.sliderTargetId)
    ? idMap.get(node.sliderTargetId)
    : node.sliderTargetId;

  const cloned = {
    ...node,
    id: newId,
    name: nextName,
    attrs: node.attrs ? deepClonePlain(node.attrs) : undefined,
    style: node.style ? deepClonePlain(node.style) : undefined,
    gradient: node.gradient ? deepClonePlain(node.gradient) : undefined,
    borderRadiusCorners: node.borderRadiusCorners ? deepClonePlain(node.borderRadiusCorners) : undefined,
    animation: node.animation ? deepClonePlain(node.animation) : undefined,
    ...(clonedEvents ? { events: clonedEvents } : {}),
    ...(clonedSliderConfig ? { sliderConfig: clonedSliderConfig } : {}),
    ...(remappedSliderTargetId ? { sliderTargetId: remappedSliderTargetId } : {}),
    x: Math.round((node.x || 0) + dx),
    y: Math.round((node.y || 0) + dy),
    children: Array.isArray(node.children)
      ? node.children.map((child) => cloneNodeUsingIdMap(child, 0, idMap, { appendCopySuffix }))
      : [],
  };

  if (clonedResponsive) {
    cloned.responsive = clonedResponsive;
  }

  return cloned;
}

/**
 * Deep clones nodes with new unique IDs (for copy / paste / duplicate).
 * Optionally supports { dx, dy } object or numeric offset, and offsets responsive coordinates too.
 */
export function cloneSubtreeWithNewIds(node, offset = 20) {
  const idMap = collectSubtreeIdMap(node);
  return cloneNodeUsingIdMap(node, offset, idMap, { appendCopySuffix: true });
}

/**
 * Deep clones a Canva-style preset AST tree with fresh unique IDs, clean element names,
 * and remapped internal references (e.g. slider controls & dots).
 */
export function clonePresetSubtree(node, placement = {}) {
  const idMap = collectSubtreeIdMap(node);
  const cloned = cloneNodeUsingIdMap(node, 0, idMap, { appendCopySuffix: false });
  if (typeof placement.x === 'number') cloned.x = Math.round(placement.x);
  if (typeof placement.y === 'number') cloned.y = Math.round(placement.y);
  return cloned;
}

/**
 * Groups selected nodes under a new container <div>.
 * Selected nodes must have the same parent (siblings).
 */
export function groupSelectedNodes(tree, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length <= 1) return tree;

  // Verify all selected nodes share the same direct parent
  const parentIds = new Set();
  const selectedNodes = [];

  selectedIds.forEach(id => {
    const found = findNodeAndParent(tree, id);
    if (found) {
      parentIds.add(found.parent ? found.parent.id : null);
      selectedNodes.push(found.node);
    }
  });

  if (parentIds.size !== 1) {
    // Sibling-only grouping restriction for clean hierarchy
    return tree;
  }

  const commonParentId = Array.from(parentIds)[0];

  // Calculate common bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedNodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  const groupWidth = Math.max(50, maxX - minX);
  const groupHeight = Math.max(50, maxY - minY);
  const groupId = `group-${Date.now()}`;

  // Make children coordinates relative to the new group container
  const childrenWithRelCoords = selectedNodes.map(n => ({
    ...n,
    x: Math.round(n.x - minX),
    y: Math.round(n.y - minY)
  }));

  const groupContainer = {
    id: groupId,
    name: `Grup ${groupId.slice(-4)}`,
    type: 'div',
    attrs: {
      id: groupId,
      class: 'group-container'
    },
    style: {
      position: 'relative',
      backgroundColor: 'transparent',
      border: '1px dashed rgba(99, 102, 241, 0.4)',
      borderRadius: '8px'
    },
    x: Math.round(minX),
    y: Math.round(minY),
    width: groupWidth,
    height: groupHeight,
    children: childrenWithRelCoords
  };

  // Remove individual selected nodes from tree
  let currentTree = tree;
  selectedIds.forEach(id => {
    const { newTree } = removeNodeFromTree(currentTree, id);
    currentTree = newTree;
  });

  // Insert group container at the same parent
  return insertNodeIntoTree(currentTree, commonParentId, groupContainer);
}

/**
 * Ungroups a container, lifting its children up to its parent with converted relative coordinates.
 */
export function ungroupSelectedNode(tree, groupId) {
  const found = findNodeAndParent(tree, groupId);
  if (!found || !found.node) return tree;

  const groupNode = found.node;
  const parentId = found.parent ? found.parent.id : null;
  const children = groupNode.children || [];

  // Convert children coordinates relative to group's parent
  const liftedChildren = children.map(child => ({
    ...child,
    x: Math.round(child.x + groupNode.x),
    y: Math.round(child.y + groupNode.y)
  }));

  // Remove the group container
  const { newTree: treeWithoutGroup } = removeNodeFromTree(tree, groupId);

  // Insert all children into group's parent
  let finalTree = treeWithoutGroup;
  liftedChildren.forEach(child => {
    finalTree = insertNodeIntoTree(finalTree, parentId, child);
  });

  return finalTree;
}

/**
 * 🌟 Distributes children inside a container (Flexbox alignment helper).
 * Modes: 'space-between' | 'center' | 'flex-start' | 'flex-end' | 'distribute-even'
 */
export function distributeChildrenInContainer(tree, containerId, mode = 'space-between') {
  const found = findNodeAndParent(tree, containerId);
  if (!found || !found.node) return tree;

  const container = found.node;
  const children = container.children || [];
  if (children.length === 0) return tree;

  const padding = 28;
  const containerWidth = container.width || 1280;

  // Sort children by x to maintain left-to-right order
  const sortedChildren = [...children].sort((a, b) => a.x - b.x);

  let updatedChildren = [...sortedChildren];

  if (sortedChildren.length === 1) {
    // Single child: center horizontally and vertically
    const child = sortedChildren[0];
    updatedChildren = [{
      ...child,
      x: Math.max(padding, Math.round((containerWidth - child.width) / 2)),
      y: Math.max(0, Math.round((container.height - child.height) / 2)),
    }];
  } else if (mode === 'space-between') {
    const first = sortedChildren[0];
    const last = sortedChildren[sortedChildren.length - 1];
    const middleChildren = sortedChildren.slice(1, -1);

    const firstX = padding;
    const lastX = Math.max(firstX + first.width + 12, containerWidth - last.width - padding);

    if (middleChildren.length === 0) {
      updatedChildren = [
        { ...first, x: firstX, y: Math.max(0, Math.round((container.height - first.height) / 2)) },
        { ...last, x: lastX, y: Math.max(0, Math.round((container.height - last.height) / 2)) },
      ];
    } else {
      const totalMidW = middleChildren.reduce((sum, c) => sum + c.width, 0);
      const spaceForMids = lastX - (firstX + first.width);
      const midGap = spaceForMids > totalMidW
        ? Math.max(12, (spaceForMids - totalMidW) / (middleChildren.length + 1))
        : 12;

      let currentX = firstX + first.width + midGap;
      const newMids = middleChildren.map(c => {
        const item = { ...c, x: Math.round(currentX), y: Math.max(0, Math.round((container.height - c.height) / 2)) };
        currentX += c.width + midGap;
        return item;
      });

      updatedChildren = [
        { ...first, x: firstX, y: Math.max(0, Math.round((container.height - first.height) / 2)) },
        ...newMids,
        { ...last, x: lastX, y: Math.max(0, Math.round((container.height - last.height) / 2)) },
      ];
    }
  } else if (mode === 'center') {
    // Center all children together
    const totalW = sortedChildren.reduce((sum, c) => sum + c.width, 0);
    const gap = 20;
    const groupW = totalW + (sortedChildren.length - 1) * gap;
    let currentX = Math.max(padding, Math.round((containerWidth - groupW) / 2));

    updatedChildren = sortedChildren.map(c => {
      const item = { ...c, x: Math.round(currentX), y: Math.max(0, Math.round((container.height - c.height) / 2)) };
      currentX += c.width + gap;
      return item;
    });
  } else if (mode === 'flex-start') {
    const gap = 20;
    let currentX = padding;
    updatedChildren = sortedChildren.map(c => {
      const item = { ...c, x: Math.round(currentX), y: Math.max(0, Math.round((container.height - c.height) / 2)) };
      currentX += c.width + gap;
      return item;
    });
  } else if (mode === 'flex-end') {
    const gap = 20;
    const totalW = sortedChildren.reduce((sum, c) => sum + c.width, 0);
    const groupW = totalW + (sortedChildren.length - 1) * gap;
    let currentX = Math.max(padding, containerWidth - padding - groupW);
    updatedChildren = sortedChildren.map(c => {
      const item = { ...c, x: Math.round(currentX), y: Math.max(0, Math.round((container.height - c.height) / 2)) };
      currentX += c.width + gap;
      return item;
    });
  }

  return updateNodeInTree(tree, containerId, {
    children: updatedChildren
  });
}

/**
 * 🌟 Smart Single / Multi-selection Centering
 * Correctly centers single elements (and their children if full-width container)
 * and centers multi-selected sibling groups within parent/canvas without collapsing items!
 */
export function centerElementsSmart(tree, selectedIds, canvasWidth = 1280, canvasHeight = 1350, axis = 'x') {
  if (!selectedIds || selectedIds.length === 0) return { newTree: tree, updates: {} };

  // Step 1: Collect info for all selected elements
  const allFound = selectedIds.map(id => {
    const res = findNodeAndParent(tree, id);
    return res ? { id, node: res.node, parent: res.parent, path: res.path } : null;
  }).filter(Boolean);

  if (allFound.length === 0) return { newTree: tree, updates: {} };

  // Filter out any node whose ancestor is ALSO selected (avoids double moving children)
  const selectedSet = new Set(selectedIds);
  const topLevelFound = allFound.filter(item => {
    // If any ancestor (excluding itself) is in selectedSet, skip it
    return !item.path.slice(0, -1).some(ancestor => selectedSet.has(ancestor.id));
  });

  if (topLevelFound.length === 0) return { newTree: tree, updates: {} };

  const updates = {};

  // Case 1: Single Top-level Element
  if (topLevelFound.length === 1) {
    const { node: el, parent } = topLevelFound[0];
    const boundW = parent ? parent.width : canvasWidth;
    const boundH = parent ? parent.height : canvasHeight;

    const u = {};
    if (axis === 'x' || axis === 'both') {
      u.x = Math.max(0, Math.round((boundW - el.width) / 2));
    }
    if (axis === 'y' || axis === 'both') {
      u.y = Math.max(0, Math.round((boundH - el.height) / 2));
    }

    // Special case: If container spans nearly full width and has children,
    // centering the container horizontally also distributes/centers its children!
    if ((axis === 'x' || axis === 'both') && el.children && el.children.length > 0 && Math.abs(boundW - el.width) <= 40) {
      const treeWithDistributed = distributeChildrenInContainer(tree, el.id, 'space-between');
      const updatedFound = findNodeAndParent(treeWithDistributed, el.id);
      if (updatedFound && updatedFound.node) {
        u.children = updatedFound.node.children;
      }
    }

    updates[el.id] = u;
    const newTree = updateNodeInTree(tree, el.id, u);
    return { newTree, updates };
  }

  // Case 2: Multi-selection
  // Check if all top-level selected items share the same parent ID (or all are root elements with parent === null)
  const firstParentId = topLevelFound[0].parent ? topLevelFound[0].parent.id : null;
  const allShareSameParent = topLevelFound.every(item => (item.parent ? item.parent.id : null) === firstParentId);

  if (allShareSameParent) {
    // Center the group as a whole within the shared parent (or canvas if root)
    const parent = topLevelFound[0].parent;
    const boundW = parent ? parent.width : canvasWidth;
    const boundH = parent ? parent.height : canvasHeight;

    const minX = Math.min(...topLevelFound.map(item => item.node.x));
    const maxX = Math.max(...topLevelFound.map(item => item.node.x + item.node.width));
    const groupW = maxX - minX;

    const minY = Math.min(...topLevelFound.map(item => item.node.y));
    const maxY = Math.max(...topLevelFound.map(item => item.node.y + item.node.height));
    const groupH = maxY - minY;

    const targetCenterX = Math.round((boundW - groupW) / 2);
    const targetCenterY = Math.round((boundH - groupH) / 2);

    const deltaX = targetCenterX - minX;
    const deltaY = targetCenterY - minY;

    topLevelFound.forEach(({ id, node }) => {
      const u = {};
      if (axis === 'x' || axis === 'both') {
        u.x = Math.round(node.x + deltaX);
      }
      if (axis === 'y' || axis === 'both') {
        u.y = Math.round(node.y + deltaY);
      }
      updates[id] = u;
    });

    const newTree = updateMultipleNodesInTree(tree, updates);
    return { newTree, updates };
  } else {
    // Multiple elements in different containers: center each within its respective container
    topLevelFound.forEach(({ id, node, parent }) => {
      const boundW = parent ? parent.width : canvasWidth;
      const boundH = parent ? parent.height : canvasHeight;
      const u = {};
      if (axis === 'x' || axis === 'both') {
        u.x = Math.max(0, Math.round((boundW - node.width) / 2));
      }
      if (axis === 'y' || axis === 'both') {
        u.y = Math.max(0, Math.round((boundH - node.height) / 2));
      }
      updates[id] = u;
    });

    const newTree = updateMultipleNodesInTree(tree, updates);
    return { newTree, updates };
  }
}

/**
 * Wraps one or more sibling nodes inside a semantic wrapper element (e.g. <a> or <button>)
 * WITHOUT replacing children's tags or forcing unwanted box backgrounds.
 */
export function wrapNodesWithTag(tree, selectedIds, wrapperTag = 'a', options = {}) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return { newTree: tree, wrapperId: null };
  }

  const tag = String(wrapperTag || 'a').toLowerCase();
  const foundItems = [];
  const parentIds = new Set();

  selectedIds.forEach(id => {
    const found = findNodeAndParent(tree, id);
    if (found && found.node) {
      parentIds.add(found.parent ? found.parent.id : null);
      foundItems.push(found);
    }
  });

  if (foundItems.length === 0 || parentIds.size !== 1) {
    return { newTree: tree, wrapperId: null };
  }

  // Sort by sibling order so z-order / list order is preserved cleanly
  foundItems.sort((a, b) => a.index - b.index);
  const commonParentId = Array.from(parentIds)[0];
  const insertIdx = foundItems[0].index;

  const withBox = Boolean(options.withBox);
  const padX = withBox ? 16 : 0;
  const padY = withBox ? 10 : 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  foundItems.forEach(({ node }) => {
    const nx = Number(node.x) || 0;
    const ny = Number(node.y) || 0;
    const nw = Number(node.width) || 40;
    const nh = Number(node.height) || 24;
    minX = Math.min(minX, nx);
    minY = Math.min(minY, ny);
    maxX = Math.max(maxX, nx + nw);
    maxY = Math.max(maxY, ny + nh);
  });

  const wrapX = Math.round(minX - padX);
  const wrapY = Math.round(minY - padY);
  const wrapW = Math.max(24, Math.round(maxX - minX + padX * 2));
  const wrapH = Math.max(24, Math.round(maxY - minY + padY * 2));
  const wrapperId = options.id || `wrap-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const wrappedChildren = foundItems.map(({ node }) => ({
    ...node,
    x: Math.round((Number(node.x) || 0) - wrapX),
    y: Math.round((Number(node.y) || 0) - wrapY),
  }));

  const isLink = tag === 'a';
  const defaultBoxBg = isLink ? 'rgba(37, 99, 235, 0.14)' : '#2563eb';
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backgroundColor: withBox ? (options.boxBg || defaultBoxBg) : 'transparent',
    borderRadius: withBox ? '10px' : '0px',
    border: withBox ? (isLink ? '1px solid rgba(59, 130, 246, 0.45)' : 'none') : 'none',
    padding: withBox ? `${padY}px ${padX}px` : '0px',
    boxShadow: withBox && !isLink ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
    color: 'inherit',
    ...(isLink ? { textDecoration: 'none' } : {}),
    ...(options.style || {}),
  };

  const firstChildName = foundItems[0].node.name || foundItems[0].node.textContent || 'Öğe';
  const defaultName = isLink
    ? `Link (${String(firstChildName).slice(0, 18)})`
    : `Buton (${String(firstChildName).slice(0, 18)})`;

  const wrapperNode = {
    id: wrapperId,
    name: options.name || defaultName,
    type: tag,
    isAtomicWrapper: true,
    attrs: {
      id: wrapperId,
      class: '',
      ...(isLink
        ? { href: options.href || '#' }
        : { type: 'button' }),
      ...(options.attrs || {}),
    },
    style: baseStyle,
    textContent: '',
    x: wrapX,
    y: wrapY,
    width: wrapW,
    height: wrapH,
    zIndex: foundItems[0].node.zIndex ?? 1,
    positionMode: foundItems[0].node.positionMode || 'normal',
    fillType: 'solid',
    fillColor: withBox ? (options.boxBg || defaultBoxBg) : 'transparent',
    borderWidth: withBox && isLink ? 1 : 0,
    borderStyle: 'solid',
    borderColor: withBox && isLink ? 'rgba(59, 130, 246, 0.45)' : 'transparent',
    borderRadius: withBox ? 10 : 0,
    shadow: withBox && !isLink ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
    ...(options.events ? { events: options.events } : {}),
    children: wrappedChildren,
  };

  let nextTree = tree;
  foundItems.forEach(({ node }) => {
    const res = removeNodeFromTree(nextTree, node.id);
    nextTree = res.newTree;
  });

  nextTree = insertNodeIntoTree(nextTree, commonParentId, wrapperNode, insertIdx);
  return { newTree: nextTree, wrapperId };
}

/**
 * Unwraps a wrapper node (`<a>`, `<button>`, `<div>`, etc.), lifting its children
 * in exact order, or converts childless wrapper back to plain `<text>` preserving text/styles.
 */
export function unwrapWrapperNode(tree, wrapperId) {
  const found = findNodeAndParent(tree, wrapperId);
  if (!found || !found.node) return { newTree: tree, restoredIds: [] };

  const wrapper = found.node;
  const parentId = found.parent ? found.parent.id : null;
  const insertStartIdx = found.index;
  const children = wrapper.children || [];

  if (children.length === 0) {
    // Convert empty wrapper back into plain unboxed text element preserving its content
    const plainTree = updateNodeInTree(tree, wrapperId, (cur) => ({
      type: 'text',
      isAtomicWrapper: false,
      fillColor: 'transparent',
      borderWidth: 0,
      shadow: 'none',
      events: undefined,
      attrs: { id: cur.attrs?.id || cur.id, class: cur.attrs?.class || '' },
      style: {
        ...(cur.style || {}),
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
      },
    }));
    return { newTree: plainTree, restoredIds: [wrapperId] };
  }

  const liftedChildren = children.map((child) => ({
    ...child,
    x: Math.round((Number(child.x) || 0) + (Number(wrapper.x) || 0)),
    y: Math.round((Number(child.y) || 0) + (Number(wrapper.y) || 0)),
  }));

  const { newTree: withoutWrapper } = removeNodeFromTree(tree, wrapperId);
  let nextTree = withoutWrapper;
  liftedChildren.forEach((child, offset) => {
    nextTree = insertNodeIntoTree(nextTree, parentId, child, insertStartIdx + offset);
  });

  return {
    newTree: nextTree,
    restoredIds: liftedChildren.map((c) => c.id),
  };
}

