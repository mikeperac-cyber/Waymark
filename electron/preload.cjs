const { contextBridge, ipcRenderer } = require("electron");

const listen = (channel, cb) => {
  const listener = (_event, value) => cb(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("waymark", {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send("window:minimize"),
  maximizeToggle: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizedChange: (cb) => listen("window:maximized", cb),
  notify: (title, body) => ipcRenderer.send("notification:show", title, body),
  openExternal: (url) => ipcRenderer.send("external:open", url),
  setCloseToTray: (enabled) => ipcRenderer.send("settings:tray", enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.send("settings:login", enabled),
  onOpenUrl: (cb) => listen("url:open", cb),
  readWorkspace: () => ipcRenderer.sendSync("workspace:read"),
  writeWorkspace: (value) => ipcRenderer.sendSync("workspace:write", value),
  writeWorkspaceAsync: (value) => ipcRenderer.invoke("workspace:write-async", value),
});
