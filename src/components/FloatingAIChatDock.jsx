import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowUp,
  RefreshCw,
  AlertCircle,
  X,
  MessageSquare,
} from 'lucide-react';
import AiSettingsPanel from './AiSettingsPanel.jsx';

/** Sleek bottom-center Gemini prompt composer wired to the shared AI conversation session. */
export default function FloatingAIChatDock({
  aiChat,
  isMinimized = false,
  onSetMinimized,
  isLeftAiOpen = false,
  onToggleLeftAiPanel,
  focusSignal = 0,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const inputRef = useRef(null);

  const {
    apiKey,
    currentModelLabel,
    scopeInfo,
    setIgnoreSelectionOnce,
    conversations = [],
    savedUserTurnsCount = 0,
    isLoading,
    error,
    handleSendPrompt,
  } = aiChat || {};

  useEffect(() => {
    if (focusSignal > 0 && !isMinimized) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [focusSignal, isMinimized]);

  const handleSubmit = async () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed || isLoading || !handleSendPrompt) return;
    setInputPrompt('');
    const result = await handleSendPrompt(trimmed);
    if (result?.reason === 'missing_api_key') {
      setInputPrompt(trimmed);
      setShowSettings(true);
    }
  };

  if (isMinimized) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-4">
        <button
          type="button"
          onClick={() => {
            onSetMinimized?.(false);
            setTimeout(() => inputRef.current?.focus(), 40);
          }}
          title="Gemini Sohbet Kutusunu Aç (Ctrl+K)"
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-[#1b1b21]/95 backdrop-blur-2xl border border-white/[0.12] hover:border-[#38bdf8]/60 text-zinc-100 shadow-[0_14px_38px_rgba(0,0,0,0.65)] text-xs font-medium transition-all"
        >
          <Sparkles size={14} className="text-[#38bdf8]" />
          <span>Gemini ile Tasarla</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-ai-dock="true"
      className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex flex-col items-center px-4"
    >
      <div className="w-full max-w-[620px] pointer-events-auto flex flex-col gap-2 transition-all duration-200">
        {showSettings && (
          <AiSettingsPanel aiChat={aiChat} onClose={() => setShowSettings(false)} />
        )}

        {/* Lightweight inline status / error strip when left panel is not currently shown */}
        {!isLeftAiOpen && isLoading && (
          <div className="self-center inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b1b22]/95 backdrop-blur-xl border border-white/[0.1] text-[#7dd3fc] text-xs shadow-lg">
            <RefreshCw size={12} className="animate-spin" />
            <span>Tamam knk, tasarlıyorum...</span>
          </div>
        )}

        {!isLeftAiOpen && error && !isLoading && (
          <div className="self-center inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1f161b]/95 backdrop-blur-xl border border-rose-500/30 text-rose-300 text-xs shadow-lg">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Classic Gemini Floating Composer Pill */}
        <div className="bg-[#1b1b22]/95 backdrop-blur-2xl border border-white/[0.1] focus-within:border-[#38bdf8]/55 rounded-[28px] shadow-[0_20px_56px_rgba(0,0,0,0.72)] px-4 pt-3 pb-2.5 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === 'Escape' && showSettings) {
                e.preventDefault();
                setShowSettings(false);
              }
            }}
            placeholder={
              scopeInfo?.effectiveMode === 'selection'
                ? `"${scopeInfo.targetSummary}" için ne yapalım knk?`
                : 'Gemini’ye yaz knk...'
            }
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 text-[13.5px] leading-6 focus:outline-none resize-none max-h-28 px-0.5"
          />

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {scopeInfo?.effectiveMode === 'selection' && (
                <span className="inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 text-[11px] max-w-[220px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{scopeInfo.targetSummary}</span>
                  <button
                    type="button"
                    onClick={() => setIgnoreSelectionOnce?.(true)}
                    title="Seçimi hedeflemek yerine tüm sayfaya uygula"
                    className="p-0.5 rounded-full hover:bg-emerald-500/20 text-emerald-200/80 hover:text-white shrink-0"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowSettings((prev) => !prev)}
                title="Gemini Modeli & API Anahtarı"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors whitespace-nowrap"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{apiKey ? currentModelLabel : 'API Anahtarı Bağla'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggleLeftAiPanel?.()}
                title={isLeftAiOpen ? 'Sol AI Geçmiş Panelini Gizle' : 'Sol Panelde Konuşmalar & Geçmiş'}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isLeftAiOpen
                    ? 'bg-white/[0.12] text-[#7dd3fc]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <MessageSquare size={14} />
                {!isLeftAiOpen && (savedUserTurnsCount > 0 || conversations.length > 1) && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSetMinimized?.(true)}
                title="Küçült"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={14} />
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!inputPrompt.trim() || isLoading}
                title="Gönder (Enter)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  inputPrompt.trim() && !isLoading
                    ? 'bg-[#e4e4e7] hover:bg-white text-zinc-950 shadow-md'
                    : 'bg-white/[0.08] text-zinc-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.2} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
