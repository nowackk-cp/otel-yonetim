import { useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  CheckCheck,
  ChevronRight,
  UserCheck,
  RotateCcw,
  Bed,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { todayStr, formatDate } from '../../lib/format';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  Modal,
  Select,
  Textarea,
  Input,
  Avatar,
  useToast,
} from '../../components/ui';
import type { HousekeepingTask, HousekeepingTaskType, Room, RoomStatus } from '../../types';

// Temizlik aşaması tipi
type CleaningStage = 'kirli' | 'temizleniyor' | 'temiz' | 'kontrol_edildi';

const TASK_TYPE_LABELS: Record<HousekeepingTaskType, string> = {
  gunluk: 'Günlük Temizlik',
  cikis: 'Çıkış Temizliği',
  derin: 'Derin Temizlik',
  havlu_carsaf: 'Havlu & Çarşaf Değişimi',
};

const STAGE_CONFIG: Record<
  CleaningStage,
  { label: string; badge: 'amber' | 'sky' | 'emerald' | 'teal'; bg: string; border: string }
> = {
  kirli: {
    label: 'Kirli Odalar',
    badge: 'amber',
    bg: 'bg-amber-50/50 dark:bg-amber-950/10',
    border: 'border-amber-200/70 dark:border-amber-900/40',
  },
  temizleniyor: {
    label: 'Temizleniyor',
    badge: 'sky',
    bg: 'bg-sky-50/50 dark:bg-sky-950/10',
    border: 'border-sky-200/70 dark:border-sky-900/40',
  },
  temiz: {
    label: 'Temizlendi (Kontrol Bekliyor)',
    badge: 'emerald',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
    border: 'border-emerald-200/70 dark:border-emerald-900/40',
  },
  kontrol_edildi: {
    label: 'Kontrol Edildi (Hazır)',
    badge: 'teal',
    bg: 'bg-teal-50/50 dark:bg-teal-950/10',
    border: 'border-teal-200/70 dark:border-teal-900/40',
  },
};

export default function HousekeepingPage() {
  const toast = useToast();
  const today = todayStr();

  // Store
  const rooms = useStore((s) => s.rooms);
  const roomTypes = useStore((s) => s.roomTypes);
  const employees = useStore((s) => s.employees);
  const tasks = useStore((s) => s.housekeepingTasks);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const log = useStore((s) => s.log);

  // Yerel state: Kontrol edilmiş odalar için id kümesi
  // (Store'da room status 'bos' olduğunda, şefin inceleyip onayladığı odaları bu state'te 'kontrol_edildi' sütununda tutarız)
  const [inspectedRoomIds, setInspectedRoomIds] = useState<Set<string>>(() => new Set());
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Yeni görev modalı
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState<HousekeepingTaskType>('cikis');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [taskNote, setTaskNote] = useState('');

  // Kat hizmetleri personeli
  const hkStaff = useMemo(
    () => employees.filter((e) => e.department === 'kat_hizmetleri' && e.active),
    [employees],
  );

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const roomTypeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes]);

  // Odaların bugünkü en son temizlik görevini haritala
  const todayTasksByRoom = useMemo(() => {
    const map = new Map<string, HousekeepingTask>();
    // bugüne ait veya açık olan görevleri tara
    tasks
      .filter((t) => t.date === today)
      .forEach((t) => {
        map.set(t.roomId, t);
      });
    return map;
  }, [tasks, today]);

  // Bir odanın kanban aşamasını tespit et
  const getRoomStage = (room: Room): CleaningStage => {
    if (room.status === 'kirli') return 'kirli';
    if (room.status === 'temizleniyor') return 'temizleniyor';
    if (inspectedRoomIds.has(room.id)) return 'kontrol_edildi';
    // 'bos' veya 'dolu' olanlar temiz sütununda yer alır
    return 'temiz';
  };

  // Filtrelenmiş odalar
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Kat filtresi
      if (selectedFloor !== 'all' && r.floor !== Number(selectedFloor)) return false;

      // Arama filtresi
      if (searchQuery.trim() && !r.no.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }

      // Personel filtresi
      if (selectedStaffFilter !== 'all') {
        const task = todayTasksByRoom.get(r.id);
        if (task?.assignedTo !== selectedStaffFilter) return false;
      }

      return true;
    });
  }, [rooms, selectedFloor, searchQuery, selectedStaffFilter, todayTasksByRoom]);

  // Sütunlara göre odaları grupla
  const kanbanColumns = useMemo(() => {
    const cols: Record<CleaningStage, Room[]> = {
      kirli: [],
      temizleniyor: [],
      temiz: [],
      kontrol_edildi: [],
    };

    filteredRooms.forEach((r) => {
      const stage = getRoomStage(r);
      cols[stage].push(r);
    });

    return cols;
  }, [filteredRooms, inspectedRoomIds]);

  // Personel bazında iş yükü istatistiği
  const staffWorkload = useMemo(() => {
    return hkStaff.map((staff) => {
      const staffTasks = tasks.filter((t) => t.date === today && t.assignedTo === staff.id);
      const total = staffTasks.length;
      const completed = staffTasks.filter((t) => t.status === 'tamamlandi').length;
      const inProgress = staffTasks.filter((t) => t.status === 'devam').length;
      const pending = staffTasks.filter((t) => t.status === 'bekliyor').length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        staff,
        total,
        completed,
        inProgress,
        pending,
        percent,
      };
    });
  }, [hkStaff, tasks, today]);

  // AKSİYONLAR

  // 1. Durum Değiştirme (Kanban aşamaları)
  const handleMoveToCleaning = (room: Room) => {
    update('rooms', room.id, { status: 'temizleniyor' });
    const existingTask = todayTasksByRoom.get(room.id);
    if (existingTask) {
      update('housekeepingTasks', existingTask.id, { status: 'devam' });
    }
    setInspectedRoomIds((prev) => {
      const next = new Set(prev);
      next.delete(room.id);
      return next;
    });
    toast.info(`Oda ${room.no} temizliğe alındı.`);
    log(`Oda ${room.no} temizlik işlemine başlandı`, 'operasyon');
  };

  const handleMarkCleaned = (room: Room) => {
    // Tamamlanınca oda 'bos' yapılır
    update('rooms', room.id, { status: 'bos' });
    const existingTask = todayTasksByRoom.get(room.id);
    if (existingTask) {
      update('housekeepingTasks', existingTask.id, { status: 'tamamlandi' });
    }
    setInspectedRoomIds((prev) => {
      const next = new Set(prev);
      next.delete(room.id);
      return next;
    });
    toast.success(`Oda ${room.no} temizlendi, boş/temiz statüsüne alındı.`);
    log(`Oda ${room.no} temizliği tamamlandı`, 'operasyon');
  };

  const handleInspectRoom = (room: Room) => {
    setInspectedRoomIds((prev) => new Set(prev).add(room.id));
    toast.success(`Oda ${room.no} şef kontrolünden geçti ve hazırlandı.`);
    log(`Oda ${room.no} kat şefi tarafından kontrol edildi ve onaylandı`, 'operasyon');
  };

  const handleRevertToDirty = (room: Room) => {
    update('rooms', room.id, { status: 'kirli' });
    setInspectedRoomIds((prev) => {
      const next = new Set(prev);
      next.delete(room.id);
      return next;
    });
    const existingTask = todayTasksByRoom.get(room.id);
    if (existingTask) {
      update('housekeepingTasks', existingTask.id, { status: 'bekliyor' });
    }
    toast.warning(`Oda ${room.no} tekrar kirli olarak işaretlendi.`);
    log(`Oda ${room.no} tekrar kirli olarak işaretlendi`, 'operasyon');
  };

  // 2. Kirli Odalar İçin Otomatik Görev Oluştur
  const handleAutoAssignDirtyRooms = () => {
    const dirtyRooms = rooms.filter((r) => r.status === 'kirli');
    if (dirtyRooms.length === 0) {
      toast.info('Şu an temizlik bekleyen kirli oda bulunmuyor.');
      return;
    }
    if (hkStaff.length === 0) {
      toast.error('Atama yapılacak aktif kat hizmetleri personeli bulunamadı.');
      return;
    }

    let assignedCount = 0;
    dirtyRooms.forEach((room, idx) => {
      const existingTask = todayTasksByRoom.get(room.id);
      // Eğer atanmış aktif bir personeli yoksa personele dağıt
      if (!existingTask || !existingTask.assignedTo) {
        const staff = hkStaff[idx % hkStaff.length];
        if (existingTask) {
          update('housekeepingTasks', existingTask.id, {
            assignedTo: staff.id,
            status: 'bekliyor',
          });
        } else {
          add('housekeepingTasks', {
            roomId: room.id,
            date: today,
            assignedTo: staff.id,
            type: 'cikis',
            status: 'bekliyor',
            note: 'Otomatik atanan temizlik görevi',
          });
        }
        assignedCount++;
      }
    });

    if (assignedCount > 0) {
      toast.success(`${assignedCount} kirli oda için kat personeline otomatik görev dağıtıldı.`);
      log(`${assignedCount} kirli oda kat personeline otomatik olarak dağıtıldı`, 'operasyon');
    } else {
      toast.info('Tüm kirli odalara zaten personel atanmış.');
    }
  };

  // 3. Manuel Görev Atama
  const handleCreateCustomTask = () => {
    if (!selectedRoomId) {
      toast.error('Lütfen bir oda seçin.');
      return;
    }
    const targetRoom = rooms.find((r) => r.id === selectedRoomId);
    if (!targetRoom) return;

    add('housekeepingTasks', {
      roomId: targetRoom.id,
      date: today,
      assignedTo: selectedEmployeeId || undefined,
      type: selectedTaskType,
      status: 'bekliyor',
      note: taskNote.trim(),
    });

    // Odanın durumu kirli değilse ve temizliğe ihtiyaç varsa kirli veya temizleniyor yapılabilir
    if (targetRoom.status === 'bos') {
      update('rooms', targetRoom.id, { status: 'kirli' });
    }

    toast.success(`Oda ${targetRoom.no} için temizlik görevi oluşturuldu.`);
    log(`Oda ${targetRoom.no} için ${TASK_TYPE_LABELS[selectedTaskType]} görevi açıldı`, 'operasyon');

    setIsAssignModalOpen(false);
    setSelectedRoomId('');
    setSelectedEmployeeId('');
    setTaskNote('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Başlık ve Aksiyonlar */}
      <PageHeader
        title="Kat Hizmetleri Panosu"
        description="Oda temizlik süreçleri, görev kanbanı ve personel iş yükü takibi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsAssignModalOpen(true)}
            >
              Görev Ata
            </Button>
            <Button
              variant="primary"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleAutoAssignDirtyRooms}
            >
              Kirli Odalar İçin Otomatik Görev Oluştur
            </Button>
          </div>
        }
      />

      {/* İstatistik & Filtreleme Çubuğu */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(STAGE_CONFIG) as CleaningStage[]).map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const count = kanbanColumns[stage].length;
          return (
            <div
              key={stage}
              className={`rounded-2xl border p-4 shadow-soft ${cfg.bg} ${cfg.border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {cfg.label}
                </span>
                <Badge color={cfg.badge}>{count} Oda</Badge>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filtre ve Arama Barı */}
      <Card padded={false} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Kat Filtresi */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter className="h-4 w-4" />
              <span>Kat:</span>
            </div>
            <div className="flex items-center gap-1">
              {['all', '1', '2', '3', '4'].map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedFloor === floor
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {floor === 'all' ? 'Tüm Katlar' : `${floor}. Kat`}
                </button>
              ))}
            </div>

            {/* Personel Filtresi */}
            <div className="min-w-[160px]">
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">Tüm Personeller</option>
                {hkStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Oda Arama */}
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="Oda no ara (örn. 101)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </Card>

      {/* KANBAN SÜTUNLARI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(STAGE_CONFIG) as CleaningStage[]).map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const roomsInCol = kanbanColumns[stage];

          return (
            <div
              key={stage}
              className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-100/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
            >
              {/* Kolon Başlığı */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {cfg.label}
                  </span>
                </div>
                <Badge color={cfg.badge}>{roomsInCol.length}</Badge>
              </div>

              {/* Oda Kartları Listesi */}
              <div className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto max-h-[750px] pr-0.5">
                {roomsInCol.length === 0 ? (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-800">
                    Bu aşamada oda yok
                  </div>
                ) : (
                  roomsInCol.map((room) => {
                    const roomType = roomTypeMap.get(room.typeId);
                    const task = todayTasksByRoom.get(room.id);
                    const assignedStaff = task?.assignedTo ? empMap.get(task.assignedTo) : null;

                    return (
                      <div
                        key={room.id}
                        className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-850"
                      >
                        {/* Üst Kısım: Oda No & Kat Bilgisi */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-900 dark:text-white">
                                Oda {room.no}
                              </span>
                              <Badge color="slate" className="text-[10px] px-1.5 py-0">
                                {room.floor}. Kat
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {roomType?.name || 'Standart'}
                            </p>
                          </div>
                          {task && (
                            <Badge color="indigo" className="text-[10px]">
                              {TASK_TYPE_LABELS[task.type]}
                            </Badge>
                          )}
                        </div>

                        {/* Personel Ataması */}
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={assignedStaff?.fullName || 'Atanmadı'}
                              size="sm"
                              className="h-6 w-6 text-[10px]"
                            />
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[110px]">
                              {assignedStaff?.fullName || 'Atanmadı'}
                            </span>
                          </div>

                          {/* Hızlı Personel Seçici / Değiştirici */}
                          <select
                            value={task?.assignedTo || ''}
                            onChange={(e) => {
                              const newStaffId = e.target.value;
                              if (task) {
                                update('housekeepingTasks', task.id, {
                                  assignedTo: newStaffId || undefined,
                                });
                              } else {
                                add('housekeepingTasks', {
                                  roomId: room.id,
                                  date: today,
                                  assignedTo: newStaffId || undefined,
                                  type: 'cikis',
                                  status: 'bekliyor',
                                });
                              }
                              toast.success(`Oda ${room.no} görevlisi güncellendi.`);
                            }}
                            className="bg-transparent text-[11px] text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer"
                          >
                            <option value="">Ata...</option>
                            {hkStaff.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.fullName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Varsa Not */}
                        {task?.note && (
                          <p className="mt-2 text-[11px] italic text-slate-500 line-clamp-2">
                            "{task.note}"
                          </p>
                        )}

                        {/* Aksiyon Butonları (Durum Değiştirme) */}
                        <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                          {stage === 'kirli' && (
                            <Button
                              size="sm"
                              variant="primary"
                              className="w-full text-xs h-7 gap-1"
                              icon={<Clock className="h-3 w-3" />}
                              onClick={() => handleMoveToCleaning(room)}
                            >
                              Temizliğe Başla
                            </Button>
                          )}

                          {stage === 'temizleniyor' && (
                            <Button
                              size="sm"
                              variant="primary"
                              className="w-full text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              icon={<Check className="h-3 w-3" />}
                              onClick={() => handleMarkCleaned(room)}
                            >
                              Temizlendi Olarak Bitir
                            </Button>
                          )}

                          {stage === 'temiz' && (
                            <div className="flex w-full items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2"
                                title="Tekrar Kirliye Al"
                                onClick={() => handleRevertToDirty(room)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                className="flex-1 text-xs h-7 bg-teal-600 hover:bg-teal-700 text-white gap-1"
                                icon={<CheckCheck className="h-3 w-3" />}
                                onClick={() => handleInspectRoom(room)}
                              >
                                Kontrol Onayı Ver
                              </Button>
                            </div>
                          )}

                          {stage === 'kontrol_edildi' && (
                            <div className="flex w-full items-center justify-between text-xs text-teal-600 dark:text-teal-400 font-medium">
                              <span className="flex items-center gap-1">
                                <CheckCheck className="h-4 w-4" /> Satışa Hazır
                              </span>
                              <button
                                onClick={() => handleRevertToDirty(room)}
                                className="text-[11px] text-slate-400 hover:text-rose-500 underline"
                              >
                                Sıfırla
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

      {/* PERSONEL BAZINDA İŞ YÜKÜ BÖLÜMÜ */}
      <Card
        title="Kat Hizmetleri Personel İş Yükü ve Performansı"
        subtitle="Bugün görevli çalışanların üstlendikleri ve tamamladıkları oda sayıları"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {staffWorkload.map(({ staff, total, completed, inProgress, pending, percent }) => (
            <div
              key={staff.id}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <Avatar name={staff.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-semibold text-slate-900 dark:text-white text-sm">
                    {staff.fullName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{staff.position}</p>
                </div>
              </div>

              {/* İlerleme Çubuğu */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-600 dark:text-slate-300">Tamamlanma Oranı</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{percent}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Sayaçlar */}
              <div className="mt-3.5 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
                <div>
                  <span className="block text-[11px] text-slate-400">Toplam</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{total}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-amber-500">Devam/Bekler</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">
                    {inProgress + pending}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-emerald-500">Tamam</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">
                    {completed}
                  </span>
                </div>
              </div>

              {/* Günlük mola bilgisi */}
              <div className="mt-2.5 text-[11px] text-slate-400 text-center">
                Mola Hakkı: {staff.breakMinutes} dk
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* YENİ GÖREV ATAMA MODALI */}
      <Modal
        open={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Yeni Temizlik Görevi Ata"
        description="Odayı seçip ilgili kat görevlisine özel temizlik talimatı verin"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleCreateCustomTask}>
              Görevi Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Oda Seçimi"
            options={rooms.map((r) => ({
              value: r.id,
              label: `Oda ${r.no} (${r.floor}. Kat - ${r.status.toUpperCase()})`,
            }))}
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            placeholder="Oda seçiniz..."
          />

          <Select
            label="Temizlik Görevi Tipi"
            options={[
              { value: 'cikis', label: 'Çıkış Temizliği (Detaylı)' },
              { value: 'gunluk', label: 'Günlük Rutin Temizlik' },
              { value: 'derin', label: 'Derin Temizlik (Detaylı Dezenfeksiyon)' },
              { value: 'havlu_carsaf', label: 'Havlu & Çarşaf Değişimi' },
            ]}
            value={selectedTaskType}
            onChange={(e) => setSelectedTaskType(e.target.value as HousekeepingTaskType)}
          />

          <Select
            label="Atanacak Kat Personeli"
            options={hkStaff.map((staff) => ({
              value: staff.id,
              label: `${staff.fullName} (${staff.position})`,
            }))}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            placeholder="Personel seçiniz (İsteğe bağlı)..."
          />

          <Textarea
            label="Özel Not / Talimat"
            placeholder="Örn: Misafir terlik ve banyo setinin yenilenmesini istedi..."
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}
