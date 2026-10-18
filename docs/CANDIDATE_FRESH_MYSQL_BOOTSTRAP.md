# Candidate fresh-MySQL bootstrap

## Purpose

`drizzle/0057_flawless_nuke.sql` is historical: production’s `__drizzle_migrations` ledger has already recorded its SHA-256 `e27c5cd660735b2d8309cce11a236fee47ad3cff6bf038e5d026f0cd3b6f1cb5`. It contains a 72-character MySQL foreign-key identifier. A new MySQL 8 database rejects that identifier even though the intended final physical constraint is the later, short `algo_outcome_prov_fk` name.

Do **not** edit the historical 0057 or 0058 migration files, their journal entries, or a populated database ledger. That would diverge source history from the production record.

## Candidate-only procedure

For a **newly provisioned, isolated candidate MySQL database only**, generate the tested bootstrap SQL from the exact checked-out commit:

```bash
node scripts/buildCandidateFreshMySqlMigrationSql.mjs --output /tmp/faultline-candidate-fresh.sql
```

The builder fails closed unless all of these hold:

- the committed 0057 content still has the production-recorded SHA-256;
- its one invalid 72-character identifier is replaced only in generated fresh-bootstrap SQL with `algo_outcome_prov_fk`;
- existing 0058 is exactly the known duplicate FK statement and is recorded in the ledger but not emitted physically;
- the production-recorded 0060 source is replaced only in generated fresh-bootstrap SQL with a temporary FK-support index, the intended unique-to-nonunique composite-index swap, and removal of that temporary index; this avoids MySQL dropping the index on which the FK currently depends and leaves the same final index state as production;
- all quoted identifiers emitted by the journal chain are 64 characters or fewer; and
- the generated ledger has exactly one entry per journal migration, retaining each original source checksum and timestamp.

Run the generated SQL only on an empty candidate database. The result has the same intended final relationship as production — one foreign key named `algo_outcome_prov_fk` — while preserving historical migration hashes and order for compatibility.
