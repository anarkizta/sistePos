-- AlterTable
ALTER TABLE `action_authorization` ADD COLUMN `usedAction` VARCHAR(80) NULL,
    ADD COLUMN `usedAt` DATETIME(3) NULL;
