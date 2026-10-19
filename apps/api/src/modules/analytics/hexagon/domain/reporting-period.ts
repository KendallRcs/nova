export interface ReportingPeriod {
  readonly month: string;
  readonly start: Date;
  readonly end: Date;
}

export class InvalidReportingMonthError extends Error {
  constructor() {
    super('Reporting month must use YYYY-MM and represent a real calendar month.');
  }
}

export function reportingMonthInLima(month: string): ReportingPeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (match === null) throw new InvalidReportingMonthError();
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 2000 || year > 9999 || monthNumber < 1 || monthNumber > 12) {
    throw new InvalidReportingMonthError();
  }
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    month,
    start: limaStart(year, monthNumber),
    end: limaStart(nextYear, nextMonth),
  };
}

function limaStart(year: number, month: number): Date {
  return new Date(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00-05:00`,
  );
}
