# CONTRACT — Otel Yönetim Altyapı Sözleşmesi

Bu doküman, modül sayfalarını yazan ajanlar içindir. Altyapı **sabittir**; değiştirme.

## Kurallar
- **Yalnızca kendi `src/pages/<modül>/` klasörüne** dosya ekle/değiştir.
- `src/types.ts`, `src/store/*`, `src/components/ui/*`, `src/components/layout/*`, `src/App.tsx`, `src/lib/*` dosyalarına **dokunma**. Eksik bir şey varsa kendi klasöründe yardımcı yaz.
- Sayfa dosya adları/yolları sabittir (`App.tsx` bunları import eder); her sayfa **default export** olmalı.
- Yardımcı bileşen/hook/sabitleri sayfa klasöründe tut (örn. `src/pages/hr/components/ShiftForm.tsx`).
- Dil: Türkçe arayüz. Para: `formatCurrency`. Tarih: `formatDate`. Tüm tarihler `'YYYY-MM-DD'`, saatler `'HH:mm'`.
- Stil: Tailwind; koyu tema için `dark:` varyantlarını ekle. Kartlar `rounded-2xl`, tonlar indigo/slate.
- `git commit` yapma. Bitirmeden `npm run build` hatasız geçmeli.

## Sayfalar (yol → dosya)
| Yol | Dosya |
|---|---|
| `/` | `pages/dashboard/DashboardPage.tsx` |
| `/rooms` `/reservations` `/calendar` `/guests` | `pages/frontdesk/{Rooms,Reservations,Calendar,Guests}Page.tsx` |
| `/accounting` `/invoices` `/taxes` `/reports` | `pages/accounting/{Accounting,Invoices,Taxes,Reports}Page.tsx` |
| `/staff` `/shifts` `/attendance` `/leaves` `/payroll` | `pages/hr/{Staff,Shifts,Attendance,Leaves,Payroll}Page.tsx` |
| `/housekeeping` `/maintenance` `/inventory` | `pages/operations/{Housekeeping,Maintenance,Inventory}Page.tsx` |
| `/suppliers` `/tasks` `/settings` | `pages/admin/{Suppliers,Tasks,Settings}Page.tsx` |

Mevcut dosyalar yalnızca `PageHeader` içeren yer tutuculardır; üzerine yaz.

## Store (`src/store/useStore.ts`)
Tek zustand store, localStorage anahtarı `otel-store`.

Koleksiyonlar: `rooms, roomTypes, guests, reservations, folioItems, payments, transactions, invoices, employees, shifts, shiftTemplates, attendance, leaveRequests, payrolls, housekeepingTasks, maintenanceTickets, inventoryItems, stockMovements, suppliers, tasks, activityLogs` + `settings`.

```tsx
import { useStore } from '../../store/useStore';

// Okuma (her zaman selector kullan; tüm store'u çekme)
const rooms = useStore((s) => s.rooms);
const settings = useStore((s) => s.settings);

// Aksiyonlar
const add = useStore((s) => s.add);
const update = useStore((s) => s.update);
const remove = useStore((s) => s.remove);
const log = useStore((s) => s.log);

const id = add('guests', { fullName: 'Ali Veli', idNo: '123', nationality: 'Türkiye', phone: '', email: '', notes: '', vip: false, blacklisted: false }); // id döner
update('rooms', roomId, { status: 'kirli' });   // patch tipi koleksiyona göre çıkarılır
remove('guests', id);
useStore.getState().updateSettings({ hotelName: 'Yeni Ad' });
useStore.getState().resetDemoData();
log('Oda 101 için giriş yapıldı', 'on_buro'); // ActivityLog'a ekler (module: genel|on_buro|muhasebe|ik|operasyon|yonetim)
```
- `add(collection, itemWithoutId)` → `id` (string) döner. `update(collection, id, patch)`. `remove(collection, id)`.
- Türetilmiş veri için `useMemo` kullan (selector içinde yeni dizi üretme → sonsuz render).
- Dışarıdan anlık erişim: `useStore.getState()`.
- Tüm tipler `src/types.ts`'te (`Room`, `Reservation`, `Employee`, ... ve `CollectionMap`). id'ler string.

### Önemli veri kuralları
- `FolioItem.amount` ve `Transaction.amount` **KDV dahil** tutardır; KDV oranı yüzde (10 = %10). `splitVat(gross, rate)` ile ayrıştır.
- `Reservation.nightlyRate` KDV dahil gecelik fiyat; konaklama toplamı `reservationTotal(r)`.
- Doluluk: `status` ∈ `onayli|giris_yapti|cikis_yapti` olan ve `checkIn <= gün < checkOut` rezervasyonlar odayı tutar (`occupiesNight`). `iptal/no_show/opsiyon` tutmaz.
- `Room.status` fiziksel durumu tutar; giriş/çıkış işleminde sayfa ilgili odanın durumunu da güncellemelidir (giriş → `dolu`, çıkış → `kirli` + kat hizmeti görevi).
- Vardiya: `end < start` ise ertesi güne sarkar (gece vardiyası). Attendance `date` = vardiyanın başladığı gün.
- `PayrollRecord.period` = `'YYYY-MM'`; `deductions` = `{sgk, unemployment, incomeTax, stampTax, other}`. Hesap için `calcPayroll(gross, settings)`.
- `Supplier.balance` pozitifse tedarikçiye borcumuz var.

## lib fonksiyonları
`src/lib/format.ts`: `formatCurrency(n, noDecimals?)`, `formatNumber`, `formatPercent(n)`, `formatDate(d, pattern?)`, `formatDateTime`, `formatWeekday(d, short?)`, `formatMonth('YYYY-MM')`, `todayStr()`, `toDateStr(Date)`, `toDate(str)`, `addDaysStr(str, n)`, `daysBetween(a, b)`, `timeToMinutes('HH:mm')`, `minutesToTime(min)`, `formatMinutes(135) → '2s 15dk'`, `initials(name)`, `currentPeriod()`.

`src/lib/id.ts`: `uid(prefix?)`.

`src/lib/calc.ts`: `nightsBetween`, `reservationNights(r)`, `reservationTotal(r)`, `folioTotal(items, resId?)`, `paymentsTotal(payments, resId?)`, `folioBalance(items, payments, resId)` (+ borçlu), `splitVat`, `round2`, `occupiesNight(r, date)`, `occupiedRoomsOn(reservations, date)`, `sellableRooms`, `occupancyRate(rooms, reservations, date?)` (0-100), `roomRevenueBetween(res, from, to)`, `adr(res, from, to)`, `revpar(rooms, res, from, to)`, `shiftGrossMinutes(start, end)`, `shiftMinutes(shift)` (mola düşülmüş; gece yarısını geçen vardiyalar doğru), `shiftHours`, `attendanceMinutes(a)`, `incomeTaxOnAnnual`, `calcPayroll(gross, settings)` → `{gross, sgk, unemployment, incomeTax, stampTax, net, employerSgk, employerUnemployment, employerCost}`.

## UI bileşenleri (`import { ... } from '../../components/ui'`)
| Bileşen | Props |
|---|---|
| `Button` | `variant?: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size?: 'sm'\|'md'\|'lg'`, `icon?: ReactNode` + native button props |
| `Card` | `title?`, `subtitle?`, `actions?`, `padded?=true`, `className` |
| `StatCard` | `title`, `value`, `icon?`, `change?` (yüzde, +/−), `changeLabel?`, `tone?: 'indigo'\|'emerald'\|'amber'\|'rose'\|'sky'\|'violet'\|'slate'` |
| `Badge` | `color?: 'slate'\|'indigo'\|'emerald'\|'amber'\|'rose'\|'sky'\|'violet'\|'orange'\|'teal'`, `dot?` |
| `Modal` | `open`, `onClose`, `title?`, `description?`, `size?: 'sm'\|'md'\|'lg'\|'xl'`, `footer?` |
| `Drawer` | `open`, `onClose`, `title?`, `description?`, `width?: 'md'\|'lg'\|'xl'`, `footer?` (sağdan açılır) |
| `Input` | native input props + `label?`, `hint?`, `error?`, `icon?`, `wrapperClassName?` |
| `Select` | native select props + `label?`, `options: {value,label}[]`, `placeholder?`, `error?` |
| `Textarea` | native props + `label?`, `error?`, `rows?` |
| `DatePicker` | `value`, `onChange(value: string)`, `mode?: 'date'\|'time'\|'month'`, `label?` |
| `Field` | `label?`, `hint?`, `error?` — özel kontroller için sarmalayıcı |
| `Tabs` | `tabs: {key,label,count?}[]`, `active`, `onChange(key)` |
| `DataTable<T>` | `columns: Column<T>[]`, `data`, `rowKey(row)`, `searchable?=true`, `searchPlaceholder?`, `pageSize?=10`, `onRowClick?`, `toolbar?`, `emptyTitle?`, `emptyDescription?`, `initialSort?` |
| `EmptyState` | `title?`, `description?`, `icon?`, `action?` |
| `PageHeader` | `title`, `description?`, `actions?` |
| `ConfirmDialog` | `open`, `onClose`, `onConfirm`, `title?`, `message?`, `confirmText?`, `cancelText?`, `danger?=true` |
| `Avatar` | `name`, `size?: 'sm'\|'md'\|'lg'`, `color?` |
| `useToast()` | `toast.success(msg)`, `.error`, `.info`, `.warning` |
| `cn(...)` | className birleştirici |

`Column<T>`: `{ key, header, render?(row), sortValue?(row) (verilirse sıralanabilir), searchValue?(row), align?: 'left'|'right'|'center', className? }`.

Örnek:
```tsx
<DataTable
  data={guests}
  rowKey={(g) => g.id}
  columns={[
    { key: 'name', header: 'Ad Soyad', sortValue: (g) => g.fullName, render: (g) => <span className="font-medium">{g.fullName}</span> },
    { key: 'vip', header: 'VIP', render: (g) => g.vip && <Badge color="amber">VIP</Badge> },
  ]}
  onRowClick={(g) => setSelected(g)}
/>
```

## Grafikler
`recharts` kurulu (renkler: indigo `#6366f1`, emerald `#10b981`, amber `#f59e0b`, rose `#f43f5e`, sky `#0ea5e9`). Koyu temada eksen/ızgara renkleri için `currentColor`/slate tonları kullan.

## Diğer
- İkonlar: `lucide-react`. Tarih: `date-fns` (tr locale: `import { tr } from 'date-fns/locale'`).
- Layout (kenar çubuğu, üst bar, bildirimler, tema) `src/components/layout`'ta; sayfalar sadece içerik üretir (`<div>` kökü yeterli; padding layout'tan gelir).
- Menü yapısı `src/components/layout/nav.ts`'tedir.

## Yeni modüller: ortak veri ve aksiyon sözleşmesi

Aşağıdaki altyapı 2026-10-14 tarihinde eklendi. Sayfa ajanları ortak `types/store/App/nav` dosyalarını değiştirmeden bu sözleşmeyi kullanmalıdır.

Yeni koleksiyonlar: `cashSessions`, `cashMovements`, `nightAudits`, `posOutlets`, `menuItems`, `posOrders`, `ratePlans`, `seasons`, `channels`, `guestFeedbacks`, `lostItems`. Hepsi mevcut tip güvenli `add/update/remove` aksiyonlarıyla çalışır. Yeni kurulum/demo sıfırlama örnek veri içerir; eski persist kaydında bulunmayan yeni koleksiyonlar boş dizilere taşınır (v3).

### Tipler ve birimler

- `CashSession`: `date`, `employeeId`, `openedAt`, `status: acik|kapali`, `openingBalance`, opsiyonel `closedAt/closedBy/countedAmount/expectedBalance/difference/notes`. Açılış ve sayım değerleri kasadaki tüm nakdin **TRY karşılığıdır**; fark = sayım − beklenen.
- `CashMovement`: `sessionId`, `date`, `type: tahsilat|odeme|doviz`, `amount`, `currency: TRY|EUR|USD`, `exchangeRate` (1 birimin TRY karşılığı; TRY=1), `method: PaymentMethod`, `description`; opsiyonel `employeeId/reservationId/exchangeId/direction`. `doviz` hareketinde `direction: giris|cikis` zorunludur. Bozumun iki tarafı ayrı hareketlerle, aynı `exchangeId` ile tutulur. Kart/havale hareketi fiziksel kasa bakiyesine girmez.
- `NightAudit`: `date`, `occupancy` (%), `occupiedRooms`, `totalRooms`, `adr`, `revpar`, `roomRevenue`, `totalRevenue`, `revenueSummary: {accommodation, restaurant, minibar, spa, other}`, `closedBy`, `closedAt`, `notes`. Gelirler KDV dahil operasyonel anlık görüntüdür.
- `PosOutlet`: `name`, `type: restoran|bar|minibar|spa|oda_servisi`, `active`, opsiyonel `description`.
- `MenuItem`: `outletId/name/category/price/vatRate/active`, opsiyonel `inventoryItemId/stockQuantity`. `price` KDV dahil birim fiyat; `stockQuantity` bir satış başına stok birimi miktarıdır.
- `PosOrder`: `outletId`, `items: PosOrderItem[]`, `total`, `status: acik|odendi|odaya_yazildi|iptal`, `date`, `createdAt`; opsiyonel `tableNo/roomNo/reservationId/employeeId/paymentMethod/folioItemIds/notes`. Kalem: `{menuItemId, name, quantity, unitPrice, vatRate, notes?}`. Ad, fiyat ve KDV sipariş anındaki kopyadır; tüm fiyatlar KDV dahildir. `total`, kalemlerin kuruşa yuvarlanan toplamıdır. Menü fiyatının değişmesi eski kalemleri değiştirmez.
- `RatePlan`: `name/roomTypeId/board/price/active`, opsiyonel `description`; `board`, mevcut `BoardType` değerlerini kullanır; fiyat KDV dahil geceliktir.
- `Season`: `name/startDate/endDate/multiplier`; tarihler dahil sınırlar olarak yorumlanır. `Channel`: `name/type/commissionRate/active`; `type: booking|expedia|airbnb|direkt|telefon|acente`, komisyon yüzde birimindedir.
- `GuestFeedback`: `guestId/date/rating/type/category/comment/status`; puan `1|2|3|4|5`, tür `memnuniyet|oneri|sikayet`, durum `yeni|inceleniyor|cozuldu|kapatildi`; opsiyonel `reservationId/response/respondedAt/assignedTo/priority/resolvedAt`. Şikâyetler ayrı koleksiyon yerine `type: sikayet` ile aynı koleksiyondadır.
- `LostItem`: `date/location/description/foundBy/status`; durum `depoda|teslim_edildi|imha`; opsiyonel `roomId/storageLocation/receivedBy/deliveredAt/guestId/notes`. `foundBy` çalışan ID’si, `receivedBy` teslim alan kişinin adıdır.
- Rezervasyonda opsiyonel `channelId/ratePlanId` bulunur; eski `channel/board/nightlyRate` alanları korunur. Kanala referans verilmesi eski `channel` değerini kendiliğinden değiştirmez.
- Misafirde mevcut `nationality/idNo/birthDate` alanları KBS için kullanılır. Yeni opsiyonel alanlar: `identityType: tc_kimlik|pasaport|yabanci_kimlik`, `passportNo`, `fatherName`, `motherName`, `birthPlace`. KBS sayfası bildirim dosyası hazırlayan yerel arayüzdür; altyapıda emniyete gönderim yoktur.

### Ortak aksiyonlar

```ts
const ids = useStore.getState().postPosOrderToFolio(orderId); // string[]
const closed = useStore.getState().closeCashSession(sessionId, countedAmount, closedBy?, notes?); // CashSession
const audit = useStore.getState().runNightAudit(date, closedBy, notes?); // NightAudit
```

- Aksiyonlar geçersiz girişte `Error` fırlatır; sayfalarda `try/catch` ve toast kullanın. İlgili koleksiyon değişiklikleri tek atomik store güncellemesidir ve aktivite günlüğü oluşturur.
- POS aktarımı giriş yapmış bir rezervasyon ve geçerli kalemler gerektirir. Sipariş `odaya_yazildi` olur; her kalem ilgili KDV oranıyla folioya aktarılır. `FolioItem.sourceOrderId` ve `folioItemIds` referansları tekrar çağrıda mükerrer aktarımı engeller. Ödenmiş/iptal sipariş aktarılamaz. Stok ve muhasebe defteri ayrıca otomatik değiştirilmez.
- Kasa kapanışında yalnızca aynı session’ın `nakit` hareketleri, kendi kuruyla ve yönüyle hesaba girer. Açılış + giriş − çıkış beklenen bakiyedir. Aynı tutarla tekrar kapanış mevcut kaydı döndürür; farklı sayımla kapalı kaydı değiştirmek hata verir. Muhasebe işlemleri tekrar yazılmaz.
- Gün sonu tarih başına bir kez kaydedilir; tekrar çağrıda mevcut snapshot döner. Doluluk mevcut `occupiesNight` kuralına, payda tüm oda sayısına göre hesaplanır. Konaklama geliri o geceyi tutan rezervasyonların gecelik fiyatıdır; bütün konaklama folyosu giriş tarihine yığılmaz. Ek folio gelirleri ve doğrudan ödenen POS siparişleri eklenir; odaya yazılan POS ikinci kez sayılmaz. Defterdeki gelir kayıtları aynı satışları temsil edebileceği için ayrıca eklenmez. Oda/rezervasyon durumlarını değiştirmez, yeni konaklama folyosu üretmez; boş veride sıfır döner. Gelecek güne gün sonu kaydedilemez.

### Yeni rotalar

| Rota | Sayfa | Menü grubu |
|---|---|---|
| `/cashier` | `pages/cashier/CashierPage.tsx` | Muhasebe |
| `/pos` | `pages/pos/PosPage.tsx` | Operasyon |
| `/rates` | `pages/rates/RatesPage.tsx` | Ön Büro |
| `/feedback` | `pages/guestcare/FeedbackPage.tsx` | Ön Büro |
| `/lost-found` | `pages/guestcare/LostFoundPage.tsx` | Ön Büro |
| `/kbs` | `pages/guestcare/KbsPage.tsx` | Ön Büro |

Sayfalar lazy yüklenir. Yer tutucuları ilgili sayfa ajanı geliştirecektir.
