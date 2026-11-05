# AlwaysTranslate

Real-time AI translation for Vencord.

## About this fork

Fork of [komi-juru/AlwaysTranslate](https://github.com/komi-juru/AlwaysTranslate), maintained by [DankyoDev](https://github.com/DankyoDev) and kept in sync with upstream.

What this fork changes:

- **Google Translate engine**, free and without an API key, next to Gemini and DeepSeek.
- **Scope hierarchy:** user > channel > server > global, merged layer by layer, with a visual editor for each scope.
- **Outgoing translation** with preview, a target language per scope and the original message kept visible.
- **API keys encrypted at rest** with the OS keychain (DPAPI on Windows) through Electron's `safeStorage`. The provider requests run in the main process instead of the renderer.
- **Debug log:** optional, written to `AlwaysTranslate.log`, with a viewer in the plugin settings. Keys are never logged.
- **Settings translated into Spanish**, with a scope editor, presets and per-scope prompts.
- **Built on the upstream pipeline:** request limiter with backoff, 6000-character batching, 60-second timeout, cache policy, retries and the regression test suite.
- **Scope tests** for resolution and language comparison.

Like upstream, this fork no longer ships the manual "Translate now" button, the DeepL engine or the custom dictionary.

<img width="583" height="698" alt="image" src="https://github.com/user-attachments/assets/d3ef429d-0af7-4388-985f-9e95c6c6dd6f" />
<img width="682" height="462" alt="Honeycam 2026-07-01 15-46-22" src="https://github.com/user-attachments/assets/3d468a52-e4b9-40a4-b089-181bad716574" />
<img width="682" height="341" alt="Honeycam 2026-07-01 18-22-25" src="https://github.com/user-attachments/assets/46629439-bfe3-4544-b7d2-cdabbcfa39aa" />


## Features

- **AI Translation** – Context-aware translations that preserve tone and slang.
- **Eco Mode** – Reduce API costs by grouping messages together.
- **Outgoing Translation** – Write in your language and send translated messages while keeping the original visible.
- **Per-Channel Settings** – Configure different languages and translation engines for each server or DM.

---

## Install

Building Vencord from source is required.

### 1. Install prerequisites

Install [**Git**](https://git-scm.com/) and [**Node.js**](https://nodejs.org/), then install `pnpm`:

```bash
npm install -g pnpm
```

### 2. Clone Vencord

```bash
git clone https://github.com/Vendicated/Vencord
```

### 3. Install AlwaysTranslate
```bash
cd Vencord/src
mkdir userplugins
cd userplugins
git clone https://github.com/DankyoDev/AlwaysTranslate.git alwaysTranslate
pnpm build
pnpm inject
```

---

## Update
```bash
cd Vencord/src/userplugins/alwaysTranslate
git pull
pnpm build
```

---

## API Keys

Configure your API key in the plugin settings.

- **Gemini** – https://aistudio.google.com/api-keys
- **DeepSeek** – https://platform.deepseek.com/

---

## Privacy

This plugin does not collect personal data. However, messages are sent to your chosen AI API; please use caution in channels with sensitive information.
> **Disclaimer:** This plugin is not officially supported by Vencord.

## Development checks

From the Vencord repository root, after installing dependencies:

```bash
pnpm testTsc
pnpm build
pnpm exec eslint src/userplugins/alwaysTranslate
node --test src/userplugins/alwaysTranslate/tests/regression.cjs
```
