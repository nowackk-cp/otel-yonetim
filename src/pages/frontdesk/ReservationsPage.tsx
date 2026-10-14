import { useMemo, useState } from 'react';
import { Plus, CalendarDays, Users, Wallet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatDate, todayStr } from '../../lib/format';
import { reservationTotal } from '../../lib/calc';
import type { Reservation } from '../../types';
import { Badge, Button, DataTable, PageHeader, Select, StatCard } from '../../components/ui';
import { ReservationDetails, ReservationForm, channelLabels, statusColor, statusLabels } from './shared';


export default function ReservationsPage() {
  const reservations = useStore((s) => s.reservations); const guests = useStore((s) => s.guests); const rooms = useStore((s) => s.rooms); const add = useStore((s) => s.add);
  const [createOpen, setCreateOpen] = useState(false); const [selected, setSelected] = useState<Reservation | null>(null); const [statusFilter, setStatusFilter] = useState('all'); const [channelFilter, setChannelFilter] = useState('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const filtered = useMemo(() => reservations.filter((r) => (statusFilter === 'all' || r.status === statusFilter) && (channelFilter === 'all' || r.channel === channelFilter) && (!from || r.checkIn >= from) && (!to || r.checkIn <= to)), [reservations,statusFilter,channelFilter,from,to]);
  const guestMap = useMemo(() => new Map(guests.map(g=>[g.id,g])),[guests]); const roomMap = useMemo(() => new Map(rooms.map(r=>[r.id,r])),[rooms]);
  const todayArrivals = reservations.filter(r=>r.checkIn===todayStr() && ['onayli','opsiyon'].includes(r.status)).length; const inHouse = reservations.filter(r=>r.status==='giris_yapti').length; const pending = reservations.filter(r=>['onayli','opsiyon'].includes(r.status) && r.checkIn>=todayStr()).length;
  const columns = [
    { key:'guest', header:'Misafir', sortValue:(r:Reservation)=>guestMap.get(r.guestId)?.fullName||'', searchValue:(r:Reservation)=>guestMap.get(r.guestId)?.fullName||'', render:(r:Reservation)=><div><div className="font-semibold">{guestMap.get(r.guestId)?.fullName||'Misafir'}</div><div className="text-xs text-slate-500">{guestMap.get(r.guestId)?.phone||'—'}</div></div> },
    { key:'room', header:'Oda', sortValue:(r:Reservation)=>roomMap.get(r.roomId)?.no||'', render:(r:Reservation)=><span className="font-semibold">{roomMap.get(r.roomId)?.no||'—'}</span> },
    { key:'dates', header:'Konaklama', sortValue:(r:Reservation)=>r.checkIn, searchValue:(r:Reservation)=>`${r.checkIn} ${r.checkOut}`, render:(r:Reservation)=><div className="whitespace-nowrap">{formatDate(r.checkIn,'d MMM')} – {formatDate(r.checkOut,'d MMM yyyy')}</div> },
    { key:'channel', header:'Kanal', sortValue:(r:Reservation)=>r.channel, render:(r:Reservation)=><span>{channelLabels[r.channel]}</span> },
    { key:'status', header:'Durum', sortValue:(r:Reservation)=>r.status, render:(r:Reservation)=><Badge color={statusColor[r.status]}>{statusLabels[r.status]}</Badge> },
    { key:'total', header:'Konaklama', align:'right' as const, sortValue:(r:Reservation)=>reservationTotal(r), render:(r:Reservation)=><span className="font-semibold">{formatCurrency(reservationTotal(r))}</span> },
  ];
  return <div className="space-y-6">
    <PageHeader title="Rezervasyonlar" description="Rezervasyon, check-in/out ve misafir hesapları" actions={<Button icon={<Plus size={16}/>} onClick={()=>setCreateOpen(true)}>Yeni rezervasyon</Button>} />
    <div className="grid gap-3 sm:grid-cols-3"><StatCard title="Bugün giriş" value={todayArrivals} icon={<CalendarDays size={18}/>} tone="indigo"/><StatCard title="Şu an konaklıyor" value={inHouse} icon={<Users size={18}/>} tone="emerald"/><StatCard title="Yaklaşan rezervasyon" value={pending} icon={<Wallet size={18}/>} tone="amber"/></div>
    <DataTable data={filtered} columns={columns} rowKey={r=>r.id} onRowClick={setSelected} pageSize={12} searchPlaceholder="Misafir, oda veya tarih ara" emptyTitle="Rezervasyon bulunamadı" emptyDescription="Filtreleri değiştirin veya yeni rezervasyon oluşturun." toolbar={<div className="flex flex-wrap items-center gap-2"><Select aria-label="Durum filtresi" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} options={[{value:'all',label:'Tüm durumlar'},...Object.entries(statusLabels).map(([value,label])=>({value,label}))]}/><Select aria-label="Kanal filtresi" value={channelFilter} onChange={e=>setChannelFilter(e.target.value)} options={[{value:'all',label:'Tüm kanallar'},...Object.entries(channelLabels).map(([value,label])=>({value,label}))]}/><input aria-label="Başlangıç tarihi" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"/><input aria-label="Bitiş tarihi" type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"/></div>}/>
    <ReservationForm open={createOpen} onClose={()=>setCreateOpen(false)}/><ReservationDetails reservation={selected} open={!!selected} onClose={()=>setSelected(null)}/>
  </div>;
}
