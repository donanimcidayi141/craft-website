import {
  ALIGN_TOKENS,
  COLOR_TOKENS,
  FONT_FAMILIES,
  GAP_PADDING_TOKENS,
  JUSTIFY_TOKENS,
  LAYOUT_MODES,
  MAX_COLUMNS,
  MIN_COLUMNS,
  RESPONSIVE_BREAKPOINTS,
  WRAP_MODES,
  inspectTreeIssues,
  sanitizePlainText,
  validateNodePatch,
  validateThemeTokens,
} from './schema.js';
import {
  canAcceptChild,
  canNodeAcceptChildren,
  findNode,
  findNodeAndLocation,
  isDescendant,
  moveNode,
  removeNode,
  updateNode,
} from './treeOps.js';
import { buildPreset, listPresets } from './presets.js';
import {
  addPage,
  collectProjectIds,
  findNodeInProject,
  getActivePage,
  getActiveTree,
  isProject,
  removePage,
  renamePage,
  switchPage,
  updateActiveTree,
  updateProjectTheme,
  validateProject,
} from './project.js';
import { listContentPacks, packToNodes } from './packAdapter.js';

/**
 * Gemini function calling araç bildirimleri ve saf yürütücü (React bağımsız).
 * - Hem legacy tek sayfa ağaçlarını hem schemaVersion:2 çoklu sayfa projelerini destekler.
 * - Tüm değişiklikler verilen `draft` üzerinde immutable olarak uygulanır.
 * - `executeTool` ASLA throw etmez.
 */

const PRESET_NAMES = listPresets().map((p) => p.name);
const PACK_IDS = listContentPacks().map((p) => p.id);

export const TOOL_DECLARATIONS = [
  {
    name: 'get_project_outline',
    description:
      'Projedeki tüm sayfaların özetini (id, title, slug, isHome, isActive) ve aktif sayfa ağacındaki düğümlerin hiyerarşik özetini döndürür.',
    parameters: {
      type: 'OBJECT',
      properties: {
        maxDepth: {
          type: 'INTEGER',
          description: 'Aktif sayfa özetinin ineceği azami ağaç derinliği (varsayılan 5).',
        },
      },
    },
  },
  {
    name: 'add_page',
    description: 'Projeye yeni bir sayfa ekler (otomatik benzersiz Türkçe slug ve başlangıç bölümü oluşturur).',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Sayfa başlığı (örn. "Hakkımızda", "İletişim").',
        },
        slug: {
          type: 'STRING',
          description: 'Opsiyonel URL kısa adı (boş bırakılırsa başlıktan otomatik üretilir).',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'switch_page',
    description: 'Düzenlenecek aktif sayfayı değiştirir. Diğer bir sayfadaki düğümleri düzenlemeden önce bu aracı çağırın.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pageId: {
          type: 'STRING',
          description: 'Geçilecek hedef sayfanın kimliği (id).',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'rename_page',
    description: 'Belirtilen sayfanın başlığını günceller (ana sayfa dışındaki sayfaların slug değeri de uyarlanır).',
    parameters: {
      type: 'OBJECT',
      properties: {
        pageId: {
          type: 'STRING',
          description: 'Yeniden adlandırılacak sayfanın kimliği.',
        },
        title: {
          type: 'STRING',
          description: 'Yeni sayfa başlığı.',
        },
      },
      required: ['pageId', 'title'],
    },
  },
  {
    name: 'remove_page',
    description: 'Projeden bir sayfayı kaldırır (en az 1 sayfa kalmalıdır).',
    parameters: {
      type: 'OBJECT',
      properties: {
        pageId: {
          type: 'STRING',
          description: 'Silinecek sayfanın kimliği.',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'list_content_packs',
    description: 'Akış şemasına dönüştürülüp sayfaya eklenebilen hazır navbar, footer, slider ve içerik blok paketlerini listeler.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'insert_content_pack',
    description: 'Hazır içerik paketini akış şemasına dönüştürerek aktif sayfaya yeni bir bölüm olarak ekler.',
    parameters: {
      type: 'OBJECT',
      properties: {
        packId: {
          type: 'STRING',
          enum: PACK_IDS,
          description: 'Eklenecek hazır içerik paketi kimliği.',
        },
        targetSectionId: {
          type: 'STRING',
          description: 'Opsiyonel: yeni bölümün hemen altına ekleneceği mevcut section kimliği.',
        },
        index: {
          type: 'INTEGER',
          description: 'Opsiyonel: bölümün yerleştirileceği sıfır tabanlı sıra indeksi.',
        },
      },
      required: ['packId'],
    },
  },
  {
    name: 'link_to_page',
    description: 'Aktif sayfadaki bir button düğümünü projedeki başka bir sayfaya (page:<pageId>) bağlar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        buttonId: {
          type: 'STRING',
          description: 'Aktif sayfadaki hedef button düğüm kimliği.',
        },
        pageId: {
          type: 'STRING',
          description: 'Butona tıklandığında açılacak hedef sayfa kimliği.',
        },
      },
      required: ['buttonId', 'pageId'],
    },
  },
  {
    name: 'get_node',
    description: 'Belirli bir düğümün layout, size, responsive, props ve doğrudan çocuk bilgilerini döndürür.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'İncelenecek düğüm kimliği.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_selection',
    description: 'Kullanıcının editörde o an seçili bıraktığı düğümün kimliğini ve özetini (yoksa null) döndürür.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'list_section_presets',
    description: 'Kullanılabilir tüm hazır bölüm (section) presetlerini ve kabul ettikleri props şemalarını listeler.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'add_section',
    description: 'Sayfaya hazır presetlerden yeni bir bölüm (section) ekler.',
    parameters: {
      type: 'OBJECT',
      properties: {
        preset: {
          type: 'STRING',
          enum: PRESET_NAMES,
          description: 'Eklenecek bölüm preset adı.',
        },
        props: {
          type: 'OBJECT',
          description: 'Başlık, alt başlık, buton metni veya kart/plan listeleri (en fazla 6 öğe) gibi içerik alanları.',
          properties: {
            eyebrow: { type: 'STRING' },
            title: { type: 'STRING' },
            subtitle: { type: 'STRING' },
            buttonText: { type: 'STRING' },
            buttonHref: { type: 'STRING' },
            items: { type: 'ARRAY', items: { type: 'OBJECT' } },
            plans: { type: 'ARRAY', items: { type: 'OBJECT' } },
            columns: { type: 'ARRAY', items: { type: 'OBJECT' } },
          },
        },
        index: {
          type: 'INTEGER',
          description: 'Bölümün yerleştirileceği sıfır tabanlı sıra indeksi (verilmezse sona eklenir).',
        },
      },
      required: ['preset'],
    },
  },
  {
    name: 'replace_section',
    description: 'Sayfa kökündeki mevcut bir bölümü seçilen preset ve props ile yenisiyle değiştirir.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Değiştirilecek kök section kimliği.',
        },
        preset: {
          type: 'STRING',
          enum: PRESET_NAMES,
          description: 'Yeni bölüm preset adı.',
        },
        props: {
          type: 'OBJECT',
          description: 'Yeni bölüm içerik özellikleri.',
          properties: {
            eyebrow: { type: 'STRING' },
            title: { type: 'STRING' },
            subtitle: { type: 'STRING' },
            buttonText: { type: 'STRING' },
            buttonHref: { type: 'STRING' },
            items: { type: 'ARRAY', items: { type: 'OBJECT' } },
            plans: { type: 'ARRAY', items: { type: 'OBJECT' } },
            columns: { type: 'ARRAY', items: { type: 'OBJECT' } },
          },
        },
      },
      required: ['id', 'preset'],
    },
  },
  {
    name: 'remove_node',
    description: 'Bir düğümü ağaçtan kaldırır. Sayfadaki son section silinemez ve kök page silinemez.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Silinecek düğüm kimliği.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'move_node',
    description: 'Bir düğümü hedef ebeveynin belirtilen indeksine taşır (ağaç kabul kurallarına uyar).',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Taşınacak düğüm kimliği.',
        },
        targetParentId: {
          type: 'STRING',
          description: 'Hedef ebeveyn düğüm kimliği.',
        },
        index: {
          type: 'INTEGER',
          description: 'Hedef ebeveyn içindeki sıfır tabanlı konum indeksi.',
        },
      },
      required: ['id', 'targetParentId', 'index'],
    },
  },
  {
    name: 'set_layout',
    description: 'Bir container/section düğümünün masaüstü düzen tokenlarını günceller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Düzenlenecek düğüm kimliği.',
        },
        layout: {
          type: 'OBJECT',
          description: 'Düzen ayarları (token ve enum değerleriyle).',
          properties: {
            mode: { type: 'STRING', enum: LAYOUT_MODES },
            gap: { type: 'STRING', enum: GAP_PADDING_TOKENS },
            padding: { type: 'STRING', enum: GAP_PADDING_TOKENS },
            align: { type: 'STRING', enum: ALIGN_TOKENS },
            justify: { type: 'STRING', enum: JUSTIFY_TOKENS },
            wrap: { type: 'STRING', enum: WRAP_MODES },
            columns: {
              type: 'INTEGER',
              description: `${MIN_COLUMNS} ile ${MAX_COLUMNS} arası tamsayı sütun sayısı.`,
            },
          },
        },
      },
      required: ['id', 'layout'],
    },
  },
  {
    name: 'set_size',
    description: 'Bir düğümün boyutlandırma modunu (fill/hug/auto veya CSS uzunluğu) ayarlar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Düğüm kimliği.',
        },
        size: {
          type: 'OBJECT',
          properties: {
            w: {
              type: 'STRING',
              description: 'fill, hug veya geçerli CSS uzunluğu (örn. 320px).',
            },
            h: {
              type: 'STRING',
              description: 'hug veya auto (sabit px yüksekliğinden kaçının).',
            },
          },
        },
      },
      required: ['id', 'size'],
    },
  },
  {
    name: 'set_responsive',
    description: 'Tablet (md) veya mobil (sm) kırılımı için yalnızca değişen düzen/boyut alanlarını günceller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Düğüm kimliği.',
        },
        breakpoint: {
          type: 'STRING',
          enum: RESPONSIVE_BREAKPOINTS,
          description: 'Hedef ekran kırılımı.',
        },
        patch: {
          type: 'OBJECT',
          description: 'İlgili kırılımda üzerine yazılacak layout veya size alanları.',
          properties: {
            layout: {
              type: 'OBJECT',
              properties: {
                mode: { type: 'STRING', enum: LAYOUT_MODES },
                gap: { type: 'STRING', enum: GAP_PADDING_TOKENS },
                padding: { type: 'STRING', enum: GAP_PADDING_TOKENS },
                align: { type: 'STRING', enum: ALIGN_TOKENS },
                justify: { type: 'STRING', enum: JUSTIFY_TOKENS },
                columns: { type: 'INTEGER' },
              },
            },
            size: {
              type: 'OBJECT',
              properties: {
                w: { type: 'STRING' },
                h: { type: 'STRING' },
              },
            },
          },
        },
      },
      required: ['id', 'breakpoint', 'patch'],
    },
  },
  {
    name: 'set_text',
    description: 'Bir text veya button düğümünün düz metin içeriğini günceller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Metni değiştirilecek text veya button düğüm kimliği.',
        },
        text: {
          type: 'STRING',
          description: 'Yeni düz metin (HTML içermez).',
        },
      },
      required: ['id', 'text'],
    },
  },
  {
    name: 'set_image',
    description: 'Bir image düğümünün güvenli görsel kaynağını (https: veya data:image/) ve alt metnini ayarlar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description: 'Görsel düğüm kimliği.',
        },
        src: {
          type: 'STRING',
          description: 'Yalnızca https: veya data:image/ ile başlayan URL.',
        },
        alt: {
          type: 'STRING',
          description: 'Erişilebilirlik için boş olmayan açıklama metni.',
        },
      },
      required: ['id', 'src', 'alt'],
    },
  },
  {
    name: 'apply_theme',
    description:
      'Proje geneli (tüm sayfalarca paylaşılan) renk tokenlarını (#rgb/#rrggbb) ve temel yazı tipi ailesini (sans/serif/mono) uygular.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tokens: {
          type: 'OBJECT',
          description: 'Tema renkleri (hex #rgb/#rrggbb) ve fontFamily.',
          properties: {
            primary: { type: 'STRING', description: 'Ana marka rengi (#rrggbb)' },
            accent: { type: 'STRING', description: 'Vurgu rengi (#rrggbb)' },
            surface: { type: 'STRING', description: 'Yüzey arka plan rengi (#rrggbb)' },
            text: { type: 'STRING', description: 'Ana metin rengi (#rrggbb)' },
            muted: { type: 'STRING', description: 'İkincil metin rengi (#rrggbb)' },
            fontFamily: { type: 'STRING', enum: FONT_FAMILIES },
          },
        },
      },
      required: ['tokens'],
    },
  },
  {
    name: 'validate_project',
    description:
      'Tüm sayfaları ve proje yapısını (boş sayfa/bölüm, kırık page: bağlantıları, tekrar eden ID, sabit px yükseklik, eksik alt metin, geçersiz token) açısından denetler.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

function summarizeNodeOutline(node, depth = 0, maxDepth = 5) {
  if (!node || typeof node !== 'object') return null;
  const rawLabel = node.props?.text || node.props?.label || node.props?.alt || '';
  const label = rawLabel ? sanitizePlainText(rawLabel, 64) : undefined;
  const entry = {
    id: node.id,
    type: node.type,
    placement: node.placement || 'flow',
    ...(label ? { label } : {}),
    childCount: Array.isArray(node.children) ? node.children.length : 0,
  };
  if (depth < maxDepth && Array.isArray(node.children) && node.children.length > 0) {
    entry.children = node.children
      .map((child) => summarizeNodeOutline(child, depth + 1, maxDepth))
      .filter(Boolean);
  }
  return entry;
}

function collectNodeIds(node, into = new Set()) {
  if (!node || typeof node !== 'object') return into;
  if (node.id) into.add(node.id);
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectNodeIds(child, into);
  }
  return into;
}

function makeDraftSafeIdGen(draft, baseIdGen) {
  const used = isProject(draft) ? collectProjectIds(draft) : collectNodeIds(draft);
  let seq = 1;
  return (hint = 'node') => {
    const cleanHint = String(hint || 'node').replace(/[^a-zA-Z0-9_-]/g, '') || 'node';
    const rawFirst =
      typeof baseIdGen === 'function' ? String(baseIdGen(cleanHint) || '') : `${cleanHint}-${seq}`;
    let candidate = rawFirst || `${cleanHint}-${seq}`;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${rawFirst || cleanHint}-${counter}`;
      counter += 1;
    }
    used.add(candidate);
    seq += 1;
    return candidate;
  };
}

function fail(draft, error) {
  if (isProject(draft)) {
    return {
      project: draft,
      tree: getActiveTree(draft),
      result: { ok: false, error },
    };
  }
  return {
    tree: draft,
    result: { ok: false, error },
  };
}

function succeedProject(nextProject, result) {
  return {
    project: nextProject,
    tree: getActiveTree(nextProject),
    result,
  };
}

function commitActiveTree(draft, projectMode, nextTree, result) {
  if (projectMode) {
    const nextProject = updateActiveTree(draft, nextTree);
    return succeedProject(nextProject, result);
  }
  return {
    tree: nextTree,
    result,
  };
}

function readOnlySuccess(draft, projectMode, result) {
  if (projectMode) {
    return succeedProject(draft, result);
  }
  return {
    tree: draft,
    result,
  };
}

function resolveNodeOnActive(draft, projectMode, activePage, activeTree, nodeId, notFoundMsg = 'id bulunamadı') {
  if (!nodeId || typeof nodeId !== 'string') {
    return { ok: false, error: notFoundMsg };
  }
  const node = findNode(activeTree, nodeId);
  if (node) return { ok: true, node };
  if (projectMode) {
    const owner = findNodeInProject(draft, nodeId);
    if (owner && owner.page.id !== activePage.id) {
      return {
        ok: false,
        error: `Düğüm '${owner.page.title}' sayfasında; önce switch_page çağır.`,
      };
    }
  }
  return { ok: false, error: notFoundMsg };
}

function resolveLocOnActive(draft, projectMode, activePage, activeTree, nodeId, notFoundMsg = 'id bulunamadı') {
  if (!nodeId || typeof nodeId !== 'string') {
    return { ok: false, error: notFoundMsg };
  }
  const loc = findNodeAndLocation(activeTree, nodeId);
  if (loc) return { ok: true, loc };
  if (projectMode) {
    const owner = findNodeInProject(draft, nodeId);
    if (owner && owner.page.id !== activePage.id) {
      return {
        ok: false,
        error: `Düğüm '${owner.page.title}' sayfasında; önce switch_page çağır.`,
      };
    }
  }
  return { ok: false, error: notFoundMsg };
}

function findRootSectionIndexOfNode(activeTree, nodeId) {
  const sections = Array.isArray(activeTree?.children) ? activeTree.children : [];
  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    if (sec?.id === nodeId || (sec && findNode(sec, nodeId))) {
      return i;
    }
  }
  return -1;
}

/**
 * Tek bir AI araç çağrısını saf ve immutable olarak yürütür.
 * Asla throw etmez.
 */
export function executeTool(draft, name, args = {}, idGen, context = {}) {
  try {
    if (!draft || typeof draft !== 'object') {
      return fail(draft, 'Geçersiz proje yapısı.');
    }
    const safeArgs = args && typeof args === 'object' ? args : {};
    const projectMode = isProject(draft);
    const activePage = projectMode ? getActivePage(draft) : null;
    const activeTree = projectMode ? activePage?.tree : draft;

    if (!activeTree || typeof activeTree !== 'object') {
      return fail(draft, 'Geçerli aktif sayfa ağacı bulunamadı.');
    }

    switch (name) {
      case 'get_project_outline': {
        const depthLimit = Math.min(8, Math.max(1, Number(safeArgs.maxDepth) || 5));
        if (projectMode) {
          return succeedProject(draft, {
            ok: true,
            activePageId: activePage.id,
            theme: draft.theme,
            pages: draft.pages.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              isHome: Boolean(p.isHome),
              isActive: p.id === activePage.id,
              sectionCount: (p.tree?.children || []).filter((c) => c?.type === 'section').length,
            })),
            outline: summarizeNodeOutline(activeTree, 0, depthLimit),
          });
        }
        return readOnlySuccess(draft, false, {
          ok: true,
          outline: summarizeNodeOutline(activeTree, 0, depthLimit),
        });
      }

      case 'add_page': {
        if (!projectMode) {
          return fail(draft, 'add_page yalnızca çoklu sayfa proje yapısında (schemaVersion: 2) kullanılabilir.');
        }
        const res = addPage(draft, {
          title: safeArgs.title,
          slug: safeArgs.slug,
        });
        if (!res.ok) return fail(draft, res.error || 'Sayfa eklenemedi.');
        return succeedProject(res.project, {
          ok: true,
          page: {
            id: res.page.id,
            title: res.page.title,
            slug: res.page.slug,
            isHome: res.page.isHome,
            rootSectionId: res.page.tree?.children?.[0]?.id || null,
          },
          activePageId: res.project.activePageId,
        });
      }

      case 'switch_page': {
        if (!projectMode) {
          return fail(draft, 'switch_page yalnızca çoklu sayfa proje yapısında kullanılabilir.');
        }
        const res = switchPage(draft, safeArgs.pageId);
        if (!res.ok) return fail(draft, res.error || 'Sayfa bulunamadı.');
        const nextActive = getActivePage(res.project);
        return succeedProject(res.project, {
          ok: true,
          activePageId: nextActive.id,
          title: nextActive.title,
          slug: nextActive.slug,
          outline: summarizeNodeOutline(nextActive.tree, 0, 3),
        });
      }

      case 'rename_page': {
        if (!projectMode) {
          return fail(draft, 'rename_page yalnızca çoklu sayfa proje yapısında kullanılabilir.');
        }
        const res = renamePage(draft, safeArgs.pageId, safeArgs.title, safeArgs.slug);
        if (!res.ok) return fail(draft, res.error || 'Sayfa yeniden adlandırılamadı.');
        return succeedProject(res.project, {
          ok: true,
          page: {
            id: res.page.id,
            title: res.page.title,
            slug: res.page.slug,
            isHome: res.page.isHome,
          },
        });
      }

      case 'remove_page': {
        if (!projectMode) {
          return fail(draft, 'remove_page yalnızca çoklu sayfa proje yapısında kullanılabilir.');
        }
        const res = removePage(draft, safeArgs.pageId);
        if (!res.ok) return fail(draft, res.error || 'Sayfa silinemedi.');
        return succeedProject(res.project, {
          ok: true,
          removedPageId: safeArgs.pageId,
          activePageId: res.project.activePageId,
          warnings: res.warnings || [],
        });
      }

      case 'list_content_packs': {
        const packs = listContentPacks();
        return readOnlySuccess(draft, projectMode, {
          ok: true,
          packs,
        });
      }

      case 'insert_content_pack': {
        const requestedPackId = safeArgs.packId || safeArgs.packKey || '';
        const { nodes, warnings } = packToNodes(requestedPackId, makeDraftSafeIdGen(draft, idGen));
        if (!Array.isArray(nodes) || nodes.length === 0) {
          return fail(draft, warnings[0] || `İçerik paketi dönüştürülemedi: "${requestedPackId}"`);
        }

        const curSections = Array.isArray(activeTree.children) ? activeTree.children : [];
        let insertIdx = curSections.length;
        const targetId = safeArgs.targetSectionId || safeArgs.target || '';
        if (targetId) {
          const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, targetId);
          if (!check.ok) return fail(draft, check.error);
          const secIdx = findRootSectionIndexOfNode(activeTree, targetId);
          insertIdx = secIdx >= 0 ? secIdx + 1 : curSections.length;
        } else if (safeArgs.index !== undefined && safeArgs.index !== null && Number.isInteger(Number(safeArgs.index))) {
          insertIdx = Math.max(0, Math.min(curSections.length, Number(safeArgs.index)));
        }

        const nextChildren = [
          ...curSections.slice(0, insertIdx),
          ...nodes,
          ...curSections.slice(insertIdx),
        ];
        const nextTree = { ...activeTree, children: nextChildren };
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          packId: requestedPackId,
          addedSectionIds: nodes.map((n) => n.id),
          addedSectionId: nodes[0].id,
          index: insertIdx,
          warnings,
        });
      }

      case 'link_to_page': {
        if (!projectMode) {
          return fail(draft, 'link_to_page yalnızca çoklu sayfa proje yapısında kullanılabilir.');
        }
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.buttonId);
        if (!check.ok) return fail(draft, check.error);
        if (check.node.type !== 'button') {
          return fail(draft, `Yalnızca button düğümleri link_to_page ile bağlanabilir ("${check.node.type}" desteklenmez).`);
        }
        const targetPage = draft.pages.find((p) => p.id === safeArgs.pageId);
        if (!targetPage) {
          return fail(draft, `Hedef sayfa bulunamadı: "${safeArgs.pageId}".`);
        }
        const href = `page:${targetPage.id}`;
        const nextTree = updateNode(activeTree, check.node.id, {
          props: { href },
        });
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          buttonId: check.node.id,
          pageId: targetPage.id,
          pageTitle: targetPage.title,
          href,
        });
      }

      case 'get_node': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        const node = check.node;
        return readOnlySuccess(draft, projectMode, {
          ok: true,
          node: {
            id: node.id,
            type: node.type,
            placement: node.placement || 'flow',
            ...(node.pos ? { pos: node.pos } : {}),
            ...(node.layout ? { layout: node.layout } : {}),
            ...(node.size ? { size: node.size } : {}),
            ...(node.props ? { props: node.props } : {}),
            ...(node.responsive ? { responsive: node.responsive } : {}),
            children: Array.isArray(node.children)
              ? node.children.map((c) => ({ id: c.id, type: c.type }))
              : [],
          },
        });
      }

      case 'get_selection': {
        const selId = context?.selectedId;
        if (!selId) {
          return readOnlySuccess(draft, projectMode, { ok: true, selection: null });
        }
        const activeNode = findNode(activeTree, selId);
        if (activeNode) {
          return readOnlySuccess(draft, projectMode, {
            ok: true,
            selection: {
              ...summarizeNodeOutline(activeNode, 0, 1),
              ...(projectMode
                ? { pageId: activePage.id, pageTitle: activePage.title, onActivePage: true }
                : {}),
            },
          });
        }
        if (projectMode) {
          const owner = findNodeInProject(draft, selId);
          if (owner) {
            return readOnlySuccess(draft, true, {
              ok: true,
              selection: {
                ...summarizeNodeOutline(owner.node, 0, 1),
                pageId: owner.page.id,
                pageTitle: owner.page.title,
                onActivePage: false,
              },
            });
          }
        }
        return readOnlySuccess(draft, projectMode, { ok: true, selection: null });
      }

      case 'list_section_presets': {
        return readOnlySuccess(draft, projectMode, {
          ok: true,
          presets: listPresets(),
        });
      }

      case 'add_section': {
        if (!PRESET_NAMES.includes(safeArgs.preset)) {
          return fail(
            draft,
            `Bilinmeyen preset "${safeArgs.preset}". Geçerli presetler: ${PRESET_NAMES.join(', ')}`
          );
        }
        const sectionNode = buildPreset(
          safeArgs.preset,
          safeArgs.props || {},
          makeDraftSafeIdGen(draft, idGen)
        );
        if (!sectionNode) {
          return fail(draft, 'Bölüm oluşturulamadı.');
        }
        const curSections = Array.isArray(activeTree.children) ? activeTree.children : [];
        const rawIdx = safeArgs.index;
        const idx =
          rawIdx !== undefined && rawIdx !== null && Number.isInteger(Number(rawIdx))
            ? Math.max(0, Math.min(Number(rawIdx), curSections.length))
            : curSections.length;
        const nextChildren = [
          ...curSections.slice(0, idx),
          sectionNode,
          ...curSections.slice(idx),
        ];
        const nextTree = { ...activeTree, children: nextChildren };
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          addedSectionId: sectionNode.id,
          preset: safeArgs.preset,
          index: idx,
        });
      }

      case 'replace_section': {
        if (!safeArgs.id) return fail(draft, 'id bulunamadı');
        const locRes = resolveLocOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!locRes.ok) return fail(draft, locRes.error);
        const loc = locRes.loc;
        if (loc.parent?.id !== activeTree.id || loc.node.type !== 'section') {
          return fail(draft, 'Yalnızca sayfa kökündeki section düğümleri replace_section ile değiştirilebilir.');
        }
        if (!PRESET_NAMES.includes(safeArgs.preset)) {
          return fail(
            draft,
            `Bilinmeyen preset "${safeArgs.preset}". Geçerli presetler: ${PRESET_NAMES.join(', ')}`
          );
        }
        const replacement = buildPreset(
          safeArgs.preset,
          safeArgs.props || {},
          makeDraftSafeIdGen(draft, idGen)
        );
        if (!replacement) return fail(draft, 'Bölüm oluşturulamadı.');
        const curChildren = Array.isArray(activeTree.children) ? activeTree.children : [];
        const nextChildren = [
          ...curChildren.slice(0, loc.index),
          replacement,
          ...curChildren.slice(loc.index + 1),
        ];
        const nextTree = { ...activeTree, children: nextChildren };
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          replacedId: safeArgs.id,
          newSectionId: replacement.id,
          preset: safeArgs.preset,
        });
      }

      case 'remove_node': {
        if (!safeArgs.id) return fail(draft, 'id bulunamadı');
        if (safeArgs.id === activeTree.id) {
          return fail(draft, 'Kök sayfa düğümü silinemez.');
        }
        const locRes = resolveLocOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!locRes.ok) return fail(draft, locRes.error);
        const loc = locRes.loc;

        if (loc.parent?.id === activeTree.id && loc.node.type === 'section') {
          const rootSections = (activeTree.children || []).filter((c) => c?.type === 'section');
          if (rootSections.length <= 1) {
            return fail(draft, 'Sayfada en az 1 section kalmalıdır; son bölüm silinemez.');
          }
        }

        const nextTree = removeNode(activeTree, safeArgs.id);
        if (nextTree === activeTree) return fail(draft, 'Düğüm silinemedi.');
        return commitActiveTree(draft, projectMode, nextTree, { ok: true, removedId: safeArgs.id });
      }

      case 'move_node': {
        const { id, targetParentId, index } = safeArgs;
        const nodeCheck = resolveNodeOnActive(draft, projectMode, activePage, activeTree, id);
        if (!nodeCheck.ok) return fail(draft, nodeCheck.error);
        const parentCheck = resolveNodeOnActive(
          draft,
          projectMode,
          activePage,
          activeTree,
          targetParentId,
          'Hedef ebeveyn id bulunamadı'
        );
        if (!parentCheck.ok) return fail(draft, parentCheck.error);
        const node = nodeCheck.node;
        const targetParent = parentCheck.node;

        if (id === targetParentId || isDescendant(activeTree, id, targetParentId)) {
          return fail(draft, 'Bir düğüm kendi içine veya alt soyuna taşınamaz.');
        }
        if (!canAcceptChild(targetParent.type, node.type)) {
          return fail(
            draft,
            `Kabul kuralı ihlali: "${targetParent.type}" düğümü "${node.type}" çocuğunu alamaz.`
          );
        }
        const nextTree = moveNode(activeTree, id, targetParentId, Number(index) || 0);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          movedId: id,
          targetParentId,
          index: Number(index) || 0,
        });
      }

      case 'set_layout': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        if (!canNodeAcceptChildren(check.node)) {
          return fail(draft, `"${check.node.type}" türü düzen (layout) desteklemez.`);
        }
        const validation = validateNodePatch({ layout: safeArgs.layout });
        if (!validation.ok) return fail(draft, validation.error);
        const nextTree = updateNode(activeTree, safeArgs.id, validation.value);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          id: safeArgs.id,
          layout: validation.value.layout,
        });
      }

      case 'set_size': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        const validation = validateNodePatch({ size: safeArgs.size });
        if (!validation.ok) return fail(draft, validation.error);
        const nextTree = updateNode(activeTree, safeArgs.id, validation.value);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          id: safeArgs.id,
          size: validation.value.size,
        });
      }

      case 'set_responsive': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        const bp = safeArgs.breakpoint;
        if (!RESPONSIVE_BREAKPOINTS.includes(bp)) {
          return fail(
            draft,
            `Geçersiz breakpoint ("${bp}"). Geçerli değerler: ${RESPONSIVE_BREAKPOINTS.join(',')}`
          );
        }
        const validation = validateNodePatch({ responsive: { [bp]: safeArgs.patch } });
        if (!validation.ok) return fail(draft, validation.error);
        const nextTree = updateNode(activeTree, safeArgs.id, validation.value);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          id: safeArgs.id,
          breakpoint: bp,
          patch: validation.value.responsive[bp],
        });
      }

      case 'set_text': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        const node = check.node;
        if (node.type !== 'text' && node.type !== 'button') {
          return fail(draft, 'Yalnızca text veya button düğümlerinin metni değiştirilebilir.');
        }
        if (typeof safeArgs.text !== 'string') {
          return fail(draft, 'text alanı string olmalıdır.');
        }
        const propKey = node.type === 'button' ? 'label' : 'text';
        const validation = validateNodePatch({ props: { [propKey]: safeArgs.text } });
        if (!validation.ok) return fail(draft, validation.error);
        const nextTree = updateNode(activeTree, safeArgs.id, validation.value);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          id: safeArgs.id,
          [propKey]: validation.value.props[propKey],
        });
      }

      case 'set_image': {
        const check = resolveNodeOnActive(draft, projectMode, activePage, activeTree, safeArgs.id);
        if (!check.ok) return fail(draft, check.error);
        const node = check.node;
        if (node.type !== 'image') {
          return fail(draft, 'Yalnızca image düğümünün görseli güncellenebilir.');
        }
        if (typeof safeArgs.alt !== 'string' || !safeArgs.alt.trim()) {
          return fail(draft, 'Görsel alt metni (alt) boş bırakılamaz.');
        }
        const validation = validateNodePatch({
          props: { src: safeArgs.src, alt: safeArgs.alt },
        });
        if (!validation.ok) return fail(draft, validation.error);
        const nextTree = updateNode(activeTree, safeArgs.id, validation.value);
        return commitActiveTree(draft, projectMode, nextTree, {
          ok: true,
          id: safeArgs.id,
          alt: validation.value.props.alt,
        });
      }

      case 'apply_theme': {
        const validation = validateThemeTokens(safeArgs.tokens);
        if (!validation.ok) return fail(draft, validation.error);
        const tokens = validation.value;
        if (Object.keys(tokens).length === 0) {
          return fail(draft, `En az bir tema tokenı verin (${COLOR_TOKENS.join(',')}, fontFamily).`);
        }
        if (projectMode) {
          const nextProject = updateProjectTheme(draft, tokens);
          return succeedProject(nextProject, { ok: true, appliedTokens: tokens, projectScope: true });
        }
        const pagePatch = {
          props: {
            theme: tokens,
            ...(tokens.surface ? { bg: 'surface' } : {}),
            ...(tokens.text ? { color: 'text' } : {}),
            ...(tokens.fontFamily ? { fontFamily: tokens.fontFamily } : {}),
          },
        };
        const nextTree = updateNode(activeTree, activeTree.id, pagePatch);
        return {
          tree: nextTree,
          result: { ok: true, appliedTokens: tokens },
        };
      }

      case 'validate_project': {
        if (projectMode) {
          const validation = validateProject(draft);
          return succeedProject(draft, {
            ok: validation.ok && validation.issues.length === 0,
            errorCount: validation.errors.length,
            issueCount: validation.issues.length,
            errors: validation.errors,
            issues: validation.issues,
          });
        }
        const issues = inspectTreeIssues(activeTree);
        return readOnlySuccess(draft, false, {
          ok: issues.length === 0,
          issueCount: issues.length,
          issues,
        });
      }

      default:
        return fail(draft, `Bilinmeyen araç: "${name}"`);
    }
  } catch (err) {
    return fail(draft, err?.message || 'Araç çalıştırılırken beklenmeyen bir hata oluştu.');
  }
}

export default executeTool;
