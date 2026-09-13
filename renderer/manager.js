const C = PlannerCore, { escape: esc, icon, iconButton } = UI;
let appState, selectedDay = new Date().getDay() || 7, currentView = new URLSearchParams(location.search).get('view') || 'week';
let pendingImport = null, importText = '', importFilename = '', importFormat = '', dialogType = '', editId = null;
const viewLabels = { week: ['YOUR WEEK, UNFOLDED', '每週行程', '把讀書、上課和生活，放在剛剛好的位置。'], import: ['A FRESH PAGE', '匯入行程', '一份表格，就能開始。你的安排會在桌面上慢慢展開。'], settings: ['MAKE ROOM FOR YOURSELF', '桌面設定', '調成你喜歡的樣子，安靜地陪著你。'] };
const selected = () => appState.schedule.days.find(d => d.day === selectedDay);
function render() {
  const scroll = window.scrollY;
  if (!viewLabels[currentView]) currentView = 'week';
  const [kicker, title, subtitle] = viewLabels[currentView];
  document.getElementById('app').innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand-large"><img src="../assets/icon.svg" alt=""><h1>暮讀</h1></div><p class="brand-caption">AFTERGLOW</p><nav aria-label="主要導覽">${[['week', 'calendar', '每週行程'], ['import', 'upload', '匯入行程'], ['settings', 'settings', '桌面設定']].map(([view, glyph, label]) => `<button class="nav-button ${currentView === view ? 'active' : ''}" data-view="${view}" ${currentView === view ? 'aria-current="page"' : ''}>${icon(glyph)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-verse">${icon('moon')}不必追趕所有星光，<br>讀好眼前這一頁。</div><button class="button subtle full-width" data-action="show-widget">${icon('arrow')}回到桌面卡片</button><div class="sidebar-foot"><span class="live-dot"></span> 行程儲存在這台電腦<br>每週循環・依電腦本地時間<br><span>暮讀 1.1.1</span></div></div></aside><main class="workspace"><header class="page-header"><div><p class="page-kicker">${kicker}</p><h2>${title}</h2><p class="page-subtitle">${subtitle}</p></div>${currentView === 'week' ? `<div class="header-actions"><button class="button subtle" data-action="export">${icon('download')}備份行程</button><button class="button primary" data-view="import">${icon('upload')}匯入新行程</button></div>` : ''}</header>${appState.recovery ? `<div class="notice">${esc(appState.recovery)}</div>` : ''}${currentView === 'week' ? renderWeek() : currentView === 'import' ? renderImport() : renderSettings()}</main></div>`;
  if (currentView === 'import') { document.getElementById('import-text').value = importText; renderImportPreview(); }
  window.scrollTo(0, scroll);
}
function renderWeek() {
  const schedule = appState.schedule, entries = schedule.days.flatMap(d => d.entries), timed = entries.filter(e => e.start);
  const hours = timed.reduce((sum, entry) => sum + ((C.minutes(entry.end) - C.minutes(entry.start) + 1440) % 1440), 0) / 60;
  const today = new Date().getDay() || 7;
  const alerts = C.warnings(schedule);
  return `<div class="overview-strip"><div>${icon('book')}<span><strong>${timed.length}</strong> 定時安排</span></div><div><span><strong>${Number(hours.toFixed(1))}</strong> 小時／週</span></div><div><span><strong>${entries.length - timed.length}</strong> 未定時提醒</span></div><span class="pill">每週循環</span></div>
  <div class="table-heading"><h3>${esc(schedule.name)}</h3><span>點選星期，編輯當天安排</span></div>
  <div class="week-table-wrap"><table class="week-table"><thead><tr>${['星期', '早上', '下午', '晚上／安排', '住哪', '電腦', '衣物提醒'].map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${schedule.days.map(day => `<tr class="${day.day === selectedDay ? 'selected' : ''}"><td><button class="day-button" data-day="${day.day}" aria-label="編輯星期${C.weekdays[day.day % 7]}">${C.weekdays[day.day % 7]}</button>${day.day === today ? '<span class="today-dot">今天</span>' : ''}</td>${C.phases.map((phase, i) => `<td>${day.entries.filter(e => e.phase === phase || (i === 0 && e.phase === '全天')).map(e => `<div class="table-entry">${e.start ? `<time>${e.start}–${e.end}</time>` : '<span class="flex-label">未定時 · </span>'}${esc(e.title)}</div>`).join('') || '<span class="muted">—</span>'}</td>`).join('')}<td>${esc(day.lodging) || '—'}</td><td>${esc(day.computer) || '—'}</td><td>${esc(day.clothes) || '—'}</td></tr>`).join('')}</tbody></table></div>
  ${alerts.length ? `<details class="notice"><summary>行程小提醒 · ${alerts.length} 項</summary>${alerts.map(text => `<p>${esc(text)}</p>`).join('')}</details>` : ''}
  <section class="section-panel" id="day-details">${renderDay()}</section>
  ${appState.canUndo ? `<button class="text-button" data-action="undo">${icon('undo')}復原上一次行程修改</button>` : ''}`;
}
function renderDay() {
  const day = selected(), isToday = day.day === (new Date().getDay() || 7), date = C.dateKey(new Date());
  const entries = [...day.entries].sort((a, b) => (a.start ? C.minutes(a.start) : ({ 早上: 0, 下午: 720, 晚上: 1080, 全天: -1 }[a.phase])) - (b.start ? C.minutes(b.start) : ({ 早上: 0, 下午: 720, 晚上: 1080, 全天: -1 }[b.phase])));
  return `<div class="detail-heading"><h3>星期${C.weekdays[day.day % 7]}</h3><div class="day-tabs">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="${d === selectedDay ? 'active' : ''}" data-day="${d}" aria-label="查看星期${C.weekdays[d % 7]}">${C.weekdays[d % 7]}</button>`).join('')}</div><button class="button subtle" data-action="add">${icon('plus')}新增安排</button></div>
  ${entries.map(entry => { const done = isToday && appState.completions[`${date}|${entry.id}`]; return `<article class="agenda-entry ${done ? 'done' : ''}">${isToday ? `<button class="complete-dot" data-action="complete" data-key="${date}|${entry.id}" aria-label="${done ? '復原' : '完成'} ${esc(entry.title)}" aria-pressed="${Boolean(done)}">${done ? icon('check') : ''}</button>` : ''}<div class="agenda-time">${entry.start ? `${entry.start}–${entry.end}` : esc(entry.phase)}<small>${entry.start ? C.minutes(entry.end) < C.minutes(entry.start) ? '至隔天' : '定時安排' : '待補時間'}</small></div><div class="agenda-copy"><h4>${esc(entry.title)}</h4>${entry.book ? `<p>${icon('book')} ${esc(entry.book)}</p>` : ''}${entry.notes ? `<p>${esc(entry.notes)}</p>` : ''}</div>${iconButton('edit', 'edit', `編輯 ${entry.title}`, `data-id="${entry.id}"`)}</article>`; }).join('') || '<div class="empty-state">今天還有很多空白，寫下一個想完成的安排吧。</div>'}
  <div class="logistic-editor"><div><h4>${icon('home')}今晚住哪</h4><p>${esc(day.lodging) || '尚未安排'}</p></div><div><h4>${icon('laptop')}電腦移動</h4><p>${esc(day.computer) || '尚未安排'}</p></div><div><h4>${icon('shirt')}衣物與行李</h4><p>${esc(day.clothes) || '尚未安排'}</p></div></div><button class="text-button" data-action="logistics">${icon('edit')}編輯生活提醒</button>`;
}
function renderImport() {
  return `<div class="import-grid"><section class="section-panel"><h3>把你的計畫帶進來</h3><p class="muted">支援 Markdown、CSV、TSV、Excel（.xlsx）與暮讀 JSON 備份。</p><div class="import-drop">${icon('upload')}<button class="button subtle" data-action="choose-file">選擇行程檔案</button><p>${esc(importFilename) || 'Excel 請將行程放在第一個工作表'}</p></div><div class="divider-label">或直接貼上表格</div><label for="import-text">行程內容</label><textarea id="import-text" spellcheck="false" placeholder="| 星期 | 早上讀書 | 下午讀書 | 晚上讀書／安排 | 晚上住哪 | 電腦 | 衣服 |&#10;| --- | --- | --- | --- | --- | --- | --- |&#10;| 一 | 08:00–09:30 工數 | 16:20–17:35 工材 | 19:30–20:30 奈米材料 | 基隆 | 留基隆 | 髒衣集中 |"></textarea><div class="form-actions"><button class="text-button" data-action="fill-example">填入格式範例</button><button class="button primary" data-action="preview-import">${icon('arrow')}辨識並預覽</button></div><div id="import-error"></div><div id="import-preview"></div></section><aside class="format-note">${icon('star')}<h3>從你的表格開始</h3><p>每週表格的欄位順序：</p><p><code>星期 → 早上 → 下午 → 晚上 → 晚上住哪 → 電腦 → 衣服</code></p><p>同一格有多個安排，用「；」分開。例如：</p><p><code>09:00–10:30 工數；10:45–12:00 電路</code></p><p>也支援逐筆 CSV：</p><p><code>星期,開始,結束,事項,書本,備註</code></p><p>沒有時間的內容會保留為提醒，可在手帳內補上。結束早於開始的行程會算到隔天。</p><p>預覽後才會套用。套用會替換整週安排，並保留上一份供復原。</p></aside></div>`;
}
function renderImportPreview() {
  const target = document.getElementById('import-preview'); if (!target) return;
  if (!pendingImport) { target.innerHTML = ''; return; }
  const count = pendingImport.days.flatMap(d => d.entries).length, alerts = C.warnings(pendingImport);
  target.innerHTML = `<div class="preview-summary"><span>${icon('check')} 已辨識 ${count} 個安排</span><span>7 天</span></div><label for="import-name">行程名稱</label><input id="import-name" maxlength="120" value="${esc(pendingImport.name)}"><div class="preview-rows" style="margin-top:14px">${pendingImport.days.map(day => `<div class="preview-row"><strong>週${C.weekdays[day.day % 7]}</strong><div>${day.entries.map(e => `<p>${esc(e.start ? `${e.start}–${e.end}` : `${e.phase}・未定時`)} ${esc(e.title)}</p>`).join('') || '<p>無安排</p>'}${day.lodging || day.computer || day.clothes ? `<p>住宿：${esc(day.lodging) || '—'}<br>電腦：${esc(day.computer) || '—'}<br>衣物：${esc(day.clothes) || '—'}</p>` : ''}</div></div>`).join('')}</div>${alerts.length ? `<div class="notice">${alerts.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}<p class="help-line">套用會取代整週行程，可使用「復原上一次行程修改」回復。</p><div class="form-actions"><button class="button primary" data-action="apply-import">${icon('check')}套用這份行程</button></div>`;
}
function renderSettings() {
  const s = appState.settings;
  const toggle = (key, label) => `<button class="switch" role="switch" aria-label="${label}" aria-checked="${s[key]}" data-setting="${key}" ${key === 'autoStart' && !appState.packaged ? 'disabled' : ''}></button>`;
  return `<section class="section-panel settings-list"><div class="setting-row"><div class="setting-copy"><h3>保持在其他視窗上方</h3><p>開啟後，即使正在使用其他 App，也看得到行程卡片。</p></div>${toggle('pinned', '保持在其他視窗上方')}</div><div class="setting-row"><div class="setting-copy"><h3>卡片尺寸</h3><p>拖曳邊緣或角落可調整大小；拖曳標題可移動，尺寸會自動保存。</p></div><select id="setting-width" data-setting-select="width" aria-label="卡片尺寸">${[...(![360,420,460].includes(s.width) ? [[s.width, '自訂 · ' + s.width + ' px']] : []), [360, '小巧 · 360 px'], [420, '舒適 · 420 px'], [460, '寬敞 · 460 px']].map(([v, name]) => `<option value="${v}" ${s.width === v ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="setting-row"><div class="setting-copy"><h3>卡片不透明度</h3><p>讓文字保持清楚，也留一點桌布的氣息。</p></div><div class="range-control"><input type="range" id="setting-opacity" min="75" max="100" value="${s.opacity}" aria-label="卡片不透明度"><span id="opacity-value">${s.opacity}%</span></div></div><div class="setting-row"><div class="setting-copy"><h3>行程提醒</h3><p>定時行程開始與提前提醒時，顯示 Windows 通知。</p></div>${toggle('notifications', '行程提醒')}</div><div class="setting-row"><div class="setting-copy"><h3>提前提醒</h3><p>沒有明確時間的安排不會發出通知。</p></div><select data-setting-select="reminderMinutes" aria-label="提前提醒">${[0, 5, 10, 15].map(v => `<option value="${v}" ${s.reminderMinutes === v ? 'selected' : ''}>${v ? `提前 ${v} 分鐘` : '僅在開始時提醒'}</option>`).join('')}</select></div><div class="setting-row"><div class="setting-copy"><h3>登入 Windows 時啟動</h3><p>${appState.packaged ? '開機後自動顯示桌面卡片。請將 App 保存在固定位置。' : '請在打包完成的正式版中開啟。'}</p></div>${toggle('autoStart', '登入 Windows 時啟動')}</div></section><div class="settings-actions"><button class="button subtle" data-action="reset-position">${icon('arrow')}移回主螢幕右側</button><button class="button subtle" data-action="export">${icon('download')}備份完整行程</button>${appState.canUndo ? `<button class="button subtle" data-action="undo">${icon('undo')}復原上一次修改</button>` : ''}</div><p class="settings-note">顯示／隱藏快捷鍵：<kbd class="keyboard">Ctrl + Shift + Space</kbd><br>也可以從 Windows 系統匣的月亮圖示叫回卡片；右鍵選單可完全結束 App。<br>行程、書本與完成紀錄儲存在本機，App 不會上傳你的資料。<br>資料位置：<code>${esc(appState.dataPath)}</code></p>`;
}
function navigate(view) {
  if (currentView === 'import') importText = document.getElementById('import-text')?.value || importText;
  currentView = view; render(); window.scrollTo(0, 0);
}
function openEditor(id = null) {
  dialogType = 'entry'; editId = id;
  const entry = selected().entries.find(e => e.id === id) || { title: '', start: '19:30', end: '20:30', phase: '晚上', book: '', notes: '' };
  const flexible = !entry.start;
  const dialog = document.getElementById('editor-dialog');
  dialog.innerHTML = `<form id="entry-form"><div class="dialog-heading"><h3>${id ? '編輯' : '新增'} · 星期${C.weekdays[selectedDay % 7]}</h3>${iconButton('close-dialog', 'close', '關閉編輯')}</div><div class="form-field"><label for="entry-title">要做什麼</label><input id="entry-title" name="title" required maxlength="160" value="${esc(entry.title)}" placeholder="例如：工數、電路、創業課報告"></div><label class="checkbox-label"><input type="checkbox" id="entry-flexible" ${flexible ? 'checked' : ''}>時間還沒確定，先記成提醒</label><div class="form-grid" id="entry-times" ${flexible ? 'hidden' : ''}><div class="form-field"><label for="entry-start">開始時間</label><input type="time" id="entry-start" name="start" value="${entry.start || '19:30'}"></div><div class="form-field"><label for="entry-end">結束時間</label><input type="time" id="entry-end" name="end" value="${entry.end || '20:30'}"></div></div><div class="form-field"><label for="entry-phase">放在每週表格的哪個時段</label><select id="entry-phase" name="phase">${['早上', '下午', '晚上', '全天'].map(p => `<option ${p === entry.phase ? 'selected' : ''}>${p}</option>`).join('')}</select><div class="dialog-help">結束早於開始時，會安排到隔天；全天提醒會列在早上欄位。</div></div><div class="form-field"><label for="entry-book">書本／章節（選填）</label><input id="entry-book" name="book" maxlength="500" value="${esc(entry.book)}" placeholder="例如：工程數學課本，第 3 章練習"></div><div class="form-field"><label for="entry-notes">讀書目標／備註（選填）</label><textarea id="entry-notes" name="notes" maxlength="2000" placeholder="例如：完成習題 1–10，整理不熟的觀念">${esc(entry.notes)}</textarea></div><div class="dialog-footer">${id ? '<button class="button danger" type="button" data-action="delete-entry">移除此安排</button>' : ''}<span class="spacer"></span><button class="button subtle" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">${icon('check')}儲存安排</button></div></form>`;
  dialog.querySelector('[data-action="close-dialog"]').type = 'button';
  dialog.showModal();
}
function openLogistics() {
  dialogType = 'logistics'; const day = selected(), dialog = document.getElementById('editor-dialog');
  dialog.innerHTML = `<form id="logistics-form"><div class="dialog-heading"><h3>星期${C.weekdays[selectedDay % 7]} · 生活提醒</h3>${iconButton('close-dialog', 'close', '關閉編輯')}</div><div class="form-field"><label for="lodging">今晚住哪</label><input id="lodging" name="lodging" maxlength="120" value="${esc(day.lodging)}"></div><div class="form-field"><label for="computer">電腦移動</label><input id="computer" name="computer" maxlength="500" value="${esc(day.computer)}"></div><div class="form-field"><label for="clothes">衣物與行李</label><textarea id="clothes" name="clothes" maxlength="2000">${esc(day.clothes)}</textarea></div><div class="form-actions"><button class="button subtle" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">儲存提醒</button></div></form>`;
  dialog.querySelector('[data-action="close-dialog"]').type = 'button'; dialog.showModal();
}
async function saveEntry(event) {
  event.preventDefault();
  const form = event.target, data = Object.fromEntries(new FormData(form)), schedule = structuredClone(appState.schedule), day = schedule.days.find(d => d.day === selectedDay);
  try {
    if (form.id === 'entry-form') {
      const flexible = document.getElementById('entry-flexible').checked;
      const entry = { id: editId || `entry-${crypto.randomUUID()}`, ...data, start: flexible ? null : data.start, end: flexible ? null : data.end };
      if (editId) day.entries = day.entries.map(e => e.id === editId ? entry : e); else day.entries.push(entry);
    } else if (form.id === 'logistics-form') Object.assign(day, data);
    else return;
    appState = await window.planner.saveSchedule(C.validateSchedule(schedule));
    document.getElementById('editor-dialog').close(); render(); UI.toast('已儲存，桌面卡片也更新了。');
  } catch (error) { UI.toast(error.message, true); }
}
document.addEventListener('submit', saveEntry);
document.addEventListener('input', event => {
  if (event.target.id === 'import-text') { importText = event.target.value; pendingImport = null; importFormat = ''; renderImportPreview(); }
  if (event.target.id === 'setting-opacity') document.getElementById('opacity-value').textContent = `${event.target.value}%`;
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.id === 'entry-flexible') { document.getElementById('entry-times').hidden = target.checked; return; }
  if (target.id === 'entry-start' && target.value) document.getElementById('entry-phase').value = C.phaseFor(target.value);
  try {
    if (target.dataset.settingSelect) { appState = await window.planner.settings({ [target.dataset.settingSelect]: Number(target.value) }); UI.toast('設定已儲存'); }
    if (target.id === 'setting-opacity') { appState = await window.planner.settings({ opacity: Number(target.value) }); UI.toast('透明度已更新'); }
  } catch (error) { UI.toast(error.message, true); render(); }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.view) { navigate(button.dataset.view); return; }
  if (button.dataset.day) { selectedDay = Number(button.dataset.day); render(); document.getElementById('day-details').scrollIntoView({ block: 'nearest' }); return; }
  if (button.type === 'submit' && button.closest('form')) return;
  try {
    if (button.dataset.setting) { const key = button.dataset.setting; appState = await window.planner.settings({ [key]: !appState.settings[key] }); render(); return; }
    const action = button.dataset.action;
    if (action === 'add' || action === 'edit') openEditor(button.dataset.id);
    else if (action === 'logistics') openLogistics();
    else if (action === 'close-dialog') document.getElementById('editor-dialog').close();
    else if (action === 'complete') appState = await window.planner.complete(button.dataset.key);
    else if (action === 'delete-entry') {
      const schedule = structuredClone(appState.schedule); const day = schedule.days.find(d => d.day === selectedDay);
      day.entries = day.entries.filter(e => e.id !== editId); appState = await window.planner.saveSchedule(schedule);
      document.getElementById('editor-dialog').close(); render(); UI.toast('已移除。可在下方復原上一次修改。');
    } else if (action === 'choose-file') {
      button.disabled = true;
      const imported = await window.planner.chooseImport();
      if (imported) {
        importFilename = imported.filename; importText = imported.text || ''; importFormat = imported.format || '';
        pendingImport = imported.schedule || C.parseImport(importText, importFormat); render();
      }
    } else if (action === 'fill-example') {
      importText = '| 星期 | 早上讀書 | 下午讀書 | 晚上讀書／安排 | 晚上住哪 | 電腦 | 衣服 |\n| --- | --- | --- | --- | --- | --- | --- |\n| 一 | 08:00–09:30 工數 | 16:20–17:35 工材 | 19:30–20:30 奈米材料；20:45–21:45 電路 | 基隆 | 留基隆 | 使用 1 份換洗；髒衣集中 |\n| 二 | | | | | | |\n| 三 | 上課 | 上課、通勤 | 創業課上課；下課回土城 | 土城 | 基隆→晚課→土城 | 帶回髒衣 |\n| 四 | | | | | | |\n| 五 | | | | | | |\n| 六 | | | | | | |\n| 日 | | | | | | |';
      importFormat = ''; importFilename = ''; pendingImport = null; render();
    } else if (action === 'preview-import') {
      try { pendingImport = C.parseImport(document.getElementById('import-text').value, importFormat); document.getElementById('import-error').innerHTML = ''; renderImportPreview(); document.getElementById('import-preview').scrollIntoView({ block: 'nearest' }); }
      catch (error) { pendingImport = null; renderImportPreview(); document.getElementById('import-error').innerHTML = `<div class="notice error-box">${esc(error.message)}</div>`; }
    } else if (action === 'apply-import') {
      if (!pendingImport) return;
      pendingImport.name = document.getElementById('import-name').value.trim() || '我的每週行程';
      appState = await window.planner.saveSchedule(pendingImport); pendingImport = null; importText = ''; importFilename = ''; navigate('week'); UI.toast('整週行程已套用，桌面卡片同步更新。');
    } else if (action === 'undo') { appState = await window.planner.undoImport(); render(); UI.toast('已復原上一次行程修改。'); }
    else if (action === 'export') { const saved = await window.planner.exportSchedule(); if (saved) UI.toast('已備份完整行程（含書本與備註）。'); }
    else if (action === 'reset-position') { await window.planner.resetPosition(); UI.toast('卡片已移回主螢幕右側。'); }
    else if (action === 'show-widget') { await window.planner.show(); window.close(); }
  } catch (error) { UI.toast(error.message, true); }
  finally { button.disabled = false; }
});
window.planner.onUpdate(state => { appState = state; if (currentView !== 'import') render(); });
window.planner.onNavigate(navigate);
window.planner.getState().then(state => { appState = state; render(); }).catch(error => UI.toast(error.message, true));
