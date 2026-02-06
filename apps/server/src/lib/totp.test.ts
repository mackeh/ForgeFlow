import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOtpAuthUri,
  buildQrCodeUrl,
  generateTotpSecret,
  generateTotpToken,
  verifyTotpToken
} from "./totp.js";

test("totp secret and token generation/verification", () => {
  const secret = generateTotpSecret();
  assert.equal(secret.length >= 16, true);
  const now = new Date("2026-02-06T12:00:00.000Z");
  const token = generateTotpToken(secret, { at: now });
  assert.equal(token.length, 6);
  assert.equal(verifyTotpToken(secret, token, { at: now }), true);
  assert.equal(verifyTotpToken(secret, "000000", { at: now }), false);
});

test("otpauth uri and qr code url are generated", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const uri = buildOtpAuthUri({
    issuer: "ForgeFlow",
    accountName: "local",
    secret
  });
  assert.equal(uri.startsWith("otpauth://totp/"), true);
  assert.equal(uri.includes("secret=JBSWY3DPEHPK3PXP"), true);
  const qr = buildQrCodeUrl(uri);
  assert.equal(qr.includes("chart.googleapis.com"), true);
});
