"use strict";

const VIEWPORTS = Object.freeze([360, 768, 1280]);
const MAX_HTML_BYTES = 1_400_000;
const LOAD_TIMEOUT_MS = 12_000;
const EXECUTION_TIMEOUT_MS = 4_000;

function withTimeout(operation, milliseconds, message) {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

function addRuntimeHarness(html) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' data:; style-src \'unsafe-inline\' data:; img-src data: blob:; font-src data:; media-src data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; form-action \'none\'; base-uri \'none\'">';
  const harness = policy + [
    '<script>',
    '  (() => {',
    '    const errors = window.__NEXERA_RUNTIME_ERRORS__ = [];',
    '    const add = value => {',
    '      const message = String(value || "").trim();',
    '      if (message && !errors.includes(message) && errors.length < 30) errors.push(message.slice(0, 500));',
    '    };',
    '    window.addEventListener("error", event => add(event.message || event.error?.message || "Uncaught runtime error"));',
    '    window.addEventListener("unhandledrejection", event => add(event.reason?.message || event.reason || "Unhandled promise rejection"));',
    '    document.addEventListener("submit", event => event.preventDefault(), true);',
    '    document.addEventListener("click", event => { const link = event.target.closest?.("a[href]"); if (link) event.preventDefault(); }, true);',
    '    window.open = () => null;',
    '    window.alert = () => {};',
    '    window.confirm = () => false;',
    '    window.prompt = () => null;',
    '  })();',
    '</script>'
  ].join("\n");
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, opening => opening + harness);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, opening => opening + "<head>" + harness + "</head>");
  return "<head>" + harness + "</head>" + html;
}
function inspectScript(options = {}) {
  const probeInteractions = options.probeInteractions === true;
  return `(async () => {
    const root = document.documentElement;
    const body = document.body;
    const width = window.innerWidth || root.clientWidth || 0;
    const scrollWidth = Math.max(root.scrollWidth || 0, body?.scrollWidth || 0);
    const issues = [];
    if (width && scrollWidth > width + 2) {
      issues.push("Horizontal overflow: content is " + scrollWidth + "px wide in a " + width + "px preview");
    }
    document.querySelectorAll('button,[role="button"]').forEach((element, index) => {
      if (!String(element.innerText || element.textContent || "").trim() &&
          !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !element.getAttribute("title")) {
        issues.push("Control " + (index + 1) + " has no accessible name");
      }
    });
    document.querySelectorAll("input:not([type=hidden]),select,textarea").forEach((element, index) => {
      if (!(element.labels && element.labels.length) &&
          !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")) {
        issues.push("Form control " + (index + 1) + " has no accessible label");
      }
    });
    document.querySelectorAll("img").forEach((element, index) => {
      if (!element.hasAttribute("alt")) issues.push("Image " + (index + 1) + " is missing alternative text");
    });
    const interactionSmoke = { attempted: 0, changed: 0, noVisibleChange: 0, skipped: 0 };
    if (${probeInteractions}) {
      const controls = Array.from(document.querySelectorAll('button,[role="button"]'))
        .filter(element => !element.disabled && element.getClientRects().length > 0).slice(0, 12);
      for (const element of controls) {
        if (!element.isConnected || !element.getClientRects().length) { interactionSmoke.skipped++; continue; }
        let changed = false;
        const observer = new MutationObserver(() => { changed = true; });
        observer.observe(document.body || document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
        try {
          element.click();
          await new Promise(resolve => setTimeout(resolve, 45));
        } catch (error) {
          const errors = window.__NEXERA_RUNTIME_ERRORS__ = window.__NEXERA_RUNTIME_ERRORS__ || [];
          const message = "Interaction smoke test: " + (error?.message || "control click failed");
          if (!errors.includes(message) && errors.length < 30) errors.push(message);
        }
        observer.disconnect();
        interactionSmoke.attempted++;
        if (changed) interactionSmoke.changed++; else interactionSmoke.noVisibleChange++;
      }
    }
    return {
      width,
      scrollWidth,
      readyState: document.readyState,
      title: document.title || "",
      issues,
      interactionSmoke,
      runtimeErrors: Array.isArray(window.__NEXERA_RUNTIME_ERRORS__) ? window.__NEXERA_RUNTIME_ERRORS__.slice(0, 30) : []
    };
  })()`;
}
function createPreviewRunner(BrowserWindow, options = {}) {
  if (typeof BrowserWindow !== "function") throw new TypeError("BrowserWindow constructor is required.");
  const loadTimeoutMs = Number.isFinite(options.loadTimeoutMs) ? Math.max(1, options.loadTimeoutMs) : LOAD_TIMEOUT_MS;
  const executionTimeoutMs = Number.isFinite(options.executionTimeoutMs) ? Math.max(1, options.executionTimeoutMs) : EXECUTION_TIMEOUT_MS;

  return async function runPreviewDiagnostics(html) {
    if (typeof html !== "string" || !html.trim()) {
      return { supported: false, issues: [], detail: "No generated HTML was available for browser inspection." };
    }
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return { supported: false, issues: [], detail: "The generated preview is too large for the isolated browser inspector." };
    }

    const preview = new BrowserWindow({
      show: false,
      width: VIEWPORTS[0],
      height: 820,
      useContentSize: true,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        webviewTag: false,
        devTools: false,
        backgroundThrottling: false
      }
    });
    const contents = preview.webContents;
    const runtimeErrors = [];
    const record = message => {
      const value = String(message || "").trim();
      if (value && !runtimeErrors.includes(value) && runtimeErrors.length < 30) runtimeErrors.push(value.slice(0, 500));
    };
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { if (!preview.isDestroyed || !preview.isDestroyed()) { if (typeof preview.destroy === "function") preview.destroy(); else preview.close(); } } catch {}
    };

    try {
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      contents.on("will-navigate", event => event.preventDefault());
      contents.on("console-message", (_event, details) => {
        if (Number(details?.level) >= 3) record("Browser console: " + (details.message || "console error"));
      });
      contents.on("render-process-gone", (_event, details) => {
        record("Preview renderer stopped: " + (details?.reason || "unknown reason"));
      });

      const inspectedHtml = addRuntimeHarness(html);
      const dataUrl = "data:text/html;base64," + Buffer.from(inspectedHtml, "utf8").toString("base64");
      await withTimeout(
        () => preview.loadURL(dataUrl),
        loadTimeoutMs,
        "The isolated browser preview timed out while loading."
      );

      const reports = [];
      let interactionSmoke = { attempted: 0, changed: 0, noVisibleChange: 0, skipped: 0 };
      for (const width of VIEWPORTS) {
        preview.setContentSize(width, 820);
        await new Promise(resolve => setTimeout(resolve, 100));
        const report = await withTimeout(
          () => contents.executeJavaScript(inspectScript({ probeInteractions: width === VIEWPORTS[0] }), true),
          executionTimeoutMs,
          "The generated project blocked the browser inspector for too long."
        );
        if (report && typeof report === "object") {
          reports.push({ ...report, expectedWidth: width });
          if (width === VIEWPORTS[0] && report.interactionSmoke && typeof report.interactionSmoke === "object") {
            interactionSmoke = report.interactionSmoke;
          }
          if (Number(report.width) !== width) record("Expected a " + width + "px viewport but Chromium reported " + report.width + "px");
          for (const issue of Array.isArray(report.issues) ? report.issues : []) {
            record(width + "px preview: " + issue);
          }
          for (const issue of Array.isArray(report.runtimeErrors) ? report.runtimeErrors : []) {
            record(issue);
          }
          if (report.readyState !== "complete") record(width + "px preview: document did not reach the complete state");
        } else {
          record(width + "px preview: the browser inspector returned an invalid result");
        }
        await withTimeout(
          () => contents.executeJavaScript("new Promise(resolve => setTimeout(resolve, 120))", true),
          executionTimeoutMs,
          "The generated project blocked the browser event loop during inspection."
        );
      }

      return {
        supported: true,
        issues: runtimeErrors.slice(0, 30),
        detail: "Generated code executed in isolated Chromium at 360px, 768px and 1280px. A click smoke test exercised " + interactionSmoke.attempted + " visible controls; this detects crashes and visible DOM responses, not semantic correctness.",
        reports,
        interactionSmoke
      };
    } catch (error) {
      return {
        supported: false,
        issues: [],
        detail: "The isolated Chromium inspection could not be completed: " + (error?.message || "unknown error")
      };
    } finally {
      close();
    }
  };
}

module.exports = { VIEWPORTS, addRuntimeHarness, inspectScript, withTimeout, createPreviewRunner };
