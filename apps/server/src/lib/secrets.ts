import type { PrismaClient } from "@prisma/client";
import { decryptText, encryptText } from "./crypto.js";

export async function upsertSecret(prisma: PrismaClient, key: string, value: string) {
  const encrypted = encryptText(value);
  return prisma.secret.upsert({
    where: { key },
    update: encrypted,
    create: { key, ...encrypted }
  });
}

export async function listSecrets(prisma: PrismaClient) {
  const rows = await prisma.secret.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function getSecretValue(prisma: PrismaClient, key: string) {
  const row = await prisma.secret.findUnique({ where: { key } });
  if (!row) return null;
  return decryptText(row.valueEnc, row.nonce, row.tag);
}

export async function interpolateWithSecrets(
  value: unknown,
  context: Record<string, unknown>,
  prisma: PrismaClient
): Promise<string | unknown> {
  if (typeof value !== "string") return value;

  let output = value;
  const tokens = [...output.matchAll(/\{\{(.*?)\}\}/g)].map((m) => m[1].trim());

  for (const token of tokens) {
    if (token.startsWith("secret:")) {
      const key = token.slice("secret:".length);
      const secret = await getSecretValue(prisma, key);
      output = output.replace(`{{${token}}}`, secret ?? "");
      continue;
    }
    const varValue = context[token];
    output = output.replace(`{{${token}}}`, varValue === undefined ? "" : String(varValue));
  }

  return output;
}
