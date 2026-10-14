import { deductPosOrderStock, postPosOrderToLedger } from '../../store/ledgerLinks';
import { useMemo, useState, type FormEvent } from 'react';
import { Banknote, BedDouble, Check, ChefHat, CreditCard, GlassWater, Minus, Plus, Search, ShoppingBag, Sparkles, Trash2, UtensilsCrossed, Wine, X } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Select, Tabs, useToast } from '../../components/ui';
import { useStore } from '../../store/useStore';
import type { MenuItem, PosOrder, PosOutletType } from '../../types';
import { formatCurrency, formatDate, formatDateTime, formatNumber, todayStr } from '../../lib/format';
import { round2 } from '../../lib/calc';
import { appendItem, cartTotals, outletNames } from './posCalc';
import MenuManagement from './MenuManagement';
import SalesReport from './SalesReport';

const icons = { restoran: UtensilsCrossed, bar: Wine, minibar: GlassWater, spa: Sparkles, oda_servisi: BedDouble };
const norm = (value: string) => value.toLocaleLowerCase('tr-TR').trim();
const fingerprint = (order: PosOrder) => JSON.stringify([order.items, order.total, order.status, order.outletId]);
type Settlement = { orderId: string; method: 'nakit' | 'kredi_karti' | 'room'; total: number; fingerprint: string };

export default function PosPage() {
  const outlets = useStore(s => s.posOutlets); const menu = useStore(s => s.menuItems); const orders = useStore(s => s.posOrders);
  const reservations = useStore(s => s.reservations); const guests = useStore(s => s.guests); const rooms = useStore(s => s.rooms);
  const [tab, setTab] = useState('sale'); const [selectedOutlet, setSelectedOutlet] = useState('');
  const [currentIds, setCurrentIds] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { tableNo: string; notes: string }>>({});
  const [query, setQuery] = useState(''); const [category, setCategory] = useState(''); const [orderSearch, setOrderSearch] = useState('');
  const [cancelId, setCancelId] = useState<string>(); const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [reservationId, setReservationId] = useState(''); const [guestSearch, setGuestSearch] = useState(''); const [received, setReceived] = useState('');
  const [outletForm, setOutletForm] = useState<{ name: string; type: PosOutletType } | null>(null); const toast = useToast();
  const activeOutlets = useMemo(() => outlets.filter(o => o.active), [outlets]);
  const outlet = activeOutlets.find(o => o.id === selectedOutlet) ?? activeOutlets[0]; const outletId = outlet?.id ?? '';
  const current = orders.find(o => o.id === currentIds[outletId] && o.status === 'acik');
  const cart = current?.items ?? []; const totals = useMemo(() => cartTotals(cart), [cart]);
  const meta = current ?? drafts[outletId] ?? { tableNo: '', notes: '' };
  const available = useMemo(() => menu.filter(i => i.outletId === outletId && i.active), [menu, outletId]);
  const categories = useMemo(() => [...new Set(available.map(i => i.category))].sort((a, b) => a.localeCompare(b, 'tr')), [available]);
  const products = useMemo(() => available.filter(i => (!category || i.category === category) && norm(`${i.name} ${i.category}`).includes(norm(query))), [available, category, query]);
  const openOrders = useMemo(() => orders.filter(o => o.status === 'acik' && o.outletId === outletId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [orders, outletId]);
  const matches = openOrders.filter(o => norm(`${o.tableNo ?? ''} ${o.roomNo ?? ''} ${o.notes ?? ''} ${o.items.map(i => i.name).join(' ')}`).includes(norm(orderSearch)));
  const staying = useMemo(() => reservations.filter(r => r.status === 'giris_yapti' && rooms.some(room => room.id === r.roomId)).map(r => ({ id: r.id, roomNo: rooms.find(room => room.id === r.roomId)!.no, guestName: guests.find(g => g.id === r.guestId)?.fullName ?? 'Misafir', checkOut: r.checkOut })).sort((a, b) => a.roomNo.localeCompare(b.roomNo, 'tr', { numeric: true })), [reservations, rooms, guests]);
  const filteredGuests = staying.filter(r => norm(`${r.roomNo} ${r.guestName}`).includes(norm(guestSearch)));
  function clearSelection(id = outletId) { setCurrentIds(ids => ({ ...ids, [id]: '' })); setDrafts(d => ({ ...d, [id]: { tableNo: '', notes: '' } })); }
  function error(err: unknown) { toast.error(err instanceof Error ? err.message : 'İşlem tamamlanamadı.'); }
  function selectOutlet(id: string) { setSelectedOutlet(id); setCategory(''); setQuery(''); setOrderSearch(''); }
  function latestOrder(id: string) {
    const state = useStore.getState(); const order = state.posOrders.find(o => o.id === id);
    if (!order || order.status !== 'acik') throw new Error('Sipariş artık açık değil. Açık siparişleri kontrol edin.');
    if (!state.posOutlets.some(o => o.id === order.outletId && o.active)) throw new Error('Satış noktası aktif değil.');
    if (order.folioItemIds?.length || state.folioItems.some(f => f.sourceOrderId === id)) throw new Error('Sipariş misafir hesabına aktarılmış; tekrar değiştirilemez.');
    return order;
  }
  function addProduct(product: MenuItem) {
    try {
      const store = useStore.getState(); const fresh = store.menuItems.find(i => i.id === product.id && i.outletId === outletId);
      if (!fresh || !store.posOutlets.some(o => o.id === outletId && o.active)) throw new Error('Ürün veya satış noktası artık mevcut değil.');
      const order = currentIds[outletId] ? latestOrder(currentIds[outletId]) : undefined;
      const items = appendItem(order?.items ?? [], fresh); const total = cartTotals(items).total;
      if (order) store.update('posOrders', order.id, { items, total });
      else {
        const id = store.add('posOrders', { outletId, items, total, status: 'acik', date: todayStr(), createdAt: new Date().toISOString(), tableNo: drafts[outletId]?.tableNo.trim() || undefined, notes: drafts[outletId]?.notes.trim() || undefined });
        setCurrentIds(ids => ({ ...ids, [outletId]: id }));
      }
    } catch (err) { error(err); }
  }
  function quantity(index: number, change: number) {
    if (!current) return;
    try {
      const order = latestOrder(current.id); if (!order.items[index]) return;
      const items = order.items.map((i, at) => at === index ? { ...i, quantity: round2(i.quantity + change) } : i).filter(i => i.quantity > 0);
      if (!items.length) { useStore.getState().update('posOrders', order.id, { status: 'iptal' }); clearSelection(); }
      else useStore.getState().update('posOrders', order.id, { items, total: cartTotals(items).total });
    } catch (err) { error(err); }
  }
  function metadata(key: 'tableNo' | 'notes', value: string) {
    try {
      if (current) { latestOrder(current.id); useStore.getState().update('posOrders', current.id, { [key]: value }); }
      else setDrafts(d => ({ ...d, [outletId]: { tableNo: d[outletId]?.tableNo ?? '', notes: d[outletId]?.notes ?? '', [key]: value } }));
    } catch (err) { error(err); }
  }
  function openPayment(method: Settlement['method']) {
    if (!current) return;
    try {
      const order = latestOrder(current.id); const total = cartTotals(order.items).total;
      if (!order.items.length || total <= 0) throw new Error('Ödeme için pozitif tutarlı ürün ekleyin.');
      setSettlement({ orderId: order.id, method, total, fingerprint: fingerprint(order) }); setReceived(String(total)); setGuestSearch('');
      setReservationId(staying.some(r => r.id === order.reservationId) ? order.reservationId! : '');
    } catch (err) { error(err); }
  }
  function settle(event: FormEvent) {
    event.preventDefault(); if (!settlement) return;
    try {
      const store = useStore.getState(); const order = latestOrder(settlement.orderId);
      if (fingerprint(order) !== settlement.fingerprint) throw new Error('Sipariş değişti. Ödeme penceresini kapatıp yeni tutarı kontrol edin.');
      const total = cartTotals(order.items).total;
      if (settlement.method === 'room') {
        const reservation = store.reservations.find(r => r.id === reservationId && r.status === 'giris_yapti');
        const room = store.rooms.find(r => r.id === reservation?.roomId);
        if (!reservation || !room) throw new Error('Giriş yapmış bir misafir ve oda seçin.');
        store.update('posOrders', order.id, { reservationId: reservation.id, roomNo: room.no }); store.postPosOrderToFolio(order.id); deductPosOrderStock(order.id);
        toast.success(`${formatCurrency(total)} oda ${room.no} hesabına yazıldı.`);
      } else {
        if (settlement.method === 'nakit' && (!Number.isFinite(Number(received)) || round2(Number(received)) < total)) throw new Error('Alınan nakit tutarı sipariş toplamından az olamaz.');
        store.update('posOrders', order.id, { total, status: 'odendi', paymentMethod: settlement.method }); postPosOrderToLedger(order.id); deductPosOrderStock(order.id);
        store.log(`${outlet?.name ?? 'POS'} · ${formatCurrency(total)} ${settlement.method === 'nakit' ? 'nakit' : 'kart'} ödeme kaydedildi`, 'operasyon');
        toast.success('Ödeme kaydedildi. Sipariş kapatıldı.');
      }
      clearSelection(order.outletId); setSettlement(null);
    } catch (err) { error(err); }
  }
  function cancelOrder() {
    if (!cancelId) return;
    try { const order = latestOrder(cancelId); const store = useStore.getState(); store.update('posOrders', order.id, { status: 'iptal' }); store.log(`POS siparişi iptal edildi: ${order.id}`, 'operasyon'); if (current?.id === order.id) clearSelection(); toast.success('Sipariş iptal edildi.'); } catch (err) { error(err); }
  }
  function createOutlet(event: FormEvent) {
    event.preventDefault(); if (!outletForm?.name.trim()) return;
    const store = useStore.getState();
    if (store.posOutlets.some(o => norm(o.name) === norm(outletForm.name))) return toast.error('Bu isimde bir satış noktası zaten var.');
    const id = store.add('posOutlets', { name: outletForm.name.trim(), type: outletForm.type, active: true });
    store.log(`${outletForm.name.trim()} satış noktası oluşturuldu`, 'operasyon'); selectOutlet(id); setOutletForm(null); setTab('menu'); toast.success('Satış noktası hazır. Menü ürünlerini ekleyebilirsiniz.');
  }
  return <div className="space-y-6">
    <PageHeader title="Restoran & Bar · POS" description="Siparişten tahsilata, tüm servis noktaları bir arada." actions={<Button variant="secondary" icon={<Plus size={17} />} onClick={() => setOutletForm({ name: '', type: 'restoran' })}>Satış noktası ekle</Button>} />
    <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Satış noktaları">
      {activeOutlets.map(o => { const Icon = icons[o.type]; const count = orders.filter(order => order.outletId === o.id && order.status === 'acik').length; return <button key={o.id} onClick={() => selectOutlet(o.id)} aria-pressed={outletId === o.id} className={`flex min-h-20 min-w-40 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${outletId === o.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}><Icon size={23} /><div><p className="whitespace-nowrap font-semibold">{o.name}</p><p className={`mt-1 text-xs ${outletId === o.id ? 'text-indigo-200' : 'text-slate-400'}`}>{outletNames[o.type]} · {count} açık</p></div></button>; })}
      {(Object.keys(outletNames) as PosOutletType[]).filter(type => !activeOutlets.some(o => o.type === type)).map(type => { const Icon = icons[type]; return <button key={type} onClick={() => setOutletForm({ name: outletNames[type], type })} className="flex min-h-20 min-w-36 items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-left text-slate-500 hover:border-indigo-400 dark:border-slate-700"><Icon size={22} /><div className="text-sm font-medium">{outletNames[type]}<p className="mt-1 text-xs font-normal">+ Oluştur</p></div></button>; })}
    </div>
    <Tabs active={tab} onChange={setTab} className="[&_button]:min-h-11" tabs={[{ key: 'sale', label: 'Satış' }, { key: 'open', label: 'Açık Siparişler / Masalar', count: openOrders.length }, { key: 'menu', label: 'Menü Yönetimi' }, { key: 'report', label: 'Satış Raporu' }]} />
    {tab === 'sale' && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{outlet?.name ?? 'Satış noktası oluşturun'}</h2><p className="mt-1 text-xs text-slate-500">{available.length} ürün · sepete eklemek için dokunun</p></div><Input aria-label="Menüde ara" placeholder="Ürün veya kategori ara…" icon={<Search size={16} />} value={query} onChange={e => setQuery(e.target.value)} wrapperClassName="w-full sm:w-64" className="h-11" /></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{['', ...categories].map(c => <button key={c} onClick={() => setCategory(c)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-medium ${category === c ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 hover:text-indigo-500 dark:bg-slate-800 dark:text-slate-300'}`}>{c || 'Tümü'}</button>)}</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">{products.map((item, index) => { const count = cart.filter(i => i.menuItemId === item.id).reduce((n, i) => n + i.quantity, 0); const palettes = ['bg-indigo-50 text-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300', 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300', 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300']; const Icon = outlet?.type === 'spa' ? Sparkles : outlet?.type === 'bar' ? Wine : ChefHat; return <button key={item.id} aria-label={`${item.name} sepete ekle`} onClick={() => addProduct(item)} className="group relative flex min-h-48 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"><div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${palettes[index % palettes.length]}`}><Icon size={25} strokeWidth={1.5} /></div>{count > 0 && <span className="absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">{formatNumber(count)}</span>}<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.category}</span><span className="mt-1 flex-1 text-sm font-semibold leading-5">{item.name}</span><span className="mt-4 flex items-center justify-between gap-2"><span className="font-bold text-indigo-600 dark:text-indigo-300">{formatCurrency(item.price)}</span><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white dark:bg-slate-800"><Plus size={18} /></span></span></button>; })}</div>
        {!products.length && <Card><EmptyState title={outlet ? 'Menüde ürün bulunamadı' : 'İlk satış noktanızı oluşturun'} description={query || category ? 'Aramayı veya kategori filtresini değiştirebilirsiniz.' : 'Menü yönetiminden bu satış noktasına ürün ekleyin.'} action={<Button variant="secondary" onClick={() => outlet ? setTab('menu') : setOutletForm({ name: '', type: 'restoran' })}>{outlet ? 'Menü yönetimine git' : 'Satış noktası ekle'}</Button>} /></Card>}
      </div>
      <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-4" aria-label="Sipariş sepeti">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800"><div><h2 className="flex items-center gap-2 font-semibold"><ShoppingBag size={19} className="text-indigo-500" />{current ? 'Açık adisyon' : 'Yeni sipariş'}</h2><p className="mt-1 text-xs text-slate-400">{current ? `#${current.id.slice(-6).toUpperCase()} · otomatik kaydedildi` : 'Ürün ekleyerek başlayın'}</p></div><Button variant="ghost" className="min-h-11" aria-label="Yeni sipariş aç" icon={<Plus size={18} />} onClick={() => clearSelection()} /></div>
        <div className="space-y-4 p-5"><Input label="Masa / servis etiketi" placeholder="Örn. Masa 12, havuz, paket…" disabled={!outlet} maxLength={40} value={meta.tableNo ?? ''} onChange={e => metadata('tableNo', e.target.value)} className="h-11" />
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">{cart.map((item, index) => <div key={`${item.menuItemId}-${index}`} className="border-b border-slate-100 pb-4 last:border-0 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-slate-400">{formatCurrency(item.unitPrice)} · KDV %{item.vatRate}</p></div><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950" aria-label={`${item.name} sepetten çıkar`} onClick={() => quantity(index, -item.quantity)}><X size={16} /></button></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700"><button aria-label={`${item.name} azalt`} className="flex h-11 w-11 items-center justify-center rounded-l-xl hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => quantity(index, -1)}><Minus size={16} /></button><span className="min-w-8 text-center text-sm font-semibold tabular-nums">{formatNumber(item.quantity)}</span><button aria-label={`${item.name} artır`} className="flex h-11 w-11 items-center justify-center rounded-r-xl hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => quantity(index, 1)}><Plus size={16} /></button></div><span className="text-sm font-semibold">{formatCurrency(round2(item.unitPrice * item.quantity))}</span></div></div>)}{!cart.length && <div className="py-8 text-center"><ShoppingBag size={35} strokeWidth={1.3} className="mx-auto text-slate-300 dark:text-slate-600" /><p className="mt-3 text-sm text-slate-400">Sepetiniz servis için hazır.</p></div>}</div>
          <Input label="Sipariş notu" placeholder="Alerjen, servis veya hazırlık notu…" disabled={!outlet} maxLength={300} value={meta.notes ?? ''} onChange={e => metadata('notes', e.target.value)} />
        </div>
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30"><div className="flex justify-between text-xs text-slate-500"><span>{formatNumber(totals.quantity)} ürün · KDV hariç</span><span>{formatCurrency(totals.net)}</span></div>{totals.breakdown.map(g => <div key={g.rate} className="flex justify-between text-xs text-slate-500"><span>KDV %{g.rate} <span className="text-slate-400">({formatCurrency(g.net)} matrah)</span></span><span>{formatCurrency(g.vat)}</span></div>)}<div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700"><span className="text-sm font-semibold">KDV dahil toplam</span><span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-300">{formatCurrency(totals.total)}</span></div><div className="grid grid-cols-2 gap-2 pt-2"><Button size="lg" className="px-3" disabled={!cart.length || totals.total <= 0} icon={<Banknote size={18} />} onClick={() => openPayment('nakit')}>Nakit öde</Button><Button size="lg" className="px-3" disabled={!cart.length || totals.total <= 0} icon={<CreditCard size={18} />} onClick={() => openPayment('kredi_karti')}>Kart öde</Button></div><Button size="lg" className="w-full" variant="secondary" disabled={!cart.length || totals.total <= 0} icon={<BedDouble size={18} />} onClick={() => openPayment('room')}>Odaya yaz</Button>{current && <div className="flex items-center justify-between"><Button variant="ghost" size="sm" className="min-h-11" onClick={() => { clearSelection(); toast.success('Sipariş açık listede saklandı.'); }}>Beklemeye al</Button><Button variant="ghost" size="sm" className="min-h-11 text-rose-500" icon={<Trash2 size={14} />} onClick={() => setCancelId(current.id)}>İptal et</Button></div>}<p className="text-[11px] leading-relaxed text-slate-400">Nakit/kart tahsilatı POS kaydına işlenir. Kasa ve muhasebe aktarımı ayrı takip edilir.</p></div>
      </aside>
    </div>}
    {tab === 'open' && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Servis devam ediyor</h2><p className="mt-1 text-sm text-slate-500">{outlet?.name ?? 'Satış noktası seçin'} · {openOrders.length} açık sipariş · {formatCurrency(openOrders.reduce((n, o) => n + cartTotals(o.items).total, 0))}</p></div><Input aria-label="Açık sipariş ara" placeholder="Masa, oda, ürün veya not ara…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} icon={<Search size={16} />} /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matches.map(order => <Card key={order.id}><div className="flex items-center justify-between"><ShoppingBag size={23} className="text-indigo-500" /><Badge color="amber" dot>Açık</Badge></div><h3 className="mt-4 text-lg font-semibold">{order.tableNo ? `Masa / servis ${order.tableNo}` : order.roomNo ? `Oda ${order.roomNo}` : 'Tezgâh siparişi'}</h3><p className="mt-1 text-xs text-slate-400">{formatDateTime(order.createdAt)} · #{order.id.slice(-6).toUpperCase()}</p><div className="my-4 space-y-1 text-sm text-slate-500">{order.items.slice(0, 3).map((i, at) => <p key={at}>{formatNumber(i.quantity)} × {i.name}</p>)}{order.items.length > 3 && <p>+{order.items.length - 3} kalem daha</p>}</div>{order.notes && <p className="mb-4 rounded-xl bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800">{order.notes}</p>}<div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800"><b className="text-lg">{formatCurrency(cartTotals(order.items).total)}</b><div className="flex gap-1"><Button variant="ghost" aria-label={`${order.id} iptal et`} icon={<Trash2 size={16} />} onClick={() => setCancelId(order.id)} /><Button onClick={() => { setCurrentIds(ids => ({ ...ids, [order.outletId]: order.id })); setTab('sale'); }}>Siparişi aç</Button></div></div></Card>)}</div>{!matches.length && <Card><EmptyState title="Açık sipariş bulunamadı" description="Yeni satışlar ödeme yapılana kadar burada saklanır." action={<Button onClick={() => { clearSelection(); setTab('sale'); }}>Yeni satışa başla</Button>} /></Card>}</div>}
    {tab === 'menu' && <MenuManagement outletId={outletId} />}
    {tab === 'report' && <SalesReport />}
    <Modal open={!!settlement} onClose={() => setSettlement(null)} title={settlement?.method === 'room' ? 'Misafir hesabına yaz' : settlement?.method === 'nakit' ? 'Nakit ödemeyi kaydet' : 'Kart ödemesini kaydet'} description={outlet?.name}>
      {settlement && <form onSubmit={settle} className="space-y-5"><div className="rounded-2xl bg-indigo-50 p-5 dark:bg-indigo-950"><p className="text-sm text-indigo-600 dark:text-indigo-300">Sipariş toplamı</p><p className="mt-1 text-3xl font-semibold text-indigo-700 dark:text-indigo-200">{formatCurrency(settlement.total)}</p></div>
        {settlement.method === 'room' ? <><Input label="Misafir veya oda ara" placeholder="Oda numarası ya da misafir adı…" value={guestSearch} onChange={e => setGuestSearch(e.target.value)} /><div className="max-h-64 space-y-2 overflow-y-auto">{filteredGuests.map(r => <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${reservationId === r.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}><input type="radio" name="pos-guest-room" value={r.id} checked={reservationId === r.id} onChange={() => setReservationId(r.id)} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Oda {r.roomNo} · {r.guestName}</p><p className="mt-1 text-xs text-slate-500">Çıkış: {formatDate(r.checkOut)}</p></div>{reservationId === r.id && <Check size={17} className="text-indigo-500" />}</label>)}{!filteredGuests.length && <p className="py-4 text-center text-sm text-slate-500">Giriş yapmış misafir bulunamadı.</p>}</div><p className="text-xs text-slate-500">Kalemler kendi KDV oranıyla seçilen misafirin folyosuna aktarılır.</p></> : settlement.method === 'nakit' ? <><Input label="Alınan nakit (₺)" type="number" required min={settlement.total} step="0.01" value={received} onChange={e => setReceived(e.target.value)} autoFocus /><div className="flex justify-between rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><span>Para üstü</span><b>{formatCurrency(Math.max(0, round2(Number(received || 0) - settlement.total)))}</b></div></> : <p className="text-sm text-slate-500">Kart terminalindeki tahsilatı tamamladıktan sonra ödemeyi buradan kaydedin.</p>}
        <div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800"><Button variant="secondary" onClick={() => setSettlement(null)}>Vazgeç</Button><Button type="submit" disabled={settlement.method === 'room' && !reservationId}>{settlement.method === 'room' ? 'Odaya aktar' : 'Ödemeyi kaydet'}</Button></div>
      </form>}
    </Modal>
    <Modal open={!!outletForm} onClose={() => setOutletForm(null)} title="Yeni satış noktası" description="Restoran, bar, minibar, spa veya oda servisi için ayrı menü oluşturun.">{outletForm && <form onSubmit={createOutlet} className="space-y-4"><Input label="Satış noktası adı" required maxLength={80} value={outletForm.name} onChange={e => setOutletForm({ ...outletForm, name: e.target.value })} /><Select label="Satış noktası türü" value={outletForm.type} onChange={e => setOutletForm({ ...outletForm, type: e.target.value as PosOutletType })} options={Object.entries(outletNames).map(([value, label]) => ({ value, label }))} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOutletForm(null)}>Vazgeç</Button><Button type="submit">Satış noktası oluştur</Button></div></form>}</Modal>
    <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(undefined)} onConfirm={cancelOrder} title="Açık sipariş iptal edilsin mi?" message="Sipariş iptal durumuna alınacak; satış raporuna ve misafir hesabına dahil edilmeyecek." confirmText="Siparişi iptal et" />
  </div>;
}

