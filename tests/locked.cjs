const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const Spotify = require('../electron/spotify.cjs');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results'); fs.mkdirSync(results, { recursive: true });
const realMedia = process.argv.includes('--real-spotify');
const env = { ...process.env, EVENING_STUDY_TEST: '1', EVENING_STUDY_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'evening-locked-')) };
delete env.ELECTRON_RUN_AS_NODE;
if (realMedia) env.EVENING_STUDY_REAL_SPOTIFY = '1'; else delete env.EVENING_STUDY_REAL_SPOTIFY;
async function pageFor(app, file) { return app.windows().find(p => p.url().includes(file)) || app.waitForEvent('window', { predicate: p => p.url().includes(file) }); }
(async () => {
  let app, beforeMusic;
  try {
    if (realMedia) { beforeMusic = await Spotify.command('status'); assert.equal(beforeMusic.ok, true, 'Spotify must have a prepared local session for the real integration check'); }
    app = await electron.launch({ args: [root], env });
    const widget = await pageFor(app, 'widget.html'); await widget.locator('.locked-in-button').waitFor();
    const originalBounds = await widget.evaluate(() => window.planner.resizeStart());
    assert.equal(await widget.locator('.now-actions button').count(), 1);
    assert.equal(await widget.getByRole('button', { name: '完成這一項', exact: true }).count(), 0);
    assert.equal(await widget.getByRole('button', { name: '專注 25 分', exact: true }).count(), 0);
    await widget.locator('.locked-in-button').click();
    const focus = await pageFor(app, 'locked.html'); await focus.locator('#elapsed-time').waitFor();
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === '暮讀 · LOCKED IN').isFullScreen()), true);
    await focus.waitForFunction(() => lockedState?.lockedSession?.spotify?.playing === true, undefined, { timeout: 20000 });
    const playing = await focus.evaluate(() => window.planner.getState());
    assert.equal(playing.lockedSession.spotify.playing, true);
    assert.ok(playing.lockedSession.spotify.title);
    console.log('PASS one LOCKED IN button opens native fullscreen and confirms Spotify is Playing');
    const start = await focus.locator('#elapsed-time').innerText();
    await focus.waitForFunction(value => document.getElementById('elapsed-time').textContent !== value, start);
    await focus.screenshot({ path: path.join(results, realMedia ? 'locked-real-spotify.png' : 'locked-fullscreen.png') });
    await focus.getByRole('button', { name: '暫停 Spotify', exact: true }).click();
    await focus.waitForFunction(() => lockedState?.lockedSession?.spotify?.playing === false);
    await focus.getByRole('button', { name: '播放 Spotify', exact: true }).click();
    await focus.waitForFunction(() => lockedState?.lockedSession?.spotify?.playing === true);
    console.log('PASS elapsed timer advances; Spotify pause and resume report actual state');
    await focus.keyboard.press('Escape').catch(error => {
      // Native Escape may destroy the page before Playwright receives key-up.
      if (!focus.isClosed() || !/Target page, context or browser has been closed/.test(error.message)) throw error;
    });
    await widget.waitForFunction(() => !appState.lockedSession);
    const restoredBounds = await widget.evaluate(() => window.planner.resizeStart());
    assert.deepEqual(restoredBounds, originalBounds);
    for (let i = 0; i < 20; i++) {
      if (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle().includes('桌面行程')).isVisible())) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const windowsAfterExit = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ title: w.getTitle(), visible: w.isVisible(), minimized: w.isMinimized(), bounds: w.getBounds() })));
    assert.equal(windowsAfterExit.find(w => w.title.includes('桌面行程')).visible, true, JSON.stringify(windowsAfterExit));
    await widget.screenshot({ path: path.join(results, 'widget-locked-button.png'), omitBackground: true });
    console.log('PASS Escape exits fullscreen and restores the same widget dimensions and location');
    await app.close(); app = null;
    if (!realMedia) {
      const missingEnv = { ...env, EVENING_STUDY_SPOTIFY_MISSING: '1' };
      app = await electron.launch({ args: [root], env: missingEnv });
      const noWidget = await pageFor(app, 'widget.html'); await noWidget.locator('.locked-in-button').click();
      const noFocus = await pageFor(app, 'locked.html');
      await noFocus.getByText('先在 Spotify 選好一首歌', { exact: true }).waitFor();
      assert.equal(await noFocus.getByText('SPOTIFY · 正在播放', { exact: true }).count(), 0);
      await noFocus.getByRole('button', { name: /返回桌面/ }).click();
      await noWidget.waitForFunction(() => !appState.lockedSession);
      console.log('PASS missing Spotify shows an actionable setup message and never claims playback');
    }
    fs.writeFileSync(path.join(results, realMedia ? 'locked-real-report.json' : 'locked-report.json'), JSON.stringify({ passed: true, realSpotify: realMedia, beforeMusic, confirmedPlayback: playing.lockedSession.spotify, originalBounds, restoredBounds, verifiedAt: new Date().toISOString() }, null, 2));
  } finally {
    if (app) await app.close();
    if (realMedia && beforeMusic?.ok && !beforeMusic.playing) await Spotify.command('pause');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
