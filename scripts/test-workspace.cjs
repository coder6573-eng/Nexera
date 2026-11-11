"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  isSafeRelativePath,
  isSupportedTextFile,
  readWorkspaceFiles,
  writeWorkspaceFiles
} = require("../desktop/workspace-files.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "nexera-workspace-test-"));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "nexera-outside-test-"));

try {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "ignored"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<html>start</html>");
  fs.writeFileSync(path.join(root, "style.css"), "body { color: green; }");
  fs.writeFileSync(path.join(root, "src", "app.js"), "window.app = true;");
  fs.writeFileSync(path.join(root, "node_modules", "ignored", "index.js"), "ignored");
  fs.writeFileSync(path.join(root, ".git", "config"), "ignored");
  fs.writeFileSync(path.join(root, "photo.png"), "binary placeholder");

  assert.equal(isSafeRelativePath("src/app.js"), true);
  assert.equal(isSafeRelativePath("../escape.js"), false);
  assert.equal(isSafeRelativePath("src/../../escape.js"), false);
  assert.equal(isSafeRelativePath("C:/escape.js"), false);
  assert.equal(isSafeRelativePath("src\\\\app.js"), false);
  assert.equal(isSupportedTextFile("src/app.js"), true);
  assert.equal(isSupportedTextFile("photo.png"), false);

  const loaded = readWorkspaceFiles(root);
  assert.equal(loaded["index.html"], "<html>start</html>");
  assert.equal(loaded["src/app.js"], "window.app = true;");
  assert.equal(loaded["node_modules/ignored/index.js"], undefined);
  assert.equal(loaded[".git/config"], undefined);
  assert.equal(loaded["photo.png"], undefined);

  const saved = writeWorkspaceFiles(root, {
    "index.html": "<html>updated</html>",
    "src/app.js": "window.app = false;",
    "src/new.js": "window.newFile = true;"
  });
  assert.equal(saved.count, 3);
  assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), "<html>updated</html>");
  assert.equal(fs.readFileSync(path.join(root, "src", "app.js"), "utf8"), "window.app = false;");
  assert.equal(fs.readFileSync(path.join(root, "src", "new.js"), "utf8"), "window.newFile = true;");

  assert.throws(() => writeWorkspaceFiles(root, {
    "index.html": "<html>must-not-change</html>",
    "../escape.js": "bad"
  }), /Unsupported workspace file path/);
  assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), "<html>updated</html>");
  assert.equal(fs.existsSync(path.join(path.dirname(root), "escape.js")), false);

  assert.throws(() => writeWorkspaceFiles(root, {
    "index.html": "<html></html>",
    "src/large.js": "x".repeat(400_001)
  }), /too large/);
  assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), "<html>updated</html>");

  let symlinkCreated = false;
  try {
    fs.symlinkSync(outside, path.join(root, "outside-link"), "junction");
    symlinkCreated = true;
  } catch {}
  if (symlinkCreated) {
    assert.equal(readWorkspaceFiles(root)["outside-link/secret.js"], undefined);
    assert.throws(() => writeWorkspaceFiles(root, { "outside-link/secret.js": "must-not-write" }), /escapes the selected folder/);
    assert.equal(fs.existsSync(path.join(outside, "secret.js")), false);
  }

  process.stdout.write("Workspace file tests passed: safe paths, bounded reads/writes, nested files, ignored directories, and symlink containment.\\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}
