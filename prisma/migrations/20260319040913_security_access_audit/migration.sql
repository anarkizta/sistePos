-- CreateTable
CREATE TABLE `store` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Store_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `terminal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Terminal_storeId_idx`(`storeId`),
    UNIQUE INDEX `Terminal_storeId_code_key`(`storeId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `credentialType` ENUM('PIN', 'PASSWORD') NOT NULL DEFAULT 'PASSWORD',
    `pinHash` VARCHAR(255) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_user` (
    `storeId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `StoreUser_userId_idx`(`userId`),
    PRIMARY KEY (`storeId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
    `userId` INTEGER NOT NULL,
    `roleId` INTEGER NOT NULL,

    INDEX `UserRole_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permission` (
    `roleId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,

    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permission_override` (
    `userId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `effect` ENUM('ALLOW', 'DENY') NOT NULL,
    `createdByUserId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserPermissionOverride_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`userId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `storeId` INTEGER NULL,
    `terminalId` INTEGER NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `endReason` ENUM('LOGOUT', 'TIMEOUT', 'FORCED') NULL,

    INDEX `AuthSession_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
    INDEX `AuthSession_terminalId_idx`(`terminalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `username` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(80) NULL,
    `ip` VARCHAR(64) NULL,
    `terminalId` INTEGER NULL,

    INDEX `LoginAttempt_username_createdAt_idx`(`username`, `createdAt`),
    INDEX `LoginAttempt_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `terminalId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `openingCashAmount` DECIMAL(12, 2) NOT NULL,
    `closingCashAmount` DECIMAL(12, 2) NULL,

    INDEX `Shift_storeId_openedAt_idx`(`storeId`, `openedAt`),
    INDEX `Shift_userId_openedAt_idx`(`userId`, `openedAt`),
    INDEX `Shift_terminalId_openedAt_idx`(`terminalId`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `action_authorization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestedByUserId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `permissionCode` VARCHAR(80) NOT NULL,
    `contextJson` JSON NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `authorizedAt` DATETIME(3) NULL,
    `authorizedByUserId` INTEGER NULL,

    INDEX `ActionAuthorization_requestedByUserId_requestedAt_idx`(`requestedByUserId`, `requestedAt`),
    INDEX `ActionAuthorization_status_requestedAt_idx`(`status`, `requestedAt`),
    INDEX `ActionAuthorization_shiftId_idx`(`shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `result` ENUM('SUCCESS', 'FAIL') NOT NULL DEFAULT 'SUCCESS',
    `actorUserId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `impersonatorUserId` INTEGER NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` INTEGER NULL,
    `message` VARCHAR(255) NULL,
    `dataJson` JSON NULL,

    INDEX `AuditEvent_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditEvent_shiftId_createdAt_idx`(`shiftId`, `createdAt`),
    INDEX `AuditEvent_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `AuditEvent_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_event_field` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `auditEventId` INTEGER NOT NULL,
    `fieldPath` VARCHAR(200) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,

    INDEX `AuditEventField_auditEventId_idx`(`auditEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `terminal` ADD CONSTRAINT `terminal_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_user` ADD CONSTRAINT `store_user_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_user` ADD CONSTRAINT `store_user_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_session` ADD CONSTRAINT `auth_session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_session` ADD CONSTRAINT `auth_session_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_session` ADD CONSTRAINT `auth_session_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `terminal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempt` ADD CONSTRAINT `login_attempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempt` ADD CONSTRAINT `login_attempt_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `terminal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift` ADD CONSTRAINT `shift_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift` ADD CONSTRAINT `shift_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `terminal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift` ADD CONSTRAINT `shift_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `action_authorization` ADD CONSTRAINT `action_authorization_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `action_authorization` ADD CONSTRAINT `action_authorization_authorizedByUserId_fkey` FOREIGN KEY (`authorizedByUserId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `action_authorization` ADD CONSTRAINT `action_authorization_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_event` ADD CONSTRAINT `audit_event_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_event` ADD CONSTRAINT `audit_event_impersonatorUserId_fkey` FOREIGN KEY (`impersonatorUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_event` ADD CONSTRAINT `audit_event_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_event_field` ADD CONSTRAINT `audit_event_field_auditEventId_fkey` FOREIGN KEY (`auditEventId`) REFERENCES `audit_event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
