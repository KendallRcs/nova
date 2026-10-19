import { describe, expect, it } from 'vitest';

import { InvalidReportingMonthError, reportingMonthInLima } from './reporting-period';

describe('reportingMonthInLima', () => {
  it('builds the half-open UTC interval for a Lima calendar month', () => {
    const period = reportingMonthInLima('2026-10');

    expect(period.start.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('crosses the year boundary', () => {
    expect(reportingMonthInLima('2026-12').end.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it.each(['2026-00', '2026-13', '26-10', '2026-1'])('rejects invalid month %s', (month) => {
    expect(() => reportingMonthInLima(month)).toThrow(InvalidReportingMonthError);
  });
});
