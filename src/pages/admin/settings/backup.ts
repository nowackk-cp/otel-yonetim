import { useStore, type StoreState } from '../../../store/useStore';
import { defaultSettings } from '../../../store/seed';
import type { CollectionName } from '../../../types';
import { todayStr } from '../../../lib/format';

export const BACKUP_VERSION = 1;

/** Yedeğe dahil edilen tüm koleksiyonlar (settings ayrıca yazılır). */
export const COLLECTION_KEYS: CollectionName[] = [
  'rooms',
  'roomTypes',
  'guests',
  'reservations',
  'folioItems',
  'payments',
  'transactions',
  'invoices',
  'employees',
  'shifts',
  'shiftTemplates',
  'attendance',
  'leaveRequests',
  'payrolls',
  'housekeepingTasks',
  'maintenanceTickets',
  'inventoryItems',
  'stockMovements',
  'suppliers',
  'tasks',
  'activityLogs',
];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Mevcut store verisini JSON dosyası olarak indirir. */
export function exportBackup() {
  const state = useStore.getState();
  const data: Record<string, unknown> = {
    app: 'otel-yonetim',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
  };
  COLLECTION_KEYS.forEach((key) => {
    data[key] = state[key];
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `otel-yedek-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedBackup {
  data: Partial<StoreState>;
  recordCount: number;
}

/** İçe aktarılan JSON'u doğrular. Hata varsa mesaj, geçerliyse store'a yazılacak veriyi döndürür. */
export function parseBackup(text: string): ParsedBackup | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'Dosya geçerli bir JSON değil';
  }
  if (!isRecord(parsed)) return 'Dosya beklenen yedek yapısında değil';

  const next: Record<string, unknown> = {};
  let recordCount = 0;

  if (isRecord(parsed.settings)) {
    // Eksik alanlar varsayılanlarla tamamlanır
    next.settings = { ...defaultSettings(), ...parsed.settings };
  }
  COLLECTION_KEYS.forEach((key) => {
    const value = parsed[key];
    if (Array.isArray(value)) {
      next[key] = value;
      recordCount += value.length;
    }
  });

  if (!('settings' in next) && recordCount === 0) return 'Dosyada tanınabilir otel verisi bulunamadı';
  return { data: next as Partial<StoreState>, recordCount };
}
