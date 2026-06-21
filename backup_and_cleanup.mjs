/**
 * FAULTLINE — Blog Post Backup & Duplicate Cleanup Script
 * Run from project root: node backup_and_cleanup.mjs
 *
 * Steps:
 *   1. Export full blogPosts table to /home/ubuntu/blogposts_backup_pre_cleanup.json
 *   2. Log pre-state: all published post IDs
 *   3. Execute unpublish SQL for 20 confirmed duplicates + test canonical 1080001
 *   4. Log post-state: verify exactly 31 posts remain published
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Step 1: Full backup ──────────────────────────────────────────────────────
console.log('\n=== STEP 1: FULL BACKUP ===');
const [allRows] = await conn.execute('SELECT * FROM blogPosts ORDER BY id ASC');
const backupPath = '/home/ubuntu/blogposts_backup_pre_cleanup.json';
fs.writeFileSync(backupPath, JSON.stringify(allRows, null, 2));
console.log(`✅ Backup written: ${backupPath} (${allRows.length} total rows)`);

// ── Step 2: Pre-state log ────────────────────────────────────────────────────
console.log('\n=== STEP 2: PRE-STATE (published posts) ===');
const [publishedPre] = await conn.execute(
  'SELECT id, title, slug, viewCount, publishedAt FROM blogPosts WHERE published = 1 ORDER BY id ASC'
);
console.log(`Published count before cleanup: ${publishedPre.length}`);
for (const p of publishedPre) {
  console.log(`  ID=${String(p.id).padStart(8)} | views=${p.viewCount} | date=${String(p.publishedAt).slice(0,10)} | ${p.title.slice(0,60)}`);
}

// ── Step 3: Unpublish confirmed duplicates ───────────────────────────────────
console.log('\n=== STEP 3: UNPUBLISHING CONFIRMED DUPLICATES ===');

// 20 confirmed duplicates (all 5 conditions verified) + test canonical 1080001
const idsToUnpublish = [
  60001,    // PCE/PPI May 27 — 99.4% identical to 60002 (7 views), same day
  120001,   // PCE Sticky May 28 — 100% identical to 120002 (3 views), same day
  210001,   // Iran Ceasefire May 29 — 100% identical to 210002 (7 views), same day
  240001,   // Inflation Surges May 30 — 100% identical to 240004 (1 view), same day
  240002,   // Inflation Surges May 30 — 100% identical to 240004 (1 view), same day
  240003,   // Inflation Surges May 30 — 100% identical to 240004 (1 view), same day
  270001,   // Inflation Surges May 30 — 100% identical to 240004 (1 view), same day
  360002,   // Geopolitical Whipsaw Jun 02 — 100% identical to 360001, same day
  390002,   // Fed Restrictive Jun 03 — 100% identical to 390001, same day
  390003,   // Fed Restrictive Jun 03 — 100% identical to 390001, same day
  390004,   // Fed Restrictive Jun 03 — 100% identical to 390001, same day
  450002,   // Labor Market Jun 05 — 100% identical to 450001 (1 view), same day
  480002,   // Jobs Shock Jun 06 — 100% identical to 480001 (3 views), same day
  600001,   // Fed Signals Delay Jun 10 — 100% identical to 600002 (1 view), same day
  660002,   // Fed Signals Delay Jun 12 — 100% identical to 660001, same day
  690002,   // CPI 4.2% Jun 13 — 100% identical to 690001, same day
  780002,   // US-Iran Deal Jun 15 — 100% identical to 780001, same day
  1050002,  // Warsh Shock Jun 19 — 100% identical to 1050001, same day
  1080001,  // Test post canonical — unpublish (contentClass=test)
  1080002,  // Test post duplicate — 100% identical to 1080001, same day
  1110002,  // Fed Signals Delay Jun 20 — 100% identical to 1110001, same day
];

console.log(`IDs to unpublish (${idsToUnpublish.length}): ${idsToUnpublish.join(', ')}`);

const placeholders = idsToUnpublish.map(() => '?').join(',');
const [updateResult] = await conn.execute(
  `UPDATE blogPosts SET published = 0 WHERE id IN (${placeholders})`,
  idsToUnpublish
);
console.log(`✅ Rows affected: ${updateResult.affectedRows}`);

// ── Step 4: Post-state log ───────────────────────────────────────────────────
console.log('\n=== STEP 4: POST-STATE (published posts) ===');
const [publishedPost] = await conn.execute(
  'SELECT id, title, slug, viewCount, publishedAt FROM blogPosts WHERE published = 1 ORDER BY id ASC'
);
console.log(`Published count after cleanup: ${publishedPost.length}`);
for (const p of publishedPost) {
  console.log(`  ID=${String(p.id).padStart(8)} | views=${p.viewCount} | date=${String(p.publishedAt).slice(0,10)} | ${p.title.slice(0,60)}`);
}

// ── Verification ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICATION ===');
const expectedCount = 31; // 52 total - 21 unpublished (20 dups + 1 test canonical)
if (publishedPost.length === expectedCount) {
  console.log(`✅ PASS: ${publishedPost.length} published posts (expected ${expectedCount})`);
} else {
  console.log(`⚠️  UNEXPECTED: ${publishedPost.length} published posts (expected ${expectedCount})`);
}

// Confirm none of the unpublished IDs are still published
const [stillPublished] = await conn.execute(
  `SELECT id FROM blogPosts WHERE published = 1 AND id IN (${placeholders})`,
  idsToUnpublish
);
if (stillPublished.length === 0) {
  console.log('✅ PASS: All targeted IDs are now unpublished');
} else {
  console.log(`❌ FAIL: These IDs are still published: ${stillPublished.map(r => r.id).join(', ')}`);
}

// Confirm canonicals are still published
const canonicalIds = [60002, 120002, 210002, 240004, 360001, 390001, 450001, 480001, 600002, 660001, 690001, 780001, 1050001, 1110001];
const [canonicalCheck] = await conn.execute(
  `SELECT id, published FROM blogPosts WHERE id IN (${canonicalIds.map(() => '?').join(',')})`,
  canonicalIds
);
const unpublishedCanonicals = canonicalCheck.filter(r => !r.published);
if (unpublishedCanonicals.length === 0) {
  console.log('✅ PASS: All canonical posts remain published');
} else {
  console.log(`❌ FAIL: These canonicals were accidentally unpublished: ${unpublishedCanonicals.map(r => r.id).join(', ')}`);
}

await conn.end();
console.log('\n=== CLEANUP COMPLETE ===\n');
