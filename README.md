<div align="center">

# 🏨 Otel Yönetim Sistemi

**Ön bürodan muhasebeye, İK'dan restorana — bir otelin tüm operasyonu tek ekranda.**

Türkçe arayüzlü, tamamen tarayıcıda çalışan, backend gerektirmeyen modern otel yönetim uygulaması.

[![Canlı Demo](https://img.shields.io/badge/▶_Canlı_Demo-Hemen_Dene-6366f1?style=for-the-badge)](https://nowackk-cp.github.io/otel-yonetim/)
[![Demo Video](https://img.shields.io/badge/🎬_Video-MP4_İndir-0f172a?style=for-the-badge)](docs/media/demo.mp4)

![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38?logo=react&logoColor=white)
![Tests](https://img.shields.io/badge/testler-145_geçti-22c55e)
![Modules](https://img.shields.io/badge/modül-26_sayfa-f59e0b)

<br/>

<img src="docs/media/demo.gif" alt="Otel Yönetim Sistemi tanıtım videosu" width="900"/>

<sub>🎬 35 saniyelik tur: gösterge paneli → odalar → yeni rezervasyon → takvim → restoran POS → muhasebe → raporlar → vardiya → bordro → görevler → global arama → koyu tema</sub>

</div>

---

## 📑 İçindekiler

- [✨ Neden bu proje?](#-neden-bu-proje)
- [🚀 Hızlı başlangıç](#-hızlı-başlangıç)
- [🧭 Modüller](#-modüller) — tıklayarak her modülün ekran görüntüsünü açın
- [🔗 Modüller arası otomatik akışlar](#-modüller-arası-otomatik-akışlar)
- [🌗 Açık / koyu tema & 📱 mobil](#-açık--koyu-tema---mobil)
- [🏗️ Mimari](#️-mimari)
- [💾 Veri, yedekleme ve sıfırlama](#-veri-yedekleme-ve-sıfırlama)
- [🧪 Testler](#-testler)
- [🎥 Demo videosunu yeniden üretme](#-demo-videosunu-yeniden-üretme)

---

## ✨ Neden bu proje?

| | |
|---|---|
| ⚡ **Kurulum yok** | Backend, veritabanı veya sunucu yok. `npm run dev` ve hazır — tüm veri tarayıcıda (`localStorage`). |
| 🧩 **26 entegre modül** | Ön büro, muhasebe, vergi, İK, bordro, kat hizmetleri, bakım, stok, POS, KBS… hepsi birbiriyle konuşur. |
| 🇹🇷 **Türkiye'ye özel** | KDV, konaklama vergisi, SGK/işsizlik, gelir ve damga vergisi, kümülatif matrah, KBS emniyet bildirimi. |
| 🔁 **Otomatik akışlar** | Check-out yapınca oda "kirli" olur ve kat hizmeti görevi açılır; POS'ta "odaya yaz" faturaya düşer. |
| 🌗 **Açık/koyu tema** | Sistem temasını algılar, tek tıkla değişir. |
| 📱 **Mobil uyumlu** | Telefonda açılır menü, tablette daraltılabilir kenar çubuğu. |
| 🎲 **Gerçekçi demo veri** | İlk açılışta bugünün tarihine göre 40 oda, misafirler, rezervasyonlar, personel ve bordrolar üretilir. |

---

## 🚀 Hızlı başlangıç

> **Gereksinim:** Node.js 22+

```bash
git clone https://github.com/nowackk-cp/otel-yonetim.git
cd otel-yonetim
npm install
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini açın. Giriş ekranı yok, doğrudan gösterge paneline düşersiniz.

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (HMR) |
| `npm run build` | Tip kontrolü + üretim derlemesi (sayfalar route bazlı kod bölmeli) |
| `npm run preview` | Üretim çıktısını önizle |
| `npm test` | vitest smoke testleri + vergi/bordro hesap testleri |

> 💡 Kurmadan denemek mi istiyorsunuz? **[Canlı demo](https://nowackk-cp.github.io/otel-yonetim/)** her `main` push'unda GitHub Pages'e otomatik yayınlanır.

---

## 🧭 Modüller

> 👇 Her başlığa tıklayın — özellikler ve ekran görüntüsü açılır.

### 📊 Genel

<details>
<summary><b>Gösterge Paneli</b> — doluluk, gelir, ADR/RevPAR, bugünkü hareketler</summary>
<br/>

- Doluluk oranı, boş oda, bugünkü giriş/çıkışlar, oteldeki misafir sayısı
- Aylık gelir, işteki personel, F&B cirosu, ortalama misafir puanı, kasa durumu
- 30 günlük gelir trendi ve oda durumu dağılımı grafikleri
- Üst bar: **global arama** (sayfa, misafir, oda, rezervasyon, çalışan — Enter ile ilk sonuca git), **bildirim zili** (düşük stok, bekleyen izinler, bugünkü giriş/çıkışlar), tarih/saat ve tema düğmesi

<img src="screenshots/desktop_light_01_dashboard.png" width="100%"/>
</details>

### 🛎️ Ön Büro

<details>
<summary><b>Odalar</b> — oda ve oda tipi yönetimi, kat planı</summary>
<br/>

Durumlar: `boş` · `dolu` · `kirli` · `temizleniyor` · `bakımda` · `bloke`. Kat, tip ve duruma göre filtreleme.

<img src="screenshots/desktop_light_02_rooms.png" width="100%"/>
</details>

<details>
<summary><b>Rezervasyonlar</b> — oluşturma, check-in/out, folio, tahsilat</summary>
<br/>

Tarih aralığına göre yalnızca müsait odalar listelenir. Kanal ve fiyat planı seçimi, gecelik fiyat sezon çarpanıyla otomatik hesaplanır. Folio kalemleri, tahsilat ve hesap dökümü.

<img src="screenshots/desktop_light_03_reservations.png" width="100%"/>
</details>

<details>
<summary><b>Takvim</b> — oda bazlı doluluk takvimi</summary>
<br/>
<img src="screenshots/desktop_light_04_calendar.png" width="100%"/>
</details>

<details>
<summary><b>Misafirler</b> — profil, konaklama geçmişi, VIP ve kara liste, KBS alanları</summary>
<br/>
<img src="screenshots/desktop_light_05_guests.png" width="100%"/>
</details>

<details>
<summary><b>Fiyat & Kanallar</b> — fiyat planları, sezonlar, satış kanalları, 30 günlük fiyat takvimi</summary>
<br/>
<img src="screenshots/desktop_light_06_rates.png" width="100%"/>
</details>

<details>
<summary><b>Misafir Memnuniyeti · Kayıp Eşya · Emniyet Bildirimi (KBS)</b></summary>
<br/>

| Memnuniyet | Kayıp Eşya | KBS |
|---|---|---|
| <img src="screenshots/desktop_light_07_feedback.png"/> | <img src="screenshots/desktop_light_08_lost_found.png"/> | <img src="screenshots/desktop_light_09_kbs.png"/> |
</details>

### 💰 Muhasebe

<details>
<summary><b>Gelir & Gider</b> — kasa/banka defteri, KDV ayrıştırma</summary>
<br/>
<img src="screenshots/desktop_light_10_accounting.png" width="100%"/>
</details>

<details>
<summary><b>Kasa & Gün Sonu</b> — kasa oturumu, döviz bozdurma, sayım farkı, night audit</summary>
<br/>

Tahsilat ve ödemeler muhasebeye otomatik olarak gelir/gider yazılır.

<img src="screenshots/desktop_light_11_cashier.png" width="100%"/>
</details>

<details>
<summary><b>Faturalar · Vergiler · Raporlar</b> — KDV, konaklama vergisi, muhtasar/damga, CSV dışa aktarma</summary>
<br/>

| Faturalar | Vergiler | Raporlar |
|---|---|---|
| <img src="screenshots/desktop_light_12_invoices.png"/> | <img src="screenshots/desktop_light_13_taxes.png"/> | <img src="screenshots/desktop_light_14_reports.png"/> |
</details>

### 👥 İnsan Kaynakları

<details>
<summary><b>Personel · Vardiyalar · Puantaj · İzinler</b></summary>
<br/>

- **Personel:** maaş, mola hakkı, yıllık izin hakkı
- **Vardiyalar:** şablonlar, gece vardiyası, çakışma ve dinlenme süresi uyarıları, geçen haftayı kopyala
- **Puantaj:** giriş/çıkış/mola, fazla mesai
- **İzinler:** talepler, onay akışı, bakiyeler

| Personel | Vardiyalar |
|---|---|
| <img src="screenshots/desktop_light_15_staff.png"/> | <img src="screenshots/desktop_light_16_shifts.png"/> |
| **Puantaj** | **İzinler** |
| <img src="screenshots/desktop_light_17_attendance.png"/> | <img src="screenshots/desktop_light_18_leaves.png"/> |
</details>

<details>
<summary><b>Bordro</b> — SGK, işsizlik, gelir & damga vergisi, kümülatif matrah, maaş pusulası</summary>
<br/>

Netten brüte / brütten nete hesaplama, vergi dilimleri ve SGK tavanı desteklenir. Parametreler Ayarlar'dan değiştirilebilir.

<img src="screenshots/desktop_light_19_payroll.png" width="100%"/>
</details>

### 🧹 Operasyon

<details>
<summary><b>Kat Hizmetleri · Bakım & Arıza · Stok & Envanter</b></summary>
<br/>

| Kat Hizmetleri | Bakım & Arıza | Stok & Envanter |
|---|---|---|
| <img src="screenshots/desktop_light_20_housekeeping.png"/> | <img src="screenshots/desktop_light_21_maintenance.png"/> | <img src="screenshots/desktop_light_22_inventory.png"/> |
</details>

<details>
<summary><b>Restoran & Bar (POS)</b> — satış noktaları, menü, sipariş, "odaya yaz"</summary>
<br/>

Siparişi misafir folyosuna yazın ya da nakit/kart ile kapatın; satış raporu dahil.

<img src="screenshots/desktop_light_23_pos.png" width="100%"/>
</details>

### ⚙️ Yönetim

<details>
<summary><b>Tedarikçiler · Görevler (kanban) · Ayarlar</b></summary>
<br/>

Ayarlar: otel bilgileri, vergi oranları, bordro parametreleri, vardiya şablonları, veri yönetimi.

| Tedarikçiler | Görevler | Ayarlar |
|---|---|---|
| <img src="screenshots/desktop_light_24_suppliers.png"/> | <img src="screenshots/desktop_light_25_tasks.png"/> | <img src="screenshots/desktop_light_26_settings.png"/> |
</details>

---

## 🔗 Modüller arası otomatik akışlar

Modüller ayrı ada değil; bir yerde yapılan işlem ilgili tüm modüllere yansır. Tüm muhasebe kayıtları **belge no ile çift kayda karşı korumalıdır**.

```mermaid
flowchart LR
    subgraph ON["🛎️ Ön Büro"]
        CI[Check-in]
        CO[Check-out]
        FOL[Folio]
    end
    subgraph OPS["🧹 Operasyon"]
        HK[Kat hizmeti görevi]
        MT[Arıza kaydı]
        STK[Stok girişi]
        POS[POS siparişi]
    end
    subgraph ACC["💰 Muhasebe"]
        LED[(Gelir / Gider defteri)]
        INV[Fatura]
    end
    subgraph HR["👥 İK"]
        PAY[Bordro]
    end
    ROOM{{Oda durumu}}

    CI -- "dolu" --> ROOM
    CO -- "kirli" --> ROOM
    CO --> HK
    HK -- "temizlendi → boş" --> ROOM
    MT -- "bakımda" --> ROOM
    POS -- "odaya yaz" --> FOL
    FOL --> INV
    FOL -- "tahsilat" --> LED
    POS -- "nakit / kart" --> LED
    PAY -- "ödendi" --> LED
    MT -- "kapanış maliyeti" --> LED
    STK -. "isteğe bağlı gider" .-> LED
    KASA[Kasa & Gün Sonu] --> LED
```

<details>
<summary>📋 Akışların metin listesi</summary>

- Check-in → oda `dolu`; check-out → oda `kirli` + kat hizmeti görevi.
- Kat hizmeti temizliği tamamlanınca oda `boş`.
- Folio tahsilatı, kasa tahsilatı/ödemesi ve doğrudan ödenen POS siparişi → muhasebeye gelir/gider kaydı.
- POS "odaya yaz" → folio kalemi → check-out faturası.
- Bordro "ödendi" → muhasebeye gider (tekrar tıklamada çift kayıt oluşmaz).
- Arıza kapatma (maliyet > 0) → "Bakım & Onarım" gideri; arıza açılırken oda bakıma alınabilir.
- Stok girişi (satın alma) → isteğe bağlı gider kaydı.
</details>

### Bir rezervasyonun yaşam döngüsü

```mermaid
stateDiagram-v2
    [*] --> opsiyon
    opsiyon --> onayli: onayla
    opsiyon --> iptal
    onayli --> giris_yapti: check-in (oda → dolu)
    onayli --> iptal
    onayli --> no_show
    giris_yapti --> cikis_yapti: check-out (oda → kirli, fatura)
    cikis_yapti --> [*]
    iptal --> [*]
    no_show --> [*]
```

---

## 🌗 Açık / koyu tema & 📱 mobil

<table>
<tr>
<td width="72%" valign="top">

**Masaüstü — açık ve koyu tema**

<img src="screenshots/desktop_light_01_dashboard.png" width="49%"/> <img src="screenshots/desktop_dark_01_dashboard.png" width="49%"/>
<img src="screenshots/desktop_light_23_pos.png" width="49%"/> <img src="screenshots/desktop_dark_23_pos.png" width="49%"/>

</td>
<td width="28%" valign="top" align="center">

**Mobil**

<img src="docs/media/mobile.gif" width="100%" alt="Mobil görünüm"/>

</td>
</tr>
</table>

<details>
<summary>🖼️ <b>Tüm koyu tema ekranları (26)</b></summary>
<br/>

| | | |
|---|---|---|
| <img src="screenshots/desktop_dark_02_rooms.png"/> | <img src="screenshots/desktop_dark_03_reservations.png"/> | <img src="screenshots/desktop_dark_04_calendar.png"/> |
| <img src="screenshots/desktop_dark_05_guests.png"/> | <img src="screenshots/desktop_dark_06_rates.png"/> | <img src="screenshots/desktop_dark_07_feedback.png"/> |
| <img src="screenshots/desktop_dark_08_lost_found.png"/> | <img src="screenshots/desktop_dark_09_kbs.png"/> | <img src="screenshots/desktop_dark_10_accounting.png"/> |
| <img src="screenshots/desktop_dark_11_cashier.png"/> | <img src="screenshots/desktop_dark_12_invoices.png"/> | <img src="screenshots/desktop_dark_13_taxes.png"/> |
| <img src="screenshots/desktop_dark_14_reports.png"/> | <img src="screenshots/desktop_dark_15_staff.png"/> | <img src="screenshots/desktop_dark_16_shifts.png"/> |
| <img src="screenshots/desktop_dark_17_attendance.png"/> | <img src="screenshots/desktop_dark_18_leaves.png"/> | <img src="screenshots/desktop_dark_19_payroll.png"/> |
| <img src="screenshots/desktop_dark_20_housekeeping.png"/> | <img src="screenshots/desktop_dark_21_maintenance.png"/> | <img src="screenshots/desktop_dark_22_inventory.png"/> |
| <img src="screenshots/desktop_dark_24_suppliers.png"/> | <img src="screenshots/desktop_dark_25_tasks.png"/> | <img src="screenshots/desktop_dark_26_settings.png"/> |
</details>

<details>
<summary>📱 <b>Mobil ekranlar</b></summary>
<br/>

| | | | |
|---|---|---|---|
| <img src="screenshots/mobile_01_dashboard.png"/> | <img src="screenshots/mobile_menu_open.png"/> | <img src="screenshots/mobile_02_rooms.png"/> | <img src="screenshots/mobile_03_reservations.png"/> |
| <img src="screenshots/mobile_04_calendar.png"/> | <img src="screenshots/mobile_10_accounting.png"/> | <img src="screenshots/mobile_19_payroll.png"/> | <img src="screenshots/mobile_23_pos.png"/> |
</details>

---

## 🏗️ Mimari

```mermaid
flowchart TB
    UI["📄 pages/&lt;modül&gt;/<br/>26 route, lazy-loaded"]
    CMP["🧱 components/ui + layout<br/>Card, DataTable, Modal, Drawer, Tabs, Toast…"]
    STORE["🗃️ store/useStore.ts<br/>tek zustand store · add / update / remove / log"]
    LIB["🧮 lib/<br/>format · calc · payroll · id"]
    SEED["🎲 store/seed.ts<br/>bugüne göre demo veri"]
    LS[("💾 localStorage<br/>otel-store")]

    UI --> CMP
    UI --> STORE
    UI --> LIB
    SEED --> STORE
    STORE <-- "persist" --> LS
```

**Teknoloji:** Vite · React 18 · TypeScript · TailwindCSS v3 · react-router-dom v6 · zustand (persist) · recharts · lucide-react · date-fns
**Test:** vitest · Testing Library · jsdom · node:test

```
src/
├── types.ts             Tüm varlık tipleri (Room, Reservation, Employee, …)
├── store/               zustand store, demo veri (seed), muhasebe bağlantıları
├── lib/                 format, calc, payroll, id yardımcıları
├── components/
│   ├── ui/              Ortak UI bileşenleri
│   └── layout/          Kenar çubuğu, üst bar, tema
├── pages/
│   ├── dashboard/       Gösterge paneli
│   ├── frontdesk/       Odalar, rezervasyonlar, takvim, misafirler
│   ├── rates/           Fiyat planları, sezonlar, kanallar
│   ├── guestcare/       Memnuniyet, kayıp eşya, KBS
│   ├── accounting/      Gelir-gider, faturalar, vergiler, raporlar
│   ├── cashier/         Kasa & gün sonu
│   ├── hr/              Personel, vardiya, puantaj, izin, bordro
│   ├── operations/      Kat hizmetleri, bakım, stok
│   ├── pos/             Restoran & bar
│   └── admin/           Tedarikçiler, görevler, ayarlar
└── test/                vitest kurulumu ve smoke testleri
```

Yeni modül yazacaklar için geliştirici sözleşmesi: **[CONTRACT.md](./CONTRACT.md)**

---

## 💾 Veri, yedekleme ve sıfırlama

> ⚠️ Veri yalnızca kullandığınız tarayıcıda saklanır. Tarayıcı verilerini temizlerseniz kaybolur — düzenli yedek alın.

| İşlem | Nasıl? |
|---|---|
| **Yedekle / geri yükle** | Ayarlar → Veri sekmesi → JSON dışa aktar / içe aktar |
| **Demo veriye sıfırla** | Ayarlar → Veri sekmesi, ya da konsolda `useStore.getState().resetDemoData()` |
| **Tamamen temizle** | DevTools → Application → localStorage → `otel-store` anahtarını silip sayfayı yenileyin |

---

## 🧪 Testler

```bash
npm test
```

- **93 vitest testi** — her sayfanın hatasız render olduğu smoke testleri, POS, fiyat hesapları, modüller arası bağlantılar
- **52 node:test testi** — KDV/konaklama vergisi ve bordro motoru (dilimler, SGK tavanı, kümülatif matrah, netten brüte)

---

## 🎥 Demo videosunu yeniden üretme

README'deki GIF ve MP4, Playwright ile otomatik kaydedilir:

```bash
npm run build
node scripts/record_demo.cjs          # docs/media/demo.webm + mobile.webm
ffmpeg -i docs/media/demo.webm -c:v libx264 -pix_fmt yuv420p docs/media/demo.mp4
```

Tüm sayfaların açık/koyu/mobil ekran görüntüleri için: `node scripts/capture_all.cjs`

---

<div align="center">

**[▶ Canlı demoyu aç](https://nowackk-cp.github.io/otel-yonetim/)** · **[⬆ Başa dön](#-otel-yönetim-sistemi)**

</div>
