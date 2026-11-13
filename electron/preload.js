const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getExportDefaults: (projectName) => ipcRenderer.invoke('get-export-defaults', projectName),
  selectExportDirectory: (defaultPath) => ipcRenderer.invoke('select-export-directory', defaultPath),
  checkExportTarget: (payload) => ipcRenderer.invoke('check-export-target', payload),
  exportToDesktop: (projectData) => ipcRenderer.invoke('export-to-desktop', projectData),
  launchLiveServer: (payload) => ipcRenderer.invoke('launch-live-server', payload),
  stopLiveServer: () => ipcRenderer.invoke('stop-live-server'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  openDesktopFolder: (folderPath) => ipcRenderer.invoke('open-desktop-folder', folderPath),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  importProjectFolder: (folderPath) => ipcRenderer.invoke('import-project-folder', folderPath),
  saveProjectFile: (payload) => ipcRenderer.invoke('save-project-file', payload),
  openProjectFileDialog: () => ipcRenderer.invoke('open-project-file-dialog'),
  readProjectFile: (filePath) => ipcRenderer.invoke('read-project-file', filePath),
});
