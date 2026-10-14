import { useMemo, useState } from 'react';
import { Calendar, TrendingUp, Sparkles, BedDouble, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatDate, todayStr } from '../../lib/format';
import { Card, Badge, Select, StatCard } from '../../components/ui';
import type { BoardType, RoomType } from '../../types';
import { BOARD_LABELS, BOARD_EXTRAS, calculate30DaysPrices } from './ratesHelpers';

export function RateCalendarTab() {
  const today = todayStr();
  const roomTypes = useStore((s) => s.roomTypes);
  const seasons = useStore((s) => s.seasons);
  const ratePlans = useStore((s) => s.ratePlans);

  // Seçili Oda Tipi ve Pansiyon Tipi
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(
    () => roomTypes[0]?.id || '',
  );
  const [selectedBoard, setSelectedBoard] = useState<BoardType>('oda_kahvalti');

  const selectedRoomType = useMemo(
    () => roomTypes.find((rt) => rt.id === selectedRoomTypeId) || roomTypes[0],
    [roomTypes, selectedRoomTypeId],
  );

  // Baz Fiyat Hesaplama:
  // Eğer bu oda tipi ve pansiyon için tanımlı aktif bir RatePlan varsa onun fiyatı,
  // yoksa roomType.basePrice + boardExtra.
  const effectiveBasePrice = useMemo(() => {
    if (!selectedRoomType) return 0;
    const plan = ratePlans.find(
      (p) => p.roomTypeId === selectedRoomType.id && p.board === selectedBoard && p.active,
    );
    if (plan) return plan.price;
    return selectedRoomType.basePrice + (BOARD_EXTRAS[selectedBoard] || 0);
  }, [selectedRoomType, selectedBoard, ratePlans]);

  // Önümüzdeki 30 Günün Fiyat Listesi
  const calendarDays = useMemo(() => {
    return calculate30DaysPrices(today, effectiveBasePrice, seasons);
  }, [today, effectiveBasePrice, seasons]);

  // Metrikler
  const averagePrice = useMemo(() => {
    if (calendarDays.length === 0) return 0;
    const total = calendarDays.reduce((sum, d) => sum + d.finalPrice, 0);
    return Math.round(total / calendarDays.length);
  }, [calendarDays]);

  const minDay = useMemo(() => {
    if (calendarDays.length === 0) return null;
    return calendarDays.reduce((prev, curr) => (curr.finalPrice < prev.finalPrice ? curr : prev));
  }, [calendarDays]);

  const maxDay = useMemo(() => {
    if (calendarDays.length === 0) return null;
    return calendarDays.reduce((prev, curr) => (curr.finalPrice > prev.finalPrice ? curr : prev));
  }, [calendarDays]);

  return (
    <div className="space-y-6">
      {/* Üst Bar: Oda Tipi ve Pansiyon Seçimi */}
      <Card padded={false} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              30 Günlük Dinamik Fiyat Takvimi
            </h3>
            <p className="text-xs text-slate-500">
              Günlük fiyat = Baz Fiyat × İlgili Tarihteki Sezon Çarpanı. Hafta sonu günleri özel olarak vurgulanmıştır.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Select
                label="Oda Tipi"
                options={roomTypes.map((rt) => ({
                  value: rt.id,
                  label: `${rt.name} (${formatCurrency(rt.basePrice)})`,
                }))}
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
              />
            </div>

            <div className="w-48">
              <Select
                label="Pansiyon Tipi"
                options={(Object.keys(BOARD_LABELS) as BoardType[]).map((b) => ({
                  value: b,
                  label: BOARD_LABELS[b],
                }))}
                value={selectedBoard}
                onChange={(e) => setSelectedBoard(e.target.value as BoardType)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Mini İstatistik Kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Uygulanan Baz Fiyat"
          value={formatCurrency(effectiveBasePrice)}
          icon={<BedDouble className="h-5 w-5" />}
          tone="indigo"
          changeLabel="Sezon çarpanı öncesi"
        />
        <StatCard
          title="30 Günlük Ortalama Fiyat"
          value={formatCurrency(averagePrice)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="En Düşük Fiyat"
          value={minDay ? formatCurrency(minDay.finalPrice) : '-'}
          icon={<Sparkles className="h-5 w-5" />}
          tone="sky"
          changeLabel={minDay ? formatDate(minDay.date, 'd MMM') : ''}
        />
        <StatCard
          title="En Yüksek Fiyat"
          value={maxDay ? formatCurrency(maxDay.finalPrice) : '-'}
          icon={<Sparkles className="h-5 w-5" />}
          tone="amber"
          changeLabel={maxDay ? formatDate(maxDay.date, 'd MMM') : ''}
        />
      </div>

      {/* 30 Günlük Takvim Izgarası */}
      <Card
        title={`${selectedRoomType?.name} • ${BOARD_LABELS[selectedBoard]} Fiyat Tablosu`}
        subtitle={`${formatDate(today, 'd MMMM yyyy')} - ${formatDate(calendarDays[calendarDays.length - 1]?.date || today, 'd MMMM yyyy')} tarihleri arası`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 pt-2">
          {calendarDays.map((day) => {
            const isToday = day.date === today;
            const diffPercent = Math.round((day.multiplier - 1) * 100);

            return (
              <div
                key={day.date}
                className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition shadow-sm ${
                  isToday
                    ? 'ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20'
                    : day.isWeekend
                    ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
                    : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-850'
                }`}
              >
                {/* Üst Kısım: Tarih ve Hafta Sonu Vurgusu */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white block">
                      {formatDate(day.date, 'd MMM')}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {day.dayName}
                    </span>
                  </div>

                  {day.isWeekend ? (
                    <Badge color="amber" className="text-[10px] px-1.5 py-0 font-bold">
                      Hafta Sonu
                    </Badge>
                  ) : isToday ? (
                    <Badge color="indigo" className="text-[10px] px-1.5 py-0 font-bold">
                      Bugün
                    </Badge>
                  ) : null}
                </div>

                {/* Orta Kısım: Sezon ve Çarpan Bilgisi */}
                <div className="my-2.5">
                  <div className="text-[11px] text-slate-500 truncate" title={day.seasonName || 'Standart Sezon'}>
                    {day.seasonName || 'Standart Sezon'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      x{day.multiplier.toFixed(2)}
                    </span>
                    {diffPercent !== 0 && (
                      <span
                        className={`text-[10px] font-bold ${
                          diffPercent > 0 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        ({diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`})
                      </span>
                    )}
                  </div>
                </div>

                {/* Alt Kısım: Nihai Gecelik Fiyat */}
                <div className="border-t border-slate-100 pt-2 dark:border-slate-800 text-right">
                  <span className="block text-[10px] text-slate-400">Gecelik</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formatCurrency(day.finalPrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
