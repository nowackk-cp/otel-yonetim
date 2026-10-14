import { useMemo, useState, type FormEvent } from 'react';
import { Archive, CalendarCheck, PackageSearch, Pencil, PackageCheck, Plus, Trash2, TriangleAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  Textarea,
  useToast,
  type Column,
} from '../../components/ui';
import { useStore } from '../../store/useStore';
import { daysBetween, formatDate, todayStr } from '../../lib/format';
import type { LostItem } from '../../types';
import { LOST_STATUS_COLOR, LOST_STATUS_LABEL, LOST_WARNING_DAYS, employeeOptions } from './helpers';

type LostStatus = LostItem['status'];
type StatusTab = 'all' | LostStatus;

type ItemForm = {
  date: string;
  location: string;
  roomId: string;
  description: string;
  foundBy: string;
  status: LostStatus;
  storageLocation: string;
  receivedBy: string;
  deliveredAt: string;
  guestId: string;
  notes: string;
};

const blankForm = (): ItemForm => ({
  date: todayStr(),
  location: 'Lobi / resepsiyon',
  roomId: '',
  description: '',
  foundBy: '',
  status: 'depoda',
  storageLocation: '',
  receivedBy: '',
  deliveredAt: todayStr(),
  guestId: '',
  notes: '',
});

const STATUS_OPTIONS = (Object.keys(LOST_STATUS_LABEL) as LostStatus[]).map((s) => ({ value: s, label: LOST_STATUS_LABEL[s] }));

export default function LostFoundPage() {
  const items = useStore((s) => s.lostItems);
  const employees = useStore((s) => s.employees);
  const rooms = useStore((s) => s.rooms);
  const guests = useStore((s) => s.guests);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [tab, setTab] = useState<StatusTab>('all');
  const [editing, setEditing] = useState<LostItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<'description' | 'foundBy' | 'receivedBy', string>>>({});
  const [deliverTarget, setDeliverTarget] = useState<LostItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LostItem | null>(null);

  const today = todayStr();
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e.fullName])), [employees]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r.no])), [rooms]);
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g.fullName])), [guests]);

  const counts = useMemo(
    () => ({
      all: items.length,
      depoda: items.filter((i) => i.status === 'depoda').length,
      teslim_edildi: items.filter((i) => i.status === 'teslim_edildi').length,
      imha: items.filter((i) => i.status === 'imha').length,
    }),
    [items],
  );

  const overdue = (item: LostItem) => item.status === 'depoda' && daysBetween(item.date, today) > LOST_WARNING_DAYS;
  const overdueCount = items.filter(overdue).length;

  const deliveredThisMonth = items.filter(
    (i) => i.status === 'teslim_edildi' && i.deliveredAt && i.deliveredAt.slice(0, 7) === today.slice(0, 7),
  ).length;

  const visible = useMemo(() => (tab === 'all' ? items : items.filter((i) => i.status === tab)), [items, tab]);

  const tabs = [
    { key: 'all', label: 'Tümü', count: counts.all },
    { key: 'depoda', label: 'Depoda', count: counts.depoda },
    { key: 'teslim_edildi', label: 'Teslim Edildi', count: counts.teslim_edildi },
    { key: 'imha', label: 'İmha', count: counts.imha },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (item: LostItem) => {
    setEditing(item);
    setForm({
      date: item.date,
      location: item.location,
      roomId: item.roomId ?? '',
      description: item.description,
      foundBy: item.foundBy,
      status: item.status,
      storageLocation: item.storageLocation ?? '',
      receivedBy: item.receivedBy ?? '',
      deliveredAt: item.deliveredAt ?? todayStr(),
      guestId: item.guestId ?? '',
      notes: item.notes ?? '',
    });
    setErrors({});
    setFormOpen(true);
  };

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.description.trim()) next.description = 'Eşya açıklaması zorunludur';
    if (!form.foundBy) next.foundBy = 'Bulan çalışanı seçin';
    if (form.status === 'teslim_edildi' && !form.receivedBy.trim()) next.receivedBy = 'Teslim alan kişiyi yazın';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    const delivered = form.status === 'teslim_edildi';
    const payload: Omit<LostItem, 'id'> = {
      date: form.date,
      location: form.location.trim() || 'Belirtilmedi',
      roomId: form.roomId || undefined,
      description: form.description.trim(),
      foundBy: form.foundBy,
      status: form.status,
      storageLocation: form.storageLocation.trim() || undefined,
      receivedBy: delivered ? form.receivedBy.trim() : undefined,
      deliveredAt: delivered ? form.deliveredAt : undefined,
      guestId: delivered ? form.guestId || undefined : undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editing) {
      update('lostItems', editing.id, payload);
      log(`Kayıp eşya güncellendi: ${payload.description}`, 'on_buro');
      toast.success('Kayıt güncellendi');
    } else {
      add('lostItems', payload);
      log(`Yeni kayıp eşya kaydı: ${payload.description}`, 'on_buro');
      toast.success('Eşya kaydedildi');
    }
    setFormOpen(false);
  };

  const columns: Column<LostItem>[] = [
    {
      key: 'date',
      header: 'Bulunma',
      sortValue: (i) => i.date,
      render: (i) => <span className="whitespace-nowrap text-slate-500">{formatDate(i.date)}</span>,
    },
    {
      key: 'description',
      header: 'Eşya',
      sortValue: (i) => i.description,
      render: (i) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">{i.description}</p>
          {i.notes && <p className="truncate text-xs text-slate-400">{i.notes}</p>}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Konum',
      searchValue: (i) => `${i.location} ${i.storageLocation ?? ''}`,
      render: (i) => (
        <div className="text-sm">
          <p className="text-slate-700 dark:text-slate-200">{i.roomId ? `Oda ${roomMap.get(i.roomId) ?? '-'}` : i.location}</p>
          {i.storageLocation && <p className="text-xs text-slate-400">{i.storageLocation}</p>}
        </div>
      ),
    },
    {
      key: 'foundBy',
      header: 'Bulan',
      searchValue: (i) => employeeMap.get(i.foundBy) ?? '',
      render: (i) => <span className="text-slate-600 dark:text-slate-300">{employeeMap.get(i.foundBy) ?? '-'}</span>,
    },
    {
      key: 'status',
      header: 'Durum',
      sortValue: (i) => i.status,
      render: (i) => {
        if (i.status === 'teslim_edildi') {
          return (
            <div className="text-sm">
              <Badge color={LOST_STATUS_COLOR[i.status]} dot>
                {LOST_STATUS_LABEL[i.status]}
              </Badge>
              <p className="mt-1 text-xs text-slate-400">
                {i.receivedBy} · {i.deliveredAt ? formatDate(i.deliveredAt) : '-'}
              </p>
            </div>
          );
        }
        return (
          <Badge color={LOST_STATUS_COLOR[i.status]} dot>
            {LOST_STATUS_LABEL[i.status]}
          </Badge>
        );
      },
    },
    {
      key: 'age',
      header: 'Bekleme',
      align: 'right',
      sortValue: (i) => (i.status === 'depoda' ? daysBetween(i.date, today) : -1),
      render: (i) => {
        if (i.status !== 'depoda') return <span className="text-slate-300 dark:text-slate-600">—</span>;
        const days = daysBetween(i.date, today);
        return overdue(i) ? (
          <Badge color="rose">
            <TriangleAlert className="h-3 w-3" />
            {LOST_WARNING_DAYS} günü geçti · {days} gün
          </Badge>
        ) : (
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">{days} gün</span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          {i.status === 'depoda' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<PackageCheck className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setDeliverTarget(i);
              }}
            >
              Teslim et
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(i);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
            aria-label="Düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(i);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            aria-label="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kayıp Eşya"
        description="Bulunan eşyalar, muhafaza ve teslim kayıtları"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Eşya Ekle
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Depoda" value={counts.depoda} icon={<Archive />} tone="sky" />
        <StatCard title="Bu Ay Teslim Edilen" value={deliveredThisMonth} icon={<PackageCheck />} tone="emerald" />
        <StatCard title={`${LOST_WARNING_DAYS}+ Gün Bekleyen`} value={overdueCount} icon={<TriangleAlert />} tone="rose" changeLabel="imha/teslim kararı gerekli" />
        <StatCard title="Toplam Kayıt" value={counts.all} icon={<PackageSearch />} tone="indigo" />
      </div>

      {overdueCount > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>{overdueCount} eşya</strong> {LOST_WARNING_DAYS} günden uzun süredir depoda. Teslim edin veya yasal süreye uygun şekilde imha tutanağı hazırlayın.
          </p>
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={visible}
          rowKey={(i) => i.id}
          columns={columns}
          onRowClick={(i) => openEdit(i)}
          searchPlaceholder="Eşya, konum veya bulan çalışan ara..."
          initialSort={{ key: 'date', dir: 'desc' }}
          toolbar={<Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as StatusTab)} />}
          emptyTitle="Kayıt bulunamadı"
          emptyDescription="Bu durumda kayıtlı eşya yok."
        />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Kayıt Düzenle' : 'Yeni Kayıp Eşya'}
        description="Eşyayı bulan çalışanı, konumu ve muhafaza yerini girin"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" form="lost-form">
              {editing ? 'Kaydet' : 'Ekle'}
            </Button>
          </>
        }
      >
        <form id="lost-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="Eşya açıklaması *" value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} className="sm:col-span-2" />
          <DatePicker label="Bulunma tarihi" value={form.date} onChange={(v) => set('date', v)} />
          <Select label="Bulan çalışan *" value={form.foundBy} onChange={(e) => set('foundBy', e.target.value)} options={employeeOptions(employees)} placeholder="Seçin" error={errors.foundBy} />
          <Input label="Bulunan yer" value={form.location} onChange={(e) => set('location', e.target.value)} hint="Oda değilse alan adı" />
          <Select label="Oda (opsiyonel)" value={form.roomId} onChange={(e) => set('roomId', e.target.value)} options={rooms.map((r) => ({ value: r.id, label: `Oda ${r.no}` }))} placeholder="Oda değil" />
          <Input label="Muhafaza yeri" value={form.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} placeholder="Dolap A · Raf 2" />
          <Select label="Durum" value={form.status} onChange={(e) => set('status', e.target.value as LostStatus)} options={STATUS_OPTIONS} />

          {form.status === 'teslim_edildi' && (
            <div className="grid gap-4 rounded-xl bg-emerald-50/60 p-4 sm:col-span-2 sm:grid-cols-2 dark:bg-emerald-500/10">
              <Input label="Teslim alan kişi *" value={form.receivedBy} onChange={(e) => set('receivedBy', e.target.value)} error={errors.receivedBy} />
              <DatePicker label="Teslim tarihi" value={form.deliveredAt} onChange={(v) => set('deliveredAt', v)} />
              <Select label="Misafir (opsiyonel)" value={form.guestId} onChange={(e) => set('guestId', e.target.value)} options={[...guestMap].map(([id, name]) => ({ value: id, label: name }))} placeholder="Kayıtlı misafir değil" className="sm:col-span-2" />
            </div>
          )}

          <Textarea label="Not" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} wrapperClassName="sm:col-span-2" />
        </form>
      </Modal>

      <DeliverModal
        item={deliverTarget}
        guests={guests}
        onClose={() => setDeliverTarget(null)}
        onDeliver={(receivedBy, deliveredAt, guestId) => {
          if (!deliverTarget) return;
          update('lostItems', deliverTarget.id, { status: 'teslim_edildi', receivedBy, deliveredAt, guestId: guestId || undefined });
          log(`Kayıp eşya teslim edildi: ${deliverTarget.description} → ${receivedBy}`, 'on_buro');
          toast.success('Eşya sahibine teslim edildi');
          setDeliverTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          remove('lostItems', deleteTarget.id);
          log(`Kayıp eşya kaydı silindi: ${deleteTarget.description}`, 'on_buro');
          toast.success('Kayıt silindi');
          setDeleteTarget(null);
        }}
        title="Kayıt silinsin mi?"
        message={deleteTarget ? <>&quot;{deleteTarget.description}&quot; kaydı kalıcı olarak silinecek.</> : null}
        confirmText="Sil"
      />

      {items.length === 0 && (
        <Card className="mt-6">
          <EmptyState title="Henüz kayıp eşya yok" description="Bulunan bir eşya olduğunda Eşya Ekle ile kaydedin." />
        </Card>
      )}
    </div>
  );
}

interface DeliverModalProps {
  item: LostItem | null;
  guests: { id: string; fullName: string }[];
  onClose: () => void;
  onDeliver: (receivedBy: string, deliveredAt: string, guestId: string) => void;
}

/** Sahibine teslim: teslim alan kişi, tarih ve (varsa) kayıtlı misafir. */
function DeliverModal({ item, guests, onClose, onDeliver }: DeliverModalProps) {
  const [receivedBy, setReceivedBy] = useState('');
  const [deliveredAt, setDeliveredAt] = useState(todayStr());
  const [guestId, setGuestId] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!receivedBy.trim()) {
      setError('Teslim alan kişinin adını yazın');
      return;
    }
    onDeliver(receivedBy.trim(), deliveredAt, guestId);
    setReceivedBy('');
    setGuestId('');
    setDeliveredAt(todayStr());
    setError(undefined);
  };

  const handleClose = () => {
    setError(undefined);
    onClose();
  };

  return (
    <Modal
      open={!!item}
      onClose={handleClose}
      title="Sahibine Teslim Et"
      description={item ? `${item.description} · ${item.storageLocation ?? item.location}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Vazgeç
          </Button>
          <Button type="submit" form="deliver-form" icon={<CalendarCheck className="h-4 w-4" />}>
            Teslimi kaydet
          </Button>
        </>
      }
    >
      <form id="deliver-form" onSubmit={submit} className="grid gap-4">
        <Input label="Teslim alan kişi *" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} error={error} placeholder="Ad soyad" autoFocus />
        <DatePicker label="Teslim tarihi" value={deliveredAt} onChange={setDeliveredAt} />
        <Select
          label="Kayıtlı misafir (opsiyonel)"
          value={guestId}
          onChange={(e) => setGuestId(e.target.value)}
          options={guests.map((g) => ({ value: g.id, label: g.fullName }))}
          placeholder="Eşleştirme yapma"
        />
      </form>
    </Modal>
  );
}
