import type { MenuItem, PosOrder, PosOrderItem, PosOutlet, PosOutletType } from '../../types';
import { round2 } from '../../lib/calc';
import { calculatePosOrderTotal, posLineAmount } from '../../store/moduleHelpers';

export const outletNames: Record<PosOutletType, string> = {
  restoran: 'Restoran', bar: 'Bar', minibar: 'Minibar', spa: 'Spa', oda_servisi: 'Oda servisi',
};

export function menuLine(item: MenuItem): PosOrderItem {
  if (!item.active) throw new Error('Pasif ürün siparişe eklenemez.');
  const line = { menuItemId: item.id, name: item.name, quantity: 1, unitPrice: item.price, vatRate: item.vatRate };
  posLineAmount(line);
  return line;
}

/** Menü fiyatı değişse de mevcut sipariş kalemleri kendi fiyatını korur. */
export function appendItem(items: PosOrderItem[], item: MenuItem): PosOrderItem[] {
  const line = menuLine(item);
  const index = items.findIndex(i => i.menuItemId === line.menuItemId && i.name === line.name && i.unitPrice === line.unitPrice && i.vatRate === line.vatRate);
  return index < 0 ? [...items, line] : items.map((i, at) => at === index ? { ...i, quantity: i.quantity + 1 } : i);
}

export function cartTotals(items: PosOrderItem[]) {
  const groups = new Map<number, { rate: number; gross: number; net: number; vat: number }>();
  for (const item of items) {
    const gross = posLineAmount(item);
    const vat = round2(gross * item.vatRate / (100 + item.vatRate));
    const group = groups.get(item.vatRate) ?? { rate: item.vatRate, gross: 0, net: 0, vat: 0 };
    group.gross = round2(group.gross + gross);
    group.vat = round2(group.vat + vat);
    group.net = round2(group.gross - group.vat);
    groups.set(item.vatRate, group);
  }
  const breakdown = [...groups.values()].sort((a, b) => a.rate - b.rate);
  const total = items.length ? calculatePosOrderTotal(items) : 0;
  const vat = round2(breakdown.reduce((n, g) => n + g.vat, 0));
  return { total, vat, net: round2(total - vat), quantity: items.reduce((n, i) => n + i.quantity, 0), breakdown };
}

export function salesReport(orders: PosOrder[], outlets: PosOutlet[], from: string, to: string, outletId = '') {
  const completed = orders.filter(o => (o.status === 'odendi' || o.status === 'odaya_yazildi') && o.date >= from && o.date <= to && (!outletId || o.outletId === outletId));
  const products = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
  const byOutlet = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  const daily = new Map<string, { date: string; revenue: number }>();
  let revenue = 0; let cash = 0; let card = 0; let room = 0; let vat = 0;
  for (const order of completed) {
    const totals = cartTotals(order.items);
    revenue = round2(revenue + totals.total); vat = round2(vat + totals.vat);
    if (order.status === 'odaya_yazildi') room = round2(room + totals.total);
    else if (order.paymentMethod === 'nakit') cash = round2(cash + totals.total);
    else card = round2(card + totals.total);
    const outlet = byOutlet.get(order.outletId) ?? { id: order.outletId, name: outlets.find(o => o.id === order.outletId)?.name ?? 'Arşiv satış noktası', count: 0, revenue: 0 };
    outlet.count++; outlet.revenue = round2(outlet.revenue + totals.total); byOutlet.set(order.outletId, outlet);
    const day = daily.get(order.date) ?? { date: order.date, revenue: 0 };
    day.revenue = round2(day.revenue + totals.total); daily.set(order.date, day);
    for (const item of order.items) {
      const product = products.get(item.menuItemId) ?? { id: item.menuItemId, name: item.name, quantity: 0, revenue: 0 };
      product.quantity += item.quantity; product.revenue = round2(product.revenue + posLineAmount(item)); products.set(item.menuItemId, product);
    }
  }
  return { revenue, cash, card, room, vat, count: completed.length, average: completed.length ? round2(revenue / completed.length) : 0,
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue),
    outlets: [...byOutlet.values()].sort((a, b) => b.revenue - a.revenue), daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
