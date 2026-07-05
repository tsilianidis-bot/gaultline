CREATE TABLE `onboardingEmailSequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`step` int NOT NULL,
	`sentAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboardingEmailSequence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `oes_user_step_idx` ON `onboardingEmailSequence` (`userId`,`step`);