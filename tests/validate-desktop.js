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
  'data-view="accounts"', 'data-view="categories"', 'data-view="recurring"',
  'standardCategoryMaster', 'IN-01', 'IN-14', 'EX-01', 'EX-50',
  'SIDEBAR_DEFAULT_ORDER', 'sidebarSortable', 'btnResetSidebar',
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

if (pkg.version !== '0.3.0-beta.0') throw new Error(`version ไม่ถูกต้อง: ${pkg.version}`);
if (!String(pkg.build?.win?.artifactName || '').includes('Setup')) throw new Error('ยังไม่ได้กำหนดชื่อ Windows Setup artifact');
if (!pkg.scripts?.['dist:portable']) throw new Error('ยังไม่มี script สำหรับ Portable build');

console.log(JSON.stringify({
  ok: true,
  product: pkg.build.productName || pkg.productName,
  release: pkg.version,
  uiVersion: '3.0.0-beta',
  encryption: 'AES-256-GCM',
  categoryDefaults: 'IN-01..IN-14 / EX-01..EX-50',
  scripts: scripts.length
}, null, 2));
