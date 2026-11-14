import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ExternalLink, Loader2, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import {
  getApiKey,
  maskApiKey,
  setApiKey,
  clearApiKey,
  testGeminiKey,
  updateSettings,
} from '../../settings/settingsStore';
import { INITIAL_MODELS } from '../../hooks/useAiChatSession';

const HOW_TO_URL = 'https://aistudio.google.com/apikey';

/**
 * Yapay Zeka sekmesi: Gemini API anahtarı, bağlantı testi ve varsayılan model seçimi.
 */
export default function SettingsAiTab({
  settings,
  aiChat,
  onDirtyChange,
  onStatusToast,
}) {
  const [savedKey, setSavedKey] = useState(() => getApiKey());
  const [draftKey, setDraftKey] = useState(() => getApiKey());
  const [showSecret, setShowSecret] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null);
  const [testState, setTestState] = useState({ status: 'idle', message: '' });
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

  const testAbortRef = useRef(null);
  const deleteTimerRef = useRef(null);

  useEffect(() => {
    const current = getApiKey();
    setSavedKey(current);
  }, [settings]);

  useEffect(() => {
    onDirtyChange?.(draftKey !== savedKey);
  }, [draftKey, savedKey, onDirtyChange]);

  useEffect(() => {
    return () => {
      testAbortRef.current?.abort();
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const modelOptions =
    Array.isArray(aiChat?.availableModels) && aiChat.availableModels.length > 0
      ? aiChat.availableModels
      : INITIAL_MODELS;

  const activeModelId = settings?.defaultModel || aiChat?.model || INITIAL_MODELS[0].id;

  const handleSave = (event) => {
    event.preventDefault();
    const result = setApiKey(draftKey);
    if (!result.ok) {
      setFormFeedback({ type: 'error', text: result.error });
      return;
    }

    setSavedKey(result.apiKey);
    setDraftKey(result.apiKey);
    aiChat?.handleSaveApiKey?.(result.apiKey);
    setConfirmDeleteStep(false);

    if (result.warning) {
      setFormFeedback({ type: 'warn', text: result.warning });
    } else {
      setFormFeedback({ type: 'success', text: 'API anahtarı bu cihaza güvenle kaydedildi.' });
    }
    onStatusToast?.('Gemini API anahtarı güncellendi.');
  };

  const handleDeleteClick = () => {
    if (!confirmDeleteStep) {
      setConfirmDeleteStep(true);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => setConfirmDeleteStep(false), 4000);
      return;
    }

    clearApiKey();
    aiChat?.handleSaveApiKey?.('');
    setSavedKey('');
    setDraftKey('');
    setConfirmDeleteStep(false);
    setTestState({ status: 'idle', message: '' });
    setFormFeedback({ type: 'info', text: 'Kayıtlı API anahtarı bu cihazdan silindi.' });
  };

  const handleRunTest = async () => {
    const candidate = draftKey.trim() || savedKey;
    if (!candidate) {
      setTestState({ status: 'error', message: 'Test etmek için önce bir API anahtarı girin.' });
      return;
    }

    testAbortRef.current?.abort();
    const controller = new AbortController();
    testAbortRef.current = controller;

    setTestState({ status: 'loading', message: 'Google Gemini API bağlantısı deneniyor...' });
    const res = await testGeminiKey(candidate, { signal: controller.signal });

    if (res.aborted) {
      setTestState({ status: 'idle', message: res.message });
      return;
    }

    setTestState({
      status: res.ok ? 'success' : 'error',
      message: res.message,
    });
  };

  const handleCancelTest = () => {
    testAbortRef.current?.abort();
  };

  const handleModelChange = (event) => {
    const nextModel = event.target.value;
    updateSettings({ defaultModel: nextModel });
    aiChat?.setModel?.(nextModel);
    onStatusToast?.('Varsayılan Gemini modeli güncellendi.');
  };

  const handleOpenHowTo = (event) => {
    if (window.electronAPI?.openExternalUrl) {
      event.preventDefault();
      window.electronAPI.openExternalUrl(HOW_TO_URL);
    }
  };

  return (
    <div className="wl-settings-panel">
      <div className="wl-settings-section">
        <div className="wl-settings-section__head">
          <div>
            <h3 className="wl-settings-section__title">Gemini API Anahtarı</h3>
            <p className="wl-settings-section__desc">
              {savedKey
                ? `Kayıtlı anahtar: ${maskApiKey(savedKey)}`
                : 'Henüz kayıtlı bir Gemini API anahtarı yok.'}
            </p>
          </div>

          <a
            href={HOW_TO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenHowTo}
            className="wl-settings-link"
          >
            <span>Anahtar nasıl alınır?</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>

        <form className="wl-settings-key-form" onSubmit={handleSave}>
          <div className="wl-settings-input-wrap">
            <KeyRound size={15} className="wl-settings-input-icon" aria-hidden="true" />
            <input
              id="settings-gemini-key"
              type={showSecret ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => {
                setDraftKey(e.target.value);
                setFormFeedback(null);
              }}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              aria-label="Gemini API anahtarı"
              className="wl-settings-input"
            />
            <button
              type="button"
              className="wl-settings-eye-btn"
              onClick={() => setShowSecret((prev) => !prev)}
              aria-label={showSecret ? 'Anahtarı gizle' : 'Anahtarı göster'}
              title={showSecret ? 'Anahtarı gizle' : 'Anahtarı göster'}
            >
              {showSecret ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>

          <div className="wl-settings-actions-row">
            <button type="submit" className="welcome-btn welcome-btn--primary-white">
              Kaydet
            </button>

            {testState.status === 'loading' ? (
              <button
                type="button"
                className="welcome-btn welcome-btn--ghost"
                onClick={handleCancelTest}
              >
                <Loader2 size={14} className="wl-spin" aria-hidden="true" />
                <span>İptal Et</span>
              </button>
            ) : (
              <button
                type="button"
                className="welcome-btn welcome-btn--ghost"
                onClick={handleRunTest}
              >
                Bağlantıyı Test Et
              </button>
            )}

            {savedKey && (
              <button
                type="button"
                className={`welcome-btn ${confirmDeleteStep ? 'wl-btn-danger-solid' : 'wl-btn-danger-ghost'}`}
                onClick={handleDeleteClick}
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>{confirmDeleteStep ? 'Emin misin?' : 'Sil'}</span>
              </button>
            )}
          </div>
        </form>

        {formFeedback && (
          <p
            role="status"
            className={`wl-settings-feedback wl-settings-feedback--${formFeedback.type}`}
          >
            {formFeedback.text}
          </p>
        )}

        {testState.status !== 'idle' && (
          <p
            role="status"
            className={`wl-settings-feedback wl-settings-feedback--${
              testState.status === 'success'
                ? 'success'
                : testState.status === 'loading'
                  ? 'info'
                  : 'error'
            }`}
          >
            {testState.message}
          </p>
        )}
      </div>

      <div className="wl-settings-section">
        <label htmlFor="settings-default-model" className="wl-settings-section__title">
          Varsayılan Model
        </label>
        <p className="wl-settings-section__desc">
          Yeni istemlerde ve karşılama ekranındaki Gemini çipinde seçili olan model.
        </p>

        <select
          id="settings-default-model"
          value={activeModelId}
          onChange={handleModelChange}
          className="wl-settings-select"
        >
          {modelOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="wl-settings-privacy">
        <ShieldCheck size={16} aria-hidden="true" />
        <p>
          API anahtarı yalnızca bu cihazdaki tarayıcı depolamasında saklanır; CraftStudio sunucularına
          gönderilmez, yalnızca doğrudan Google Gemini API isteklerinde kullanılır.
        </p>
      </div>
    </div>
  );
}
