import { Module } from "@nestjs/common";
import { VaultService } from "./vault.service";
import { VaultController } from "./vault.controller";
import { CryptoService } from "./crypto.service";
import { StorageService } from "./storage.service";
import { ExtractionService } from "./extraction.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [VaultController],
  providers: [VaultService, CryptoService, StorageService, ExtractionService],
  exports: [VaultService, CryptoService],
})
export class VaultModule {}
