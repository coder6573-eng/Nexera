# Nexera V21 release checklist

This checklist separates source readiness from a distributable, signed release. Do not publish a build until all required checks below are complete.

## Current build configuration

- App ID: `ai.nexera.app`
- Version: `21.0.0`
- Android version code: `210`
- Android compile/target API: `36`
- Android minimum API: `29`
- Android deliverables: signed APK for direct distribution and signed AAB for Google Play
- Windows deliverable: portable Electron executable; currently unsigned
- Python Agent: optional self-hosted backend; no public Nexera-hosted service is included

## Before creating a release tag

- [ ] GitHub Actions regression jobs complete successfully. A job that never starts or has no step logs is not a pass.
- [ ] Android debug APK installs and is tested on real devices, including Android 13 and Android 16.
- [ ] Windows portable build starts and its primary workflows are smoke-tested on a Windows machine.
- [ ] The Python backend tests pass. If the Python Agent is not being offered as a hosted service, keep it documented as self-hosted and do not distribute a shared server token.
- [ ] Review the privacy notice in `PRIVACY.md`, replace the publisher contact placeholder, and publish it at a public HTTPS URL.
- [ ] Complete the store listing, screenshots, app access instructions, content rating, target-audience declaration, and Data safety form based on the actual final build and third-party provider behavior.
- [ ] Review the AI provider terms and the app's handling of prompts, project files, and provider keys.
- [ ] Confirm the publisher has authority to distribute the app and its name, logo, code, and dependencies.

## Android upload-key setup

The production workflow expects these GitHub Actions repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded publisher-owned upload keystore |
| `ANDROID_KEY_ALIAS` | Alias inside that keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_PASSWORD` | Key password |

Create and retain the upload keystore under the publisher's control. Keep a secure offline backup. Never commit the keystore, passwords, or base64 contents to the repository, and never paste them into a chat. If the upload key is lost, replacing it requires the appropriate Play Console key-reset process.

After the secrets are configured, create the `v21.0.0` tag on the exact reviewed commit. The `.github/workflows/release-v21.yml` workflow runs frontend and backend tests, builds and verifies the signed APK and AAB, builds the Windows portable app, and only then creates the GitHub release.

## Google Play account and store submission

Google Play Console account owners must be at least 18. If the app is to be published before its developer is 18, an adult must genuinely own and manage the developer account and accept the publisher responsibilities. Do not enter a false age or identity. Google states that Play Console account ownership cannot be transferred.

The Play Console owner must review the current testing, identity, device-verification, store-listing, and policy requirements before submission. The V21 build targets API 36 to meet the current new-app and update target-API requirement.

## Remaining limitations

- The release pipeline cannot create a publisher-owned signing key or configure repository secrets on the publisher's behalf.
- The Windows executable is unsigned. Windows may show an unknown-publisher warning until a trusted code-signing certificate is configured.
- A successful build does not replace real-device QA or Play Console review.
- The Python Agent backend is not deployed by this repository. The public app must not embed a shared master bearer token or OpenRouter server key.
