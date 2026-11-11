const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");
const { execFile } = require("node:child_process");

let mainWindow;
let localServer;
let localOrigin;
let linkedWorkspaceDirectory = null;
const WORKSPACE_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".txt", ".md", ".svg", ".xml", ".webmanifest"]);
const WORKSPACE_IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", ".idea"]);
function safeWorkspaceRelativePath(value) {
  if (typeof value !== "string" || value.startsWith("/") || value.includes("\\\\") || value.length > 400) return false;
  const parts = value.split("/");
  return parts.length <= 5 && parts.every(part => /^[A-Za-z0-9._-]{1,80}$/.test(part) && part !== "." && part !== "..");
}
function readWorkspaceFiles(root) {
  const files = {};
  let totalBytes = 0;
  const walk = (directory, depth) => {
    if (depth > 4 || Object.keys(files).length >= 100 || totalBytes >= 700_000) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (Object.keys(files).length >= 100 || totalBytes >= 700_000) break;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!WORKSPACE_IGNORED_DIRS.has(entry.name)) walk(path.join(directory, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const fullPath = path.join(directory, entry.name);
      const relative = path.relative(root, fullPath).split(path.sep).join("/");
      if (!safeWorkspaceRelativePath(relative) || !WORKSPACE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const stat = fs.statSync(fullPath);
      if (stat.size > 400_000 || totalBytes + stat.size > 700_000) continue;
      files[relative] = fs.readFileSync(fullPath, "utf8");
      totalBytes += stat.size;
    }
  };
  walk(root, 0);
  return files;
}
function writeWorkspaceFiles(filesJson) {
  if (!linkedWorkspaceDirectory) return { ok: false, error: "No local folder is linked." };
  try {
    if (typeof filesJson !== "string" || filesJson.length > 1_000_000) throw new Error("The workspace update is too large.");
    const files = JSON.parse(filesJson);
    if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error("Invalid workspace file data.");
    const entries = Object.entries(files);
    if (!entries.length || entries.length > 100) throw new Error("The workspace must contain between 1 and 100 files.");
    const root = fs.realpathSync(linkedWorkspaceDirectory);
    let totalBytes = 0;
    for (const [name, value] of entries) {
      if (!safeWorkspaceRelativePath(name) || !WORKSPACE_EXTENSIONS.has(path.extname(name).toLowerCase())) throw new Error("Unsupported workspace file path or type: " + name);
      if (typeof value !== "string") throw new Error("Invalid content for " + name);
      const bytes = Buffer.byteLength(value, "utf8");
      if (bytes > 400_000) throw new Error("A workspace file is too large: " + name);
      totalBytes += bytes;
      if (totalBytes > 700_000) throw new Error("The workspace update is too large.");
      const target = path.resolve(root, ...name.split("/"));
      if (target !== root && !target.startsWith(root + path.sep)) throw new Error("Invalid workspace path.");
      const parent = path.dirname(target);
      fs.mkdirSync(parent, { recursive: true });
      const realParent = fs.realpathSync(parent);
      if (realParent !== root && !realParent.startsWith(root + path.sep)) throw new Error("Workspace path escapes the selected folder.");
      if (fs.existsSync(target)) {
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Refusing to replace a non-file workspace entry: " + name);
      }
      fs.writeFileSync(target, value, "utf8");
    }
    return { ok: true, count: entries.length };
  } catch (error) {
    return { ok: false, error: error.message || "Could not save the local workspace." };
  }
}
const keyFile = () => path.join(app.getPath("userData"), "credentials.enc");
const allowedProvider = /^[a-z0-9_-]{1,40}$/i;

function readKeys() {
  try {
    if (!fs.existsSync(keyFile()) || !safeStorage.isEncryptionAvailable()) return {};
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(keyFile())));
  } catch { return {}; }
}
function writeKeys(keys) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure credential storage is unavailable.");
  fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
  fs.writeFileSync(keyFile(), safeStorage.encryptString(JSON.stringify(keys)), { mode: 0o600 });
}
function sendResult(requestId, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("nexera:result", { id: requestId, json: JSON.stringify(data) });
}
function postChat({ provider, endpoint, model, messagesJson, requestId }) {
  (async () => {
    try {
      if (!allowedProvider.test(provider || "")) throw new Error("Invalid provider.");
      const target = new URL(endpoint);
      if (target.protocol !== "https:") throw new Error("Only HTTPS model endpoints are allowed.");
      if (!model || model.length > 160) throw new Error("Enter a valid model ID.");
      const apiKey = readKeys()[provider];
      const kiloFreeModel = provider === "kilo" &&
        (model === "kilo-auto/free" || model.endsWith(":free"));
      const llmFaucetFree = provider === "llmfaucet";
      const ovhAnonymousFree = provider === "ovh";
      if (!apiKey && !kiloFreeModel && !llmFaucetFree && !ovhAnonymousFree) {
        throw new Error("No API key saved for this provider. Open Settings to add one, or choose a free route.");
      }
      if (typeof messagesJson !== "string" || messagesJson.length > 1_000_000) throw new Error("The chat request was too large.");
      let messages;
      try { messages = JSON.parse(messagesJson); } catch { throw new Error("Invalid chat message data."); }
      if (!Array.isArray(messages) || messages.length < 1 || messages.length > 80) throw new Error("Invalid chat message list.");
      const body = JSON.stringify({ model, messages, temperature: 0.3 });
      const result = await new Promise((resolve, reject) => {
        const req = https.request(target, {
          method: "POST",
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : (llmFaucetFree ? { Authorization: "Bearer free" } : {})),
            "Content-Type": "application/json",
            Accept: "application/json",
            "Content-Length": Buffer.byteLength(body)
          },
          timeout: 45000
        }, res => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", chunk => {
            data += chunk;
            if (data.length > 2_000_000) req.destroy(new Error("Provider response was too large."));
          });
          res.on("end", () => resolve({ status: res.statusCode || 0, data }));
        });
        req.on("timeout", () => req.destroy(new Error("The model request timed out.")));
        req.on("error", reject);
        req.write(body);
        req.end();
      });
      let parsed;
      try { parsed = JSON.parse(result.data); } catch { throw new Error("The provider returned an unreadable response."); }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(parsed?.error?.message || `The provider returned HTTP ${result.status}.`);
      }
      const content = parsed?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("The model returned an empty response.");
      sendResult(requestId, { content });
    } catch (error) {
      sendResult(requestId, { error: error.message || "Model request failed." });
    }
  })();
}
function searchWeb(query, requestId) {
  (async () => {
    try {
      if (typeof query !== "string" || !query.trim() || query.length > 300) {
        throw new Error("Enter a shorter search query.");
      }
      const target = new URL("https://html.duckduckgo.com/html/");
      target.searchParams.set("q", query.trim());
      const html = await new Promise((resolve, reject) => {
        const req = https.request(target, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0 NexeraAI/1.0", Accept: "text/html" },
          timeout: 20000
        }, res => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", chunk => {
            body += chunk;
            if (body.length > 1_500_000) req.destroy(new Error("Search response was too large."));
          });
          res.on("end", () => {
            if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
              reject(new Error("Web search returned HTTP " + res.statusCode + "."));
            } else resolve(body);
          });
        });
        req.on("timeout", () => req.destroy(new Error("Web search timed out.")));
        req.on("error", reject);
        req.end();
      });
      const clean = value => String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/&#39;|&#x27;/gi, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/\s+/g, " ").trim();
      const anchors = [...html.matchAll(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*>.*?<\/a>/gis)].slice(0, 6);
      const results = anchors.map(match => {
        const tag = match[0];
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1] || "";
        const title = clean(tag.match(/>(.*?)<\/a>/is)?.[1] || "");
        const tail = html.slice(match.index + tag.length);
        const snippet = clean(tail.match(/<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>(.*?)<\/(?:a|div)>/is)?.[1] || "");
        let url = href.startsWith("//") ? "https:" + href : href;
        try { url = new URL(url).searchParams.get("uddg") || url; } catch {}
        return { title, url, snippet };
      }).filter(item => item.title && /^https?:\/\//i.test(item.url));
      sendResult(requestId, { content: JSON.stringify(results) });
    } catch (error) {
      sendResult(requestId, { error: error.message || "Web search failed." });
    }
  })();
}

function localPortFile() {
  return path.join(app.getPath("userData"), "local-origin.json");
}
function preferredLocalPort() {
  try {
    const saved = JSON.parse(fs.readFileSync(localPortFile(), "utf8"));
    if (Number.isInteger(saved.port) && saved.port >= 1024 && saved.port <= 65535) return saved.port;
  } catch {}
  return 40000 + Math.floor(Math.random() * 20000);
}
function createLocalServer() {
  const root = path.resolve(__dirname, "..");
  return http.createServer((request, response) => {
    let pathname = "/";
    try { pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
    if (pathname !== "/" && pathname !== "/index.html") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    try {
      const html = fs.readFileSync(path.join(root, "index.html"));
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https: wss:; img-src 'self' data: https: blob:; frame-src 'self' https: data: blob:; object-src 'none'; base-uri 'self'"
      });
      response.end(html);
    } catch {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Could not load Nexera.");
    }
  });
}
async function startLocalServer() {
  let port = preferredLocalPort();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const server = createLocalServer();
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { server.off("listening", onListening); reject(error); };
        const onListening = () => { server.off("error", onError); resolve(); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "localhost");
      });
      localServer = server;
      localOrigin = "http://localhost:" + port;
      fs.mkdirSync(path.dirname(localPortFile()), { recursive: true });
      fs.writeFileSync(localPortFile(), JSON.stringify({ port }), { mode: 0o600 });
      return localOrigin;
    } catch (error) {
      server.close();
      if (error.code !== "EADDRINUSE" || attempt === 11) throw error;
      port = 40000 + Math.floor(Math.random() * 20000);
    }
  }
  throw new Error("Could not reserve a local app origin.");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 820, minWidth: 360, minHeight: 560,
    backgroundColor: "#fbfcf9",
    title: "Nexera AI",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.loadURL(localOrigin);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol !== "https:") return { action: "deny" };
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520, height: 760, autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
        }
      };
    } catch { return { action: "deny" }; }
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== localOrigin) event.preventDefault();
    } catch { event.preventDefault(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}
app.whenReady().then(async () => {
  ipcMain.handle("nexera:open-folder", async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, { title: "Open local web project folder", properties: ["openDirectory"] });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
      const root = fs.realpathSync(result.filePaths[0]);
      const files = readWorkspaceFiles(root);
      if (typeof files["index.html"] !== "string") throw new Error("The selected folder needs an index.html file.");
      linkedWorkspaceDirectory = root;
      return { ok: true, folderName: path.basename(root), files };
    } catch (error) {
      return { ok: false, error: error.message || "Could not open that folder." };
    }
  });
  ipcMain.handle("nexera:save-folder", async (_event, filesJson) => writeWorkspaceFiles(filesJson));
  ipcMain.on("nexera:has-key", (event, provider) => {
    event.returnValue = allowedProvider.test(provider || "") && typeof readKeys()[provider] === "string";
  });
  ipcMain.on("nexera:save-key", (event, payload) => {
    try {
      if (!allowedProvider.test(payload?.provider || "") || !payload?.value || payload.value.length > 4096) throw new Error();
      const keys = readKeys(); keys[payload.provider] = payload.value; writeKeys(keys); event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("nexera:delete-key", (event, provider) => {
    try {
      const keys = readKeys(); delete keys[provider]; writeKeys(keys); event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("nexera:chat", (_event, payload) => postChat(payload));
  ipcMain.on("nexera:search", (_event, payload) => searchWeb(payload?.query, payload?.requestId));
  ipcMain.on("nexera:preview", (_event, html) => {
    if (typeof html !== "string" || html.length > 2_000_000) return;
    const preview = new BrowserWindow({
      width: 1100, height: 760, title: "Nexera Preview",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
    });
    preview.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    preview.webContents.on("will-navigate", event => event.preventDefault());
    preview.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
  ipcMain.on("nexera:export-zip", async (_event, payload) => {
    let tempDir = "";
    try {
      if (typeof payload?.filesJson !== "string" || payload.filesJson.length > 5_000_000) {
        throw new Error("The project is too large to export.");
      }
      const files = JSON.parse(payload.filesJson);
      if (!files || typeof files !== "object" || Array.isArray(files)) {
        throw new Error("Invalid project file data.");
      }
      const safeName = String(payload.projectName || "Nexera-project").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) || "Nexera-project";
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: "Export project",
        defaultPath: safeName + ".zip",
        filters: [{ name: "ZIP archive", extensions: ["zip"] }]
      });
      if (canceled || !filePath) return;
      const names = Object.keys(files).filter(name => safeWorkspaceRelativePath(name));
      if (!names.length || names.length > 100) throw new Error("The project must contain between 1 and 100 exportable files.");
      let totalBytes = 0;
      tempDir = path.join(app.getPath("temp"), "nexera-export-" + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      for (const name of names) {
        const content = String(files[name] || "");
        const bytes = Buffer.byteLength(content, "utf8");
        if (bytes > 2_000_000) throw new Error("A project file is too large to export: " + name);
        totalBytes += bytes;
        if (totalBytes > 10_000_000) throw new Error("The project is too large to export.");
        const target = path.join(tempDir, ...name.split("/"));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, "utf8");
      }
      await new Promise((resolve, reject) => {
        const ps = [
          "-NoProfile", "-NonInteractive", "-Command",
          "Compress-Archive -LiteralPath " + names.map(n => "'" + path.join(tempDir, n).replace(/'/g, "''") + "'").join(",") +
          " -DestinationPath '" + filePath.replace(/'/g, "''") + "' -Force"
        ];
        execFile("powershell.exe", ps, error => error ? reject(error) : resolve());
      });
      dialog.showMessageBox(mainWindow, { type: "info", message: "Project ZIP exported successfully." });
    } catch (error) {
      dialog.showErrorBox("Nexera export failed", error.message || "Could not export the ZIP.");
    } finally {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  await startLocalServer();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => { if (localServer) localServer.close(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });