export type SchedulePreset = {
  id: string;
  name: string;
  description: string;
  cron: string;
};

export type UpcomingRun = {
  atUtc: string;
  atLocal: string;
};

type ParsedField = {
  values: Set<number>;
  wildcard: boolean;
};

type ParsedCron = {
  minute: ParsedField;
  hour: ParsedField;
  dayOfMonth: ParsedField;
  month: ParsedField;
  dayOfWeek: ParsedField;
};

type LocalParts = {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
};

const weekdayNames: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

const schedulePresets: SchedulePreset[] = [
  {
    id: "every-15-min",
    name: "Every 15 minutes",
    description: "Runs every 15 minutes",
    cron: "*/15 * * * *"
  },
  {
    id: "hourly",
    name: "Hourly",
    description: "Runs at minute 0 every hour",
    cron: "0 * * * *"
  },
  {
    id: "business-hours",
    name: "Business hours",
    description: "Runs every 30 min during weekdays 09:00-17:59",
    cron: "*/30 9-17 * * 1-5"
  },
  {
    id: "daily-9am",
    name: "Daily 09:00",
    description: "Runs every day at 09:00",
    cron: "0 9 * * *"
  },
  {
    id: "weekdays-9am",
    name: "Weekdays 09:00",
    description: "Runs Monday-Friday at 09:00",
    cron: "0 9 * * 1-5"
  },
  {
    id: "weekly-monday",
    name: "Weekly Monday 09:00",
    description: "Runs every Monday at 09:00",
    cron: "0 9 * * 1"
  }
];

export function listSchedulePresets() {
  return schedulePresets;
}

function parseValue(raw: string, min: number, max: number, names?: Record<string, number>) {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  let value = names?.[key] ?? Number(key);
  if (!Number.isInteger(value)) return null;
  if (max === 6 && value === 7) value = 0;
  if (value < min || value > max) return null;
  return value;
}

function addRange(set: Set<number>, start: number, end: number, step: number) {
  for (let value = start; value <= end; value += step) {
    set.add(value);
  }
}

function parseField(raw: string, min: number, max: number, names?: Record<string, number>): ParsedField | null {
  const field = raw.trim();
  if (!field) return null;
  if (field === "*") {
    const values = new Set<number>();
    addRange(values, min, max, 1);
    return { values, wildcard: true };
  }

  const values = new Set<number>();
  const parts = field.split(",");
  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part) return null;

    const [rangePartRaw, stepPartRaw] = part.split("/");
    const rangePart = rangePartRaw.trim();
    const step = stepPartRaw === undefined ? 1 : Number(stepPartRaw);
    if (!Number.isInteger(step) || step <= 0) return null;

    if (rangePart === "*") {
      addRange(values, min, max, step);
      continue;
    }

    if (rangePart.includes("-")) {
      const [startRaw, endRaw] = rangePart.split("-");
      const start = parseValue(startRaw, min, max, names);
      const end = parseValue(endRaw, min, max, names);
      if (start === null || end === null || end < start) return null;
      addRange(values, start, end, step);
      continue;
    }

    const start = parseValue(rangePart, min, max, names);
    if (start === null) return null;
    if (step === 1) {
      values.add(start);
      continue;
    }
    addRange(values, start, max, step);
  }

  return { values, wildcard: false };
}

function parseCronExpression(cronExpression: string): ParsedCron | null {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const minute = parseField(fields[0], 0, 59);
  const hour = parseField(fields[1], 0, 23);
  const dayOfMonth = parseField(fields[2], 1, 31);
  const month = parseField(fields[3], 1, 12);
  const dayOfWeek = parseField(fields[4], 0, 6, weekdayNames);

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null;
  }

  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function toDayOfWeek(raw: string): number {
  const mapped = weekdayNames[raw.slice(0, 3).toLowerCase()];
  return mapped ?? 0;
}

function getLocalParts(date: Date, timezone: string): LocalParts {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);

  const values: Record<string, number> = {};
  for (const part of dateParts) {
    if (part.type === "minute" || part.type === "hour" || part.type === "day" || part.type === "month") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    minute: values.minute || 0,
    hour: values.hour || 0,
    dayOfMonth: values.day || 1,
    month: values.month || 1,
    dayOfWeek: toDayOfWeek(weekday)
  };
}

function matchesCron(parsed: ParsedCron, local: LocalParts) {
  if (!parsed.minute.values.has(local.minute)) return false;
  if (!parsed.hour.values.has(local.hour)) return false;
  if (!parsed.month.values.has(local.month)) return false;

  const domMatches = parsed.dayOfMonth.values.has(local.dayOfMonth);
  const dowMatches = parsed.dayOfWeek.values.has(local.dayOfWeek);

  if (parsed.dayOfMonth.wildcard && parsed.dayOfWeek.wildcard) {
    return true;
  }
  if (parsed.dayOfMonth.wildcard) {
    return dowMatches;
  }
  if (parsed.dayOfWeek.wildcard) {
    return domMatches;
  }
  return domMatches || dowMatches;
}

function formatLocal(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

const defaultScanWindowMinutes = 60 * 24 * 370;

function nextRunAtFromParsed(
  parsed: ParsedCron,
  timezone: string,
  fromDate: Date,
  scanWindowMinutes: number
) {
  const startMs = fromDate.getTime();
  let cursor = new Date(startMs - (startMs % 60_000) + 60_000);

  for (let i = 0; i < scanWindowMinutes; i += 1) {
    const local = getLocalParts(cursor, timezone);
    if (matchesCron(parsed, local)) {
      return cursor;
    }
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return null;
}

export function nextRunAt(
  cronExpression: string,
  timezone: string,
  fromDate = new Date(),
  scanWindowMinutes = defaultScanWindowMinutes
) {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return null;
  return nextRunAtFromParsed(parsed, timezone, fromDate, scanWindowMinutes);
}

export function nextRunsAt(
  cronExpression: string,
  timezone: string,
  options: {
    fromDate?: Date;
    count?: number;
    scanWindowMinutes?: number;
  } = {}
) {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return [] as Date[];

  const fromDate = options.fromDate || new Date();
  const count = Math.max(1, Math.min(200, options.count || 1));
  const scanWindowMinutes = Math.max(1, options.scanWindowMinutes || defaultScanWindowMinutes);

  const out: Date[] = [];
  let cursor = new Date(fromDate.getTime());
  for (let i = 0; i < count; i += 1) {
    const next = nextRunAtFromParsed(parsed, timezone, cursor, scanWindowMinutes);
    if (!next) break;
    out.push(next);
    cursor = new Date(next.getTime() + 60_000);
  }
  return out;
}

export function buildUpcomingRuns(
  cronExpression: string,
  timezone: string,
  options: {
    fromDate?: Date;
    count?: number;
    scanWindowMinutes?: number;
  } = {}
) {
  return nextRunsAt(cronExpression, timezone, options).map((date) => ({
    atUtc: date.toISOString(),
    atLocal: formatLocal(date, timezone)
  }));
}

export function buildSchedulePreview(cronExpression: string, timezone: string, fromDate = new Date()) {
  const next = nextRunAt(cronExpression, timezone, fromDate);
  return {
    cron: cronExpression,
    timezone,
    nextRunAtUtc: next ? next.toISOString() : null,
    nextRunAtLocal: next ? formatLocal(next, timezone) : null
  };
}
