# CraftStudio Klavye Kısayolları Envanteri

Bu belge `src/hooks/useShortcuts.js` (`App.jsx` global `keydown` dinleyicisi) ve `src/components/Canvas.jsx` içindeki `window` klavye dinleyicilerini, çalışma koşullarını ve çakışma analizini listeler.

---

## 1. Global Kısayollar (`src/hooks/useShortcuts.js`)

> **Ortak Koruma (`shouldHandleGlobalCanvasShortcut`):**
> `Ctrl+K` dışındaki tüm kısayollar aşağıdaki durumlarda **devre dışıdır**:
> 1. Herhangi bir modal açıksa (`showExportModal`, `showTutorial`, `showAddTagModal`, `showImportReportModal`, `showAttributesInspectorModal`, `functionEditorState.isOpen`).
> 2. Odak (`document.activeElement` veya `e.target`) bir `<input>`, `<textarea>`, `<select>`, `<option>` veya `contentEditable` öğesi içindeyse.

| Tuş / Kombinasyon | Mod | İşlev | Çalışma Koşulu |
| :--- | :--- | :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Evrensel (`design`, `backend`) | Yüzen AI Sohbet Kutusunu (`FloatingAIChatDock`) açar ve odaklanır (`setAiDockMinimized(false)`, `setAiFocusSignal(s => s + 1)`) | Modal açık değilken, `!showWelcomeScreen` ve `!previewMode` iken *(input odaklı olsa bile çalışır)* |
| `Ctrl+S` / `Cmd+S` | Evrensel (`design`, `backend`) | Projeyi kaydet (`handleSaveProject(false)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Evrensel (`design`, `backend`) | Projeyi farklı kaydet (`handleSaveProject(true)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+O` / `Cmd+O` | Evrensel (`design`, `backend`) | Proje / site dosyası aç (`handleOpenProjectFile()`) | Ortak koruma *(Karşılama ekranında da çalışır)* |
| `Ctrl+Shift+O` / `Cmd+Shift+O` | Evrensel (`design`, `backend`) | Klasör içe aktar (`handleOpenProjectFolder()`) | Ortak koruma *(Karşılama ekranında da çalışır)* |
| `Ctrl+E` / `Cmd+E` | Evrensel (`design`, `backend`) | Canlıya Al & Yayınla modalını aç (`setShowExportModal(true)`) | Ortak koruma + `!showWelcomeScreen` |
| `Ctrl+A` / `Cmd+A` | Yalnızca `design` | Aktif kapsamdaki tüm öğeleri seç (`handleSelectAll()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+C` / `Cmd+C` | Yalnızca `design` | Seçili öğeleri panoya kopyala (`handleCopy()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Yalnızca `design` | Seçili öğenin görsel biçimini kopyala (`handleCopyElementStyle({ activateTool: false })`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+X` / `Cmd+X` | Yalnızca `design` | Seçili öğeleri kes (`handleCut()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+V` / `Cmd+V` | Yalnızca `design` | Panodaki öğeleri yapıştır (`handlePaste()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Yalnızca `design` | Kopyalanan görsel biçimi seçili öğelere uygula (`handlePasteElementStyle()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+D` / `Cmd+D` | Yalnızca `design` | Seçili öğeleri çoğalt (`handleDuplicateSelected()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Yalnızca `design` | Seçili öğeleri kilitle / kilidi aç (`handleToggleLockSelected()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+Shift+N` / `Cmd+Shift+N` | Yalnızca `design` | Yeni boş proje başlat (`handleStartNewProject('blank')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+N` / `Cmd+N` | Yalnızca `design` | Yeni sayfa sekmesi ekle (`handleAddTab()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+G` / `Cmd+G` | Yalnızca `design` | Seçili öğeleri grupla (`handleGroupSelected()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` (`selectedIds.length > 1` ise etkili) |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Yalnızca `design` | Seçili grubu çöz (`handleUngroupSelected()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+Z` / `Cmd+Z` | Yalnızca `design` | Geri al (`handleUndo()`) *(Backend modunda no-op; tasarım geçmişine dokunmaz)* | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` (`historyIndex > 0` ise) |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Yalnızca `design` | İleri al (`handleRedo()`) *(Backend modunda no-op; tasarım geçmişine dokunmaz)* | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` (`historyIndex < history.length - 1` ise) |
| `Delete` / `Backspace` | Yalnızca `design` | Seçili öğeleri sil (`handleDeleteSelected()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `selectedIds.length > 0` |
| `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | Yalnızca `design` | Seçili öğeleri `1px` (`Shift` basılıysa `10px`) kaydır (`applyMultipleUpdatesForViewport` + `updateElementsWithHistory`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `selectedIds.length > 0` |
| `Escape` | Evrensel (`design`, `backend`) | Öncelik sırasıyla: 1) `previewMode` açıksa kapatır, 2) `activeTool !== 'select'` ise `'select'` aracına döner, 3) yalnızca `design` modunda `handleSelectParent()` ile üst kapsama çıkar veya seçimi temizler *(Backend modunda korunan tasarım seçimine dokunmaz)* | Ortak koruma + `!showWelcomeScreen` |
| `Enter` | Yalnızca `design` | Seçili kapsayıcının ilk alt öğesini seçer (`handleSelectChild()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!isCtrl && !e.altKey && !e.shiftKey` |
| `Ctrl+=` / `Ctrl++` | Yalnızca `design` | Yakınlaştır (`setZoom(z => clampCanvasZoom(z + 0.1))`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+-` | Yalnızca `design` | Uzaklaştır (`setZoom(z => clampCanvasZoom(z - 0.1))`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `Ctrl+0` | Yalnızca `design` | Zoom sıfırla / sığdır (`handleResetZoom()`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` |
| `]` (`BracketRight`) | Yalnızca `design` | Seçili öğeyi bir öne getir (`handleZOrderSelected('forward')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!e.altKey` + `selectedIds.length > 0` |
| `Ctrl+]` (`Ctrl+BracketRight`) | Yalnızca `design` | Seçili öğeyi en öne getir (`handleZOrderSelected('front')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!e.altKey` + `selectedIds.length > 0` |
| `[` (`BracketLeft`) | Yalnızca `design` | Seçili öğeyi bir arkaya gönder (`handleZOrderSelected('backward')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!e.altKey` + `selectedIds.length > 0` |
| `Ctrl+[` (`Ctrl+BracketLeft`) | Yalnızca `design` | Seçili öğeyi en arkaya gönder (`handleZOrderSelected('back')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!e.altKey` + `selectedIds.length > 0` |
| `Shift+G` | Yalnızca `design` | Düzen ızgarasını aç/kapat (`setShowLayoutGrid(v => !v)`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!isCtrl && !e.altKey && e.shiftKey` |
| `Shift+R` | Yalnızca `design` | Cetvelleri aç/kapat (`setShowRulers(v => !v)`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + `!isCtrl && !e.altKey && e.shiftKey` |
| `V` | Yalnızca `design` | Seçim aracı (`setActiveTool('select')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız (`!isCtrl && !altKey && !shiftKey`) |
| `H` | Yalnızca `design` | El / Kaydırma aracı (`setActiveTool('hand')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `Z` | Yalnızca `design` | Büyüteç aracı (`setActiveTool('zoom')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `R` | Yalnızca `design` | Kutu / Dikdörtgen çizim aracı (`setActiveTool('rectangle')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `O` | Yalnızca `design` | Daire / Elips çizim aracı (`setActiveTool('circle')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `L` | Yalnızca `design` | Çizgi çizim aracı (`setActiveTool('line')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `F` | Yalnızca `design` | Çerçeve (Frame) çizim aracı (`setActiveTool('frame')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `T` | Yalnızca `design` | Metin çizim aracı (`setActiveTool('text')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |
| `I` | Yalnızca `design` | Renk Damlalığı aracı (`setActiveTool('eyedropper')`) | Ortak koruma + `!showWelcomeScreen` + `activeMode === 'design'` + modifiersız |

---

## 2. `src/components/Canvas.jsx` İçindeki `window` Klavye Dinleyicileri (Yalnızca `design` Modu)

> **Mod Durumu:** `activeMode === 'backend'` olduğunda `<Canvas />` bileşeni unmount edildiği için aşağıdaki tüm `useEffect` temizleme (`cleanup`) fonksiyonları çalışır ve Backend modunda bu `window` dinleyicilerinin hiçbiri bağlı değildir.

1. **Modifier & Gezinme Dinleyicisi (`Canvas.jsx` L993–1060 — `keydown`, `keyup`, `blur` — Mod: Yalnızca `design`):**
   - `Alt` (`keydown` / `keyup`):
     - İşlev: `isAltPressed` / `isAltPressedRef` durumunu günceller. Sürükleme sırasında `Alt+Drag` çoğaltma önizlemesini (`syncDragPresentation`), boşta iken `Alt+Hover` akıllı mesafe ölçeri (`computeAltMeasureGuides`) ve Büyüteç aracında `Alt+Tık` uzaklaştırmayı etkinleştirir.
     - Koşul: Yazı alanı odaklı değilse (`!isTypingFocused()`) `e.preventDefault()` çağırır.
   - `Space` (`' '` — `keydown` / `keyup`):
     - İşlev: Basılı tutulduğu sürece `isSpacePressed` / `isSpacePressedRef` durumunu `true` yaparak geçici El (Pan) modunu etkinleştirir; bırakıldığında (`keyup`) `panModeRef.current === 'space'` ise pan işlemini sonlandırır.
     - Koşul: `!isTypingFocused() && !e.repeat` iken `e.preventDefault()` çağırır.
   - `Control` / `Meta` (`keydown` / `keyup`):
     - İşlev: `isCtrlPressed` durumunu günceller; fare sabitken bile grup içi doğrudan derin seçim (X-Ray hover) adayını yeniden hesaplar (`Canvas.jsx` L1186–1192).
     - Koşul: Her zaman (`Canvas` mount edilmişken).

2. **Sağ Tık Bağlam Menüsü Kapatma Dinleyicisi (`Canvas.jsx` L1201–1221 — `keydown` capture — Mod: Yalnızca `design`):**
   - `Escape` (`keydown`, `capture: true`):
     - İşlev: Tuval sağ tık bağlam menüsünü kapatır (`setContextMenu(null)`) ve `ev.stopPropagation()` / `ev.stopImmediatePropagation()` ile `useShortcuts` Escape dalının aynı anda tetiklenmesini önler.
     - Koşul: Yalnızca `design` modunda ve `contextMenu !== null` iken bağlıdır.

---

## 3. `useShortcuts.js` (`App.jsx`) ile `Canvas.jsx` Arasındaki Çakışma Analizi

- **Çakışmayanlar:**
  - `Alt`, `Space` (`' '`), `Control` / `Meta`: `useShortcuts.js` tek başına `Alt`, `Space` veya `Control`/`Meta` tuşlarına aksiyon bağlamadığı için çakışma yoktur.
  - Tuval içi metin düzenleme (`editingTextNodeId` `<textarea>` L499, L545, L613): Odak `<textarea>` üzerinde olduğu için `shouldHandleGlobalCanvasShortcut` `false` döner; `Enter` ve `Escape` yalnızca metin düzenleyici tarafından işlenir.
- **Çakışan Tuş (`Escape` — Sağ Tık Bağlam Menüsü Açıkken):**
  - **Durum:** Tuval üzerinde sağ tık bağlam menüsü (`contextMenu`) açıkken `Escape` tuşuna basıldığında **hem `Canvas.jsx` (L1204) hem `useShortcuts.js` (`App.jsx` Escape dalı) aynı anda çalışır**.
  - **Neden:** `contextMenu` durumu `Canvas.jsx` içinde lokal tutulmaktadır (`useShortcuts` içindeki `isAnyModalOpen` kontrolünde yer almaz) ve `Canvas.jsx` içindeki `closeMenu` dinleyicisi `e.stopPropagation()` çağırmaz.
  - **Sonuç:** Sağ tık menüsü açıkken `Escape`'e basmak menüyü kapatırken aynı zamanda aktif aracı `'select'`e sıfırlar veya `activeTool === 'select'` ise `handleSelectParent()` tetikleyerek seçimi üst öğeye çıkarır / temizler. *(Talimat gereği davranış değiştirilmemiştir.)*
