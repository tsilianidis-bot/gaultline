CREATE TABLE `sharedReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`reportType` varchar(32) NOT NULL,
	`subject` varchar(64) NOT NULL,
	`publicShareId` varchar(32) NOT NULL,
	`snapshotJson` text NOT NULL,
	`expiresAt` timestamp,
	`viewCount` int NOT NULL DEFAULT 0,
	`revoked` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sharedReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `sharedReports_publicShareId_unique` UNIQUE(`publicShareId`)
);
