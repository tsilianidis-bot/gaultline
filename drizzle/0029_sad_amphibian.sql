CREATE TABLE `contentCtaClicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageSlug` varchar(300) NOT NULL,
	`ctaType` enum('start_free','demo','pricing','related_tool') NOT NULL,
	`visitorId` varchar(64),
	`userId` int,
	`country` varchar(4),
	`deviceType` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contentCtaClicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organicContent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentType` varchar(60) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`title` varchar(300) NOT NULL,
	`metaDescription` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`schemaJson` text,
	`internalLinksJson` text,
	`featuredImagePrompt` text,
	`status` enum('draft','published','rejected') NOT NULL DEFAULT 'draft',
	`qualityScore` int,
	`wordCount` int,
	`duplicateOf` int,
	`rejectionReason` varchar(200),
	`pressureScore` int,
	`regime` varchar(80),
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organicContent_id` PRIMARY KEY(`id`),
	CONSTRAINT `organicContent_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `signalPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`assetType` enum('stock','crypto') NOT NULL,
	`name` varchar(128),
	`signalSummary` text,
	`bullishCase` text,
	`bearishCase` text,
	`macroRisks` text,
	`technicalRisks` text,
	`catalystAnalysis` text,
	`confidenceScore` int,
	`faqJson` text,
	`signalLabel` varchar(20),
	`lastPrice` decimal(14,4),
	`dailyChangePct` decimal(8,4),
	`pressureScore` int,
	`regime` varchar(80),
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signalPages_id` PRIMARY KEY(`id`),
	CONSTRAINT `signalPages_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
ALTER TABLE `blogPosts` ADD `contentClass` enum('evergreen','intel_record','test') DEFAULT 'intel_record' NOT NULL;--> statement-breakpoint
ALTER TABLE `blogPosts` ADD `metaTitle` varchar(70);--> statement-breakpoint
ALTER TABLE `blogPosts` ADD `metaDescription` varchar(165);--> statement-breakpoint
ALTER TABLE `blogPosts` ADD `readTimeMinutes` int;--> statement-breakpoint
CREATE INDEX `contentCtaClicks_pageSlug_idx` ON `contentCtaClicks` (`pageSlug`);--> statement-breakpoint
CREATE INDEX `contentCtaClicks_ctaType_idx` ON `contentCtaClicks` (`ctaType`);--> statement-breakpoint
CREATE INDEX `contentCtaClicks_createdAt_idx` ON `contentCtaClicks` (`createdAt`);--> statement-breakpoint
CREATE INDEX `organicContent_slug_idx` ON `organicContent` (`slug`);--> statement-breakpoint
CREATE INDEX `organicContent_type_status_idx` ON `organicContent` (`contentType`,`status`);--> statement-breakpoint
CREATE INDEX `organicContent_publishedAt_idx` ON `organicContent` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `signalPages_symbol_idx` ON `signalPages` (`symbol`);--> statement-breakpoint
CREATE INDEX `signalPages_assetType_idx` ON `signalPages` (`assetType`);