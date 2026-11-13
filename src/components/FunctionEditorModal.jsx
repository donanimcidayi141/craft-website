import React, { useState, useEffect, useRef } from 'react';
import {
  X, Code2, Wand2, Play, Plus, Trash2, CheckCircle2, AlertCircle, Terminal, Sparkles
} from 'lucide-react';
import { flattenTree } from '../utils/treeUtils';
import {
  sanitizeFunctionIdentifier,
  compileFormulaStepsToJs,
  executeCraftFunction,
} from '../utils/interactionEngine';

export default function FunctionEditorModal({
  isOpen,
  onClose,
  fnObj,
  elements = [],
  tabs = [],
  onSaveFunction,
}) {
  const [name, setName] = useState('hesapla');
  const [editorMode, setEditorMode] = useState('formula'); // 'formula' | 'code'
  const [formulaSteps, setFormulaSteps] = useState([]);
  const [code, setCode] = useState('');
  const [testResult, setTestResult] = useState(null);
  const codeTextareaRef = useRef(null);

  const flatElements = flattenTree(elements);
  const elementOptions = flatElements.map((n) => ({
    id: n.id,
    htmlId: n.attrs?.id || n.id,
    label: n.name || n.textContent?.slice(0, 20) || `<${n.type}>`,
    tag: String(n.type || 'div').toLowerCase(),
  }));

  const inputElements = elementOptions.filter((e) => ['input', 'textarea', 'select'].includes(e.tag));

  useEffect(() => {
    if (!isOpen || !fnObj) return;
    setName(fnObj.name || 'hesapla');
    setEditorMode(fnObj.editorMode || 'formula');
    setFormulaSteps(
      Array.isArray(fnObj.formulaSteps) && fnObj.formulaSteps.length > 0
        ? fnObj.formulaSteps
        : [
            {
              id: `step-${Date.now()}`,
              type: 'math',
              leftType: 'element',
              leftValue: inputElements[0]?.htmlId || elementOptions[0]?.htmlId || '',
              op: '*',
              rightType: inputElements[1] ? 'element' : 'number',
              rightValue: inputElements[1]?.htmlId || '1',
              targetId: elementOptions.find((e) => !['input', 'textarea', 'select', 'button'].includes(e.tag))?.htmlId || '',
              prefix: '',
              suffix: ' TL',
            },
          ]
    );
    setCode(
      fnObj.code ||
        `// Öğe ID'lerini kullanarak değer okuyabilir ve ekrana yazdırabilirsiniz:\nconst deger = Number(getValue('${inputElements[0]?.htmlId || 'girdi-1'}')) || 0;\nsetText('${elementOptions[0]?.htmlId || 'sonuc'}', 'Sonuç: ' + deger);`
    );
    setTestResult(null);
  }, [isOpen, fnObj?.id]);

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

  if (!isOpen || !fnObj) return null;

  const insertSnippetIntoCode = (snippet) => {
    const ta = codeTextareaRef.current;
    if (!ta) {
      setCode((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${snippet}`);
      return;
    }
    const start = ta.selectionStart ?? code.length;
    const end = ta.selectionEnd ?? code.length;
    const next = `${code.slice(0, start)}${snippet}${code.slice(end)}`;
    setCode(next);
    setTimeout(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    }, 10);
  };

  const addFormulaStep = (type) => {
    const firstInputId = inputElements[0]?.htmlId || elementOptions[0]?.htmlId || '';
    const firstTextId = elementOptions.find((e) => !['input', 'button'].includes(e.tag))?.htmlId || elementOptions[0]?.htmlId || '';
    const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const templates = {
      math: {
        id,
        type: 'math',
        leftType: 'element',
        leftValue: firstInputId,
        op: '+',
        rightType: 'number',
        rightValue: '0',
        targetId: firstTextId,
        prefix: '',
        suffix: '',
      },
      condition: {
        id,
        type: 'condition',
        leftValue: firstInputId,
        operator: '>',
        compareValue: '0',
        targetId: firstTextId,
        thenText: 'Geçerli!',
        elseText: 'Lütfen geçerli değer girin.',
      },
      set_text: { id, type: 'set_text', targetId: firstTextId, text: 'İşlem başarılı' },
      toggle_visible: { id, type: 'toggle_visible', targetId: firstTextId },
      notify: { id, type: 'notify', message: 'İşlem tamamlandı!' },
      navigate_page: { id, type: 'navigate_page', targetPageId: tabs[0]?.id || '' },
    };

    setFormulaSteps((prev) => [...prev, templates[type] || templates.notify]);
  };

  const updateStep = (stepId, patch) => {
    setFormulaSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  };

  const handleTestRun = () => {
    const draft = {
      ...fnObj,
      name: sanitizeFunctionIdentifier(name),
      editorMode,
      formulaSteps,
      code,
    };
    const notifications = [];
    const res = executeCraftFunction(draft, {
      elements,
      tabs,
      runtimeOverrides: {},
      onNotify: (msg) => notifications.push(msg),
    });
    setTestResult({ ...res, notifications });
  };

  const handleSave = () => {
    const cleanName = sanitizeFunctionIdentifier(name);
    const compiledIfFormula = editorMode === 'formula' ? compileFormulaStepsToJs(formulaSteps) : code;
    onSaveFunction({
      ...fnObj,
      name: cleanName,
      editorMode,
      formulaSteps,
      code: compiledIfFormula,
    });
    onClose();
  };

  const previewCompiledJs = compileFormulaStepsToJs(formulaSteps);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-[#18181b] border border-[#2c2c32] rounded-md shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs text-zinc-200">
        {/* Header */}
        <div className="px-5 py-3 bg-[#141417] border-b border-[#27272d] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-[#0d99ff]/15 border border-[#0d99ff]/40 flex items-center justify-center text-[#38bdf8] shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-zinc-100 flex items-center gap-2">
                <span>Fonksiyon Mantığı Editörü</span>
                <span className="font-mono text-[#7dd3fc] bg-[#101013] px-2 py-0.5 rounded border border-[#2c2c34] text-[11px]">
                  {sanitizeFunctionIdentifier(name)}()
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                İster kodsuz formül/kural kurun, ister doğrudan JavaScript yazın — Önizleme ve React çıktısında birebir çalışır.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Function Name + Mode Switcher */}
        <div className="px-5 py-2.5 bg-[#16161a] border-b border-[#27272d] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-400">Fonksiyon Adı:</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((prev) => sanitizeFunctionIdentifier(prev))}
              className="bg-[#101013] border border-[#2c2c34] focus:border-[#0d99ff] rounded px-2.5 py-1 text-zinc-100 font-mono text-xs focus:outline-none w-48"
              placeholder="ör: hesapla"
            />
            <span className="text-[10px] font-mono text-zinc-500">()</span>
          </div>

          <div className="flex items-center gap-0.5 bg-[#101013] p-0.5 rounded border border-[#27272d]">
            <button
              type="button"
              onClick={() => setEditorMode('formula')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-medium transition-colors ${
                editorMode === 'formula'
                  ? 'bg-[#0d99ff] text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Wand2 size={12} />
              <span>Kodsuz Formül & Kural</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (editorMode === 'formula' && (!code.trim() || code.includes('getValue(\'girdi-1\')'))) {
                  setCode(compileFormulaStepsToJs(formulaSteps));
                }
                setEditorMode('code');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-medium transition-colors ${
                editorMode === 'code'
                  ? 'bg-[#25252c] text-white border border-[#3a3a44] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Code2 size={13} />
              <span>JavaScript Kodu</span>
            </button>
          </div>
        </div>

        {/* Clickable Page Element ID Chips */}
        <div className="px-5 py-2.5 bg-[#0d0f15] border-b border-white/[0.07] flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 shrink-0">
            Sayfa Öğeleri ({elementOptions.length}):
          </span>
          {elementOptions.length === 0 ? (
            <span className="text-[10px] text-neutral-500 italic">Bu sayfada henüz öğe yok.</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {elementOptions.slice(0, 18).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (editorMode === 'code') {
                      const helper = ['input', 'textarea', 'select'].includes(item.tag)
                        ? `Number(getValue('${item.htmlId}')) || 0`
                        : `'${item.htmlId}'`;
                      insertSnippetIntoCode(helper);
                    } else if (formulaSteps.length > 0) {
                      const lastStep = formulaSteps[formulaSteps.length - 1];
                      updateStep(lastStep.id, { targetId: item.htmlId });
                    }
                  }}
                  title={
                    editorMode === 'code'
                      ? `Tıkla: JS koduna '${item.htmlId}' ekle`
                      : `Tıkla: Son adımın hedefi olarak '${item.htmlId}' seç`
                  }
                  className="px-2 py-0.5 rounded bg-[#1c1c21] hover:bg-[#0d99ff]/20 border border-[#2c2c34] hover:border-[#0d99ff]/60 text-[10px] font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition-colors shrink-0"
                >
                  <span className="text-[#7dd3fc]">#{item.htmlId}</span>
                  <span className="text-zinc-500 max-w-[90px] truncate">({item.label})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {editorMode === 'formula' ? (
            <>
              {/* Step Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-zinc-400 mr-1">Adım Ekle:</span>
                {[
                  { id: 'math', label: '+ Hesaplama (× ÷ + −)' },
                  { id: 'condition', label: '+ Eğer / İse Koşulu' },
                  { id: 'set_text', label: '+ Metin Yazdır' },
                  { id: 'toggle_visible', label: '+ Göster / Gizle' },
                  { id: 'navigate_page', label: '+ Sayfaya Git' },
                  { id: 'notify', label: '+ Bildirim Mesajı' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => addFormulaStep(btn.id)}
                    className="px-2.5 py-1 rounded bg-[#1c1c21] hover:bg-[#25252d] border border-[#2c2c34] hover:border-[#0d99ff]/60 text-zinc-200 hover:text-white text-[11px] font-medium transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Visual Formula Steps */}
              <div className="space-y-2.5">
                {formulaSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="bg-[#141417] border border-[#27272d] rounded-md p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7dd3fc]">
                        Adım {index + 1}:{' '}
                        {step.type === 'math'
                          ? 'Matematiksel Hesaplama'
                          : step.type === 'condition'
                          ? 'Koşullu Karar (Eğer / İse)'
                          : step.type === 'set_text'
                          ? 'Hedef Öğeye Metin Yaz'
                          : step.type === 'toggle_visible'
                          ? 'Öğe Görünürlüğünü Aç/Kapat'
                          : step.type === 'navigate_page'
                          ? 'Başka Sayfaya Geç'
                          : 'Ekranda Bildirim Göster'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormulaSteps((prev) => prev.filter((s) => s.id !== step.id))}
                        className="text-neutral-500 hover:text-red-400 p-1 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {step.type === 'math' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            value={step.leftType || 'element'}
                            onChange={(e) => updateStep(step.id, { leftType: e.target.value })}
                            className="bg-[#0b0d12] border border-white/[0.09] rounded px-1.5 py-1 text-[11px] text-neutral-300"
                          >
                            <option value="element">Öğeden Al</option>
                            <option value="number">Sabit Sayı</option>
                          </select>
                          {step.leftType === 'number' ? (
                            <input
                              type="number"
                              value={step.leftValue || '0'}
                              onChange={(e) => updateStep(step.id, { leftValue: e.target.value })}
                              className="w-20 bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          ) : (
                            <select
                              value={step.leftValue || ''}
                              onChange={(e) => updateStep(step.id, { leftValue: e.target.value })}
                              className="flex-1 min-w-[110px] bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                            >
                              <option value="">-- Öğe Seç --</option>
                              {elementOptions.map((o) => (
                                <option key={o.id} value={o.htmlId}>
                                  #{o.htmlId} ({o.label})
                                </option>
                              ))}
                            </select>
                          )}

                          <select
                            value={step.op || '+'}
                            onChange={(e) => updateStep(step.id, { op: e.target.value })}
                            className="bg-[#0d99ff]/15 border border-[#0d99ff]/40 rounded px-2 py-1 text-[#7dd3fc] font-bold text-xs"
                          >
                            <option value="+">+</option>
                            <option value="-">−</option>
                            <option value="*">×</option>
                            <option value="/">÷</option>
                          </select>

                          <select
                            value={step.rightType || 'number'}
                            onChange={(e) => updateStep(step.id, { rightType: e.target.value })}
                            className="bg-[#0b0d12] border border-white/[0.09] rounded px-1.5 py-1 text-[11px] text-neutral-300"
                          >
                            <option value="element">Öğeden Al</option>
                            <option value="number">Sabit Sayı</option>
                          </select>
                          {step.rightType === 'number' ? (
                            <input
                              type="number"
                              value={step.rightValue || '0'}
                              onChange={(e) => updateStep(step.id, { rightValue: e.target.value })}
                              className="w-20 bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          ) : (
                            <select
                              value={step.rightValue || ''}
                              onChange={(e) => updateStep(step.id, { rightValue: e.target.value })}
                              className="flex-1 min-w-[110px] bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                            >
                              <option value="">-- Öğe Seç --</option>
                              {elementOptions.map((o) => (
                                <option key={o.id} value={o.htmlId}>
                                  #{o.htmlId} ({o.label})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-neutral-400">➔ Sonucu Yaz:</span>
                          <select
                            value={step.targetId || ''}
                            onChange={(e) => updateStep(step.id, { targetId: e.target.value })}
                            className="flex-1 min-w-[120px] bg-[#0b0d12] border border-emerald-500/40 rounded px-2 py-1 text-emerald-300 font-mono text-xs"
                          >
                            <option value="">-- Hedef Metin --</option>
                            {elementOptions.map((o) => (
                              <option key={o.id} value={o.htmlId}>
                                #{o.htmlId} ({o.label})
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={step.prefix || ''}
                            onChange={(e) => updateStep(step.id, { prefix: e.target.value })}
                            placeholder="Önek"
                            className="w-16 bg-[#0b0d12] border border-white/[0.09] rounded px-1.5 py-1 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={step.suffix || ''}
                            onChange={(e) => updateStep(step.id, { suffix: e.target.value })}
                            placeholder="Birim (TL)"
                            className="w-20 bg-[#0b0d12] border border-white/[0.09] rounded px-1.5 py-1 text-xs text-white"
                          />
                        </div>
                      </div>
                    )}

                    {step.type === 'condition' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-400">Eğer</span>
                          <select
                            value={step.leftValue || ''}
                            onChange={(e) => updateStep(step.id, { leftValue: e.target.value })}
                            className="flex-1 bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                          >
                            <option value="">-- Öğe Seç --</option>
                            {elementOptions.map((o) => (
                              <option key={o.id} value={o.htmlId}>
                                #{o.htmlId}
                              </option>
                            ))}
                          </select>
                          <select
                            value={step.operator || '=='}
                            onChange={(e) => updateStep(step.id, { operator: e.target.value })}
                            className="bg-[#101013] border border-[#2c2c34] rounded px-2 py-1 text-[#7dd3fc] text-xs"
                          >
                            <option value="==">Eşitse</option>
                            <option value="!=">Eşit Değilse</option>
                            <option value=">">Büyükse (&gt;)</option>
                            <option value="<">Küçükse (&lt;)</option>
                            <option value="contains">İçeriyorsa</option>
                          </select>
                          <input
                            type="text"
                            value={step.compareValue || ''}
                            onChange={(e) => updateStep(step.id, { compareValue: e.target.value })}
                            placeholder="Değer"
                            className="w-24 bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            value={step.targetId || ''}
                            onChange={(e) => updateStep(step.id, { targetId: e.target.value })}
                            className="bg-[#0b0d12] border border-emerald-500/40 rounded px-2 py-1 text-emerald-300 font-mono text-xs"
                          >
                            <option value="">-- Hedef Öğe --</option>
                            {elementOptions.map((o) => (
                              <option key={o.id} value={o.htmlId}>
                                #{o.htmlId}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={step.thenText || ''}
                            onChange={(e) => updateStep(step.id, { thenText: e.target.value })}
                            placeholder="Doğruysa yaz..."
                            className="flex-1 min-w-[90px] bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white text-xs"
                          />
                          <input
                            type="text"
                            value={step.elseText || ''}
                            onChange={(e) => updateStep(step.id, { elseText: e.target.value })}
                            placeholder="Değilse (opsiyonel)"
                            className="flex-1 min-w-[90px] bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {(step.type === 'set_text' || step.type === 'toggle_visible') && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={step.targetId || ''}
                          onChange={(e) => updateStep(step.id, { targetId: e.target.value })}
                          className="min-w-[180px] bg-[#0b0d12] border border-white/[0.09] rounded px-2 py-1 text-white font-mono text-xs"
                        >
                          <option value="">-- Hedef Öğe --</option>
                          {elementOptions.map((o) => (
                            <option key={o.id} value={o.htmlId}>
                              #{o.htmlId} ({o.label})
                            </option>
                          ))}
                        </select>
                        {step.type === 'set_text' && (
                          <input
                            type="text"
                            value={step.text || ''}
                            onChange={(e) => updateStep(step.id, { text: e.target.value })}
                            placeholder="Yazdırılacak yeni metin..."
                            className="flex-1 bg-[#0b0d12] border border-white/[0.09] rounded px-2.5 py-1 text-white text-xs"
                          />
                        )}
                      </div>
                    )}

                    {step.type === 'notify' && (
                      <input
                        type="text"
                        value={step.message || ''}
                        onChange={(e) => updateStep(step.id, { message: e.target.value })}
                        placeholder="Kullanıcıya gösterilecek bildirim mesajı..."
                        className="w-full bg-[#0b0d12] border border-white/[0.09] rounded px-2.5 py-1.5 text-white text-xs"
                      />
                    )}

                    {step.type === 'navigate_page' && (
                      <select
                        value={step.targetPageId || ''}
                        onChange={(e) => updateStep(step.id, { targetPageId: e.target.value })}
                        className="w-full bg-[#0b0d12] border border-white/[0.09] rounded px-2.5 py-1.5 text-white text-xs"
                      >
                        <option value="">-- Hedef Sayfayı Seç --</option>
                        {tabs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.route || '/'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {/* Compiled JS Preview */}
              <div className="bg-[#0a0c10] border border-white/[0.07] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-neutral-400">
                    Otomatik Üretilen JavaScript Kodu (Salt Okunur Önizleme)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCode(previewCompiledJs);
                      setEditorMode('code');
                    }}
                    className="text-[10px] text-purple-300 hover:text-purple-200 underline"
                  >
                    Kod Editörüne Aktar →
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">
                  {previewCompiledJs}
                </pre>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-neutral-400 mr-1">Hızlı Yardımcı Ekle:</span>
                {[
                  { label: 'getValue(id)', snippet: "const val = Number(getValue('id')) || 0;\n" },
                  { label: 'setText(id, txt)', snippet: "setText('id', 'Yeni Değer');\n" },
                  { label: 'setValue(id, val)', snippet: "setValue('id', '');\n" },
                  { label: 'toggleVisible(id)', snippet: "toggleVisible('id');\n" },
                  { label: 'setStyle(id, css)', snippet: "setStyle('id', { color: '#10b981' });\n" },
                  { label: 'goToPage(sayfa)', snippet: `goToPage('${tabs[0]?.name || 'Anasayfa.craft'}');\n` },
                  { label: 'notify(mesaj)', snippet: "notify('İşlem tamamlandı!');\n" },
                ].map((h) => (
                  <button
                    key={h.label}
                    type="button"
                    onClick={() => insertSnippetIntoCode(h.snippet)}
                    className="px-2 py-0.5 rounded bg-[#171a24] hover:bg-purple-600/30 border border-white/[0.09] text-purple-300 font-mono text-[10px]"
                  >
                    {h.label}
                  </button>
                ))}
              </div>

              <div className="bg-[#0c0c0e] border border-[#27272d] rounded-md overflow-hidden">
                <div className="px-3 py-1.5 bg-[#141417] border-b border-[#27272d] font-mono text-[11px] text-[#7dd3fc]">
                  {`function ${sanitizeFunctionIdentifier(name)}() {`}
                </div>
                <textarea
                  ref={codeTextareaRef}
                  rows={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-[#0c0c0e] text-emerald-200 font-mono text-xs p-3 focus:outline-none resize-y leading-relaxed"
                  placeholder="Buraya JavaScript mantığınızı yazın..."
                />
                <div className="px-3 py-1 bg-[#141417] border-t border-[#27272d] font-mono text-[11px] text-[#7dd3fc]">
                  {`}`}
                </div>
              </div>
            </div>
          )}

          {/* Live Test Console Result */}
          {testResult && (
            <div
              className={`rounded-md p-3 border text-xs flex items-start gap-2.5 ${
                testResult.ok
                  ? 'bg-[#101a15] border-emerald-500/40 text-emerald-200'
                  : 'bg-[#1c1113] border-rose-500/50 text-rose-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 min-w-0 flex-1 font-mono text-[11px]">
                <div className="font-semibold">
                  {testResult.ok
                    ? `Fonksiyon hatasız çalıştı (${testResult.mutatedIds?.length || 0} öğe güncellendi)`
                    : `Çalışma Hatası: ${testResult.error}`}
                </div>
                {testResult.logs?.length > 0 && (
                  <div className="text-zinc-300">
                    Çıktılar: {testResult.logs.join(' | ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#141417] border-t border-[#27272d] flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c1c21] hover:bg-[#23232a] border border-emerald-500/40 text-emerald-300 font-medium transition-colors"
          >
            <Play size={12} />
            <span>Fonksiyonu Şimdi Test Et</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-[#202026] hover:bg-[#282830] border border-[#2f2f38] text-zinc-300 font-medium"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold transition-colors"
            >
              Kaydet ve Bağla ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
