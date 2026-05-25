const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nackDesktop", {
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke("nack:open-external", url),
});
