import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY || "local_dev_secret_key";
  return createHash("sha256").update(raw).digest();
}

export function encryptText(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    valueEnc: encrypted.toString("base64"),
    nonce: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptText(valueEnc: string, nonce: string, tag: string) {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(valueEnc, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
