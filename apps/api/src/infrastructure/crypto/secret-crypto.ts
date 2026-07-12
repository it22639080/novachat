import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

const algorithm = "aes-256-gcm";

function encryptionKey() {
  return createHash("sha256")
    .update(env.WHATSAPP_TOKEN_ENCRYPTION_KEY ?? env.JWT_SECRET)
    .digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(encryptedSecret: string) {
  const [version, iv, authTag, ciphertext] = encryptedSecret.split(":");

  if (version !== "v1" || !iv || !authTag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format");
  }

  const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
