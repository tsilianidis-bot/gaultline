#!/usr/bin/env node
/**
 * Emit the journal-ordered SQL bootstrap for a brand-new MySQL database.
 *
 * Production has already recorded migration 0057 with its original SHA-256.
 * That historical file contains a 72-character foreign-key name rejected by
 * current MySQL. This builder deliberately leaves the historical source and
 * its ledger hash unchanged, but emits a MySQL-safe physical equivalent for
 * an empty database. Migration 0058 is the pre-existing follow-up that adds
 * the same relationship under the intended final name, so it is recorded but
 * its duplicate DDL is not emitted in a fresh bootstrap.
 *
 * This is candidate/bootstrap tooling only. The application startup path does
 * not invoke it and production must never use it to modify an existing DB.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, 'drizzle');
const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
const legacy0057Constraint = 'algorithmOutcomeObservations_provenanceId_algorithmScoreProvenance_id_fk';
const canonicalConstraint = 'algo_outcome_prov_fk';
const expected0057Hash = 'e27c5cd660735b2d8309cce11a236fee47ad3cff6bf038e5d026f0cd3b6f1cb5';
const expected0057Tag = '0057_flawless_nuke';
const expected0058Tag = '0058_lovely_skin';
const expected0058Sql = 'ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT `algo_outcome_prov_fk` FOREIGN KEY (`provenanceId`) REFERENCES `algorithmScoreProvenance`(`id`) ON DELETE cascade ON UPDATE no action;';

function fail(message) {
  throw new Error(`Fresh MySQL bootstrap refused: ${message}`);
}

function identifiersOver64(sql) {
  return [...new Set([...sql.matchAll(/`([^`]+)`/g)].map(([, identifier]) => identifier))]
    .filter((identifier) => identifier.length > 64);
}

function splitStatements(sql) {
  return sql.split('--> statement-breakpoint').filter((statement) => statement.trim());
}

const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : null;
if (outputFlag >= 0 && !outputPath) fail('--output requires a path');
if (process.argv.some((arg, index) => arg === '--output' && index !== outputFlag)) fail('--output may only be supplied once');

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
if (journal.dialect !== 'mysql') fail(`journal dialect is ${journal.dialect}, expected mysql`);
const tags = journal.entries.map((entry) => entry.tag);
if (new Set(tags).size !== tags.length) fail('journal tags are not unique');
if (tags.indexOf(expected0057Tag) + 1 !== tags.indexOf(expected0058Tag)) fail('0057 and 0058 are not adjacent in journal order');

const rendered = [
  '-- FAULTLINE fresh MySQL candidate bootstrap.',
  '-- Generated only from the committed migration journal; do not edit.',
  '-- Safe only for a newly provisioned empty candidate database.',
  'CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (',
  '  `id` serial primary key,',
  '  `hash` text not null,',
  '  `created_at` bigint',
  ');',
  '',
];

for (const entry of journal.entries) {
  const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`);
  const originalSql = fs.readFileSync(migrationPath, 'utf8');
  const originalHash = crypto.createHash('sha256').update(originalSql).digest('hex');
  let sqlToEmit = originalSql;

  if (entry.tag === expected0057Tag) {
    if (originalHash !== expected0057Hash) fail(`0057 historical checksum is ${originalHash}, expected ${expected0057Hash}`);
    const occurrences = originalSql.split(legacy0057Constraint).length - 1;
    if (occurrences !== 1) fail(`0057 legacy constraint occurs ${occurrences} times, expected 1`);
    sqlToEmit = originalSql.replace(legacy0057Constraint, canonicalConstraint);
  }

  if (entry.tag === expected0058Tag) {
    if (originalSql.trim() !== expected0058Sql) fail('0058 no longer matches the known duplicate foreign-key follow-up');
    // 0057 emitted canonicalConstraint above; retaining this DDL would create a
    // duplicate physical FK. Keep 0058's original ledger entry for compatibility.
    sqlToEmit = '';
  }

  const tooLong = identifiersOver64(sqlToEmit);
  if (tooLong.length) fail(`${entry.tag} contains identifiers longer than 64 characters: ${tooLong.join(', ')}`);

  rendered.push(`-- journal ${entry.idx}: ${entry.tag}`);
  for (const statement of splitStatements(sqlToEmit)) rendered.push(`${statement.trimEnd()}\n`);
  rendered.push(`INSERT INTO \`__drizzle_migrations\` (\`hash\`, \`created_at\`) VALUES ('${originalHash}', ${entry.when});`, '');
}

const sql = `${rendered.join('\n')}\n`;
if (identifiersOver64(sql).length) fail('generated bootstrap contains an overlength quoted identifier');
if ((sql.match(/INSERT INTO `__drizzle_migrations`/g) ?? []).length !== journal.entries.length) fail('generated ledger entry count does not match journal');
if (!sql.includes(`ADD CONSTRAINT \`${canonicalConstraint}\``)) fail('canonical 0057 foreign key was not emitted');
if ((sql.split(`ADD CONSTRAINT \`${canonicalConstraint}\``).length - 1) !== 1) fail('canonical foreign key is not emitted exactly once');

if (outputPath) {
  fs.writeFileSync(path.resolve(repoRoot, outputPath), sql);
} else {
  process.stdout.write(sql);
}
console.error(JSON.stringify({
  journalEntries: journal.entries.length,
  firstTag: journal.entries[0]?.tag,
  lastTag: journal.entries.at(-1)?.tag,
  preserved0057Hash: expected0057Hash,
  emitted0057Constraint: canonicalConstraint,
  skippedDuplicate0058Ddl: true,
  byteLength: Buffer.byteLength(sql),
}));
