// ZYSTEEL HR — attendance resolution (arch §3.3).
// Marks not timestamps. A day = two marks (AM, PM). Pure, testable.

export type AttendanceMark = "PRESENT" | "LEAVE" | "ABSENT"; // √ △ ×

export interface DayMarks {
  am: AttendanceMark;
  pm: AttendanceMark;
}

const halfValue = (m: AttendanceMark): number => (m === "PRESENT" ? 0.5 : 0);

/** Days actually worked for one day's marks: PRESENT halves only. */
export function dayWorked(d: DayMarks): number {
  return halfValue(d.am) + halfValue(d.pm);
}

export interface AttendanceTotals {
  present: number; // √ days (fractional)
  leave: number;   // △ days (fractional)
  absent: number;  // × days (fractional)
}

const tally = (m: AttendanceMark, t: AttendanceTotals) => {
  if (m === "PRESENT") t.present += 0.5;
  else if (m === "LEAVE") t.leave += 0.5;
  else t.absent += 0.5;
};

/** Aggregate a list of day-marks into present/leave/absent day counts. */
export function summarize(days: DayMarks[]): AttendanceTotals {
  const t: AttendanceTotals = { present: 0, leave: 0, absent: 0 };
  for (const d of days) {
    tally(d.am, t);
    tally(d.pm, t);
  }
  return t;
}

/** Parse a √/△/× glyph (or letter) to a mark. Used for spreadsheet import. */
export function parseMark(glyph: string): AttendanceMark {
  const g = glyph.trim();
  if (g === "√" || g === "P" || g === "p") return "PRESENT";
  if (g === "△" || g === "L" || g === "l") return "LEAVE";
  if (g === "×" || g === "x" || g === "X") return "ABSENT";
  throw new Error(`Unrecognized attendance glyph: ${JSON.stringify(glyph)}`);
}
