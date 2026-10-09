// UAT pipeline / REQ-16 foundation — channel, data isolation and build metadata
// ไม่แตะไฟล์ข้อมูลจริง: ใช้ path จำลองและโฟลเดอร์ชั่วคราวเท่านั้น
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ch = require('../../electron/channel');
const { buildInfo } = require('../../scripts/write-build-info');

const APPDATA = path.join(os.tmpdir(), 'finnote-mock-appdata');
const SHA = '4d653756b2d12728a7b63c8ecae727c25b624d35';

test('resolveChannel: ไม่มี build-info → แพ็กเกจแล้วเป็น stable, รันจากซอร์สเป็น dev', () => {
  assert.equal(ch.resolveChannel(null, true), 'stable');
  assert.equal(ch.resolveChannel(null, false), 'dev');
});

test('resolveChannel: channel ที่ไม่รู้จักถือเป็น uat (แยกข้อมูลไว้ก่อน)', () => {
  assert.equal(ch.resolveChannel({ channel: 'UAT' }, true), 'uat');
  assert.equal(ch.resolveChannel({ channel: 'beta' }, true), 'beta');
  assert.equal(ch.resolveChannel({ channel: 'qa-something' }, true), 'uat');
});

test('stable/beta ไม่เปลี่ยน userData (คงโฟลเดอร์ข้อมูลจริงเดิม)', () => {
  assert.equal(ch.isolatedUserDataPath('stable', APPDATA, {}), null);
  assert.equal(ch.isolatedUserDataPath('beta', APPDATA, {}), null);
  assert.equal(ch.allowLegacyMigration('stable'), true);
  assert.equal(ch.allowLegacyMigration('beta'), true);
});

test('UAT Setup ใช้โฟลเดอร์แยกใน AppData และห้าม Legacy Migration', () => {
  const p = ch.isolatedUserDataPath('uat', APPDATA, {});
  assert.equal(p, path.join(APPDATA, 'FinNote Desktop UAT'));
  assert.notEqual(p.toLowerCase(), path.join(APPDATA, 'FinNote Desktop').toLowerCase());
  assert.equal(ch.allowLegacyMigration('uat'), false);
  assert.equal(ch.allowLegacyMigration('dev'), false);
});

test('UAT Portable เก็บข้อมูลข้างไฟล์ exe (PORTABLE_EXECUTABLE_DIR)', () => {
  const exeDir = path.join(os.tmpdir(), 'finnote-mock-usb');
  assert.equal(ch.isolatedUserDataPath('uat', APPDATA, { PORTABLE_EXECUTABLE_DIR: exeDir }), path.join(exeDir, 'FinNote-UAT-Data'));
});

test('dev ใช้โฟลเดอร์แยก', () => {
  assert.equal(ch.isolatedUserDataPath('dev', APPDATA, {}), path.join(APPDATA, 'FinNote Desktop Dev'));
});

test('ตัวป้องกัน: ปฏิเสธ path ที่ชี้โฟลเดอร์ข้อมูลจริงหรือ Legacy (รวมตัวพิมพ์/ท้าย / ต่างกัน)', () => {
  assert.throws(() => ch.assertNotProductionPath(path.join(APPDATA, 'FinNote Desktop'), APPDATA), /ข้อมูลจริง/);
  assert.throws(() => ch.assertNotProductionPath(path.join(APPDATA, 'finnote desktop') + path.sep, APPDATA), /ข้อมูลจริง/);
  assert.throws(() => ch.assertNotProductionPath(path.join(APPDATA, 'x', '..', 'FinNote Desktop'), APPDATA), /ข้อมูลจริง/);
  assert.throws(() => ch.assertNotProductionPath(path.join(APPDATA, 'finnote-desktop'), APPDATA), /ข้อมูลจริง/);
  assert.throws(() => ch.assertNotProductionPath('', APPDATA), /ข้อมูลจริง/);
  assert.equal(ch.assertNotProductionPath(path.join(APPDATA, 'FinNote Desktop UAT'), APPDATA), true);
});

test('describeBuild: อ่าน build-info.json และคืนข้อมูลแสดงผล', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finnote-buildinfo-'));
  try {
    fs.writeFileSync(path.join(dir, 'build-info.json'), JSON.stringify(buildInfo({ version: '0.3.0-beta.0', channel: 'uat', commit: SHA, runNumber: 12, builtAt: '2026-10-09T00:00:00Z' })));
    const b = ch.describeBuild({ appRoot: dir, isPackaged: true, packageVersion: '0.3.0-beta.0', appDataDir: APPDATA, env: {} });
    assert.equal(b.channel, 'uat');
    assert.equal(b.production, false);
    assert.equal(b.displayVersion, '0.3.0-beta.0+uat.12.4d65375');
    assert.equal(b.shortCommit, '4d65375');
    assert.equal(b.userDataOverride, path.join(APPDATA, 'FinNote Desktop UAT'));
    assert.equal(b.legacyMigrationAllowed, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('describeBuild: build-info.json เสียหาย → ไม่ล้ม และแพ็กเกจแล้วถือเป็น stable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finnote-buildinfo-'));
  try {
    fs.writeFileSync(path.join(dir, 'build-info.json'), '{broken');
    const b = ch.describeBuild({ appRoot: dir, isPackaged: true, packageVersion: '0.3.0-beta.0', appDataDir: APPDATA, env: {} });
    assert.equal(b.channel, 'stable');
    assert.equal(b.userDataOverride, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildInfo: beta/stable ใช้เวอร์ชันจาก package.json ตรง ๆ, uat ใช้ SemVer build metadata', () => {
  assert.equal(buildInfo({ version: '0.3.0-beta.1', channel: 'beta', commit: SHA, runNumber: 3 }).displayVersion, '0.3.0-beta.1');
  assert.equal(buildInfo({ version: '0.3.0-beta.1', channel: 'uat', commit: SHA, runNumber: 3 }).displayVersion, '0.3.0-beta.1+uat.3.4d65375');
});

test('buildInfo: ปฏิเสธ channel และ commit ที่ไม่ถูกต้อง', () => {
  assert.throws(() => buildInfo({ version: '1.0.0', channel: 'prod', commit: SHA }), /channel/);
  assert.throws(() => buildInfo({ version: '1.0.0', channel: 'uat', commit: 'abc' }), /commit/);
});
