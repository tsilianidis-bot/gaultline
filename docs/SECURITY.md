# Security

Secrets live only in Railway (or the host secret manager / process environment). They must never be committed to git.

- Use [`.env.example`](../.env.example) and [`.project-config.example.json`](../.project-config.example.json) for **key names and placeholders only**.
- `.project-config.json` and `.env*` files are gitignored. Do not force-add them.
- The application reads `process.env` (`server/_core/env.ts` and related clients). It does **not** import `.project-config.json`.
- This change stops **forward** tracking. It does **not** rewrite git history. Historical commits may still contain previously tracked secrets; rotation and history rewrite require separate owner approval.
- Do not print secret values in issues, pull requests, commits, logs, or docs.

See also: [`RC_PROJECT_CONFIG_SHAPES.md`](RC_PROJECT_CONFIG_SHAPES.md), [`INDEPENDENT_STAGING.md`](INDEPENDENT_STAGING.md).
