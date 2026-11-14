import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { findNode, moveNode, removeNode, updateNode } from './treeOps.js';
import sampleTree from './sampleTree.js';
import {
  addPage,
  createProjectIdGen,
  ensureProject,
  getActivePage,
  getActiveTree,
  isProject,
  movePage,
  removePage,
  renamePage,
  setHome,
  switchPage,
  updateActiveTree,
  updateProjectTheme,
} from './project.js';
import { packToNodes } from './packAdapter.js';

/**
 * Faz 2–4b proje, sayfa sekmeleri, ağaç, seçim, düzenleme, geçmiş (undo/redo) ve AI taslak deposu.
 * - Geçmiş yığını en fazla 100 PROJE anlık görüntüsü saklar.
 * - `SWITCH_PAGE` geçmiş adımı oluşturmaz; yalnızca `activePageId` değiştirir ve seçimi/düzenlemeyi temizler.
 * - Sayfa ekleme/silme/yeniden adlandırma/sıralama, içerik paketi ekleme ve AI taslağı TEK undo adımı ekler.
 * - `projectVersion` (geriye dönük `treeVersion` takma adıyla) her gerçek mutasyonda artar; AI çakışmalarını yakalar.
 * - `aiBusy` true iken sürükleme, satır içi düzenleme, Delete, sayfa işlemleri ve undo/redo kilitlenir.
 */

export const MAX_HISTORY_STEPS = 100;

function reconcileSelectionId(tree, id) {
  if (!id || !tree) return null;
  return findNode(tree, id) ? id : null;
}

function ensureValidActivePage(project, preferredPageId) {
  if (!isProject(project) || project.pages.length === 0) return project;
  if (preferredPageId && project.pages.some((p) => p.id === preferredPageId)) {
    return project.activePageId === preferredPageId
      ? project
      : { ...project, activePageId: preferredPageId };
  }
  const fallbackId = project.pages[0].id;
  return project.activePageId === fallbackId
    ? project
    : { ...project, activePageId: fallbackId };
}

export function diffChangedPageTitles(prevProject, nextProject) {
  const prevMap = new Map((prevProject?.pages || []).map((p) => [p.id, p]));
  const titles = [];
  for (const page of nextProject?.pages || []) {
    const prev = prevMap.get(page.id);
    if (!prev || prev.tree !== page.tree || prev.title !== page.title || prev.slug !== page.slug || prev.isHome !== page.isHome) {
      titles.push(page.title || page.id);
    }
  }
  for (const prev of prevProject?.pages || []) {
    if (!(nextProject?.pages || []).some((p) => p.id === prev.id)) {
      titles.push(`${prev.title || prev.id} (silindi)`);
    }
  }
  if (prevProject?.theme !== nextProject?.theme && titles.length === 0) {
    titles.push('Proje Teması');
  }
  return titles;
}

export function createInitialStoreState(
  initialInput = sampleTree,
  initialSelectedId = 'hero-title'
) {
  const project = ensureProject(initialInput);
  const activeTree = getActiveTree(project);
  const validSelected = reconcileSelectionId(activeTree, initialSelectedId);

  return {
    project,
    projectVersion: 0,
    tree: activeTree,
    treeVersion: 0,
    selectedId: validSelected,
    hoveredId: null,
    viewport: 'lg',
    zoom: 0.85,
    editingId: null,
    aiBusy: false,
    aiConflict: false,
    iframeLoadCount: 0,
    commitCount: 0,
    lastWarnings: [],
    history: {
      past: [],
      future: [],
    },
  };
}

function commitProjectChange(
  state,
  nextProject,
  nextSelectedId = state.selectedId,
  nextEditingId = state.editingId,
  warnings = []
) {
  if (!nextProject || nextProject === state.project) {
    const activeTree = getActiveTree(state.project);
    const reconciled = reconcileSelectionId(activeTree, nextSelectedId);
    return reconciled !== state.selectedId || warnings.length > 0
      ? { ...state, selectedId: reconciled, aiConflict: false, lastWarnings: warnings }
      : { ...state, aiConflict: false };
  }

  const normalizedProject = ensureValidActivePage(nextProject, nextProject.activePageId);
  const activeTree = getActiveTree(normalizedProject);
  const trimmedPast = state.history.past.slice(-(MAX_HISTORY_STEPS - 1));
  const nextVersion = state.projectVersion + 1;

  return {
    ...state,
    project: normalizedProject,
    projectVersion: nextVersion,
    tree: activeTree,
    treeVersion: nextVersion,
    selectedId: reconcileSelectionId(activeTree, nextSelectedId),
    editingId: reconcileSelectionId(activeTree, nextEditingId),
    aiConflict: false,
    commitCount: state.commitCount + 1,
    lastWarnings: warnings,
    history: {
      past: [...trimmedPast, state.project],
      future: [],
    },
  };
}

export function treeStoreReducer(state, action) {
  switch (action.type) {
    case 'SELECT_NODE': {
      const nextId = action.nodeId ?? null;
      return state.selectedId === nextId ? state : { ...state, selectedId: nextId };
    }

    case 'HOVER_NODE':
      return state.hoveredId === (action.nodeId ?? null)
        ? state
        : { ...state, hoveredId: action.nodeId ?? null };

    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };

    case 'SET_ZOOM': {
      const clamped = Math.min(1, Math.max(0.5, Number(action.zoom) || 1));
      return { ...state, zoom: Number(clamped.toFixed(2)) };
    }

    case 'SET_EDITING_ID': {
      if (state.aiBusy && action.nodeId) return state;
      return { ...state, editingId: action.nodeId ?? null };
    }

    case 'SET_AI_BUSY':
      return state.aiBusy === Boolean(action.aiBusy)
        ? state
        : { ...state, aiBusy: Boolean(action.aiBusy) };

    case 'CLEAR_AI_CONFLICT':
      return state.aiConflict ? { ...state, aiConflict: false } : state;

    case 'CLEAR_WARNINGS':
      return state.lastWarnings.length > 0 ? { ...state, lastWarnings: [] } : state;

    case 'SET_LOAD_COUNT':
      return { ...state, iframeLoadCount: action.count };

    // Sayfa sekmesi geçişi: geçmiş adımı oluşturmaz, seçimi ve aktif düzenlemeyi temizler
    case 'SWITCH_PAGE': {
      if (state.aiBusy) return state;
      const res = switchPage(state.project, action.pageId);
      if (!res.ok) return state;
      if (res.project === state.project && !state.selectedId && !state.editingId) {
        return state;
      }
      const nextTree = getActiveTree(res.project);
      return {
        ...state,
        project: res.project,
        tree: nextTree,
        selectedId: null,
        hoveredId: null,
        editingId: null,
      };
    }

    case 'ADD_PAGE': {
      if (state.aiBusy) return state;
      const res = addPage(state.project, {
        title: action.title,
        slug: action.slug,
        tree: action.tree,
      });
      if (!res.ok) return state;
      const nextProject = action.switchToNew === false
        ? res.project
        : switchPage(res.project, res.page.id).project;
      return commitProjectChange(state, nextProject, null, null);
    }

    case 'REMOVE_PAGE': {
      if (state.aiBusy) return state;
      const res = removePage(state.project, action.pageId);
      if (!res.ok) return state;
      return commitProjectChange(state, res.project, null, null, res.warnings || []);
    }

    case 'RENAME_PAGE': {
      if (state.aiBusy) return state;
      const res = renamePage(state.project, action.pageId, action.title, action.slug);
      if (!res.ok) return state;
      return commitProjectChange(state, res.project);
    }

    case 'SET_HOME_PAGE': {
      if (state.aiBusy) return state;
      const res = setHome(state.project, action.pageId);
      if (!res.ok) return state;
      return commitProjectChange(state, res.project);
    }

    case 'MOVE_PAGE': {
      if (state.aiBusy) return state;
      const res = movePage(state.project, action.pageId, action.targetIndex);
      if (!res.ok) return state;
      return commitProjectChange(state, res.project);
    }

    case 'UPDATE_THEME': {
      if (state.aiBusy) return state;
      const nextProject = updateProjectTheme(state.project, action.tokens);
      return commitProjectChange(state, nextProject);
    }

    case 'INSERT_CONTENT_PACK': {
      if (state.aiBusy) return state;
      const activeTree = state.tree;
      if (!activeTree) return state;
      const idGen = createProjectIdGen(state.project, 'pack');
      const { nodes, warnings } = packToNodes(action.packKey, idGen);
      if (!nodes || nodes.length === 0) {
        return { ...state, lastWarnings: warnings || [] };
      }

      const existingChildren = Array.isArray(activeTree.children) ? [...activeTree.children] : [];
      let insertIndex = existingChildren.length;
      if (Number.isInteger(action.index)) {
        insertIndex = Math.max(0, Math.min(existingChildren.length, action.index));
      } else if (action.afterNodeId) {
        const idx = existingChildren.findIndex((c) => c?.id === action.afterNodeId);
        if (idx !== -1) insertIndex = idx + 1;
      }

      existingChildren.splice(insertIndex, 0, ...nodes);
      const nextTree = { ...activeTree, children: existingChildren };
      const nextProject = updateActiveTree(state.project, nextTree);
      return commitProjectChange(state, nextProject, nodes[0].id, null, warnings || []);
    }

    case 'MOVE_NODE': {
      if (state.aiBusy) return state;
      const nextTree = moveNode(state.tree, action.id, action.targetParentId, action.index);
      if (nextTree === state.tree) return state;
      const nextProject = updateActiveTree(state.project, nextTree);
      return commitProjectChange(state, nextProject, action.id);
    }

    case 'UPDATE_NODE': {
      if (state.aiBusy) return state;
      const nextTree = updateNode(state.tree, action.id, action.patch);
      if (nextTree === state.tree) return state;
      const nextProject = updateActiveTree(state.project, nextTree);
      return commitProjectChange(state, nextProject);
    }

    case 'REMOVE_NODE': {
      if (state.aiBusy) return state;
      const targetId = action.id ?? state.selectedId;
      if (!targetId) return state;
      const nextTree = removeNode(state.tree, targetId);
      if (nextTree === state.tree) return state;
      const nextSelected = state.selectedId === targetId ? null : state.selectedId;
      const nextProject = updateActiveTree(state.project, nextTree);
      return commitProjectChange(state, nextProject, nextSelected);
    }

    case 'APPLY_AI_DRAFT': {
      const draftInput = action.project || action.tree;
      if (!draftInput || typeof draftInput !== 'object') {
        return { ...state, aiConflict: true };
      }
      if (action.baseVersion !== state.projectVersion) {
        return { ...state, aiConflict: true };
      }

      let candidateProject = isProject(draftInput)
        ? draftInput
        : updateActiveTree(state.project, draftInput);

      if (candidateProject === state.project) {
        return { ...state, aiConflict: false };
      }

      // Kullanıcının AI öncesi aktif sayfası yeni projede hâlâ varsa orada kal (silindiyse fallback)
      const userPrevPageId = state.project.activePageId;
      candidateProject = ensureValidActivePage(candidateProject, userPrevPageId);

      return commitProjectChange(state, candidateProject, state.selectedId, null);
    }

    case 'UNDO': {
      if (state.aiBusy || state.history.past.length === 0) return state;
      const prevSnapshot = state.history.past[state.history.past.length - 1];
      const nextPast = state.history.past.slice(0, -1);
      const nextFuture = [state.project, ...state.history.future].slice(0, MAX_HISTORY_STEPS);

      // Mevcut aktif sayfa geri yüklenen projede varsa koru; yoksa ilk sayfaya düş
      const restoredProject = ensureValidActivePage(prevSnapshot, state.project.activePageId);
      const restoredTree = getActiveTree(restoredProject);
      const nextVersion = state.projectVersion + 1;

      return {
        ...state,
        project: restoredProject,
        projectVersion: nextVersion,
        tree: restoredTree,
        treeVersion: nextVersion,
        selectedId: reconcileSelectionId(restoredTree, state.selectedId),
        editingId: null,
        aiConflict: false,
        history: {
          past: nextPast,
          future: nextFuture,
        },
      };
    }

    case 'REDO': {
      if (state.aiBusy || state.history.future.length === 0) return state;
      const nextSnapshot = state.history.future[0];
      const nextFuture = state.history.future.slice(1);
      const trimmedPast = state.history.past.slice(-(MAX_HISTORY_STEPS - 1));

      const restoredProject = ensureValidActivePage(nextSnapshot, state.project.activePageId);
      const restoredTree = getActiveTree(restoredProject);
      const nextVersion = state.projectVersion + 1;

      return {
        ...state,
        project: restoredProject,
        projectVersion: nextVersion,
        tree: restoredTree,
        treeVersion: nextVersion,
        selectedId: reconcileSelectionId(restoredTree, state.selectedId),
        editingId: null,
        aiConflict: false,
        history: {
          past: [...trimmedPast, state.project],
          future: nextFuture,
        },
      };
    }

    case 'RESET_TREE': {
      const baseProject = ensureProject(action.project || action.tree || sampleTree);
      const nextState = createInitialStoreState(baseProject, 'hero-title');
      return {
        ...nextState,
        viewport: state.viewport,
        zoom: state.zoom,
        iframeLoadCount: state.iframeLoadCount,
      };
    }

    default:
      return state;
  }
}

function isEditableEventTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[contenteditable]')) return true;
  return false;
}

/**
 * Tekil React proje + ağaç deposu hook'u ve klavye kısayol yöneticisi.
 */
export function useTreeStore(initialInput = sampleTree) {
  const [state, dispatch] = useReducer(
    treeStoreReducer,
    initialInput,
    (input) => createInitialStoreState(input, 'hero-title')
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleShortcutKeyDown = useCallback((e) => {
    const current = stateRef.current;
    if (current.aiBusy || current.editingId || isEditableEventTarget(e.target)) {
      return;
    }

    const modKey = e.metaKey || e.ctrlKey;
    const lowerKey = (e.key || '').toLowerCase();

    if (modKey && lowerKey === 'z') {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
      return;
    }

    if (modKey && lowerKey === 'y') {
      e.preventDefault();
      dispatch({ type: 'REDO' });
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && current.selectedId) {
      e.preventDefault();
      dispatch({ type: 'REMOVE_NODE', id: current.selectedId });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleShortcutKeyDown);
    return () => window.removeEventListener('keydown', handleShortcutKeyDown);
  }, [handleShortcutKeyDown]);

  const actions = useMemo(
    () => ({
      selectNode: (nodeId) => dispatch({ type: 'SELECT_NODE', nodeId }),
      hoverNode: (nodeId) => dispatch({ type: 'HOVER_NODE', nodeId }),
      setViewport: (viewport) => dispatch({ type: 'SET_VIEWPORT', viewport }),
      setZoom: (zoom) => dispatch({ type: 'SET_ZOOM', zoom }),
      setEditingId: (nodeId) => dispatch({ type: 'SET_EDITING_ID', nodeId }),
      setAiBusy: (aiBusy) => dispatch({ type: 'SET_AI_BUSY', aiBusy }),
      clearAiConflict: () => dispatch({ type: 'CLEAR_AI_CONFLICT' }),
      clearWarnings: () => dispatch({ type: 'CLEAR_WARNINGS' }),
      setLoadCount: (count) => dispatch({ type: 'SET_LOAD_COUNT', count }),
      switchPage: (pageId) => dispatch({ type: 'SWITCH_PAGE', pageId }),
      addPage: (opts) => {
        const cur = stateRef.current;
        if (cur.aiBusy) return { ok: false, error: 'AI çalışırken sayfa eklenemez.' };
        const res = addPage(cur.project, opts);
        if (!res.ok) return res;
        dispatch({ type: 'ADD_PAGE', ...opts });
        return { ok: true, page: res.page };
      },
      removePage: (pageId) => {
        const cur = stateRef.current;
        if (cur.aiBusy) return { ok: false, error: 'AI çalışırken sayfa silinemez.' };
        const res = removePage(cur.project, pageId);
        if (!res.ok) return res;
        dispatch({ type: 'REMOVE_PAGE', pageId });
        return { ok: true, warnings: res.warnings || [] };
      },
      renamePage: (pageId, title, slug) => {
        const cur = stateRef.current;
        if (cur.aiBusy) return { ok: false, error: 'AI çalışırken sayfa yeniden adlandırılamaz.' };
        const res = renamePage(cur.project, pageId, title, slug);
        if (!res.ok) return res;
        dispatch({ type: 'RENAME_PAGE', pageId, title, slug });
        return { ok: true, page: res.page };
      },
      setHomePage: (pageId) => {
        const cur = stateRef.current;
        if (cur.aiBusy) return { ok: false, error: 'AI çalışırken ana sayfa değiştirilemez.' };
        const res = setHome(cur.project, pageId);
        if (!res.ok) return res;
        dispatch({ type: 'SET_HOME_PAGE', pageId });
        return { ok: true };
      },
      movePage: (pageId, targetIndex) => dispatch({ type: 'MOVE_PAGE', pageId, targetIndex }),
      updateTheme: (tokens) => dispatch({ type: 'UPDATE_THEME', tokens }),
      insertContentPack: (packKey, opts = {}) => {
        const cur = stateRef.current;
        if (cur.aiBusy) return { ok: false, warnings: ['AI çalışırken içerik paketi eklenemez.'] };
        const previewIdGen = createProjectIdGen(cur.project, 'pack');
        const check = packToNodes(packKey, previewIdGen);
        if (!check.nodes || check.nodes.length === 0) {
          return { ok: false, warnings: check.warnings || [] };
        }
        dispatch({
          type: 'INSERT_CONTENT_PACK',
          packKey,
          index: opts.index,
          afterNodeId: opts.afterNodeId,
        });
        return { ok: true, warnings: check.warnings || [] };
      },
      moveNode: (id, targetParentId, index) =>
        dispatch({ type: 'MOVE_NODE', id, targetParentId, index }),
      updateNode: (id, patch) => dispatch({ type: 'UPDATE_NODE', id, patch }),
      removeNode: (id) => dispatch({ type: 'REMOVE_NODE', id }),
      applyAiDraft: ({ project, tree, baseVersion }) => {
        const cur = stateRef.current;
        const payload = project || tree;
        const conflict =
          !payload || typeof payload !== 'object' || baseVersion !== cur.projectVersion;
        const nextProject = isProject(payload)
          ? payload
          : updateActiveTree(cur.project, payload);
        const changedPages = conflict ? [] : diffChangedPageTitles(cur.project, nextProject);
        dispatch({ type: 'APPLY_AI_DRAFT', project, tree, baseVersion });
        return { ok: !conflict, conflict, changedPages };
      },
      getLatestSnapshot: () => ({
        project: stateRef.current.project,
        projectVersion: stateRef.current.projectVersion,
        tree: stateRef.current.tree,
        treeVersion: stateRef.current.projectVersion,
        activePageId: stateRef.current.project.activePageId,
        selectedId: stateRef.current.selectedId,
        editingId: stateRef.current.editingId,
      }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      resetTree: (input) => dispatch({ type: 'RESET_TREE', project: isProject(input) ? input : undefined, tree: !isProject(input) ? input : undefined }),
    }),
    []
  );

  return {
    state,
    activePage: getActivePage(state.project),
    dispatch,
    actions,
    canUndo: !state.aiBusy && state.history.past.length > 0,
    canRedo: !state.aiBusy && state.history.future.length > 0,
    handleShortcutKeyDown,
  };
}

export default useTreeStore;
