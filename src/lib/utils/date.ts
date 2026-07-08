// Cambodia Standard Time — ICT (UTC+7), no daylight saving.
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Returns the current instant expressed as a Date whose UTC fields
 * correspond to Cambodia wall-clock time.  Use `.toISOString()` or
 * `.getUTCHours()` / `.getUTCMinutes()` to read local Cambodia time.
 * NOT a real UTC timestamp — only suitable for calendar-date work.
 */
export function nowICT(): Date {
  return new Date(Date.now() + ICT_OFFSET_MS);
}

/**
 * Today's calendar date in Cambodia as "YYYY-MM-DD".
 * Vercel functions run at UTC; between midnight UTC and 7 AM ICT the server
 * thinks it is yesterday.  Always use this (not new Date().toISOString())
 * when you need "today" as a calendar date for attendance, cron windows, etc.
 */
export function todayICT(): string {
  return nowICT().toISOString().slice(0, 10);
}

/**
 * Midnight UTC of today's Cambodia calendar date — use for Prisma date
 * column comparisons where the column is typed @db.Date.
 */
export function startOfTodayICT(): Date {
  return new Date(todayICT());
}
