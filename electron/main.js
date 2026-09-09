const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#07110c',
    title: 'MZ Tactical Lab',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.on('did-finish-load', () => {
    try {
      const patchPath = path.join(__dirname, '..', 'src', 'parser-patch.js');
      const patchCode = fs.readFileSync(patchPath, 'utf8');
      win.webContents.executeJavaScript(patchCode).catch((error) => {
        console.error('No se pudo activar el parser de ManagerZone:', error);
      });
    } catch (error) {
      console.error('No se pudo cargar parser-patch.js:', error);
    }
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
