// Tüm varlık tipleri. Tüm id'ler string. Tarihler 'YYYY-MM-DD', saatler 'HH:mm',
// tarih-saat alanları ISO string (örn. new Date().toISOString()).

export type ID = string;
export type DateStr = string; // 'YYYY-MM-DD'
export type TimeStr = string; // 'HH:mm'
export type ISODateTime = string;

// ---------- Ayarlar ----------
export interface IncomeTaxBracket {
  /** Dilim üst sınırı (yıllık matrah, TL). Son dilim için null (sınırsız). */
  upTo: number | null;
  /** Oran, yüzde olarak (15 = %15) */
  rate: number;
}

export interface Settings {
  hotelName: string;
  address: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  currency: 'TRY';
  /** KDV oranları (yüzde) */
  vatAccommodation: number; // 10
  vatFood: number; // 10
  vatAlcohol: number; // 20
  vatGeneral: number; // 20
  /** Konaklama vergisi (yüzde) */
  accommodationTax: number; // 2
  /** Kurumlar vergisi oranı (ondalık oran; 0.25 = %25) */
  corporateTaxRate: number;
  /** Beyan/ödeme günleri (ayın günü) */
  taxDeadlineDay: number;
  withholdingDeadlineDay: number;
  accommodationDeadlineDay: number;
  /** Brüt asgari ücret (aylık) */
  minWageGross: number;
  /** SGK / işsizlik oranları (yüzde) */
  sgkEmployee: number; // 14
  unemploymentEmployee: number; // 1
  sgkEmployer: number; // 15.75
  unemploymentEmployer: number; // 2
  /** Damga vergisi (oran, binde 7.59 => 0.00759) */
  stampTax: number;
  incomeTaxBrackets: IncomeTaxBracket[];
  checkInTime: TimeStr;
  checkOutTime: TimeStr;
  totalFloors?: number;
}

// ---------- Odalar ----------
export type RoomStatus = 'bos' | 'dolu' | 'kirli' | 'temizleniyor' | 'bakimda' | 'bloke';

export interface RoomType {
  id: ID;
  name: string;
  capacity: number;
  basePrice: number;
  description: string;
}

export interface Room {
  id: ID;
  no: string;
  floor: number;
  typeId: ID;
  status: RoomStatus;
  features: string[];
  notes?: string;
}

// ---------- Misafirler ----------
export interface Guest {
  id: ID;
  fullName: string;
  idNo: string; // TC kimlik veya pasaport no
  nationality: string;
  phone: string;
  email: string;
  birthDate?: DateStr;
  /** KBS alanları; nationality / idNo / birthDate mevcut alanlarıyla birlikte kullanılır. */
  identityType?: 'tc_kimlik' | 'pasaport' | 'yabanci_kimlik';
  passportNo?: string;
  fatherName?: string;
  motherName?: string;
  birthPlace?: string;
  notes: string;
  vip: boolean;
  blacklisted: boolean;
}

// ---------- Rezervasyonlar ----------
export type ReservationStatus = 'opsiyon' | 'onayli' | 'giris_yapti' | 'cikis_yapti' | 'iptal' | 'no_show';
export type ReservationChannel = 'direkt' | 'telefon' | 'booking' | 'expedia' | 'acente' | 'walk_in';
export type BoardType = 'oda_kahvalti' | 'yarim' | 'tam' | 'her_sey_dahil' | 'sadece_oda';

export interface Reservation {
  id: ID;
  guestId: ID;
  roomId: ID;
  checkIn: DateStr;
  checkOut: DateStr;
  adults: number;
  children: number;
  status: ReservationStatus;
  channel: ReservationChannel;
  channelId?: ID;
  ratePlanId?: ID;
  board: BoardType;
  nightlyRate: number;
  notes: string;
  createdAt: ISODateTime;
}

export type FolioType = 'konaklama' | 'restoran' | 'minibar' | 'spa' | 'camasir' | 'transfer' | 'diger';

export interface FolioItem {
  id: ID;
  reservationId: ID;
  date: DateStr;
  description: string;
  type: FolioType;
  amount: number; // KDV dahil tutar
  vatRate: number; // yüzde
  /** POS aktarımının tekrarında mükerrer folio oluşturmamak için. */
  sourceOrderId?: ID;
}

export type PaymentMethod = 'nakit' | 'kredi_karti' | 'havale' | 'sanal_pos';

export interface Payment {
  id: ID;
  reservationId?: ID;
  amount: number;
  method: PaymentMethod;
  date: DateStr;
  note?: string;
}

// ---------- Muhasebe ----------
export type TransactionType = 'gelir' | 'gider';
export type AccountType = 'kasa' | 'banka';

export interface Transaction {
  id: ID;
  type: TransactionType;
  category: string;
  description: string;
  amount: number; // KDV dahil toplam
  vatRate: number; // yüzde
  vatAmount: number;
  date: DateStr;
  account: AccountType;
  documentNo?: string;
  supplierId?: ID;
}

export type InvoiceStatus = 'taslak' | 'kesildi' | 'odendi' | 'iptal';

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number; // KDV hariç
  vatRate: number;
}

export interface Invoice {
  id: ID;
  no: string;
  customerName: string;
  customerTaxNo?: string;
  customerAddress?: string;
  reservationId?: ID;
  lines: InvoiceLine[];
  subtotal: number; // KDV hariç ara toplam
  vatTotal: number;
  accommodationTax: number;
  total: number;
  status: InvoiceStatus;
  date: DateStr;
}

// ---------- Kasa ve gün sonu ----------
export type CashCurrency = 'TRY' | 'EUR' | 'USD';
export interface CashSession {
  id: ID;
  date: DateStr;
  employeeId: ID;
  openedAt: ISODateTime;
  closedAt?: ISODateTime;
  closedBy?: ID;
  status: 'acik' | 'kapali';
  /** Açılış, sayım, beklenen bakiye ve fark TRY karşılığıdır. */
  openingBalance: number;
  countedAmount?: number;
  expectedBalance?: number;
  difference?: number;
  notes?: string;
}
export interface CashMovement {
  id: ID;
  sessionId: ID;
  date: DateStr;
  type: 'tahsilat' | 'odeme' | 'doviz';
  /** Döviz bozumunda zorunlu; iki taraf ayrı hareket, ortak exchangeId ile tutulur. */
  direction?: 'giris' | 'cikis';
  amount: number;
  currency: CashCurrency;
  /** Bir birim para biriminin TRY karşılığı; TRY için 1. */
  exchangeRate: number;
  method: PaymentMethod;
  description: string;
  employeeId?: ID;
  reservationId?: ID;
  exchangeId?: ID;
  /** Hareketin kaynağı; yalnız 'manuel' (veya boş/eski kayıt) muhasebe defterine yazılır. */
  sourceType?: 'folio' | 'pos' | 'manuel';
  sourceId?: ID;
  /** Manuel hareketin KDV oranı (yüzde); 0 = KDV yok, boşsa genel oran. */
  vatRate?: number;
}
export interface NightAuditRevenue {
  accommodation: number;
  restaurant: number;
  minibar: number;
  spa: number;
  other: number;
}
export interface NightAudit {
  id: ID;
  date: DateStr;
  occupancy: number; // yüzde, 0–100
  occupiedRooms: number;
  totalRooms: number;
  adr: number;
  revpar: number;
  roomRevenue: number;
  totalRevenue: number;
  revenueSummary: NightAuditRevenue;
  closedBy: ID;
  closedAt: ISODateTime;
  notes: string;
}

// ---------- Satış noktaları (POS) ----------
export type PosOutletType = 'restoran' | 'bar' | 'minibar' | 'spa' | 'oda_servisi';
export interface PosOutlet {
  id: ID;
  name: string;
  type: PosOutletType;
  active: boolean;
  description?: string;
}
export interface MenuItem {
  id: ID;
  outletId: ID;
  name: string;
  category: string;
  price: number; // KDV dahil birim fiyat
  vatRate: number; // yüzde
  active: boolean;
  inventoryItemId?: ID;
  stockQuantity?: number; // bir satış için stok birimi miktarı
}
/** Fiyat/KDV/ad sipariş anında kopyalanır; menü değişikliği eski siparişi değiştirmez. */
export interface PosOrderItem {
  menuItemId: ID;
  name: string;
  quantity: number;
  unitPrice: number; // KDV dahil
  vatRate: number;
  notes?: string;
}
export type PosOrderStatus = 'acik' | 'odendi' | 'odaya_yazildi' | 'iptal';
export interface PosOrder {
  id: ID;
  outletId: ID;
  tableNo?: string;
  roomNo?: string;
  reservationId?: ID;
  items: PosOrderItem[];
  total: number; // KDV dahil kalem toplamı; aktarımda kalemlerden yeniden hesaplanır
  status: PosOrderStatus;
  date: DateStr;
  createdAt: ISODateTime;
  employeeId?: ID;
  paymentMethod?: PaymentMethod;
  folioItemIds?: ID[];
  notes?: string;
}

// ---------- Fiyat ve satış kanalları ----------
export interface RatePlan {
  id: ID;
  name: string;
  roomTypeId: ID;
  board: BoardType;
  price: number; // KDV dahil gecelik fiyat
  active: boolean;
  description?: string;
}
export interface Season {
  id: ID;
  name: string;
  startDate: DateStr;
  endDate: DateStr;
  multiplier: number;
}
export interface Channel {
  id: ID;
  name: string;
  type: 'booking' | 'expedia' | 'airbnb' | 'direkt' | 'telefon' | 'acente';
  commissionRate: number; // yüzde
  active: boolean;
}

// ---------- Misafir ilişkileri ----------
export type FeedbackStatus = 'yeni' | 'inceleniyor' | 'cozuldu' | 'kapatildi';
export interface GuestFeedback {
  id: ID;
  guestId: ID;
  reservationId?: ID;
  date: DateStr;
  rating: 1 | 2 | 3 | 4 | 5;
  type: 'memnuniyet' | 'oneri' | 'sikayet';
  category: string;
  comment: string;
  status: FeedbackStatus;
  response?: string;
  respondedAt?: ISODateTime;
  assignedTo?: ID;
  priority?: Priority;
  resolvedAt?: ISODateTime;
}
export interface LostItem {
  id: ID;
  date: DateStr;
  location: string;
  roomId?: ID;
  description: string;
  foundBy: ID;
  status: 'depoda' | 'teslim_edildi' | 'imha';
  storageLocation?: string;
  receivedBy?: string;
  deliveredAt?: DateStr;
  guestId?: ID;
  notes?: string;
}

// ---------- Personel ----------
export type Department =
  | 'on_buro'
  | 'kat_hizmetleri'
  | 'mutfak'
  | 'servis'
  | 'teknik'
  | 'guvenlik'
  | 'muhasebe'
  | 'yonetim';

export interface Employee {
  id: ID;
  fullName: string;
  idNo: string;
  phone: string;
  department: Department;
  position: string;
  startDate: DateStr;
  grossSalary: number; // aylık ise aylık brüt, saatlik ise saatlik brüt
  salaryType: 'aylik' | 'saatlik';
  iban: string;
  breakMinutes: number; // günlük mola hakkı (dk)
  annualLeaveDays: number; // yıllık izin hakkı (gün)
  active: boolean;
  color: string; // hex, vardiya takviminde kullanılır
}

export type ShiftType = 'sabah' | 'aksam' | 'gece' | 'ozel';

export interface Shift {
  id: ID;
  employeeId: ID;
  date: DateStr;
  start: TimeStr;
  end: TimeStr; // start'tan küçükse ertesi güne sarkar
  breakMinutes: number;
  type: ShiftType;
  note?: string;
}

export interface ShiftTemplate {
  id: ID;
  name: string;
  type: ShiftType;
  start: TimeStr;
  end: TimeStr;
  breakMinutes: number;
}

export interface BreakEntry {
  start: TimeStr;
  end?: TimeStr;
}

export interface Attendance {
  id: ID;
  employeeId: ID;
  date: DateStr;
  checkIn?: TimeStr;
  checkOut?: TimeStr;
  breaks: BreakEntry[];
  note?: string;
}

export type LeaveType = 'yillik' | 'hastalik' | 'ucretsiz' | 'mazeret';
export type LeaveStatus = 'beklemede' | 'onaylandi' | 'reddedildi';

export interface LeaveRequest {
  id: ID;
  employeeId: ID;
  type: LeaveType;
  startDate: DateStr;
  endDate: DateStr;
  status: LeaveStatus;
  description: string;
}

export interface PayrollRecord {
  id: ID;
  employeeId: ID;
  period: string; // 'YYYY-MM'
  gross: number;
  overtime: number; // fazla mesai ücreti (brüt)
  deductions: {
    sgk: number;
    unemployment: number;
    incomeTax: number;
    stampTax: number;
    other: number;
  };
  net: number;
  paid: boolean;
  paidDate?: DateStr;
}

// ---------- Operasyon ----------
export type HousekeepingTaskType = 'gunluk' | 'cikis' | 'derin' | 'havlu_carsaf';
export type TaskStatus = 'bekliyor' | 'devam' | 'tamamlandi';

export interface HousekeepingTask {
  id: ID;
  roomId: ID;
  date: DateStr;
  assignedTo?: ID; // employeeId
  type: HousekeepingTaskType;
  status: TaskStatus;
  note?: string;
}

export type Priority = 'dusuk' | 'orta' | 'yuksek' | 'acil';
export type MaintenanceStatus = 'acik' | 'devam' | 'beklemede' | 'kapandi';

export interface MaintenanceTicket {
  id: ID;
  roomId?: ID;
  area: string; // oda değilse alan (Havuz, Asansör, ...)
  title: string;
  description: string;
  priority: Priority;
  status: MaintenanceStatus;
  assignedTo?: ID;
  cost: number;
  openedAt: DateStr;
  closedAt?: DateStr;
}

export interface InventoryItem {
  id: ID;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  supplierId?: ID;
}

export interface StockMovement {
  id: ID;
  itemId: ID;
  direction: 'giris' | 'cikis';
  quantity: number;
  date: DateStr;
  description: string;
  /** POS siparişinden otomatik düşülen çıkışlar için sipariş id'si */
  sourceOrderId?: ID;
}

export interface Supplier {
  id: ID;
  name: string;
  contact: string;
  phone: string;
  email: string;
  taxNo: string;
  category: string;
  balance: number; // + ise tedarikçiye borcumuz
}

// ---------- Yönetim ----------
export type GeneralTaskStatus = 'yapilacak' | 'devam' | 'tamamlandi';

export interface Task {
  id: ID;
  title: string;
  description: string;
  assignedTo?: ID; // employeeId
  dueDate?: DateStr;
  priority: Priority;
  status: GeneralTaskStatus;
}

export type ModuleName =
  | 'genel'
  | 'on_buro'
  | 'muhasebe'
  | 'ik'
  | 'operasyon'
  | 'yonetim';

export interface ActivityLog {
  id: ID;
  date: ISODateTime;
  message: string;
  module: ModuleName | string;
}

// ---------- Koleksiyon haritası ----------
export interface CollectionMap {
  rooms: Room;
  roomTypes: RoomType;
  guests: Guest;
  reservations: Reservation;
  folioItems: FolioItem;
  payments: Payment;
  transactions: Transaction;
  invoices: Invoice;
  employees: Employee;
  shifts: Shift;
  shiftTemplates: ShiftTemplate;
  attendance: Attendance;
  leaveRequests: LeaveRequest;
  payrolls: PayrollRecord;
  housekeepingTasks: HousekeepingTask;
  maintenanceTickets: MaintenanceTicket;
  inventoryItems: InventoryItem;
  stockMovements: StockMovement;
  suppliers: Supplier;
  tasks: Task;
  activityLogs: ActivityLog;
  cashSessions: CashSession;
  cashMovements: CashMovement;
  nightAudits: NightAudit;
  posOutlets: PosOutlet;
  menuItems: MenuItem;
  posOrders: PosOrder;
  ratePlans: RatePlan;
  seasons: Season;
  channels: Channel;
  guestFeedbacks: GuestFeedback;
  lostItems: LostItem;
}

export type CollectionName = keyof CollectionMap;
