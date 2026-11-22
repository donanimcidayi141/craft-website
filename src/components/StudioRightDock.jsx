import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Sliders,
  Box,
  Tag as TagIcon,
  Sparkles,
  Code2,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  ChevronsRight,
  Database,
  Play,
} from 'lucide-react';
import { getStudioModeConfig } from '../data/studioModesRegistry';

const RIGHT_TAB_ICON_MAP = {
  LayoutGrid,
  Sliders,
  Box,
  Tag: TagIcon,
  Sparkles,
  Code2,
  Database,
  Play,
};

const MIN_DOCK_WIDTH = 296;
const MAX_DOCK_WIDTH = 540;
export const DEFAULT_RIGHT_DOCK_WIDTH = 336;

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
  activeMode = 'design',
  modeConfig = null,
}) {
  const resolvedModeConfig = modeConfig || getStudioModeConfig(activeMode);
  const isBackendMode = activeMode === 'backend';
  const showFloatingInspectorButton = resolvedModeConfig.supportsFloatingAttributesInspector !== false;
  const headerTitle = resolvedModeConfig.rightDockHeaderTitle || 'Özellikler & Tasarım';
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

  const railItems = (resolvedModeConfig.rightTabs || []).map((tab) => ({
    id: tab.railId || `prop-${tab.id}`,
    tabId: tab.id,
    label: tab.label,
    icon: RIGHT_TAB_ICON_MAP[tab.icon] || Sliders,
    isActive: isOpen && activeModule === 'properties' && propertiesTab === tab.id,
    accent: tab.id === 'block' || isBackendMode
      ? 'text-[#38bdf8] bg-[#23232b] border-[#383844]'
      : tab.id === 'props'
      ? 'text-[#7dd3fc] bg-[#1a222b] border-[#2c435a]'
      : 'text-white bg-[#23232b] border-[#383844]',
    indicator: tab.indicator || 'bg-[#0d99ff]',
    onClick: () => onSelectDockTarget('properties', tab.id),
  }));

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

          {/* Studio Panel Header Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#141417] border-b border-[#27272d] shrink-0 gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 min-w-0">
              <Sliders size={12} className={isBackendMode ? 'text-emerald-400 shrink-0' : 'text-[#38bdf8] shrink-0'} />
              <span className="truncate">{headerTitle}</span>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {showFloatingInspectorButton && (
                <button
                  type="button"
                  onClick={onOpenFloatingInspector}
                  title="Yüzen CSS & Nitelik Penceresini Aç/Kapat"
                  className={`p-1.5 rounded transition-colors ${
                    isFloatingInspectorOpen
                      ? 'bg-[#0d99ff]/18 text-[#7dd3fc] border border-[#0d99ff]/40'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <ExternalLink size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Sağ paneli daralt"
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>

          {/* Active Module Body */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            {isBackendMode ? (
              <div className="flex-1 p-4 text-xs text-zinc-400 space-y-3 overflow-y-auto" data-backend-right-dock={propertiesTab}>
                <div className="flex items-center gap-1.5 border-b border-[#27272d] pb-2">
                  {(resolvedModeConfig.rightTabs || []).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-backend-right-tab={tab.id}
                      onClick={() => onSelectDockTarget('properties', tab.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        propertiesTab === tab.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-[#121216] border border-[#26262f] text-[11px] text-zinc-400 leading-relaxed">
                  Seçili sekme: <strong className="text-zinc-200">{(resolvedModeConfig.rightTabs || []).find((t) => t.id === propertiesTab)?.label || propertiesTab}</strong>. Akış adımı seçildiğinde ayarlar burada görünecek.
                </div>
              </div>
            ) : (
              propertiesContent
            )}
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
                data-right-rail-tab={item.tabId}
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

          {showFloatingInspectorButton && (
            <>
              <div className="w-4 h-px bg-[#2c2c32] my-1" />

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
            </>
          )}
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
