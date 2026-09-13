const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { guardLockedWindow } = require('../electron/locked-window.cjs');

function fixture({ leaveEvent = true, refuseFullscreen = false } = {}) {
  const win = new EventEmitter();
  win.webContents = new EventEmitter();
  const calls = [], timers = new Map();
  let serial = 0, destroyed = false, fullscreen = false;
  Object.assign(win, {
    isDestroyed: () => destroyed, isFullScreen: () => fullscreen,
    show: () => calls.push('show'), focus: () => calls.push('focus'),
    setFullScreen(value) { calls.push(`fullscreen:${value}`); fullscreen = value && !refuseFullscreen; if (!value && leaveEvent) win.emit('leave-full-screen'); },
    destroy() { if (destroyed) return; destroyed = true; calls.push('destroy'); win.emit('closed'); },
    close() { let prevented = false; win.emit('close', { preventDefault() { prevented = true; } }); if (!prevented) win.destroy(); }
  });
  const guard = guardLockedWindow(win, {
    timers: { setTimeout(fn, ms) { timers.set(++serial, { fn, ms }); return serial; }, clearTimeout(id) { timers.delete(id); } },
    onVisible: () => calls.push('hide-widget-and-play'), onClosed: () => calls.push('restore-widget'), onFailure: code => calls.push(code)
  });
  return { win, guard, calls, timers, advance(ms) { for (const [id, timer] of [...timers]) if (timer.ms <= ms) { timers.delete(id); timer.fn(); } } };
}

for (const readyFirst of [true, false]) test(`fullscreen waits for both content and load, readyFirst=${readyFirst}`, () => {
  const f = fixture();
  if (readyFirst) f.guard.ready(); else f.win.webContents.emit('did-finish-load');
  f.guard.focus(); // Repeated clicks must not expose the blank loading window.
  assert.deepEqual(f.calls, []);
  if (readyFirst) f.win.webContents.emit('did-finish-load'); else f.guard.ready();
  assert.deepEqual(f.calls, ['show', 'fullscreen:true', 'focus', 'hide-widget-and-play']);
  f.guard.ready(); f.win.webContents.emit('did-finish-load');
  assert.equal(f.calls.filter(x => x === 'hide-widget-and-play').length, 1);
  f.win.close();
  assert.equal(f.win.isDestroyed(), true);
  assert.equal(f.calls.at(-1), 'restore-widget');
  assert.equal(f.timers.size, 0);
});

for (const event of ['preload-error', 'render-process-gone', 'did-fail-load']) test(`${event} restores the widget before starting music`, () => {
  const f = fixture();
  f.win.webContents.emit(event);
  assert.equal(f.win.isDestroyed(), true);
  assert.equal(f.calls.includes('hide-widget-and-play'), false);
  assert.equal(f.calls.at(-1), 'restore-widget');
  f.guard.ready(); f.win.webContents.emit('did-finish-load');
  assert.equal(f.calls.includes('show'), false);
});

test('subframe load failures do not abort the main page', () => {
  const f = fixture();
  f.win.webContents.emit('did-fail-load', {}, -3, '', '', false);
  assert.deepEqual(f.calls, []);
});

test('first paint alone cannot hide the widget; missing readiness times out', () => {
  const f = fixture();
  f.win.emit('ready-to-show'); f.win.webContents.emit('did-finish-load');
  f.advance(10000);
  assert.deepEqual(f.calls, ['LOAD_TIMEOUT', 'destroy', 'restore-widget']);
});

test('renderer crash after presentation restores desktop once', () => {
  const f = fixture(); f.guard.ready(); f.win.webContents.emit('did-finish-load');
  f.win.webContents.emit('render-process-gone'); f.guard.fail('LATE_ERROR');
  assert.equal(f.calls.filter(x => x === 'restore-widget').length, 1);
  assert.equal(f.timers.size, 0);
});

test('Escape closes even if leave-full-screen never arrives, including repeated Escape', () => {
  const f = fixture({ leaveEvent: false }); f.guard.ready(); f.win.webContents.emit('did-finish-load');
  f.win.close(); f.win.close();
  assert.equal(f.win.isDestroyed(), false);
  f.advance(1500);
  assert.equal(f.win.isDestroyed(), true);
  assert.equal(f.calls.filter(x => x === 'restore-widget').length, 1);
  assert.equal(f.timers.size, 0);
});

test('refused fullscreen restores desktop with a useful failure reason', () => {
  const f = fixture({ refuseFullscreen: true }); f.guard.ready(); f.win.webContents.emit('did-finish-load');
  f.advance(3000);
  assert.ok(f.calls.includes('FULLSCREEN_FAILED'));
  assert.equal(f.calls.at(-1), 'restore-widget');
});

test('closing during startup cancels load timeout and late callbacks', () => {
  const f = fixture(); f.win.close(); f.guard.ready(); f.win.webContents.emit('did-finish-load'); f.advance(10000);
  assert.deepEqual(f.calls, ['destroy', 'restore-widget']);
  assert.equal(f.timers.size, 0);
});
