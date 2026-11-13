import React from 'react';
import { KeyRound, ExternalLink, RefreshCw, X } from 'lucide-react';

/** Reusable inline Gemini API key & model settings panel. */
export default function AiSettingsPanel({
  aiChat,
  onClose,
  compact = false,
}) {
  if (!aiChat) return null;
  const {
    apiKey,
    keyDraft,
    setKeyDraft,
    handleSaveApiKey,
    model,
    setModel,
    availableModels,
    isFetchingModels,
    fetchModelsFromApi,
  } = aiChat;

  const saveAndClose = () => {
    const saved = handleSaveApiKey(keyDraft);
    if (saved) onClose?.();
  };

  return (
    <div
      className={
        compact
          ? 'bg-[#121216] border-b border-[#27272d] p-2.5 space-y-2 text-[11px] shrink-0'
          : 'bg-[#1b1b22]/95 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-3.5 shadow-[0_20px_54px_rgba(0,0,0,0.75)] space-y-2.5 text-xs'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-100 flex items-center gap-1.5 truncate">
          <KeyRound size={12} className="text-[#38bdf8] shrink-0" />
          <span className="truncate">Gemini API Bağlantısı</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[10.5px] text-[#38bdf8] hover:underline flex items-center gap-1"
          >
            <span>API Al</span>
            <ExternalLink size={10} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08]"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveAndClose();
          }}
          placeholder="AIza... Gemini API anahtarı"
          className={`flex-1 min-w-0 bg-[#101013] border border-[#2c2c34] text-zinc-100 font-mono focus:outline-none focus:border-[#38bdf8]/70 ${
            compact ? 'rounded px-2 py-1 text-[11px]' : 'rounded-2xl px-3 py-2 text-xs'
          }`}
        />
        <button
          type="button"
          onClick={saveAndClose}
          className={`bg-[#e4e4e7] hover:bg-white text-zinc-950 font-semibold transition-colors shrink-0 ${
            compact ? 'px-2.5 py-1 rounded text-[11px]' : 'px-4 py-2 rounded-2xl text-xs'
          }`}
        >
          Kaydet
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={`flex-1 min-w-0 bg-[#101013] border border-[#2c2c34] text-zinc-200 focus:outline-none focus:border-[#38bdf8]/60 truncate ${
            compact ? 'rounded px-2 py-1 text-[11px]' : 'rounded-xl px-2.5 py-1.5 text-[11px]'
          }`}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => fetchModelsFromApi(apiKey)}
          disabled={isFetchingModels || !apiKey}
          title="Modelleri Yenile"
          className={`bg-[#101013] border border-[#2c2c34] text-zinc-400 hover:text-white disabled:opacity-40 shrink-0 ${
            compact ? 'p-1 rounded' : 'p-1.5 rounded-xl'
          }`}
        >
          <RefreshCw size={12} className={isFetchingModels ? 'animate-spin text-[#38bdf8]' : ''} />
        </button>
      </div>
    </div>
  );
}
