const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");

let window = null;
let tray = null;
let quitting = false;
let closeToTray = true;
let latestWorkspacePayload = null;
let writeChain = Promise.resolve(true);

app.setName("Waymark");
if (process.platform === "win32") {
  app.setAppUserModelId("com.waymark.desktop");
}

function extractUrlArg(argv) {
  for (const arg of argv.slice(1)) {
    if (/^https?:\/\/\S+/i.test(arg)) return arg;
  }
  return null;
}

function validateWorkspaceJson(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 50 * 1024 * 1024) {
    throw new Error("Invalid workspace payload");
  }
  JSON.parse(value);
}

function writeWorkspaceSync(dataPath, value) {
  try {
    validateWorkspaceJson(value);
    latestWorkspacePayload = value;
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    const tmpPath = `${dataPath}.tmp`;
    fs.writeFileSync(tmpPath, value, "utf8");
    try {
      fs.renameSync(tmpPath, dataPath);
    } catch {
      fs.copyFileSync(tmpPath, dataPath);
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

function queueWorkspaceWrite(dataPath, value) {
  try {
    validateWorkspaceJson(value);
  } catch {
    return Promise.resolve(false);
  }
  latestWorkspacePayload = value;
  writeChain = writeChain.then(async () => {
    // Coalesce intermediate writes if a newer payload arrived while waiting
    if (latestWorkspacePayload !== value) return true;
    try {
      await fsp.mkdir(path.dirname(dataPath), { recursive: true });
      const tmpPath = `${dataPath}.tmp`;
      await fsp.writeFile(tmpPath, value, "utf8");
      try {
        await fsp.rename(tmpPath, dataPath);
      } catch {
        await fsp.copyFile(tmpPath, dataPath);
        await fsp.unlink(tmpPath).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  });
  return writeChain;
}

function loadWindowState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw);
    const width = Number.isFinite(parsed.width) && parsed.width >= 800 ? parsed.width : 1280;
    const height = Number.isFinite(parsed.height) && parsed.height >= 600 ? parsed.height : 860;
    const x = Number.isFinite(parsed.x) ? parsed.x : undefined;
    const y = Number.isFinite(parsed.y) ? parsed.y : undefined;
    return { width, height, x, y, maximized: Boolean(parsed.maximized) };
  } catch {
    return { width: 1280, height: 860, x: undefined, y: undefined, maximized: false };
  }
}

function saveWindowState(statePath, win) {
  if (!win || win.isDestroyed()) return;
  try {
    const maximized = win.isMaximized();
    const bounds = maximized ? win.getNormalBounds() : win.getBounds();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ ...bounds, maximized }), "utf8");
  } catch {}
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (!window) return;
    window.show();
    if (window.isMinimized()) window.restore();
    window.focus();
    const url = extractUrlArg(argv);
    if (url) window.webContents.send("url:open", url);
  });

  app.on("before-quit", () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    const userDataDir = app.getPath("userData");
    const dataPath = path.join(userDataDir, "workspace.json");
    const statePath = path.join(userDataDir, "window-state.json");

    ipcMain.on("workspace:read", (event) => {
      try {
        event.returnValue = latestWorkspacePayload ?? fs.readFileSync(dataPath, "utf8");
      } catch {
        event.returnValue = null;
      }
    });

    ipcMain.on("workspace:write", (event, value) => {
      event.returnValue = writeWorkspaceSync(dataPath, value);
    });

    ipcMain.handle("workspace:write-async", (_event, value) => {
      return queueWorkspaceWrite(dataPath, value);
    });

    const initialState = loadWindowState(statePath);

    window = new BrowserWindow({
      width: initialState.width,
      height: initialState.height,
      x: initialState.x,
      y: initialState.y,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      show: false,
      backgroundColor: "#f8f5ef",
      icon: path.join(__dirname, "assets", "icon.ico"),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });

    window.loadFile(path.join(__dirname, "..", "dist-electron", "electron.html"));

    window.once("ready-to-show", () => {
      if (initialState.maximized) window.maximize();
      window.show();
      const startupUrl = extractUrlArg(process.argv);
      if (startupUrl) window.webContents.send("url:open", startupUrl);
    });

    window.on("close", (event) => {
      saveWindowState(statePath, window);
      if (!quitting && closeToTray && tray) {
        event.preventDefault();
        window.hide();
      }
    });

    for (const name of ["maximize", "unmaximize"]) {
      window.on(name, () => {
        if (window && !window.isDestroyed()) {
          window.webContents.send("window:maximized", window.isMaximized());
        }
      });
    }

    const external = (url) => {
      try {
        const parsed = new URL(url);
        if (["https:", "http:", "mailto:"].includes(parsed.protocol)) {
          void shell.openExternal(parsed.toString());
        }
      } catch {}
    };

    window.webContents.setWindowOpenHandler(({ url }) => {
      external(url);
      return { action: "deny" };
    });

    window.webContents.on("will-navigate", (event, url) => {
      if (url.split("#")[0] !== window.webContents.getURL().split("#")[0]) {
        event.preventDefault();
        external(url);
      }
    });

    ipcMain.on("window:minimize", () => window?.minimize());
    ipcMain.on("window:maximize", () => {
      if (!window) return;
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    });
    ipcMain.on("window:close", () => window?.close());
    ipcMain.handle("window:is-maximized", () => Boolean(window?.isMaximized()));
    ipcMain.on("external:open", (_event, url) => external(url));

    ipcMain.on("notification:show", (_event, title, body) => {
      if (typeof title === "string" && typeof body === "string" && Notification.isSupported()) {
        const n = new Notification({
          title: title.slice(0, 200),
          body: body.slice(0, 2000),
          icon: path.join(__dirname, "assets", "icon-256.png"),
        });
        n.on("click", () => {
          window?.show();
          window?.focus();
        });
        n.show();
      }
    });

    ipcMain.on("settings:tray", (_event, enabled) => {
      closeToTray = Boolean(enabled);
    });

    ipcMain.on("settings:login", (_event, enabled) => {
      if (process.platform === "win32") {
        app.setLoginItemSettings({
          openAtLogin: Boolean(enabled),
          path: process.execPath,
        });
      }
    });

    try {
      const trayIconPath =
        process.platform === "win32"
          ? path.join(__dirname, "assets", "icon.ico")
          : path.join(__dirname, "assets", "tray.png");
      tray = new Tray(nativeImage.createFromPath(trayIconPath));
      tray.setToolTip("Waymark");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: "Open Waymark",
            click: () => {
              window?.show();
              window?.focus();
            },
          },
          { type: "separator" },
          {
            label: "Quit",
            click: () => {
              quitting = true;
              app.quit();
            },
          },
        ]),
      );
      tray.on("click", () => {
        window?.show();
        window?.focus();
      });
      tray.on("double-click", () => {
        window?.show();
        window?.focus();
      });
    } catch {
      closeToTray = false;
    }
  });

  app.on("window-all-closed", () => app.quit());
}
