"use strict";

const fs = require("node:fs");
const path = require("node:path");

const WORKSPACE_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".txt", ".md", ".svg", ".xml", ".webmanifest"]);
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", ".idea"]);
const MAX_FILES = 100;
const MAX_FILE_BYTES = 400_000;
const MAX_TOTAL_BYTES = 700_000;
const MAX_DEPTH = 4;

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length > 400 || value.startsWith("/") || value.includes("\\\\")) return false;
  const parts = value.split("/");
  return parts.length >= 1 && parts.length <= 5 &&
    parts.every(part => /^[A-Za-z0-9._-]{1,80}$/.test(part) && part !== "." && part !== "..");
}

function isSupportedTextFile(name) {
  return isSafeRelativePath(name) && WORKSPACE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function readWorkspaceFiles(directory) {
  const root = fs.realpathSync(directory);
  if (!fs.statSync(root).isDirectory()) throw new Error("The selected workspace is not a folder.");
  const files = {};
  let totalBytes = 0;

  function walk(current, depth) {
    if (depth > MAX_DEPTH || Object.keys(files).length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (Object.keys(files).length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) walk(path.join(current, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(root, fullPath).split(path.sep).join("/");
      if (!isSupportedTextFile(relative)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_TOTAL_BYTES) continue;
      files[relative] = fs.readFileSync(fullPath, "utf8");
      totalBytes += stat.size;
    }
  }

  walk(root, 0);
  return files;
}

function writeWorkspaceFiles(directory, files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error("Invalid workspace file data.");
  const entries = Object.entries(files);
  if (!entries.length || entries.length > MAX_FILES) throw new Error("The workspace must contain between 1 and 100 files.");
  const root = fs.realpathSync(directory);
  if (!fs.statSync(root).isDirectory()) throw new Error("The selected workspace is not a folder.");
  let totalBytes = 0;

  const prepared = entries.map(([name, value]) => {
    if (!isSupportedTextFile(name)) throw new Error("Unsupported workspace file path or type: " + name);
    if (typeof value !== "string") throw new Error("Invalid content for " + name);
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes > MAX_FILE_BYTES) throw new Error("A workspace file is too large: " + name);
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("The workspace update is too large.");
    const target = path.resolve(root, ...name.split("/"));
    if (target === root || !target.startsWith(root + path.sep)) throw new Error("Invalid workspace path.");
    return { name, value, target, parent: path.dirname(target) };
  });

  // Validate every destination before changing any existing file.
  for (const item of prepared) {
    fs.mkdirSync(item.parent, { recursive: true });
    const realParent = fs.realpathSync(item.parent);
    if (realParent !== root && !realParent.startsWith(root + path.sep)) {
      throw new Error("Workspace path escapes the selected folder.");
    }
    if (fs.existsSync(item.target)) {
      const stat = fs.lstatSync(item.target);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error("Refusing to replace a non-file workspace entry: " + item.name);
      }
    }
  }

  for (const item of prepared) fs.writeFileSync(item.target, item.value, "utf8");
  return { count: prepared.length };
}

module.exports = { isSafeRelativePath, isSupportedTextFile, readWorkspaceFiles, writeWorkspaceFiles };
