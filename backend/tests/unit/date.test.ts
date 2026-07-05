import { resolveCurrentDateContext } from '../../src/utils/date.js';

describe('resolveCurrentDateContext', () => {
  it('resolves the correct date and weekday for a normal midday moment', () => {
    const now = new Date('2026-07-05T15:00:00Z'); // Sunday, midday UTC
    const result = resolveCurrentDateContext('UTC', now);

    expect(result).toEqual({ isoDate: '2026-07-05', timezone: 'UTC', weekdayName: 'Sunday' });
  });

  it('rolls over to the next day once local time crosses midnight, even if UTC has not', () => {
    // 2026-07-06T02:30:00Z is 23:30 on 2026-07-05 in America/Sao_Paulo (UTC-3)
    const now = new Date('2026-07-06T02:30:00Z');
    const result = resolveCurrentDateContext('America/Sao_Paulo', now);

    expect(result.isoDate).toBe('2026-07-05');
    expect(result.weekdayName).toBe('Sunday');
  });

  it('rolls over earlier in timezones ahead of UTC', () => {
    // 2026-07-05T21:00:00Z is already 2026-07-06 06:00 in Asia/Tokyo (UTC+9)
    const now = new Date('2026-07-05T21:00:00Z');
    const result = resolveCurrentDateContext('Asia/Tokyo', now);

    expect(result.isoDate).toBe('2026-07-06');
    expect(result.weekdayName).toBe('Monday');
  });

  it('defaults to a real Date() when no fixed time is provided', () => {
    const result = resolveCurrentDateContext('UTC');
    expect(result.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
