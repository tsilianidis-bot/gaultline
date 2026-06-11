CREATE TABLE `analyticsSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`entryPage` varchar(512),
	`exitPage` varchar(512),
	`pageCount` int NOT NULL DEFAULT 1,
	`durationSecs` int NOT NULL DEFAULT 0,
	`isBounce` int NOT NULL DEFAULT 1,
	`country` varchar(4),
	`deviceType` varchar(16),
	`browser` varchar(32),
	`os` varchar(32),
	`referrer` varchar(1024),
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `analyticsSessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `pageViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`path` varchar(512) NOT NULL,
	`title` varchar(256),
	`referrer` varchar(1024),
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	`country` varchar(4),
	`deviceType` varchar(16),
	`browser` varchar(32),
	`os` varchar(32),
	`screenWidth` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pageViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siteEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`eventName` varchar(128) NOT NULL,
	`props` text,
	`path` varchar(512),
	`country` varchar(4),
	`deviceType` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteEvents_id` PRIMARY KEY(`id`)
);
