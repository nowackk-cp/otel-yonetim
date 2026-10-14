import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollectionMap, CollectionName, Settings, ActivityLog, CashSession, NightAudit, FolioType } from '../types';
import { uid } from '../lib/id';
import { createSeed, type SeedData } from './seed';
import { round2 } from '../lib/calc';
import { todayStr } from '../lib/format';
import { calculateCashSessionBalance, calculateNightAuditMetrics, calculatePosOrderTotal, posLineAmount, validDate } from './moduleHelpers';

type Collections = { [K in CollectionName]: CollectionMap[K][] };

export interface StoreState extends Collections {
  settings: Settings;

  /** Yeni kayıt ekler, üretilen id'yi döndürür. */
  add: <K extends CollectionName>(collection: K, item: Omit<CollectionMap[K], 'id'>) => string;
  /** Kaydı kısmen günceller. */
  update: <K extends CollectionName>(collection: K, id: string, patch: Partial<Omit<CollectionMap[K], 'id'>>) => void;
  /** Kaydı siler. */
  remove: <K extends CollectionName>(collection: K, id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Tüm veriyi demo verisiyle sıfırlar. */
  resetDemoData: () => void;
  /** Aktivite günlüğüne kayıt ekler. */
  log: (message: string, module?: ActivityLog['module']) => void;
  postPosOrderToFolio: (orderId: string) => string[];
  closeCashSession: (sessionId: string, countedAmount: number, closedBy?: string, notes?: string) => CashSession;
  runNightAudit: (date: string, closedBy: string, notes?: string) => NightAudit;
}

const seed: SeedData = createSeed();
const NEW_COLLECTIONS = ['cashSessions', 'cashMovements', 'nightAudits', 'posOutlets', 'menuItems', 'posOrders', 'ratePlans', 'seasons', 'channels', 'guestFeedbacks', 'lostItems'] as const;

/** Eski kullanıcıya yeni demo ilişkileri karıştırılmaz; var olmayan koleksiyonlar boştur. */
export function migrateStoreState(persistedState: unknown): Partial<StoreState> {
  const previous = persistedState && typeof persistedState === 'object' ? persistedState as Partial<StoreState> : {};
  return { ...previous, ...Object.fromEntries(NEW_COLLECTIONS.map(key => [key, Array.isArray(previous[key]) ? previous[key] : []])) };
}
const activity = (logs: ActivityLog[], message: string, module: ActivityLog['module']) => [{ id: uid(), date: new Date().toISOString(), message, module }, ...logs].slice(0, 500);

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...seed,

      add: (collection, item) => {
        const id = uid();
        set((state) => ({
          [collection]: [...(state[collection] as unknown[]), { ...item, id }],
        }) as Partial<StoreState>);
        return id;
      },

      update: (collection, id, patch) =>
        set((state) => ({
          [collection]: (state[collection] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }) as Partial<StoreState>),

      remove: (collection, id) =>
        set((state) => ({
          [collection]: (state[collection] as { id: string }[]).filter((x) => x.id !== id),
        }) as Partial<StoreState>),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      resetDemoData: () => set(() => ({ ...createSeed() })),

      postPosOrderToFolio: (orderId) => {
        const state = get(); const order = state.posOrders.find(o => o.id === orderId);
        if (!order) throw new Error('Sipariş bulunamadı.');
        if (order.status === 'odendi' || order.status === 'iptal') throw new Error('Ödenmiş veya iptal sipariş odaya aktarılamaz.');
        const posted = state.folioItems.filter(f => f.sourceOrderId === orderId);
        if (posted.length) {
          if (posted.some(f => f.reservationId !== order.reservationId)) throw new Error('Siparişin folio bağlantısı rezervasyonla uyuşmuyor.');
          const ids = posted.map(f => f.id);
          if (order.status !== 'odaya_yazildi') set({ posOrders: state.posOrders.map(o => o.id === orderId ? { ...o, status: 'odaya_yazildi', folioItemIds: ids } : o) });
          return ids;
        }
        if (order.folioItemIds?.length) throw new Error('Aktarılmış folio kalemleri bulunamadı; siparişi tekrar aktarmadan kayıtları kontrol edin.');
        const reservation = state.reservations.find(r => r.id === order.reservationId);
        if (!reservation || reservation.status !== 'giris_yapti') throw new Error('Odaya aktarım için giriş yapmış bir rezervasyon seçin.');
        const room = state.rooms.find(r => r.id === reservation.roomId);
        if (!room || (order.roomNo && order.roomNo !== room.no)) throw new Error('Sipariş odası rezervasyonla uyuşmuyor.');
        const outlet = state.posOutlets.find(o => o.id === order.outletId);
        if (!outlet || !validDate(order.date)) throw new Error('Siparişin satış noktası veya tarihi geçersiz.');
        const total = calculatePosOrderTotal(order.items);
        const type: FolioType = outlet.type === 'spa' ? 'spa' : outlet.type === 'minibar' ? 'minibar' : 'restoran';
        const items = order.items.map(item => ({ id: uid('folio-'), reservationId: reservation.id, date: order.date,
          description: `${outlet.name} · ${item.name} × ${item.quantity}`, type, amount: posLineAmount(item), vatRate: item.vatRate, sourceOrderId: orderId }));
        const ids = items.map(item => item.id);
        set({ folioItems: [...state.folioItems, ...items], posOrders: state.posOrders.map(o => o.id === orderId ? { ...o, total, status: 'odaya_yazildi', roomNo: room.no, folioItemIds: ids } : o),
          activityLogs: activity(state.activityLogs, `${outlet.name} siparişi oda ${room.no} folyosuna aktarıldı`, 'operasyon') });
        return ids;
      },

      closeCashSession: (sessionId, countedAmount, closedBy, notes) => {
        const state = get(); const session = state.cashSessions.find(s => s.id === sessionId);
        if (!session) throw new Error('Kasa oturumu bulunamadı.');
        if (!Number.isFinite(countedAmount) || countedAmount < 0) throw new Error('Sayılan tutar sıfır veya pozitif olmalı.');
        if (session.status === 'kapali') {
          if (session.countedAmount === round2(countedAmount)) return session;
          throw new Error('Kapalı kasa farklı bir sayımla tekrar kapatılamaz.');
        }
        const actor = closedBy ?? session.employeeId;
        if (!state.employees.some(e => e.id === actor)) throw new Error('Kasayı kapatan çalışan bulunamadı.');
        const expectedBalance = calculateCashSessionBalance(session, state.cashMovements);
        const closed: CashSession = { ...session, status: 'kapali', closedAt: new Date().toISOString(), closedBy: actor,
          countedAmount: round2(countedAmount), expectedBalance, difference: round2(countedAmount - expectedBalance), notes: notes ?? session.notes };
        set({ cashSessions: state.cashSessions.map(s => s.id === sessionId ? closed : s), activityLogs: activity(state.activityLogs, `${session.date} kasa oturumu kapatıldı; fark ${closed.difference} TRY`, 'muhasebe') });
        return closed;
      },

      runNightAudit: (date, closedBy, notes = '') => {
        const state = get();
        if (!validDate(date) || date > todayStr()) throw new Error('Gün sonu için bugün veya geçmiş bir tarih seçin.');
        const existing = state.nightAudits.find(a => a.date === date);
        if (existing) return existing;
        if (!state.employees.some(e => e.id === closedBy)) throw new Error('Gün sonunu kapatan çalışan bulunamadı.');
        const audit: NightAudit = { id: uid('audit-'), date, ...calculateNightAuditMetrics(date, state.rooms, state.reservations, state.folioItems, state.posOrders, state.posOutlets),
          closedBy, closedAt: new Date().toISOString(), notes };
        set({ nightAudits: [...state.nightAudits, audit], activityLogs: activity(state.activityLogs, `${date} gün sonu tamamlandı`, 'muhasebe') });
        return audit;
      },

      log: (message, module = 'genel') =>
        set((state) => ({
          activityLogs: [
            { id: uid(), date: new Date().toISOString(), message, module },
            ...state.activityLogs,
          ].slice(0, 500),
        })),
    }),
    {
      name: 'otel-store',
      version: 3,
      migrate: (persistedState) => migrateStoreState(persistedState),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') return currentState;
        const persisted = migrateStoreState(persistedState);
        return {
          ...currentState,
          ...persisted,
          settings: { ...currentState.settings, ...persisted.settings },
        };
      },
    },
  ),
);

/** Hook dışında (örn. olay yöneticilerinde) anlık erişim: getState() */
export const getStore = () => useStore.getState();
