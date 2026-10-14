import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { createSeed } from '../../store/seed';
import { todayStr } from '../../lib/format';
import type { MenuItem, PosOrder } from '../../types';
import { appendItem, cartTotals, salesReport } from './posCalc';
import PosPage from './PosPage';

const product: MenuItem = { id: 'food', outletId: 'restaurant', name: 'Test Yemeği', category: 'Ana yemek', price: 110, vatRate: 10, active: true };
const beverage: MenuItem = { id: 'drink', outletId: 'bar', name: 'Test İçeceği', category: 'İçecek', price: 120, vatRate: 20, active: true };
const mount = () => render(<ToastProvider><PosPage /></ToastProvider>);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
beforeEach(() => {
  const seed = createSeed();
  useStore.setState({ ...seed, posOutlets: [{ id: 'restaurant', name: 'Test Restoran', type: 'restoran', active: true }, { id: 'bar', name: 'Test Bar', type: 'bar', active: true }], menuItems: [{ ...product }, { ...beverage }], posOrders: [], folioItems: [] });
});

describe('POS hesapları', () => {
  it('karma KDV, kuruş ve boş sepet hesapları tutarlıdır', () => {
    const items = [...appendItem([], product), ...appendItem([], beverage)];
    items[0].quantity = 2;
    const result = cartTotals(items);
    expect(result.total).toBe(340); expect(result.vat).toBe(40); expect(result.net).toBe(300);
    expect(result.breakdown).toEqual([{ rate: 10, gross: 220, net: 200, vat: 20 }, { rate: 20, gross: 120, net: 100, vat: 20 }]);
    expect(cartTotals([])).toEqual({ total: 0, vat: 0, net: 0, quantity: 0, breakdown: [] });
    const small = cartTotals([{ menuItemId: 'small', name: 'Küçük kalem', quantity: 3, unitPrice: 0.05, vatRate: 20 }]);
    expect(small.total).toBe(0.15); expect(Math.round((small.net + small.vat) * 100)).toBe(15);
  });
  it('fiyat değişen ürün ayrı kalemde eklenir; eski fiyat korunur', () => {
    const old = appendItem([], product); const result = appendItem(old, { ...product, price: 220 });
    expect(result).toHaveLength(2); expect(old[0].unitPrice).toBe(110); expect(old[0].quantity).toBe(1);
    expect(cartTotals(result).total).toBe(330);
    expect(() => appendItem(old, { ...product, active: false })).toThrow('Pasif');
  });
  it('rapor açık/iptal siparişi dışlar; folio satışı tek kez sayılır', () => {
    const base: PosOrder = { id: 'a', outletId: 'restaurant', items: appendItem([], product), total: 999, status: 'odendi', paymentMethod: 'nakit', date: todayStr(), createdAt: new Date().toISOString() };
    const orders: PosOrder[] = [base, { ...base, id: 'b', status: 'odaya_yazildi' }, { ...base, id: 'c', status: 'acik' }, { ...base, id: 'd', status: 'iptal' }];
    const result = salesReport(orders, useStore.getState().posOutlets, todayStr(), todayStr());
    expect(result.count).toBe(2); expect(result.revenue).toBe(220); expect(result.cash).toBe(110); expect(result.room).toBe(110); expect(result.products[0].quantity).toBe(2);
    expect(salesReport(orders, [], '2000-01-01', '2000-01-02').average).toBe(0);
    expect(salesReport(orders, [], todayStr(), todayStr(), 'bar').count).toBe(0);
  });
});

describe('POS satış akışı', () => {
  it('sepete ekleme ve adet işlemleri açık siparişi anında kaydeder', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Test Yemeği artır');
    expect(useStore.getState().posOrders[0].items[0].quantity).toBe(2);
    expect(useStore.getState().posOrders[0].total).toBe(220);
    click('Test Yemeği azalt'); expect(useStore.getState().posOrders[0].total).toBe(110);
    click('Test Yemeği sepetten çıkar'); expect(useStore.getState().posOrders[0].status).toBe('iptal');
    expect(screen.getByRole('button', { name: 'Nakit öde' })).toBeDisabled();
  });
  it('satış noktası değiştirilince açık sepetler korunur', () => {
    mount(); fireEvent.change(screen.getByLabelText('Masa / servis etiketi'), { target: { value: '12' } }); click('Test Yemeği sepete ekle');
    click(/Test Bar/); click('Test İçeceği sepete ekle'); click(/Test Restoran/);
    expect(screen.getByLabelText('Masa / servis etiketi')).toHaveValue('12');
    expect(screen.getByRole('button', { name: 'Test Yemeği artır' })).toBeInTheDocument();
    expect(useStore.getState().posOrders).toHaveLength(2);
  });
  it('nakit ödeme para üstü gösterir ve tek siparişi kapatır', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Nakit öde');
    fireEvent.change(screen.getByLabelText('Alınan nakit (₺)'), { target: { value: '150' } });
    expect(screen.getByText('Para üstü').parentElement?.textContent).toContain('40,00');
    click('Ödemeyi kaydet');
    expect(useStore.getState().posOrders).toHaveLength(1);
    expect(useStore.getState().posOrders[0]).toMatchObject({ status: 'odendi', paymentMethod: 'nakit', total: 110 });
    expect(screen.getByRole('button', { name: 'Nakit öde' })).toBeDisabled();
  });
  it('kart işlemi yalnızca kayıt onaylandıktan sonra kapanır', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Kart öde');
    expect(useStore.getState().posOrders[0].status).toBe('acik'); click('Ödemeyi kaydet');
    expect(useStore.getState().posOrders[0].paymentMethod).toBe('kredi_karti');
  });
  it('odaya aktarım yalnızca giriş yapmış rezervasyona, kaynak sipariş bağıyla yapılır', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Odaya yaz');
    const reservation = useStore.getState().reservations.find(r => r.status === 'giris_yapti')!;
    const option = screen.getAllByRole('radio').find(r => (r as HTMLInputElement).value === reservation.id)!;
    fireEvent.click(option); click('Odaya aktar');
    const order = useStore.getState().posOrders[0]; expect(order.status).toBe('odaya_yazildi'); expect(order.reservationId).toBe(reservation.id);
    expect(useStore.getState().folioItems).toHaveLength(1);
    expect(useStore.getState().folioItems[0]).toMatchObject({ sourceOrderId: order.id, reservationId: reservation.id, amount: 110, vatRate: 10 });
    act(() => { useStore.getState().postPosOrderToFolio(order.id); }); expect(useStore.getState().folioItems).toHaveLength(1);
  });
  it('ödeme penceresi açıldıktan sonra değişen tutar tahsil edilmiş sayılmaz', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Kart öde');
    const order = useStore.getState().posOrders[0];
    act(() => useStore.getState().update('posOrders', order.id, { total: 220, items: [{ ...order.items[0], quantity: 2 }] }));
    click('Ödemeyi kaydet'); expect(useStore.getState().posOrders[0].status).toBe('acik');
    expect(screen.getByText(/Sipariş değişti/)).toBeInTheDocument();
  });
  it('beklemeye alınan masa tekrar açılıp düzenlenebilir', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Beklemeye al'); click(/Açık Siparişler/); click('Siparişi aç');
    click('Test Yemeği artır'); expect(useStore.getState().posOrders[0].total).toBe(220);
  });
});

describe('POS menü yönetimi', () => {
  it('ürün fiyatını düzenler, eski siparişteki fiyatı korur', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Menü Yönetimi'); click('Test Yemeği düzenle');
    fireEvent.change(screen.getByLabelText('KDV dahil fiyat (₺)'), { target: { value: '220' } }); click('Ürünü kaydet');
    expect(useStore.getState().menuItems[0].price).toBe(220); expect(useStore.getState().posOrders[0].items[0].unitPrice).toBe(110);
    click('Satış'); click('Test Yemeği sepete ekle'); expect(useStore.getState().posOrders[0].items).toHaveLength(2);
  });
  it('açık siparişte kullanılan silinecek ürünü pasife alır', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Menü Yönetimi'); click('Test Yemeği sil'); click('Menüden kaldır');
    expect(useStore.getState().menuItems.find(i => i.id === 'food')?.active).toBe(false);
    click('Satış'); expect(screen.queryByRole('button', { name: 'Test Yemeği sepete ekle' })).not.toBeInTheDocument();
    expect(useStore.getState().posOrders[0].items[0].name).toBe('Test Yemeği');
  });
  it('boş veride oda servisi satış noktası ve menü ürünü oluşturulabilir', () => {
    useStore.setState({ posOutlets: [], menuItems: [], posOrders: [] }); mount(); click(/Oda servisi/); click('Satış noktası oluştur');
    expect(useStore.getState().posOutlets[0].type).toBe('oda_servisi'); click('Ürün ekle');
    fireEvent.change(screen.getByLabelText('Ürün adı'), { target: { value: 'Gece çorbası' } });
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'Çorba' } });
    fireEvent.change(screen.getByLabelText('KDV dahil fiyat (₺)'), { target: { value: '180' } }); click('Ürünü kaydet');
    expect(useStore.getState().menuItems[0]).toMatchObject({ name: 'Gece çorbası', price: 180, active: true });
    click('Satış'); expect(screen.getByRole('button', { name: 'Gece çorbası sepete ekle' })).toBeInTheDocument();
  });
  it('rapor sekmesinde outlet ve ürün cirosu görünür', () => {
    mount(); click('Test Yemeği sepete ekle'); click('Kart öde'); click('Ödemeyi kaydet'); click('Satış Raporu');
    expect(screen.getByText('Satış cirosu')).toBeInTheDocument(); expect(screen.getByText('Ürün bazlı satışlar')).toBeInTheDocument();
    const table = screen.getByRole('table'); expect(within(table).getByText('Test Yemeği')).toBeInTheDocument();
  });
});
