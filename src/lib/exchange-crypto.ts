import "server-only";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.EXCHANGE_CREDENTIALS_ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY) {
  throw new Error("EXCHANGE_CREDENTIALS_ENCRYPTION_KEY is missing");
}

const key = Buffer.from(ENCRYPTION_KEY, "base64");

if (key.length !== 32) {
  throw new Error("Encryption key must be exactly 32 bytes (base64 decoded)");
}

type EncryptedPayload = {
  iv: string;
  tag: string;
  content: string;
};

export function encryptText(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    content: encrypted.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decryptText(encodedPayload: string): string {
  const decoded = Buffer.from(encodedPayload, "base64").toString("utf8");
  const payload = JSON.parse(decoded) as EncryptedPayload;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(-4);
}
