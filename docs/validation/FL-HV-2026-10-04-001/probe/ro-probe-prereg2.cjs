// READ-ONLY (TRANSACTION READ ONLY, rolled back). Model identity/training-window metadata only; no scores.
const mysql = require('/workspace/probability/fix60/node_modules/mysql2/promise');
(async () => { const e = process.env;
  const c = await mysql.createConnection({ host: e.RAILWAY_TCP_PROXY_DOMAIN, port: Number(e.RAILWAY_TCP_PROXY_PORT), user: e.MYSQLUSER, password: e.MYSQLPASSWORD, database: e.MYSQLDATABASE, dateStrings: true, timezone: 'Z' });
  await c.query('SET SESSION TRANSACTION READ ONLY'); await c.query('START TRANSACTION READ ONLY');
  const out={};
  try { const [r] = await c.query("SELECT id, modelVersion, modelType, approved, featureSchemaVersion, trainingStart, trainingEnd, createdAt FROM systemicRegimeModels ORDER BY id"); out.models=r; } catch(err){ out.models={error:err.code}; }
  try { const [r] = await c.query("SELECT COUNT(*) n, MIN(computedAt) first, MAX(computedAt) last FROM systemicRegimeReadings WHERE historyClass='LIVE_INFERENCE'"); out.liveReadings=r; } catch(err){ out.liveReadings={error:err.code}; }
  await c.query('ROLLBACK'); await c.end(); process.stdout.write(JSON.stringify(out,null,1)); })().catch(err=>{console.error('FATAL '+(err.code||err.message));process.exit(1);});
