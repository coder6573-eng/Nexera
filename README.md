# Nexera AI v21.0.0

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
- **Model-agnostic engineering pipeline** — Agent mode creates a visible plan, builds with the selected provider, can request bounded read-only host tools (`workspace.list_files`, `workspace.read_file`, `workspace.search_files`, `workspace.validate`, and `browser.inspect`) through a shared JSON contract, runs a separate QA pass, performs deterministic structure/asset checks, and executes the generated project in an isolated Electron Chromium window at 360px, 768px, and 1280px. The browser inspector captures JavaScript runtime errors, unhandled promise rejections, console errors, horizontal overflow, missing accessible names/labels, and missing image alt text. It also click-smoke-tests up to 12 visible buttons in the disposable preview, reports observable DOM changes and runtime errors without claiming semantic correctness, and captures compact element geometry/style summaries at each viewport for targeted repair. Inspection pages deny outbound connections and block form submission, link navigation, pop-ups and blocking dialogs. The same inspection is host-driven and works with any configured OpenAI-compatible chat model; model quality can still affect the generated implementation. It can run up to two targeted repair passes before applying the result. Build mode skips planning and the separate QA call but still runs available checks and repairs. Because the model only needs to produce the shared JSON project contract, the host's tool capabilities are available even when a model has no native function-calling support; output quality still varies by model.
- **Live preview** — the sandboxed preview refreshes after a completed build or edit. Keep chatting to refine the page.
- **Visible progress** — stages, route attempts, elapsed time, and the current waiting state are shown instead of leaving a blank spinner. Actual model names are shown only when returned by provider metadata.
- **Background behavior** — Windows model requests run in the Electron main process and continue while the window is minimized. Android requests use a native worker thread and can continue while the app process remains alive; Android may stop work if it kills the app, so this is not a guarantee of surviving force-stop or process death.
- **Workspace** — project files, editor, preview, restricted terminal, ZIP export, and linked local folder support remain available. The terminal is currently a restricted workspace command panel (`ls`, `cat`, `touch`, `grep`, `wc`, and related file commands); it is not a general operating-system shell or an npm/build runner. Windows browser diagnostics execute generated project code in a separate hidden Chromium window with Node integration disabled, context isolation, sandboxing, and navigation/pop-up restrictions. Android inline preview runs bundled JavaScript in a WebView without a native bridge. File access, external network requests, form submissions, and top-level navigation are blocked by the preview policy and WebView client. Automated browser diagnostics are unavailable on Android, so static checks are used there and generated JavaScript runtime behavior is not certified on Android.

The supported project output is browser-based **HTML, CSS, and JavaScript**. The app does not execute arbitrary operating-system commands.

## Python Agent backend\n\nV21 adds an optional **Nexera Python Agent** route for Vibecoding. The client synchronizes the active project to the FastAPI service, streams model-selected workspace tool calls and results, then retrieves the updated files and runs the client's available checks before applying them. Agent mode supports a separate planning model and orchestrator/build model; Build mode uses the restricted file tools without delete or terminal tools. The server-side OpenRouter key is never placed in the frontend.\n\nThe API is not hosted by this repository. To use this route, deploy `backend/` privately, configure `NEXERA_API_KEY`, `OPENROUTER_API_KEY`, a persistent workspace volume, TLS, rate limiting, and the exact `NEXERA_CORS_ORIGINS`. Enter the API URL and bearer token in Nexera Settings. The token is held in the active app session and is not saved to browser storage; re-enter it after restarting. The current single shared bearer-token scheme is for private testing only, not a public multi-user service. Do not expose a shared master token to untrusted clients. Terminal execution stays disabled unless the operator builds the Node/Python sandbox image and explicitly enables Docker execution on a private single-user host. Do not mount a host Docker socket into a public multi-user service.\n\n## Normal Chat

- Optional web search using DuckDuckGo search results.
- Chart rendering for numeric data when the model returns the supported chart format.
- General conversation using the configured OpenAI-compatible chat-completions endpoint.

Web search results are snippets and links, not a guarantee of exhaustive research. Check important sources directly.

## Build from source

### Android APK

The existing `.github/workflows/build-apk.yml` remains the V20 release workflow and is not changed by the V21 branch. The V21 branch adds `.github/workflows/v21-android-preview.yml`, which runs frontend regression tests, builds a debug APK, and uploads it as a short-lived Actions artifact rather than publishing a release. The Android launcher icon and in-app brand mark use the same Nexera N symbol.

### Windows portable app

The V21 branch adds `.github/workflows/v21-windows-preview.yml` to run regression tests, build the portable Windows app, and upload a preview artifact. Neither preview workflow publishes a public release.

## Development checks

Run:

```bash
npm test
```

This parses the shared UI and desktop bridge scripts, then runs jsdom interaction checks for the drawer, settings, mode selectors, web-search toggle, project navigation, terminal commands, archive/restore, export surface, and send flow.

The regression suite verifies UI interactions, project validation, file handling, preview assembly, native bridge policy, malformed-output recovery, safe preservation, planner/build/reviewer sequencing, read-only agent tool contracts and budgets, bounded repair, Android preview network-isolation policy, and the isolated Chromium runner's viewport/error/interaction-smoke/cleanup behavior. A successful package build verifies compilation and packaging; it does not replace testing on a real Android device or Windows machine. The model-assisted QA pass cannot claim runtime execution of generated code.
