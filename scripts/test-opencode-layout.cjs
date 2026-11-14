const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const styleStart = html.indexOf('<style id="nexera-v19-opencode-workspace">');
const styleEnd = html.indexOf("</style>", styleStart);
assert.notEqual(styleStart, -1, "V19 workspace layout styles should exist.");
assert.notEqual(styleEnd, -1, "V19 workspace layout styles should close.");
const css = html.slice(styleStart, styleEnd);

for (const token of [
  "grid-template-columns:220px minmax(0,1fr) 340px",
  "#main.vibe-active #workspaceFiles",
  "#main.vibe-active #conversation",
  "#main.vibe-active #chatComposer",
  "#main.vibe-active #agentWorkbench",
  "grid-column:2",
  "grid-column:3",
  "@media(max-width:760px)",
  "mobile-preview .agent-preview{display:flex!important",
  "prefers-reduced-motion:reduce"
]) {
  assert.ok(css.includes(token), "Missing OpenCode-style workspace layout rule: " + token);
}

assert.ok(html.includes("AGENT SESSION"), "Workspace header should identify the active agent session.");
assert.ok(html.includes(">EXPLORER</span>"), "The left panel should be clearly identified as the file explorer.");
assert.ok(html.includes("Agent session</span>"), "The right panel should identify agent activity.");
assert.ok(html.includes('data-nexera-version="19.0.0"'), "The app should identify itself as v19.");
console.log("OpenCode-inspired workspace layout checks passed.");
