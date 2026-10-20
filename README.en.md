# Selection Desk

[简体中文](README.md) · Windows 11 x64 · 0.1.0-alpha.1 · MIT

Translate selected text, ask custom questions and continue a streaming conversation in a desktop overlay. Built with Electron, TypeScript, React and selection-hook. The interface defaults to Chinese and the system theme, with movable, resizable and pinnable conversations.

**Alpha software.** Automated checks do not establish compatibility with real desktop applications. See the [validation record](docs/validation.md). A stable release requires the WeCom workflow, five working days of use and clean Windows installation validation.

## Getting started

1. Install the Windows x64 alpha or run the portable executable. First launch opens Settings. Once settings are saved, subsequent launches stay in the tray. Use the tray or `--settings` to open settings; `--background` supports a background launch.
2. Codex is the default provider. Check the local executable path, login state and connection. Alternatively select an OpenAI-compatible API and enter its URL, model and key. Provider switching is explicit.
3. Select text in another application and choose Translate or Ask. Typing a question activates the input; pin a conversation to retain it when another selection arrives.
4. If automatic capture fails, copy text manually and press `Ctrl+Shift+Space`. Automatic clipboard fallback defaults to off pending native clipboard restoration compatibility checks.

No OCR, voice, cloud sync or source-text replacement. Start at login is off by default.

## Agent connections and privacy

Settings exports separate configurations for Codex, WorkBuddy and Qwen Office (千问办公), with a token per client. Installed builds support HTTP and stdio; single-file portable builds support HTTP. Keep real exports local. MCP exposes only `get_selection`; each read requires approval for that client and request, and ordinary selections expire from memory after 60 seconds. WorkBuddy and Qwen reverse conversations are not implemented, pending official API support. See [connectors](docs/connectors.md).

No telemetry by default and no intentional local transcript persistence. Model requests send selected text and conversation context to the chosen provider, whose own retention policy applies. Keys and tokens use OS-backed encryption; this does not isolate them from software running under the same Windows account. See [security](SECURITY.md).

Alpha executables are unsigned, so Windows may display an unknown publisher notice. Verify the download source and any supplied checksums before installing. Uninstall the NSIS version from Windows Settings → Apps → Installed apps. Exit and remove the executable for the portable version. Remove exported connector entries from clients; residual settings and credential cleanup must be checked during [installation validation](docs/validation.md).

## Development

Use Windows x64, Node.js 22.12 or a newer compatible version, and npm:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run package
```

`npm start` launches a development build. Packages are written to `release/` as NSIS and portable artifacts. Dependency downloads require network access. Pull requests are checked without publishing. New versions on main are published as prereleases after all Windows checks pass; existing version assets are left unchanged.

See [architecture](docs/architecture.md), [contributing](CONTRIBUTING.md) and [MIT license](LICENSE).
