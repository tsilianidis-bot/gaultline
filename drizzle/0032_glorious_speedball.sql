CREATE TABLE `chatbot_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`interest` text,
	`leadScore` int NOT NULL DEFAULT 0,
	`planInterest` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatbot_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','bot') NOT NULL,
	`content` text NOT NULL,
	`intent` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatbot_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`pageUrl` varchar(512),
	`email` varchar(320),
	`userId` int,
	`leadScore` int NOT NULL DEFAULT 0,
	`signupIntent` tinyint NOT NULL DEFAULT 0,
	`pricingIntent` tinyint NOT NULL DEFAULT 0,
	`securitiesMentioned` varchar(512),
	`planInterest` varchar(32),
	`conversionStatus` enum('none','lead','signup','paid') NOT NULL DEFAULT 'none',
	`reviewed` tinyint NOT NULL DEFAULT 0,
	`adminNote` text,
	`messageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chatbot_leads_session_idx` ON `chatbot_leads` (`sessionId`);--> statement-breakpoint
CREATE INDEX `chatbot_leads_email_idx` ON `chatbot_leads` (`email`);--> statement-breakpoint
CREATE INDEX `chatbot_messages_session_idx` ON `chatbot_messages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `chatbot_sessions_visitor_idx` ON `chatbot_sessions` (`visitorId`);--> statement-breakpoint
CREATE INDEX `chatbot_sessions_created_idx` ON `chatbot_sessions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `chatbot_sessions_lead_score_idx` ON `chatbot_sessions` (`leadScore`);--> statement-breakpoint
CREATE INDEX `chatbot_sessions_status_idx` ON `chatbot_sessions` (`conversionStatus`);