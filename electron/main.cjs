const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog, Notification, globalShortcut, powerMonitor, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Core = require('../shared/core');
const defaultSchedule = require('../shared/default-schedule.json');
const Spotify = require('./spotify.cjs');
const { guardLockedWindow } = require('./locked-window.cjs');
// Software compositing keeps transparent corners clean during live Windows resize.
app.disableHardwareAcceleration();
const isTest = process.env.EVENING_STUDY_TEST === '1';
if (isTest && process.env.EVENING_STUDY_DATA) app.setPath('userData', process.env.EVENING_STUDY_DATA);
else app.setPath('userData', path.join(app.getPath('appData'), 'EveningStudy'));
app.setName('暮讀');
app.setAppUserModelId('tw.local.eveningstudy');
const rendererDir = path.join(__dirname, '../renderer');
const defaults = { pinned: false, opacity: 94, notifications: true, reminderMinutes: 5, autoStart: false, width: 420, height: 774 };
let state, widget, manager, tray, quitting = false, storePath, positionTimer;
let lockedWindow, lockedSession = null, lockedGuard, lockedError = '', spotifyTimer, spotifyBusy = false;
const noticeKeys = new Set();
function initialState() { return { version: 1, schedule: structuredClone(defaultSchedule), settings: { ...defaults }, completions: {}, focus: null, position: null, previousSchedule: null, recovery: '' }; }
function loadState() {
  const initial = initialState();
  if (!fs.existsSync(storePath)) return initial;
  const decode = file => {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    saved.schedule = Core.validateSchedule(saved.schedule);
    saved.settings = validSettings({ ...defaults, ...saved.settings });
    const restored = { ...initial, ...saved };
    restored.completions = Object.fromEntries(Object.entries(saved.completions || {}).filter(([key, value]) => /^\d{4}-\d{2}-\d{2}\|[\w-]+$/.test(key) && value === true));
    restored.focus = null; // v1.1 replaces the former 25-minute timer with LOCKED IN.
    return restored;
  };
  try { return decode(storePath); }
  catch {
    try { const restored = decode(`${storePath}.bak`); restored.recovery = '上次儲存的檔案無法讀取，已使用上一份備份復原。'; return restored; }
    catch {
      fs.copyFileSync(storePath, `${storePath}.unreadable-${Date.now()}`);
      initial.recovery = '原本的資料無法讀取，已另外保留原檔，目前載入你的初始行程。'; return initial;
    }
  }
}
function persist() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temp = `${storePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
  // The backup is itself validated before overwriting a previously good backup.
  if (fs.existsSync(storePath)) {
    try { Core.validateSchedule(JSON.parse(fs.readFileSync(storePath, 'utf8')).schedule); fs.copyFileSync(storePath, `${storePath}.bak`); } catch { /* Preserve the last good backup. */ }
  }
  fs.renameSync(temp, storePath);
}
function publicState() { return { ...state, lockedSession, lockedError, appVersion: app.getVersion(), canUndo: Boolean(state.previousSchedule), packaged: app.isPackaged, dataPath: storePath, displayCount: screen.getAllDisplays().length }; }
function broadcast(save = true) {
  if (save) persist();
  for (const win of [widget, manager, lockedWindow]) if (win && !win.isDestroyed()) win.webContents.send('state:update', publicState());
  if (tray) setTrayMenu();
  return publicState();
}
function validSettings(settings) {
  const out = {};
  for (const key of ['pinned', 'notifications', 'autoStart']) {
    if (typeof settings[key] !== 'boolean') throw new Error('設定格式不正確。');
    out[key] = settings[key];
  }
  if (!Number.isInteger(settings.opacity) || settings.opacity < 75 || settings.opacity > 100) throw new Error('不透明度範圍為 75–100。');
  if (![0, 5, 10, 15].includes(settings.reminderMinutes)) throw new Error('提醒時間格式不正確。');
  if (!Number.isInteger(settings.width) || settings.width < 320 || settings.width > 1000) throw new Error('卡片寬度範圍為 320–1000。');
  if (!Number.isInteger(settings.height) || settings.height < 480 || settings.height > 1800) throw new Error('卡片高度範圍為 480–1800。');
  return { ...out, opacity: settings.opacity, reminderMinutes: settings.reminderMinutes, width: settings.width, height: settings.height };
}
function widgetBounds(reset = false) {
  const saved = state.position;
  const display = !reset && saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? screen.getDisplayNearestPoint({ x: Math.round(saved.x), y: Math.round(saved.y) }) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = Math.min(state.settings.width, area.width - 24), height = Math.min(state.settings.height, area.height - 32);
  const x = !reset && saved ? Math.max(area.x, Math.min(saved.x, area.x + area.width - width)) : area.x + area.width - width - 30;
  const y = !reset && saved ? Math.max(area.y, Math.min(saved.y, area.y + area.height - height)) : area.y + Math.max(16, Math.round((area.height - height) * 0.35));
  return { x: Math.round(x), y: Math.round(y), width, height };
}
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
}
function showWidget() { if (lockedWindow && !lockedWindow.isDestroyed()) lockedWindow.close(); if (widget && !widget.isDestroyed()) { widget.showInactive(); broadcast(false); } }
async function spotifyAction(action, autoOpen = false) {
  if (!['status', 'play', 'pause', 'open'].includes(action)) throw new Error('不支援的 Spotify 操作。');
  if (action === 'open') { await shell.openExternal('spotify:'); return; }
  const session = lockedSession;
  if (spotifyBusy) {
    if (action === 'status') return publicState();
    while (spotifyBusy && lockedSession === session) await new Promise(resolve => setTimeout(resolve, 50));
    if (lockedSession !== session) return publicState();
  }
  spotifyBusy = true;
  try {
    let media;
    if (isTest && process.env.EVENING_STUDY_REAL_SPOTIFY !== '1') {
      media = process.env.EVENING_STUDY_SPOTIFY_MISSING === '1' ? { ok: false, code: 'NO_SESSION', playing: false } : { ok: true, playing: action === 'pause' ? false : action === 'play' ? true : (session?.spotify?.playing ?? false), title: 'Spotify 測試歌曲', artist: '整合測試', status: action === 'pause' ? 'Paused' : 'Playing', canPlay: true, canPause: true };
    } else {
      media = await Spotify.command(action);
      if (autoOpen && media.code === 'NO_SESSION') {
        try {
          await shell.openExternal('spotify:');
          for (let attempt = 0; attempt < 3 && media.code === 'NO_SESSION' && lockedSession === session; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 800)); media = await Spotify.command('play');
          }
        } catch { media = { ok: false, code: 'NOT_INSTALLED', playing: false }; }
      }
    }
    if (session && lockedSession === session) { lockedSession.spotify = media; broadcast(false); }
    return publicState();
  } finally { spotifyBusy = false; }
}
function enterLockedIn() {
  if (lockedWindow && !lockedWindow.isDestroyed()) { lockedGuard?.focus(); return publicState(); }
  lockedError = '';
  const current = Core.snapshot(state.schedule, state.completions).current;
  lockedSession = { startedAt: Date.now(), title: current?.title || '自由讀書', book: current?.book || '', notes: current?.notes || '', time: current ? `${current.start}–${current.end}` : '', spotify: { connecting: true, playing: false } };
  const display = screen.getDisplayMatching(widget.getBounds());
  lockedWindow = new BrowserWindow({ ...display.workArea, fullscreenable: true, frame: false, backgroundColor: '#070d20', show: false, title: '暮讀 · LOCKED IN', autoHideMenuBar: true, icon: path.join(__dirname, '../assets/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  const focusWindow = lockedWindow;
  const session = lockedSession;
  secureWindow(focusWindow);
  const guard = guardLockedWindow(focusWindow, {
    isQuitting: () => quitting,
    onVisible() {
      if (lockedWindow !== focusWindow) return;
      session.startedAt = Date.now();
      widget.hide();
      broadcast(false);
      spotifyAction('play', true).catch(() => {
        if (lockedSession === session) { session.spotify = { ok: false, code: 'MEDIA_UNAVAILABLE', playing: false }; broadcast(false); }
      });
      spotifyTimer = setInterval(() => { if (lockedSession === session) spotifyAction('status').catch(() => {}); }, 10000);
    },
    onFailure(code) {
      if (lockedWindow !== focusWindow) return;
      lockedError = `全螢幕未能顯示，已返回桌面卡片。請重試。（${code}）`;
      try {
        const log = path.join(app.getPath('userData'), 'diagnostics.log');
        if (fs.existsSync(log) && fs.statSync(log).size > 256 * 1024) fs.renameSync(log, `${log}.previous`);
        fs.appendFileSync(log, `${new Date().toISOString()} ${app.getVersion()} LOCKED_IN ${code}\n`);
      } catch { /* Diagnostics must never prevent returning to the widget. */ }
    },
    onClosed() {
      if (lockedWindow !== focusWindow) return;
      lockedWindow = null; lockedGuard = null; lockedSession = null;
      clearInterval(spotifyTimer);
      if (!quitting && widget && !widget.isDestroyed()) { widget.show(); broadcast(false); }
    }
  });
  lockedGuard = guard;
  focusWindow.webContents.on('before-input-event', (event, input) => { if (input.type === 'keyDown' && input.key === 'Escape') { event.preventDefault(); focusWindow.close(); } });
  focusWindow.loadFile(path.join(rendererDir, 'locked.html')).catch(() => guard.fail('LOAD_FAILED'));
  broadcast(false); return publicState();
}
function createWidget() {
  widget = new BrowserWindow({ ...widgetBounds(), title: '暮讀 · 桌面行程', frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, maximizable: false, skipTaskbar: true, show: false, alwaysOnTop: state.settings.pinned, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  secureWindow(widget);
  widget.loadFile(path.join(rendererDir, 'widget.html'));
  widget.once('ready-to-show', () => widget.showInactive());
  widget.on('close', event => { if (!quitting) { event.preventDefault(); widget.hide(); } });
  widget.on('moved', () => {
    clearTimeout(positionTimer);
    positionTimer = setTimeout(() => { if (!widget.isDestroyed()) { const { x, y } = widget.getBounds(); state.position = { x, y }; persist(); } }, 300);
  });
}
function openManager(view = 'week') {
  if (!['week', 'import', 'settings'].includes(view)) view = 'week';
  if (manager && !manager.isDestroyed()) { manager.show(); manager.focus(); manager.webContents.send('manager:navigate', view); return; }
  const area = screen.getPrimaryDisplay().workArea;
  manager = new BrowserWindow({ width: Math.min(1220, area.width - 48), height: Math.min(900, area.height - 48), minWidth: Math.min(860, area.width - 48), minHeight: Math.min(640, area.height - 48), title: '暮讀 · 行程手帳', backgroundColor: '#080f24', autoHideMenuBar: true, icon: path.join(__dirname, '../assets/icon.png'), show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  secureWindow(manager);
  manager.loadFile(path.join(rendererDir, 'manager.html'), { query: { view } });
  manager.once('ready-to-show', () => manager.show());
  manager.on('closed', () => { manager = null; });
}
function setTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示桌面卡片', click: showWidget },
    { label: '隱藏桌面卡片', click: () => widget.hide() },
    { label: '行程手帳', click: () => openManager('week') },
    { type: 'separator' },
    { label: '保持在其他視窗上方', type: 'checkbox', checked: state.settings.pinned, click: item => { state.settings.pinned = item.checked; widget.setAlwaysOnTop(item.checked); broadcast(); } },
    { label: '移回主螢幕右側', click: () => { widget.setBounds(widgetBounds(true)); showWidget(); } },
    { label: '設定', click: () => openManager('settings') },
    { type: 'separator' },
    { label: '結束暮讀', click: () => app.quit() }
  ]));
}
function notify(title, body) {
  if (!state.settings.notifications || isTest || !Notification.isSupported()) return;
  const notice = new Notification({ title, body, silent: false, icon: path.join(__dirname, '../assets/icon.png') });
  notice.on('click', showWidget); notice.show();
}
function tick() {
  const now = new Date(), ms = now.getTime();
  if (!state.settings.notifications) return;
  for (const event of Core.occurrences(state.schedule, now)) {
    if (state.completions[Core.completionKey(event)]) continue;
    const thresholds = state.settings.reminderMinutes ? [state.settings.reminderMinutes, 0] : [0];
    for (const before of thresholds) {
      const due = event.startsAt - before * 60_000, key = `${Core.completionKey(event)}:${before}`;
      if (ms >= due && ms < due + 20_000 && !noticeKeys.has(key)) {
        noticeKeys.add(key); notify(before ? `${before} 分鐘後 · ${event.title}` : `現在開始 · ${event.title}`, `${event.start}–${event.end}${event.book ? `\n${event.book}` : ''}`);
      }
    }
  }
  if (noticeKeys.size > 1000) noticeKeys.clear();
}
function handle(channel, fn, allowed = () => [widget, manager, lockedWindow]) {
  ipcMain.handle(channel, async (event, ...args) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !allowed().includes(sender) || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith(pathToFileURL(rendererDir + path.sep).href)) throw new Error('不允許的來源。');
    return fn(...args);
  });
}
function registerHandlers() {
  handle('lock:enter', enterLockedIn);
  handle('lock:ready', () => lockedGuard?.ready(), () => [lockedWindow]);
  handle('lock:failed', () => lockedGuard?.fail('RENDER_FAILED'), () => [lockedWindow]);
  handle('lock:exit', () => { showWidget(); return publicState(); });
  handle('spotify:action', action => spotifyAction(action));
  handle('state:get', () => publicState());
  handle('manager:open', view => openManager(view));
  handle('widget:hide', () => widget.hide());
  handle('widget:show', showWidget);
  handle('widget:reset', () => { widget.setBounds(widgetBounds(true)); showWidget(); });
  handle('widget:resize-start', () => widget.getBounds());
  handle('widget:resize', (requested, finish) => {
    if (!requested || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(requested[key]))) throw new Error('無效的視窗尺寸。');
    const area = screen.getDisplayMatching(widget.getBounds()).workArea;
    const width = Math.round(Math.max(320, Math.min(1000, requested.width, area.width)));
    const height = Math.round(Math.max(480, Math.min(1800, requested.height, area.height)));
    const x = Math.round(Math.max(area.x, Math.min(requested.x, area.x + area.width - width)));
    const y = Math.round(Math.max(area.y, Math.min(requested.y, area.y + area.height - height)));
    widget.setBounds({ x, y, width, height });
    state.settings.width = width; state.settings.height = height; state.position = { x, y };
    if (finish) broadcast();
    return widget.getBounds();
  });
  handle('settings:save', input => {
    const settings = validSettings({ ...state.settings, ...input });
    if (settings.autoStart !== state.settings.autoStart) {
      if (!app.isPackaged || isTest) throw new Error('請在正式版 App 中設定開機啟動。');
      const executable = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
      app.setLoginItemSettings({ openAtLogin: settings.autoStart, path: executable });
      if (app.getLoginItemSettings({ path: executable }).openAtLogin !== settings.autoStart) throw new Error('Windows 未套用開機啟動設定，請稍後重試。');
    }
    state.settings = settings; widget.setAlwaysOnTop(settings.pinned); widget.setBounds(widgetBounds()); return broadcast();
  });
  handle('schedule:save', input => {
    const schedule = Core.validateSchedule(input);
    state.previousSchedule = { schedule: state.schedule, completions: state.completions };
    state.schedule = schedule;
    // Completion only survives if the actual recurring entry is unchanged.
    const oldEntries = new Map(state.previousSchedule.schedule.days.flatMap(d => d.entries.map(e => [e.id, JSON.stringify([d.day, e])])));
    const unchanged = new Set(schedule.days.flatMap(d => d.entries.filter(e => oldEntries.get(e.id) === JSON.stringify([d.day, e])).map(e => e.id)));
    state.completions = Object.fromEntries(Object.entries(state.completions).filter(([key]) => unchanged.has(key.split('|')[1])));
    return broadcast();
  });
  handle('schedule:undo', () => {
    if (state.previousSchedule) { state.schedule = Core.validateSchedule(state.previousSchedule.schedule); state.completions = state.previousSchedule.completions || {}; state.previousSchedule = null; }
    return broadcast();
  });
  handle('entry:complete', key => {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}\|[\w-]+$/.test(key)) throw new Error('完成紀錄格式不正確。');
    if (!state.schedule.days.some(d => d.entries.some(e => e.id === key.split('|')[1]))) throw new Error('找不到這個行程。');
    if (state.completions[key]) delete state.completions[key]; else state.completions[key] = true;
    const cutoff = Core.dateKey(new Date(Date.now() - 120 * 86400_000));
    state.completions = Object.fromEntries(Object.entries(state.completions).filter(([k]) => k.slice(0, 10) >= cutoff));
    return broadcast();
  });
  handle('import:choose', async () => {
    const result = await dialog.showOpenDialog(manager || widget, { title: '匯入每週行程', properties: ['openFile'], filters: [{ name: '行程表', extensions: ['md', 'txt', 'csv', 'tsv', 'json', 'xlsx'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const filename = result.filePaths[0];
    if (fs.statSync(filename).size > 5 * 1024 * 1024) throw new Error('檔案上限為 5 MB，請縮小後重新匯入。');
    const extension = path.extname(filename).slice(1).toLowerCase();
    if (extension === 'xlsx') {
      const ExcelJS = require('exceljs'); const book = new ExcelJS.Workbook(); await book.xlsx.readFile(filename);
      const sheet = book.worksheets[0];
      if (!sheet || sheet.rowCount > 1000 || sheet.columnCount > 50) throw new Error('請將行程放在第一個工作表，且不超過 1000 列、50 欄。');
      const rows = []; sheet.eachRow(row => { const cells = []; for (let i = 1; i <= Math.min(sheet.columnCount, 50); i++) {
        const cell = row.getCell(i), value = cell.value;
        // ExcelJS converts date-formatted time serials into UTC Date objects.
        if (value instanceof Date && /h/i.test(cell.numFmt)) cells.push(Core.fmtTime(value.getUTCHours() * 60 + value.getUTCMinutes()));
        else if (typeof value === 'number' && value >= 0 && value < 1 && /h|m/i.test(cell.numFmt)) cells.push(Core.fmtTime(Math.round(value * 1440) % 1440));
        else cells.push(cell.text);
      } rows.push(cells); });
      return { filename: path.basename(filename), schedule: Core.fromRows(rows, path.basename(filename, '.xlsx')) };
    }
    return { filename: path.basename(filename), text: fs.readFileSync(filename, 'utf8'), format: extension };
  });
  handle('schedule:export', async () => {
    const result = await dialog.showSaveDialog(manager || widget, { title: '備份完整行程', defaultPath: `${state.schedule.name}.json`, filters: [{ name: '暮讀完整行程（含書本與備註）', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, JSON.stringify(state.schedule, null, 2), 'utf8'); return result.filePath;
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWidget);
  app.whenReady().then(() => {
    storePath = path.join(app.getPath('userData'), 'planner.json'); state = loadState();
    registerHandlers(); createWidget();
    const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png'));
    tray = new Tray(icon.resize({ width: 32, height: 32 })); tray.setToolTip('暮讀 · 讓每個此刻，有個方向');
    tray.on('click', showWidget); tray.on('double-click', () => openManager('week')); setTrayMenu();
    globalShortcut.register('CommandOrControl+Shift+Space', () => widget.isVisible() ? widget.hide() : showWidget());
    screen.on('display-removed', () => widget.setBounds(widgetBounds()));
    screen.on('display-metrics-changed', () => widget.setBounds(widgetBounds()));
    powerMonitor.on('resume', () => { tick(); broadcast(false); });
    setInterval(tick, 15_000); tick();
    if (process.argv.includes('--manager')) openManager('week');
  }).catch(error => { dialog.showErrorBox('暮讀無法啟動', String(error.message || error)); app.quit(); });
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { quitting = true; clearTimeout(positionTimer); if (state) persist(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
