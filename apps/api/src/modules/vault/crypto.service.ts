import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96 bits, the value GCM is specified for

export interface EncryptedPayload {
  ciphertext: Buffer;
  wrappedDek: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Envelope encryption for vault files, in three tiers:
 *
 *   deployment master key  →  per-tenant DEK  →  per-file DEK  →  file bytes
 *
 * Only wrapped keys are ever persisted. The per-tenant tier is what makes
 * crypto-shredding possible (see `shredTenantKey`), and it is also the reason the
 * master key can be rotated without rewriting a single stored object.
 *
 * The master key currently comes from configuration. Everything above it is written
 * against `unwrapTenantKey`/`wrapTenantKey`, so moving to AWS/GCP KMS later means
 * replacing those two functions and nothing else.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly masterKey: Buffer;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const configured = this.config.get<string>("VAULT_MASTER_KEY");

    if (configured) {
      this.masterKey = Buffer.from(configured, "base64");
      if (this.masterKey.length !== KEY_BYTES) {
        throw new Error(
          `VAULT_MASTER_KEY must decode to ${KEY_BYTES} bytes; got ${this.masterKey.length}. ` +
            `Generate one with: openssl rand -base64 32`,
        );
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("VAULT_MASTER_KEY is required in production");
      }
      // Deterministic in dev so a restart can still read files written before it.
      // Useless as a secret, which is the point — it must never reach production.
      this.masterKey = crypto.createHash("sha256").update("kos-development-master-key").digest();
      this.logger.warn(
        "VAULT_MASTER_KEY is not set — using a well-known development key. " +
          "Stored files are NOT meaningfully encrypted.",
      );
    }
  }

  private wrap(key: Buffer, wrappingKey: Buffer): Buffer {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, wrappingKey, iv);
    const wrapped = Buffer.concat([cipher.update(key), cipher.final()]);
    // iv || authTag || ciphertext, so the wrapped key is one self-describing blob.
    return Buffer.concat([iv, cipher.getAuthTag(), wrapped]);
  }

  private unwrap(wrapped: Buffer, wrappingKey: Buffer): Buffer {
    const iv = wrapped.subarray(0, IV_BYTES);
    const authTag = wrapped.subarray(IV_BYTES, IV_BYTES + 16);
    const ciphertext = wrapped.subarray(IV_BYTES + 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, wrappingKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Fetch the tenant's data encryption key, minting one on first use.
   *
   * Not cached in memory on purpose: at MVP scale the unwrap is negligible, and a
   * cache of plaintext tenant keys is exactly the thing that turns a memory disclosure
   * bug into a cross-tenant breach.
   */
  private async tenantKey(tenantId: string): Promise<Buffer> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { wrappedDek: true },
    });
    if (!tenant) throw new InternalServerErrorException("Tenant not found");

    if (tenant.wrappedDek) {
      return this.unwrap(Buffer.from(tenant.wrappedDek), this.masterKey);
    }

    const dek = crypto.randomBytes(KEY_BYTES);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { wrappedDek: this.wrap(dek, this.masterKey) },
    });
    this.logger.log(`Minted data encryption key for tenant ${tenantId}`);
    return dek;
  }

  async encrypt(plaintext: Buffer): Promise<EncryptedPayload> {
    const tenantId = TenantContext.requireTenantId();
    const tenantDek = await this.tenantKey(tenantId);

    const fileKey = crypto.randomBytes(KEY_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, fileKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
      ciphertext,
      wrappedDek: this.wrap(fileKey, tenantDek),
      iv,
      authTag: cipher.getAuthTag(),
    };
  }

  async decrypt(payload: {
    ciphertext: Buffer;
    wrappedDek: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }): Promise<Buffer> {
    const tenantId = TenantContext.requireTenantId();
    const tenantDek = await this.tenantKey(tenantId);
    const fileKey = this.unwrap(payload.wrappedDek, tenantDek);

    const decipher = crypto.createDecipheriv(ALGORITHM, fileKey, payload.iv);
    decipher.setAuthTag(payload.authTag);
    // Throws if the ciphertext or its metadata was altered — GCM authenticates,
    // so a tampered stored object fails loudly rather than returning garbage.
    return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
  }

  /**
   * Crypto-shredding: destroy the tenant's key rather than their data.
   *
   * Every file for the firm becomes permanently unrecoverable while the audit record
   * of what existed, who touched it, and when survives. That is what lets an erasure
   * request and an append-only audit obligation both be satisfied — deleting rows
   * would satisfy only the first.
   *
   * Irreversible. There is no recovery path by design.
   */
  async shredTenantKey(tenantId: string): Promise<void> {
    // Scoped to the target tenant explicitly: this is an administrative action that
    // may be triggered from outside a normal request, where there is no ambient scope
    // and RLS would otherwise make the row invisible and the update a silent no-op.
    await this.prisma.asTenant(tenantId, () =>
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { wrappedDek: null },
      }),
    );
    this.logger.warn(`Crypto-shredded encryption key for tenant ${tenantId}`);
  }
}
