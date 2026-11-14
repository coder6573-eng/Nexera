const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
function styleBlock(id, label) {
  const start = html.indexOf('<style id="' + id + '">');
  assert.notEqual(start, -1, label + " styles should exist.");
  const end = html.indexOf("</style>", start);
  assert.notEqual(end, -1, label + " styles should close.");
  return html.slice(start, end);
}

const workspace = styleBlock("nexera-v19-opencode-workspace", "V19 workspace");
const android = styleBlock("nexera-v19-android-file-tabs", "Android file tabs");
const refined = styleBlock("nexera-v19-2-refined-workspace", "V19.2 refinement");

for (const token of [
  "grid-template-columns:220px minmax(0,1fr) 340px",
  "#main.vibe-active #workspaceFiles",
  "#main.vibe-active #conversation",
  "#main.vibe-active #chatComposer",
  "#main.vibe-active #agentWorkbench",
  "grid-column:2",
  "grid-column:3",
  "@media(max-width:760px)"
]) {
  assert.ok(workspace.includes(token), "Missing workspace layout rule: " + token);
}

for (const token of [
  "@media(max-width:900px)",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "mobile-files #workspaceFiles",
  "display:flex!important;flex:1;min-height:0;width:100%;max-width:none",
  "mobile-preview .agent-preview{display:flex!important",
]) {
  assert.ok(android.includes(token), "Missing Android tab layout rule: " + token);
}

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
  assert.ok(refined.includes(token), "Missing refined responsive layout rule: " + token);
}

assert.ok(html.includes("AGENT SESSION"), "Workspace header should identify the active agent session.");
assert.ok(html.includes(">EXPLORER</span>"), "The left panel should be clearly identified as the file explorer.");
assert.ok(html.includes("Agent session</span>"), "The right panel should identify agent activity.");
assert.ok(html.includes("window.innerWidth<=900"), "Android/tablet widths should use tab navigation instead of the cramped desktop sidebar.");
assert.ok(html.includes('data-nexera-version="19.3.0"'), "The app should identify itself as v19.2.");
console.log("Responsive workspace checks passed: desktop columns, Android tabs, readable agent panel, and phone-safe layout.");
