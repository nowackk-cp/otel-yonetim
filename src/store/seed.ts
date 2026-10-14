import type {
  Settings, RoomType, Room, Guest, Reservation, FolioItem, Payment, Transaction, Invoice, Employee, Shift,
  ShiftTemplate, Attendance, LeaveRequest, PayrollRecord, HousekeepingTask, MaintenanceTicket, InventoryItem,
  StockMovement, Supplier, Task, ActivityLog, RoomStatus, ReservationChannel, BoardType, Department, ShiftType,
  FolioType, PaymentMethod, CashSession, CashMovement, NightAudit, PosOutlet, MenuItem, PosOrder, RatePlan, Season, Channel, GuestFeedback, LostItem,
} from '../types';
import { addDaysStr, todayStr, toDateStr, daysBetween, minutesToTime, timeToMinutes } from '../lib/format';
import { roomRevenueBetween, splitVat, round2, shiftGrossMinutes } from '../lib/calc';
import { calculatePayroll, minimumWageBaseBeforePeriod, type PayrollSettings } from '../lib/payroll';
import { addDays, startOfWeek, format, parseISO } from 'date-fns';
import { calculateCashSessionBalance, calculateNightAuditMetrics, calculatePosOrderTotal } from './moduleHelpers';

export interface SeedData {
  settings: Settings;
  roomTypes: RoomType[];
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  folioItems: FolioItem[];
  payments: Payment[];
  transactions: Transaction[];
  invoices: Invoice[];
  employees: Employee[];
  shifts: Shift[];
  shiftTemplates: ShiftTemplate[];
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  payrolls: PayrollRecord[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceTickets: MaintenanceTicket[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  tasks: Task[];
  activityLogs: ActivityLog[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  nightAudits: NightAudit[];
  posOutlets: PosOutlet[];
  menuItems: MenuItem[];
  posOrders: PosOrder[];
  ratePlans: RatePlan[];
  seasons: Season[];
  channels: Channel[];
  guestFeedbacks: GuestFeedback[];
  lostItems: LostItem[];
}

export const defaultSettings = (): PayrollSettings => ({
  hotelName: 'Grand Mavi Otel',
  address: 'Atatürk Bulvarı No:42, Muratpaşa / Antalya',
  phone: '+90 242 555 01 01',
  email: 'info@grandmavi.example',
  taxNo: '1234567890',
  taxOffice: 'Muratpaşa V.D.',
  currency: 'TRY',
  vatAccommodation: 10,
  vatFood: 10,
  vatAlcohol: 20,
  vatGeneral: 20,
  accommodationTax: 2,
  corporateTaxRate: 0.25,
  taxDeadlineDay: 28,
  withholdingDeadlineDay: 26,
  accommodationDeadlineDay: 26,
  // 2026: ÇSGB asgari ücret tablosu; GİB 332 seri no.lu ücret tarifesi.
  minWageGross: 33030,
  sgkEmployee: 14,
  unemploymentEmployee: 1,
  // Diğer sektörler (otel): 2026 iki puan indirimli %19,75; indirimsiz %21,75.
  sgkEmployer: 19.75,
  sgkCeilingMultiplier: 9,
  unemploymentEmployer: 2,
  stampTax: 0.00759,
  incomeTaxBrackets: [
    { upTo: 190000, rate: 15 },
    { upTo: 400000, rate: 20 },
    { upTo: 1500000, rate: 27 },
    { upTo: 5300000, rate: 35 },
    { upTo: null, rate: 40 },
  ],
  checkInTime: '14:00',
  checkOutTime: '12:00',
  totalFloors: 4,
});

// Deterministik rastgele (her sıfırlamada aynı yapı, tarihler bugüne göre kayar)
function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

function weighted<T>(rng: ReturnType<typeof makeRng>, items: [T, number][]): T {
  const total = items.reduce((s, i) => s + i[1], 0);
  let r = rng.next() * total;
  for (const [v, w] of items) {
    if ((r -= w) <= 0) return v;
  }
  return items[items.length - 1][0];
}

export function createSeed(): SeedData {
  const rng = makeRng(20261014);
  const today = todayStr();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;
  const settings = defaultSettings();

  // ---------- Oda tipleri ----------
  const roomTypes: RoomType[] = [
    { id: 'rt-std', name: 'Standart', capacity: 2, basePrice: 2200, description: '22 m², çift kişilik yatak, şehir manzarası' },
    { id: 'rt-dlx', name: 'Deluxe', capacity: 3, basePrice: 3200, description: '30 m², balkonlu, deniz manzaralı' },
    { id: 'rt-aile', name: 'Aile', capacity: 4, basePrice: 4200, description: '42 m², iki yatak odalı, oturma alanı' },
    { id: 'rt-suit', name: 'Suit', capacity: 4, basePrice: 6000, description: '55 m², salon, jakuzi, geniş teras' },
    { id: 'rt-kral', name: 'Kral Dairesi', capacity: 4, basePrice: 12000, description: '120 m², özel teras, jakuzi, butler hizmeti' },
  ];
  const typeById = Object.fromEntries(roomTypes.map((t) => [t.id, t]));

  // ---------- Odalar ----------
  const layout: Record<number, string[]> = {
    1: ['rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-aile', 'rt-aile', 'rt-aile'],
    2: ['rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-std', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-aile', 'rt-aile'],
    3: ['rt-std', 'rt-std', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-suit', 'rt-suit'],
    4: ['rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-dlx', 'rt-suit', 'rt-suit', 'rt-suit', 'rt-suit', 'rt-kral'],
  };
  const featuresFor = (typeId: string, floor: number): string[] => {
    const f = ['Klima', 'Wi-Fi', 'TV', 'Minibar'];
    if (typeId !== 'rt-std') f.push('Balkon');
    if (floor >= 3) f.push('Deniz Manzarası');
    if (typeId === 'rt-suit' || typeId === 'rt-kral') f.push('Jakuzi', 'Kasa');
    if (typeId === 'rt-aile') f.push('Çocuk Yatağı');
    return f;
  };
  const outOfOrder: Record<string, RoomStatus> = { '208': 'bakimda', '307': 'bakimda', '405': 'bloke' };
  const rooms: Room[] = [];
  for (let floor = 1; floor <= 4; floor++) {
    layout[floor].forEach((typeId, i) => {
      const no = `${floor}${String(i + 1).padStart(2, '0')}`;
      rooms.push({ id: `room-${no}`, no, floor, typeId, status: 'bos', features: featuresFor(typeId, floor), notes: '' });
    });
  }

  // ---------- Misafirler ----------
  const guestSrc: [string, string][] = [
    ['Ahmet Yılmaz', 'Türkiye'], ['Ayşe Demir', 'Türkiye'], ['Mehmet Kaya', 'Türkiye'], ['Fatma Çelik', 'Türkiye'],
    ['Mustafa Şahin', 'Türkiye'], ['Zeynep Arslan', 'Türkiye'], ['Emre Koç', 'Türkiye'], ['Elif Aydın', 'Türkiye'],
    ['Burak Öztürk', 'Türkiye'], ['Selin Yıldız', 'Türkiye'], ['Can Polat', 'Türkiye'], ['Deniz Aksoy', 'Türkiye'],
    ['Hakan Erdoğan', 'Türkiye'], ['Gül Kılıç', 'Türkiye'], ['Murat Güneş', 'Türkiye'], ['Esra Kurt', 'Türkiye'],
    ['Oğuz Tan', 'Türkiye'], ['Büşra Çetin', 'Türkiye'], ['Kemal Özdemir', 'Türkiye'], ['Naz Bozkurt', 'Türkiye'],
    ['Volkan Acar', 'Türkiye'], ['Ece Karaca', 'Türkiye'],
    ['John Smith', 'Birleşik Krallık'], ['Emma Johnson', 'Birleşik Krallık'], ['Hans Müller', 'Almanya'],
    ['Anna Schmidt', 'Almanya'], ['Ivan Petrov', 'Rusya'], ['Olga Ivanova', 'Rusya'], ['Pierre Dubois', 'Fransa'],
    ['Marie Laurent', 'Fransa'], ['Giulia Rossi', 'İtalya'], ['Lars Nielsen', 'Danimarka'], ['Sara Al-Farsi', 'Birleşik Arap Emirlikleri'],
    ['Mohammed Hassan', 'Suudi Arabistan'], ['Yuki Tanaka', 'Japonya'],
  ];
  const guests: Guest[] = guestSrc.map(([fullName, nationality], i) => {
    const tr = nationality === 'Türkiye';
    const first = fullName.split(' ')[0].toLowerCase().replace(/[ıİ]/g, 'i').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o');
    return {
      id: `g-${i + 1}`,
      fullName,
      idNo: tr ? String(10000000000 + rng.int(0, 89999999999)).slice(0, 11) : `${String.fromCharCode(65 + rng.int(0, 25))}${rng.int(1000000, 9999999)}`,
      nationality,
      identityType: tr ? 'tc_kimlik' : 'pasaport',
      fatherName: tr ? ['Ali', 'Hasan', 'İbrahim', 'Mustafa'][i % 4] : undefined,
      motherName: tr ? ['Fatma', 'Emine', 'Ayşe', 'Hatice'][i % 4] : undefined,
      birthPlace: tr ? ['Antalya', 'İstanbul', 'Ankara', 'İzmir'][i % 4] : undefined,
      phone: tr ? `+90 5${rng.int(30, 59)} ${rng.int(100, 999)} ${rng.int(10, 99)} ${rng.int(10, 99)}` : `+${rng.int(30, 98)} ${rng.int(100, 999)} ${rng.int(1000000, 9999999)}`,
      email: `${first}${i + 1}@example.com`,
      birthDate: `${rng.int(1960, 2000)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
      notes: '',
      vip: [2, 12, 22, 30].includes(i),
      blacklisted: i === 18,
    };
  });
  guests[2].notes = 'Yüksek kat tercih eder.';
  guests.filter(g => g.identityType === 'pasaport').forEach(g => { g.passportNo = g.idNo; });
  guests[12].notes = 'Fındık alerjisi var.';
  guests[22].notes = 'Sessiz oda talebi.';
  guests[18].notes = 'Önceki konaklamada oda hasarı. Kara listede.';
  const usableGuests = guests.filter((g) => !g.blacklisted);

  // ---------- Rezervasyonlar ----------
  const reservations: Reservation[] = [];
  const boardExtra: Record<BoardType, number> = { sadece_oda: 0, oda_kahvalti: 250, yarim: 650, tam: 1000, her_sey_dahil: 1600 };
  const round50 = (n: number) => Math.round(n / 50) * 50;
  const startDay = addDaysStr(today, -60);
  const endDay = addDaysStr(today, 30);

  rooms.forEach((room) => {
    const ooo = outOfOrder[room.no];
    let cursor = addDaysStr(startDay, rng.int(0, 3));
    while (cursor < endDay) {
      const dense = cursor >= addDaysStr(today, -14);
      // Yoğun dönemde ~%72, eski dönemde ~%50 doluluk hedeflenir
      if (!rng.chance(dense ? 0.82 : 0.65)) {
        cursor = addDaysStr(cursor, rng.int(1, 3));
        continue;
      }
      const nights = rng.int(dense ? 3 : 2, dense ? 8 : 5);
      const checkOut = addDaysStr(cursor, nights);
      if (ooo && checkOut > addDaysStr(today, -4)) break;
      const typ = typeById[room.typeId];
      const board = weighted<BoardType>(rng, [['oda_kahvalti', 40], ['sadece_oda', 15], ['yarim', 15], ['tam', 8], ['her_sey_dahil', 22]]);
      const channel = weighted<ReservationChannel>(rng, [['direkt', 22], ['telefon', 12], ['booking', 28], ['expedia', 14], ['acente', 14], ['walk_in', 10]]);
      const guest = rng.pick(usableGuests);
      let status: Reservation['status'];
      if (checkOut < today) status = rng.chance(0.06) ? (rng.chance(0.5) ? 'iptal' : 'no_show') : 'cikis_yapti';
      else if (cursor <= today) status = 'giris_yapti';
      else status = rng.chance(0.12) ? 'opsiyon' : rng.chance(0.05) ? 'iptal' : 'onayli';
      reservations.push({
        id: `res-${reservations.length + 1}`,
        guestId: guest.id,
        roomId: room.id,
        checkIn: cursor,
        checkOut,
        adults: Math.min(typ.capacity, rng.int(1, 2) + (typ.capacity > 2 && rng.chance(0.3) ? 1 : 0)),
        children: typ.capacity > 2 && rng.chance(0.3) ? rng.int(1, 2) : 0,
        status,
        channel,
        board,
        nightlyRate: round50(typ.basePrice * (0.9 + rng.next() * 0.35) + boardExtra[board]),
        notes: rng.chance(0.1) ? rng.pick(['Geç giriş yapacak.', 'Doğum günü sürprizi.', 'Bebek yatağı istendi.', 'Havaalanı transferi var.', 'Yüksek kat talebi.']) : '',
        createdAt: new Date(parseISO(cursor).getTime() - rng.int(2, 40) * 86400000).toISOString(),
      });
      cursor = addDaysStr(checkOut, rng.int(0, 2));
    }
  });
  reservations.sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  // Oda durumları (bugüne göre)
  const inHouse = new Set(
    reservations.filter((r) => r.status === 'giris_yapti' && r.checkOut >= today).map((r) => r.roomId),
  );
  rooms.forEach((r) => {
    if (outOfOrder[r.no]) r.status = outOfOrder[r.no];
    else if (inHouse.has(r.id)) r.status = 'dolu';
    else r.status = weighted<RoomStatus>(rng, [['bos', 62], ['kirli', 24], ['temizleniyor', 14]]);
  });

  // ---------- Folio & ödemeler ----------
  const folioItems: FolioItem[] = [];
  const payments: Payment[] = [];
  const methods: PaymentMethod[] = ['nakit', 'kredi_karti', 'kredi_karti', 'havale', 'sanal_pos'];
  reservations.forEach((r) => {
    if (r.status === 'iptal' || r.status === 'no_show' || r.status === 'opsiyon') return;
    const nights = daysBetween(r.checkIn, r.checkOut);
    const total = nights * r.nightlyRate;
    const isStayed = r.status === 'cikis_yapti' || r.status === 'giris_yapti';
    if (isStayed) {
      folioItems.push({ id: id('f'), reservationId: r.id, date: r.checkIn, description: `Konaklama (${nights} gece)`, type: 'konaklama', amount: total, vatRate: settings.vatAccommodation });
      const extras = rng.int(0, 4);
      for (let k = 0; k < extras; k++) {
        const t = weighted<Exclude<FolioType, 'konaklama'>>(rng, [['restoran', 40], ['minibar', 25], ['spa', 12], ['camasir', 8], ['transfer', 10], ['diger', 5]]);
        const span = Math.max(0, Math.min(nights, daysBetween(r.checkIn, today) + 1) - 1);
        const d = addDaysStr(r.checkIn, rng.int(0, span));
        const amt = { restoran: rng.int(350, 1800), minibar: rng.int(120, 600), spa: rng.int(800, 2500), camasir: rng.int(150, 500), transfer: rng.int(600, 1500), diger: rng.int(100, 500) }[t];
        const descr = { restoran: 'Restoran harcaması', minibar: 'Minibar', spa: 'Spa & masaj', camasir: 'Çamaşırhane', transfer: 'Havalimanı transferi', diger: 'Diğer hizmet' }[t];
        folioItems.push({ id: id('f'), reservationId: r.id, date: d, description: descr, type: t, amount: amt, vatRate: t === 'restoran' || t === 'minibar' ? (t === 'restoran' ? settings.vatFood : settings.vatAlcohol) : settings.vatGeneral });
      }
    }
    const folio = folioItems.filter((f) => f.reservationId === r.id).reduce((s, f) => s + f.amount, 0);
    if (r.status === 'cikis_yapti') {
      const m = rng.pick(methods);
      if (rng.chance(0.3)) {
        const first = Math.round(folio * 0.4);
        payments.push({ id: id('p'), reservationId: r.id, amount: first, method: 'kredi_karti', date: r.checkIn });
        payments.push({ id: id('p'), reservationId: r.id, amount: folio - first, method: m, date: r.checkOut });
      } else payments.push({ id: id('p'), reservationId: r.id, amount: folio, method: m, date: r.checkOut });
    } else if (r.status === 'giris_yapti') {
      payments.push({ id: id('p'), reservationId: r.id, amount: Math.round(total * 0.4), method: rng.pick(methods), date: r.checkIn, note: 'Ön ödeme' });
    } else if (r.status === 'onayli' && rng.chance(0.5)) {
      payments.push({ id: id('p'), reservationId: r.id, amount: Math.round(total * 0.2), method: 'havale', date: addDaysStr(today, -rng.int(1, 5)), note: 'Kapora' });
    }
  });

  // ---------- Tedarikçiler ----------
  const suppliers: Supplier[] = [
    { id: 'sup-1', name: 'Akdeniz Gıda Toptan', contact: 'Ramazan Bey', phone: '+90 242 330 11 22', email: 'siparis@akdenizgida.example', taxNo: '3210987654', category: 'Gıda', balance: 48500 },
    { id: 'sup-2', name: 'Lara Et & Tavuk', contact: 'Servet Usta', phone: '+90 242 331 22 33', email: 'info@laraet.example', taxNo: '4321098765', category: 'Gıda', balance: 22300 },
    { id: 'sup-3', name: 'Ege Tekstil', contact: 'Nilüfer Hanım', phone: '+90 232 440 55 66', email: 'satis@egetekstil.example', taxNo: '5432109876', category: 'Tekstil', balance: 0 },
    { id: 'sup-4', name: 'TemizPlus Kimya', contact: 'Orhan Bey', phone: '+90 242 332 44 55', email: 'bilgi@temizplus.example', taxNo: '6543210987', category: 'Temizlik', balance: 8750 },
    { id: 'sup-5', name: 'Mavi İçecek Dağıtım', contact: 'Tolga Bey', phone: '+90 242 333 66 77', email: 'tolga@maviicecek.example', taxNo: '7654321098', category: 'İçecek', balance: 15400 },
    { id: 'sup-6', name: 'Teknik Servis A.Ş.', contact: 'Cevdet Usta', phone: '+90 242 334 88 99', email: 'servis@teknikas.example', taxNo: '8765432109', category: 'Bakım', balance: 0 },
    { id: 'sup-7', name: 'Antalya Elektrik Dağıtım', contact: 'Abone Hizmetleri', phone: '186', email: 'abone@aedas.example', taxNo: '9876543210', category: 'Fatura', balance: 0 },
    { id: 'sup-8', name: 'Medya Reklam Ajansı', contact: 'Pelin Hanım', phone: '+90 212 555 12 12', email: 'pelin@medyareklam.example', taxNo: '1098765432', category: 'Pazarlama', balance: 12000 },
    { id: 'sup-9', name: 'Güvenli Sigorta Aracılık', contact: 'Hasan Bey', phone: '+90 242 335 10 10', email: 'hasan@guvenli.example', taxNo: '2109876543', category: 'Sigorta', balance: 0 },
    { id: 'sup-10', name: 'Sıhhi Tesisat Market', contact: 'Yaşar Usta', phone: '+90 242 336 20 20', email: 'yasar@sihhi.example', taxNo: '1209876543', category: 'Bakım', balance: 3200 },
  ];

  // ---------- Çalışanlar ----------
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#84cc16'];
  const empSrc: [string, Department, string, number, number][] = [
    ['Selim Karaca', 'yonetim', 'Genel Müdür', 140000, 5],
    ['Nihan Aksu', 'yonetim', 'İK Müdürü', 72000, 6],
    ['Kerem Doğan', 'on_buro', 'Ön Büro Müdürü', 62000, 7],
    ['Pınar Yalçın', 'on_buro', 'Resepsiyonist', 40000, 3],
    ['Tuğba Ersoy', 'on_buro', 'Resepsiyonist', 38500, 2],
    ['Barış Uçar', 'on_buro', 'Gece Resepsiyonisti', 39000, 4],
    ['Yusuf Başar', 'on_buro', 'Bellboy', 34000, 1],
    ['Hatice Koçak', 'kat_hizmetleri', 'Kat Şefi', 44000, 9],
    ['Sevgi Tunç', 'kat_hizmetleri', 'Oda Görevlisi', 34500, 4],
    ['Leyla Duman', 'kat_hizmetleri', 'Oda Görevlisi', 33500, 2],
    ['Gamze Eren', 'kat_hizmetleri', 'Oda Görevlisi', 33030, 1],
    ['Rıza Çakır', 'kat_hizmetleri', 'Çamaşırhane Sorumlusu', 36000, 5],
    ['Ali Rıza Bulut', 'mutfak', 'Executive Şef', 78000, 8],
    ['Cemal Yurt', 'mutfak', 'Aşçıbaşı', 52000, 6],
    ['Songül Taş', 'mutfak', 'Aşçı Yardımcısı', 37000, 3],
    ['Mahmut Işık', 'mutfak', 'Bulaşıkçı', 33030, 1],
    ['Serkan Özkan', 'servis', 'Restoran Müdürü', 54000, 6],
    ['Merve Sönmez', 'servis', 'Garson', 35000, 2],
    ['Onur Altun', 'servis', 'Garson', 34500, 1],
    ['Taner Bilgin', 'servis', 'Barmen', 38000, 3],
    ['Ramazan Aydoğan', 'teknik', 'Teknik Müdür', 56000, 10],
    ['İsmail Korkmaz', 'teknik', 'Tesisatçı / Elektrikçi', 41000, 4],
    ['Veli Sarı', 'guvenlik', 'Güvenlik Şefi', 43000, 7],
    ['Cengiz Aslan', 'guvenlik', 'Güvenlik Görevlisi', 35000, 2],
    ['Aylin Mutlu', 'muhasebe', 'Muhasebe Müdürü', 66000, 8],
    ['Dilek Aras', 'muhasebe', 'Muhasebe Uzmanı', 46000, 3],
  ];
  const employees: Employee[] = empSrc.map(([fullName, department, position, grossSalary, yrs], i) => ({
    id: `emp-${i + 1}`,
    fullName,
    idNo: String(20000000000 + rng.int(0, 79999999999)).slice(0, 11),
    phone: `+90 5${rng.int(30, 59)} ${rng.int(100, 999)} ${rng.int(10, 99)} ${rng.int(10, 99)}`,
    department,
    position,
    startDate: addDaysStr(today, -(yrs * 365 + rng.int(0, 300))),
    grossSalary,
    salaryType: 'aylik',
    iban: `TR${rng.int(10, 99)} 0006 2000 ${rng.int(1000, 9999)} 0006 ${rng.int(1000, 9999)} ${rng.int(10, 99)}`,
    breakMinutes: department === 'mutfak' || department === 'kat_hizmetleri' ? 75 : 60,
    annualLeaveDays: yrs >= 15 ? 26 : yrs >= 5 ? 20 : 14,
    active: true,
    color: palette[i % palette.length],
  }));
  employees[15].active = true;

  // ---------- Vardiya şablonları ----------
  const shiftTemplates: ShiftTemplate[] = [
    { id: 'tpl-sabah', name: 'Sabah (07:00-15:00)', type: 'sabah', start: '07:00', end: '15:00', breakMinutes: 60 },
    { id: 'tpl-aksam', name: 'Akşam (15:00-23:00)', type: 'aksam', start: '15:00', end: '23:00', breakMinutes: 60 },
    { id: 'tpl-gece', name: 'Gece (23:00-07:00)', type: 'gece', start: '23:00', end: '07:00', breakMinutes: 45 },
    { id: 'tpl-gunduz', name: 'Gündüz Ofis (09:00-18:00)', type: 'ozel', start: '09:00', end: '18:00', breakMinutes: 60 },
    { id: 'tpl-kat', name: 'Kat Hizmetleri (08:00-16:00)', type: 'sabah', start: '08:00', end: '16:00', breakMinutes: 75 },
  ];
  const tpl = Object.fromEntries(shiftTemplates.map((t) => [t.id, t]));

  // Deterministik vardiya deseni: (çalışan, tarih) -> şablon | null (izin günü)
  const weekIndex = (d: string) => Math.floor(daysBetween('2024-01-01', format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd')) / 7);
  const dow = (d: string) => (parseISO(d).getDay() + 6) % 7; // 0=Pzt
  const patternFor = (emp: Employee, i: number, d: string): ShiftTemplate | null => {
    const w = dow(d);
    if (w === i % 7) return null; // haftalık izin günü
    switch (emp.department) {
      case 'yonetim':
      case 'muhasebe':
        return w >= 5 ? null : tpl['tpl-gunduz'];
      case 'teknik':
        return w === 6 ? null : tpl['tpl-gunduz'];
      case 'kat_hizmetleri':
        return tpl['tpl-kat'];
      case 'on_buro':
        if (emp.position.includes('Gece')) return tpl['tpl-gece'];
        return [tpl['tpl-sabah'], tpl['tpl-aksam']][(weekIndex(d) + i) % 2];
      case 'mutfak':
        return [tpl['tpl-sabah'], tpl['tpl-aksam']][(weekIndex(d) + i) % 2];
      case 'servis':
        return [tpl['tpl-aksam'], tpl['tpl-sabah']][(weekIndex(d) + i) % 2];
      case 'guvenlik':
        return [tpl['tpl-gece'], tpl['tpl-aksam']][(weekIndex(d) + i) % 2];
    }
  };

  // Bu hafta + gelecek hafta vardiyaları
  const weekStart = toDateStr(startOfWeek(now, { weekStartsOn: 1 }));
  const shifts: Shift[] = [];
  for (let k = 0; k < 14; k++) {
    const d = addDaysStr(weekStart, k);
    employees.forEach((e, i) => {
      const t = patternFor(e, i, d);
      if (!t) return;
      shifts.push({ id: id('sh'), employeeId: e.id, date: d, start: t.start, end: t.end, breakMinutes: t.breakMinutes, type: t.type, note: '' });
    });
  }

  // ---------- Puantaj (son 14 gün) ----------
  const attendance: Attendance[] = [];
  for (let k = 14; k >= 0; k--) {
    const d = addDaysStr(today, -k);
    employees.forEach((e, i) => {
      const t = patternFor(e, i, d);
      if (!t || rng.chance(0.03)) return;
      const startMin = timeToMinutes(t.start);
      if (k === 0 && nowMin < startMin) return;
      const lateIn = rng.chance(0.15) ? rng.int(5, 25) : rng.int(-8, 3);
      const checkIn = minutesToTime(startMin + lateIn);
      const endMin = timeToMinutes(t.end);
      const finished = k > 0 || (t.end > t.start && nowMin >= endMin);
      const breakStart = startMin + shiftGrossMinutes(t.start, t.end) / 2 - 15 + rng.int(-20, 30);
      const brk = k === 0 && nowMin < breakStart + e.breakMinutes ? [] : [{ start: minutesToTime(breakStart), end: minutesToTime(breakStart + e.breakMinutes + rng.int(-10, 12)) }];
      attendance.push({
        id: id('at'),
        employeeId: e.id,
        date: d,
        checkIn,
        checkOut: finished ? minutesToTime(endMin + rng.int(-5, 20)) : undefined,
        breaks: brk,
        note: lateIn > 15 ? 'Geç geldi' : '',
      });
    });
  }

  // ---------- İzin talepleri ----------
  const leaveRequests: LeaveRequest[] = [
    { id: id('lv'), employeeId: 'emp-4', type: 'yillik', startDate: addDaysStr(today, 10), endDate: addDaysStr(today, 17), status: 'beklemede', description: 'Yaz tatili' },
    { id: id('lv'), employeeId: 'emp-9', type: 'hastalik', startDate: addDaysStr(today, -3), endDate: addDaysStr(today, -1), status: 'onaylandi', description: 'Doktor raporu mevcut' },
    { id: id('lv'), employeeId: 'emp-14', type: 'yillik', startDate: addDaysStr(today, 20), endDate: addDaysStr(today, 27), status: 'beklemede', description: 'Aile ziyareti' },
    { id: id('lv'), employeeId: 'emp-18', type: 'mazeret', startDate: addDaysStr(today, 2), endDate: addDaysStr(today, 2), status: 'onaylandi', description: 'Resmi işlem' },
    { id: id('lv'), employeeId: 'emp-7', type: 'ucretsiz', startDate: addDaysStr(today, 5), endDate: addDaysStr(today, 9), status: 'reddedildi', description: 'Yoğun dönem, uygun görülmedi' },
    { id: id('lv'), employeeId: 'emp-20', type: 'yillik', startDate: addDaysStr(today, -30), endDate: addDaysStr(today, -23), status: 'onaylandi', description: '' },
    { id: id('lv'), employeeId: 'emp-12', type: 'hastalik', startDate: addDaysStr(today, 1), endDate: addDaysStr(today, 2), status: 'beklemede', description: 'Rapor bekleniyor' },
    { id: id('lv'), employeeId: 'emp-25', type: 'yillik', startDate: addDaysStr(today, 35), endDate: addDaysStr(today, 42), status: 'onaylandi', description: 'Tatil planı' },
  ];

  // ---------- Bordro (yılbaşından son tamamlanan aya; kümülatif matrah eksiksiz) ----------
  const payrolls: PayrollRecord[] = [];
  const cumulativeBases = new Map<string, number>();
  for (let month = 0; month < now.getMonth(); month++) {
    const md = new Date(now.getFullYear(), month, 1);
    const period = format(md, 'yyyy-MM');
    const paidDate = format(new Date(now.getFullYear(), month + 1, 5), 'yyyy-MM-dd');
    employees.forEach((e) => {
      if (e.startDate.slice(0, 7) > period) return;
      const gross = e.grossSalary * (e.salaryType === 'saatlik' ? 225 : 1);
      const c = calculatePayroll({ gross, overtimeHours: rng.chance(0.25) ? rng.int(4, 16) : 0,
        hourlyRate: e.salaryType === 'saatlik' ? e.grossSalary : gross / 225,
        cumulativeTaxBase: cumulativeBases.get(e.id) ?? 0,
        cumulativeMinimumWageBase: minimumWageBaseBeforePeriod(period, settings) }, settings);
      cumulativeBases.set(e.id, c.cumulativeTaxBaseAfter);
      payrolls.push({
        id: id('pr'),
        employeeId: e.id,
        period,
        gross: c.gross,
        overtime: c.overtime,
        deductions: c.deductions,
        net: c.net,
        paid: paidDate <= today,
        paidDate: paidDate <= today ? paidDate : undefined,
      });
    });
  }

  // ---------- Muhasebe işlemleri (son ~3 ay) ----------
  const transactions: Transaction[] = [];
  const tx = (type: 'gelir' | 'gider', category: string, description: string, amount: number, vatRate: number, date: string, account: 'kasa' | 'banka', extra: Partial<Transaction> = {}) => {
    const { vat } = splitVat(amount, vatRate);
    transactions.push({ id: id('tx'), type, category, description, amount: round2(amount), vatRate, vatAmount: vat, date, account, ...extra });
  };
  const yesterday = addDaysStr(today, -1);
  for (let w = 0; w < 13; w++) {
    const to = addDaysStr(yesterday, -w * 7);
    const from = addDaysStr(to, -6);
    const rev = roomRevenueBetween(reservations.filter((r) => r.status !== 'iptal'), from, to);
    tx('gelir', 'Konaklama', `Haftalık konaklama geliri (${from} / ${to})`, rev, settings.vatAccommodation, to, 'banka', { documentNo: `HG-${to.replace(/-/g, '')}` });
    tx('gelir', 'Restoran & Bar', 'Restoran ve bar satışları', Math.round(rev * rng.int(14, 22) / 100), settings.vatFood, to, 'kasa');
    tx('gelir', 'Spa & Hizmetler', 'Spa, transfer ve diğer hizmetler', Math.round(rev * rng.int(3, 7) / 100), settings.vatGeneral, to, 'kasa');
    tx('gider', 'Gıda & İçecek', 'Haftalık gıda alımı', rng.int(95, 150) * 1000, settings.vatFood, addDaysStr(to, -rng.int(0, 4)), 'banka', { supplierId: rng.pick(['sup-1', 'sup-2', 'sup-5']), documentNo: `AF-${rng.int(1000, 9999)}` });
  }
  for (let m = 3; m >= 0; m--) {
    const md = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const ym = format(md, 'yyyy-MM');
    const day = (n: number) => `${ym}-${String(n).padStart(2, '0')}`;
    const past = (d: string) => d <= today;
    const add = (cat: string, desc: string, amt: number, vat: number, dd: number, acc: 'kasa' | 'banka', extra: Partial<Transaction> = {}) => {
      if (past(day(dd))) tx('gider', cat, desc, amt, vat, day(dd), acc, extra);
    };
    const previousPeriod = format(new Date(md.getFullYear(), md.getMonth() - 1, 1), 'yyyy-MM');
    const previousPayrolls = payrolls.filter(p => p.period === previousPeriod);
    if (previousPayrolls.length) {
      add('Personel', 'Personel maaş ödemesi', round2(previousPayrolls.reduce((sum, p) => sum + p.net, 0)), 0, 5, 'banka');
      const premiums = previousPayrolls.reduce((sum, p) => {
        const c = calculatePayroll({ gross: p.gross, overtimeGross: p.overtime }, settings);
        return sum + p.deductions.sgk + p.deductions.unemployment + c.employerSgk + c.employerUnemployment;
      }, 0);
      add('Personel', 'SGK prim ödemesi', round2(premiums), 0, 26, 'banka');
    }
    add('Elektrik', 'Elektrik faturası', rng.int(165, 215) * 1000, settings.vatGeneral, 12, 'banka', { supplierId: 'sup-7', documentNo: `EL-${ym}` });
    add('Su', 'Su faturası', rng.int(28, 42) * 1000, 10, 14, 'banka', { documentNo: `SU-${ym}` });
    add('Doğalgaz', 'Doğalgaz faturası', rng.int(55, 90) * 1000, settings.vatGeneral, 15, 'banka', { documentNo: `DG-${ym}` });
    add('İletişim', 'İnternet ve telefon', 7800, settings.vatGeneral, 18, 'banka');
    add('Temizlik Malzemesi', 'Temizlik kimyasalları', rng.int(18, 30) * 1000, settings.vatGeneral, 9, 'banka', { supplierId: 'sup-4' });
    add('Bakım & Onarım', 'Teknik servis bakım bedeli', rng.int(14, 40) * 1000, settings.vatGeneral, 20, 'banka', { supplierId: 'sup-6' });
    add('Pazarlama', 'Dijital reklam ve sosyal medya', rng.int(20, 35) * 1000, settings.vatGeneral, 8, 'banka', { supplierId: 'sup-8' });
    add('Komisyon', 'Booking.com komisyonu', rng.int(70, 110) * 1000, settings.vatGeneral, 22, 'banka', { documentNo: `BK-${ym}` });
    add('Komisyon', 'Expedia komisyonu', rng.int(30, 55) * 1000, settings.vatGeneral, 22, 'banka');
    add('Sigorta', 'İşyeri sigortası', 9500, settings.vatGeneral, 3, 'banka', { supplierId: 'sup-9' });
    add('Vergi', 'KDV ödemesi', rng.int(150, 230) * 1000, 0, 26, 'banka');
    if (previousPayrolls.length) add('Vergi', 'Muhtasar ve damga vergisi', round2(previousPayrolls.reduce((sum, p) => sum + p.deductions.incomeTax + p.deductions.stampTax, 0)), 0, 26, 'banka');
    add('Tekstil', 'Havlu ve nevresim yenileme', rng.int(10, 35) * 1000, settings.vatGeneral, 11, 'banka', { supplierId: 'sup-3' });
  }

  // ---------- Faturalar ----------
  const invoices: Invoice[] = [];
  const invRes = reservations.filter((r) => r.status === 'cikis_yapti').slice(-12);
  invRes.forEach((r, i) => {
    const g = guests.find((x) => x.id === r.guestId)!;
    const nights = daysBetween(r.checkIn, r.checkOut);
    const gross = nights * r.nightlyRate;
    const net = round2(gross / (1 + settings.vatAccommodation / 100));
    const vat = round2(gross - net);
    const accTax = round2(net * settings.accommodationTax / 100);
    invoices.push({
      id: id('inv'),
      no: `F${now.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      customerName: g.fullName,
      reservationId: r.id,
      lines: [{ description: `Konaklama (${nights} gece)`, quantity: nights, unitPrice: round2(net / nights), vatRate: settings.vatAccommodation }],
      subtotal: net,
      vatTotal: vat,
      accommodationTax: accTax,
      total: round2(net + vat + accTax),
      status: i < 8 ? 'odendi' : i < 10 ? 'kesildi' : i === 10 ? 'taslak' : 'iptal',
      date: r.checkOut,
    });
  });

  // ---------- Envanter ----------
  const invSrc: [string, string, string, number, number, number, string][] = [
    ['Banyo Havlusu', 'Tekstil', 'adet', 420, 300, 180, 'sup-3'],
    ['Plaj Havlusu', 'Tekstil', 'adet', 150, 100, 150, 'sup-3'],
    ['Çarşaf Takımı (Çift)', 'Tekstil', 'takım', 260, 200, 420, 'sup-3'],
    ['Yastık', 'Tekstil', 'adet', 90, 60, 160, 'sup-3'],
    ['Şampuan (30ml)', 'Oda Malzemesi', 'adet', 1100, 800, 4.5, 'sup-4'],
    ['Sabun (25g)', 'Oda Malzemesi', 'adet', 650, 800, 3, 'sup-4'],
    ['Tuvalet Kâğıdı', 'Temizlik', 'koli', 24, 30, 320, 'sup-4'],
    ['Çamaşır Deterjanı', 'Temizlik', 'kg', 180, 100, 62, 'sup-4'],
    ['Cam Temizleyici', 'Temizlik', 'lt', 45, 30, 48, 'sup-4'],
    ['Çöp Poşeti (Büyük)', 'Temizlik', 'rulo', 140, 80, 35, 'sup-4'],
    ['Filtre Kahve', 'Gıda', 'kg', 18, 25, 520, 'sup-1'],
    ['Çay (Dökme)', 'Gıda', 'kg', 42, 20, 340, 'sup-1'],
    ['Un', 'Gıda', 'kg', 300, 150, 22, 'sup-1'],
    ['Ayçiçek Yağı', 'Gıda', 'lt', 120, 80, 68, 'sup-1'],
    ['Zeytinyağı', 'Gıda', 'lt', 35, 40, 310, 'sup-1'],
    ['Süt', 'Gıda', 'lt', 90, 60, 36, 'sup-1'],
    ['Tavuk Göğsü', 'Gıda', 'kg', 70, 50, 150, 'sup-2'],
    ['Su (0.5 lt)', 'İçecek', 'adet', 2400, 1500, 4, 'sup-5'],
    ['Kola (Minibar)', 'İçecek', 'adet', 380, 300, 22, 'sup-5'],
    ['Bira (Minibar)', 'İçecek', 'adet', 160, 200, 45, 'sup-5'],
    ['Şarap (Kırmızı)', 'İçecek', 'şişe', 64, 40, 380, 'sup-5'],
    ['Ampul (LED)', 'Teknik', 'adet', 85, 50, 38, 'sup-10'],
    ['Oda Terliği', 'Oda Malzemesi', 'çift', 520, 400, 12, 'sup-3'],
    ['Peçete', 'Gıda', 'paket', 12, 20, 55, 'sup-1'],
  ];
  const inventoryItems: InventoryItem[] = invSrc.map(([name, category, unit, quantity, minQuantity, unitPrice, supplierId], i) => ({
    id: `inv-item-${i + 1}`, name, category, unit, quantity, minQuantity, unitPrice, supplierId,
  }));
  const stockMovements: StockMovement[] = [];
  for (let k = 0; k < 34; k++) {
    const item = rng.pick(inventoryItems);
    const dir = rng.chance(0.4) ? 'giris' : 'cikis';
    stockMovements.push({
      id: id('sm'),
      itemId: item.id,
      direction: dir,
      quantity: Math.max(1, Math.round(item.minQuantity * (dir === 'giris' ? rng.int(30, 80) : rng.int(5, 25)) / 100)),
      date: addDaysStr(today, -rng.int(0, 30)),
      description: dir === 'giris' ? 'Tedarikçiden teslim alındı' : rng.pick(['Kat hizmetleri kullanımı', 'Mutfak kullanımı', 'Minibar dolumu', 'Teknik servis']),
    });
  }
  stockMovements.sort((a, b) => b.date.localeCompare(a.date));

  // ---------- Kat hizmetleri ----------
  const housekeepingTasks: HousekeepingTask[] = [];
  const hkStaff = employees.filter((e) => e.department === 'kat_hizmetleri').map((e) => e.id);
  rooms.forEach((r, i) => {
    if (r.status === 'kirli') housekeepingTasks.push({ id: id('hk'), roomId: r.id, date: today, assignedTo: hkStaff[i % hkStaff.length], type: 'cikis', status: 'bekliyor', note: 'Çıkış temizliği' });
    else if (r.status === 'temizleniyor') housekeepingTasks.push({ id: id('hk'), roomId: r.id, date: today, assignedTo: hkStaff[i % hkStaff.length], type: 'cikis', status: 'devam', note: '' });
    else if (r.status === 'dolu' && rng.chance(0.55)) housekeepingTasks.push({ id: id('hk'), roomId: r.id, date: today, assignedTo: hkStaff[i % hkStaff.length], type: rng.chance(0.2) ? 'havlu_carsaf' : 'gunluk', status: rng.chance(0.5) ? 'tamamlandi' : 'bekliyor', note: '' });
  });
  for (let k = 1; k <= 3; k++) {
    for (let j = 0; j < 8; j++) {
      const r = rng.pick(rooms);
      housekeepingTasks.push({ id: id('hk'), roomId: r.id, date: addDaysStr(today, -k), assignedTo: rng.pick(hkStaff), type: rng.pick(['gunluk', 'cikis', 'derin']), status: 'tamamlandi', note: '' });
    }
  }
  housekeepingTasks.push({ id: id('hk'), roomId: 'room-208', date: today, assignedTo: hkStaff[0], type: 'derin', status: 'bekliyor', note: 'Bakım sonrası derin temizlik' });

  // ---------- Arıza kayıtları ----------
  const maintenanceTickets: MaintenanceTicket[] = [
    { id: id('mt'), roomId: 'room-208', area: 'Oda 208', title: 'Klima çalışmıyor', description: 'Kompresör arızalı, parça bekleniyor.', priority: 'yuksek', status: 'devam', assignedTo: 'emp-22', cost: 6500, openedAt: addDaysStr(today, -4) },
    { id: id('mt'), roomId: 'room-307', area: 'Oda 307', title: 'Banyo su kaçağı', description: 'Lavabo altı sızıntı, tavan nemlenmiş.', priority: 'acil', status: 'devam', assignedTo: 'emp-22', cost: 3200, openedAt: addDaysStr(today, -2) },
    { id: id('mt'), area: 'Havuz', title: 'Havuz pompası gürültülü', description: 'Sirkülasyon pompası rulman sesi yapıyor.', priority: 'orta', status: 'acik', assignedTo: 'emp-21', cost: 0, openedAt: addDaysStr(today, -1) },
    { id: id('mt'), area: 'Asansör', title: 'Yıllık asansör bakımı', description: 'Periyodik bakım ve kontrol.', priority: 'orta', status: 'beklemede', cost: 4800, openedAt: addDaysStr(today, -9) },
    { id: id('mt'), roomId: 'room-110', area: 'Oda 110', title: 'TV kumandası arızalı', description: '', priority: 'dusuk', status: 'acik', cost: 0, openedAt: addDaysStr(today, 0) },
    { id: id('mt'), roomId: 'room-203', area: 'Oda 203', title: 'Ampul değişimi', description: 'Banyo aydınlatması', priority: 'dusuk', status: 'kapandi', assignedTo: 'emp-22', cost: 120, openedAt: addDaysStr(today, -12), closedAt: addDaysStr(today, -11) },
    { id: id('mt'), area: 'Mutfak', title: 'Buzdolabı soğutmuyor', description: 'Depo buzdolabı gazı eksik.', priority: 'yuksek', status: 'kapandi', assignedTo: 'emp-21', cost: 2900, openedAt: addDaysStr(today, -20), closedAt: addDaysStr(today, -18) },
    { id: id('mt'), roomId: 'room-405', area: 'Oda 405', title: 'Parke yenileme', description: 'Zemin kaplaması değişiyor, oda bloke.', priority: 'orta', status: 'devam', assignedTo: 'emp-21', cost: 18500, openedAt: addDaysStr(today, -6) },
    { id: id('mt'), area: 'Lobi', title: 'Giriş kapısı sensörü', description: 'Otomatik kapı geç açılıyor.', priority: 'orta', status: 'kapandi', cost: 1800, openedAt: addDaysStr(today, -30), closedAt: addDaysStr(today, -27) },
    { id: id('mt'), area: 'Çatı', title: 'Jeneratör testi', description: 'Aylık yük testi.', priority: 'dusuk', status: 'acik', assignedTo: 'emp-21', cost: 0, openedAt: addDaysStr(today, -3) },
  ];

  // ---------- Görevler ----------
  const tasks: Task[] = [
    { id: id('t'), title: 'Haftalık yönetim toplantısı hazırlığı', description: 'Doluluk ve gelir raporunu hazırla.', assignedTo: 'emp-1', dueDate: addDaysStr(today, 1), priority: 'orta', status: 'yapilacak' },
    { id: id('t'), title: 'Booking.com fiyat güncellemesi', description: 'Sezon sonu kampanyası için fiyatları gözden geçir.', assignedTo: 'emp-3', dueDate: addDaysStr(today, 2), priority: 'yuksek', status: 'devam' },
    { id: id('t'), title: 'KDV beyannamesi', description: 'Aylık KDV beyannamesini hazırla ve ilet.', assignedTo: 'emp-25', dueDate: addDaysStr(today, 7), priority: 'acil', status: 'yapilacak' },
    { id: id('t'), title: 'Yangın tatbikatı', description: 'Tüm vardiyalar için tatbikat planla.', assignedTo: 'emp-23', dueDate: addDaysStr(today, 14), priority: 'orta', status: 'yapilacak' },
    { id: id('t'), title: 'Minimum stoktaki ürünlerin siparişi', description: 'Sabun, kahve, bira, peçete, zeytinyağı.', assignedTo: 'emp-8', dueDate: addDaysStr(today, 1), priority: 'yuksek', status: 'yapilacak' },
    { id: id('t'), title: 'Personel performans görüşmeleri', description: 'Çeyreklik değerlendirme.', assignedTo: 'emp-2', dueDate: addDaysStr(today, 10), priority: 'dusuk', status: 'devam' },
    { id: id('t'), title: 'Restoran menü güncellemesi', description: 'Sonbahar menüsü.', assignedTo: 'emp-13', dueDate: addDaysStr(today, -2), priority: 'orta', status: 'tamamlandi' },
    { id: id('t'), title: 'Web sitesi fotoğraf yenileme', description: '', assignedTo: 'emp-1', dueDate: addDaysStr(today, 21), priority: 'dusuk', status: 'yapilacak' },
    { id: id('t'), title: 'Isıtma sistemi kış bakımı', description: 'Kazan ve radyatörler.', assignedTo: 'emp-21', dueDate: addDaysStr(today, 12), priority: 'yuksek', status: 'yapilacak' },
    { id: id('t'), title: 'Tedarikçi sözleşmelerini yenile', description: 'Gıda ve temizlik tedarikçileri.', assignedTo: 'emp-25', dueDate: addDaysStr(today, -5), priority: 'orta', status: 'tamamlandi' },
  ];

  // ---------- Fiyat planları, sezonlar ve kanallar ----------
  const channelDefinitions: [Channel['type'], string, number][] = [
    ['booking', 'Booking.com', 15], ['expedia', 'Expedia', 18], ['airbnb', 'Airbnb', 14],
    ['direkt', 'Direkt Satış', 0], ['telefon', 'Telefon', 0], ['acente', 'Akdeniz Turizm Acentesi', 12],
  ];
  const channels: Channel[] = channelDefinitions.map(([type, name, commissionRate]) => ({ id: `channel-${type}`, name, type, commissionRate, active: true }));
  const boardLabels: Record<BoardType, string> = { sadece_oda: 'Sadece Oda', oda_kahvalti: 'Oda Kahvaltı', yarim: 'Yarım Pansiyon', tam: 'Tam Pansiyon', her_sey_dahil: 'Her Şey Dahil' };
  const ratePlans: RatePlan[] = roomTypes.flatMap(type => (Object.keys(boardLabels) as BoardType[]).map(board => ({
    id: `rate-${type.id}-${board}`, name: `${type.name} · ${boardLabels[board]}`, roomTypeId: type.id, board,
    price: type.basePrice + boardExtra[board], active: true, description: 'Gecelik, KDV dahil demo fiyat planı.',
  })));
  const year = now.getFullYear();
  const seasons: Season[] = [
    { id: 'season-winter', name: 'Kış & Erken Rezervasyon', startDate: `${year}-01-01`, endDate: `${year}-04-30`, multiplier: 0.85 },
    { id: 'season-summer', name: 'Yaz Sezonu', startDate: `${year}-05-01`, endDate: `${year}-09-30`, multiplier: 1.35 },
    { id: 'season-autumn', name: 'Sonbahar & Şehir Kaçamağı', startDate: `${year}-10-01`, endDate: `${year}-12-31`, multiplier: 1 },
  ];
  reservations.forEach(r => {
    r.channelId = channels.find(c => c.type === (r.channel === 'walk_in' ? 'direkt' : r.channel))?.id;
    r.ratePlanId = ratePlans.find(plan => plan.roomTypeId === rooms.find(room => room.id === r.roomId)?.typeId && plan.board === r.board)?.id;
  });

  // ---------- POS satış noktaları ve 30 menü kalemi ----------
  const posOutlets: PosOutlet[] = [
    { id: 'outlet-restaurant', name: 'Mavi Restoran', type: 'restoran', active: true, description: 'Akdeniz mutfağı ve açık büfe' },
    { id: 'outlet-bar', name: 'Teras Bar', type: 'bar', active: true, description: 'Manzara eşliğinde kokteyl ve içecekler' },
    { id: 'outlet-minibar', name: 'Oda Minibar', type: 'minibar', active: true, description: 'Odada içecek ve atıştırmalıklar' },
    { id: 'outlet-spa', name: 'Mavi Spa', type: 'spa', active: true, description: 'Masaj, hamam ve bakım hizmetleri' },
  ];
  const menuDefinitions: [number, string, string, number, number, string?, number?][] = [
    [0, 'Serpme Kahvaltı', 'Kahvaltı', 650, settings.vatFood],
    [0, 'Menemen', 'Kahvaltı', 280, settings.vatFood],
    [0, 'Mercimek Çorbası', 'Başlangıç', 180, settings.vatFood],
    [0, 'Akdeniz Salata', 'Salata', 340, settings.vatFood],
    [0, 'Izgara Levrek', 'Ana Yemek', 780, settings.vatFood],
    [0, 'Tavuk Şiş', 'Ana Yemek', 520, settings.vatFood],
    [0, 'Etli Mantı', 'Ana Yemek', 460, settings.vatFood],
    [0, 'Sebzeli Makarna', 'Ana Yemek', 390, settings.vatFood],
    [0, 'Fırın Sütlaç', 'Tatlı', 220, settings.vatFood],
    [0, 'Türk Kahvesi', 'Sıcak İçecek', 140, settings.vatFood, 'Filtre Kahve', 0.01],
    [1, 'Espresso', 'Sıcak İçecek', 150, settings.vatFood, 'Filtre Kahve', 0.018],
    [1, 'Cappuccino', 'Sıcak İçecek', 190, settings.vatFood, 'Filtre Kahve', 0.018],
    [1, 'Taze Portakal Suyu', 'Soğuk İçecek', 220, settings.vatFood],
    [1, 'Ev Yapımı Limonata', 'Soğuk İçecek', 180, settings.vatFood],
    [1, 'Yerli Bira', 'Alkollü İçecek', 260, settings.vatAlcohol, 'Bira (Minibar)', 1],
    [1, 'Kırmızı Şarap · Kadeh', 'Alkollü İçecek', 350, settings.vatAlcohol, 'Şarap (Kırmızı)', 0.2],
    [1, 'Mojito', 'Kokteyl', 420, settings.vatAlcohol],
    [1, 'Alkolsüz Meyve Kokteyli', 'Kokteyl', 290, settings.vatFood],
    [2, 'Su 0,5 lt', 'İçecek', 60, settings.vatFood, 'Su (0.5 lt)', 1],
    [2, 'Kola', 'İçecek', 110, settings.vatFood, 'Kola (Minibar)', 1],
    [2, 'Maden Suyu', 'İçecek', 80, settings.vatFood],
    [2, 'Minibar Bira', 'Alkollü İçecek', 210, settings.vatAlcohol, 'Bira (Minibar)', 1],
    [2, 'Karışık Kuruyemiş', 'Atıştırmalık', 160, settings.vatFood],
    [2, 'Bitter Çikolata', 'Atıştırmalık', 130, settings.vatFood],
    [3, 'Klasik Masaj · 50 dk', 'Masaj', 1800, settings.vatGeneral],
    [3, 'Aromaterapi Masajı · 60 dk', 'Masaj', 2200, settings.vatGeneral],
    [3, 'Sıcak Taş Masajı · 60 dk', 'Masaj', 2400, settings.vatGeneral],
    [3, 'Türk Hamamı & Kese', 'Hamam', 1400, settings.vatGeneral],
    [3, 'Cilt Bakımı · 45 dk', 'Bakım', 1600, settings.vatGeneral],
    [3, 'Refleksoloji · 30 dk', 'Masaj', 1200, settings.vatGeneral],
  ];
  const menuItems: MenuItem[] = menuDefinitions.map(([outlet, name, category, price, vatRate, stockName, stockQuantity], index) => ({
    id: `menu-${index + 1}`, outletId: posOutlets[outlet].id, name, category, price, vatRate, active: true,
    inventoryItemId: stockName ? inventoryItems.find(item => item.name === stockName)?.id : undefined, stockQuantity,
  }));
  const posOrders: PosOrder[] = [];
  for (let index = 0; index < 16; index++) {
    const outlet = posOutlets[index % 4]; const group = Math.floor(index / 4);
    const date = addDaysStr(today, -group);
    const reservation = reservations.find(r => r.status === 'giris_yapti' && r.checkIn <= date && r.checkOut > date);
    const available = menuItems.filter(item => item.outletId === outlet.id);
    const status: PosOrder['status'] = group === 0 ? 'acik' : group === 1 ? 'odendi' : group === 2 && reservation ? 'odaya_yazildi' : 'iptal';
    const items = available.slice(index % 3, index % 3 + 2).map((item, i) => ({ menuItemId: item.id, name: item.name, quantity: i === 0 && outlet.type !== 'spa' ? 2 : 1, unitPrice: item.price, vatRate: item.vatRate }));
    const order: PosOrder = { id: `pos-order-${index + 1}`, outletId: outlet.id, tableNo: outlet.type === 'restoran' || outlet.type === 'bar' ? String(index % 8 + 1) : undefined,
      roomNo: reservation && (status === 'odaya_yazildi' || outlet.type === 'minibar') ? rooms.find(r => r.id === reservation.roomId)?.no : undefined,
      reservationId: status === 'odaya_yazildi' ? reservation?.id : undefined, items, total: calculatePosOrderTotal(items), status, date,
      createdAt: new Date(`${date}T${outlet.type === 'spa' ? '15' : '19'}:30:00`).toISOString(), employeeId: outlet.type === 'spa' ? 'emp-17' : 'emp-18',
      paymentMethod: status === 'odendi' ? index % 2 === 0 ? 'nakit' : 'kredi_karti' : undefined,
      notes: status === 'iptal' ? 'Misafir talebiyle iptal edildi; ücret alınmadı.' : undefined };
    if (status === 'odaya_yazildi' && reservation) {
      const posted = items.map(item => ({ id: id('f-pos'), reservationId: reservation.id, date,
        description: `${outlet.name} · ${item.name} × ${item.quantity}`, type: (outlet.type === 'spa' ? 'spa' : outlet.type === 'minibar' ? 'minibar' : 'restoran') as FolioType,
        amount: round2(item.quantity * item.unitPrice), vatRate: item.vatRate, sourceOrderId: order.id }));
      order.folioItemIds = posted.map(item => item.id); folioItems.push(...posted);
    }
    posOrders.push(order);
  }

  // ---------- Kasa vardiyaları ve döviz hareketleri (kurlar yalnızca demodur) ----------
  const cashSessions: CashSession[] = []; const cashMovements: CashMovement[] = [];
  for (let offset = 3; offset >= 0; offset--) {
    const date = addDaysStr(today, -offset); const sessionId = `cash-session-${date}`;
    const session: CashSession = { id: sessionId, date, employeeId: offset % 2 === 0 ? 'emp-4' : 'emp-5', openedAt: new Date(`${date}T07:00:00`).toISOString(), status: 'acik', openingBalance: 5000, notes: 'Resepsiyon ana kasa · sabah vardiyası' };
    const movement = (data: Omit<CashMovement, 'id' | 'sessionId' | 'date'>) => cashMovements.push({ id: id('cash-move'), sessionId, date, ...data });
    payments.filter(p => p.date === date).slice(0, 6).forEach(p => movement({ type: 'tahsilat', amount: p.amount, currency: 'TRY', exchangeRate: 1, method: p.method, reservationId: p.reservationId, description: 'Misafir hesabı tahsilatı', employeeId: session.employeeId }));
    movement({ type: 'tahsilat', amount: 2500, currency: 'TRY', exchangeRate: 1, method: 'nakit', description: 'Günübirlik hizmet tahsilatı', employeeId: session.employeeId });
    movement({ type: 'odeme', amount: 180, currency: 'TRY', exchangeRate: 1, method: 'nakit', description: 'Resepsiyon küçük gideri · taksi bedeli', employeeId: session.employeeId });
    const exchangeId = `exchange-${date}`; const currency = offset % 2 === 0 ? 'EUR' : 'USD'; const exchangeRate = currency === 'EUR' ? 52.4 : 45.2;
    movement({ type: 'doviz', direction: 'giris', amount: 100, currency, exchangeRate, method: 'nakit', description: `${currency} alımı · örnek demo kur`, exchangeId });
    movement({ type: 'doviz', direction: 'cikis', amount: round2(100 * exchangeRate), currency: 'TRY', exchangeRate: 1, method: 'nakit', description: 'Döviz bozumunun TRY karşılığı', exchangeId });
    posOrders.filter(order => order.date === date && order.status === 'odendi').forEach(order => movement({ type: 'tahsilat', amount: order.total, currency: 'TRY', exchangeRate: 1, method: order.paymentMethod ?? 'nakit', description: `${posOutlets.find(outlet => outlet.id === order.outletId)?.name} · POS tahsilatı` }));
    if (offset > 0) {
      session.expectedBalance = calculateCashSessionBalance(session, cashMovements); session.countedAmount = round2(session.expectedBalance + (offset === 2 ? -20 : 0));
      session.difference = round2(session.countedAmount - session.expectedBalance); session.status = 'kapali'; session.closedAt = new Date(`${date}T23:30:00`).toISOString(); session.closedBy = session.employeeId;
    }
    cashSessions.push(session);
  }
  const nightAudits: NightAudit[] = [3, 2, 1].map(offset => {
    const date = addDaysStr(today, -offset);
    return { id: `night-audit-${date}`, date, ...calculateNightAuditMetrics(date, rooms, reservations, folioItems, posOrders, posOutlets), closedBy: 'emp-6', closedAt: new Date(`${addDaysStr(date, 1)}T02:00:00`).toISOString(), notes: 'Gece vardiyası kontrolü tamamlandı; açık hesaplar sonraki vardiyaya devredildi.' };
  });

  // ---------- Misafir geri bildirimleri ve şikâyetler ----------
  const feedbackDefinitions: [GuestFeedback['rating'], string, string][] = [
    [5, 'Personel', 'Resepsiyon ekibi çok ilgiliydi, girişimiz hızlıca tamamlandı.'],
    [4, 'Yiyecek & İçecek', 'Kahvaltı çeşitliydi; glutensiz seçenekler artırılabilir.'],
    [2, 'Teknik', 'Odamızdaki klima gece gürültülü çalışıyordu.'],
    [5, 'Temizlik', 'Odamız her gün özenle temizlendi, teşekkür ederiz.'],
    [3, 'Hizmet', 'Oda servisi siparişi beklediğimizden geç geldi.'],
    [1, 'Gürültü', 'Koridordaki gece gürültüsü nedeniyle uyuyamadık.'],
    [4, 'Spa', 'Masaj çok iyiydi, rezervasyon saatleri daha esnek olabilir.'],
    [5, 'Konum', 'Denize ve şehir merkezine ulaşım çok rahattı.'],
    [2, 'Temizlik', 'Balkon temizliği için iki kez talepte bulunmamız gerekti.'],
    [4, 'Yiyecek & İçecek', 'Akşam yemeklerinde yerel lezzetlere daha fazla yer verilebilir.'],
    [5, 'Personel', 'Çocuğumuzun doğum günü için hazırlanan sürpriz çok güzeldi.'],
    [3, 'Teknik', 'Wi-Fi bağlantısı odamızda sık sık kesildi.'],
    [5, 'Spa', 'Hamam ve bakım hizmetlerinden çok memnun kaldık.'],
    [4, 'Oda', 'Yastık seçenekleri sunulması çok hoşumuza gitti.'],
    [2, 'Hizmet', 'Çıkış sırasında fatura için uzun süre bekledik.'],
  ];
  const guestFeedbacks: GuestFeedback[] = feedbackDefinitions.map(([rating, category, comment], index) => {
    const guest = guests[index]; const reservation = [...reservations].reverse().find(r => r.guestId === guest.id && r.checkIn <= today && !['iptal', 'no_show', 'opsiyon'].includes(r.status));
    const date = addDaysStr(today, -(index % 12)); const status: GuestFeedback['status'] = ['yeni', 'inceleniyor', 'cozuldu', 'kapatildi'][index % 4] as GuestFeedback['status'];
    return { id: `feedback-${index + 1}`, guestId: guest.id, reservationId: reservation?.id, date, rating, type: rating <= 2 ? 'sikayet' : rating <= 4 ? 'oneri' : 'memnuniyet', category, comment, status,
      assignedTo: category === 'Teknik' ? 'emp-21' : category === 'Temizlik' ? 'emp-8' : 'emp-3', priority: rating <= 2 ? 'yuksek' : 'orta',
      response: status === 'cozuldu' || status === 'kapatildi' ? 'Geri bildiriminiz için teşekkür ederiz. İlgili ekibimiz gerekli kontrolü tamamladı ve sizinle iletişime geçti.' : undefined,
      respondedAt: status === 'cozuldu' || status === 'kapatildi' ? new Date(`${date}T17:00:00`).toISOString() : undefined,
      resolvedAt: status === 'cozuldu' ? new Date(`${date}T18:00:00`).toISOString() : undefined };
  });
  const lostDescriptions = ['Siyah güneş gözlüğü ve kılıfı', 'Beyaz telefon şarj adaptörü', 'Çocuk pelüş ayıcığı', 'Gümüş renk kol saati', 'Mavi desenli eşarp', 'Kablosuz kulaklık kutusu', 'İngilizce roman ve kitap ayracı', 'Spor ayakkabısı çantası', 'Kişisel su şişesi', 'Deri kartlık · kartlar muhafaza altında'];
  const lostItems: LostItem[] = lostDescriptions.map((description, index) => {
    const status: LostItem['status'] = index === 8 ? 'imha' : index % 3 === 1 ? 'teslim_edildi' : 'depoda'; const room = rooms[index * 2];
    return { id: `lost-${index + 1}`, date: addDaysStr(today, index === 8 ? -95 : -(index * 2 + 1)), location: index % 3 === 0 ? 'Lobi / resepsiyon' : `Oda ${room.no}`, roomId: index % 3 === 0 ? undefined : room.id, description,
      foundBy: `emp-${8 + index % 5}`, status, storageLocation: `Kayıp eşya dolabı ${index < 5 ? 'A' : 'B'} · Raf ${index % 3 + 1}`,
      receivedBy: status === 'teslim_edildi' ? guests[index].fullName : undefined, deliveredAt: status === 'teslim_edildi' ? addDaysStr(today, -index) : undefined,
      guestId: status === 'teslim_edildi' ? guests[index].id : undefined, notes: status === 'imha' ? 'Saklama süresi doldu; tutanakla imha edildi.' : 'Etiketlenerek poşetlendi, buluntu defterine kaydedildi.' };
  });

  // ---------- Aktivite günlüğü ----------
  const mins = (n: number) => new Date(now.getTime() - n * 60000).toISOString();
  const activityLogs: ActivityLog[] = [
    { id: id('al'), date: mins(8), message: 'Oda 312 için giriş işlemi yapıldı', module: 'on_buro' },
    { id: id('al'), date: mins(25), message: 'Yeni rezervasyon oluşturuldu (Booking.com)', module: 'on_buro' },
    { id: id('al'), date: mins(50), message: 'Elektrik faturası ödendi', module: 'muhasebe' },
    { id: id('al'), date: mins(95), message: 'Oda 208 klima arızası kaydı açıldı', module: 'operasyon' },
    { id: id('al'), date: mins(150), message: 'Yıllık izin talebi alındı: Pınar Yalçın', module: 'ik' },
    { id: id('al'), date: mins(240), message: 'Stok girişi yapıldı: Su (0.5 lt)', module: 'operasyon' },
    { id: id('al'), date: mins(400), message: 'Oda 105 çıkış yaptı, temizlik görevi oluşturuldu', module: 'on_buro' },
    { id: id('al'), date: mins(700), message: 'Vardiya planı güncellendi', module: 'ik' },
    { id: id('al'), date: mins(1300), message: 'Eylül ayı maaşları ödendi', module: 'muhasebe' },
    { id: id('al'), date: mins(1800), message: 'Yeni tedarikçi eklendi: Sıhhi Tesisat Market', module: 'yonetim' },
  ];

  return {
    settings, roomTypes, rooms, guests, reservations, folioItems, payments, transactions, invoices, employees,
    shifts, shiftTemplates, attendance, leaveRequests, payrolls, housekeepingTasks, maintenanceTickets,
    inventoryItems, stockMovements, suppliers, tasks, activityLogs,
    cashSessions, cashMovements, nightAudits, posOutlets, menuItems, posOrders, ratePlans, seasons, channels, guestFeedbacks, lostItems,
  };
}
