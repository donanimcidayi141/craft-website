import { flattenTree } from './treeUtils.js';

/**
 * Normalizes a user-supplied function name into a safe JS identifier (e.g. "hesapla()" -> "hesapla").
 */
export function sanitizeFunctionIdentifier(rawName = 'hesapla') {
  const cleaned = String(rawName || '')
    .replace(/\(\s*\)\s*$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_$]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1');
  return cleaned || 'ozelFonksiyon';
}

/**
 * Finds an element node by its internal AST id OR HTML attrs.id OR name.
 */
export function findElementByAnyId(elements = [], targetRef = '') {
  const ref = String(targetRef || '').replace(/^#/, '').trim();
  if (!ref) return null;
  const flat = flattenTree(elements);
  return (
    flat.find((n) => n.id === ref) ||
    flat.find((n) => n.attrs?.id === ref) ||
    flat.find((n) => (n.name || '').trim() === ref) ||
    null
  );
}

/**
 * Reads an element's current live value or text content (for getValue / rules).
 */
export function readElementLiveValue(elements = [], runtimeOverrides = {}, targetRef = '') {
  const node = findElementByAnyId(elements, targetRef);
  if (!node) {
    return runtimeOverrides[targetRef]?.value ?? runtimeOverrides[targetRef]?.textContent ?? '';
  }
  const ov = runtimeOverrides[node.id] || {};
  const tag = String(node.type || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (ov.value !== undefined) return ov.value;
    return node.attrs?.value ?? '';
  }
  if (ov.textContent !== undefined) return ov.textContent;
  return node.textContent ?? node.content ?? '';
}

function quoteJsString(str) {
  return JSON.stringify(String(str ?? ''));
}

function renderOperandJs(type, value) {
  if (type === 'element' && value) {
    return `(Number(getValue(${quoteJsString(value)})) || 0)`;
  }
  const num = Number(value);
  return Number.isFinite(num) && String(value).trim() !== '' ? String(num) : '0';
}

/**
 * Compiles visual no-code formula/rule steps into clean, readable JavaScript
 * that works identically in CraftStudio Preview AND exported React apps.
 */
export function compileFormulaStepsToJs(formulaSteps = []) {
  if (!Array.isArray(formulaSteps) || formulaSteps.length === 0) {
    return '// Yukarıdan bir kural ekleyin veya JS kodu yazın\nnotify("Fonksiyon çalıştı!");';
  }

  const lines = [];
  formulaSteps.forEach((step, idx) => {
    if (!step || !step.type) return;
    if (step.type === 'math') {
      const leftExpr = renderOperandJs(step.leftType || 'element', step.leftValue);
      const rightExpr = renderOperandJs(step.rightType || 'element', step.rightValue);
      const op = ['+', '-', '*', '/'].includes(step.op) ? step.op : '+';
      const varName = `sonuc_${idx + 1}`;
      const expr = op === '/'
        ? `(${rightExpr} !== 0 ? (${leftExpr} / ${rightExpr}) : 0)`
        : `(${leftExpr} ${op} ${rightExpr})`;
      lines.push(`const ${varName} = ${expr};`);
      if (step.targetId) {
        const prefix = step.prefix ? `${quoteJsString(step.prefix)} + ` : '';
        const suffix = step.suffix ? ` + ${quoteJsString(step.suffix)}` : '';
        lines.push(`setText(${quoteJsString(step.targetId)}, ${prefix}${varName}${suffix});`);
      }
    } else if (step.type === 'condition') {
      const sourceExpr = `getValue(${quoteJsString(step.leftValue || '')})`;
      const cmpVal = String(step.compareValue ?? '');
      let condJs = `${sourceExpr} === ${quoteJsString(cmpVal)}`;
      if (step.operator === '!=') condJs = `${sourceExpr} !== ${quoteJsString(cmpVal)}`;
      else if (step.operator === '>') condJs = `Number(${sourceExpr}) > Number(${quoteJsString(cmpVal)})`;
      else if (step.operator === '<') condJs = `Number(${sourceExpr}) < Number(${quoteJsString(cmpVal)})`;
      else if (step.operator === 'contains') condJs = `String(${sourceExpr}).toLowerCase().includes(${quoteJsString(cmpVal.toLowerCase())})`;

      lines.push(`if (${condJs}) {`);
      if (step.targetId) {
        lines.push(`  setText(${quoteJsString(step.targetId)}, ${quoteJsString(step.thenText ?? '')});`);
      }
      lines.push(`}${step.elseText ? ` else {\n  setText(${quoteJsString(step.targetId || '')}, ${quoteJsString(step.elseText)});\n}` : ''}`);
    } else if (step.type === 'set_text') {
      if (step.targetId) {
        lines.push(`setText(${quoteJsString(step.targetId)}, ${quoteJsString(step.text ?? '')});`);
      }
    } else if (step.type === 'toggle_visible') {
      if (step.targetId) {
        lines.push(`toggleVisible(${quoteJsString(step.targetId)});`);
      }
    } else if (step.type === 'notify') {
      lines.push(`notify(${quoteJsString(step.message || 'İşlem tamamlandı!')});`);
    } else if (step.type === 'navigate_page') {
      if (step.targetPageId) {
        lines.push(`goToPage(${quoteJsString(step.targetPageId)});`);
      }
    }
  });

  return lines.length > 0 ? lines.join('\n') : 'notify("Fonksiyon çalıştı!");';
}

/**
 * Returns executable JS source code for a function record (`formula` or `code` mode).
 */
export function getEffectiveFunctionCode(fnObj) {
  if (!fnObj) return '';
  if (fnObj.editorMode === 'formula') {
    return compileFormulaStepsToJs(fnObj.formulaSteps || []);
  }
  return String(fnObj.code || '');
}

/**
 * Safely executes a project function against Preview Runtime state with bound helpers.
 */
export function executeCraftFunction(fnObj, context = {}) {
  const {
    elements = [],
    runtimeOverrides = {},
    setRuntimeOverrides,
    tabs = [],
    onNavigateTab,
    onNavigateUrl,
    onScrollTo,
    onNotify,
  } = context;

  if (!fnObj) {
    return { ok: false, error: 'Seçili fonksiyon bulunamadı.', logs: [] };
  }

  const code = getEffectiveFunctionCode(fnObj);
  if (!code.trim()) {
    return { ok: true, logs: ['Fonksiyon gövdesi boş.'], mutatedIds: [] };
  }

  // Work on a local mutable copy of runtime overrides during synchronous execution
  const workingOverrides = { ...runtimeOverrides };
  const mutatedIds = [];
  const logs = [];

  const patchOverride = (targetRef, patch) => {
    const node = findElementByAnyId(elements, targetRef);
    const id = node ? node.id : String(targetRef || '').replace(/^#/, '');
    if (!id) return;
    workingOverrides[id] = { ...(workingOverrides[id] || {}), ...patch };
    if (!mutatedIds.includes(id)) mutatedIds.push(id);
  };

  const api = {
    getValue: (ref) => readElementLiveValue(elements, workingOverrides, ref),
    setValue: (ref, val) => patchOverride(ref, { value: String(val ?? '') }),
    setText: (ref, txt) => patchOverride(ref, { textContent: String(txt ?? ''), content: String(txt ?? '') }),
    setStyle: (ref, stylePatch) => {
      const node = findElementByAnyId(elements, ref);
      const id = node ? node.id : String(ref || '').replace(/^#/, '');
      if (!id || !stylePatch || typeof stylePatch !== 'object') return;
      const curStyle = workingOverrides[id]?.style || {};
      patchOverride(id, { style: { ...curStyle, ...stylePatch } });
    },
    show: (ref) => patchOverride(ref, { isHidden: false }),
    hide: (ref) => patchOverride(ref, { isHidden: true }),
    toggleVisible: (ref) => {
      const node = findElementByAnyId(elements, ref);
      const id = node ? node.id : String(ref || '').replace(/^#/, '');
      if (!id) return;
      const curHidden = workingOverrides[id]?.isHidden ?? Boolean(node?.isHidden);
      patchOverride(id, { isHidden: !curHidden });
    },
    goToPage: (pageRef) => {
      const match = tabs.find(
        (t) =>
          t.id === pageRef ||
          t.name === pageRef ||
          t.name.replace(/\.craft$/, '').toLowerCase() === String(pageRef || '').toLowerCase()
      );
      if (match && onNavigateTab) {
        onNavigateTab(match.id);
      } else if (onNotify) {
        onNotify(`Sayfa bulunamadı: ${pageRef}`);
      }
    },
    scrollTo: (ref) => onScrollTo?.(ref),
    openUrl: (url, newTab = true) => onNavigateUrl?.(url, newTab),
    notify: (msg) => {
      const text = String(msg ?? '');
      logs.push(text);
      onNotify?.(text);
    },
    alert: (msg) => {
      const text = String(msg ?? '');
      logs.push(text);
      onNotify?.(text);
    },
    log: (...args) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
  };

  try {
    const paramName = (fnObj.params || '').trim();
    const fnRunner = new Function(
      'getValue',
      'setValue',
      'setText',
      'setStyle',
      'show',
      'hide',
      'toggleVisible',
      'goToPage',
      'scrollTo',
      'openUrl',
      'notify',
      'alert',
      'console',
      ...(paramName ? [paramName] : []),
      `"use strict";\n${code}`
    );

    fnRunner(
      api.getValue,
      api.setValue,
      api.setText,
      api.setStyle,
      api.show,
      api.hide,
      api.toggleVisible,
      api.goToPage,
      api.scrollTo,
      api.openUrl,
      api.notify,
      api.alert,
      { log: api.log, warn: api.log, error: api.log }
    );

    if (setRuntimeOverrides && mutatedIds.length > 0) {
      setRuntimeOverrides(workingOverrides);
    }

    return { ok: true, logs, mutatedIds, nextOverrides: workingOverrides };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), logs };
  }
}

/**
 * Resolves the total number of slides and next active index for a slider container node.
 */
export function resolveSliderNextIndex(sliderNode, currentIdx = 0, action = 'slider_next', targetSlideIndex = 0) {
  const slideChildren = Array.isArray(sliderNode?.children)
    ? sliderNode.children.filter((ch) => ch?.sliderRole === 'slide')
    : [];
  const totalSlides = Math.max(
    1,
    Number(sliderNode?.sliderConfig?.totalSlides || slideChildren.length || 1)
  );
  const normalizedCurrent = ((Number(currentIdx) || 0) % totalSlides + totalSlides) % totalSlides;

  if (action === 'slider_prev') {
    return (normalizedCurrent - 1 + totalSlides) % totalSlides;
  }
  if (action === 'slider_goto') {
    const target = Number(targetSlideIndex) || 0;
    return ((target % totalSlides) + totalSlides) % totalSlides;
  }
  return (normalizedCurrent + 1) % totalSlides;
}

/**
 * Dispatches an element's configured `onClick` event (or <a> href fallback) in Preview Mode.
 */
export function executeNodeClickEvent(node, context = {}) {
  const {
    elements = [],
    projectFunctions = [],
    runtimeOverrides = {},
    setRuntimeOverrides,
    tabs = [],
    onNavigateTab,
    onNavigateUrl,
    onScrollTo,
    onNotify,
  } = context;

  const clickCfg = node?.events?.onClick;
  if (!clickCfg || clickCfg.mode === 'none') {
    // Fallback for standard <a> href if no explicit event was configured
    const tag = String(node?.type || '').toLowerCase();
    const href = node?.attrs?.href;
    if (tag === 'a' && href && href !== '#') {
      if (href.startsWith('#')) {
        onScrollTo?.(href.slice(1));
        return { ok: true, action: 'scroll_to' };
      }
      const matchedTab = tabs.find(
        (t) => t.route === href || `/${t.name.replace(/\.craft$/, '').toLowerCase()}` === href.toLowerCase()
      );
      if (matchedTab) {
        onNavigateTab?.(matchedTab.id);
        return { ok: true, action: 'navigate_page' };
      }
      onNavigateUrl?.(href, node?.attrs?.target === '_blank');
      return { ok: true, action: 'navigate_url' };
    }
    return { ok: true, action: 'noop' };
  }

  switch (clickCfg.mode) {
    case 'function': {
      const fnObj =
        projectFunctions.find((f) => f.id === clickCfg.functionId) ||
        projectFunctions.find((f) => f.name === clickCfg.functionName);
      if (!fnObj) {
        const msg = `Fonksiyon "${clickCfg.functionName || clickCfg.functionId}" henüz tanımlanmadı.`;
        onNotify?.(msg);
        return { ok: false, error: msg };
      }
      return executeCraftFunction(fnObj, context);
    }
    case 'navigate_page': {
      if (clickCfg.targetPageId) {
        onNavigateTab?.(clickCfg.targetPageId);
      }
      return { ok: true, action: 'navigate_page' };
    }
    case 'navigate_url': {
      if (clickCfg.url) {
        onNavigateUrl?.(clickCfg.url, clickCfg.openInNewTab !== false);
      }
      return { ok: true, action: 'navigate_url' };
    }
    case 'scroll_to': {
      if (clickCfg.targetElementId) {
        onScrollTo?.(clickCfg.targetElementId);
      }
      return { ok: true, action: 'scroll_to' };
    }
    case 'toggle_visibility': {
      if (clickCfg.targetElementId) {
        const target = findElementByAnyId(elements, clickCfg.targetElementId);
        const id = target ? target.id : clickCfg.targetElementId;
        const curHidden = runtimeOverrides[id]?.isHidden ?? Boolean(target?.isHidden);
        setRuntimeOverrides?.({
          ...runtimeOverrides,
          [id]: { ...(runtimeOverrides[id] || {}), isHidden: !curHidden },
        });
      }
      return { ok: true, action: 'toggle_visibility' };
    }
    case 'set_text': {
      if (clickCfg.targetElementId) {
        const target = findElementByAnyId(elements, clickCfg.targetElementId);
        const id = target ? target.id : clickCfg.targetElementId;
        setRuntimeOverrides?.({
          ...runtimeOverrides,
          [id]: {
            ...(runtimeOverrides[id] || {}),
            textContent: clickCfg.newText ?? '',
            content: clickCfg.newText ?? '',
          },
        });
      }
      return { ok: true, action: 'set_text' };
    }
    case 'slider_prev':
    case 'slider_next':
    case 'slider_goto': {
      const target = findElementByAnyId(elements, clickCfg.targetElementId);
      const id = target ? target.id : clickCfg.targetElementId;
      if (id) {
        const curIdx =
          runtimeOverrides[id]?.activeSlideIndex ??
          target?.sliderConfig?.activeSlideIndex ??
          0;
        const nextIdx = resolveSliderNextIndex(target, curIdx, clickCfg.mode, clickCfg.slideIndex);
        setRuntimeOverrides?.({
          ...runtimeOverrides,
          [id]: {
            ...(runtimeOverrides[id] || {}),
            activeSlideIndex: nextIdx,
          },
        });
        return { ok: true, action: clickCfg.mode, activeSlideIndex: nextIdx };
      }
      return { ok: true, action: clickCfg.mode };
    }
    case 'accordion_toggle': {
      const target = findElementByAnyId(elements, clickCfg.targetElementId) || node;
      const id = target ? target.id : clickCfg.targetElementId;
      if (id) {
        const curOpen = runtimeOverrides[id]?.accordionOpen ?? Boolean(target?.accordionOpen);
        const nextOpen = !curOpen;
        setRuntimeOverrides?.({
          ...runtimeOverrides,
          [id]: {
            ...(runtimeOverrides[id] || {}),
            accordionOpen: nextOpen,
          },
        });
        return { ok: true, action: 'accordion_toggle', accordionOpen: nextOpen };
      }
      return { ok: true, action: 'accordion_toggle' };
    }
    default:
      return { ok: true, action: 'noop' };
  }
}

/**
 * Generates an inline JSX handler string (`onClick={...}`) for AST React code generation.
 */
export function buildReactOnClickExpression(eventConfig, projectFunctions = [], tabs = []) {
  if (!eventConfig || eventConfig.mode === 'none') return null;

  if (eventConfig.mode === 'function') {
    const fnObj =
      projectFunctions.find((f) => f.id === eventConfig.functionId) ||
      projectFunctions.find((f) => f.name === eventConfig.functionName);
    const fnName = sanitizeFunctionIdentifier(fnObj?.name || eventConfig.functionName);
    return `() => ${fnName}()`;
  }
  if (eventConfig.mode === 'navigate_page') {
    const tab = tabs.find((t) => t.id === eventConfig.targetPageId);
    const route = tab?.route || '/';
    return `() => goToPage(${JSON.stringify(tab?.id || route)})`;
  }
  if (eventConfig.mode === 'navigate_url' && eventConfig.url) {
    return eventConfig.openInNewTab === false
      ? `() => { window.location.href = ${JSON.stringify(eventConfig.url)}; }`
      : `() => window.open(${JSON.stringify(eventConfig.url)}, '_blank', 'noopener,noreferrer')`;
  }
  if (eventConfig.mode === 'scroll_to' && eventConfig.targetElementId) {
    return `() => scrollToElement(${JSON.stringify(eventConfig.targetElementId)})`;
  }
  if (eventConfig.mode === 'toggle_visibility' && eventConfig.targetElementId) {
    return `() => toggleVisible(${JSON.stringify(eventConfig.targetElementId)})`;
  }
  if (eventConfig.mode === 'set_text' && eventConfig.targetElementId) {
    return `() => setText(${JSON.stringify(eventConfig.targetElementId)}, ${JSON.stringify(eventConfig.newText ?? '')})`;
  }
  if (
    (eventConfig.mode === 'slider_prev' || eventConfig.mode === 'slider_next' || eventConfig.mode === 'slider_goto') &&
    eventConfig.targetElementId
  ) {
    const actionKey = eventConfig.mode.replace('slider_', '');
    const targetIdx = eventConfig.mode === 'slider_goto' ? `, ${Number(eventConfig.slideIndex) || 0}` : '';
    return `() => switchSlider(${JSON.stringify(eventConfig.targetElementId)}, ${JSON.stringify(actionKey)}${targetIdx})`;
  }
  if (eventConfig.mode === 'accordion_toggle' && eventConfig.targetElementId) {
    return `() => toggleAccordion(${JSON.stringify(eventConfig.targetElementId)})`;
  }
  return null;
}
