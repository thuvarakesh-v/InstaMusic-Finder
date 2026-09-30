export const DAILY_SEARCH_LIMIT = 15;
export const SEARCH_ALLOWANCE_NOTICE = "For more relevant results, try again after 12 AM.";
export const CLIENT_TIME_ZONE_HEADER = "X-Client-Timezone";
export const FALLBACK_TIME_ZONE = "UTC";

const MAX_TIME_ZONE_LENGTH = 64;

export function formatSearchAllowance(remaining: number): string {
  const safe = Math.max(0, Math.min(DAILY_SEARCH_LIMIT, Math.trunc(remaining)));
  if (safe === DAILY_SEARCH_LIMIT) return `You can search ${DAILY_SEARCH_LIMIT} times a day. ${DAILY_SEARCH_LIMIT} remaining today.`;
  if (safe === 1) return "1 search remaining today.";
  return `${safe} searches remaining today.`;
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone.length > MAX_TIME_ZONE_LENGTH) return FALLBACK_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function readClientTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function civilInZone(instantMs: number, timeZone: string): CivilTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const values = new Map<string, string>();
  for (const part of parts) {
    if (part.type !== "literal") values.set(part.type, part.value);
  }
  let year = Number(values.get("year"));
  let month = Number(values.get("month"));
  let day = Number(values.get("day"));
  let hour = Number(values.get("hour"));
  if (hour === 24) {
    hour = 0;
    const shifted = new Date(Date.UTC(year, month - 1, day + 1));
    year = shifted.getUTCFullYear();
    month = shifted.getUTCMonth() + 1;
    day = shifted.getUTCDate();
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const civil = civilInZone(instantMs, timeZone);
  const asUtc = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
  return asUtc - instantMs;
}

function utcFromCivilMidnight(timeZone: string, year: number, month: number, day: number): number {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const adjusted = utcGuess - zoneOffsetMs(utcGuess, timeZone);
  return utcGuess - zoneOffsetMs(adjusted, timeZone);
}

export function nextLocalMidnight(nowMs: number, timeZone: string): number {
  const zone = resolveTimeZone(timeZone);
  const civil = civilInZone(nowMs, zone);
  const tomorrow = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + 1));
  let candidate = utcFromCivilMidnight(zone, tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());
  if (candidate <= nowMs) {
    const dayAfter = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + 2));
    candidate = utcFromCivilMidnight(zone, dayAfter.getUTCFullYear(), dayAfter.getUTCMonth() + 1, dayAfter.getUTCDate());
  }
  return candidate;
}
