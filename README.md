# Nexera AI v11.0.0

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

The Kilo fallback IDs are read from the current free catalogue and may change. The stable `kilo-auto/free` route is tried first. Sources: [Kilo Gateway model documentation](https://kilo.ai/docs/gateway/models-and-providers), [LLMFaucet API and limits](https://github.com/llmfaucet/llmfaucet), [UncloseAI inference details](https://www.uncloseai.com/inference.html).

Other selectable routes include OVH (experimental/manual), Puter (your own account and User-Pays allowance), OpenRouter Free (requires your API key), DeepSeek, GLM, Qwen, and a custom OpenAI-compatible endpoint. Those routes are not part of Free Auto. Some free account tiers require an API key; they are not anonymous routes.

API keys are not stored in browser localStorage. Android uses Android Keystore-backed encryption; Windows uses Electron safeStorage. Free gateways have their own data policies and may log prompts or use them to improve services. Do not send private or confidential information to public free routes.

## Vibecoding

- **Replit-inspired workspace** — desktop shows the project file list, live preview, and AI chat together. On mobile, Chat, Preview, and Files become switchable panels.
- **Iterative editing** — ask for changes in the same conversation. The current project files are supplied as context and partial file updates preserve untouched files.
- **Planning and clarification** — Agent mode creates a visible implementation plan and asks a concise question when a missing detail would materially change the result. Build mode skips the separate planning call.
- **Live preview** — the sandboxed preview refreshes after a completed build or edit. Keep chatting to refine the page.
- **Visible progress** — stages, route attempts, elapsed time, and the current waiting state are shown instead of leaving a blank spinner. Actual model names are shown only when returned by provider metadata.
- **Background behavior** — Windows model requests run in the Electron main process and continue while the window is minimized. Android requests use a native worker thread and can continue while the app process remains alive; Android may stop work if it kills the app, so this is not a guarantee of surviving force-stop or process death.
- **Workspace** — project files, editor, preview, restricted terminal, ZIP export, and linked local folder support remain available. The terminal is intentionally limited to the current project workspace.

The supported project output is browser-based **HTML, CSS, and JavaScript**. The app does not execute arbitrary operating-system commands.

## Normal Chat

- Optional web search using DuckDuckGo search results.
- Chart rendering for numeric data when the model returns the supported chart format.
- General conversation using the configured OpenAI-compatible chat-completions endpoint.

Web search results are snippets and links, not a guarantee of exhaustive research. Check important sources directly.

## GitHub Pages prerequisite

Before the first deployment, the repository owner must enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. The current Actions token cannot create the repository's Pages site automatically.

## Build from source

### Android APK

The GitHub Actions workflow `.github/workflows/build-apk.yml`:
1. Validates the shared UI and desktop JavaScript syntax.
2. Copies `index.html` into Android WebView assets.
3. Builds the debug APK with Gradle.
4. Uploads `app-debug.apk` as the `nexera-debug-apk` artifact.

### Windows portable app

The GitHub Actions workflow `.github/workflows/build-exe.yml` validates JavaScript, installs dependencies, builds the portable Electron app, and uploads the EXE artifact.

## Development checks

Run:

```bash
npm test
```

This parses the shared UI and desktop bridge scripts, then runs jsdom interaction checks for the drawer, settings, mode selectors, web-search toggle, project navigation, terminal commands, archive/restore, export surface, and send flow.

A successful package build verifies compilation and packaging; it does not replace testing on a real Android device or Windows machine.
