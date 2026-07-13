// Cambodia Standard Time — ICT (UTC+7), no daylight saving.
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

// NOT a real UTC timestamp — only suitable for calendar-date work.
export function nowICT(): Date {
  return new Date(Date.now() + ICT_OFFSET_MS);
}

// Today's Cambodia calendar date as "YYYY-MM-DD".
export function todayICT(): string {
  return nowICT().toISOString().slice(0, 10);
}

// Midnight UTC of today's Cambodia calendar date — use for Prisma @db.Date range queries.
export function startOfTodayICT(): Date {
  return new Date(todayICT());
}
