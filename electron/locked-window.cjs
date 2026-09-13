// Keep lifecycle events and timers injectable for deterministic failure tests.
function guardLockedWindow(win, { onVisible, onClosed, onFailure, isQuitting = () => false, timers = globalThis, loadTimeout = 10000, exitTimeout = 1500 }) {
  let loaded = false, rendered = false, visible = false, closing = false, finished = false;
  let transitionTimer;
  const startupTimer = timers.setTimeout(() => fail('LOAD_TIMEOUT'), loadTimeout);
  const clearTimers = () => { timers.clearTimeout(startupTimer); timers.clearTimeout(transitionTimer); };
  function fail(code) {
    if (finished || closing) return;
    closing = true;
    clearTimers();
    onFailure(code);
    if (!win.isDestroyed()) win.destroy();
  }
  function present() {
    if (!loaded || !rendered || visible || closing || finished) return;
    visible = true;
    timers.clearTimeout(startupTimer);
    try {
      // Create as an ordinary hidden window; entering fullscreen before the
      // renderer's first content can leave an empty native surface on Windows.
      win.show();
      win.setFullScreen(true);
      win.focus();
      onVisible();
      transitionTimer = timers.setTimeout(() => {
        if (!win.isDestroyed() && !win.isFullScreen()) fail('FULLSCREEN_FAILED');
      }, 3000);
    } catch { fail('PRESENT_FAILED'); }
  }
  win.webContents.on('did-finish-load', () => { loaded = true; present(); });
  win.webContents.on('did-fail-load', (_event, _code, _description, _url, mainFrame) => { if (mainFrame !== false) fail('LOAD_FAILED'); });
  win.webContents.on('preload-error', () => fail('PRELOAD_FAILED'));
  win.webContents.on('render-process-gone', () => fail('RENDERER_EXITED'));
  win.on('unresponsive', () => fail('RENDERER_UNRESPONSIVE'));
  win.on('close', event => {
    if (finished || isQuitting()) return;
    if (closing) { event.preventDefault(); return; }
    closing = true;
    clearTimers();
    if (!win.isFullScreen()) return;
    event.preventDefault();
    const destroy = () => { if (!win.isDestroyed()) win.destroy(); };
    win.once('leave-full-screen', destroy);
    transitionTimer = timers.setTimeout(destroy, exitTimeout);
    try { win.setFullScreen(false); } catch { destroy(); }
  });
  win.on('closed', () => { if (finished) return; finished = true; clearTimers(); onClosed(); });
  return {
    ready() { if (!closing && !finished) { rendered = true; present(); } },
    fail,
    focus() { if (visible && !closing && !finished) { win.show(); win.focus(); } }
  };
}
module.exports = { guardLockedWindow };
