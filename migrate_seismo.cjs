const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  await conn.execute(`CREATE TABLE IF NOT EXISTS \`seismographReadings\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`readingDate\` varchar(10) NOT NULL,
    \`pressureScore\` int NOT NULL,
    \`stressLevel\` varchar(20) NOT NULL,
    \`regime\` varchar(80) NOT NULL,
    \`subScoresJson\` text NOT NULL,
    \`bullProbability\` int,
    \`crashProbability\` int,
    \`direction\` varchar(10) NOT NULL DEFAULT 'stable',
    \`deltaFromPrior\` int NOT NULL DEFAULT 0,
    \`streakDays\` int NOT NULL DEFAULT 0,
    \`historicalPercentile\` int,
    \`pressureDriversJson\` text,
    \`activeAlertsJson\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`seismographReadings_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`seismographReadings_readingDate_unique\` UNIQUE(\`readingDate\`)
  )`);
  console.log('seismographReadings OK');

  await conn.execute(`CREATE TABLE IF NOT EXISTS \`seismographPatterns\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`detectedAt\` varchar(10) NOT NULL,
    \`patternType\` varchar(60) NOT NULL,
    \`patternName\` varchar(120) NOT NULL,
    \`patternDescription\` text NOT NULL,
    \`confidence\` int NOT NULL,
    \`frequency\` varchar(20) NOT NULL,
    \`historicalCount\` int NOT NULL DEFAULT 0,
    \`analogMatchesJson\` text,
    \`outcomeDistributionJson\` text,
    \`invalidationConditions\` text,
    \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
    \`resolvedAt\` varchar(10),
    \`actualOutcome\` varchar(20),
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`seismographPatterns_id\` PRIMARY KEY(\`id\`)
  )`);
  console.log('seismographPatterns OK');

  await conn.execute(`CREATE TABLE IF NOT EXISTS \`seismographTransitions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`transitionDate\` varchar(10) NOT NULL,
    \`fromRegime\` varchar(80) NOT NULL,
    \`toRegime\` varchar(80) NOT NULL,
    \`pressureAtTransition\` int NOT NULL,
    \`confidence\` int NOT NULL,
    \`priorRegimeDuration\` int NOT NULL DEFAULT 0,
    \`explanation\` text,
    \`driversJson\` text,
    \`historicalBaseRate\` int,
    \`confirmed\` tinyint(1),
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`seismographTransitions_id\` PRIMARY KEY(\`id\`)
  )`);
  console.log('seismographTransitions OK');

  const idxPairs = [
    ['seismographReadings','seismo_readings_date_idx','readingDate'],
    ['seismographReadings','seismo_readings_score_idx','pressureScore'],
    ['seismographPatterns','seismo_patterns_detected_idx','detectedAt'],
    ['seismographPatterns','seismo_patterns_type_idx','patternType'],
    ['seismographPatterns','seismo_patterns_active_idx','isActive'],
    ['seismographTransitions','seismo_transitions_date_idx','transitionDate'],
    ['seismographTransitions','seismo_transitions_from_idx','fromRegime'],
    ['seismographTransitions','seismo_transitions_to_idx','toRegime'],
  ];
  for (const [tbl, idx, col] of idxPairs) {
    try { await conn.execute(`CREATE INDEX \`${idx}\` ON \`${tbl}\` (\`${col}\`)`); }
    catch(e) { /* already exists */ }
  }
  console.log('Indexes OK');
  await conn.end();
  console.log('Done');
}
main().catch(e => { console.error(e.message); process.exit(1); });
