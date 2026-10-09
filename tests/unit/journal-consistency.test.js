// REQ-15 — Journal Consistency (calendar month) unit tests
// ใช้ข้อมูลจำลองเท่านั้น ดึงฟังก์ชันจริงจาก Index.html ระหว่างเครื่องหมาย REQ-15:BEGIN / REQ-15:END
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const index = fs.readFileSync(path.join(__dirname, '..', '..', 'Index.html'), 'utf8');
const block = index.match(/\/\* REQ-15:BEGIN[\s\S]*?\/\* REQ-15:END \*\//);
if (!block) throw new Error('ไม่พบบล็อก REQ-15 ใน Index.html');
const monthsLine = index.match(/const THAI_MONTHS = \[[^\]]*\];/);
if (!monthsLine) throw new Error('ไม่พบ THAI_MONTHS ใน Index.html');

// ใส่ monthKey/cycleStartDay ที่โยน error เพื่อพิสูจน์ว่าฟังก์ชันไม่ผูกกับงวดการเงิน
const context = vm.createContext({
  monthKey() { throw new Error('ห้ามใช้ monthKey ใน REQ-15'); },
  cycleStartDay() { throw new Error('ห้ามใช้ cycleStartDay ใน REQ-15'); },
  cycleRange() { throw new Error('ห้ามใช้ cycleRange ใน REQ-15'); }
});
vm.runInContext(`${monthsLine[0]}\nfunction toBuddhistYear(y){ return y + 543; }\n${block[0]}\nthis.fn = journalCalendarConsistency;`, context);
const stats = (journals, today, back) => JSON.parse(JSON.stringify(context.fn(journals, today, back)));
const j = (date, draft = false) => ({ id: 'mock_' + date + (draft ? '_d' : ''), date, draft, title: 'ข้อมูลจำลอง' });

test('แสดง 3 เดือนปฏิทิน เรียงเก่าไปปัจจุบัน พร้อมชื่อเดือนและปี พ.ศ.', () => {
  const r = stats([], '2026-10-09');
  assert.deepEqual(r.map(x => x.key), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(r.map(x => x.label), ['สิงหาคม 2569', 'กันยายน 2569', 'ตุลาคม 2569']);
  assert.deepEqual(r.map(x => x.isCurrent), [false, false, true]);
});

test('วันเดียวกันหลายรายการนับเป็น 1 วัน', () => {
  const r = stats([j('2026-09-15'), j('2026-09-15'), j('2026-09-15'), j('2026-09-16')], '2026-10-09');
  assert.equal(r[1].recordedDays, 2);
});

test('ไม่นับฉบับร่าง และวันที่มีทั้งร่างและฉบับจริงนับ 1 วัน', () => {
  const r = stats([j('2026-10-01', true), j('2026-10-02', true), j('2026-10-02'), j('2026-10-03', true)], '2026-10-09');
  assert.equal(r[2].recordedDays, 1);
});

test('เดือนว่างแสดง 0 วัน และ 0%', () => {
  const r = stats([j('2026-10-05')], '2026-10-09');
  assert.equal(r[0].recordedDays, 0);
  assert.equal(r[0].totalDays, 31);
  assert.equal(r[0].pct, 0);
});

test('เดือนปัจจุบันคำนวณถึงวันนี้ และไม่นับบันทึกวันในอนาคต', () => {
  const r = stats([j('2026-10-01'), j('2026-10-09'), j('2026-10-20')], '2026-10-09');
  assert.equal(r[2].totalDays, 9);
  assert.equal(r[2].recordedDays, 2);
  assert.equal(r[2].pct, 22.2);
});

test('ปีอธิกสุรทิน: ก.พ. 2028 มี 29 วัน และปีปกติ ก.พ. 2027 มี 28 วัน', () => {
  assert.equal(stats([], '2028-04-10')[0].totalDays, 29);
  assert.equal(stats([], '2027-04-10')[0].totalDays, 28);
});

test('ข้ามปี: มกราคมย้อนไป พ.ย. และ ธ.ค. ของปีก่อน', () => {
  const r = stats([j('2025-11-30'), j('2025-12-31'), j('2026-01-01')], '2026-01-01');
  assert.deepEqual(r.map(x => x.key), ['2025-11', '2025-12', '2026-01']);
  assert.deepEqual(r.map(x => x.label), ['พฤศจิกายน 2568', 'ธันวาคม 2568', 'มกราคม 2569']);
  assert.deepEqual(r.map(x => x.recordedDays), [1, 1, 1]);
  assert.equal(r[2].totalDays, 1);
  assert.equal(r[2].pct, 100);
});

test('บันทึกวันที่ 28–31 อยู่ในเดือนปฏิทินของตัวเอง ไม่เลื่อนไปเดือนก่อนตามงวด', () => {
  const r = stats([j('2026-08-28'), j('2026-08-31'), j('2026-09-28'), j('2026-09-30')], '2026-10-09');
  assert.equal(r[0].recordedDays, 2);
  assert.equal(r[1].recordedDays, 2);
  assert.equal(r[2].recordedDays, 0);
});

test('สัดส่วนแถบสัมพันธ์กับวันที่บันทึกจริง (ครบทุกวัน = 100%)', () => {
  const days = Array.from({ length: 30 }, (_, i) => j(`2026-09-${String(i + 1).padStart(2, '0')}`));
  const r = stats(days, '2026-10-09');
  assert.equal(r[1].recordedDays, 30);
  assert.equal(r[1].totalDays, 30);
  assert.equal(r[1].pct, 100);
});

test('ทนต่อข้อมูลผิดรูปแบบ: date ว่าง/ไม่ใช่สตริง/null ไม่ทำให้ล้ม', () => {
  const r = stats([null, {}, { date: 20261001 }, { date: '' }, { date: '2026-10-02T08:00:00' }], '2026-10-09');
  assert.equal(r[2].recordedDays, 1);
  assert.deepEqual(stats([], 'not-a-date'), []);
});

test('renderJournal ไม่ใช้ monthKey/งวดการเงินสำหรับการ์ดความสม่ำเสมอและสถิติเดือนนี้', () => {
  const render = index.match(/function renderJournal\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(render, /journalCalendarConsistency\(DATA\.dailyJournals, todayISO\(\), 2\)/);
  assert.doesNotMatch(render, /monthLabel\(item\.period\)\.split/);
  assert.doesNotMatch(render, /const monthDays = DATA\.dailyJournals\.filter\(item=>monthKey/);
});
