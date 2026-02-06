import test from "node:test";
import assert from "node:assert/strict";
import { encryptText } from "./crypto.js";
import { interpolateWithSecrets } from "./secrets.js";

test("interpolateWithSecrets resolves variables and encrypted secrets", async () => {
  process.env.SECRET_ENCRYPTION_KEY = "test-key";
  const enc = encryptText("TOKEN123");

  const prisma = {
    secret: {
      findUnique: async ({ where }: any) => {
        if (where.key === "API_TOKEN") {
          return {
            key: "API_TOKEN",
            valueEnc: enc.valueEnc,
            nonce: enc.nonce,
            tag: enc.tag
          };
        }
        return null;
      }
    }
  } as any;

  const out = await interpolateWithSecrets(
    "Authorization: Bearer {{secret:API_TOKEN}} user={{username}}",
    { username: "alice" },
    prisma
  );

  assert.equal(out, "Authorization: Bearer TOKEN123 user=alice");
});
