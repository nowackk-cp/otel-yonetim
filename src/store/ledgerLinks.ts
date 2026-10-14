import { useStore } from './useStore';
import { round2, splitVat } from '../lib/calc';
import { todayStr } from '../lib/format';
import type { PaymentMethod } from '../types';

/**
 * Kasa hareketini (TRY karşılığıyla) muhasebe defterine yazar. Aynı hareket iki kez yazılmaz.
 * Yalnız manuel (veya kaynağı belirtilmemiş eski) hareketler defter kaydı üretir;
 * folio / POS kaynaklı hareketler gelirini kendi akışında zaten yazmıştır.
 */
export function postCashMovementToLedger(movementId: string): boolean {
  const s = useStore.getState();
  const m = s.cashMovements.find((x) => x.id === movementId);
  if (!m || m.type === 'doviz') return false;
  if (m.sourceType && m.sourceType !== 'manuel') return false;
  const documentNo = `CASH:${m.id}`;
  if (s.transactions.some((t) => t.documentNo === documentNo)) return false;
  const amount = round2(m.amount * m.exchangeRate);
  const vatRate = m.vatRate ?? s.settings.vatGeneral;
  s.add('transactions', {
    type: m.type === 'tahsilat' ? 'gelir' : 'gider',
    category: m.type === 'tahsilat' ? 'Kasa Tahsilatı' : 'Kasa Ödemesi',
    description: m.description,
    amount,
    vatRate,
    vatAmount: vatRate > 0 ? splitVat(amount, vatRate).vat : 0,
    date: m.date,
    account: m.method === 'nakit' ? 'kasa' : 'banka',
    documentNo,
  });
  return true;
}

/**
 * Nakit folio / POS tahsilatını açık kasa oturumuna hareket olarak düşer (defter kaydı üretmez).
 * Açık oturum yoksa veya aynı kaynak daha önce işlendiyse false döner.
 */
export function mirrorCashPaymentToSession(p: {
  sourceType: 'folio' | 'pos';
  sourceId: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  reservationId?: string;
}): boolean {
  if (p.method !== 'nakit' || !(p.amount > 0)) return false;
  const s = useStore.getState();
  if (s.cashMovements.some((m) => m.sourceType === p.sourceType && m.sourceId === p.sourceId)) return false;
  const today = todayStr();
  const open = s.cashSessions.filter((c) => c.status === 'acik');
  const session = open.find((c) => c.date === today) ?? open[open.length - 1];
  if (!session) return false;
  s.add('cashMovements', {
    sessionId: session.id,
    date: session.date,
    type: 'tahsilat',
    amount: round2(p.amount),
    currency: 'TRY',
    exchangeRate: 1,
    method: 'nakit',
    description: p.description,
    employeeId: session.employeeId,
    reservationId: p.reservationId,
    sourceType: p.sourceType,
    sourceId: p.sourceId,
  });
  return true;
}

/** Doğrudan ödenen (odaya yazılmayan) POS siparişini gelir olarak yazar ve nakitse kasaya düşer. */
export function postPosOrderToLedger(orderId: string): boolean {
  const s = useStore.getState();
  const o = s.posOrders.find((x) => x.id === orderId);
  if (!o || o.status !== 'odendi') return false;
  const documentNo = `POS:${o.id}`;
  if (s.transactions.some((t) => t.documentNo === documentNo)) return false;
  const outlet = s.posOutlets.find((x) => x.id === o.outletId);
  const vat = round2(o.items.reduce((n, i) => n + splitVat(i.quantity * i.unitPrice, i.vatRate).vat, 0));
  const amount = round2(o.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0));
  s.add('transactions', {
    type: 'gelir',
    category: 'Restoran & Bar',
    description: `${outlet?.name ?? 'POS'} satışı${o.tableNo ? ` · masa ${o.tableNo}` : ''}`,
    amount,
    vatRate: amount > 0 ? round2((vat / (amount - vat)) * 100) : 0,
    vatAmount: vat,
    date: o.date || todayStr(),
    account: o.paymentMethod === 'nakit' ? 'kasa' : 'banka',
    documentNo,
  });
  if (o.paymentMethod === 'nakit') {
    mirrorCashPaymentToSession({ sourceType: 'pos', sourceId: o.id, amount, method: 'nakit', description: `${outlet?.name ?? 'POS'} nakit satış` });
  }
  return true;
}

/**
 * Ödenmiş veya odaya yazılmış POS siparişinin menü-stok bağlantılı kalemlerini stoktan düşer.
 * Sipariş başına bir kez çalışır; iptal / açık siparişlerde düşmez.
 */
export function deductPosOrderStock(orderId: string): boolean {
  const s = useStore.getState();
  const o = s.posOrders.find((x) => x.id === orderId);
  if (!o || (o.status !== 'odendi' && o.status !== 'odaya_yazildi')) return false;
  if (s.stockMovements.some((m) => m.sourceOrderId === orderId)) return false;
  const need = new Map<string, number>();
  for (const line of o.items) {
    const menu = s.menuItems.find((m) => m.id === line.menuItemId);
    if (!menu?.inventoryItemId) continue;
    need.set(menu.inventoryItemId, (need.get(menu.inventoryItemId) ?? 0) + line.quantity * (menu.stockQuantity ?? 1));
  }
  let any = false;
  need.forEach((qty, itemId) => {
    const item = useStore.getState().inventoryItems.find((i) => i.id === itemId);
    if (!item || qty <= 0) return;
    useStore.getState().update('inventoryItems', itemId, { quantity: round2(Math.max(0, item.quantity - qty)) });
    useStore.getState().add('stockMovements', {
      itemId,
      direction: 'cikis',
      quantity: round2(qty),
      date: o.date || todayStr(),
      description: `POS satışı · ${s.posOutlets.find((x) => x.id === o.outletId)?.name ?? 'POS'}`,
      sourceOrderId: orderId,
    });
    any = true;
  });
  return any;
}
