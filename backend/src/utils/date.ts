export interface DateContext {
  isoDate: string;
  timezone: string;
  weekdayName: string;
}

/**
 * Resolves the real current calendar date in a given IANA timezone, so callers
 * never have to infer "today"/"tomorrow" from the server's own local clock.
 */
export function resolveCurrentDateContext(timezone: string, now: Date = new Date()): DateContext {
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(now);

  return { isoDate, timezone, weekdayName };
}
