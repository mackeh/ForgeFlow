export type MaintenanceWindow = {
  start: string;
  end: string;
  weekdays?: number[];
};

type LocalClock = {
  hour: number;
  minute: number;
  dayOfWeek: number;
};

const shortWeekdays: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

function parseLocalClock(date: Date, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);

  const valueByType: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "hour" || part.type === "minute") {
      valueByType[part.type] = Number(part.value);
    }
  }

  return {
    hour: valueByType.hour || 0,
    minute: valueByType.minute || 0,
    dayOfWeek: shortWeekdays[weekday.slice(0, 3).toLowerCase()] ?? 0
  };
}

function parseClockValue(raw: string) {
  const value = raw.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

function inWeekdayScope(window: MaintenanceWindow, dayOfWeek: number) {
  if (!Array.isArray(window.weekdays) || window.weekdays.length === 0) return true;
  return window.weekdays.includes(dayOfWeek);
}

function inWindowMinutes(start: number, end: number, now: number) {
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export function isInMaintenanceWindow(date: Date, timezone: string, windows: MaintenanceWindow[]) {
  if (!Array.isArray(windows) || windows.length === 0) return false;
  const clock = parseLocalClock(date, timezone);
  const nowMinutes = clock.hour * 60 + clock.minute;

  return windows.some((window) => {
    if (!inWeekdayScope(window, clock.dayOfWeek)) return false;
    const start = parseClockValue(window.start);
    const end = parseClockValue(window.end);
    if (start === null || end === null) return false;
    return inWindowMinutes(start, end, nowMinutes);
  });
}

export function maintenanceBlockReason(date: Date, timezone: string, windows: MaintenanceWindow[]) {
  if (!isInMaintenanceWindow(date, timezone, windows)) return null;
  return "Skipped due to maintenance window";
}

