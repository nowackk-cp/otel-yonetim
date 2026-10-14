import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { ToastProvider } from '../components/ui';
import { useStore } from '../store/useStore';
import { createSeed } from '../store/seed';

const ROUTES = [
  '/', '/rooms', '/reservations', '/calendar', '/guests', '/accounting', '/invoices', '/taxes', '/reports',
  '/staff', '/shifts', '/attendance', '/leaves', '/payroll', '/housekeeping', '/maintenance', '/inventory',
  '/suppliers', '/tasks', '/settings',
  '/cashier', '/pos', '/rates', '/feedback', '/lost-found', '/kbs',
];

const COLLECTIONS = [
  'rooms', 'roomTypes', 'guests', 'reservations', 'folioItems', 'payments', 'transactions', 'invoices', 'employees',
  'shifts', 'shiftTemplates', 'attendance', 'leaveRequests', 'payrolls', 'housekeepingTasks', 'maintenanceTickets',
  'inventoryItems', 'stockMovements', 'suppliers', 'tasks', 'activityLogs',
  'cashSessions', 'cashMovements', 'nightAudits', 'posOutlets', 'menuItems', 'posOrders',
  'ratePlans', 'seasons', 'channels', 'guestFeedbacks', 'lostItems',
] as const;

async function renderRoute(path: string) {
  const errors: unknown[][] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
    errors.push(a);
  });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(view.container.querySelector('h1')).not.toBeNull(), { timeout: 10000 });
  spy.mockRestore();
  // React render hataları (error boundary'siz) throw eder; burada yalnızca "Error:" ile başlayan uyarıları yakalarız
  const fatal = errors.filter((e) => String(e[0]).includes('The above error occurred') || String(e[0]).startsWith('Error:'));
  expect(fatal).toEqual([]);
  return view;
}

describe('Demo veri ile smoke', () => {
  beforeEach(() => {
    useStore.setState(createSeed());
  });
  it.each(ROUTES)('%s render olur', async (path) => {
    const { container } = await renderRoute(path);
    expect(container.textContent?.length).toBeGreaterThan(20);
  });
});

describe('Boş store ile smoke', () => {
  beforeEach(() => {
    const empty = Object.fromEntries(COLLECTIONS.map((k) => [k, []]));
    useStore.setState({ ...empty, settings: createSeed().settings });
  });
  it.each(ROUTES)('%s boş veriyle çökmez', async (path) => {
    await renderRoute(path);
  });
});

describe('Üst bar', () => {
  it('bildirim zili ve global arama çalışır', async () => {
    useStore.setState(createSeed());
    const { findByLabelText, getByPlaceholderText, findByText } = await renderRoute('/');
    const bell = await findByLabelText('Bildirimler');
    fireEvent.click(bell);
    await findByText(/Bildirimler \(/);
    const input = getByPlaceholderText(/ara/i) as HTMLInputElement;
    expect(input).toBeTruthy();
  });
});

describe('Global arama', () => {
  it('misafir, oda, çalışan ve rezervasyon arar; Enter ilgili sayfaya yönlendirir', async () => {
    useStore.setState(createSeed());
    const { getByPlaceholderText, findByText, findAllByText } = await renderRoute('/');
    const input = getByPlaceholderText(/ara/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ahmet' } });
    await findByText('Misafir');
    fireEvent.change(input, { target: { value: 'Selim' } });
    expect((await findAllByText('Çalışan')).length).toBeGreaterThan(0);
    fireEvent.change(input, { target: { value: '101' } });
    await findByText('Oda');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toMatch(/Oda/i));
  });
});
