# FAULTLINE Backup Verification Record

> **Archive:** `FAULTLINE_FULL_BACKUP_2026-08-13.zip`  
> **Verification date:** 2026-08-13  
> **Scope:** Safe source, schema/migrations, product documentation, reference assets, package manifests, and redacted task history.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Archive opens successfully | Pass | `unzip -tq` completed with no archive errors. |
| Source code included | Pass | `client/src/`, `server/`, and `shared/` TypeScript/TSX sources are present. |
| Package manifests and lockfile included | Pass | `package.json`, `pnpm-lock.yaml`, `package-lock.json`, configs, and patch files are present. |
| Database structure included | Pass | `drizzle/schema.ts`, 53 ordered SQL migrations, and generated `FAULTLINE_DATABASE_SCHEMA.md` are present. |
| ASHA reconstruction included | Pass | `ASHA_MASTER_SYSTEM_PROMPT.md` is present. |
| Engine specification included | Pass | `FAULTLINE_ENGINE_SPECIFICATIONS.md` is present. |
| Restoration materials included | Pass | Master restoration guide, architecture, product bible, current-state, external-dependency, environment template, manifest, and checklist are present. |
| Dependencies and caches excluded | Pass | Root and nested `node_modules`, Vite cache, Git, Manus runtime/log directories, build outputs, and coverage are excluded. |
| Secret files excluded | Pass | `.env*` and `.project-config.json` are excluded. Root `todo*.md` files are excluded in favor of `FAULTLINE_TODO_SAFE.md`. |
| Common live-secret pattern scan | Pass with reviewed false positive | No secret value was included. The only pattern match was the literal string `sk_live_` in a Stripe test that checks a prefix, not a key. |

## Explicit exclusions

The archive excludes real environment files, project configuration containing injected secrets, package/dependency directories, build outputs, caches, Git and Manus operational state, runtime logs, temporary files, database files, and raw root TODO records that may contain secrets. The archive includes a redacted TODO export instead.

## Remaining external recovery obligations

The archive cannot recover production database records, provider accounts/keys, Stripe account/payment history, OAuth registrations, domain registrar/DNS control, host/scheduler state, storage objects outside the repository, or Manus conversation history. These require separate owner-controlled exports or account access. See `FAULTLINE_EXTERNAL_DEPENDENCIES.md`.
