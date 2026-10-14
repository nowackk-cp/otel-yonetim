// README için tanıtım videosu kaydeder: node scripts/record_demo.cjs (önce npm run build)
// Çıktı: docs/media/demo.webm → ffmpeg ile demo.mp4 / demo.gif'e dönüştürülür.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'media');
fs.mkdirSync(OUT_DIR, { recursive: true });
const baseUrl = 'http://localhost:4174';

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Sunucu açılmadı');
}

async function recordClip(browser, name, viewport, scenario) {
  const tmp = path.join(OUT_DIR, `_tmp_${name}`);
  const ctx = await browser.newContext({ viewport, locale: 'tr-TR', recordVideo: { dir: tmp, size: viewport } });
  const page = await ctx.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.setItem('otel-theme', 'light'));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await scenario(page);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(OUT_DIR, `${name}.webm`));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${name}.webm`);
}

const nav = async (page, label, wait = 1600) => {
  await page.locator('aside').getByText(label, { exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(wait);
};

async function run() {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
  });
  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch({ headless: true });

    // 1) Genel tur
    await recordClip(browser, 'demo', { width: 1280, height: 800 }, async (page) => {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1200);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(600);
      await nav(page, 'Odalar');
      await nav(page, 'Rezervasyonlar');
      await page.getByRole('button', { name: 'Yeni rezervasyon' }).click();
      await page.waitForTimeout(1800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      await nav(page, 'Takvim');
      await nav(page, 'Restoran & Bar');
      await nav(page, 'Gelir & Gider');
      await nav(page, 'Raporlar', 2000);
      await nav(page, 'Vardiyalar');
      await nav(page, 'Bordro');
      await nav(page, 'Görevler');
      // Global arama
      const search = page.getByPlaceholder('Sayfa, misafir veya oda ara...');
      await search.click();
      await search.pressSequentially('kat hiz', { delay: 90 });
      await page.waitForTimeout(900);
      await search.press('Enter');
      await page.waitForTimeout(1600);
      // Koyu tema
      await page.getByLabel('Temayı değiştir').click();
      await page.waitForTimeout(1200);
      await nav(page, 'Gösterge Paneli', 2200);
    });

    // 2) Mobil
    await recordClip(browser, 'mobile', { width: 390, height: 780 }, async (page) => {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(1200);
      await page.getByLabel('Menüyü aç').click();
      await page.waitForTimeout(1200);
      await page.locator('aside').getByText('Odalar', { exact: true }).click();
      await page.waitForTimeout(1800);
      await page.getByLabel('Temayı değiştir').click();
      await page.waitForTimeout(1500);
    });

    await browser.close();
  } finally {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F']);
    else preview.kill();
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
