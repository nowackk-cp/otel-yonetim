import type { FolioItem, Payment, Reservation, Room, Shift, Settings } from '../types';
import { daysBetween, timeToMinutes, todayStr, addDaysStr } from './format';

/** Geceleme sayısı (en az 1 değil; aynı gün ise 0 döner) */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, daysBetween(checkIn, checkOut));
}

export function reservationNights(r: Pick<Reservation, 'checkIn' | 'checkOut'>): number {
  return nightsBetween(r.checkIn, r.checkOut);
}

/** Konaklama toplamı = geceleme × gecelik fiyat */
export function reservationTotal(r: Pick<Reservation, 'checkIn' | 'checkOut' | 'nightlyRate'>): number {
  return reservationNights(r) * r.nightlyRate;
}

/** Folio kalemleri toplamı (KDV dahil) */
export function folioTotal(items: FolioItem[], reservationId?: string): number {
  return items
    .filter((i) => !reservationId || i.reservationId === reservationId)
    .reduce((s, i) => s + i.amount, 0);
}

export function paymentsTotal(payments: Payment[], reservationId?: string): number {
  return payments
    .filter((p) => !reservationId || p.reservationId === reservationId)
    .reduce((s, p) => s + p.amount, 0);
}

/** Folio bakiyesi = folio kalemleri − ödemeler (pozitif ise misafir borçlu) */
export function folioBalance(items: FolioItem[], payments: Payment[], reservationId: string): number {
  return folioTotal(items, reservationId) - paymentsTotal(payments, reservationId);
}

/** KDV dahil tutardan KDV ayrıştırma */
export function splitVat(gross: number, vatRate: number): { net: number; vat: number } {
  const net = gross / (1 + vatRate / 100);
  return { net: round2(net), vat: round2(gross - net) };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Rezervasyon verilen gece (date) için odayı tutuyor mu? (checkIn <= date < checkOut) */
export function occupiesNight(r: Reservation, date: string): boolean {
  if (r.status === 'iptal' || r.status === 'no_show' || r.status === 'opsiyon') return false;
  return r.checkIn <= date && date < r.checkOut;
}

/** Belirli bir gecedeki dolu oda sayısı */
export function occupiedRoomsOn(reservations: Reservation[], date: string): number {
  const set = new Set<string>();
  reservations.forEach((r) => occupiesNight(r, date) && set.add(r.roomId));
  return set.size;
}

/** Satılabilir oda sayısı (bakımda/bloke olanlar hariç) */
export function sellableRooms(rooms: Room[]): number {
  return rooms.filter((r) => r.status !== 'bakimda' && r.status !== 'bloke').length;
}

/** Bugünkü (veya verilen tarihteki) doluluk oranı, yüzde 0-100 */
export function occupancyRate(rooms: Room[], reservations: Reservation[], date: string = todayStr()): number {
  const total = rooms.length;
  if (!total) return 0;
  return (occupiedRoomsOn(reservations, date) / total) * 100;
}

/** Tarih aralığındaki gecelik oda geliri (rezervasyon gecelik fiyatı toplamı) */
export function roomRevenueBetween(reservations: Reservation[], from: string, to: string): number {
  let total = 0;
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    reservations.forEach((r) => {
      if (occupiesNight(r, d)) total += r.nightlyRate;
    });
  }
  return total;
}

/** ADR = oda geliri / satılan oda geceleri */
export function adr(reservations: Reservation[], from: string, to: string): number {
  let sold = 0;
  for (let d = from; d <= to; d = addDaysStr(d, 1)) sold += occupiedRoomsOn(reservations, d);
  return sold ? roomRevenueBetween(reservations, from, to) / sold : 0;
}

/** RevPAR = oda geliri / (oda sayısı × gün sayısı) */
export function revpar(rooms: Room[], reservations: Reservation[], from: string, to: string): number {
  const days = daysBetween(from, to) + 1;
  const available = rooms.length * days;
  return available ? roomRevenueBetween(reservations, from, to) / available : 0;
}

/** Vardiya süresi (dakika, mola DÜŞÜLMEDEN). Gece yarısını geçen vardiyaları (22:00-06:00) doğru hesaplar. */
export function shiftGrossMinutes(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return e > s ? e - s : e + 1440 - s; // e <= s => ertesi gün
}

/** Vardiya çalışma süresi (dakika, mola düşülmüş) */
export function shiftMinutes(shift: Pick<Shift, 'start' | 'end' | 'breakMinutes'>): number {
  return Math.max(0, shiftGrossMinutes(shift.start, shift.end) - (shift.breakMinutes || 0));
}

/** Vardiya saat cinsinden net süre */
export function shiftHours(shift: Pick<Shift, 'start' | 'end' | 'breakMinutes'>): number {
  return shiftMinutes(shift) / 60;
}

/** Puantaj: giriş-çıkış arası net çalışma dakikası (mola düşülmüş) */
export function attendanceMinutes(a: {
  checkIn?: string;
  checkOut?: string;
  breaks: { start: string; end?: string }[];
}): number {
  if (!a.checkIn || !a.checkOut) return 0;
  const gross = shiftGrossMinutes(a.checkIn, a.checkOut);
  const br = a.breaks.reduce((s, b) => (b.end ? s + shiftGrossMinutes(b.start, b.end) : s), 0);
  return Math.max(0, gross - br);
}

// Bordro için tek hesap kaynağı; eski import yolları korunur.
export { calcPayroll, incomeTaxOnAnnual } from './payroll';
export type { PayrollCalc } from './payroll';

