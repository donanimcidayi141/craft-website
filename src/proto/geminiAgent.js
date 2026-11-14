import { TOOL_DECLARATIONS, executeTool } from './aiTools.js';
import { getActivePage, getActiveTree, isProject } from './project.js';

/**
 * Gemini Function Calling ajanı (izole taslak döngüsü).
 * - Hiçbir zaman piksel/ham CSS üretmez; yalnızca `aiTools` üzerindeki token/preset araçlarını çağırır.
 * - Modelden dönen `content` nesnesini (`thoughtSignature` dahil) geçmişe AYNEN ekler.
 * - `thought: true` parçalarını `finalText`'e karıştırmaz.
 * - Aynı turdaki birden fazla `functionCall` yanıtını TEK `user` turunda geri gönderir.
 * - API anahtarını `x-goog-api-key` başlığıyla gönderir; URL, log, hata veya step çıktısına sızdırmaz.
 */

export const MAX_AGENT_TURNS = 12;

export const SYSTEM_INSTRUCTION = [
  'Sen CraftStudio çoklu sayfa ve akış tabanlı web editörünün tasarım asistanısın.',
  'ASLA piksel koordinatı (x, y) veya ham CSS stringi üretme. Yalnızca tanımlı araçları, presetleri, içerik paketlerini, enum ve tasarım tokenlarını kullan.',
  'Emin değilsen veya mevcut sayfaları/yapıyı bilmiyorsan önce get_project_outline (gerekirse get_selection, list_section_presets veya list_content_packs) çağır.',
  'Yeni sayfa oluşturduğunda (add_page) içerik eklemeden veya düzenlemeden önce o sayfaya switch_page ile geç. Düğüm araçları yalnızca aktif sayfada çalışır.',
  'Sayfalar arası buton bağlantıları için link_to_page(buttonId, pageId) kullan; bu bağlantı yayında ilgili HTML/route sayfasına dönüşür.',
  'apply_theme ile yaptığın renk/yazı tipi değişiklikleri PROJE genelidir ve tüm sayfalara ortak uygulanır.',
  'Bölüm eklerken preset (add_section / replace_section) veya hazır paket (insert_content_pack) kullan; kart/plan listeleri en fazla 6 öğe içermelidir.',
  'Görseller için yalnız güvenli https: veya data:image/ kaynakları ve boş olmayan alt metin ver; sabit px yükseklik kullanma.',
  'İşin bitmeden önce validate_project ile tüm sayfaları ve iç bağlantıları doğrula, ardından araç çağırmadan yaptıklarını özetleyen kısa bir Türkçe yanıt yaz.',
].join('\n');

const BLOCKED_FINISH_REASONS = new Set([
  'MAX_TOKENS',
  'SAFETY',
  'RECITATION',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
]);

function scrubSecret(text, secret) {
  const str = String(text || '');
  if (!secret) return str;
  return str.split(secret).join('***');
}

function summarizeValue(val, secret) {
  try {
    const raw = JSON.stringify(val);
    const cleaned = scrubSecret(raw, secret);
    return cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
  } catch {
    return '';
  }
}

function summarizeResult(result, secret) {
  if (!result || typeof result !== 'object') return '';
  if (!result.ok) {
    return scrubSecret(result.error || 'İşlem başarısız oldu', secret);
  }
  if (result.packId) return `Paket eklendi: ${result.packId}`;
  if (result.page?.slug) return `Sayfa: ${result.page.title} (${result.page.slug})`;
  if (result.removedPageId) return `Sayfa silindi: #${result.removedPageId}`;
  if (result.activePageId && result.title) return `Aktif sayfa: ${result.title}`;
  if (result.buttonId && result.href) return `Bağlantı: #${result.buttonId} -> ${result.pageTitle || result.href}`;
  if (result.addedSectionId) return `Eklendi: #${result.addedSectionId} (${result.preset})`;
  if (result.newSectionId) return `Değiştirildi: #${result.newSectionId} (${result.preset})`;
  if (result.removedId) return `Silindi: #${result.removedId}`;
  if (result.movedId) return `Taşındı: #${result.movedId}`;
  if (result.appliedTokens) return 'Tema tokenları güncellendi';
  if (Array.isArray(result.issues)) {
    const errCount = Number(result.errorCount || 0);
    return `Doğrulama: ${errCount > 0 ? `${errCount} hata, ` : ''}${result.issues.length} sorun`;
  }
  if (Array.isArray(result.packs)) return `${result.packs.length} içerik paketi listelendi`;
  if (Array.isArray(result.presets)) return `${result.presets.length} preset listelendi`;
  if (result.outline) return 'Proje özeti okundu';
  if (result.selection !== undefined) return result.selection ? `Seçim: #${result.selection.id}` : 'Seçim yok';
  if (result.node) return `Düğüm: #${result.node.id}`;
  return 'Tamamlandı';
}

function sleepWithAbort(ms, signal) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('İptal edildi', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('İptal edildi', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function buildInitialPrompt(prompt, selectedId, activePage) {
  const cleanPrompt = String(prompt || '').trim();
  const hints = [];
  if (activePage) {
    hints.push(`Aktif sayfa: "${activePage.title}" (id: ${activePage.id}, slug: ${activePage.slug})`);
  }
  if (selectedId) {
    hints.push(`Seçili düğüm: "${selectedId}"`);
  }
  if (hints.length > 0) {
    return `${cleanPrompt}\n\n[Bağlam notu: ${hints.join(' · ')}. Gerekirse get_project_outline, get_selection veya get_node çağırabilirsin.]`;
  }
  return cleanPrompt;
}

function mapHttpError(status, bodyMessage, apiKey) {
  const safeMsg = scrubSecret(bodyMessage, apiKey);
  if (status === 401 || status === 403) {
    return 'Gemini API anahtarı geçersiz veya yetkisiz.';
  }
  if (status === 429) {
    return 'Gemini API istek sınırı (429) aşıldı. Kısa süre sonra tekrar deneyin.';
  }
  if (status === 503 || status >= 500) {
    return `Gemini sunucusu geçici olarak yanıt veremiyor (HTTP ${status}).`;
  }
  return safeMsg ? `Gemini isteği başarısız oldu (${status}): ${safeMsg}` : `Gemini isteği başarısız oldu (HTTP ${status}).`;
}

function mapFinishReasonError(reason) {
  if (reason === 'MAX_TOKENS') {
    return 'Model yanıtı belirteç (MAX_TOKENS) sınırına takıldığı için tamamlanamadı.';
  }
  return `Model yanıtı güvenlik/politika gerekçesiyle durduruldu (${reason}).`;
}

async function callGeminiWithRetry({
  endpoint,
  apiKey,
  requestBody,
  signal,
  fetchImpl,
  retryDelayMs,
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('İptal edildi', 'AbortError');
    }

    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (res.ok) {
      return res.json();
    }

    const errJson = await res.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || '';

    if ((res.status === 429 || res.status === 503) && attempt === 0) {
      await sleepWithAbort(retryDelayMs, signal);
      continue;
    }

    throw new Error(mapHttpError(res.status, rawMsg, apiKey));
  }

  throw new Error('Gemini API isteği tamamlanamadı.');
}

/**
 * Gemini function calling ajan döngüsünü izole taslak (`baseProject` veya `baseTree`) üzerinde çalıştırır.
 * Asla global store'a dokunmaz; bittiğinde `draftProject` / `draftTree` veya hata döner.
 */
export async function runAgent({
  prompt,
  baseProject,
  baseTree,
  selectedId = null,
  apiKey = '',
  model = 'gemini-3-flash-preview',
  signal,
  onStep,
  fetchImpl = fetch,
  idGen,
  retryDelayMs = 600,
} = {}) {
  const cleanKey = String(apiKey || '').trim();
  const cleanPrompt = String(prompt || '').trim();
  const initialDraft = baseProject || baseTree;
  const startedWithProject = isProject(initialDraft);
  const steps = [];

  if (!cleanKey) {
    return {
      ok: false,
      draftProject: null,
      draftTree: null,
      finalText: '',
      steps,
      error: 'Gemini API anahtarı bulunamadı.',
    };
  }
  if (!cleanPrompt) {
    return {
      ok: false,
      draftProject: null,
      draftTree: null,
      finalText: '',
      steps,
      error: 'Lütfen bir komut yazın.',
    };
  }
  if (!initialDraft || typeof initialDraft !== 'object') {
    return {
      ok: false,
      draftProject: null,
      draftTree: null,
      finalText: '',
      steps,
      error: 'Geçerli başlangıç proje yapısı bulunamadı.',
    };
  }

  let currentDraft = initialDraft;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model || 'gemini-3-flash-preview'
  )}:generateContent`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: buildInitialPrompt(
            cleanPrompt,
            selectedId,
            startedWithProject ? getActivePage(initialDraft) : null
          ),
        },
      ],
    },
  ];

  try {
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
      if (signal?.aborted) {
        return {
          ok: false,
          aborted: true,
          draftProject: null,
          draftTree: null,
          finalText: '',
          steps,
          error: 'İşlem iptal edildi.',
        };
      }

      const requestBody = {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        toolConfig: {
          functionCallingConfig: { mode: 'AUTO' },
        },
        generationConfig: {
          maxOutputTokens: 8192,
        },
      };

      const data = await callGeminiWithRetry({
        endpoint,
        apiKey: cleanKey,
        requestBody,
        signal,
        fetchImpl,
        retryDelayMs,
      });

      const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
      if (!candidate || !candidate.content) {
        return {
          ok: false,
          draftProject: null,
          draftTree: null,
          finalText: '',
          steps,
          error: 'Gemini boş veya geçersiz bir yanıt döndürdü.',
        };
      }

      if (candidate.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
        return {
          ok: false,
          draftProject: null,
          draftTree: null,
          finalText: '',
          steps,
          error: mapFinishReasonError(candidate.finishReason),
        };
      }

      // THOUGHT SIGNATURE KURALI: modelden dönen content nesnesini olduğu gibi geçmişe ekle
      contents.push(candidate.content);

      const parts = Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
      const functionCalls = [];
      const visibleTexts = [];

      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        } else if (part.thought !== true && typeof part.text === 'string' && part.text.trim()) {
          visibleTexts.push(part.text);
        }
      }

      if (functionCalls.length === 0) {
        return {
          ok: true,
          draftProject: startedWithProject ? currentDraft : null,
          draftTree: startedWithProject ? getActiveTree(currentDraft) : currentDraft,
          finalText: scrubSecret(visibleTexts.join('\n').trim(), cleanKey),
          steps,
        };
      }

      const responseParts = [];
      for (const fc of functionCalls) {
        const toolOut = executeTool(
          currentDraft,
          fc.name,
          fc.args || {},
          idGen,
          { selectedId }
        );
        currentDraft = startedWithProject ? toolOut.project || currentDraft : toolOut.tree;
        const result = toolOut.result;

        const stepInfo = {
          index: steps.length + 1,
          tool: fc.name,
          argsSummary: summarizeValue(fc.args || {}, cleanKey),
          ok: Boolean(result?.ok),
          summary: summarizeResult(result, cleanKey),
        };
        steps.push(stepInfo);
        onStep?.(stepInfo);

        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: result,
          },
        });
      }

      // Aynı turdaki tüm araç yanıtları TEK kullanıcı turunda geri gönderilir
      contents.push({
        role: 'user',
        parts: responseParts,
      });
    }

    return {
      ok: false,
      draftProject: startedWithProject ? currentDraft : null,
      draftTree: startedWithProject ? getActiveTree(currentDraft) : currentDraft,
      finalText: '',
      steps,
      error: `adım sınırı: Model ${MAX_AGENT_TURNS} tur içinde tamamlamadı.`,
    };
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      return {
        ok: false,
        aborted: true,
        draftProject: null,
        draftTree: null,
        finalText: '',
        steps,
        error: 'İşlem iptal edildi.',
      };
    }
    return {
      ok: false,
      draftProject: null,
      draftTree: null,
      finalText: '',
      steps,
      error: scrubSecret(err?.message || 'Ajan çalıştırılırken bir ağ hatası oluştu.', cleanKey),
    };
  }
}

export default runAgent;
