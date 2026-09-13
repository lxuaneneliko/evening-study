const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../renderer');

async function boot({ session = { startedAt: Date.now(), title: '<script>bad()</script>', spotify: { ok: false, code: 'NO_SESSION' } }, rejectState = false, missingBridge = false } = {}) {
  const calls = [], raf = [], elements = new Map(), events = {};
  const element = () => ({ innerHTML: '', textContent: '', getBoundingClientRect: () => ({ height: 100 }) });
  for (const id of ['locked', 'spotify-player', 'elapsed-time', 'wall-time']) elements.set(id, element());
  const center = element();
  const planner = missingBridge ? undefined : {
    async getState() { if (rejectState) throw new Error('IPC failed'); return { lockedSession: session }; },
    onUpdate() {}, async lockReady() { calls.push('ready'); }, async lockFailed() { calls.push('failed'); }, async unlock() { calls.push('exit'); }
  };
  const window = { planner, addEventListener(name, fn) { events[name] = fn; } };
  const context = vm.createContext({ window, document: { getElementById: id => elements.get(id), querySelector: selector => selector.includes('locked-center') ? center : element(), addEventListener() {} }, setInterval() {}, requestAnimationFrame(fn) { raf.push(fn); }, UI: { escape: s => String(s).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), icon: () => '', time: () => '17:30', toast() {} } });
  vm.runInContext(fs.readFileSync(path.join(root, 'locked-bootstrap.js'), 'utf8'), context);
  try { vm.runInContext(fs.readFileSync(path.join(root, 'locked.js'), 'utf8'), context); } catch { events.error(); }
  await new Promise(resolve => setImmediate(resolve));
  return { calls, raf, elements, center, events };
}

test('renderer acknowledges only after content and two paint frames; missing Spotify still renders', async () => {
  const f = await boot();
  assert.deepEqual(f.calls, []);
  assert.match(f.elements.get('locked').innerHTML, /&lt;script&gt;bad/);
  assert.match(f.elements.get('spotify-player').innerHTML, /先在 Spotify 選好一首歌/);
  f.raf.shift()(); assert.deepEqual(f.calls, []);
  f.raf.shift()(); assert.deepEqual(f.calls, ['ready']);
});

for (const [name, options] of [['missing session', { session: null }], ['rejected state IPC', { rejectState: true }], ['missing preload bridge', { missingBridge: true }]]) test(`${name} shows a fallback and never acknowledges a blank page`, async () => {
  const f = await boot(options);
  assert.equal(f.calls.includes('ready'), false);
  assert.match(f.center.textContent, /載入失敗/);
  if (!options.missingBridge) assert.deepEqual(f.calls, ['failed']);
});
