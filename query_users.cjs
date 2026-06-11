const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [users] = await conn.execute(
    'SELECT id, name, email, role, accessTier, loginMethod, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId FROM users ORDER BY createdAt ASC'
  );
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  const [positions] = await conn.execute(
    'SELECT userId, COUNT(*) as cnt, GROUP_CONCAT(ticker ORDER BY createdAt DESC SEPARATOR ",") as tickers FROM positions GROUP BY userId'
  );
  console.log('=== POSITIONS ===');
  console.log(JSON.stringify(positions, null, 2));

  const [crypto] = await conn.execute(
    'SELECT userId, COUNT(*) as cnt, GROUP_CONCAT(symbol SEPARATOR ",") as symbols FROM cryptoWatchlist GROUP BY userId'
  );
  console.log('=== CRYPTO WATCHLIST ===');
  console.log(JSON.stringify(crypto, null, 2));

  const [founding] = await conn.execute(
    'SELECT userId, name, email, status, createdAt FROM foundingAccessRequests ORDER BY createdAt DESC'
  );
  console.log('=== FOUNDING REQUESTS ===');
  console.log(JSON.stringify(founding, null, 2));

  const [awareness] = await conn.execute(
    'SELECT userId, COUNT(*) as totalActions, MAX(createdAt) as lastAction, MIN(createdAt) as firstAction FROM userMarketAwarenessActions GROUP BY userId'
  );
  console.log('=== MARKET AWARENESS ===');
  console.log(JSON.stringify(awareness, null, 2));

  await conn.end();
}

main().catch(console.error);
