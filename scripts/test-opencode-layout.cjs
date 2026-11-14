const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const styleStart = html.indexOf('<style id="nexera-v19-opencode-workspace">');
const styleEnd = html.indexOf("</style>", styleStart);
assert.notEqual(styleStart, -1, "V19 workspace layout styles should exist.");
assert.notEqual(styleEnd, -1, "V19 workspace layout styles should close.");
const css = html.slice(styleStart, styleEnd);
const refinedStart = html.indexOf('<style id="nexera-v19-2-refined-workspace">');
const refinedEnd = html.indexOf("</style>", refinedStart);
assert.notEqual(refinedStart, -1, "V19.2 responsive refinement styles should exist.");
assert.notEqual(refinedEnd, -1, "V19.2 responsive refinement styles should close.");
const refinedCss = html.slice(refinedStart, refinedEnd);
for (const token of [
  "grid-template-columns:minmax(205px,230px) minmax(0,1fr) minmax(285px,330px)",
  "min-height:43px",
  ".agent-plan",
  "max-width:none",
  "@media(max-width:900px)",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "safe-area-inset-bottom",
  "prefers-reduced-motion:reduce"
]) {
  assert.ok(refinedCss.includes(token), "Missing refined responsive layout rule: " + token);
}

for (const token of [
  "grid-template-columns:220px minmax(0,1fr) 340px",
  "#main.vibe-active #workspaceFiles",
  "#main.vibe-active #conversation",
  "#main.vibe-active #chatComposer",
  "#main.vibe-active #agentWorkbench",
  "grid-column:2",
  "grid-column:3",
  "@media(max-width:760px)",
  "nexera-v19-android-file-tabs",
  "@media(max-width:900px)",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "mobile-files #workspaceFiles",
  "display:flex!important;flex:1;min-height:0;width:100%;max-width:none",
  "mobile-preview .agent-preview{display:flex!important",
  "prefers-reduced-motion:reduce"
]) {
  assert.ok(css.includes(token), "Missing OpenCode-style workspace layout rule: " + token);
}

assert.ok(html.includes("AGENT SESSION"), "Workspace header should identify the active agent session.");
assert.ok(html.includes(">EXPLORER</span>"), "The left panel should be clearly identified as the file explorer.");
assert.ok(html.includes("Agent session</span>"), "The right panel should identify agent activity.");
assert.ok(html.includes("window.innerWidth<=900"), "Android/tablet widths should use tab navigation instead of the cramped desktop sidebar.");
assert.ok(html.includes('data-nexera-version="19.2.0"'), "The app should identify itself as v19.2.");
console.log("OpenCode-inspired workspace layout checks passed.");
