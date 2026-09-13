const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../shared/core');
const schedule = require('../shared/default-schedule.json');
const sample = fs.readFileSync(path.join(__dirname, '../samples/我的每週行程.md'), 'utf8');
const custom = entries => C.validateSchedule({ days: C.emptyDays().map(d => ({ ...d, entries: entries.filter(e => e.day === d.day).map(e => ({ phase: '晚上', ...e })) })) });
test('user table preserves every timed task and untimed reminder', () => {
  const parsed = C.parseImport(sample);
  assert.equal(parsed.days.flatMap(d => d.entries).length, 35);
  assert.equal(parsed.days.flatMap(d => d.entries).filter(e => e.start).length, 26);
  assert.equal(parsed.days[6].clothes, '帶 3 份換洗＋乾淨睡衣；土城預留週四穿著及週五換洗');
  assert.equal(parsed.days[2].entries[3].title, '下課回土城');
  assert.ok(parsed.days[1].entries.some(e => e.title === '創業課考試準備'));
  assert.ok(parsed.days[5].entries.some(e => e.title === '創業課報告'));
});
test('original merged Markdown header and bold days are accepted', () => {
  const broken = sample.replace(sample.split('\n')[0], '| 星期早上讀書下午讀書晚上讀書／安排晚上住哪電腦衣服 | | | | | | |').replace('| 一 |', '| **一** |');
  assert.equal(C.parseImport(broken).days[0].entries[0].start, '08:00');
});
test('minute boundaries switch exactly at start and end', () => {
  assert.equal(C.snapshot(schedule, {}, new Date(2026, 8, 14, 7, 59, 59)).current, null);
  assert.equal(C.snapshot(schedule, {}, new Date(2026, 8, 14, 8, 0)).current.title, '工數');
  const result = C.snapshot(schedule, {}, new Date(2026, 8, 14, 9, 30));
  assert.equal(result.current, null); assert.equal(result.next[0].title, '工材');
});
test('Sunday evening rolls to next week Monday', () => {
  const result = C.snapshot(schedule, {}, new Date(2026, 8, 13, 22));
  assert.equal(result.next[0].day, 1); assert.equal(result.next[0].date, '2026-09-14');
});
test('completion belongs to one occurrence, not every future week', () => {
  const done = { '2026-09-14|d1-0': true };
  assert.equal(C.snapshot(schedule, done, new Date(2026, 8, 14, 8, 30)).done, 1);
  assert.equal(C.snapshot(schedule, done, new Date(2026, 8, 21, 8, 30)).done, 0);
  assert.equal(C.snapshot(schedule, done, new Date(2026, 8, 21, 7)).next[0].title, '工數');
});
test('unscheduled commute stays a reminder without an invented time', () => {
  const result = C.snapshot(schedule, {}, new Date(2026, 8, 16, 10));
  assert.equal(result.current, null); assert.equal(result.flexible.length, 4);
  assert.ok(result.flexible.every(e => e.start === null && e.end === null));
});
test('previous day overnight block is active after midnight', () => {
  const s = custom([{ day: 7, id: 'overnight', title: '夜讀', start: '23:30', end: '01:00' }]);
  const result = C.snapshot(s, {}, new Date(2026, 8, 14, 0, 30));
  assert.equal(result.current.title, '夜讀'); assert.equal(result.current.date, '2026-09-13');
  assert.equal(C.snapshot(s, {}, new Date(2026, 8, 14, 1, 0)).current, null);
});
test('overlap warnings include cross-day and weekly wrap conflicts', () => {
  const s = custom([{ day: 7, id: 'a', title: '夜讀', start: '23:30', end: '01:00' }, { day: 1, id: 'b', title: '另一項', start: '00:30', end: '02:00' }]);
  assert.equal(C.warnings(s).length, 1); assert.match(C.warnings(s)[0], /時間重疊/);
});
test('malformed or invalid times never silently become reminders', () => {
  for (const cell of ['25:00–26:00 工數', '08:65–09:00 工數', '08:00 工數', '08:00–08:00 工數', '08:00–09:00']) {
    assert.throws(() => C.parseImport(`| 一 | ${cell} | | |`));
  }
});
test('multiple time ranges without a semicolon are separated', () => {
  const s = C.parseImport('| 一 | 08:00–09:00 工數 09:15–10:00 電路 | | |');
  assert.equal(s.days[0].entries.length, 2); assert.equal(s.days[0].entries[1].title, '電路');
});
test('CSV supports quoted commas, notes, and embedded newlines', () => {
  const csv = '星期,開始,結束,事項,書本,備註\r\n一,08:00,09:00,"工數,練習",第一章,"一行\n二行"';
  const e = C.parseImport(csv, 'csv').days[0].entries[0];
  assert.equal(e.title, '工數,練習'); assert.equal(e.notes, '一行\n二行');
});
test('weekly TSV pasted from Excel keeps logistics', () => {
  const s = C.parseImport('星期\t早上\t下午\t晚上\t住哪\t電腦\t衣服\n星期日\t09:00–10:00 工數\t\t\t基隆\t土城→基隆\t3份');
  assert.equal(s.days[6].computer, '土城→基隆');
});
test('JSON roundtrip preserves book and notes', () => {
  const s = structuredClone(schedule); s.days[0].entries[0].book = '微分方程，第 1 章'; s.days[0].entries[0].notes = '1–10 題';
  assert.deepEqual(C.parseImport(JSON.stringify(s)), s);
});
test('Markdown roundtrip preserves all source table content', () => {
  const parsed = C.parseImport(C.toMarkdown(schedule));
  assert.deepEqual(parsed.days, schedule.days);
});
test('bad dates, duplicate ids, and invalid schemas are rejected', () => {
  const bad = structuredClone(schedule); bad.days[1].entries[0].id = bad.days[0].entries[0].id;
  assert.throws(() => C.validateSchedule(bad));
  assert.throws(() => C.validateSchedule({ days: [] }));
  assert.throws(() => C.parseImport('{bad}'));
  assert.throws(() => C.parseImport('some prose without a schedule'));
  assert.throws(() => C.parseImport('| 一 | 上課 | | |\n| 一 | 下課 | | |'));
});
test('empty weekly schedule produces a useful empty snapshot', () => {
  const result = C.snapshot(C.validateSchedule({ days: C.emptyDays() }));
  assert.equal(result.current, null); assert.equal(result.next.length, 0); assert.equal(result.total, 0);
});
test('overlapping active tasks prefer unfinished task', () => {
  const s = custom([{ day: 1, id: 'a', title: 'A', start: '08:00', end: '09:00' }, { day: 1, id: 'b', title: 'B', start: '08:30', end: '09:30' }]);
  assert.equal(C.snapshot(s, { '2026-09-14|a': true }, new Date(2026, 8, 14, 8, 40)).current.id, 'b');
});
test('out of bounds imports and open quotes are rejected', () => {
  assert.throws(() => C.parseImport('x'.repeat(2_000_001)));
  assert.throws(() => C.parseDelimited('a,"b', ','));
});
