import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Key, Check, AlertCircle, RefreshCw, 
  Trash2, Copy, X, Bot, User, Zap, ChevronDown, ExternalLink, Sliders,
  Maximize2, Minimize2
} from 'lucide-react';

export const DEFAULT_GEMINI_API_KEY = '';

function readInitialGeminiApiKey() {
  const saved = localStorage.getItem('craft_gemini_api_key');
  if (saved && saved.length > 10) return saved;
  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY
    ? String(import.meta.env.VITE_GEMINI_API_KEY).trim()
    : '';
  return envKey || '';
}

export default function AIAgentPanel({
  elements = [],
  onUpdateElements,
  selectedIds = [],
  onClose
}) {
  const [apiKey, setApiKey] = useState(() => readInitialGeminiApiKey());
  const [isEditingKey, setIsEditingKey] = useState(() => !apiKey);
  const [isFloating, setIsFloating] = useState(false);
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState([
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Önerilen & En Hızlı)' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Ultra Hızlı)' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-flash-latest', label: 'Gemini Flash (En Güncel)' },
    { id: 'gemini-pro-latest', label: 'Gemini Pro (En Güncel)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' }
  ]);
  
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Merhaba! Ben CraftStudio Gemini Ajanıyım. Sayfanızdaki öğeleri, renkleri, metinleri veya bileşenleri doğal dille değiştirebilirim. Başlamak için Google AI Studio API anahtarınızı bağlayın.',
      time: 'Şimdi'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const chatBottomRef = useRef(null);

  // Dynamically fetch models accessible by this API key
  const fetchModelsFromApi = async (keyToUse) => {
    const k = keyToUse || apiKey;
    if (!k) return;
    setIsFetchingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}`);
      if (res.ok) {
        const data = await res.json();
        const valid = (data.models || [])
          .filter(m => {
            const name = (m.name || '').replace('models/', '');
            const canGen = m.supportedGenerationMethods?.includes('generateContent');
            // Filter out unsupported/dead models (1.5, 2.5)
            const isDead = name.includes('1.5') || name.includes('2.5');
            return canGen && !isDead && (name.includes('gemini-3') || name.includes('latest') || name.includes('flash') || name.includes('pro'));
          })
          .map(m => {
            const id = m.name.replace('models/', '');
            let label = m.displayName || id;
            if (id === 'gemini-3-flash-preview') label = 'Gemini 3 Flash (Önerilen & En Hızlı)';
            else if (id === 'gemini-3.1-flash-lite-preview') label = 'Gemini 3.1 Flash Lite (Ultra Hızlı)';
            return { id, label };
          });
        if (valid.length > 0) {
          setAvailableModels(valid);
        }
      }
    } catch (e) {
      console.warn('Could not fetch models dynamically:', e);
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    fetchModelsFromApi(apiKey);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSaveApiKey = (key) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('craft_gemini_api_key', trimmed);
      setIsEditingKey(false);
      setError(null);
    } else {
      localStorage.removeItem('craft_gemini_api_key');
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Sohbet temizlendi. Tasarımınızda yapmak istediğiniz değişiklikleri söyleyin, anında uygulayayım!',
        time: 'Şimdi'
      }
    ]);
  };

  const QUICK_PROMPTS = [
    'Hero başlığını "Geleceğin Web Stüdyosu" yap ve rengini sarı yap',
    'Navbar\'a "Sepet (0)" butonu ekle ve turuncu yap',
    'Tüm kartların arka planını koyu lacivert yap ve köşelerini 20px yuvarla',
    'Hero butonuna mor gradyan ve hafif neon gölge ekle',
    'Footer zeminini daha koyu yap ve telif hakkı metnini güncelle'
  ];

  const handleSendPrompt = async (promptToSend) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      setError('Lütfen önce ücretsiz Gemini API Anahtarınızı girin.');
      setIsEditingKey(true);
      return;
    }

    setError(null);
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const systemInstruction = `
Sen CraftStudio görsel web tasarım ve kod üretici uygulamasının uzman yapay zeka ajanısın.
Kullanıcı sana tasarımında yapmak istediği değişiklikleri doğal dille söyler.
Sen mevcut sayfa DOM AST ağacını (elements dizisi) inceleyip, kullanıcının istediği değişiklikleri uygulayarak GÜNCELLENMİŞ elements dizisini ve kullanıcıya açıklama mesajını JSON formatında döndürmelisin.

CraftStudio Elements AST Şeması:
- id: benzersiz string (örn: 'elem-hero', 'elem-btn-1')
- type: HTML5 tag adı ('nav', 'section', 'div', 'h1', 'h2', 'p', 'button', 'a', 'span', 'img', 'footer', vb.)
- name: Açıklayıcı Türkçe isim (örn: 'Hero Ana Başlık')
- x, y: Sayı (ebeveynine göre göreceli koordinatlar)
- width, height: Sayı (piksel genişlik ve yükseklik)
- style: CSS özellikleri nesnesi (camelCase: backgroundColor, color, fontSize, borderRadius, padding, display, gap, boxShadow, vb.)
- attrs: HTML özellikleri (id, class, href, src, alt, vb.)
- textContent: Metin içeriği
- children: İç içe çocuk elemanlar dizisi (varsa)

Kurallar:
1. SADECE aşağıdaki JSON formatında geçerli bir JSON yanıtı döndür, markdown veya başka metin ekleme:
{
  "message": "Kullanıcıya yapılan değişiklikleri özetleyen samimi Türkçe mesaj",
  "elements": [ ... güncellenmiş tam elements dizisi ... ]
}
2. Elemanların ebeveyn-çocuk hiyerarşisini ve koordinat bütünlüğünü koru.
3. İstenen değişiklikleri titizlikle uygula (renkler, metinler, stiller, yeni eklenen elemanlar).
4. Nesneye yönelik modüler yapıya (Navbar, Hero, Features, Footer) sadık kal.
`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemInstruction}\n\nMEVCUT ELEMENTS AĞACI:\n${JSON.stringify(elements, null, 2)}\n\nKULLANICI TALEBİ:\n${text}`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP Hata: ${res.status}`);
      }

      const resData = await res.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Gemini API boş yanıt döndürdü.');

      // Extract JSON cleanly handling possible markdown fences or stray text
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (jsonErr) {
        // Fallback regex search for JSON object { ... }
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('Yapay zeka yanıtı geçerli JSON formatında okunamadı: ' + jsonErr.message);
        }
      }

      if (parsed.elements && Array.isArray(parsed.elements)) {
        onUpdateElements(parsed.elements);
      }

      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: parsed.message || 'İstediğiniz değişiklikler tuvale başarıyla uygulandı!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Gemini API Error:', err);
      setError(err.message || 'İstek işlenirken bir hata oluştu.');
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: `Üzgünüm, bir hata oluştu: ${err.message}. Lütfen API anahtarınızı ve internet bağlantınızı kontrol edin.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isFloating && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" 
          onClick={() => setIsFloating(false)} 
        />
      )}

      <div className={isFloating 
        ? "fixed inset-8 md:inset-16 z-50 bg-[#141417] border border-[#2c2c32] rounded-lg flex flex-col text-xs text-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        : "w-full min-w-0 bg-[#141417] flex flex-col h-full text-xs text-zinc-200 select-none overflow-hidden"
      }>
        
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-[#27272d] bg-[#18181b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0d99ff]/15 border border-[#0d99ff]/40 flex items-center justify-center text-[#38bdf8]">
              <Sparkles size={13} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-100 text-xs block leading-tight">Gemini AI Ajanı</span>
                {apiKey ? (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    API Bağlı
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] text-zinc-300 font-mono bg-[#101013] px-1.5 py-0.5 rounded border border-[#2c2c32]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0d99ff]"></span>
                    Anahtar Girin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-purple-300/90 font-mono">Doğal Dil ile Tasarım &amp; Kod</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFloating(!isFloating)}
              title={isFloating ? "Kenara Sabitle (Dock)" : "Ayrı Geniş Pencereye Al (Float)"}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors"
            >
              {isFloating ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={() => setIsEditingKey(!isEditingKey)}
              title="API Anahtarını Değiştir"
              className={`p-1.5 rounded transition-colors ${apiKey ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222228]' : 'text-[#38bdf8] bg-[#0d99ff]/15 border border-[#0d99ff]/30'}`}
            >
              <Key size={13} />
            </button>
            <button
              onClick={handleClearHistory}
              title="Sohbeti Temizle"
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/[0.06]"
            >
              <Trash2 size={13} />
            </button>
            <button
              onClick={onClose}
              title="Kapat"
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/[0.06] ml-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>

      {/* Model & API Key Bar */}
      <div className="px-3 py-2 bg-[#0b0d12] border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[10px] text-slate-400 font-mono">Model:</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="flex-1 bg-[#171a24] border border-white/[0.08] rounded-md px-2 py-1 text-[11px] text-purple-300 font-mono focus:outline-none focus:border-purple-500 truncate"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={() => fetchModelsFromApi(apiKey)}
            disabled={isFetchingModels}
            title="Kullanıcı API modellerini yenile"
            className="p-1 rounded-md text-slate-400 hover:text-purple-300 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={isFetchingModels ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-500/30 font-mono whitespace-nowrap">
          Gemini 3
        </span>
      </div>

      {/* Active API Status Banner */}
      {apiKey && !isEditingKey && (
        <div className="px-3 py-1.5 bg-emerald-950/25 border-b border-emerald-500/20 flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>API Bağlı: Gemini 3 Aktif</span>
            <span className="text-slate-500 font-mono text-[9px] ml-1">({apiKey.slice(0, 8)}...{apiKey.slice(-4)})</span>
          </span>
          <button
            onClick={() => setIsEditingKey(true)}
            className="text-[10px] text-slate-400 hover:text-white hover:underline"
          >
            Değiştir
          </button>
        </div>
      )}

      {/* API Key Modal / Form */}
      {isEditingKey && (
        <div className="p-3 bg-purple-950/20 border-b border-purple-500/25 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
              <Key size={12} />
              <span>Gemini 3 API Anahtarı</span>
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Google AI Studio</span>
              <ExternalLink size={10} />
            </a>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed flex items-center gap-1.5">
            <Sparkles size={11} className="text-purple-400 shrink-0" />
            <span>Kendi <strong className="text-slate-200">Google AI Studio (Gemini)</strong> API anahtarınızı bağlayın; anahtar yalnızca tarayıcınızda saklanır.</span>
          </p>

          <div className="flex gap-1.5">
            <input
              type="password"
              defaultValue={apiKey}
              id="gemini-key-input"
              placeholder="Gemini API anahtarınızı girin..."
              className="flex-1 bg-[#0b0d12] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => {
                const el = document.getElementById('gemini-key-input');
                if (el) {
                  handleSaveApiKey(el.value);
                  fetchModelsFromApi(el.value);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Messages Chat Area */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
              {msg.role === 'user' ? (
                <>
                  <span>Sen</span>
                  <User size={11} className="text-sky-400" />
                </>
              ) : (
                <>
                  <Bot size={11} className="text-purple-400" />
                  <span>CraftStudio AI</span>
                </>
              )}
              <span>•</span>
              <span>{msg.time}</span>
            </div>

            <div
              className={`max-w-[90%] rounded-md px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0d99ff] text-white rounded-br-none'
                  : 'bg-[#18181b] border border-[#27272d] text-zinc-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-[#38bdf8] text-xs py-2 px-3 bg-[#18181b] rounded border border-[#0d99ff]/30 animate-pulse">
            <RefreshCw size={13} className="animate-spin" />
            <span>Yapay zeka tasarımınızı analiz ediyor ve uyguluyor...</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertCircle size={12} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 bg-[#101013] border-t border-[#27272d] space-y-1.5">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
          Hızlı Öneriler
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendPrompt(qp)}
              disabled={isLoading}
              className="whitespace-nowrap px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#0d99ff]/15 border border-[#2c2c32] hover:border-[#0d99ff]/40 text-zinc-300 hover:text-[#38bdf8] text-[10px] transition-colors"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-2.5 bg-[#18181b] border-t border-[#27272d] flex items-end gap-2">
        <textarea
          rows={2}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt();
            }
          }}
          placeholder="Tasarımda neyi değiştirmek istersiniz? (örn: Butonları yeşil yap)..."
          className="flex-1 bg-[#101013] border border-[#2c2c32] rounded p-2 text-zinc-100 text-xs focus:outline-none focus:border-[#0d99ff] resize-none font-sans"
        />
        <button
          onClick={() => handleSendPrompt()}
          disabled={!inputPrompt.trim() || isLoading}
          className="p-2.5 rounded bg-[#0d99ff] hover:bg-[#0284c7] text-white font-semibold disabled:opacity-40 transition-all"
        >
          <Send size={14} />
        </button>
      </div>

    </div>
  </>
);
}
