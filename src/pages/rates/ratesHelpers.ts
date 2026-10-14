import type { BoardType, Channel, RatePlan, Reservation, RoomType, Season } from '../../types';
import { addDaysStr, daysBetween, todayStr } from '../../lib/format';
import { reservationTotal } from '../../lib/calc';

export const BOARD_LABELS: Record<BoardType, string> = {
  sadece_oda: 'Sadece Oda',
  oda_kahvalti: 'Oda + Kahvaltı',
  yarim: 'Yarım Pansiyon',
  tam: 'Tam Pansiyon',
  her_sey_dahil: 'Her Şey Dahil',
};

export const BOARD_EXTRAS: Record<BoardType, number> = {
  sadece_oda: 0,
  oda_kahvalti: 250,
  yarim: 650,
  tam: 1000,
  her_sey_dahil: 1600,
};

export const CHANNEL_TYPE_LABELS: Record<Channel['type'], string> = {
  booking: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  direkt: 'Direkt Satış',
  telefon: 'Telefon ile Rezervasyon',
  acente: 'Turizm Acentesi',
};

/**
 * Verilen bir tarih ('YYYY-MM-DD') için geçerli olan sezonu döner.
 * Eğer birden fazla sezon çakışıyorsa son tanımlanan önceliklidir.
 */
export function getSeasonForDate(dateStr: string, seasons: Season[]): Season | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const s = seasons[i];
    if (s.startDate <= dateStr && dateStr <= s.endDate) {
      return s;
    }
  }
  return null;
}

/**
 * Belirli bir tarih hafta sonu mu? (Cuma, Cumartesi veya Pazar)
 * Otelcilikte genellikle Cuma ve Cumartesi geceleri hafta sonu tarifesi kabul edilir.
 */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Pazar, 5 = Cuma, 6 = Cumartesi
  return day === 5 || day === 6 || day === 0;
}

/**
 * 30 günlük fiyat takvimi gün verisi
 */
export interface DayPriceInfo {
  date: string;
  dayOfMonth: number;
  dayName: string;
  isWeekend: boolean;
  basePrice: number;
  multiplier: number;
  finalPrice: number;
  seasonName: string | null;
}

export function calculate30DaysPrices(
  startDate: string,
  basePrice: number,
  seasons: Season[],
): DayPriceInfo[] {
  const result: DayPriceInfo[] = [];
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts'];

  for (let i = 0; i < 30; i++) {
    const dStr = addDaysStr(startDate, i);
    const dObj = new Date(`${dStr}T00:00:00`);
    const dayOfWeek = dObj.getDay();
    const weekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
    const season = getSeasonForDate(dStr, seasons);
    const multiplier = season ? season.multiplier : 1.0;
    const finalPrice = Math.round(basePrice * multiplier);

    result.push({
      date: dStr,
      dayOfMonth: dObj.getDate(),
      dayName: dayNames[dayOfWeek],
      isWeekend: weekend,
      basePrice,
      multiplier,
      finalPrice,
      seasonName: season ? season.name : null,
    });
  }

  return result;
}

/**
 * Rezervasyonun ait olduğu kanalı belirler.
 * Kural: Kanalı olmayan veya eşleşmeyen rezervasyonları 'Direkt' say.
 */
export function resolveReservationChannel(
  reservation: Reservation,
  channels: Channel[],
): Channel {
  // 1. Doğrudan channelId ile eşleşme
  if (reservation.channelId) {
    const found = channels.find((c) => c.id === reservation.channelId);
    if (found) return found;
  }

  // 2. reservation.channel tipine göre eşleşme
  if (reservation.channel) {
    const targetType = reservation.channel === 'walk_in' ? 'direkt' : reservation.channel;
    const found = channels.find((c) => c.type === targetType);
    if (found) return found;
  }

  // 3. Bulunamazsa 'direkt' tipindeki kanal veya sanal direkt kanal
  const defaultDirect = channels.find((c) => c.type === 'direkt');
  if (defaultDirect) return defaultDirect;

  return {
    id: 'virtual-direct',
    name: 'Direkt Satış',
    type: 'direkt',
    commissionRate: 0,
    active: true,
  };
}

export interface ChannelPerformance {
  channel: Channel;
  reservationCount: number;
  grossRevenue: number;
  commissionAmount: number;
  netRevenue: number;
}

/**
 * Kanal bazlı rezervasyon sayısı, brüt ciro, komisyon tutarı ve net gelir hesaplar.
 */
export function calculateChannelPerformances(
  reservations: Reservation[],
  channels: Channel[],
): ChannelPerformance[] {
  // Kanalları performans haritasına al
  const perfMap = new Map<string, ChannelPerformance>();

  channels.forEach((ch) => {
    perfMap.set(ch.id, {
      channel: ch,
      reservationCount: 0,
      grossRevenue: 0,
      commissionAmount: 0,
      netRevenue: 0,
    });
  });

  // İptal ve no-show olmayan rezervasyonlar üzerinden ciro hesapla
  const validReservations = reservations.filter(
    (r) => r.status !== 'iptal' && r.status !== 'no_show',
  );

  validReservations.forEach((r) => {
    const resolved = resolveReservationChannel(r, channels);
    let perf = perfMap.get(resolved.id);
    if (!perf) {
      perf = {
        channel: resolved,
        reservationCount: 0,
        grossRevenue: 0,
        commissionAmount: 0,
        netRevenue: 0,
      };
      perfMap.set(resolved.id, perf);
    }

    const rev = reservationTotal(r);
    perf.reservationCount += 1;
    perf.grossRevenue += rev;
  });

  // Komisyon ve net gelir hesapla
  const list = Array.from(perfMap.values()).map((p) => {
    const commission = Math.round((p.grossRevenue * p.channel.commissionRate) / 100);
    const net = p.grossRevenue - commission;
    return {
      ...p,
      commissionAmount: commission,
      netRevenue: net,
    };
  });

  return list;
}
