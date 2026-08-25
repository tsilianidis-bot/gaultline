ALTER TABLE `conversationMessages` ADD `responseId` varchar(255);--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `originatingStateId` varchar(255);--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `originatingEffectiveAt` timestamp;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `evidenceClaimIds` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `forecastClaimIds` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `historicalClaimIds` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `evidenceStrength` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `dataQuality` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `promptVersion` varchar(128);--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `modelIdentity` varchar(255);--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `generationAttempts` int;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `validationStatus` varchar(64);--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `validationIssues` text;--> statement-breakpoint
ALTER TABLE `conversationMessages` ADD `withheldClaimReasons` text;