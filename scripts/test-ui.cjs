const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync("index.html", "utf8");
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

const dom = new JSDOM(html, {
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
  assert.equal(document.getElementById("home").style.display, "flex");

  click("menuBtn");
  assert.ok(document.getElementById("drawer").classList.contains("open"));
  click("closeDrawer");
  assert.ok(!document.getElementById("drawer").classList.contains("open"));

  click("settingsBtn");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  click("cancelSettings");
  assert.ok(!document.getElementById("modalBackdrop").classList.contains("open"));

  const homeMode = document.getElementById("homeMode");
  homeMode.value = "vibe";
  change("homeMode");
  assert.notEqual(document.getElementById("homeAgentMode").style.display, "none");
  assert.notEqual(document.getElementById("homeSkill").style.display, "none");
  assert.equal(document.getElementById("homeWebSearch").style.display, "none");

  homeMode.value = "chat";
  change("homeMode");
  assert.notEqual(document.getElementById("homeWebSearch").style.display, "none");
  click("homeWebSearch");
  assert.ok(document.getElementById("homeWebSearch").classList.contains("active"));
  click("homeWebSearch");
  assert.ok(!document.getElementById("homeWebSearch").classList.contains("active"));

  click("menuBtn");
  click("newProject");
  assert.equal(document.getElementById("chatMode").value, "vibe");
  assert.equal(document.getElementById("chatComposer").style.display, "block");

  click("newChatBtn");
  assert.equal(document.getElementById("homeMode").value, "chat");
  assert.equal(document.getElementById("home").style.display, "flex");

  click("menuBtn");
  const projectButton = document.querySelector("#projectList .open-project");
  assert.ok(projectButton, "Project list should contain the seeded project");
  projectButton.click();
  assert.equal(document.getElementById("projectView").style.display, "flex");

  document.querySelector('[data-tab="terminal"]').click();
  const terminalInput = document.getElementById("terminalInput");
  assert.ok(terminalInput, "Terminal tab should render its input");
  terminalInput.value = "ls";
  click("terminalRun");
  assert.ok(document.getElementById("terminalOutput").textContent.includes("notes.txt"));

  terminalInput.value = "cat notes.txt";
  click("terminalRun");
  assert.ok(document.getElementById("terminalOutput").textContent.includes("Nexera workspace terminal works."));

  terminalInput.value = "touch scratch.txt";
  click("terminalRun");
  assert.ok(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].files["scratch.txt"] !== undefined);

  terminalInput.value = "rm scratch.txt";
  click("terminalRun");
  assert.equal(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].files["scratch.txt"], undefined);

  terminalInput.value = "run";
  click("terminalRun");
  assert.ok(document.querySelector(".preview-frame"), "Run command should open the isolated preview tab");

  document.querySelector('[data-tab="export"]').click();
  const exportButton = [...document.querySelectorAll("#projectContent button")].find(button => button.textContent.includes("Download project ZIP"));
  assert.ok(exportButton, "Export tab should show its export action");
  exportButton.click();

  click("backChat");
  assert.equal(document.getElementById("chatMode").value, "vibe");

  click("menuBtn");
  const openAgain = document.querySelector("#projectList .open-project");
  openAgain.click();
  click("projectMore");
  assert.equal(JSON.parse(window.localStorage.getItem("nexera.projects.v1"))[0].archived, true);

  click("menuBtn");
  click("showArchives");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  click("modalClose");
  assert.ok(!document.getElementById("modalBackdrop").classList.contains("open"));

  click("menuBtn");
  click("drawerSettings");
  assert.ok(document.getElementById("modalBackdrop").classList.contains("open"));
  click("cancelSettings");

  const homePrompt = document.getElementById("homePrompt");
  homePrompt.value = "Hello Nexera";
  click("homeSend");
  assert.equal(document.getElementById("conversation").style.display, "block");
  assert.ok(document.getElementById("conversation").textContent.includes("add an API key"));

  if (runtimeErrors.length) {
    throw new Error("Runtime errors: " + runtimeErrors.map(error => error.message).join("; "));
  }

  console.log("Nexera UI interaction tests passed.");
} finally {
  dom.window.close();
}
