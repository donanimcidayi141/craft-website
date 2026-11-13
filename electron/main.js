const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createCraftProjectSchema, importProjectFromFolder } = require('./importer');

// ⚡ Power Efficiency & Hardware GPU Acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1e1e1e',
    title: 'CraftStudio - Web Tasarımcı & React Oluşturucu',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      backgroundThrottling: true,
    },
  });

  Menu.setApplicationMenu(null);

  const indexPath = path.join(__dirname, '../dist/index.html');

  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Failed to load:', code, desc);
  });

  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sanitizeExportSlug(name = 'yayinlanan-react-site') {
  const trMap = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  const cleaned = String(name || '')
    .split('')
    .map((ch) => trMap[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return cleaned || 'yayinlanan-react-site';
}

function getMimeTypeForExt(ext) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.jsx': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  };
  return map[ext] || 'application/octet-stream';
}

const livePreviewState = {
  server: null,
  port: null,
  targetDir: '',
  htmlContent: '',
};

ipcMain.handle('get-export-defaults', async (event, projectName) => {
  const desktopPath = app.getPath('desktop');
  const suggestedSlug = sanitizeExportSlug(projectName || 'yayinlanan-react-site');
  return {
    desktopPath,
    documentsPath: app.getPath('documents'),
    homePath: app.getPath('home'),
    suggestedSlug,
    resolvedPath: path.join(desktopPath, suggestedSlug),
  };
});

ipcMain.handle('select-export-directory', async (event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Projenin Yayınlanacağı Üst Klasörü Seçin',
    defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : app.getPath('desktop'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) {
    return { canceled: true, directoryPath: null };
  }
  return { canceled: false, directoryPath: result.filePaths[0] };
});

ipcMain.handle('check-export-target', async (event, payload = {}) => {
  try {
    const baseDir = payload.targetBaseDir && fs.existsSync(payload.targetBaseDir)
      ? payload.targetBaseDir
      : app.getPath('desktop');
    const folderSlug = sanitizeExportSlug(payload.folderName || 'yayinlanan-react-site');
    const targetPath = path.join(baseDir, folderSlug);
    const exists = fs.existsSync(targetPath);
    let fileCount = 0;
    let hasPackageJson = false;
    if (exists) {
      try {
        const entries = fs.readdirSync(targetPath);
        fileCount = entries.length;
        hasPackageJson = entries.includes('package.json');
      } catch {
        // Ignore permission read checks
      }
    }
    return { targetPath, baseDir, folderSlug, exists, fileCount, hasPackageJson };
  } catch (error) {
    return { targetPath: '', exists: false, error: error.message };
  }
});

// IPC Handler: Export Complete Modular React Project + Live Standalone Build to user-specified directory!
ipcMain.handle('export-to-desktop', async (event, project = {}) => {
  try {
    const requestedBaseDir = project.targetBaseDir && fs.existsSync(project.targetBaseDir)
      ? project.targetBaseDir
      : app.getPath('desktop');
    const folderSlug = sanitizeExportSlug(project.folderName || project.title || 'yayinlanan-react-site');
    const targetPath = path.join(requestedBaseDir, folderSlug);

    // Create directories
    fs.mkdirSync(path.join(targetPath, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(targetPath, 'public'), { recursive: true });

    const writtenFiles = [];
    const writeTrackedFile = (relPath, content) => {
      if (content === undefined || content === null) return;
      const absPath = path.join(targetPath, relPath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      fs.writeFileSync(absPath, text, 'utf8');
      writtenFiles.push({
        path: relPath,
        bytes: Buffer.byteLength(text, 'utf8'),
      });
    };

    // Write modular React files
    if (project.files) {
      writeTrackedFile('package.json', project.files.packageJson);
      writeTrackedFile('vite.config.js', project.files.viteConfig);
      writeTrackedFile('index.html', project.files.indexHtml);
      writeTrackedFile('src/index.css', project.files.indexCss);
      writeTrackedFile('src/main.jsx', project.files.mainJsx);
      writeTrackedFile('src/App.jsx', project.files.appCode);

      if (project.files.usesModularTemplate !== false) {
        writeTrackedFile('src/components/Navbar.jsx', project.files.navbarCode);
        writeTrackedFile('src/components/HeroSection.jsx', project.files.heroCode);
        writeTrackedFile('src/components/ProductCard.jsx', project.files.productCardCode);
        writeTrackedFile('src/components/ProductsSection.jsx', project.files.productsSectionCode);
        writeTrackedFile('src/components/Footer.jsx', project.files.footerCode);
      }

      if (project.files.customElementsCode) {
        writeTrackedFile('src/components/CustomElementsSection.jsx', project.files.customElementsCode);
      }

      const standaloneHtml = project.standaloneHtml || project.files.standaloneHtml;
      if (standaloneHtml) {
        writeTrackedFile('live-preview.html', standaloneHtml);
        writeTrackedFile('public/live-preview.html', standaloneHtml);
      }
    }

    // 🌟 Write craft.project.json for 100% Lossless Studio Re-Import!
    const craftProjectData = createCraftProjectSchema({
      id: project.id,
      name: project.title || 'CraftStudio Projesi',
      canvasSettings: project.canvasSettings,
      canvasByViewport: project.canvasByViewport || null,
      viewportMode: project.viewportMode || 'desktop',
      initializedViewports: project.initializedViewports || undefined,
      activeTabId: project.activeTabId || 'tab-1',
      tabs: project.tabs || [
        { id: 'tab-1', name: 'Anasayfa.craft', route: '/', elements: project.elements, canvasByViewport: project.canvasByViewport || undefined }
      ],
      projectFunctions: Array.isArray(project.projectFunctions) ? project.projectFunctions : [],
      pageLinks: project.pageLinks || []
    });
    writeTrackedFile('craft.project.json', JSON.stringify(craftProjectData, null, 2));

    const readme = `# ${project.title || 'CraftStudio Web Projesi'}

Bu web sitesi **CraftStudio** ile görsel olarak tasarlandı ve yayınlandı.

## 1. Anında Canlı Görüntüleme (Kurulumsuz)
\`live-preview.html\` dosyasını doğrudan tarayıcıda açabilir veya CraftStudio'daki **"Tarayıcıda Canlı Aç"** butonunu kullanabilirsiniz.

## 2. React Geliştirme Ortamı (Vite + Tailwind CSS)
\`\`\`bash
cd "${targetPath}"
npm install
npm run dev
\`\`\`

Tarayıcınızda açılan adrese gidin (varsayılan: http://localhost:5173).
`;
    writeTrackedFile('README.md', readme);

    if (project.openFolderAfter !== false) {
      shell.openPath(targetPath);
    }

    return {
      success: true,
      folderPath: targetPath,
      folderSlug,
      liveHtmlPath: fs.existsSync(path.join(targetPath, 'live-preview.html'))
        ? path.join(targetPath, 'live-preview.html')
        : null,
      writtenFiles,
      craftProjectData,
    };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Open folder dialog to import project (craft.project.json OR external HTML/JSX)
ipcMain.handle('open-project-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Açılacak Proje Klasörünü Seçin (CraftStudio veya Harici Web Sitesi)'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    const importResult = await importProjectFromFolder(folderPath);
    return importResult;
  } catch (error) {
    console.error('Project open dialog error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Import specific folder by path
ipcMain.handle('import-project-folder', async (event, folderPath) => {
  try {
    const importResult = await importProjectFromFolder(folderPath);
    return importResult;
  } catch (error) {
    console.error('Import project folder error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-desktop-folder', async (event, folderPath) => {
  if (folderPath) return shell.openPath(folderPath);
  return '';
});

ipcMain.handle('launch-live-server', async (event, payload = {}) => {
  try {
    const http = require('node:http');
    if (payload.htmlContent !== undefined) {
      livePreviewState.htmlContent = String(payload.htmlContent || '');
    }
    if (payload.targetDir && fs.existsSync(payload.targetDir)) {
      livePreviewState.targetDir = payload.targetDir;
    }

    if (!livePreviewState.server) {
      livePreviewState.server = http.createServer((req, res) => {
        try {
          const rawUrl = (req.url || '/').split('?')[0];
          const relReq = decodeURIComponent(rawUrl === '/' ? '/live-preview.html' : rawUrl);

          if ((rawUrl === '/' || rawUrl === '/live-preview.html') && livePreviewState.htmlContent) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(livePreviewState.htmlContent);
            return;
          }

          if (livePreviewState.targetDir) {
            const safeRoot = path.resolve(livePreviewState.targetDir);
            const resolved = path.resolve(safeRoot, relReq.replace(/^\/+/, ''));
            if (resolved.startsWith(safeRoot + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
              const ext = path.extname(resolved).toLowerCase();
              res.writeHead(200, { 'Content-Type': getMimeTypeForExt(ext), 'Cache-Control': 'no-store' });
              fs.createReadStream(resolved).pipe(res);
              return;
            }
          }

          if (livePreviewState.htmlContent) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(livePreviewState.htmlContent);
            return;
          }

          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
        } catch (reqErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(reqErr.message);
        }
      });

      await new Promise((resolve, reject) => {
        livePreviewState.server.once('error', reject);
        livePreviewState.server.listen(0, '127.0.0.1', () => {
          const addr = livePreviewState.server.address();
          livePreviewState.port = addr && typeof addr === 'object' ? addr.port : null;
          livePreviewState.server.unref();
          resolve();
        });
      });
    }

    const url = `http://127.0.0.1:${livePreviewState.port}/`;
    if (payload.openInBrowser !== false) {
      await shell.openExternal(url);
    }
    return { success: true, url, port: livePreviewState.port };
  } catch (error) {
    console.error('Live server error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-live-server', async () => {
  try {
    if (livePreviewState.server) {
      await new Promise((resolve) => livePreviewState.server.close(() => resolve()));
      livePreviewState.server = null;
      livePreviewState.port = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external-url', async (event, targetUrl) => {
  if (typeof targetUrl === 'string' && /^https?:\/\//i.test(targetUrl)) {
    await shell.openExternal(targetUrl);
    return { success: true };
  }
  return { success: false, error: 'Geçersiz URL' };
});

// IPC Handler: Save native .craft.json project file (supports Save & Save As)
ipcMain.handle('save-project-file', async (event, payload = {}) => {
  try {
    let targetPath = payload.filePath || null;
    if (!targetPath || payload.saveAs) {
      const safeName = String(payload.defaultFileName || 'proje.craft.json').replace(/[/\\?%*:|"<>]/g, '-');
      const result = await dialog.showSaveDialog(mainWindow, {
        title: payload.saveAs ? 'Projeyi Farklı Kaydet (.craft.json)' : 'Projeyi Kaydet (.craft.json)',
        defaultPath: path.join(app.getPath('desktop'), safeName),
        filters: [
          { name: 'CraftStudio Projesi (*.craft.json)', extensions: ['craft.json', 'json'] },
          { name: 'Tüm Dosyalar', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }
      targetPath = result.filePath;
    }

    const rawText = typeof payload.content === 'string'
      ? payload.content
      : JSON.stringify(payload.content || {}, null, 2);
    fs.writeFileSync(targetPath, rawText, 'utf8');

    const baseName = path.basename(targetPath).replace(/\.craft\.json$|\.json$/i, '');
    return {
      success: true,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      name: baseName || 'CraftStudio Projesi',
    };
  } catch (error) {
    console.error('Save project file error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Open native .craft.json project file via File Dialog
ipcMain.handle('open-project-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Proje Dosyası Aç (.craft.json)',
      properties: ['openFile'],
      filters: [
        { name: 'CraftStudio Projesi (*.craft.json, *.json)', extensions: ['craft.json', 'craft', 'json'] },
        { name: 'Tüm Dosyalar', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  } catch (error) {
    console.error('Open project file error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Re-open a known recent .craft.json file path directly
ipcMain.handle('read-project-file', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: `Dosya bulunamadı: ${filePath}` };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  } catch (error) {
    console.error('Read project file error:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
