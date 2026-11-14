"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { VIEWPORTS, addRuntimeHarness, createPreviewRunner } = require("../desktop/preview-runner.cjs");

class FakeWebContents extends EventEmitter {
  constructor(owner) {
    super();
    this.owner = owner;
    this.handlers = {};
    this.scripts = [];
  }
  setWindowOpenHandler(handler) { this.handlers.open = handler; }
  async executeJavaScript(source) {
    this.scripts.push(source);
    if (source.includes("document.documentElement") && FakeBrowserWindow.nextScenario.hangInspection) return new Promise(() => {});
    if (source.includes("document.documentElement")) {
      return {
        width: this.owner.width,
        scrollWidth: this.owner.width,
        readyState: "complete",
        title: "Fixture",
        issues: FakeBrowserWindow.nextScenario.issues || [],
        runtimeErrors: this.owner.runtimeErrors
      };
    }
    return true;
  }
}

class FakeBrowserWindow extends EventEmitter {
  static instances = [];
  static nextScenario = {};
  constructor(options) {
    super();
    this.options = options;
    this.width = options.width;
    this.runtimeErrors = FakeBrowserWindow.nextScenario.runtimeErrors || [];
    this.webContents = new FakeWebContents(this);
    this.closed = false;
    FakeBrowserWindow.instances.push(this);
  }
  async loadURL(url) {
    this.url = url;
    if (FakeBrowserWindow.nextScenario.failLoad) throw new Error("fixture load failure");
    if (FakeBrowserWindow.nextScenario.consoleError) {
      this.webContents.emit("console-message", {}, { level: 3, message: FakeBrowserWindow.nextScenario.consoleError });
    }
  }
  setContentSize(width) { this.width = width; }
  isDestroyed() { return false; }
  close() { this.closed = true; }
  destroy() { this.closed = true; }
}

async function main() {
  assert.deepEqual(VIEWPORTS, [360, 768, 1280]);
  const source = "<!doctype html><html><head><title>Fixture</title></head><body><main>hello</main></body></html>";
  const instrumented = addRuntimeHarness(source);
  assert.ok(instrumented.includes("__NEXERA_RUNTIME_ERRORS__"));
  assert.ok(instrumented.indexOf("__NEXERA_RUNTIME_ERRORS__") < instrumented.indexOf("<title>Fixture</title>"));

  FakeBrowserWindow.instances = [];
  FakeBrowserWindow.nextScenario = {};
  const inspect = createPreviewRunner(FakeBrowserWindow);
  const result = await inspect(source);
  assert.equal(result.supported, true);
  assert.deepEqual(result.reports.map(report => report.expectedWidth), [360, 768, 1280]);
  assert.equal(result.issues.length, 0);
  const first = FakeBrowserWindow.instances.at(-1);
  assert.equal(first.closed, true, "The hidden browser window must always be closed.");
  assert.equal(first.options.show, false);
  assert.equal(first.options.webPreferences.nodeIntegration, false);
  assert.equal(first.options.webPreferences.contextIsolation, true);
  assert.equal(first.options.webPreferences.sandbox, true);
  assert.equal(first.options.webPreferences.webSecurity, true);
  assert.equal(first.options.webPreferences.backgroundThrottling, false);
  assert.equal(first.webContents.handlers.open().action, "deny");
  assert.ok(first.url.startsWith("data:text/html;base64,"));
  assert.ok(Buffer.from(first.url.slice("data:text/html;base64,".length), "base64").toString("utf8").includes("__NEXERA_RUNTIME_ERRORS__"));

  FakeBrowserWindow.nextScenario = { consoleError: "Uncaught ReferenceError: missingThing is not defined" };
  const failedRuntime = await inspect(source);
  assert.ok(failedRuntime.issues.some(issue => issue.includes("Uncaught ReferenceError")));
  assert.equal(FakeBrowserWindow.instances.at(-1).closed, true);

  FakeBrowserWindow.nextScenario = { runtimeErrors: ["Unhandled promise rejection: fixture"] };
  const rejected = await inspect(source);
  assert.ok(rejected.issues.includes("Unhandled promise rejection: fixture"));

  FakeBrowserWindow.nextScenario = { issues: ["Horizontal overflow: content is 400px wide in a 360px preview", "Image 1 is missing alternative text"] };
  const layoutIssues = await inspect(source);
  assert.ok(layoutIssues.issues.some(issue => issue.includes("360px preview: Horizontal overflow")));
  assert.ok(layoutIssues.issues.some(issue => issue.includes("Image 1 is missing alternative text")));

  FakeBrowserWindow.nextScenario = { failLoad: true };
  const loadFailure = await inspect(source);
  assert.equal(loadFailure.supported, false);
  assert.ok(loadFailure.detail.includes("fixture load failure"));
  assert.equal(FakeBrowserWindow.instances.at(-1).closed, true);

  FakeBrowserWindow.nextScenario = { hangInspection: true };
  const fastInspect = createPreviewRunner(FakeBrowserWindow, { executionTimeoutMs: 15 });
  const hung = await fastInspect(source);
  assert.equal(hung.supported, false);
  assert.ok(hung.detail.includes("blocked the browser inspector"));
  assert.equal(FakeBrowserWindow.instances.at(-1).closed, true, "A stuck generated page must be forcibly destroyed.");

  const beforeInvalid = FakeBrowserWindow.instances.length;
  const invalid = await inspect(" ");
  assert.equal(invalid.supported, false);
  assert.equal(FakeBrowserWindow.instances.length, beforeInvalid);
  const oversized = await inspect("x".repeat(1_400_001));
  assert.equal(oversized.supported, false);
  assert.equal(FakeBrowserWindow.instances.length, beforeInvalid, "Oversized previews must be rejected before creating a browser window.");

  process.stdout.write("Preview runner tests passed: isolated Chromium configuration, three viewport inspections, runtime error capture, cleanup, and failure handling.\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
