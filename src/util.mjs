const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_MS = 864e5;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function ymd(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function utc(date) {
  const { y, m, d } = ymd(date);
  return Date.UTC(y, m - 1, d);
}

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const addDays = (date, n) => new Date(utc(date) + n * DAY_MS).toISOString().slice(0, 10);

/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (date) => (new Date(utc(date)).getUTCDay() + 6) % 7;
export const weekday = (date) => WEEKDAYS[weekdayIndex(date)];
export const monthName = (m) => MONTHS[m - 1];
export const shortMonth = (m) => MONTHS[m - 1].slice(0, 3);

export function fmtShort(date) {
  const { m, d } = ymd(date);
  return `${shortMonth(m)} ${d}`;
}

export function fmtLong(date) {
  const { y, m, d } = ymd(date);
  return `${monthName(m)} ${d}, ${y}`;
}

export const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / DAY_MS);

/** 0-based day of the year. */
export const dayOfYear = (date) => Math.round((utc(date) - Date.UTC(ymd(date).y, 0, 1)) / DAY_MS);
export const daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function todayIn(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
