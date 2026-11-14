"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const start = html.indexOf("function parseAgentResponse(raw){");
const end = html.indexOf("\nfunction renderChangeSummary", start);
assert.notEqual(start, -1, "Agent response helpers should exist.");
assert.notEqual(end, -1, "Agent quality helpers should end before change summary.");

const source = html.slice(start, end) + "\nthis.parseAgentResponse=parseAgentResponse;this.normalizeAgentResponse=normalizeAgentResponse;this.mergeProjectFiles=mergeProjectFiles;this.resolveProjectReference=resolveProjectReference;this.validateProjectFiles=validateProjectFiles;";
const sandbox = { isSafeProjectPath: name => typeof name === "string" && !name.includes("\\") && name.split("/").length <= 5 && name.split("/").every(part => /^[A-Za-z0-9._-]{1,80}$/.test(part) && part !== "." && part !== "..") };
vm.runInNewContext(source, sandbox, { filename: "agent-quality-helpers" });

const valid = {
  "index.html": '<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="./style.css"></head><body><main>Ready</main><script src="script.js"></script></body></html>',
  "style.css": "main { display: grid; }",
  "script.js": "document.querySelector('main');"
};
assert.deepEqual(Array.from(sandbox.validateProjectFiles(valid)), [], "A complete project with local files should pass static checks.");

const missingAsset = { ...valid };
delete missingAsset["style.css"];
assert.ok(Array.from(sandbox.validateProjectFiles(missingAsset)).some(issue => issue.includes("missing local asset: ./style.css")),
  "Missing local stylesheets should be rejected.");

const unsafeAsset = {
  ...valid,
  "index.html": valid["index.html"].replace("./style.css", "../style.css")
};
assert.ok(Array.from(sandbox.validateProjectFiles(unsafeAsset)).some(issue => issue.includes("missing local asset: ../style.css")),
  "Path traversal references should be rejected.");

const unsafeScript = { ...valid, "script.js": "const payload = '</script>';" };
assert.ok(Array.from(sandbox.validateProjectFiles(unsafeScript)).some(issue => issue.includes("raw </script>")),
  "Raw script-closing sequences should be rejected before preview.");

const missingCssAsset = { ...valid, "style.css": "main { background: url('./images/missing.svg'); }" };
assert.ok(Array.from(sandbox.validateProjectFiles(missingCssAsset)).some(issue => issue.includes("missing local asset")),
  "Missing CSS url() assets should be rejected.");

const incomplete = {
  "index.html": "<html><body>Missing viewport and doctype</body></html>"
};
assert.ok(Array.from(sandbox.validateProjectFiles(incomplete)).some(issue => issue.includes("DOCTYPE")),
  "Incomplete documents should be rejected.");

const wrapped = 'The result is ready:\n```json\n{"kind":"project","files":{"index.html":"<html>brace } in a string</html>"}}\n```';
const parsed = sandbox.parseAgentResponse(wrapped);
assert.equal(parsed.kind, "project", "JSON inside a markdown fence should be recovered.");
assert.ok(parsed.files["index.html"].includes("brace } in a string"), "Balanced braces inside strings should not break parsing.");
assert.equal(sandbox.parseAgentResponse("<think>private working</think> {broken"), null, "Malformed output should not be accepted.");
assert.equal(sandbox.normalizeAgentResponse('{"files":{"index.html":"ok"}}').kind, "project", "Compatible project responses without an explicit kind should normalize.");

const updated = sandbox.mergeProjectFiles(valid, { "script.js": "window.ready = true;" });
assert.equal(updated["style.css"], valid["style.css"], "Partial updates must preserve untouched files.");
assert.equal(updated["script.js"], "window.ready = true;");
const deleted = sandbox.mergeProjectFiles(valid, {}, ["notes.txt"]);
assert.ok(deleted, "A safe optional file deletion should apply.");
assert.equal(sandbox.mergeProjectFiles(valid, {}, ["index.html"]), null, "Core files must not be deletable.");
assert.equal(sandbox.mergeProjectFiles(valid, { "../outside.js": "bad" }), null, "Unsafe file paths must be rejected.");

assert.deepEqual(sandbox.resolveProjectReference("../shared.css", "pages/index.html"), { external: false, unsafe: false, path: "shared.css" });
assert.equal(sandbox.resolveProjectReference("../../outside.css", "index.html").unsafe, true);

process.stdout.write("Agent quality tests passed: tolerant parsing, safe partial updates, bounded deletion, nested assets, JavaScript syntax, and HTML validation.\\n");
