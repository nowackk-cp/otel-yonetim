import {
  LayoutDashboard, BedDouble, CalendarCheck, CalendarDays, Users, Wallet, FileText, Landmark, BarChart3,
  UserCog, Clock, Fingerprint, Plane, Banknote, SprayCan, Wrench, Package, Truck, ListChecks, Settings,
  UtensilsCrossed, Tags, MessageSquare, Search, ShieldCheck, ReceiptText, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  { title: 'Genel', items: [{ to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard }] },
  {
    title: 'Ön Büro',
    items: [
      { to: '/rooms', label: 'Odalar', icon: BedDouble },
      { to: '/reservations', label: 'Rezervasyonlar', icon: CalendarCheck },
      { to: '/calendar', label: 'Takvim', icon: CalendarDays },
      { to: '/guests', label: 'Misafirler', icon: Users },
      { to: '/rates', label: 'Fiyat & Kanallar', icon: Tags },
      { to: '/feedback', label: 'Misafir Memnuniyeti', icon: MessageSquare },
      { to: '/lost-found', label: 'Kayıp Eşya', icon: Search },
      { to: '/kbs', label: 'Emniyet Bildirimi (KBS)', icon: ShieldCheck },
    ],
  },
  {
    title: 'Muhasebe',
    items: [
      { to: '/accounting', label: 'Gelir & Gider', icon: Wallet },
      { to: '/cashier', label: 'Kasa & Gün Sonu', icon: ReceiptText },
      { to: '/invoices', label: 'Faturalar', icon: FileText },
      { to: '/taxes', label: 'Vergiler', icon: Landmark },
      { to: '/reports', label: 'Raporlar', icon: BarChart3 },
    ],
  },
  {
    title: 'İnsan Kaynakları',
    items: [
      { to: '/staff', label: 'Personel', icon: UserCog },
      { to: '/shifts', label: 'Vardiyalar', icon: Clock },
      { to: '/attendance', label: 'Puantaj', icon: Fingerprint },
      { to: '/leaves', label: 'İzinler', icon: Plane },
      { to: '/payroll', label: 'Bordro', icon: Banknote },
    ],
  },
  {
    title: 'Operasyon',
    items: [
      { to: '/housekeeping', label: 'Kat Hizmetleri', icon: SprayCan },
      { to: '/maintenance', label: 'Bakım & Arıza', icon: Wrench },
      { to: '/inventory', label: 'Stok & Envanter', icon: Package },
      { to: '/pos', label: 'Restoran & Bar', icon: UtensilsCrossed },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { to: '/suppliers', label: 'Tedarikçiler', icon: Truck },
      { to: '/tasks', label: 'Görevler', icon: ListChecks },
      { to: '/settings', label: 'Ayarlar', icon: Settings },
    ],
  },
];
