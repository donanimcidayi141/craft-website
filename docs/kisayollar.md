# CraftStudio Klavye Kısayolları Envanteri

Bu belge `src/hooks/useShortcuts.js` (`App.jsx` global `keydown` dinleyicisi) ve `src/components/Canvas.jsx` içindeki `window` klavye dinleyicilerini, çalışma koşullarını ve çakışma analizini listeler.

---

## 1. Global Kısayollar (`src/hooks/useShortcuts.js`)

> **Ortak Koruma (`shouldHandleGlobalCanvasShortcut`):**
> `Ctrl+K` dışındaki tüm kısayollar aşağıdaki durumlarda **devre dışıdır**:
> 1. Herhangi bir modal açıksa (`showExportModal`, `showTutorial`, `showAddTagModal`, `showImportReportModal`, `showAttributesInspectorModal`, `functionEditorState.isOpen`).
> 2. Odak (`document.activeElement` veya `e.target`) bir `<input>`, `<textarea>`, `<select>`, `<option>` veya `contentEditable` öğesi içindeyse.

| Tuş / Kombinasyon | İşlev | Çalışma Koşulu |
| :--- | :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Yüzen AI Sohbet Kutusunu (`FloatingAIChatDock`) açar ve odaklanır (`setAiDockMinimized(false)`, `setAiFocusSignal(s => s + 1)`) | Modal açık değilken, `!showWelcomeScreen` ve `!previewMode` iken *(input odaklı olsa bile çalışır)* |
| `Ctrl+S` / `Cmd+S` | Projeyi kaydet (`handleSaveProject(false)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Projeyi farklı kaydet (`handleSaveProject(true)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+O` / `Cmd+O` | Proje / site dosyası aç (`handleOpenProjectFile()`) | Ortak koruma *(Karşılama ekranında da çalışır)* |
| `Ctrl+Shift+O` / `Cmd+Shift+O` | Klasör içe aktar (`handleOpenProjectFolder()`) | Ortak koruma *(Karşılama ekranında da çalışır)* |
| `Ctrl+E` / `Cmd+E` | Canlıya Al & Yayınla modalını aç (`setShowExportModal(true)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+A` / `Cmd+A` | Aktif kapsamdaki tüm öğeleri seç (`handleSelectAll()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+C` / `Cmd+C` | Seçili öğeleri panoya kopyala (`handleCopy()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Seçili öğenin görsel biçimini kopyala (`handleCopyElementStyle({ activateTool: false })`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+X` / `Cmd+X` | Seçili öğeleri kes (`handleCut()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+V` / `Cmd+V` | Panodaki öğeleri yapıştır (`handlePaste()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Kopyalanan görsel biçimi seçili öğelere uygula (`handlePasteElementStyle()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+D` / `Cmd+D` | Seçili öğeleri çoğalt (`handleDuplicateSelected()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Seçili öğeleri kilitle / kilidi aç (`handleToggleLockSelected()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+N` / `Cmd+Shift+N` | Yeni boş proje başlat (`handleStartNewProject('blank')`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+N` / `Cmd+N` | Yeni sayfa sekmesi ekle (`handleAddTab()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+G` / `Cmd+G` | Seçili öğeleri grupla (`handleGroupSelected()`) | Ortak koruma + `!showWelcomeScreen` (`selectedIds.length > 1` ise etkili) |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Seçili grubu çöz (`handleUngroupSelected()`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Z` / `Cmd+Z` | Geri al (`handleUndo()`) | Ortak koruma + `!showWelcomeScreen` (`historyIndex > 0` ise) |
| `Ctrl+Shift+Z` / `Ctrl+Y` | İleri al (`handleRedo()`) | Ortak koruma + `!showWelcomeScreen` (`historyIndex < history.length - 1` ise) |
| `Delete` / `Backspace` | Seçili öğeleri sil (`handleDeleteSelected()`) | Ortak koruma + `!showWelcomeScreen` + `selectedIds.length > 0` |
| `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | Seçili öğeleri `1px` (`Shift` basılıysa `10px`) kaydır (`applyMultipleUpdatesForViewport` + `updateElementsWithHistory`) | Ortak koruma + `!showWelcomeScreen` + `selectedIds.length > 0` |
| `Escape` | Öncelik sırasıyla: 1) `previewMode` açıksa kapatır, 2) `activeTool !== 'select'` ise `'select'` aracına döner, 3) `handleSelectParent()` ile üst kapsama çıkar veya seçimi temizler | Ortak koruma + `!showWelcomeScreen` |
| `Enter` | Seçili kapsayıcının ilk alt öğesini seçer (`handleSelectChild()`) | Ortak koruma + `!showWelcomeScreen` + `!isCtrl && !e.altKey && !e.shiftKey` |
| `Ctrl+=` / `Ctrl++` | Yakınlaştır (`setZoom(z => clampCanvasZoom(z + 0.1))`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+-` | Uzaklaştır (`setZoom(z => clampCanvasZoom(z - 0.1))`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+0` | Zoom sıfırla / sığdır (`handleResetZoom()`) | Ortak koruma + `!showWelcomeScreen` |
| `]` (`BracketRight`) | Seçili öğeyi bir öne getir (`handleZOrderSelected('forward')`) | Ortak koruma + `!showWelcomeScreen` + `!e.altKey` + `selectedIds.length > 0` |
| `Ctrl+]` (`Ctrl+BracketRight`) | Seçili öğeyi en öne getir (`handleZOrderSelected('front')`) | Ortak koruma + `!showWelcomeScreen` + `!e.altKey` + `selectedIds.length > 0` |
| `[` (`BracketLeft`) | Seçili öğeyi bir arkaya gönder (`handleZOrderSelected('backward')`) | Ortak koruma + `!showWelcomeScreen` + `!e.altKey` + `selectedIds.length > 0` |
| `Ctrl+[` (`Ctrl+BracketLeft`) | Seçili öğeyi en arkaya gönder (`handleZOrderSelected('back')`) | Ortak koruma + `!showWelcomeScreen` + `!e.altKey` + `selectedIds.length > 0` |
| `Shift+G` | Düzen ızgarasını aç/kapat (`setShowLayoutGrid(v => !v)`) | Ortak koruma + `!showWelcomeScreen` + `!isCtrl && !e.altKey && e.shiftKey` |
| `Shift+R` | Cetvelleri aç/kapat (`setShowRulers(v => !v)`) | Ortak koruma + `!showWelcomeScreen` + `!isCtrl && !e.altKey && e.shiftKey` |
| `V` | Seçim aracı (`setActiveTool('select')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız (`!isCtrl && !altKey && !shiftKey`) |
| `H` | El / Kaydırma aracı (`setActiveTool('hand')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `Z` | Büyüteç aracı (`setActiveTool('zoom')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `R` | Kutu / Dikdörtgen çizim aracı (`setActiveTool('rectangle')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `O` | Daire / Elips çizim aracı (`setActiveTool('circle')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `L` | Çizgi çizim aracı (`setActiveTool('line')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `F` | Çerçeve (Frame) çizim aracı (`setActiveTool('frame')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `T` | Metin çizim aracı (`setActiveTool('text')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |
| `I` | Renk Damlalığı aracı (`setActiveTool('eyedropper')`) | Ortak koruma + `!showWelcomeScreen` + modifiersız |

---

## 2. `src/components/Canvas.jsx` İçindeki `window` Klavye Dinleyicileri

1. **Modifier & Gezinme Dinleyicisi (`Canvas.jsx` L993–1060 — `keydown`, `keyup`, `blur`):**
   - `Alt` (`keydown` / `keyup`):
     - İşlev: `isAltPressed` / `isAltPressedRef` durumunu günceller. Sürükleme sırasında `Alt+Drag` çoğaltma önizlemesini (`syncDragPresentation`), boşta iken `Alt+Hover` akıllı mesafe ölçeri (`computeAltMeasureGuides`) ve Büyüteç aracında `Alt+Tık` uzaklaştırmayı etkinleştirir.
     - Koşul: Yazı alanı odaklı değilse (`!isTypingFocused()`) `e.preventDefault()` çağırır.
   - `Space` (`' '` — `keydown` / `keyup`):
     - İşlev: Basılı tutulduğu sürece `isSpacePressed` / `isSpacePressedRef` durumunu `true` yaparak geçici El (Pan) modunu etkinleştirir; bırakıldığında (`keyup`) `panModeRef.current === 'space'` ise pan işlemini sonlandırır.
     - Koşul: `!isTypingFocused() && !e.repeat` iken `e.preventDefault()` çağırır.
   - `Control` / `Meta` (`keydown` / `keyup`):
     - İşlev: `isCtrlPressed` durumunu günceller; fare sabitken bile grup içi doğrudan derin seçim (X-Ray hover) adayını yeniden hesaplar (`Canvas.jsx` L1186–1192).
     - Koşul: Her zaman.

2. **Sağ Tık Bağlam Menüsü Kapatma Dinleyicisi (`Canvas.jsx` L1201–1216 — `keydown`):**
   - `Escape` (`keydown`):
     - İşlev: Tuval sağ tık bağlam menüsünü kapatır (`setContextMenu(null)`).
     - Koşul: Yalnızca `contextMenu !== null` iken aktif olur (`ev.type === 'keydown' && ev.key === 'Escape'`).

---

## 3. `useShortcuts.js` (`App.jsx`) ile `Canvas.jsx` Arasındaki Çakışma Analizi

- **Çakışmayanlar:**
  - `Alt`, `Space` (`' '`), `Control` / `Meta`: `useShortcuts.js` tek başına `Alt`, `Space` veya `Control`/`Meta` tuşlarına aksiyon bağlamadığı için çakışma yoktur.
  - Tuval içi metin düzenleme (`editingTextNodeId` `<textarea>` L499, L545, L613): Odak `<textarea>` üzerinde olduğu için `shouldHandleGlobalCanvasShortcut` `false` döner; `Enter` ve `Escape` yalnızca metin düzenleyici tarafından işlenir.
- **Çakışan Tuş (`Escape` — Sağ Tık Bağlam Menüsü Açıkken):**
  - **Durum:** Tuval üzerinde sağ tık bağlam menüsü (`contextMenu`) açıkken `Escape` tuşuna basıldığında **hem `Canvas.jsx` (L1204) hem `useShortcuts.js` (`App.jsx` Escape dalı) aynı anda çalışır**.
  - **Neden:** `contextMenu` durumu `Canvas.jsx` içinde lokal tutulmaktadır (`useShortcuts` içindeki `isAnyModalOpen` kontrolünde yer almaz) ve `Canvas.jsx` içindeki `closeMenu` dinleyicisi `e.stopPropagation()` çağırmaz.
  - **Sonuç:** Sağ tık menüsü açıkken `Escape`'e basmak menüyü kapatırken aynı zamanda aktif aracı `'select'`e sıfırlar veya `activeTool === 'select'` ise `handleSelectParent()` tetikleyerek seçimi üst öğeye çıkarır / temizler. *(Talimat gereği davranış değiştirilmemiştir.)*
