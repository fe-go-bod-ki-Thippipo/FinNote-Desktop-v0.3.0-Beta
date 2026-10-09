const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const required = ['Index.html', 'electron/main.js', 'electron/preload.js', 'README.md', 'LICENSE', 'package.json', 'assets/finnote-logo.png', 'build/icon.ico'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`ไม่พบไฟล์ ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const scripts = [...index.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
scripts.forEach((script, i) => new vm.Script(script, { filename: `Index-script-${i + 1}.js` }));
new vm.Script(main, { filename: 'main.js' });
new vm.Script(preload, { filename: 'preload.js' });

const indexMarkers = [
  'finnoteDesktop', 'SQLite', 'loadDesktopData', 'saveDesktopData',
  'data-view="accounts"', 'data-view="categories"', 'data-view="recurring"', 'data-view="alerts"',
  'standardCategoryMaster', 'IN-01', 'IN-14', 'EX-01', 'EX-50',
  'SIDEBAR_DEFAULT_ORDER', 'sidebarSortable', 'btnResetSidebar',
  'renderTransactionCalendar', 'txCalPrev', 'txCalNext', 'buildFinancialAlerts', 'renderAlertSettings', 'dashboard-alert-trend-grid',
  'rerenderWithInputFocus', 'compositionstart', 'compositionend',
  'id="securityGate"', 'getSecurityGate', 'Recovery Key', 'Encryption at Rest', 'showStartupDiagnostic'
];
for (const marker of indexMarkers) {
  if (!index.includes(marker)) throw new Error(`Index.html ไม่มี marker: ${marker}`);
}

const securityMarkers = [
  'aes-256-gcm', 'pbkdf2Sync', 'security_meta', 'app_meta',
  'security:setup', 'security:unlock', 'security:recover', 'security:change-password',
  'finnote.pre-encryption.', 'ENCRYPTION_FORMAT_VERSION', 'MIGRATION_VERSION', 'ensureAppMetaSchema', 'app:diagnostics'
];
for (const marker of securityMarkers) {
  if (!main.includes(marker)) throw new Error(`main.js ไม่มี security marker: ${marker}`);
}

for (const marker of ['securityStatus', 'securitySetup', 'securityUnlock', 'securityRecover', 'securityChangePassword', 'securityNewRecovery', 'securityLock', 'diagnostics']) {
  if (!preload.includes(marker)) throw new Error(`preload.js ไม่มี marker: ${marker}`);
}

// Version: package.json เป็นแหล่งเดียว ต้องเป็น SemVer 2.0 (ไม่ล็อกค่าตายตัว เพื่อให้ออกรุ่นใหม่ได้)
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
if (!SEMVER.test(String(pkg.version || ''))) throw new Error(`version ไม่ใช่ SemVer (ไม่รวม +metadata): ${pkg.version}`);
if (!String(pkg.build?.win?.artifactName || '').includes('Setup')) throw new Error('ยังไม่ได้กำหนดชื่อ Windows Setup artifact');
if (!pkg.scripts?.['dist:portable']) throw new Error('ยังไม่มี script สำหรับ Portable build');

// UAT build ต้องแยกตัวตนจากโปรแกรมจริง และแพ็กไฟล์ครบ (--config จะไม่อ่าน package.json build)
const uatConfigPath = path.join(root, 'electron-builder.uat.yml');
if (!fs.existsSync(uatConfigPath)) throw new Error('ไม่พบ electron-builder.uat.yml');
const uatConfig = fs.readFileSync(uatConfigPath, 'utf8');
const yamlValue = key => (uatConfig.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
if (yamlValue('appId') === pkg.build.appId || !/\.uat$/.test(yamlValue('appId') || '')) throw new Error('UAT appId ต้องแตกต่างจากโปรแกรมจริงและลงท้าย .uat');
if (yamlValue('productName') === (pkg.build.productName || pkg.productName)) throw new Error('UAT productName ต้องแตกต่างจากโปรแกรมจริง');
for (const file of [...pkg.build.files, 'build-info.json']) {
  if (!uatConfig.includes(`- ${file}`)) throw new Error(`electron-builder.uat.yml ไม่ได้แพ็กไฟล์ ${file}`);
}
if (!/^asar:\s*true$/m.test(uatConfig)) throw new Error('UAT build ต้องเปิด asar');
const portableConfig = fs.readFileSync(path.join(root, 'electron-builder.portable.yml'), 'utf8');
for (const file of pkg.build.files) {
  if (!portableConfig.includes(`- ${file}`)) throw new Error(`electron-builder.portable.yml ไม่ได้ระบุไฟล์ ${file} (จะแพ็กทั้งโปรเจกต์)`);
}
if (!/^asar:\s*true$/m.test(portableConfig)) throw new Error('Portable build ต้องเปิด asar');
if (!pkg.build.files.includes('build-info.json')) throw new Error('package.json build.files ต้องมี build-info.json');

// Main process ต้องแยก userData ตาม channel และกันหลาย instance เขียนฐานเดียวกัน
for (const marker of ["require('./channel')", "app.setPath('userData'", 'requestSingleInstanceLock', 'legacyMigrationAllowed']) {
  if (!main.includes(marker)) throw new Error(`main.js ไม่มี isolation marker: ${marker}`);
}
const setPathAt = main.indexOf("app.setPath('userData'");
const firstUserDataRead = main.indexOf("app.getPath('userData')", main.indexOf('app.whenReady'));
if (firstUserDataRead !== -1 && setPathAt > firstUserDataRead) throw new Error("app.setPath('userData') ต้องเกิดก่อนการใช้งาน userData");
if (!index.includes('id="appBuildLabel"') || !index.includes('applyBuildInfo')) throw new Error('Index.html ต้องแสดงข้อมูล Build');

console.log(JSON.stringify({
  ok: true,
  product: pkg.build.productName || pkg.productName,
  release: pkg.version,
  uatAppId: yamlValue('appId'),
  encryption: 'AES-256-GCM',
  categoryDefaults: 'IN-01..IN-14 / EX-01..EX-50',
  scripts: scripts.length
}, null, 2));
