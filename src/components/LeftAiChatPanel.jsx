import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  KeyRound,
  Trash2,
  ChevronsLeft,
  ChevronDown,
  ChevronRight,
  X,
  ArrowUp,
  RefreshCw,
  Undo2,
  RotateCcw,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import AiSettingsPanel from './AiSettingsPanel.jsx';

/** Left sidebar panel for Gemini AI chat, saved conversation history, and itemized edit logs. */
export default function LeftAiChatPanel({ aiChat, onClosePanel }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(true);
  const [localPrompt, setLocalPrompt] = useState('');
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);

  const {
    apiKey,
    currentModelLabel,
    scopeInfo,
    setIgnoreSelectionOnce,
    conversations = [],
    activeConversation,
    messages = [],
    isLoading,
    error,
    handleCreateNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleClearHistory,
    handleSendPrompt,
    handleUndoMessageChange,
    handleRetryVariation,
  } = aiChat || {};

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversation?.id, isLoading]);

  const handleSubmit = async () => {
    const trimmed = localPrompt.trim();
    if (!trimmed || isLoading || !handleSendPrompt) return;
    setLocalPrompt('');
    const result = await handleSendPrompt(trimmed);
    if (result?.reason === 'missing_api_key') {
      setLocalPrompt(trimmed);
      setShowSettings(true);
    }
  };

  return (
    <div data-left-ai-panel="true" className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#27272d] bg-[#141417] flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={13} className="text-[#38bdf8] shrink-0" />
          <span className="font-semibold text-zinc-100 text-[11px] uppercase tracking-wider truncate">
            Gemini AI
          </span>
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 bg-[#101013] border border-[#27272d] px-1.5 rounded">
            {conversations.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              handleCreateNewConversation?.();
              setTimeout(() => inputRef.current?.focus(), 40);
            }}
            title="Yeni Sohbet Başlat"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1c2330] hover:bg-[#0d99ff]/25 border border-[#2c435a] text-[#7dd3fc] text-[10px] font-medium transition-colors disabled:opacity-40 mr-0.5"
          >
            <Plus size={10} />
            <span>Yeni</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            title="API Anahtarı & Model Ayarları"
            className={`relative p-1 rounded hover:bg-white/[0.06] transition-colors ${
              showSettings ? 'text-[#7dd3fc] bg-white/[0.08]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KeyRound size={12} />
            <span
              className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                apiKey ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            title="Aktif Sohbeti Temizle"
            className="p-1 text-zinc-400 hover:text-rose-300 rounded hover:bg-white/[0.06]"
          >
            <Trash2 size={12} />
          </button>

          <button
            type="button"
            onClick={onClosePanel}
            title="Sol paneli gizle"
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06]"
          >
            <ChevronsLeft size={13} />
          </button>
        </div>
      </div>

      {/* Inline API Settings */}
      {showSettings && (
        <AiSettingsPanel aiChat={aiChat} onClose={() => setShowSettings(false)} compact />
      )}

      {/* Saved Conversations History Section */}
      <div className="border-b border-[#27272d] bg-[#131317] shrink-0">
        <button
          type="button"
          onClick={() => setShowHistoryList((prev) => !prev)}
          className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {showHistoryList ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Konuşmalarımız</span>
            <span className="text-[9.5px] font-mono text-zinc-500">({conversations.length})</span>
          </span>
          <span className="text-[10px] text-zinc-500 truncate max-w-[105px]">
            {activeConversation?.title || 'Yeni Sohbet'}
          </span>
        </button>

        {showHistoryList && (
          <div
            data-ai-conversations-sidebar="true"
            className="max-h-[146px] overflow-y-auto px-1.5 pb-1.5 space-y-1"
          >
            {conversations.map((conv) => {
              const isActiveConv = conv.id === activeConversation?.id;
              const userTurnCount = (conv.messages || []).filter((m) => m.role === 'user').length;
              return (
                <div
                  key={conv.id}
                  data-ai-conversation-id={conv.id}
                  onClick={() => handleSelectConversation?.(conv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectConversation?.(conv.id);
                    }
                  }}
                  className={`group flex items-center justify-between gap-1.5 px-2 py-1.5 rounded border text-left cursor-pointer transition-colors ${
                    isActiveConv
                      ? 'bg-[#202632] text-white border-[#0d99ff]/60'
                      : 'bg-[#18181d] text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <MessageSquare
                      size={11}
                      className={isActiveConv ? 'text-[#38bdf8] shrink-0' : 'text-zinc-500 shrink-0'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">
                        {conv.title || 'Yeni Sohbet'}
                      </div>
                      <div className="text-[9.5px] text-zinc-500">
                        {userTurnCount > 0 ? `${userTurnCount} mesaj` : 'Başlatılmadı'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation?.(conv.id, e)}
                    title="Konuşmayı Sil"
                    className="opacity-55 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-rose-300 hover:bg-white/[0.06] shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Chat History & Step-by-step Changes */}
      <div
        data-left-ai-messages="true"
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 min-h-0"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[92%] flex flex-col items-end gap-1">
                {msg.scopeLabel && (
                  <span className="text-[9.5px] text-emerald-300/90 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25">
                    {msg.scopeLabel}
                  </span>
                )}
                <div className="rounded-xl rounded-br-sm bg-[#252530] border border-[#323240] text-zinc-100 px-2.5 py-1.5 text-[11.5px] leading-snug break-words">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="w-full flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-[#38bdf8]/15 flex items-center justify-center text-[#38bdf8] shrink-0 mt-0.5">
                  <Sparkles size={10} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className={`text-[11.5px] leading-relaxed break-words ${msg.isError ? 'text-rose-300' : 'text-zinc-200'}`}>
                    {msg.text}
                  </div>

                  {Array.isArray(msg.changes) && msg.changes.length > 0 && !msg.isError && (
                    <div
                      data-ai-changes-list="true"
                      className="rounded-lg bg-[#101014] border border-[#272730] px-2.5 py-2 space-y-1.5"
                    >
                      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#7dd3fc]">
                        Yaptığım Değişiklikler
                      </div>
                      <ul className="space-y-1">
                        {msg.changes.map((stepText, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-1.5 text-[11px] text-zinc-200 leading-snug"
                          >
                            <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[9.5px] font-semibold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="break-words min-w-0">{stepText}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {msg.appliedCount > 0 && !msg.isError && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {msg.beforeSnapshot && (
                        <button
                          type="button"
                          disabled={msg.undoApplied}
                          onClick={() => handleUndoMessageChange?.(msg)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-colors border ${
                            msg.undoApplied
                              ? 'text-zinc-500 bg-[#141418] border-[#24242a] cursor-default'
                              : 'text-zinc-200 bg-[#1c1c23] border-[#2c2c36] hover:bg-amber-500/15 hover:text-amber-300 hover:border-amber-500/40'
                          }`}
                        >
                          <Undo2 size={10} />
                          <span>{msg.undoApplied ? 'Geri Alındı' : 'Geri Al'}</span>
                        </button>
                      )}

                      {msg.canRetry && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleRetryVariation?.(msg)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium text-zinc-300 bg-[#1c1c23] border border-[#2c2c36] hover:bg-[#38bdf8]/15 hover:text-[#7dd3fc] hover:border-[#38bdf8]/40 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw size={10} />
                          <span>Başka Tasarla</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-[#7dd3fc] text-[11px] py-1">
            <div className="w-4 h-4 rounded-full bg-[#38bdf8]/15 flex items-center justify-center shrink-0">
              <RefreshCw size={10} className="animate-spin" />
            </div>
            <span>Tamam knk, tasarlıyorum...</span>
          </div>
        )}

        {error && !messages.some((m) => m.isError && m.text.includes(error)) && (
          <div className="text-rose-300 text-[11px] flex items-center gap-1.5 px-1">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Inline Chat Composer inside Left Panel */}
      <div className="p-2.5 border-t border-[#27272d] bg-[#141417] space-y-1.5 shrink-0">
        {scopeInfo?.effectiveMode === 'selection' && (
          <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px]">
            <span className="truncate">Seçili: {scopeInfo.targetSummary}</span>
            <button
              type="button"
              onClick={() => setIgnoreSelectionOnce?.(true)}
              title="Tüm sayfaya uygula"
              className="text-emerald-200/80 hover:text-white shrink-0"
            >
              <X size={10} />
            </button>
          </div>
        )}

        <textarea
          ref={inputRef}
          data-left-ai-input="true"
          rows={2}
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            scopeInfo?.effectiveMode === 'selection'
              ? `"${scopeInfo.targetSummary}" için ne yapalım?`
              : "Gemini'ye yaz knk..."
          }
          className="w-full bg-[#101013] border border-[#2a2a32] focus:border-[#0d99ff] rounded-md px-2.5 py-1.5 text-[11.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-snug"
        />

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#101013] border border-[#27272d] hover:border-[#3e3e4a] text-[10px] text-zinc-400 hover:text-zinc-200 truncate"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="truncate">{apiKey ? currentModelLabel : 'API Bağla'}</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!localPrompt.trim() || isLoading}
            title="Gönder (Enter)"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              localPrompt.trim() && !isLoading
                ? 'bg-[#0d99ff] hover:bg-[#1aa3ff] text-white'
                : 'bg-[#202026] text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <ArrowUp size={11} />}
            <span>Gönder</span>
          </button>
        </div>
      </div>
    </div>
  );
}
