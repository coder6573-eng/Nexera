const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("NexeraNative", {
  hasApiKey: (provider) => ipcRenderer.sendSync("nexera:has-key", provider),
  saveApiKey: (provider, value) => ipcRenderer.sendSync("nexera:save-key", { provider, value }),
  deleteApiKey: (provider) => ipcRenderer.sendSync("nexera:delete-key", provider),
  chat: (provider, endpoint, model, messagesJson, requestId) =>
    ipcRenderer.send("nexera:chat", { provider, endpoint, model, messagesJson, requestId }),
  showPreview: (html) => ipcRenderer.send("nexera:preview", html),
  exportZip: (projectName, filesJson) =>
    ipcRenderer.send("nexera:export-zip", { projectName, filesJson })
});

ipcRenderer.on("nexera:result", (_event, payload) => {
  window.dispatchEvent(new CustomEvent("nexera-native-result", { detail: payload }));
});