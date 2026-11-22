# CraftStudio — Refactor Haritası (Aşama 1 Analizi)

- **Dal:** `refactor/workspace-core` (baz commit: `a3a9bbf`)
- **Hedef Dosyalar (Başlangıç Boyutları):**
  - `src/App.jsx` — **2.845 satır** (`110.364` bayt)
  - `src/components/Canvas.jsx` — **3.118 satır** (`132.760` bayt)
  - `src/components/PropertiesPanel.jsx` — **2.673 satır** (`130.129` bayt — Aşama 5'te detaylandırılacak)
- **Kapsam Dışı (Dokunulmayacak):** `src/components/WelcomeScreen.jsx`, `src/components/welcome/*`, `src/proto/*`

---

## 1. `src/App.jsx` Envanteri (Gruplandırılmış)

`src/App.jsx` tek bir `CraftStudioApp()` bileşeni (L101–2834), 1 üst seviye saf yardımcı (`buildTabState`, L81–99) ve 1 URL yönlendirici (`App`, L2837–2845) içeriyor.

### 1.1 Proje / Sekmeler / Geçmiş (Project, Tabs, History & AST)
- **Saf Yardımcı (Top-level):** `buildTabState` (L81–99)
- **State:**
  - `tabs` (L113) — çoklu sayfa sekme dizisi (`elements`, `canvasByViewport`, `initializedViewports`, `route`)
  - `activeTabId` (L117)
  - `projectMeta` (L132 — `{ id, name, filePath, createdAt }`)
  - `hasUnsavedChanges` (L138)
  - `projectFunctions` (L139)
  - `pageLinks` (L140)
  - `historyByTab` (L166 — sekme başına `{ items, index }` undo/redo yığını)
- **Ref & Senkronizasyon:**
  - `latestTabSnapshotRef` (L184) + `useEffect` (L185–190): `onUpdateElement` sonrası hemen çağrılan `handleCommitHistory()`'nin bayat React state okumamasını sağlayan senkron snapshot ref'i.
- **Türetilmiş Değerler (`useMemo` / inline):**
  - `activeTab` (L121), `rawElements` (L122), `elements` (`useMemo`, L123–126 via `resolveTreeForViewport`), `activeCanvasByViewport` (L128), `canvasSettings` (L129), `currentTabHistory` / `history` / `historyIndex` (L176–181)
- **Handler'lar (`useCallback` / fonksiyonlar):**
  - Çekirdek state & history: `setTabHistory` (`useCallback`, L229), `updateElementsWithHistory` (`useCallback`, L237), `handleCommitHistory` (`useCallback`, L268), `setCanvasSettings` (`useCallback`, L288)
  - Eleman güncelleme: `handleUpdateElement` (L305), `handleUpdateElementDirect` (L324), `handleUpdateMultipleElements` (L330)
  - Geçmiş: `handleUndo` (L1171), `handleRedo` (L1189)
  - Sekme & meta: `handleAddTab` (L1318), `handleCloseTab` (L1327), `handleRenameTab` (`useCallback`, L1337), `handleRenameProject` (L1853)
  - Fonksiyon CRUD: `handleSaveProjectFunction` (L740), `handleDeleteProjectFunction` (L765)
  - AST mutasyonları: `handleGroupSelected` (L403), `handleUngroupSelected` (L410), `handleDeleteSelected` (L421), `handleDuplicateSelected` (L434), `handleAltDuplicateElements` (`useCallback`, L466), `handleWrapSelected` (L698), `handleUnwrapElement` (L710), `handleReparentElement` (L895), `handleRenameElement` (L902), `handleAlignHorizontalCenter` (L907), `handleAlignVerticalCenter` (L914), `handleAddElementAt` (L922), `handleQuickAdd` (L944), `handleSelectNewTag` (L952), `handleAddPreset` (L1013), `handleRemoveBackground` (L1094), `handleZOrderSelected` (L1104), `handleToggleLockSelected` (L1113), `handleToggleHideSelected` (L1125)
  - Öğretici kısayol aksiyonları: `handleTutorialAddBox` (L1351), `handleTutorialApplyGradient` (L1371), `handleTutorialApplyBorderRadius` (L1384), `handleTutorialCenterBox` (L1393)

### 1.2 Seçim (Selection, Deep Scope & Clipboard)
- **State:**
  - `selectedIds` (L193)
  - `editingGroupId` (L194 — çift tıkla girilen grup izolasyonu)
  - `clipboard` (L227 — `Ctrl+C / X / V` için `{ type, nodes, sourceParentMap }`)
- **Türetilmiş Değer:**
  - `selectedElement` (L2453–2455)
- **Handler'lar:**
  - `handleSelectElements` (`useCallback`, L347 — ata/torun çakışmasını filtreler)
  - `handleToggleElementSelection` (`useCallback`, L366 — Shift+Tık)
  - `handleSelectAll` (L390)
  - `handleCopy` (L560), `handleCut` (L577), `handlePaste` (L601)
  - `handleSelectParent` (L670), `handleSelectChild` (L688)

### 1.3 Panel ve Çalışma Alanı Düzeni (Workspace Layout, Modals, Toast & Global Shortcuts)
- **State:**
  - Ekran / Modal görünürlüğü: `showWelcomeScreen` (L102), `showTutorial` (L103), `showExportModal` (L104), `showAddTagModal` (L105), `showAttributesInspectorModal` (L106), `showImportReportModal` (L110), `functionEditorState` (L141)
  - Bildirim: `previewToast` (L147) + **Ref:** `previewToastTimerRef` (L148)
  - Sol & Sağ Dock düzeni: `leftSidebarTab` (L206 — `'layers' | 'elements' | 'templates' | 'code' | 'ai' | null`), `rightDockOpen` (L209), `rightPropertiesTab` (L210), `rightDockWidth` (L211)
  - Yüzen AI Dock görünürlüğü: `aiDockMinimized` (L214), `aiFocusSignal` (L215)
  - Tuval düzen yardımcıları: `showLayoutGrid` (L222), `showRulers` (L223)
- **Türetilmiş Değer:**
  - `effectiveActivePanels` (L2457–2463)
- **Handler'lar:**
  - `showToastMessage` (`useCallback`, L154)
  - `handleOpenFunctionEditor` (L723)
  - `handleSelectRightDockTarget` (L1212), `handleDockFloatingInspector` (L1225), `togglePanel` (L1231)
- **Effect'ler:**
  - `document.title` & `#/editor` hash senkronizasyonu (L1568–1578)
  - `hashchange` dinleyicisi — welcome rotalarına dönüş (L1580–1589)
  - Global klavye kısayolları `keydown` (L2200–2444)

### 1.4 Tuval Görünümü (Canvas View: Zoom / Pan / Viewport)
- **State:**
  - `viewportMode` (L118 — `'desktop' | 'tablet' | 'mobile'`)
  - `zoom` (L201), `panOffset` (L202), `fitVersion` (L203)
- **Ref'ler:**
  - `fitCanvasRef` (L844), `centerHorizRef` (L845)
- **Handler'lar:**
  - `fitCanvasToViewport` (`useCallback`, L811)
  - `centerCanvasHorizontally` (`useCallback`, L833)
  - `handleResetZoom` (`useCallback`, L1208)
  - `handleSwitchViewport` (`useCallback`, L1399)
  - `handleResetViewportFromDesktop` (`useCallback`, L1447)
- **Effect'ler:**
  - Ref güncelleme `useEffect`leri (L846–851)
  - İlk açılış / sekme / viewport değişiminde çift `rAF` ile `fitCanvasToViewport` (L854–868)
  - `ResizeObserver` + `window.resize` ile yatay ortalama (L871–886)
  - Tablet/Mobile seçiliyken sekme değişince otomatik viewport adaptasyonu (L2447–2451)

### 1.5 Araçlar (Tools & Renkler & Biçim Boyacısı)
- **State:**
  - `activeTool` (L196 — `'select' | 'hand' | 'zoom' | 'rectangle' | 'circle' | 'line' | 'frame' | 'text' | 'eyedropper' | 'format_paint'`)
  - `primaryColor` (L197)
  - `secondaryColor` (L198)
  - `copiedElementStyle` (L224)
- **Handler'lar:**
  - `handleCopyElementStyle` (L1136)
  - `handlePasteElementStyle` (L1155)
  - *(Not: `handleSelectNewTag` L952, `handleAddElementAt` L922 ve `handleAddPreset` L1013 de araç durumunu sıfırlar veya `primaryColor` kullanır.)*

### 1.6 Dosya İşlemleri (Aç / Kaydet / İçe-Dışa Aktar / Otomatik Taslak / Proje Kurulumu)
- **State:**
  - `importReportData` (L109), `showImportReportModal` (L110)
  - `recentProjects` (L151), `autosaveDraft` (L152)
- **Ref'ler:**
  - `projectFileInputRef` (L149), `projectFolderInputRef` (L150)
- **Handler'lar:**
  - Şema/Taslak yardımcıları: `buildCurrentProjectSchema` (`useCallback`, L1470), `flushAutosaveDraft` (`useCallback`, L1485), `applyLoadedProjectSchema` (`useCallback`, L1493)
  - Proje başlatma (Welcome köprüsü): `handleStartNewProject` (L1592), `handleStartAssembledProject` (`useCallback`, L1658), `handleGoHome` (`useCallback`, L2192)
  - Kaydetme / Açma / İçe aktarma: `handleSaveProject` (`useCallback`, L1859), `handleOpenProject` (L1922), `handleOpenProjectFile` (`useCallback`, L1933), `handleProjectFileInputChange` (L1955), `handleOpenProjectFolder` (L1975), `handleProjectFolderInputChange` (L2003), `handleConfirmImport` (L2023)
  - Son projeler & otomatik taslak: `handleOpenRecentProject` (L2043), `handleDeleteRecentProject` (L2094), `handleRestoreAutosave` (`useCallback`, L2099), `handleSaveAutosave` (`useCallback`, L2109), `handleDismissAutosave` (`useCallback`, L2186)
- **Effect'ler:**
  - 1.5sn debounce ile localStorage taslak kaydı (L1547–1553)
  - `beforeunload` senkron taslak kaydı & çıkış uyarısı (L1556–1565)

### 1.7 AI (Oturum, Vurgu & Welcome Geçişi)
- **State & Ref:**
  - `aiHighlightedIds` (L216), `aiHighlightTimerRef` (L217)
  - `pendingWelcomeAiPrompt` (L218)
  - *(Arayüz durumu: `aiDockMinimized` L214, `aiFocusSignal` L215)*
- **Hook:** `aiChat = useAiChatSession(...)` (L1309–1316)
- **Handler'lar:**
  - `triggerAiHighlight` (`useCallback`, L1257)
  - `handleCaptureAiSnapshot` (`useCallback`, L1268)
  - `handleApplyAiResult` (`useCallback`, L1274)
  - `handleRestoreAiSnapshot` (`useCallback`, L1299)
  - `handleStartAiPromptFromWelcome` (L1826)
- **Effect:**
  - Welcome'dan editöre geçildiğinde `pendingWelcomeAiPrompt` gönderme (L1846–1851)

### 1.8 Önizleme / Sunum (Preview Mode & Runtime)
- **State:**
  - `previewRuntimeOverrides` (L146 — input değerleri, slider index, accordion open vb.)
  - `previewMode` (L221)
- **Handler'lar:**
  - `handlePreviewInputChange` (`useCallback`, L770)
  - `handlePreviewExecuteEvent` (`useCallback`, L777)
  - `handleTogglePreviewMode` (`useCallback`, L888)

---

## 2. `src/components/Canvas.jsx` Envanteri & Yeni Toolbox İletişimi

`Canvas.jsx` iki ana bölümden oluşuyor: özyinelemeli öğe render bileşeni `CanvasNode` (L46–726) ve ana etkileşim kabuğu `Canvas` (L731–3118).

### 2.1 `Canvas` İçindeki State, Ref ve Effect Grupları

| Grup | State | Ref | Handler / Effect |
| :--- | :--- | :--- | :--- |
| **Klavye / Modifier & Hover** | `isAltPressed` (L788), `isSpacePressed` (L790), `isCtrlPressed` (L792), `hoveredCandidateId` (L799), `altHoverTargetId` (L800) | `containerRef` (L787), `isAltPressedRef` (L789), `isSpacePressedRef` (L791), `hoveredRawNodeIdRef` (L793) | Global `keydown/keyup/blur` `useEffect` (L994–1061), Ctrl/scope hover güncelleme `useEffect` (L1187–1193), `handleNodeMouseEnter` (L1499), `handleNodeMouseLeave` (L1511) |
| **Pan & Wheel Zoom** | `isPanning` (L794), `panStart` (L795) | `panModeRef` (L796), `latestZoomRef` (L844), `latestPanOffsetRef` (L845) | Ref sync `useEffect`leri (L847–851), container non-passive `wheel` `useEffect` (L1064–1108), `getCanvasLocalCoords` (`useCallback`, L1111) |
| **Seçim / Marquee / Drop Target** | `dropTargetContainerId` (L803), `isMarqueeActive` (L806), `marqueeStart` (L807), `marqueeCurrent` (L808) | — | `findDropTargetContainer` (`useCallback`, L1125), `getCombinedBoundingBox` (L1157), `handleMouseDown` (L1553), `handleNodeMouseDown` (L1678), `handleNodeDoubleClick` (L1762) |
| **Sürükleme & Alt+Drag & Snap** | `isDraggingElement` (L818), `altDuplicatePreview` (L827), `activeGuides` (L832) | `isDraggingRef` (L819), `draggingIdsRef` (L820), `dragStartCanvasRef` (L821), `elementsStartPositionsRef` (L822), `dragParentAbsRef` (L823), `lastClientPosRef` (L824), `lastDragDeltaRef` (L825), `altDuplicateModeRef` (L826), `autoScrollFrameRef` (L828), `hasMovedDuringDragRef` (L829), `dragStartBboxRef` (L833), `latestElementsRef` (L842), `latestCanvasSettingsRef` (L843), `onUpdateMultipleElementsRef` (L846), `syncDragPresentationRef` (L990) | `startAutoScroll` / `stopAutoScroll` (L869–883), `syncDragPresentation` (`useCallback`, L886), `startElementDrag` (L1629) |
| **Resize & Height Extender** | `resizingHandle` (L860), `resizeStart` (L861), `isExtendingHeight` (L864), `heightDragStartY` (L865), `initialHeight` (L866) | — | `handleResizeMouseDown` (L2147) + `handleMouseMove`/`handleMouseUp` dalları |
| **Inline Metin Editörü** | `editingTextNodeId` (L836) | `editingTextNodeIdRef` (L837) | Ref sync `useEffect` (L838–840), `handleUpdateElementText` (L853) |
| **Yeni Toolbox & Sağ Tık Menü** | `drawDraft` (L812), `zoomBox` (L813), `eyedropperSample` (L814), `contextMenu` (L815) | Mevcut pan/zoom/alt ref'lerini paylaşır | Detayı bölüm 2.2'de |
| **Global Etkileşim Döngüsü** | — | — | `window` `mousemove` / `mouseup` `useEffect` (L2129–2144) |

### 2.2 Yeni Toolbox Araçlarının State/Ref Kullanımı ve `App.jsx` İletişimi

1. **Sürükle-Çiz (`rectangle`, `circle`, `line`, `frame`, `text`)**
   - **Lokal State / Sabitler:** `DRAW_TOOLS` (L811), `drawDraft` (L812 — `{ tool, start, current, shiftKey, parentId, parentAbs }`), render aşamasında `drawPreviewBox` (`resolveDrawnBox` ile hesaplanır, L2230–2235) ve `data-draw-ghost` önizlemesi (L2596–2616).
   - **Akış & `App.jsx` İletişimi:** `handleMouseDown` (L1608) veya `handleNodeMouseDown` (L1719) -> `startDrawGesture` (L1353) -> `handleMouseMove` (L1804) -> `handleMouseUp` (L2053) -> `commitDrawnElement` (L1367).
   - **`App.jsx` Prop Çağrıları:** `primaryColor`, `secondaryColor`, `canvasSettings` okunur; çizim bitince `onAddElementAt({...})` (`App.jsx` L922) çağrılır. `App.jsx` elemanı ekler, seçer ve `keepActiveTool` verilmediği için `setActiveTool('select')` yapar. `text` aracında ayrıca `requestAnimationFrame(() => setEditingTextNodeId(created.id))` tetiklenir.

2. **Büyüteç (`zoom` — `Z`)**
   - **Lokal State / Ref:** `zoomBox` (L813 — `{ start, current, clientStartX, clientStartY, altKey }`), render'da `zoomBoxRect` (L2223–2228). Ref olarak `containerRef`, `latestZoomRef`, `latestPanOffsetRef` ve `isAltPressedRef` kullanılır.
   - **Akış & `App.jsx` İletişimi:** `handleMouseDown` (L1560) / `handleNodeMouseDown` (L1686) -> `setZoomBox(...)` -> `handleMouseMove` (L1797) -> `handleMouseUp` (L2029): sürükleme `>= 8px` ise `zoomToWorldRect` (L1242), tek tık ise `zoomAtClientPoint` (L1220; `Alt` basılıysa `-0.25`, değilse `+0.25`).
   - **`App.jsx` Prop Çağrıları:** Doğrudan `setZoom(nextZoom)` ve `setPanOffset(nextPan)` çağırır (`clampCanvasZoom` ile sınırlar).

3. **Renk Damlalığı (`eyedropper` — `I`)**
   - **Lokal State / Effect:** `eyedropperSample` (L814 — `{ clientX, clientY, hex, targetNodeId, contrastWithBg }`) ve araç değişince temizleyen `useEffect` (L1196–1200).
   - **Akış & `App.jsx` İletişimi:** `handleMouseMove` (L1811) -> `sampleColorAtClientPoint` (L1262; `document.elementsFromPoint` + `getComputedStyle` + `parseCssColorToHex` + `computeContrastRatio`) ile imleç HUD'ı (`data-eyedropper-hud`, L2996) güncellenir. Tıklamada (`handleMouseDown` L1574 / `handleNodeMouseDown` L1700) -> `applyEyedropperColor` (L1316) çalışır.
   - **`App.jsx` Prop Çağrıları:** Her zaman `setPrimaryColor?.(hex)` çağırır. `selectedIds.length > 0` ise `onUpdateMultipleElements(updates)` + `onNotify(...)`, değilse panoya kopyalayıp `onNotify(...)` çağırır; ardından `setActiveTool?.('select')` ile aracı sıfırlar. *(Mevcut davranış notu: burada `onCommitHistory` çağrılmaz; refactor sırasında davranışı bozmamak için değiştirilmemeli.)*

4. **Biçim Boyacısı (`format_paint`)**
   - **State / Ref Konumu:** Canvas içinde state tutmaz; taşınabilir stil verisi `App.jsx` içinde `copiedElementStyle` (L224) olarak tutulur.
   - **Akış & `App.jsx` İletişimi:** `App.jsx` (`handleCopyElementStyle` L1136) veya bağlam menüsü/sol ray (`onCopyStyle`) stili kopyalayıp `activeTool = 'format_paint'` yapar. Canvas üzerinde `handleNodeMouseDown` (L1708–1717) yakalar, `resolveSelectionTarget` ile hedef ID'yi bulur, `onPasteStyle?.([resolvedId])` (`App.jsx` `handlePasteElementStyle` L1155) ve `setActiveTool?.('select')` çağırır.

5. **Alt+Hover Mesafe Ölçer (Smart Distance Inspector)**
   - **Lokal State / Ref:** `altHoverTargetId` (L800 — `handleNodeMouseEnter`/`Leave` ile güncellenir), `isAltPressed` (L788), `isDraggingElement` (L818), `isAltPressedRef`, `isDraggingRef`.
   - **Akış & `App.jsx` İletişimi:** Render sırasında (L2238–2249) `!previewMode && isAltPressed && !isDraggingElement && activeTool === 'select' && selectedIds.length === 1` şartı sağlanırsa `elements`, `selectedIds`, `canvasSettings` prop'ları üzerinden `computeAltMeasureGuides` çağrılır ve `data-alt-measure-svg` (L2637) çizilir.

6. **Sağ Tık Bağlam Menüsü, Izgara ve Cetveller**
   - **Lokal State / Effect:** `contextMenu` (L815) ve kapatma `useEffect`'i (L1202–1217).
   - **`App.jsx` Prop Çağrıları:** Öğe üzerindeyse önce `onSelectElements` / `setEditingGroupId` ile hedefi seçer; ardından menü aksiyonları doğrudan `App.jsx` handler'larını (`onDuplicateSelected`, `onCopySelected`, `onCutSelected`, `onPasteFromClipboard`, `onCopyStyle`, `onPasteStyle`, `onZOrderSelected`, `onAlignHorizontalCenter`, `onAlignVerticalCenter`, `onGroupSelected`, `onUngroupSelected`, `onToggleLockSelected`, `onToggleHideSelected`, `onDeleteSelected`, `setShowLayoutGrid`, `setShowRulers`, `onResetZoom`) tetikler.

---

## 3. Gruplar Arası Bağımlılıklar & En Riskli Bölme Noktaları

Bölme sırasında en çok dikkat gerektiren çapraz okuma/yazma noktaları şunlardır:

1. **`latestTabSnapshotRef` + `setTabs` + `historyByTab` Senkron Halkası (`App.jsx` L184–344, L1171–1205, L1438–1441)**
   - `handleUpdateElement`, `handleUpdateMultipleElements` ve `setCanvasSettings` history'ye yazmadan `tabs` ve `latestTabSnapshotRef`'i anında günceller; etkileşim bitiminde `handleCommitHistory` veriyi bu ref'ten okuyup history'ye yazar. `handleUndo`, `handleRedo` ve `handleSwitchViewport` da ref'i günceller.
   - **Risk (Yüksek):** `tabs`, `historyByTab` ve `latestTabSnapshotRef` farklı hook'lara bölünürse `drag`/`resize`/`inline text` sonunda Undo yığını bozulur. Hepsi **`useProjectState`** içinde birlikte kalmalıdır.

2. **`applyLoadedProjectSchema` / Proje Başlatıcıların Çoklu Reset Etkisi (`App.jsx` L1493–1544, L1592–1844)**
   - Proje yükleme (`applyLoadedProjectSchema`), yeni proje (`handleStartNewProject`, `handleStartAssembledProject`) ve sekme değiştirme (`<TopMenuBar setActiveTabId>`); aynı anda Proje (`tabs`, `historyByTab`, `projectMeta`, `projectFunctions`, `pageLinks`, `hasUnsavedChanges`), Seçim (`selectedIds`, `editingGroupId`), Önizleme (`previewMode`, `previewRuntimeOverrides`), Görünüm (`viewportMode`, `fitVersion`) ve Ekran (`showWelcomeScreen`) state'lerini sıfırlar.
   - **Risk (Yüksek):** Hook sınırları net bir `resetSelection()`, `resetPreview()`, `triggerFit()` callback sözleşmesi ile bağlanmazsa eski projeden kalan seçim/önizleme durumu yeni projeye sızar.

3. **`fitCanvasToViewport` & `ResizeObserver` Merkezleme Bağlantısı (`App.jsx` L811–886)**
   - Tuval görünümü hesaplaması (`useCanvasView`), `useWorkspaceLayout` içindeki `leftSidebarTab`, `rightDockOpen`, `rightDockWidth`, `showWelcomeScreen` ile `previewMode` ve `canvasSettings.width/height` değerlerini doğrudan okur.
   - **Risk (Orta):** `useCanvasView` içine layout ölçülerini ve `previewMode`'u parametre/bağımlılık olarak geçirmemek sol/sağ panel açılıp kapanırken artboard'un yanlış konumlanmasına yol açar.

4. **`handleSwitchViewport` ve Sekme Geçişi Adaptasyonu (`App.jsx` L1399–1468, L2447–2451)**
   - Viewport değişimi yalnızca `viewportMode` ve `fitVersion`'ı değil; aktif sekmenin `elements`, `canvasByViewport` ve `initializedViewports` alanlarını (`ensureViewportAdapted`) ve `latestTabSnapshotRef`'i de günceller.
   - **Risk (Orta-Yüksek):** `viewportMode` state'i `useCanvasView`'da, `tabs` state'i `useProjectState`'te olacağı için `switchViewport` koordinasyonu ya `App.jsx` orkestrasyonunda ya da `useProjectState.ensureTabViewportAdapted(...)` metodu üzerinden yapılmalıdır.

5. **Araç / Eleman Ekleme ve Sağ Dock Otomatik Açma (`App.jsx` L922–1091)**
   - `handleSelectNewTag` ve `handleAddPreset`: `primaryColor` (Araçlar), `panOffset` / `zoom` / `viewportMode` (Tuval Görünümü), `rawElements` / `setCanvasSettings` (Proje), `setActiveTool('select')` (Araçlar) ve `setRightDockOpen(true)` / `setRightPropertiesTab('block')` (Panel Düzeni) ile konuşur.
   - **Risk (Orta):** Hazır blok eklendiğinde sağ dock'un `'block'` sekmesine geçme ve tuval yüksekliğini otomatik uzatma davranışı korunmalıdır.

6. **Global `keydown` Kısayol Dinleyicisi (`App.jsx` L2200–2444)**
   - Tek bir `useEffect` içinde modallar, welcome ekranı, preview, AI dock focus, Ctrl+S/O/E/A/C/X/V/D/G/Z/Y, Ctrl+Shift+C/V/L/N/G, ok tuşlarıyla nudge (`applyMultipleUpdatesForViewport`), Esc zinciri (`previewMode` -> `activeTool !== 'select'` -> `handleSelectParent`), Z-order (`[ / ]`), Grid/Rulers (`Shift+G/R`), Zoom (`Ctrl +/-/0`) ve tek tuş araçları yönetiliyor.
   - **Risk (Orta-Yüksek):** Dikkat: Mevcut dependency array (L2438–2444) tüm handler'ları değil, bunların okuduğu ana state'leri listeliyor. Hook'lara taşırken handler referanslarının güncel closure'a sahip olması veya dependency array'in eksiksiz güncellenmesi gerekir.

7. **AI Ajanı ve Welcome-to-Editor Handoff (`App.jsx` L1257–1316, L1815–1851)**
   - `handleApplyAiResult` (`syncViewportTreeDiffs`, `updateElementsWithHistory`, `handleSelectElements`, `triggerAiHighlight`, `showToastMessage`) ve `handleStartAiPromptFromWelcome` (`handleStartAssembledProject`, `setAiDockMinimized(false)`, `setLeftSidebarTab('ai')`, `setPendingWelcomeAiPrompt`) birden fazla grubu etkiler.
   - **Risk (Orta):** Welcome'dan gelen AI prompt'unun editör mount olur olmaz `aiChat.handleSendPrompt` ile gönderilmesi bozulmamalıdır.

8. **Önizleme Etkileşim Köprüsü (`App.jsx` L777–809, L888–892)**
   - `handlePreviewExecuteEvent` sayfa içi navigasyon tetiklediğinde `setActiveTabId`, `setSelectedIds([])`, `setEditingGroupId(null)` çağırır; `handleTogglePreviewMode` ise `fitVersion`'ı artırır.

9. **`Canvas.jsx` Global `window` Dinleyici & `handleMouseMove` Bağımlılığı (`Canvas.jsx` L2129–2144)**
   - `useEffect` dependency listesinde `handleMouseMove` var ve `handleMouseMove` her render'da yeniden oluşturuluyor (`handleMouseUp` dependency listesinde yok).
   - **Risk (Orta-Yüksek — Aşama 5):** Hook'lara bölerken `handleMouseMove` / `handleMouseUp` ref üzerinden bağlanmazsa veya state'ler ayrı hook'larda dağınık güncellenirse sürükleme sırasında stale closure oluşabilir.

---

## 4. Önerilen Taşıma Planı (Aşama 2 → Aşama 5)

### Aşama 2 — React'e Bağlı Olmayan Yardımcılar (`src/utils/`)
| Kaynak (`App.jsx` / `Canvas.jsx`) | Hedef Dosya | Taşınacak Mantık | Tahmini Satır | Risk |
| :--- | :--- | :--- | :---: | :--- |
| `App.jsx`: `buildTabState` (L81–99) | `src/utils/projectStorage.js` *(veya `tabUtils.js`)* | Sekme nesnesi oluşturma (`elements`, `canvasByViewport`, `initializedViewports`) | ~25 | **Düşük** |
| `App.jsx`: `handleStartAssembledProject` saf yerleşim bloğu (L1658–1793) + `handleStartNewProject` config üretimi (L1603–1652) | `src/utils/projectAssemblyUtils.js` *(yeni)* | `TEMPLATE_BLUEPRINTS` / `CONTENT_PACK_ASSETS` yerleşimi, marka/başlık metin enjeksiyonu, viewport adaptasyonu ile `tab + projectMeta` üretimi | ~170 | **Düşük-Orta** |
| `App.jsx`: `handleSelectNewTag` eleman kurucu (L952–1007) + `handleAddPreset` konumlandırıcı (L1013–1077) | `src/utils/elementFactoryUtils.js` *(yeni)* | `checkbox` / `frame` / `createTagElement` node inşası, preset X/Y/stageHeight hesabı | ~115 | **Düşük** |
| `Canvas.jsx`: `cursorClass` / `nodeInteractionCursor` (L2190–2213), 2-öğe mesafe/hiza özeti (L2521–2549), cetvel tick hesabı (L2891–2904) | `src/utils/canvasToolsUtils.js` *(mevcut)* | Saf hesaplama fonksiyonları (`resolveCanvasCursors`, `computeTwoElementAlignmentBadge`, `computeRulerTicks`) | ~85 | **Düşük** |

### Aşama 3 — `App.jsx` Hook Bölünmesi (Her biri ayrı commit)
| Sıra | Hedef Hook | Kapsam (State + Handler + Effect) | Tahmini Satır | Risk |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `src/hooks/useSelection.js` | `selectedIds`, `editingGroupId`, `clipboard`, `selectedElement`, `handleSelectElements`, `handleToggleElementSelection`, `handleSelectAll`, `handleCopy`, `handleSelectParent`, `handleSelectChild` *(ve opsiyonel `clearSelection`)* | ~190 | **Düşük-Orta** |
| 2 | `src/hooks/useWorkspaceLayout.js` | `showWelcomeScreen`, tüm modal state'leri (`showTutorial`, `showExportModal`, `showAddTagModal`, `showAttributesInspectorModal`, `showImportReportModal`, `importReportData`, `functionEditorState`), `leftSidebarTab`, `rightDockOpen`, `rightPropertiesTab`, `rightDockWidth`, `aiDockMinimized`, `aiFocusSignal`, `showLayoutGrid`, `showRulers`, `previewToast`, `showToastMessage`, `handleSelectRightDockTarget`, `handleDockFloatingInspector`, `togglePanel`, `handleOpenFunctionEditor`, title/hash `useEffect`leri | ~210 | **Düşük-Orta** |
| 3 | `src/hooks/useCanvasView.js` | `viewportMode`, `zoom`, `panOffset`, `fitVersion`, `fitCanvasToViewport`, `centerCanvasHorizontally`, `handleResetZoom`, `fitCanvasRef`/`centerHorizRef` + `ResizeObserver`/fit `useEffect`leri *(Ayrıca `activeTool`, `primaryColor`, `secondaryColor`, `copiedElementStyle` araç state'leri ya küçük bir `useCanvasTools` ya da `App.jsx` üstünde tutulur; `handleCopyElementStyle` / `handlePasteElementStyle` ile)* | ~175 | **Orta** |
| 4 | `src/hooks/useProjectState.js` | `tabs`, `activeTabId`, `activeTab`, `rawElements`, `elements`, `activeCanvasByViewport`, `canvasSettings`, `projectMeta`, `hasUnsavedChanges`, `projectFunctions`, `pageLinks`, `historyByTab`, `latestTabSnapshotRef`, tüm `updateElementsWithHistory` / `handleCommitHistory` / `handleUpdate*` / `handleUndo` / `handleRedo` / sekme & fonksiyon CRUD / AST mutasyonları (`delete`, `duplicate`, `altDuplicate`, `group`, `ungroup`, `cut`, `paste`, `wrap`, `unwrap`, `reparent`, `rename`, `align`, `zOrder`, `lock`, `hide`, `removeBg`, `addElementAt`, `addPreset`, `switchViewport`, `resetViewportFromDesktop`) | ~480 | **Yüksek** |
| 5 | `src/hooks/useProjectIO.js` | `recentProjects`, `autosaveDraft`, `projectFileInputRef`, `projectFolderInputRef`, `buildCurrentProjectSchema`, `flushAutosaveDraft`, `applyLoadedProjectSchema`, `handleSaveProject`, `handleOpenProject*`, `handleConfirmImport`, `handleOpenRecentProject`, `handleDeleteRecentProject`, `handleRestoreAutosave`, `handleSaveAutosave`, `handleDismissAutosave`, `handleStartNewProject`, `handleStartAssembledProject`, `handleGoHome`, autosave & `beforeunload` `useEffect`leri | ~360 | **Yüksek** |

> **Önizleme & AI & Kısayollar:** Aşama 3 sonunda `App.jsx` içinde kalan ince parçalar (~180–250 satır: AI snapshot/highlight/welcome prompt köprüsü, `previewMode` + `previewRuntimeOverrides`, `activeTool` + renkler, global `keydown` orkestrasyonu ve JSX render ağacı). İstenirse `App.jsx`'i daha da inceltmek için `usePreviewRuntime` (~60 satır, **Düşük** risk) ve `useStudioShortcuts` (~220 satır, **Orta-Yüksek** risk) de eklenebilir. Aşama 3 sonunda `App.jsx`'in **~2.845 satırdan ~650–850 satıra** düşmesi öngörülür.

### Aşama 4 — `useWorkspaceLayout` Tek Nesne Konsolidasyonu
- `togglePanel` (L1231–1255), `handleSelectRightDockTarget` (L1212–1223), `handleDockFloatingInspector` (L1225–1229) ve `effectiveActivePanels` (L2457–2463) tek bir yapılandırılmış `workspaceLayout` state nesnesinde birleştirilecek:
  - Sol panel (`leftTab`, ileride genişletilebilir çekmece genişliği), Sağ dock (`rightOpen`, `rightTab`, `rightWidth`), Yüzen pencereler (`attributesInspector`, `tutorial`, `export`, `addTag`, `importReport`, `functionEditor`), AI dock (`minimized`, `focusSignal`), Tuval yardımcıları (`showLayoutGrid`, `showRulers`).
  - **Tahmini Değişim:** `useWorkspaceLayout.js` içinde ~180–220 satır, **Düşük-Orta** risk. İleride eklenecek `"Tasarım | Backend"` mod sistemi doğrudan `workspaceLayout.mode` (ve moda göre panel görünürlükleri) üstüne temiz şekilde oturacak.
- **İleriye Dönük Not:** useWorkspaceLayout içindeki showWelcomeScreen, toast ve hash/title effect'leri ileride useAppShell hook'una ayrılacak.

### Aşama 5 *(Onayınla — İstenirse)* — `Canvas.jsx` & `PropertiesPanel.jsx` Bölünmesi
- **`Canvas.jsx` (3.118 satır -> hedef ~450–600 satır kabuk):**
  1. `src/components/canvas/CanvasNode.jsx` (~680 satır, Risk: **Düşük-Orta**)
  2. `src/hooks/useCanvasNavigation.js` — wheel zoom/pan, middle/space/hand/alt pan, `zoomAtClientPoint`, `zoomToWorldRect` (~220 satır, Risk: **Orta**)
  3. `src/hooks/useCanvasInteractions.js` — element drag, `syncDragPresentation`, `Alt+Drag`, auto-parenting, marquee, 8-handle resize, height extender, `window` global move/up listener (~520 satır, Risk: **Yüksek**)
  4. `src/hooks/useCanvasToolbox.js` — `drawDraft` (`startDrawGesture`/`commitDrawnElement`), `zoomBox`, `eyedropperSample`, `altHoverTargetId` + `contextMenu` (~240 satır, Risk: **Orta**)
  5. Overlay alt bileşenleri: `CanvasSmartGuides.jsx` (L2637–2886), `CanvasRulers.jsx` (L2891–2958), `CanvasContextMenu.jsx` (L3022–3115) (~380 satır, Risk: **Düşük**)
- **`PropertiesPanel.jsx` (2.673 satır):** Aşama 5 onaylandığında dosya içi tam okuma yapılıp sekmelere (`block`, `style`, `layout`, `props`, `css`, `code`) göre ayrılacak; tahmini hedef **6 alt bileşen + ~350 satır kabuk** (Risk: **Orta**).

---

## 5. Bölüm 5: Taşınan Handler Yan Etkileri (`useProjectState` — Aşama 3b-2)

`useProjectState` yalnızca proje/sekme/history/viewport state'ini ve `latestTabSnapshotRef + setTabs + historyByTab` senkron halkasını kapsüller; diğer hook'ların (`useSelection`, `useCanvasView`, `useWorkspaceLayout`) state veya setter'larını doğrudan çağırmaz. Aşağıdaki tablo orijinal koddaki tüm proje-dışı yan etkileri ve `App.jsx` koordinasyon karşılıklarını listeler:

| Handler / Çağrıcı | Orijinal Konum (`App.jsx`) | Saf Proje State Etkisi (`useProjectState`) | Proje-Dışı Bağımlılık / Yan Etki | `App.jsx` Koruma Stratejisi |
| :--- | :--- | :--- | :--- | :--- |
| `setTabHistory` | L219–224 | `setHistoryByTab` sıfırlama + `latestTabSnapshotRef[tabId]` senkronu | Yok | Hook içinde direkt döner |
| `updateElementsWithHistory` | L227–255 | `setTabs`, `latestTabSnapshotRef`, `setHasUnsavedChanges(true)`, `setHistoryByTab` | Yok | Hook içinde direkt döner |
| `handleCommitHistory` | L276–293 | `latestTabSnapshotRef` -> `setHasUnsavedChanges(true)`, `setHistoryByTab` | Yok | Hook içinde direkt döner |
| `setCanvasSettings` | L296–310 | `setHasUnsavedChanges(true)`, `setTabs`, `latestTabSnapshotRef` | Yok | Hook içinde direkt döner |
| `handleUpdateElement` | L313–329 | `latestTabSnapshotRef`, `setHasUnsavedChanges(true)`, `setTabs` | `selectedIds[0]` (`useSelection`) okur | Hook: `updateActiveTabElement(id, updates)`; `App.jsx`: `handleUpdateElement(updates)` sarmalayıcısı `selectedIds[0]` ile çağırır |
| `handleUpdateElementDirect` | L332–335 | `applyNodeUpdateForViewport` + `updateElementsWithHistory` | Yok | Hook içinde direkt döner |
| `handleUpdateMultipleElements` | L338–352 | `latestTabSnapshotRef`, `setHasUnsavedChanges(true)`, `setTabs` | Yok | Hook içinde direkt döner |
| `handleRenameElement` | L621–623 | `handleUpdateElementDirect(id, { name })` | Yok | Hook içinde direkt döner |
| `handleUndo` | L889–905 | `setTabs`, `latestTabSnapshotRef`, `setHistoryByTab` | Yok *(seçimi sıfırlamaz)* | Hook içinde direkt döner (`useCallback`) |
| `handleRedo` | L907–923 | `setTabs`, `latestTabSnapshotRef`, `setHistoryByTab` | Yok *(seçimi sıfırlamaz)* | Hook içinde direkt döner (`useCallback`) |
| `handleAddTab` | L986–993 | `buildTabState`, `setTabs`, `setTabHistory`, `setActiveTabId`, `setHasUnsavedChanges(true)` | Tablet/Mobil modundaysa `useEffect` adaptasyonu + `useCanvasView` fit effect'i | Hook içinde direkt döner |
| `handleCloseTab` | L995–1003 | `setTabs`, aktifse `setActiveTabId(remaining[0].id)`, `setHasUnsavedChanges(true)` | Aktif sekme değişirse `useCanvasView` fit effect'i tetiklenir | Hook içinde direkt döner |
| `handleRenameTab` | L1005–1016 | `setTabs` (`name`, `route`), `setHasUnsavedChanges(true)` | Yok | Hook içinde direkt döner |
| Sekme seçimi (`TopMenuBar` / `onNavigateTab` / `PresentationOverlay`) | L2166–2170, L581–584, L2385 | `setActiveTabId(nextId)` | `TopMenuBar`: `resetSelection()` + `setPreviewRuntimeOverrides({})`; `onNavigateTab`: `resetSelection()`; `PresentationOverlay`: yok | Hook yalın `setActiveTabId` döner; `App.jsx` sarmalayıcıları ilgili yan etkileri birebir korur |
| `handleSwitchViewport` | L1067–1112 | `setViewportMode`, `desktop` dışında `ensureViewportAdapted`, `canvasByViewport[vp].height`, `initializedViewports[vp] = true`, `latestTabSnapshotRef` | **`triggerFit()`** (`useCanvasView`, `desktop` dahil geçerli her çağrıda çalışır) | Hook: `switchViewportMode(nextViewport)` (`boolean` döner); `App.jsx`: `handleSwitchViewport` geçerli dönüşte `triggerFit()` çağırır |
| Sekme değişimi auto-adapt `useEffect` | L2090–2094 | `viewportMode !== 'desktop' && !activeTab.initializedViewports?.[viewportMode]` iken `switchViewportMode(viewportMode)` | Yeni sekme adaptasyonu sonrası `useCanvasView` `activeTabId`/`viewportMode`/`fit` effect'i | Hook içinde döngü korumalı `useEffect` (`autoAdaptedPairsRef`: aynı `tabId:viewportMode` çifti tek sefer); `App.jsx` veya ek `triggerFit` ihtiyacı yok |
| `handleResetViewportFromDesktop` | L1115–1136 | `ensureViewportAdapted(forceReset: true)`, `initializedViewports[vp] = true`, `updateElementsWithHistory` | Yok | Hook içinde direkt döner |
| `handleRenameProject` | L1496–1499 | `setProjectMeta(name)`, `setHasUnsavedChanges(true)` | Pencere başlığı `document.title` reaktif effect'i | Hook içinde direkt döner; başlık effect'i `App.jsx`'te korunur |
| `saveProjectFunction` (`handleSaveProjectFunction`) | L537–560 | `setProjectFunctions`, `setHasUnsavedChanges(true)`, hedefli `updateElementsWithHistory` | `functionEditorState.bindTargetElementId` (`useWorkspaceLayout`) + **`showToastMessage(..., 'success')`** | Hook: `saveProjectFunction(savedFn, bindTargetElementId)`; `App.jsx`: `handleSaveProjectFunction` toast + `bindTargetElementId` bağlamasını korur |
| `handleDeleteProjectFunction` | L562–565 | `setProjectFunctions`, `setHasUnsavedChanges(true)` | Yok | Hook içinde direkt döner |

### `updateElementsWithHistory` Çağıran Diğer İşlemler (`App.jsx` & `useSelection.js` Dışı Yan Etkiler)

- `useSelection.js`: `handleCut` (`setClipboard`, `setSelectedIds([])`), `handlePaste` (`setSelectedIds(newIds)`) — zaten `useSelection` içinde.
- `App.jsx` orkestrasyon katmanında kalarak proje + seçim/araç/UI yan etkilerini birlikte yönetenler:
  - `handleGroupSelected` (`selectedIds` okur)
  - `handleUngroupSelected` (`selectedIds` okur, `setEditingGroupId(null)`)
  - `handleDeleteSelected` (`selectedIds` okur, `setSelectedIds([])`, `setEditingGroupId(null)`)
  - `handleDuplicateSelected` (`selectedIds` okur, `setSelectedIds(newSelectedIds)`)
  - `handleAltDuplicateElements` (`setSelectedIds(newSelectedIds)`)
  - `handleWrapSelected` (`selectedIds` okur, `setSelectedIds([wrapperId])`)
  - `handleUnwrapElement` (`selectedIds` / `editingGroupId` okur, `setEditingGroupId`, `setSelectedIds(restoredIds)`)
  - `handleReparentElement` (`setSelectedIds([sourceId])`)
  - `handleAlignHorizontalCenter` / `handleAlignVerticalCenter` (`selectedIds` okur)
  - `handleAddElementAt` (`setSelectedIds([rawNewElement.id])`, `!keepActiveTool && setActiveTool('select')`) — ayrıca `handleSelectNewTag` (`panOffset`, `zoom`, `primaryColor` okur, `setShowAddTagModal(false)`)
  - `handleAddPreset` (`panOffset`, `zoom` okur; `setCanvasSettings`, `setSelectedIds`, `setActiveTool('select')`, koşullu `setRightDockOpen(true)` + `setRightPropertiesTab('block')`)
  - `handleApplyAiResult` (`handleSelectElements`, `triggerAiHighlight`, `showToastMessage`) & `handleRestoreAiSnapshot` (`handleSelectElements`, `setAiHighlightedIds([])`, `showToastMessage`)
  - `handleKeyDown` ok tuşu nudge (`selectedIds` okur) ve `PropertiesPanel` `onUpdateResolvedElements` (`syncViewportTreeDiffs` + `updateElementsWithHistory`)

---

## 6. Refactor Sonucu (Aşama 2 → Aşama 4 Tamamlanan Durum)

### 6.1 Final Hook Listesi ve Sorumlulukları (`src/hooks/`)

| Hook Dosyası | Satır Sayısı | Sorumluluğu (1 Satır) |
| :--- | :---: | :--- |
| `src/hooks/useWorkspaceLayout.js` | `393` | Sol çekmece, sağ özellikler dock'u, yüzen AI dock, tüm modal pencereler, toast bildirimleri ve `#/ice-aktar`–`#/projeler` hash dönüşlerini tek bir `layout` nesnesinde yönetir. |
| `src/hooks/useProjectState.js` | `506` | Çoklu sayfa sekmeleri (`tabs`, `activeTabId`), aktif cihaz görünümü (`viewportMode`), AST çözümlemesi (`elements`), sekme bazlı undo/redo yığını (`historyByTab` + `latestTabSnapshotRef`) ve proje meta/fonksiyon/sayfa bağlantılarını yönetir. |
| `src/hooks/useCanvasView.js` | `140` | Tuval `zoom`, `panOffset`, `fitVersion`, ekran boyutuna otomatik sığdırma (`fitCanvasToViewport`) ve panel/pencere değişimlerinde `ResizeObserver` ile yatay ortalama döngüsünü yönetir. |
| `src/hooks/useSelection.js` | `255` | Seçili öğe ID'leri (`selectedIds`), grup izolasyonu (`editingGroupId`), pano (`clipboard`) ve kopyala/kes/yapıştır/ebeveyn-çocuk seçim gezinmesini yönetir. |
| `src/hooks/useProjectIO.js` | `820` | Proje kaydetme/açma (`.craft.json`, HTML/JSX dosya ve klasör içe aktarma), `1500ms` otomatik taslak (`autosaveDraft`), `beforeunload` koruması, son projeler (`recentProjects`) ve yeni/modüler proje başlatıcılarını yönetir. |
| `src/hooks/useShortcuts.js` | `360` | Global `window` `keydown` kısayollarını (`Ctrl+S/O/E/A/C/X/V/D/G/N/Z/Y/K`, ok tuşlarıyla kaydırma, `Delete`, `Esc`, `Enter`, Z-order, ızgara/cetvel ve tek tuş araçları) bayat closure olmadan (`latestRef`) yönetir. |
| `src/hooks/useAiChatSession.js` | `466` | *(Mevcut)* Gemini AI sohbet oturumu, model seçimi, mesaj geçmişi ve tasarım uygulama/geri alma akışını yönetir. |

### 6.2 Dosya Satır Sayıları (Başlangıç vs. Son)

| Dosya | Başlangıç (`a3a9bbf`) | Son (`refactor/workspace-core`) | Değişim |
| :--- | :---: | :---: | :---: |
| **`src/App.jsx`** | **`2.845`** | **`1.338`** | **`-1.507` (%53,0 azalma)** |
| `src/components/Canvas.jsx` | `3.118` | `3.062` | `-56` *(Aşama 2 saf yardımcılar ayrıldı)* |
| `src/components/PropertiesPanel.jsx` | `2.673` | `2.673` | `0` *(Aşama 5 kapsamı)* |
| `src/utils/projectAssemblyUtils.js` | *(yeni — Aşama 2)* | `30` | `+30` |
| `src/utils/canvasToolsUtils.js` | `308` | `460` | `+152` *(Aşama 2 saf tuval yardımcıları)* |
| `src/hooks/useSelection.js` | *(yeni — Aşama 3a)* | `255` | `+255` |
| `src/hooks/useWorkspaceLayout.js` | *(yeni — Aşama 3a/4)* | `393` | `+393` |
| `src/hooks/useCanvasView.js` | *(yeni — Aşama 3b-1)* | `140` | `+140` |
| `src/hooks/useProjectState.js` | *(yeni — Aşama 3b-2)* | `506` | `+506` |
| `src/hooks/useProjectIO.js` | *(yeni — Aşama 3b-3)* | `820` | `+820` |
| `src/hooks/useShortcuts.js` | *(yeni — Aşama 3b-4)* | `360` | `+360` |

### 6.3 Bilinen Kalan İşler (Sonraki Fazlar)
1. **Aşama 5 (`Canvas.jsx` & `PropertiesPanel.jsx` Bölünmesi):** `Canvas.jsx` (`3.062` satır -> `CanvasNode`, `useCanvasNavigation`, `useCanvasInteractions`, `useCanvasToolbox`, overlay bileşenleri) ve `PropertiesPanel.jsx` (`2.673` satır -> sekme alt bileşenleri) bölünmesi henüz yapılmadı.
2. **`useAppShell` Ayrımı:** `useWorkspaceLayout` içindeki `showWelcomeScreen`, `previewToast` / `showToastMessage`, `hashchange` dinleyicisi ve `App.jsx` içindeki `document.title` / `#/editor` hash senkronizasyonu ileride bağımsız bir `useAppShell` hook'una ayrılacak.
3. **Davranış İyileştirmeleri (`docs/sonra-yapilacaklar.md`):**
   - Sekme kapatma geri alınamıyor ve onay yok.
   - Sekme kapatınca seçim sıfırlanmıyor.
   - Geri alınca seçili eleman yoksa seçim eski ID'de kalıyor.
4. **Kısayol Çakışma Notu (`docs/kisayollar.md`):**
   - Tuval üzerinde sağ tık bağlam menüsü (`contextMenu`) açıkken `Escape`'e basıldığında hem `Canvas.jsx` menüyü kapatır hem de `useShortcuts.js` (`App.jsx`) `Escape` dalı tetiklenir.


