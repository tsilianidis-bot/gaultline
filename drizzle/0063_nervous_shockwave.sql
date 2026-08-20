CREATE TABLE `forecastObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`forecastKey` varchar(220) NOT NULL,
	`sourceType` varchar(96) NOT NULL,
	`sourceKey` varchar(220) NOT NULL,
	`sourceModel` varchar(128) NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`evidenceClass` enum('OBSERVED','DERIVED','HISTORICAL','INTERPRETED','FORECAST') NOT NULL,
	`horizonStatus` enum('SUPPORTED','NOT_ESTABLISHED','INSUFFICIENT_EVIDENCE') NOT NULL,
	`forecastGeneratedAt` timestamp NOT NULL,
	`forecastExpiresAt` timestamp,
	`originalForecastJson` text NOT NULL,
	`sourceVersionsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecastObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `forecastObservations_forecastKey_unique` UNIQUE(`forecastKey`)
);
--> statement-breakpoint
CREATE TABLE `forecastResolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resolutionKey` varchar(220) NOT NULL,
	`forecastObservationId` int NOT NULL,
	`resolutionStatus` enum('PENDING','TARGET_REACHED','INVALIDATED','EXPIRED','UNAVAILABLE') NOT NULL,
	`resolvedAt` timestamp NOT NULL,
	`outcomeValueJson` text NOT NULL,
	`sourceVersionsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecastResolutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `forecastResolutions_resolutionKey_unique` UNIQUE(`resolutionKey`)
);
--> statement-breakpoint
ALTER TABLE `forecastResolutions` ADD CONSTRAINT `forecastResolutions_observation_fk` FOREIGN KEY (`forecastObservationId`) REFERENCES `forecastObservations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `forecastObservations_source_idx` ON `forecastObservations` (`sourceType`,`sourceKey`);--> statement-breakpoint
CREATE INDEX `forecastObservations_generated_idx` ON `forecastObservations` (`forecastGeneratedAt`);--> statement-breakpoint
CREATE INDEX `forecastResolutions_observation_idx` ON `forecastResolutions` (`forecastObservationId`);--> statement-breakpoint
CREATE INDEX `forecastResolutions_resolved_idx` ON `forecastResolutions` (`resolvedAt`);