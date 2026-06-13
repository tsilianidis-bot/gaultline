ALTER TABLE `cryptoWatchlist` ADD CONSTRAINT `cryptoWatchlist_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mobileWatchlist` ADD CONSTRAINT `mobileWatchlist_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userMarketAwarenessActions` ADD CONSTRAINT `userMarketAwarenessActions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analyticsSessions_startedAt_idx` ON `analyticsSessions` (`startedAt`);--> statement-breakpoint
CREATE INDEX `analyticsSessions_userId_idx` ON `analyticsSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `cryptoWatchlist_userId_idx` ON `cryptoWatchlist` (`userId`);--> statement-breakpoint
CREATE INDEX `cryptoWatchlist_userId_symbol_idx` ON `cryptoWatchlist` (`userId`,`symbol`);--> statement-breakpoint
CREATE INDEX `mobileWatchlist_userId_idx` ON `mobileWatchlist` (`userId`);--> statement-breakpoint
CREATE INDEX `mobileWatchlist_userId_symbol_idx` ON `mobileWatchlist` (`userId`,`symbol`);--> statement-breakpoint
CREATE INDEX `pageViews_path_createdAt_idx` ON `pageViews` (`path`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pageViews_sessionId_idx` ON `pageViews` (`sessionId`);--> statement-breakpoint
CREATE INDEX `pageViews_userId_createdAt_idx` ON `pageViews` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `positions_userId_idx` ON `positions` (`userId`);--> statement-breakpoint
CREATE INDEX `positions_ticker_idx` ON `positions` (`ticker`);--> statement-breakpoint
CREATE INDEX `siteEvents_eventName_createdAt_idx` ON `siteEvents` (`eventName`,`createdAt`);--> statement-breakpoint
CREATE INDEX `siteEvents_userId_idx` ON `siteEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `marketAwareness_userId_completedAt_idx` ON `userMarketAwarenessActions` (`userId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `marketAwareness_actionKey_idx` ON `userMarketAwarenessActions` (`actionKey`);