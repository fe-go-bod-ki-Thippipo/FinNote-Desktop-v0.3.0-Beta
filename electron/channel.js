'use strict';
/**
 * Build channel & data isolation (REQ-16 foundation / UAT pipeline)
 *
 * channel มาจาก build-info.json ที่ workflow สร้างตอน Build
 *   - stable / beta : โปรแกรมใช้งานจริง → ไม่เปลี่ยน userData (คงพฤติกรรมเดิมทุกประการ)
 *   - uat           : ทดสอบตรวจรับ   → userData แยก, ห้ามอ่านฐานข้อมูล Legacy
 *   - dev           : รันจากซอร์ส (npm start) → userData แยก
 * ไม่มี build-info.json:
 *   - แพ็กเกจแล้ว (app.isPackaged) → ถือเป็น stable (Build เดิมทั้งหมดก่อนหน้านี้)
 *   - รันจากซอร์ส → dev
 * โมดูลนี้ไม่ require('electron') เพื่อให้ทดสอบด้วย node:test ได้
 */
const path = require('path');
const fs = require('fs');

const PRODUCTION_CHANNELS = Object.freeze(['stable', 'beta']);
const KNOWN_CHANNELS = Object.freeze(['stable', 'beta', 'uat', 'dev']);
const PRODUCTION_DIR_NAME = 'FinNote Desktop';
const LEGACY_DIR_NAME = 'finnote-desktop';
const ISOLATED_DIR_NAMES = Object.freeze({ uat: 'FinNote Desktop UAT', dev: 'FinNote Desktop Dev' });
const PORTABLE_UAT_DATA_DIR = 'FinNote-UAT-Data';

function readBuildInfo(appRoot) {
  try {
    const file = path.join(appRoot, 'build-info.json');
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function resolveChannel(buildInfo, isPackaged) {
  const raw = String(buildInfo && buildInfo.channel || '').trim().toLowerCase();
  if (raw) {
    // channel ที่ไม่รู้จักให้ถือเป็น uat (แยกข้อมูลไว้ก่อน) ไม่ใช่ stable
    return KNOWN_CHANNELS.includes(raw) ? raw : 'uat';
  }
  return isPackaged ? 'stable' : 'dev';
}

function isProductionChannel(channel) {
  return PRODUCTION_CHANNELS.includes(channel);
}

function samePath(a, b) {
  const norm = p => path.resolve(String(p || '')).replace(/[\\/]+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

/**
 * คืน path userData ที่ต้อง setPath หรือ null เมื่อไม่ต้องเปลี่ยน (production)
 * ป้องกันกรณีคำนวณได้ path เดียวกับข้อมูลจริงหรือโฟลเดอร์ Legacy โดยโยน error
 */
function isolatedUserDataPath(channel, appDataDir, env = {}) {
  if (isProductionChannel(channel)) return null;
  let target;
  if (channel === 'uat' && env.PORTABLE_EXECUTABLE_DIR) {
    target = path.join(env.PORTABLE_EXECUTABLE_DIR, PORTABLE_UAT_DATA_DIR);
  } else {
    target = path.join(appDataDir, ISOLATED_DIR_NAMES[channel] || ISOLATED_DIR_NAMES.uat);
  }
  assertNotProductionPath(target, appDataDir, channel);
  return target;
}

/** โยน error เมื่อ target ชี้โฟลเดอร์ข้อมูลจริง (FinNote Desktop) หรือโฟลเดอร์ Legacy (finnote-desktop) */
function assertNotProductionPath(target, appDataDir, channel = 'uat') {
  const forbidden = [path.join(appDataDir, PRODUCTION_DIR_NAME), path.join(appDataDir, LEGACY_DIR_NAME)];
  if (!target || forbidden.some(p => samePath(p, target))) {
    throw new Error(`channel ${channel} ต้องไม่ใช้โฟลเดอร์ข้อมูลจริง: ${target}`);
  }
  return true;
}

function allowLegacyMigration(channel) {
  return isProductionChannel(channel);
}

function displayVersion(buildInfo, packageVersion, channel) {
  if (buildInfo && buildInfo.displayVersion) return String(buildInfo.displayVersion);
  return channel === 'dev' ? `${packageVersion}+dev` : String(packageVersion);
}

function describeBuild({ appRoot, isPackaged, packageVersion, appDataDir, env }) {
  const info = readBuildInfo(appRoot);
  const channel = resolveChannel(info, isPackaged);
  return {
    channel,
    production: isProductionChannel(channel),
    version: String(packageVersion),
    displayVersion: displayVersion(info, packageVersion, channel),
    commit: info && info.commit ? String(info.commit) : '',
    shortCommit: info && info.commit ? String(info.commit).slice(0, 7) : '',
    runNumber: info && info.runNumber ? String(info.runNumber) : '',
    builtAt: info && info.builtAt ? String(info.builtAt) : '',
    userDataOverride: isolatedUserDataPath(channel, appDataDir, env || {}),
    legacyMigrationAllowed: allowLegacyMigration(channel)
  };
}

module.exports = {
  PRODUCTION_CHANNELS,
  KNOWN_CHANNELS,
  PRODUCTION_DIR_NAME,
  LEGACY_DIR_NAME,
  ISOLATED_DIR_NAMES,
  PORTABLE_UAT_DATA_DIR,
  readBuildInfo,
  resolveChannel,
  isProductionChannel,
  isolatedUserDataPath,
  assertNotProductionPath,
  allowLegacyMigration,
  displayVersion,
  describeBuild
};
