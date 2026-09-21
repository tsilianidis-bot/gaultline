# USI restore kit (P0-1)

`client/src/pages/UniversalSymbolIntelligence.tsx` was accidentally stubbed (FILE:// / PLACEHOLDER) during large MCP push attempts.

## On box
Use `/workspace/usi-minimal.tsx` or `/workspace/FINAL_usi_create_or_update.json` with GitHub MCP `create_or_update_file` / `push_files` (full content, not a path stub).

## Assemble from parts (after parts land)
```bash
cat docs/restore/usi-minimal.b64.part* | base64 -d > client/src/pages/UniversalSymbolIntelligence.tsx
```

Expected sha256: `9cd71b9039426068c12a603bc884e8b27f8710fc89de1f61768ca4e44cf39159`
Includes `_providerHealth?` on DayTradeReport.

Do not revert shadow `0283841` or docs `601219a` / `ab31893`.
