// READ-ONLY probe for FL-HV-2026-10-04-001 exclusions. Session TRANSACTION READ ONLY, rolled back. Never prints credentials.
// Selects only ids/timestamps/version/provenance fields; deliberately does NOT select any pressure/score values.
const mysql = require('/workspace/probability/fix60/node_modules/mysql2/promise');
(async () => {
  const e = process.env;
  const c = await mysql.createConnection({ host: e.RAILWAY_TCP_PROXY_DOMAIN, port: Number(e.RAILWAY_TCP_PROXY_PORT), user: e.MYSQLUSER, password: e.MYSQLPASSWORD, database: e.MYSQLDATABASE, dateStrings: true, timezone: 'Z', connectTimeout: 20000 });
  await c.query('SET SESSION TRANSACTION READ ONLY'); await c.query('START TRANSACTION READ ONLY');
  const out = {};
  const q = async (k, sql, p=[]) => { try { const [r] = await c.query(sql, p); out[k] = r; } catch (err) { out[k] = { error: err.code || String(err.message).slice(0,200) }; } };
  await q('session', "SELECT UTC_TIMESTAMP() utc_, @@transaction_read_only ro, @@session.time_zone tz, @@global.time_zone gtz, @@system_time_zone stz");
  for (const t of ['shadowModelReadings','shadowForwardOutcomes','intelligenceStateManifests','algorithmOutcomeObservations','algorithmScoreProvenance']) await q('cols_'+t, 'SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [t]);
  await q('shadow_readings_20261004', "SELECT id, readingAt, engineVersion, flagFallback FROM shadowModelReadings WHERE readingAt >= '2026-10-04 00:00:00' ORDER BY id");
  await q('shadow_readings_summary', "SELECT COUNT(*) n, MIN(readingAt) first, MAX(readingAt) last, MIN(id) minId, MAX(id) maxId FROM shadowModelReadings");
  await q('shadow_outcomes_20261004', "SELECT o.* FROM shadowForwardOutcomes o JOIN shadowModelReadings r ON r.id=o.shadowReadingId WHERE r.readingAt >= '2026-10-04 00:00:00' ORDER BY o.id");
  await q('manifests', "SELECT id, stateId, originatingRunId, generatedAt, createdAt, championVersion, modelVersion, scoringVersion, configurationVersion, inputSnapshotId, LEFT(stateHash,16) stateHash16, JSON_UNQUOTE(JSON_EXTRACT(manifestJson,'$.recordClass')) recordClass, JSON_UNQUOTE(JSON_EXTRACT(manifestJson,'$.runProvenance.trigger')) trig, JSON_UNQUOTE(JSON_EXTRACT(manifestJson,'$.runProvenance.codeVersion')) codeVersion FROM intelligenceStateManifests ORDER BY id");
  await q('algo_prov', "SELECT id, observationKey, observedAt, createdAt, engineVersion, LEFT(formulaHash,12) fh12, provenanceStatus FROM algorithmScoreProvenance ORDER BY id");
  await q('algo_outcomes', "SELECT id, outcomeKey, provenanceId, horizonTradingDays h, observedAt, createdAt, JSON_UNQUOTE(JSON_EXTRACT(outcomeJson,'$.spy.baseObservedAt')) spyBase, JSON_UNQUOTE(JSON_EXTRACT(outcomeJson,'$.spy.targetObservedAt')) spyTarget FROM algorithmOutcomeObservations ORDER BY id");
  await c.query('ROLLBACK'); await c.end();
  process.stdout.write(JSON.stringify(out, null, 1));
})().catch(err => { console.error('FATAL ' + (err.code || err.message)); process.exit(1); });
