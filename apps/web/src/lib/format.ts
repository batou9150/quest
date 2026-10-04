import { currentLang } from '../i18n';

interface Formatters {
  dateTime: Intl.DateTimeFormat;
  dateOnly: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
}

const cache = new Map<string, Formatters>();

/** The site language, refined by the browser's region when it matches (en-GB, fr-CA...). */
function locale(): string {
  const lang = currentLang();
  const regional = typeof navigator === 'undefined' ? undefined : navigator.languages?.find((l) => l.toLowerCase().startsWith(`${lang}-`));
  return regional ?? lang;
}

function formatters(): Formatters {
  const loc = locale();
  let f = cache.get(loc);
  if (!f) {
    f = {
      dateTime: new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }),
      dateOnly: new Intl.DateTimeFormat(loc, { dateStyle: 'medium' }),
      time: new Intl.DateTimeFormat(loc, { timeStyle: 'medium' }),
      number: new Intl.NumberFormat(loc),
    };
    cache.set(loc, f);
  }
  return f;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatters().dateTime.format(d);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatters().dateOnly.format(d);
}

export function formatTime(date: Date): string {
  return formatters().time.format(date);
}

export function formatNumber(n: number): string {
  return formatters().number.format(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO string → value for <input type="datetime-local"> in the browser's time zone. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO 8601 with the local UTC offset, e.g. 2026-10-04T14:30:00+02:00. */
export function localInputToIso(local: string): string {
  const d = new Date(local);
  if (!local || Number.isNaN(d.getTime())) return '';
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
