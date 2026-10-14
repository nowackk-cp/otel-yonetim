import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BedDouble,
  Users,
  LogIn,
  LogOut,
  TrendingUp,
  AlertTriangle,
  Clock,
  Wrench,
  Package,
  Calendar,
  Plus,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useStore } from '../../store/useStore';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  todayStr,
  addDaysStr,
  currentPeriod,
} from '../../lib/format';
import {
  occupancyRate,
  folioBalance,
  occupiesNight,
} from '../../lib/calc';
import { StatCard, Card, Badge, Button, Tabs, Avatar } from '../../components/ui';
import type { RoomStatus } from '../../types';
import { calculateCashSessionBalance, calculateNightAuditMetrics } from '../../store/moduleHelpers';

const ROOM_STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; badge: 'emerald' | 'indigo' | 'amber' | 'sky' | 'rose' | 'slate' }> = {
  bos: { label: 'Boş / Hazır', color: '#10b981', badge: 'emerald' },
  dolu: { label: 'Dolu', color: '#6366f1', badge: 'indigo' },
  kirli: { label: 'Kirli', color: '#f59e0b', badge: 'amber' },
  temizleniyor: { label: 'Temizleniyor', color: '#0ea5e9', badge: 'sky' },
  bakimda: { label: 'Bakımda', color: '#f43f5e', badge: 'rose' },
  bloke: { label: 'Bloke', color: '#64748b', badge: 'slate' },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const today = todayStr();
  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures'>('arrivals');

  // Zustand Store selectors
  const settings = useStore((s) => s.settings);
  const rooms = useStore((s) => s.rooms);
  const roomTypes = useStore((s) => s.roomTypes);
  const guests = useStore((s) => s.guests);
  const reservations = useStore((s) => s.reservations);
  const transactions = useStore((s) => s.transactions);
  const employees = useStore((s) => s.employees);
  const shifts = useStore((s) => s.shifts);
  const attendance = useStore((s) => s.attendance);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const maintenanceTickets = useStore((s) => s.maintenanceTickets);
  const inventoryItems = useStore((s) => s.inventoryItems);
  const activityLogs = useStore((s) => s.activityLogs);
  const folioItems = useStore((s) => s.folioItems);
  const payments = useStore((s) => s.payments);
  const posOrders = useStore((s) => s.posOrders);
  const posOutlets = useStore((s) => s.posOutlets);
  const guestFeedbacks = useStore((s) => s.guestFeedbacks);
  const cashSessions = useStore((s) => s.cashSessions);
  const cashMovements = useStore((s) => s.cashMovements);

  // Lookups
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const roomTypeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes]);
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Metrikler
  const currentOccupancy = useMemo(() => occupancyRate(rooms, reservations, today), [rooms, reservations, today]);
  const emptyRoomsCount = useMemo(() => rooms.filter((r) => r.status === 'bos').length, [rooms]);

  // Bugün giriş & çıkış rezervasyonları
  const todayArrivals = useMemo(
    () =>
      reservations.filter(
        (r) => r.checkIn === today && r.status !== 'iptal' && r.status !== 'no_show',
      ),
    [reservations, today],
  );

  const todayDepartures = useMemo(
    () =>
      reservations.filter(
        (r) => r.checkOut === today && r.status !== 'iptal' && r.status !== 'no_show',
      ),
    [reservations, today],
  );

  // Şu an otelde konaklayan toplam misafir (yetişkin + çocuk)
  const inHouseGuestCount = useMemo(() => {
    return reservations
      .filter((r) => occupiesNight(r, today) || (r.status === 'giris_yapti' && r.checkIn <= today && r.checkOut >= today))
      .reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0);
  }, [reservations, today]);

  // Bu ayın toplam geliri
  const currentMonthPeriod = useMemo(() => currentPeriod(), []);
  const monthlyRevenue = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'gelir' && t.date.startsWith(currentMonthPeriod))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, currentMonthPeriod]);

  // Bugün vardiyadaki personel
  const todayShifts = useMemo(() => {
    return shifts.filter((s) => s.date === today);
  }, [shifts, today]);

  // Oda durumu dağılımı (Halka grafik verisi)
  const roomStatusData = useMemo(() => {
    const counts: Record<RoomStatus, number> = {
      bos: 0,
      dolu: 0,
      kirli: 0,
      temizleniyor: 0,
      bakimda: 0,
      bloke: 0,
    };
    rooms.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });

    return (Object.keys(counts) as RoomStatus[])
      .map((status) => ({
        name: ROOM_STATUS_CONFIG[status]?.label || status,
        key: status,
        value: counts[status],
        color: ROOM_STATUS_CONFIG[status]?.color || '#94a3b8',
      }))
      .filter((item) => item.value > 0);
  }, [rooms]);

  // Son 30 günlük gelir grafiği
  const last30DaysRevenue = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = addDaysStr(today, -i);
      dayMap.set(d, 0);
    }

    transactions.forEach((t) => {
      if (t.type === 'gelir' && dayMap.has(t.date)) {
        dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
      }
    });

    return Array.from(dayMap.entries()).map(([date, revenue]) => ({
      date,
      formattedDate: formatDate(date, 'd MMM'),
      gelir: Math.round(revenue),
    }));
  }, [today, transactions]);

  // Uyarılar Paneli Verileri
  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.quantity <= item.minQuantity),
    [inventoryItems],
  );

  const urgentMaintenanceTickets = useMemo(
    () =>
      maintenanceTickets.filter(
        (t) =>
          (t.status === 'acik' || t.status === 'devam') &&
          (t.priority === 'acil' || t.priority === 'yuksek'),
      ),
    [maintenanceTickets],
  );

  const pendingLeaveRequests = useMemo(
    () => leaveRequests.filter((l) => l.status === 'beklemede'),
    [leaveRequests],
  );

  // Ayrılanlar arasında ödenmemiş bakiyesi olanlar
  const departuresWithUnpaidBalance = useMemo(() => {
    return todayDepartures
      .map((res) => {
        const balance = folioBalance(folioItems, payments, res.id);
        const guest = guestMap.get(res.guestId);
        const room = roomMap.get(res.roomId);
        return { res, guest, room, balance };
      })
      .filter((item) => item.balance > 0);
  }, [todayDepartures, folioItems, payments, guestMap, roomMap]);

  // Vergi uyarısını ayarlardaki beyan günlerinden en yakınına göre oluştur.
  const taxAlert = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const configuredDeadlines = [
      { name: 'KDV beyanı', day: settings.taxDeadlineDay },
      { name: 'Muhtasar ve prim hizmet', day: settings.withholdingDeadlineDay },
      { name: 'Konaklama vergisi', day: settings.accommodationDeadlineDay },
    ];
    const upcoming = configuredDeadlines.map((item) => {
      let date = new Date(todayDate.getFullYear(), todayDate.getMonth(), item.day);
      if (date < todayDate) date = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, item.day);
      return { ...item, date, daysLeft: Math.round((date.getTime() - todayDate.getTime()) / 86400000) };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
    const next = upcoming[0];
    return {
      daysLeft: next.daysLeft,
      targetMonth: next.date.toLocaleDateString('tr-TR', { month: 'long' }),
      deadlineName: next.name,
      isNear: next.daysLeft <= 7,
    };
  }, [today, settings.taxDeadlineDay, settings.withholdingDeadlineDay, settings.accommodationDeadlineDay]);

  // Karşılama mesajı
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }, []);

  const audit = useMemo(() => { try { return calculateNightAuditMetrics(today, rooms, reservations, folioItems, posOrders, posOutlets); } catch { return { revenueSummary: { restaurant: 0, minibar: 0 } }; } }, [today, rooms, reservations, folioItems, posOrders, posOutlets]);
  const fnbToday = audit.revenueSummary.restaurant + audit.revenueSummary.minibar;
  const avgRating = guestFeedbacks.length ? guestFeedbacks.reduce((n, f) => n + f.rating, 0) / guestFeedbacks.length : null;
  const openCash = cashSessions.filter((c) => c.status === 'acik');
  const cashLabel = openCash.length ? `Açık · ${formatCurrency(openCash.reduce((n, c) => n + calculateCashSessionBalance(c, cashMovements), 0), true)}` : 'Kapalı';

  return (
    <div className="space-y-6 pb-10">
      {/* Üst Bar: Selamlama ve Tarih */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {greeting}, Yönetici 👋
            </h1>
            <Badge color="indigo" dot>
              Canlı Sistem
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
              {formatDate(today, 'd MMMM yyyy, EEEE')}
            </span>
            <span className="hidden sm:inline">•</span>
            <span>{settings.hotelName} Yönetim Özeti</span>
          </div>
        </div>

        {/* Hızlı İşlem Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/reservations')}
          >
            Yeni Rezervasyon
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Receipt className="h-4 w-4" />}
            onClick={() => navigate('/accounting')}
          >
            Gider Ekle
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => navigate('/housekeeping')}
          >
            Kat Hizmetleri
          </Button>
        </div>
      </div>

      {/* Ana StatCard'lar (7 Metrik) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        <StatCard
          title="Bugünkü Doluluk"
          value={formatPercent(currentOccupancy, 0)}
          icon={<BedDouble />}
          tone="indigo"
          change={currentOccupancy > 60 ? 4.8 : -2.1}
          changeLabel="geçen haftaya göre"
        />
        <StatCard
          title="Boş Oda"
          value={`${emptyRoomsCount} / ${rooms.length}`}
          icon={<Sparkles />}
          tone="emerald"
        />
        <StatCard
          title="Bugün Giriş"
          value={`${todayArrivals.length} oda`}
          icon={<LogIn />}
          tone="sky"
        />
        <StatCard
          title="Bugün Çıkış"
          value={`${todayDepartures.length} oda`}
          icon={<LogOut />}
          tone="amber"
        />
        <StatCard
          title="Oteldeki Misafir"
          value={`${inHouseGuestCount} kişi`}
          icon={<Users />}
          tone="violet"
        />
        <StatCard
          title="Bu Ayın Geliri"
          value={formatCurrency(monthlyRevenue, true)}
          icon={<TrendingUp />}
          tone="emerald"
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          title="İşteki Personel"
          value={`${todayShifts.length} kişi`}
          icon={<Clock />}
          tone="slate"
        />
      </div>

      {/* Küçük kartlar: F&B cirosu, misafir puanı, kasa */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Bugünkü F&B Cirosu" value={formatCurrency(fnbToday, true)} icon={<Receipt />} tone="amber" />
        <StatCard title="Ortalama Misafir Puanı" value={avgRating === null ? '—' : `${avgRating.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} / 5`} icon={<Sparkles />} tone="violet" />
        <StatCard title="Kasa Durumu" value={cashLabel} icon={<Package />} tone={openCash.length ? 'emerald' : 'slate'} />
      </div>

      {/* Grafikler Alanı: 30 Günlük Gelir + Oda Durumu Halka Grafiği */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gelir Alan Grafiği (2 Kolon) */}
        <Card
          className="lg:col-span-2"
          title="30 Günlük Gelir Trendi"
          subtitle="Son 30 günün gerçekleşen günlük tahsilat ve oda gelirleri"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/reports')}
            >
              Rapor Detayı
            </Button>
          }
        >
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last30DaysRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={3}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₺${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: number) => [formatCurrency(val), 'Gelir']}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? formatDate(item.date, 'd MMMM yyyy') : '';
                  }}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area
                  type="monotone"
                  dataKey="gelir"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Oda Durumu Halka Grafiği (1 Kolon) */}
        <Card
          title="Oda Durumu Dağılımı"
          subtitle={`Toplam ${rooms.length} odanın anlık operasyonel durumu`}
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/rooms')}
            >
              Odalar
            </Button>
          }
        >
          <div className="relative flex h-56 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roomStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {roomStatusData.map((entry) => (
                    <Cell key={`cell-${entry.key}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [`${val} Oda (%${Math.round((val / rooms.length) * 100)})`, name]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-800 dark:text-white">
                {rooms.length}
              </span>
              <span className="text-xs font-medium text-slate-400">Toplam Oda</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
            {roomStatusData.map((st) => (
              <div key={st.key} className="flex items-center justify-between py-1">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                  {st.name}
                </span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {st.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Orta Bölüm: Uyarılar & Önemli Aksiyonlar Paneli */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Operasyonel Uyarılar ve Yaklaşan Yükümlülükler</span>
          </div>
        }
        subtitle="Öncelikli müdahale gerektiren teknik, finansal ve idari durumlar"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Düşük Stok Uyarısı */}
          <div className="flex flex-col justify-between rounded-xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-sm">
                  <Package className="h-4 w-4" />
                  <span>Kritik Stok Uyarısı</span>
                </div>
                <Badge color="rose">{lowStockItems.length}</Badge>
              </div>
              <p className="mt-2 text-xs text-rose-800 dark:text-rose-300">
                {lowStockItems.length > 0
                  ? `${lowStockItems.slice(0, 2).map((i) => i.name).join(', ')}${lowStockItems.length > 2 ? ` ve ${lowStockItems.length - 2} ürün daha` : ''} minimum seviyenin altında.`
                  : 'Tüm stoklar güvenli seviyede.'}
              </p>
            </div>
            <Link
              to="/inventory"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400"
            >
              Sipariş listesini aç →
            </Link>
          </div>

          {/* 2. Açık Acil Arızalar */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                  <Wrench className="h-4 w-4" />
                  <span>Acil & Yüksek Arızalar</span>
                </div>
                <Badge color="amber">{urgentMaintenanceTickets.length}</Badge>
              </div>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {urgentMaintenanceTickets.length > 0
                  ? `${urgentMaintenanceTickets[0].title} (${urgentMaintenanceTickets[0].area}) başta olmak üzere açık acil kayıtlar var.`
                  : 'Kritik veya acil arıza bulunmuyor.'}
              </p>
            </div>
            <Link
              to="/maintenance"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400"
            >
              Bakım paneline git →
            </Link>
          </div>

          {/* 3. Bekleyen İzin Talepleri & Borçlu Çıkışlar */}
          <div className="flex flex-col justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Bekleyen İzinler & Çıkışlar</span>
                </div>
                <Badge color="indigo">
                  {pendingLeaveRequests.length + departuresWithUnpaidBalance.length}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-indigo-800 dark:text-indigo-300">
                {pendingLeaveRequests.length > 0 && `${pendingLeaveRequests.length} personel izin onayı bekliyor. `}
                {departuresWithUnpaidBalance.length > 0 &&
                  `${departuresWithUnpaidBalance.length} çıkış yapacak odanın açık bakiyesi var.`}
                {pendingLeaveRequests.length === 0 && departuresWithUnpaidBalance.length === 0 && 'Bekleyen talep yok.'}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Link
                to="/leaves"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-400"
              >
                İzinleri incele →
              </Link>
              {departuresWithUnpaidBalance.length > 0 && (
                <Link
                  to="/reservations"
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-400"
                >
                  Bakiyeler →
                </Link>
              )}
            </div>
          </div>

          {/* 4. Yaklaşan Vergi Günleri */}
          <div className="flex flex-col justify-between rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 font-semibold text-sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Vergi & Beyanname</span>
                </div>
                <Badge color={taxAlert.isNear ? 'rose' : 'violet'}>
                  {taxAlert.daysLeft} Gün Kaldı
                </Badge>
              </div>
              <p className="mt-2 text-xs text-violet-800 dark:text-violet-300">
                {taxAlert.deadlineName}: {taxAlert.daysLeft === 0 ? 'bugün' : `${taxAlert.daysLeft} gün içinde`} · {taxAlert.targetMonth}. KDV: {settings.taxDeadlineDay}, muhtasar: {settings.withholdingDeadlineDay}, konaklama vergisi: {settings.accommodationDeadlineDay}.
              </p>
            </div>
            <Link
              to="/taxes"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-400"
            >
              Vergi takvimini gör →
            </Link>
          </div>
        </div>
      </Card>

      {/* Alt Bölüm: Bugün Giriş / Çıkış Listeleri + Vardiyadaki Personel + Son Aktiviteler */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol 2 Kolon: Bugün Giriş / Çıkış Listeleri */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Giriş & Çıkış Hareketleri"
            subtitle="Bugün otele gelecek ve otelden ayrılacak misafirler"
            actions={
              <Tabs
                tabs={[
                  { key: 'arrivals', label: 'Bugün Giriş', count: todayArrivals.length },
                  { key: 'departures', label: 'Bugün Çıkış', count: todayDepartures.length },
                ]}
                active={activeTab}
                onChange={(key) => setActiveTab(key as 'arrivals' | 'departures')}
              />
            }
          >
            {activeTab === 'arrivals' ? (
              todayArrivals.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Bugün giriş yapacak yeni rezervasyon bulunmuyor.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todayArrivals.map((res) => {
                    const guest = guestMap.get(res.guestId);
                    const room = roomMap.get(res.roomId);
                    const roomType = room ? roomTypeMap.get(room.typeId) : undefined;
                    return (
                      <div
                        key={res.id}
                        className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={guest?.fullName || 'Misafir'} size="md" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {guest?.fullName || 'Bilinmeyen Misafir'}
                              </span>
                              {guest?.vip && <Badge color="amber">VIP</Badge>}
                              <Badge color="slate">{res.channel}</Badge>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              Oda: <strong className="text-indigo-600 dark:text-indigo-400">{room?.no || 'Atanmadı'}</strong> ({roomType?.name || 'Standart'}) • {res.adults} Yetişkin{res.children > 0 ? `, ${res.children} Çocuk` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <span className="block font-medium text-slate-700 dark:text-slate-300">
                              Çıkış: {formatDate(res.checkOut, 'd MMM')}
                            </span>
                            <span className="text-slate-400">{formatCurrency(res.nightlyRate)} / gece</span>
                          </div>
                          <Badge color={res.status === 'giris_yapti' ? 'emerald' : 'sky'}>
                            {res.status === 'giris_yapti' ? 'Giriş Yaptı' : 'Bekleniyor'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : todayDepartures.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Bugün ayrılacak misafir bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {todayDepartures.map((res) => {
                  const guest = guestMap.get(res.guestId);
                  const room = roomMap.get(res.roomId);
                  const balance = folioBalance(folioItems, payments, res.id);
                  return (
                    <div
                      key={res.id}
                      className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={guest?.fullName || 'Misafir'} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {guest?.fullName || 'Bilinmeyen Misafir'}
                            </span>
                            {guest?.vip && <Badge color="amber">VIP</Badge>}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Oda: <strong className="text-indigo-600 dark:text-indigo-400">{room?.no}</strong> • Giriş: {formatDate(res.checkIn, 'd MMM')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <span className="block text-slate-500">Folio Durumu:</span>
                          {balance > 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              Borç: {formatCurrency(balance)}
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Bakiye Sıfır ✓
                            </span>
                          )}
                        </div>
                        <Badge color={res.status === 'cikis_yapti' ? 'slate' : 'amber'}>
                          {res.status === 'cikis_yapti' ? 'Ayrıldı' : 'Çıkış Bekliyor'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Vardiyadaki Personel Kartı */}
          <Card
            title="Bugünün Vardiyasında Görevli Personel"
            subtitle={`${todayShifts.length} çalışan bugün aktif vardiya çizelgesinde yer alıyor`}
            actions={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate('/shifts')}
              >
                Vardiya Planı
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {todayShifts.slice(0, 8).map((shift) => {
                const emp = empMap.get(shift.employeeId);
                const att = attendance.find(
                  (a) => a.employeeId === shift.employeeId && a.date === today,
                );
                const isCheckedIn = Boolean(att?.checkIn);

                return (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={emp?.fullName || 'Personel'} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-white">
                          {emp?.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {emp?.position}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {shift.start} - {shift.end}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isCheckedIn ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-[10px] text-slate-500">
                          {isCheckedIn ? 'İş Başında' : 'Vardiya Bekleniyor'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {todayShifts.length > 8 && (
              <div className="mt-3 text-center">
                <Link
                  to="/shifts"
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  +{todayShifts.length - 8} personeli daha vardiya takviminde görüntüle →
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Sağ 1 Kolon: Son Sistem Aktiviteleri */}
        <Card
          className="h-fit"
          title="Son Aktiviteler"
          subtitle="Otel içi son işlemler ve sistem günlüğü"
          actions={
            <Badge color="slate">
              <Activity className="h-3 w-3 mr-1 inline" /> Canlı Günlük
            </Badge>
          }
        >
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {activityLogs.slice(0, 9).map((log) => {
              const timeStr = new Date(log.date).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              let dotColor = 'bg-slate-400';
              let badgeColor: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' = 'slate';

              if (log.module === 'on_buro') {
                dotColor = 'bg-indigo-500';
                badgeColor = 'indigo';
              } else if (log.module === 'muhasebe') {
                dotColor = 'bg-emerald-500';
                badgeColor = 'emerald';
              } else if (log.module === 'operasyon') {
                dotColor = 'bg-amber-500';
                badgeColor = 'amber';
              } else if (log.module === 'ik') {
                dotColor = 'bg-sky-500';
                badgeColor = 'sky';
              }

              return (
                <div key={log.id} className="relative group">
                  <div
                    className={`absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-2 ring-slate-100 dark:border-slate-900 dark:ring-slate-800 ${dotColor}`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {log.message}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeStr}</span>
                  </div>
                  <div className="mt-1">
                    <Badge color={badgeColor} className="text-[10px] py-0 px-1.5">
                      {log.module}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
