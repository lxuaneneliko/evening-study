const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(process.env.PLANNER_TEST_ROOT || path.join(__dirname, '..'));
const clone = value => JSON.parse(JSON.stringify(value));

async function boot(directory, { rejectedLogin = false } = {}) {
  const handlers = new Map(), windows = [], loginCalls = [], timers = new Set();
  let login = false;
  const app = new EventEmitter();
  const paths = { appData: directory, exe: path.join(directory, 'installed', '暮讀.exe') };
  Object.assign(app, { isPackaged: true, disableHardwareAcceleration() {}, setName() {}, setAppUserModelId() {}, setPath: (k, v) => paths[k] = v, getPath: k => paths[k], getVersion: () => 'test', requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() {}, setLoginItemSettings(options) { loginCalls.push(clone(options)); login = options.openAtLogin; }, getLoginItemSettings() { return { openAtLogin: login, executableWillLaunchAtLogin: login && !rejectedLogin }; } });
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, { setWindowOpenHandler() {}, send() {}, session: { setPermissionRequestHandler() {} } });
      windows.push(this);
    }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds) { this.bounds = { ...bounds }; this.emit('resize'); this.emit('moved'); }
    setAlwaysOnTop() {} isDestroyed() { return false; } showInactive() {} loadFile() { return Promise.resolve(); }
  }
  const display = { workArea: { x: 0, y: 0, width: 1707, height: 1019 } };
  const screen = Object.assign(new EventEmitter(), { getPrimaryDisplay: () => display, getDisplayNearestPoint: () => display, getDisplayMatching: () => display, getAllDisplays: () => [display] });
  class Tray extends EventEmitter { setToolTip() {} setContextMenu() {} }
  const electron = { app, BrowserWindow: Window, ipcMain: { handle: (key, fn) => handlers.set(key, fn) }, screen, Tray, Menu: { buildFromTemplate: x => x }, nativeImage: { createFromPath: () => ({ resize() { return {}; } }) }, Notification: { isSupported: () => false }, dialog: { showErrorBox: (...args) => { throw new Error(args.join(' ')); } }, globalShortcut: { register() {}, unregisterAll() {} }, powerMonitor: new EventEmitter(), shell: {} };
  const context = vm.createContext({ require: name => name === 'electron' ? electron : name.startsWith('.') ? require(path.resolve(root, 'electron', name)) : require(name), __dirname: path.join(root, 'electron'), process: { env: {}, argv: [] }, structuredClone, console, Date, setInterval() {}, clearInterval() {}, setTimeout(fn, delay) { const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); return timer; }, clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); } });
  vm.runInContext(fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const widget = windows[0];
  assert(widget, 'App created its widget');
  Window.fromWebContents = sender => sender === widget.webContents ? widget : null;
  const { pathToFileURL } = require('node:url');
  widget.webContents.mainFrame = { url: pathToFileURL(path.join(root, 'renderer/widget.html')).href };
  return { app, widget, loginCalls, paths, state: () => clone(vm.runInContext('publicState()', context)), saved: () => JSON.parse(fs.readFileSync(path.join(paths.userData, 'planner.json'))), invoke: (key, ...args) => handlers.get(key)({ sender: widget.webContents, senderFrame: widget.webContents.mainFrame }, ...args), dispose() { for (const timer of timers) clearTimeout(timer); } };
}

test('resize is saved without pointerup, then restored with all preferences on cold start', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-preferences-'));
  const first = await boot(directory); t.after(() => first.dispose());
  await first.invoke('settings:save', { opacity: 79, pinned: true, notifications: false, reminderMinutes: 15 });
  await first.invoke('widget:resize', { x: 520, y: 42, width: 631, height: 721 }, false);
  await new Promise(resolve => setTimeout(resolve, 210));
  const saved = first.saved();
  assert.equal(saved.settings.width, 631); assert.equal(saved.settings.height, 721);
  assert.equal(saved.settings.opacity, 79); assert.deepEqual(saved.position, { x: 520, y: 42 });
  first.dispose(); // Simulate losing the process without before-quit.
  const second = await boot(directory); t.after(() => second.dispose());
  assert.deepEqual(second.state().settings, saved.settings);
  assert.deepEqual(second.widget.getBounds(), { x: 520, y: 42, width: 631, height: 721 });
});

test('Windows shutdown flushes pending bounds before debounce expires', async t => {
  const instance = await boot(fs.mkdtempSync(path.join(os.tmpdir(), 'planner-shutdown-'))); t.after(() => instance.dispose());
  instance.widget.setBounds({ x: 80, y: 90, width: 590, height: 680 });
  instance.widget.emit('query-session-end', {});
  assert.equal(instance.saved().settings.width, 590);
  assert.deepEqual(instance.saved().position, { x: 80, y: 90 });
});

test('saved autostart repairs a missing launch entry using the current executable', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-login-'));
  const first = await boot(directory); t.after(() => first.dispose());
  await first.invoke('settings:save', { autoStart: true });
  assert.equal(first.saved().settings.autoStart, true);
  const second = await boot(directory); t.after(() => second.dispose());
  assert.deepEqual(second.loginCalls, [{ name: '暮讀', openAtLogin: true, path: second.paths.exe, args: [] }]);
  await second.invoke('settings:save', { autoStart: false });
  assert.equal(second.saved().settings.autoStart, false);
});

test('a Windows-disabled launch entry is reported rather than saved as enabled', async t => {
  const instance = await boot(fs.mkdtempSync(path.join(os.tmpdir(), 'planner-login-disabled-')), { rejectedLogin: true }); t.after(() => instance.dispose());
  await assert.rejects(instance.invoke('settings:save', { autoStart: true }), /Windows 未啟用/);
  assert.equal(instance.state().settings.autoStart, false);
});
