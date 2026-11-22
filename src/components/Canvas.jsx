import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, Search, Compass, ChevronDown, ChevronRight, 
  MoveVertical, ShieldAlert, Group, Ungroup, CornerDownRight, RefreshCw,
  FolderOpen, Zap, ArrowDownToLine, Pin, Lock, Sparkles,
  CopyPlus, Paintbrush, Copy, Scissors, Clipboard, Trash2, EyeOff,
  Maximize2, Grid3x3, Ruler, ArrowUpToLine, AlignCenterHorizontal,
  AlignCenterVertical, Frame as FrameIcon, Video as VideoIcon
} from 'lucide-react';
import { 
  getNodePath, 
  getAbsoluteCoords, 
  findNodeAndParent, 
  canHaveChildren, 
  isExplicitContainer,
  flattenTree 
} from '../utils/treeUtils';
import { 
  MIN_ELEMENT_SIZE,
  MIN_MULTI_SIZE,
  getDescendantIds,
  computeDragSnap,
  computeResizeSnap,
} from '../utils/snapUtils';
import {
  resolveSelectionTarget,
  resolveDoubleClickAction,
  getScopeChildren,
  shouldAllowDragUnparent,
  getAutoContrastTextColor,
} from '../utils/selectionUtils';
import { createTagElement } from '../data/tagRegistry';
import { resolveWheelPanDelta, clampCanvasZoom } from '../utils/canvasInputUtils';
import {
  resolveDrawnBox,
  computeAltMeasureGuides,
  sampleColorAtClientPoint,
} from '../utils/canvasToolsUtils';

/**
 * 🌟 RECURSIVE CANVAS NODE COMPONENT
 * Renders an element and recursively renders all of its children inside it.
 * Child coordinates (x, y) are relative to their parent container.
 */
function CanvasNode({
  node,
  depth = 0,
  elements,
  selectedIds,
  editingGroupId,
  hoveredCandidateId,
  dropTargetContainerId,
  onNodeMouseDown,
  onNodeDoubleClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  editingTextNodeId,
  setEditingTextNodeId,
  onUpdateElementText,
  onCommitHistory,
  previewMode,
  previewRuntimeOverrides = {},
  onPreviewExecuteEvent = null,
  onPreviewInputChange = null,
  viewportMode,
  canvasSettings,
  isPreviewGhost = false,
  interactionCursor = null,
  parentSliderState = null,
  parentAccordionOpen = null,
  accordionDeltaY = 0,
  accordionResolvedOpen = null,
  accordionResolvedHeight = null,
  aiHighlightedIds = []
}) {
  const runtimePatch = previewMode ? (previewRuntimeOverrides[node.id] || null) : null;
  const effectiveNode = runtimePatch
    ? {
        ...node,
        ...runtimePatch,
        style: { ...(node.style || {}), ...(runtimePatch.style || {}) },
        attrs: {
          ...(node.attrs || {}),
          ...(runtimePatch.value !== undefined ? { value: runtimePatch.value } : {}),
        },
      }
    : node;

  const ownSliderActiveIndex = effectiveNode.sliderConfig
    ? Number(runtimePatch?.activeSlideIndex ?? effectiveNode.sliderConfig.activeSlideIndex ?? 0)
    : null;
  const nextSliderState = ownSliderActiveIndex !== null
    ? { sliderId: node.id, activeSlideIndex: ownSliderActiveIndex, totalSlides: effectiveNode.sliderConfig.totalSlides || 1 }
    : parentSliderState;
  const isActiveSliderDot =
    effectiveNode.sliderRole === 'dot' &&
    nextSliderState &&
    Number(effectiveNode.slideIndex ?? 0) === Number(nextSliderState.activeSlideIndex ?? 0);

  const ownAccordionOpen = effectiveNode.accordionRole === 'item'
    ? (accordionResolvedOpen !== null
        ? accordionResolvedOpen
        : (runtimePatch?.accordionOpen !== undefined
            ? Boolean(runtimePatch.accordionOpen)
            : Boolean(effectiveNode.accordionOpen)))
    : null;

  if (effectiveNode.isHidden) return null;
  if (effectiveNode.accordionRole === 'panel' && parentAccordionOpen === false) return null;

  const isSelected = !isPreviewGhost && selectedIds.includes(node.id) && !previewMode;
  const isCandidate = !isPreviewGhost && hoveredCandidateId === node.id && !isSelected && !previewMode;
  const isInEditingScope = !isPreviewGhost && editingGroupId === node.id && !previewMode;
  const isDropTarget = !isPreviewGhost && dropTargetContainerId === node.id && !previewMode;
  const isAiHighlighted = !isPreviewGhost && !previewMode && aiHighlightedIds.includes(node.id);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  // Border radius computation
  let borderRadiusCss = effectiveNode.style?.borderRadius || `${effectiveNode.borderRadius || 0}px`;
  if (effectiveNode.borderRadiusType === 'custom' && effectiveNode.borderRadiusCorners) {
    const { tl, tr, br, bl } = effectiveNode.borderRadiusCorners;
    borderRadiusCss = `${tl}px ${tr}px ${br}px ${bl}px`;
  }

  // Fill computation: Style / Solid / Gradient
  let backgroundCss = effectiveNode.style?.background || effectiveNode.style?.backgroundColor || effectiveNode.fillColor || 'transparent';
  if (effectiveNode.fillType === 'gradient' && effectiveNode.gradient) {
    backgroundCss = `linear-gradient(${effectiveNode.gradient.angle || 90}deg, ${effectiveNode.gradient.color1 || '#d4af37'}, ${effectiveNode.gradient.color2 || '#2c2523'})`;
  }

  // Border computation
  let borderStyleObj = {};
  if (effectiveNode.style?.border) {
    borderStyleObj.border = effectiveNode.style.border;
  } else if (effectiveNode.style?.borderWidth) {
    borderStyleObj.border = `${effectiveNode.style.borderWidth} ${effectiveNode.style.borderStyle || 'solid'} ${effectiveNode.style.borderColor || '#38322c'}`;
  } else if (effectiveNode.borderWidth) {
    borderStyleObj.border = `${effectiveNode.borderWidth}px ${effectiveNode.borderStyle || 'solid'} ${effectiveNode.borderColor || '#000'}`;
  }

  // Side-specific borders
  if (effectiveNode.style?.borderTop) borderStyleObj.borderTop = effectiveNode.style.borderTop;
  if (effectiveNode.style?.borderBottom) borderStyleObj.borderBottom = effectiveNode.style.borderBottom;
  if (effectiveNode.style?.borderLeft) borderStyleObj.borderLeft = effectiveNode.style.borderLeft;
  if (effectiveNode.style?.borderRight) borderStyleObj.borderRight = effectiveNode.style.borderRight;

  const shadowCss = effectiveNode.style?.boxShadow || (effectiveNode.shadow !== 'none' ? effectiveNode.shadow : 'none');

  const isSticky = effectiveNode.positionMode === 'sticky';
  const isFixed = effectiveNode.positionMode === 'fixed';

  // Responsive clamping only during device preview mode (keeps free resizing in editor)
  const nodeWidth = (previewMode && depth === 0 && canvasSettings?.width)
    ? Math.min(effectiveNode.width, canvasSettings.width)
    : effectiveNode.width;

  let previewContainerExtraH = 0;
  if (hasChildren) {
    let accOffset = 0;
    node.children.forEach((ch) => {
      if (ch.accordionRole === 'item') {
        const chPatch = previewMode ? previewRuntimeOverrides[ch.id] : null;
        const chOpen = chPatch?.accordionOpen !== undefined ? Boolean(chPatch.accordionOpen) : Boolean(ch.accordionOpen);
        const chCollapsed = Number(ch.accordionCollapsedHeight) || 58;
        const chExpanded = Number(ch.accordionExpandedHeight) || 108;
        const chTargetH = chOpen ? chExpanded : chCollapsed;
        const chBaseH = Number(ch.height) || chTargetH;
        accOffset += (chTargetH - chBaseH);
      }
    });
    previewContainerExtraH = Math.max(0, accOffset);
  }

  const resolvedNodeY = (Number(effectiveNode.y) || 0) + (Number(accordionDeltaY) || 0);
  const resolvedNodeHeight = (accordionResolvedHeight ?? effectiveNode.height) + previewContainerExtraH;

  let positionStyle = {
    position: 'absolute',
    left: `${effectiveNode.x}px`,
    top: `${resolvedNodeY}px`,
    width: `${nodeWidth}px`,
    height: `${resolvedNodeHeight}px`,
    zIndex: effectiveNode.zIndex || (isSticky || isFixed ? 100 : depth + 1),
  };

  if (previewMode && isSticky) {
    positionStyle = {
      ...positionStyle,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    };
  }

  const tagType = (effectiveNode.type || 'div').toLowerCase();
  const isPureTextNode = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'text', 'badge'].includes(tagType);
  const hasInteractiveClick =
    previewMode &&
    !isPreviewGhost &&
    (tagType === 'button' ||
      tagType === 'a' ||
      (effectiveNode.events?.onClick && effectiveNode.events.onClick.mode && effectiveNode.events.onClick.mode !== 'none'));

  const styleOpacityRaw = effectiveNode.style?.opacity;
  const baseOpacity = styleOpacityRaw !== undefined && styleOpacityRaw !== '' && !Number.isNaN(parseFloat(styleOpacityRaw))
    ? Math.max(0, Math.min(1, parseFloat(styleOpacityRaw)))
    : ((effectiveNode.opacity ?? 100) / 100);
  const rootOpacity = baseOpacity * (isPreviewGhost && depth === 0 ? 0.72 : 1);

  const extraNodeStyle = effectiveNode.style && typeof effectiveNode.style === 'object' ? { ...effectiveNode.style } : {};
  delete extraNodeStyle.position;
  delete extraNodeStyle.left;
  delete extraNodeStyle.top;
  delete extraNodeStyle.width;
  delete extraNodeStyle.height;
  delete extraNodeStyle.zIndex;
  delete extraNodeStyle.margin;
  delete extraNodeStyle.borderWidth;
  delete extraNodeStyle.borderStyle;
  delete extraNodeStyle.borderColor;
  delete extraNodeStyle.border;

  const hoverLineVars = (effectiveNode.animation?.hoverLineColor || effectiveNode.animation?.hoverLineHeight || effectiveNode.animation?.hoverLineDuration)
    ? {
        '--craft-line-color': effectiveNode.animation.hoverLineColor || '#fbbf24',
        '--craft-line-height': `${effectiveNode.animation.hoverLineHeight || 2}px`,
        '--craft-line-duration': `${effectiveNode.animation.hoverLineDuration || 0.28}s`,
      }
    : {};

  const hasHoverUnderline = Boolean(effectiveNode.animation?.hoverClassName && effectiveNode.animation.hoverClassName.includes('hover-'));
  const resolvedOverflow = effectiveNode.style?.overflow || (hasChildren || hasHoverUnderline || isPureTextNode ? 'visible' : 'hidden');

  return (
    <div
      id={isPreviewGhost ? undefined : `canvas-el-${node.id}`}
      data-element-id={isPreviewGhost ? undefined : node.id}
      onMouseDown={isPreviewGhost || previewMode ? undefined : (e) => onNodeMouseDown(e, node)}
      onDoubleClick={isPreviewGhost || previewMode ? undefined : (e) => onNodeDoubleClick(e, node)}
      onMouseEnter={isPreviewGhost || previewMode ? undefined : (e) => onNodeMouseEnter(e, node)}
      onMouseLeave={isPreviewGhost || previewMode ? undefined : (e) => onNodeMouseLeave(e, node)}
      onClick={hasInteractiveClick ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPreviewExecuteEvent?.(effectiveNode);
      } : undefined}
      style={{
        ...extraNodeStyle,
        ...hoverLineVars,
        ...positionStyle,
        background: backgroundCss,
        borderRadius: borderRadiusCss,
        ...borderStyleObj,
        boxShadow: shadowCss,
        opacity: isActiveSliderDot ? 1 : rootOpacity,
        transform: isActiveSliderDot ? 'scale(1.22)' : extraNodeStyle.transform,
        transition: effectiveNode.sliderRole === 'dot' ? 'all 0.2s ease' : extraNodeStyle.transition,
        pointerEvents: isPreviewGhost ? 'none' : undefined,
        cursor: hasInteractiveClick
          ? 'pointer'
          : interactionCursor
            ? (node.isLocked && interactionCursor === 'copy' ? 'grab' : interactionCursor)
            : (extraNodeStyle.cursor || undefined),
        display: effectiveNode.style?.display || 'flex',
        alignItems: effectiveNode.style?.alignItems || (isPureTextNode || tagType === 'button' ? 'center' : 'flex-start'),
        justifyContent: effectiveNode.style?.justifyContent || (tagType === 'button' ? 'center' : 'flex-start'),
        flexDirection: effectiveNode.style?.flexDirection || 'column',
        padding: effectiveNode.style?.padding || undefined,
        overflow: resolvedOverflow,
        boxSizing: 'border-box',
      }}
      className={`relative select-none transition-shadow ${
        isPreviewGhost && depth === 0
          ? 'outline outline-2 outline-dashed outline-emerald-400'
          : isDropTarget 
            ? 'ring-2 ring-blue-500 bg-blue-500/15' 
            : isAiHighlighted
              ? 'ring-2 ring-cyan-400 shadow-[0_0_28px_rgba(56,189,248,0.45)]'
              : isInEditingScope
                ? 'outline outline-2 outline-dashed outline-indigo-400/90'
                : isCandidate 
                  ? 'outline outline-1.5 outline-sky-400 outline-offset-1' 
                  : isSelected && selectedIds.length > 1
                    ? 'outline-1 outline-blue-400 outline-dashed'
                    : ''
      } ${effectiveNode.animation?.className || ''} ${effectiveNode.animation?.hoverClassName || ''}`}
    >
      {/* Visual Position & Group Badges (Show on Hover, Selection, Scope, AI Highlight, or Drop-target only) */}
      {!previewMode && (isSelected || isCandidate || isDropTarget || isInEditingScope || isAiHighlighted) && (
        <div className="absolute -top-5 left-1 flex items-center gap-1 pointer-events-none z-30">
          {isAiHighlighted && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider bg-cyan-500 text-slate-950 shadow-md inline-flex items-center gap-1 animate-pulse">
              <Sparkles size={9} />
              <span>AI Yeniledi</span>
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider border shadow-sm inline-flex items-center gap-1 ${
            isInEditingScope
              ? 'bg-[#6366f1] text-white border-indigo-400/80'
              : isSelected 
                ? 'bg-[#0d99ff] text-white border-[#38bdf8]/80' 
                : isCandidate
                  ? 'bg-[#38bdf8] text-[#09090b] border-sky-200 font-bold'
                  : 'bg-[#18181b]/95 border-[#2c2c32] text-zinc-200'
          }`}>
            {isInEditingScope && <FolderOpen size={9} className="shrink-0" />}
            <span>{isInEditingScope ? `İçinde: <${tagType}>` : `<${tagType}>`}</span>
          </span>
          {isDropTarget && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-[#0d99ff] text-white shadow-sm inline-flex items-center gap-1">
              <ArrowDownToLine size={9} />
              <span>İçine Bırak</span>
            </span>
          )}
          {hasChildren && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-300 bg-[#18181b]/95 border border-[#2c2c32] shadow-sm">
              {node.children.length} alt öğe
            </span>
          )}
          {effectiveNode.events?.onClick?.mode && effectiveNode.events.onClick.mode !== 'none' && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 shadow-sm inline-flex items-center gap-1">
              <Zap size={9} className="text-emerald-400" />
              <span>{effectiveNode.events.onClick.mode === 'function' ? `${effectiveNode.events.onClick.functionName || 'fn'}()` : effectiveNode.events.onClick.mode}</span>
            </span>
          )}
          {(isSticky || isFixed) && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-[#18181b] text-[#38bdf8] border border-[#0d99ff]/50 shadow-sm inline-flex items-center gap-1">
              {isSticky ? <Pin size={9} /> : <Lock size={9} />}
              <span>{isSticky ? 'Sticky' : 'Fixed'}</span>
            </span>
          )}
        </div>
      )}

      {/* 1. NAVBAR / NAV ELEMENT (Clean container or empty helper) */}
      {(tagType === 'navbar' || tagType === 'nav') && (!node.children || node.children.length === 0) && (
        node.textContent ? (
          <div className="w-full h-full px-6 flex items-center text-sm font-medium text-neutral-200">
            {node.textContent}
          </div>
        ) : !previewMode ? (
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-sky-500/30 rounded-lg text-sky-300/75 text-xs font-medium pointer-events-none gap-2 px-4">
            <Compass size={14} className="text-sky-400 shrink-0" />
            <span>Boş Navigasyon Alanı (&lt;nav&gt;) — Buraya logo, linkler veya butonlarınızı yerleştirin</span>
          </div>
        ) : null
      )}

      {/* 2. FOOTER ELEMENT (Clean container or empty helper) */}
      {tagType === 'footer' && (!node.children || node.children.length === 0) && (
        node.textContent ? (
          <div className="w-full h-full p-4 text-xs text-neutral-400">
            {node.textContent}
          </div>
        ) : !previewMode ? (
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-neutral-700 rounded-lg text-neutral-400 text-xs font-medium pointer-events-none gap-2 px-4">
            <span className="text-sm">👣</span>
            <span>Boş Alt Bilgi Alanı (&lt;footer&gt;) — Buraya telif metni, linkler veya iletişim ekleyin</span>
          </div>
        ) : null
      )}

      {/* 3. PRODUCT CARD / ARTICLE ELEMENT (Legacy fallback only if element has no real children) */}
      {(tagType === 'product_card' || (tagType === 'article' && node.productName && (!node.children || node.children.length === 0))) && (
        <div className="w-full h-full flex flex-col justify-between p-3.5 overflow-hidden text-neutral-800 pointer-events-none">
          <div className="relative w-full h-[68%] rounded-xl overflow-hidden bg-neutral-100 mb-2">
            <img
              src={node.productImage || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80'}
              alt={node.productName}
              className="w-full h-full object-cover pointer-events-none"
            />
            {node.productTag && (
              <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow">
                {node.productTag}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-xs text-neutral-900 truncate">
                {node.productName || 'Web Bileşeni'}
              </h4>
              <span className="text-blue-600 font-bold font-mono text-sm">
                {node.productPrice || 'Modern Tasarım'}
              </span>
            </div>
            <button className="px-3 py-1.5 bg-neutral-900 text-white font-medium text-[11px] rounded-lg shadow-sm">
              İncele ↗
            </button>
          </div>
        </div>
      )}

      {/* 4. IMAGE (img / image) */}
      {(tagType === 'img' || tagType === 'image') && (
        <img
          src={node.attrs?.src || node.imageUrl || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80'}
          alt={node.attrs?.alt || 'Görsel'}
          style={{ borderRadius: borderRadiusCss, objectFit: node.style?.objectFit || 'cover' }}
          className="w-full h-full pointer-events-none"
        />
      )}

      {/* 5. INPUT / TEXTAREA / SELECT / HR / VIDEO */}
      {tagType === 'input' && (
        (effectiveNode.attrs?.type === 'checkbox' || effectiveNode.attrs?.type === 'radio') ? (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <input
              type={effectiveNode.attrs.type}
              checked={Boolean(effectiveNode.attrs?.checked)}
              readOnly
              className={`w-full h-full ${previewMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
              style={{ accentColor: effectiveNode.style?.accentColor || '#0d99ff' }}
            />
          </div>
        ) : (
          <input
            type={effectiveNode.attrs?.type || 'text'}
            placeholder={effectiveNode.attrs?.placeholder || 'Değer girin...'}
            value={effectiveNode.attrs?.value ?? ''}
            readOnly={!previewMode}
            onChange={previewMode ? (e) => onPreviewInputChange?.(node.id, e.target.value) : undefined}
            onClick={previewMode ? (e) => e.stopPropagation() : undefined}
            className={`w-full h-full px-3.5 py-2 bg-transparent border-none outline-none font-sans ${
              previewMode ? 'pointer-events-auto cursor-text' : 'pointer-events-none'
            }`}
            style={{
              color: effectiveNode.style?.color || '#1a1816',
              fontSize: effectiveNode.style?.fontSize || '14px',
            }}
          />
        )
      )}

      {tagType === 'textarea' && (
        <textarea
          placeholder={effectiveNode.attrs?.placeholder || 'Metin girin...'}
          value={previewMode ? (runtimePatch?.value ?? effectiveNode.attrs?.value ?? effectiveNode.textContent ?? '') : (effectiveNode.attrs?.value ?? effectiveNode.textContent ?? '')}
          readOnly={!previewMode}
          onChange={previewMode ? (e) => onPreviewInputChange?.(node.id, e.target.value) : undefined}
          onClick={previewMode ? (e) => e.stopPropagation() : undefined}
          className={`w-full h-full p-2.5 bg-transparent border-none outline-none resize-none font-sans ${
            previewMode ? 'pointer-events-auto cursor-text' : 'pointer-events-none'
          }`}
          style={{
            color: effectiveNode.style?.color || '#1a1816',
            fontSize: effectiveNode.style?.fontSize || '14px',
          }}
        />
      )}

      {tagType === 'select' && (
        <div
          className="w-full h-full px-3 flex items-center justify-between gap-2 bg-transparent pointer-events-none font-sans"
          style={{
            color: effectiveNode.style?.color || '#1a1816',
            fontSize: effectiveNode.style?.fontSize || '14px',
          }}
        >
          <span className="truncate">{effectiveNode.textContent || 'Seçim 1'}</span>
          <ChevronDown size={14} className="shrink-0 opacity-60" />
        </div>
      )}

      {tagType === 'hr' && (
        <div
          className="w-full h-full rounded-full pointer-events-none"
          style={{
            backgroundColor:
              (effectiveNode.fillColor && effectiveNode.fillColor !== 'transparent' && effectiveNode.fillColor) ||
              effectiveNode.style?.backgroundColor ||
              effectiveNode.borderColor ||
              '#64748b',
            minHeight: '2px',
            minWidth: '2px',
          }}
        />
      )}

      {tagType === 'video' && (
        previewMode && effectiveNode.attrs?.src ? (
          <video
            src={effectiveNode.attrs.src}
            controls
            className="w-full h-full object-cover rounded-[inherit]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-slate-900/90 text-slate-300 rounded-[inherit] pointer-events-none">
            <VideoIcon size={22} className="text-sky-400" />
            <span className="text-[11px] font-medium">Video Oynatıcı</span>
          </div>
        )
      )}

      {/* 6. BUTTON */}
      {tagType === 'button' && (
        editingTextNodeId === node.id ? (
          <textarea
            autoFocus
            value={effectiveNode.textContent ?? effectiveNode.content ?? ''}
            onChange={(e) => onUpdateElementText(node.id, e.target.value)}
            onBlur={() => {
              setEditingTextNodeId(null);
              if (onCommitHistory) onCommitHistory();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setEditingTextNodeId(null);
                if (onCommitHistory) onCommitHistory();
              } else if (e.key === 'Escape') {
                setEditingTextNodeId(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full h-full bg-[#101013]/95 text-white font-bold p-1 rounded border-2 border-[#0d99ff] focus:outline-none resize-none font-sans text-xs text-center z-50 shadow-2xl"
          />
        ) : (!hasChildren || Boolean(effectiveNode.textContent || effectiveNode.content)) ? (
          <div
            style={{
              color: effectiveNode.style?.color || effectiveNode.textColor || '#ffffff',
              fontSize: effectiveNode.style?.fontSize || `${effectiveNode.fontSize || 14}px`,
              fontWeight: effectiveNode.style?.fontWeight || effectiveNode.fontWeight || '600',
              textShadow: effectiveNode.style?.textShadow || undefined,
              width: '100%',
              height: '100%',
              textAlign: effectiveNode.style?.textAlign || 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            className="pointer-events-none"
          >
            {effectiveNode.sliderRole === 'dot' ? '' : (effectiveNode.textContent || effectiveNode.content || (!hasChildren ? 'Buton' : ''))}
          </div>
        ) : null
      )}

      {/* 7. TYPOGRAPHY / HEADINGS / PARAGRAPHS / PURE TEXT */}
      {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'text', 'badge'].includes(tagType) && (
        editingTextNodeId === node.id ? (
          <textarea
            autoFocus
            value={effectiveNode.textContent ?? effectiveNode.content ?? ''}
            onChange={(e) => onUpdateElementText(node.id, e.target.value)}
            onBlur={() => {
              setEditingTextNodeId(null);
              if (onCommitHistory) onCommitHistory();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setEditingTextNodeId(null);
                if (onCommitHistory) onCommitHistory();
              } else if (e.key === 'Escape') {
                setEditingTextNodeId(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              color: effectiveNode.style?.color || effectiveNode.textColor || '#ffffff',
              fontSize: effectiveNode.style?.fontSize || `${effectiveNode.fontSize || 16}px`,
              fontWeight: effectiveNode.style?.fontWeight || effectiveNode.fontWeight || '600',
              textAlign: effectiveNode.style?.textAlign || effectiveNode.textAlign || 'left',
              fontFamily: effectiveNode.style?.fontFamily || 'inherit',
              lineHeight: effectiveNode.style?.lineHeight || '1.3',
              letterSpacing: effectiveNode.style?.letterSpacing || undefined,
              textShadow: effectiveNode.style?.textShadow || undefined,
            }}
            className="w-full h-full bg-[#101013]/95 p-1.5 rounded border-2 border-[#0d99ff] focus:outline-none resize-none shadow-2xl z-50"
          />
        ) : (Boolean(effectiveNode.textContent || effectiveNode.content) || effectiveNode.accordionRole === 'indicator' || (!hasChildren && tagType === 'text')) ? (
          <div
            style={{
              color: effectiveNode.style?.color || effectiveNode.textColor || '#1f2937',
              fontSize: effectiveNode.style?.fontSize || `${effectiveNode.fontSize || 16}px`,
              fontWeight: effectiveNode.style?.fontWeight || effectiveNode.fontWeight || '400',
              textAlign:
                effectiveNode.style?.textAlign ||
                effectiveNode.textAlign ||
                (effectiveNode.style?.justifyContent === 'center' ? 'center' : 'left'),
              fontFamily: effectiveNode.style?.fontFamily || undefined,
              lineHeight: effectiveNode.style?.lineHeight || '1.4',
              letterSpacing: effectiveNode.style?.letterSpacing || undefined,
              textDecoration: effectiveNode.style?.textDecoration || undefined,
              textTransform: effectiveNode.style?.textTransform || undefined,
              textShadow: effectiveNode.style?.textShadow || undefined,
              whiteSpace: effectiveNode.style?.whiteSpace || undefined,
              width: '100%',
              padding:
                effectiveNode.style?.padding !== undefined
                  ? 0
                  : tagType === 'text'
                    ? '2px 4px'
                    : '4px',
            }}
            className="pointer-events-none"
          >
            {effectiveNode.accordionRole === 'indicator' && parentAccordionOpen !== null
              ? (parentAccordionOpen ? '−' : '+')
              : (effectiveNode.textContent || effectiveNode.content || (!hasChildren && tagType === 'text' ? 'Metin buraya gelecek...' : ''))}
          </div>
        ) : null
      )}

      {/* 8. GENERAL CONTAINERS (div, section, frame, header, form, etc.) with direct text content */}
      {!['navbar', 'nav', 'footer', 'product_card', 'article', 'img', 'image', 'input', 'textarea', 'select', 'hr', 'video', 'circle', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'text', 'badge'].includes(tagType) && (
        editingTextNodeId === node.id ? (
          <textarea
            autoFocus
            value={effectiveNode.textContent ?? effectiveNode.content ?? ''}
            onChange={(e) => onUpdateElementText(node.id, e.target.value)}
            onBlur={() => {
              setEditingTextNodeId(null);
              if (onCommitHistory) onCommitHistory();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setEditingTextNodeId(null);
                if (onCommitHistory) onCommitHistory();
              } else if (e.key === 'Escape') {
                setEditingTextNodeId(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full h-full bg-[#101013]/95 text-white p-1 rounded border-2 border-[#0d99ff] focus:outline-none resize-none text-xs z-50 shadow-2xl"
          />
        ) : (
          effectiveNode.textContent ? (
            <div
              style={{
                color: effectiveNode.style?.color || '#1a1816',
                fontSize: effectiveNode.style?.fontSize || '14px',
                fontWeight: effectiveNode.style?.fontWeight || '400',
                fontFamily: effectiveNode.style?.fontFamily || undefined,
                textAlign:
                  effectiveNode.style?.textAlign ||
                  effectiveNode.textAlign ||
                  (effectiveNode.style?.justifyContent === 'center' ? 'center' : 'left'),
                textShadow: effectiveNode.style?.textShadow || undefined,
                width: '100%',
              }}
              className="pointer-events-none"
            >
              {effectiveNode.textContent}
            </div>
          ) : (tagType === 'frame' && !hasChildren && !previewMode) ? (
            <div className="w-full h-full flex items-center justify-center border border-dashed border-slate-400/50 rounded-lg text-slate-400 text-[11px] font-medium pointer-events-none gap-1.5">
              <FrameIcon size={13} />
              <span>Çerçeve Alanı</span>
            </div>
          ) : null
        )
      )}

      {/* 9. RECURSIVE CHILDREN NODES */}
      {hasChildren && (() => {
        let runningAccordionOffsetY = 0;
        const nextAccordionParentOpen = ownAccordionOpen !== null ? ownAccordionOpen : parentAccordionOpen;
        return node.children.map(child => {
          if (
            ownSliderActiveIndex !== null &&
            child.sliderRole === 'slide' &&
            Number(child.slideIndex ?? 0) !== ownSliderActiveIndex
          ) {
            return null;
          }
          let childAccordionDeltaY = 0;
          let childAccordionOpen = null;
          let childAccordionHeight = null;
          if (child.accordionRole === 'item') {
            const chPatch = previewMode ? previewRuntimeOverrides[child.id] : null;
            childAccordionOpen = chPatch?.accordionOpen !== undefined ? Boolean(chPatch.accordionOpen) : Boolean(child.accordionOpen);
            const chCollapsed = Number(child.accordionCollapsedHeight) || 58;
            const chExpanded = Number(child.accordionExpandedHeight) || 108;
            childAccordionHeight = childAccordionOpen ? chExpanded : chCollapsed;
            const chBaseH = Number(child.height) || childAccordionHeight;
            childAccordionDeltaY = runningAccordionOffsetY;
            runningAccordionOffsetY += (childAccordionHeight - chBaseH);
          }
          return (
            <CanvasNode
              key={child.id}
              node={child}
              depth={depth + 1}
              elements={elements}
              selectedIds={selectedIds}
              editingGroupId={editingGroupId}
              hoveredCandidateId={hoveredCandidateId}
              dropTargetContainerId={dropTargetContainerId}
              onNodeMouseDown={onNodeMouseDown}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              editingTextNodeId={editingTextNodeId}
              setEditingTextNodeId={setEditingTextNodeId}
              onUpdateElementText={onUpdateElementText}
              onCommitHistory={onCommitHistory}
              previewMode={previewMode}
              previewRuntimeOverrides={previewRuntimeOverrides}
              onPreviewExecuteEvent={onPreviewExecuteEvent}
              onPreviewInputChange={onPreviewInputChange}
              viewportMode={viewportMode}
              canvasSettings={canvasSettings}
              isPreviewGhost={isPreviewGhost}
              interactionCursor={interactionCursor}
              parentSliderState={nextSliderState}
              parentAccordionOpen={nextAccordionParentOpen}
              accordionDeltaY={childAccordionDeltaY}
              accordionResolvedOpen={childAccordionOpen}
              accordionResolvedHeight={childAccordionHeight}
              aiHighlightedIds={aiHighlightedIds}
            />
          );
        });
      })()}
    </div>
  );
}

/**
 * 🌟 MAIN CANVAS COMPONENT
 */
export default function Canvas({
  elements = [],
  selectedIds = [],
  onSelectElements,
  onToggleElementSelection,
  onUpdateElement,
  onUpdateMultipleElements,
  onAltDuplicateElements,
  onCommitHistory,
  onReparentElement,
  onSelectParent,
  onSelectChild,
  activeTool,
  setActiveTool,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  canvasSettings,
  onUpdateCanvasSettings,
  previewMode,
  previewRuntimeOverrides = {},
  onPreviewExecuteEvent = null,
  onPreviewInputChange = null,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  onAddElementAt,
  editingGroupId,
  setEditingGroupId,
  viewportMode = 'desktop',
  onResetViewportFromDesktop,
  aiHighlightedIds = [],
  showLayoutGrid = false,
  setShowLayoutGrid,
  showRulers = false,
  setShowRulers,
  copiedStyle = null,
  onCopyStyle,
  onPasteStyle,
  onDuplicateSelected,
  onDeleteSelected,
  onCopySelected,
  onCutSelected,
  onPasteFromClipboard,
  canPasteClipboard = false,
  onGroupSelected,
  onUngroupSelected,
  onZOrderSelected,
  onToggleLockSelected,
  onToggleHideSelected,
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  onResetZoom,
  onNotify,
}) {
  const containerRef = useRef(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const isAltPressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const hoveredRawNodeIdRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const panModeRef = useRef(null); // 'middle' | 'space' | 'alt' | 'hand' | null

  // Hover candidate outline state
  const [hoveredCandidateId, setHoveredCandidateId] = useState(null);
  const [altHoverTargetId, setAltHoverTargetId] = useState(null);

  // Auto-parenting / drop target container highlight state
  const [dropTargetContainerId, setDropTargetContainerId] = useState(null);

  // Marquee Selection state
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeCurrent, setMarqueeCurrent] = useState({ x: 0, y: 0 });

  // Interactive Draw-to-Create, Zoom-Box, Eyedropper, and Right-Click Context Menu states
  const DRAW_TOOLS = ['rectangle', 'circle', 'line', 'frame', 'text'];
  const [drawDraft, setDrawDraft] = useState(null);
  const [zoomBox, setZoomBox] = useState(null);
  const [eyedropperSample, setEyedropperSample] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Dragging & Alt+Drag Ghost Duplication state
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const isDraggingRef = useRef(false);
  const draggingIdsRef = useRef([]);
  const dragStartCanvasRef = useRef({ x: 0, y: 0 });
  const elementsStartPositionsRef = useRef({});
  const dragParentAbsRef = useRef(null);
  const lastClientPosRef = useRef({ x: 0, y: 0 });
  const lastDragDeltaRef = useRef({ rawDx: 0, rawDy: 0, dx: 0, dy: 0 });
  const altDuplicateModeRef = useRef(false);
  const [altDuplicatePreview, setAltDuplicatePreview] = useState(null);
  const autoScrollFrameRef = useRef(null);
  const hasMovedDuringDragRef = useRef(false);

  // Adobe / Figma Smart Alignment Guides & Snapping state
  const [activeGuides, setActiveGuides] = useState([]);
  const dragStartBboxRef = useRef(null);

  // Inline text editing state (Double-click on canvas to type directly!)
  const [editingTextNodeId, setEditingTextNodeId] = useState(null);
  const editingTextNodeIdRef = useRef(null);
  useEffect(() => {
    editingTextNodeIdRef.current = editingTextNodeId;
  }, [editingTextNodeId]);

  const latestElementsRef = useRef(elements);
  const latestCanvasSettingsRef = useRef(canvasSettings);
  const latestZoomRef = useRef(zoom);
  const latestPanOffsetRef = useRef(panOffset);
  const onUpdateMultipleElementsRef = useRef(onUpdateMultipleElements);
  useEffect(() => { latestElementsRef.current = elements; }, [elements]);
  useEffect(() => { latestCanvasSettingsRef.current = canvasSettings; }, [canvasSettings]);
  useEffect(() => { latestZoomRef.current = zoom; }, [zoom]);
  useEffect(() => { latestPanOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { onUpdateMultipleElementsRef.current = onUpdateMultipleElements; }, [onUpdateMultipleElements]);

  const handleUpdateElementText = (id, newText) => {
    if (onUpdateElement) {
      onUpdateElement({ textContent: newText, content: newText });
    }
  };

  // Resizing state
  const [resizingHandle, setResizingHandle] = useState(null);
  const [resizeStart, setResizeStart] = useState({ minX: 0, minY: 0, w: 0, h: 0, startX: 0, startY: 0, elementsMap: {} });

  // Dragging bottom page height extender
  const [isExtendingHeight, setIsExtendingHeight] = useState(false);
  const [heightDragStartY, setHeightDragStartY] = useState(0);
  const [initialHeight, setInitialHeight] = useState(canvasSettings.height);

  // Auto-scroll helper
  const startAutoScroll = (speed) => {
    if (autoScrollFrameRef.current) return;
    const loop = () => {
      setPanOffset(prev => ({ ...prev, y: prev.y + speed }));
      autoScrollFrameRef.current = requestAnimationFrame(loop);
    };
    autoScrollFrameRef.current = requestAnimationFrame(loop);
  };

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  // Unified drag presentation updater (handles normal drag, mid-drag Alt toggle, and snap guides)
  const syncDragPresentation = useCallback((rawDx, rawDy, altHeld) => {
    const startBbox = dragStartBboxRef.current;
    const ids = draggingIdsRef.current;
    const startMap = elementsStartPositionsRef.current;
    const currentElements = latestElementsRef.current;
    const currentCanvasSettings = latestCanvasSettingsRef.current;
    const currentZoom = Math.max(0.15, latestZoomRef.current || 1);

    let effectiveDx = rawDx;
    let effectiveDy = rawDy;
    let guides = [];

    if (startBbox) {
      const snapThreshold = Math.max(3, Math.min(14, 7 / currentZoom));
      const dragBox = {
        left: startBbox.minX + rawDx,
        right: startBbox.maxX + rawDx,
        centerX: startBbox.minX + rawDx + startBbox.width / 2,
        top: startBbox.minY + rawDy,
        bottom: startBbox.maxY + rawDy,
        centerY: startBbox.minY + rawDy + startBbox.height / 2,
        width: startBbox.width,
        height: startBbox.height,
      };

      // In Alt-duplicate mode, keep originals eligible as snap targets so copies can align to originals
      const excludeSet = altHeld ? new Set() : getDescendantIds(currentElements, ids);
      const snap = computeDragSnap(
        dragBox,
        currentElements,
        currentCanvasSettings,
        excludeSet,
        snapThreshold,
        dragParentAbsRef.current
      );
      effectiveDx = rawDx + snap.snapDeltaX;
      effectiveDy = rawDy + snap.snapDeltaY;
      guides = snap.guides;
    }

    lastDragDeltaRef.current = { rawDx, rawDy, dx: effectiveDx, dy: effectiveDy };
    setActiveGuides(guides);

    if (altHeld) {
      // Restore originals to start positions if we just switched into Alt-duplicate mode mid-drag
      if (!altDuplicateModeRef.current && onUpdateMultipleElementsRef.current) {
        const restoreMap = {};
        ids.forEach(id => {
          const st = startMap[id];
          if (st) restoreMap[id] = { x: st.x, y: st.y };
        });
        onUpdateMultipleElementsRef.current(restoreMap);
      }
      altDuplicateModeRef.current = true;

      const items = [];
      ids.forEach(id => {
        const found = findNodeAndParent(currentElements, id);
        const st = startMap[id];
        if (found?.node && st) {
          items.push({
            id,
            node: found.node,
            absX: Math.round(st.absX + effectiveDx),
            absY: Math.round(st.absY + effectiveDy),
            width: st.width,
            height: st.height,
          });
        }
      });
      setAltDuplicatePreview({
        dx: effectiveDx,
        dy: effectiveDy,
        bbox: startBbox
          ? {
              minX: Math.round(startBbox.minX + effectiveDx),
              minY: Math.round(startBbox.minY + effectiveDy),
              width: startBbox.width,
              height: startBbox.height,
            }
          : null,
        items,
      });
    } else {
      if (altDuplicateModeRef.current) {
        altDuplicateModeRef.current = false;
        setAltDuplicatePreview(null);
      }
      const updatesMap = {};
      ids.forEach(id => {
        const st = startMap[id];
        if (st) {
          updatesMap[id] = {
            x: Math.round(st.x + effectiveDx),
            y: Math.round(st.y + effectiveDy),
          };
        }
      });
      if (onUpdateMultipleElementsRef.current) {
        onUpdateMultipleElementsRef.current(updatesMap);
      }
    }
  }, []);

  const syncDragPresentationRef = useRef(syncDragPresentation);
  useEffect(() => { syncDragPresentationRef.current = syncDragPresentation; }, [syncDragPresentation]);

  // Track Alt, Space (Pan), and Ctrl/Meta keys globally including mid-drag Alt toggling
  useEffect(() => {
    const isTypingFocused = () => {
      if (editingTextNodeIdRef.current) return true;
      const tag = document.activeElement?.tagName;
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || Boolean(document.activeElement?.isContentEditable);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Alt') {
        if (!isTypingFocused()) e.preventDefault();
        if (!isAltPressedRef.current) {
          isAltPressedRef.current = true;
          setIsAltPressed(true);
          if (isDraggingRef.current && hasMovedDuringDragRef.current) {
            const { rawDx, rawDy } = lastDragDeltaRef.current;
            syncDragPresentationRef.current(rawDx, rawDy, true);
          }
        }
      } else if (e.key === ' ') {
        if (!isTypingFocused() && !e.repeat) {
          e.preventDefault();
          isSpacePressedRef.current = true;
          setIsSpacePressed(true);
        }
      } else if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = false;
        setIsAltPressed(false);
        if (isDraggingRef.current && hasMovedDuringDragRef.current) {
          const { rawDx, rawDy } = lastDragDeltaRef.current;
          syncDragPresentationRef.current(rawDx, rawDy, false);
        }
      } else if (e.key === ' ') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        if (panModeRef.current === 'space') {
          panModeRef.current = null;
          setIsPanning(false);
        }
      } else if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };

    const handleWindowBlur = () => {
      isAltPressedRef.current = false;
      isSpacePressedRef.current = false;
      panModeRef.current = null;
      setIsAltPressed(false);
      setIsSpacePressed(false);
      setIsCtrlPressed(false);
      setIsPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // 1. Mouse Wheel Handler: Cursor-anchored Zoom (Ctrl/Cmd or Adobe Alt+Wheel) & Scroll Pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Zoom anchored at the cursor (Adobe Photoshop / Illustrator / Figma feel)
        const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
        const prevZoom = latestZoomRef.current || 1;
        const nextZoom = Math.min(3.5, Math.max(0.2, +(prevZoom + zoomDelta).toFixed(2)));
        if (nextZoom !== prevZoom) {
          const rect = container.getBoundingClientRect();
          const pointerX = e.clientX - rect.left;
          const pointerY = e.clientY - rect.top;
          const curPan = latestPanOffsetRef.current || { x: 0, y: 0 };
          const worldX = (pointerX - curPan.x) / prevZoom;
          const worldY = (pointerY - curPan.y) / prevZoom;
          const nextPan = {
            x: Math.round(pointerX - worldX * nextZoom),
            y: Math.round(pointerY - worldY * nextZoom),
          };
          latestZoomRef.current = nextZoom;
          latestPanOffsetRef.current = nextPan;
          setZoom(nextZoom);
          setPanOffset(nextPan);
        }
      } else {
        // Keep mouse wheel strictly vertical even while Shift is held for multi-select;
        // horizontal scrolling uses native trackpad/tilt deltaX without sideways drift.
        const { dx, dy } = resolveWheelPanDelta({ deltaX: e.deltaX, deltaY: e.deltaY });
        if (dx !== 0 || dy !== 0) {
          setPanOffset((prev) => {
            const next = { x: prev.x + dx, y: prev.y + dy };
            latestPanOffsetRef.current = next;
            return next;
          });
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [setZoom, setPanOffset]);

  // Convert client coordinates to artboard canvas coordinates
  const getCanvasLocalCoords = useCallback((clientX, clientY) => {
    const artboard = document.getElementById('artboard-canvas');
    if (!artboard) return { x: 0, y: 0 };
    const rect = artboard.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  /**
   * Helper: Find which container on canvas the mouse pointer is currently hovering over
   * (for auto-parenting). Excludes dragged elements and their descendants.
   */
  const findDropTargetContainer = useCallback((localX, localY, excludedIds) => {
    const allNodes = flattenTree(elements);
    const validContainers = allNodes.filter(n => {
      if (excludedIds.includes(n.id)) return false;
      // Do not allow dropping into descendants of excluded nodes
      const path = getNodePath(elements, n.id);
      if (path.some(p => excludedIds.includes(p.id))) return false;
      return isExplicitContainer(n);
    });

    // Check hit test using absolute coordinates
    const hitting = [];
    for (const container of validContainers) {
      const abs = getAbsoluteCoords(elements, container.id);
      if (!abs) continue;
      if (
        localX >= abs.x &&
        localX <= abs.x + abs.width &&
        localY >= abs.y &&
        localY <= abs.y + abs.height
      ) {
        hitting.push({ container, area: abs.width * abs.height });
      }
    }

    if (hitting.length === 0) return null;
    // Pick the most specific (smallest area) container
    hitting.sort((a, b) => a.area - b.area);
    return hitting[0].container;
  }, [elements]);

  // Compute absolute bounding box of selected elements
  const getCombinedBoundingBox = (ids = selectedIds) => {
    if (!ids || ids.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    ids.forEach(id => {
      const abs = getAbsoluteCoords(elements, id);
      if (abs) {
        if (abs.x < minX) minX = abs.x;
        if (abs.y < minY) minY = abs.y;
        if (abs.x + abs.width > maxX) maxX = abs.x + abs.width;
        if (abs.y + abs.height > maxY) maxY = abs.y + abs.height;
      }
    });

    if (minX === Infinity) return null;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
    };
  };

  // Live recompute hover candidate when Ctrl or isolation scope toggles under stationary pointer
  useEffect(() => {
    if (!hoveredRawNodeIdRef.current || previewMode) return;
    const { targetId } = resolveSelectionTarget(elements, hoveredRawNodeIdRef.current, editingGroupId, {
      ctrlKey: isCtrlPressed,
    });
    setHoveredCandidateId(targetId);
  }, [isCtrlPressed, editingGroupId, elements, previewMode]);

  // Clear eyedropper preview when tool changes; close context menu on Escape or outside click
  useEffect(() => {
    if (activeTool !== 'eyedropper') {
      setEyedropperSample(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeMenu = (ev) => {
      if (ev?.type === 'keydown') {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
      }
      if (ev?.type === 'mousedown' && ev.target?.closest?.('[data-canvas-context-menu]')) return;
      setContextMenu(null);
    };
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeMenu, true);
    window.addEventListener('wheel', closeMenu, { passive: true });
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeMenu, true);
      window.removeEventListener('wheel', closeMenu);
    };
  }, [contextMenu]);

  // Cursor-anchored Zoom (for Zoom tool click & Alt+Click)
  const zoomAtClientPoint = useCallback((nextZoomRaw, clientX, clientY) => {
    const container = containerRef.current;
    const prevZoom = latestZoomRef.current || 1;
    const nextZoom = clampCanvasZoom(nextZoomRaw);
    if (!container || nextZoom === prevZoom) return;
    const rect = container.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const curPan = latestPanOffsetRef.current || { x: 0, y: 0 };
    const worldX = (pointerX - curPan.x) / prevZoom;
    const worldY = (pointerY - curPan.y) / prevZoom;
    const nextPan = {
      x: Math.round(pointerX - worldX * nextZoom),
      y: Math.round(pointerY - worldY * nextZoom),
    };
    latestZoomRef.current = nextZoom;
    latestPanOffsetRef.current = nextPan;
    setZoom(nextZoom);
    setPanOffset(nextPan);
  }, [setZoom, setPanOffset]);

  // Zoom smoothly to fit a dragged canvas world rectangle
  const zoomToWorldRect = useCallback((worldRect) => {
    const container = containerRef.current;
    if (!container || worldRect.width < 1 || worldRect.height < 1) return;
    const cw = Math.max(200, container.clientWidth);
    const ch = Math.max(200, container.clientHeight);
    const rawZoom = Math.min((cw * 0.84) / worldRect.width, (ch * 0.84) / worldRect.height);
    const nextZoom = clampCanvasZoom(rawZoom);
    const cx = worldRect.x + worldRect.width / 2;
    const cy = worldRect.y + worldRect.height / 2;
    const nextPan = {
      x: Math.round(cw / 2 - cx * nextZoom),
      y: Math.round(ch / 2 - cy * nextZoom),
    };
    latestZoomRef.current = nextZoom;
    latestPanOffsetRef.current = nextPan;
    setZoom(nextZoom);
    setPanOffset(nextPan);
  }, [setZoom, setPanOffset]);

  const applyEyedropperColor = useCallback((hex) => {
    if (!hex) return;
    setPrimaryColor?.(hex);
    if (selectedIds.length > 0 && onUpdateMultipleElements) {
      const updates = {};
      selectedIds.forEach((id) => {
        const found = findNodeAndParent(elements, id);
        const tag = String(found?.node?.type || '').toLowerCase();
        const isPureText = ['text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'blockquote', 'badge'].includes(tag);
        if (isPureText && found?.node && (!found.node.fillColor || found.node.fillColor === 'transparent')) {
          updates[id] = {
            color: hex,
            style: { ...(found.node.style || {}), color: hex },
          };
        } else if (tag === 'hr') {
          updates[id] = {
            fillColor: hex,
            borderColor: hex,
            style: { ...(found?.node?.style || {}), backgroundColor: hex, borderColor: hex },
          };
        } else {
          updates[id] = {
            fillType: 'solid',
            fillColor: hex,
            style: { ...(found?.node?.style || {}), backgroundColor: hex },
          };
        }
      });
      onUpdateMultipleElements(updates);
      onNotify?.(`Renk uygulandı: ${hex}`, 'success');
    } else {
      navigator.clipboard?.writeText?.(hex).catch(() => {});
      onNotify?.(`Renk örneklendi ve kopyalandı: ${hex}`, 'success');
    }
    setActiveTool?.('select');
  }, [elements, selectedIds, onUpdateMultipleElements, setPrimaryColor, onNotify, setActiveTool]);

  const startDrawGesture = useCallback((clientX, clientY, shiftKey) => {
    const coords = getCanvasLocalCoords(clientX, clientY);
    const parentCandidate = activeTool === 'frame' ? null : findDropTargetContainer(coords.x, coords.y, []);
    const parentAbs = parentCandidate ? getAbsoluteCoords(elements, parentCandidate.id) : null;
    setDrawDraft({
      tool: activeTool,
      start: coords,
      current: coords,
      shiftKey: Boolean(shiftKey),
      parentId: parentCandidate?.id || null,
      parentAbs,
    });
  }, [activeTool, elements, getCanvasLocalCoords, findDropTargetContainer]);

  const commitDrawnElement = useCallback((draft) => {
    if (!draft) return;
    const defaultSizeMap = {
      rectangle: { width: 240, height: 150 },
      circle: { width: 140, height: 140 },
      line: { width: 320, height: 2 },
      frame: { width: 460, height: 300 },
      text: { width: 220, height: 42 },
    };
    const resolved = resolveDrawnBox(draft.start, draft.current, {
      shiftKey: draft.shiftKey,
      isLine: draft.tool === 'line',
      defaultSize: defaultSizeMap[draft.tool] || defaultSizeMap.rectangle,
    });
    const relX = draft.parentAbs ? Math.max(0, Math.round(resolved.x - draft.parentAbs.x)) : Math.max(0, resolved.x);
    const relY = draft.parentAbs ? Math.max(0, Math.round(resolved.y - draft.parentAbs.y)) : Math.max(0, resolved.y);

    if (draft.tool === 'rectangle') {
      onAddElementAt({
        parentId: draft.parentId,
        type: 'rectangle',
        name: `Dikdörtgen ${elements.length + 1}`,
        x: relX,
        y: relY,
        width: resolved.width,
        height: resolved.height,
        fillType: 'solid',
        fillColor: primaryColor || '#d4af37',
        borderWidth: 1,
        borderColor: secondaryColor || '#1a1816',
        borderStyle: 'solid',
        borderRadius: 14,
        borderRadiusType: 'single',
        borderRadiusCorners: { tl: 14, tr: 14, br: 14, bl: 14 },
        positionMode: 'normal',
        opacity: 100,
        shadow: '0 4px 14px rgba(0,0,0,0.1)',
        children: [],
      });
    } else if (draft.tool === 'circle') {
      onAddElementAt({
        parentId: draft.parentId,
        type: 'circle',
        name: `Daire ${elements.length + 1}`,
        x: relX,
        y: relY,
        width: resolved.width,
        height: resolved.height,
        fillType: 'solid',
        fillColor: primaryColor || '#d4af37',
        borderWidth: 1,
        borderColor: secondaryColor || '#1a1816',
        borderStyle: 'solid',
        borderRadius: 9999,
        borderRadiusType: 'single',
        borderRadiusCorners: { tl: 9999, tr: 9999, br: 9999, bl: 9999 },
        positionMode: 'normal',
        opacity: 100,
        shadow: '0 4px 14px rgba(0,0,0,0.1)',
        children: [],
      });
    } else if (draft.tool === 'line') {
      const lineColor = secondaryColor && secondaryColor !== '#ffffff' ? secondaryColor : (primaryColor || '#334155');
      onAddElementAt({
        parentId: draft.parentId,
        type: 'hr',
        name: `Çizgi ${elements.length + 1}`,
        x: relX,
        y: relY,
        width: resolved.width,
        height: resolved.height,
        fillType: 'solid',
        fillColor: lineColor,
        borderWidth: 0,
        borderRadius: 9999,
        style: {
          border: 'none',
          backgroundColor: lineColor,
        },
        positionMode: 'normal',
        children: [],
      });
    } else if (draft.tool === 'frame') {
      onAddElementAt({
        parentId: null,
        type: 'frame',
        name: `Çerçeve ${elements.length + 1}`,
        x: Math.max(0, resolved.x),
        y: Math.max(0, resolved.y),
        width: resolved.width,
        height: resolved.height,
        fillType: 'solid',
        fillColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'solid',
        borderRadius: 16,
        borderRadiusType: 'single',
        borderRadiusCorners: { tl: 16, tr: 16, br: 16, bl: 16 },
        style: {
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '16px',
          padding: '20px',
        },
        positionMode: 'normal',
        opacity: 100,
        children: [],
      });
    } else if (draft.tool === 'text') {
      const contrastColor = getAutoContrastTextColor(
        canvasSettings?.backgroundColor || canvasSettings?.background || '#ffffff'
      );
      const created = createTagElement('text', {
        name: `Metin ${elements.length + 1}`,
        textContent: 'Yeni Metin',
        x: resolved.wasDrag ? relX : Math.max(0, Math.round(draft.start.x - 10)),
        y: resolved.wasDrag ? relY : Math.max(0, Math.round(draft.start.y - 16)),
        width: resolved.wasDrag ? Math.max(80, resolved.width) : undefined,
        style: {
          color: contrastColor,
          backgroundColor: 'transparent',
        },
      });
      onAddElementAt({ ...created, parentId: draft.parentId });
      requestAnimationFrame(() => {
        setEditingTextNodeId(created.id);
      });
    }
  }, [elements.length, primaryColor, secondaryColor, canvasSettings, onAddElementAt]);

  // Hover detection for outline indicator (Highlights exact element that click will target at current scope)
  const handleNodeMouseEnter = (e, node) => {
    if (previewMode || isDraggingElement || isPanning) return;
    e.stopPropagation();
    hoveredRawNodeIdRef.current = node.id;
    const { targetId } = resolveSelectionTarget(elements, node.id, editingGroupId, {
      ctrlKey: e.ctrlKey || e.metaKey || isCtrlPressed,
    });
    const resolved = targetId || node.id;
    setHoveredCandidateId(resolved);
    setAltHoverTargetId(resolved);
  };

  const handleNodeMouseLeave = (e, node) => {
    e.stopPropagation();
    if (hoveredRawNodeIdRef.current === node.id) {
      hoveredRawNodeIdRef.current = null;
    }
    const { targetId } = resolveSelectionTarget(elements, node.id, editingGroupId, {
      ctrlKey: e.ctrlKey || e.metaKey || isCtrlPressed,
    });
    setHoveredCandidateId(prev => (prev === node.id || prev === targetId ? null : prev));
    setAltHoverTargetId(prev => (prev === node.id || prev === targetId ? null : prev));
  };

  // Right-click Context Menu Handler
  const handleCanvasContextMenu = (e) => {
    if (previewMode) return;
    e.preventDefault();
    e.stopPropagation();
    const nodeEl = e.target?.closest?.('[data-element-id]');
    const rawId = nodeEl?.getAttribute?.('data-element-id') || null;
    let targetId = null;

    if (rawId) {
      const { targetId: resolvedId, nextEditingGroupId } = resolveSelectionTarget(elements, rawId, editingGroupId, {
        ctrlKey: Boolean(e.ctrlKey || e.metaKey),
      });
      targetId = resolvedId || rawId;
      if (setEditingGroupId && nextEditingGroupId !== editingGroupId) {
        setEditingGroupId(nextEditingGroupId);
      }
      if (!selectedIds.includes(targetId)) {
        onSelectElements([targetId]);
      }
    }

    const menuWidth = 224;
    const menuHeight = targetId ? 380 : 180;
    const clampedX = Math.max(8, Math.min(window.innerWidth - menuWidth - 12, e.clientX));
    const clampedY = Math.max(8, Math.min(window.innerHeight - menuHeight - 12, e.clientY));
    setContextMenu({ x: clampedX, y: clampedY, targetId });
  };

  // Mouse Down on Canvas Background / Pasteboard
  const handleMouseDown = (e) => {
    if (e.button === 2) return;
    if (contextMenu) setContextMenu(null);
    const altHeld = Boolean(e.altKey || isAltPressedRef.current);
    const spaceHeld = Boolean(isSpacePressedRef.current);

    // 0. Zoom Tool (Z): Click to zoom in, Alt+Click to zoom out, Drag to zoom rectangle
    if (activeTool === 'zoom' && e.button === 0 && !spaceHeld) {
      e.preventDefault();
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setZoomBox({
        start: coords,
        current: coords,
        clientStartX: e.clientX,
        clientStartY: e.clientY,
        altKey: altHeld,
      });
      return;
    }

    // 0b. Eyedropper Tool (I): Sample & apply without clearing selection
    if (activeTool === 'eyedropper' && e.button === 0 && !spaceHeld) {
      e.preventDefault();
      const sample = sampleColorAtClientPoint(e.clientX, e.clientY, Boolean(e.shiftKey));
      if (sample?.hex) applyEyedropperColor(sample.hex);
      return;
    }

    // 1. Pan with Middle Button OR (Space + Left Click) OR (Hand tool + Left Click)
    //    OR (Alt + Left Click on empty artboard paper / outside the artboard when not Zoom tool)
    if (
      e.button === 1 ||
      (spaceHeld && e.button === 0) ||
      (activeTool === 'hand' && e.button === 0) ||
      (altHeld && e.button === 0)
    ) {
      e.preventDefault();
      if (altHeld !== isAltPressedRef.current) {
        isAltPressedRef.current = altHeld;
        setIsAltPressed(altHeld);
      }
      panModeRef.current =
        e.button === 1
          ? 'middle'
          : spaceHeld
          ? 'space'
          : activeTool === 'hand'
          ? 'hand'
          : 'alt';
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // 2. Drag-to-Draw Shape / Line / Frame / Text on Artboard
    if (DRAW_TOOLS.includes(activeTool) && e.button === 0 && e.target.closest('#artboard-canvas')) {
      e.preventDefault();
      startDrawGesture(e.clientX, e.clientY, e.shiftKey);
      return;
    }

    // 3. Marquee Selection on Empty Canvas Area
    if (e.target.id === 'artboard-canvas' || e.target.id === 'canvas-wrapper') {
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setIsMarqueeActive(true);
      setMarqueeStart(coords);
      setMarqueeCurrent(coords);

      if (!e.shiftKey) {
        onSelectElements([]);
        setEditingGroupId?.(null);
      }
    }
  };

  // Shared drag initializer for both single node clicks and multi-selection bounding box
  const startElementDrag = (e, idsToDrag) => {
    if (e.altKey !== isAltPressedRef.current) {
      isAltPressedRef.current = e.altKey;
      setIsAltPressed(e.altKey);
    }

    const startMap = {};
    let sharedParentId = undefined;
    let sameParent = true;

    idsToDrag.forEach(id => {
      const found = findNodeAndParent(elements, id);
      const abs = getAbsoluteCoords(elements, id);
      if (found && found.node) {
        const pid = found.parent ? found.parent.id : null;
        if (sharedParentId === undefined) sharedParentId = pid;
        else if (sharedParentId !== pid) sameParent = false;

        startMap[id] = {
          x: found.node.x,
          y: found.node.y,
          absX: abs ? abs.x : found.node.x,
          absY: abs ? abs.y : found.node.y,
          width: found.node.width,
          height: found.node.height,
        };
      }
    });

    dragParentAbsRef.current = sameParent && sharedParentId
      ? getAbsoluteCoords(elements, sharedParentId)
      : null;

    const startCanvasCoords = getCanvasLocalCoords(e.clientX, e.clientY);
    dragStartCanvasRef.current = startCanvasCoords;
    elementsStartPositionsRef.current = startMap;
    draggingIdsRef.current = idsToDrag;
    lastClientPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedDuringDragRef.current = false;
    lastDragDeltaRef.current = { rawDx: 0, rawDy: 0, dx: 0, dy: 0 };
    altDuplicateModeRef.current = false;
    dragStartBboxRef.current = getCombinedBoundingBox(idsToDrag);
    setAltDuplicatePreview(null);

    isDraggingRef.current = true;
    setIsDraggingElement(true);
  };

  // Mouse Down on an Element Node (Nested Scope + Ctrl Direct Deep Select)
  const handleNodeMouseDown = (e, node) => {
    if (previewMode) return;
    if (e.button === 2) return;
    if (contextMenu) setContextMenu(null);
    if (isSpacePressedRef.current || activeTool === 'hand') return;
    if (editingTextNodeIdRef.current === node.id) return;

    // Active Canvas Mode Tools intercept clicks before element selection/drag!
    if (activeTool === 'zoom' && e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setZoomBox({
        start: coords,
        current: coords,
        clientStartX: e.clientX,
        clientStartY: e.clientY,
        altKey: Boolean(e.altKey || isAltPressedRef.current),
      });
      return;
    }

    if (activeTool === 'eyedropper' && e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const sample = sampleColorAtClientPoint(e.clientX, e.clientY, Boolean(e.shiftKey));
      if (sample?.hex) applyEyedropperColor(sample.hex);
      return;
    }

    if (activeTool === 'format_paint' && e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const isCtrl = Boolean(e.ctrlKey || e.metaKey);
      const { targetId } = resolveSelectionTarget(elements, node.id, editingGroupId, { ctrlKey: isCtrl });
      const resolvedId = targetId || node.id;
      onPasteStyle?.([resolvedId]);
      setActiveTool?.('select');
      return;
    }

    if (DRAW_TOOLS.includes(activeTool) && e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      startDrawGesture(e.clientX, e.clientY, e.shiftKey);
      return;
    }

    e.stopPropagation();

    const isCtrl = Boolean(e.ctrlKey || e.metaKey);
    const { targetId, nextEditingGroupId } = resolveSelectionTarget(
      elements,
      node.id,
      editingGroupId,
      { ctrlKey: isCtrl }
    );
    const resolvedId = targetId || node.id;
    const resolvedNode = findNodeAndParent(elements, resolvedId)?.node || node;
    if (resolvedNode.isLocked) return;

    if (setEditingGroupId && nextEditingGroupId !== editingGroupId) {
      setEditingGroupId(nextEditingGroupId);
    }

    const isShift = e.shiftKey;

    // 1. Shift+Click: Toggle selection on resolved target node
    if (isShift) {
      onToggleElementSelection(resolvedId);
      return;
    }

    // 2. Select resolved node if not already part of current selection
    let currentSelection = selectedIds;
    if (!selectedIds.includes(resolvedId)) {
      currentSelection = [resolvedId];
      onSelectElements([resolvedId]);
    }

    startElementDrag(e, currentSelection);
  };

  // Double Click on an Element Node -> Drill one level into wrappers/containers, or edit leaf text!
  const handleNodeDoubleClick = (e, node) => {
    if (previewMode) return;
    e.stopPropagation();

    const dbl = resolveDoubleClickAction(elements, node.id, editingGroupId, {
      ctrlKey: Boolean(e.ctrlKey || e.metaKey),
    });

    if (dbl.action === 'enter_group') {
      const targetGroup = findNodeAndParent(elements, dbl.groupId)?.node;
      if (targetGroup?.isLocked) return;
      setEditingGroupId?.(dbl.groupId);
      onSelectElements([dbl.nextSelectedId]);
      return;
    }

    if (dbl.action === 'edit_text') {
      const leaf = findNodeAndParent(elements, dbl.targetId)?.node;
      if (leaf?.isLocked) return;
      if (dbl.nextEditingGroupId !== undefined && dbl.nextEditingGroupId !== editingGroupId) {
        setEditingGroupId?.(dbl.nextEditingGroupId);
      }
      onSelectElements([dbl.targetId]);
      setEditingTextNodeId(dbl.targetId);
      return;
    }

    if (dbl.action === 'select' && dbl.targetId) {
      onSelectElements([dbl.targetId]);
    }
  };

  // Mouse Move handler
  const handleMouseMove = (e) => {
    // 0. Zoom-box marquee drag
    if (zoomBox) {
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setZoomBox((prev) => (prev ? { ...prev, current: coords, altKey: Boolean(e.altKey || isAltPressedRef.current) } : null));
      return;
    }

    // 0b. Drag-to-draw preview
    if (drawDraft) {
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setDrawDraft((prev) => (prev ? { ...prev, current: coords, shiftKey: Boolean(e.shiftKey) } : null));
      return;
    }

    // 0c. Live Eyedropper color sampling under cursor
    if (activeTool === 'eyedropper' && !isPanning && !previewMode) {
      const sample = sampleColorAtClientPoint(e.clientX, e.clientY, Boolean(e.shiftKey));
      setEyedropperSample(sample);
    }

    // 1. Canvas Pan
    if (isPanning) {
      const nextPan = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      latestPanOffsetRef.current = nextPan;
      setPanOffset(nextPan);
      return;
    }

    // 2. Marquee Selection Drag (Restricted to active scope siblings!)
    if (isMarqueeActive) {
      const coords = getCanvasLocalCoords(e.clientX, e.clientY);
      setMarqueeCurrent(coords);

      const x1 = Math.min(marqueeStart.x, coords.x);
      const y1 = Math.min(marqueeStart.y, coords.y);
      const x2 = Math.max(marqueeStart.x, coords.x);
      const y2 = Math.max(marqueeStart.y, coords.y);

      const scopeSiblings = getScopeChildren(elements, editingGroupId);
      const intersectingIds = scopeSiblings.filter(el => {
        if (el.isHidden) return false;
        const abs = getAbsoluteCoords(elements, el.id);
        if (!abs) return false;
        return !(abs.x > x2 || (abs.x + abs.width) < x1 || abs.y > y2 || (abs.y + abs.height) < y1);
      }).map(el => el.id);

      onSelectElements(intersectingIds);
      return;
    }

    // 3. Extending page height downwards
    if (isExtendingHeight) {
      const dy = (e.clientY - heightDragStartY) / zoom;
      const newHeight = Math.max(600, Math.round(initialHeight + dy));
      onUpdateCanvasSettings({ height: newHeight });
      return;
    }

    // 4. Dragging elements (Normal move OR dynamic Alt+Drag duplication preview)
    if (isDraggingElement && draggingIdsRef.current.length > 0) {
      lastClientPosRef.current = { x: e.clientX, y: e.clientY };
      const currentCanvas = getCanvasLocalCoords(e.clientX, e.clientY);
      const rawDx = currentCanvas.x - dragStartCanvasRef.current.x;
      const rawDy = currentCanvas.y - dragStartCanvasRef.current.y;

      if (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2) {
        hasMovedDuringDragRef.current = true;
      }

      if (e.altKey !== isAltPressedRef.current) {
        isAltPressedRef.current = e.altKey;
        setIsAltPressed(e.altKey);
      }

      if (hasMovedDuringDragRef.current) {
        syncDragPresentation(rawDx, rawDy, Boolean(e.altKey));
      }

      // Check auto-parenting candidate container under cursor (SINGLE element drag ONLY)
      // Protect children of atomic semantic wrappers (<a>, <button>) from accidental drag-unparenting!
      const draggedList = draggingIdsRef.current;
      if (draggedList.length > 1) {
        setDropTargetContainerId(null);
      } else {
        const draggedId = draggedList[0];
        const currentParent = findNodeAndParent(elements, draggedId)?.parent;
        const canUnparentByDrag = !currentParent || shouldAllowDragUnparent(elements, draggedId);

        if (!canUnparentByDrag) {
          setDropTargetContainerId(null);
        } else {
          const candidateContainer = findDropTargetContainer(currentCanvas.x, currentCanvas.y, draggedList);
          if (candidateContainer) {
            if (currentParent?.id !== candidateContainer.id) {
              setDropTargetContainerId(candidateContainer.id);
            } else {
              setDropTargetContainerId(null);
            }
          } else if (currentParent) {
            const parentAbs = getAbsoluteCoords(elements, currentParent.id);
            const isOutsideParent = (
              currentCanvas.x < parentAbs.x ||
              currentCanvas.x > (parentAbs.x + parentAbs.width) ||
              currentCanvas.y < parentAbs.y ||
              currentCanvas.y > (parentAbs.y + parentAbs.height)
            );
            setDropTargetContainerId(isOutsideParent ? 'root' : null);
          } else {
            setDropTargetContainerId(null);
          }
        }
      }

      // Auto-scroll near canvas boundaries
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const edgeThreshold = 70;
        if (e.clientY < rect.top + edgeThreshold) {
          const intensity = Math.min(1.5, (rect.top + edgeThreshold - e.clientY) / 30);
          startAutoScroll(intensity * 14);
        } else if (e.clientY > rect.bottom - edgeThreshold) {
          const intensity = Math.min(1.5, (e.clientY - (rect.bottom - edgeThreshold)) / 30);
          startAutoScroll(-intensity * 14);
        } else {
          stopAutoScroll();
        }
      }
      return;
    }

    // 5. Resizing elements (Single and Multi-selection with Page Boundary & Element Smart Snapping)
    if (resizingHandle && selectedIds.length > 0) {
      const dx = (e.clientX - resizeStart.startX) / zoom;
      const dy = (e.clientY - resizeStart.startY) / zoom;
      const snapThreshold = Math.max(3, Math.min(14, 7 / Math.max(0.15, zoom)));

      if (selectedIds.length === 1) {
        const id = selectedIds[0];
        const start = resizeStart.elementsMap[id];
        if (!start) return;

        const excludeSet = getDescendantIds(elements, [id]);
        const res = computeResizeSnap({
          handle: resizingHandle,
          startAbs: { x: start.absX, y: start.absY, width: start.w, height: start.h },
          parentAbs: start.parentAbs,
          dx,
          dy,
          minSize: MIN_ELEMENT_SIZE,
          elements,
          canvasSettings,
          excludeIdsSet: excludeSet,
          threshold: snapThreshold,
        });

        setActiveGuides(res.guides);

        // If this container had children at resize start, clamp non-destructively from start.originalChildren
        if (Array.isArray(start.originalChildren) && start.originalChildren.length > 0) {
          const MARGIN = 8;
          const adjustedChildren = start.originalChildren.map(child => {
            let cx = child.x;
            let cy = child.y;
            if (typeof cx === 'number' && typeof child.width === 'number' && cx + child.width > res.width - MARGIN) {
              cx = Math.max(MARGIN, Math.round(res.width - child.width - MARGIN));
            }
            if (typeof cy === 'number' && typeof child.height === 'number' && cy + child.height > res.height - MARGIN) {
              cy = Math.max(MARGIN, Math.round(res.height - child.height - MARGIN));
            }
            return (cx !== child.x || cy !== child.y) ? { ...child, x: cx, y: cy } : child;
          });
          onUpdateElement({
            width: res.width,
            height: res.height,
            x: res.localX,
            y: res.localY,
            children: adjustedChildren,
          });
        } else {
          onUpdateElement({
            width: res.width,
            height: res.height,
            x: res.localX,
            y: res.localY,
          });
        }
      } else if (selectedIds.length > 1 && resizeStart.w > 0 && resizeStart.h > 0) {
        const excludeSet = getDescendantIds(elements, selectedIds);
        const res = computeResizeSnap({
          handle: resizingHandle,
          startAbs: { x: resizeStart.minX, y: resizeStart.minY, width: resizeStart.w, height: resizeStart.h },
          parentAbs: { x: 0, y: 0, width: canvasSettings.width, height: canvasSettings.height },
          dx,
          dy,
          minSize: MIN_MULTI_SIZE,
          elements,
          canvasSettings,
          excludeIdsSet: excludeSet,
          threshold: snapThreshold,
        });

        setActiveGuides(res.guides);

        const scaleX = res.width / resizeStart.w;
        const scaleY = res.height / resizeStart.h;

        const updatesMap = {};
        selectedIds.forEach(id => {
          const start = resizeStart.elementsMap[id];
          if (start) {
            const relOffsetX = start.absX - resizeStart.minX;
            const relOffsetY = start.absY - resizeStart.minY;
            const nextAbsX = res.absLeft + relOffsetX * scaleX;
            const nextAbsY = res.absTop + relOffsetY * scaleY;
            updatesMap[id] = {
              width: Math.max(16, Math.round(start.w * scaleX)),
              height: Math.max(16, Math.round(start.h * scaleY)),
              x: Math.round(nextAbsX - (start.parentAbs?.x || 0)),
              y: Math.round(nextAbsY - (start.parentAbs?.y || 0)),
            };
          }
        });
        onUpdateMultipleElements(updatesMap);
      }
    }
  };

  // Mouse Up handler (Completes move, Alt+Drag copy drop, draw, zoom, resize, pan, or auto-parenting)
  const handleMouseUp = (e) => {
    if (zoomBox) {
      const finishedZoom = zoomBox;
      setZoomBox(null);
      const rectW = Math.abs(finishedZoom.current.x - finishedZoom.start.x);
      const rectH = Math.abs(finishedZoom.current.y - finishedZoom.start.y);
      if (Math.hypot(rectW, rectH) >= 8) {
        zoomToWorldRect({
          x: Math.min(finishedZoom.start.x, finishedZoom.current.x),
          y: Math.min(finishedZoom.start.y, finishedZoom.current.y),
          width: rectW,
          height: rectH,
        });
      } else {
        const prevZ = latestZoomRef.current || 1;
        const step = (e?.altKey ?? finishedZoom.altKey) ? -0.25 : 0.25;
        zoomAtClientPoint(
          +(prevZ + step).toFixed(2),
          e?.clientX ?? finishedZoom.clientStartX,
          e?.clientY ?? finishedZoom.clientStartY
        );
      }
      return;
    }

    if (drawDraft) {
      const finishedDraft = { ...drawDraft, shiftKey: Boolean(e?.shiftKey ?? drawDraft.shiftKey) };
      setDrawDraft(null);
      commitDrawnElement(finishedDraft);
      return;
    }

    panModeRef.current = null;
    setIsPanning(false);
    setIsMarqueeActive(false);
    stopAutoScroll();
    setActiveGuides([]);
    dragStartBboxRef.current = null;

    const currentAltHeld = Boolean(e?.altKey ?? isAltPressedRef.current);

    if (isDraggingElement) {
      isDraggingRef.current = false;
      setIsDraggingElement(false);

      const draggedList = draggingIdsRef.current;
      draggingIdsRef.current = [];
      altDuplicateModeRef.current = false;
      setAltDuplicatePreview(null);

      if (currentAltHeld && hasMovedDuringDragRef.current && draggedList.length > 0 && onAltDuplicateElements) {
        const { dx, dy } = lastDragDeltaRef.current;
        const targetContainerForAlt =
          draggedList.length === 1 && dropTargetContainerId
            ? (dropTargetContainerId === 'root' ? null : dropTargetContainerId)
            : undefined;
        setDropTargetContainerId(null);
        onAltDuplicateElements(draggedList, dx, dy, targetContainerForAlt);
      } else if (!currentAltHeld && dropTargetContainerId && draggedList.length === 1) {
        const targetId = draggedList[0];
        if (dropTargetContainerId === 'root') {
          onReparentElement(targetId, null);
        } else {
          onReparentElement(targetId, dropTargetContainerId);
        }
        setDropTargetContainerId(null);
      } else {
        setDropTargetContainerId(null);
        if (hasMovedDuringDragRef.current && onCommitHistory) {
          onCommitHistory();
        }

        // Clicking inside multi-selection bounding box without dragging drills down to clicked element
        if (!hasMovedDuringDragRef.current && selectedIds.length > 1) {
          const clickedCoords = getCanvasLocalCoords(lastClientPosRef.current.x, lastClientPosRef.current.y);
          const hitChild = selectedIds.find(id => {
            const abs = getAbsoluteCoords(elements, id);
            return (
              abs &&
              clickedCoords.x >= abs.x &&
              clickedCoords.x <= (abs.x + abs.width) &&
              clickedCoords.y >= abs.y &&
              clickedCoords.y <= (abs.y + abs.height)
            );
          });
          if (hitChild) {
            onSelectElements([hitChild]);
          }
        }
      }
    }

    if (resizingHandle) {
      setResizingHandle(null);
      if (onCommitHistory) onCommitHistory();
    }

    setIsExtendingHeight(false);
  };

  // Window-level mousemove & mouseup listeners
  useEffect(() => {
    const isInteracting = Boolean(
      isDraggingElement || isPanning || isMarqueeActive || resizingHandle || isExtendingHeight || drawDraft || zoomBox
    );
    if (!isInteracting) return;

    const onGlobalMouseMove = (e) => handleMouseMove(e);
    const onGlobalMouseUp = (e) => handleMouseUp(e);

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isDraggingElement, isPanning, isMarqueeActive, resizingHandle, isExtendingHeight, drawDraft, zoomBox, handleMouseMove]);

  // Resize handle drag start
  const handleResizeMouseDown = (e, handle) => {
    e.stopPropagation();
    setResizingHandle(handle);

    const startElementsMap = {};
    selectedIds.forEach(id => {
      const found = findNodeAndParent(elements, id);
      const abs = getAbsoluteCoords(elements, id);
      if (found && found.node) {
        const parentAbs = found.parent
          ? getAbsoluteCoords(elements, found.parent.id)
          : { x: 0, y: 0, width: canvasSettings.width, height: canvasSettings.height };
        startElementsMap[id] = {
          x: found.node.x,
          y: found.node.y,
          w: found.node.width,
          h: found.node.height,
          absX: abs ? abs.x : found.node.x,
          absY: abs ? abs.y : found.node.y,
          parentAbs: parentAbs || { x: 0, y: 0, width: canvasSettings.width, height: canvasSettings.height },
          originalChildren: Array.isArray(found.node.children)
            ? found.node.children.map(c => ({ ...c }))
            : null,
        };
      }
    });

    if (bbox) {
      setResizeStart({
        minX: bbox.minX,
        minY: bbox.minY,
        w: bbox.width,
        h: bbox.height,
        startX: e.clientX,
        startY: e.clientY,
        elementsMap: startElementsMap
      });
    }
  };

  const bbox = getCombinedBoundingBox();

  // Compute Adobe/Figma-aware cursor style
  let cursorClass = 'cursor-default';
  if (isPanning) {
    cursorClass = 'cursor-grabbing';
  } else if (isSpacePressed || activeTool === 'hand') {
    cursorClass = 'cursor-grab';
  } else if (activeTool === 'zoom') {
    cursorClass = isAltPressed ? 'cursor-zoom-out' : 'cursor-zoom-in';
  } else if (activeTool === 'eyedropper' || activeTool === 'format_paint' || DRAW_TOOLS.includes(activeTool)) {
    cursorClass = 'cursor-crosshair';
  } else if (isAltPressed && !isDraggingElement) {
    cursorClass = hoveredCandidateId ? 'cursor-copy' : (selectedIds.length === 1 ? 'cursor-crosshair' : 'cursor-grab');
  }

  const nodeInteractionCursor = isPanning
    ? 'grabbing'
    : (isSpacePressed || activeTool === 'hand')
    ? 'grab'
    : activeTool === 'zoom'
    ? (isAltPressed ? 'zoom-out' : 'zoom-in')
    : (activeTool === 'eyedropper' || activeTool === 'format_paint' || DRAW_TOOLS.includes(activeTool))
    ? 'crosshair'
    : isAltPressed
    ? 'copy'
    : null;

  // Marquee, Zoom-Box, Draw-to-Create ghost rectangles
  const marqueeStyle = isMarqueeActive ? {
    left: `${Math.min(marqueeStart.x, marqueeCurrent.x)}px`,
    top: `${Math.min(marqueeStart.y, marqueeCurrent.y)}px`,
    width: `${Math.abs(marqueeCurrent.x - marqueeStart.x)}px`,
    height: `${Math.abs(marqueeCurrent.y - marqueeStart.y)}px`,
  } : null;

  const zoomBoxRect = zoomBox ? {
    left: Math.min(zoomBox.start.x, zoomBox.current.x),
    top: Math.min(zoomBox.start.y, zoomBox.current.y),
    width: Math.abs(zoomBox.current.x - zoomBox.start.x),
    height: Math.abs(zoomBox.current.y - zoomBox.start.y),
  } : null;

  const drawPreviewBox = drawDraft ? resolveDrawnBox(drawDraft.start, drawDraft.current, {
    shiftKey: drawDraft.shiftKey,
    isLine: drawDraft.tool === 'line',
    minDrag: 1,
    defaultSize: { width: 1, height: 1 },
  }) : null;

  // Alt + Hover Smart Distance Inspector segments (Figma-style red measurements)
  let altMeasureGuides = [];
  if (!previewMode && isAltPressed && !isDraggingElement && activeTool === 'select' && selectedIds.length === 1) {
    const srcAbs = getAbsoluteCoords(elements, selectedIds[0]);
    const targetAbs = altHoverTargetId && altHoverTargetId !== selectedIds[0]
      ? getAbsoluteCoords(elements, altHoverTargetId)
      : null;
    const foundSrc = findNodeAndParent(elements, selectedIds[0]);
    const parentAbs = foundSrc?.parent
      ? getAbsoluteCoords(elements, foundSrc.parent.id)
      : { x: 0, y: 0, width: canvasSettings.width, height: canvasSettings.height };
    altMeasureGuides = computeAltMeasureGuides(srcAbs, targetAbs, parentAbs);
  }

  // 🪜 BREADCRUMB PATH COMPUTATION
  const breadcrumbPath = selectedIds.length === 1 
    ? getNodePath(elements, selectedIds[0]) 
    : [];

  return (
    <div
      ref={containerRef}
      id="canvas-wrapper"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleCanvasContextMenu}
      className={`relative flex-1 h-full canvas-grid overflow-hidden select-none ${cursorClass}`}
    >
      {/* Pan & Zoom Transform container */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning || isDraggingElement || resizingHandle || isExtendingHeight || isMarqueeActive || drawDraft || zoomBox ? 'none' : 'transform 0.05s ease-out',
        }}
        className="absolute top-0 left-0 pb-32"
      >
        {/* 🌟 ARTBOARD HEADER & INTERACTIVE BREADCRUMB */}
        {!previewMode && (
          <div
            style={{
              transform: `scale(${Math.min(1.65, Math.max(1, +(0.88 / Math.max(zoom, 0.2)).toFixed(3)))})`,
              transformOrigin: 'bottom left',
            }}
            className="absolute -top-8 left-0 w-max whitespace-nowrap flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 select-none"
          >
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 bg-[#18181b]/95 backdrop-blur-md border border-[#2c2c32] px-2.5 py-1 rounded shadow-lg text-zinc-200">
              <button
                onClick={() => {
                  onSelectElements([]);
                  setEditingGroupId?.(null);
                }}
                className="hover:text-[#38bdf8] font-semibold flex items-center gap-1 transition-colors"
                title="Tüm seçimi kaldır ve tuval köküne dön"
              >
                <span>Tuval</span>
              </button>

              {breadcrumbPath.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <ChevronRight size={12} className="text-zinc-500" />
                  <button
                    onClick={() => {
                      setEditingGroupId?.(idx > 0 ? breadcrumbPath[idx - 1].id : null);
                      onSelectElements([item.id]);
                    }}
                    className={`hover:text-[#38bdf8] transition-colors flex items-center gap-1 ${
                      idx === breadcrumbPath.length - 1
                        ? 'text-[#38bdf8] font-semibold'
                        : editingGroupId === item.id
                        ? 'text-indigo-300 font-semibold underline decoration-indigo-400/60'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span>{item.name || `<${item.type}>`}</span>
                  </button>
                </React.Fragment>
              ))}

              {selectedIds.length > 1 && (
                <>
                  <ChevronRight size={12} className="text-zinc-500" />
                  <span className="text-[#38bdf8] font-semibold">
                    {selectedIds.length} Öğe Seçili
                  </span>
                </>
              )}
            </div>

            {editingGroupId && (
              <button
                onClick={() => {
                  onSelectParent?.();
                }}
                title="İçine girilen kapsayıcı katmandan bir üst katmana çık (Esc)"
                className="px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] font-semibold transition-colors inline-flex items-center gap-1.5 backdrop-blur-md shadow"
              >
                <FolderOpen size={11} className="text-indigo-300" />
                <span>İç Katman • Çık (Esc)</span>
              </button>
            )}

            <span className="text-zinc-500 tabular-nums">({canvasSettings.width} × {canvasSettings.height}px)</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                viewportMode === 'mobile'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : viewportMode === 'tablet'
                  ? 'bg-[#0d99ff]/15 text-[#38bdf8] border-[#0d99ff]/40'
                  : 'bg-[#18181b]/95 text-zinc-300 border-[#2c2c32]'
              }`}
            >
              {viewportMode === 'mobile' ? 'Mobil' : viewportMode === 'tablet' ? 'Tablet' : 'Masaüstü'}
            </span>
            {viewportMode !== 'desktop' && onResetViewportFromDesktop && (
              <button
                onClick={onResetViewportFromDesktop}
                title="Bu cihaz tasarımını masaüstü tasarımından yeniden uyarla"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#18181b]/95 hover:bg-[#0d99ff]/15 text-zinc-300 hover:text-[#38bdf8] border border-[#2c2c32] hover:border-[#0d99ff]/40 transition-colors"
              >
                <RefreshCw size={10} />
                <span>Masaüstünden Uyarla</span>
              </button>
            )}
            <span className="px-2 py-0.5 bg-[#18181b]/95 rounded text-[10px] text-zinc-200 tabular-nums border border-[#2c2c32]">
              %{Math.round(zoom * 100)}
            </span>
          </div>
        )}

        {/* 🌟 ARTBOARD CANVAS CONTAINER */}
        <div
          id="artboard-canvas"
          style={{
            width: `${canvasSettings.width}px`,
            height: `${canvasSettings.height}px`,
            background: canvasSettings.backgroundColor || canvasSettings.background || '#ffffff',
            boxShadow: previewMode 
              ? '0 28px 70px rgba(0, 0, 0, 0.55)' 
              : '0 24px 64px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          }}
          className={`relative transition-[border-radius,border-color,box-shadow] duration-200 ${
            previewMode 
              ? viewportMode === 'mobile' 
                ? 'rounded-[36px] overflow-hidden border-[8px] border-[#222]' 
                : viewportMode === 'tablet' 
                  ? 'rounded-[20px] overflow-hidden border-[6px] border-[#222]' 
                  : 'rounded-none'
              : ''
          }`}
        >
          {/* 🌟 12-COLUMN RESPONSIVE WEB LAYOUT GRID OVERLAY (Shift+G) */}
          {!previewMode && showLayoutGrid && (
            <div
              data-layout-grid-overlay
              className="absolute inset-0 pointer-events-none z-[140]"
              style={{
                paddingLeft: viewportMode === 'mobile' ? '16px' : viewportMode === 'tablet' ? '24px' : '48px',
                paddingRight: viewportMode === 'mobile' ? '16px' : viewportMode === 'tablet' ? '24px' : '48px',
                display: 'grid',
                gridTemplateColumns: `repeat(${viewportMode === 'mobile' ? 4 : viewportMode === 'tablet' ? 8 : 12}, minmax(0, 1fr))`,
                gap: viewportMode === 'mobile' ? '12px' : '20px',
              }}
            >
              {Array.from({ length: viewportMode === 'mobile' ? 4 : viewportMode === 'tablet' ? 8 : 12 }).map((_, colIdx) => (
                <div
                  key={`grid-col-${colIdx}`}
                  className="h-full bg-rose-500/[0.08] border-x border-rose-500/20"
                />
              ))}
            </div>
          )}

          {/* Recursively Render Tree Elements */}
          {elements.map((el) => (
            <CanvasNode
              key={el.id}
              node={el}
              depth={0}
              elements={elements}
              selectedIds={selectedIds}
              editingGroupId={editingGroupId}
              hoveredCandidateId={hoveredCandidateId}
              dropTargetContainerId={dropTargetContainerId}
              onNodeMouseDown={handleNodeMouseDown}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              editingTextNodeId={editingTextNodeId}
              setEditingTextNodeId={setEditingTextNodeId}
              onUpdateElementText={handleUpdateElementText}
              onCommitHistory={onCommitHistory}
              previewMode={previewMode}
              previewRuntimeOverrides={previewRuntimeOverrides}
              onPreviewExecuteEvent={onPreviewExecuteEvent}
              onPreviewInputChange={onPreviewInputChange}
              viewportMode={viewportMode}
              canvasSettings={canvasSettings}
              interactionCursor={nodeInteractionCursor}
              aiHighlightedIds={aiHighlightedIds}
            />
          ))}

          {/* 📋 Adobe-style Alt+Drag Duplication Ghost Preview */}
          {!previewMode && altDuplicatePreview && altDuplicatePreview.items?.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-[145]">
              {altDuplicatePreview.items.map((item) => (
                <CanvasNode
                  key={`ghost-${item.id}`}
                  node={{ ...item.node, x: item.absX, y: item.absY }}
                  depth={0}
                  elements={elements}
                  selectedIds={[]}
                  hoveredCandidateId={null}
                  dropTargetContainerId={null}
                  editingTextNodeId={null}
                  setEditingTextNodeId={() => {}}
                  onUpdateElementText={() => {}}
                  onCommitHistory={() => {}}
                  previewMode={true}
                  viewportMode={viewportMode}
                  canvasSettings={canvasSettings}
                  isPreviewGhost={true}
                />
              ))}
              {altDuplicatePreview.bbox && (
                <div
                  style={{
                    left: `${altDuplicatePreview.bbox.minX}px`,
                    top: `${altDuplicatePreview.bbox.minY}px`,
                    width: `${altDuplicatePreview.bbox.width}px`,
                    height: `${altDuplicatePreview.bbox.height}px`,
                  }}
                  className="absolute border-2 border-dashed border-emerald-400 bg-emerald-400/5 pointer-events-none"
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
                    Kopyalanacak ({Math.round(altDuplicatePreview.bbox.minX)}, {Math.round(altDuplicatePreview.bbox.minY)})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🌟 SELECTION BOUNDING BOX & 8 RESIZE HANDLES */}
          {!previewMode && bbox && selectedIds.length > 0 && (
            <div
              onMouseDown={(e) => {
                if (previewMode || activeTool !== 'select') return;
                if (isSpacePressedRef.current || activeTool === 'hand') return;
                e.stopPropagation();
                startElementDrag(e, selectedIds);
              }}
              style={{
                position: 'absolute',
                left: `${bbox.minX}px`,
                top: `${bbox.minY}px`,
                width: `${bbox.width}px`,
                height: `${bbox.height}px`,
                border: '2px solid #3b82f6',
                backgroundColor: selectedIds.length > 1 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                pointerEvents: selectedIds.length > 1 ? 'auto' : 'none',
                cursor: isPanning
                  ? 'grabbing'
                  : (isSpacePressed || activeTool === 'hand')
                  ? 'grab'
                  : isAltPressed
                  ? 'copy'
                  : (selectedIds.length > 1 ? 'move' : 'default'),
                zIndex: 150,
              }}
            >
              {/* Size tooltip badge */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-mono text-[9px] px-2 py-0.5 rounded shadow whitespace-nowrap flex items-center gap-1.5 pointer-events-none">
                <span>{Math.round(bbox.width)} × {Math.round(bbox.height)}</span>
                {selectedIds.length > 1 && (
                  <span className="bg-blue-800 px-1 rounded text-[8px] font-bold">
                    {selectedIds.length} Öğe
                  </span>
                )}
              </div>

              {/* 🟢 Two Elements Side-by-Side & Distance Pill Badge */}
              {selectedIds.length === 2 && (() => {
                const el1 = findNodeAndParent(elements, selectedIds[0]);
                const el2 = findNodeAndParent(elements, selectedIds[1]);
                if (!el1?.node || !el2?.node) return null;
                const a1 = getAbsoluteCoords(elements, el1.node.id);
                const a2 = getAbsoluteCoords(elements, el2.node.id);
                const isTopAligned = Math.abs(a1.y - a2.y) <= 3;
                const isCenterAligned = Math.abs((a1.y + a1.height / 2) - (a2.y + a2.height / 2)) <= 3;
                const leftBox = a1.x <= a2.x ? a1 : a2;
                const rightBox = a1.x <= a2.x ? a2 : a1;
                const gap = Math.round(rightBox.x - (leftBox.x + leftBox.width));
                
                let alignText = '';
                if (isTopAligned) alignText = 'Yan Yana (Üst Hiza)';
                else if (isCenterAligned) alignText = 'Yan Yana (Merkez Hiza)';

                return (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-emerald-950/95 backdrop-blur border border-emerald-500/60 text-emerald-300 font-mono text-[9px] px-2.5 py-0.5 rounded-md shadow-lg whitespace-nowrap flex items-center gap-1.5 pointer-events-none z-30">
                    {alignText && (
                      <span className="font-bold inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        {alignText}
                      </span>
                    )}
                    {alignText && <span className="opacity-40">•</span>}
                    <span className="text-white font-semibold">↔ {gap >= 0 ? `${gap}px Boşluk` : 'Üst Üste'}</span>
                  </div>
                );
              })()}

              {/* 8 Resize Handles */}
              {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                let handleStyle = {};
                if (handle === 'nw') handleStyle = { top: -5, left: -5, cursor: 'nwse-resize' };
                if (handle === 'n') handleStyle = { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
                if (handle === 'ne') handleStyle = { top: -5, right: -5, cursor: 'nesw-resize' };
                if (handle === 'e') handleStyle = { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' };
                if (handle === 'se') handleStyle = { bottom: -5, right: -5, cursor: 'nwse-resize' };
                if (handle === 's') handleStyle = { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
                if (handle === 'sw') handleStyle = { bottom: -5, left: -5, cursor: 'nesw-resize' };
                if (handle === 'w') handleStyle = { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' };

                return (
                  <div
                    key={handle}
                    onMouseDown={(e) => handleResizeMouseDown(e, handle)}
                    style={{
                      ...handleStyle,
                      width: 9,
                      height: 9,
                      position: 'absolute',
                      pointerEvents: 'auto',
                    }}
                    className="bg-white border-2 border-blue-600 rounded-sm hover:scale-125 transition-transform"
                  />
                );
              })}
            </div>
          )}

          {/* 🌟 MARQUEE SELECTION RECTANGLE */}
          {isMarqueeActive && marqueeStyle && (
            <div
              style={{
                position: 'absolute',
                ...marqueeStyle,
                border: '1px dashed #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.18)',
                pointerEvents: 'none',
                zIndex: 200,
              }}
            />
          )}

          {/* ✏️ LIVE DRAG-TO-DRAW GHOST PREVIEW */}
          {!previewMode && drawDraft && drawPreviewBox && (
            <div
              data-draw-ghost
              style={{
                position: 'absolute',
                left: `${drawPreviewBox.x}px`,
                top: `${drawPreviewBox.y}px`,
                width: `${drawPreviewBox.width}px`,
                height: `${drawPreviewBox.height}px`,
                borderRadius: drawDraft.tool === 'circle' ? '9999px' : drawDraft.tool === 'frame' ? '16px' : drawDraft.tool === 'rectangle' ? '14px' : '2px',
                border: '2px solid #0d99ff',
                backgroundColor: drawDraft.tool === 'line' ? '#0d99ff' : 'rgba(13, 153, 255, 0.14)',
                pointerEvents: 'none',
                zIndex: 210,
              }}
            >
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#0d99ff] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
                {drawPreviewBox.width} × {drawPreviewBox.height} px
              </div>
            </div>
          )}

          {/* 🔍 ZOOM-TO-BOX RECTANGLE */}
          {!previewMode && zoomBoxRect && zoomBoxRect.width >= 4 && zoomBoxRect.height >= 4 && (
            <div
              data-zoom-box
              style={{
                position: 'absolute',
                left: `${zoomBoxRect.left}px`,
                top: `${zoomBoxRect.top}px`,
                width: `${zoomBoxRect.width}px`,
                height: `${zoomBoxRect.height}px`,
                border: '1.5px dashed #38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                pointerEvents: 'none',
                zIndex: 210,
              }}
            />
          )}

          {/* 📏 ALT + HOVER SMART DISTANCE INSPECTOR OVERLAY */}
          {!previewMode && altMeasureGuides.length > 0 && (
            <svg
              data-alt-measure-svg
              className="absolute inset-0 pointer-events-none z-[195] overflow-visible"
              style={{ width: `${canvasSettings.width}px`, height: `${canvasSettings.height}px` }}
            >
              {altMeasureGuides.map((g, idx) => {
                const midX = (g.x1 + g.x2) / 2;
                const midY = (g.y1 + g.y2) / 2;
                const label = `${g.gap}`;
                const w = Math.max(24, label.length * 6.5 + 10);
                return (
                  <g key={`alt-measure-${idx}`}>
                    <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#f43f5e" strokeWidth="1.5" />
                    {g.axis === 'x' ? (
                      <>
                        <line x1={g.x1} y1={g.y1 - 4} x2={g.x1} y2={g.y1 + 4} stroke="#f43f5e" strokeWidth="1.5" />
                        <line x1={g.x2} y1={g.y2 - 4} x2={g.x2} y2={g.y2 + 4} stroke="#f43f5e" strokeWidth="1.5" />
                      </>
                    ) : (
                      <>
                        <line x1={g.x1 - 4} y1={g.y1} x2={g.x1 + 4} y2={g.y1} stroke="#f43f5e" strokeWidth="1.5" />
                        <line x1={g.x2 - 4} y1={g.y2} x2={g.x2 + 4} y2={g.y2} stroke="#f43f5e" strokeWidth="1.5" />
                      </>
                    )}
                    <rect x={midX - w / 2} y={midY - 8} width={w} height="16" rx="4" fill="#f43f5e" />
                    <text
                      x={midX}
                      y={midY + 3}
                      fill="#ffffff"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* ↕ BOTTOM EXTENDER HANDLE: Drag to extend page height */}
          {!previewMode && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsExtendingHeight(true);
                setHeightDragStartY(e.clientY);
                setInitialHeight(canvasSettings.height);
              }}
              className="absolute -bottom-7 left-0 w-full h-6 flex items-center justify-center cursor-ns-resize group"
            >
              <div
                style={{
                  transform: `scale(${Math.min(1.65, Math.max(1, +(0.88 / Math.max(zoom, 0.2)).toFixed(3)))})`,
                  transformOrigin: 'top center',
                }}
                className="px-3 py-0.5 rounded bg-[#18181b]/95 backdrop-blur hover:bg-[#0d99ff] border border-[#2c2c32] hover:border-[#0d99ff] text-zinc-400 hover:text-white font-medium text-[10px] flex items-center gap-1.5 shadow-lg transition-colors whitespace-nowrap"
              >
                <MoveVertical size={11} />
                <span>Sayfa Boyunu Uzat ({canvasSettings.height}px)</span>
              </div>
            </div>
          )}
          {/* 🌟 ADOBE / FIGMA SMART ALIGNMENT GUIDES OVERLAY */}
          {!previewMode && activeGuides.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none z-[180] overflow-visible"
              style={{ width: `${canvasSettings.width}px`, height: `${canvasSettings.height}px` }}
            >
              {activeGuides
                .filter(guide => {
                  if (guide.type === 'gap-h') {
                    return Number.isFinite(guide.x1) && Number.isFinite(guide.x2) && Number.isFinite(guide.y);
                  }
                  if (guide.type === 'gap-v') {
                    return Number.isFinite(guide.y1) && Number.isFinite(guide.y2) && Number.isFinite(guide.x);
                  }
                  if (guide.type === 'vertical') {
                    return Number.isFinite(guide.x) && Number.isFinite(guide.minY) && Number.isFinite(guide.maxY);
                  }
                  return Number.isFinite(guide.y) && Number.isFinite(guide.minX) && Number.isFinite(guide.maxX);
                })
                .map((guide, idx) => {
                  if (guide.type === 'gap-h') {
                    const midX = (guide.x1 + guide.x2) / 2;
                    const badgeFill = guide.isEqualGap ? '#047857' : '#1d4ed8';
                    const lineColor = guide.isEqualGap ? '#10b981' : '#3b82f6';
                    const badgeText = guide.isEqualGap ? `=${guide.gap}px` : `↔ ${guide.gap}px`;
                    const badgeW = Math.max(54, badgeText.length * 7 + 14);
                    const bx = Math.max(4, Math.min(canvasSettings.width - badgeW - 4, midX - badgeW / 2));
                    const by = Math.max(4, guide.y - 11);
                    return (
                      <g key={`guide-gaph-${idx}`}>
                        <line x1={guide.x1} y1={guide.y} x2={guide.x2} y2={guide.y} stroke={lineColor} strokeWidth="1.5" />
                        <line x1={guide.x1} y1={guide.y - 6} x2={guide.x1} y2={guide.y + 6} stroke={lineColor} strokeWidth="1.5" />
                        <line x1={guide.x2} y1={guide.y - 6} x2={guide.x2} y2={guide.y + 6} stroke={lineColor} strokeWidth="1.5" />
                        <rect
                          x={bx}
                          y={by}
                          width={badgeW}
                          height="20"
                          rx="5"
                          fill={badgeFill}
                          stroke="#ffffff"
                          strokeWidth="0.6"
                        />
                        <text
                          x={bx + badgeW / 2}
                          y={by + 13}
                          fill="#ffffff"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {badgeText}
                        </text>
                      </g>
                    );
                  } else if (guide.type === 'gap-v') {
                    const midY = (guide.y1 + guide.y2) / 2;
                    const badgeFill = guide.isEqualGap ? '#047857' : '#1d4ed8';
                    const lineColor = guide.isEqualGap ? '#10b981' : '#3b82f6';
                    const badgeText = guide.isEqualGap ? `=${guide.gap}px` : `↕ ${guide.gap}px`;
                    const badgeW = Math.max(54, badgeText.length * 7 + 14);
                    const bx = Math.max(4, Math.min(canvasSettings.width - badgeW - 4, guide.x - badgeW / 2));
                    const by = Math.max(4, midY - 10);
                    return (
                      <g key={`guide-gapv-${idx}`}>
                        <line x1={guide.x} y1={guide.y1} x2={guide.x} y2={guide.y2} stroke={lineColor} strokeWidth="1.5" />
                        <line x1={guide.x - 6} y1={guide.y1} x2={guide.x + 6} y2={guide.y1} stroke={lineColor} strokeWidth="1.5" />
                        <line x1={guide.x - 6} y1={guide.y2} x2={guide.x + 6} y2={guide.y2} stroke={lineColor} strokeWidth="1.5" />
                        <rect
                          x={bx}
                          y={by}
                          width={badgeW}
                          height="20"
                          rx="5"
                          fill={badgeFill}
                          stroke="#ffffff"
                          strokeWidth="0.6"
                        />
                        <text
                          x={bx + badgeW / 2}
                          y={by + 13}
                          fill="#ffffff"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {badgeText}
                        </text>
                      </g>
                    );
                  } else if (guide.type === 'vertical') {
                    const strokeColor = guide.isPageEdge ? '#ec4899' : '#f43f5e';
                    const badgeText = guide.label || `${Math.round(guide.x)}px`;
                    const badgeW = Math.max(60, badgeText.length * 6.5 + 14);
                    const bx = Math.max(4, Math.min(canvasSettings.width - badgeW - 4, guide.x - badgeW / 2));
                    const by = Math.max(4, guide.minY + 6);
                    return (
                      <g key={`guide-v-${idx}`}>
                        <line
                          x1={guide.x}
                          y1={guide.minY}
                          x2={guide.x}
                          y2={guide.maxY}
                          stroke={strokeColor}
                          strokeWidth={guide.isPageEdge ? '2' : '1.5'}
                          strokeDasharray={guide.isPageEdge ? undefined : '4 3'}
                        />
                        {Number.isFinite(guide.snapY) && (
                          <circle cx={guide.x} cy={guide.snapY} r="3.5" fill={strokeColor} />
                        )}
                        <rect
                          x={bx}
                          y={by}
                          width={badgeW}
                          height="17"
                          rx="4"
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="0.5"
                        />
                        <text
                          x={bx + badgeW / 2}
                          y={by + 12}
                          fill="#ffffff"
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {badgeText}
                        </text>
                      </g>
                    );
                  } else {
                    const isEmerald = guide.isSideBySide;
                    const strokeColor = guide.isPageEdge ? '#ec4899' : isEmerald ? '#10b981' : '#f43f5e';
                    const badgeText = guide.label || `${Math.round(guide.y)}px`;
                    const badgeWidth = Math.max(58, badgeText.length * 6.6 + 14);
                    const bx = Math.max(4, Math.min(canvasSettings.width - badgeWidth - 4, guide.minX + 8));
                    const by = guide.y < 24 ? guide.y + 4 : guide.y - 20;

                    return (
                      <g key={`guide-h-${idx}`}>
                        <line
                          x1={guide.minX}
                          y1={guide.y}
                          x2={guide.maxX}
                          y2={guide.y}
                          stroke={strokeColor}
                          strokeWidth={guide.isPageEdge || isEmerald ? '2' : '1.5'}
                          strokeDasharray={guide.isPageEdge || isEmerald ? undefined : '4 3'}
                        />
                        {Number.isFinite(guide.snapX) && (
                          <circle cx={guide.snapX} cy={guide.y} r="4" fill={strokeColor} />
                        )}
                        <rect
                          x={bx}
                          y={by}
                          width={badgeWidth}
                          height="18"
                          rx="5"
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="0.5"
                        />
                        <text
                          x={bx + badgeWidth / 2}
                          y={by + 12}
                          fill="#ffffff"
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {badgeText}
                        </text>
                      </g>
                    );
                  }
                })}
            </svg>
          )}
        </div>
      </div>

      {/* 📏 PIXEL RULERS OVERLAY (Shift+R) */}
      {!previewMode && showRulers && (() => {
        const rawStep = 80 / Math.max(0.2, zoom);
        const step = rawStep <= 25 ? 25 : rawStep <= 50 ? 50 : rawStep <= 100 ? 100 : rawStep <= 200 ? 200 : 400;
        const containerW = containerRef.current?.clientWidth || 1600;
        const containerH = containerRef.current?.clientHeight || 1000;
        const startX = Math.floor((-panOffset.x) / zoom / step) * step;
        const endX = Math.ceil((containerW - panOffset.x) / zoom / step) * step;
        const startY = Math.floor((-panOffset.y) / zoom / step) * step;
        const endY = Math.ceil((containerH - panOffset.y) / zoom / step) * step;
        const xTicks = [];
        for (let v = startX; v <= endX && xTicks.length < 80; v += step) xTicks.push(v);
        const yTicks = [];
        for (let v = startY; v <= endY && yTicks.length < 80; v += step) yTicks.push(v);

        return (
          <>
            <div data-ruler="top" className="absolute top-0 left-5 right-0 h-5 bg-[#121216]/95 border-b border-[#2c2c34] pointer-events-none z-30 overflow-hidden">
              {bbox && (
                <div
                  className="absolute top-0 bottom-0 bg-[#0d99ff]/25 border-x border-[#0d99ff]/70"
                  style={{
                    left: `${Math.round(panOffset.x + bbox.minX * zoom - 20)}px`,
                    width: `${Math.max(2, Math.round(bbox.width * zoom))}px`,
                  }}
                />
              )}
              {xTicks.map((val) => {
                const screenX = Math.round(panOffset.x + val * zoom - 20);
                return (
                  <div
                    key={`rx-${val}`}
                    className="absolute top-0 bottom-0 border-l border-zinc-600/70 pl-1 text-[9px] font-mono text-zinc-400 leading-[18px]"
                    style={{ left: `${screenX}px` }}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
            <div data-ruler="left" className="absolute top-5 left-0 bottom-0 w-5 bg-[#121216]/95 border-r border-[#2c2c34] pointer-events-none z-30 overflow-hidden">
              {bbox && (
                <div
                  className="absolute left-0 right-0 bg-[#0d99ff]/25 border-y border-[#0d99ff]/70"
                  style={{
                    top: `${Math.round(panOffset.y + bbox.minY * zoom - 20)}px`,
                    height: `${Math.max(2, Math.round(bbox.height * zoom))}px`,
                  }}
                />
              )}
              {yTicks.map((val) => {
                const screenY = Math.round(panOffset.y + val * zoom - 20);
                return (
                  <div
                    key={`ry-${val}`}
                    className="absolute left-0 right-0 border-t border-zinc-600/70 pt-0.5 text-[8px] font-mono text-zinc-400 text-center"
                    style={{ top: `${screenY}px` }}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
            <div className="absolute top-0 left-0 w-5 h-5 bg-[#16161b] border-r border-b border-[#2c2c34] pointer-events-none z-30 flex items-center justify-center text-[8px] font-mono text-zinc-500">
              px
            </div>
          </>
        );
      })()}

      {/* 🎯 ACTIVE TOOL FLOATING HINT BAR */}
      {!previewMode && activeTool !== 'select' && (
        <div className="absolute top-7 left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="px-3 py-1 rounded-full bg-[#121216]/90 backdrop-blur border border-[#32323c] shadow-xl text-[11px] text-zinc-200 flex items-center gap-2 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0d99ff]" />
            <span>
              {activeTool === 'zoom'
                ? 'Büyüteç: Tıkla Yakınlaş · Alt+Tıkla Uzaklaş · Sürükle Odaklan'
                : activeTool === 'eyedropper'
                  ? 'Damlalık: Rengi örnekle & seçili öğeye uygula (Esc: İptal)'
                  : activeTool === 'format_paint'
                    ? 'Biçim Boyacısı: Stili uygulamak için hedef öğeye tıkla (Esc: İptal)'
                    : activeTool === 'hand'
                      ? 'El Aracı: Tuvali sürükleyerek kaydır'
                      : 'Sürükleyerek çiz veya tıkla (Shift: Orantılı · Esc: Seçim)'}
            </span>
          </div>
        </div>
      )}

      {/* Top-Right Compact Canvas Telemetry & Control Hint (keeps bottom-center clear for Floating AI Dock) */}
      {!previewMode && (
        <div className={`hidden lg:flex absolute right-3 items-center gap-2 pointer-events-none z-20 ${showRulers ? 'top-7' : 'top-2.5'}`}>
          <div className="bg-[#18181b]/90 backdrop-blur border border-[#2c2c32] px-2.5 py-1 rounded text-[10px] font-mono tabular-nums text-zinc-400 flex items-center gap-2 shadow-lg whitespace-nowrap">
            <span className="hidden 2xl:inline text-zinc-500">Boşluk: Kaydır · Ctrl+Tekerlek: Zoom</span>
            <span className="hidden 2xl:inline text-zinc-700">|</span>
            <span className="text-[#38bdf8] uppercase">{viewportMode}</span>
            <span className="text-zinc-700">|</span>
            <span>{canvasSettings.width} × {canvasSettings.height} px</span>
            <span className="text-zinc-700">|</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      )}

      {/* 🧪 EYEDROPPER LIVE FLOATING COLOR HUD */}
      {!previewMode && activeTool === 'eyedropper' && eyedropperSample && (
        <div
          data-eyedropper-hud
          style={{
            position: 'fixed',
            left: `${eyedropperSample.clientX + 18}px`,
            top: `${eyedropperSample.clientY + 18}px`,
          }}
          className="pointer-events-none z-[120] flex items-center gap-2 rounded-lg border border-[#3a3a46] bg-[#121216]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur"
        >
          <span
            className="w-5 h-5 rounded-md border border-white/25 shrink-0"
            style={{ backgroundColor: eyedropperSample.hex }}
          />
          <div className="leading-tight font-mono">
            <div className="text-[11px] font-bold text-white">{eyedropperSample.hex}</div>
            {eyedropperSample.contrastWithBg && eyedropperSample.contrastWithBg > 1 && (
              <div className="text-[9px] text-zinc-400">
                Kontrast: {eyedropperSample.contrastWithBg}:1
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🖱️ CANVAS RIGHT-CLICK CONTEXT MENU */}
      {!previewMode && contextMenu && (
        <div
          data-canvas-context-menu
          style={{ position: 'fixed', left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="z-[150] w-56 rounded-xl border border-[#34343e] bg-[#141418]/98 p-1.5 shadow-2xl backdrop-blur-xl text-[12px] text-zinc-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.targetId ? (
            <>
              {[
                { label: 'Çoğalt', hint: 'Ctrl+D', icon: CopyPlus, run: onDuplicateSelected },
                { label: 'Kopyala', hint: 'Ctrl+C', icon: Copy, run: onCopySelected },
                { label: 'Kes', hint: 'Ctrl+X', icon: Scissors, run: onCutSelected },
                canPasteClipboard && { label: 'Yapıştır', hint: 'Ctrl+V', icon: Clipboard, run: onPasteFromClipboard },
                'divider',
                { label: 'Biçimi Kopyala', hint: 'Ctrl+Shift+C', icon: Paintbrush, run: () => onCopyStyle?.({ activateTool: true, sourceId: contextMenu.targetId }) },
                copiedStyle && { label: 'Biçimi Yapıştır', hint: 'Ctrl+Shift+V', icon: Paintbrush, run: () => onPasteStyle?.(selectedIds.length ? selectedIds : [contextMenu.targetId]) },
                'divider',
                { label: 'En Öne Getir', hint: 'Ctrl+]', icon: ArrowUpToLine, run: () => onZOrderSelected?.('front') },
                { label: 'Öne Getir', hint: ']', icon: ArrowUpToLine, run: () => onZOrderSelected?.('forward') },
                { label: 'Arkaya Gönder', hint: '[', icon: ArrowDownToLine, run: () => onZOrderSelected?.('backward') },
                { label: 'En Arkaya Gönder', hint: 'Ctrl+[', icon: ArrowDownToLine, run: () => onZOrderSelected?.('back') },
                'divider',
                { label: 'Yatay Ortala', hint: '', icon: AlignCenterHorizontal, run: onAlignHorizontalCenter },
                { label: 'Dikey Ortala', hint: '', icon: AlignCenterVertical, run: onAlignVerticalCenter },
                { label: 'Grupla', hint: 'Ctrl+G', icon: Group, run: onGroupSelected },
                { label: 'Grubu Çöz', hint: 'Ctrl+Shift+G', icon: Ungroup, run: onUngroupSelected },
                'divider',
                { label: 'Kilitle / Aç', hint: 'Ctrl+Shift+L', icon: Lock, run: () => onToggleLockSelected?.() },
                { label: 'Gizle / Göster', hint: '', icon: EyeOff, run: () => onToggleHideSelected?.() },
                { label: 'Sil', hint: 'Del', icon: Trash2, danger: true, run: onDeleteSelected },
              ]
                .filter(Boolean)
                .map((item, idx) => {
                  if (item === 'divider') {
                    return <div key={`ctx-div-${idx}`} className="my-1 border-t border-[#26262f]" />;
                  }
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.run?.();
                        setContextMenu(null);
                      }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                        item.danger
                          ? 'text-rose-300 hover:bg-rose-500/20 hover:text-rose-200'
                          : 'text-zinc-200 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      <Icon size={13} className={item.danger ? 'text-rose-400 shrink-0' : 'text-zinc-400 shrink-0'} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <kbd className="text-[10px] font-mono text-zinc-500">{item.hint}</kbd>}
                    </button>
                  );
                })}
            </>
          ) : (
            <>
              {[
                canPasteClipboard && { label: 'Buraya Yapıştır', hint: 'Ctrl+V', icon: Clipboard, run: onPasteFromClipboard },
                { label: '12 Sütun Izgara', hint: 'Shift+G', icon: Grid3x3, active: showLayoutGrid, run: () => setShowLayoutGrid?.((v) => !v) },
                { label: 'Piksel Cetvelleri', hint: 'Shift+R', icon: Ruler, active: showRulers, run: () => setShowRulers?.((v) => !v) },
                { label: 'Ekrana Sığdır', hint: 'Ctrl+0', icon: Maximize2, run: onResetZoom },
              ]
                .filter(Boolean)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.run?.();
                        setContextMenu(null);
                      }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                        item.active
                          ? 'bg-[#0d99ff]/15 text-[#7dd3fc]'
                          : 'text-zinc-200 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      <Icon size={13} className="shrink-0 opacity-80" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <kbd className="text-[10px] font-mono text-zinc-500">{item.hint}</kbd>}
                    </button>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
