# Contributing

Selection Desk targets Windows 11 x64. Read `AGENTS.md` and `docs/architecture.md` before changing the desktop lifecycle, selection capture or sharing boundary.

## Changes

Describe the user-visible problem, proposed behavior and relevant risks. Keep interface and security changes covered by behavioral tests. Preserve explicit provider choice, per-request sharing consent, the 60-second selection lifetime and the single hook-owning desktop instance. Update the relevant user documentation when behavior changes.

Use `npm ci`, then run `npm test`, `npm run typecheck`, `npm run build` and `npm run package` on Windows. Report actual results and environment. A passing build is not evidence of WeCom or other desktop compatibility; record those separately in `docs/validation.md`.

## Public material

Do not submit keys, tokens, exported real connector configurations, local logs, selected private text or personal research documents. Use synthetic text and placeholders in reproductions. The original personal requirement/research document is workspace material and is excluded from public release material. Include dependency notices when distributing bundled third-party software; the project MIT license does not replace dependency licenses.

## Release gate

Publish alpha artifacts only with explicit validation limits. Stable publication requires the WeCom workflow, five working days of trial use and clean Windows install/uninstall checks. CI checks pull requests and uploads artifacts for review. New versions on main are published as prereleases after all Windows checks pass; an existing release is never overwritten automatically.
