import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Circle, CircleDot, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
import { useStore } from '../../store/useStore';
import { formatDate, todayStr } from '../../lib/format';
import type { GeneralTaskStatus, Priority, Task } from '../../types';
import { PRIORITY_COLOR, PRIORITY_LABEL, TASK_STATUS_LABEL, toOptions } from './helpers';

type TaskForm = Omit<Task, 'id'>;

const STATUS_ORDER: GeneralTaskStatus[] = ['yapilacak', 'devam', 'tamamlandi'];

const COLUMN_META: Record<GeneralTaskStatus, { icon: ReactNode; tone: string }> = {
  yapilacak: { icon: <Circle className="h-4 w-4" />, tone: 'text-slate-500' },
  devam: { icon: <CircleDot className="h-4 w-4" />, tone: 'text-indigo-500' },
  tamamlandi: { icon: <CheckCircle2 className="h-4 w-4" />, tone: 'text-emerald-500' },
};

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  assignedTo: undefined,
  dueDate: undefined,
  priority: 'orta',
  status: 'yapilacak',
};

const PRIORITY_OPTIONS = toOptions(PRIORITY_LABEL);
const STATUS_OPTIONS = toOptions(TASK_STATUS_LABEL);

export default function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const employees = useStore((s) => s.employees);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const today = todayStr();

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const employeeOptions = useMemo(
    () => employees.filter((e) => e.active).map((e) => ({ value: e.id, label: `${e.fullName} · ${e.position}` })),
    [employees],
  );

  const columns = useMemo(() => {
    const byStatus: Record<GeneralTaskStatus, Task[]> = { yapilacak: [], devam: [], tamamlandi: [] };
    tasks.forEach((t) => byStatus[t.status]?.push(t));
    // Önce öncelik (acil → düşük), sonra son tarih (yakın → uzak, tarihsizler sonda)
    const rank: Record<Priority, number> = { acil: 0, yuksek: 1, orta: 2, dusuk: 3 };
    (Object.keys(byStatus) as GeneralTaskStatus[]).forEach((k) =>
      byStatus[k].sort((a, b) => {
        const p = rank[a.priority] - rank[b.priority];
        if (p) return p;
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
      }),
    );
    return byStatus;
  }, [tasks]);

  const overdueCount = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'tamamlandi').length;

  const openCreate = (status: GeneralTaskStatus = 'yapilacak') => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, status });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
    });
    setErrors({});
    setFormOpen(true);
  };

  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: 'Görev başlığı zorunludur' });
      return;
    }
    const payload: TaskForm = {
      ...form,
      title: form.title.trim(),
      assignedTo: form.assignedTo || undefined,
      dueDate: form.dueDate || undefined,
    };
    if (editing) {
      update('tasks', editing.id, payload);
      log(`Görev güncellendi: ${payload.title}`, 'yonetim');
      toast.success('Görev güncellendi');
    } else {
      add('tasks', payload);
      log(`Yeni görev eklendi: ${payload.title}`, 'yonetim');
      toast.success('Görev eklendi');
    }
    setFormOpen(false);
  };

  const moveTo = (task: Task, status: GeneralTaskStatus) => {
    if (task.status === status) return;
    update('tasks', task.id, { status });
    if (status === 'tamamlandi') {
      log(`Görev tamamlandı: ${task.title}`, 'yonetim');
      toast.success('Görev tamamlandı');
    }
  };

  const shift = (task: Task, dir: -1 | 1) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[idx + dir];
    if (next) moveTo(task, next);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove('tasks', deleteTarget.id);
    log(`Görev silindi: ${deleteTarget.title}`, 'yonetim');
    toast.success('Görev silindi');
    setDeleteTarget(null);
  };

  const renderCard = (task: Task) => {
    const assignee = task.assignedTo ? employeeMap.get(task.assignedTo) : undefined;
    const overdue = !!task.dueDate && task.dueDate < today && task.status !== 'tamamlandi';
    const idx = STATUS_ORDER.indexOf(task.status);

    return (
      <div
        key={task.id}
        className="group rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-800/60"
      >
        <div className="flex items-start justify-between gap-2">
          <Badge color={PRIORITY_COLOR[task.priority]} dot>
            {PRIORITY_LABEL[task.priority]}
          </Badge>
          <div className="flex shrink-0 opacity-70 transition group-hover:opacity-100">
            <button onClick={() => openEdit(task)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700" aria-label="Düzenle">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleteTarget(task)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Sil">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <h4 className="mt-2 font-semibold leading-snug text-slate-900 dark:text-white">{task.title}</h4>
        {task.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>}

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          {assignee ? (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={assignee.fullName} size="sm" color={assignee.color} />
              <span className="truncate text-slate-600 dark:text-slate-300">{assignee.fullName}</span>
            </div>
          ) : (
            <span className="text-slate-400">Atanmadı</span>
          )}
          {task.dueDate ? (
            <span
              className={
                overdue
                  ? 'inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'inline-flex shrink-0 items-center gap-1 text-slate-500 dark:text-slate-400'
              }
              title={overdue ? 'Son tarih geçti' : undefined}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(task.dueDate, 'd MMM')}
              {overdue && ' · gecikti'}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
          <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => shift(task, -1)} icon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Geri
          </Button>
          <div className="flex gap-1">
            {STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
              <button
                key={s}
                onClick={() => moveTo(task, s)}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                title={`${TASK_STATUS_LABEL[s]} yap`}
              >
                {TASK_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" disabled={idx === STATUS_ORDER.length - 1} onClick={() => shift(task, 1)} icon={<ArrowRight className="h-3.5 w-3.5" />}>
            İleri
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Görevler"
        description={`${tasks.length} görev${overdueCount ? ` · ${overdueCount} gecikmiş` : ''}`}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
            Görev Ekle
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const list = columns[status];
          return (
            <section key={status} className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <header className="mb-3 flex items-center justify-between px-1">
                <div className={`flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 ${COLUMN_META[status].tone}`}>
                  {COLUMN_META[status].icon}
                  <span className="text-slate-800 dark:text-slate-100">{TASK_STATUS_LABEL[status]}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">{list.length}</span>
                </div>
                <button
                  onClick={() => openCreate(status)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-800"
                  aria-label="Bu kolona görev ekle"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-col gap-3">
                {list.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
                    Görev yok
                  </div>
                ) : (
                  list.map(renderCard)
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Görevi Düzenle' : 'Yeni Görev'}
        description="Görevi bir çalışana atayın, öncelik ve son tarih belirleyin"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" form="task-form">
              {editing ? 'Kaydet' : 'Ekle'}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="Başlık *" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} className="sm:col-span-2" />
          <Textarea
            label="Açıklama"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            wrapperClassName="sm:col-span-2"
          />
          <Select
            label="Atanan çalışan"
            value={form.assignedTo ?? ''}
            onChange={(e) => set('assignedTo', e.target.value || undefined)}
            options={employeeOptions}
            placeholder="Atanmadı"
          />
          <DatePicker label="Son tarih" value={form.dueDate ?? ''} onChange={(v) => set('dueDate', v || undefined)} />
          <Select label="Öncelik" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)} options={PRIORITY_OPTIONS} />
          <Select label="Durum" value={form.status} onChange={(e) => set('status', e.target.value as GeneralTaskStatus)} options={STATUS_OPTIONS} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Görev silinsin mi?"
        message={deleteTarget ? <>&quot;{deleteTarget.title}&quot; görevi kalıcı olarak silinecek.</> : null}
        confirmText="Sil"
      />
    </div>
  );
}
