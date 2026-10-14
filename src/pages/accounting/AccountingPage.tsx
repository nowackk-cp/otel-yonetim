import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Landmark, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, ConfirmDialog, DataTable, DatePicker, Input, Modal, PageHeader, Select, StatCard, useToast } from '../../components/ui';
import { useStore } from '../../store/useStore';
import type { Transaction, TransactionType } from '../../types';
import { formatCurrency, formatDate, formatMonth, todayStr } from '../../lib/format';
import { calculateVat, calculateAccommodationCharge, calculateProvisionalTax, isAccommodation } from './taxCalc';
import { COLORS, chartTooltip, downloadCsv, groupAmounts, MoneyRow, usePeriod } from './shared';
const categories = { gelir: ['Konaklama', 'Restoran', 'Alkollü İçecek', 'Minibar', 'Restoran & Bar', 'Spa & Hizmetler', 'Transfer', 'Diğer Gelir'], gider: ['Personel', 'Gıda & İçecek', 'Elektrik', 'Su', 'Doğalgaz', 'İletişim', 'Temizlik Malzemesi', 'Bakım & Onarım', 'Pazarlama', 'Komisyon', 'Sigorta', 'Vergi', 'Geçici Vergi', 'Tekstil', 'Diğer Gider'] };
const blank = (type: TransactionType, rate: number) => ({ type, category: categories[type][0], description: '', amount: '', vatRate: String(rate), included: 'yes', date: todayStr(), account: 'banka', documentNo: '', supplierId: '' });
export default function AccountingPage() {
  const transactions = useStore((s) => s.transactions); const suppliers = useStore((s) => s.suppliers); const settings = useStore((s) => s.settings);
  const add = useStore((s) => s.add); const update = useStore((s) => s.update); const remove = useStore((s) => s.remove); const log = useStore((s) => s.log);
  const toast = useToast(); const period = usePeriod();
  const [kind, setKind] = useState(''); const [category, setCategory] = useState(''); const [account, setAccount] = useState(''); const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<string>(); const [deleting, setDeleting] = useState<Transaction>();
  const [form, setForm] = useState(blank('gelir', settings.vatAccommodation));
  const rates = [...new Set([0, settings.vatAccommodation, settings.vatFood, settings.vatAlcohol, settings.vatGeneral, Number(form.vatRate)])].sort((a, b) => a - b);
  const accommodation = form.type === 'gelir' && isAccommodation(form.category);
  const service = calculateVat(Number(form.amount) || 0, Number(form.vatRate), form.included === 'yes');
  const totals = accommodation ? calculateAccommodationCharge(Number(form.amount) || 0, Number(form.vatRate), settings.accommodationTax, form.included === 'yes') : { ...calculateVat(Number(form.amount) || 0, Number(form.vatRate), form.included === 'yes'), accommodationTax: 0 };
  const dated = useMemo(() => transactions.filter((t) => period.valid && t.date >= period.from && t.date <= period.to), [transactions, period.from, period.to, period.valid]);
  const filtered = useMemo(() => dated.filter((t) => (!kind || t.type === kind) && (!category || t.category === category) && (!account || t.account === account) && `${t.description} ${t.category} ${t.documentNo ?? ''} ${suppliers.find((s) => s.id === t.supplierId)?.name ?? ''}`.toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR'))), [dated, kind, category, account, query, suppliers]);
  const income = dated.filter((t) => t.type === 'gelir').reduce((s, t) => s + t.amount, 0);
  const expense = dated.filter((t) => t.type === 'gider').reduce((s, t) => s + t.amount, 0);
  const profit = calculateProvisionalTax(dated, 0, 0, settings.accommodationTax).profit;
  const balance = (a: string) => transactions.filter((t) => t.date <= period.to && t.account === a).reduce((s, t) => s + (t.type === 'gelir' ? t.amount : -t.amount), 0);
  const pie = useMemo(() => groupAmounts(dated.filter((t) => t.type === 'gider'), (t) => t.category, (t) => t.amount), [dated]);
  const monthly = useMemo(() => {
    const months = new Map<string, { month: string; gelir: number; gider: number }>();
    dated.forEach((t) => { const key = t.date.slice(0, 7); const row = months.get(key) ?? { month: key, gelir: 0, gider: 0 }; row[t.type] += t.amount; months.set(key, row); });
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, month: formatMonth(m.month) }));
  }, [dated]);
  function start(type: TransactionType) { setEditing(undefined); setForm(blank(type, type === 'gelir' ? settings.vatAccommodation : 0)); setOpen(true); }
  function edit(t: Transaction) { setEditing(t.id); setForm({ ...t, amount: String(t.amount), vatRate: String(t.vatRate), included: 'yes', documentNo: t.documentNo ?? '', supplierId: t.supplierId ?? '' }); setOpen(true); }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.category.trim() || !form.description.trim() || !form.date || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0 || !Number.isFinite(Number(form.vatRate)) || Number(form.vatRate) < 0 || Number(form.vatRate) > 100) return toast.error('Tarih, açıklama, kategori ve pozitif tutar gerekli.');
    if (['Geçici Vergi'].includes(form.category) && !/^GECICI:\d{4}:Q[1-4]$/.test(form.documentNo.trim())) return toast.error('Geçici vergi için belge no GECICI:2026:Q1 biçiminde olmalı.');
    const item: Omit<Transaction, 'id'> = { type: form.type, category: form.category.trim(), description: form.description.trim(), amount: service.gross, vatRate: Number(form.vatRate), vatAmount: service.vat, date: form.date, account: form.account as Transaction['account'], documentNo: form.documentNo.trim(), supplierId: form.supplierId || undefined };
    if (editing) update('transactions', editing, item); else add('transactions', item);
    log(`${form.description}: muhasebe kaydı ${editing ? 'güncellendi' : 'eklendi'}`, 'muhasebe'); toast.success('İşlem kaydedildi.'); setOpen(false);
  }
  function exportCsv() {
    downloadCsv(`muhasebe-${period.from}-${period.to}.csv`, [['Tarih', 'Tür', 'Kategori', 'Açıklama', 'KDV dahil tutar', 'KDV oranı', 'KDV', 'Hesap', 'Belge no', 'Tedarikçi'], ...filtered.map((t) => [t.date, t.type, t.category, t.description, t.amount.toFixed(2), t.vatRate, calculateVat(t.amount, t.vatRate).vat.toFixed(2), t.account, t.documentNo ?? '', suppliers.find((s) => s.id === t.supplierId)?.name ?? ''])]);
  }
  return <div className="space-y-6">
    <PageHeader title="Gelir & gider defteri" description="Nakit akışınızı izleyin, her işlemi kayıt altına alın." actions={<><Button variant="secondary" icon={<Download />} onClick={exportCsv}>CSV indir</Button><Button variant="secondary" icon={<Plus />} onClick={() => start('gider')}>Gider ekle</Button><Button icon={<Plus />} onClick={() => start('gelir')}>Gelir ekle</Button></>} />
    {period.controls}{!period.valid && <p className="text-sm text-rose-600">Geçerli bir tarih aralığı seçin.</p>}
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <StatCard title="Toplam gelir" value={formatCurrency(income, true)} icon={<ArrowDownLeft />} tone="emerald" valueClassName="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight" />
      <StatCard title="Toplam gider" value={formatCurrency(expense, true)} icon={<ArrowUpRight />} tone="rose" valueClassName="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight" />
      <StatCard title="Net kâr (KDV hariç)" value={formatCurrency(profit, true)} icon={<TrendingUp />} valueClassName="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight" />
      <StatCard title="Kasa bakiyesi" value={formatCurrency(balance('kasa'), true)} icon={<Wallet />} tone="amber" valueClassName="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight" />
      <StatCard title="Banka bakiyesi" value={formatCurrency(balance('banka'), true)} icon={<Landmark />} tone="sky" valueClassName="text-lg sm:text-xl 2xl:text-2xl font-bold tracking-tight" />
    </div>
    <p className="text-xs text-slate-500">Gelir, gider ve bakiyeler KDV dahildir. Net kâr, defterdeki KDV hariç gelir−gider farkıdır. Bakiyeler kayıt başlangıcından dönem sonuna kadardır.</p>
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title="Gelir ve gider dengesi" subtitle="Seçilen dönemin aylık hareketleri" className="lg:col-span-3"><div className="h-72">{monthly.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b830" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} /><YAxis tickFormatter={(v) => `${v / 1000}b`} tick={{ fontSize: 11, fill: '#94a3b8' }} /><Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltip} /><Legend /><Bar dataKey="gelir" name="Gelir" fill="#6366f1" radius={[5, 5, 0, 0]} /><Bar dataKey="gider" name="Gider" fill="#f43f5e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="pt-24 text-center text-slate-400">Bu dönemde hareket yok.</p>}</div></Card>
      <Card title="Giderlerin dağılımı" subtitle="Kategori bazında gider" className="lg:col-span-2"><div className="h-72">{pie.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{pie.map((p, i) => <Cell key={p.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer> : <p className="pt-24 text-center text-slate-400">Bu dönemde gider yok.</p>}</div></Card>
    </div>
    <DataTable data={filtered} rowKey={(t) => t.id} initialSort={{ key: 'date', dir: 'desc' }} searchable={false} toolbar={<><Input aria-label="İşlem ara" placeholder="Açıklama, belge, tedarikçi ara..." value={query} onChange={(e) => setQuery(e.target.value)} /><Select aria-label="İşlem türü" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: '', label: 'Tüm işlemler' }, { value: 'gelir', label: 'Gelir' }, { value: 'gider', label: 'Gider' }]} /><Select aria-label="Kategori filtresi" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'Tüm kategoriler' }, ...[...new Set(transactions.map((t) => t.category))].sort().map((c) => ({ value: c, label: c }))]} /><Select aria-label="Hesap filtresi" value={account} onChange={(e) => setAccount(e.target.value)} options={[{ value: '', label: 'Tüm hesaplar' }, { value: 'kasa', label: 'Kasa' }, { value: 'banka', label: 'Banka' }]} /></>} columns={[
      { key: 'date', header: 'Tarih', sortValue: (t) => t.date, render: (t) => formatDate(t.date) },
      { key: 'description', header: 'İşlem', searchValue: (t) => `${t.description} ${t.documentNo ?? ''} ${suppliers.find((s) => s.id === t.supplierId)?.name ?? ''}`, render: (t) => <div><p className="font-medium">{t.description}</p><p className="text-xs text-slate-400">{t.documentNo || 'Belge no yok'} · {suppliers.find((s) => s.id === t.supplierId)?.name || 'Genel işlem'}</p></div> },
      { key: 'category', header: 'Kategori', sortValue: (t) => t.category },
      { key: 'type', header: 'Tür', render: (t) => <Badge color={t.type === 'gelir' ? 'emerald' : 'rose'}>{t.type === 'gelir' ? 'Gelir' : 'Gider'}</Badge> },
      { key: 'account', header: 'Hesap', render: (t) => t.account === 'kasa' ? 'Kasa' : 'Banka' },
      { key: 'vatAmount', header: 'KDV', align: 'right', render: (t) => <span>{formatCurrency(calculateVat(t.amount, t.vatRate).vat)} <small className="text-slate-400">(%{t.vatRate})</small></span> },
      { key: 'amount', header: 'Tutar', align: 'right', sortValue: (t) => t.amount, render: (t) => <span className={t.type === 'gelir' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>{t.type === 'gelir' ? '+' : '−'}{formatCurrency(t.amount)}</span> },
      { key: 'actions', header: '', render: (t) => <div className="flex gap-1"><Button size="sm" variant="ghost" aria-label="İşlemi düzenle" icon={<Pencil size={15} />} onClick={() => edit(t)} /><Button size="sm" variant="ghost" aria-label="İşlemi sil" icon={<Trash2 size={15} />} onClick={() => setDeleting(t)} /></div> },
    ]} />
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Muhasebe kaydını düzenle' : form.type === 'gelir' ? 'Yeni gelir kaydı' : 'Yeni gider kaydı'} size="lg" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Vazgeç</Button><Button type="submit" form="transaction-form">Kaydet</Button></>}>
      <form id="transaction-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <DatePicker label="İşlem tarihi" required value={form.date} onChange={(date) => setForm({ ...form, date })} />
        <Input label="Kategori" required list="accounting-categories" value={form.category} onChange={(e) => { const category = e.target.value; const vatRate = ['Alkollü İçecek'].includes(category) ? settings.vatAlcohol : category === 'Konaklama' ? settings.vatAccommodation : category === 'Restoran' ? settings.vatFood : ['Personel', 'Personel Maaşı', 'Vergi', 'Geçici Vergi', 'Sigorta'].includes(category) ? 0 : Number(form.vatRate); setForm({ ...form, category, vatRate: String(vatRate) }); }} /><datalist id="accounting-categories">{categories[form.type].map((c) => <option key={c} value={c} />)}</datalist>
        <Input label="Açıklama" required wrapperClassName="sm:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Tutar (₺)" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Select label="Tutar biçimi" value={form.included} onChange={(e) => setForm({ ...form, included: e.target.value })} options={[{ value: 'yes', label: accommodation ? 'KDV dahil hizmet bedeli (konaklama vergisi hariç)' : 'KDV dahil' }, { value: 'no', label: 'KDV hariç' }]} />
        <Select label="KDV oranı" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} options={rates.map((r) => ({ value: String(r), label: `%${r}` }))} />
        <Select label="Hesap" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} options={[{ value: 'kasa', label: 'Kasa' }, { value: 'banka', label: 'Banka' }]} />
        <Input label="Belge numarası" value={form.documentNo} onChange={(e) => setForm({ ...form, documentNo: e.target.value })} />
        <Select label="Tedarikçi" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} options={[{ value: '', label: 'Tedarikçi seçilmedi' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
        <div className="rounded-2xl bg-indigo-50 p-4 text-sm dark:bg-indigo-950/40 sm:col-span-2"><MoneyRow label="KDV hariç hizmet bedeli" value={formatCurrency(totals.net)} /><MoneyRow label="KDV" value={formatCurrency(totals.vat)} /><MoneyRow label="Deftere kaydedilecek hizmet tutarı" value={formatCurrency(service.gross)} strong />{accommodation && <><MoneyRow label="Ayrıca konaklama vergisi" value={formatCurrency(totals.accommodationTax)} /><MoneyRow label="Vergiler dahil genel toplam" value={formatCurrency(totals.gross)} strong /><p className="mt-3 text-xs">GİB uyumlu hesap: konaklama vergisi KDV hariç hizmet bedelinden hesaplanır ve KDV matrahına dahil edilmez. Defter tutarı konaklama vergisini içermez; vergi merkezinde ayrıca hesaplanır.</p></>}</div>
      </form>
    </Modal>
    <ConfirmDialog open={!!deleting} onClose={() => setDeleting(undefined)} title="Muhasebe kaydı silinsin mi?" message={`${deleting?.description ?? ''} kaydı silinecek ve hesap bakiyesi güncellenecek.`} confirmText="Kaydı sil" onConfirm={() => { if (deleting) { remove('transactions', deleting.id); log('Muhasebe kaydı silindi: ' + deleting.description, 'muhasebe'); toast.success('Kayıt silindi.'); } }} />
  </div>;
}

