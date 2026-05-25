const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;
const PROTOCOL = "nack";

// Windows : même identifiant que package.json build.appId — icône barre des tâches / Jump List correcte
if (process.platform === "win32") {
  app.setAppUserModelId("com.nack.desktop");
}

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

function focusMainWindow() {
  const win = mainWindow || BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function registerDeepLinkProtocol() {
  try {
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch (e) {
    console.error("registerDeepLinkProtocol", e);
  }
}

ipcMain.handle("nack:open-external", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
    throw new Error("URL externe invalide");
  }
  await shell.openExternal(url.trim());
});

function createMainWindow() {
  const iconPath = path.join(__dirname, "assets", "icon.png");
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const isExternalUrl = /^https?:\/\//i.test(url);
    if (isExternalUrl) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL || "http://localhost:8080");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (/^nack:/i.test(url)) {
      focusMainWindow();
    }
  });

  app.whenReady().then(() => {
    registerDeepLinkProtocol();
    createMainWindow();

    if (process.platform === "win32") {
      const cold = process.argv.find((a) => /^nack:/i.test(a));
      if (cold) {
        setTimeout(() => focusMainWindow(), 400);
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
