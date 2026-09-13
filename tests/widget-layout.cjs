const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.PLANNER_TEST_ROOT || path.join(__dirname, '..'));
const C = require(path.join(root, 'shared/core'));
const results = [];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext();
    await context.route('http://planner.test/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const file = path.resolve(root, name);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ body: fs.readFileSync(file), contentType: type });
    });
    const page = await context.newPage();
    for (const mode of ['free', 'long-title']) {
      const state = { settings: { opacity: 76, width: 878, height: 984, pinned: false, autoStart: true, notifications: true, reminderMinutes: 5 }, schedule: { name: '測試行程', days: C.emptyDays().map(day => ({ ...day, lodging: '基隆', clothes: '準備換洗衣物', entries: mode === 'free' ? [] : [{ id: 'study-' + day.day, title: '工程數學與材料實習報告：整理今天的重點和課後習題', start: '00:00', end: '23:59', phase: '全天', book: '工程數學第六章與課堂筆記', notes: '先複習觀念，再完成本週的作業。' }] })) }, completions: {}, packaged: true, appVersion: 'test', canUndo: false, recovery: '', dataPath: 'isolated-test' };
      await page.addInitScript(state => {
        window.__state = state; window.__updates = [];
        window.planner = { getState: async () => window.__state, onUpdate: fn => window.__updates.push(fn), onNavigate() {}, settings: async patch => { window.__state.settings = { ...window.__state.settings, ...patch }; window.__updates.forEach(fn => fn(structuredClone(window.__state))); return structuredClone(window.__state); } };
      }, state);
      for (const [width, height] of [[320, 480], [360, 640], [420, 774], [878, 984], [1000, 500]]) {
        await page.setViewportSize({ width, height });
        await page.goto('http://planner.test/renderer/widget.html');
        await page.locator('.locked-in-button').waitFor();
        assert.match(await page.locator('.hero-copy h1').innerText(), mode === 'free' ? /留一點空白/ : /工程數學與材料實習報告/);
        const metrics = await page.evaluate(() => {
          const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
          const effectiveOpacity = selector => { let value = 1; for (let e = document.querySelector(selector); e; e = e.parentElement) value *= Number(getComputedStyle(e).opacity); return value; };
          return { title: rect('.hero-copy h1'), caption: rect('.book-line'), action: rect('.locked-in-button'), card: rect('.now-card'), next: rect('.next-card'), buttonOpacity: effectiveOpacity('.locked-in-button'), cardOpacity: effectiveOpacity('.now-card'), panelBackground: getComputedStyle(document.querySelector('.now-card')).backgroundColor };
        });
        assert(metrics.title.bottom <= metrics.caption.top + 1, `${mode} ${width}x${height}: title overlaps caption`);
        assert(metrics.caption.bottom <= metrics.action.top + 1, `${mode}: caption overlaps button`);
        assert(metrics.action.bottom <= metrics.card.bottom + 1, `${mode}: button outside card`);
        assert(metrics.card.bottom <= metrics.next.top + 1, `${mode}: cards overlap`);
        assert.equal(metrics.buttonOpacity, 0.76); assert.equal(metrics.cardOpacity, 0.76);
        assert.equal(metrics.panelBackground, 'rgb(8, 17, 44)');
        results.push({ mode, width, height, ...metrics });
      }
    }
    await page.setViewportSize({ width: 1100, height: 850 });
    await page.goto('http://planner.test/renderer/manager.html?view=settings');
    await page.locator('#setting-opacity').waitFor();
    await page.evaluate(() => {
      const input = document.querySelector('#setting-opacity'); input.focus(); window.__originalSlider = input;
      input.value = '82'; input.dispatchEvent(new Event('input', { bubbles: true }));
      window.__updates.forEach(fn => fn(structuredClone(window.__state)));
      if (document.querySelector('#setting-opacity') !== input || input.value !== '82') throw new Error('Slider was replaced during input');
    });
    await page.waitForFunction(() => window.__state.settings.opacity === 82);
    assert.equal(await page.evaluate(() => document.querySelector('#setting-opacity') === window.__originalSlider), true);
    await page.evaluate(() => { const input = document.querySelector('#setting-opacity'); input.value = '75'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => window.__state.settings.opacity === 75);
    const reportDir = path.resolve(__dirname, '../test-results');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'widget-layout-report.json'), JSON.stringify({ passed: true, testedRoot: root, headless: true, nativeDesktopNotControlled: true, sliderAutosave: true, results }, null, 2));
    console.log(`PASS ${results.length} layouts; button/card opacity match; slider autosaves without being replaced`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
