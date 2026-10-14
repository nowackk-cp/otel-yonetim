import { useMemo, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Percent,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  CreditCard,
  Building,
  Users,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatPercent } from '../../lib/format';
import {
  Button,
  Card,
  Badge,
  DataTable,
  type Column,
  Modal,
  Input,
  Select,
  ConfirmDialog,
  StatCard,
  useToast,
} from '../../components/ui';
import type { Channel } from '../../types';
import {
  CHANNEL_TYPE_LABELS,
  calculateChannelPerformances,
  type ChannelPerformance,
} from './ratesHelpers';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#64748b'];

export function ChannelsTab() {
  const toast = useToast();
  const channels = useStore((s) => s.channels);
  const reservations = useStore((s) => s.reservations);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<Channel['type']>('booking');
  const [commissionRate, setCommissionRate] = useState('15');
  const [active, setActive] = useState(true);

  // Delete State
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null);

  // Kanal Performans Hesaplaması (Kanalı olmayanlar 'Direkt' sayılır)
  const channelPerformances = useMemo(() => {
    return calculateChannelPerformances(reservations, channels);
  }, [reservations, channels]);

  // Genel Toplamlar
  const totals = useMemo(() => {
    return channelPerformances.reduce(
      (acc, curr) => ({
        count: acc.count + curr.reservationCount,
        gross: acc.gross + curr.grossRevenue,
        commission: acc.commission + curr.commissionAmount,
        net: acc.net + curr.netRevenue,
      }),
      { count: 0, gross: 0, commission: 0, net: 0 },
    );
  }, [channelPerformances]);

  // Pasta Grafik Verisi (Brüt Ciro Payları)
  const pieChartData = useMemo(() => {
    return channelPerformances
      .filter((p) => p.grossRevenue > 0)
      .map((p, idx) => ({
        name: p.channel.name,
        value: p.grossRevenue,
        reservations: p.reservationCount,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [channelPerformances]);

  // CRUD İşlemleri
  const handleOpenCreateModal = () => {
    setEditingChannel(null);
    setName('');
    setType('booking');
    setCommissionRate('15');
    setActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ch: Channel) => {
    setEditingChannel(ch);
    setName(ch.name);
    setType(ch.type);
    setCommissionRate(String(ch.commissionRate));
    setActive(ch.active);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Lütfen kanal adını girin.');
      return;
    }
    const numComm = Number(commissionRate);
    if (isNaN(numComm) || numComm < 0 || numComm > 100) {
      toast.error('Komisyon oranı %0 ile %100 arasında olmalıdır.');
      return;
    }

    if (editingChannel) {
      update('channels', editingChannel.id, {
        name: name.trim(),
        type,
        commissionRate: numComm,
        active,
      });
      toast.success('Satış kanalı güncellendi.');
      log(`Satış kanalı güncellendi: ${name.trim()}`, 'yonetim');
    } else {
      add('channels', {
        name: name.trim(),
        type,
        commissionRate: numComm,
        active,
      });
      toast.success('Yeni satış kanalı eklendi.');
      log(`Yeni satış kanalı eklendi: ${name.trim()}`, 'yonetim');
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!deletingChannel) return;
    remove('channels', deletingChannel.id);
    toast.success('Satış kanalı silindi.');
    log(`Satış kanalı silindi: ${deletingChannel.name}`, 'yonetim');
    setDeletingChannel(null);
  };

  // Tablo Kolonları
  const columns: Column<ChannelPerformance>[] = [
    {
      key: 'name',
      header: 'Kanal Adı',
      sortValue: (p) => p.channel.name,
      render: (p) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">
            {p.channel.name}
          </span>
          <span className="text-xs text-slate-500">
            {CHANNEL_TYPE_LABELS[p.channel.type] || p.channel.type}
          </span>
        </div>
      ),
    },
    {
      key: 'commissionRate',
      header: 'Komisyon',
      align: 'right',
      sortValue: (p) => p.channel.commissionRate,
      render: (p) => (
        <span className="font-medium text-xs">
          %{p.channel.commissionRate}
        </span>
      ),
    },
    {
      key: 'reservationCount',
      header: 'Rezervasyon',
      align: 'right',
      sortValue: (p) => p.reservationCount,
      render: (p) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {p.reservationCount} Adet
        </span>
      ),
    },
    {
      key: 'grossRevenue',
      header: 'Brüt Ciro',
      align: 'right',
      sortValue: (p) => p.grossRevenue,
      render: (p) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {formatCurrency(p.grossRevenue)}
        </span>
      ),
    },
    {
      key: 'commissionAmount',
      header: 'Komisyon Tutarı',
      align: 'right',
      sortValue: (p) => p.commissionAmount,
      render: (p) => (
        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
          −{formatCurrency(p.commissionAmount)}
        </span>
      ),
    },
    {
      key: 'netRevenue',
      header: 'Net Gelir',
      align: 'right',
      sortValue: (p) => p.netRevenue,
      render: (p) => (
        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(p.netRevenue)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (p) => (
        <Badge color={p.channel.active ? 'emerald' : 'slate'} dot={p.channel.active}>
          {p.channel.active ? 'Aktif' : 'Pasif'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'İşlem',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Düzenle"
            onClick={() => handleOpenEditModal(p.channel)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            title="Sil"
            onClick={() => setDeletingChannel(p.channel)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Üst Kısım: Başlık ve Ekleme */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Online & Offline Satış Kanalları
          </h3>
          <p className="text-xs text-slate-500">
            OTA acenteleri, direkt kanallar, komisyon oranları ve net kârlılık analizi.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={handleOpenCreateModal}
        >
          Yeni Satış Kanalı
        </Button>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Toplam Rezervasyon"
          value={`${totals.count} Adet`}
          icon={<Users className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          title="Brüt Satış Cirosu"
          value={formatCurrency(totals.gross, true)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="Toplam OTA Komisyonu"
          value={formatCurrency(totals.commission, true)}
          icon={<Percent className="h-5 w-5" />}
          tone="rose"
          changeLabel={`Toplam cironun %${totals.gross ? Math.round((totals.commission / totals.gross) * 100) : 0}'i`}
        />
        <StatCard
          title="Otele Kalan Net Gelir"
          value={formatCurrency(totals.net, true)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      {/* Grafik ve Analiz Alanı */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recharts Pasta Grafik (1 Kolon) */}
        <Card
          title="Kanal Ciro Payı"
          subtitle="Satış kanallarının toplam brüt cirodaki oransal dağılımı"
        >
          <div className="h-64 w-full">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [
                      `${formatCurrency(val)} (%${totals.gross ? Math.round((val / totals.gross) * 100) : 0})`,
                      'Brüt Ciro',
                    ]}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Grafik için ciro verisi bulunamadı
              </div>
            )}
          </div>
        </Card>

        {/* Kanal Performans Tablosu (2 Kolon) */}
        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={channelPerformances}
            rowKey={(p) => p.channel.id}
            searchPlaceholder="Kanal adı veya tip ara..."
            emptyTitle="Kanal bulunamadı"
            emptyDescription="Kayıtlı satış kanalı yok."
          />
        </div>
      </div>

      {/* EKLE / DÜZENLE MODALI */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChannel ? 'Satış Kanalını Düzenle' : 'Yeni Satış Kanalı Ekle'}
        description="Rezervasyon kaynağını ve otele uygulanacak komisyon yüzdesini belirleyin."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingChannel ? 'Güncelle' : 'Kanalı Kaydet'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Kanal Adı"
            placeholder="Örn: Booking.com, Airbnb, Tatilbudur Acente..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Kanal Türü"
              options={[
                { value: 'booking', label: 'Booking.com' },
                { value: 'expedia', label: 'Expedia' },
                { value: 'airbnb', label: 'Airbnb' },
                { value: 'acente', label: 'Turizm Acentesi' },
                { value: 'direkt', label: 'Direkt Satış' },
                { value: 'telefon', label: 'Telefon Satışı' },
              ]}
              value={type}
              onChange={(e) => {
                const newType = e.target.value as Channel['type'];
                setType(newType);
                if (newType === 'direkt' || newType === 'telefon') {
                  setCommissionRate('0');
                } else if (newType === 'booking') {
                  setCommissionRate('15');
                } else if (newType === 'expedia') {
                  setCommissionRate('18');
                } else if (newType === 'airbnb') {
                  setCommissionRate('14');
                } else if (newType === 'acente') {
                  setCommissionRate('12');
                }
              }}
            />

            <Input
              label="Komisyon Oranı (%)"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bu satış kanalı aktif ve rezervasyon girişine açık
            </span>
          </label>
        </div>
      </Modal>

      {/* SİLME ONAY DİYALOĞU */}
      <ConfirmDialog
        open={Boolean(deletingChannel)}
        onClose={() => setDeletingChannel(null)}
        onConfirm={handleDelete}
        title="Satış Kanalını Sil"
        message={`"${deletingChannel?.name}" satış kanalını silmek istediğinize emin misiniz?`}
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
      />
    </div>
  );
}
