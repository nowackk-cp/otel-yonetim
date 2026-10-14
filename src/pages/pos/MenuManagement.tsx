import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, DataTable, Input, Modal, Select, useToast } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../lib/format';
import { round2 } from '../../lib/calc';
import type { MenuItem } from '../../types';

export default function MenuManagement({ outletId }: { outletId: string }) {
  const items = useStore(s => s.menuItems); const outlets = useStore(s => s.posOutlets); const settings = useStore(s => s.settings);
  const [status, setStatus] = useState('all'); const [editing, setEditing] = useState<MenuItem | null>(null); const [deleting, setDeleting] = useState<MenuItem | null>(null); const toast = useToast();
  const outlet = outlets.find(o => o.id === outletId);
  const visible = useMemo(() => items.filter(i => i.outletId === outletId && (status === 'all' || i.active === (status === 'active'))), [items, outletId, status]);
  const categories = useMemo(() => [...new Set(items.filter(i => i.outletId === outletId).map(i => i.category))].sort(), [items, outletId]);
  const patch = (values: Partial<MenuItem>) => setEditing(i => i ? { ...i, ...values } : i);
  function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    if (!editing.name.trim() || !editing.category.trim() || !Number.isFinite(editing.price) || editing.price <= 0 || !Number.isFinite(editing.vatRate) || editing.vatRate < 0 || editing.vatRate > 100) return toast.error('Ad, kategori, pozitif fiyat ve 0–100 arasında KDV gerekli.');
    const store = useStore.getState();
    if (!store.posOutlets.some(o => o.id === editing.outletId && o.active)) return toast.error('Aktif bir satış noktası seçin.');
    if (store.menuItems.some(i => i.id !== editing.id && i.outletId === editing.outletId && i.name.toLocaleLowerCase('tr-TR') === editing.name.trim().toLocaleLowerCase('tr-TR'))) return toast.error('Bu satış noktasında aynı isimli ürün var.');
    const { id, ...data } = editing;
    const payload = { ...data, name: data.name.trim(), category: data.category.trim(), price: round2(data.price) };
    if (payload.price <= 0) return toast.error('Fiyat en az 0,01 ₺ olmalı.');
    if (id) store.update('menuItems', id, payload); else store.add('menuItems', payload);
    store.log(`${payload.name} menü kaydı ${id ? 'güncellendi' : 'oluşturuldu'}`, 'operasyon'); setEditing(null); toast.success('Menü kaydedildi. Açık siparişlerin fiyatları korunur.');
  }
  function removeItem() {
    if (!deleting) return; const store = useStore.getState();
    if (store.posOrders.some(o => o.status === 'acik' && o.items.some(i => i.menuItemId === deleting.id))) {
      store.update('menuItems', deleting.id, { active: false }); toast.info('Ürün açık siparişte kullanılıyor; silinmek yerine pasife alındı.');
    } else { store.remove('menuItems', deleting.id); toast.success('Ürün silindi; geçmiş satış kayıtları korundu.'); }
    store.log(`${deleting.name} menüden kaldırıldı`, 'operasyon');
  }
  return <div className="space-y-4">
    <Card title={`${outlet?.name ?? 'Satış noktası seçin'} · Menü`} subtitle="Fiyatlar KDV dahildir. Değişiklikler yeni eklenen sipariş kalemlerine uygulanır." actions={<Button disabled={!outlet?.active} icon={<Plus size={17} />} onClick={() => setEditing({ id: '', outletId, name: '', category: '', price: 0, vatRate: outlet?.type === 'spa' ? settings.vatGeneral : settings.vatFood, active: true })}>Ürün ekle</Button>}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500"><Badge color="emerald">{items.filter(i => i.outletId === outletId && i.active).length} aktif ürün</Badge><Badge>{items.filter(i => i.outletId === outletId && !i.active).length} pasif ürün</Badge><span>{categories.length} kategori</span></div>
    </Card>
    <DataTable data={visible} rowKey={i => i.id} searchPlaceholder="Ürün veya kategori ara…" toolbar={<Select aria-label="Menü durumu" value={status} onChange={e => setStatus(e.target.value)} options={[{ value: 'all', label: 'Tüm ürünler' }, { value: 'active', label: 'Aktif ürünler' }, { value: 'inactive', label: 'Pasif ürünler' }]} />} columns={[
      { key: 'name', header: 'Ürün', sortValue: i => i.name, render: i => <span className="font-semibold">{i.name}</span> },
      { key: 'category', header: 'Kategori', sortValue: i => i.category },
      { key: 'price', header: 'KDV dahil fiyat', align: 'right', sortValue: i => i.price, render: i => formatCurrency(i.price) },
      { key: 'vatRate', header: 'KDV', render: i => `%${i.vatRate}` },
      { key: 'active', header: 'Durum', render: i => <Badge color={i.active ? 'emerald' : 'slate'} dot>{i.active ? 'Aktif' : 'Pasif'}</Badge> },
      { key: 'actions', header: 'İşlemler', render: i => <div className="flex gap-1"><Button className="min-h-11" variant="ghost" aria-label={`${i.name} düzenle`} icon={<Pencil size={16} />} onClick={() => setEditing({ ...i })} /><Button className="min-h-11" variant="ghost" aria-label={`${i.name} ${i.active ? 'pasife al' : 'aktifleştir'}`} icon={<Power size={16} />} onClick={() => { useStore.getState().update('menuItems', i.id, { active: !i.active }); toast.success(i.active ? 'Ürün pasife alındı.' : 'Ürün aktifleştirildi.'); }} /><Button className="min-h-11" variant="ghost" aria-label={`${i.name} sil`} icon={<Trash2 size={16} />} onClick={() => setDeleting(i)} /></div> },
    ]} />
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Menü ürününü düzenle' : 'Yeni menü ürünü'} description={outlet?.name}>
      {editing && <form onSubmit={save} className="space-y-4"><Input label="Ürün adı" autoFocus required maxLength={100} value={editing.name} onChange={e => patch({ name: e.target.value })} /><Input label="Kategori" list="pos-menu-categories" required maxLength={60} value={editing.category} onChange={e => patch({ category: e.target.value })} /><datalist id="pos-menu-categories">{categories.map(c => <option key={c} value={c} />)}</datalist><div className="grid grid-cols-2 gap-4"><Input label="KDV dahil fiyat (₺)" type="number" required min="0.01" step="0.01" value={editing.price} onChange={e => patch({ price: Number(e.target.value) })} /><Input label="KDV oranı (%)" type="number" required min="0" max="100" step="0.01" value={editing.vatRate} onChange={e => patch({ vatRate: Number(e.target.value) })} /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => patch({ vatRate: settings.vatFood })}>Yiyecek · %{settings.vatFood}</Button><Button size="sm" variant="secondary" onClick={() => patch({ vatRate: settings.vatAlcohol })}>Alkollü içecek · %{settings.vatAlcohol}</Button><Button size="sm" variant="secondary" onClick={() => patch({ vatRate: settings.vatGeneral })}>Genel · %{settings.vatGeneral}</Button></div><Select label="Satış durumu" value={String(editing.active)} onChange={e => patch({ active: e.target.value === 'true' })} options={[{ value: 'true', label: 'Aktif — satışa açık' }, { value: 'false', label: 'Pasif — satışta gizli' }]} /><div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800"><Button variant="secondary" onClick={() => setEditing(null)}>Vazgeç</Button><Button type="submit">Ürünü kaydet</Button></div></form>}
    </Modal>
    <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={removeItem} title="Ürün menüden kaldırılsın mı?" message={`${deleting?.name ?? ''} kaldırılacak. Açık siparişte kullanılıyorsa pasife alınır; geçmiş siparişler korunur.`} confirmText="Menüden kaldır" />
  </div>;
}
