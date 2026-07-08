CREATE TABLE `conversationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`userTier` enum('free','core','premium','founding','anonymous') NOT NULL DEFAULT 'anonymous',
	`module` varchar(64),
	`pagePath` varchar(255),
	`symbolsMentioned` text,
	`topics` text,
	`messageCount` int NOT NULL DEFAULT 0,
	`upgradedAfter` boolean NOT NULL DEFAULT false,
	`upgradedToTier` varchar(32),
	`avgConfidenceScore` double,
	`avgResponseTimeMs` double,
	`hasQualityFlag` boolean NOT NULL DEFAULT false,
	`retentionExpiresAt` timestamp,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversationMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`responseTimeMs` int,
	`confidenceScore` double,
	`hasFollowUp` boolean NOT NULL DEFAULT false,
	`topicClusterKey` varchar(64),
	`symbolsMentioned` varchar(255),
	`qualityFlag` enum('hallucination','low_confidence','error','unanswered','off_topic'),
	`userRating` tinyint,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversationMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversationRetentionPolicy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`retentionDays` int NOT NULL DEFAULT 90,
	`anonymizeOnExpiry` boolean NOT NULL DEFAULT true,
	`loggingEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `conversationRetentionPolicy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featureRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestText` text NOT NULL,
	`normalizedText` varchar(255) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`priorityScore` double NOT NULL DEFAULT 0,
	`status` enum('new','under_review','planned','in_progress','shipped','wont_do') NOT NULL DEFAULT 'new',
	`category` varchar(64),
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `featureRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topicClusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterKey` varchar(128) NOT NULL,
	`label` varchar(128) NOT NULL,
	`exampleQuestions` text,
	`count` int NOT NULL DEFAULT 0,
	`trend7d` int NOT NULL DEFAULT 0,
	`avgConfidence` double,
	`isUnanswered` boolean NOT NULL DEFAULT false,
	`hasHighFollowUp` boolean NOT NULL DEFAULT false,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topicClusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `topicClusters_clusterKey_unique` UNIQUE(`clusterKey`)
);
--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD CONSTRAINT `conversationMessages_conversationId_conversationLogs_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversationLogs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cl_session_idx` ON `conversationLogs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `cl_user_idx` ON `conversationLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `cl_started_idx` ON `conversationLogs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `cl_tier_idx` ON `conversationLogs` (`userTier`);--> statement-breakpoint
CREATE INDEX `cm_conv_idx` ON `conversationMessages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `cm_topic_idx` ON `conversationMessages` (`topicClusterKey`);--> statement-breakpoint
CREATE INDEX `cm_time_idx` ON `conversationMessages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `fr_priority_idx` ON `featureRequests` (`priorityScore`);--> statement-breakpoint
CREATE INDEX `fr_status_idx` ON `featureRequests` (`status`);--> statement-breakpoint
CREATE INDEX `tc_key_idx` ON `topicClusters` (`clusterKey`);--> statement-breakpoint
CREATE INDEX `tc_count_idx` ON `topicClusters` (`count`);