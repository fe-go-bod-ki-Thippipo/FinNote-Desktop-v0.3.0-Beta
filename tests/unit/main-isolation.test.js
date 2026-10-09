// โหลด electron/main.js จริงด้วย Electron จำลอง เพื่อยืนยันลำดับ startup ของการแยกข้อมูล
// ไม่เปิดฐานข้อมูลจริง: whenReady() ไม่ resolve และ sql.js ถูกแทนด้วย stub
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const repo = path.join(__dirname, '..', '..');
const SHA = '4d653756b2d12728a7b63c8ecae727c25b624d35';

function loadMain({ buildInfo, isPackaged = true, env = {}, lockGranted = true }) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'finnote-main-'));
  const appData = path.join(sandbox, 'AppData');
  fs.mkdirSync(path.join(sandbox, 'electron'), { recursive: true });
  for (const f of ['main.js', 'channel.js']) fs.copyFileSync(path.join(repo, 'electron', f), path.join(sandbox, 'electron', f));
  if (buildInfo) fs.writeFileSync(path.join(sandbox, 'build-info.json'), JSON.stringify(buildInfo));

  const calls = [];
  const app = {
    isPackaged,
    getVersion: () => '0.3.0-beta.0',
    getPath: name => { calls.push(['getPath', name]); return name === 'appData' ? appData : path.join(appData, 'FinNote Desktop'); },
    setPath: (name, value) => calls.push(['setPath', name, value]),
    requestSingleInstanceLock: () => { calls.push(['requestSingleInstanceLock']); return lockGranted; },
    quit: () => calls.push(['quit']),
    on: event => calls.push(['on', event]),
    whenReady: () => new Promise(() => {})
  };
  const electronStub = { app, BrowserWindow: function () {}, ipcMain: { handle() {} }, dialog: {} };
  const originalLoad = Module._load;
  const savedEnv = { ...process.env };
  Object.keys(process.env).filter(k => k === 'PORTABLE_EXECUTABLE_DIR').forEach(k => delete process.env[k]);
  Object.assign(process.env, env);
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electronStub;
    if (request === 'sql.js') return () => Promise.reject(new Error('stub'));
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    require(path.join(sandbox, 'electron', 'main.js'));
  } finally {
    Module._load = originalLoad;
    process.env = savedEnv;
  }
  return { calls, appData, sandbox, cleanup: () => fs.rmSync(sandbox, { recursive: true, force: true }) };
}

test('UAT: setPath(userData) ไปโฟลเดอร์แยก ก่อน requestSingleInstanceLock และไม่ใช่โฟลเดอร์จริง', () => {
  const r = loadMain({ buildInfo: { channel: 'uat', commit: SHA, displayVersion: '0.3.0-beta.0+uat.1.4d65375' } });
  try {
    const setIdx = r.calls.findIndex(c => c[0] === 'setPath');
    const lockIdx = r.calls.findIndex(c => c[0] === 'requestSingleInstanceLock');
    assert.ok(setIdx > -1 && lockIdx > setIdx, JSON.stringify(r.calls));
    assert.equal(r.calls[setIdx][2], path.join(r.appData, 'FinNote Desktop UAT'));
    assert.ok(!r.calls.slice(0, setIdx).some(c => c[0] === 'getPath' && c[1] === 'userData'), 'อ่าน userData ก่อน setPath');
    assert.ok(fs.existsSync(path.join(r.appData, 'FinNote Desktop UAT')));
  } finally { r.cleanup(); }
});

test('UAT Portable: ข้อมูลอยู่ข้าง exe', () => {
  const exeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finnote-portable-'));
  const r = loadMain({ buildInfo: { channel: 'uat', commit: SHA }, env: { PORTABLE_EXECUTABLE_DIR: exeDir } });
  try {
    assert.deepEqual(r.calls.find(c => c[0] === 'setPath'), ['setPath', 'userData', path.join(exeDir, 'FinNote-UAT-Data')]);
  } finally { r.cleanup(); fs.rmSync(exeDir, { recursive: true, force: true }); }
});

test('Stable/Beta และ Build เดิมที่ไม่มี build-info: ไม่เรียก setPath (คงโฟลเดอร์ข้อมูลจริงเดิม)', () => {
  for (const buildInfo of [null, { channel: 'beta', commit: SHA }, { channel: 'stable', commit: SHA }]) {
    const r = loadMain({ buildInfo, isPackaged: true });
    try {
      assert.equal(r.calls.filter(c => c[0] === 'setPath').length, 0, JSON.stringify(buildInfo));
      assert.equal(r.calls.filter(c => c[0] === 'requestSingleInstanceLock').length, 1);
    } finally { r.cleanup(); }
  }
});

test('instance ที่สองในโฟลเดอร์ข้อมูลเดียวกันจะปิดตัว', () => {
  const r = loadMain({ buildInfo: { channel: 'uat', commit: SHA }, lockGranted: false });
  try {
    assert.ok(r.calls.some(c => c[0] === 'quit'));
    assert.ok(!r.calls.some(c => c[0] === 'on' && c[1] === 'second-instance'));
  } finally { r.cleanup(); }
});
