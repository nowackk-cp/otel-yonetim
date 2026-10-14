import { describe, expect, it } from 'vitest';
import {
  calculate30DaysPrices,
  calculateChannelPerformances,
  getSeasonForDate,
  isWeekend,
  resolveReservationChannel,
} from './ratesHelpers';
import type { Channel, Reservation, Season } from '../../types';

describe('ratesHelpers unit tests', () => {
  const dummySeasons: Season[] = [
    {
      id: 's-winter',
      name: 'Kış Sezonu',
      startDate: '2026-01-01',
      endDate: '2026-04-30',
      multiplier: 0.8,
    },
    {
      id: 's-summer',
      name: 'Yaz Sezonu',
      startDate: '2026-06-01',
      endDate: '2026-09-30',
      multiplier: 1.5,
    },
  ];

  it('tarihe göre doğru sezonu ve çarpanı bulur', () => {
    const summer = getSeasonForDate('2026-07-15', dummySeasons);
    expect(summer?.name).toBe('Yaz Sezonu');
    expect(summer?.multiplier).toBe(1.5);

    const winter = getSeasonForDate('2026-02-10', dummySeasons);
    expect(winter?.name).toBe('Kış Sezonu');
    expect(winter?.multiplier).toBe(0.8);

    const offSeason = getSeasonForDate('2026-05-15', dummySeasons);
    expect(offSeason).toBeNull();
  });

  it('hafta sonu kontrolü doğru çalışır', () => {
    // 2026-10-16 Cuma
    expect(isWeekend('2026-10-16')).toBe(true);
    // 2026-10-17 Cumartesi
    expect(isWeekend('2026-10-17')).toBe(true);
    // 2026-10-18 Pazar
    expect(isWeekend('2026-10-18')).toBe(true);
    // 2026-10-19 Pazartesi
    expect(isWeekend('2026-10-19')).toBe(false);
  });

  it('30 günlük fiyat takvimini baz fiyat x sezon çarpanı ile hesaplar', () => {
    const days = calculate30DaysPrices('2026-07-01', 2000, dummySeasons);
    expect(days).toHaveLength(30);
    expect(days[0].finalPrice).toBe(3000); // 2000 * 1.5
    expect(days[0].seasonName).toBe('Yaz Sezonu');
  });

  it('kanalı olmayan veya walk_in olan rezervasyonları Direkt sayar', () => {
    const channels: Channel[] = [
      { id: 'ch-direct', name: 'Direkt Satış', type: 'direkt', commissionRate: 0, active: true },
      { id: 'ch-bkg', name: 'Booking.com', type: 'booking', commissionRate: 15, active: true },
    ];

    const resNoChannel: Reservation = {
      id: 'res-1',
      guestId: 'g-1',
      roomId: 'r-1',
      checkIn: '2026-10-15',
      checkOut: '2026-10-18',
      adults: 2,
      children: 0,
      status: 'onayli',
      channel: 'walk_in',
      board: 'oda_kahvalti',
      nightlyRate: 3000,
      notes: '',
      createdAt: new Date().toISOString(),
    };

    const resolved = resolveReservationChannel(resNoChannel, channels);
    expect(resolved.type).toBe('direkt');
    expect(resolved.name).toBe('Direkt Satış');
  });

  it('kanal komisyon ve net gelir hesaplamalarını doğru yapar', () => {
    const channels: Channel[] = [
      { id: 'ch-bkg', name: 'Booking.com', type: 'booking', commissionRate: 15, active: true },
      { id: 'ch-dir', name: 'Direkt', type: 'direkt', commissionRate: 0, active: true },
    ];

    const reservations: Reservation[] = [
      {
        id: 'res-1',
        guestId: 'g-1',
        roomId: 'r-1',
        checkIn: '2026-10-15',
        checkOut: '2026-10-17', // 2 gece
        adults: 2,
        children: 0,
        status: 'onayli',
        channel: 'booking',
        board: 'oda_kahvalti',
        nightlyRate: 1000, // toplam 2000 TL
        notes: '',
        createdAt: new Date().toISOString(),
      },
    ];

    const perfs = calculateChannelPerformances(reservations, channels);
    const bkgPerf = perfs.find((p) => p.channel.type === 'booking');
    expect(bkgPerf).toBeDefined();
    expect(bkgPerf?.reservationCount).toBe(1);
    expect(bkgPerf?.grossRevenue).toBe(2000);
    expect(bkgPerf?.commissionAmount).toBe(300); // 2000 * 0.15
    expect(bkgPerf?.netRevenue).toBe(1700);
  });
});
