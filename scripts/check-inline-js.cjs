const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script\\s*>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

if (scripts.length !== 1) {
  throw new Error(`Expected one inline application script, found ${scripts.length}.`);
}

new vm.Script(scripts[0], { filename: "index.html:inline-script" });

const requiredIds = [
  "menuBtn", "closeDrawer", "scrim", "newChatBtn", "newProject",
  "showArchives", "settingsBtn", "chatSettings", "drawerSettings",
  "homeSend", "chatSend", "backChat", "projectMore"
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`) || !scripts[0].includes(`$(' ${id}')`.replace("$(' ", "$('"))) {
    // The source uses compact $('id') selectors; keep this check explicit.
    if (!html.includes(`id="${id}"`) || !scripts[0].includes(`$(' ${id}')`.replace(" ", ""))) {
      throw new Error(`Missing UI wiring for #${id}.`);
    }
  }
}

if (!scripts[0].includes("window.onNexeraNativeResult")) {
  throw new Error("Native result bridge callback is missing.");
}

console.log("Nexera UI script parses and required controls are wired.");
