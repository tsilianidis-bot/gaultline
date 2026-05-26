CREATE TABLE `xPostQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postType` enum('premarket','midday','closing','breaking') NOT NULL,
	`variant` enum('short','thread','founder','institutional','breaking') NOT NULL,
	`content` text NOT NULL,
	`headline` varchar(500),
	`status` enum('pending','posted','failed','skipped') NOT NULL DEFAULT 'pending',
	`xPostId` varchar(64),
	`errorMsg` text,
	`pressureScore` int,
	`pressureRegime` varchar(100),
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xPostQueue_id` PRIMARY KEY(`id`)
);
