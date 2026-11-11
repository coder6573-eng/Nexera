const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync("index.html", "utf8");
const iifeEnd = html.lastIndexOf("})();");
assert.notEqual(iifeEnd, -1, "App IIFE should have a closing marker.");
const instrumentedHtml = html.slice(0, iifeEnd) + "window.__testHooks = { buildPreviewHtml, updateAgentWorkbench, renderAssistantContent, addMessage, mergeProjectFiles, getActiveProject: () => activeProject }; " + html.slice(iifeEnd);
assert.notEqual(instrumentedHtml, html, "Test hooks should be injected into the app IIFE only for jsdom tests.");
const virtualConsole = new VirtualConsole();
const runtimeErrors = [];
virtualConsole.on("jsdomError", error => runtimeErrors.push(error));

const seed = [{
  id: "test-project",
  name: "Button Test Project",
  files: {
    "index.html": "<!doctype html><html><head><link rel='stylesheet' href='style.css'></head><body><h1>Test</h1><script src='script.js'></script></body></html>",
    "style.css": "body { color: #333; }",
    "script.js": "console.log('test');",
    "notes.txt": "Nexera workspace terminal works."
  },
  archived: false,
  updated: 1
}];

const dom = new JSDOM(instrumentedHtml, {
  url: "https://nexera.test/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.localStorage.setItem("nexera.projects.v1", JSON.stringify(seed));
  }
});

const { window } = dom;
const document = window.document;
const click = id => {
  const element = document.getElementById(id);
  assert.ok(element, "Missing #" + id);
  element.click();
  return element;
};
const change = id => {
  const element = document.getElementById(id);
  assert.ok(element, "Missing #" + id);
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
  return element;
};

try {
  const routeValues = [...document.getElementById("homeProvider").options].map(option => option.value);
  for (const route of ["kilo", "llmfaucet", "ovh", "llm7", "puter", "openrouter"]) {
    assert.ok(routeValues.includes(route), "Missing chat route: " + route);
  }
  document.getElementById("homeProvider").value = "ovh";
  change("homeProvider");
  assert.equal(document.getElementById("chatProvider").value, "ovh", "Provider selection should sync between composers");
  document.getElementById("homeProvider").value = "kilo";
  change("homeProvider");

  assert.equal(document.getElementById("home").style.display, "flex");

  click("menuBtn");
  assert.ok(document.getElementById("drawer").classList.contains("open"));
  click("closeDrawer");
  assert.ok(!document.getElementById("drawer").classList.contains("open"));

  click("settingsBtn");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  assert.equal(document.getElementById("provider").value, "kilo");
  assert.equal(document.getElementById("connectPuter").style.display, "none");
  assert.ok(document.getElementById("kiloInfo").textContent.includes("three Kilo free models"));
  assert.ok(html.includes("-webkit-tap-highlight-color:transparent"));
  assert.ok(html.includes("KILO_FREE_BACKUPS"));
  assert.ok(html.includes("renderAssistantContent"), "Assistant markdown renderer should be wired");
  assert.ok(html.includes("copy-message"), "Assistant copy action should be present");
  document.getElementById("provider").value = "openrouter";
  change("provider");
  assert.equal(document.getElementById("endpoint").value, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(document.getElementById("apiKeyWrap").style.display, "block");
  document.getElementById("provider").value = "puter";
  change("provider");
  assert.equal(document.getElementById("endpointWrap").style.display, "none");
  assert.equal(document.getElementById("apiKeyWrap").style.display, "none");
  click("cancelSettings");
  assert.ok(!document.getElementById("modalBackdrop").classList.contains("open"));

  const homeMode = document.getElementById("homeMode");
  homeMode.value = "vibe";
  change("homeMode");
  assert.notEqual(document.getElementById("homeAgentMode").style.display, "none");
  assert.notEqual(document.getElementById("homeSkill").style.display, "none");
  assert.equal(document.getElementById("homeWebSearch").style.display, "none");
  document.getElementById("homeAgentMode").value = "agent";
  change("homeAgentMode");
  assert.equal(document.getElementById("chatAgentMode").value, "agent");
  document.getElementById("homeSkill").value = "debug";
  change("homeSkill");
  assert.equal(document.getElementById("chatSkill").value, "debug");

  homeMode.value = "chat";
  change("homeMode");
  assert.notEqual(document.getElementById("homeWebSearch").style.display, "none");
  click("homeWebSearch");
  assert.ok(document.getElementById("homeWebSearch").classList.contains("active"));
  assert.ok(document.getElementById("chatWebSearch").classList.contains("active"));
  click("chatWebSearch");
  assert.ok(!document.getElementById("homeWebSearch").classList.contains("active"));

  click("menuBtn");
  click("newProject");
  assert.equal(document.getElementById("chatMode").value, "vibe");
  assert.equal(document.getElementById("chatComposer").style.display, "block");

  click("newChatBtn");
  assert.ok(document.getElementById("agentWorkbench").hidden, "Agent workbench should not remain visible in a normal chat");
  assert.equal(document.getElementById("homeMode").value, "chat");
  assert.equal(document.getElementById("home").style.display, "flex");

  click("menuBtn");
  const projectButton = document.querySelector("#projectList .open-project");
  assert.ok(projectButton, "Project list should contain the seeded project");
  projectButton.click();
  assert.equal(document.getElementById("projectView").style.display, "flex");
  const notesButton = [...document.querySelectorAll(".file-row")].find(button => button.textContent.includes("notes.txt"));
  assert.ok(notesButton, "Files tab should list workspace files");
  notesButton.click();
  assert.equal(document.querySelector(".file-editor").value, "Nexera workspace terminal works.");
  document.querySelector(".file-editor").value = "Updated from the editor.";
  document.querySelector(".file-editor").dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.ok(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].files["notes.txt"].includes("Updated"));

  document.querySelector('[data-tab="terminal"]').click();
  const terminalInput = document.getElementById("terminalInput");
  assert.ok(terminalInput, "Terminal tab should render its input");
  terminalInput.value = "ls";
  click("terminalRun");
  assert.ok(document.getElementById("terminalOutput").textContent.includes("notes.txt"));

  terminalInput.value = "cat notes.txt";
  click("terminalRun");
  assert.ok(document.getElementById("terminalOutput").textContent.includes("Updated from the editor."));

  terminalInput.value = "touch scratch.txt";
  click("terminalRun");
  assert.ok(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].files["scratch.txt"] !== undefined);

  terminalInput.value = "rm scratch.txt";
  click("terminalRun");
  assert.equal(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].files["scratch.txt"], undefined);

  terminalInput.value = "run";
  click("terminalRun");
  assert.ok(document.querySelector(".preview-frame"), "Run command should open the isolated preview tab");
  document.querySelector('[data-tab="files"]').click();
  const previewButton = [...document.querySelectorAll("#projectContent button")].find(button => button.textContent === "Preview project");
  assert.ok(previewButton, "Files tab should expose the preview action");
  previewButton.click();
  assert.ok(document.querySelector(".preview-frame"));

  document.querySelector('[data-tab="export"]').click();
  const exportButton = [...document.querySelectorAll("#projectContent button")].find(button => button.textContent.includes("Download project ZIP"));
  assert.ok(exportButton, "Export tab should show its export action");
  exportButton.click();

  click("backChat");
  assert.equal(document.getElementById("chatMode").value, "vibe");
  assert.equal(window.__testHooks.getActiveProject()?.id, "test-project", "Returning to chat must preserve the active project for iterative edits");
  click("openLivePreview");
  assert.equal(document.getElementById("projectView").style.display, "flex", "Browser preview action should open the project preview view");
  assert.ok(document.querySelector(".preview-frame"), "Browser preview action should show the live iframe");
  click("backChat");
  assert.equal(window.__testHooks.getActiveProject()?.id, "test-project", "Preview return should preserve the active project");

  click("menuBtn");
  const openAgain = document.querySelector("#projectList .open-project");
  openAgain.click();
  click("projectMore");
  assert.equal(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].archived, true);

  click("menuBtn");
  click("showArchives");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  const restoreButton = document.querySelector(".restore-btn");
  assert.ok(restoreButton, "Archived project should have a restore action");
  restoreButton.click();
  assert.equal(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].archived, false);
  assert.ok(!document.getElementById("modalBackdrop").classList.contains("open"));

  click("menuBtn");
  click("drawerSettings");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  click("cancelSettings");

  click("chatSettings");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  click("deleteKey");
  click("cancelSettings");

  click("menuBtn");
  click("scrim");
  assert.ok(!document.getElementById("drawer").classList.contains("open"));

  const homePrompt = document.getElementById("homePrompt");
  homePrompt.value = "Hello Nexera";
  click("homeSend");
  assert.equal(document.getElementById("conversation").style.display, "block");
  assert.ok(document.getElementById("conversation").textContent.includes("add an API key") || document.getElementById("conversation").textContent.includes("Kilo"));
  document.getElementById("chatPrompt").value = "Follow-up question";
  click("chatSend");
  assert.ok(document.getElementById("conversation").textContent.includes("Follow-up question"));

  // Preview assembly must inline linked workspace assets and keep script-closing text inert.
  const previewHtml = window.__testHooks.buildPreviewHtml({
    "index.html": "<!doctype html><html><head><link rel='stylesheet' href='style.css'></head><body><h1>Preview</h1><script src='script.js'></script></body></html>",
    "style.css": "body { color: rgb(1, 2, 3); }",
    "script.js": "window.previewLoaded = true; const sample = '</script>';",
    "extra.js": "window.extraLoaded = true;"
  });
  assert.ok(previewHtml.includes("<style>body { color: rgb(1, 2, 3); }</style>"), "Preview should inline CSS");
  assert.ok(previewHtml.includes("window.previewLoaded = true"), "Preview should inline linked JavaScript");
  assert.ok(previewHtml.includes("window.extraLoaded = true"), "Preview should include additional JS files");
  assert.ok(previewHtml.includes("<" + String.fromCharCode(92) + "/script>"), "Preview should escape script-closing text inside generated JavaScript");

  // Existing projects accept partial file updates while preserving untouched files.
  const partialEdit = window.__testHooks.mergeProjectFiles({
    "index.html": "<html><body>Existing</body></html>",
    "style.css": "body { color: black; }",
    "script.js": "window.keepThis = true;"
  }, { "style.css": "body { color: green; }" });
  assert.equal(partialEdit["style.css"], "body { color: green; }");
  assert.equal(partialEdit["script.js"], "window.keepThis = true;", "Untouched project files must survive iterative edits");
  assert.equal(window.__testHooks.mergeProjectFiles(null, { "style.css": "body{}" }), null, "New projects still require core files");
  const filteredEdit = window.__testHooks.mergeProjectFiles({ "index.html": "<html></html>" }, {
    "../escape.js": "bad",
    "script.js": "window.safe = true;"
  });
  assert.equal(filteredEdit["../escape.js"], undefined, "Project file paths must be constrained");
  assert.equal(filteredEdit["script.js"], "window.safe = true;");
  assert.equal(window.__testHooks.mergeProjectFiles({ "index.html": "<html></html>" }, { "oversized.js": "x".repeat(400001) }), null, "Oversized generated files must be rejected");

  // AI-generated file names are untrusted text and must never become executable HTML.
  const workbench = document.getElementById("agentWorkbench");
  workbench.hidden = false;
  window.__testHooks.updateAgentWorkbench(["<img src=x onerror=alert(1)>", "index.html"], 0, "building");
  assert.equal(document.querySelector("#agentSteps img"), null, "Agent file names must not be interpreted as HTML");
  assert.equal(document.querySelector("#agentSteps .agent-file").textContent, "<img src=x onerror=alert(1)>");
  workbench.hidden = true;

  // Assistant formatting should create semantic elements without parsing raw HTML.
  const formatted = document.createElement("div");
  window.__testHooks.renderAssistantContent(formatted, "## Heading\n- **bold** item\n- `code`\n\n<script>alert(1)</script>");
  assert.equal(formatted.querySelector("h3")?.textContent, "Heading");
  assert.equal(formatted.querySelectorAll("ul li").length, 2);
  assert.equal(formatted.querySelector("strong")?.textContent, "bold");
  assert.equal(formatted.querySelector("code")?.textContent, "code");
  assert.equal(formatted.querySelector("script"), null, "Assistant text must not execute embedded HTML");

  // Deferred assistant responses must copy the final text, not their initially empty placeholder.
  let copiedText = null;
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: value => { copiedText = value; return Promise.resolve(); } }
  });
  const deferredContent = window.__testHooks.addMessage("", "assistant");
  deferredContent.textContent = "Final generated response";
  document.querySelector("#conversation .message.assistant:last-child .copy-message").click();
  assert.equal(copiedText, "Final generated response", "Copy should use the final rendered assistant content");
  if (runtimeErrors.length) {
    throw new Error("Runtime errors: " + runtimeErrors.map(error => error.message).join("; "));
  }

  console.log("Nexera UI interaction tests passed.");
} finally {
  dom.window.close();
}
