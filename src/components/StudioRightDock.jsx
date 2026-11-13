import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Box,
  Tag as TagIcon,
  Sparkles,
  Code2,
  Bot,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  ChevronsRight,
} from 'lucide-react';

const MIN_DOCK_WIDTH = 308;
const MAX_DOCK_WIDTH = 560;
export const DEFAULT_RIGHT_DOCK_WIDTH = 360;

/**
 * Obsidian Studio Right Workspace Dock + Vertical Tool Rail.
 * Provides a draggable width splitter, docked Properties/AI switcher,
 * direct icon-rail tab triggers, and one-click pop-out to the floating inspector.
 */
export default function StudioRightDock({
  isOpen = true,
  activeModule = 'properties',
  propertiesTab = 'layout',
  dockWidth = DEFAULT_RIGHT_DOCK_WIDTH,
  onChangeDockWidth,
  onSelectDockTarget,
  onToggleCollapse,
  onOpenFloatingInspector,
  isFloatingInspectorOpen = false,
  propertiesContent,
  aiAgentContent,
}) {
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef(null);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handlePointerMove = (e) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const dx = state.startX - e.clientX;
      const maxAllowed = Math.min(MAX_DOCK_WIDTH, Math.floor(window.innerWidth * 0.48));
      const clamped = Math.max(MIN_DOCK_WIDTH, Math.min(maxAllowed, state.startWidth + dx));
      onChangeDockWidth?.(clamped);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, onChangeDockWidth]);

  const railItems = [
    {
      id: 'prop-style',
      label: 'Stil ve Görünüm',
      icon: Sliders,
      isActive: isOpen && activeModule === 'properties' && propertiesTab === 'style',
      accent: 'text-white bg-[#23232b] border-[#383844]',
      indicator: 'bg-[#0d99ff]',
      onClick: () => onSelectDockTarget('properties', 'style'),
    },
    {
      id: 'prop-layout',
      label: 'Düzen ve Konum',
      icon: Box,
      isActive: isOpen && activeModule === 'properties' && propertiesTab === 'layout',
      accent: 'text-white bg-[#23232b] border-[#383844]',
      indicator: 'bg-[#0d99ff]',
      onClick: () => onSelectDockTarget('properties', 'layout'),
    },
    {
      id: 'prop-props',
      label: 'HTML Nitelikleri & Eylem',
      icon: TagIcon,
      isActive: isOpen && activeModule === 'properties' && propertiesTab === 'props',
      accent: 'text-[#7dd3fc] bg-[#1a222b] border-[#2c435a]',
      indicator: 'bg-[#0d99ff]',
      onClick: () => onSelectDockTarget('properties', 'props'),
    },
    {
      id: 'prop-css',
      label: 'CSS Kuralları',
      icon: Sparkles,
      isActive: isOpen && activeModule === 'properties' && propertiesTab === 'css',
      accent: 'text-white bg-[#23232b] border-[#383844]',
      indicator: 'bg-[#0d99ff]',
      onClick: () => onSelectDockTarget('properties', 'css'),
    },
    {
      id: 'prop-code',
      label: 'Canlı HTML & CSS Kodu',
      icon: Code2,
      isActive: isOpen && activeModule === 'properties' && propertiesTab === 'code',
      accent: 'text-white bg-[#23232b] border-[#383844]',
      indicator: 'bg-[#0d99ff]',
      onClick: () => onSelectDockTarget('properties', 'code'),
    },
  ];

  return (
    <div className="flex h-full shrink-0 z-20 select-none relative">
      {/* Resizable Docked Drawer */}
      {isOpen && (
        <div
          style={{ width: `${dockWidth}px` }}
          className="relative h-full bg-[#18181b] border-l border-[#2c2c32] flex flex-col min-w-0"
        >
          {/* Left Edge Smooth Width Splitter */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              resizeStateRef.current = { startX: e.clientX, startWidth: dockWidth };
              setIsResizing(true);
            }}
            onDoubleClick={() => onChangeDockWidth?.(DEFAULT_RIGHT_DOCK_WIDTH)}
            title="Panel genişliğini sürükle (çift tıkla: varsayılan)"
            className={`absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize z-30 transition-colors flex items-center justify-center group ${
              isResizing ? 'bg-[#0d99ff]/45' : 'hover:bg-[#0d99ff]/20'
            }`}
          >
            <span className={`w-0.5 h-10 rounded-sm transition-all ${
              isResizing
                ? 'bg-[#0d99ff] opacity-100 h-16'
                : 'bg-zinc-600 group-hover:bg-[#0d99ff] opacity-0 group-hover:opacity-100'
            }`} />
          </div>

          {/* Studio Panel Group Switcher Bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#141417] border-b border-[#27272d] shrink-0 gap-1.5">
            <div className="flex items-center gap-0.5 bg-[#101013] p-0.5 rounded border border-[#27272d] min-w-0">
              <button
                type="button"
                onClick={() => onSelectDockTarget('properties', propertiesTab)}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  activeModule === 'properties'
                    ? 'bg-[#23232a] text-white border border-[#35353f]'
                    : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
                }`}
              >
                <Sliders size={11} className="text-[#38bdf8] shrink-0" />
                <span>Özellikler</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectDockTarget('aiAgent')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                  activeModule === 'aiAgent'
                    ? 'bg-violet-500/20 text-violet-200 border border-violet-400/35 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 border border-transparent'
                }`}
              >
                <Bot size={11} className="text-violet-400 shrink-0" />
                <span>Gemini AI</span>
              </button>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={onOpenFloatingInspector}
                title="Yüzen CSS & Nitelik Penceresini Aç/Kapat"
                className={`p-1.5 rounded-lg transition-colors ${
                  isFloatingInspectorOpen
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <ExternalLink size={12} />
              </button>
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Sağ paneli daralt"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>

          {/* Active Module Body */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            {activeModule === 'aiAgent' ? aiAgentContent : propertiesContent}
          </div>
        </div>
      )}

      {/* Persistent Studio Vertical Icon Rail */}
      <div className="w-10 bg-[#141417] border-l border-[#2c2c32] flex flex-col items-center py-2 justify-between shrink-0">
        <div className="flex flex-col items-center gap-1 w-full px-1">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                title={item.label}
                className={`relative w-full h-8 rounded flex items-center justify-center transition-colors border ${
                  item.isActive
                    ? item.accent
                    : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/[0.05]'
                }`}
              >
                {item.isActive && (
                  <span className={`absolute -right-1 top-1.5 bottom-1.5 w-0.5 rounded-l ${item.indicator}`} />
                )}
                <Icon size={14} strokeWidth={1.75} />
              </button>
            );
          })}

          <div className="w-4 h-px bg-[#2c2c32] my-1" />

          <button
            type="button"
            onClick={() => onSelectDockTarget('aiAgent')}
            title="Gemini AI Tasarım Asistanı"
            className={`relative w-full h-8 rounded flex items-center justify-center transition-colors border ${
              isOpen && activeModule === 'aiAgent'
                ? 'bg-[#1a222b] border-[#2c435a] text-[#7dd3fc]'
                : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/[0.05]'
            }`}
          >
            {isOpen && activeModule === 'aiAgent' && (
              <span className="absolute -right-1 top-1.5 bottom-1.5 w-0.5 rounded-l bg-[#0d99ff]" />
            )}
            <Bot size={14} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onOpenFloatingInspector}
            title="Yüzen CSS & Nitelik Penceresi"
            className={`relative w-full h-8 rounded flex items-center justify-center transition-colors border ${
              isFloatingInspectorOpen
                ? 'bg-[#1a222b] border-[#2c435a] text-[#7dd3fc]'
                : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/[0.05]'
            }`}
          >
            {isFloatingInspectorOpen && (
              <span className="absolute -right-1 top-1.5 bottom-1.5 w-0.5 rounded-l bg-[#0d99ff]" />
            )}
            <ExternalLink size={14} strokeWidth={1.75} />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          title={isOpen ? 'Sağ Paneli Daralt' : 'Sağ Paneli Aç'}
          className="w-8 h-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          {isOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </div>
    </div>
  );
}
