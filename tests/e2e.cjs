const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results'); fs.mkdirSync(results, { recursive: true });
const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'evening-study-e2e-'));
const errors = [];
const testEnv = { ...process.env, EVENING_STUDY_TEST: '1', EVENING_STUDY_DATA: testData };
delete testEnv.ELECTRON_RUN_AS_NODE;
async function pageFor(app, filename) {
  const existing = app.windows().find(p => p.url().includes(filename));
  if (existing) return existing;
  return app.waitForEvent('window', { predicate: p => p.url().includes(filename), timeout: 15000 });
}
(async () => {
  let app;
  try {
    app = await electron.launch({ args: [root, '--manager'], env: testEnv });
    const manager = await pageFor(app, 'manager.html'), widget = await pageFor(app, 'widget.html');
    for (const page of [manager, widget]) page.on('pageerror', e => errors.push(e.message));
    await manager.locator('.week-table tbody tr').last().waitFor();
    assert.equal(await manager.locator('.week-table tbody tr').count(), 7);
    await widget.locator('.night-card').last().waitFor(); assert.equal(await widget.locator('.night-card').count(), 2);
    const bounds = await app.evaluate(({ BrowserWindow, screen }) => { const w = BrowserWindow.getAllWindows().find(w => w.getTitle().includes('桌面行程')); return { bounds: w.getBounds(), work: screen.getPrimaryDisplay().workArea, frame: w.isAlwaysOnTop() }; });
    assert.ok(bounds.bounds.x + bounds.bounds.width <= bounds.work.x + bounds.work.width); assert.equal(bounds.frame, false);
    console.log('PASS native transparent two-card window, 7 weekday rows, default placement');

    await manager.getByRole('button', { name: '編輯星期一', exact: true }).click();
    await manager.getByRole('button', { name: '編輯 工數', exact: true }).click();
    await manager.locator('#entry-book').fill('工程數學 · 第 3 章');
    await manager.locator('#entry-notes').fill('完成習題 1–10，整理不熟的觀念。');
    await manager.getByRole('button', { name: '儲存安排', exact: true }).click();
    await manager.locator('#editor-dialog').waitFor({ state: 'hidden' });
    assert.equal(await manager.locator('#day-details').getByText('工程數學 · 第 3 章', { exact: false }).count(), 1);
    console.log('PASS editor saves textbook and study notes');

    await manager.getByRole('button', { name: '新增安排', exact: true }).click();
    await manager.locator('#entry-title').fill('<img src=x onerror=alert(1)> 安全測試');
    await manager.locator('#entry-flexible').check();
    await manager.getByRole('button', { name: '儲存安排', exact: true }).click();
    await manager.locator('#editor-dialog').waitFor({ state: 'hidden' });
    assert.equal(await manager.locator('.agenda-copy img').count(), 0);
    await manager.getByRole('button', { name: '編輯 <img src=x onerror=alert(1)> 安全測試', exact: true }).click();
    await manager.getByRole('button', { name: '移除此安排', exact: true }).click();
    await manager.locator('#editor-dialog').waitFor({ state: 'hidden' });
    assert.equal(await manager.locator('.agenda-copy').getByText('<img src=x onerror=alert(1)> 安全測試', { exact: true }).count(), 0);
    console.log('PASS add and remove entries; imported markup stays inert text');

    await manager.getByRole('button', { name: '匯入新行程', exact: true }).click();
    await manager.locator('#import-text').fill('| 一 | 25:00–26:00 工數 | | |');
    await manager.getByRole('button', { name: '辨識並預覽', exact: true }).click();
    assert.match(await manager.locator('#import-error').innerText(), /時間超出範圍/);
    const unchanged = await manager.evaluate(() => window.planner.getState()); assert.equal(unchanged.schedule.days[0].entries[0].book, '工程數學 · 第 3 章');
    await manager.locator('#import-text').fill('星期,開始,結束,事項,書本,備註\n一,08:00,09:00,測試匯入,測試課本,請保留原本備份');
    await manager.getByRole('button', { name: '辨識並預覽', exact: true }).click();
    await manager.getByRole('button', { name: '套用這份行程', exact: true }).click();
    await manager.locator('.week-table tbody tr').last().waitFor();
    assert.equal((await manager.evaluate(() => window.planner.getState())).schedule.days[0].entries[0].title, '測試匯入');
    await manager.getByRole('button', { name: '復原上一次行程修改', exact: true }).click();
    assert.equal((await manager.evaluate(() => window.planner.getState())).schedule.days[0].entries[0].book, '工程數學 · 第 3 章');
    console.log('PASS invalid import protection, CSV preview/apply and complete undo');

    await manager.getByRole('button', { name: '桌面設定', exact: true }).click();
    await manager.getByRole('switch', { name: '保持在其他視窗上方', exact: true }).click();
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle().includes('桌面行程')).isAlwaysOnTop()), true);
    await manager.getByRole('combobox', { name: '卡片尺寸', exact: true }).selectOption('360');
    await manager.waitForFunction(async () => (await window.planner.getState()).settings.width === 360);
    // Windows fractional display scaling can round native bounds by one DIP.
    assert.ok(Math.abs(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle().includes('桌面行程')).getBounds().width) - 360) <= 1);
    await manager.getByRole('combobox', { name: '卡片尺寸', exact: true }).selectOption('420');
    await manager.getByRole('switch', { name: '保持在其他視窗上方', exact: true }).click();
    console.log('PASS real native pin and width settings');

    // A deterministic reading moment is used only in this isolated test profile.
    await widget.clock.install({ time: new Date(2026, 8, 14, 8, 35) }); await widget.evaluate(() => render());
    await widget.locator('.locked-in-button').waitFor();
    assert.equal(await widget.locator('.now-actions button').count(), 1);
    await widget.screenshot({ path: path.join(results, 'widget-reading.png'), omitBackground: true });
    await manager.getByRole('button', { name: '每週行程', exact: true }).click();
    await manager.screenshot({ path: path.join(results, 'weekly-planner.png'), fullPage: true });
    assert.equal(await widget.evaluate(() => document.getElementById('widget').scrollWidth > innerWidth), false);
    console.log('PASS single LOCKED IN action, deterministic visual captures and width overflow');

    await app.close();
    app = await electron.launch({ args: [root, '--manager'], env: testEnv });
    const reopened = await pageFor(app, 'manager.html'); await reopened.locator('.week-table').waitFor();
    const saved = await reopened.evaluate(() => window.planner.getState()); assert.equal(saved.schedule.days[0].entries[0].book, '工程數學 · 第 3 章'); assert.equal(saved.settings.width, 420);
    assert.ok(fs.existsSync(path.join(testData, 'planner.json.bak')));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS restart persistence, automatic backup, zero renderer errors');
    fs.writeFileSync(path.join(results, 'e2e-report.json'), JSON.stringify({ passed: true, errors, testData, nativeBounds: bounds, verifiedAt: new Date().toISOString() }, null, 2));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
