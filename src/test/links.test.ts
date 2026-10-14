import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { createSeed } from '../store/seed';
import { postCashMovementToLedger, postPosOrderToLedger, mirrorCashPaymentToSession, deductPosOrderStock } from '../store/ledgerLinks';
import { calculateCashSessionBalance } from '../store/moduleHelpers';
import { todayStr } from '../lib/format';

describe('Muhasebe bağlantıları', () => {
  beforeEach(() => useStore.setState({ ...createSeed(), cashSessions: [], cashMovements: [] }));

  it('kasa tahsilatı bir kez gelir yazar, ödeme gider yazar, döviz yazmaz', () => {
    const s = useStore.getState();
    const sessionId = s.add('cashSessions', { date: todayStr(), employeeId: s.employees[0].id, openedAt: new Date().toISOString(), status: 'acik', openingBalance: 0, notes: '' });
    const base = { sessionId, date: todayStr(), amount: 1200, currency: 'TRY' as const, exchangeRate: 1, method: 'nakit' as const, description: 'Test' };
    const inId = s.add('cashMovements', { ...base, type: 'tahsilat' });
    const outId = s.add('cashMovements', { ...base, type: 'odeme' });
    const fxId = s.add('cashMovements', { ...base, type: 'doviz', direction: 'giris' });
    const before = useStore.getState().transactions.length;
    expect(postCashMovementToLedger(inId)).toBe(true);
    expect(postCashMovementToLedger(inId)).toBe(false);
    expect(postCashMovementToLedger(outId)).toBe(true);
    expect(postCashMovementToLedger(fxId)).toBe(false);
    const tx = useStore.getState().transactions;
    expect(tx.length).toBe(before + 2);
    expect(tx.find((t) => t.documentNo === `CASH:${inId}`)?.type).toBe('gelir');
    expect(tx.find((t) => t.documentNo === `CASH:${outId}`)?.type).toBe('gider');
  });

  it('doğrudan ödenen POS siparişi bir kez gelir yazar', () => {
    const s = useStore.getState();
    const outletId = s.posOutlets[0].id;
    const id = s.add('posOrders', { outletId, items: [{ menuItemId: 'x', name: 'Çay', quantity: 2, unitPrice: 55, vatRate: 10 }], total: 110, status: 'odendi', date: todayStr(), createdAt: new Date().toISOString(), paymentMethod: 'nakit' } as never);
    expect(postPosOrderToLedger(id)).toBe(true);
    expect(postPosOrderToLedger(id)).toBe(false);
    const t = useStore.getState().transactions.find((x) => x.documentNo === `POS:${id}`)!;
    expect(t.amount).toBe(110);
    expect(t.vatAmount).toBe(10);
    expect(t.account).toBe('kasa');
  });

  it('manuel kasa tahsilatı seçilen KDV oranını kullanır; "KDV yok" 0 yazar', () => {
    const s = useStore.getState();
    const sessionId = s.add('cashSessions', { date: todayStr(), employeeId: s.employees[0].id, openedAt: new Date().toISOString(), status: 'acik', openingBalance: 0, notes: '' });
    const base = { sessionId, date: todayStr(), amount: 1100, currency: 'TRY' as const, exchangeRate: 1, method: 'nakit' as const, description: 'KDV test', sourceType: 'manuel' as const };
    const a = s.add('cashMovements', { ...base, type: 'tahsilat', vatRate: 10 });
    const b = s.add('cashMovements', { ...base, type: 'odeme', vatRate: 0 });
    postCashMovementToLedger(a);
    postCashMovementToLedger(b);
    const tx = useStore.getState().transactions;
    expect(tx.find((t) => t.documentNo === `CASH:${a}`)).toMatchObject({ type: 'gelir', vatRate: 10, vatAmount: 100 });
    expect(tx.find((t) => t.documentNo === `CASH:${b}`)).toMatchObject({ type: 'gider', vatRate: 0, vatAmount: 0 });
  });

  it('folio / POS kaynaklı kasa hareketi defter kaydı üretmez ve kasa bakiyesine nakit olarak düşer', () => {
    const s = useStore.getState();
    const sessionId = s.add('cashSessions', { date: todayStr(), employeeId: s.employees[0].id, openedAt: new Date().toISOString(), status: 'acik', openingBalance: 500, notes: '' });
    const before = useStore.getState().transactions.length;
    expect(mirrorCashPaymentToSession({ sourceType: 'folio', sourceId: 'pay-1', amount: 300, method: 'nakit', description: 'Folio' })).toBe(true);
    expect(mirrorCashPaymentToSession({ sourceType: 'folio', sourceId: 'pay-1', amount: 300, method: 'nakit', description: 'Folio' })).toBe(false); // tekrar yok
    expect(mirrorCashPaymentToSession({ sourceType: 'folio', sourceId: 'pay-2', amount: 999, method: 'kredi_karti', description: 'Kart' })).toBe(false); // kart kasaya girmez
    const mv = useStore.getState().cashMovements.find((m) => m.sourceId === 'pay-1')!;
    expect(postCashMovementToLedger(mv.id)).toBe(false);
    expect(useStore.getState().transactions.length).toBe(before);
    const session = useStore.getState().cashSessions.find((c) => c.id === sessionId)!;
    expect(calculateCashSessionBalance(session, useStore.getState().cashMovements)).toBe(800);
  });

  it('nakit POS ödemesi: tek gelir kaydı + kasaya bir hareket (çift gelir yok)', () => {
    const s = useStore.getState();
    const sessionId = s.add('cashSessions', { date: todayStr(), employeeId: s.employees[0].id, openedAt: new Date().toISOString(), status: 'acik', openingBalance: 0, notes: '' });
    const id = s.add('posOrders', { outletId: s.posOutlets[0].id, items: [{ menuItemId: s.menuItems[0].id, name: 'Test', quantity: 1, unitPrice: 200, vatRate: 10 }], total: 200, status: 'odendi', date: todayStr(), createdAt: new Date().toISOString(), paymentMethod: 'nakit' } as never);
    postPosOrderToLedger(id);
    postPosOrderToLedger(id);
    const st = useStore.getState();
    expect(st.transactions.filter((t) => t.documentNo === `POS:${id}`)).toHaveLength(1);
    const moves = st.cashMovements.filter((m) => m.sourceType === 'pos' && m.sourceId === id);
    expect(moves).toHaveLength(1);
    expect(postCashMovementToLedger(moves[0].id)).toBe(false);
    expect(calculateCashSessionBalance(st.cashSessions.find((c) => c.id === sessionId)!, st.cashMovements)).toBe(200);
  });

  describe('POS stok düşümü', () => {
    const linked = () => useStore.getState().menuItems.find((m) => m.inventoryItemId && m.stockQuantity)!;
    const order = (status: 'odendi' | 'odaya_yazildi' | 'iptal' | 'acik') => {
      const s = useStore.getState();
      const menu = linked();
      return s.add('posOrders', { outletId: menu.outletId, items: [{ menuItemId: menu.id, name: menu.name, quantity: 3, unitPrice: menu.price, vatRate: menu.vatRate }], total: menu.price * 3, status, date: todayStr(), createdAt: new Date().toISOString() } as never);
    };

    it('seed menüsünde stoğa bağlı kalemler var', () => {
      const s = useStore.getState();
      expect(s.menuItems.filter((m) => m.inventoryItemId).length).toBeGreaterThanOrEqual(3);
    });

    it('ödenen sipariş stoğu düşer, hareket yazar, ikinci çağrıda tekrar düşmez', () => {
      const menu = linked();
      const before = useStore.getState().inventoryItems.find((i) => i.id === menu.inventoryItemId)!.quantity;
      const id = order('odendi');
      expect(deductPosOrderStock(id)).toBe(true);
      expect(deductPosOrderStock(id)).toBe(false);
      const st = useStore.getState();
      const after = st.inventoryItems.find((i) => i.id === menu.inventoryItemId)!.quantity;
      expect(after).toBeCloseTo(before - 3 * (menu.stockQuantity ?? 1), 5);
      const mv = st.stockMovements.filter((m) => m.sourceOrderId === id);
      expect(mv).toHaveLength(1);
      expect(mv[0].direction).toBe('cikis');
    });

    it('odaya yazılan sipariş de stoğu düşer; iptal ve açık sipariş düşmez', () => {
      const menu = linked();
      const qty = () => useStore.getState().inventoryItems.find((i) => i.id === menu.inventoryItemId)!.quantity;
      const start = qty();
      expect(deductPosOrderStock(order('iptal'))).toBe(false);
      expect(deductPosOrderStock(order('acik'))).toBe(false);
      expect(qty()).toBe(start);
      expect(deductPosOrderStock(order('odaya_yazildi'))).toBe(true);
      expect(qty()).toBeLessThan(start);
    });
  });
});
