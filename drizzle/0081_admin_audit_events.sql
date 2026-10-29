-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION: apply only through the reviewed,
-- ordered journal after independent QA; never at app boot, deploy, or manually.
--
-- Durable owner/admin mutation evidence. No foreign keys are used because an
-- audit event must survive a retained target-ID reference after user deletion.
-- Approval-email correlations are server-generated UUIDs, never recipient data.
CREATE TABLE `adminAuditEvents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actorUserId` int NOT NULL,
  `action` varchar(96) NOT NULL,
  `targetType` varchar(64) NOT NULL,
  `targetId` int,
  `targetKey` varchar(128),
  `correlationId` varchar(36),
  `beforeStateJson` text NOT NULL,
  `afterStateJson` text NOT NULL,
  `outcome` varchar(24) NOT NULL,
  `occurredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `adminAuditEvents_actor_occurredAt_idx` (`actorUserId`, `occurredAt`),
  KEY `adminAuditEvents_target_occurredAt_idx` (`targetType`, `targetId`, `occurredAt`),
  KEY `adminAuditEvents_action_occurredAt_idx` (`action`, `occurredAt`),
  UNIQUE KEY `adminAuditEvents_correlation_action_unique` (`correlationId`, `action`),
  CONSTRAINT `adminAuditEvents_before_json` CHECK (JSON_VALID(`beforeStateJson`)),
  CONSTRAINT `adminAuditEvents_after_json` CHECK (JSON_VALID(`afterStateJson`)),
  CONSTRAINT `adminAuditEvents_outcome` CHECK (`outcome` IN ('SUCCEEDED', 'FAILED', 'ATTEMPTED')),
  CONSTRAINT `adminAuditEvents_correlation_safe` CHECK (`correlationId` IS NULL OR `correlationId` REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TRIGGER `adminAuditEvents_append_only_update`
BEFORE UPDATE ON `adminAuditEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'adminAuditEvents append-only';
--> statement-breakpoint
CREATE TRIGGER `adminAuditEvents_append_only_delete`
BEFORE DELETE ON `adminAuditEvents`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'adminAuditEvents append-only';
