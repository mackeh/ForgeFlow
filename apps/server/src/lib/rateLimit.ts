export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  loginMaxRequests: number;
  trustProxy: boolean;
};

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  if (value < 1) return fallback;
  return Math.floor(value);
}

function parseBoolean(raw: string | undefined, fallback = false) {
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().trim();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function loadRateLimitConfig(env: Record<string, string | undefined> = process.env): RateLimitConfig {
  return {
    windowMs: parsePositiveInt(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    maxRequests: parsePositiveInt(env.RATE_LIMIT_MAX, 300),
    loginMaxRequests: parsePositiveInt(env.RATE_LIMIT_LOGIN_MAX, 25),
    trustProxy: parseBoolean(env.TRUST_PROXY, false)
  };
}
