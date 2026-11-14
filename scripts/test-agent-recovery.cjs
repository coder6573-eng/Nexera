"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const helperStart = html.indexOf("function isSafeProjectPath(name){");
const helperEnd = html.indexOf("\nfunction renderChangeSummary", helperStart);
const pipelineStart = html.indexOf("async function runVibeBuildPipeline(options){");
const pipelineEnd = html.indexOf("\nasync function send(", pipelineStart);

assert.notEqual(helperStart, -1, "Project safety helpers should exist.");
assert.notEqual(helperEnd, -1, "Project safety helper boundary should exist.");
assert.notEqual(pipelineStart, -1, "The engineering pipeline should exist.");
assert.notEqual(pipelineEnd, -1, "The engineering pipeline boundary should exist.");

const sandbox = { localFolderLinked: false, VIBE_SYSTEM: "test system", SKILL_GUIDES: { frontend: "frontend" } };
vm.createContext(sandbox);
vm.runInContext(
  html.slice(helperStart, helperEnd) +
  "\nthis.agentHelpers={normalizeAgentResponse,mergeProjectFiles,validateProjectFiles};",
  sandbox,
  { filename: "agent-project-helpers" }
);
vm.runInContext(
  html.slice(pipelineStart, pipelineEnd) + "\nthis.runVibeBuildPipeline=runVibeBuildPipeline;",
  sandbox,
  { filename: "agent-build-pipeline" }
);

const validFiles = {
  "index.html": '<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="style.css"></head><body><main>Ready</main><script src="script.js"></script></body></html>',
  "style.css": "main { color: green; }",
  "script.js": "window.ready = true;"
};
const validResponse = JSON.stringify({ kind: "project", name: "Recovery test", summary: "Recovered successfully", files: validFiles });
const noPreview = async () => ({ supported: false, issues: [], detail: "Preview unavailable in the test environment." });

async function runPipeline(nativeCall, options = {}, validate = sandbox.agentHelpers.validateProjectFiles) {
  sandbox.nativeCall = nativeCall;
  sandbox.validateProjectFiles = validate;
  sandbox.runPreviewDiagnostics = noPreview;
  const stages = [];
  const result = await sandbox.runVibeBuildPipeline({
    request: "Create a small responsive project",
    cfg: { provider: "mock", endpoint: "", model: "mock-model", plannerModel: "planner-model", orchestratorModel: "builder-model" },
    onStage: stage => stages.push(stage),
    ...options
  });
  return { result, stages };
}

async function testMalformedResponseRecovery() {
  let calls = 0;
  const { result, stages } = await runPipeline(async () => (++calls === 1 ? "not valid JSON" : "```json\n" + validResponse + "\n```"));
  assert.equal(calls, 2, "The model should receive exactly one bounded recovery request.");
  assert.equal(result.response.kind, "project");
  assert.equal(result.response.name, "Recovery test");
  assert.ok(stages.includes("Recovering"), "The recovery stage should be visible.");
}

async function testRecoveryFailurePreservesExistingProject() {
  let calls = 0;
  const existing = { ...validFiles };
  const snapshot = JSON.stringify(existing);
  const { result } = await runPipeline(async () => { calls++; return "still malformed"; }, { existingFiles: existing });
  assert.equal(calls, 2, "Recovery must stop after one retry.");
  assert.equal(result.response.kind, "error");
  assert.equal(JSON.stringify(existing), snapshot, "Failed recovery must not mutate existing files.");
  assert.match(result.reviewDetail, /preserved|failed/i);
}

async function testPlannerBuildReviewerLifecycle() {
  let calls = 0;
  const { result, stages } = await runPipeline(async () => {
    calls++;
    if (calls === 1) return "Plan: build a responsive page and verify its controls.";
    if (calls === 2) return validResponse;
    return JSON.stringify({ kind: "project", name: "Review", files: {} });
  }, { agentMode: true });
  assert.equal(calls, 3, "Agent mode should call planner, builder and independent reviewer.");
  assert.equal(result.response.kind, "project");
  assert.deepEqual(stages, ["Planning", "Building", "Reviewing"]);
}

async function testBoundedRepairPass() {
  let calls = 0;
  let validations = 0;
  const validate = () => (++validations === 1 ? ["script.js: test issue"] : []);
  const { result, stages } = await runPipeline(async () => {
    calls++;
    return calls === 1 ? validResponse : JSON.stringify({ kind: "project", name: "Repair", files: { "script.js": "window.repaired = true;" } });
  }, {}, validate);
  assert.equal(calls, 2, "One targeted repair request should resolve the test issue.");
  assert.equal(result.response.kind, "project");
  assert.ok(stages.includes("Repairing"), "The repair stage should be visible.");
}

(async () => {
  await testMalformedResponseRecovery();
  await testRecoveryFailurePreservesExistingProject();
  await testPlannerBuildReviewerLifecycle();
  await testBoundedRepairPass();
  process.stdout.write("Agent recovery tests passed: malformed-output retry, safe preservation, planner/build/reviewer lifecycle, and bounded repair.\n");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
