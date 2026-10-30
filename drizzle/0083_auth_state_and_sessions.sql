-- OAuth state and browser-session invalidation for the release candidate.
-- Apply only through the reviewed ordered Drizzle journal. No application
-- startup path may create or repair this schema.
CREATE TABLE `oauthAuthorizationStates` (
  `stateHash` varchar(64) NOT NULL,
  `verifierHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `oauthAuthorizationStates_stateHash` PRIMARY KEY(`stateHash`)
);
--> statement-breakpoint
CREATE INDEX `oauthAuthorizationStates_expiresAt_idx`
  ON `oauthAuthorizationStates` (`expiresAt`);
--> statement-breakpoint
CREATE TABLE `authSessions` (
  `sessionIdHash` varchar(64) NOT NULL,
  `openId` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `authSessions_sessionIdHash` PRIMARY KEY(`sessionIdHash`)
);
--> statement-breakpoint
CREATE INDEX `authSessions_openId_expiresAt_idx`
  ON `authSessions` (`openId`,`expiresAt`);
--> statement-breakpoint
CREATE INDEX `authSessions_expiresAt_idx`
  ON `authSessions` (`expiresAt`);
