CREATE TABLE `blogPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(300) NOT NULL,
	`subtitle` varchar(400),
	`content` text NOT NULL,
	`author` varchar(100) NOT NULL DEFAULT 'FAULTLINE',
	`category` varchar(80) NOT NULL DEFAULT 'Macro Intelligence',
	`tags` text,
	`published` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blogPosts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blogPosts_slug_unique` UNIQUE(`slug`)
);
