const { _electron: electron } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const exe = path.join(root, 'release/win-unpacked/暮讀.exe');
const archive = path.join(root, 'release/win-unpacked/resources/app.asar');
const files = ['electron/spotify.cjs', 'renderer/locked.html', 'renderer/locked.js', 'electron/main.cjs', 'electron/preload.cjs', 'shared/core.js', 'shared/default-schedule.json', 'renderer/widget.html', 'renderer/widget.js', 'renderer/manager.html', 'renderer/manager.js', 'renderer/styles.css', 'renderer/ui.js'];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
for (const file of files) assert.equal(hash(asar.extractFile(archive, file)), hash(fs.readFileSync(path.join(root, file))), `Packaged file mismatch: ${file}`);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evening-packaged-'));
const env = { ...process.env, EVENING_STUDY_TEST: '1', EVENING_STUDY_DATA: dataDir }; delete env.ELECTRON_RUN_AS_NODE;
(async () => {
  let app;
  try {
    app = await electron.launch({ executablePath: exe, args: ['--manager'], env });
    const widget = app.windows().find(p => p.url().includes('widget.html')) || await app.waitForEvent('window', { predicate: p => p.url().includes('widget.html') });
    await widget.locator('.next-card').waitFor();
    const result = await app.evaluate(({ app, BrowserWindow, screen }) => ({ packaged: app.isPackaged, version: app.getVersion(), bounds: BrowserWindow.getAllWindows().find(w => w.getTitle().includes('桌面行程')).getBounds(), workArea: screen.getPrimaryDisplay().workArea }));
    assert.equal(result.packaged, true); assert.equal(result.version, '1.1.1');
    const state = await widget.evaluate(() => window.planner.getState());
    assert.equal(state.schedule.days.flatMap(d => d.entries).length, 35);
    assert.equal(await widget.locator('[data-resize]').count(), 8);
    assert.equal(state.settings.autoStart, false);
    assert.equal(await widget.locator('.now-actions button').count(), 1);
    await widget.locator('.locked-in-button').click();
    const focus = app.windows().find(p => p.url().includes('locked.html')) || await app.waitForEvent('window', { predicate: p => p.url().includes('locked.html') });
    await focus.waitForFunction(() => lockedState?.lockedSession?.spotify?.playing === true);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === '暮讀 · LOCKED IN').isFullScreen()), true);
    await focus.keyboard.press('Escape').catch(error => {
      if (!focus.isClosed() || !/Target page, context or browser has been closed/.test(error.message)) throw error;
    });
    await widget.waitForFunction(() => !appState.lockedSession);
    await widget.screenshot({ path: path.join(root, 'test-results/packaged-widget.png'), omitBackground: true });
    fs.writeFileSync(path.join(root, 'test-results/packaged-report.json'), JSON.stringify({ ...result, verifiedFiles: files, archiveSha256: hash(fs.readFileSync(archive)), passed: true }, null, 2));
    console.log('PASS packaged Windows executable launches; 13 source files match; version, 35 entries, 8 resize handles verified');
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
