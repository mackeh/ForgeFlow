type RunLike = {
  id: string;
  status: string;
  createdAt: Date | string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  logs?: unknown;
};

type DailyBucket = { date: string; total: number; succeeded: number; failed: number };
type HourlyBucket = { hour: string; total: number };

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function localDateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function localHourKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false
  }).format(date);
}

export function buildDashboardMetrics(runs: RunLike[], timezone: string, days: number) {
  const now = new Date();
  const start = new Date(now.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const inWindow = runs.filter((run) => {
    const created = asDate(run.createdAt);
    return created ? created >= start : false;
  });

  const totalRuns = inWindow.length;
  const succeeded = inWindow.filter((run) => run.status === "SUCCEEDED").length;
  const failed = inWindow.filter((run) => run.status === "FAILED").length;
  const waiting = inWindow.filter((run) => run.status === "WAITING_APPROVAL").length;
  const running = inWindow.filter((run) => run.status === "RUNNING").length;

  const durations = inWindow
    .map((run) => {
      const startedAt = asDate(run.startedAt || null);
      const finishedAt = asDate(run.finishedAt || null);
      if (!startedAt || !finishedAt) return null;
      return finishedAt.getTime() - startedAt.getTime();
    })
    .filter((value): value is number => typeof value === "number" && value >= 0);

  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    : 0;

  const dailyMap = new Map<string, DailyBucket>();
  const hourlyMap = new Map<string, HourlyBucket>();

  for (const run of inWindow) {
    const created = asDate(run.createdAt);
    if (!created) continue;

    const day = localDateKey(created, timezone);
    const dayRow = dailyMap.get(day) || { date: day, total: 0, succeeded: 0, failed: 0 };
    dayRow.total += 1;
    if (run.status === "SUCCEEDED") dayRow.succeeded += 1;
    if (run.status === "FAILED") dayRow.failed += 1;
    dailyMap.set(day, dayRow);

    const hour = localHourKey(created, timezone);
    const hourRow = hourlyMap.get(hour) || { hour, total: 0 };
    hourRow.total += 1;
    hourlyMap.set(hour, hourRow);
  }

  const topNodeFailures = new Map<string, number>();
  for (const run of inWindow) {
    const logs = Array.isArray(run.logs) ? (run.logs as Array<Record<string, unknown>>) : [];
    for (const log of logs) {
      if (log.status !== "failed") continue;
      const nodeId = String(log.nodeId || "");
      if (!nodeId || nodeId === "run") continue;
      topNodeFailures.set(nodeId, (topNodeFailures.get(nodeId) || 0) + 1);
    }
  }

  const topFailures = Array.from(topNodeFailures.entries())
    .map(([nodeId, count]) => ({ nodeId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const hourly = Array.from(hourlyMap.values()).sort((a, b) => Number(a.hour) - Number(b.hour));

  return {
    timezone,
    periodDays: days,
    generatedAt: now.toISOString(),
    summary: {
      totalRuns,
      succeeded,
      failed,
      waiting,
      running,
      successRate: totalRuns ? Number(((succeeded / totalRuns) * 100).toFixed(1)) : 0,
      avgDurationMs
    },
    daily,
    hourly,
    topFailures
  };
}
