const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const scripts = [];
const scriptTag = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
let match;

while ((match = scriptTag.exec(html)) !== null) {
  if (match[1].trim()) scripts.push(match[1]);
}

if (scripts.length !== 1) {
  throw new Error("Expected one inline application script, found " + scripts.length + ".");
}

new vm.Script(scripts[0], { filename: "index.html:inline-script" });

for (const file of ["desktop/main.cjs", "desktop/preload.cjs"]) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}

const requiredIds = [
  "menuBtn", "closeDrawer", "scrim", "newChatBtn", "newProject",
  "showArchives", "settingsBtn", "chatSettings", "drawerSettings",
  "homeSend", "chatSend", "backChat", "projectMore", "homeMode", "chatMode",
  "homeAgentMode", "chatAgentMode", "homeSkill", "chatSkill", "homeWebSearch", "chatWebSearch"
];

for (const id of requiredIds) {
  if (!html.includes('id="' + id + '"') || !scripts[0].includes("$('" + id + "')")) {
    throw new Error("Missing UI wiring for #" + id + ".");
  }
}

if (!/<script\b(?=[^>]*\basync\b)(?=[^>]*src="https:\/\/js\.puter\.com\/v2\/")[^>]*>/i.test(html)) throw new Error("Asynchronous Puter SDK loader is missing.");
if (!scripts[0].includes("window.puter.ai.chat(msgs,false,settings)") || !scripts[0].includes("window.NexeraNative.saveApiKey")) throw new Error("Puter message-array routing or secure BYOK provider routing is missing.");

if (!scripts[0].includes('"kind":"question"') || !scripts[0].includes("parsed?.kind==='question'")) {
  throw new Error("Vibecoding clarification-question flow is missing.");
}
if (!scripts[0].includes("mergeProjectFiles(activeProject?.files,parsed?.files)")) {
  throw new Error("Iterative partial project merge flow is missing.");
}

if (!scripts[0].includes("window.onNexeraNativeResult")) {
  throw new Error("Native result bridge callback is missing.");
}

console.log("Nexera UI script parses and required controls are wired.");
