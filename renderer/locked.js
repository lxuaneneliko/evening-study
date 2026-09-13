let lockedState;
let readySent = false;
const { escape: esc, icon } = UI;
const spotifyIcon = '<svg class="icon spotify-mark" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="11"/><g fill="none" stroke="#101a36" stroke-linecap="round"><path d="M6 9c5-2 10-1 13 1" stroke-width="1.8"/><path d="M6.7 12.3c4-1.5 8-1 11 1" stroke-width="1.5"/><path d="M7.5 15.5c3-1 6-0.7 9 .8" stroke-width="1.3"/></g></svg>';
function renderLocked() {
  const session = lockedState?.lockedSession;
  if (!session) throw new Error('Missing focus session');
  document.getElementById('locked').innerHTML = `<div class="focus-constellation" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>✦</span><span>✧</span></div><header class="locked-header"><span class="wordmark">${icon('moon')} 暮讀 <span class="wordmark-en">AFTERGLOW</span></span><button class="exit-locked" data-action="exit">返回桌面 <kbd>Esc</kbd>${icon('close')}</button></header><section class="locked-center"><div class="locked-kicker"><span></span> LOCKED IN <span></span></div><h1>${esc(session.title)}</h1>${session.book ? `<p class="locked-book">${icon('book')} ${esc(session.book)}</p>` : ''}<div class="locked-clock-wrap"><span class="clock-orbit" aria-hidden="true"></span><time id="elapsed-time">00:00</time></div><p class="elapsed-label">已專注 <span>·</span> 一次，只做好一件事</p>${session.notes ? `<p class="locked-notes">${esc(session.notes)}</p>` : ''}</section><footer class="locked-footer"><div id="spotify-player"></div><div class="locked-verse"><span>每個此刻，都有自己的光。</span><span id="wall-time"></span></div></footer>`;
  renderSpotify(); updateTime();
  if (!readySent) {
    readySent = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (document.getElementById('elapsed-time')?.getBoundingClientRect().height > 0 && document.querySelector('.exit-locked')) {
        window.planner.lockReady().catch(window.lockedFailure);
      } else window.lockedFailure();
    }));
  }
}
function renderSpotify() {
  const media = lockedState?.lockedSession?.spotify || { connecting: true };
  const connecting = media.connecting;
  const label = connecting ? '正在連接 Spotify' : media.ok ? media.playing ? 'SPOTIFY · 正在播放' : 'SPOTIFY · 已暫停' : 'SPOTIFY · 尚未連接';
  const title = connecting ? '準備你的背景音樂…' : media.ok ? (media.title || 'Spotify') : media.code === 'NOT_INSTALLED' ? '請先安裝並登入 Spotify' : '先在 Spotify 選好一首歌';
  const detail = media.ok ? (media.artist || '') : connecting ? '續播目前選好的內容' : '選好歌曲後，按右側按鈕重試';
  const action = media.playing ? 'pause' : 'play';
  const target = document.getElementById('spotify-player'); if (!target) return;
  target.innerHTML = `<div class="spotify-player ${media.playing ? 'is-playing' : ''}">${spotifyIcon}<div class="spotify-copy"><div class="spotify-label"><span class="music-live-dot"></span>${label}</div><div class="spotify-title">${esc(title)}</div><div class="spotify-artist">${esc(detail)}</div></div><button class="spotify-play" data-action="${action}" aria-label="${media.playing ? '暫停 Spotify' : '播放 Spotify'}" ${connecting ? 'disabled' : ''}>${icon(media.playing ? 'pause' : 'play')}</button><button class="spotify-open" data-action="open" title="開啟 Spotify" aria-label="開啟 Spotify">${icon('arrow')}</button></div>`;
}
function updateTime() {
  if (!lockedState?.lockedSession) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - lockedState.lockedSession.startedAt) / 1000));
  const h = Math.floor(elapsed / 3600), m = Math.floor(elapsed / 60) % 60, s = elapsed % 60;
  const time = document.getElementById('elapsed-time');
  if (time) time.textContent = `${h ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const clock = document.getElementById('wall-time'); if (clock) clock.textContent = UI.time(new Date());
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'exit') return; // Also works while bootstrapping.
  button.disabled = true;
  try {
    await window.planner.spotify(button.dataset.action);
  } catch (error) { UI.toast(error.message, true); }
  finally { button.disabled = false; }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); window.planner.unlock().catch(error => UI.toast(error.message, true)); }
});
window.planner.onUpdate(state => { const isNew = !lockedState || lockedState.lockedSession?.startedAt !== state.lockedSession?.startedAt; lockedState = state; if (isNew) renderLocked(); else { renderSpotify(); updateTime(); } });
window.planner.getState().then(state => { lockedState = state; renderLocked(); }).catch(window.lockedFailure);
setInterval(updateTime, 1000);
