(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlannerCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const phases = ['早上', '下午', '晚上'];
  const clean = value => String(value ?? '').replace(/\*\*/g, '').replace(/<br\s*\/?\s*>/gi, '；').trim();
  const dayNumber = value => {
    const text = clean(value).replace(/^(星期|週|周)/, '').trim();
    if (['日', '天', '7', '0', 'Sun', 'Sunday'].includes(text)) return 7;
    const index = '一二三四五六'.indexOf(text);
    if (text.length === 1 && index >= 0) return index + 1;
    return /^[1-6]$/.test(text) ? Number(text) : null;
  };
  function minutes(time) {
    if (!/^\d{1,2}:\d{2}$/.test(time || '')) throw new Error(`時間格式不正確：${time}，請使用 08:00。`);
    const [h, m] = time.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error(`時間超出範圍：${time}`);
    return h * 60 + m;
  }
  const fmtTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const phaseFor = time => !time ? '全天' : minutes(time) < 12 * 60 ? '早上' : minutes(time) < 18 * 60 ? '下午' : '晚上';
  const emptyDays = () => Array.from({ length: 7 }, (_, i) => ({ day: i + 1, lodging: '', computer: '', clothes: '', entries: [] }));
  const textField = (value, max = 2000) => {
    if (value != null && typeof value !== 'string') throw new Error('文字欄位必須是字串。');
    if ((value || '').length > max) throw new Error(`文字超過 ${max} 字限制。`);
    return (value || '').trim();
  };
  function validateSchedule(input) {
    if (!input || !Array.isArray(input.days) || input.days.length !== 7) throw new Error('行程需要包含星期一到星期日的 7 天。');
    const seenDays = new Set(), ids = new Set();
    const days = input.days.map(day => {
      if (!Number.isInteger(day.day) || day.day < 1 || day.day > 7 || seenDays.has(day.day)) throw new Error('星期不可重複，請使用 1 到 7。');
      seenDays.add(day.day);
      if (!Array.isArray(day.entries) || day.entries.length > 100) throw new Error('每天最多可有 100 個行程。');
      const entries = day.entries.map((entry, index) => {
        const title = textField(entry.title, 160);
        if (!title) throw new Error(`星期${weekdays[day.day % 7]}有一個行程沒有名稱。`);
        let start = entry.start || null, end = entry.end || null;
        if (Boolean(start) !== Boolean(end)) throw new Error(`「${title}」請同時填寫開始與結束時間。`);
        if (start) {
          start = fmtTime(minutes(start)); end = fmtTime(minutes(end));
          if (start === end) throw new Error(`「${title}」開始和結束時間不可相同。`);
        }
        const id = textField(entry.id || `d${day.day}-${index}`, 120);
        if (ids.has(id) || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('行程識別碼重複或格式不正確。');
        ids.add(id);
        return { id, title, start, end, phase: ['早上', '下午', '晚上', '全天'].includes(entry.phase) ? entry.phase : phaseFor(start), book: textField(entry.book, 500), notes: textField(entry.notes) };
      });
      return { day: day.day, lodging: textField(day.lodging, 120), computer: textField(day.computer, 500), clothes: textField(day.clothes), entries };
    }).sort((a, b) => a.day - b.day);
    return { schemaVersion: 1, name: textField(input.name || '我的每週行程', 120), days };
  }
  function parseCell(value, day, phase, entries) {
    const text = clean(value).replace(/：/g, ':');
    if (!text || /^[-—–]+$/.test(text)) return;
    const chunks = text.split(/[；;\n]+/).map(x => x.trim()).filter(Boolean);
    for (const chunk of chunks) {
      // A cell may contain several ranges even when there is no semicolon.
      const range = /(\d{1,2}:\d{2})\s*[-–—~～至到]\s*(\d{1,2}:\d{2})\s*/g;
      const matches = [...chunk.matchAll(range)];
      const push = (title, start = null, end = null) => entries.push({ id: `d${day}-${entries.length}`, title: clean(title), start, end, phase, book: '', notes: '' });
      if (!matches.length) {
        if (/\d{1,2}:\d{2}/.test(chunk)) throw new Error(`「${chunk}」請提供完整的開始–結束時間。`);
        push(chunk); continue;
      }
      if (matches[0].index > 0) push(chunk.slice(0, matches[0].index));
      matches.forEach((match, i) => {
        const title = chunk.slice(match.index + match[0].length, matches[i + 1]?.index ?? chunk.length).trim();
        if (!title) throw new Error(`星期${weekdays[day % 7]} ${match[1]} 的行程缺少名稱。`);
        push(title, match[1], match[2]);
      });
    }
  }
  function parseDelimited(text, delimiter) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (quoted) throw new Error('CSV 的引號未成對，請檢查檔案。');
    row.push(cell); if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }
  function fromRows(rows, name = '匯入的每週行程') {
    const days = emptyDays();
    const normalized = rows.map(row => row.map(clean)).filter(row => row.some(Boolean));
    const first = normalized[0] || [];
    const col = (...labels) => first.findIndex(value => labels.includes(value));
    const startIndex = col('開始', '開始時間', 'start'), endIndex = col('結束', '結束時間', 'end');
    const titleIndex = col('事項', '科目', '行程', '名稱', 'title');
    let count = 0;
    if (startIndex >= 0 && endIndex >= 0 && titleIndex >= 0) {
      const dayIndex = col('星期', '週', 'day');
      if (dayIndex < 0) throw new Error('逐筆行程表缺少「星期」欄位。');
      for (const row of normalized.slice(1)) {
        const d = dayNumber(row[dayIndex]);
        if (!d) throw new Error(`無法辨認星期：${row[dayIndex]}`);
        const target = days[d - 1];
        const get = (...labels) => row[col(...labels)] || '';
        target.entries.push({ id: `d${d}-${target.entries.length}`, title: row[titleIndex], start: row[startIndex] || null, end: row[endIndex] || null, phase: get('時段', 'phase') || phaseFor(row[startIndex]), book: get('書本', '教材', 'book'), notes: get('備註', 'notes') });
        for (const [key, labels] of [['lodging', ['晚上住哪', '住宿']], ['computer', ['電腦']], ['clothes', ['衣服']]]) if (get(...labels)) target[key] = get(...labels);
        count++;
      }
    } else {
      const seen = new Set();
      for (const row of normalized) {
        const d = dayNumber(row[0]);
        if (!d) continue; // Markdown prose, header and separator are data, not commands.
        if (seen.has(d)) throw new Error(`星期${weekdays[d % 7]}重複了，請每一天只放一列。`);
        if (row.length < 4 || row.length > 7) throw new Error('每週表格請依序使用：星期、早上、下午、晚上、晚上住哪、電腦、衣服。');
        seen.add(d); count++;
        const target = days[d - 1];
        phases.forEach((phase, i) => parseCell(row[i + 1], d, phase, target.entries));
        target.lodging = row[4] || ''; target.computer = row[5] || ''; target.clothes = row[6] || '';
      }
    }
    if (!count) throw new Error('沒有找到行程。請貼上星期一到日的 Markdown 表格，或選擇 CSV、TSV、Excel、JSON 檔案。');
    return validateSchedule({ name, days });
  }
  function parseImport(text, format = '') {
    if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('匯入內容過大（上限 200 萬字元）。');
    text = text.replace(/^\uFEFF/, '').trim();
    if (!text) throw new Error('請先貼上或選擇一份行程表。');
    if (format === 'json' || text.startsWith('{')) {
      let parsed; try { parsed = JSON.parse(text); } catch { throw new Error('JSON 格式不正確。'); }
      return validateSchedule(parsed.schedule || parsed);
    }
    if (format === 'csv') return fromRows(parseDelimited(text, ','));
    if (format === 'tsv' || text.includes('\t')) return fromRows(parseDelimited(text, '\t'));
    if (text.includes('|')) {
      return fromRows(text.split(/\r?\n/).filter(line => line.includes('|')).map(line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')));
    }
    return fromRows(parseDelimited(text, ','));
  }
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const completionKey = item => `${item.date}|${item.id}`;
  function occurrences(schedule, now = new Date()) {
    const result = [];
    for (let offset = -1; offset <= 8; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const day = schedule.days.find(d => d.day === (date.getDay() || 7));
      if (!day) continue;
      for (const entry of day.entries) {
        if (!entry.start) continue;
        const start = new Date(date); start.setMinutes(minutes(entry.start));
        const end = new Date(date); end.setMinutes(minutes(entry.end));
        if (end <= start) end.setDate(end.getDate() + 1);
        result.push({ ...entry, day: day.day, date: dateKey(date), startsAt: start.getTime(), endsAt: end.getTime() });
      }
    }
    return result.sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
  }
  function snapshot(schedule, completions = {}, now = new Date()) {
    const all = occurrences(schedule, now), t = now.getTime();
    const active = all.filter(entry => entry.startsAt <= t && entry.endsAt > t);
    const current = active.find(entry => !completions[completionKey(entry)]) || active[0] || null;
    const next = all.filter(entry => entry.startsAt > t && !completions[completionKey(entry)]).slice(0, 3);
    const today = schedule.days.find(d => d.day === (now.getDay() || 7));
    const date = dateKey(now);
    const done = today.entries.filter(e => completions[`${date}|${e.id}`]).length;
    const flexible = today.entries.filter(e => !e.start).map(e => ({ ...e, date, day: today.day }));
    return { current, active, next, today, flexible, date, done, total: today.entries.length };
  }
  function warnings(schedule) {
    const list = [];
    const flexible = schedule.days.flatMap(d => d.entries).filter(e => !e.start).length;
    if (flexible) list.push(`${flexible} 個行程沒有時間，會保留在當日提醒；補上時間後可自動切換與通知。`);
    const all = occurrences(schedule, new Date(2026, 8, 14));
    const conflicts = new Set();
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length && all[j].startsAt < all[i].endsAt; j++) {
      const key = [all[i].id, all[j].id].sort().join('|');
      if (!conflicts.has(key)) { list.push(`時間重疊：星期${weekdays[all[i].day % 7]}「${all[i].title}」與「${all[j].title}」。`); conflicts.add(key); }
    }
    return list;
  }
  function toMarkdown(schedule) {
    const escape = text => String(text || '').replace(/\|/g, '／').replace(/\r?\n/g, '；');
    const header = '| 星期 | 早上讀書 | 下午讀書 | 晚上讀書／安排 | 晚上住哪 | 電腦 | 衣服 |\n| --- | --- | --- | --- | --- | --- | --- |';
    return `${header}\n${schedule.days.map(day => `| ${[weekdays[day.day % 7], ...phases.map((phase, i) => day.entries.filter(e => e.phase === phase || (i === 0 && e.phase === '全天')).map(e => `${e.start ? `${e.start}–${e.end} ` : ''}${e.title}`).join('；')), day.lodging, day.computer, day.clothes].map(escape).join(' | ')} |`).join('\n')}\n`;
  }
  return { weekdays, phases, minutes, fmtTime, phaseFor, emptyDays, validateSchedule, parseImport, fromRows, parseDelimited, dateKey, completionKey, occurrences, snapshot, warnings, toMarkdown };
});
