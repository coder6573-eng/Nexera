# Nexera AI v19.5.0

Nexera is a light, mobile-first AI workspace with two separate experiences:

- **Normal Chat** — general AI chat, optional web search, and simple data visualizations.
- **Vibecoding** — plan and build browser projects, edit files, preview them, and export the workspace.

The same interface is packaged as an Android app (WebView) and a Windows portable desktop app (Electron).

## AI routes

**Free Auto** is the default. It tries 16 no-key candidates across four gateways and only advances after retryable errors, rate limits, timeouts, or unavailable models. It never silently switches to a paid route.

| Gateway | Candidate routes | Access and limits |
| --- | ---: | --- |
| Kilo Gateway | 10 | Anonymous free-model access; Kilo documents 200 requests/hour/IP. The Auto Free pool changes over time. |
| LLMFaucet | 4 | Anonymous selectors: `auto:coding`, `auto:smart`, `auto:fast`, and `auto`. Anonymous use is limited to 20 requests/day. |
| LLM7 | 1 | Anonymous free OpenAI-compatible route; capacity and model availability can change. |
| UncloseAI Hermes | 1 | Public no-key endpoint; currently serves Qwen3.8-27B and is rate-limited per IP. |

The Kilo fallback IDs are a snapshot of the free catalogue and may change. The dynamic Kilo Auto Free route is always attempted first. The stable `kilo-auto/free` route is tried first. Sources: [Kilo Gateway model documentation](https://kilo.ai/docs/gateway/models-and-providers), [LLMFaucet API and limits](https://github.com/llmfaucet/llmfaucet), [UncloseAI inference details](https://www.uncloseai.com/inference.html).

Other selectable routes include OVH (experimental/manual), Puter (your own account and User-Pays allowance), OpenRouter Free (requires your API key), DeepSeek, GLM, Qwen. Those routes are not part of Free Auto. Some free account tiers require an API key; they are not anonymous routes.

API keys are not stored in browser localStorage. Android uses Android Keystore-backed encryption; Windows uses Electron safeStorage. Free gateways have their own data policies and may log prompts or use them to improve services. Do not send private or confidential information to public free routes.

## Vibecoding

- **Replit-inspired workspace** — desktop shows the project file list, live preview, and AI chat together. On mobile, Chat, Preview, and Files become switchable panels.
- **Iterative editing** — ask for changes in the same conversation. The current project files are supplied as context and partial file updates preserve untouched files.
- **Model-agnostic engineering pipeline** — Agent mode creates a visible plan, builds with the selected provider, runs a separate QA pass, performs deterministic structure/asset checks, and executes the generated project in an isolated Electron Chromium window at 360px, 768px, and 1280px. The browser inspector captures JavaScript runtime errors, unhandled promise rejections, console errors, horizontal overflow, missing accessible names/labels, and missing image alt text. The same inspection is host-driven and works with any configured OpenAI-compatible chat model; model quality can still affect the generated implementation. It can run up to two targeted repair passes before applying the result. Build mode skips planning and the separate QA call but still runs available checks and repairs. Because the model only needs to produce the shared JSON project contract, the host's tool capabilities are available even when a model has no native function-calling support; output quality still varies by model.
- **Live preview** — the sandboxed preview refreshes after a completed build or edit. Keep chatting to refine the page.
- **Visible progress** — stages, route attempts, elapsed time, and the current waiting state are shown instead of leaving a blank spinner. Actual model names are shown only when returned by provider metadata.
- **Background behavior** — Windows model requests run in the Electron main process and continue while the window is minimized. Android requests use a native worker thread and can continue while the app process remains alive; Android may stop work if it kills the app, so this is not a guarantee of surviving force-stop or process death.
- **Workspace** — project files, editor, preview, restricted terminal, ZIP export, and linked local folder support remain available. The terminal is currently a restricted workspace command panel (`ls`, `cat`, `touch`, `grep`, `wc`, and related file commands); it is not a general operating-system shell or an npm/build runner. Windows browser diagnostics execute generated project code in a separate hidden Chromium window with Node integration disabled, context isolation, sandboxing, and navigation/pop-up restrictions. Android inline preview continues to disable generated JavaScript; static structure and asset checks are used there, and generated JavaScript runtime behavior is not certified on Android.

The supported project output is browser-based **HTML, CSS, and JavaScript**. The app does not execute arbitrary operating-system commands.

## Normal Chat

- Optional web search using DuckDuckGo search results.
- Chart rendering for numeric data when the model returns the supported chart format.
- General conversation using the configured OpenAI-compatible chat-completions endpoint.

Web search results are snippets and links, not a guarantee of exhaustive research. Check important sources directly.

## Build from source

### Android APK

The workflow `.github/workflows/build-apk.yml` is intentionally gated to the `v30.0.0` tag. Intermediate development commits do not produce APKs. The final workflow runs the regression suite, copies the shared UI into Android WebView assets, builds the debug APK, and attaches it to the v30.0.0 GitHub release.

### Windows portable app

The workflow `.github/workflows/build-exe.yml` is also gated to the `v30.0.0` tag. It runs the regression suite, builds the portable Electron app, and publishes the EXE to the same final release.

## Development checks

Run:

```bash
npm test
```

This parses the shared UI and desktop bridge scripts, then runs jsdom interaction checks for the drawer, settings, mode selectors, web-search toggle, project navigation, terminal commands, archive/restore, export surface, and send flow.

The regression suite verifies UI interactions, project validation, file handling, preview assembly, native bridge policy, malformed-output recovery, safe preservation, planner/build/reviewer sequencing, bounded repair, and the isolated Chromium runner's viewport/error/cleanup behavior. A successful package build verifies compilation and packaging; it does not replace testing on a real Android device or Windows machine. The model-assisted QA pass cannot claim runtime execution of generated code.
