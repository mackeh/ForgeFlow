import type { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

type DependencyStatus = {
  ok: boolean;
  latencyMs: number;
  message?: string;
};

type HealthReport = {
  ok: boolean;
  criticalOk: boolean;
  checkedAt: string;
  dependencies: {
    db: DependencyStatus;
    redis: DependencyStatus;
    ollama: DependencyStatus;
    agent: DependencyStatus;
  };
};

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
const agentBaseUrl = process.env.AGENT_BASE_URL || "http://agent:7001";

async function timedCheck(check: () => Promise<void>): Promise<DependencyStatus> {
  const started = Date.now();
  try {
    await check();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: String(error)
    };
  }
}

async function checkDb(prisma: PrismaClient) {
  await prisma.$queryRaw`SELECT 1`;
}

async function checkRedis() {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    enableReadyCheck: false
  });
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") {
      throw new Error(`Unexpected redis ping response: ${pong}`);
    }
  } finally {
    client.disconnect();
  }
}

async function checkHttpJson(url: string) {
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(2500)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function collectHealth(prisma: PrismaClient): Promise<HealthReport> {
  const [db, redis, ollama, agent] = await Promise.all([
    timedCheck(() => checkDb(prisma)),
    timedCheck(() => checkRedis()),
    timedCheck(() => checkHttpJson(`${ollamaBaseUrl}/api/tags`)),
    timedCheck(() => checkHttpJson(`${agentBaseUrl}/health`))
  ]);

  const criticalOk = db.ok && redis.ok;
  const ok = criticalOk && ollama.ok && agent.ok;

  return {
    ok,
    criticalOk,
    checkedAt: new Date().toISOString(),
    dependencies: { db, redis, ollama, agent }
  };
}
