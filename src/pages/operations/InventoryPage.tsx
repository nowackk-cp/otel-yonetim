import { useMemo, useState } from 'react';
import {
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Printer,
  History,
  Layers,
  Search,
  ShoppingCart,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Building2,
  FileText,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  formatCurrency,
  formatDate,
  todayStr,
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
  useToast,
} from '../../components/ui';
import type { InventoryItem, StockMovement, Supplier } from '../../types';

// Standartlaştırılmış kategoriler
const INVENTORY_CATEGORIES = [
  'Tümü',
  'Temizlik',
  'Banyo Malzemeleri',
  'Minibar & İçecek',
  'Mutfak & Gıda',
  'Çarşaf & Havlu',
  'Teknik Malzeme',
] as const;

// Seed verisindeki kategorileri UI kategorilerine eşleme
function mapSeedCategory(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes('temizlik')) return 'Temizlik';
  if (c.includes('oda') || c.includes('banyo')) return 'Banyo Malzemeleri';
  if (c.includes('içecek') || c.includes('minibar')) return 'Minibar & İçecek';
  if (c.includes('gıda') || c.includes('mutfak')) return 'Mutfak & Gıda';
  if (c.includes('tekstil') || c.includes('çarşaf') || c.includes('havlu')) return 'Çarşaf & Havlu';
  if (c.includes('teknik')) return 'Teknik Malzeme';
  return cat;
}

export default function InventoryPage() {
  const toast = useToast();
  const today = todayStr();

  // Store
  const inventoryItems = useStore((s) => s.inventoryItems);
  const stockMovements = useStore((s) => s.stockMovements);
  const suppliers = useStore((s) => s.suppliers);
  const settings = useStore((s) => s.settings);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const log = useStore((s) => s.log);

  // Tab State: 'inventory' | 'movements'
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');

  // Modal State'leri
  // 1. Stok Hareketi Modalı (Giriş / Çıkış)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementItemId, setMovementItemId] = useState('');
  const [movementDirection, setMovementDirection] = useState<'giris' | 'cikis'>('giris');
  const [movementQuantity, setMovementQuantity] = useState('10');
  const [movementDate, setMovementDate] = useState(today);
  const [movementDescription, setMovementDescription] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(false);

  // 2. Yeni Ürün Modalı
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Temizlik');
  const [newItemUnit, setNewItemUnit] = useState('adet');
  const [newItemQuantity, setNewItemQuantity] = useState('50');
  const [newItemMinQuantity, setNewItemMinQuantity] = useState('20');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('25');
  const [newItemSupplierId, setNewItemSupplierId] = useState('');

  // 3. Sipariş Listesi Modalı
  const [isOrderListModalOpen, setIsOrderListModalOpen] = useState(false);

  // Lookups
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const itemMap = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);

  // Metrikler
  const totalStockValue = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [inventoryItems]);

  const lowStockItems = useMemo(() => {
    return inventoryItems.filter((item) => item.quantity <= item.minQuantity);
  }, [inventoryItems]);

  const totalItemsCount = inventoryItems.length;

  const totalMonthlyMovements = useMemo(() => {
    return stockMovements.filter((m) => m.date.startsWith(today.slice(0, 7))).length;
  }, [stockMovements, today]);

  // Kategoriye göre filtrelenmiş ürünler
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'Tümü') return inventoryItems;
    return inventoryItems.filter((item) => mapSeedCategory(item.category) === selectedCategory);
  }, [inventoryItems, selectedCategory]);

  // Tedarikçiye göre gruplanmış kritik ürünler (Sipariş Listesi)
  const groupedOrdersBySupplier = useMemo(() => {
    const groups = new Map<
      string,
      { supplier: Supplier | undefined; items: { item: InventoryItem; needed: number; estimatedCost: number }[] }
    >();

    lowStockItems.forEach((item) => {
      const sId = item.supplierId || 'unknown';
      if (!groups.has(sId)) {
        groups.set(sId, {
          supplier: item.supplierId ? supplierMap.get(item.supplierId) : undefined,
          items: [],
        });
      }
      // Önerilen sipariş: Eksik kalan + minimum kadar güvenlik tamponu
      const needed = Math.max(1, item.minQuantity * 2 - item.quantity);
      const estimatedCost = needed * item.unitPrice;
      groups.get(sId)!.items.push({ item, needed, estimatedCost });
    });

    return Array.from(groups.values());
  }, [lowStockItems, supplierMap]);

  const totalOrderEstimatedCost = useMemo(() => {
    return groupedOrdersBySupplier.reduce((sum, grp) => {
      return sum + grp.items.reduce((s, i) => s + i.estimatedCost, 0);
    }, 0);
  }, [groupedOrdersBySupplier]);

  // AKSİYONLAR

  // 1. Stok Hareketi Kaydetme (Giriş / Çıkış)
  const handleSaveMovement = () => {
    const item = itemMap.get(movementItemId);
    if (!item) {
      toast.error('Lütfen bir ürün seçin.');
      return;
    }
    const qty = Number(movementQuantity);
    if (!qty || qty <= 0) {
      toast.error('Lütfen geçerli bir miktar girin.');
      return;
    }

    if (movementDirection === 'cikis' && item.quantity < qty) {
      toast.error(`Yetersiz stok! Mevcut stok: ${item.quantity} ${item.unit}.`);
      return;
    }

    // Yeni stok miktarı hesapla
    const newQty = movementDirection === 'giris' ? item.quantity + qty : item.quantity - qty;

    // Ürünü güncelle
    update('inventoryItems', item.id, { quantity: newQty });

    // Hareketi kaydet
    add('stockMovements', {
      itemId: item.id,
      direction: movementDirection,
      quantity: qty,
      date: movementDate,
      description: movementDescription.trim() || (movementDirection === 'giris' ? 'Stok alımı' : 'Departman kullanımı'),
    });

    // Girişte opsiyonel muhasebe gideri oluşturma
    if (movementDirection === 'giris' && recordAsExpense) {
      const totalCost = qty * item.unitPrice;
      const { vat } = splitVat(totalCost, settings.vatGeneral);
      add('transactions', {
        type: 'gider',
        category: 'Malzeme & Tedarik',
        description: `${item.name} (${qty} ${item.unit}) Stok Alımı Bedeli`,
        amount: round2(totalCost),
        vatRate: settings.vatGeneral,
        vatAmount: vat,
        date: movementDate,
        account: 'banka',
        supplierId: item.supplierId,
      });
      toast.success(`${formatCurrency(totalCost)} tutarındaki satın alma muhasebeye gider olarak kaydedildi.`);
    }

    toast.success(
      `${item.name} için ${qty} ${item.unit} stok ${movementDirection === 'giris' ? 'girişi' : 'çıkışı'} yapıldı. Yeni stok: ${newQty} ${item.unit}.`,
    );
    log(
      `${item.name} stok ${movementDirection}: ${qty} ${item.unit} (${movementDescription || 'İşlem'})`,
      'operasyon',
    );

    // Kapat ve sıfırla
    setIsMovementModalOpen(false);
    setMovementItemId('');
    setMovementQuantity('10');
    setMovementDescription('');
    setRecordAsExpense(false);
  };

  // 2. Yeni Ürün Kartı Kaydetme
  const handleCreateNewItem = () => {
    if (!newItemName.trim()) {
      toast.error('Lütfen ürün adını girin.');
      return;
    }

    add('inventoryItems', {
      name: newItemName.trim(),
      category: newItemCategory,
      unit: newItemUnit.trim() || 'adet',
      quantity: Number(newItemQuantity) || 0,
      minQuantity: Number(newItemMinQuantity) || 0,
      unitPrice: Number(newItemUnitPrice) || 0,
      supplierId: newItemSupplierId || undefined,
    });

    toast.success(`"${newItemName}" stok kartı başarıyla eklendi.`);
    log(`Yeni stok kalemi eklendi: ${newItemName} (${newItemCategory})`, 'operasyon');

    setIsNewItemModalOpen(false);
    setNewItemName('');
    setNewItemQuantity('50');
    setNewItemMinQuantity('20');
    setNewItemUnitPrice('25');
    setNewItemSupplierId('');
  };

  // Hızlı Stok Hareketi Açıcı
  const handleOpenMovementModal = (item: InventoryItem, direction: 'giris' | 'cikis') => {
    setMovementItemId(item.id);
    setMovementDirection(direction);
    setMovementQuantity(direction === 'giris' ? String(item.minQuantity) : '5');
    setMovementDescription(
      direction === 'giris' ? 'Tedarikçiden mal kabul' : 'Kat hizmetleri / departman talebi',
    );
    setRecordAsExpense(false);
    setIsMovementModalOpen(true);
  };

  // Tablo Kolonları: Stok Listesi
  const inventoryColumns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Ürün Adı',
      sortValue: (i) => i.name,
      render: (i) => {
        const isCritical = i.quantity <= i.minQuantity;
        return (
          <div className="flex items-center gap-2">
            <div>
              <span className={`font-semibold block ${isCritical ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                {i.name}
              </span>
              <span className="text-xs text-slate-500">{mapSeedCategory(i.category)}</span>
            </div>
            {isCritical && (
              <Badge color="rose" dot className="text-[10px]">
                Kritik ({i.minQuantity - i.quantity} eksik)
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Mevcut Stok',
      align: 'right',
      sortValue: (i) => i.quantity,
      render: (i) => {
        const isCritical = i.quantity <= i.minQuantity;
        return (
          <div className="text-right">
            <span
              className={`text-base font-bold ${
                isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {i.quantity.toLocaleString('tr-TR')}
            </span>{' '}
            <span className="text-xs text-slate-500 font-normal">{i.unit}</span>
          </div>
        );
      },
    },
    {
      key: 'minQuantity',
      header: 'Min. Seviye',
      align: 'right',
      sortValue: (i) => i.minQuantity,
      render: (i) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {i.minQuantity.toLocaleString('tr-TR')} {i.unit}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'Birim Fiyat',
      align: 'right',
      sortValue: (i) => i.unitPrice,
      render: (i) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {formatCurrency(i.unitPrice)}
        </span>
      ),
    },
    {
      key: 'totalValue',
      header: 'Toplam Değer',
      align: 'right',
      sortValue: (i) => i.quantity * i.unitPrice,
      render: (i) => (
        <span className="text-xs font-bold text-slate-900 dark:text-white">
          {formatCurrency(i.quantity * i.unitPrice)}
        </span>
      ),
    },
    {
      key: 'supplierId',
      header: 'Tedarikçi',
      render: (i) => {
        const sup = i.supplierId ? supplierMap.get(i.supplierId) : null;
        return sup ? (
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {sup.name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Hızlı Hareket',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            title="Stok Girişi"
            icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
            onClick={() => handleOpenMovementModal(i, 'giris')}
          >
            Giriş
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            title="Stok Çıkışı"
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            onClick={() => handleOpenMovementModal(i, 'cikis')}
          >
            Çıkış
          </Button>
        </div>
      ),
    },
  ];

  // Tablo Kolonları: Hareket Geçmişi
  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'date',
      header: 'Tarih',
      sortValue: (m) => m.date,
      render: (m) => <span className="text-xs font-medium">{formatDate(m.date)}</span>,
    },
    {
      key: 'itemId',
      header: 'Ürün',
      render: (m) => {
        const item = itemMap.get(m.itemId);
        return (
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block text-sm">
              {item?.name || 'Silinmiş Ürün'}
            </span>
            <span className="text-xs text-slate-400">{item?.category}</span>
          </div>
        );
      },
    },
    {
      key: 'direction',
      header: 'Hareket Türü',
      sortValue: (m) => m.direction,
      render: (m) => (
        <Badge color={m.direction === 'giris' ? 'emerald' : 'sky'}>
          {m.direction === 'giris' ? (
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3" /> Mal Girişi
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Depo Çıkışı
            </span>
          )}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      header: 'Miktar',
      align: 'right',
      sortValue: (m) => m.quantity,
      render: (m) => {
        const item = itemMap.get(m.itemId);
        return (
          <span className="font-bold text-sm text-slate-900 dark:text-white">
            {m.direction === 'giris' ? '+' : '-'}{m.quantity} {item?.unit || 'adet'}
          </span>
        );
      },
    },
    {
      key: 'description',
      header: 'Açıklama / Departman',
      render: (m) => <span className="text-xs text-slate-600 dark:text-slate-300">{m.description}</span>,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Sayfa Başlığı ve Aksiyonlar */}
      <PageHeader
        title="Stok & Envanter Yönetimi"
        description="Otel malzeme stokları, depo hareketleri, minimum stok takipleri ve sipariş yönetimi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<ShoppingCart className="h-4 w-4" />}
              onClick={() => setIsOrderListModalOpen(true)}
            >
              Sipariş Listesi Oluştur ({lowStockItems.length})
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowDownLeft className="h-4 w-4" />}
              onClick={() => {
                setMovementItemId('');
                setMovementDirection('giris');
                setRecordAsExpense(false);
                setIsMovementModalOpen(true);
              }}
            >
              Stok Hareketi Ekle
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsNewItemModalOpen(true)}
            >
              Yeni Ürün Ekle
            </Button>
          </div>
        }
      />

      {/* İstatistik Sayaçları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Toplam Stok Değeri</span>
            <Badge color="emerald">Maliyet</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalStockValue, true)}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-soft dark:border-rose-900/30 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Kritik Stok Uyarısı</span>
            <Badge color="rose">{lowStockItems.length}</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300">
            {lowStockItems.length} Kalem
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kayıtlı Ürün Sayısı</span>
            <Badge color="indigo">Kalem</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalItemsCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bu Ayki Depo Hareketleri</span>
            <Badge color="sky">Hareket</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalMonthlyMovements}</p>
        </div>
      </div>

      {/* Görünüm Sekmeleri */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <Tabs
          tabs={[
            { key: 'inventory', label: 'Stok Listesi', count: filteredItems.length },
            { key: 'movements', label: 'Depo Hareket Geçmişi', count: stockMovements.length },
          ]}
          active={activeTab}
          onChange={(k) => setActiveTab(k as 'inventory' | 'movements')}
        />

        {activeTab === 'inventory' && (
          <div className="flex flex-wrap items-center gap-1">
            {INVENTORY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. STOK LİSTESİ TABLOSU */}
      {activeTab === 'inventory' && (
        <DataTable
          columns={inventoryColumns}
          data={filteredItems}
          rowKey={(i) => i.id}
          searchPlaceholder="Ürün adı, kategori veya tedarikçi ara..."
          emptyTitle="Ürün bulunamadı"
          emptyDescription="Seçilen kategoride ürün kartı bulunmuyor."
        />
      )}

      {/* 2. DEPO HAREKET GEÇMİŞİ */}
      {activeTab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={stockMovements}
          rowKey={(m) => m.id}
          searchPlaceholder="Hareketlerde ürün adı veya açıklama ara..."
          emptyTitle="Stok hareketi bulunamadı"
          emptyDescription="Henüz kayıtlı bir depo hareketi yok."
        />
      )}

      {/* STOK GİRİŞ / ÇIKIŞ MODALI */}
      <Modal
        open={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title="Stok Hareketi Kaydet (Giriş / Çıkış)"
        description="Depoya yeni malzeme girişi yapın veya departmanlara malzeme çıkışı verin"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsMovementModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleSaveMovement}>
              Hareketi Onayla
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Malzeme / Ürün Seçimi"
            options={inventoryItems.map((i) => ({
              value: i.id,
              label: `${i.name} (Mevcut: ${i.quantity} ${i.unit} - Min: ${i.minQuantity})`,
            }))}
            value={movementItemId}
            onChange={(e) => setMovementItemId(e.target.value)}
            placeholder="Malzeme seçiniz..."
          />

          {/* Hareket Yönü Butonları */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Hareket Yönü
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMovementDirection('giris')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  movementDirection === 'giris'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                Stok Girişi (+ Ekle)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementDirection('cikis');
                  setRecordAsExpense(false);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  movementDirection === 'cikis'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-300'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-sky-600" />
                Stok Çıkışı (- Düş)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Miktar"
              type="number"
              min={1}
              value={movementQuantity}
              onChange={(e) => setMovementQuantity(e.target.value)}
            />
            <Input
              label="İşlem Tarihi"
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
            />
          </div>

          <Input
            label="Açıklama / Kullanım Yeri"
            placeholder="Örn: 2. Kat kat arabaları dolumu, Mutfak teslimi..."
            value={movementDescription}
            onChange={(e) => setMovementDescription(e.target.value)}
          />

          {/* Girişte Opsiyonel Gider Kaydı */}
          {movementDirection === 'giris' && movementItemId && (
            <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 cursor-pointer dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <input
                type="checkbox"
                checked={recordAsExpense}
                onChange={(e) => setRecordAsExpense(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-emerald-900 dark:text-emerald-300 block">
                  Bu alımı muhasebeye gider olarak işle
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Toplam tutar ({formatCurrency((Number(movementQuantity) || 0) * (itemMap.get(movementItemId)?.unitPrice || 0))}) muhasebe işlemlerine "Malzeme & Tedarik" gideri olarak kaydedilir.
                </span>
              </div>
            </label>
          )}
        </div>
      </Modal>

      {/* YENİ ÜRÜN KARTI MODALI */}
      <Modal
        open={isNewItemModalOpen}
        onClose={() => setIsNewItemModalOpen(false)}
        title="Yeni Stok Kartı Oluştur"
        description="Otel envanterine yeni bir ürün kalemi tanımlayın"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsNewItemModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleCreateNewItem}>
              Ürünü Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Ürün Adı"
            placeholder="Örn: Sıvı El Sabunu (5lt), Buklet Şampuan..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Kategori"
              options={[
                { value: 'Temizlik', label: 'Temizlik' },
                { value: 'Banyo Malzemeleri', label: 'Banyo Malzemeleri' },
                { value: 'Minibar & İçecek', label: 'Minibar & İçecek' },
                { value: 'Mutfak & Gıda', label: 'Mutfak & Gıda' },
                { value: 'Çarşaf & Havlu', label: 'Çarşaf & Havlu' },
                { value: 'Teknik Malzeme', label: 'Teknik Malzeme' },
              ]}
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
            />

            <Select
              label="Ölçü Birimi"
              options={[
                { value: 'adet', label: 'Adet' },
                { value: 'kg', label: 'Kilogram (kg)' },
                { value: 'lt', label: 'Litre (lt)' },
                { value: 'koli', label: 'Koli' },
                { value: 'paket', label: 'Paket' },
                { value: 'rulo', label: 'Rulo' },
                { value: 'takım', label: 'Takım' },
                { value: 'şişe', label: 'Şişe' },
              ]}
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Mevcut Miktar"
              type="number"
              min={0}
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
            />
            <Input
              label="Minimum Kritik Eşik"
              type="number"
              min={0}
              value={newItemMinQuantity}
              onChange={(e) => setNewItemMinQuantity(e.target.value)}
            />
            <Input
              label="Birim Alış Fiyatı (₺)"
              type="number"
              min={0}
              value={newItemUnitPrice}
              onChange={(e) => setNewItemUnitPrice(e.target.value)}
            />
          </div>

          <Select
            label="Varsayılan Tedarikçi"
            options={suppliers.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.category})`,
            }))}
            value={newItemSupplierId}
            onChange={(e) => setNewItemSupplierId(e.target.value)}
            placeholder="Tedarikçi seçiniz..."
          />
        </div>
      </Modal>

      {/* SİPARİŞ LİSTESİ OLUŞTUR (YAZDIRILABİLİR) MODALI */}
      <Modal
        open={isOrderListModalOpen}
        onClose={() => setIsOrderListModalOpen(false)}
        size="lg"
        title="Tedarik & Satın Alma Sipariş Listesi"
        description="Minimum stok seviyesinin altına düşen malzemelerin tedarikçi bazlı sipariş formu"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500 font-medium">
              Tahmini Toplam Sipariş Maliyeti: <strong className="text-slate-900 dark:text-white text-sm">{formatCurrency(totalOrderEstimatedCost)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setIsOrderListModalOpen(false)}>
                Kapat
              </Button>
              <Button
                variant="primary"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => window.print()}
              >
                Yazdır / PDF Kaydet
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 print:p-0">
          {/* Yazdırma Başlığı (Sadece print sırasında veya ekranda temiz antet) */}
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {settings.hotelName} — Satın Alma Talep Formu
                </h3>
                <p className="text-xs text-slate-500">
                  Tarih: {formatDate(today, 'd MMMM yyyy, EEEE')} • İlgili Departman: Satın Alma & Envanter
                </p>
              </div>
              <Badge color="amber">{lowStockItems.length} Kalem Sipariş Önerisi</Badge>
            </div>
          </div>

          {groupedOrdersBySupplier.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Şu an kritik seviyede malzeme bulunmuyor. Tüm stoklar güvende.
            </div>
          ) : (
            groupedOrdersBySupplier.map(({ supplier, items }, idx) => (
              <div
                key={supplier?.id || `supplier-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850"
              >
                {/* Tedarikçi Başlığı */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {supplier?.name || 'Diğer / Tanımsız Tedarikçi'}
                    </span>
                    {supplier?.category && (
                      <Badge color="slate" className="text-[10px]">
                        {supplier.category}
                      </Badge>
                    )}
                  </div>
                  {supplier?.phone && (
                    <span className="text-xs text-slate-500">
                      Tel: {supplier.phone} • Yetkili: {supplier.contact}
                    </span>
                  )}
                </div>

                {/* Ürün Tablosu */}
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left font-semibold text-slate-400 dark:border-slate-800">
                      <th className="py-1.5">Malzeme Adı</th>
                      <th className="py-1.5 text-right">Mevcut</th>
                      <th className="py-1.5 text-right">Kritik Eşik</th>
                      <th className="py-1.5 text-right font-bold text-indigo-600">Önerilen Sipariş</th>
                      <th className="py-1.5 text-right">Birim Fiyat</th>
                      <th className="py-1.5 text-right">Tahmini Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map(({ item, needed, estimatedCost }) => (
                      <tr key={item.id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-2 font-medium text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-2 text-right text-rose-600 font-semibold">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 text-right text-slate-400">
                          {item.minQuantity} {item.unit}
                        </td>
                        <td className="py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          {needed} {item.unit}
                        </td>
                        <td className="py-2 text-right">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                      <td colSpan={5} className="py-2 text-right text-slate-500">
                        Tedarikçi Ara Toplam:
                      </td>
                      <td className="py-2 text-right text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(items.reduce((s, i) => s + i.estimatedCost, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))
          )}

          {/* İmza Alanı (Print için) */}
          <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Talebi Hazırlayan</p>
              <p className="mt-1">Kat Hizmetleri / Depo Sorumlusu</p>
              <div className="mt-10 border-b border-dashed border-slate-300 w-32 mx-auto" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Onaylayan</p>
              <p className="mt-1">Otel Genel Müdürü / Satın Alma Müdürü</p>
              <div className="mt-10 border-b border-dashed border-slate-300 w-32 mx-auto" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
