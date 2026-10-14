import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate, todayStr, daysBetween } from '../../lib/format';
import {
  Button,
  Card,
  Badge,
  DataTable,
  type Column,
  Modal,
  Input,
  DatePicker,
  ConfirmDialog,
  useToast,
} from '../../components/ui';
import type { Season } from '../../types';

const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const SEASON_PALETTE = [
  { bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { bg: 'bg-amber-500', light: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' },
  { bg: 'bg-sky-500', light: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300' },
  { bg: 'bg-rose-500', light: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' },
  { bg: 'bg-violet-500', light: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300' },
];

export function SeasonsTab() {
  const toast = useToast();
  const today = todayStr();
  const currentYear = new Date().getFullYear();

  const seasons = useStore((s) => s.seasons);
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const log = useStore((s) => s.log);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(`${currentYear}-06-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-08-31`);
  const [multiplier, setMultiplier] = useState('1.25');

  // Delete State
  const [deletingSeason, setDeletingSeason] = useState<Season | null>(null);

  const handleOpenCreateModal = () => {
    setEditingSeason(null);
    setName('');
    setStartDate(`${currentYear}-06-01`);
    setEndDate(`${currentYear}-08-31`);
    setMultiplier('1.25');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (season: Season) => {
    setEditingSeason(season);
    setName(season.name);
    setStartDate(season.startDate);
    setEndDate(season.endDate);
    setMultiplier(String(season.multiplier));
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Lütfen sezon adını girin.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }
    const numMult = Number(multiplier);
    if (isNaN(numMult) || numMult <= 0) {
      toast.error('Lütfen geçerli bir çarpan girin (örn: 1.25).');
      return;
    }

    if (editingSeason) {
      update('seasons', editingSeason.id, {
        name: name.trim(),
        startDate,
        endDate,
        multiplier: numMult,
      });
      toast.success('Sezon güncellendi.');
      log(`Sezon güncellendi: ${name.trim()} (x${numMult})`, 'yonetim');
    } else {
      add('seasons', {
        name: name.trim(),
        startDate,
        endDate,
        multiplier: numMult,
      });
      toast.success('Yeni sezon eklendi.');
      log(`Yeni sezon eklendi: ${name.trim()} (x${numMult})`, 'yonetim');
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!deletingSeason) return;
    remove('seasons', deletingSeason.id);
    toast.success('Sezon silindi.');
    log(`Sezon silindi: ${deletingSeason.name}`, 'yonetim');
    setDeletingSeason(null);
  };

  // Yıllık Şerit için Sezon Konumlandırma
  // Yılın 365 günü üzerinden yüzde hesaplama
  const calculateYearPosition = (startStr: string, endStr: string) => {
    const startYear = new Date(`${startStr}T00:00:00`).getFullYear();
    const yearStart = new Date(currentYear, 0, 1).getTime();
    const yearEnd = new Date(currentYear, 11, 31).getTime();
    const totalYearMs = yearEnd - yearStart;

    const sTime = Math.max(yearStart, new Date(`${startStr}T00:00:00`).getTime());
    const eTime = Math.min(yearEnd, new Date(`${endStr}T23:59:59`).getTime());

    if (eTime < yearStart || sTime > yearEnd) {
      return null;
    }

    const leftPercent = Math.max(0, Math.min(100, ((sTime - yearStart) / totalYearMs) * 100));
    const widthPercent = Math.max(2, Math.min(100 - leftPercent, ((eTime - sTime) / totalYearMs) * 100));

    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  // Bugünün Yıllık Şeritteki Konumu
  const todayPositionPercent = useMemo(() => {
    const yearStart = new Date(currentYear, 0, 1).getTime();
    const yearEnd = new Date(currentYear, 11, 31).getTime();
    const nowTime = new Date(`${today}T00:00:00`).getTime();
    const percent = ((nowTime - yearStart) / (yearEnd - yearStart)) * 100;
    return Math.max(0, Math.min(100, percent));
  }, [currentYear, today]);

  // Tablo Kolonları
  const columns: Column<Season>[] = [
    {
      key: 'name',
      header: 'Sezon Adı',
      sortValue: (s) => s.name,
      render: (s) => (
        <span className="font-semibold text-slate-900 dark:text-white block">{s.name}</span>
      ),
    },
    {
      key: 'startDate',
      header: 'Başlangıç',
      sortValue: (s) => s.startDate,
      render: (s) => <span className="text-xs">{formatDate(s.startDate)}</span>,
    },
    {
      key: 'endDate',
      header: 'Bitiş',
      sortValue: (s) => s.endDate,
      render: (s) => <span className="text-xs">{formatDate(s.endDate)}</span>,
    },
    {
      key: 'duration',
      header: 'Süre',
      align: 'right',
      sortValue: (s) => daysBetween(s.startDate, s.endDate) + 1,
      render: (s) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {daysBetween(s.startDate, s.endDate) + 1} Gün
        </span>
      ),
    },
    {
      key: 'multiplier',
      header: 'Fiyat Çarpanı',
      align: 'right',
      sortValue: (s) => s.multiplier,
      render: (s) => {
        const diff = Math.round((s.multiplier - 1) * 100);
        const isUp = s.multiplier >= 1;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              x{s.multiplier.toFixed(2)}
            </span>
            <Badge color={diff > 0 ? 'emerald' : diff < 0 ? 'amber' : 'slate'} className="text-[10px]">
              {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : 'Standart'}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Dönem Durumu',
      render: (s) => {
        const isCurrent = s.startDate <= today && today <= s.endDate;
        const isPast = s.endDate < today;
        return (
          <Badge color={isCurrent ? 'emerald' : isPast ? 'slate' : 'sky'} dot={isCurrent}>
            {isCurrent ? 'Aktif Sezon' : isPast ? 'Geçti' : 'Gelecek Sezon'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'İşlemler',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Düzenle"
            onClick={() => handleOpenEditModal(s)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            title="Sil"
            onClick={() => setDeletingSeason(s)}
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
            Dönemsel Sezonlar ve Fiyat Çarpanları
          </h3>
          <p className="text-xs text-slate-500">
            Yüksek sezon, düşük sezon ve erken rezervasyon dönemleri fiyat takvimine otomatik çarpan olarak yansır.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={handleOpenCreateModal}
        >
          Yeni Sezon Tanımla
        </Button>
      </div>

      {/* YILLIK ŞERİT GÖRÜNÜMÜ (ANNUAL TIMELINE RIBBON) */}
      <Card
        title={`Yıllık Sezon Şeridi (${currentYear})`}
        subtitle="Yıl boyunca tanımlı sezonların zaman eksenindeki dağılımı ve bugünün konumu"
      >
        <div className="space-y-4 pt-2">
          {/* 12 Ay Başlıkları */}
          <div className="grid grid-cols-12 text-center text-[11px] font-semibold text-slate-500 border-b border-slate-200 pb-2 dark:border-slate-800">
            {MONTH_NAMES.map((m, idx) => (
              <div key={idx} className="truncate px-0.5">
                {m.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Şerit Çubuğu Alanı */}
          <div className="relative h-16 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1.5 overflow-hidden">
            {/* Ay Ayırıcı İnce Çizgiler */}
            <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="border-r border-slate-200/60 dark:border-slate-700/40 h-full last:border-r-0"
                />
              ))}
            </div>

            {/* Sezon Blokları */}
            {seasons.map((season, idx) => {
              const pos = calculateYearPosition(season.startDate, season.endDate);
              if (!pos) return null;
              const palette = SEASON_PALETTE[idx % SEASON_PALETTE.length];

              return (
                <div
                  key={season.id}
                  style={{ left: pos.left, width: pos.width }}
                  className={`absolute top-1.5 bottom-1.5 rounded-xl border flex flex-col justify-center px-2.5 transition shadow-sm overflow-hidden z-10 cursor-pointer hover:ring-2 hover:ring-indigo-400 ${palette.light}`}
                  onClick={() => handleOpenEditModal(season)}
                  title={`${season.name} (${formatDate(season.startDate)} - ${formatDate(season.endDate)}) • Çarpan: x${season.multiplier}`}
                >
                  <span className="truncate font-bold text-xs">{season.name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] opacity-80 truncate">
                    <span className="font-semibold">x{season.multiplier}</span>
                    <span>•</span>
                    <span>{formatDate(season.startDate, 'd MMM')} - {formatDate(season.endDate, 'd MMM')}</span>
                  </div>
                </div>
              );
            })}

            {/* Bugün Göstergesi (Kırmızı Çizgi) */}
            <div
              style={{ left: `${todayPositionPercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none shadow"
            >
              <div className="absolute -top-1 -translate-x-1/2 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-sm shadow-sm">
                Bugün
              </div>
            </div>
          </div>

          {/* Bilgilendirme ve Renk Açıklamaları */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-indigo-500" />
              <span>Sezon çubuklarına tıklayarak doğrudan düzenleme yapabilirsiniz.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              <span>Kırmızı çizgi bugünün tarihini ({formatDate(today, 'd MMMM')}) gösterir.</span>
            </div>
          </div>
        </div>
      </Card>

      {/* SEZONLAR TABLOSU */}
      <DataTable
        columns={columns}
        data={seasons}
        rowKey={(s) => s.id}
        searchPlaceholder="Sezon adı ara..."
        emptyTitle="Sezon bulunamadı"
        emptyDescription="Henüz tanımlanmış bir sezon bulunmuyor."
      />

      {/* EKLE / DÜZENLE MODALI */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeason ? 'Sezonu Düzenle' : 'Yeni Sezon Tanımla'}
        description="Dönemin başlangıç, bitiş tarihlerini ve baz fiyata uygulanacak çarpanı belirleyin."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingSeason ? 'Güncelle' : 'Sezonu Kaydet'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Sezon Adı"
            placeholder="Örn: Yaz Yüksek Sezonu, Bayram Dönemi, Erken Rezervasyon..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Başlangıç Tarihi"
              value={startDate}
              onChange={(v) => setStartDate(v)}
            />
            <DatePicker
              label="Bitiş Tarihi"
              value={endDate}
              onChange={(v) => setEndDate(v)}
            />
          </div>

          <div>
            <Input
              label="Fiyat Çarpanı (Örn: 1.35 = %35 Artış, 0.85 = %15 İndirim)"
              type="number"
              step="0.05"
              min="0.1"
              max="5"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              {Number(multiplier) > 1
                ? `Bu sezonda oda fiyatları normal baz fiyatın %${Math.round((Number(multiplier) - 1) * 100)} fazlası olarak hesaplanır.`
                : Number(multiplier) < 1
                ? `Bu sezonda oda fiyatlarına %${Math.round((1 - Number(multiplier)) * 100)} indirim uygulanır.`
                : 'Fiyatlar standart baz fiyat üzerinden uygulanır.'}
            </p>
          </div>
        </div>
      </Modal>

      {/* SİLME ONAY DİYALOĞU */}
      <ConfirmDialog
        open={Boolean(deletingSeason)}
        onClose={() => setDeletingSeason(null)}
        onConfirm={handleDelete}
        title="Sezonu Sil"
        message={`"${deletingSeason?.name}" sezonunu silmek istediğinize emin misiniz? Fiyat takvimi normale dönecektir.`}
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
      />
    </div>
  );
}
