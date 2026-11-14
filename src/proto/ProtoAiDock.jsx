import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Square, CheckCircle2, AlertCircle, KeyRound, ChevronUp } from 'lucide-react';
import { useProtoStore } from './ProtoApp';
import { runAgent } from './geminiAgent.js';

/**
 * İzole prototip için yüzen Gemini Function Calling dock bileşeni.
 * - Mevcut `FloatingAIChatDock.jsx`'ten tamamen bağımsızdır.
 * - Anahtarı `craft_gemini_api_key` localStorage veya `VITE_GEMINI_API_KEY` ortamından okur;
 *   asla koda gömmez, loglamaz, hata/step metinlerine sızdırmaz.
 * - İframe ve SelectionOverlay üzerinde (`z-50`) yüzerek açılıp kapatılabilir.
 */

export const PROTO_AI_MODELS = [
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash (Latest)' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro (Latest)' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
];

export function readGeminiApiKey() {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage?.getItem('craft_gemini_api_key');
      if (saved && saved.trim().length > 10) return saved.trim();
    } catch {
      // storage erişimi engelliyse ortam değişkenini dene
    }
  }
  // Ortam değişkeni yalnızca geliştirme (DEV) modunda okunur; üretim bundle'ına gömülmez.
  const envKey =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.DEV &&
    import.meta.env?.VITE_GEMINI_API_KEY
      ? String(import.meta.env.VITE_GEMINI_API_KEY).trim()
      : '';
  return envKey || '';
}

export function ProtoAiDock({ onCommitBeforeAi = null }) {
  const { state, actions } = useProtoStore();
  const [isOpen, setIsOpen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(PROTO_AI_MODELS[0].id);
  const [apiKeyPresent, setApiKeyPresent] = useState(() => Boolean(readGeminiApiKey()));
  const [steps, setSteps] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [undoHintVisible, setUndoHintVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const abortRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const syncKeyStatus = () => {
      setApiKeyPresent(Boolean(readGeminiApiKey()));
    };
    syncKeyStatus();
    window.addEventListener('focus', syncKeyStatus);
    window.addEventListener('storage', syncKeyStatus);
    return () => {
      window.removeEventListener('focus', syncKeyStatus);
      window.removeEventListener('storage', syncKeyStatus);
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, []);

  const handleCancel = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      abortRef.current?.abort();
    } catch {}
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (runningRef.current || state.aiBusy) return;

    const activeKey = readGeminiApiKey();
    setApiKeyPresent(Boolean(activeKey));
    if (!activeKey) {
      setErrorMessage('Anahtar bulunamadı: Gemini API anahtarı yapılandırılmamış.');
      return;
    }

    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      setErrorMessage('Lütfen Gemini için bir düzenleme veya oluşturma komutu yazın.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setUndoHintVisible(false);
    setSteps([]);

    // Açık bir satır içi metin düzenlemesi varsa ajan başlamadan önce commit et
    if (typeof onCommitBeforeAi === 'function') {
      await onCommitBeforeAi();
    }

    const snapshot = actions.getLatestSnapshot();
    const baseProject = snapshot.project;
    const baseVersion = snapshot.projectVersion;
    const baseSelectedId = snapshot.selectedId;

    const controller = new AbortController();
    abortRef.current = controller;
    runningRef.current = true;
    actions.clearAiConflict();
    actions.setAiBusy(true);

    try {
      const res = await runAgent({
        prompt: cleanPrompt,
        baseProject,
        selectedId: baseSelectedId,
        apiKey: activeKey,
        model,
        signal: controller.signal,
        onStep: (step) => {
          setSteps((prev) => [...prev, step]);
        },
      });

      if (res.ok && (res.draftProject || res.draftTree)) {
        const applyRes = actions.applyAiDraft({
          project: res.draftProject,
          tree: res.draftTree,
          baseVersion,
        });

        if (applyRes.conflict) {
          setErrorMessage(
            'Sürüm çakışması: Ajan çalışırken proje değiştiği için taslak uygulanmadı.'
          );
          setStatusMessage('');
          setUndoHintVisible(false);
        } else {
          const pagesNote =
            Array.isArray(applyRes.changedPages) && applyRes.changedPages.length > 0
              ? ` (Değişen sayfalar: ${applyRes.changedPages.join(', ')})`
              : '';
          setStatusMessage(`${res.finalText || 'Değişiklikler tek adımda uygulandı.'}${pagesNote}`);
          setUndoHintVisible(true);
        }
      } else {
        setErrorMessage(res.error || 'Ajan tamamlanamadı; ağaç değiştirilmedi.');
      }
    } catch (err) {
      setErrorMessage(err?.message || 'Beklenmeyen hata; ağaç değiştirilmedi.');
    } finally {
      abortRef.current = null;
      runningRef.current = false;
      actions.setAiBusy(false);
    }
  };

  const handleTextareaKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        data-proto-ai-toggle="true"
        onClick={() => {
          setApiKeyPresent(Boolean(readGeminiApiKey()));
          setIsOpen(true);
        }}
        className="fixed bottom-10 right-5 z-50 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xl border border-white/15 cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Gemini AI</span>
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <aside
      data-proto-ai-dock="true"
      className="fixed bottom-10 right-5 z-50 w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-7rem)] flex flex-col rounded-xl bg-[#18181d]/95 backdrop-blur-md border border-white/15 shadow-2xl text-neutral-100 overflow-hidden"
    >
      {/* Üst Başlık */}
      <div className="px-3.5 py-2.5 bg-[#111115] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-xs font-semibold truncate">Gemini Tasarım Ajanı</span>
          {state.aiBusy && (
            <span
              data-proto-ai-busy="true"
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
            >
              Çalışıyor...
            </span>
          )}
        </div>
        <button
          type="button"
          data-proto-ai-close="true"
          onClick={() => setIsOpen(false)}
          title="Paneli Küçült"
          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Model Seçici & Seçili Düğüm Etiketi */}
      <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between gap-2 bg-[#141418]">
        <select
          data-proto-ai-model="true"
          value={model}
          disabled={state.aiBusy}
          onChange={(e) => setModel(e.target.value)}
          aria-label="Gemini modeli seç"
          className="flex-1 min-w-0 rounded-md bg-[#101013] border border-white/15 px-2 py-1 text-[11px] text-neutral-200 focus:outline-none focus:border-sky-500"
        >
          {PROTO_AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {state.selectedId && (
          <span
            data-proto-ai-selection="true"
            className="shrink-0 max-w-[130px] truncate px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-[10px] font-mono text-sky-300"
            title={`Seçili düğüm: ${state.selectedId}`}
          >
            Seçili: {state.selectedId}
          </span>
        )}
      </div>

      {/* Anahtar Eksik Uyarısı */}
      {!apiKeyPresent && (
        <div
          data-proto-ai-no-key="true"
          className="mx-3.5 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Anahtar bulunamadı. Ana editörden Gemini API anahtarını bağlayın veya{' '}
            <code className="font-mono text-[10px]">VITE_GEMINI_API_KEY</code> tanımlayın.
          </span>
        </div>
      )}

      {/* Adım Günlüğü & Özet Alanı */}
      {(steps.length > 0 || statusMessage || errorMessage || state.aiConflict) && (
        <div className="px-3.5 pt-2.5 pb-1 space-y-2 overflow-y-auto max-h-56 text-[11px]">
          {steps.length > 0 && (
            <div data-proto-ai-steps="true" className="space-y-1">
              {steps.map((s) => (
                <div
                  key={`${s.index}-${s.tool}`}
                  className="flex items-start gap-1.5 rounded-md bg-white/5 px-2 py-1 border border-white/5"
                >
                  {s.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] text-sky-300 truncate">
                      {s.index}. {s.tool}
                    </div>
                    {s.summary && (
                      <div className="text-[10px] text-neutral-300 break-words">{s.summary}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {statusMessage && (
            <div
              data-proto-ai-summary="true"
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-emerald-100 space-y-1"
            >
              <div>{statusMessage}</div>
              {undoHintVisible && (
                <div className="text-[10px] text-emerald-300/90 font-medium">
                  Geri almak için Ctrl+Z
                </div>
              )}
            </div>
          )}

          {(errorMessage || state.aiConflict) && (
            <div
              data-proto-ai-error="true"
              className="rounded-lg bg-rose-500/15 border border-rose-500/35 p-2 text-rose-200"
            >
              {errorMessage || 'Sürüm çakışması nedeniyle taslak uygulanmadı.'}
            </div>
          )}
        </div>
      )}

      {/* Komut Giriş Formu */}
      <form onSubmit={handleSubmit} className="p-3.5 space-y-2">
        <textarea
          data-proto-ai-input="true"
          rows={3}
          value={prompt}
          disabled={state.aiBusy}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Örn: Hero + özellikler + fiyatlandırma + footer olan bir sayfa kur..."
          className="w-full resize-none rounded-lg bg-[#101013] border border-white/15 px-2.5 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-500">
            Ctrl+Enter ile gönder · Taslak tek adımda uygulanır
          </span>
          {state.aiBusy ? (
            <button
              key="ai-cancel-btn"
              type="button"
              data-proto-ai-cancel="true"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
            >
              <Square className="w-3 h-3" />
              <span>İptal</span>
            </button>
          ) : (
            <button
              key="ai-send-btn"
              type="button"
              data-proto-ai-send="true"
              disabled={!apiKeyPresent || !prompt.trim()}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-medium cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Gönder</span>
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}

export default ProtoAiDock;
