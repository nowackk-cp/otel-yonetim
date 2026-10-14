import type { BadgeColor } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import type { GeneralTaskStatus, Priority, ShiftType } from '../../types';

export const PRIORITY_LABEL: Record<Priority, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  acil: 'Acil',
};

export const PRIORITY_COLOR: Record<Priority, BadgeColor> = {
  dusuk: 'slate',
  orta: 'sky',
  yuksek: 'amber',
  acil: 'rose',
};

export const TASK_STATUS_LABEL: Record<GeneralTaskStatus, string> = {
  yapilacak: 'Yapılacak',
  devam: 'Devam Ediyor',
  tamamlandi: 'Tamamlandı',
};

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  sabah: 'Sabah',
  aksam: 'Akşam',
  gece: 'Gece',
  ozel: 'Özel',
};

/** Etiket sözlüğünü <Select> seçeneklerine çevirir. */
export function toOptions<T extends string>(labels: Record<T, string>): SelectOption[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

/** Form girdisi (string) -> sayı. Boş/geçersiz girdi 0 olur. */
export function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
