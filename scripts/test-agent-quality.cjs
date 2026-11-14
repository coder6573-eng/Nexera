"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const start = html.indexOf("function validateProjectFiles(files){");
const end = html.indexOf("\nfunction renderChangeSummary", start);
assert.notEqual(start, -1, "Static project validator should exist.");
assert.notEqual(end, -1, "Static project validator should end before change summary.");

const source = html.slice(start, end) + "\nthis.validateProjectFiles = validateProjectFiles;";
const sandbox = {};
vm.runInNewContext(source, sandbox, { filename: "validateProjectFiles" });

const valid = {
  "index.html": '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"><script src="script.js"></script></head><body><main>Ready</main></body></html>',
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

const incomplete = {
  "index.html": "<html><body>Missing viewport and doctype</body></html>"
};
assert.ok(Array.from(sandbox.validateProjectFiles(incomplete)).some(issue => issue.includes("DOCTYPE")),
  "Incomplete documents should be rejected.");

process.stdout.write("Agent quality tests passed: valid project acceptance, missing assets, unsafe paths, and incomplete HTML rejection.\\n");
