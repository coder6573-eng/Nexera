# Nexera AI v10.5.0

Nexera is a light, mobile-first AI workspace with two separate experiences:

- **Normal Chat** — general AI chat, optional web search, and simple data visualizations.
- **Vibecoding** — plan and build browser projects, edit files, preview them, and export the workspace.

The same interface is packaged as an Android app (WebView) and a Windows portable desktop app (Electron).

## AI providers

Kilo Auto Free is the default. The chat composer also lets users switch directly between Kilo Auto, LLMFaucet, OVH Free, LLM7 Free, Puter, and OpenRouter Free. Kilo Auto automatically tries its free model pool and then keyless fallback gateways when capacity is unavailable. Open **Settings** to configure BYOK routes.

| Provider | Default model | Key required |
| --- | --- | --- |
| OpenRouter | `openrouter/free` | Yes |
| Kilo AI Gateway (default) | `kilo-auto/free` → free Kilo fallbacks | No for free routes |
| LLMFaucet | `auto:coding` | No |
| OVH AI Endpoints | `gpt-oss-120b` | No on anonymous path |
| LLM7 | `gpt-oss:20b` | Free provider key |
| Puter AI | `openai/gpt-6-luna` | Puter account |
| DeepSeek | `deepseek-chat` | Yes |
| GLM / Zhipu | `glm-4.5-flash` | Yes |
| Qwen / DashScope | `qwen-plus` | Yes |
| Custom | User supplied | Depends on provider |

Kilo free routes are subject to availability and provider rate limits. Kilo documents anonymous access for free models, with a gateway rate limit of 200 requests per hour per IP. The free model catalog can change. Kilo Auto Free may route requests to providers with different data-handling practices; do not send private or confidential information when using it.

API keys are not stored in browser localStorage. Android uses Android Keystore-backed encryption; Windows uses Electron safeStorage.

## Vibecoding

- **Iterative editing** — after the first build, keep chatting in the same conversation. Nexera uses the current project files as context and merges partial file updates, preserving untouched files. If a request is materially unclear, it asks a clarification question before building.
- **Linked local folder (Windows desktop)** — open an existing web project folder containing `index.html`; supported text files are loaded into the chat workspace and agent edits are written back to that selected folder. Reads and writes are bounded, paths are validated, and symbolic links are not followed. Android continues to use the private app workspace.
- **Real live preview** — the build card contains a sandboxed iframe preview generated from the current project files. It refreshes after every completed build/edit, and the full preview can be opened separately. Returning from the project preview keeps the active project attached to the chat.
- **Chat polish** — assistant responses render basic headings, lists, links, inline code, and fenced code blocks safely, with a one-tap copy action that copies the final response. The composer auto-grows with the message.


- **Build** — one-pass generation with an embedded quality checklist to reduce wait time.
- **Agent** — a concise planning pass followed by building and a built-in quality review.
- **Skills** — Frontend, UI/UX, Debugging, Accessibility, and Performance guidance.
- **Workspace terminal** — restricted commands that operate only on the current app workspace. It is not an operating-system shell and does not run arbitrary commands.
- **Files / Preview / Terminal / Export** — edit project files, preview in an isolated surface, run safe workspace commands, and export a ZIP.

The project workspace is stored locally by the app. The terminal is intentionally limited to workspace file operations; it cannot access arbitrary device or computer paths.

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
