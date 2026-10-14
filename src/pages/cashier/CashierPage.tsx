import { useMemo, useState } from 'react';
import { postCashMovementToLedger } from '../../store/ledgerLinks';
import {
  Activity, Banknote, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, CreditCard,
  DoorOpen, FileText, Landmark, LockKeyhole, Plus, Receipt, Wallet, XCircle,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Badge, Button, Card, DataTable, DatePicker, Drawer, EmptyState, Input, Modal,
  PageHeader, Select, StatCard, Tabs, Textarea, useToast, type Column,
} from '../../components/ui';
import { addDaysStr, formatCurrency, formatDate, formatDateTime, todayStr } from '../../lib/format';
import { useStore } from '../../store/useStore';
import { calculateNightAuditMetrics } from '../../store/moduleHelpers';
import type { CashCurrency, CashMovement, CashSession, NightAudit, PaymentMethod, Reservation } from '../../types';

type TabKey = 'cash' | 'audit' | 'history';
type MovementKind = 'tahsilat' | 'odeme';
const cashTabs = [
  { key: 'cash', label: 'Kasa' },
  { key: 'audit', label: 'Gün Sonu · Night Audit' },
  { key: 'history', label: 'Geçmiş Kasalar' },
];
const methodNames: Record<PaymentMethod, string> = {
  nakit: 'Nakit', kredi_karti: 'Kart', havale: 'Havale / EFT', sanal_pos: 'Sanal POS',
};
const currencyNames: Record<CashCurrency, string> = { TRY: 'Türk lirası', EUR: 'Euro', USD: 'ABD doları' };
const movementName: Record<CashMovement['type'], string> = { tahsilat: 'Tahsilat', odeme: 'Ödeme', doviz: 'Döviz bozum' };
const converted = (movement: CashMovement) => movement.amount * movement.exchangeRate;
const cashValue = (session: CashSession, movements: CashMovement[]) => {
  const amount = movements.filter((m) => m.sessionId === session.id && m.method === 'nakit').reduce((sum, movement) => {
    const sign = movement.type === 'tahsilat' ? 1 : movement.type === 'odeme' ? -1 : movement.direction === 'giris' ? 1 : -1;
    return sum + sign * converted(movement);
  }, session.openingBalance);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};
const movementColumns = (employees: Map<string, string>): Column<CashMovement>[] => [
  { key: 'date', header: 'İş günü', sortValue: (m) => m.date, render: (m) => formatDate(m.date) },
  { key: 'type', header: 'Hareket', render: (m) => <Badge color={m.type === 'tahsilat' ? 'emerald' : m.type === 'odeme' ? 'rose' : 'violet'}>{movementName[m.type]}{m.type === 'doviz' ? ` · ${m.direction === 'giris' ? 'Giriş' : 'Çıkış'}` : ''}</Badge> },
  { key: 'description', header: 'Açıklama', searchValue: (m) => `${m.description} ${m.currency} ${methodNames[m.method]}`, render: (m) => <div className="font-medium">{m.description}<span className="block text-xs font-normal text-slate-500">{methodNames[m.method]} · {m.currency}{m.currency !== 'TRY' ? ` · kur ${m.exchangeRate.toLocaleString('tr-TR')}` : ''}{m.employeeId ? ` · ${employees.get(m.employeeId) || ''}` : ''}</span></div> },
  { key: 'amount', header: 'Tutar', align: 'right', sortValue: (m) => converted(m), render: (m) => <div className="font-semibold">{m.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {m.currency}<span className="block text-xs font-normal text-slate-500">{formatCurrency(converted(m))} karşılığı</span></div> },
];

export default function CashierPage() {
  const rooms = useStore((s) => s.rooms);
  const reservations = useStore((s) => s.reservations);
  const guests = useStore((s) => s.guests);
  const employees = useStore((s) => s.employees);
  const cashSessions = useStore((s) => s.cashSessions);
  const cashMovements = useStore((s) => s.cashMovements);
  const nightAudits = useStore((s) => s.nightAudits);
  const folioItems = useStore((s) => s.folioItems);
  const posOrders = useStore((s) => s.posOrders);
  const posOutlets = useStore((s) => s.posOutlets);
  const add = useStore((s) => s.add);
  const closeCashSession = useStore((s) => s.closeCashSession);
  const runNightAudit = useStore((s) => s.runNightAudit);
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>('cash');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [exchangeModal, setExchangeModal] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<CashSession | null>(null);
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [openingBalance, setOpeningBalance] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movementKind, setMovementKind] = useState<MovementKind>('tahsilat');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementCurrency, setMovementCurrency] = useState<CashCurrency>('TRY');
  const [movementRate, setMovementRate] = useState('1');
  const [movementMethod, setMovementMethod] = useState<PaymentMethod>('nakit');
  const settings = useStore((s) => s.settings);
  const [movementVat, setMovementVat] = useState<string>('');
  const vatOptions = useMemo(() => { const rates = [settings.vatGeneral, settings.vatAccommodation, settings.vatFood, settings.vatAlcohol].filter((r, i, a) => a.indexOf(r) === i && r > 0); return [...rates.map((r) => ({ value: String(r), label: `%${r}${r === settings.vatGeneral ? ' (genel)' : ''}` })), { value: '0', label: 'KDV yok' }]; }, [settings]);
  const [auditDate, setAuditDate] = useState(todayStr());
  const [auditEmployeeId, setAuditEmployeeId] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [foreignCurrency, setForeignCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [exchangeDirection, setExchangeDirection] = useState<'giris' | 'cikis'>('giris');

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e.fullName])), [employees]);
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g.fullName])), [guests]);
  const roomNumberMap = useMemo(() => new Map(rooms.map((r) => [r.id, r.no])), [rooms]);
  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const todaySessions = useMemo(() => cashSessions.filter((s) => s.date === todayStr()).sort((a, b) => b.openedAt.localeCompare(a.openedAt)), [cashSessions]);
  const selectedSession = useMemo(() => cashSessions.find((s) => s.id === selectedSessionId) || todaySessions.find((s) => s.status === 'acik') || todaySessions[0] || null, [cashSessions, selectedSessionId, todaySessions]);
  const sessionMovements = useMemo(() => cashMovements.filter((m) => m.sessionId === selectedSession?.id).sort((a, b) => b.id.localeCompare(a.id)), [cashMovements, selectedSession]);
  const expected = selectedSession ? cashValue(selectedSession, cashMovements) : 0;
  const selectedAudit = nightAudits.find((a) => a.date === auditDate);
  const auditPreview = useMemo(() => calculateNightAuditMetrics(auditDate, rooms, reservations, folioItems, posOrders, posOutlets), [auditDate, rooms, reservations, folioItems, posOrders, posOutlets]);
  const auditReservations = useMemo(() => reservations.filter((r) => r.checkIn === auditDate && r.status !== 'iptal' || r.checkOut === auditDate && r.status !== 'iptal' || r.checkIn === auditDate && r.status === 'no_show').sort((a, b) => a.checkIn.localeCompare(b.checkIn)), [reservations, auditDate]);

  const openCashSession = () => {
    const value = Number(openingBalance);
    const actor = employeeId || activeEmployees[0]?.id;
    if (!Number.isFinite(value) || value < 0 || !actor) { toast.error('Geçerli açılış bakiyesi ve çalışan seçin.'); return; }
    if (cashSessions.some((s) => s.date === sessionDate && s.status === 'acik')) { toast.warning('Bu tarihte zaten açık bir kasa oturumu var.'); return; }
    const id = add('cashSessions', { date: sessionDate, employeeId: actor, openedAt: new Date().toISOString(), status: 'acik', openingBalance: value, notes: '' });
    setSelectedSessionId(id); setCountedAmount(''); setOpenSessionModal(false); toast.success('Kasa oturumu açıldı.');
  };

  const saveMovement = () => {
    if (!selectedSession || selectedSession.status !== 'acik') return toast.error('Önce açık bir kasa oturumu seçin.');
    const amount = Number(movementAmount); const rate = Number(movementRate);
    if (!movementDescription.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0 || (movementCurrency === 'TRY' && rate !== 1)) return toast.error('Açıklama, tutar ve geçerli döviz kuru girin.');
    const movementId = add('cashMovements', { sessionId: selectedSession.id, date: selectedSession.date, type: movementKind, amount, currency: movementCurrency, exchangeRate: rate, method: movementMethod, description: movementDescription.trim(), employeeId: selectedSession.employeeId, sourceType: 'manuel', vatRate: movementVat === '' ? settings.vatGeneral : Number(movementVat) });
    postCashMovementToLedger(movementId);
    setMovementModal(false); setMovementDescription(''); setMovementAmount(''); setMovementCurrency('TRY'); setMovementRate('1'); toast.success(movementKind === 'tahsilat' ? 'Tahsilat kaydedildi.' : 'Kasa ödemesi kaydedildi.');
  };

  const saveExchange = () => {
    if (!selectedSession || selectedSession.status !== 'acik') return toast.error('Önce açık bir kasa oturumu seçin.');
    const amount = Number(foreignAmount); const rate = Number(exchangeRate);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return toast.error('Döviz tutarı ve kur sıfırdan büyük olmalı.');
    const tl = Math.round((amount * rate + Number.EPSILON) * 100) / 100;
    const exchangeId = `exchange-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const foreignDirection = exchangeDirection; const tlDirection = exchangeDirection === 'giris' ? 'cikis' : 'giris';
    const description = `${foreignCurrency} bozum işlemi`;
    add('cashMovements', { sessionId: selectedSession.id, date: selectedSession.date, type: 'doviz', direction: foreignDirection, amount, currency: foreignCurrency, exchangeRate: rate, method: 'nakit', description: `${description} · döviz`, employeeId: selectedSession.employeeId, exchangeId });
    add('cashMovements', { sessionId: selectedSession.id, date: selectedSession.date, type: 'doviz', direction: tlDirection, amount: tl, currency: 'TRY', exchangeRate: 1, method: 'nakit', description: `${description} · TL karşılığı`, employeeId: selectedSession.employeeId, exchangeId });
    setExchangeModal(false); setForeignAmount(''); toast.success(`${formatCurrency(tl)} karşılıklı döviz işlemi kaydedildi.`);
  };

  const closeSession = () => {
    if (!selectedSession) return;
    const counted = Number(countedAmount);
    try {
      const closed = closeCashSession(selectedSession.id, counted, selectedSession.employeeId, closeNotes);
      setSelectedSessionId(closed.id); setSessionDetail(closed); toast.success(`Kasa kapatıldı · fark ${formatCurrency(closed.difference || 0)}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Kasa kapatılamadı.'); }
  };

  const closeAudit = () => {
    const actor = auditEmployeeId || activeEmployees[0]?.id;
    if (!actor) return toast.error('Gün sonunu kapatacak çalışanı seçin.');
    try {
      const audit = runNightAudit(auditDate, actor, auditNotes);
      toast.success(`${formatDate(audit.date)} gün sonu kaydedildi.`);
      setAuditNotes('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gün sonu kapatılamadı.'); }
  };

  const movementTableColumns = useMemo(() => movementColumns(employeeMap), [employeeMap]);
  const reservationsColumns: Column<Reservation>[] = [
    { key: 'guest', header: 'Misafir', sortValue: (r) => guestMap.get(r.guestId) || '', render: (r) => <span className="font-medium">{guestMap.get(r.guestId) || 'Misafir'}</span> },
    { key: 'room', header: 'Oda', sortValue: (r) => roomNumberMap.get(r.roomId) || '', render: (r) => <Badge color="indigo">{roomNumberMap.get(r.roomId) || '—'}</Badge> },
    { key: 'kind', header: 'Hareket', sortValue: (r) => r.status, render: (r) => <Badge color={r.status === 'no_show' ? 'rose' : r.checkIn === auditDate ? 'emerald' : 'amber'}>{r.status === 'no_show' ? 'No-show' : r.checkIn === auditDate ? 'Giriş' : 'Çıkış'}</Badge> },
    { key: 'date', header: 'Tarih', sortValue: (r) => r.checkIn === auditDate ? r.checkIn : r.checkOut, render: (r) => formatDate(r.checkIn === auditDate ? r.checkIn : r.checkOut) },
    { key: 'people', header: 'Kişi', align: 'center', render: (r) => `${r.adults + r.children} kişi` },
  ];

  return <div className="space-y-6">
    <PageHeader title="Kasa & Gün Sonu" description="Kasa oturumları, tahsilat hareketleri ve gece denetimi." actions={<div className="flex items-center gap-2"><Badge color={todaySessions.some((s) => s.status === 'acik') ? 'emerald' : 'slate'} dot>{todaySessions.some((s) => s.status === 'acik') ? 'Kasa açık' : 'Kasa kapalı'}</Badge>{!todaySessions.some((s) => s.status === 'acik') && todaySessions.length > 0 && <Button size="sm" icon={<Plus size={15}/>} onClick={() => { setSessionDate(todayStr()); setOpeningBalance(''); setEmployeeId(activeEmployees[0]?.id || ''); setOpenSessionModal(true); }}>Yeni oturum</Button>}</div>} />
    <Tabs tabs={cashTabs} active={tab} onChange={(key) => setTab(key as TabKey)} />

    {tab === 'cash' && <div className="space-y-6">
      {!selectedSession && <Card className="border-dashed"><EmptyState title="Bugün için açık kasa oturumu yok" description="Açılış bakiyesi ve sorumlu çalışanı belirleyerek vardiya kasasını başlatın." action={<Button icon={<Plus size={16} />} onClick={() => { setSessionDate(todayStr()); setOpeningBalance(''); setEmployeeId(activeEmployees[0]?.id || ''); setOpenSessionModal(true); }}>Kasa oturumu aç</Button>} /></Card>}
      {selectedSession && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Açılış bakiyesi" value={formatCurrency(selectedSession.openingBalance)} icon={<Wallet />} tone="slate" />
          <StatCard title="Beklenen nakit" value={formatCurrency(expected)} icon={<Banknote />} tone="emerald" />
          <StatCard title="Tahsilat hareketi" value={formatCurrency(sessionMovements.filter((m) => m.type === 'tahsilat').reduce((s, m) => s + converted(m), 0))} icon={<Receipt />} tone="indigo" />
          <StatCard title="Ödeme hareketi" value={formatCurrency(sessionMovements.filter((m) => m.type === 'odeme').reduce((s, m) => s + converted(m), 0))} icon={<Activity />} tone="rose" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Card title="Vardiya kasası" subtitle={`${formatDate(selectedSession.date)} · ${employeeMap.get(selectedSession.employeeId) || 'Sorumlu atanmadı'} · ${formatDateTime(selectedSession.openedAt)}`} actions={<div className="flex flex-wrap gap-2">{selectedSession.status === 'acik' && <><Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => { setMovementKind('tahsilat'); setMovementModal(true); }}>Hareket ekle</Button><Button size="sm" variant="secondary" icon={<CircleDollarSign size={15} />} onClick={() => { setForeignAmount(''); setExchangeRate(''); setExchangeModal(true); }}>Döviz bozum</Button></>}{selectedSession.status === 'kapali' && <Badge color="slate">Kapatıldı</Badge>}</div>}>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><span className="mr-auto text-sm text-slate-600 dark:text-slate-300">Oturum seç</span><select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={selectedSession.id} onChange={(e) => { setSelectedSessionId(e.target.value); setCountedAmount(''); setCloseNotes(''); }}><option value={selectedSession.id}>{selectedSession.date} · {employeeMap.get(selectedSession.employeeId)} · {selectedSession.status === 'acik' ? 'Açık' : 'Kapalı'}</option>{todaySessions.filter((s) => s.id !== selectedSession.id).map((s) => <option value={s.id} key={s.id}>{s.date} · {employeeMap.get(s.employeeId)} · {s.status === 'acik' ? 'Açık' : 'Kapalı'}</option>)}</select></div>
            <DataTable data={sessionMovements} columns={movementTableColumns} rowKey={(m) => m.id} pageSize={6} searchPlaceholder="Hareket ara" emptyTitle="Henüz kasa hareketi yok" emptyDescription="Tahsilat, ödeme veya döviz hareketi ekleyebilirsiniz." />
          </Card>
          <div className="space-y-6">
            <Card title="Ödeme yöntemi kırılımı" subtitle="Tahsilatların TL karşılığı">
              <div className="h-52 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={paymentBreakdown(sessionMovements)} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false}/><XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }}/><YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}/><Bar dataKey="amount" name="Tahsilat" fill="#6366f1" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div className="grid grid-cols-2 gap-2 text-xs">{paymentBreakdown(sessionMovements).map((row) => <div key={row.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"><span>{row.name}</span><b>{formatCurrency(row.amount)}</b></div>)}</div>
            </Card>
            <Card title="Kasa sayımı" subtitle="Kapanışta sayılan nakdi girin; fark otomatik hesaplanır.">
              {selectedSession.status === 'acik' ? <div className="space-y-3"><div className="flex justify-between text-sm"><span className="text-slate-500">Beklenen bakiye</span><b>{formatCurrency(expected)}</b></div><Input label="Sayım sonucu · TL" type="number" min="0" step="0.01" value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} placeholder="Kasadaki nakit"/><div className="flex justify-between rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-950/40"><span>Tahmini fark</span><b className={(Number(countedAmount || 0) - expected) < 0 ? 'text-rose-600' : 'text-emerald-600'}>{countedAmount ? formatCurrency(Number(countedAmount) - expected) : '—'}</b></div><Textarea label="Kapanış notu" rows={2} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Varsa açıklama"/><Button className="w-full" icon={<LockKeyhole size={16}/>} disabled={!countedAmount} onClick={closeSession}>Kasayı kapat</Button></div> : <div className="space-y-3"><div className="flex justify-between text-sm"><span className="text-slate-500">Beklenen</span><b>{formatCurrency(selectedSession.expectedBalance || 0)}</b></div><div className="flex justify-between text-sm"><span className="text-slate-500">Sayılan</span><b>{formatCurrency(selectedSession.countedAmount || 0)}</b></div><div className={`flex justify-between rounded-xl p-3 text-sm ${Number(selectedSession.difference || 0) === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'}`}><span>Kasa farkı</span><b>{formatCurrency(selectedSession.difference || 0)}</b></div>{selectedSession.notes && <p className="text-xs text-slate-500">{selectedSession.notes}</p>}</div>}
            </Card>
          </div>
        </div>
        <Card title="Döviz hızlı hesaplama" subtitle="Kur girişi ile EUR / USD tutarının TL karşılığını görün."><div className="grid gap-4 sm:grid-cols-4"><Select label="Para birimi" value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value as 'EUR' | 'USD')} options={[{value:'EUR',label:'EUR · Euro'},{value:'USD',label:'USD · ABD doları'}]}/><Input label="Kur · 1 birim = TL" type="number" min="0" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)}/><Input label={`Tutar · ${foreignCurrency}`} type="number" min="0" step="0.01" value={foreignAmount} onChange={(e) => setForeignAmount(e.target.value)}/><div className="flex items-end"><div className="w-full rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><span className="block text-xs text-slate-500">TL karşılığı</span><b>{formatCurrency(Number(foreignAmount || 0) * Number(exchangeRate || 0))}</b></div></div></div></Card>
      </>}
    </div>}

    {tab === 'audit' && <div className="space-y-6">
      <Card title="Gün sonu · Night Audit" subtitle="Seçili tarihin operasyonel performansını kontrol edin ve günü kapatın." actions={<DatePicker label="Rapor günü" value={auditDate} onChange={setAuditDate} max={todayStr()} />}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Doluluk" value={`%${(selectedAudit?.occupancy ?? auditPreview.occupancy).toLocaleString('tr-TR', {maximumFractionDigits:1})}`} icon={<Activity/>} tone="indigo"/><StatCard title="Satılan oda" value={`${selectedAudit?.occupiedRooms ?? auditPreview.occupiedRooms} / ${selectedAudit?.totalRooms ?? auditPreview.totalRooms}`} icon={<DoorOpen/>} tone="emerald"/><StatCard title="ADR" value={formatCurrency(selectedAudit?.adr ?? auditPreview.adr)} icon={<Wallet/>} tone="violet"/><StatCard title="RevPAR" value={formatCurrency(selectedAudit?.revpar ?? auditPreview.revpar)} icon={<CircleDollarSign/>} tone="sky"/></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><RevenueCard label="Oda geliri" value={selectedAudit?.revenueSummary.accommodation ?? auditPreview.revenueSummary.accommodation}/><RevenueCard label="F&B" value={(selectedAudit?.revenueSummary.restaurant ?? auditPreview.revenueSummary.restaurant) + (selectedAudit?.revenueSummary.minibar ?? auditPreview.revenueSummary.minibar)}/><RevenueCard label="Spa" value={selectedAudit?.revenueSummary.spa ?? auditPreview.revenueSummary.spa}/><RevenueCard label="Diğer gelir" value={selectedAudit?.revenueSummary.other ?? auditPreview.revenueSummary.other}/><RevenueCard label="Toplam gelir" value={selectedAudit?.totalRevenue ?? auditPreview.totalRevenue} strong/></div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30 sm:flex-row sm:items-end"><Select label="Günü kapatan çalışan" value={auditEmployeeId || activeEmployees[0]?.id || ''} onChange={(e) => setAuditEmployeeId(e.target.value)} options={activeEmployees.map((e) => ({value:e.id,label:e.fullName}))}/><Textarea label="Gün sonu notu" rows={1} value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} placeholder="Vardiya devri, açık hesaplar..."/><Button className="shrink-0" icon={<CheckCircle2 size={16}/>} disabled={!!selectedAudit || auditDate > todayStr()} onClick={closeAudit}>{selectedAudit ? 'Gün sonu kapatıldı' : 'Gün sonunu kapat'}</Button></div>
        {selectedAudit && <p className="mt-3 text-xs text-slate-500">{formatDateTime(selectedAudit.closedAt)} · {employeeMap.get(selectedAudit.closedBy) || 'Çalışan'} tarafından kapatıldı{selectedAudit.notes ? ` · ${selectedAudit.notes}` : ''}</p>}
      </Card>
      <Card title="Giriş, çıkış ve no-show" subtitle={`${formatDate(auditDate)} günü`}>{auditReservations.length ? <DataTable searchable={false} data={auditReservations} columns={reservationsColumns} rowKey={(r) => r.id} emptyTitle="Hareket yok"/> : <EmptyState title="Bu tarihte rezervasyon hareketi yok" description="Giriş, çıkış veya no-show bulunamadı."/>}</Card>
      <Card title="Geçmiş gün sonları" subtitle="Kapatılmış gece denetimleri"><DataTable data={[...nightAudits].sort((a,b)=>b.date.localeCompare(a.date))} columns={auditColumns(employeeMap)} rowKey={(a) => a.id} searchPlaceholder="Tarih veya kapatan çalışan ara" onRowClick={(a) => setAuditDate(a.date)} pageSize={8} emptyTitle="Henüz gün sonu kaydı yok"/></Card>
    </div>}

    {tab === 'history' && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><StatCard title="Toplam oturum" value={cashSessions.length} icon={<CalendarClock/>} tone="indigo"/><StatCard title="Açık oturum" value={cashSessions.filter((s) => s.status === 'acik').length} icon={<Clock3/>} tone="amber"/><StatCard title="Kapatılan oturum" value={cashSessions.filter((s) => s.status === 'kapali').length} icon={<CheckCircle2/>} tone="emerald"/></div><Card title="Kasa oturumları" subtitle="Tüm vardiyaların açılış ve kapanış sayımları"><DataTable data={[...cashSessions].sort((a,b)=>b.openedAt.localeCompare(a.openedAt))} columns={sessionColumns(employeeMap)} rowKey={(s) => s.id} searchPlaceholder="Tarih veya çalışan ara" onRowClick={(s) => setSessionDetail(s)} pageSize={12} emptyTitle="Kasa geçmişi boş"/></Card></div>}

    <Modal open={openSessionModal} onClose={() => setOpenSessionModal(false)} title="Kasa oturumu aç" description="Açılış bakiyesi TRY karşılığıyla kaydedilir." footer={<><Button variant="secondary" onClick={() => setOpenSessionModal(false)}>Vazgeç</Button><Button onClick={openCashSession}>Kasayı aç</Button></>}><div className="space-y-4"><DatePicker label="Oturum günü" value={sessionDate} max={todayStr()} onChange={setSessionDate}/><Select label="Sorumlu çalışan" value={employeeId || activeEmployees[0]?.id || ''} onChange={(e) => setEmployeeId(e.target.value)} options={activeEmployees.map((e) => ({value:e.id,label:e.fullName}))}/><Input label="Açılış bakiyesi · TL" type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="Örn. 5.000"/></div></Modal>

    <Modal open={movementModal} onClose={() => setMovementModal(false)} title="Kasa hareketi ekle" description="Kasa dışı tahsilatları da hareket olarak izleyebilirsiniz." footer={<><Button variant="secondary" onClick={() => setMovementModal(false)}>Vazgeç</Button><Button onClick={saveMovement}>Hareketi kaydet</Button></>}><div className="grid gap-4 sm:grid-cols-2"><Select label="Hareket türü" value={movementKind} onChange={(e) => setMovementKind(e.target.value as MovementKind)} options={[{value:'tahsilat',label:'Tahsilat'},{value:'odeme',label:'Ödeme'}]}/><Select label="KDV oranı" value={movementVat === '' ? String(settings.vatGeneral) : movementVat} onChange={(e) => setMovementVat(e.target.value)} options={vatOptions}/><Select label="Ödeme yöntemi" value={movementMethod} onChange={(e) => setMovementMethod(e.target.value as PaymentMethod)} options={Object.entries(methodNames).map(([value,label]) => ({value,label}))}/><Input label="Açıklama" value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} placeholder="Örn. oda hesabı tahsilatı"/><Input label="Tutar" type="number" min="0" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)}/><Select label="Para birimi" value={movementCurrency} onChange={(e) => { setMovementCurrency(e.target.value as CashCurrency); if (e.target.value === 'TRY') setMovementRate('1'); }} options={Object.entries(currencyNames).map(([value,label]) => ({value,label:`${value} · ${label}`}))}/><Input label="Kur · 1 birim = TL" type="number" min="0" step="0.0001" disabled={movementCurrency === 'TRY'} value={movementRate} onChange={(e) => setMovementRate(e.target.value)}/><div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">TL karşılığı <b className="ml-2">{formatCurrency(Number(movementAmount || 0) * Number(movementRate || 0))}</b></div></div></Modal>

    <Modal open={exchangeModal} onClose={() => setExchangeModal(false)} title="Döviz bozum kaydı" description="Döviz ve TL karşılığı, kasa defterine eş hareket olarak işlenir." footer={<><Button variant="secondary" onClick={() => setExchangeModal(false)}>Vazgeç</Button><Button onClick={saveExchange}>Döviz işlemini kaydet</Button></>}><div className="grid gap-4 sm:grid-cols-2"><Select label="Para birimi" value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value as 'EUR'|'USD')} options={[{value:'EUR',label:'EUR · Euro'},{value:'USD',label:'USD · ABD doları'}]}/><Select label="Döviz hareket yönü" value={exchangeDirection} onChange={(e) => setExchangeDirection(e.target.value as 'giris'|'cikis')} options={[{value:'giris',label:'Döviz kasaya girer · TL çıkar'},{value:'cikis',label:'Döviz kasadan çıkar · TL girer'}]}/><Input label={`Tutar · ${foreignCurrency}`} type="number" min="0" step="0.01" value={foreignAmount} onChange={(e) => setForeignAmount(e.target.value)}/><Input label="Kur · 1 birim = TL" type="number" min="0" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)}/><div className="sm:col-span-2 rounded-xl bg-indigo-50 p-4 text-sm dark:bg-indigo-950/40"><span className="text-slate-500">İşlem karşılığı</span><b className="float-right">{formatCurrency(Number(foreignAmount || 0) * Number(exchangeRate || 0))}</b></div></div></Modal>

    <Drawer open={!!sessionDetail} onClose={() => setSessionDetail(null)} title="Kasa oturumu detayı" description={sessionDetail ? `${formatDate(sessionDetail.date)} · ${employeeMap.get(sessionDetail.employeeId) || 'Çalışan'}` : ''} width="lg">{sessionDetail && <SessionDetail session={sessionDetail} movements={cashMovements.filter((m) => m.sessionId === sessionDetail.id)} employees={employeeMap}/>}</Drawer>
  </div>;
}

function paymentBreakdown(movements: CashMovement[]) {
  const data = [{name:'Nakit',amount:0},{name:'Kart',amount:0},{name:'Havale',amount:0},{name:'EUR',amount:0},{name:'USD',amount:0}];
  movements.filter((m) => m.type === 'tahsilat').forEach((m) => {
    const index = m.currency === 'EUR' ? 3 : m.currency === 'USD' ? 4 : m.method === 'nakit' ? 0 : m.method === 'havale' ? 2 : 1;
    data[index].amount += converted(m);
  });
  return data.map((row) => ({...row,amount:Math.round((row.amount+Number.EPSILON)*100)/100}));
}

function RevenueCard({ label, value, strong=false }: { label:string; value:number; strong?:boolean }) {
  return <div className={`rounded-xl border p-4 ${strong?'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40':'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}><span className="block text-xs text-slate-500">{label}</span><b className={`mt-1 block ${strong?'text-indigo-700 dark:text-indigo-300':'text-slate-900 dark:text-white'}`}>{formatCurrency(value)}</b></div>;
}

function auditColumns(employees:Map<string,string>):Column<NightAudit>[] {
  return [
    {key:'date',header:'İş günü',sortValue:(a)=>a.date,render:(a)=>formatDate(a.date)},
    {key:'occupancy',header:'Doluluk',align:'right',sortValue:(a)=>a.occupancy,render:(a)=><span>%{a.occupancy.toLocaleString('tr-TR',{maximumFractionDigits:1})}</span>},
    {key:'rooms',header:'Satılan oda',align:'center',sortValue:(a)=>a.occupiedRooms,render:(a)=><span>{a.occupiedRooms} / {a.totalRooms}</span>},
    {key:'adr',header:'ADR',align:'right',sortValue:(a)=>a.adr,render:(a)=>formatCurrency(a.adr)},
    {key:'revenue',header:'Toplam gelir',align:'right',sortValue:(a)=>a.totalRevenue,render:(a)=><b>{formatCurrency(a.totalRevenue)}</b>},
    {key:'closedBy',header:'Kapatan',searchValue:(a)=>employees.get(a.closedBy)||'',render:(a)=>employees.get(a.closedBy)||'—'},
  ];
}

function sessionColumns(employees:Map<string,string>):Column<CashSession>[] {
  return [
    {key:'date',header:'Tarih',sortValue:(s)=>s.date,render:(s)=>formatDate(s.date)},
    {key:'employee',header:'Sorumlu',sortValue:(s)=>employees.get(s.employeeId)||'',searchValue:(s)=>employees.get(s.employeeId)||'',render:(s)=><span className="font-medium">{employees.get(s.employeeId)||'—'}</span>},
    {key:'status',header:'Durum',render:(s)=><Badge color={s.status==='acik'?'emerald':'slate'} dot>{s.status==='acik'?'Açık':'Kapalı'}</Badge>},
    {key:'opening',header:'Açılış',align:'right',sortValue:(s)=>s.openingBalance,render:(s)=>formatCurrency(s.openingBalance)},
    {key:'expected',header:'Beklenen',align:'right',sortValue:(s)=>s.expectedBalance||0,render:(s)=>s.expectedBalance===undefined?'—':formatCurrency(s.expectedBalance)},
    {key:'counted',header:'Sayım',align:'right',sortValue:(s)=>s.countedAmount||0,render:(s)=>s.countedAmount===undefined?'—':formatCurrency(s.countedAmount)},
    {key:'difference',header:'Fark',align:'right',sortValue:(s)=>s.difference||0,render:(s)=>s.difference===undefined?'—':<span className={s.difference===0?'text-emerald-600':'text-rose-600'}>{formatCurrency(s.difference)}</span>},
  ];
}

function SessionDetail({session,movements,employees}:{session:CashSession;movements:CashMovement[];employees:Map<string,string>}) {
  const expected=session.expectedBalance ?? cashValue(session,movements);
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><RevenueCard label="Açılış bakiyesi" value={session.openingBalance}/><RevenueCard label="Beklenen bakiye" value={expected}/><RevenueCard label="Sayım sonucu" value={session.countedAmount ?? 0}/><RevenueCard label="Fark" value={session.difference ?? 0} strong/></div><p className="text-xs text-slate-500">{session.status==='kapali'&&session.closedAt?`Kapanış: ${formatDateTime(session.closedAt)} · ${employees.get(session.closedBy||'')||'—'}`:'Bu oturum henüz açık.'}</p>{session.notes&&<p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">{session.notes}</p>}<DataTable data={[...movements].sort((a,b)=>b.id.localeCompare(a.id))} columns={movementColumns(employees)} rowKey={(m)=>m.id} searchable={false} emptyTitle="Hareket bulunmuyor"/></div>;
}
