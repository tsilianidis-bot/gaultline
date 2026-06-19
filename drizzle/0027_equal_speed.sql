CREATE TABLE `visitorProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`visitCount` int NOT NULL DEFAULT 1,
	`totalPages` int NOT NULL DEFAULT 1,
	`country` varchar(4),
	`countryName` varchar(80),
	`city` varchar(80),
	`region` varchar(80),
	`deviceType` varchar(16),
	`browser` varchar(32),
	`os` varchar(32),
	`firstReferrer` varchar(1024),
	`firstUtmSource` varchar(128),
	`firstUtmMedium` varchar(128),
	`firstUtmCampaign` varchar(128),
	`converted` int NOT NULL DEFAULT 0,
	`convertedAt` timestamp,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitorProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitorProfiles_visitorId_unique` UNIQUE(`visitorId`)
);
--> statement-breakpoint
CREATE INDEX `visitorProfiles_visitorId_idx` ON `visitorProfiles` (`visitorId`);--> statement-breakpoint
CREATE INDEX `visitorProfiles_country_idx` ON `visitorProfiles` (`country`);--> statement-breakpoint
CREATE INDEX `visitorProfiles_lastSeenAt_idx` ON `visitorProfiles` (`lastSeenAt`);