import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import { CryptoService } from "./crypto.service";
import { ExtractionService } from "./extraction.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { PrismaService, prismaProvider } from "../../prisma/prisma.service";

/**
 * Vault encryption and isolation, against a real Postgres.
 *
 * The properties worth asserting are the ones a mock cannot show: that stored bytes
 * are not the plaintext, that one tenant's key cannot open another's file, and that
 * tampering is detected rather than silently returning wrong data.
 */

const raw = new PrismaClient();
let prisma: PrismaService;
let cryptoService: CryptoService;

const ids = { tenantA: "t_vault_a", tenantB: "t_vault_b" };

const config = new ConfigService({
  VAULT_MASTER_KEY: crypto.randomBytes(32).toString("base64"),
});

async function seed() {
  await raw.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");
  await raw.tenant.createMany({
    data: [
      { id: ids.tenantA, name: "Vault Alpha", slug: "vault-alpha", status: "ACTIVE" },
      { id: ids.tenantB, name: "Vault Beta", slug: "vault-beta", status: "ACTIVE" },
    ],
  });
}

async function cleanup() {
  await raw.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");
  await raw.tenant.deleteMany({ where: { id: { in: Object.values(ids) } } });
}

describe("Vault encryption", () => {
  beforeAll(async () => {
    prisma = await prismaProvider.useFactory();
    cryptoService = new CryptoService(config, prisma);
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await raw.$disconnect();
    await prisma.$disconnect();
  });

  it("round-trips a file through envelope encryption", async () => {
    const plaintext = Buffer.from("Settlement figure is £2.4m. Do not disclose.", "utf8");

    const result = await TenantContext.run({ tenantId: ids.tenantA }, async () => {
      const encrypted = await cryptoService.encrypt(plaintext);
      return {
        encrypted,
        decrypted: await cryptoService.decrypt(encrypted),
      };
    });

    expect(result.decrypted.toString("utf8")).toBe(plaintext.toString("utf8"));
    // The stored form must not contain the plaintext anywhere in it.
    expect(result.encrypted.ciphertext.includes(Buffer.from("Settlement"))).toBe(false);
    expect(result.encrypted.ciphertext.equals(plaintext)).toBe(false);
  });

  it("uses a different file key every time, so one leak is one file", async () => {
    const plaintext = Buffer.from("identical content", "utf8");

    const [a, b] = await TenantContext.run({ tenantId: ids.tenantA }, async () => [
      await cryptoService.encrypt(plaintext),
      await cryptoService.encrypt(plaintext),
    ]);

    expect(a.wrappedDek.equals(b.wrappedDek)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("cannot decrypt one tenant's file under another tenant's key", async () => {
    const plaintext = Buffer.from("Alpha's confidential merger terms", "utf8");
    const encrypted = await TenantContext.run({ tenantId: ids.tenantA }, () =>
      cryptoService.encrypt(plaintext),
    );

    await expect(
      TenantContext.run({ tenantId: ids.tenantB }, () => cryptoService.decrypt(encrypted)),
    ).rejects.toThrow();
  });

  it("detects tampering with the stored ciphertext", async () => {
    const encrypted = await TenantContext.run({ tenantId: ids.tenantA }, () =>
      cryptoService.encrypt(Buffer.from("original contents", "utf8")),
    );

    const tampered = Buffer.from(encrypted.ciphertext);
    tampered[0] ^= 0xff;

    // GCM authenticates, so a modified object fails loudly instead of returning
    // plausible-looking garbage.
    await expect(
      TenantContext.run({ tenantId: ids.tenantA }, () =>
        cryptoService.decrypt({ ...encrypted, ciphertext: tampered }),
      ),
    ).rejects.toThrow();
  });

  it("makes files unreadable after crypto-shredding, without deleting the bytes", async () => {
    const encrypted = await TenantContext.run({ tenantId: ids.tenantB }, () =>
      cryptoService.encrypt(Buffer.from("subject access request material", "utf8")),
    );

    await cryptoService.shredTenantKey(ids.tenantB);

    // The ciphertext still exists; it simply can never be opened again. A new key is
    // minted on demand, which is precisely why it cannot recover the old file.
    await expect(
      TenantContext.run({ tenantId: ids.tenantB }, () => cryptoService.decrypt(encrypted)),
    ).rejects.toThrow();
  });
});

describe("ExtractionService", () => {
  const extraction = new ExtractionService();

  it("extracts plain text and markdown", async () => {
    const text = await extraction.extract(
      Buffer.from("# Heading\n\nEngagement letter terms.", "utf8"),
      "text/markdown",
      "terms.md",
    );
    expect(text).toContain("Engagement letter terms.");
  });

  it("returns null for formats it cannot read, rather than throwing", async () => {
    const text = await extraction.extract(Buffer.from([0x00, 0x01, 0x02]), "image/png", "logo.png");
    expect(text).toBeNull();
  });

  it("survives a corrupt file of a supported type", async () => {
    // A malformed PDF must not fail the upload — the file is still stored, just not
    // searchable.
    const text = await extraction.extract(
      Buffer.from("not actually a pdf", "utf8"),
      "application/pdf",
      "broken.pdf",
    );
    expect(text).toBeNull();
  });
});
