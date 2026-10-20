# Security and privacy

Selection Desk is alpha software. Its local service listens on `127.0.0.1:18765`; it is intended for the same machine and must not be exposed through a proxy or port forward.

## Data boundaries

- Each MCP client has its own token. A token identifies the configured client; it is not a trusted identity attestation for all software on the machine.
- `get_selection` requires confirmation for the named client and current request. Ordinary selections live in memory for 60 seconds. Fixed conversations can retain the text needed for that conversation in memory.
- API keys and client tokens use Electron safeStorage. On Windows its DPAPI protection does not isolate secrets from applications running as the same user. See [Electron's platform security semantics](https://www.electronjs.org/docs/latest/api/safe-storage).
- Exported connector files contain usable credentials in client-readable form. Keep them local and remove obsolete copies. Never attach them to an issue or commit them.
- The app has no telemetry by default and does not intentionally save local transcripts. Text submitted to a model is subject to that provider's processing and retention policies. Clients receiving an approved selection have their own storage policies.
- Automatic clipboard fallback is off by default until format-restoration compatibility is validated. Manual copy plus `Ctrl+Shift+Space` is available.

## Reporting

For ordinary bugs, provide a synthetic reproduction, app/Windows version and expected behavior. For a suspected security issue, use the repository's private vulnerability reporting facility if available. No dedicated security mailbox or guaranteed response time is established. If a private channel is unavailable, open a minimal issue asking for one, without exploit details, secrets or private text.

If a real connector export is exposed, remove its client configuration and replace the affected local credential before reconnecting. If an API key is exposed, revoke it through the provider. Do not assume deleting a public message removes earlier copies.
