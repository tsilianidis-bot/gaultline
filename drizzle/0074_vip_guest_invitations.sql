-- Issue #111: private, single-use VIP guest invitations.
-- Additive only. No users.accessTier, billing, checkout, scheduler, or public-registration change.
CREATE TABLE `vipGuestInvitations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `createdByUserId` int NOT NULL,
  `label` varchar(120),
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp,
  `revokedByUserId` int,
  `redeemedAt` timestamp,
  `redeemedByUserId` int,
  `redeemedByEmail` varchar(320),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `vip_guest_invitations_pk` PRIMARY KEY(`id`),
  CONSTRAINT `vip_guest_invites_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `vip_guest_invites_revoker_fk` FOREIGN KEY (`revokedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `vip_guest_invites_redeemer_fk` FOREIGN KEY (`redeemedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vip_guest_invites_token_hash_uniq` ON `vipGuestInvitations` (`tokenHash`);
--> statement-breakpoint
CREATE INDEX `vip_guest_invites_active_idx` ON `vipGuestInvitations` (`expiresAt`, `redeemedAt`, `revokedAt`);
--> statement-breakpoint
CREATE INDEX `vip_guest_invites_creator_idx` ON `vipGuestInvitations` (`createdByUserId`, `createdAt`);
--> statement-breakpoint
CREATE TABLE `vipGuestEntitlements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `invitationId` int NOT NULL,
  `userId` int NOT NULL,
  `grantedAt` timestamp NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `vip_guest_entitlements_pk` PRIMARY KEY(`id`),
  CONSTRAINT `vip_guest_entitlement_invite_fk` FOREIGN KEY (`invitationId`) REFERENCES `vipGuestInvitations`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `vip_guest_entitlement_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vip_guest_entitlements_invite_uniq` ON `vipGuestEntitlements` (`invitationId`);
--> statement-breakpoint
CREATE INDEX `vip_guest_entitlements_user_exp_idx` ON `vipGuestEntitlements` (`userId`, `expiresAt`);
