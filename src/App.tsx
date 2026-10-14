import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const RoomsPage = lazy(() => import('./pages/frontdesk/RoomsPage'));
const ReservationsPage = lazy(() => import('./pages/frontdesk/ReservationsPage'));
const CalendarPage = lazy(() => import('./pages/frontdesk/CalendarPage'));
const GuestsPage = lazy(() => import('./pages/frontdesk/GuestsPage'));
const AccountingPage = lazy(() => import('./pages/accounting/AccountingPage'));
const InvoicesPage = lazy(() => import('./pages/accounting/InvoicesPage'));
const TaxesPage = lazy(() => import('./pages/accounting/TaxesPage'));
const ReportsPage = lazy(() => import('./pages/accounting/ReportsPage'));
const StaffPage = lazy(() => import('./pages/hr/StaffPage'));
const ShiftsPage = lazy(() => import('./pages/hr/ShiftsPage'));
const AttendancePage = lazy(() => import('./pages/hr/AttendancePage'));
const LeavesPage = lazy(() => import('./pages/hr/LeavesPage'));
const PayrollPage = lazy(() => import('./pages/hr/PayrollPage'));
const HousekeepingPage = lazy(() => import('./pages/operations/HousekeepingPage'));
const MaintenancePage = lazy(() => import('./pages/operations/MaintenancePage'));
const InventoryPage = lazy(() => import('./pages/operations/InventoryPage'));
const SuppliersPage = lazy(() => import('./pages/admin/SuppliersPage'));
const TasksPage = lazy(() => import('./pages/admin/TasksPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const CashierPage = lazy(() => import('./pages/cashier/CashierPage'));
const PosPage = lazy(() => import('./pages/pos/PosPage'));
const RatesPage = lazy(() => import('./pages/rates/RatesPage'));
const FeedbackPage = lazy(() => import('./pages/guestcare/FeedbackPage'));
const LostFoundPage = lazy(() => import('./pages/guestcare/LostFoundPage'));
const KbsPage = lazy(() => import('./pages/guestcare/KbsPage'));

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/taxes" element={<TaxesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leaves" element={<LeavesPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/housekeeping" element={<HousekeepingPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/cashier" element={<CashierPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/rates" element={<RatesPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/lost-found" element={<LostFoundPage />} />
          <Route path="/kbs" element={<KbsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
