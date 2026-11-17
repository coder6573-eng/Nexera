# Nexera AI Privacy Notice

**Last updated: 15 November 2026**

This is a publication draft. Before distributing Nexera, the publisher must review it, replace the contact placeholder, verify every statement against the final app build and provider contracts, and publish it at a stable public HTTPS URL.

## Who operates Nexera

Nexera AI is distributed by the publisher identified on the app's store listing. This repository does not provide a Nexera-operated account service or hosted Python Agent service. Contact: **[PUBLISHER PRIVACY CONTACT EMAIL — REPLACE BEFORE RELEASE]**.

## Information stored on your device

Nexera stores project/workspace information and app settings in local app storage so that projects and preferences can remain available between sessions. The app does not require a Nexera account.

When a user adds a provider API key in the installed Android app, it is encrypted using Android Keystore-backed storage. The Windows app uses Electron's operating-system secure storage. Browser-only use does not provide the same native credential storage and does not persist BYOK keys.

The optional Python Agent backend URL is saved in app settings. Its bearer token is held in the active app session and must be entered again after restarting the app.

## Information sent to other services

When a user sends a message, the prompt and relevant conversation context are sent to the AI provider selected in the app. Depending on the selected route, this may include Kilo Gateway, LLMFaucet, OVH AI Endpoints, LLM7, UncloseAI, Puter, OpenRouter, DeepSeek, Zhipu/GLM, or Alibaba Cloud DashScope/Qwen. These providers process requests under their own terms and privacy policies. Nexera does not control their retention, review, or model-training practices.

If web search is used, the search query is sent to DuckDuckGo.

If the user chooses the optional Python Agent route, the current project files and agent request are sent to the backend URL that the user configured. That backend operator controls server access, workspace retention, logs, backups, and the OpenRouter account used by the service. Do not connect to a backend unless you trust its operator.

## Information sharing and sale

Nexera does not operate an advertising profile or sell user information. Information is sent to third-party services only when a user chooses a feature or provider that requires it, as described above. The publisher should review third-party SDKs and provider terms before release and update this notice if the final build behaves differently.

## Data retention and deletion

Project data stored locally can generally be removed by deleting projects or clearing the app's storage/uninstalling the app. Data already sent to an AI provider, search service, or user-configured Python backend is subject to that service's retention and deletion policies. Contact the relevant provider or backend operator for those records.

## Security

Nexera uses native secure storage for saved provider credentials on Android and Windows. Network requests to configured AI providers use HTTPS. The optional Python Agent backend should only be used with a trusted HTTPS endpoint. No internet-connected service can guarantee absolute security.

## Children's privacy

Nexera is not designed to collect personal information from children. Users should not submit sensitive personal information, passwords, private keys, or confidential documents to public AI gateways.

## Changes and contact

This notice may be updated when app features, providers, or data practices change. For privacy questions, contact the publisher at the address listed above.
