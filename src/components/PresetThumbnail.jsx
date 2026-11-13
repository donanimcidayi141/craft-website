import React from 'react';

/**
 * Renders crisp miniature structural thumbnails for Canva-style Navbar, Footer,
 * Interactive Slider, Content Block, and Atomic UI presets inside sidebar & asset drawers.
 */
export default function PresetThumbnail({ asset }) {
  const key = asset?.presetKey || '';
  const el = asset?.element || {};
  const t = (el.type || 'div').toLowerCase();

  // 1. NAVBAR THUMBNAILS
  if (key === 'nav-minimal-centered') {
    return (
      <div className="w-full h-9 rounded-sm bg-white border border-zinc-300 px-2.5 flex items-center justify-between shadow-sm">
        <span className="text-[8px] font-extrabold tracking-widest text-zinc-900">LUMEN.</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-zinc-400" />
          <span className="w-4 h-1 rounded-full bg-zinc-400" />
          <span className="w-4 h-1 rounded-full bg-zinc-400" />
        </div>
        <span className="px-1.5 py-0.5 rounded-full border border-zinc-900 text-[7px] font-semibold text-zinc-900">CTA</span>
      </div>
    );
  }
  if (key === 'nav-boutique-commerce') {
    return (
      <div className="w-full h-9 rounded-sm bg-[#121014] border border-[#3a2f3b] px-2.5 flex items-center justify-between">
        <span className="text-[8px] font-bold tracking-wider text-amber-300">AURA</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-zinc-400/70" />
          <span className="w-4 h-1 rounded-full bg-amber-300/80" />
          <span className="w-4 h-1 rounded-full bg-zinc-400/70" />
        </div>
        <span className="px-1.5 py-0.5 rounded-sm bg-amber-300 text-[#18130c] text-[7px] font-bold">Sepet</span>
      </div>
    );
  }
  if (key === 'nav-floating-glass') {
    return (
      <div className="w-[94%] h-8 rounded-full bg-[#18181b]/95 border border-white/15 px-2.5 flex items-center justify-between shadow-md">
        <span className="text-[8px] font-bold text-white tracking-wider">NOVA</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
          <span className="w-4 h-1 rounded-full bg-[#38bdf8]" />
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
        </div>
        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#0d99ff] to-indigo-500 text-white text-[7px] font-semibold">Dene</span>
      </div>
    );
  }
  if (key.startsWith('nav-') || t === 'nav' || t === 'navbar') {
    return (
      <div className="w-full h-9 rounded-sm bg-[#09090b] border border-[#2c2c32] px-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#0d99ff] inline-block" />
          <span className="text-[8px] font-bold text-zinc-100">ATELIER</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
          <span className="w-4 h-1 rounded-full bg-[#38bdf8]" />
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
        </div>
        <span className="px-1.5 py-0.5 rounded-sm bg-[#0d99ff] text-white text-[7px] font-semibold">Başla</span>
      </div>
    );
  }

  // 2. FOOTER THUMBNAILS
  if (key === 'footer-minimal-editorial') {
    return (
      <div className="w-full h-10 rounded-sm bg-[#111114] border-t-2 border-[#38bdf8]/60 border-x border-b border-[#27272d] px-2.5 flex items-center justify-between">
        <span className="text-[8px] font-semibold text-zinc-200">LUMEN • 2026</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
          <span className="w-4 h-1 rounded-full bg-zinc-500" />
        </div>
      </div>
    );
  }
  if (key === 'footer-newsletter-cta') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#0c1220] border border-[#1e293b] p-2 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <span className="w-16 h-1.5 rounded-full bg-zinc-200" />
          <div className="flex items-center gap-1">
            <span className="flex-1 h-3 rounded-sm bg-[#101013] border border-slate-700" />
            <span className="w-6 h-3 rounded-sm bg-[#0d99ff]" />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="space-y-1">
            <span className="block w-5 h-1 rounded-full bg-zinc-400" />
            <span className="block w-4 h-1 rounded-full bg-zinc-600" />
          </div>
          <div className="space-y-1">
            <span className="block w-5 h-1 rounded-full bg-zinc-400" />
            <span className="block w-4 h-1 rounded-full bg-zinc-600" />
          </div>
        </div>
      </div>
    );
  }
  if (key.startsWith('footer-') || t === 'footer') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#09090b] border border-[#27272d] p-2 flex flex-col justify-between">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="space-y-1">
            <span className="block w-8 h-1.5 rounded-full bg-zinc-200" />
            <span className="block w-10 h-1 rounded-full bg-zinc-600" />
          </div>
          {[0, 1, 2].map((col) => (
            <div key={col} className="space-y-1">
              <span className="block w-6 h-1 rounded-full bg-zinc-400" />
              <span className="block w-7 h-1 rounded-full bg-zinc-700" />
              <span className="block w-5 h-1 rounded-full bg-zinc-700" />
            </div>
          ))}
        </div>
        <div className="border-t border-[#27272d] pt-1 flex justify-between items-center">
          <span className="w-12 h-1 rounded-full bg-zinc-700" />
          <span className="w-6 h-1 rounded-full bg-zinc-700" />
        </div>
      </div>
    );
  }

  // 3. INTERACTIVE SLIDER THUMBNAILS
  if (key === 'slider-testimonials') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#141418] border border-[#2c2c32] px-2 py-1.5 flex flex-col justify-between relative">
        <div className="flex items-center justify-between gap-1.5 my-auto">
          <span className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 text-[8px] text-zinc-200 flex items-center justify-center">‹</span>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="w-3/4 h-1.5 rounded-full bg-zinc-200" />
            <span className="w-1/2 h-1 rounded-full bg-zinc-500" />
          </div>
          <span className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 text-[8px] text-zinc-200 flex items-center justify-center">›</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        </div>
      </div>
    );
  }
  if (key === 'slider-collection-strip') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#111115] border border-[#2c2c32] px-2 py-1.5 flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-3 rounded-full bg-zinc-800 text-[7px] text-zinc-300 flex items-center justify-center">‹</span>
          <div className="flex-1 grid grid-cols-2 gap-1.5">
            <div className="h-6 rounded-sm bg-[#1c1c22] border border-[#2e2e36] flex items-center gap-1 p-1">
              <span className="w-4 h-4 rounded-sm bg-amber-400/25 border border-amber-400/40 shrink-0" />
              <span className="flex-1 h-1.5 rounded-full bg-zinc-300" />
            </div>
            <div className="h-6 rounded-sm bg-[#1c1c22] border border-[#2e2e36] flex items-center gap-1 p-1">
              <span className="w-4 h-4 rounded-sm bg-[#0d99ff]/25 border border-[#0d99ff]/40 shrink-0" />
              <span className="flex-1 h-1.5 rounded-full bg-zinc-300" />
            </div>
          </div>
          <span className="w-2.5 h-3 rounded-full bg-zinc-800 text-[7px] text-zinc-300 flex items-center justify-center">›</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        </div>
      </div>
    );
  }
  if (key.startsWith('slider-') || el.sliderConfig) {
    return (
      <div className="w-full h-12 rounded-sm bg-gradient-to-r from-[#0f172a] to-[#172554] border border-[#0d99ff]/40 px-2 py-1.5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <span className="w-3 h-3 rounded-full bg-black/50 text-[8px] text-white flex items-center justify-center shrink-0">‹</span>
          <div className="flex-1 space-y-1">
            <span className="block w-16 h-1.5 rounded-full bg-white" />
            <span className="block w-10 h-1 rounded-full bg-[#38bdf8]" />
          </div>
          <span className="w-9 h-6 rounded-sm bg-sky-400/20 border border-sky-400/40 shrink-0" />
          <span className="w-3 h-3 rounded-full bg-black/50 text-[8px] text-white flex items-center justify-center shrink-0">›</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="w-2 h-1 rounded-full bg-[#38bdf8]" />
          <span className="w-1 h-1 rounded-full bg-white/40" />
          <span className="w-1 h-1 rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  // 4. CONTENT BLOCKS THUMBNAILS
  if (key === 'block-split-hero') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#141418] border border-[#2c2c32] p-2 flex items-center justify-between gap-2">
        <div className="flex-1 space-y-1">
          <span className="block w-8 h-1 rounded-full bg-[#0d99ff]" />
          <span className="block w-full h-1.5 rounded-full bg-zinc-100" />
          <span className="block w-3/4 h-1 rounded-full bg-zinc-500" />
          <span className="inline-block w-8 h-2.5 rounded-sm bg-[#0d99ff]" />
        </div>
        <div className="w-12 h-8 rounded-sm bg-gradient-to-br from-sky-500/30 to-indigo-500/30 border border-white/15 shrink-0" />
      </div>
    );
  }
  if (key === 'block-features-grid') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#111115] border border-[#27272d] p-1.5 flex flex-col justify-between">
        <span className="w-14 h-1 rounded-full bg-zinc-300 mx-auto" />
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 rounded-sm bg-[#1a1a20] border border-[#2c2c32] p-1 space-y-1">
              <span className="block w-3 h-1 rounded-full bg-[#38bdf8]" />
              <span className="block w-full h-1 rounded-full bg-zinc-400" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (key === 'block-pricing-tiers') {
    return (
      <div className="w-full h-12 rounded-sm bg-[#111115] border border-[#27272d] p-1.5 grid grid-cols-3 gap-1 items-end">
        {[false, true, false].map((feat, i) => (
          <div
            key={i}
            className={`rounded-sm p-1 flex flex-col justify-between ${
              feat ? 'h-9 bg-[#161b26] border border-[#0d99ff]' : 'h-8 bg-[#18181c] border border-[#2c2c32]'
            }`}
          >
            <span className={`block w-6 h-1 rounded-full ${feat ? 'bg-[#38bdf8]' : 'bg-zinc-400'}`} />
            <span className={`block w-full h-1.5 rounded-sm ${feat ? 'bg-[#0d99ff]' : 'bg-zinc-600'}`} />
          </div>
        ))}
      </div>
    );
  }
  if (key === 'block-stats-kpi') {
    return (
      <div className="w-full h-11 rounded-sm bg-[#141418] border border-[#27272d] p-1.5 grid grid-cols-4 gap-1">
        {['120+', '%99', '18ms', '45K'].map((v) => (
          <div key={v} className="rounded-sm bg-[#1b1b21] border border-[#2c2c32] flex flex-col items-center justify-center">
            <span className="text-[7px] font-bold text-[#38bdf8] leading-none">{v}</span>
            <span className="w-4 h-0.5 rounded-full bg-zinc-500 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  // 5. ATOMIC FALLBACK THUMBNAILS
  const bg =
    el.style?.background ||
    el.style?.backgroundColor ||
    (el.fillType === 'gradient' && el.gradient
      ? `linear-gradient(${el.gradient.angle}deg, ${el.gradient.color1}, ${el.gradient.color2})`
      : el.fillColor) ||
    '#1e293b';

  if (t === 'img') {
    return (
      <img
        src={el.attrs?.src || el.imageUrl}
        alt={asset.name}
        className="w-full h-full object-cover rounded-sm"
      />
    );
  }
  if (t === 'button' || t === 'a') {
    return (
      <div
        style={{
          background: bg,
          color: el.style?.color || el.textColor || '#ffffff',
          borderRadius: el.style?.borderRadius || `${el.borderRadius ?? 8}px`,
          border: el.style?.border || '1px solid rgba(255,255,255,0.12)',
        }}
        className="px-3 py-1 text-[10px] font-semibold shadow-sm truncate max-w-[90%]"
      >
        {el.textContent || el.content || asset.name}
      </div>
    );
  }
  if (t === 'h1' || t === 'h2' || t === 'p' || t === 'text') {
    return (
      <div
        style={{
          color: el.style?.color && el.style.color !== '#0f172a' ? el.style.color : '#e2e8f0',
          fontWeight: el.style?.fontWeight || '700',
        }}
        className="text-[11px] text-center line-clamp-2 px-2 leading-tight"
      >
        {el.textContent || el.content || asset.name}
      </div>
    );
  }
  if (t === 'span' || t === 'badge') {
    return (
      <span
        style={{
          background: bg,
          color: el.style?.color || el.textColor || '#38bdf8',
          borderRadius: el.style?.borderRadius || '999px',
          border: el.style?.border || '1px solid rgba(255,255,255,0.1)',
        }}
        className="px-2.5 py-0.5 text-[10px] font-semibold truncate max-w-[90%]"
      >
        {el.textContent || el.content || asset.name}
      </span>
    );
  }
  return (
    <div
      style={{
        background: bg,
        borderRadius: el.style?.borderRadius || `${el.borderRadius ?? 8}px`,
        border: el.style?.border || '1px solid rgba(255,255,255,0.12)',
      }}
      className="w-4/5 h-10 flex items-center justify-center shadow-inner"
    >
      <span className="text-[9px] font-mono text-white/80 truncate px-2">
        &lt;{t}&gt;
      </span>
    </div>
  );
}
