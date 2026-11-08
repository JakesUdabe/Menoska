import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  parseISO,
  differenceInMinutes,
  format,
  isSameDay,
  getYear,
  startOfYear,
  endOfYear,
  isWithinInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import { EXPECTED_DAILY_HOURS, EXPECTED_WEEKLY_HOURS } from "@/lib/admin/types";
import type { TimeEntry } from "@/lib/admin/types";

function toHolidaySet(holidayDates: Iterable<string> = []): Set<string> {
  return holidayDates instanceof Set ? holidayDates : new Set(holidayDates);
}

export function dateKey(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function entryDurationHours(entry: TimeEntry): number {
  if (!entry.clock_out) return 0;
  const mins = differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in));
  return Math.max(0, mins / 60);
}

export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

export function getWeekdayDates(
  reference = new Date(),
  holidayDates: Iterable<string> = [],
): Date[] {
  const holidays = toHolidaySet(holidayDates);
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  const end = endOfWeek(reference, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).filter(
    (d) => !isWeekend(d) && !holidays.has(dateKey(d)),
  );
}

export function computeDailyHours(entries: TimeEntry[], date: Date): number {
  return entries
    .filter((e) => isSameDay(parseISO(e.work_date), date))
    .reduce((sum, e) => sum + entryDurationHours(e), 0);
}

export function computeWeeklyHours(
  entries: TimeEntry[],
  reference = new Date(),
  holidayDates: Iterable<string> = [],
): number {
  const weekdays = getWeekdayDates(reference, holidayDates);
  return weekdays.reduce((sum, d) => sum + computeDailyHours(entries, d), 0);
}

export function computeExpectedWeekly(
  reference = new Date(),
  holidayDates: Iterable<string> = [],
): number {
  return getWeekdayDates(reference, holidayDates).length * EXPECTED_DAILY_HOURS;
}

export function formatDateEs(date: Date | string, pattern = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: es });
}

export function yearDays(year: number): Date[] {
  return eachDayOfInterval({
    start: startOfYear(new Date(year, 0, 1)),
    end: endOfYear(new Date(year, 0, 1)),
  });
}

export function dateInRange(date: Date, start: string, end: string): boolean {
  return isWithinInterval(date, {
    start: parseISO(start),
    end: parseISO(end),
  });
}

export { getYear, EXPECTED_DAILY_HOURS, EXPECTED_WEEKLY_HOURS };
