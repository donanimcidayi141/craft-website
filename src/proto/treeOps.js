/**
 * Saf (React'siz, Node uyumlu) ağaç işlemleri ve kabul kuralları modülü.
 * - Tüm değişiklikler immutability (değişmezlik) ilkesiyle yeni kopya döndürür.
 * - Kurallar:
 *   - `text`, `image`, `button`, `blob` çocuk alamaz.
 *   - `section` yalnızca kök (`page`) düzeyinde olabilir; başka düğümün altına taşınamaz.
 *   - `container` ve `section`, `section`/`page` dışındaki çocukları alabilir.
 */

const LEAF_TYPES = new Set(['text', 'image', 'button', 'blob']);

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function deepMergeObjects(baseObj, patchObj) {
  if (!isPlainObject(patchObj)) return patchObj;
  const base = isPlainObject(baseObj) ? baseObj : {};
  const next = { ...base };
  for (const key of Object.keys(patchObj)) {
    const patchVal = patchObj[key];
    if (isPlainObject(patchVal) && isPlainObject(base[key])) {
      next[key] = deepMergeObjects(base[key], patchVal);
    } else {
      next[key] = patchVal;
    }
  }
  return next;
}

/**
 * Ağaç içinde id'ye göre düğüm arar.
 */
export function findNode(tree, id) {
  if (!tree || !id) return null;
  if (tree.id === id) return tree;
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Düğümün ebeveynini döndürür; kök veya bulunamazsa `null`.
 */
export function findParent(tree, id) {
  if (!tree || !id || tree.id === id) return null;
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      if (child?.id === id) return tree;
      const deep = findParent(child, id);
      if (deep) return deep;
    }
  }
  return null;
}

/**
 * Düğümün kendisini, ebeveynini ve ebeveyn içindeki indeksini döndürür.
 */
export function findNodeAndLocation(tree, id, parent = null, index = -1) {
  if (!tree || !id) return null;
  if (tree.id === id) {
    return { node: tree, parent, index };
  }
  if (Array.isArray(tree.children)) {
    for (let i = 0; i < tree.children.length; i += 1) {
      const found = findNodeAndLocation(tree.children[i], id, tree, i);
      if (found) return found;
    }
  }
  return null;
}

/**
 * `id` düğümünün `ancestorId` alt ağacında bulunup bulunmadığını döndürür.
 */
export function isDescendant(tree, ancestorId, id) {
  if (!tree || !ancestorId || !id || ancestorId === id) return false;
  const ancestor = findNode(tree, ancestorId);
  if (!ancestor || !Array.isArray(ancestor.children)) return false;
  for (const child of ancestor.children) {
    if (child?.id === id || isDescendant(child, child?.id, id)) {
      return true;
    }
  }
  return false;
}

/**
 * Düğümün genel olarak çocuk kabul edip edemeyeceğini döndürür.
 */
export function canNodeAcceptChildren(nodeOrType) {
  const type = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType?.type;
  if (!type || LEAF_TYPES.has(type)) return false;
  return type === 'page' || type === 'section' || type === 'container';
}

/**
 * Belirli ebeveyn tipinin belirli çocuk tipini kabul edip edemeyeceğini doğrular.
 */
export function canAcceptChild(parentType, childType) {
  if (!parentType || !childType) return false;
  if (LEAF_TYPES.has(parentType)) return false;
  if (childType === 'page') return false;
  if (childType === 'section') {
    return parentType === 'page';
  }
  if (parentType === 'page') {
    return childType === 'section';
  }
  return parentType === 'section' || parentType === 'container';
}

/**
 * Verilen viewport kırılımı (`lg` | `md` | `sm`) için etkin düzen modunu döndürür.
 */
export function getEffectiveLayoutMode(node, viewport = 'lg') {
  const baseMode = node?.layout?.mode || 'stack';
  if (viewport === 'md') {
    return node?.responsive?.md?.layout?.mode || baseMode;
  }
  if (viewport === 'sm') {
    return node?.responsive?.sm?.layout?.mode || node?.responsive?.md?.layout?.mode || baseMode;
  }
  return baseMode;
}

function mapReplaceChildren(tree, replacementsById) {
  if (!tree) return tree;
  const hasReplacement = Object.prototype.hasOwnProperty.call(replacementsById, tree.id);
  const currentChildren = hasReplacement ? replacementsById[tree.id] : tree.children;

  if (!Array.isArray(currentChildren)) {
    return hasReplacement ? { ...tree, children: currentChildren } : tree;
  }

  let childrenChanged = hasReplacement;
  const nextChildren = currentChildren.map((child) => {
    const mapped = mapReplaceChildren(child, replacementsById);
    if (mapped !== child) childrenChanged = true;
    return mapped;
  });

  if (!childrenChanged) return tree;
  return { ...tree, children: nextChildren };
}

/**
 * Bir düğümü hedef ebeveynin belirli indeksine taşır.
 * - Kendi alt soyuna veya kendisine taşımayı reddeder (`tree` değişmez).
 * - Kabul kurallarına uymayan taşımayı reddeder (`tree` değişmez).
 * - Aynı ebeveynde taşırken önce çıkarır sonra `index`'e ekler.
 */
export function moveNode(tree, id, targetParentId, index = 0) {
  if (!tree || !id || !targetParentId) return tree;
  if (id === tree.id || id === targetParentId) return tree;

  const sourceLoc = findNodeAndLocation(tree, id);
  const targetParent = findNode(tree, targetParentId);
  if (!sourceLoc || !sourceLoc.parent || !targetParent) return tree;

  if (isDescendant(tree, id, targetParentId)) return tree;
  if (!canAcceptChild(targetParent.type, sourceLoc.node.type)) return tree;

  const sourceParent = sourceLoc.parent;
  const sameParent = sourceParent.id === targetParent.id;

  if (sameParent) {
    const currentChildren = Array.isArray(sourceParent.children) ? sourceParent.children : [];
    const withoutMoved = currentChildren.filter((_, idx) => idx !== sourceLoc.index);
    const boundedIndex = Math.max(0, Math.min(Number(index) || 0, withoutMoved.length));
    // Aynı yere taşınıyorsa gereksiz kopya oluşturma
    if (boundedIndex === sourceLoc.index) return tree;

    const reordered = [
      ...withoutMoved.slice(0, boundedIndex),
      sourceLoc.node,
      ...withoutMoved.slice(boundedIndex),
    ];
    return mapReplaceChildren(tree, { [sourceParent.id]: reordered });
  }

  const nextSourceChildren = (sourceParent.children || []).filter((_, idx) => idx !== sourceLoc.index);
  const targetChildren = Array.isArray(targetParent.children) ? targetParent.children : [];
  const boundedIndex = Math.max(0, Math.min(Number(index) || 0, targetChildren.length));
  const nextTargetChildren = [
    ...targetChildren.slice(0, boundedIndex),
    sourceLoc.node,
    ...targetChildren.slice(boundedIndex),
  ];

  return mapReplaceChildren(tree, {
    [sourceParent.id]: nextSourceChildren,
    [targetParent.id]: nextTargetChildren,
  });
}

/**
 * Düğümü derin birleştirme (props, pos, layout, size, responsive) ile günceller.
 */
export function updateNode(tree, id, patch) {
  if (!tree || !id || !isPlainObject(patch)) return tree;

  if (tree.id === id) {
    const next = { ...tree };
    for (const key of Object.keys(patch)) {
      const val = patch[key];
      if (isPlainObject(val) && isPlainObject(tree[key])) {
        next[key] = deepMergeObjects(tree[key], val);
      } else {
        next[key] = val;
      }
    }
    return next;
  }

  if (!Array.isArray(tree.children)) return tree;
  let changed = false;
  const nextChildren = tree.children.map((child) => {
    const updated = updateNode(child, id, patch);
    if (updated !== child) changed = true;
    return updated;
  });

  return changed ? { ...tree, children: nextChildren } : tree;
}

/**
 * Belirtilen düğümü ağaçtan kaldırır (kök `page` silinemez).
 */
export function removeNode(tree, id) {
  if (!tree || !id || tree.id === id) return tree;
  if (!Array.isArray(tree.children)) return tree;

  let changed = false;
  const nextChildren = [];
  for (const child of tree.children) {
    if (child?.id === id) {
      changed = true;
      continue;
    }
    const nextChild = removeNode(child, id);
    if (nextChild !== child) changed = true;
    nextChildren.push(nextChild);
  }

  return changed ? { ...tree, children: nextChildren } : tree;
}
