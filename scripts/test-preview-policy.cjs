"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("index.html", "utf8");
const start = source.indexOf("function buildPreviewHtml(files,diagnosticId=''){");
const end = source.indexOf("\nasync function runPreviewDiagnostics", start);
assert.notEqual(start, -1, "The shared project preview builder should exist.");
assert.notEqual(end, -1, "The preview builder boundary should exist.");

const sandbox = {
  isAndroidNative: () => true,
  resolveProjectReference: reference => ({ path: String(reference).split(/[?#]/)[0] })
};
vm.runInNewContext(
  source.slice(start, end) + "\nthis.buildPreviewHtml = buildPreviewHtml;",
  sandbox,
  { filename: "nexera-preview-policy" }
);

const files = {
  "index.html": '<!doctype html><html><head><title>Android preview</title><link rel="stylesheet" href="style.css"></head><body><main>Ready</main><script src="script.js"></script></body></html>',
  "style.css": "main { color: green; }",
  "script.js": "window.previewWorks = true;"
};
const androidHtml = sandbox.buildPreviewHtml(files);
assert.ok(androidHtml.includes("default-src 'none'"), "Android preview must deny resources by default.");
assert.ok(androidHtml.includes("connect-src 'none'"), "Android preview must block outbound network connections.");
assert.ok(androidHtml.includes("form-action 'none'"), "Android preview must block form submissions.");
assert.ok(androidHtml.indexOf("Content-Security-Policy") < androidHtml.indexOf("<title>Android preview</title>"), "The policy must be installed before project markup.");
assert.ok(androidHtml.includes("main { color: green; }"), "Bundled project CSS must continue to work.");
assert.ok(androidHtml.includes("window.previewWorks = true;"), "Bundled project JavaScript must continue to run inline.");

sandbox.isAndroidNative = () => false;
const desktopHtml = sandbox.buildPreviewHtml(files);
assert.equal(desktopHtml.includes("Content-Security-Policy"), false, "The Android-only policy must not silently change desktop preview behavior.");

sandbox.isAndroidNative = () => true;
const headlessHtml = sandbox.buildPreviewHtml({ "index.html": "<html><body>body only</body></html>" });
assert.ok(headlessHtml.includes("<head><meta http-equiv=\"Content-Security-Policy\""), "Android previews without a head element should receive one.");

process.stdout.write("Preview policy tests passed: Android preview keeps inline app code working while blocking network, forms, and untrusted navigation resources.\n");
