import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

const algorithm = "aes-256-gcm";
const currentVersion = 1;

function getSessionKey() {
  if (!env.WHATSAPP_SESSION_ENCRYPTION_KEY) {
    throw new Error("WHATSAPP_SESSION_ENCRYPTION_KEY is required for WhatsApp Web session encryption");
  }

  return createHash("sha256").update(env.WHATSAPP_SESSION_ENCRYPTION_KEY).digest();
}

export function encryptSessionState(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getSessionKey(), iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v${currentVersion}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSessionState<T>(encryptedValue: string): T {
  const [version, iv, tag, encrypted] = encryptedValue.split(":");

  if (version !== `v${currentVersion}` || !iv || !tag || !encrypted) {
    throw new Error("Unsupported WhatsApp session state format");
  }

  const decipher = createDecipheriv(algorithm, getSessionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
