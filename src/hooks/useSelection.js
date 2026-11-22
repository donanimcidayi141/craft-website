import { useState, useCallback, useMemo } from 'react';
import {
  findNodeAndParent,
  getNodePath,
  getAbsoluteCoords,
  removeNodeFromTree,
  insertNodeIntoTree,
  cloneSubtreeWithNewIds,
  flattenTree,
  isExplicitContainer,
} from '../utils/treeUtils';
import { getParentScopeId } from '../utils/selectionUtils';

/**
 * Multi-selection, group isolation scope, and clipboard management hook.
 * Input:  { elements, rawElements, updateElementsWithHistory }
 * Output: {
 *   selectedIds, setSelectedIds, editingGroupId, setEditingGroupId,
 *   clipboard, setClipboard, selectedElement,
 *   handleSelectElements, handleToggleElementSelection, handleSelectAll,
 *   handleSelectParent, handleSelectChild,
 *   handleCopy, handleCut, handlePaste,
 *   reset,
 * }
 */
export function useSelection({ elements = [], rawElements = [], updateElementsWithHistory }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [clipboard, setClipboard] = useState(null);

  const selectedElement = useMemo(
    () => (selectedIds.length > 0 ? findNodeAndParent(elements, selectedIds[0])?.node || null : null),
    [elements, selectedIds]
  );

  // Multi-Selection: Set selection cleanly preventing ancestor + descendant coexistence
  const handleSelectElements = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      setSelectedIds([]);
      return;
    }
    // Filter out ancestors if their descendants are in ids
    const allDescendantIds = new Set();
    ids.forEach((id) => {
      const found = findNodeAndParent(elements, id);
      if (found && found.node && found.node.children) {
        flattenTree(found.node.children).forEach((d) => allDescendantIds.add(d.id));
      }
    });
    // Never allow an ancestor to be selected together with its children
    const cleanIds = ids.filter((id) => !allDescendantIds.has(id));
    setSelectedIds(cleanIds);
  }, [elements]);

  // Multi-Selection Toggle with Shift+Click
  const handleToggleElementSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      // Find all ancestors of the clicked node
      const nodePath = getNodePath(elements, id);
      const ancestorIds = new Set(nodePath.slice(0, -1).map((n) => n.id));

      // Find all descendants of the clicked node
      const found = findNodeAndParent(elements, id);
      const descendantIds = new Set();
      if (found && found.node && found.node.children) {
        flattenTree(found.node.children).forEach((d) => descendantIds.add(d.id));
      }

      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      // Strip out any ancestors or descendants of the newly selected element
      const cleanPrev = prev.filter((item) => !ancestorIds.has(item) && !descendantIds.has(item));
      return [...cleanPrev, id];
    });
  }, [elements]);

  // Select all (Ctrl+A): Sibling elements at current hierarchy level or root elements
  const handleSelectAll = () => {
    if (selectedIds.length > 0) {
      const parent = findNodeAndParent(elements, selectedIds[0])?.parent;
      const siblings = parent ? (parent.children || []) : elements;
      const visibleSiblingIds = siblings.filter((el) => !el.isHidden).map((el) => el.id);
      setSelectedIds(visibleSiblingIds);
    } else {
      const rootIds = elements.filter((el) => !el.isHidden).map((el) => el.id);
      setSelectedIds(rootIds);
    }
  };

  // Copy (Ctrl+C)
  const handleCopy = () => {
    if (selectedIds.length === 0) return;
    const nodes = [];
    const sourceParentMap = {};
    selectedIds.forEach((id) => {
      const found = findNodeAndParent(rawElements, id);
      if (found && found.node) {
        nodes.push(found.node);
        sourceParentMap[id] = found.parent ? found.parent.id : null;
      }
    });
    if (nodes.length > 0) {
      setClipboard({ type: 'copy', nodes, sourceParentMap });
    }
  };

  // Cut (Ctrl+X)
  const handleCut = () => {
    if (selectedIds.length === 0) return;
    const nodes = [];
    const sourceParentMap = {};
    selectedIds.forEach((id) => {
      const found = findNodeAndParent(rawElements, id);
      if (found && found.node) {
        nodes.push(found.node);
        sourceParentMap[id] = found.parent ? found.parent.id : null;
      }
    });
    if (nodes.length === 0) return;

    setClipboard({ type: 'cut', nodes, sourceParentMap });

    let nextTree = rawElements;
    selectedIds.forEach((id) => {
      nextTree = removeNodeFromTree(nextTree, id).newTree;
    });
    updateElementsWithHistory(nextTree);
    setSelectedIds([]);
  };

  // Paste (Ctrl+V)
  const handlePaste = () => {
    if (!clipboard || !clipboard.nodes || clipboard.nodes.length === 0) return;

    let targetParentId = null;
    let targetIndex = -1;

    if (selectedIds.length > 0) {
      const target = findNodeAndParent(rawElements, selectedIds[0]);
      if (target) {
        const isContainer = isExplicitContainer(target.node.type);
        const isSelfOrCopied = clipboard.nodes.some((n) => n.id === target.node.id);
        // Only paste INSIDE if target is an explicit container (e.g. div, section) AND not the copied item itself
        if (isContainer && !isSelfOrCopied) {
          targetParentId = target.node.id;
          targetIndex = -1;
        } else if (target.parent) {
          // Otherwise paste as SIBLING in parent
          targetParentId = target.parent.id;
          targetIndex = target.index + 1;
        } else {
          // Canvas root sibling
          targetParentId = null;
          targetIndex = target.index + 1;
        }
      }
    }

    let nextTree = rawElements;
    const newIds = [];

    clipboard.nodes.forEach((node) => {
      const sourceParentId = clipboard.sourceParentMap?.[node.id] || null;
      const cloned = cloneSubtreeWithNewIds(node, 0);
      newIds.push(cloned.id);

      // Coordinate placement:
      if (targetParentId === sourceParentId) {
        // Sibling in the same container -> offset 20px from original
        cloned.x = (node.x || 0) + 20;
        cloned.y = (node.y || 0) + 20;
      } else if (!targetParentId) {
        // Target is canvas root -> Convert source's relative coords to canvas-absolute coords!
        const sourceAbs = getAbsoluteCoords(rawElements, node.id);
        const absX = sourceAbs ? sourceAbs.x : (node.x || 0);
        const absY = sourceAbs ? sourceAbs.y : (node.y || 0);
        cloned.x = Math.max(20, absX + 20);
        cloned.y = Math.max(20, absY + 20);
      } else {
        // Target is a different container -> Convert to target container local space
        const sourceAbs = getAbsoluteCoords(rawElements, node.id);
        const targetParentAbs = getAbsoluteCoords(rawElements, targetParentId);
        if (sourceAbs && targetParentAbs) {
          cloned.x = Math.max(10, (sourceAbs.x - targetParentAbs.x) + 20);
          cloned.y = Math.max(10, (sourceAbs.y - targetParentAbs.y) + 20);
        } else {
          cloned.x = (node.x || 0) + 20;
          cloned.y = (node.y || 0) + 20;
        }
      }

      nextTree = insertNodeIntoTree(nextTree, targetParentId, cloned, targetIndex);
      if (targetIndex >= 0) targetIndex++;
    });

    updateElementsWithHistory(nextTree);
    setSelectedIds(newIds);
  };

  // Hierarchy Navigation: Esc -> Step out of active editingGroupId, or go up to parent, or deselect
  const handleSelectParent = () => {
    if (editingGroupId) {
      const currentScopeId = editingGroupId;
      const nextScopeId = getParentScopeId(elements, currentScopeId);
      setEditingGroupId(nextScopeId);
      setSelectedIds([currentScopeId]);
      return;
    }
    if (selectedIds.length === 0) return;
    const found = findNodeAndParent(elements, selectedIds[0]);
    if (found && found.parent) {
      setSelectedIds([found.parent.id]);
    } else {
      setSelectedIds([]);
    }
  };

  // Hierarchy Navigation: Enter -> Drill into selected container and pick first child
  const handleSelectChild = () => {
    if (selectedIds.length === 0) return;
    const found = findNodeAndParent(elements, selectedIds[0]);
    if (found && found.node && found.node.children && found.node.children.length > 0) {
      setEditingGroupId(found.node.id);
      setSelectedIds([found.node.children[0].id]);
    }
  };

  const reset = useCallback(({ clearClipboard = false } = {}) => {
    setSelectedIds([]);
    setEditingGroupId(null);
    if (clearClipboard) {
      setClipboard(null);
    }
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    editingGroupId,
    setEditingGroupId,
    clipboard,
    setClipboard,
    selectedElement,
    handleSelectElements,
    handleToggleElementSelection,
    handleSelectAll,
    handleSelectParent,
    handleSelectChild,
    handleCopy,
    handleCut,
    handlePaste,
    reset,
  };
}
