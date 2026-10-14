import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const currencyFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
});
const currencyFmt0 = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});
const numberFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/** 1234.5 -> "₺1.234,50" */
export function formatCurrency(value: number, noDecimals = false): string {
  const v = Number.isFinite(value) ? value : 0;
  return (noDecimals ? currencyFmt0 : currencyFmt).format(v);
}

export function formatNumber(value: number): string {
  return numberFmt.format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number, digits = 1): string {
  return `%${(Number.isFinite(value) ? value : 0).toLocaleString('tr-TR', { maximumFractionDigits: digits })}`;
}

/** Date | 'YYYY-MM-DD' | ISO -> Date */
export function toDate(d: Date | string): Date {
  return typeof d === 'string' ? parseISO(d) : d;
}

/** Date -> 'YYYY-MM-DD' (yerel saat) */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** 'YYYY-MM-DD' + n gün */
export function addDaysStr(d: string, n: number): string {
  return toDateStr(addDays(parseISO(d), n));
}

/** İki tarih arası gün farkı (b - a) */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** "14 Eki 2026" */
export function formatDate(d: Date | string, pattern = 'd MMM yyyy'): string {
  if (!d) return '-';
  return format(toDate(d), pattern, { locale: tr });
}

/** "14 Eki 2026 15:30" */
export function formatDateTime(d: Date | string): string {
  if (!d) return '-';
  return format(toDate(d), 'd MMM yyyy HH:mm', { locale: tr });
}

/** "Çarşamba" */
export function formatWeekday(d: Date | string, short = false): string {
  return format(toDate(d), short ? 'EEE' : 'EEEE', { locale: tr });
}

export function formatMonth(period: string): string {
  // 'YYYY-MM' -> "Ekim 2026"
  return format(parseISO(`${period}-01`), 'LLLL yyyy', { locale: tr });
}

/** 'HH:mm' -> dakika (0-1439) */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** dakika -> 'HH:mm' */
export function minutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 135 -> "2s 15dk", 45 -> "45dk", 120 -> "2s" */
export function formatMinutes(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}s ${m}dk`;
  if (h) return `${h}s`;
  return `${m}dk`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

export function currentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}
