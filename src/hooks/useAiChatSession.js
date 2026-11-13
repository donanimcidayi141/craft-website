import { useState, useEffect, useCallback } from 'react';
import {
  resolveAiTargetScope,
  detectAiRedesignIntent,
  resolveAiTemperature,
  buildAiSystemPrompt,
  buildGeminiRequestContents,
  parseAiJsonResponse,
  applyAiResponseToTree,
} from '../utils/aiAgentUtils';

export const AI_CONVERSATIONS_STORAGE_KEY = 'craft_ai_conversations_v1';

export const DEFAULT_AI_WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: "Selam knk, ne yapalım? Tüm siteyi tarif edebilir ya da tuvalden bir yer seçip 'bu olmamış' diyebilirsin.",
};

const INITIAL_MODELS = [
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash (Latest)' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro (Latest)' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
];

function readInitialGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  const saved = localStorage.getItem('craft_gemini_api_key');
  if (saved && saved.length > 10) return saved;
  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY
    ? String(import.meta.env.VITE_GEMINI_API_KEY).trim()
    : '';
  return envKey || '';
}

export function createConversationSession(title = 'Yeni Sohbet', initialMessages = null) {
  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const msgs = Array.isArray(initialMessages) && initialMessages.length > 0
    ? initialMessages
    : [{ ...DEFAULT_AI_WELCOME_MSG, id: `welcome-${Date.now()}` }];
  return {
    id,
    title,
    updatedAt: Date.now(),
    messages: msgs,
  };
}

function deriveConversationTitle(promptText) {
  const clean = String(promptText || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Yeni Sohbet';
  return clean.length > 36 ? `${clean.slice(0, 36)}...` : clean;
}

function loadInitialConversations() {
  if (typeof window === 'undefined') {
    const first = createConversationSession();
    return { list: [first], activeId: first.id };
  }
  try {
    const raw = localStorage.getItem(AI_CONVERSATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed
          .filter((c) => c && typeof c === 'object' && Array.isArray(c.messages) && c.messages.length > 0)
          .slice(0, 30);
        if (sanitized.length > 0) {
          return { list: sanitized, activeId: sanitized[0].id };
        }
      }
    }
  } catch {
    // ignore corrupted storage payloads
  }
  const fallback = createConversationSession();
  return { list: [fallback], activeId: fallback.id };
}

/** Shared Gemini AI chat, persistent conversation history, and canvas application state. */
export function useAiChatSession({
  elements = [],
  selectedIds = [],
  canvasSettings = null,
  onCaptureSnapshot,
  onApplyAiResult,
  onRestoreAiSnapshot,
  onUserPromptSent,
} = {}) {
  const [apiKey, setApiKey] = useState(() => readInitialGeminiApiKey());
  const [keyDraft, setKeyDraft] = useState(() => readInitialGeminiApiKey());
  const [ignoreSelectionOnce, setIgnoreSelectionOnce] = useState(false);
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState(INITIAL_MODELS);

  const [initialStore] = useState(() => loadInitialConversations());
  const [conversations, setConversations] = useState(() => initialStore.list);
  const [activeConversationId, setActiveConversationId] = useState(() => initialStore.activeId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];
  const messages = activeConversation?.messages || [DEFAULT_AI_WELCOME_MSG];
  const savedUserTurnsCount = conversations.reduce(
    (sum, conv) => sum + (conv.messages || []).filter((m) => m.role === 'user').length,
    0
  );

  // Persist conversation threads cleanly without storing heavy snapshot clones
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const serializable = conversations.slice(0, 30).map((conv) => ({
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        messages: (conv.messages || []).map(({ beforeSnapshot, ...rest }) => rest),
      }));
      localStorage.setItem(AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // ignore storage quota errors
    }
  }, [conversations]);

  // Re-enable automatic selection targeting whenever canvas selection changes
  const selectionKey = Array.isArray(selectedIds) ? selectedIds.join(',') : '';
  useEffect(() => {
    setIgnoreSelectionOnce(false);
  }, [selectionKey]);

  const fetchModelsFromApi = useCallback(async (keyToUse) => {
    const k = keyToUse || apiKey;
    if (!k) return;
    setIsFetchingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}`);
      if (res.ok) {
        const data = await res.json();
        const valid = (data.models || [])
          .filter((m) => {
            const name = (m.name || '').replace('models/', '');
            const canGen = m.supportedGenerationMethods?.includes('generateContent');
            const isDead = name.includes('1.5') || name.includes('2.5');
            return canGen && !isDead && (name.includes('gemini-3') || name.includes('latest') || name.includes('flash') || name.includes('pro'));
          })
          .map((m) => {
            const id = m.name.replace('models/', '');
            let label = m.displayName || id;
            if (id === 'gemini-3-flash-preview') label = 'Gemini 3 Flash';
            else if (id === 'gemini-3.1-flash-lite-preview') label = 'Gemini 3.1 Flash Lite';
            return { id, label };
          });
        if (valid.length > 0) setAvailableModels(valid);
      }
    } catch {
      // ignore offline model fetch issues
    } finally {
      setIsFetchingModels(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) fetchModelsFromApi(apiKey);
  }, []);

  const requestedMode = ignoreSelectionOnce ? 'full_site' : 'auto';
  const scopeInfo = resolveAiTargetScope(elements, selectedIds, requestedMode);
  const currentModelLabel = (availableModels.find((m) => m.id === model)?.label || model)
    .replace(' (Önerilen & En Hızlı)', '')
    .replace(' (Hızlı & Önerilen)', '');

  const handleSaveApiKey = useCallback((nextKey) => {
    const trimmed = String(nextKey || '').trim();
    setApiKey(trimmed);
    setKeyDraft(trimmed);
    if (trimmed) {
      localStorage.setItem('craft_gemini_api_key', trimmed);
      setError(null);
      fetchModelsFromApi(trimmed);
      return true;
    }
    localStorage.removeItem('craft_gemini_api_key');
    return false;
  }, [fetchModelsFromApi]);

  const updateConversationById = useCallback((convId, updater) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const nextConv = updater(c);
        return { ...nextConv, updatedAt: Date.now() };
      })
    );
  }, []);

  const handleCreateNewConversation = useCallback(() => {
    if (isLoading) return null;
    const fresh = createConversationSession('Yeni Sohbet');
    setConversations((prev) => [fresh, ...prev].slice(0, 30));
    setActiveConversationId(fresh.id);
    setError(null);
    return fresh.id;
  }, [isLoading]);

  const handleSelectConversation = useCallback((convId) => {
    if (!convId || convId === activeConversationId) return;
    setActiveConversationId(convId);
    setError(null);
  }, [activeConversationId]);

  const handleDeleteConversation = useCallback((convId, e) => {
    if (e) e.stopPropagation();
    if (isLoading && convId === activeConversationId) return;
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== convId);
      if (remaining.length === 0) {
        const fresh = createConversationSession('Yeni Sohbet');
        setActiveConversationId(fresh.id);
        return [fresh];
      }
      if (convId === activeConversationId) {
        setActiveConversationId(remaining[0].id);
      }
      return remaining;
    });
    setError(null);
  }, [isLoading, activeConversationId]);

  const handleClearHistory = useCallback(() => {
    const targetId = activeConversation?.id;
    if (!targetId) return;
    updateConversationById(targetId, (conv) => ({
      ...conv,
      title: 'Yeni Sohbet',
      messages: [{
        ...DEFAULT_AI_WELCOME_MSG,
        id: `welcome-${Date.now()}`,
      }],
    }));
    setError(null);
  }, [activeConversation?.id, updateConversationById]);

  const handleSendPrompt = useCallback(async (promptText, { forceRedesign = false, labelOverride = null } = {}) => {
    const rawText = String(promptText || '').trim();
    if (!rawText || isLoading) return { ok: false, reason: 'empty_or_busy' };

    if (!apiKey) {
      setError('Önce Gemini API anahtarını bağlaman gerekiyor knk.');
      return { ok: false, reason: 'missing_api_key' };
    }

    const targetConvId = activeConversation?.id;
    if (!targetConvId) return { ok: false, reason: 'no_conversation' };

    const priorMessages = [...messages];
    setError(null);

    const activeScope = resolveAiTargetScope(elements, selectedIds, requestedMode);
    const isRedesign = Boolean(forceRedesign) || detectAiRedesignIntent(rawText);
    const displayPrompt = labelOverride || rawText;
    const beforeSnapshot = onCaptureSnapshot ? onCaptureSnapshot() : null;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      promptText: rawText,
      text: displayPrompt,
      scopeLabel: activeScope.effectiveMode === 'selection' ? activeScope.targetSummary : null,
    };

    const hasPriorUserMsg = priorMessages.some((m) => m.role === 'user');
    updateConversationById(targetConvId, (conv) => ({
      ...conv,
      title: !hasPriorUserMsg || conv.title === 'Yeni Sohbet' ? deriveConversationTitle(displayPrompt) : conv.title,
      messages: [...(conv.messages || []), userMsg],
    }));

    // Auto-open the Left AI Panel so conversations & step-by-step actions appear on the left
    onUserPromptSent?.(targetConvId);
    setIsLoading(true);

    try {
      const systemPrompt = buildAiSystemPrompt({
        effectiveMode: activeScope.effectiveMode,
        elements,
        targetNodes: activeScope.targetNodes,
        canvasSettings,
        userPrompt: rawText,
        isRedesign,
      });

      const contents = buildGeminiRequestContents({
        conversationHistory: priorMessages,
        systemPrompt,
      });

      const requestBody = {
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: resolveAiTemperature({
            effectiveMode: activeScope.effectiveMode,
            isRedesign,
          }),
        },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP Hata: ${res.status}`);
      }

      const resData = await res.json();
      const rawReply = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = parseAiJsonResponse(rawReply);

      const {
        nextElements,
        recommendedHeight,
        changedCount,
        appliedTargetIds,
        changes,
      } = applyAiResponseToTree({
        elements,
        parsedResponse: parsed,
        effectiveMode: activeScope.effectiveMode,
        targetIds: activeScope.targetIds,
        currentStageHeight: Number(canvasSettings?.height) || 1350,
      });

      onApplyAiResult?.({
        nextElements,
        recommendedHeight,
        appliedTargetIds,
        effectiveMode: activeScope.effectiveMode,
      });

      const fallbackMsg = activeScope.effectiveMode === 'selection'
        ? `Tamam knk, "${activeScope.targetSummary}" alanını yeniden tasarladım.`
        : 'Tamam knk, yeni tasarımı tuvale uyguladım.';

      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        rawMessage: parsed.message || fallbackMsg,
        text: parsed.message || fallbackMsg,
        changes: Array.isArray(changes) ? changes : [],
        appliedCount: changedCount,
        beforeSnapshot,
        undoApplied: false,
        canRetry: true,
        sourcePrompt: rawText,
      };
      updateConversationById(targetConvId, (conv) => ({
        ...conv,
        messages: [...(conv.messages || []), assistantMsg],
      }));

      return { ok: true };
    } catch (err) {
      setError(err.message || 'İstek işlenirken hata oluştu.');
      updateConversationById(targetConvId, (conv) => ({
        ...conv,
        messages: [
          ...(conv.messages || []),
          {
            id: `ai-err-${Date.now()}`,
            role: 'assistant',
            isError: true,
            text: `Knk bir hata çıktı: ${err.message}`,
          },
        ],
      }));
      return { ok: false, reason: 'request_error', error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    apiKey,
    activeConversation?.id,
    messages,
    elements,
    selectedIds,
    requestedMode,
    onCaptureSnapshot,
    updateConversationById,
    onUserPromptSent,
    canvasSettings,
    model,
    onApplyAiResult,
  ]);

  const handleUndoMessageChange = useCallback((msg) => {
    if (!msg?.beforeSnapshot || msg.undoApplied) return;
    onRestoreAiSnapshot?.(msg.beforeSnapshot);
    const targetId = activeConversation?.id;
    if (!targetId) return;
    updateConversationById(targetId, (conv) => ({
      ...conv,
      messages: [
        ...(conv.messages || []).map((m) => (m.id === msg.id ? { ...m, undoApplied: true } : m)),
        {
          id: `ai-undo-${Date.now()}`,
          role: 'assistant',
          isSystemUndo: true,
          text: 'Tamam knk, değişiklikten önceki haline geri döndüm.',
        },
      ],
    }));
  }, [onRestoreAiSnapshot, activeConversation?.id, updateConversationById]);

  const handleRetryVariation = useCallback((msg) => {
    if (isLoading) return;
    const basePrompt = msg?.sourcePrompt || 'Burası olmamış, tamamen farklı tasarla';
    handleSendPrompt(
      `Bir önceki tasarım içime sinmedi ("${basePrompt}"). Aynı alanı tamamen farklı bir görsel kompozisyon, renk dengesi ve düzenle baştan tasarla.`,
      {
        forceRedesign: true,
        labelOverride: 'Başka tasarım dene',
      }
    );
  }, [isLoading, handleSendPrompt]);

  return {
    apiKey,
    keyDraft,
    setKeyDraft,
    handleSaveApiKey,
    model,
    setModel,
    availableModels,
    isFetchingModels,
    fetchModelsFromApi,
    currentModelLabel,
    ignoreSelectionOnce,
    setIgnoreSelectionOnce,
    scopeInfo,
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    savedUserTurnsCount,
    isLoading,
    error,
    setError,
    handleCreateNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleClearHistory,
    handleSendPrompt,
    handleUndoMessageChange,
    handleRetryVariation,
  };
}
