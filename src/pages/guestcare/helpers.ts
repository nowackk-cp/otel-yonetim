import type { BadgeColor, SelectOption } from '../../components/ui';
import type { Employee, FeedbackStatus, Guest, GuestFeedback, LostItem, Priority } from '../../types';

// ---------- Geri bildirim ----------
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  yeni: 'Yeni',
  inceleniyor: 'İnceleniyor',
  cozuldu: 'Çözüldü',
  kapatildi: 'Kapatıldı',
};

export const FEEDBACK_STATUS_COLOR: Record<FeedbackStatus, BadgeColor> = {
  yeni: 'sky',
  inceleniyor: 'amber',
  cozuldu: 'emerald',
  kapatildi: 'slate',
};

export const FEEDBACK_TYPE_LABEL: Record<GuestFeedback['type'], string> = {
  memnuniyet: 'Memnuniyet',
  oneri: 'Öneri',
  sikayet: 'Şikâyet',
};

export const FEEDBACK_TYPE_COLOR: Record<GuestFeedback['type'], BadgeColor> = {
  memnuniyet: 'emerald',
  oneri: 'indigo',
  sikayet: 'rose',
};

export const PRIORITY_LABEL: Record<Priority, string> = { dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek', acil: 'Acil' };

/** Grafiklerde ve filtrelerde kullanılan kategori grupları. */
export const CATEGORY_GROUPS = ['Temizlik', 'Personel', 'Yemek', 'Konum', 'Fiyat/Performans'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number] | 'Diğer';

/** Serbest metin kategoriyi (örn. "Yiyecek & İçecek", "Oda") gruba eşler. Eşleşmeyen → "Diğer". */
export function categoryGroup(raw: string): CategoryGroup {
  const c = raw.toLocaleLowerCase('tr-TR');
  if (c.includes('temizlik') || c === 'oda') return 'Temizlik';
  if (c.includes('personel') || c === 'hizmet') return 'Personel';
  if (c.includes('yiyecek') || c.includes('yemek') || c.includes('içecek')) return 'Yemek';
  if (c.includes('konum')) return 'Konum';
  if (c.includes('fiyat')) return 'Fiyat/Performans';
  return 'Diğer';
}

/** Puana göre varsayılan geri bildirim türü. */
export function typeForRating(rating: GuestFeedback['rating']): GuestFeedback['type'] {
  if (rating <= 2) return 'sikayet';
  if (rating <= 4) return 'oneri';
  return 'memnuniyet';
}

export function averageRating(items: Pick<GuestFeedback, 'rating'>[]): number | null {
  if (!items.length) return null;
  return items.reduce((s, f) => s + f.rating, 0) / items.length;
}

// ---------- Kayıp eşya ----------
export const LOST_STATUS_LABEL: Record<LostItem['status'], string> = {
  depoda: 'Depoda',
  teslim_edildi: 'Teslim Edildi',
  imha: 'İmha Edildi',
};

export const LOST_STATUS_COLOR: Record<LostItem['status'], BadgeColor> = {
  depoda: 'sky',
  teslim_edildi: 'emerald',
  imha: 'slate',
};

/** Depoda bekleyen eşya bu gün sayısını geçerse uyarı verilir. */
export const LOST_WARNING_DAYS = 90;

// ---------- KBS ----------
export const IDENTITY_LABEL: Record<NonNullable<Guest['identityType']>, string> = {
  tc_kimlik: 'T.C. Kimlik',
  pasaport: 'Pasaport',
  yabanci_kimlik: 'Yabancı Kimlik',
};

/** Kimlik tipi açık değilse uyrukla tahmin edilir (Türkiye → T.C. kimlik). */
export function identityTypeOf(g: Guest): NonNullable<Guest['identityType']> {
  if (g.identityType) return g.identityType;
  return g.nationality === 'Türkiye' ? 'tc_kimlik' : 'pasaport';
}

export function identityNumberOf(g: Guest): string {
  const type = identityTypeOf(g);
  return type === 'tc_kimlik' ? g.idNo : g.passportNo || g.idNo;
}

/** KBS için zorunlu ama eksik olan alanların listesi (boşsa kayıt tamamdır). */
export function missingKbsFields(g: Guest): string[] {
  const type = identityTypeOf(g);
  const missing: string[] = [];
  if (!g.fullName.trim()) missing.push('Ad soyad');
  if (!g.nationality.trim()) missing.push('Uyruk');
  if (!g.birthDate) missing.push('Doğum tarihi');
  const no = identityNumberOf(g).trim();
  if (type === 'tc_kimlik') {
    if (!/^\d{11}$/.test(no)) missing.push('T.C. kimlik no (11 hane)');
    if (!g.birthPlace?.trim()) missing.push('Doğum yeri');
    if (!g.fatherName?.trim()) missing.push('Baba adı');
    if (!g.motherName?.trim()) missing.push('Anne adı');
  } else if (!no) {
    missing.push(type === 'pasaport' ? 'Pasaport no' : 'Kimlik no');
  }
  return missing;
}

/** Aktif çalışanlar için <Select> seçenekleri. */
export function employeeOptions(employees: Employee[]): SelectOption[] {
  return employees
    .filter((e) => e.active)
    .map((e) => ({ value: e.id, label: `${e.fullName} · ${e.position}` }));
}
