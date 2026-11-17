const fs = require("node:fs");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("index.html", "utf8");
const document = new JSDOM(html).window.document;
const scripts = [...document.querySelectorAll("script")]
  .filter(script => !script.src && script.textContent.includes("(()=>{'use strict';"))
  .map(script => script.textContent);

if (scripts.length !== 1) {
  throw new Error("Expected one inline application script, found " + scripts.length + ".");
}

new vm.Script(scripts[0], { filename: "index.html:inline-script" });

for (const file of ["desktop/main.cjs", "desktop/preload.cjs"]) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}

const requiredIds = [
  "menuBtn", "closeDrawer", "scrim", "newChatBtn", "newProject", "openLocalFolder",
  "showArchives", "settingsBtn", "chatSettings", "drawerSettings",
  "homeSend", "chatSend", "backChat", "projectMore", "homeMode", "chatMode",
  "homeAgentMode", "chatAgentMode", "homeSkill", "chatSkill", "homeWebSearch", "chatWebSearch",
  "workspaceToolbar", "workspaceFiles", "workspaceFileList", "workspaceTitle", "workspaceFileCount",
  "workspaceChatTab", "workspacePreviewTab", "workspaceFilesTab", "workspaceOpenProject",
  "agentElapsed", "agentStatusDetail", "agentRoute", "agentPlan", "pythonBackendUrl", "pythonBackendToken"
];

for (const id of requiredIds) {
  if (!html.includes('id="' + id + '"') || !scripts[0].includes("$('" + id + "')")) {
    throw new Error("Missing UI wiring for #" + id + ".");
  }
}

if (!/<script\b(?=[^>]*\basync\b)(?=[^>]*src="https:\/\/js\.puter\.com\/v2\/")[^>]*>/i.test(html)) throw new Error("Asynchronous Puter SDK loader is missing.");
if (!scripts[0].includes("window.puter.ai.chat(msgs,false,settings)") || !scripts[0].includes("window.NexeraNative.saveApiKey")) throw new Error("Puter message-array routing or secure BYOK provider routing is missing.");

if (!scripts[0].includes("function waitForPuter()") || !scripts[0].includes("await waitForPuter()")) {
  throw new Error("Puter route must wait for its asynchronous SDK to load.");
}
if (!scripts[0].includes('"kind":"question"') || !scripts[0].includes("parsed?.kind==='question'")) {
  throw new Error("Vibecoding clarification-question flow is missing.");
}
if (!scripts[0].includes("mergeProjectFiles(activeProject?.files,parsed?.files,parsed?.deletedFiles)")) {
  throw new Error("Iterative partial project merge flow is missing.");
}

const desktopMain = fs.readFileSync("desktop/main.cjs", "utf8");
const desktopPreload = fs.readFileSync("desktop/preload.cjs", "utf8");

for (const endpoint of [
  "https://openrouter.ai/api/v1/chat/completions",
  "https://api.deepseek.com/chat/completions",
  "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  "https://ai-gateway.kilo.ai/api/v1/chat/completions",
  "https://api.llmfaucet.dev/v1/chat/completions",
  "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
  "https://api.llm7.io/v1/chat/completions",
  "https://hermes.ai.unturf.com/v1/chat/completions"
]) {
  if (!desktopMain.includes(endpoint)) throw new Error("Desktop provider endpoint allowlist is missing " + endpoint);
}
if (!desktopMain.includes("isAllowedEndpoint(provider, endpoint)") ||
    !desktopMain.includes("byokProviders.has(payload?.provider)")) {
  throw new Error("Desktop native bridge must enforce exact provider endpoints and restrict BYOK storage.");
}

if (!desktopPreload.includes('platform: "windows"')) throw new Error("Windows native bridge must identify its preview platform.");
if (!desktopMain.includes('ipcMain.handle("nexera:open-folder"') ||
    !desktopMain.includes('ipcMain.handle("nexera:save-folder"') ||
    !desktopPreload.includes("openFolder:") ||
    !desktopPreload.includes("saveFolder:")) {
  throw new Error("Desktop local-folder workspace bridge is incomplete.");
}
if (!scripts[0].includes("typeof window.NexeraNative?.openFolder") ||
    !scripts[0].includes("await window.NexeraNative.openFolder()") ||
    !scripts[0].includes("await saveLinkedFolder()")) {
  throw new Error("Local-folder UI import or save wiring is incomplete.");
}

if (!scripts[0].includes("const FREE_AUTO_ROUTES") || !scripts[0].includes("FREE_AUTO_ROUTES.slice()")) throw new Error("Free Auto route pool is missing.");
if (!scripts[0].includes("function renderServedModel") || !scripts[0].includes("data.model")) throw new Error("Actual served-model metadata handling is missing.");
if (!scripts[0].includes("async function runPythonAgentPipeline") || !scripts[0].includes("v1/workspaces/") || !scripts[0].includes("text/event-stream")) throw new Error("Python agent client synchronization or SSE streaming is missing.");
if (!scripts[0].includes("function startAgentTask") || !scripts[0].includes("function updateAgentRoute")) throw new Error("Agent progress and route-attempt reporting are missing.");
for (const required of [
  "async function runVibeBuildPipeline",
  "Act as a strict software QA reviewer",
  "Repair only the concrete issues listed below",
  "function parseAgentResponse",
  "function runPreviewDiagnostics",
  "function isAndroidNative"
]) {
  if (!scripts[0].includes(required)) throw new Error("Model-agnostic agent pipeline is missing " + required);
}

if (!scripts[0].includes("window.onNexeraNativeResult")) {
  throw new Error("Native result bridge callback is missing.");
}

const androidMain = fs.readFileSync("app/src/main/java/ai/nexera/app/MainActivity.kt", "utf8");
for (const endpoint of [
  "https://openrouter.ai/api/v1/chat/completions",
  "https://api.deepseek.com/chat/completions",
  "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  "https://ai-gateway.kilo.ai/api/v1/chat/completions",
  "https://api.llmfaucet.dev/v1/chat/completions",
  "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
  "https://api.llm7.io/v1/chat/completions",
  "https://hermes.ai.unturf.com/v1/chat/completions"
]) {
  if (!androidMain.includes(endpoint)) throw new Error("Android provider endpoint allowlist is missing " + endpoint);
}
if (!androidMain.includes('fun platform(): String = "android"')) throw new Error("Android bridge must identify its preview platform.");
if (!androidMain.includes("require(isAllowedEndpoint(provider, endpoint))") ||
    !androidMain.includes("provider in byokEndpoints")) {
  throw new Error("Android native bridge must enforce provider-specific endpoint allowlists and restrict BYOK storage.");
}

console.log("Nexera UI script parses and required controls are wired.");
