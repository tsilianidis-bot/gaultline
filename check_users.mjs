import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });
const users = await db.select({
  id: schema.users.id,
  name: schema.users.name,
  openId: schema.users.openId,
  role: schema.users.role,
  accessTier: schema.users.accessTier,
}).from(schema.users).limit(20);
console.log(JSON.stringify(users, null, 2));
await conn.end();
