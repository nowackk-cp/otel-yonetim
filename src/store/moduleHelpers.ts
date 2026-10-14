import type { CashMovement, CashSession, FolioItem, NightAudit, NightAuditRevenue, PosOrder, PosOrderItem, PosOutlet, Reservation, Room } from '../types';
import { occupiesNight, round2 } from '../lib/calc';
import { toDateStr } from '../lib/format';

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && toDateStr(parsed) === value;
}

export function posLineAmount(item: PosOrderItem): number {
  if (!item.name.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.vatRate) || item.vatRate < 0 || item.vatRate > 100) {
    throw new Error('Sipariş kaleminde ad, pozitif miktar, geçerli fiyat ve KDV oranı gerekli.');
  }
  const amount = round2(item.quantity * item.unitPrice);
  if (!Number.isFinite(amount)) throw new Error('Sipariş tutarı hesaplanamıyor.');
  return amount;
}

export function calculatePosOrderTotal(items: PosOrderItem[]): number {
  if (!items.length) throw new Error('Sipariş en az bir kalem içermeli.');
  return round2(items.reduce((sum, item) => sum + posLineAmount(item), 0));
}

/** Tüm nakit para birimleri, hareket anındaki kurla TRY karşılığına çevrilir. */
export function calculateCashSessionBalance(session: CashSession, movements: CashMovement[]): number {
  if (!Number.isFinite(session.openingBalance) || session.openingBalance < 0) throw new Error('Açılış bakiyesi geçersiz.');
  const balance = movements.filter(m => m.sessionId === session.id && m.method === 'nakit').reduce((sum, m) => {
    if (!['TRY', 'EUR', 'USD'].includes(m.currency) || !Number.isFinite(m.amount) || m.amount < 0 || !Number.isFinite(m.exchangeRate) || m.exchangeRate <= 0 || (m.currency === 'TRY' && m.exchangeRate !== 1)) {
      throw new Error('Nakit hareketinin tutarı, para birimi veya kuru geçersiz.');
    }
    if (m.type === 'doviz' && m.direction !== 'giris' && m.direction !== 'cikis') throw new Error('Döviz hareketinde giriş/çıkış yönü gerekli.');
    if (!['tahsilat', 'odeme', 'doviz'].includes(m.type)) throw new Error('Kasa hareketinin türü geçersiz.');
    const direction = m.type === 'tahsilat' ? 1 : m.type === 'odeme' ? -1 : m.direction === 'giris' ? 1 : -1;
    return sum + direction * round2(m.amount * m.exchangeRate);
  }, session.openingBalance);
  if (!Number.isFinite(balance)) throw new Error('Kasa bakiyesi hesaplanamıyor.');
  return round2(balance);
}

export function outletRevenueCategory(type: PosOutlet['type']): keyof NightAuditRevenue {
  return type === 'spa' ? 'spa' : type === 'minibar' ? 'minibar' : 'restaurant';
}

/** Muhasebe tahsilatları değil, ilgili gecenin operasyonel satışları ölçülür. */
export function calculateNightAuditMetrics(date: string, rooms: Room[], reservations: Reservation[], folios: FolioItem[], orders: PosOrder[], outlets: PosOutlet[]): Pick<NightAudit, 'occupancy' | 'occupiedRooms' | 'totalRooms' | 'adr' | 'revpar' | 'roomRevenue' | 'totalRevenue' | 'revenueSummary'> {
  const knownRooms = new Set(rooms.map(r => r.id));
  const occupied = new Map(reservations.filter(r => knownRooms.has(r.roomId) && occupiesNight(r, date)).map(r => [r.roomId, r]));
  const roomRevenue = round2([...occupied.values()].reduce((sum, r) => sum + r.nightlyRate, 0));
  const summary: NightAuditRevenue = { accommodation: roomRevenue, restaurant: 0, minibar: 0, spa: 0, other: 0 };
  const eligibleReservations = new Set(reservations.filter(r => !['iptal', 'no_show', 'opsiyon'].includes(r.status)).map(r => r.id));
  folios.filter(f => f.date === date && f.type !== 'konaklama' && eligibleReservations.has(f.reservationId)).forEach(f => {
    const category = f.type === 'restoran' ? 'restaurant' : f.type === 'minibar' ? 'minibar' : f.type === 'spa' ? 'spa' : 'other';
    summary[category] += f.amount;
  });
  // Odaya aktarılan sipariş zaten foliodadır; yalnızca doğrudan ödenen sipariş eklenir.
  const postedOrders = new Set(folios.filter(f => f.sourceOrderId).map(f => f.sourceOrderId));
  orders.filter(o => o.date === date && o.status === 'odendi' && !postedOrders.has(o.id)).forEach(order => {
    const outlet = outlets.find(o => o.id === order.outletId);
    summary[outlet ? outletRevenueCategory(outlet.type) : 'other'] += calculatePosOrderTotal(order.items);
  });
  const revenueSummary = Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, round2(value)])) as unknown as NightAuditRevenue;
  return { occupancy: rooms.length ? round2(occupied.size / rooms.length * 100) : 0, occupiedRooms: occupied.size, totalRooms: rooms.length,
    adr: occupied.size ? round2(roomRevenue / occupied.size) : 0, revpar: rooms.length ? round2(roomRevenue / rooms.length) : 0,
    roomRevenue, totalRevenue: round2(Object.values(revenueSummary).reduce((sum, value) => sum + value, 0)), revenueSummary };
}
