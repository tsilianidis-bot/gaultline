import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS promoCampaigns (
    id INT AUTO_INCREMENT NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    trialTier ENUM('free','core','premium','founding') NOT NULL DEFAULT 'premium',
    trialDays INT NOT NULL DEFAULT 30,
    maxRedemptions INT NOT NULL DEFAULT 100,
    redemptionCount INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(100),
    milestones VARCHAR(100) DEFAULT '75,90,100',
    milestonesNotified TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY promoCampaigns_code_unique (code)
  )`,
  `CREATE TABLE IF NOT EXISTS promoRedemptions (
    id INT AUTO_INCREMENT NOT NULL,
    campaignId INT NOT NULL,
    userId INT NOT NULL,
    redemptionNumber INT NOT NULL,
    email VARCHAR(320) NOT NULL,
    name VARCHAR(200),
    activatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
    trialExpiresAt TIMESTAMP NOT NULL,
    engaged BOOLEAN NOT NULL DEFAULT FALSE,
    converted BOOLEAN NOT NULL DEFAULT FALSE,
    stripeSubscriptionId VARCHAR(64),
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY promoRedemptions_userId_campaignId_uniq (userId, campaignId),
    UNIQUE KEY promoRedemptions_email_campaignId_uniq (email, campaignId),
    CONSTRAINT promoRedemptions_campaignId_fk FOREIGN KEY (campaignId) REFERENCES promoCampaigns(id),
    CONSTRAINT promoRedemptions_userId_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS promoRedemptions_campaignId_idx ON promoRedemptions (campaignId)`,
  `CREATE INDEX IF NOT EXISTS promoRedemptions_userId_idx ON promoRedemptions (userId)`,
  `INSERT IGNORE INTO promoCampaigns (code, description, trialTier, trialDays, maxRedemptions, redemptionCount, active, source, milestones, milestonesNotified)
   VALUES ('FACEBOOK30', 'Free 30-day FAULTLINE premium membership — Facebook campaign', 'premium', 30, 100, 0, TRUE, 'Personal Facebook page', '75,90,100', '[]')`,
];

for (const sql of statements) {
  try {
    await db.execute(sql);
    console.log("✓", sql.trim().slice(0, 60));
  } catch (e) {
    console.error("✗", e.message, "\n  SQL:", sql.trim().slice(0, 80));
  }
}

await db.end();
console.log("Migration complete.");
