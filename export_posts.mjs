import mysql from "mysql2/promise";
import fs from "fs";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT 
    id, slug, title, subtitle, content, author, category, tags,
    publishedAt, viewCount, createdAt, LENGTH(content) as contentLength
  FROM blogPosts 
  WHERE published = 1 
  ORDER BY publishedAt DESC
`);

await conn.end();

fs.writeFileSync("/tmp/blog_posts.json", JSON.stringify(rows, null, 2));
console.log(`Exported ${rows.length} posts`);
