# Nexra Android V1 — Design

## Intent
Turn the existing Nexra single-page chatbot into an installable Android APK that feels like a minimal AI chat app, while letting the AI create and manage small browser projects (HTML, CSS, JavaScript). The user should experience a chat-first assistant, not an IDE.

## Goals
- Ship Nexra itself as an Android APK using a native Android WebView shell.
- First-launch screen contains only a compact top row (sidebar control and robot/Nexra AI identity), generous whitespace, and a message composer near the lower portion of the screen. No welcome headline, subtitle, suggestion chips, or dashboard.
- After the first message, transition into a conventional conversation view with a persistent composer and readable, non-overlapping messages.
- Keep the interface light: warm white, pale green surfaces, muted green-grey text, soft green accents; no dark theme in V1.
- Sidebar contains New project, project history, Archived projects, and Settings.
- A project view exposes Files, Preview, and Export only when the user opens a project.
- Projects are browser applications composed of index.html, style.css, and script.js. Preview them in a sandboxed WebView iframe.
- Allow projects to be renamed, archived/restored, and exported as ZIP.
- Remove Puter.js completely. Store provider API keys only on-device using Android Keystore-backed encryption. The browser JavaScript must never receive the raw key; a native Android bridge performs provider requests.
- Support configurable OpenAI-compatible endpoints/models so DeepSeek, GLM, Qwen, and compatible services can be configured without hardcoding credentials.
- Build APKs through GitHub Actions. Keep the existing GitHub Pages workflow and main branch untouched during V1 development.

## Non-goals
- No traditional IDE layout, permanent code panes, terminal, or visible chain-of-thought.
- No EXE/APK generation for projects created inside Nexra in V1.
- No arbitrary GitHub repository connection or cloud coding runner in V1.
- No production deployment or merge to main without explicit approval.

## Approaches
1. **WebView APK with native secure bridge (selected):** Reuse a lightweight HTML/CSS/JS frontend, wrap it in Android WebView, keep secrets and provider HTTP requests in native Kotlin. Best fit for the existing static frontend and the requested chat-first UI.
2. **Fully native Android UI:** Strong platform integration but duplicates the UI work and slows iteration.
3. **Browser-only PWA:** Fastest prototype, but does not deliver the requested installable APK or reliable device-keystore storage.

## Architecture
- Android Kotlin host owns WebView setup, Android Keystore-backed API-key storage, and provider HTTP requests.
- Frontend owns chat state, project metadata/files, project navigation, file inspection/editing, preview rendering, and ZIP export.
- Persist project data locally in WebView storage for V1; never persist API keys there.
- Model calls use an OpenAI-compatible chat-completions contract through the native bridge. Provider endpoint and model are configurable; API key is fetched from secure native storage and is never returned to JavaScript.
- Generated project changes use a constrained JSON response contract containing a user-facing summary, task checklist, and complete project file contents. Validate the response before saving files.

## Security and privacy
- API keys are encrypted with an AES key held in Android Keystore; only ciphertext is stored in app-private preferences.
- Never include keys in URLs, logs, analytics, project files, exported ZIPs, or JavaScript state.
- Native networking must use HTTPS; reject non-HTTPS custom endpoints.
- Render project previews in a sandboxed iframe without same-origin privileges.
- Generated project code is untrusted; preview it in the isolated iframe and do not expose the native bridge inside the preview frame.

## Acceptance criteria
1. The APK launches to the specified minimal light home screen.
2. Text wraps and scrolls correctly on narrow screens and with large font/display settings; no composer/message overlap when the keyboard opens.
3. Sending a message transitions to chat layout and displays task progress without exposing internal reasoning.
4. Puter.js is absent from app and web source.
5. API keys can be saved, checked, replaced, and deleted; raw keys are not exposed to frontend JavaScript or logs.
6. A user can create a project, persist its three files, reopen it, inspect/edit files, preview it, archive/restore it, and export a ZIP.
7. GitHub Actions produces a debug APK artifact.
8. Existing GitHub Pages deployment workflow is preserved and main is not modified.
