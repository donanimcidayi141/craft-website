# CraftStudio — "Tasarım | Backend" Mod Sistemi Mimari Tasarım Raporu

- **Durum:** Tasarım Aşaması (Kod Yazılmadı — Onay Bekliyor)
- **Hedef Kullanıcı:** Kod bilmeyen (no-code) kullanıcılar için tek atölyede görsel arayüz tasarımı (**Tasarım**) ile görsel mantık/veri/akış kurgusunu (**Backend**) birleştiren genişletilebilir mod mimarisi.
- **Kapsam Dışı (Dokunulmayacak):** `src/components/WelcomeScreen.jsx`, `src/components/welcome/*`, `src/proto/*`.
- **Temel Mimari İlke:** İleride 3. veya 4. bir mod (ör. `"Veritabanı"`, `"Otomasyon / SEO"`) eklemek `src/App.jsx`'e dokunmadan yalnızca **Mod Kayıt Defterine (`src/data/studioModesRegistry.js`) yeni bir tanım nesnesi eklemekten** ibaret olmalıdır.

---

## 1. Mod Kayıt Yapısı (`STUDIO_MODES_REGISTRY`)

Mevcut kod tabanındaki bileşenlerin (`StudioLeftSidebar.jsx`, `StudioRightDock.jsx`, `TopMenuBar.jsx`, `useShortcuts.js`, `Canvas.jsx`, `useWorkspaceLayout.js`) gerçek prop ve veri yapıları incelenerek her mod kaydının aşağıdaki şemaya sahip olması tasarlanmıştır:

```js
/**
 * src/data/studioModesRegistry.js
 */
export const STUDIO_MODES = {
  design: {
    id: 'design',
    label: 'Tasarım',
    shortLabel: 'Tasarım',
    description: 'Sayfa düzeni, görsel bileşenler ve duyarlı (PC/Tablet/Mobil) görünüm tasarım alanı',
    icon: 'Palette', // lucide-react ikon adı veya bileşen referansı
    accentColor: '#0d99ff',

    // 1.1 Üst Çubuk (TopMenuBar) Görünürlük & Bağlam Bayrakları
    topBarConfig: {
      showViewportSwitcher: true,   // PC (1280px) / Tablet (768px) / Mobil (375px)
      showPageTabsBar: true,        // Anasayfa.craft, Sayfa-2.craft sekme şeridi
      showSelectionAlignStrip: true,// "N seçili | Grupla | Yatay Ortala | Dikey Ortala"
      showZoomCapsule: true,        // - %100 +
      showPreviewButton: true,      // "Sun"
    },

    // 1.2 Sol Ray Araçları (StudioLeftSidebar.jsx L527-940 gerçek bölümleri)
    tools: {
      defaultToolId: 'select',
      // Birincil aktif araç kapsülü (activeTool state'ini değiştirenler)
      primaryTools: [
        { id: 'select', label: 'Seçim', shortcut: 'V', icon: 'MousePointer', kind: 'cursor' },
        { id: 'hand', label: 'El / Kaydır', shortcut: 'H', icon: 'Hand', kind: 'pan' },
        { id: 'zoom', label: 'Büyüteç (Yakınlaştır)', shortcut: 'Z', icon: 'Search', kind: 'zoom' },
        {
          id: 'shapes',
          kind: 'flyout',
          defaultSubToolId: 'rectangle',
          items: [
            { id: 'rectangle', label: 'Kutu Çiz', desc: 'Dikdörtgen / Kart', shortcut: 'R', icon: 'Square', drawTool: true },
            { id: 'circle', label: 'Daire / Elips', desc: 'Yuvarlak şekil', shortcut: 'O', icon: 'Circle', drawTool: true },
            { id: 'line', label: 'Çizgi / Ayırıcı', desc: 'Yatay veya dikey çizgi', shortcut: 'L', icon: 'Minus', drawTool: true },
            { id: 'frame', label: 'Çerçeve / Bölüm', desc: 'İçine öğe konabilen kutu', shortcut: 'F', icon: 'Frame', drawTool: true },
          ],
        },
        { id: 'text', label: 'Metin yaz', shortcut: 'T', icon: 'Type', kind: 'draw', drawTool: true },
      ],
      // STİL bölümü (StudioLeftSidebar.jsx L659-716)
      styleTools: [
        { id: 'eyedropper', label: 'Renk Damlalığı', shortcut: 'I', icon: 'Pipette' },
        { id: 'format_paint', label: 'Biçim Boyacısı', shortcut: 'Ctrl+Shift+C', icon: 'Paintbrush' },
      ],
      // EKLE açılır grupları (StudioLeftSidebar.jsx L186-227: 'structure', 'typography', 'components' + 'remove-bg')
      addGroups: ['structure', 'typography', 'components'],
      showRemoveBackgroundAction: true,
      // DÜZEN bölümü (StudioLeftSidebar.jsx L791-940: 'view' popover, 'duplicate', 'arrange' popover, 'delete')
      showViewGuidesPopover: true,
      showArrangeActions: true,
    },

    // 1.3 Sol Çekmeceler (StudioLeftSidebar.jsx L514-519 + 'ai' çekmecesi)
    leftPanels: [
      { id: 'layers', title: 'Katmanlar & DOM Ağacı', menuLabel: 'Katmanlar (Layers)', icon: 'Layers', minWidth: 220, defaultWidth: 248 },
      { id: 'templates', title: 'Şablonlar & Hazır Bloklar', menuLabel: 'Assetler & Şablonlar', icon: 'LayoutTemplate', minWidth: 220, defaultWidth: 248 },
      { id: 'elements', title: 'HTML Etiketleri', menuLabel: null, icon: 'Tag', minWidth: 220, defaultWidth: 248 },
      { id: 'code', title: 'Canlı Kod (JSX & CSS)', menuLabel: null, icon: 'Code2', minWidth: 220, defaultWidth: 248 },
      { id: 'ai', title: 'AI Tasarım Asistanı', menuLabel: null, icon: 'Sparkles', minWidth: 296, defaultWidth: 296 },
    ],

    // 1.4 Orta Çalışma Alanı Görünümü
    centerView: {
      componentKey: 'design_canvas', // <Canvas /> + <FloatingAIChatDock />
      supportsCanvasFit: true,
      supportsFloatingAiDock: true,
    },

    // 1.5 Sağ Dock Sekmeleri (StudioRightDock.jsx L64-119 railItems + PropertiesPanel controlledTab)
    rightTabs: [
      { id: 'block', railId: 'prop-block', label: 'Bileşen Özelleştirici', icon: 'LayoutGrid', indicator: 'bg-emerald-400' },
      { id: 'style', railId: 'prop-style', label: 'Stil ve Görünüm', icon: 'Sliders', indicator: 'bg-[#0d99ff]' },
      { id: 'layout', railId: 'prop-layout', label: 'Düzen ve Konum', icon: 'Box', indicator: 'bg-[#0d99ff]' },
      { id: 'props', railId: 'prop-props', label: 'HTML Nitelikleri & Eylem', icon: 'Tag', indicator: 'bg-[#0d99ff]' },
      { id: 'css', railId: 'prop-css', label: 'CSS Kuralları', icon: 'Sparkles', indicator: 'bg-[#0d99ff]' },
      { id: 'code', railId: 'prop-code', label: 'Canlı HTML & CSS Kodu', icon: 'Code2', indicator: 'bg-[#0d99ff]' },
    ],
    rightDockHeaderTitle: 'Özellikler & Tasarım',
    supportsFloatingAttributesInspector: true, // StudioRightDock L158 & L215 ExternalLink butonu

    // 1.6 Pencere Menüsü Öğeleri (TopMenuBar.jsx L308-367 — kayıttan otomatik üretilir)
    menuPanels: [
      {
        id: 'properties',
        label: 'Özellikler & Hizalama',
        icon: 'Sliders',
        target: { area: 'rightDock' },
      },
      {
        id: 'assets',
        label: 'Assetler & Şablonlar',
        icon: 'Box',
        target: { area: 'leftDrawer', tabId: 'templates', activeMatchTabs: ['templates', 'elements'] },
      },
      {
        id: 'layers',
        label: 'Katmanlar (Layers)',
        icon: 'Layers',
        target: { area: 'leftDrawer', tabId: 'layers', activeMatchTabs: ['layers'] },
      },
      {
        id: 'aiAgent',
        label: 'AI Sohbet Çubuğu',
        icon: 'Sparkles',
        shortcutHint: 'Ctrl+K',
        target: { area: 'aiDock' },
      },
      {
        id: 'attributesAndCss',
        label: 'Yüzen CSS & Nitelik Penceresi',
        icon: 'Tag',
        dividerBefore: true,
        target: { area: 'modal', modalKey: 'attributesInspector' },
      },
    ],

    // 1.7 Kısayol Bağlamı (Bölüm 4'te detaylandırılmıştır)
    shortcutsProfile: 'design',

    // 1.8 Modun Varsayılan Panel Düzeni
    defaultLayout: {
      leftDrawer: { activeTab: null },
      rightDock: { isOpen: true, activeTab: 'layout', width: 336 },
      aiDock: { isMinimized: false },
    },
  },

  backend: {
    id: 'backend',
    label: 'Backend',
    shortLabel: 'Backend',
    description: 'Kod yazmadan sayfa olayları, veri tabloları ve görsel iş akışı kurgulama alanı',
    icon: 'Workflow',
    accentColor: '#10b981',

    topBarConfig: {
      showViewportSwitcher: false,   // Backend akışında PC/Tablet/Mobil kırılımı gizlenir
      showPageTabsBar: false,        // Sayfa sekmeleri yerine akış/veri bağlamı (bkz. Bölüm 9 Açık Sorular)
      showSelectionAlignStrip: false,// Görsel hizalama şeridi gizlenir
      showZoomCapsule: true,         // İleride akış tuvali zoom'u için korunur (iskelette %100 sabit/devre dışı)
      showPreviewButton: true,       // "Sun" her iki modda da projeyi test etmek için erişilebilir
    },

    tools: {
      defaultToolId: 'select',
      primaryTools: [
        { id: 'select', label: 'Seçim', shortcut: 'V', icon: 'MousePointer', kind: 'cursor' },
        { id: 'hand', label: 'El / Kaydır', shortcut: 'H', icon: 'Hand', kind: 'pan' },
      ],
      styleTools: [],
      addGroups: [],
      showRemoveBackgroundAction: false,
      showViewGuidesPopover: false,
      showArrangeActions: false,
    },

    leftPanels: [
      { id: 'flows', title: 'Olay & İş Akışları', menuLabel: 'İş Akışları (Flows)', icon: 'Workflow', minWidth: 220, defaultWidth: 256 },
      { id: 'dataModels', title: 'Veri Kutuları & Tablolar', menuLabel: 'Veri Kutuları', icon: 'Database', minWidth: 220, defaultWidth: 256 },
      { id: 'triggers', title: 'Sayfa Tetikleyicileri', menuLabel: 'Tetikleyiciler', icon: 'Zap', minWidth: 220, defaultWidth: 256 },
    ],

    centerView: {
      componentKey: 'backend_canvas_skeleton', // Şimdilik boş iskelet bileşeni (<BackendWorkspaceSkeleton />)
      supportsCanvasFit: false,
      supportsFloatingAiDock: true,
    },

    rightTabs: [
      { id: 'stepConfig', railId: 'back-step', label: 'Adım Ayarları', icon: 'Sliders', indicator: 'bg-emerald-400' },
      { id: 'dataBinding', railId: 'back-data', label: 'Veri Bağlama', icon: 'Database', indicator: 'bg-emerald-400' },
      { id: 'testRun', railId: 'back-test', label: 'Test & Çıktı', icon: 'Play', indicator: 'bg-emerald-400' },
    ],
    rightDockHeaderTitle: 'Akış & Veri Özellikleri',
    supportsFloatingAttributesInspector: false,

    menuPanels: [
      {
        id: 'backendInspector',
        label: 'Akış & Adım Özellikleri',
        icon: 'Sliders',
        target: { area: 'rightDock' },
      },
      {
        id: 'flows',
        label: 'İş Akışları (Flows)',
        icon: 'Workflow',
        target: { area: 'leftDrawer', tabId: 'flows', activeMatchTabs: ['flows'] },
      },
      {
        id: 'dataModels',
        label: 'Veri Kutuları',
        icon: 'Database',
        target: { area: 'leftDrawer', tabId: 'dataModels', activeMatchTabs: ['dataModels'] },
      },
      {
        id: 'aiAgent',
        label: 'AI Sohbet Çubuğu',
        icon: 'Sparkles',
        shortcutHint: 'Ctrl+K',
        target: { area: 'aiDock' },
      },
    ],

    shortcutsProfile: 'backend',

    defaultLayout: {
      leftDrawer: { activeTab: 'flows' },
      rightDock: { isOpen: true, activeTab: 'stepConfig', width: 336 },
      aiDock: { isMinimized: false },
    },
  },
};

export const DEFAULT_STUDIO_MODE = 'design';
export const STUDIO_MODE_LIST = [STUDIO_MODES.design, STUDIO_MODES.backend];
```

---

## 2. `useWorkspaceLayout` Evrimi: `layoutsByMode` ve Setter Kaldırma Planı

### 2.1 Yeni `layout` State Yapısı
Şu anki `INITIAL_WORKSPACE_LAYOUT` ([useWorkspaceLayout.js](file:///home/mert/Masaüstü/craftStudio/src/hooks/useWorkspaceLayout.js#L10-L33)) tek bir `leftDrawer` ve `rightDock` tutmaktadır. Mod sistemiyle birlikte `layout` nesnesi **global kabuk durumu** (`showWelcomeScreen`, `activeMode`, `modals`, `aiDock`) ve **mod başına panel düzeni** (`layoutsByMode`) olarak ayrılır:

```js
const INITIAL_WORKSPACE_LAYOUT = {
  showWelcomeScreen: true,
  activeMode: 'design', // 'design' | 'backend'
  layoutsByMode: {
    design: {
      leftDrawer: { activeTab: null },
      rightDock: { isOpen: true, propertiesTab: 'layout', width: DEFAULT_RIGHT_DOCK_WIDTH },
    },
    backend: {
      leftDrawer: { activeTab: 'flows' },
      rightDock: { isOpen: true, propertiesTab: 'stepConfig', width: DEFAULT_RIGHT_DOCK_WIDTH },
    },
  },
  aiDock: {
    isMinimized: false,
    focusSignal: 0,
  },
  modals: {
    tutorial: false,
    export: false,
    addTag: false,
    attributesInspector: false,
    importReport: false,
    importReportData: null,
    functionEditor: INITIAL_FUNCTION_EDITOR_STATE,
  },
};
```

- **Aktif mod seçicileri:** `currentModeConfig = STUDIO_MODES[layout.activeMode]` ve `currentModeLayout = layout.layoutsByMode[layout.activeMode]`.
- `leftSidebarTab`, `rightDockOpen`, `rightPropertiesTab`, `rightDockWidth` değerleri otomatik olarak `currentModeLayout` içinden okunur; yazma işlemleri yalnızca `layoutsByMode[layout.activeMode]` dilimini günceller.

### 2.2 Eski Tek Tek Setter'ların Kademeli Kaldırılma Planı
Şu anda `useWorkspaceLayout` dışarıya 14 adet tekil setter (`setLeftSidebarTab`, `setRightDockOpen`, `setRightPropertiesTab`, `setRightDockWidth`, `setShowTutorial`, `setShowExportModal` vb.) döndürmektedir. Kademeli geçiş 3 adımda yapılır:

1. **Faz 1 (Geriye Uyumlu Köprü):** `useWorkspaceLayout` içine 4 yapılandırılmış aksiyon eklenir:
   - `setStudioMode(nextMode)`
   - `setLeftDrawerTab(tabId)`
   - `updateRightDock(partial)` (`{ isOpen, propertiesTab, width }`)
   - `setModalOpen(modalKey, isOpenOrPayload)`
   Mevcut tekil setter'lar bu 4 aksiyonun ince sarmalayıcıları olarak çalışmaya devam eder (hiçbir mevcut test/bileşen kırılmaz).
2. **Faz 2 (`App.jsx` Tüketim Göçü):** `App.jsx` içindeki prop geçişleri (`StudioLeftSidebar`, `StudioRightDock`, `TopMenuBar`, modallar) tekil setter'lar yerine `layout` + bu 4 yapılandırılmış aksiyona geçirilir.
3. **Faz 3 (Temizlik):** `App.jsx`'te hiçbir çağrıcısı kalmayan tekil setter'lar `useWorkspaceLayout` dönüş nesnesinden silinir.

### 2.3 Mod Değişince Korunan vs. Sıfırlanan Durumlar Tablosu

| Durum / State | Sahibi (`Hook` / `App`) | Mod Değişince (`Tasarım <-> Backend`) Ne Olur? | Gerekçe |
| :--- | :--- | :--- | :--- |
| `tabs`, `activeTabId`, `projectMeta`, `projectFunctions`, `pageLinks`, `hasUnsavedChanges`, `historyByTab` | `useProjectState` | **KORUNUR** | Kullanıcı iki modda da aynı proje üzerinde çalışmaktadır; kaydedilmemiş değişiklik bayrağı ve undo geçmişi kaybolmamalıdır. |
| `layoutsByMode.design` / `layoutsByMode.backend` | `useWorkspaceLayout` | **HER MOD KENDİ DÜZENİNİ HATIRLAR** | Tasarım'da `Katmanlar` çekmecesi açıkken Backend'e geçip tekrar Tasarım'a dönüldüğünde `Katmanlar` açık kalır. |
| `aiDock` (`isMinimized`, `focusSignal`) & `aiChat` oturumu | `useWorkspaceLayout` / `useAiChatSession` | **KORUNUR** | AI sohbet geçmişi proje genelindedir. |
| Açık Modallar (`addTag`, `attributesInspector`, `functionEditor`) | `useWorkspaceLayout` | **KAPATILIR (SIFIRLANIR)** | Tasarım'a özgü `"Bu ne olacak?"` veya `"Yüzen CSS Müfettişi"` penceresi Backend modunda havada asılı kalmamalıdır. |
| `openAddGroup` (Sol ray açılır menüleri) & `contextMenu` (Tuval sağ tık menüsü) | `StudioLeftSidebar` / `Canvas` | **KAPATILIR (SIFIRLANIR)** | Açık kalan uçucu popover'lar mod değişiminde temizlenir. |
| `previewMode` | `App.jsx` | **KORUNUR (`false` ise `false`)** | Mod anahtarı yalnızca editör görünümünde (`!previewMode`) görünür; sunum modundayken mod değiştirilmez. |

---

## 3. Mod Değişince Seçili Araç (`activeTool`), Seçim (`selectedIds`) ve `zoom` Davranışı

1. **Seçili Araç (`activeTool`):**
   - Tasarım modundaki çizim ve stil araçları (`rectangle`, `circle`, `line`, `frame`, `text`, `eyedropper`, `format_paint`) Backend modunda **anlamsızdır**.
   - **Kural:** Mod değiştiği anda (`setStudioMode(nextMode)`), hedef modun `tools.primaryTools` listesinde mevcut `activeTool` yoksa (veya her mod geçişinde güvenli varsayılan olarak) `activeTool` hedef modun `tools.defaultToolId` değerine (`'select'`) **sıfırlanır**.
2. **Seçim (`selectedIds`, `editingGroupId`) ve Backend Seçimi:**
   - Tasarım modundaki DOM düğümü seçimi (`selectedIds`, `editingGroupId`) Backend tuvalinde doğrudan seçili düğüm olarak görünmez; ancak kullanıcı Tasarım'da bir butonu seçip *"Backend'de buna akış bağla"* diyerek veya tekrar Tasarım'a dönerek çalışmak isteyebilir.
   - **Tasarım:**
     - `useSelection` (Tasarım DOM seçimi) ile ileride eklenecek `selectedBackendNodeIds` birbirinden **ayrı** tutulur.
     - Tasarım'dan Backend'e geçildiğinde `editingGroupId` (grup izolasyonu) `null`'a sıfırlanır; `selectedIds` ise দুটি seçenekten biriyle yönetilir (bkz. **Bölüm 9, Açık Soru 2**: `selectedIds` tamamen sıfırlansın mı, yoksa Tasarım'a geri dönüldüğünde hatırlansın mı?).
3. **Zoom ve Pan (`zoom`, `panOffset`):**
   - Tasarım tuvali (`useCanvasView`), sol çekmece ve sağ dock genişliklerine göre artboard'u (`1280px / 768px / 375px`) ortalar ve sığdırır.
   - Backend modundan Tasarım moduna geri dönüldüğünde `<Canvas />` yeniden görünür olur; `useCanvasView` içindeki `triggerFit()` (veya Tasarım moduna ait son `zoom`/`panOffset`) tetiklenerek tuvalin kaymış veya `0x0` ölçümde kalması engellenir.
   - Backend iskelet görünümünde ise Tasarım tuvalinin `ResizeObserver`'ı devre dışı kalır (yalnızca `activeMode === 'design'` iken çalışır).

---

## 4. `useShortcuts` Mod Başına Kısayol Tablosu ve `docs/kisayollar.md` Çakışma Kontrolü

### 4.1 Mod Başına Kısayol Mimarisi
`useShortcuts` içine `activeMode` (`'design' | 'backend'`) geçirilir ve kısayollar iki katmana ayrılır:

1. **Evrensel (Global — Her İki Modda Geçerli) Kısayollar:**
   - `Ctrl+K` (AI Sohbet odakla)
   - `Ctrl+S` / `Ctrl+Shift+S` (Kaydet / Farklı Kaydet)
   - `Ctrl+O` / `Ctrl+Shift+O` (Dosya / Klasör Aç)
   - `Ctrl+E` (Canlıya Al & Yayınla Modalı)
   - `Ctrl+Shift+N` (Yeni Boş Proje)
   - `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (Aktif modun geçmişinde Geri Al / İleri Al)
   - `Escape` (Açık aracı `'select'`e döndür / aktif mod seçimini üst kapsama çıkar)
   - `V` (`select` aracı), `H` (`hand` aracı)
2. **Yalnızca `design` Modunda Geçerli Kısayollar (`activeMode === 'design'` şartına bağlananlar):**
   - **Tek Tuş Çizim/Stil Araçları:** `R` (`rectangle`), `O` (`circle`), `L` (`line`), `F` (`frame`), `T` (`text`), `Z` (`zoom`), `I` (`eyedropper`)
   - **DOM AST & Görsel Düzenleme:** `Ctrl+A` (tüm DOM öğelerini seç), `Ctrl+C/X/V` (DOM öğesi kopyala/kes/yapıştır), `Ctrl+Shift+C/V` (biçim boyacısı kopyala/yapıştır), `Ctrl+D` (DOM öğesi çoğalt), `Ctrl+G` / `Ctrl+Shift+G` (grupla / grubu çöz), `Ctrl+Shift+L` (kilitle), `Ctrl+N` (yeni sayfa sekmesi), `Delete` / `Backspace` (seçili DOM öğesini sil), `ArrowUp/Down/Left/Right` (DOM öğesini `1px/10px` kaydır), `Enter` (alt DOM öğesini seç), `]` / `[` / `Ctrl+]` / `Ctrl+[` (Z-order), `Shift+G` (12 sütun ızgara), `Shift+R` (piksel cetveli), `Ctrl + / - / 0` (tuval zoom).

### 4.2 `docs/kisayollar.md` ile Çakışma Kontrolü
[kisayollar.md](file:///home/mert/Masaüstü/craftStudio/docs/kisayollar.md) içindeki mevcut 35 kısayol incelendiğinde:
- Backend modunda `R`, `O`, `L`, `F`, `T`, `I`, `Shift+G`, `Shift+R`, `Ctrl+G`, `Ctrl+D`, `Delete`, `Arrow*` tuşları `activeMode === 'design'` korumasıyla devre dışı bırakıldığında, kullanıcı Backend modundayken **arka plandaki Tasarım tuvalinin öğelerinin yanlışlıkla silinmesi, taşınması, gruplanması veya görünmez çizim aracına geçilmesi tamamen engellenmiş olur**.
- Yeni bir mod geçiş kısayolu eklenecekse (ör. `Alt+1` Tasarım, `Alt+2` Backend), `docs/kisayollar.md` içinde `Alt+1` veya `Alt+2` kullanan **hiçbir mevcut kısayol bulunmamaktadır** (sıfır çakışma).

---

## 5. `TopMenuBar` Pencere Menüsünün Kayıttan Otomatik Dolması

Şu anda [TopMenuBar.jsx](file:///home/mert/Masaüstü/craftStudio/src/components/TopMenuBar.jsx#L304-L367) içinde `Pencere` menüsündeki 5 öğe (`properties`, `assets`, `layers`, `aiAgent`, `attributesAndCss`) sabit (hardcoded) JSX olarak yazılmıştır.

### 5.1 Veri Güdümlü `Pencere` Menüsü
1. `useWorkspaceLayout`, aktif modun `STUDIO_MODES[activeMode].menuPanels` dizisini okur:
   - `effectiveActivePanels` hesaplaması sabit anahtarlar yerine `menuPanels` dizisindeki her öğenin `target` tanımına (`area: 'rightDock' | 'leftDrawer' | 'aiDock' | 'modal'`) bakarak dinamik `{ [panel.id]: boolean }` haritası üretir.
   - `togglePanel(panelId)` fonksiyonu `menuPanels.find(p => p.id === panelId)?.target` üzerinden ilgili çekmeceyi, sağ dock'u, AI dock'u veya modalı açıp kapatır.
2. `TopMenuBar.jsx` içine `menuPanels = STUDIO_MODES[activeMode].menuPanels` prop olarak (veya varsayılan değerle) verilir ve menü tek bir `.map()` ile çizilir:
   - `panel.dividerBefore === true` ise üstüne `<div className="h-px bg-[#27272d] my-1 mx-1" />` konur.
   - `panel.shortcutHint` varsa (`Ctrl+K`) sağda `<kbd>` etiketi ve yanında `activePanels[panel.id] && <Check />` gösterilir.
3. **Geriye Uyumluluk & Smoke Test Garantisi:**
   - `design` modundaki `menuPanels` etiketleri (`"Özellikler & Hizalama"`, `"Assetler & Şablonlar"`, `"Katmanlar (Layers)"`, `"AI Sohbet Çubuğu"`, `"Yüzen CSS & Nitelik Penceresi"`) ve `panel.id` değerleri mevcut sabit JSX ile **%100 aynı** olduğu için `scripts/test_smoke_ui.js` içindeki `clickWindowMenuItem(cdp, 'Katmanlar (Layers)')` ve `clickWindowMenuItem(cdp, 'Assetler')` adımları hiçbir değişiklik olmadan çalışmaya devam eder.

---

## 6. Proje Şeması (`.craft.json`) `backend` Bölümü ve Geriye Uyumluluk

### 6.1 `.craft.json` Şema Genişlemesi (`src/utils/projectStorage.js`)
Mevcut `buildSerializableProjectSchema` ([projectStorage.js](file:///home/mert/Masaüstü/craftStudio/src/utils/projectStorage.js#L91-L128)) çıktısına mevcut alanların hiçbirini bozmadan `backend` alanı eklenir:

```json
{
  "schemaVersion": "1.1.0",
  "studio": "CraftStudio",
  "id": "proj-173...",
  "name": "Aurelia Atelier Vitrini",
  "viewportMode": "desktop",
  "activeTabId": "tab-1",
  "tabs": [ ... ],
  "projectFunctions": [ ... ],
  "pageLinks": [ ... ],
  "backend": {
    "version": 1,
    "flows": [],
    "dataModels": [],
    "triggers": []
  }
}
```

### 6.2 Eski Dosyalar Açılırken Geriye Uyumluluk
- `createDefaultBackendState()` yardımcısı `{ version: 1, flows: [], dataModels: [], triggers: [] }` döndürür.
- `parseAndMigrateLoadedProject(rawInput)` ([projectStorage.js](file:///home/mert/Masaüstü/craftStudio/src/utils/projectStorage.js#L133-L204)) içinde:
  - Yüklenen `.craft.json`, eski tek sayfalı JSON veya HTML/JSX içe aktarma çıktısında `parsed.backend` alanı **yoksa** veya geçersizse otomatik olarak `normalizeProjectBackend(parsed.backend)` -> `{ version: 1, flows: [], dataModels: [], triggers: [] }` atanır.
  - Mevcut `projectFunctions` (formül/JS fonksiyonları) ve `pageLinks` alanları olduğu gibi korunur (bkz. **Bölüm 9, Açık Soru 3**).
  - Mevcut 77 birim testi (`scripts/test_studio_features.js`) ve `scripts/test_import_matrix.js` içindeki `project.craft.json` beklentileri doğrulanarak geriye uyumluluk garanti altına alınır.

---

## 7. Mod Anahtarı Arayüzü (UI / UX) ve Geçiş Davranışı

1. **Konum (`TopMenuBar.jsx`):**
   - Üst komut çubuğunda (`h-10`), sol taraftaki **Proje Adı & Kayıt Durumu kapsülü** ile ortadaki **PC / Tablet / Mobil Cihaz Seçicisi** arasında (veya orta alanda birincil segment kontrolü olarak) yer alır:
   - Kod bilmeyen kullanıcı için net, ikonlu iki segmentli hap (pill) anahtar:
     - `[ 🎨 Tasarım ]` (`data-studio-mode="design"`, aktifken `#0d99ff` mavi vurgu)
     - `[ ⚡ Backend ]` (`data-studio-mode="backend"`, aktifken `#10b981` zümrüt vurgu)
2. **Mod Başına Düzen Hatırlama:**
   - `layoutsByMode` sayesinde kullanıcı Tasarım modunda sol çekmeceyi kapatıp sağ dock'u `400px` genişliğe ayarladıysa ve Backend modunda sol `İş Akışları` çekmecesini açık bıraktıysa, modlar arasında geçiş yaptığında her mod kendi son bıraktığı panel açık/kapalı ve sekme durumuna geri döner.
3. **Geçiş Animasyonu & Kaybolma / Ölçüm Sorunları (`Canvas` & `ResizeObserver`):**
   - Ağır animasyonlar yerine anlık, titremesiz (zero-layout-thrash) geçiş uygulanır.
   - Backend moduna geçildiğinde `<Canvas />` unmount edildiği (veya gizlendiği) ve tekrar Tasarım moduna dönüldüğünde yeniden mount olduğu için, `useCanvasView` içindeki çift `requestAnimationFrame` fit/center effect'ine `activeMode` bağımlılığı eklenir (`if (activeMode !== 'design') return;`). Böylece Tasarım moduna dönüldüğü anda `#canvas-wrapper` ve `#artboard-canvas` doğru boyutlarla yeniden ortalanır ve `0px` görünmez tuval sorunu yaşanmaz.
4. **Kaydedilmemiş Değişiklik Durumu (`hasUnsavedChanges`):**
   - Salt mod değiştirmek (`Tasarım -> Backend` veya `Backend -> Tasarım`) proje verisini değiştirmediği için **`hasUnsavedChanges`'i `true` yapmaz**.
   - Eğer projede zaten kaydedilmemiş değişiklik varsa (`hasUnsavedChanges === true`), üst çubuktaki `● Kaydedilmedi` rozeti, pencere başlığındaki `● ` öneki, `1500ms` otomatik taslak (`useProjectIO`) ve `Ctrl+S` kaydetme işlevi Backend modunda da kesintisiz çalışmaya devam eder.

---

## 8. İmplementasyon Adımları (Her Adım Ayrı Commit & 4 Test Garantisi)

Her adımdan sonra `node scripts/test_studio_features.js`, `node scripts/test_import_matrix.js`, `npm run build` ve `node scripts/test_smoke_ui.js` çalıştırılacak ve hiçbir adımda mevcut Tasarım modu davranışı değişmeyecektir:

| Adım | Commit Başlığı (Öneri) | Etkilenen Dosyalar | İçerik | Risk |
| :---: | :--- | :--- | :--- | :---: |
| **1** | `feat(modes): add studioModesRegistry and backend schema defaults` | `src/data/studioModesRegistry.js` *(yeni)*, `src/utils/projectStorage.js`, `scripts/test_studio_features.js` | `STUDIO_MODES` (`design`, `backend`) kayıt tanımları; `projectStorage.js` içine `normalizeProjectBackend` ve geriye uyumlu `backend` alanı; birim testleri. | **Düşük** |
| **2** | `refactor(layout): support per-mode layoutsByMode and registry menuPanels` | `src/hooks/useWorkspaceLayout.js`, `src/hooks/useProjectState.js`, `src/hooks/useProjectIO.js` | `useWorkspaceLayout` içinde `activeMode` + `layoutsByMode` desteği ve `menuPanels` üzerinden dinamik `effectiveActivePanels`/`togglePanel`; `useProjectState` ve `useProjectIO` içine `backendData` state/reset/save bağlantısı. | **Düşük-Orta** |
| **3** | `feat(ui): add mode switcher to TopMenuBar and registry-driven Window menu` | `src/components/TopMenuBar.jsx`, `src/hooks/useShortcuts.js`, `src/hooks/useCanvasView.js` | `TopMenuBar` üst çubuğuna `Tasarım \| Backend` mod anahtarı ve kayıttan otomatik dolan `Pencere` menüsü; `useShortcuts` içine `activeMode` profili; `useCanvasView` içine `activeMode === 'design'` koruması. | **Orta** |
| **4** | `feat(backend): render mode-driven left/right panels and backend workspace skeleton` | `src/components/BackendWorkspaceSkeleton.jsx` *(yeni)*, `src/components/StudioLeftSidebar.jsx`, `src/components/StudioRightDock.jsx`, `src/App.jsx`, `scripts/test_smoke_ui.js` | `StudioLeftSidebar` ve `StudioRightDock` bileşenlerinin aktif modun `tools`, `leftPanels` ve `rightTabs` kayıtlarını okuması; orta alanda `activeMode === 'backend'` iken `<BackendWorkspaceSkeleton />` gösterilmesi; smoke teste `Tasarım <-> Backend` geçiş doğrulamasının eklenmesi. | **Orta** |

---

## 9. Onaylanan Tasarım Kararları (Hepsi A)

1. **Aktif Mod (`activeMode`) `.craft.json` Dosyasına Kaydedilmez (Karar: A):**
   - Projeler kaydedilirken veya açılırken her zaman `'design'` (Tasarım) modunda açılır; `activeMode` yalnızca çalışma zamanı görünüm durumudur.
2. **Tasarım'dan Backend'e Geçerken Seçim Davranışı (Karar: A):**
   - `editingGroupId` sıfırlanır (`null`), ancak `selectedIds` bellekte korunur.
3. **Mevcut `projectFunctions` ve `backend` Bölümü İlişkisi (Karar: A):**
   - `projectFunctions` geriye uyumluluk için yerinde kalır; yeni `backend` bölümü (`{ version: 1, flows: [], dataModels: [], triggers: [] }`) ayrı bir nesne olarak eklenir.
4. **Backend Modunda Üstteki Sayfa Sekmeleri (Karar: A):**
   - Backend modunda üstteki sayfa sekmeleri şeridi (`showPageTabsBar: false`) gizlenir.
5. **Yüzen AI Sohbet Kutusu (`FloatingAIChatDock`) Görünürlüğü (Karar: A):**
   - Yüzen AI sohbet kutusu (`supportsFloatingAiDock: true`) her iki modda da görünür kalır.

