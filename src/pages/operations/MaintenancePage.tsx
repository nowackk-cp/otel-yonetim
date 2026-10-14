import { useMemo, useState } from 'react';
import {
  Wrench,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  Building,
  Check,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  formatCurrency,
  formatDate,
  todayStr,
  daysBetween,
  addDaysStr,
} from '../../lib/format';
import { splitVat, round2 } from '../../lib/calc';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  Modal,
  Select,
  Input,
  Textarea,
  Tabs,
  DataTable,
  type Column,
  Avatar,
  useToast,
} from '../../components/ui';
import type { MaintenanceTicket, Priority, MaintenanceStatus, Room } from '../../types';

interface PeriodicItem {
  id: string;
  name: string;
  area: string;
  frequency: string;
  lastDate: string;
  nextDate: string;
  company: string;
  status: 'normal' | 'yaklasiyor' | 'gecikti';
}

const PRIORITY_CONFIG: Record<Priority, { label: string; badge: 'rose' | 'amber' | 'sky' | 'slate'; dot?: boolean }> = {
  acil: { label: 'Acil', badge: 'rose', dot: true },
  yuksek: { label: 'Yüksek', badge: 'amber' },
  orta: { label: 'Orta', badge: 'sky' },
  dusuk: { label: 'Düşük', badge: 'slate' },
};

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; badge: 'amber' | 'sky' | 'indigo' | 'emerald' }> = {
  acik: { label: 'Açık', badge: 'amber' },
  devam: { label: 'İşlemde', badge: 'sky' },
  beklemede: { label: 'Beklemede', badge: 'indigo' },
  kapandi: { label: 'Çözüldü / Kapandı', badge: 'emerald' },
};

export default function MaintenancePage() {
  const toast = useToast();
  const today = todayStr();

  // Store
  const rooms = useStore((s) => s.rooms);
  const employees = useStore((s) => s.employees);
  const tickets = useStore((s) => s.maintenanceTickets);
  const settings = useStore((s) => s.settings);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const log = useStore((s) => s.log);

  // Görünüm Sekmesi: kanban | list | periodic
  const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'periodic'>('kanban');

  // Filtreler
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');

  // Modal State'leri
  // 1. Yeni Bilet Modalı
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isRoomTicket, setIsRoomTicket] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('orta');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [setRoomOutOfOrder, setSetRoomOutOfOrder] = useState(true); // Odayı bakıma al seçeneği
  const [initialCost, setInitialCost] = useState('0');

  // 2. Kapatma / Çözme Modalı
  const [closingTicket, setClosingTicket] = useState<MaintenanceTicket | null>(null);
  const [finalCost, setFinalCost] = useState('');
  const [createExpenseTransaction, setCreateExpenseTransaction] = useState(true);
  const [reopenRoomOption, setReopenRoomOption] = useState<'kirli' | 'bos' | 'none'>('kirli');

  // Teknik Personeller
  const techStaff = useMemo(
    () => employees.filter((e) => e.department === 'teknik' && e.active),
    [employees],
  );

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  // Periyodik Bakım Sabit Verisi
  const periodicMaintenanceList: PeriodicItem[] = useMemo(() => {
    return [
      {
        id: 'p-1',
        name: 'Asansör Aylık Periyodik Bakımı',
        area: 'A & B Blok Yolcu Asansörleri',
        frequency: 'Aylık',
        lastDate: addDaysStr(today, -20),
        nextDate: addDaysStr(today, 10),
        company: 'Otis Asansör San.',
        status: 'normal',
      },
      {
        id: 'p-2',
        name: 'Kazan Dairesi & Brülör Kontrolü',
        area: 'Kazan Dairesi (-1. Kat)',
        frequency: '3 Aylık',
        lastDate: addDaysStr(today, -85),
        nextDate: addDaysStr(today, 5),
        company: 'Termo Isı Sistemleri',
        status: 'yaklasiyor',
      },
      {
        id: 'p-3',
        name: 'VRF & Klima Santrali Bakımı',
        area: 'Tüm Katlar & Ortak Alanlar',
        frequency: '6 Aylık',
        lastDate: addDaysStr(today, -190),
        nextDate: addDaysStr(today, -10),
        company: 'Daikin Yetkili Servis',
        status: 'gecikti',
      },
      {
        id: 'p-4',
        name: 'Yangın Tüpleri ve Hidrant Basınç Testi',
        area: 'Tüm Kat Koridorları ve Depolar',
        frequency: '6 Aylık',
        lastDate: addDaysStr(today, -150),
        nextDate: addDaysStr(today, 30),
        company: 'Akdeniz Yangın Güvenlik',
        status: 'normal',
      },
      {
        id: 'p-5',
        name: 'Jeneratör Yük & Akü Testi',
        area: 'Çatı Jeneratör Odası',
        frequency: 'Aylık',
        lastDate: addDaysStr(today, -28),
        nextDate: addDaysStr(today, 2),
        company: 'Aksa Jeneratör Servis',
        status: 'yaklasiyor',
      },
      {
        id: 'p-6',
        name: 'Yüzme Havuzu Filtrasyon & Dozajlama',
        area: 'Açık & Kapalı Havuzlar',
        frequency: 'Haftalık',
        lastDate: addDaysStr(today, -5),
        nextDate: addDaysStr(today, 2),
        company: 'Havuz Kimya & Teknik',
        status: 'normal',
      },
      {
        id: 'p-7',
        name: 'Su Deposu Temizliği & Klorlama',
        area: 'Ana Su Deposu (-2. Kat)',
        frequency: 'Yıllık',
        lastDate: addDaysStr(today, -320),
        nextDate: addDaysStr(today, 45),
        company: 'Antalya Çevre & Arıtma',
        status: 'normal',
      },
    ];
  }, [today]);

  // Filtrelenmiş biletler
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (selectedStaffFilter !== 'all' && t.assignedTo !== selectedStaffFilter) return false;
      return true;
    });
  }, [tickets, priorityFilter, selectedStaffFilter]);

  // Kanban sütunları
  const kanbanCols = useMemo(() => {
    const cols: Record<MaintenanceStatus, MaintenanceTicket[]> = {
      acik: [],
      devam: [],
      beklemede: [],
      kapandi: [],
    };
    filteredTickets.forEach((t) => {
      if (cols[t.status]) cols[t.status].push(t);
    });
    return cols;
  }, [filteredTickets]);

  // İstatistik Sayaçları
  const activeCount = useMemo(
    () => tickets.filter((t) => t.status === 'acik' || t.status === 'devam' || t.status === 'beklemede').length,
    [tickets],
  );
  const urgentCount = useMemo(
    () => tickets.filter((t) => (t.status !== 'kapandi') && (t.priority === 'acil' || t.priority === 'yuksek')).length,
    [tickets],
  );
  const monthlyTotalCost = useMemo(() => {
    return tickets.reduce((sum, t) => sum + (t.cost || 0), 0);
  }, [tickets]);

  // AKSİYONLAR

  // 1. Yeni Bilet Oluştur
  const handleCreateTicket = () => {
    if (!newTitle.trim()) {
      toast.error('Lütfen bir arıza başlığı girin.');
      return;
    }

    let areaName = customArea.trim();
    let roomId: string | undefined = undefined;

    if (isRoomTicket) {
      if (!selectedRoomId) {
        toast.error('Lütfen arızalı odayı seçin.');
        return;
      }
      const room = roomMap.get(selectedRoomId);
      roomId = selectedRoomId;
      areaName = `Oda ${room?.no || selectedRoomId}`;

      // Eğer odayı bakıma alma seçeneği işaretlendiyse
      if (setRoomOutOfOrder && room) {
        update('rooms', room.id, { status: 'bakimda' });
        toast.warning(`Oda ${room.no} bakıma alındı ve satışa kapatıldı.`);
      }
    } else {
      if (!areaName) {
        toast.error('Lütfen arızanın bulunduğu alanı belirtin.');
        return;
      }
    }

    const costNum = Number(initialCost) || 0;

    add('maintenanceTickets', {
      title: newTitle.trim(),
      area: areaName,
      roomId,
      priority: newPriority,
      status: 'acik',
      assignedTo: assignedStaffId || undefined,
      description: newDescription.trim(),
      cost: costNum,
      openedAt: today,
    });

    toast.success(`"${newTitle}" arıza kaydı başarıyla oluşturuldu.`);
    log(`Yeni arıza kaydı açıldı: ${newTitle} (${areaName})`, 'operasyon');

    // Formu sıfırla
    setIsCreateModalOpen(false);
    setNewTitle('');
    setSelectedRoomId('');
    setCustomArea('');
    setNewPriority('orta');
    setAssignedStaffId('');
    setNewDescription('');
    setInitialCost('0');
  };

  // 2. Durum Değiştirme (Açık -> Devam -> Beklemede)
  const handleQuickStatusChange = (ticket: MaintenanceTicket, newStatus: MaintenanceStatus) => {
    if (newStatus === 'kapandi') {
      // Çözümleme modalını aç
      setClosingTicket(ticket);
      setFinalCost(String(ticket.cost || 0));
      return;
    }

    update('maintenanceTickets', ticket.id, { status: newStatus });
    toast.info(`Kayıt durumu "${STATUS_CONFIG[newStatus].label}" olarak güncellendi.`);
    log(`Arıza kaydı durumu güncellendi: ${ticket.title} -> ${newStatus}`, 'operasyon');
  };

  // 3. Arıza Kaydını Çözme / Kapatma (Maliyet & Muhasebe Gideri ile)
  const handleConfirmCloseTicket = () => {
    if (!closingTicket) return;

    const costValue = Number(finalCost) || 0;

    // Bilet güncellemesi
    update('maintenanceTickets', closingTicket.id, {
      status: 'kapandi',
      cost: costValue,
      closedAt: today,
    });

    // Muhasebeye Gider İşleme Seçeneği
    const maintDocNo = `MAINT:${closingTicket.id}`;
    if (createExpenseTransaction && costValue > 0 && !useStore.getState().transactions.some((t) => t.documentNo === maintDocNo)) {
      const { vat } = splitVat(costValue, settings.vatGeneral);
      add('transactions', {
        type: 'gider',
        category: 'Bakım & Onarım',
        description: `${closingTicket.title} (${closingTicket.area}) Bakım-Onarım Bedeli`,
        amount: round2(costValue),
        vatRate: settings.vatGeneral,
        vatAmount: vat,
        date: today,
        account: 'banka',
        documentNo: maintDocNo,
      });
      toast.success(`${formatCurrency(costValue)} tutarındaki bakım maliyeti muhasebeye gider olarak işlendi.`);
    }

    // Odayı tekrar hizmete açma seçeneği
    if (closingTicket.roomId && reopenRoomOption !== 'none') {
      update('rooms', closingTicket.roomId, { status: reopenRoomOption });
      toast.info(`İlgili oda "${reopenRoomOption === 'kirli' ? 'Kirli (Temizlik Bekliyor)' : 'Boş / Hazır'}" durumuna getirildi.`);
    }

    toast.success(`"${closingTicket.title}" arıza kaydı başarıyla kapatıldı.`);
    log(`Arıza kaydı kapatıldı: ${closingTicket.title}. Maliyet: ${formatCurrency(costValue)}`, 'operasyon');

    setClosingTicket(null);
  };

  // 4. Periyodik Bakım Kaydı Başlatma Kısayolu
  const handleStartPeriodicTicket = (item: PeriodicItem) => {
    setNewTitle(item.name);
    setIsRoomTicket(false);
    setCustomArea(item.area);
    setNewPriority(item.status === 'gecikti' ? 'acil' : 'orta');
    setNewDescription(`Periyodik bakım planı dahilinde kontrol ve servis işlemi. Yetkili Servis: ${item.company}. Periyot: ${item.frequency}.`);
    setIsCreateModalOpen(true);
  };

  // Liste Tablosu Kolonları
  const tableColumns: Column<MaintenanceTicket>[] = [
    {
      key: 'title',
      header: 'Arıza / İşlem',
      sortValue: (t) => t.title,
      render: (t) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">{t.title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t.area}</span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Öncelik',
      sortValue: (t) => t.priority,
      render: (t) => {
        const p = PRIORITY_CONFIG[t.priority];
        return (
          <Badge color={p.badge} dot={p.dot}>
            {p.label}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Durum',
      sortValue: (t) => t.status,
      render: (t) => {
        const s = STATUS_CONFIG[t.status];
        return <Badge color={s.badge}>{s.label}</Badge>;
      },
    },
    {
      key: 'assignedTo',
      header: 'Teknik Personel',
      render: (t) => {
        const emp = t.assignedTo ? empMap.get(t.assignedTo) : null;
        return emp ? (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Avatar name={emp.fullName} size="sm" className="h-5 w-5 text-[9px]" />
            <span>{emp.fullName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Atanmadı</span>
        );
      },
    },
    {
      key: 'openedAt',
      header: 'Açılış Tarihi',
      sortValue: (t) => t.openedAt,
      render: (t) => <span className="text-xs">{formatDate(t.openedAt)}</span>,
    },
    {
      key: 'cost',
      header: 'Maliyet',
      align: 'right',
      sortValue: (t) => t.cost,
      render: (t) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {t.cost > 0 ? formatCurrency(t.cost) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'İşlem',
      align: 'right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          {t.status !== 'kapandi' ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              icon={<Check className="h-3 w-3" />}
              onClick={() => handleQuickStatusChange(t, 'kapandi')}
            >
              Çöz & Kapat
            </Button>
          ) : (
            <Badge color="emerald">Tamamlandı</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Sayfa Başlığı */}
      <PageHeader
        title="Bakım, Arıza & Teknik Servis"
        description="Otel genelindeki arıza kayıtları, oda bakım takipleri ve periyodik ekipman kontrolleri"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Yeni Arıza / Bakım Kaydı
          </Button>
        }
      />

      {/* İstatistik Sayaçları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Açık İş Emirleri</span>
            <Badge color="sky">{activeCount}</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{activeCount}</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-soft dark:border-rose-900/30 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Acil & Yüksek</span>
            <Badge color="rose">{urgentCount}</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300">{urgentCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kayıtlı Teknik Personel</span>
            <Badge color="slate">{techStaff.length}</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{techStaff.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Toplam Bakım Harcaması</span>
            <Badge color="emerald">Muhasebe</Badge>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white truncate">
            {formatCurrency(monthlyTotalCost, true)}
          </p>
        </div>
      </div>

      {/* Görünüm Sekmeleri & Filtreler */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <Tabs
          tabs={[
            { key: 'kanban', label: 'Kanban Panosu', count: filteredTickets.length },
            { key: 'list', label: 'Tüm Kayıtlar Tablosu' },
            { key: 'periodic', label: 'Periyodik Bakım Takvimi', count: periodicMaintenanceList.length },
          ]}
          active={activeTab}
          onChange={(k) => setActiveTab(k as 'kanban' | 'list' | 'periodic')}
        />

        {activeTab !== 'periodic' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Öncelik Filtresi */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Tüm Öncelikler</option>
              <option value="acil">Acil</option>
              <option value="yuksek">Yüksek</option>
              <option value="orta">Orta</option>
              <option value="dusuk">Düşük</option>
            </select>

            {/* Personel Filtresi */}
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Tüm Teknik Personeller</option>
              {techStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. KANBAN GÖRÜNÜMÜ */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(STATUS_CONFIG) as MaintenanceStatus[]).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const colTickets = kanbanCols[status];

            return (
              <div
                key={status}
                className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-100/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                {/* Kolon Başlığı */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {cfg.label}
                  </span>
                  <Badge color={cfg.badge}>{colTickets.length}</Badge>
                </div>

                {/* Bilet Kartları */}
                <div className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto max-h-[750px] pr-0.5">
                  {colTickets.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-800">
                      Kayıt yok
                    </div>
                  ) : (
                    colTickets.map((ticket) => {
                      const priorityCfg = PRIORITY_CONFIG[ticket.priority];
                      const assignedEmp = ticket.assignedTo ? empMap.get(ticket.assignedTo) : null;
                      const room = ticket.roomId ? roomMap.get(ticket.roomId) : null;

                      return (
                        <div
                          key={ticket.id}
                          className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-850"
                        >
                          {/* Üst Kısım: Öncelik ve Alan */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                              {ticket.area}
                            </span>
                            <Badge color={priorityCfg.badge} dot={priorityCfg.dot} className="text-[10px]">
                              {priorityCfg.label}
                            </Badge>
                          </div>

                          {/* Başlık & Açıklama */}
                          <h4 className="mt-1 font-semibold text-slate-900 dark:text-white text-sm">
                            {ticket.title}
                          </h4>
                          {ticket.description && (
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                              {ticket.description}
                            </p>
                          )}

                          {/* Oda Durumu Bilgisi */}
                          {room && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <Building className="h-3.5 w-3.5" />
                              <span>Oda {room.no}</span>
                              {room.status === 'bakimda' ? (
                                <Badge color="rose" className="text-[10px] py-0">Bakımda</Badge>
                              ) : (
                                <Badge color="slate" className="text-[10px] py-0">{room.status}</Badge>
                              )}
                            </div>
                          )}

                          {/* Personel & Maliyet */}
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Avatar
                                name={assignedEmp?.fullName || 'Atanmadı'}
                                size="sm"
                                className="h-5 w-5 text-[9px]"
                              />
                              <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[100px]">
                                {assignedEmp?.fullName || 'Atanmadı'}
                              </span>
                            </div>

                            {ticket.cost > 0 && (
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatCurrency(ticket.cost)}
                              </span>
                            )}
                          </div>

                          {/* Durum Değiştirme Butonları */}
                          <div className="mt-3 flex items-center justify-between gap-1">
                            {status === 'acik' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs h-7"
                                onClick={() => handleQuickStatusChange(ticket, 'devam')}
                              >
                                İşleme Al
                              </Button>
                            )}

                            {status === 'devam' && (
                              <div className="flex w-full gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs h-7 px-2"
                                  onClick={() => handleQuickStatusChange(ticket, 'beklemede')}
                                  title="Parça veya servis beklemede"
                                >
                                  Beklet
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="flex-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleQuickStatusChange(ticket, 'kapandi')}
                                >
                                  Çöz & Kapat
                                </Button>
                              </div>
                            )}

                            {status === 'beklemede' && (
                              <div className="flex w-full gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1 text-xs h-7"
                                  onClick={() => handleQuickStatusChange(ticket, 'devam')}
                                >
                                  Devam Et
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="flex-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleQuickStatusChange(ticket, 'kapandi')}
                                >
                                  Tamamla
                                </Button>
                              </div>
                            )}

                            {status === 'kapandi' && (
                              <div className="flex w-full items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-4 w-4" /> Kapatıldı ({formatDate(ticket.closedAt || ticket.openedAt)})
                                </span>
                                <button
                                  onClick={() => handleQuickStatusChange(ticket, 'devam')}
                                  className="text-[11px] text-slate-400 hover:text-indigo-600 underline"
                                >
                                  Yeniden Aç
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. LİSTE TABLOSU GÖRÜNÜMÜ */}
      {activeTab === 'list' && (
        <DataTable
          columns={tableColumns}
          data={filteredTickets}
          rowKey={(t) => t.id}
          searchPlaceholder="Arıza başlığı, oda veya alan ara..."
          emptyTitle="Bakım kaydı bulunamadı"
          emptyDescription="Filtrelere uygun açık veya kapalı bakım kaydı yok."
        />
      )}

      {/* 3. PERİYODİK BAKIM TAKVİMİ GÖRÜNÜMÜ */}
      {activeTab === 'periodic' && (
        <div className="space-y-4">
          <Card
            title="Kritik Ekipman & Periyodik Bakım Planı"
            subtitle="Asansör, kazan dairesi, klima santralleri ve yangın güvenliği periyodik muayene takvimi"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                    <th className="py-3 px-4">Ekipman / Tesisat</th>
                    <th className="py-3 px-4">Konum</th>
                    <th className="py-3 px-4">Periyot</th>
                    <th className="py-3 px-4">Son Bakım</th>
                    <th className="py-3 px-4">Gelecek Bakım</th>
                    <th className="py-3 px-4">Yetkili Servis</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodicMaintenanceList.map((item) => {
                    const daysLeft = daysBetween(today, item.nextDate);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {item.area}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {item.frequency}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {formatDate(item.lastDate)}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {formatDate(item.nextDate)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {item.company}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.status === 'gecikti' ? (
                            <Badge color="rose" dot>Gecikti ({Math.abs(daysLeft)} gün)</Badge>
                          ) : item.status === 'yaklasiyor' ? (
                            <Badge color="amber">{daysLeft} gün kaldı</Badge>
                          ) : (
                            <Badge color="emerald">Normal ({daysLeft} gün)</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs gap-1.5"
                            icon={<Wrench className="h-3.5 w-3.5" />}
                            onClick={() => handleStartPeriodicTicket(item)}
                          >
                            Bakım Emri Aç
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* YENİ KAYIT MODALI */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Yeni Arıza / Bakım Kaydı Oluştur"
        description="Teknik servise iş emri iletin veya odayı bakıma alın"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleCreateTicket}>
              Kaydı Oluştur
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Arıza / Bakım Başlığı"
            placeholder="Örn: Banyo su sızıntısı, Klima gaz dolumu, Asansör bakımı..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          {/* Konum Tipi Seçimi */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsRoomTicket(true)}
              className={`rounded-xl border p-3 text-xs font-medium transition text-left ${
                isRoomTicket
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Building className="h-4 w-4 mb-1" />
              Oda Arızası
            </button>
            <button
              type="button"
              onClick={() => setIsRoomTicket(false)}
              className={`rounded-xl border p-3 text-xs font-medium transition text-left ${
                !isRoomTicket
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Wrench className="h-4 w-4 mb-1" />
              Genel Alan / Tesisat
            </button>
          </div>

          {isRoomTicket ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
              <Select
                label="Arızalı Oda Seçimi"
                options={rooms.map((r) => ({
                  value: r.id,
                  label: `Oda ${r.no} (${r.floor}. Kat - Durum: ${r.status})`,
                }))}
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                placeholder="Oda seçiniz..."
              />

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={setRoomOutOfOrder}
                  onChange={(e) => setSetRoomOutOfOrder(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Bu odayı hemen <strong className="text-rose-600">"Bakımda"</strong> durumuna getir (Yeni rezervasyonlara kapat)
                </span>
              </label>
            </div>
          ) : (
            <Input
              label="Bölüm / Tesisat Lokasyonu"
              placeholder="Örn: Havuz, Kazan Dairesi, Restoran, Lobi Kapısı..."
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Öncelik Derecesi"
              options={[
                { value: 'dusuk', label: 'Düşük Öncelik' },
                { value: 'orta', label: 'Orta Öncelik' },
                { value: 'yuksek', label: 'Yüksek Öncelik' },
                { value: 'acil', label: 'Acil Müdahale (Kritik)' },
              ]}
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
            />

            <Select
              label="Teknik Personel"
              options={techStaff.map((staff) => ({
                value: staff.id,
                label: `${staff.fullName} (${staff.position})`,
              }))}
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              placeholder="Teknisyen ata..."
            />
          </div>

          <Input
            label="Tahmini / Başlangıç Maliyeti (₺)"
            type="number"
            min={0}
            value={initialCost}
            onChange={(e) => setInitialCost(e.target.value)}
          />

          <Textarea
            label="Arıza Detayları ve Açıklama"
            placeholder="Sorunun ayrıntılarını, gerekli yedek parçaları belirtin..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>

      {/* KAYIT KAPATMA VE MALİYET / GİDER İŞLEME MODALI */}
      <Modal
        open={Boolean(closingTicket)}
        onClose={() => setClosingTicket(null)}
        title="Arıza Kaydını Çöz ve Kapat"
        description={`"${closingTicket?.title}" kaydını sonlandırmak üzeresiniz.`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setClosingTicket(null)}>
              Vazgeç
            </Button>
            <Button variant="primary" onClick={handleConfirmCloseTicket}>
              Kaydı Kapat ve Onayla
            </Button>
          </div>
        }
      >
        {closingTicket && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <p>
                <strong>Konum:</strong> {closingTicket.area}
              </p>
              <p className="mt-1">
                <strong>Açılış Tarihi:</strong> {formatDate(closingTicket.openedAt)}
              </p>
            </div>

            <Input
              label="Gerçekleşen Toplam Bakım/Onarım Maliyeti (₺)"
              type="number"
              min={0}
              value={finalCost}
              onChange={(e) => setFinalCost(e.target.value)}
            />

            {/* Muhasebeye Gider Ekleme Checkbox'ı */}
            <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 cursor-pointer dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <input
                type="checkbox"
                checked={createExpenseTransaction}
                onChange={(e) => setCreateExpenseTransaction(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-emerald-900 dark:text-emerald-300 block">
                  Bu maliyeti muhasebeye gider olarak işle
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Muhasebe kayıtlarına "Bakım & Onarım" kategorisinde KDV dahil gider hareketi eklenir.
                </span>
              </div>
            </label>

            {/* Oda Hizmete Açma Seçeneği */}
            {closingTicket.roomId && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  İlişkili Odanın Yeni Durumu (Oda {roomMap.get(closingTicket.roomId)?.no}):
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reopenOpt"
                      checked={reopenRoomOption === 'kirli'}
                      onChange={() => setReopenRoomOption('kirli')}
                    />
                    <span>Kirli (Temizlik)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reopenOpt"
                      checked={reopenRoomOption === 'bos'}
                      onChange={() => setReopenRoomOption('bos')}
                    />
                    <span>Boş (Hazır)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reopenOpt"
                      checked={reopenRoomOption === 'none'}
                      onChange={() => setReopenRoomOption('none')}
                    />
                    <span>Değiştirme</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
