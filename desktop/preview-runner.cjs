"use strict";

const VIEWPORTS = Object.freeze([360, 768, 1280]);
const MAX_HTML_BYTES = 2_000_000;
const LOAD_TIMEOUT_MS = 12_000;

function addRuntimeHarness(html) {
  const harness = `<script>
    (() => {
      const errors = window.__NEXERA_RUNTIME_ERRORS__ = [];
      const add = value => {
        const message = String(value || "").trim();
        if (message && !errors.includes(message) && errors.length < 30) errors.push(message.slice(0, 500));
      };
      window.addEventListener("error", event => add(event.message || event.error?.message || "Uncaught runtime error"));
      window.addEventListener("unhandledrejection", event => add(event.reason?.message || event.reason || "Unhandled promise rejection"));
    })();
  <\/script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, harness + "</head>");
  if (/<body\b[^>]*>/i.test(html)) return html.replace(/<body\\b[^>]*>/i, opening => opening + harness);
  return harness + html;
}

function inspectScript() {
  return `(() => {
    const root = document.documentElement;
    const body = document.body;
    const width = window.innerWidth || root.clientWidth || 0;
    const scrollWidth = Math.max(root.scrollWidth || 0, body?.scrollWidth || 0);
    const issues = [];
    if (width && scrollWidth > width + 2) {
      issues.push("Horizontal overflow: content is " + scrollWidth + "px wide in a " + width + "px preview");
    }
    document.querySelectorAll("button,[role=" + JSON.stringify("button") + "]").forEach((element, index) => {
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
    return {
      width,
      scrollWidth,
      readyState: document.readyState,
      title: document.title || "",
      issues,
      runtimeErrors: Array.isArray(window.__NEXERA_RUNTIME_ERRORS__) ? window.__NEXERA_RUNTIME_ERRORS__.slice(0, 30) : []
    };
  })()`;
}

function createPreviewRunner(BrowserWindow) {
  if (typeof BrowserWindow !== "function") throw new TypeError("BrowserWindow constructor is required.");

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
        devTools: false
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
      try { if (!preview.isDestroyed || !preview.isDestroyed()) preview.close(); } catch {}
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
      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(inspectedHtml);
      let loadTimer;
      try {
        await Promise.race([
          preview.loadURL(dataUrl),
          new Promise((_, reject) => {
            loadTimer = setTimeout(() => reject(new Error("The isolated browser preview timed out while loading.")), LOAD_TIMEOUT_MS);
          })
        ]);
      } finally {
        if (loadTimer) clearTimeout(loadTimer);
      }

      const reports = [];
      for (const width of VIEWPORTS) {
        preview.setContentSize(width, 820);
        const report = await contents.executeJavaScript(inspectScript(), true);
        if (report && typeof report === "object") {
          reports.push({ ...report, expectedWidth: width });
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
        await contents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))", true);
      }

      return {
        supported: true,
        issues: runtimeErrors.slice(0, 30),
        detail: "Generated code executed in an isolated Chromium window and was inspected at 360px, 768px and 1280px.",
        reports
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

module.exports = { VIEWPORTS, addRuntimeHarness, inspectScript, createPreviewRunner };
