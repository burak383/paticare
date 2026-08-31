// Shared date helpers. Deliberately NOT `date.toISOString().slice(0, 10)` —
// that reads the date in UTC, which is wrong for any positive UTC offset
// (Türkiye is UTC+3, this app's target market): a Date that's already "today"
// locally can still report yesterday's date in UTC (e.g. any time between
// 00:00 and 03:00 local), and a local-midnight Date (as produced by
// `date.setHours(0, 0, 0, 0)`, used when building calendar week strips) rolls
// back a full day every single time. Build the string from local
// getFullYear/getMonth/getDate instead so "today" always means today.
export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}
