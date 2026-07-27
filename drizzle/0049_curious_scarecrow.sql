ALTER TABLE `users` ADD `lifetimeAccess` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lifetimePurchasedAt` timestamp;