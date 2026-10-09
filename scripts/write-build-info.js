#!/usr/bin/env node
'use strict';
/**
 * สร้าง build-info.json ที่ root ของโปรเจกต์ก่อน electron-builder แพ็กโปรแกรม
 * ใช้: node scripts/write-build-info.js --channel uat
 * ค่า commit/run มาจาก GitHub Actions (GITHUB_SHA, GITHUB_RUN_NUMBER) หรือ git ในเครื่อง
 * เวอร์ชันมาจาก package.json เท่านั้น (แหล่งเดียว) และไม่แก้ package.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const CHANNELS = ['stable', 'beta', 'uat', 'dev'];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function gitCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim(); } catch (_) { return ''; }
}

function buildInfo({ version, channel, commit, runNumber, builtAt }) {
  if (!CHANNELS.includes(channel)) throw new Error(`channel ไม่ถูกต้อง: ${channel} (ต้องเป็น ${CHANNELS.join('/')})`);
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error(`commit SHA ไม่ถูกต้อง: "${commit}"`);
  const shortCommit = commit.slice(0, 7);
  const run = String(runNumber || 'local');
  // SemVer build metadata (+...) ไม่เปลี่ยนลำดับเวอร์ชันของ Release ปกติ
  const displayVersion = channel === 'stable' || channel === 'beta'
    ? version
    : `${version}+${channel}.${run}.${shortCommit}`;
  return { version, channel, commit, shortCommit, runNumber: run, builtAt, displayVersion };
}

if (require.main === module) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const info = buildInfo({
    version: pkg.version,
    channel: String(arg('channel') || '').toLowerCase(),
    commit: gitCommit(),
    runNumber: process.env.GITHUB_RUN_NUMBER,
    builtAt: new Date().toISOString()
  });
  fs.writeFileSync(path.join(root, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(JSON.stringify(info, null, 2));
}

module.exports = { buildInfo, CHANNELS };
