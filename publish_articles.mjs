/**
 * publish_articles.mjs
 * Reads the 20 written evergreen articles from write_evergreen_articles.json
 * and inserts them into the blogPosts table with contentClass='evergreen'.
 * 
 * Run: node publish_articles.mjs
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse mysql://user:pass@host:port/dbname
const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  ssl: { rejectUnauthorized: false },
});

const raw = JSON.parse(readFileSync('/home/ubuntu/write_evergreen_articles.json', 'utf8'));
const articles = raw.results.map(r => r.output);

console.log(`Publishing ${articles.length} evergreen articles...`);

let published = 0;
let skipped = 0;
const errors = [];

for (const article of articles) {
  const slug = article.slug;
  
  // Check if slug already exists
  const [existing] = await conn.execute(
    'SELECT id FROM blogPosts WHERE slug = ?',
    [slug]
  );
  
  if (existing.length > 0) {
    console.log(`  SKIP (exists): ${slug}`);
    skipped++;
    continue;
  }
  
  // Calculate read time (avg 250 words/min)
  const wordCount = article.word_count || 2000;
  const readTime = Math.max(1, Math.ceil(wordCount / 250));
  
  // Clean up title (remove "Article N — PILLAR/SUPPORTING:" prefix if present)
  const title = article.title
    .replace(/^Article \d+ — (PILLAR|SUPPORTING): /, '')
    .replace(/^'|'$/g, '')
    .trim();
  
  // Determine category based on tags
  const tags = article.tags || '';
  let category = 'Market Analysis';
  if (tags.toLowerCase().includes('ai') || tags.toLowerCase().includes('bubble')) {
    category = 'AI & Markets';
  } else if (tags.toLowerCase().includes('crypto') || tags.toLowerCase().includes('bitcoin') || tags.toLowerCase().includes('altcoin')) {
    category = 'Crypto Intelligence';
  } else if (tags.toLowerCase().includes('recession') || tags.toLowerCase().includes('macro')) {
    category = 'Macro Intelligence';
  } else if (tags.toLowerCase().includes('risk') || tags.toLowerCase().includes('position')) {
    category = 'Risk Management';
  } else if (tags.toLowerCase().includes('psychology') || tags.toLowerCase().includes('trading')) {
    category = 'Trading Psychology';
  } else if (tags.toLowerCase().includes('liquidity') || tags.toLowerCase().includes('fed')) {
    category = 'Macro Intelligence';
  }

  try {
    await conn.execute(
      `INSERT INTO blogPosts 
        (slug, title, content, author, category, tags, published, publishedAt, contentClass, 
         metaTitle, metaDescription, readTimeMinutes, createdAt, updatedAt)
       VALUES (?, ?, ?, 'FAULTLINE', ?, ?, 1, NOW(), 'evergreen', ?, ?, ?, NOW(), NOW())`,
      [
        slug,
        title,
        article.content,
        category,
        tags,
        (article.seo_title || title).substring(0, 70),
        (article.meta_description || '').substring(0, 165),
        readTime,
      ]
    );
    
    console.log(`  ✓ Published: ${slug} (${wordCount} words, ${readTime} min read)`);
    published++;
  } catch (err) {
    console.error(`  ✗ Error publishing ${slug}: ${err.message}`);
    errors.push({ slug, error: err.message });
  }
}

await conn.end();

console.log('\n=== PUBLISH SUMMARY ===');
console.log(`Published: ${published}`);
console.log(`Skipped (already exists): ${skipped}`);
console.log(`Errors: ${errors.length}`);
if (errors.length > 0) {
  console.log('Errors:', JSON.stringify(errors, null, 2));
}

// Verify final count
const conn2 = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  ssl: { rejectUnauthorized: false },
});

const [rows] = await conn2.execute(
  "SELECT contentClass, COUNT(*) as cnt FROM blogPosts WHERE published=1 GROUP BY contentClass"
);
console.log('\nPublished posts by class:');
rows.forEach(r => console.log(`  ${r.contentClass}: ${r.cnt}`));
await conn2.end();
