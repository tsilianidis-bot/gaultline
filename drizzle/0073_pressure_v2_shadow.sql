-- Phase 3 (2026-10-13): Pressure Index v2 SHADOW forward record (FL-PI-v2-research-0).
-- REQUIRES FOUNDER APPROVAL TO APPLY. Additive only: creates one new table; touches no existing table.
-- Not applied automatically on deploy (no migrate step in the start/build scripts).
CREATE TABLE `pressureV2ShadowObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`asOfDate` varchar(10) NOT NULL,
	`onSpecGrid` boolean NOT NULL DEFAULT false,
	`recordClass` enum('FORWARD_LIVE') NOT NULL DEFAULT 'FORWARD_LIVE',
	`specId` varchar(64) NOT NULL,
	`specSha256` varchar(64) NOT NULL,
	`implementationVersion` varchar(40) NOT NULL,
	`referenceSha256` varchar(64) NOT NULL,
	`runTrigger` varchar(30) NOT NULL,
	`status` enum('computed','unavailable') NOT NULL,
	`v2Score` decimal(6,2),
	`band` varchar(40),
	`nPillars` int NOT NULL,
	`pillarsJson` text NOT NULL,
	`benchmarksJson` text NOT NULL,
	`inputProvenanceJson` text NOT NULL,
	`unavailableReason` text,
	`v1Pressure` int,
	`v1MethodologyVersion` varchar(60),
	CONSTRAINT `pressureV2ShadowObservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pressureV2Shadow_asOf_idx` ON `pressureV2ShadowObservations` (`asOfDate`);
