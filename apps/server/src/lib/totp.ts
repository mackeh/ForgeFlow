import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string) {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    out.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(out);
}

function base32Encode(buffer: Buffer) {
  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (!chunk) continue;
    const value = Number.parseInt(chunk.padEnd(5, "0"), 2);
    out += BASE32_ALPHABET[value];
  }
  return out;
}

export function generateTotpSecret(lengthBytes = 20) {
  return base32Encode(randomBytes(lengthBytes)).slice(0, 32);
}

function tokenForCounter(secret: string, counter: number, digits = 6) {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function generateTotpToken(secret: string, options?: { periodSec?: number; digits?: number; at?: Date }) {
  const periodSec = options?.periodSec || 30;
  const digits = options?.digits || 6;
  const at = options?.at || new Date();
  const counter = Math.floor(at.getTime() / 1000 / periodSec);
  return tokenForCounter(secret, counter, digits);
}

export function verifyTotpToken(
  secret: string,
  token: string,
  options?: { periodSec?: number; digits?: number; window?: number; at?: Date }
) {
  const periodSec = options?.periodSec || 30;
  const digits = options?.digits || 6;
  const window = options?.window ?? 1;
  const at = options?.at || new Date();
  const counter = Math.floor(at.getTime() / 1000 / periodSec);
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = tokenForCounter(secret, counter + drift, digits);
    if (expected === token) return true;
  }
  return false;
}

export function buildOtpAuthUri(params: { issuer: string; accountName: string; secret: string }) {
  const issuer = encodeURIComponent(params.issuer);
  const accountName = encodeURIComponent(params.accountName);
  const secret = encodeURIComponent(params.secret);
  return `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function buildQrCodeUrl(otpauthUrl: string) {
  return `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(otpauthUrl)}`;
}
