import test from "node:test";
import assert from "node:assert/strict";
import { decryptText, encryptText } from "./crypto.js";

test("encryptText/decryptText roundtrip", () => {
  process.env.SECRET_ENCRYPTION_KEY = "test-key";
  const encrypted = encryptText("super-secret");
  const plain = decryptText(encrypted.valueEnc, encrypted.nonce, encrypted.tag);
  assert.equal(plain, "super-secret");
});
