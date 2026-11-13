import React, { useState, useRef } from 'react';
import { 
  Layers, Eye, EyeOff, Lock, Unlock, Trash2, X, Group, 
  ChevronRight, ChevronDown, Folder, FileCode, Tag as TagIcon 
} from 'lucide-react';
import { canHaveChildren, isExplicitContainer } from '../utils/treeUtils.js';

export default function LayersPanel({
  elements = [],
  selectedIds = [],
  onSelectElement,
  onSelectMultipleElements,
  onToggleElementSelection,
  onToggleVisibility,
  onToggleLock,
  onRenameElement,
  onReparentElement,
  onDeleteSelected,
  onGroupSelected,
  onUngroupSelected,
  onClose
}) {
  // Collapsed state for container nodes (true = collapsed, false/undefined = expanded)
  const [collapsedMap, setCollapsedMap] = useState({});
  
  // Inline rename state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Drag and drop state
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'inside' | 'after'

  // Toggle collapse / expand
  const toggleCollapse = (id, e) => {
    e.stopPropagation();
    setCollapsedMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Build flattened list of currently visible nodes for Shift+Click range selection
  const getVisibleNodes = () => {
    const list = [];
    function traverse(nodes) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(node => {
        list.push(node);
        if (!collapsedMap[node.id] && node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    }
    traverse(elements);
    return list;
  };

  // Handle click on a layer (supports normal click and Shift+click range selection)
  const handleLayerClick = (node, e) => {
    if (editingId) return;

    if (e.shiftKey && selectedIds.length > 0 && onSelectMultipleElements) {
      const visibleList = getVisibleNodes();
      const lastSelectedId = selectedIds[selectedIds.length - 1];
      const lastIdx = visibleList.findIndex(n => n.id === lastSelectedId);
      const currentIdx = visibleList.findIndex(n => n.id === node.id);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangeIds = visibleList.slice(start, end + 1).map(n => n.id);
        onSelectMultipleElements(rangeIds);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      onToggleElementSelection(node.id);
    } else {
      onSelectElement(node.id);
    }
  };

  // Commit rename
  const handleCommitRename = (id) => {
    if (editingName.trim()) {
      onRenameElement(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  // Drag & drop handlers
  const handleDragStart = (e, node) => {
    if (editingId === node.id) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.id);
    setDraggedId(node.id);
  };

  const handleDragOver = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId === node.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    const isContainer = canHaveChildren(node.type) && isExplicitContainer(node.type);

    if (isContainer && offsetY > height * 0.25 && offsetY < height * 0.75) {
      setDropPosition('inside');
    } else if (offsetY < height * 0.5) {
      setDropPosition('before');
    } else {
      setDropPosition('after');
    }
    setDragOverTargetId(node.id);
  };

  const handleDragLeave = (e, node) => {
    e.stopPropagation();
    if (dragOverTargetId === node.id) {
      setDragOverTargetId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedId || draggedId === targetNode.id) {
      setDraggedId(null);
      setDragOverTargetId(null);
      setDropPosition(null);
      return;
    }

    if (dropPosition === 'inside') {
      onReparentElement(draggedId, targetNode.id, -1);
    } else if (dropPosition === 'before') {
      onReparentElement(draggedId, targetNode.parentId || null, 0);
    } else if (dropPosition === 'after') {
      onReparentElement(draggedId, targetNode.parentId || null, -1);
    }

    setDraggedId(null);
    setDragOverTargetId(null);
    setDropPosition(null);
  };

  // Count all nodes recursively
  const countAllNodes = (nodes) => {
    if (!Array.isArray(nodes)) return 0;
    return nodes.reduce((acc, n) => acc + 1 + countAllNodes(n.children), 0);
  };
  const totalCount = countAllNodes(elements);

  // Recursive tree renderer
  const renderTreeNodes = (nodes, depth = 0, parentId = null) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;

    return nodes.map((node) => {
      const isSelected = selectedIds.includes(node.id);
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const isCollapsed = collapsedMap[node.id];
      const isEditing = editingId === node.id;
      const isDragTarget = dragOverTargetId === node.id;

      return (
        <div key={node.id} className="relative">
          {/* Drop indicator lines */}
          {isDragTarget && dropPosition === 'before' && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-30" />
          )}

          {/* Node row */}
          <div
            draggable={!isEditing}
            onDragStart={(e) => handleDragStart(e, node)}
            onDragOver={(e) => handleDragOver(e, { ...node, parentId })}
            onDragLeave={(e) => handleDragLeave(e, node)}
            onDrop={(e) => handleDrop(e, { ...node, parentId })}
            onClick={(e) => handleLayerClick(node, e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(node.id);
              setEditingName(node.name || node.type);
            }}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            className={`flex items-center justify-between pr-2 py-1.5 rounded-lg cursor-pointer transition-all group select-none text-xs ${
              isSelected
                ? 'bg-blue-600/30 text-white font-medium border-l-2 border-blue-400'
                : 'hover:bg-white/[0.05] text-neutral-300'
            } ${
              isDragTarget && dropPosition === 'inside' ? 'ring-2 ring-blue-500 bg-blue-500/20' : ''
            }`}
          >
            {/* Left: Expand Arrow + Tag Badge + Name */}
            <div className="flex items-center gap-1.5 truncate flex-1 mr-2">
              {/* Expand / Collapse Button */}
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleCollapse(node.id, e)}
                  className="p-0.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.07]"
                >
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
              ) : (
                <span className="w-4" />
              )}

              {/* Tag pill */}
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#101013] text-[#38bdf8] border border-[#2c2c32] flex-shrink-0">
                &lt;{node.type || 'div'}&gt;
              </span>

              {/* Editable Name */}
              {isEditing ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename(node.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleCommitRename(node.id)}
                  autoFocus
                  className="w-full bg-[#0b0d12] border border-blue-500 rounded px-1 text-white text-xs focus:outline-none"
                />
              ) : (
                <span className="truncate text-xs" title="Çift tıkla yeniden adlandır">
                  {node.name || node.type}
                </span>
              )}

              {node.groupId && (
                <span className="text-[8px] px-1 rounded bg-purple-900/80 text-purple-200 border border-purple-500/30 flex-shrink-0">
                  Grup
                </span>
              )}
            </div>

            {/* Right Action Icons: Lock, Visibility, Delete */}
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 flex-shrink-0">
              {/* Lock */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(node.id);
                }}
                title={node.isLocked ? 'Kilidi Aç' : 'Kilitle'}
                className={`p-1 rounded hover:bg-[#222228] ${node.isLocked ? 'text-[#38bdf8]' : 'hover:text-zinc-100'}`}
              >
                {node.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>

              {/* Visibility */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(node.id);
                }}
                title={node.isHidden ? 'Görünür Yap' : 'Gizle'}
                className={`p-1 rounded hover:bg-white/[0.07] ${node.isHidden ? 'text-neutral-500' : 'hover:text-white'}`}
              >
                {node.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(node.id);
                  onDeleteSelected();
                }}
                title="Katmanı Sil"
                className="p-1 rounded hover:bg-white/[0.07] hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Drop indicator lines */}
          {isDragTarget && dropPosition === 'after' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-30" />
          )}

          {/* Recursive Children */}
          {hasChildren && !isCollapsed && (
            <div className="border-l border-white/[0.07] ml-3.5">
              {renderTreeNodes(node.children, depth + 1, node.id)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-80 bg-[#141417] border-l border-[#27272d] flex flex-col h-full text-xs text-zinc-300 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#27272d] bg-[#18181b]">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Layers size={14} className="text-[#0d99ff]" />
          <span>Katman Ağacı ({totalCount})</span>
          {selectedIds.length > 0 && (
            <span className="text-[10px] text-[#38bdf8] ml-1 tabular-nums">
              ({selectedIds.length} seçili)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedIds.length > 1 && (
            <button
              onClick={onGroupSelected}
              title="Seçilenleri Grupla (Ctrl+G)"
              className="p-1 text-[#38bdf8] hover:text-white rounded hover:bg-[#222228]"
            >
              <Group size={13} />
            </button>
          )}
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#222228]">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Layer Tree list */}
      <div className="p-2 overflow-y-auto flex-1 space-y-0.5">
        {elements.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-xs">
            Henüz eklenmiş bir katman yok.
          </div>
        ) : (
          renderTreeNodes(elements, 0, null)
        )}
      </div>

      {/* Quick Tips footer */}
      <div className="px-3 py-2 bg-[#18181b] border-t border-[#27272d] text-[10px] text-zinc-400 flex justify-between items-center">
        <span>Çift tık: Adlandır • Sürükle: Taşı</span>
        <span>Shift+Tık: Aralık</span>
      </div>
    </div>
  );
}
