import { useState, type FormEvent } from 'react';
import { Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, DataTable, DatePicker, Input, Modal, Select, useToast, type Column } from '../../../components/ui';
import { shiftMinutes } from '../../../lib/calc';
import { formatMinutes } from '../../../lib/format';
import { useStore } from '../../../store/useStore';
import type { ShiftTemplate, ShiftType } from '../../../types';
import { SHIFT_TYPE_LABEL, num, toOptions } from '../helpers';

type TemplateForm = Omit<ShiftTemplate, 'id'>;

const EMPTY_FORM: TemplateForm = { name: '', type: 'sabah', start: '09:00', end: '17:00', breakMinutes: 60 };

const SHIFT_TYPE_OPTIONS = toOptions(SHIFT_TYPE_LABEL);
const SHIFT_TYPE_COLOR: Record<ShiftType, 'amber' | 'sky' | 'violet' | 'slate'> = {
  sabah: 'amber',
  aksam: 'sky',
  gece: 'violet',
  ozel: 'slate',
};

export function ShiftTemplatesTab() {
  const templates = useStore((s) => s.shiftTemplates);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; time?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<ShiftTemplate | null>(null);

  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (t: ShiftTemplate) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, start: t.start, end: t.end, breakMinutes: t.breakMinutes });
    setErrors({});
    setFormOpen(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; time?: string } = {};
    if (!form.name.trim()) nextErrors.name = 'Şablon adı zorunludur';
    if (!form.start || !form.end || form.start === form.end) nextErrors.time = 'Başlangıç ve bitiş saati farklı olmalı';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const payload: TemplateForm = { ...form, name: form.name.trim(), breakMinutes: Math.max(0, form.breakMinutes) };
    if (editing) {
      update('shiftTemplates', editing.id, payload);
      log(`Vardiya şablonu güncellendi: ${payload.name}`, 'ik');
      toast.success('Vardiya şablonu güncellendi');
    } else {
      add('shiftTemplates', payload);
      log(`Yeni vardiya şablonu eklendi: ${payload.name}`, 'ik');
      toast.success('Vardiya şablonu eklendi');
    }
    setFormOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove('shiftTemplates', deleteTarget.id);
    log(`Vardiya şablonu silindi: ${deleteTarget.name}`, 'ik');
    toast.success('Vardiya şablonu silindi');
    setDeleteTarget(null);
  };

  const columns: Column<ShiftTemplate>[] = [
    {
      key: 'name',
      header: 'Şablon',
      sortValue: (t) => t.name,
      render: (t) => (
        <div className="flex items-center gap-2">
          <Badge color={SHIFT_TYPE_COLOR[t.type]}>{SHIFT_TYPE_LABEL[t.type]}</Badge>
          <span className="font-medium text-slate-900 dark:text-white">{t.name}</span>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Saat',
      sortValue: (t) => t.start,
      render: (t) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {t.start} – {t.end}
          {t.end < t.start && (
            <span title="Vardiya ertesi güne sarkar" className="text-violet-500">
              <Moon className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'break',
      header: 'Mola',
      align: 'right',
      sortValue: (t) => t.breakMinutes,
      render: (t) => `${t.breakMinutes} dk`,
    },
    {
      key: 'net',
      header: 'Net çalışma',
      align: 'right',
      sortValue: (t) => shiftMinutes(t),
      render: (t) => <span className="font-semibold">{formatMinutes(shiftMinutes(t))}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Düzenle">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Sil">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const formNetMinutes = form.start && form.end && form.start !== form.end ? shiftMinutes(form) : 0;

  return (
    <>
      <Card
        title="Vardiya Şablonları"
        subtitle="Vardiya planlamasında hızlı seçim için kullanılan hazır saat dilimleri"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Şablon Ekle
          </Button>
        }
        padded={false}
      >
        <DataTable
          data={templates}
          rowKey={(t) => t.id}
          columns={columns}
          searchPlaceholder="Şablon ara..."
          emptyTitle="Şablon yok"
          emptyDescription="Sabah, akşam veya gece gibi sık kullanılan vardiyalar için şablon ekleyin."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Şablonu Düzenle' : 'Yeni Vardiya Şablonu'}
        description="Başlangıç ve bitiş saati; bitiş başlangıçtan önceyse vardiya ertesi güne sarkar"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" form="shift-template-form">
              {editing ? 'Kaydet' : 'Ekle'}
            </Button>
          </>
        }
      >
        <form id="shift-template-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="Şablon adı *" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} className="sm:col-span-2" />
          <Select label="Vardiya tipi" value={form.type} onChange={(e) => set('type', e.target.value as ShiftType)} options={SHIFT_TYPE_OPTIONS} />
          <Input
            label="Mola (dk)"
            type="number"
            min={0}
            step={5}
            value={form.breakMinutes}
            onChange={(e) => set('breakMinutes', num(e.target.value))}
          />
          <DatePicker label="Başlangıç" mode="time" value={form.start} onChange={(v) => set('start', v)} error={errors.time} />
          <DatePicker label="Bitiş" mode="time" value={form.end} onChange={(v) => set('end', v)} />
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:col-span-2 dark:bg-slate-800/60 dark:text-slate-300">
            Net çalışma süresi: <span className="font-semibold text-slate-900 dark:text-white">{formatMinutes(formNetMinutes)}</span>
            {formNetMinutes > 0 && form.end < form.start && <span className="ml-2 text-violet-500">· ertesi güne sarkar</span>}
          </div>
          {errors.time && <p className="text-xs text-rose-600 sm:col-span-2">{errors.time}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Vardiya şablonu silinsin mi?"
        message={deleteTarget ? <>&quot;{deleteTarget.name}&quot; şablonu silinecek. Mevcut vardiya kayıtları etkilenmez.</> : null}
        confirmText="Sil"
      />
    </>
  );
}
