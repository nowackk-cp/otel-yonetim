import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, SlidersHorizontal, Table, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../lib/format';
import {
  Button,
  Card,
  Badge,
  DataTable,
  type Column,
  Modal,
  Input,
  Select,
  Textarea,
  ConfirmDialog,
  useToast,
} from '../../components/ui';
import type { BoardType, RatePlan, RoomType } from '../../types';
import { BOARD_LABELS, BOARD_EXTRAS } from './ratesHelpers';

export function RatePlansTab() {
  const toast = useToast();
  const ratePlans = useStore((s) => s.ratePlans);
  const roomTypes = useStore((s) => s.roomTypes);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [board, setBoard] = useState<BoardType>('oda_kahvalti');
  const [price, setPrice] = useState('2500');
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState('');

  // Delete State
  const [deletingPlan, setDeletingPlan] = useState<RatePlan | null>(null);

  // Görünüm Modu: Matris veya Liste
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  const boardsList = useMemo(() => Object.keys(BOARD_LABELS) as BoardType[], []);
  const roomTypeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes]);

  // Hızlı Ekleme / Düzenleme Açıcı
  const handleOpenCreateModal = (targetRoomTypeId?: string, targetBoard?: BoardType) => {
    setEditingPlan(null);
    const rtId = targetRoomTypeId || (roomTypes[0]?.id ?? '');
    const b = targetBoard || 'oda_kahvalti';
    const rt = roomTypeMap.get(rtId);
    const defaultPrice = (rt?.basePrice || 2000) + (BOARD_EXTRAS[b] || 0);

    setRoomTypeId(rtId);
    setBoard(b);
    setPrice(String(defaultPrice));
    setName(rt ? `${rt.name} • ${BOARD_LABELS[b]}` : 'Yeni Fiyat Planı');
    setActive(true);
    setDescription('Gecelik, KDV dahil standart fiyat planı.');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: RatePlan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setRoomTypeId(plan.roomTypeId);
    setBoard(plan.board);
    setPrice(String(plan.price));
    setActive(plan.active);
    setDescription(plan.description || '');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Lütfen fiyat planı adını girin.');
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Lütfen geçerli bir fiyat girin.');
      return;
    }

    if (editingPlan) {
      update('ratePlans', editingPlan.id, {
        name: name.trim(),
        roomTypeId,
        board,
        price: numPrice,
        active,
        description: description.trim(),
      });
      toast.success('Fiyat planı güncellendi.');
      log(`Fiyat planı güncellendi: ${name.trim()}`, 'yonetim');
    } else {
      add('ratePlans', {
        name: name.trim(),
        roomTypeId,
        board,
        price: numPrice,
        active,
        description: description.trim(),
      });
      toast.success('Yeni fiyat planı oluşturuldu.');
      log(`Yeni fiyat planı eklendi: ${name.trim()}`, 'yonetim');
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!deletingPlan) return;
    remove('ratePlans', deletingPlan.id);
    toast.success('Fiyat planı silindi.');
    log(`Fiyat planı silindi: ${deletingPlan.name}`, 'yonetim');
    setDeletingPlan(null);
  };

  // Matris Haritası: (roomTypeId + '-' + board) -> RatePlan
  const matrixMap = useMemo(() => {
    const map = new Map<string, RatePlan>();
    ratePlans.forEach((p) => {
      map.set(`${p.roomTypeId}-${p.board}`, p);
    });
    return map;
  }, [ratePlans]);

  // Tablo Kolonları
  const columns: Column<RatePlan>[] = [
    {
      key: 'name',
      header: 'Plan Adı',
      sortValue: (p) => p.name,
      render: (p) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">{p.name}</span>
          {p.description && (
            <span className="text-xs text-slate-500 line-clamp-1">{p.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'roomTypeId',
      header: 'Oda Tipi',
      render: (p) => {
        const rt = roomTypeMap.get(p.roomTypeId);
        return <span className="font-medium text-xs">{rt?.name || 'Bilinmiyor'}</span>;
      },
    },
    {
      key: 'board',
      header: 'Pansiyon Tipi',
      render: (p) => (
        <Badge color="indigo" className="text-xs">
          {BOARD_LABELS[p.board] || p.board}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Gecelik Fiyat',
      align: 'right',
      sortValue: (p) => p.price,
      render: (p) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatCurrency(p.price)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Durum',
      render: (p) => (
        <Badge color={p.active ? 'emerald' : 'slate'} dot={p.active}>
          {p.active ? 'Satışta' : 'Pasif'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Düzenle"
            onClick={() => handleOpenEditModal(p)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            title="Sil"
            onClick={() => setDeletingPlan(p)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Üst Bar: Görünüm ve Ekleme Butonu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'matrix'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              Fiyat Matrisi (Oda x Pansiyon)
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Plan Listesi ({ratePlans.length})
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => handleOpenCreateModal()}
        >
          Yeni Fiyat Planı
        </Button>
      </div>

      {/* 1. ODA TİPİ X PANSİYON TİPİ FİYAT MATRİSİ */}
      {viewMode === 'matrix' ? (
        <Card
          title="Fiyatlandırma Matrisi"
          subtitle="Oda tipleri ve pansiyon seçeneklerine göre tanımlı gecelik baz satış fiyatları"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[200px]">
                    Oda Tipi / Kapasite
                  </th>
                  {boardsList.map((b) => (
                    <th
                      key={b}
                      className="py-3.5 px-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 min-w-[140px]"
                    >
                      {BOARD_LABELS[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roomTypes.map((rt) => (
                  <tr
                    key={rt.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-sm">
                          {rt.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {rt.capacity} Kişilik • Baz: {formatCurrency(rt.basePrice)}
                        </span>
                      </div>
                    </td>

                    {boardsList.map((b) => {
                      const plan = matrixMap.get(`${rt.id}-${b}`);

                      return (
                        <td key={b} className="py-3 px-3 text-center">
                          {plan ? (
                            <button
                              onClick={() => handleOpenEditModal(plan)}
                              className={`w-full group rounded-xl border p-2.5 transition text-center focus:outline-none ${
                                plan.active
                                  ? 'border-indigo-100 bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-950/40 dark:bg-indigo-950/20'
                                  : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100 dark:border-slate-800 dark:bg-slate-850'
                              }`}
                            >
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
                                {formatCurrency(plan.price)}
                              </div>
                              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                                <span>{plan.active ? 'Aktif' : 'Pasif'}</span>
                                <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenCreateModal(rt.id, b)}
                              className="w-full rounded-xl border border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 transition"
                            >
                              + Plan Ekle
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* 2. PLAN LİSTESİ */
        <DataTable
          columns={columns}
          data={ratePlans}
          rowKey={(p) => p.id}
          searchPlaceholder="Fiyat planı veya oda tipi ara..."
          emptyTitle="Fiyat planı bulunamadı"
          emptyDescription="Henüz tanımlanmış bir fiyat planı yok."
        />
      )}

      {/* EKLE / DÜZENLE MODALI */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'Fiyat Planını Düzenle' : 'Yeni Fiyat Planı Oluştur'}
        description="Oda tipi ve pansiyon seçeneğine göre gecelik KDV dahil fiyat belirleyin."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingPlan ? 'Değişiklikleri Kaydet' : 'Planı Oluştur'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Plan Başlığı"
            placeholder="Örn: Deluxe • Oda Kahvaltı"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Oda Tipi"
              options={roomTypes.map((rt) => ({
                value: rt.id,
                label: `${rt.name} (${formatCurrency(rt.basePrice)})`,
              }))}
              value={roomTypeId}
              onChange={(e) => {
                setRoomTypeId(e.target.value);
                const rt = roomTypeMap.get(e.target.value);
                if (rt) {
                  setName(`${rt.name} • ${BOARD_LABELS[board]}`);
                  setPrice(String(rt.basePrice + (BOARD_EXTRAS[board] || 0)));
                }
              }}
            />

            <Select
              label="Pansiyon Tipi"
              options={boardsList.map((b) => ({
                value: b,
                label: BOARD_LABELS[b],
              }))}
              value={board}
              onChange={(e) => {
                const newBoard = e.target.value as BoardType;
                setBoard(newBoard);
                const rt = roomTypeMap.get(roomTypeId);
                if (rt) {
                  setName(`${rt.name} • ${BOARD_LABELS[newBoard]}`);
                  setPrice(String(rt.basePrice + (BOARD_EXTRAS[newBoard] || 0)));
                }
              }}
            />
          </div>

          <Input
            label="Gecelik Satış Fiyatı (₺ - KDV Dahil)"
            type="number"
            min={0}
            step="10"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <Textarea
            label="Plan Açıklaması / Notlar"
            placeholder="İptal şartları, min stay veya dahil olan hizmetler..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bu fiyat planı aktif ve satış kanallarında kullanılabilir
            </span>
          </label>
        </div>
      </Modal>

      {/* SİLME ONAY DİYALOĞU */}
      <ConfirmDialog
        open={Boolean(deletingPlan)}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDelete}
        title="Fiyat Planını Sil"
        message={`"${deletingPlan?.name}" fiyat planını silmek istediğinize emin misiniz?`}
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
      />
    </div>
  );
}
