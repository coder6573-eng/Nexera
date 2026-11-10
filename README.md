# Nexera AI v10.1.0

Nexera is a light, mobile-first AI workspace with two separate experiences:

- **Normal Chat** — general AI chat, optional web search, and simple data visualizations.
- **Vibecoding** — plan and build browser projects, edit files, preview them, and export the workspace.

The same interface is packaged as an Android app (WebView) and a Windows portable desktop app (Electron).

## AI providers

Kilo Auto Free is the default. If that route is busy, Nexera automatically tries three additional Kilo free models in sequence. Open **Settings** to choose another provider, change the model, or configure BYOK.

| Provider | Default model | Key required |
| --- | --- | --- |
| OpenRouter | `openrouter/free` | Yes |
| Kilo AI Gateway (default) | `kilo-auto/free` → `z-ai/glm-5:free` → `minimax/minimax-m2.1:free` → `google/gemma-4-26b-a4b-it:free` | No for free routes |
| DeepSeek | `deepseek-chat` | Yes |
| GLM / Zhipu | `glm-4.5-flash` | Yes |
| Qwen / DashScope | `qwen-plus` | Yes |
| Custom | User supplied | Depends on provider |

Kilo free routes are subject to availability and provider rate limits. Kilo documents anonymous access for free models, with a gateway rate limit of 200 requests per hour per IP. The free model catalog can change. Kilo Auto Free may route requests to providers with different data-handling practices; do not send private or confidential information when using it.

API keys are not stored in browser localStorage. Android uses Android Keystore-backed encryption; Windows uses Electron safeStorage.

## Vibecoding

- **Build** — planning pass followed by a complete project build.
- **Agent** — planning, build, and a review/polish pass.
- **Skills** — Frontend, UI/UX, Debugging, Accessibility, and Performance guidance.
- **Workspace terminal** — restricted commands that operate only on the current app workspace. It is not an operating-system shell and does not run arbitrary commands.
- **Files / Preview / Terminal / Export** — edit project files, preview in an isolated surface, run safe workspace commands, and export a ZIP.

The project workspace is stored locally by the app. The terminal is intentionally limited to workspace file operations; it cannot access arbitrary device or computer paths.

## Normal Chat

- Optional web search using DuckDuckGo search results.
- Chart rendering for numeric data when the model returns the supported chart format.
- General conversation using the configured OpenAI-compatible chat-completions endpoint.

Web search results are snippets and links, not a guarantee of exhaustive research. Check important sources directly.

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
