import { beforeEach, describe, expect, it } from 'vitest';
import { createSeed } from '../store/seed';
import { migrateStoreState, useStore } from '../store/useStore';
import { calculateCashSessionBalance } from '../store/moduleHelpers';
import { addDaysStr, todayStr } from '../lib/format';
import type { CashMovement, CashSession, FolioItem, PosOrder, Reservation } from '../types';

const COLLECTIONS = ['cashSessions', 'cashMovements', 'nightAudits', 'posOutlets', 'menuItems', 'posOrders', 'ratePlans', 'seasons', 'channels', 'guestFeedbacks', 'lostItems'] as const;
beforeEach(() => { useStore.setState(createSeed()); });

function openOrder(patch: Partial<PosOrder> = {}): PosOrder {
  const store = useStore.getState();
  const reservation = store.reservations.find(r => r.status === 'giris_yapti')!;
  return { id: 'test-order', outletId: store.posOutlets[0].id, reservationId: reservation.id, date: todayStr(), createdAt: new Date().toISOString(), status: 'acik', total: 999,
    items: [{ menuItemId: store.menuItems[0].id, name: 'Yemek', quantity: 2, unitPrice: 110, vatRate: 10 }, { menuItemId: store.menuItems[1].id, name: 'İçecek', quantity: 1, unitPrice: 120, vatRate: 20 }], ...patch };
}

describe('Yeni koleksiyonlar ve demo ilişkileri', () => {
  it('istenen demo sayıları ve bağlantıları mevcuttur', () => {
    const s = useStore.getState();
    expect(s.posOutlets).toHaveLength(4); expect(s.menuItems).toHaveLength(30); expect(s.seasons).toHaveLength(3); expect(s.channels).toHaveLength(6);
    expect(s.guestFeedbacks).toHaveLength(15); expect(s.lostItems).toHaveLength(10); expect(s.ratePlans).toHaveLength(s.roomTypes.length * 5);
    expect(s.cashSessions.filter(c => c.status === 'kapali')).toHaveLength(3); expect(s.nightAudits).toHaveLength(3);
    for (const item of s.menuItems) { expect(s.posOutlets.some(o => o.id === item.outletId)).toBe(true); if (item.inventoryItemId) expect(s.inventoryItems.some(i => i.id === item.inventoryItemId)).toBe(true); }
    for (const r of s.reservations) { expect(s.channels.some(c => c.id === r.channelId)).toBe(true); expect(s.ratePlans.some(p => p.id === r.ratePlanId)).toBe(true); }
    for (const f of s.guestFeedbacks) { expect(s.guests.some(g => g.id === f.guestId)).toBe(true); expect(f.rating).toBeGreaterThanOrEqual(1); expect(f.rating).toBeLessThanOrEqual(5); }
    for (const c of s.cashSessions.filter(c => c.status === 'kapali')) expect(c.expectedBalance).toBe(calculateCashSessionBalance(c, s.cashMovements));
    for (const order of s.posOrders.filter(o => o.status === 'odaya_yazildi')) expect(s.folioItems.filter(f => f.sourceOrderId === order.id).map(f => f.id)).toEqual(order.folioItemIds);
  });
  it('tüm yeni koleksiyonlarda genel CRUD kullanılabilir', () => {
    for (const key of COLLECTIONS) {
      const { id: originalId, ...item } = useStore.getState()[key][0];
      const added = useStore.getState().add(key, item);
      expect(added).not.toBe(originalId); expect(useStore.getState()[key].some(i => i.id === added)).toBe(true);
      useStore.getState().remove(key, added); expect(useStore.getState()[key].some(i => i.id === added)).toBe(false);
    }
    const menu = useStore.getState().menuItems[0]; useStore.getState().update('menuItems', menu.id, { price: 999 });
    expect(useStore.getState().menuItems[0].price).toBe(999);
  });
});

describe('Persist v3 geçişi', () => {
  it('eski veriyi korur, yeni koleksiyonları boş dizilere tamamlar', () => {
    const old = { guests: [{ id: 'existing-guest' }], settings: { hotelName: 'Mevcut otel' } };
    const migrated = migrateStoreState(old);
    for (const key of COLLECTIONS) expect(migrated[key]).toEqual([]);
    expect(migrated.guests).toEqual(old.guests); expect(migrated.settings?.hotelName).toBe('Mevcut otel');
  });
  it('önceden kaydedilmiş yeni koleksiyonları ve ayar varsayılanlarını korur', () => {
    const current = useStore.getState(); const merge = useStore.persist.getOptions().merge!;
    const saved = { settings: { hotelName: 'Kayıtlı Otel' }, menuItems: current.menuItems.slice(0, 1), cashSessions: null };
    const merged = merge(saved, current);
    expect(merged.menuItems).toHaveLength(1); expect(merged.cashSessions).toEqual([]); expect(merged.channels).toEqual([]);
    expect(merged.settings.hotelName).toBe('Kayıtlı Otel'); expect(merged.settings.vatFood).toBe(current.settings.vatFood);
    expect(merged.postPosOrderToFolio).toBe(current.postPosOrderToFolio);
    expect(merge(undefined, current)).toBe(current); expect(useStore.persist.getOptions().version).toBe(3);
  });
});

describe('POS → folio', () => {
  it('KDV oranlarını ve fiyat kopyalarını korur; toplamı kalemlerden hesaplar', () => {
    const order = openOrder(); const before = useStore.getState().folioItems.length;
    useStore.setState({ posOrders: [order] }); useStore.getState().update('menuItems', order.items[0].menuItemId, { price: 9999 });
    const ids = useStore.getState().postPosOrderToFolio(order.id); const state = useStore.getState();
    expect(ids).toHaveLength(2); expect(state.folioItems).toHaveLength(before + 2);
    expect(state.folioItems.filter(f => f.sourceOrderId === order.id).map(f => [f.amount, f.vatRate, f.type])).toEqual([[220, 10, 'restoran'], [120, 20, 'restoran']]);
    expect(state.posOrders[0]).toMatchObject({ status: 'odaya_yazildi', total: 340, folioItemIds: ids });
  });
  it('tekrar çağrı ve sonradan çıkış yapılması mükerrer folio üretmez', () => {
    const order = openOrder(); useStore.setState({ posOrders: [order] }); const first = useStore.getState().postPosOrderToFolio(order.id);
    useStore.getState().update('reservations', order.reservationId!, { status: 'cikis_yapti' });
    const before = useStore.getState(); expect(before.postPosOrderToFolio(order.id)).toEqual(first);
    expect(useStore.getState().folioItems).toBe(before.folioItems); expect(useStore.getState().activityLogs).toBe(before.activityLogs);
  });
  it('ödenmiş/iptal, geçersiz kalem ve yanlış oda işlemleri atomik reddedilir', () => {
    const good = openOrder();
    const invalid: Partial<PosOrder>[] = [{ status: 'odendi' }, { status: 'iptal' }, { reservationId: undefined }, { roomNo: '9999' }, { items: [] }, { items: [{ ...good.items[0], quantity: -1 }] }, { items: [{ ...good.items[0], vatRate: 200 }] }];
    for (const patch of invalid) {
      const order = openOrder(patch); useStore.setState({ posOrders: [order] }); const before = useStore.getState();
      expect(() => before.postPosOrderToFolio(order.id)).toThrow(); expect(useStore.getState().folioItems).toBe(before.folioItems); expect(useStore.getState().posOrders).toBe(before.posOrders);
    }
  });
  it('spa, minibar ve oda servisi uygun folio tipine yazılır', () => {
    for (const [type, folioType] of [['spa', 'spa'], ['minibar', 'minibar'], ['oda_servisi', 'restoran']] as const) {
      const outletId = useStore.getState().add('posOutlets', { name: type, type, active: true }); const order = openOrder({ id: `order-${type}`, outletId });
      useStore.setState({ posOrders: [order] }); useStore.getState().postPosOrderToFolio(order.id);
      expect(useStore.getState().folioItems.filter(f => f.sourceOrderId === order.id).every(f => f.type === folioType)).toBe(true);
    }
  });
});

describe('Kasa kapanışı', () => {
  function cashFixture() {
    const session: CashSession = { id: 'test-session', date: todayStr(), employeeId: useStore.getState().employees[0].id, openedAt: new Date().toISOString(), status: 'acik', openingBalance: 1000 };
    const movement = (id: string, patch: Partial<CashMovement> = {}): CashMovement => ({ id, sessionId: session.id, date: todayStr(), type: 'tahsilat', amount: 500, currency: 'TRY', exchangeRate: 1, method: 'nakit', description: id, ...patch });
    const movements = [movement('cash'), movement('expense', { type: 'odeme', amount: 100 }), movement('card', { method: 'kredi_karti', amount: 999 }), movement('bank', { method: 'havale', amount: 999 }), movement('eur-in', { type: 'doviz', direction: 'giris', currency: 'EUR', amount: 10, exchangeRate: 50 }), movement('try-out', { type: 'doviz', direction: 'cikis', amount: 500 }), movement('usd', { currency: 'USD', amount: 100, exchangeRate: 45 }), movement('other-session', { sessionId: 'other' })];
    useStore.setState({ cashSessions: [session], cashMovements: movements }); return session;
  }
  it('yalnızca oturumun nakdini, döviz kurlarını ve bozumun iki tarafını sayar', () => {
    const session = cashFixture(); const closed = useStore.getState().closeCashSession(session.id, 5895);
    expect(closed).toMatchObject({ status: 'kapali', expectedBalance: 5900, countedAmount: 5895, difference: -5, closedBy: session.employeeId });
    expect(closed.closedAt).toBeTruthy(); const before = useStore.getState();
    expect(before.closeCashSession(session.id, 5895)).toEqual(closed); expect(useStore.getState().activityLogs).toBe(before.activityLogs);
    expect(() => before.closeCashSession(session.id, 5900)).toThrow();
  });
  it('geçersiz sayım ve yönü olmayan döviz hareketi kaydı değiştirmez', () => {
    const session = cashFixture(); const before = useStore.getState();
    for (const counted of [-1, NaN, Infinity]) expect(() => before.closeCashSession(session.id, counted)).toThrow();
    useStore.setState({ cashMovements: before.cashMovements.map(m => m.id === 'eur-in' ? { ...m, direction: undefined } : m) });
    expect(() => useStore.getState().closeCashSession(session.id, 5900)).toThrow(); expect(useStore.getState().cashSessions).toBe(before.cashSessions);
  });
});

describe('Gün sonu snapshot', () => {
  it('gecelik gelir, checkout sınırı, POS/folio ayrımı ve tekrar çağrı doğrudur', () => {
    const state = useStore.getState(); const date = todayStr(); const rooms = state.rooms.slice(0, 2);
    const base = state.reservations[0];
    const reservations: Reservation[] = [{ ...base, id: 'staying', roomId: rooms[0].id, checkIn: addDaysStr(date, -2), checkOut: addDaysStr(date, 1), status: 'giris_yapti', nightlyRate: 1000 }, { ...base, id: 'checked-out', roomId: rooms[1].id, checkIn: addDaysStr(date, -3), checkOut: date, status: 'cikis_yapti', nightlyRate: 2000 }, { ...base, id: 'cancelled', roomId: rooms[1].id, checkIn: date, checkOut: addDaysStr(date, 1), status: 'iptal', nightlyRate: 9000 }];
    const folio = (id: string, type: FolioItem['type'], amount: number, patch: Partial<FolioItem> = {}): FolioItem => ({ id, reservationId: 'staying', date, type, amount, vatRate: 10, description: id, ...patch });
    const folioItems = [folio('lodging', 'konaklama', 7000), folio('food', 'restoran', 110, { sourceOrderId: 'posted-order' }), folio('mini', 'minibar', 60), folio('transfer', 'transfer', 40), folio('invalid-reservation', 'spa', 999, { reservationId: 'cancelled' })];
    const order = (id: string, amount: number, outletId: string, status: PosOrder['status'] = 'odendi'): PosOrder => ({ ...openOrder(), id, outletId, reservationId: 'staying', total: amount, status, items: [{ ...openOrder().items[0], quantity: 1, unitPrice: amount }] });
    const posOrders = [order('cash-sale', 200, state.posOutlets[1].id), order('spa-sale', 240, state.posOutlets[3].id), order('posted-order', 110, state.posOutlets[0].id), order('open', 999, state.posOutlets[0].id, 'acik'), order('room-order', 999, state.posOutlets[0].id, 'odaya_yazildi')];
    useStore.setState({ rooms, reservations, folioItems, posOrders, nightAudits: [] });
    const audit = useStore.getState().runNightAudit(date, state.employees[0].id, 'Kontrol');
    expect(audit).toMatchObject({ occupiedRooms: 1, totalRooms: 2, occupancy: 50, adr: 1000, revpar: 500, roomRevenue: 1000, totalRevenue: 1650, revenueSummary: { accommodation: 1000, restaurant: 310, minibar: 60, spa: 240, other: 40 } });
    expect(useStore.getState().rooms).toBe(rooms); expect(useStore.getState().folioItems).toBe(folioItems);
    useStore.getState().update('reservations', 'staying', { nightlyRate: 9999 });
    expect(useStore.getState().runNightAudit(date, state.employees[0].id)).toBe(audit); expect(useStore.getState().nightAudits).toHaveLength(1);
  });
  it('boş operasyonda sıfır metrik üretir, gelecek/bozuk tarih ve bilinmeyen çalışanı reddeder', () => {
    const state = useStore.getState(); useStore.setState({ rooms: [], reservations: [], folioItems: [], posOrders: [], nightAudits: [] });
    const audit = useStore.getState().runNightAudit(todayStr(), state.employees[0].id);
    expect([audit.occupancy, audit.adr, audit.revpar, audit.totalRevenue]).toEqual([0, 0, 0, 0]);
    expect(() => useStore.getState().runNightAudit(addDaysStr(todayStr(), 1), state.employees[0].id)).toThrow();
    expect(() => useStore.getState().runNightAudit('2026-02-30', state.employees[0].id)).toThrow();
    expect(() => useStore.getState().runNightAudit(addDaysStr(todayStr(), -1), 'missing-employee')).toThrow();
  });
});
