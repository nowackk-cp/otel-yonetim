import { useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { Pencil, Plus, Receipt, Trash2, Truck, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatCard,
  useToast,
  type Column,
} from '../../components/ui';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatDate } from '../../lib/format';
import { splitVat } from '../../lib/calc';
import type { Supplier, Transaction } from '../../types';
import { num } from './helpers';

type SupplierForm = Omit<Supplier, 'id'>;

const EMPTY_FORM: SupplierForm = {
  name: '',
  contact: '',
  phone: '',
  email: '',
  taxNo: '',
  category: '',
  balance: 0,
};

/** Bakiye: + ise tedarikçiye borcumuz, − ise tedarikçiden alacağımız var. */
function BalanceBadge({ balance }: { balance: number }) {
  if (balance > 0) return <Badge color="rose">Borcumuz {formatCurrency(balance)}</Badge>;
  if (balance < 0) return <Badge color="sky">Alacağımız {formatCurrency(-balance)}</Badge>;
  return <Badge color="emerald">Borç yok</Badge>;
}

export default function SuppliersPage() {
  const suppliers = useStore((s) => s.suppliers);
  const transactions = useStore((s) => s.transactions);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const selected = useMemo(() => suppliers.find((s) => s.id === selectedId) ?? null, [suppliers, selectedId]);

  /** Tedarikçiye ait gider işlemleri (tedarikçi bazında, tarihe göre yeni → eski). */
  const supplierExpenses = useMemo(() => {
    if (!selected) return [] as Transaction[];
    return transactions
      .filter((t) => t.type === 'gider' && t.supplierId === selected.id)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [transactions, selected]);

  const expenseTotal = supplierExpenses.reduce((sum, t) => sum + t.amount, 0);

  const stats = useMemo(() => {
    const debt = suppliers.filter((s) => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);
    const receivable = suppliers.filter((s) => s.balance < 0).reduce((sum, s) => sum - s.balance, 0);
    return {
      count: suppliers.length,
      debtors: suppliers.filter((s) => s.balance > 0).length,
      debt,
      receivable,
    };
  }, [suppliers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (supplier: Supplier, e?: MouseEvent) => {
    e?.stopPropagation();
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      taxNo: supplier.taxNo,
      category: supplier.category,
      balance: supplier.balance,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const set = <K extends keyof SupplierForm>(key: K, value: SupplierForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: 'Tedarikçi adı zorunludur' });
      return;
    }
    const payload: SupplierForm = { ...form, name: form.name.trim() };
    if (editing) {
      update('suppliers', editing.id, payload);
      log(`Tedarikçi güncellendi: ${payload.name}`, 'muhasebe');
      toast.success('Tedarikçi güncellendi');
    } else {
      add('suppliers', payload);
      log(`Yeni tedarikçi eklendi: ${payload.name}`, 'muhasebe');
      toast.success('Tedarikçi eklendi');
    }
    closeForm();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove('suppliers', deleteTarget.id);
    log(`Tedarikçi silindi: ${deleteTarget.name}`, 'muhasebe');
    toast.success('Tedarikçi silindi');
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Firma',
      sortValue: (s) => s.name,
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white">{s.name}</p>
          <p className="text-xs text-slate-400">{s.taxNo ? `VKN ${s.taxNo}` : 'VKN yok'}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      sortValue: (s) => s.category,
      render: (s) => (s.category ? <Badge color="indigo">{s.category}</Badge> : <span className="text-slate-400">-</span>),
    },
    {
      key: 'contact',
      header: 'İletişim',
      searchValue: (s) => `${s.contact} ${s.phone} ${s.email}`,
      render: (s) => (
        <div className="text-sm">
          <p>{s.contact || '-'}</p>
          <p className="text-xs text-slate-400">{s.phone}</p>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Bakiye',
      align: 'right',
      sortValue: (s) => s.balance,
      render: (s) => <BalanceBadge balance={s.balance} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => openEdit(s, e)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
            aria-label="Düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(s);
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
        title="Tedarikçiler"
        description="Tedarikçi kayıtları, borç-alacak bakiyeleri ve gider geçmişi"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Tedarikçi Ekle
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Toplam Tedarikçi" value={stats.count} icon={<Truck />} tone="indigo" />
        <StatCard title="Toplam Borcumuz" value={formatCurrency(stats.debt, true)} icon={<Wallet />} tone="rose" changeLabel={`${stats.debtors} tedarikçi`} />
        <StatCard title="Toplam Alacağımız" value={formatCurrency(stats.receivable, true)} icon={<Receipt />} tone="sky" />
        <StatCard
          title="Borçsuz Tedarikçi"
          value={stats.count - stats.debtors}
          icon={<Receipt />}
          tone="emerald"
        />
      </div>

      <div className="mt-6">
        <DataTable
          data={suppliers}
          rowKey={(s) => s.id}
          columns={columns}
          onRowClick={(s) => setSelectedId(s.id)}
          searchPlaceholder="Firma, kategori, kişi ara..."
          emptyTitle="Tedarikçi yok"
          emptyDescription="Yeni bir tedarikçi ekleyerek başlayın."
        />
      </div>

      {/* Tedarikçi detayı: gider işlemleri ve bakiye */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name}
        description={selected ? [selected.category, selected.taxNo && `VKN ${selected.taxNo}`].filter(Boolean).join(' · ') : undefined}
        width="lg"
        footer={
          selected && (
            <>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(selected)}>
                Düzenle
              </Button>
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(selected)}>
                Sil
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card padded>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bakiye</p>
                <div className="mt-2">
                  <BalanceBadge balance={selected.balance} />
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(selected.balance)}</p>
              </Card>
              <Card padded>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Toplam Gider</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(expenseTotal)}</p>
                <p className="text-xs text-slate-400">{supplierExpenses.length} işlem (KDV dahil)</p>
              </Card>
              <Card padded>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">İletişim</p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{selected.contact || '-'}</p>
                <p className="text-xs text-slate-400">{selected.phone || '-'}</p>
                <p className="truncate text-xs text-slate-400">{selected.email || '-'}</p>
              </Card>
            </div>

            <Card title="Gider İşlemleri" subtitle="Bu tedarikçiye ait gider kayıtları" padded={false}>
              {supplierExpenses.length === 0 ? (
                <EmptyState title="Gider işlemi yok" description="Bu tedarikçiye bağlı bir gider kaydı bulunmuyor." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                        <th className="px-5 py-2.5">Tarih</th>
                        <th className="px-3 py-2.5">Açıklama</th>
                        <th className="px-3 py-2.5 text-right">KDV</th>
                        <th className="px-5 py-2.5 text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierExpenses.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                          <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(t.date)}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{t.description}</p>
                            <p className="text-xs text-slate-400">
                              {t.category}
                              {t.documentNo ? ` · ${t.documentNo}` : ''}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-xs text-slate-500">
                            %{t.vatRate} · {formatCurrency(t.vatAmount || splitVat(t.amount, t.vatRate).vat)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                        <td colSpan={3} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Toplam
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(expenseTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </Drawer>

      {/* Ekle / düzenle */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi'}
        description="Firma bilgileri ve güncel bakiye"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Vazgeç
            </Button>
            <Button type="submit" form="supplier-form">
              {editing ? 'Kaydet' : 'Ekle'}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="Firma adı *" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} className="sm:col-span-2" />
          <Input label="Yetkili kişi" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
          <Input label="Kategori" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Gıda, Bakım, ..." />
          <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="E-posta" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Vergi no" value={form.taxNo} onChange={(e) => set('taxNo', e.target.value)} />
          <Input
            label="Bakiye (₺)"
            type="number"
            step="0.01"
            value={form.balance}
            onChange={(e) => set('balance', num(e.target.value))}
            hint="+ değer: tedarikçiye borcumuz · − değer: alacağımız"
            className="sm:col-span-2"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Tedarikçi silinsin mi?"
        message={
          deleteTarget ? (
            <>
              <strong>{deleteTarget.name}</strong> kaydı silinecek. Bu işlem geri alınamaz; geçmiş gider işlemleri korunur.
            </>
          ) : null
        }
        confirmText="Sil"
      />
    </div>
  );
}
