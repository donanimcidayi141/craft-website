import sampleTree from './sampleTree.js';
import { findNode, updateNode } from './treeOps.js';
import {
  COLOR_TOKENS,
  DEFAULT_THEME_COLORS,
  FONT_FAMILIES,
  inspectTreeIssues,
  parsePageHref,
  sanitizePlainText,
  validateColor,
} from './schema.js';

/**
 * Saf çoklu sayfa proje modeli (schemaVersion: 2, React bağımsız).
 * - Tüm düğüm ID'leri proje genelinde benzersizdir.
 * - Tema (renk token'ları ve yazı tipi ailesi) proje seviyesinde tutulur ve tüm sayfalarca paylaşılır.
 * - Tüm işlemler immutable'dır ve hata fırlatmaz (`{ ok, project?, warnings?, error? }` döner).
 */

export const PROJECT_SCHEMA_VERSION = 2;
export const MIN_PROJECT_PAGES = 1;
export const MAX_PROJECT_PAGES = 12;

const COLOR_SET_OR_FONT = new Set(FONT_FAMILIES);
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createDefaultTheme(overrides = {}) {
  const base = {
    ...DEFAULT_THEME_COLORS,
    fontFamily: 'sans',
  };
  if (overrides && typeof overrides === 'object') {
    for (const k of COLOR_TOKENS) {
      if (overrides[k] !== undefined) {
        const res = validateColor(overrides[k], { allowTokens: false });
        if (res.ok) base[k] = res.value;
      }
    }
    if (overrides.fontFamily && COLOR_SET_OR_FONT.has(overrides.fontFamily)) {
      base.fontFamily = overrides.fontFamily;
    }
  }
  return base;
}

const TURKISH_CHAR_MAP = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  I: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

/**
 * Türkçe karakterleri ASCII'ye çevirerek URL/dosya güvenilir slug üretir.
 */
export function slugifyTitle(title, fallback = 'sayfa') {
  const raw = String(title ?? '')
    .split('')
    .map((ch) => (ch in TURKISH_CHAR_MAP ? TURKISH_CHAR_MAP[ch] : ch))
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return raw || fallback;
}

export function ensureUniqueSlug(desiredSlug, usedSlugs = new Set(), isHome = false) {
  if (isHome) return 'index';
  let base = slugifyTitle(desiredSlug, 'sayfa');
  if (base === 'index') base = 'sayfa';
  if (!usedSlugs.has(base)) return base;
  let counter = 2;
  while (usedSlugs.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export function collectTreeIds(node, counts = new Map()) {
  if (!node || typeof node !== 'object') return counts;
  if (node.id) {
    counts.set(node.id, (counts.get(node.id) || 0) + 1);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectTreeIds(child, counts);
    }
  }
  return counts;
}

export function collectProjectIds(project) {
  const used = new Set();
  if (!project || typeof project !== 'object') return used;
  for (const page of project.pages || []) {
    if (page?.id) used.add(page.id);
    if (page?.tree) {
      const counts = collectTreeIds(page.tree);
      for (const id of counts.keys()) used.add(id);
    }
  }
  return used;
}

/**
 * Proje geneli benzersiz ID üreteci (mevcut tüm sayfa/düğüm ID'leriyle çakışmaz).
 */
export function createProjectIdGen(project, prefix = 'n') {
  const used = collectProjectIds(project);
  let seq = 1;
  return (hint = prefix) => {
    const cleanHint = slugifyTitle(hint || prefix, prefix) || prefix;
    while (used.has(`${cleanHint}-${seq}`)) {
      seq += 1;
    }
    const nextId = `${cleanHint}-${seq}`;
    used.add(nextId);
    seq += 1;
    return nextId;
  };
}

export function isProject(val) {
  return Boolean(
    val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      Number(val.schemaVersion) === PROJECT_SCHEMA_VERSION &&
      Array.isArray(val.pages)
  );
}

/**
 * Eski tek ağaç projesini (`schemaVersion: 2` öncesi) tek sayfalı çoklu sayfa projesine çevirir.
 */
export function fromLegacyTree(tree = sampleTree, options = {}) {
  if (isProject(tree)) {
    return {
      ...tree,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      theme: createDefaultTheme(tree.theme),
    };
  }
  const sourceTree = tree && typeof tree === 'object' ? tree : sampleTree;
  const pageId = sourceTree.id && SAFE_ID_RE.test(sourceTree.id) ? sourceTree.id : 'page-home';
  const theme = createDefaultTheme(options.theme || sourceTree.props?.theme);

  const normalizedTree =
    sourceTree.id === pageId ? sourceTree : { ...sourceTree, id: pageId };

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    theme,
    pages: [
      {
        id: pageId,
        slug: 'index',
        title: sanitizePlainText(options.title || 'Ana Sayfa', 80).trim() || 'Ana Sayfa',
        isHome: true,
        tree: normalizedTree,
      },
    ],
    activePageId: pageId,
  };
}

export function ensureProject(input = sampleTree) {
  return isProject(input) ? input : fromLegacyTree(input);
}

export function getActivePage(project) {
  if (!isProject(project) || project.pages.length === 0) return null;
  return project.pages.find((p) => p.id === project.activePageId) || project.pages[0];
}

export function getActiveTree(project) {
  return getActivePage(project)?.tree || null;
}

export function getPageFileName(page) {
  if (!page || page.isHome) return 'index.html';
  const cleanSlug = slugifyTitle(page.slug, 'sayfa');
  return cleanSlug === 'index' ? 'sayfa.html' : `${cleanSlug}.html`;
}

export function findNodeInProject(project, nodeId) {
  if (!isProject(project) || !nodeId) return null;
  for (let i = 0; i < project.pages.length; i += 1) {
    const page = project.pages[i];
    const node = findNode(page?.tree, nodeId);
    if (node) {
      return { page, node, pageIndex: i };
    }
  }
  return null;
}

/**
 * Projenin yapısal tutarlılığını ve tüm sayfa ağaçlarındaki sorunları doğrular.
 */
export function validateProject(project) {
  const errors = [];
  const issues = [];

  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    errors.push('Proje bir nesne olmalıdır.');
    return { ok: false, errors, issues };
  }

  if (Number(project.schemaVersion) !== PROJECT_SCHEMA_VERSION) {
    errors.push(`Geçersiz schemaVersion (${project.schemaVersion}); beklenen: ${PROJECT_SCHEMA_VERSION}.`);
  }

  if (!Array.isArray(project.pages)) {
    errors.push('Proje pages dizisi içermelidir.');
    return { ok: false, errors, issues };
  }

  if (project.pages.length < MIN_PROJECT_PAGES || project.pages.length > MAX_PROJECT_PAGES) {
    errors.push(
      `Sayfa sayısı ${MIN_PROJECT_PAGES} ile ${MAX_PROJECT_PAGES} arasında olmalıdır (mevcut: ${project.pages.length}).`
    );
  }

  const pageIds = new Set();
  const slugs = new Set();
  const globalNodeOwners = new Map(); // nodeId -> pageId
  let homeCount = 0;

  for (let idx = 0; idx < project.pages.length; idx += 1) {
    const page = project.pages[idx];
    if (!page || typeof page !== 'object') {
      errors.push(`Sayfa #${idx + 1} geçersiz nesne.`);
      continue;
    }
    if (!page.id || typeof page.id !== 'string' || !SAFE_ID_RE.test(page.id)) {
      errors.push(`Sayfa #${idx + 1} geçersiz ID içeriyor.`);
    } else if (pageIds.has(page.id)) {
      errors.push(`Tekrar eden sayfa ID'si: "${page.id}".`);
    } else {
      pageIds.add(page.id);
    }

    if (page.isHome) {
      homeCount += 1;
      if (page.slug !== 'index') {
        errors.push(`Ana sayfanın ("${page.id}") slug değeri "index" olmalıdır.`);
      }
    } else if (page.slug === 'index') {
      errors.push(`"index" slug değeri yalnızca ana sayfaya verilebilir ("${page.id}").`);
    }

    if (!page.slug || typeof page.slug !== 'string' || !SAFE_SLUG_RE.test(page.slug)) {
      errors.push(`Sayfa "${page.id || idx}" geçersiz slug içeriyor: "${page.slug}".`);
    } else if (slugs.has(page.slug)) {
      errors.push(`Tekrar eden sayfa slug değeri: "${page.slug}".`);
    } else {
      slugs.add(page.slug);
    }

    if (!page.tree || typeof page.tree !== 'object') {
      errors.push(`Sayfa "${page.id || idx}" ağaç (tree) nesnesi içermiyor.`);
      continue;
    }

    const counts = collectTreeIds(page.tree);
    for (const [nodeId, count] of counts.entries()) {
      if (count > 1) {
        errors.push(`Sayfa "${page.title || page.id}" içinde tekrar eden düğüm ID'si: "${nodeId}".`);
      }
      if (globalNodeOwners.has(nodeId)) {
        errors.push(
          `Sayfalar arası tekrar eden düğüm ID'si: "${nodeId}" ("${globalNodeOwners.get(nodeId)}" ve "${page.id}").`
        );
      } else {
        globalNodeOwners.set(nodeId, page.id);
      }
    }

    const sections = (page.tree.children || []).filter((c) => c && c.type === 'section');
    if (sections.length === 0) {
      issues.push({
        nodeId: page.tree.id || page.id,
        pageId: page.id,
        kind: 'empty_page',
        message: `"${page.title || page.id}" sayfasında hiç bölüm (section) yok.`,
      });
    }
  }

  if (homeCount !== 1) {
    errors.push(`Projede tam olarak 1 ana sayfa (isHome: true) olmalıdır (mevcut: ${homeCount}).`);
  }

  if (!project.activePageId || !pageIds.has(project.activePageId)) {
    errors.push(`activePageId ("${project.activePageId}") geçerli bir sayfaya işaret etmiyor.`);
  }

  for (const page of project.pages) {
    if (page?.tree && typeof page.tree === 'object') {
      const pageIssues = [];
      inspectTreeIssues(page.tree, pageIssues, { validPageIds: pageIds });
      for (const item of pageIssues) {
        issues.push({ ...item, pageId: page.id });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    issues,
  };
}

function buildStarterPageTree(title, idGen) {
  const rootId = idGen('page');
  const secId = idGen('sec');
  const titleId = idGen('h1');
  const descId = idGen('p');
  return {
    id: rootId,
    type: 'page',
    placement: 'flow',
    layout: { mode: 'stack' },
    size: { w: 'fill', h: 'hug' },
    props: {
      bg: 'surface',
      color: 'text',
    },
    children: [
      {
        id: secId,
        type: 'section',
        placement: 'flow',
        layout: { mode: 'stack', gap: 'md', padding: 'xl', align: 'start' },
        size: { w: 'fill', h: 'hug' },
        props: { bg: 'surface', maxWidth: '1200px' },
        children: [
          {
            id: titleId,
            type: 'text',
            placement: 'flow',
            size: { w: 'fill', h: 'hug' },
            props: {
              tag: 'h1',
              text: sanitizePlainText(title, 120) || 'Yeni Sayfa',
              fontVariant: 'h1',
              fontWeight: 700,
              color: 'primary',
            },
          },
          {
            id: descId,
            type: 'text',
            placement: 'flow',
            size: { w: 'fill', h: 'hug' },
            props: {
              tag: 'p',
              text: 'Bu sayfanın içeriğini düzenleyebilir, yeni bölümler veya içerik paketleri ekleyebilirsiniz.',
              fontVariant: 'body',
              color: 'muted',
            },
          },
        ],
      },
    ],
  };
}

function ensureTreeIdsUniqueInProject(node, usedIds, idGen) {
  if (!node || typeof node !== 'object') return node;
  let nextId = node.id;
  if (!nextId || !SAFE_ID_RE.test(nextId) || usedIds.has(nextId)) {
    nextId = idGen(node.type || 'node');
  } else {
    usedIds.add(nextId);
  }
  const nextChildren = Array.isArray(node.children)
    ? node.children.map((c) => ensureTreeIdsUniqueInProject(c, usedIds, idGen))
    : undefined;
  return {
    ...node,
    id: nextId,
    ...(nextChildren !== undefined ? { children: nextChildren } : {}),
  };
}

export function addPage(project, { title = 'Yeni Sayfa', slug, tree } = {}) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  if (project.pages.length >= MAX_PROJECT_PAGES) {
    return {
      ok: false,
      error: `En fazla ${MAX_PROJECT_PAGES} sayfa oluşturulabilir.`,
    };
  }

  const cleanTitle = sanitizePlainText(title || 'Yeni Sayfa', 80).trim() || 'Yeni Sayfa';
  const usedSlugs = new Set(project.pages.map((p) => p.slug));
  const finalSlug = ensureUniqueSlug(slug || cleanTitle, usedSlugs, false);

  const idGen = createProjectIdGen(project, 'pg');
  const pageId = idGen('pg');
  const usedIds = collectProjectIds(project);
  usedIds.add(pageId);

  const pageTree = tree
    ? ensureTreeIdsUniqueInProject(tree, usedIds, idGen)
    : buildStarterPageTree(cleanTitle, idGen);

  const newPage = {
    id: pageId,
    slug: finalSlug,
    title: cleanTitle,
    isHome: false,
    tree: pageTree,
  };

  return {
    ok: true,
    page: newPage,
    project: {
      ...project,
      pages: [...project.pages, newPage],
    },
  };
}

function scrubBrokenPageLinksInTree(node, deletedPageId, pageTitle, warnings) {
  if (!node || typeof node !== 'object') return node;

  let changed = false;
  let nextProps = node.props;
  if (node.type === 'button' && node.props?.href && parsePageHref(node.props.href) === deletedPageId) {
    nextProps = { ...node.props, href: '#' };
    changed = true;
    warnings.push(
      `Düğme '${node.id}' ("${pageTitle}" sayfasındaki) silinen '${deletedPageId}' sayfasına bağlıydı; bağlantı '#' olarak sıfırlandı.`
    );
  }

  let nextChildren = node.children;
  if (Array.isArray(node.children)) {
    let anyChildChanged = false;
    const mapped = node.children.map((child) => {
      const updated = scrubBrokenPageLinksInTree(child, deletedPageId, pageTitle, warnings);
      if (updated !== child) anyChildChanged = true;
      return updated;
    });
    if (anyChildChanged) {
      nextChildren = mapped;
      changed = true;
    }
  }

  if (!changed) return node;
  return {
    ...node,
    props: nextProps,
    children: nextChildren,
  };
}

export function removePage(project, pageId) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  if (project.pages.length <= MIN_PROJECT_PAGES) {
    return { ok: false, error: 'Projedeki son sayfa silinemez.' };
  }
  const target = project.pages.find((p) => p.id === pageId);
  if (!target) {
    return { ok: false, error: `Sayfa bulunamadı: "${pageId}".` };
  }
  if (target.isHome) {
    return { ok: false, error: 'Ana sayfa silinemez. Önce başka bir sayfayı ana sayfa yapın.' };
  }

  const warnings = [];
  const nextPages = project.pages
    .filter((p) => p.id !== pageId)
    .map((p) => ({
      ...p,
      tree: scrubBrokenPageLinksInTree(p.tree, pageId, p.title || p.id, warnings),
    }));

  const homePage = nextPages.find((p) => p.isHome) || nextPages[0];
  const nextActivePageId =
    project.activePageId === pageId || !nextPages.some((p) => p.id === project.activePageId)
      ? homePage.id
      : project.activePageId;

  return {
    ok: true,
    removedPage: target,
    warnings,
    project: {
      ...project,
      pages: nextPages,
      activePageId: nextActivePageId,
    },
  };
}

export function renamePage(project, pageId, nextTitle, nextSlug) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  const idx = project.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) {
    return { ok: false, error: `Sayfa bulunamadı: "${pageId}".` };
  }
  const cleanTitle = sanitizePlainText(nextTitle || '', 80).trim();
  if (!cleanTitle) {
    return { ok: false, error: 'Sayfa başlığı boş olamaz.' };
  }

  const current = project.pages[idx];
  let finalSlug = current.slug;
  if (current.isHome) {
    finalSlug = 'index';
  } else {
    const usedSlugs = new Set(project.pages.filter((p) => p.id !== pageId).map((p) => p.slug));
    const slugSource =
      nextSlug !== undefined && String(nextSlug).trim() !== '' ? nextSlug : cleanTitle;
    finalSlug = ensureUniqueSlug(slugSource, usedSlugs, false);
  }

  const updatedPage = {
    ...current,
    title: cleanTitle,
    slug: finalSlug,
  };
  const nextPages = project.pages.map((p, i) => (i === idx ? updatedPage : p));
  return {
    ok: true,
    page: updatedPage,
    project: {
      ...project,
      pages: nextPages,
    },
  };
}

export function setHome(project, pageId) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  const target = project.pages.find((p) => p.id === pageId);
  if (!target) {
    return { ok: false, error: `Sayfa bulunamadı: "${pageId}".` };
  }
  if (target.isHome && target.slug === 'index') {
    return { ok: true, project };
  }

  const reservedSlugs = new Set(
    project.pages.filter((p) => p.id !== pageId && !p.isHome).map((p) => p.slug)
  );
  reservedSlugs.add('index');

  const nextPages = project.pages.map((p) => {
    if (p.id === pageId) {
      return { ...p, isHome: true, slug: 'index' };
    }
    if (p.isHome) {
      const reassignedSlug = ensureUniqueSlug(slugifyTitle(p.title, 'ana-sayfa'), reservedSlugs, false);
      reservedSlugs.add(reassignedSlug);
      return { ...p, isHome: false, slug: reassignedSlug };
    }
    return p;
  });

  return {
    ok: true,
    project: {
      ...project,
      pages: nextPages,
    },
  };
}

export function movePage(project, pageId, targetIndex) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  const fromIdx = project.pages.findIndex((p) => p.id === pageId);
  if (fromIdx === -1) {
    return { ok: false, error: `Sayfa bulunamadı: "${pageId}".` };
  }
  const boundedIndex = Math.max(0, Math.min(project.pages.length - 1, Math.round(Number(targetIndex) || 0)));
  if (fromIdx === boundedIndex) {
    return { ok: true, project };
  }
  const nextPages = [...project.pages];
  const [moved] = nextPages.splice(fromIdx, 1);
  nextPages.splice(boundedIndex, 0, moved);
  return {
    ok: true,
    project: {
      ...project,
      pages: nextPages,
    },
  };
}

export function switchPage(project, pageId) {
  if (!isProject(project)) {
    return { ok: false, error: 'Geçersiz proje yapısı.' };
  }
  const target = project.pages.find((p) => p.id === pageId);
  if (!target) {
    return { ok: false, error: `Sayfa bulunamadı: "${pageId}".` };
  }
  if (project.activePageId === pageId) {
    return { ok: true, project };
  }
  return {
    ok: true,
    project: {
      ...project,
      activePageId: pageId,
    },
  };
}

export function updatePageTree(project, pageId, nextTree) {
  if (!isProject(project) || !nextTree || typeof nextTree !== 'object') return project;
  const idx = project.pages.findIndex((p) => p.id === pageId);
  if (idx === -1 || project.pages[idx].tree === nextTree) return project;
  const nextPages = project.pages.map((p, i) => (i === idx ? { ...p, tree: nextTree } : p));
  return {
    ...project,
    pages: nextPages,
  };
}

export function updateActiveTree(project, nextTree) {
  const active = getActivePage(project);
  if (!active) return project;
  return updatePageTree(project, active.id, nextTree);
}

export function updateProjectTheme(project, tokens) {
  if (!isProject(project)) return project;
  const nextTheme = createDefaultTheme({ ...(project.theme || {}), ...(tokens || {}) });
  // Kök ağaçtaki font/bg/color tokenlarının uyumlu kalmasını sağla (eski theme alanını sayfa üzerinden proje seviyesine taşı)
  const nextPages = project.pages.map((p) => {
    if (!p.tree) return p;
    const prevProps = p.tree.props || {};
    const cleanProps = { ...prevProps };
    delete cleanProps.theme;
    if (tokens?.surface) cleanProps.bg = 'surface';
    if (tokens?.text) cleanProps.color = 'text';
    if (tokens?.fontFamily) cleanProps.fontFamily = tokens.fontFamily;
    return {
      ...p,
      tree: updateNode(p.tree, p.tree.id, { props: cleanProps }),
    };
  });
  return {
    ...project,
    theme: nextTheme,
    pages: nextPages,
  };
}
