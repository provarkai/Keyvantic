import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface StorageDriver {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  readonly name: string;
}

/**
 * Stores files on the local filesystem. For development only — it does not survive a
 * container restart and does not work behind more than one API instance.
 */
class LocalDiskDriver implements StorageDriver {
  readonly name = "local-disk";

  constructor(private root: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    // Storage keys are generated server-side, but resolving them without this check
    // would turn any future key-from-user-input into a path traversal.
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      throw new NotFoundException("Stored file not found");
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/** S3 or any S3-compatible endpoint (Cloudflare R2, MinIO, Backblaze B2). */
class S3Driver implements StorageDriver {
  readonly name = "s3";

  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}

  async put(key: string, body: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        // The bytes are already encrypted before they reach here; server-side
        // encryption is belt-and-braces against the storage provider itself.
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async get(key: string) {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new NotFoundException("Stored file not found");
      return Buffer.from(bytes);
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") {
        throw new NotFoundException("Stored file not found");
      }
      throw err;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(private config: ConfigService) {
    const bucket = this.config.get<string>("S3_BUCKET");

    if (bucket) {
      const client = new S3Client({
        region: this.config.get<string>("S3_REGION", "auto"),
        endpoint: this.config.get<string>("S3_ENDPOINT"),
        forcePathStyle: Boolean(this.config.get<string>("S3_ENDPOINT")),
        credentials: {
          accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID", ""),
          secretAccessKey: this.config.get<string>("S3_SECRET_ACCESS_KEY", ""),
        },
      });
      this.driver = new S3Driver(client, bucket);
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("S3_BUCKET is required in production — local disk storage is not durable");
      }
      const root = this.config.get<string>("LOCAL_STORAGE_PATH", ".vault-storage");
      this.driver = new LocalDiskDriver(root);
      this.logger.warn(`No S3_BUCKET configured — storing vault files on local disk at ${root}`);
    }

    this.logger.log(`Vault storage driver: ${this.driver.name}`);
  }

  /**
   * Storage keys are tenant-prefixed. Not a security boundary — access control is
   * enforced in the database — but it keeps a misdirected read within one firm's
   * namespace and makes per-tenant lifecycle rules and bulk export straightforward.
   */
  buildKey(tenantId: string, vaultItemId: string, versionNumber: number): string {
    return `tenants/${tenantId}/vault/${vaultItemId}/v${versionNumber}`;
  }

  put(key: string, body: Buffer) {
    return this.driver.put(key, body);
  }

  get(key: string) {
    return this.driver.get(key);
  }

  delete(key: string) {
    return this.driver.delete(key);
  }
}
