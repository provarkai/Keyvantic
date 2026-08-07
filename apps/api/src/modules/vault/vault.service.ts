import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as crypto from "crypto";
import { FileClassification } from "@prisma/client";
import type { JwtUserPayload } from "@keyvantic/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../../common/access/access.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AuditService } from "../audit/audit.service";
import { CryptoService } from "./crypto.service";
import { StorageService } from "./storage.service";
import { ExtractionService } from "./extraction.service";
import { UploadFileDto } from "./dto/upload-file.dto";

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ITEM_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  classification: true,
  confidentiality: true,
  currentVersion: true,
  engagementId: true,
  categoryId: true,
  documentId: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, fullName: true, avatarUrl: true } },
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 1,
    select: {
      versionNumber: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      checksumSha256: true,
      scanStatus: true,
      createdAt: true,
    },
  },
};

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private audit: AuditService,
    private crypto: CryptoService,
    private storage: StorageService,
    private extraction: ExtractionService,
  ) {}

  async list(actor: JwtUserPayload, filters: { engagementId?: string; documentId?: string }) {
    const where = await this.access.vaultItemWhere(actor);

    return this.prisma.vaultItem.findMany({
      where: {
        AND: [
          where,
          filters.engagementId ? { engagementId: filters.engagementId } : {},
          filters.documentId ? { documentId: filters.documentId } : {},
        ],
      },
      select: ITEM_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findById(id: string, actor: JwtUserPayload) {
    await this.access.requireReadableVaultItem(id, actor);

    const item = await this.prisma.vaultItem.findUnique({
      where: { id },
      select: {
        ...ITEM_LIST_SELECT,
        versions: {
          orderBy: { versionNumber: "desc" as const },
          select: {
            id: true,
            versionNumber: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            checksumSha256: true,
            scanStatus: true,
            createdAt: true,
            uploadedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException("File not found");
    return item;
  }

  /**
   * Store a new file.
   *
   * Order matters: encrypt, then store, then record. If the write to object storage
   * fails, no row is created and no key is leaked; if the database write fails, the
   * stored object is orphaned but unreadable without its row, and a later sweep can
   * collect it. The reverse order would leave a row pointing at nothing.
   */
  async upload(file: UploadedFile, dto: UploadFileDto, actor: JwtUserPayload) {
    const tenantId = TenantContext.requireTenantId();
    this.assertUploadable(file, dto);

    if (dto.engagementId) {
      // Filing into an engagement puts the file behind that boundary, so the uploader
      // has to be on the team — the same rule authored documents follow.
      await this.access.requireEngagementWriteAccess(dto.engagementId, actor);
    }

    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const extractedText =
      dto.classification === FileClassification.SEALED
        ? null
        : await this.extraction.extract(file.buffer, file.mimetype, file.originalname);

    const encrypted = await this.crypto.encrypt(file.buffer);

    const item = await this.prisma.tenantTransaction(async (tx) =>
      tx.vaultItem.create({
        data: {
          tenantId,
          name: dto.name ?? file.originalname,
          description: dto.description,
          categoryId: dto.categoryId,
          engagementId: dto.engagementId,
          documentId: dto.documentId,
          classification: dto.classification ?? FileClassification.WORKING,
          confidentiality: dto.confidentiality,
          currentVersion: 1,
          uploadedById: actor.sub,
        },
      }),
    );

    const storageKey = this.storage.buildKey(tenantId, item.id, 1);
    await this.storage.put(storageKey, encrypted.ciphertext);

    await this.prisma.vaultFileVersion.create({
      data: {
        tenantId,
        vaultItemId: item.id,
        versionNumber: 1,
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksumSha256: checksum,
        wrappedDek: encrypted.wrappedDek,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        extractedText,
        // No scanner is wired up yet. Marking these SKIPPED rather than CLEAN keeps
        // the distinction between "scanned and safe" and "never scanned" honest.
        scanStatus: "SKIPPED",
        uploadedById: actor.sub,
      },
    });

    await this.audit.log({
      actorId: actor.sub,
      action: "CREATE",
      entityType: "VaultItem",
      entityId: item.id,
      metadata: { name: item.name, sizeBytes: file.size, mimeType: file.mimetype },
    });

    return this.findById(item.id, actor);
  }

  /** Adds a version rather than replacing bytes, so prior sends stay reconstructable. */
  async addVersion(id: string, file: UploadedFile, actor: JwtUserPayload) {
    const tenantId = TenantContext.requireTenantId();
    const item = await this.access.requireReadableVaultItem(id, actor);
    this.assertUploadable(file, { classification: item.classification });

    if (item.engagementId) {
      await this.access.requireEngagementWriteAccess(item.engagementId, actor);
    }

    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const extractedText =
      item.classification === FileClassification.SEALED
        ? null
        : await this.extraction.extract(file.buffer, file.mimetype, file.originalname);
    const encrypted = await this.crypto.encrypt(file.buffer);

    const versionNumber = item.currentVersion + 1;
    const storageKey = this.storage.buildKey(tenantId, item.id, versionNumber);
    await this.storage.put(storageKey, encrypted.ciphertext);

    await this.prisma.tenantTransaction(async (tx) => {
      await tx.vaultFileVersion.create({
        data: {
          tenantId,
          vaultItemId: item.id,
          versionNumber,
          storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksumSha256: checksum,
          wrappedDek: encrypted.wrappedDek,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          extractedText,
          scanStatus: "SKIPPED",
          uploadedById: actor.sub,
        },
      });
      await tx.vaultItem.update({
        where: { id: item.id },
        data: { currentVersion: versionNumber },
      });
    });

    await this.audit.log({
      actorId: actor.sub,
      action: "VERSION_CREATE",
      entityType: "VaultItem",
      entityId: item.id,
      metadata: { versionNumber, sizeBytes: file.size },
    });

    return this.findById(item.id, actor);
  }

  /**
   * Decrypt and return a file's bytes.
   *
   * Every call is audited before the bytes are handed over, because "who downloaded
   * this and when" is the question a firm needs answered after an incident.
   */
  async download(id: string, actor: JwtUserPayload, versionNumber?: number) {
    const item = await this.access.requireReadableVaultItem(id, actor);

    const version = await this.prisma.vaultFileVersion.findFirst({
      where: {
        vaultItemId: item.id,
        versionNumber: versionNumber ?? item.currentVersion,
      },
    });
    if (!version) throw new NotFoundException("File version not found");

    const ciphertext = await this.storage.get(version.storageKey);
    const plaintext = await this.crypto.decrypt({
      ciphertext,
      wrappedDek: Buffer.from(version.wrappedDek),
      iv: Buffer.from(version.iv),
      authTag: Buffer.from(version.authTag),
    });

    // Detects corruption in storage that GCM would not: the authenticated decrypt
    // proves the bytes are the ones we encrypted, this proves they are the ones the
    // user uploaded.
    const checksum = crypto.createHash("sha256").update(plaintext).digest("hex");
    if (checksum !== version.checksumSha256) {
      this.logger.error(
        `Checksum mismatch for vault file ${item.id} v${version.versionNumber} — refusing to serve`,
      );
      throw new BadRequestException("Stored file failed its integrity check");
    }

    await this.audit.log({
      actorId: actor.sub,
      action: "EXPORT",
      entityType: "VaultItem",
      entityId: item.id,
      metadata: { versionNumber: version.versionNumber, originalName: version.originalName },
    });

    return {
      buffer: plaintext,
      filename: version.originalName,
      mimeType: version.mimeType,
    };
  }

  async remove(id: string, actor: JwtUserPayload) {
    const item = await this.access.requireReadableVaultItem(id, actor);
    if (item.engagementId) {
      await this.access.requireEngagementWriteAccess(item.engagementId, actor);
    }

    // Soft delete only. Stored objects are left in place: retention rules and legal
    // hold are not built yet, and destroying bytes on a user action would be the
    // wrong default for a firm with disclosure obligations.
    await this.prisma.vaultItem.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      actorId: actor.sub,
      action: "DELETE",
      entityType: "VaultItem",
      entityId: id,
      metadata: { name: item.name },
    });

    return { success: true };
  }

  private assertUploadable(file: UploadedFile, dto: { classification?: FileClassification }) {
    if (!file?.buffer?.length) throw new BadRequestException("Empty file");

    if (dto.classification === FileClassification.SEALED) {
      // Storing a server-readable file under a name that promises otherwise is worse
      // than not offering the tier at all.
      throw new BadRequestException(
        "SEALED files must be encrypted in the browser before upload, which is not yet " +
          "implemented. Upload as WORKING, or wait for client-side encryption.",
      );
    }
  }
}
