import React, { useState } from 'react';
import {
  LayoutGrid, Plus, Trash2, Pin, Palette, Link as LinkIcon,
  Type, Image as ImageIcon, Layers, ChevronRight, MousePointerClick, Sliders
} from 'lucide-react';
import { updateNodeInTree, distributeChildrenInContainer } from '../utils/treeUtils';
import {
  BLOCK_THEME_PRESETS,
  findOwningBlock,
  extractBlockInspectorModel,
  applyBlockThemePreset,
  addNavbarLinkItem,
  removeBlockChildById,
  addSliderSlideItem,
  removeSliderSlideItem,
} from '../utils/blockCustomizerUtils';

const KIND_LABELS = {
  navbar: 'Navbar Özelleştirici',
  footer: 'Footer Özelleştirici',
  slider: 'Slider / Karusel Editörü',
  section: 'Bölüm / İçerik Bloğu',
};

/**
 * Contextual block-level inspector tailored for Navbars, Footers, Sliders, and Content Blocks.
 * Allows editing brand text, navigation links, CTAs, slides, images, and cohesive color themes
 * directly from the right panel without hunting deeply through child coordinates.
 */
export default function BlockCustomizer({
  elements = [],
  selectedElement,
  onSelectElement,
  onUpdateElementDirect,
  onUpdateResolvedElements,
}) {
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkHref, setNewLinkHref] = useState('#');

  const blockMatch = selectedElement ? findOwningBlock(elements, selectedElement.id) : null;
  if (!blockMatch) {
    return (
      <div className="p-4 text-[11px] text-zinc-400 space-y-2">
        <div className="p-3 rounded border border-[#27272d] bg-[#18181b] leading-relaxed">
          Bu öğe tekil bir yapı taşıdır. Hazır içerik blokları (Navbar, Footer, Slider veya Bölüm) seçtiğinizde akıllı bileşen kontrolleri burada görünür.
        </div>
      </div>
    );
  }

  const { blockNode, blockKind, isAncestor } = blockMatch;
  const model = extractBlockInspectorModel(blockNode);

  const commitBlockTransform = (transformer) => {
    const nextBlock = transformer(blockNode);
    const nextTree = updateNodeInTree(elements, blockNode.id, () => nextBlock);
    if (onUpdateResolvedElements) {
      onUpdateResolvedElements(nextTree);
    }
  };

  const handleUpdateChildNode = (nodeId, updates) => {
    if (onUpdateElementDirect) {
      onUpdateElementDirect(nodeId, updates);
    }
  };

  const handleUpdateChildStyle = (nodeId, stylePatch) => {
    handleUpdateChildNode(nodeId, (prevNode) => {
      const nextStyle = { ...(prevNode?.style || {}), ...stylePatch };
      Object.keys(stylePatch).forEach((k) => {
        if (stylePatch[k] === undefined) delete nextStyle[k];
      });
      return { style: nextStyle };
    });
  };

  const handleUpdateChildAttrs = (nodeId, attrsPatch, extraNodePatch = {}) => {
    handleUpdateChildNode(nodeId, (prevNode) => ({
      ...extraNodePatch,
      attrs: { ...(prevNode?.attrs || {}), ...attrsPatch },
    }));
  };

  const handleAddNavLink = (e) => {
    e?.preventDefault?.();
    const label = newLinkLabel.trim() || `Bağlantı ${model.linkNodes.length + 1}`;
    const href = newLinkHref.trim() || '#';
    commitBlockTransform((node) => addNavbarLinkItem(node, label, href));
    setNewLinkLabel('');
    setNewLinkHref('#');
  };

  const currentSlide = model.slides[model.activeSlideIndex] || model.slides[0] || null;
  const blockBgSafe = (model.theme.background || '').startsWith('#') ? model.theme.background : '#18181b';

  return (
    <div className="p-3 space-y-3 overflow-y-auto flex-1 select-none">
      {/* Contextual Block Header */}
      <div className="p-2.5 rounded border border-[#0d99ff]/35 bg-[#0d99ff]/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <LayoutGrid size={13} className="text-[#38bdf8] shrink-0" />
            <span className="text-[11px] font-bold text-zinc-100 truncate">
              {KIND_LABELS[blockKind] || 'Bileşen'}
            </span>
          </div>
          {isAncestor && (
            <button
              type="button"
              onClick={() => onSelectElement?.(blockNode.id)}
              className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#222228] text-[#38bdf8] border border-[#2c2c34] text-[10px] font-semibold shrink-0"
              title="Ana kapsayıcı bloğu seç"
            >
              Kökünü Seç
            </button>
          )}
        </div>
        <div className="text-[10px] text-zinc-400 truncate font-medium">
          Aktif Blok: <span className="text-zinc-200">{model.blockName}</span>
        </div>

        {/* One-Click Theme Swatches */}
        <div className="pt-1 border-t border-white/10">
          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1.5">
            Hızlı Tema & Kontrast
          </span>
          <div className="grid grid-cols-5 gap-1">
            {BLOCK_THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => commitBlockTransform((n) => applyBlockThemePreset(n, preset.id))}
                title={preset.label}
                className="flex flex-col items-center gap-1 p-1 rounded bg-[#101013] hover:bg-[#1c1c22] border border-[#27272d] hover:border-[#0d99ff]/50 transition-colors"
              >
                <span
                  className="w-full h-3 rounded-sm border border-white/15 flex items-center justify-end pr-0.5"
                  style={{ background: preset.previewBg }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: preset.previewAccent }} />
                </span>
                <span className="text-[8.5px] text-zinc-300 truncate w-full text-center">{preset.shortLabel || preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Block Geometry & Quick Behavior */}
      <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Palette size={11} className="text-[#0d99ff]" />
          <span>Blok Yapısı & Arka Plan</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 bg-[#101013] px-2 py-1 rounded border border-[#2c2c32] flex items-center gap-1.5">
            <input
              type="color"
              value={blockBgSafe}
              onChange={(e) => {
                const nextBg = e.target.value;
                const prevStyle = { ...(blockNode.style || {}) };
                delete prevStyle.background;
                handleUpdateChildNode(blockNode.id, { style: { ...prevStyle, backgroundColor: nextBg } });
              }}
              className="w-4 h-4 rounded cursor-pointer bg-transparent shrink-0"
              title="Arka Plan Rengi"
            />
            <input
              type="text"
              value={model.theme.background}
              onChange={(e) => {
                const v = e.target.value;
                const prevStyle = { ...(blockNode.style || {}) };
                if (v.includes('gradient')) {
                  prevStyle.background = v;
                  delete prevStyle.backgroundColor;
                } else {
                  delete prevStyle.background;
                  prevStyle.backgroundColor = v;
                }
                handleUpdateChildNode(blockNode.id, { style: prevStyle });
              }}
              className="flex-1 min-w-0 bg-transparent text-[10px] font-mono text-zinc-100 focus:outline-none"
            />
          </div>
          <div className="min-w-0 bg-[#101013] px-2 py-1 rounded border border-[#2c2c32] flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-500 font-semibold shrink-0">H</span>
            <input
              type="number"
              min="36"
              value={model.theme.height}
              onChange={(e) => handleUpdateChildNode(blockNode.id, { height: Math.max(36, Number(e.target.value) || 36) })}
              className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-zinc-100 focus:outline-none tabular-nums"
            />
            <span className="text-[9px] text-zinc-500 shrink-0">px</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {blockKind === 'navbar' && (
            <button
              type="button"
              onClick={() => handleUpdateChildNode(blockNode.id, {
                positionMode: model.theme.sticky ? 'normal' : 'sticky',
                zIndex: model.theme.sticky ? (blockNode.zIndex || 2) : 100,
              })}
              className={`flex-1 py-1.5 px-2 rounded border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                model.theme.sticky
                  ? 'bg-[#0d99ff]/15 text-[#38bdf8] border-[#0d99ff]/45'
                  : 'bg-[#101013] text-zinc-300 border-[#2c2c32] hover:border-zinc-500'
              }`}
            >
              <Pin size={11} />
              <span>{model.theme.sticky ? 'Üstte Sabit (Sticky)' : 'Normal Akış'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const distributed = distributeChildrenInContainer([blockNode], blockNode.id, 'space-between');
              if (onUpdateResolvedElements && distributed?.[0]) {
                onUpdateResolvedElements(updateNodeInTree(elements, blockNode.id, () => distributed[0]));
              }
            }}
            className="flex-1 py-1.5 px-2 rounded bg-[#101013] hover:bg-[#222228] text-zinc-300 border border-[#2c2c32] text-[10px] font-medium"
            title="Alt öğeleri yatayda eşit dağıt"
          >
            Öğeleri İki Yana Dağıt
          </button>
        </div>
      </div>

      {/* Interactive Slider Controls */}
      {blockKind === 'slider' && model.slides.length > 0 && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-1">
              <Layers size={11} />
              <span>Slaytlar ({model.slides.length})</span>
            </span>
            <button
              type="button"
              onClick={() => commitBlockTransform((n) => addSliderSlideItem(n))}
              className="px-2 py-0.5 rounded bg-[#0d99ff] hover:bg-[#0088ee] text-white text-[10px] font-semibold flex items-center gap-1"
            >
              <Plus size={10} />
              <span>Slayt Ekle</span>
            </button>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {model.slides.map((sl) => (
              <button
                key={sl.id}
                type="button"
                onClick={() => handleUpdateChildNode(blockNode.id, {
                  sliderConfig: { ...(blockNode.sliderConfig || {}), activeSlideIndex: sl.index },
                })}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                  model.activeSlideIndex === sl.index
                    ? 'bg-[#0d99ff] text-white border-[#0d99ff]'
                    : 'bg-[#101013] text-zinc-400 border-[#2c2c32] hover:text-white'
                }`}
              >
                Slayt {sl.index + 1}
              </button>
            ))}
          </div>

          {currentSlide && (
            <div className="p-2 rounded bg-[#101013] border border-[#2c2c32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-200">{currentSlide.name}</span>
                {model.slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => commitBlockTransform((n) => removeSliderSlideItem(n, currentSlide.id))}
                    className="text-zinc-500 hover:text-rose-400 p-0.5"
                    title="Bu slaytı sil"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              {currentSlide.titleNode && (
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-0.5">Slayt Başlığı</label>
                  <input
                    type="text"
                    value={currentSlide.titleNode.text}
                    onChange={(e) => handleUpdateChildNode(currentSlide.titleNode.id, { textContent: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#2c2c34] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>
              )}
              {currentSlide.descNode && (
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-0.5">Slayt Açıklaması</label>
                  <textarea
                    rows={2}
                    value={currentSlide.descNode.text}
                    onChange={(e) => handleUpdateChildNode(currentSlide.descNode.id, { textContent: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#2c2c34] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff] resize-none"
                  />
                </div>
              )}
              {currentSlide.ctaNode && (
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-0.5">Slayt Butonu</label>
                  <input
                    type="text"
                    value={currentSlide.ctaNode.text}
                    onChange={(e) => handleUpdateChildNode(currentSlide.ctaNode.id, { textContent: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#2c2c34] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>
              )}
              {currentSlide.imgNode && (
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-0.5">Görsel URL</label>
                  <input
                    type="text"
                    value={currentSlide.imgNode.src}
                    onChange={(e) => handleUpdateChildAttrs(currentSlide.imgNode.id, { src: e.target.value }, { imageUrl: e.target.value })}
                    className="w-full bg-[#18181b] border border-[#2c2c34] rounded px-2 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>
              )}

              {currentSlide.extraTexts?.length > 0 && (
                <div className="pt-1 border-t border-[#27272d] space-y-1.5">
                  <label className="text-[9px] text-zinc-400 font-semibold block">
                    Slayt Kart Metinleri ({currentSlide.extraTexts.length})
                  </label>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {currentSlide.extraTexts.map((txt) => (
                      <div key={txt.id} className="bg-[#18181b] border border-[#27272d] rounded p-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-zinc-500">
                          <span className="truncate font-medium">{txt.name}</span>
                          <button
                            type="button"
                            onClick={() => onSelectElement?.(txt.id)}
                            className="text-[#38bdf8] hover:underline shrink-0"
                          >
                            &lt;{txt.tag}&gt; seç
                          </button>
                        </div>
                        <input
                          type="text"
                          value={txt.text}
                          onChange={(e) => handleUpdateChildNode(txt.id, { textContent: e.target.value })}
                          className="w-full bg-[#101013] border border-[#2c2c34] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentSlide.extraImages?.length > 0 && (
                <div className="pt-1 border-t border-[#27272d] space-y-1.5">
                  <label className="text-[9px] text-zinc-400 font-semibold block">
                    Diğer Slayt Görselleri ({currentSlide.extraImages.length})
                  </label>
                  {currentSlide.extraImages.map((img) => (
                    <div key={img.id} className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 block truncate">{img.name}</span>
                      <input
                        type="text"
                        value={img.src}
                        onChange={(e) => handleUpdateChildAttrs(img.id, { src: e.target.value }, { imageUrl: e.target.value })}
                        className="w-full bg-[#18181b] border border-[#2c2c34] rounded px-2 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0d99ff]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Brand / Logo Field (Navbar & Footer) */}
      {model.brandNode && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Type size={11} className="text-[#0d99ff]" />
              <span>Marka / Logo Metni</span>
            </span>
            <button
              type="button"
              onClick={() => onSelectElement?.(model.brandNode.id)}
              className="text-[9px] text-[#38bdf8] hover:underline"
            >
              Katmana Git
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={model.brandNode.text}
              onChange={(e) => handleUpdateChildNode(model.brandNode.id, { textContent: e.target.value })}
              className="flex-1 min-w-0 bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
            />
            <input
              type="color"
              value={(model.brandNode.color || '').startsWith('#') ? model.brandNode.color : '#ffffff'}
              onChange={(e) => handleUpdateChildStyle(model.brandNode.id, { color: e.target.value })}
              className="w-7 h-7 rounded border border-[#2c2c32] bg-[#101013] cursor-pointer p-0.5 shrink-0"
              title="Marka Yazı Rengi"
            />
          </div>
        </div>
      )}

      {/* Navigation / Footer Links Editor */}
      {(blockKind === 'navbar' || model.linkNodes.length > 0) && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <LinkIcon size={11} className="text-[#0d99ff]" />
              <span>Menü Bağlantıları ({model.linkNodes.length})</span>
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {model.linkNodes.map((lnk) => (
              <div key={lnk.id} className="bg-[#101013] border border-[#27272d] rounded p-1.5 flex items-center gap-1">
                <input
                  type="text"
                  value={lnk.text}
                  onChange={(e) => handleUpdateChildNode(lnk.id, { textContent: e.target.value })}
                  placeholder="Link Adı"
                  className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-100 focus:outline-none px-1"
                />
                <input
                  type="text"
                  value={lnk.href}
                  onChange={(e) => handleUpdateChildAttrs(lnk.id, { href: e.target.value })}
                  placeholder="#hedef"
                  className="w-20 shrink-0 bg-[#18181b] border border-[#27272d] rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-[#0d99ff]"
                />
                <input
                  type="color"
                  value={(lnk.color || '').startsWith('#') ? lnk.color : '#d4d4d8'}
                  onChange={(e) => handleUpdateChildStyle(lnk.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent shrink-0"
                  title="Link Rengi"
                />
                <button
                  type="button"
                  onClick={() => onSelectElement?.(lnk.id)}
                  className="p-1 text-zinc-500 hover:text-[#38bdf8]"
                  title="Öğeyi seç"
                >
                  <ChevronRight size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => commitBlockTransform((n) => removeBlockChildById(n, lnk.id))}
                  className="p-1 text-zinc-500 hover:text-rose-400"
                  title="Linki kaldır"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {blockKind === 'navbar' && (
            <form onSubmit={handleAddNavLink} className="pt-1 border-t border-[#27272d] flex items-center gap-1">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Yeni link..."
                className="flex-1 min-w-0 bg-[#101013] border border-[#2c2c32] rounded px-2 py-1 text-[10px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
              />
              <input
                type="text"
                value={newLinkHref}
                onChange={(e) => setNewLinkHref(e.target.value)}
                placeholder="#url"
                className="w-16 shrink-0 bg-[#101013] border border-[#2c2c32] rounded px-1.5 py-1 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-[#0d99ff]"
              />
              <button
                type="submit"
                className="px-2 py-1 rounded bg-[#0d99ff] hover:bg-[#0088ee] text-white text-[10px] font-semibold flex items-center gap-0.5 shrink-0"
              >
                <Plus size={10} />
                <span>Ekle</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* CTA Buttons Editor */}
      {model.ctaNodes.length > 0 && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <MousePointerClick size={11} className="text-[#0d99ff]" />
            <span>Aksiyon Butonları ({model.ctaNodes.length})</span>
          </span>
          <div className="space-y-1.5">
            {model.ctaNodes.map((btn) => (
              <div key={btn.id} className="bg-[#101013] border border-[#27272d] rounded p-1.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={btn.text}
                  onChange={(e) => handleUpdateChildNode(btn.id, { textContent: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-100 focus:outline-none px-1"
                />
                <input
                  type="color"
                  value={(btn.bg || '').startsWith('#') ? btn.bg : '#0d99ff'}
                  onChange={(e) => handleUpdateChildStyle(btn.id, { backgroundColor: e.target.value, background: undefined })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent shrink-0"
                  title="Buton Arka Planı"
                />
                <input
                  type="color"
                  value={(btn.color || '').startsWith('#') ? btn.color : '#ffffff'}
                  onChange={(e) => handleUpdateChildStyle(btn.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent shrink-0"
                  title="Buton Yazı Rengi"
                />
                <button
                  type="button"
                  onClick={() => onSelectElement?.(btn.id)}
                  className="p-1 text-zinc-500 hover:text-[#38bdf8]"
                  title="Butonu ayrıntılı düzenle"
                >
                  <Sliders size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Texts & Headings (Hero / Features / FAQ / Cards / Footer Copyright) */}
      {model.textNodes.length > 0 && blockKind !== 'slider' && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Type size={11} className="text-[#0d99ff]" />
            <span>Bölüm Metinleri</span>
          </span>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
            {model.textNodes.map((txt) => (
              <div key={txt.id} className="bg-[#101013] border border-[#27272d] rounded p-1.5 space-y-1">
                <div className="flex items-center justify-between text-[9px] text-zinc-500">
                  <span className="truncate font-medium">{txt.name}</span>
                  <button
                    type="button"
                    onClick={() => onSelectElement?.(txt.id)}
                    className="text-[#38bdf8] hover:underline shrink-0"
                  >
                    &lt;{txt.tag}&gt; seç
                  </button>
                </div>
                <input
                  type="text"
                  value={txt.text}
                  onChange={(e) => handleUpdateChildNode(txt.id, { textContent: e.target.value })}
                  className="w-full bg-[#18181b] border border-[#27272d] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input / Search / Form Fields inside Block */}
      {model.inputNodes?.length > 0 && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Sliders size={11} className="text-[#0d99ff]" />
            <span>Giriş Alanları ({model.inputNodes.length})</span>
          </span>
          <div className="space-y-1.5">
            {model.inputNodes.map((inp) => (
              <div key={inp.id} className="bg-[#101013] border border-[#27272d] rounded p-1.5 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span className="truncate font-medium">{inp.name}</span>
                  <button
                    type="button"
                    onClick={() => onSelectElement?.(inp.id)}
                    className="text-[#38bdf8] hover:underline shrink-0"
                  >
                    &lt;{inp.tag}&gt; seç
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inp.placeholder}
                    onChange={(e) => handleUpdateChildAttrs(inp.id, { placeholder: e.target.value })}
                    placeholder="Placeholder metni..."
                    aria-label={`${inp.name} placeholder`}
                    className="flex-1 min-w-0 bg-[#18181b] border border-[#27272d] rounded px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#0d99ff]"
                  />
                  {inp.tag === 'input' && (
                    <select
                      value={inp.inputType}
                      onChange={(e) => handleUpdateChildAttrs(inp.id, { type: e.target.value })}
                      aria-label={`${inp.name} tipi`}
                      className="w-20 shrink-0 bg-[#18181b] border border-[#27272d] rounded px-1.5 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0d99ff]"
                    >
                      <option value="text">text</option>
                      <option value="search">search</option>
                      <option value="email">email</option>
                      <option value="tel">tel</option>
                      <option value="url">url</option>
                      <option value="number">number</option>
                      <option value="password">password</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Images inside Block */}
      {model.imageNodes.length > 0 && blockKind !== 'slider' && (
        <div className="bg-[#18181b] p-2.5 rounded border border-[#27272d] space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <ImageIcon size={11} className="text-[#0d99ff]" />
            <span>Görseller ({model.imageNodes.length})</span>
          </span>
          <div className="space-y-1.5">
            {model.imageNodes.map((img) => (
              <div key={img.id} className="bg-[#101013] border border-[#27272d] rounded p-1.5 space-y-1">
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span className="truncate">{img.name}</span>
                  <button
                    type="button"
                    onClick={() => onSelectElement?.(img.id)}
                    className="text-[#38bdf8] hover:underline"
                  >
                    Seç
                  </button>
                </div>
                <input
                  type="text"
                  value={img.src}
                  onChange={(e) => handleUpdateChildAttrs(img.id, { src: e.target.value }, { imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#18181b] border border-[#27272d] rounded px-2 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0d99ff]"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
