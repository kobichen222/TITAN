/* DJ MAX — Electron wrapper
   Loads public/pioneer-dj-pro-max-v2.html in a native BrowserWindow so the
   whole app runs as a standalone desktop program (no browser needed). */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0a0a0a',
    title: 'DJ MAX — Ultimate AI DJ Console',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'public', 'icon.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Enable Web Audio + File API + drag-drop — all default-on for packaged apps
      webSecurity: true,
    },
  });

  // Minimal menu: just File → Quit, View → Reload / DevTools, and Window
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // External links → system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const htmlPath = path.join(__dirname, '..', 'public', 'pioneer-dj-pro-max-v2.html');
  mainWindow.loadFile(htmlPath);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
