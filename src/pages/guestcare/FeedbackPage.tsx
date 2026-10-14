import { useMemo, useState, type FormEvent } from 'react';
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, MessageSquare, Plus, Save, Star, TriangleAlert } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DatePicker,
  Drawer,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  useToast,
  type Column,
} from '../../components/ui';
import { useStore } from '../../store/useStore';
import { formatDate, formatDateTime, todayStr } from '../../lib/format';
import type { Employee, FeedbackStatus, GuestFeedback, Priority } from '../../types';
import {
  CATEGORY_GROUPS,
  FEEDBACK_STATUS_COLOR,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_COLOR,
  FEEDBACK_TYPE_LABEL,
  PRIORITY_LABEL,
  averageRating,
  categoryGroup,
  employeeOptions,
  typeForRating,
  type CategoryGroup,
} from './helpers';

const CHART_COLORS = { indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9' };
const AXIS_TICK = { fill: '#94a3b8', fontSize: 12 };
const GRID_STROKE = 'rgba(148,163,184,0.25)';

const fmtAvg = (n: number | null) => (n === null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5 puan`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={n <= value ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400' : 'h-3.5 w-3.5 text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tüm türler' },
  { value: 'memnuniyet', label: 'Memnuniyet' },
  { value: 'oneri', label: 'Öneri' },
  { value: 'sikayet', label: 'Şikâyet' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm durumlar' },
  ...(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((s) => ({ value: s, label: FEEDBACK_STATUS_LABEL[s] })),
];
const GROUP_OPTIONS = [
  { value: 'all', label: 'Tüm kategoriler' },
  ...[...CATEGORY_GROUPS, 'Diğer' as const].map((g) => ({ value: g, label: g })),
];
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }));
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} · ${['', 'Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'][r]}` }));

export default function FeedbackPage() {
  const feedbacks = useStore((s) => s.guestFeedbacks);
  const guests = useStore((s) => s.guests);
  const reservations = useStore((s) => s.reservations);
  const rooms = useStore((s) => s.rooms);
  const employees = useStore((s) => s.employees);
  const add = useStore((s) => s.add);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const reservationMap = useMemo(() => new Map(reservations.map((r) => [r.id, r])), [reservations]);

  const stats = useMemo(() => {
    const open = feedbacks.filter((f) => f.type === 'sikayet' && (f.status === 'yeni' || f.status === 'inceleniyor')).length;
    const resolved = feedbacks.filter((f) => f.status === 'cozuldu' || f.status === 'kapatildi').length;
    return {
      avg: averageRating(feedbacks),
      total: feedbacks.length,
      open,
      resolutionRate: feedbacks.length ? Math.round((resolved / feedbacks.length) * 100) : 0,
    };
  }, [feedbacks]);

  const distribution = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((rating) => ({
        name: `${rating} ★`,
        count: feedbacks.filter((f) => f.rating === rating).length,
        color: rating <= 2 ? CHART_COLORS.rose : rating === 3 ? CHART_COLORS.amber : CHART_COLORS.emerald,
      })),
    [feedbacks],
  );

  const categoryAverages = useMemo(() => {
    const groups: (CategoryGroup)[] = [...CATEGORY_GROUPS, 'Diğer'];
    return groups.map((group) => {
      const items = feedbacks.filter((f) => categoryGroup(f.category) === group);
      return { name: group, avg: averageRating(items) ?? 0, count: items.length, hasData: items.length > 0 };
    });
  }, [feedbacks]);

  const filtered = useMemo(
    () =>
      feedbacks.filter(
        (f) =>
          (typeFilter === 'all' || f.type === typeFilter) &&
          (statusFilter === 'all' || f.status === statusFilter) &&
          (groupFilter === 'all' || categoryGroup(f.category) === groupFilter),
      ),
    [feedbacks, typeFilter, statusFilter, groupFilter],
  );

  const selected = useMemo(() => feedbacks.find((f) => f.id === selectedId) ?? null, [feedbacks, selectedId]);

  const roomNoOf = (f: GuestFeedback) => {
    const res = f.reservationId ? reservationMap.get(f.reservationId) : undefined;
    return res ? roomMap.get(res.roomId)?.no : undefined;
  };

  const columns: Column<GuestFeedback>[] = [
    {
      key: 'date',
      header: 'Tarih',
      sortValue: (f) => f.date,
      render: (f) => <span className="whitespace-nowrap text-slate-500">{formatDate(f.date)}</span>,
    },
    {
      key: 'guest',
      header: 'Misafir',
      sortValue: (f) => guestMap.get(f.guestId)?.fullName ?? '',
      searchValue: (f) => `${guestMap.get(f.guestId)?.fullName ?? ''} ${f.comment} ${f.category}`,
      render: (f) => {
        const g = guestMap.get(f.guestId);
        return g ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={g.fullName} size="sm" />
            <span className="font-medium text-slate-900 dark:text-white">{g.fullName}</span>
          </div>
        ) : (
          <span className="text-slate-400">Bilinmeyen misafir</span>
        );
      },
    },
    {
      key: 'rating',
      header: 'Puan',
      align: 'center',
      sortValue: (f) => f.rating,
      render: (f) => <Stars value={f.rating} />,
    },
    {
      key: 'type',
      header: 'Tür',
      render: (f) => <Badge color={FEEDBACK_TYPE_COLOR[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>,
    },
    {
      key: 'category',
      header: 'Kategori',
      sortValue: (f) => f.category,
      render: (f) => <span className="text-slate-600 dark:text-slate-300">{f.category}</span>,
    },
    {
      key: 'comment',
      header: 'Yorum',
      render: (f) => <p className="max-w-xs truncate text-slate-600 dark:text-slate-300" title={f.comment}>{f.comment}</p>,
    },
    {
      key: 'status',
      header: 'Durum',
      sortValue: (f) => f.status,
      render: (f) => (
        <Badge color={FEEDBACK_STATUS_COLOR[f.status]} dot>
          {FEEDBACK_STATUS_LABEL[f.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Misafir Memnuniyeti"
        description="Puan özetleri, geri bildirim ve şikâyet takibi"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Geri Bildirim Ekle
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ortalama Puan" value={`${fmtAvg(stats.avg)} / 5`} icon={<Star />} tone="amber" />
        <StatCard title="Toplam Geri Bildirim" value={stats.total} icon={<MessageSquare />} tone="indigo" />
        <StatCard title="Açık Şikâyet" value={stats.open} icon={<TriangleAlert />} tone="rose" changeLabel="yeni veya inceleniyor" />
        <StatCard title="Çözüm Oranı" value={`%${stats.resolutionRate}`} icon={<CheckCircle2 />} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Puan Dağılımı" subtitle="Kaç misafir hangi puanı verdi">
          {feedbacks.length === 0 ? (
            <EmptyState title="Veri yok" description="Henüz geri bildirim kaydı bulunmuyor." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v} misafir`, 'Adet']} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {distribution.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Kategori Ortalamaları" subtitle="Ortalama puan (0-5); veri olmayan kategoriler 0 görünür">
          {feedbacks.length === 0 ? (
            <EmptyState title="Veri yok" description="Kategori ortalaması için geri bildirim gerekli." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryAverages} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" domain={[0, 5]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, _n, item) => [
                    `${fmtAvg(item.payload.hasData ? Number(v) : null)} · ${item.payload.count} yorum`,
                    'Ortalama',
                  ]}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <Bar dataKey="avg" fill={CHART_COLORS.indigo} radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <DataTable
          data={filtered}
          rowKey={(f) => f.id}
          columns={columns}
          onRowClick={(f) => setSelectedId(f.id)}
          searchPlaceholder="Misafir, yorum veya kategori ara..."
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle="Kayıt bulunamadı"
          emptyDescription="Seçili filtrelerle eşleşen geri bildirim yok."
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} wrapperClassName="w-40" aria-label="Tür filtresi" />
              <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} wrapperClassName="w-40" aria-label="Durum filtresi" />
              <Select options={GROUP_OPTIONS} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} wrapperClassName="w-44" aria-label="Kategori filtresi" />
            </div>
          }
        />
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? guestMap.get(selected.guestId)?.fullName ?? 'Geri bildirim' : undefined}
        description={selected ? `${formatDate(selected.date)} · ${selected.category}` : undefined}
        width="lg"
      >
        {selected && (
          <FeedbackDetail
            key={selected.id}
            feedback={selected}
            guestName={guestMap.get(selected.guestId)?.fullName ?? 'Bilinmeyen misafir'}
            roomNo={roomNoOf(selected)}
            employees={employees}
          />
        )}
      </Drawer>

      <CreateFeedbackModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        guests={guests}
        reservations={reservations}
        onCreate={(payload) => {
          add('guestFeedbacks', payload);
          log(`Yeni geri bildirim eklendi (${payload.rating}/5, ${payload.category})`, 'on_buro');
          toast.success('Geri bildirim kaydedildi');
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

interface FeedbackDetailProps {
  feedback: GuestFeedback;
  guestName: string;
  roomNo?: string;
  employees: Employee[];
}

/** Detay paneli. `key` ile her geri bildirim için ayrı mount edilir; taslak yerel tutulur. */
function FeedbackDetail({ feedback, guestName, roomNo, employees }: FeedbackDetailProps) {
  const update = useStore((s) => s.update);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [status, setStatus] = useState<FeedbackStatus>(feedback.status);
  const [priority, setPriority] = useState<Priority | ''>(feedback.priority ?? '');
  const [assignedTo, setAssignedTo] = useState(feedback.assignedTo ?? '');
  const [response, setResponse] = useState(feedback.response ?? '');

  const save = (e: FormEvent) => {
    e.preventDefault();
    const responseChanged = response.trim() !== (feedback.response ?? '').trim();
    const now = new Date().toISOString();
    update('guestFeedbacks', feedback.id, {
      status,
      priority: priority || undefined,
      assignedTo: assignedTo || undefined,
      response: response.trim() || undefined,
      respondedAt: responseChanged && response.trim() ? now : feedback.respondedAt,
      resolvedAt: status === 'cozuldu' ? feedback.resolvedAt ?? now : undefined,
    });
    if (status !== feedback.status) log(`Geri bildirim durumu: ${FEEDBACK_STATUS_LABEL[status]} (${guestName})`, 'on_buro');
    toast.success('Geri bildirim güncellendi');
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Stars value={feedback.rating} />
        <Badge color={FEEDBACK_TYPE_COLOR[feedback.type]}>{FEEDBACK_TYPE_LABEL[feedback.type]}</Badge>
        <Badge color={FEEDBACK_STATUS_COLOR[feedback.status]} dot>
          {FEEDBACK_STATUS_LABEL[feedback.status]}
        </Badge>
        {roomNo && <span className="text-xs text-slate-500">Oda {roomNo}</span>}
      </div>

      <blockquote className="rounded-xl border-l-4 border-indigo-400 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        {feedback.comment}
      </blockquote>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Durum"
          value={status}
          onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
          options={(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((s) => ({ value: s, label: FEEDBACK_STATUS_LABEL[s] }))}
        />
        <Select
          label="Öncelik"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | '')}
          options={PRIORITY_OPTIONS}
          placeholder="Belirtilmedi"
        />
        <Select
          label="Sorumlu"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={employeeOptions(employees)}
          placeholder="Atanmadı"
          wrapperClassName="sm:col-span-2"
        />
      </div>

      <div>
        <Textarea
          label="Misafire yanıt"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={5}
          placeholder="Misafire iletilecek yanıtı yazın..."
        />
        {feedback.respondedAt && (
          <p className="mt-2 text-xs text-slate-400">Son yanıt: {formatDateTime(feedback.respondedAt)}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-xs text-slate-400">
          {feedback.resolvedAt ? `Çözüldü: ${formatDateTime(feedback.resolvedAt)}` : 'Henüz çözülmedi'}
        </p>
        <Button type="submit" icon={<Save className="h-4 w-4" />}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}

interface CreateFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  guests: { id: string; fullName: string }[];
  reservations: { id: string; guestId: string; roomId: string; checkIn: string; checkOut: string }[];
  onCreate: (payload: Omit<GuestFeedback, 'id'>) => void;
}

function CreateFeedbackModal({ open, onClose, guests, reservations, onCreate }: CreateFeedbackModalProps) {
  const blank = () => ({
    guestId: '',
    reservationId: '',
    date: todayStr(),
    rating: 5 as GuestFeedback['rating'],
    type: 'memnuniyet' as GuestFeedback['type'],
    category: CATEGORY_GROUPS[0] as string,
    comment: '',
  });
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<{ guestId?: string; comment?: string }>({});

  const sortedGuests = useMemo(() => [...guests].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr')), [guests]);
  const guestReservations = reservations.filter((r) => r.guestId === form.guestId);

  const handleClose = () => {
    setForm(blank());
    setErrors({});
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { guestId?: string; comment?: string } = {};
    if (!form.guestId) nextErrors.guestId = 'Misafir seçin';
    if (form.comment.trim().length < 3) nextErrors.comment = 'Yorum en az 3 karakter olmalı';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onCreate({
      guestId: form.guestId,
      reservationId: form.reservationId || undefined,
      date: form.date,
      rating: form.rating,
      type: form.type,
      category: form.category,
      comment: form.comment.trim(),
      status: 'yeni',
    });
    setForm(blank());
    setErrors({});
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Yeni Geri Bildirim"
      description="Misafirden telefon, e-posta veya yüz yüze alınan geri bildirim"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Vazgeç
          </Button>
          <Button type="submit" form="feedback-create-form" icon={<Plus className="h-4 w-4" />}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="feedback-create-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Misafir *"
          value={form.guestId}
          onChange={(e) => setForm((f) => ({ ...f, guestId: e.target.value, reservationId: '' }))}
          options={sortedGuests.map((g) => ({ value: g.id, label: g.fullName }))}
          placeholder="Misafir seçin"
          error={errors.guestId}
        />
        <Select
          label="Konaklama (opsiyonel)"
          value={form.reservationId}
          onChange={(e) => setForm((f) => ({ ...f, reservationId: e.target.value }))}
          options={guestReservations.map((r) => ({ value: r.id, label: `${r.checkIn} → ${r.checkOut}` }))}
          placeholder={guestReservations.length ? 'Bağlanmasın' : 'Bu misafirin rezervasyonu yok'}
          disabled={!guestReservations.length}
        />
        <DatePicker label="Tarih" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
        <Select
          label="Puan"
          value={String(form.rating)}
          onChange={(e) => {
            const rating = Number(e.target.value) as GuestFeedback['rating'];
            setForm((f) => ({ ...f, rating, type: typeForRating(rating) }));
          }}
          options={RATING_OPTIONS}
        />
        <Select
          label="Tür"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GuestFeedback['type'] }))}
          options={TYPE_OPTIONS.filter((o) => o.value !== 'all')}
        />
        <Select
          label="Kategori"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          options={[...CATEGORY_GROUPS, 'Diğer' as const].map((g) => ({ value: g, label: g }))}
        />
        <Textarea
          label="Yorum *"
          value={form.comment}
          onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          error={errors.comment}
          rows={4}
          wrapperClassName="sm:col-span-2"
        />
      </form>
    </Modal>
  );
}
