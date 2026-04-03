import "server-only";
import crypto from "crypto";

/**
 * EXCHANGE_CREDENTIALS_ENCRYPTION_KEY 는 반드시 32바이트(base64 인코딩)여야 함
 * 예:
 * openssl rand -base64 32
 */
const ENCRYPTION_KEY = process.env.EXCHANGE_CREDENTIALS_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("EXCHANGE_CREDENTIALS_ENCRYPTION_KEY is missing");
}

const key = Buffer.from(ENCRYPTION_KEY, "base64");

if (key.length !== 32) {
  throw new Error(
    "Encryption key must be exactly 32 bytes after base64 decoding",
  );
}

/**
 * 평문 문자열을 AES-256-CBC로 암호화
 * 저장 형식: ivBase64:encryptedBase64
 */
export function encryptExchangeCredential(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");

  return `${iv.toString("base64")}:${encrypted}`;
}

/**
 * DB에 저장된 암호문을 복호화
 */
export function decryptExchangeCredential(payload: string): string {
  const [ivBase64, encryptedBase64] = payload.split(":");

  if (!ivBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// 기존 다른 파일들에서 쓰던 이름 호환용
export const encryptText = encryptExchangeCredential;
export const decryptText = decryptExchangeCredential;
