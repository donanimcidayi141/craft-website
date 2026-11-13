import { findNodeAndParent, updateNodeInTree } from './treeUtils.js';

const TAG_SYNONYMS = {
  rectangle: 'div',
  box: 'div',
  frame: 'div',
  container: 'div',
  navbar: 'nav',
  hero: 'section',
  heading: 'h2',
  paragraph: 'p',
  text: 'span',
  link: 'a',
  image: 'img',
};

function toCamelCssKey(prop) {
  if (!prop || prop.startsWith('--')) return prop;
  return prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Resolves the effective AI execution scope ('full_site' vs 'selection')
 * from explicit user toggle + active canvas selection.
 */
export function resolveAiTargetScope(elements = [], selectedIds = [], requestedMode = 'auto') {
  const safeIds = Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : [];
  const targetNodes = safeIds
    .map((id) => findNodeAndParent(elements, id)?.node)
    .filter(Boolean);

  let effectiveMode = requestedMode;
  if (requestedMode === 'auto') {
    effectiveMode = targetNodes.length > 0 ? 'selection' : 'full_site';
  }
  if (effectiveMode === 'selection' && targetNodes.length === 0) {
    effectiveMode = 'full_site';
  }

  const targetSummary = targetNodes.length === 0
    ? 'Tüm Sayfa (Yeni Tam Site Üretimi)'
    : targetNodes.length === 1
    ? `${targetNodes[0].name || `<${targetNodes[0].type || 'div'}>`} (${targetNodes[0].id})`
    : `${targetNodes.length} Seçili Öğe`;

  return {
    effectiveMode,
    targetNodes,
    targetIds: targetNodes.map((n) => n.id),
    targetSummary,
  };
}

const REDESIGN_INTENT_KEYWORDS = [
  'olmamis', 'olmamış', 'begenmedim', 'beğenmedim', 'kotu', 'kötü', 'cirkin', 'çirkin',
  'sikici', 'sıkıcı', 'bozuk', 'karisik', 'karışık', 'bastan', 'baştan', 'yeniden tasarla',
  'yeniden yap', 'elden gecir', 'elden geçir', 'degistir', 'değiştir', 'oturmamis', 'oturmamış',
  'patlamis', 'patlamış', 'tekrar tasarla', 'baska tasarim', 'başka tasarım', 'varyasyon',
  'guzellestir', 'güzelleştir', 'modernlestir', 'modernleştir', 'redesign', 'remake', 'overhaul', 'ugly',
];

function normalizeForIntent(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Detects whether the user wants a bold creative redesign (e.g. "bu olmamış", "baştan tasarla")
 * rather than a minor CSS/text tweak.
 */
export function detectAiRedesignIntent(userPrompt = '') {
  const norm = normalizeForIntent(userPrompt).trim();
  if (!norm) return false;
  return REDESIGN_INTENT_KEYWORDS.some((kw) => norm.includes(normalizeForIntent(kw)));
}

/**
 * Resolves ideal creativity temperature per execution scope and redesign intent.
 */
export function resolveAiTemperature({ effectiveMode = 'full_site', isRedesign = false } = {}) {
  if (effectiveMode === 'selection') {
    return isRedesign ? 0.85 : 0.48;
  }
  return isRedesign ? 0.92 : 0.82;
}

/**
 * Builds valid alternating Gemini `contents` turns from prior chat messages,
 * appending the live context-rich prompt as the final `user` turn.
 */
export function buildGeminiRequestContents({ conversationHistory = [], systemPrompt = '' } = {}) {
  const historyTurns = [];
  const recent = (Array.isArray(conversationHistory) ? conversationHistory : [])
    .filter((m) => m && m.id !== 'welcome' && !m.isError && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-6);

  recent.forEach((msg) => {
    const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
    const cleanText = msg.role === 'assistant'
      ? JSON.stringify({ message: msg.rawMessage || msg.text })
      : String(msg.promptText || msg.text).trim();
    if (!cleanText) return;
    if (historyTurns.length === 0 && geminiRole !== 'user') return;
    const prev = historyTurns[historyTurns.length - 1];
    if (prev && prev.role === geminiRole) {
      prev.parts[0].text = `${prev.parts[0].text}\n${cleanText}`;
    } else {
      historyTurns.push({ role: geminiRole, parts: [{ text: cleanText }] });
    }
  });

  if (historyTurns.length > 0 && historyTurns[historyTurns.length - 1].role === 'user') {
    historyTurns.pop();
  }

  return [
    ...historyTurns,
    { role: 'user', parts: [{ text: String(systemPrompt || '') }] },
  ];
}

/**
 * Builds a clean, context-rich prompt for either full-site architecture generation
 * or strict surgical editing / creative redesign of selected canvas subtrees.
 */
export function buildAiSystemPrompt({
  effectiveMode = 'full_site',
  elements = [],
  targetNodes = [],
  canvasSettings = { width: 1280, height: 1350, backgroundColor: '#ffffff' },
  userPrompt = '',
  isRedesign = false,
}) {
  const stageW = Number(canvasSettings?.width) || 1280;
  const wantsRedesign = Boolean(isRedesign) || detectAiRedesignIntent(userPrompt);
  const schemaRules = `CraftStudio AST Düğüm Şeması (ÇOK ÖNEMLİ GEOMETRİ KURALLARI):
- id: benzersiz kısa string (örn: "ai-nav-1", "ai-hero-h1")
- type: Geçerli HTML5 tag adı ("nav", "header", "section", "div", "article", "h1", "h2", "h3", "p", "span", "button", "a", "img", "footer")
- name: Açıklayıcı Türkçe katman adı
- x, y: SAYISAL PİKSEL! Her eleman (ve çocukları) ebeveyn kapsayıcısının sol-üst (0, 0) noktasına göre MUTLAK piksel koordinatla yerleşir. Çocukların x+width ve y+height değerleri ebeveyn ölçüsünü aşmamalı ve kardeş öğeler üst üste binmemelidir!
- width, height: SAYISAL PİKSEL! Tüm metinlere, başlıklara ve butonlara yeterli genişlik ve yükseklik ver.
- positionMode: Opsiyonel ("sticky" yalnızca üst navbar için)
- style: camelCase CSS nesnesi (backgroundColor, background, color, fontSize, fontWeight, borderRadius, boxShadow, padding, lineHeight, letterSpacing, objectFit). DİKKAT: style içine left, top, position, width, height, margin veya border string YAZMA; kenarlık için borderWidth (sayı), borderColor (renk), borderRadius (sayı) üst alanlarını kullan!
- attrs: HTML öznitelikleri (href, src, alt, type vb. - img için geçerli Unsplash URL ver)
- textContent: Metin içeriği (buton, başlık, paragraf, link, rozet için zorunlu)
- children: Alt eleman dizisi []`;

  const artDirectionGuide = `SANAT YÖNETMENLİĞİ & YARATICI TASARIM STANDARTLARI (ÇOK ÖNEMLİ — KLiŞELERİ YASAKLA):
- YASAKLAR: Kullanıcı özellikle istemedikçe klişe lacivert-mavi (#0f172a / #3b82f6) SaaS şablonları üretme; başlık ve butonlara ASLA emoji (🚀, ⚡, ✨) koyma; birbirinin kopyası sıkıcı kutular dizme.
- PALET ÇEŞİTLİLİĞİ: Sektöre uygun özgün ve pahalı hissettiren palet seç:
  1. Lüks Atelier / Takı / Moda: Zemin #0b0a09, Kart #151311, İnce Çerçeve #2d261d, Vurgu Şampanya Altın #d4af37 -> #e8cf88, Ana Yazı #f7f2e9, İkincil #a69d92
  2. Editoryal Krem / Mimari / Kahve: Zemin #f6f2eb, Kart #ffffff, İnce Çerçeve #e4ddd2, Vurgu Sıcak Terracotta/Kömür #181512 & #b45309
  3. Zümrüt & Bronz Botaniği: Zemin #091310, Kart #111f1a, Çerçeve #1e352d, Vurgu #d6b174 & #10b981
  4. Modern Swiss Galeri: Zemin #0d0d0f, Kart #16161a, Vurgu Elektrik Limonu #d9f99d veya Saf Beyaz #fafafa
- TİPOGRAFİ & HİYERARŞİ:
  - Üst mikro etiket (eyebrow): 11px-12px uppercase, letterSpacing "0.18em", fontWeight "600", ince çerçeveli veya saf metin.
  - Hero Ana Başlık (h1): fontSize 46px-56px, fontFamily "'Playfair Display', Georgia, serif" (editoryal/lüks için) veya "'Plus Jakarta Sans', sans-serif", letterSpacing "-0.025em", lineHeight "1.08".
  - Alt açıklamalar: 15px-17px, rahat satır aralığı ("1.65"), yüksek okunabilirlik.
- ASİMETRİK KOMPOZİSYON & GÖRSEL ZENGİNLİK:
  - Hero alanında solda güçlü başlık + açıklama + birincil + ikincil buton, sağda mutlaka kenarlıklı/gölgeli editoryal vitrin fotoğrafı ("img" etiketi + uygun Unsplash URL: örn mücevher https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&auto=format&fit=crop&q=85, mimari/teknoloji https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop&q=85, kahve/gastronomi https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&auto=format&fit=crop&q=85) kurgula.
  - Her bölümde cömert nefes alma alanı (28-40px iç boşluk), zarif "1px" sınır çizgileri, derinlikli kartlar, fiyat/detay etiketleri ve gerçek Türkçe marka metinleri üret.
  - Kinetik canlılık için animation: { className: "animate-slide-up" veya "animate-fade-in", hoverClassName: "hover-lift" veya "hover-underline-center" } ekle.`;

  const toneRule = `YANIT TONU VE ADIM LİSTESİ:
- "message" alanında kullanıcıyla samimi, sıcak ve net Türkçe konuş (ör: "Tamam knk, Hero alanını editoryal altın ve obsidyen kompozisyonla baştan kurdum."). Teknik JSON terimleri anlatma.
- "changes" dizisinde yaptığın her somut değişikliği veya oluşturduğun bölümü 5-12 kelimelik net Türkçe maddeler halinde TEKER TEKER sırala.`;

  if (effectiveMode === 'selection' && targetNodes.length > 0) {
    const pageOutline = (elements || []).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      bg: n.style?.background || n.style?.backgroundColor || null,
    }));

    const redesignDirective = wantsRedesign
      ? `YENİDEN TASARIM (REDESIGN) MODU AKTİF:
- Kullanıcı seçili alanı beğenmedi veya kökten yenilemeni istedi! Sadece renk/metin rötuşu YAPMA.
- Seçili kök düğümün id, x, y (ve uygun ise dış width) koordinatlarını koruyarak içindeki tüm çocuk hiyerarşisini, görsel kompozisyonu, tipografi ölçeğini, kart/rozet/buton düzenini ve renk paletini modern bir tasarımcı gibi SIFIRDAN YENİDEN TASARLA.
- Yeni düzen gerekirse bölümün height değerini alt öğeler ferah sığacak biçimde ayarlayabilirsin; görsel, rozet, başlık, açıklama ve butonları x/y ile çakışmasız yerleştir.`
      : `SEÇİLİ ALAN DÜZENLEME KURALLARI:
- Sayfadaki seçili olmayan diğer bölümlere DOKUNMA, sadece hedef node'ların güncel halini "updatedNodes" dizisinde ver.
- Mevcut ebeveyn id, x, y değerlerini kullanıcı aksi istemedikçe koru; alt çocukları x/y ile çakışmadan hizala ve yüksek kontrast sağla.`;

    return `Sen CraftStudio'da kullanıcıyla birlikte çalışan kıdemli ve samimi bir web tasarım ajanısın. Kullanıcı mevcut sayfadan YALNIZCA SEÇİLİ BÖLÜM(LER) üzerinde çalışma istiyor.

${schemaRules}

${artDirectionGuide}

${toneRule}

SAYFA GENEL ÖZETİ (Uyumluluk için bağlam):
${JSON.stringify(pageOutline)}

DÜZENLENECEK SEÇİLİ HEDEF ALT AĞAÇ(LAR):
${JSON.stringify(targetNodes, null, 2)}

KURALLAR:
1. SADECE geçerli JSON döndür:
{
  "message": "Tamam knk, ... şeklinde samimi 1-2 cümlelik Türkçe özet",
  "changes": [
    "Yaptığım 1. somut değişiklik...",
    "Yaptığım 2. somut değişiklik..."
  ],
  "updatedNodes": [ ... güncellenmiş/yeniden tasarlanmış hedef alt ağaç düğümleri (mevcut kök id değerlerini koru!) ... ]
}
${redesignDirective}

KULLANICI TALEBİ:
${userPrompt}`;
  }

  return `Sen CraftStudio'da kullanıcıyla birlikte çalışan kıdemli ve samimi bir web tasarım ajanısın. Kullanıcı isteğine göre sıfırdan veya mevcut tuval üzerinde eksiksiz, modern, yüksek kontrastlı ve çarpıcı TAM WEB SİTESİ üreteceksin.

Tuval Ölçüleri: Genişlik ${stageW}px (kök bölümler x: 0..${stageW} arasında düzgün dikey akışla y = 0'dan aşağı doğru hizalanmalı).

${schemaRules}

${artDirectionGuide}

${toneRule}

TAM SİTE ÜRETİM KURALLARI:
1. SADECE geçerli JSON döndür:
{
  "message": "Tamam knk, ... şeklinde samimi 1-2 cümlelik Türkçe özet",
  "changes": [
    "Oluşturulan/güncellenen 1. bölüm veya özellik...",
    "Oluşturulan/güncellenen 2. bölüm veya özellik..."
  ],
  "elements": [ ... tüm sayfa bölümleri (Navbar -> Hero -> Özellikler/Vitrin -> İstatistik/SSS -> CTA -> Footer) ... ]
}
2. Kök bölümleri üst üste bindirme (Navbar y:0 height:72, Hero y:88, sonraki bölümler arasında 28-40px dikey boşluk bırak).
3. Her kapsayıcı section/nav/footer içinde children elemanlarının koordinatları ebeveynine göre göreceli (0,0 tabanlı) olsun, her biri açık sayısal x, y, width, height taşısın ve asla ebeveyn sınırını taşırmasın.
4. En az 4-5 zengin bölüm (Sticky Navbar, Güçlü Hero + Görsel + CTA, 3 sütunlu Kartlar/Özellikler, İstatistik veya CTA Banner, Kurumsal Footer) üret.
5. Tüm buton/link/başlık renklerinde WCAG uyumlu yüksek kontrast ve modern tipografi kullan.

MEVCUT TUVAL DURUMU (Varsa referans, tamamen yenileyebilirsin):
${JSON.stringify((elements || []).map((n) => ({ id: n.id, type: n.type, name: n.name, y: n.y, height: n.height })))}

KULLANICI TALEBİ:
${userPrompt}`;
}

/**
 * Extracts valid JSON from a Gemini text completion cleanly.
 */
export function parseAiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Yapay zeka boş yanıt döndürdü.');
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (jsonErr) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Yapay zeka yanıtı geçerli JSON formatında okunamadı: ' + jsonErr.message);
  }
}

/**
 * Sanitizes AI-generated AST nodes recursively: ensures valid HTML5 tags,
 * numeric geometry, camelCase styles, unique IDs, and arrays.
 */
export function sanitizeAiAstNodes(rawNodes, prefix = 'ai', seenIds = new Set()) {
  if (!Array.isArray(rawNodes)) return [];

  return rawNodes
    .filter((node) => node && typeof node === 'object')
    .map((node, idx) => {
      const rawTag = String(node.type || 'div').toLowerCase().trim();
      const type = TAG_SYNONYMS[rawTag] || rawTag;

      let id = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `${prefix}-node-${Date.now()}-${idx}`;
      while (seenIds.has(id)) {
        id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
      }
      seenIds.add(id);

      const nextStyle = {};
      if (node.style && typeof node.style === 'object') {
        Object.entries(node.style).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            nextStyle[toCamelCssKey(k)] = v;
          }
        });
      }

      const num = (v, fallback) => {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
      };

      const children = Array.isArray(node.children)
        ? sanitizeAiAstNodes(node.children, `${prefix}-c${idx}`, seenIds)
        : [];

      const cleanedNode = {
        ...node,
        id,
        type,
        name: node.name || `<${type}>`,
        x: num(node.x, 0),
        y: num(node.y, 0),
        width: Math.max(12, num(node.width, type === 'nav' || type === 'footer' ? 1280 : 320)),
        height: Math.max(12, num(node.height, type === 'nav' ? 72 : 120)),
        style: nextStyle,
        attrs: node.attrs && typeof node.attrs === 'object' ? { ...node.attrs } : {},
        children,
      };

      if (typeof node.textContent === 'string') {
        cleanedNode.textContent = node.textContent;
      } else if (typeof node.content === 'string') {
        cleanedNode.textContent = node.content;
      }

      return cleanedNode;
    });
}

/**
 * Calculates required canvas height to fit all root elements cleanly with bottom padding.
 */
export function computeRequiredStageHeight(elements = [], currentHeight = 1350) {
  const maxBottom = (elements || []).reduce(
    (max, el) => Math.max(max, (Number(el?.y) || 0) + (Number(el?.height) || 0)),
    0
  );
  if (maxBottom <= 0) return currentHeight;
  return Math.max(currentHeight, Math.min(6400, maxBottom + 80));
}

function describeNodeBg(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.fillType === 'gradient' && node.gradient) {
    return `${node.gradient.color1 || ''} → ${node.gradient.color2 || ''}`;
  }
  return node.style?.background || node.style?.backgroundColor || node.fillColor || '';
}

function collectNodeDiffBullets(beforeNode, afterNode) {
  if (!afterNode || typeof afterNode !== 'object') return [];
  const label = afterNode.name || beforeNode?.name || afterNode.type || 'Bileşen';
  if (!beforeNode) {
    const childCount = Array.isArray(afterNode.children) ? afterNode.children.length : 0;
    return [
      `${label} bölümü oluşturuldu (${Math.round(afterNode.height || 0)}px${childCount ? `, ${childCount} alt öğe` : ''})`,
    ];
  }

  const bullets = [];
  const beforeBg = describeNodeBg(beforeNode);
  const afterBg = describeNodeBg(afterNode);
  if (afterBg && afterBg !== beforeBg) {
    bullets.push(`${label} arka planı güncellendi (${afterBg})`);
  }
  if (afterNode.textColor && afterNode.textColor !== beforeNode.textColor) {
    bullets.push(`${label} yazı rengi ${afterNode.textColor} yapıldı`);
  }
  if (afterNode.fontSize && afterNode.fontSize !== beforeNode.fontSize) {
    bullets.push(`${label} yazı boyutu ${afterNode.fontSize}px olarak ayarlandı`);
  }
  if (afterNode.textContent && afterNode.textContent !== beforeNode.textContent) {
    const snippet = String(afterNode.textContent).trim().slice(0, 42);
    bullets.push(`${label} metni yenilendi: "${snippet}${afterNode.textContent.length > 42 ? '...' : ''}"`);
  }
  if (afterNode.height && beforeNode.height && Math.abs(Number(afterNode.height) - Number(beforeNode.height)) >= 8) {
    bullets.push(`${label} yüksekliği ${beforeNode.height}px → ${afterNode.height}px güncellendi`);
  }

  const beforeChildren = Array.isArray(beforeNode.children) ? beforeNode.children : [];
  const afterChildren = Array.isArray(afterNode.children) ? afterNode.children : [];
  if (afterChildren.length !== beforeChildren.length) {
    bullets.push(`${label} iç düzeni yenilendi (${beforeChildren.length} → ${afterChildren.length} alt öğe)`);
  } else {
    const beforeChildMap = new Map(beforeChildren.map((ch) => [ch?.id, ch]));
    afterChildren.forEach((ch) => {
      if (!ch) return;
      const prevCh = beforeChildMap.get(ch.id);
      if (!prevCh) {
        bullets.push(`${label} içine "${ch.name || ch.type || 'Yeni öğe'}" eklendi`);
      } else {
        if (ch.textContent && ch.textContent !== prevCh.textContent) {
          const snippet = String(ch.textContent).trim().slice(0, 36);
          bullets.push(`"${ch.name || ch.type}" metni "${snippet}${ch.textContent.length > 36 ? '...' : ''}" yapıldı`);
        }
        const chBg = describeNodeBg(ch);
        if (chBg && chBg !== describeNodeBg(prevCh)) {
          bullets.push(`"${ch.name || ch.type}" rengi ${chBg} olarak değiştirildi`);
        }
      }
    });
  }

  if (bullets.length === 0) {
    bullets.push(`${label} (${afterNode.type || 'div'}) bölümü yeniden düzenlendi`);
  }
  return bullets;
}

/**
 * Normalizes Gemini's optional `changes` array and guarantees deterministic
 * step-by-step bullets from the AST diff when omitted or incomplete.
 */
export function summarizeAiChanges({
  beforeElements = [],
  afterElements = [],
  targetIds = [],
  parsedChanges = [],
  effectiveMode = 'full_site',
}) {
  const aiBullets = Array.isArray(parsedChanges)
    ? parsedChanges.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  if (aiBullets.length > 0) {
    return aiBullets.slice(0, 12);
  }

  const astBullets = [];
  if (effectiveMode === 'selection' && targetIds.length > 0) {
    targetIds.forEach((id) => {
      const beforeMatch = findNodeAndParent(beforeElements, id)?.node || null;
      const afterMatch = findNodeAndParent(afterElements, id)?.node || null;
      astBullets.push(...collectNodeDiffBullets(beforeMatch, afterMatch));
    });
  } else {
    (afterElements || []).forEach((node) => {
      const childCount = Array.isArray(node.children) ? node.children.length : 0;
      const bgLabel = describeNodeBg(node);
      astBullets.push(
        `${node.name || node.type || 'Bölüm'} eklendi (${Math.round(node.width || 0)}×${Math.round(node.height || 0)}px${childCount ? `, ${childCount} öğe` : ''}${bgLabel ? `, ${bgLabel}` : ''})`
      );
    });
  }

  return Array.from(new Set(astBullets)).slice(0, 12);
}

/**
 * Merges a parsed AI response into the Studio tree cleanly:
 * - 'full_site' replaces canvas elements with sanitized new architecture.
 * - 'selection' patches ONLY targeted selected nodes in place, leaving all siblings untouched.
 */
export function applyAiResponseToTree({
  elements = [],
  parsedResponse = {},
  effectiveMode = 'full_site',
  targetIds = [],
  currentStageHeight = 1350,
}) {
  if (effectiveMode === 'selection' && targetIds.length > 0) {
    const incomingRaw = Array.isArray(parsedResponse.updatedNodes)
      ? parsedResponse.updatedNodes
      : Array.isArray(parsedResponse.elements)
      ? parsedResponse.elements
      : [];

    if (incomingRaw.length === 0) {
      throw new Error('Yapay zeka seçili bölüm için güncellenecek öğe döndürmedi.');
    }

    const sanitizedIncoming = sanitizeAiAstNodes(incomingRaw, 'ai-edit');
    let nextTree = [...elements];
    let changedCount = 0;
    const appliedTargetIds = [];

    targetIds.forEach((targetId, idx) => {
      const matched = sanitizedIncoming.find((item) => item.id === targetId)
        || (targetIds.length === 1 ? sanitizedIncoming[0] : sanitizedIncoming[idx]);
      if (!matched) return;
      const origRaw = incomingRaw.find((item) => item?.id === targetId)
        || (targetIds.length === 1 ? incomingRaw[0] : incomingRaw[idx])
        || {};
      nextTree = updateNodeInTree(nextTree, targetId, (prevNode) => {
        const hasExplicitX = Number.isFinite(Number(origRaw.x)) && (Number(origRaw.x) !== 0 || (prevNode?.x || 0) === 0);
        const hasExplicitY = Number.isFinite(Number(origRaw.y)) && (Number(origRaw.y) !== 0 || (prevNode?.y || 0) === 0);
        const resolvedX = hasExplicitX ? matched.x : (prevNode?.x ?? matched.x);
        const resolvedY = hasExplicitY ? matched.y : (prevNode?.y ?? matched.y);
        const resolvedW = Number.isFinite(Number(origRaw.width)) ? matched.width : (prevNode?.width ?? matched.width);
        return {
          ...matched,
          id: targetId,
          x: resolvedX,
          y: resolvedY,
          width: resolvedW,
        };
      });
      appliedTargetIds.push(targetId);
      changedCount += 1;
    });

    const changes = summarizeAiChanges({
      beforeElements: elements,
      afterElements: nextTree,
      targetIds: appliedTargetIds,
      parsedChanges: parsedResponse?.changes,
      effectiveMode: 'selection',
    });

    return {
      nextElements: nextTree,
      recommendedHeight: computeRequiredStageHeight(nextTree, currentStageHeight),
      changedCount,
      appliedTargetIds,
      changes,
    };
  }

  const fullRaw = Array.isArray(parsedResponse.elements)
    ? parsedResponse.elements
    : Array.isArray(parsedResponse.updatedNodes)
    ? parsedResponse.updatedNodes
    : [];

  if (fullRaw.length === 0) {
    throw new Error('Yapay zeka geçerli bir site yapısı (elements) döndürmedi.');
  }

  const nextElements = sanitizeAiAstNodes(fullRaw, 'ai-site');
  const changes = summarizeAiChanges({
    beforeElements: elements,
    afterElements: nextElements,
    targetIds: nextElements.map((n) => n.id),
    parsedChanges: parsedResponse?.changes,
    effectiveMode: 'full_site',
  });
  return {
    nextElements,
    recommendedHeight: computeRequiredStageHeight(nextElements, 1350),
    changedCount: nextElements.length,
    appliedTargetIds: nextElements.map((n) => n.id),
    changes,
  };
}
