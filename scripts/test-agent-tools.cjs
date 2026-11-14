"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const start = html.indexOf("async function executeAgentTool(");
const end = html.indexOf("\nfunction parseAgentResponse", start);
assert.notEqual(start, -1, "The model-independent host tool runtime should exist.");
assert.notEqual(end, -1, "The host tool runtime should end before response parsing.");

const sandbox = {
  isSafeProjectPath: name => typeof name === "string" && !name.includes("\\") &&
    name.split("/").length <= 5 &&
    name.split("/").every(part => /^[A-Za-z0-9._-]{1,80}$/.test(part) && part !== "." && part !== ".."),
  validateProjectFiles: files => Object.keys(files).length ? [] : ["Project is empty."],
  runPreviewDiagnostics: async files => ({
    supported: true,
    issues: [],
    detail: "Preview inspected.",
    interactionSmoke: { attempted: 2, changed: 2, noVisibleChange: 0, skipped: 0 },
    reports: [{ expectedWidth: 360, layoutSummary: [{ tag: "main", text: "Ready" }], issues: [], runtimeErrors: [] }]
  })
};
vm.runInNewContext(
  html.slice(start, end) + "\nthis.executeAgentTool = executeAgentTool;",
  sandbox,
  { filename: "nexera-agent-tools" }
);

const files = {
  "index.html": "<!doctype html><html><body><main>Ready</main></body></html>",
  "style.css": "main { color: green; }"
};

(async () => {
  const listed = await sandbox.executeAgentTool("workspace.list_files", {}, { files });
  assert.equal(listed.ok, true);
  assert.deepEqual(Array.from(listed.files, file => file.path), ["index.html", "style.css"]);
  assert.ok(listed.files.every(file => Number.isInteger(file.characters)));

  const read = await sandbox.executeAgentTool("workspace.read_file", { path: "index.html" }, { files });
  assert.equal(read.ok, true);
  assert.equal(read.content, files["index.html"]);
  assert.equal(read.truncated, false);

  const truncated = await sandbox.executeAgentTool("workspace.read_file", { path: "style.css" }, {
    files: { "style.css": "x".repeat(15000) }
  });
  assert.equal(truncated.ok, true);
  assert.equal(truncated.content.length, 12000);
  assert.equal(truncated.truncated, true);

  const traversal = await sandbox.executeAgentTool("workspace.read_file", { path: "../secret.txt" }, { files });
  assert.equal(traversal.ok, false);
  assert.match(traversal.error, /safe relative path/i);

  const missing = await sandbox.executeAgentTool("workspace.read_file", { path: "missing.js" }, { files });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/i);

  const searched = await sandbox.executeAgentTool("workspace.search_files", { query: "ready" }, { files });
  assert.equal(searched.ok, true);
  assert.ok(searched.matches.some(match => match.path === "index.html" && match.line === 1));
  const invalidSearch = await sandbox.executeAgentTool("workspace.search_files", { query: " " }, { files });
  assert.equal(invalidSearch.ok, false);

  const validation = await sandbox.executeAgentTool("workspace.validate", {}, { files });
  assert.deepEqual(Array.from(validation.issues), []);

  const inspection = await sandbox.executeAgentTool("browser.inspect", {}, { files, runPreviewDiagnostics: sandbox.runPreviewDiagnostics });
  assert.equal(inspection.ok, true);
  assert.equal(inspection.interactionSmoke.attempted, 2);
  assert.equal(inspection.reports[0].layoutSummary[0].tag, "main", "Browser tool results should include compact measured layout evidence.");

  const noProject = await sandbox.executeAgentTool("browser.inspect", {}, { files: {} });
  assert.equal(noProject.ok, false);
  assert.match(noProject.error, /index\.html/i);

  const unknown = await sandbox.executeAgentTool("host.exec", { command: "whoami" }, { files });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /not available/i);

  const invalidArgs = await sandbox.executeAgentTool("workspace.list_files", [], { files });
  assert.equal(invalidArgs.ok, false);
  process.stdout.write("Agent tool tests passed: allowlisted read-only workspace and browser tools, bounded file reads, safe paths, and unknown-tool rejection.\n");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
