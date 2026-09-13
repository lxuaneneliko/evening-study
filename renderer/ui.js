const UI = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paths = {
    moon: '<path d="M20.8 13.5A9 9 0 0 1 10.5 3.2 9 9 0 1 0 20.8 13.5Z"/>',
    star: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/>',
    book: '<path d="M12 5v15M3 4q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h.01m6 0h.01"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4"/>',
    pin: '<path d="m8 3 8 0-1 7 4 4H5l4-4Zm4 11v7"/>',
    hide: '<path d="M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-8h6v8"/>',
    laptop: '<rect x="5" y="4" width="14" height="12" rx="2"/><path d="m5 16-3 4h20l-3-4"/>',
    shirt: '<path d="m8 3 4 3 4-3 6 5-4 4-2-2v11H8V10l-2 2-4-4Z"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    undo: '<path d="M4 10h10a6 6 0 1 1 0 12M4 10l5-5m-5 5 5 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
  const iconButton = (action, name, title, extra = '') => `<button class="icon-button" data-action="${action}" title="${escape(title)}" aria-label="${escape(title)}" ${extra}>${icon(name)}</button>`;
  let timer;
  function toast(text, error = false) { const target = document.getElementById('toast'); target.textContent = String(text).replace(/^Error invoking remote method '[^']+': Error: /, ''); target.className = `visible ${error ? 'error' : ''}`; clearTimeout(timer); timer = setTimeout(() => target.className = '', error ? 6500 : 3500); }
  const time = date => date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLabel = (dateString, now = new Date()) => dateString === PlannerCore.dateKey(now) ? '今天' : dateString === PlannerCore.dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) ? '明天' : `週${PlannerCore.weekdays[new Date(dateString + 'T12:00:00').getDay()]}`;
  return { escape, icon, iconButton, toast, time, dayLabel };
})();
