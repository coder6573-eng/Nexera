"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const dom = new JSDOM(html);
const document = dom.window.document;
const inline = [...document.querySelectorAll("script")]
  .filter(script => !script.src && script.textContent.includes("(()=>{'use strict';"))
  .map(script => script.textContent);

assert.equal(inline.length, 1, "Nexera should have one application inline script");
const source = inline[0];

for (const required of [
  "let agentUpdates=[]",
  "function addAgentChatUpdate",
  "function finishAgentChatUpdate",
  "function agentUpdate",
  "function setAgentStage",
  "function updateAgentRoute",
  "addAgentProgress('Okay, I’m working on it.",
  "agentUpdate('I’m planning the build now.",
  "agentUpdate('Building the website now",
  "agentUpdate('The first version is built.",
  "agentUpdate('Done. The files are saved",
  "changedFiles",
  "careful, iterative software engineering agent",
  "Preserve the existing architecture",
  "360px phone, 768px tablet, and 1280px desktop",
  "independent QA reviewer",
  "I could not safely apply this update",
  "projectIssues.length?projectIssues.join",
]) {
  assert.ok(source.includes(required), "Missing agent chat behavior: " + required);
}

assert.ok(html.includes('class="agent-chat-update'), "Agent progress messages need dedicated chat styling");
assert.ok(html.includes('class="agent-chat-text'), "Agent progress messages need readable chat text");
assert.ok(!source.includes("addAgentProgress(agentProgressForStage(stage))"), "Stage transitions should not duplicate progress messages");

new vm.Script(source, { filename: "index.html:inline-script" });

console.log("Agent chat tests passed: live progress messages, deduplicated stage updates, route-aware status, file-change messaging, and completion chat are wired.");
