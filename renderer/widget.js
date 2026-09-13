let appState;
let lastMinute = '';
const C = PlannerCore, { escape: esc, icon, iconButton } = UI;
function render() {
  if (!appState) return;
  const now = new Date(), snap = C.snapshot(appState.schedule, appState.completions, now);
  const current = snap.current, completed = current && appState.completions[C.completionKey(current)];
  const next = snap.next[0];
  const progress = current ? Math.max(0, Math.min(100, (now.getTime() - current.startsAt) / (current.endsAt - current.startsAt) * 100)) : 0;
  const remaining = current ? Math.max(1, Math.ceil((current.endsAt - now.getTime()) / 60000)) : next ? Math.ceil((next.startsAt - now.getTime()) / 60000) : null;
  document.documentElement.style.setProperty('--panel-opacity', appState.settings.opacity / 100);
  document.getElementById('widget').innerHTML = `
    <header class="widget-toolbar drag"><span class="wordmark">${icon('moon')} 暮讀 <span class="wordmark-en">AFTERGLOW</span></span><div class="toolbar-actions no-drag">
      ${iconButton('pin', 'pin', appState.settings.pinned ? '取消置頂' : '保持在其他視窗上方', `aria-pressed="${appState.settings.pinned}"`)}
      ${iconButton('settings', 'settings', '開啟設定')}${iconButton('hide', 'hide', '隱藏卡片（系統匣可叫回）')}</div></header>
    <section class="night-card now-card" aria-label="現在要做什麼">
      ${appState.lockedError ? `<p class="locked-error" role="alert">${esc(appState.lockedError)}</p>` : ''}
      <div class="card-topline drag"><span class="eyebrow">CHAPTER ${String(now.getDay() || 7).padStart(2, '0')} <span class="tiny-star">✦</span> 此刻</span><span class="short-date">${now.getMonth() + 1} 月 ${now.getDate()} 日・週${C.weekdays[now.getDay()]}</span></div>
      <div class="now-meta"><span class="status ${completed ? 'finished' : current ? 'active' : ''}"><i></i>${completed ? '這一項，完成了' : current ? '正在進行' : '自由安排'}</span><time id="live-clock" class="clock-time">${UI.time(now)}</time></div>
      <div class="hero-copy"><h1>${current ? esc(current.title) : '留一點空白<br>給自己'}</h1><div class="moon-orbit" aria-hidden="true"><div class="orbit-ring"></div>${icon('moon')}<span>✧</span><b>·</b></div></div>
      <p class="book-line">${icon(current?.book ? 'book' : 'star')}<span>${current?.book ? esc(current.book) : current ? '把注意力，放在眼前這一頁。' : next ? '喝口水、伸展一下，再慢慢開始。' : '這週還沒有定時安排，打開手帳寫下計畫。'}</span></p>
      ${current?.notes ? `<p class="current-note">${esc(current.notes)}</p>` : ''}
      <div class="session-bottom">${current ? `<div class="session-times"><span>${current.start} <span class="time-dash">—</span> ${current.end}${C.minutes(current.end) < C.minutes(current.start) ? ' 翌日' : ''}</span><span>${completed ? '已打勾' : `剩餘 ${remaining} 分鐘`}</span></div><div class="progress-track"><div style="width:${completed ? 100 : progress}%"></div></div>` : `<div class="rest-note">${icon('clock')} ${next ? remaining > 180 ? `下一個安排在${UI.dayLabel(next.date)} ${next.start}` : `距離下一個安排還有 ${remaining} 分鐘` : '把生活留一點餘裕。'}</div>`}
      <div class="now-actions"><button class="button locked-in-button" data-action="lock-in">${icon('play')}<span>LOCKED IN</span><span class="lock-hint">全螢幕 · Spotify</span>${icon('arrow')}</button></div></div>
    </section>
    <section class="night-card next-card" aria-label="接下來的安排">
      <div class="card-topline drag"><span class="eyebrow">THE NEXT PAGE <span class="tiny-star">✧</span> 接著</span><button class="text-button no-drag" data-action="week">行程手帳 ${icon('arrow')}</button></div>
      <div class="next-list">${snap.next.slice(0, 2).map((entry, index) => `<article class="next-entry"><div class="timeline-mark"><span class="timeline-dot ${index === 0 ? 'gold' : ''}"></span>${index === 0 && snap.next.length > 1 ? '<span class="timeline-line"></span>' : ''}</div><div class="next-copy"><div class="next-time">${UI.dayLabel(entry.date)} ${entry.start}–${entry.end}</div><h2>${esc(entry.title)}</h2>${entry.book ? `<p>${esc(entry.book)}</p>` : ''}</div><span class="next-number">0${index + 1}</span></article>`).join('') || '<p class="muted empty-next">尚無定時行程。<br>在手帳裡，安排下一頁。</p>'}</div>
      <div class="daily-belongings"><div class="small-section-title"><span>把生活也照顧好</span><span>TONIGHT</span></div><div class="logistic-line">${icon('home')}<span>今晚住 <strong>${esc(snap.today.lodging || '尚未安排')}</strong></span></div>${snap.today.computer ? `<div class="logistic-line">${icon('laptop')}<span>${esc(snap.today.computer)}</span></div>` : ''}${snap.today.clothes ? `<div class="logistic-line clothes-line">${icon('shirt')}<span>${esc(snap.today.clothes)}</span></div>` : ''}</div>
      ${snap.flexible.length ? `<button class="flexible-hint" data-action="week">${icon('calendar')}<span>今日提醒：${esc(snap.flexible.map(e => `${e.phase} ${e.title}`).join('；'))}</span>${icon('arrow')}</button>` : ''}
    </section>
    <footer class="widget-footer"><span>每個此刻，都有自己的光。</span><span>今日 ${snap.done} / ${snap.total} ${icon('star')}</span></footer>`;
  if (!document.getElementById('resize-edges').children.length) document.getElementById('resize-edges').innerHTML = ['n','s','e','w','ne','nw','se','sw'].map(direction => `<div class="resize-handle resize-${direction}" data-resize="${direction}" title="拖曳調整大小" aria-hidden="true">${direction === 'se' ? '<svg width="13" height="13" viewBox="0 0 13 13"><path d="M3 11 11 3M7 11l4-4" stroke="currentColor" stroke-width="1.2"/></svg>' : ''}</div>`).join('');
  updateClock();
}
function updateClock() {
  const clock = document.getElementById('live-clock'); if (clock) clock.textContent = UI.time(new Date());
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  button.disabled = true;
  try {
    const action = button.dataset.action;
    if (action === 'pin') appState = await window.planner.settings({ pinned: !appState.settings.pinned });
    else if (action === 'settings' || action === 'week') await window.planner.openManager(action);
    else if (action === 'hide') await window.planner.hide();
    else if (action === 'lock-in') await window.planner.lockIn();
  } catch (error) { UI.toast(error.message, true); }
  finally { button.disabled = false; }
});
window.planner.onUpdate(state => { appState = state; if (!resizeDrag) render(); });
window.planner.getState().then(state => { appState = state; render(); if (state.recovery) UI.toast(state.recovery, true); }).catch(error => UI.toast(error.message, true));
let resizeDrag = null, resizeFrame = null, latestBounds = null, resizeInFlight = Promise.resolve();
function fitCards() { document.documentElement.style.setProperty('--ui-scale', Math.min(1, window.innerHeight / 774)); }
window.addEventListener('resize', fitCards); fitCards();
document.addEventListener('pointerdown', async event => {
  const handle = event.target.closest('[data-resize]'); if (!handle || event.button !== 0) return;
  event.preventDefault(); handle.setPointerCapture(event.pointerId);
  resizeDrag = { direction: handle.dataset.resize, screenX: event.screenX, screenY: event.screenY, handle, pointerId: event.pointerId, bounds: null };
  document.body.classList.add('resizing');
  const bounds = await window.planner.resizeStart(); if (resizeDrag) resizeDrag.bounds = bounds;
});
document.addEventListener('pointermove', event => {
  if (!resizeDrag?.bounds) return;
  const { direction, bounds } = resizeDrag, dx = event.screenX - resizeDrag.screenX, dy = event.screenY - resizeDrag.screenY;
  const width = Math.max(320, Math.min(1000, bounds.width + (direction.includes('e') ? dx : direction.includes('w') ? -dx : 0)));
  const height = Math.max(480, Math.min(1800, bounds.height + (direction.includes('s') ? dy : direction.includes('n') ? -dy : 0)));
  latestBounds = { x: direction.includes('w') ? bounds.x + bounds.width - width : bounds.x, y: direction.includes('n') ? bounds.y + bounds.height - height : bounds.y, width, height };
  if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = null; const request = latestBounds; resizeInFlight = resizeInFlight.then(() => window.planner.resize(request)).catch(error => UI.toast(error.message, true)); });
});
async function finishResize() {
  if (!resizeDrag) return;
  if (resizeFrame) { cancelAnimationFrame(resizeFrame); resizeFrame = null; }
  const bounds = latestBounds || resizeDrag.bounds;
  resizeDrag = null; latestBounds = null; document.body.classList.remove('resizing');
  await resizeInFlight;
  if (bounds) await window.planner.resize(bounds, true);
}
document.addEventListener('pointerup', () => finishResize().catch(error => UI.toast(error.message, true)));
document.addEventListener('pointercancel', () => finishResize().catch(error => UI.toast(error.message, true)));
document.addEventListener('lostpointercapture', () => finishResize().catch(error => UI.toast(error.message, true)));
window.addEventListener('blur', () => finishResize().catch(error => UI.toast(error.message, true)));
setInterval(() => { const minute = new Date().toISOString().slice(0, 16); if (minute !== lastMinute && !resizeDrag) { lastMinute = minute; render(); } else updateClock(); }, 1000);
