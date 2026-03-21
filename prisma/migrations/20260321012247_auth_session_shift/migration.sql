-- AlterTable
ALTER TABLE `auth_session` ADD COLUMN `shiftId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `AuthSession_shiftId_idx` ON `auth_session`(`shiftId`);

-- AddForeignKey
ALTER TABLE `auth_session` ADD CONSTRAINT `auth_session_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
