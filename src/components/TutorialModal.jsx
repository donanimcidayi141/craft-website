import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, X,
  Square, AlignCenter, MoveVertical, Code, Play, Lightbulb
} from 'lucide-react';

export default function TutorialModal({
  isOpen,
  onClose,
  onAddSampleBox,
  onCenterSampleBox,
  onApplyGradient,
  onApplyBorderRadius,
  onTogglePreview,
  onExportReact
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps = [
    {
      title: "1. Adım: Tuvale Dikdörtgen Ekle",
      icon: Square,
      badge: "Temel Çizim",
      description: "Tasarım yaparken her şey bloklarla (dikdörtgenlerle) başlar. Sol araç çubuğundaki 'R' simgesine basabilir veya aşağıdaki butona tıklayarak hemen bir kutu ekleyebilirsin.",
      actionText: "Tuvale Dikdörtgen Ekle",
      action: () => onAddSampleBox(),
      tip: "Kısayol: Klavyeden 'R' tuşuna basıp beyaz tuvalde istediğin yere tıklayabilirsin."
    },
    {
      title: "2. Adım: Dolgu & Gradyan Ayarlama",
      icon: Sparkles,
      badge: "Renk & Gradyan",
      description: "Eklediğin dikdörtgenin rengini düz veya iki renkli gradyan yapabilirsin. Sağ paneldeki 'Dolgu' kısmından Gradyan'ı seçip açıyı 45° yapmayı dene.",
      actionText: "Altın Gradyan Uygula",
      action: () => onApplyGradient(),
      tip: "Açı kaydırıcısıyla renk geçişinin yönünü 0°-360° arasında döndürebilirsin."
    },
    {
      title: "3. Adım: Border-Radius (Köşe Yuvarlama)",
      icon: Sparkles,
      badge: "Köşe Yuvarlaklığı",
      description: "Köşeleri yumuşatmak için sağ paneldeki Border Radius slider'ını kullan. 'Ayrık' butonuna basarak sadece sol üst ve sağ alt köşeyi de yuvarlayabilirsin!",
      actionText: "Köşeleri 24px Yuvarla",
      action: () => onApplyBorderRadius(),
      tip: "Modern tasarımda 16px - 24px köşe yuvarlaklığı çok şık durur."
    },
    {
      title: "4. Adım: Sayfada veya Nesne İçinde Ortala",
      icon: AlignCenter,
      badge: "Yeni Özellik: Hizalama",
      description: "Artık bir öğeyi sayfada tam ortaya almak için tek tık yeterli! 'Yatay Ortala' ve 'Dikey Ortala' butonlarını kullanarak nesneyi kusursuz hizala.",
      actionText: "Öğeyi Sayfada Tam Ortala",
      action: () => onCenterSampleBox(),
      tip: "Üst menü çubuğundaki veya sağ paneldeki hizalama simgelerine tıklayabilirsin."
    },
    {
      title: "5. Adım: Sayfayı Aşağı Kaydırma & Boyunu Uzatma",
      icon: MoveVertical,
      badge: "Doğal Scroll",
      description: "Fare tekerleğini çevirerek sayfayı aşağı kaydırabilirsin. Tuvalin en altındaki 'Sayfa Boyunu Uzat' tutamacını aşağı çekerek sayfa boyunu 2000px yapabilirsin.",
      actionText: null,
      tip: "Kısayol: Ctrl + Fare Tekerleği yakınlaştırır, normal tekerlek sayfayı aşağı kaydırır."
    },
    {
      title: "6. Adım: Canlı Önizleme & Yayınlama (React + HTML)",
      icon: Code,
      badge: "Yayınlama & Kod",
      description: "Artık sıradan çıktı yok! 'Canlıya Al · Yayınla' dediğinde hedef klasörü ve proje adını kendin seçebilir, gerçek canlı önizlemeyi test edip tek tıkla tarayıcıda canlıya alabilirsin.",
      actionText: "Canlıya Al Studio Penceresini Aç",
      action: () => onExportReact(),
      tip: "Masaüstü uygulamasında 'Tarayıcıda Canlı Aç' doğrudan yerel HTTP sunucusuyla tarayıcıda yayına alır!"
    }
  ];

  const current = steps[currentStep];
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#18181b] border border-[#2c2c34] rounded-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#27272d] flex items-center justify-between bg-[#141417]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#0d99ff]/15 text-[#38bdf8] border border-[#0d99ff]/35 flex items-center justify-center">
              <Icon size={16} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7dd3fc] block">
                {current.badge} • Adım {currentStep + 1} / {steps.length}
              </span>
              <h3 className="font-semibold text-zinc-100 text-[13px]">{current.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-[#101013] h-1.5 rounded-sm overflow-hidden border border-[#27272d]">
            <div
              className="bg-[#0d99ff] h-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {current.description}
          </p>

          {/* Interactive Action Button for this step */}
          {current.actionText && (
            <div className="pt-1">
              <button
                onClick={() => {
                  current.action();
                }}
                className="w-full py-2 px-4 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Play size={12} className="fill-current" />
                <span>{current.actionText}</span>
              </button>
            </div>
          )}

          {/* Pro tip card */}
          <div className="p-3 bg-[#101013] border border-[#27272d] rounded text-xs text-zinc-400 flex items-start gap-2.5">
            <Lightbulb size={14} className="text-[#38bdf8] shrink-0 mt-0.5" />
            <span>{current.tip}</span>
          </div>
        </div>

        {/* Footer controls */}
        <div className="px-5 py-3 bg-[#141417] border-t border-[#27272d] flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft size={13} />
            <span>Geri</span>
          </button>

          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-sm cursor-pointer transition-all ${
                  i === currentStep ? 'bg-[#0d99ff] w-5' : 'bg-white/20 w-2'
                }`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium bg-[#222229] border border-[#32323c] hover:bg-[#0d99ff] hover:border-[#0d99ff] text-zinc-100 hover:text-white transition-colors"
            >
              <span>Sonraki</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[#0d99ff] text-white hover:bg-[#1fa3ff] transition-colors"
            >
              <CheckCircle2 size={13} />
              <span>Tamamla</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
