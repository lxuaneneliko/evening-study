const { test } = require('node:test');
const assert = require('node:assert/strict');
const { command, scriptFor } = require('../electron/spotify.cjs');
test('only explicit player actions can enter the fixed platform command', () => {
  assert.throws(() => scriptFor("play'; Remove-Item anything"));
  assert.match(scriptFor('play'), /TryPlayAsync/);
  assert.doesNotMatch(scriptFor('play'), /ExecutionPolicy|SendKeys|keybd_event|SendInput/);
});
test('platform call is hidden, bounded, and reports confirmed playback', async () => {
  const result = await command('play', (exe, args, options, done) => {
    assert.match(exe, /WindowsPowerShell/); assert.equal(args[0], '-NoProfile');
    assert.equal(options.windowsHide, true); assert.equal(options.timeout, 12000);
    done(null, '{"ok":true,"playing":true,"title":"Music"}');
  });
  assert.equal(result.playing, true);
});
test('malformed platform output and process failure do not pretend to play', async () => {
  for (const fake of [(exe, args, options, done) => done(new Error('unavailable'), ''), (exe, args, options, done) => done(null, 'not JSON')]) {
    assert.deepEqual(await command('play', fake), { ok: false, code: 'MEDIA_UNAVAILABLE', playing: false });
  }
});
