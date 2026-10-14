const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const routes = [
  { path: '/', name: '01_dashboard' },
  { path: '/rooms', name: '02_rooms' },
  { path: '/reservations', name: '03_reservations' },
  { path: '/calendar', name: '04_calendar' },
  { path: '/guests', name: '05_guests' },
  { path: '/rates', name: '06_rates' },
  { path: '/feedback', name: '07_feedback' },
  { path: '/lost-found', name: '08_lost_found' },
  { path: '/kbs', name: '09_kbs' },
  { path: '/accounting', name: '10_accounting' },
  { path: '/cashier', name: '11_cashier' },
  { path: '/invoices', name: '12_invoices' },
  { path: '/taxes', name: '13_taxes' },
  { path: '/reports', name: '14_reports' },
  { path: '/staff', name: '15_staff' },
  { path: '/shifts', name: '16_shifts' },
  { path: '/attendance', name: '17_attendance' },
  { path: '/leaves', name: '18_leaves' },
  { path: '/payroll', name: '19_payroll' },
  { path: '/housekeeping', name: '20_housekeeping' },
  { path: '/maintenance', name: '21_maintenance' },
  { path: '/inventory', name: '22_inventory' },
  { path: '/pos', name: '23_pos' },
  { path: '/suppliers', name: '24_suppliers' },
  { path: '/tasks', name: '25_tasks' },
  { path: '/settings', name: '26_settings' },
];

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return true;
    } catch (e) {
      // beklemeye devam et
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function run() {
  console.log('Vite preview başlatılıyor...');
  const previewProcess = spawn('npx.cmd', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true,
  });

  previewProcess.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  previewProcess.stderr.on('data', (d) => process.stderr.write(`[preview err] ${d}`));

  const baseUrl = 'http://localhost:4173';
  await waitForServer(baseUrl);
  console.log(`Vite preview hazır: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const reports = {
    consoleErrors: [],
    overflows: [],
    captured: [],
  };

  try {
    // 1. MASAÜSTÜ AÇIK TEMA (1440x900)
    console.log('\n--- 1. Masaüstü Açık Tema Çekiliyor (1440x900) ---');
    const desktopLightContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'tr-TR',
    });
    const pageLight = await desktopLightContext.newPage();
    pageLight.on('console', (msg) => {
      if (msg.type() === 'error') {
        reports.consoleErrors.push({ theme: 'desktop_light', url: pageLight.url(), text: msg.text() });
      }
    });
    pageLight.on('pageerror', (err) => {
      reports.consoleErrors.push({ theme: 'desktop_light', url: pageLight.url(), text: err.message });
    });

    // Açık temaya ayarla
    await pageLight.goto(baseUrl);
    await pageLight.evaluate(() => {
      localStorage.setItem('otel-theme', 'light');
      document.documentElement.classList.remove('dark');
    });

    for (const r of routes) {
      await pageLight.goto(`${baseUrl}${r.path}`, { waitUntil: 'networkidle' });
      await pageLight.waitForTimeout(400);

      // Yatay taşma kontrolü
      const hasOverflow = await pageLight.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
      });
      if (hasOverflow) {
        reports.overflows.push({ theme: 'desktop_light', route: r.path });
      }

      const filePath = path.join(SCREENSHOTS_DIR, `desktop_light_${r.name}.png`);
      await pageLight.screenshot({ path: filePath, fullPage: false });
      reports.captured.push(`desktop_light_${r.name}.png`);
      process.stdout.write(`✓ ${r.name} `);
    }
    await desktopLightContext.close();

    // 2. MASAÜSTÜ KOYU TEMA (1440x900)
    console.log('\n\n--- 2. Masaüstü Koyu Tema Çekiliyor (1440x900) ---');
    const desktopDarkContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'tr-TR',
    });
    const pageDark = await desktopDarkContext.newPage();
    pageDark.on('console', (msg) => {
      if (msg.type() === 'error') {
        reports.consoleErrors.push({ theme: 'desktop_dark', url: pageDark.url(), text: msg.text() });
      }
    });
    pageDark.on('pageerror', (err) => {
      reports.consoleErrors.push({ theme: 'desktop_dark', url: pageDark.url(), text: err.message });
    });

    // Koyu temaya ayarla
    await pageDark.goto(baseUrl);
    await pageDark.evaluate(() => {
      localStorage.setItem('otel-theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    for (const r of routes) {
      await pageDark.goto(`${baseUrl}${r.path}`, { waitUntil: 'networkidle' });
      await pageDark.waitForTimeout(400);

      const filePath = path.join(SCREENSHOTS_DIR, `desktop_dark_${r.name}.png`);
      await pageDark.screenshot({ path: filePath, fullPage: false });
      reports.captured.push(`desktop_dark_${r.name}.png`);
      process.stdout.write(`✓ ${r.name} `);
    }
    await desktopDarkContext.close();

    // 3. MOBİL GÖRÜNÜM (390x844)
    console.log('\n\n--- 3. Mobil Görünüm Çekiliyor (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: 'tr-TR',
    });
    const pageMobile = await mobileContext.newPage();
    pageMobile.on('console', (msg) => {
      if (msg.type() === 'error') {
        reports.consoleErrors.push({ theme: 'mobile', url: pageMobile.url(), text: msg.text() });
      }
    });
    pageMobile.on('pageerror', (err) => {
      reports.consoleErrors.push({ theme: 'mobile', url: pageMobile.url(), text: err.message });
    });

    for (const r of routes) {
      await pageMobile.goto(`${baseUrl}${r.path}`, { waitUntil: 'networkidle' });
      await pageMobile.waitForTimeout(400);

      const hasOverflow = await pageMobile.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
      });
      if (hasOverflow) {
        reports.overflows.push({ theme: 'mobile', route: r.path });
      }

      const filePath = path.join(SCREENSHOTS_DIR, `mobile_${r.name}.png`);
      await pageMobile.screenshot({ path: filePath, fullPage: false });
      reports.captured.push(`mobile_${r.name}.png`);
      process.stdout.write(`✓ ${r.name} `);
    }

    // Mobil menü açılışını test et ve çek
    console.log('\nMobil menü açılışı test ediliyor...');
    await pageMobile.goto(baseUrl, { waitUntil: 'networkidle' });
    // Hamburger butonuna tıkla
    const menuBtn = await pageMobile.$('button[aria-label="Menüyü aç"], button[title="Menüyü aç"], header button:first-child');
    if (menuBtn) {
      await menuBtn.click();
      await pageMobile.waitForTimeout(300);
      await pageMobile.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'mobile_menu_open.png'),
      });
      reports.captured.push('mobile_menu_open.png');
      console.log('✓ mobile_menu_open.png kaydedildi');
    }

    await mobileContext.close();

    // Raporu kaydet
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'audit_report.json'),
      JSON.stringify(reports, null, 2),
      'utf8',
    );
    console.log('\n\nTüm ekran görüntüleri başarıyla alındı ve audit_report.json kaydedildi.');
    console.log(`Konsol Hataları: ${reports.consoleErrors.length}`);
    console.log(`Yatay Taşmalar: ${reports.overflows.length}`);
  } finally {
    try {
      await browser.close();
    } catch (e) {}
    try {
      previewProcess.kill();
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${previewProcess.pid} /f /t`, { stdio: 'ignore' });
    } catch (e) {}
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
