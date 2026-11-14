"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const dom = new JSDOM(html);
const inline = [...dom.window.document.querySelectorAll("script")]
  .filter(script => !script.src && script.textContent.includes("(()=>{'use strict';"))
  .map(script => script.textContent);

assert.equal(inline.length, 1, "Nexera should have one application inline script");
const source = inline[0];

for (const required of [
  "function parseAgentResponse",
  "function normalizeAgentResponse",
  "function mergeProjectFiles(existing,incoming,deletedFiles=[])",
  "function validateProjectFiles",
  "function runPreviewDiagnostics",
  "The isolated project preview was checked at 360px, 768px and 1280px",
  "async function runVibeBuildPipeline",
  "async function send(",
  "Act as the planning stage of a software engineering agent",
  "Act as a strict software QA reviewer",
  "Repair only the concrete issues listed below",
  "attempt<=2",
  "cfg.orchestratorModel||cfg.model",
  "cfg.plannerModel||cfg.model",
  "onRouteAttempt:options.onRoute",
  "mergeProjectFiles(activeProject?.files,parsed?.files,parsed?.deletedFiles)",
  "The previous saved project will be preserved",
  "The isolated preview ran without reported runtime or basic accessibility errors",
  "Android preview keeps generated JavaScript disabled for safety",
  "platform()==='android'",
  "changedFiles",
  "model-agnostic software engineering agent",
  "I could not safely apply this update"
]) {
  assert.ok(source.includes(required), "Missing engineering pipeline behavior: " + required);
}

assert.ok(html.includes('class="agent-chat-update'), "Agent progress messages need dedicated chat styling");
assert.ok(html.includes('class="agent-chat-text'), "Agent progress messages need readable chat text");
assert.ok(!source.includes("addAgentProgress(agentProgressForStage(stage))"), "Stage transitions should not duplicate progress messages");

new vm.Script(source, { filename: "index.html:inline-script" });
console.log("Agent pipeline checks passed: model-agnostic planning, robust response parsing, build, QA, runtime preview checks, bounded repair, and safe project preservation.");
