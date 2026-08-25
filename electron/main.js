const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

let database;
let databasePath;
let mainWindow;
let unlockedMasterKey = null;
let SQLRuntime = null;

const SECURITY_VERSION = 1;
const ENCRYPTION_FORMAT_VERSION = 1;
const MIGRATION_VERSION = 3;
const KDF_ITERATIONS = 210000;
const KEY_BYTES = 32;

const LOG_FILE_NAME = 'finnote-startup.log';

function logDiagnostic(message, error = null) {
  try {
    const line = `[${new Date().toISOString()}] ${message}${error ? ` | ${error.stack || error.message || String(error)}` : ''}\n`;
    const base = app && app.getPath ? app.getPath('userData') : process.cwd();
    fs.mkdirSync(base, { recursive: true });
    fs.appendFileSync(path.join(base, LOG_FILE_NAME), line, 'utf8');
  } catch (_) {}
}

function tableColumns(tableName) {
  if (!database) return [];
  const stmt = database.prepare(`PRAGMA table_info(${tableName})`);
  const cols = [];
  try {
    while (stmt.step()) cols.push(String(stmt.getAsObject().name || ''));
  } finally {
    stmt.free();
  }
  return cols;
}

function hasColumn(tableName, columnName) {
  return tableColumns(tableName).includes(columnName);
}

function ensureAppMetaSchema() {
  // v0.2.0 development builds may have left an older/partial app_meta table.
  // CREATE TABLE IF NOT EXISTS does not add missing columns, so upgrade it explicitly.
  const cols = new Set(tableColumns('app_meta'));
  if (!cols.size) return;
  if (!cols.has('migration_version')) database.run('ALTER TABLE app_meta ADD COLUMN migration_version INTEGER NOT NULL DEFAULT 1');
  if (!cols.has('encryption_format_version')) database.run('ALTER TABLE app_meta ADD COLUMN encryption_format_version INTEGER NOT NULL DEFAULT 0');
  if (!cols.has('updated_at')) database.run("ALTER TABLE app_meta ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  if (!cols.has('legacy_migrated_at')) database.run("ALTER TABLE app_meta ADD COLUMN legacy_migrated_at TEXT NOT NULL DEFAULT ''");
  if (!cols.has('legacy_source_path')) database.run("ALTER TABLE app_meta ADD COLUMN legacy_source_path TEXT NOT NULL DEFAULT ''");
  if (!cols.has('legacy_source_fingerprint')) database.run("ALTER TABLE app_meta ADD COLUMN legacy_source_fingerprint TEXT NOT NULL DEFAULT ''");
}

function safeAppMeta() {
  try {
    const cols = new Set(tableColumns('app_meta'));
    if (!cols.size) return { migration_version: 1, encryption_format_version: 0 };
    const migrationExpr = cols.has('migration_version') ? 'migration_version' : '1 AS migration_version';
    const encryptionExpr = cols.has('encryption_format_version') ? 'encryption_format_version' : '0 AS encryption_format_version';
    const migratedExpr = cols.has('legacy_migrated_at') ? 'legacy_migrated_at' : "'' AS legacy_migrated_at";
    const sourceExpr = cols.has('legacy_source_path') ? 'legacy_source_path' : "'' AS legacy_source_path";
    const fingerprintExpr = cols.has('legacy_source_fingerprint') ? 'legacy_source_fingerprint' : "'' AS legacy_source_fingerprint";
    return firstRow(`SELECT ${migrationExpr}, ${encryptionExpr}, ${migratedExpr}, ${sourceExpr}, ${fingerprintExpr} FROM app_meta WHERE id = 1`) || { migration_version: 1, encryption_format_version: 0, legacy_migrated_at:'', legacy_source_path:'', legacy_source_fingerprint:'' };
  } catch (error) {
    logDiagnostic('safeAppMeta fallback', error);
    return { migration_version: 1, encryption_format_version: 0 };
  }
}


function firstRowFrom(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) return null;
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function payloadSummary(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const arrayCount = key => Array.isArray(data[key]) ? data[key].length : 0;
  const categories = data.categories && typeof data.categories === 'object' ? data.categories : {};
  return {
    version: Number(data.version || 1),
    transactions: arrayCount('transactions'),
    accounts: arrayCount('accounts'),
    categoriesIncome: Array.isArray(categories.income) ? categories.income.length : 0,
    categoriesExpense: Array.isArray(categories.expense) ? categories.expense.length : 0,
    categoryMaster: arrayCount('categoryMaster'),
    debts: arrayCount('debts'),
    debtPayments: arrayCount('debtPayments'),
    savings: arrayCount('savings'),
    savingsLogs: arrayCount('savingsLogs'),
    recurringTemplates: arrayCount('recurringTemplates'),
    dailyJournals: arrayCount('dailyJournals'),
    grabbikeLogs: arrayCount('grabbikeLogs')
  };
}

function summariesMatch(a, b) {
  const keys = ['transactions','accounts','categoriesIncome','categoriesExpense','debts','debtPayments','savings','savingsLogs','recurringTemplates','dailyJournals','grabbikeLogs'];
  return keys.every(key => Number(a?.[key] || 0) === Number(b?.[key] || 0));
}

function legacyDatabasePath() {
  const candidate = path.join(app.getPath('appData'), 'finnote-desktop', 'finnote.sqlite3');
  if (databasePath && path.resolve(candidate) === path.resolve(databasePath)) return null;
  return candidate;
}

function readLegacyDatabase() {
  const sourcePath = legacyDatabasePath();
  if (!sourcePath || !fs.existsSync(sourcePath) || !SQLRuntime) return { found: false, sourcePath };
  let legacyDb = null;
  try {
    const fileBuffer = fs.readFileSync(sourcePath);
    const fingerprint = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    legacyDb = new SQLRuntime.Database(fileBuffer);
    const table = firstRowFrom(legacyDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='app_data'");
    if (!table) return { found: false, sourcePath, reason: 'no_app_data' };
    const row = firstRowFrom(legacyDb, 'SELECT data_json, updated_at FROM app_data WHERE id = 1');
    if (!row || !row.data_json) return { found: false, sourcePath, reason: 'no_payload' };
    if (isEncryptedPayload(String(row.data_json))) return { found: false, sourcePath, reason: 'already_encrypted' };
    const payload = JSON.parse(String(row.data_json));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('ข้อมูลในฐานเดิมไม่ใช่ FinNote payload ที่รองรับ');
    return { found: true, sourcePath, payload, updatedAt: row.updated_at || '', summary: payloadSummary(payload), fingerprint };
  } catch (error) {
    logDiagnostic(`อ่านฐานข้อมูล FinNote เดิมไม่สำเร็จ: ${sourcePath}`, error);
    return { found: true, sourcePath, error: error.message || String(error) };
  } finally {
    if (legacyDb) try { legacyDb.close(); } catch (_) {}
  }
}

function backupFile(sourcePath, prefix) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  const backupDir = path.join(app.getPath('userData'), 'migration-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destination = path.join(backupDir, `${prefix}.${stamp}.sqlite3`);
  fs.copyFileSync(sourcePath, destination);
  return destination;
}

function currentPayloadSummary() {
  const row = firstRow('SELECT data_json FROM app_data WHERE id = 1');
  if (!row || !row.data_json) return null;
  const payload = isEncryptedPayload(row.data_json) ? decryptJsonText(row.data_json, 'app_data:1') : JSON.parse(row.data_json);
  return payloadSummary(payload);
}

function hasMeaningfulNewData(summary) {
  if (!summary) return false;
  return ['transactions','debts','debtPayments','savings','savingsLogs','recurringTemplates','dailyJournals','grabbikeLogs'].some(key => Number(summary[key] || 0) > 0);
}

function migrateLegacyDatabaseIntoEncryptedStore(options = {}) {
  requireUnlocked();
  const legacy = readLegacyDatabase();
  if (!legacy.found) return { ok: false, reason: legacy.reason || 'not_found', sourcePath: legacy.sourcePath };
  if (legacy.error) throw new Error(`อ่านข้อมูลเวอร์ชันเดิมไม่สำเร็จ: ${legacy.error}`);

  const meta = safeAppMeta();
  const currentSummary = currentPayloadSummary();
  if (hasMeaningfulNewData(currentSummary) && !options.replaceCurrent) {
    return { ok: false, reason: 'new_data_present', sourcePath: legacy.sourcePath, legacySummary: legacy.summary, currentSummary };
  }

  const legacyBackupPath = backupFile(legacy.sourcePath, 'legacy-finnote');
  const currentBackupPath = backupFile(databasePath, 'before-legacy-migration');
  const now = new Date().toISOString();
  try {
    database.run('BEGIN TRANSACTION');
    const encrypted = encryptJsonObject(legacy.payload, 'app_data:1');
    database.run(`
      INSERT INTO app_data (id, schema_version, data_json, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, data_json = excluded.data_json, updated_at = excluded.updated_at
    `, [Number(legacy.payload.version || 1), encrypted, legacy.updatedAt || now]);
    const verifyRow = firstRow('SELECT data_json FROM app_data WHERE id = 1');
    const verifiedPayload = decryptJsonText(verifyRow.data_json, 'app_data:1');
    const verifiedSummary = payloadSummary(verifiedPayload);
    if (!summariesMatch(legacy.summary, verifiedSummary)) throw new Error('ตรวจสอบจำนวนข้อมูลหลัง Migration ไม่ผ่าน');
    database.run('UPDATE app_meta SET migration_version = ?, encryption_format_version = ?, updated_at = ?, legacy_migrated_at = ?, legacy_source_path = ?, legacy_source_fingerprint = ? WHERE id = 1', [MIGRATION_VERSION, ENCRYPTION_FORMAT_VERSION, now, now, legacy.sourcePath, legacy.fingerprint]);
    database.run('COMMIT');
    persistDatabase();
    logDiagnostic(`Migration ฐานเดิมสำเร็จ: ${legacy.sourcePath}`);
    return { ok: true, sourcePath: legacy.sourcePath, legacyBackupPath, currentBackupPath, before: legacy.summary, after: verifiedSummary };
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (_) {}
    logDiagnostic('Migration ฐานข้อมูลเดิมล้มเหลว', error);
    throw error;
  }
}

function persistDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  fs.writeFileSync(temporaryPath, Buffer.from(database.export()));
  fs.renameSync(temporaryPath, databasePath);
}

function firstRow(sql, params = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) return null;
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function randomB64(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

function deriveKey(secret, saltB64, iterations = KDF_ITERATIONS) {
  return crypto.pbkdf2Sync(String(secret), Buffer.from(saltB64, 'base64'), iterations, KEY_BYTES, 'sha256');
}

function encryptBytes(buffer, key, aad = '') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: ENCRYPTION_FORMAT_VERSION,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64')
  };
}

function decryptBytes(envelope, key, aad = '') {
  if (!envelope || Number(envelope.enc) !== ENCRYPTION_FORMAT_VERSION || envelope.alg !== 'aes-256-gcm') {
    throw new Error('รูปแบบข้อมูลเข้ารหัสไม่รองรับ');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]);
}

function wrapMasterKey(masterKey, secret, saltB64, purpose, iterations = KDF_ITERATIONS) {
  const key = deriveKey(secret, saltB64, iterations);
  return JSON.stringify(encryptBytes(masterKey, key, `FinNote:${purpose}:v${SECURITY_VERSION}`));
}

function unwrapMasterKey(wrappedJson, secret, saltB64, purpose, iterations = KDF_ITERATIONS) {
  const key = deriveKey(secret, saltB64, iterations);
  const envelope = JSON.parse(wrappedJson);
  return decryptBytes(envelope, key, `FinNote:${purpose}:v${SECURITY_VERSION}`);
}

function generateRecoveryKey() {
  const raw = crypto.randomBytes(24).toString('hex').toUpperCase();
  return `FN-${raw.match(/.{1,6}/g).join('-')}`;
}

function isEncryptedPayload(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed.enc === ENCRYPTION_FORMAT_VERSION && parsed.alg === 'aes-256-gcm' && parsed.ct;
  } catch (_) {
    return false;
  }
}

function securityRow() {
  try {
    if (!tableColumns('security_meta').length) return null;
    return firstRow('SELECT * FROM security_meta WHERE id = 1');
  } catch (error) {
    logDiagnostic('อ่าน security_meta ไม่สำเร็จ', error);
    throw error;
  }
}

function requireUnlocked() {
  const row = securityRow();
  if (!row) throw Object.assign(new Error('ยังไม่ได้ตั้งค่าความปลอดภัย'), { code: 'SECURITY_SETUP_REQUIRED' });
  if (!unlockedMasterKey) throw Object.assign(new Error('ฐานข้อมูลถูกล็อก กรุณาเข้าสู่ระบบ'), { code: 'DATABASE_LOCKED' });
  return row;
}

function encryptJsonObject(obj, aad) {
  const bytes = Buffer.from(JSON.stringify(obj), 'utf8');
  return JSON.stringify(encryptBytes(bytes, unlockedMasterKey, aad));
}

function decryptJsonText(text, aad) {
  if (!isEncryptedPayload(text)) return JSON.parse(text);
  const bytes = decryptBytes(JSON.parse(text), unlockedMasterKey, aad);
  return JSON.parse(bytes.toString('utf8'));
}

function makeLegacyBackup() {
  if (!fs.existsSync(databasePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(path.dirname(databasePath), `finnote.pre-encryption.${stamp}.sqlite3`);
  fs.copyFileSync(databasePath, backupPath);
  return backupPath;
}

function migratePlaintextRowsToEncryption() {
  requireUnlocked();
  const appRow = firstRow('SELECT data_json FROM app_data WHERE id = 1');
  if (appRow && !isEncryptedPayload(appRow.data_json)) {
    const parsed = JSON.parse(appRow.data_json);
    database.run('UPDATE app_data SET data_json = ? WHERE id = 1', [encryptJsonObject(parsed, 'app_data:1')]);
  }
  const stmt = database.prepare('SELECT id, data_json FROM backups');
  const rows = [];
  try {
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  rows.forEach(row => {
    if (!isEncryptedPayload(row.data_json)) {
      const parsed = JSON.parse(row.data_json);
      database.run('UPDATE backups SET data_json = ? WHERE id = ?', [encryptJsonObject(parsed, `backup:${row.id}`), row.id]);
    }
  });
  database.run('UPDATE app_meta SET migration_version = ?, encryption_format_version = ?, updated_at = ? WHERE id = 1', [MIGRATION_VERSION, ENCRYPTION_FORMAT_VERSION, new Date().toISOString()]);
  persistDatabase();
}

async function openDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.js')), file)
  });
  SQLRuntime = SQL;
  const dataDir = app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });
  databasePath = path.join(dataDir, 'finnote.sqlite3');
  database = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();
  database.run(`
    CREATE TABLE IF NOT EXISTS app_data (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL DEFAULT 1,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
    CREATE TABLE IF NOT EXISTS security_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      security_version INTEGER NOT NULL,
      owner_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      wrapped_master_key_password TEXT NOT NULL,
      recovery_salt TEXT NOT NULL,
      wrapped_master_key_recovery TEXT NOT NULL,
      kdf_iterations INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      migration_version INTEGER NOT NULL DEFAULT 1,
      encryption_format_version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      legacy_migrated_at TEXT NOT NULL DEFAULT '',
      legacy_source_path TEXT NOT NULL DEFAULT '',
      legacy_source_fingerprint TEXT NOT NULL DEFAULT ''
    );
  `);
  ensureAppMetaSchema();
  const now = new Date().toISOString();
  database.run('INSERT OR IGNORE INTO app_meta (id, migration_version, encryption_format_version, updated_at) VALUES (1, 1, 0, ?)', [now]);
  database.run("UPDATE app_meta SET updated_at = CASE WHEN updated_at IS NULL OR updated_at = '' THEN ? ELSE updated_at END WHERE id = 1", [now]);
  persistDatabase();
  logDiagnostic(`เปิดฐานข้อมูลสำเร็จ: ${databasePath}`);
}

function registerIpc() {
  ipcMain.handle('security:status', () => {
    try {
      const sec = securityRow();
      const appRow = firstRow('SELECT id, data_json FROM app_data WHERE id = 1');
      const meta = safeAppMeta();
      const requiredSecurityColumns = ['security_version','owner_name','password_salt','wrapped_master_key_password','recovery_salt','wrapped_master_key_recovery','kdf_iterations'];
      const secColumns = new Set(tableColumns('security_meta'));
      const securitySchemaOk = requiredSecurityColumns.every(c => secColumns.has(c));
      if (sec && !securitySchemaOk) throw new Error('โครงสร้าง security_meta ไม่สมบูรณ์จากเวอร์ชันทดสอบก่อนหน้า');
      const externalLegacy = readLegacyDatabase();
      return {
        configured: Boolean(sec),
        locked: Boolean(sec) && !unlockedMasterKey,
        ownerName: sec ? sec.owner_name : '',
        hasLegacyData: Boolean(appRow && !isEncryptedPayload(appRow.data_json)) || Boolean(externalLegacy.found && !externalLegacy.error),
        legacyDatabaseFound: Boolean(externalLegacy.found && !externalLegacy.error),
        legacyDatabasePath: externalLegacy.sourcePath || '',
        legacySummary: externalLegacy.summary || null,
        databasePath,
        migrationVersion: Number(meta.migration_version || 1),
        encryptionFormatVersion: Number(meta.encryption_format_version || 0),
        securitySchemaOk
      };
    } catch (error) {
      logDiagnostic('security:status ล้มเหลว', error);
      throw new Error(`ตรวจระบบความปลอดภัยไม่สำเร็จ: ${error.message || error}`);
    }
  });

  ipcMain.handle('app:diagnostics', () => {
    const meta = safeAppMeta();
    return {
      appVersion: app.getVersion(),
      databasePath,
      logPath: path.join(app.getPath('userData'), LOG_FILE_NAME),
      databaseExists: Boolean(databasePath && fs.existsSync(databasePath)),
      appMetaColumns: tableColumns('app_meta'),
      securityMetaColumns: tableColumns('security_meta'),
      migrationVersion: Number(meta.migration_version || 1),
      encryptionFormatVersion: Number(meta.encryption_format_version || 0)
    };
  });

  ipcMain.handle('security:setup', (_event, input) => {
    if (securityRow()) throw new Error('ตั้งค่าความปลอดภัยแล้ว');
    const ownerName = String(input?.ownerName || '').trim().slice(0, 80);
    const password = String(input?.password || '');
    if (!ownerName) throw new Error('กรุณากรอกชื่อเจ้าของข้อมูล');
    if (password.length < 8) throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');

    const legacyBackupPath = makeLegacyBackup();
    const masterKey = crypto.randomBytes(KEY_BYTES);
    const passwordSalt = randomB64(16);
    const recoverySalt = randomB64(16);
    const recoveryKey = generateRecoveryKey();
    const now = new Date().toISOString();
    const wrappedPw = wrapMasterKey(masterKey, password, passwordSalt, 'password');
    const wrappedRecovery = wrapMasterKey(masterKey, recoveryKey, recoverySalt, 'recovery');
    database.run(`INSERT INTO security_meta
      (id, security_version, owner_name, password_salt, wrapped_master_key_password, recovery_salt, wrapped_master_key_recovery, kdf_iterations, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [SECURITY_VERSION, ownerName, passwordSalt, wrappedPw, recoverySalt, wrappedRecovery, KDF_ITERATIONS, now, now]);
    unlockedMasterKey = masterKey;
    migratePlaintextRowsToEncryption();
    return { ok: true, ownerName, recoveryKey, legacyBackupPath };
  });

  ipcMain.handle('security:unlock', (_event, password) => {
    const sec = securityRow();
    if (!sec) throw new Error('ยังไม่ได้ตั้งค่าความปลอดภัย');
    try {
      const master = unwrapMasterKey(sec.wrapped_master_key_password, String(password || ''), sec.password_salt, 'password', Number(sec.kdf_iterations || KDF_ITERATIONS));
      if (master.length !== KEY_BYTES) throw new Error('invalid key');
      unlockedMasterKey = master;
      return { ok: true, ownerName: sec.owner_name };
    } catch (_) {
      throw new Error('รหัสผ่านไม่ถูกต้อง');
    }
  });

  ipcMain.handle('security:recover', (_event, input) => {
    const sec = securityRow();
    if (!sec) throw new Error('ยังไม่ได้ตั้งค่าความปลอดภัย');
    const recoveryKey = String(input?.recoveryKey || '').trim().toUpperCase();
    const newPassword = String(input?.newPassword || '');
    if (newPassword.length < 8) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
    try {
      const master = unwrapMasterKey(sec.wrapped_master_key_recovery, recoveryKey, sec.recovery_salt, 'recovery', Number(sec.kdf_iterations || KDF_ITERATIONS));
      const passwordSalt = randomB64(16);
      const wrappedPw = wrapMasterKey(master, newPassword, passwordSalt, 'password');
      database.run('UPDATE security_meta SET password_salt = ?, wrapped_master_key_password = ?, updated_at = ? WHERE id = 1', [passwordSalt, wrappedPw, new Date().toISOString()]);
      unlockedMasterKey = master;
      persistDatabase();
      return { ok: true };
    } catch (_) {
      throw new Error('Recovery Key ไม่ถูกต้อง');
    }
  });

  ipcMain.handle('security:change-password', (_event, input) => {
    const sec = requireUnlocked();
    const currentPassword = String(input?.currentPassword || '');
    const newPassword = String(input?.newPassword || '');
    if (newPassword.length < 8) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
    try {
      const verifyMaster = unwrapMasterKey(sec.wrapped_master_key_password, currentPassword, sec.password_salt, 'password', Number(sec.kdf_iterations || KDF_ITERATIONS));
      if (!crypto.timingSafeEqual(verifyMaster, unlockedMasterKey)) throw new Error('mismatch');
    } catch (_) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    const salt = randomB64(16);
    const wrapped = wrapMasterKey(unlockedMasterKey, newPassword, salt, 'password');
    database.run('UPDATE security_meta SET password_salt = ?, wrapped_master_key_password = ?, updated_at = ? WHERE id = 1', [salt, wrapped, new Date().toISOString()]);
    persistDatabase();
    return { ok: true };
  });

  ipcMain.handle('security:new-recovery', (_event, currentPassword) => {
    const sec = requireUnlocked();
    try {
      const verifyMaster = unwrapMasterKey(sec.wrapped_master_key_password, String(currentPassword || ''), sec.password_salt, 'password', Number(sec.kdf_iterations || KDF_ITERATIONS));
      if (!crypto.timingSafeEqual(verifyMaster, unlockedMasterKey)) throw new Error('mismatch');
    } catch (_) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    const recoveryKey = generateRecoveryKey();
    const salt = randomB64(16);
    const wrapped = wrapMasterKey(unlockedMasterKey, recoveryKey, salt, 'recovery');
    database.run('UPDATE security_meta SET recovery_salt = ?, wrapped_master_key_recovery = ?, updated_at = ? WHERE id = 1', [salt, wrapped, new Date().toISOString()]);
    persistDatabase();
    return { ok: true, recoveryKey };
  });

  ipcMain.handle('security:lock', () => {
    if (unlockedMasterKey) unlockedMasterKey.fill(0);
    unlockedMasterKey = null;
    return { ok: true };
  });

  ipcMain.handle('legacy:status', () => {
    const legacy = readLegacyDatabase();
    const meta = safeAppMeta();
    return {
      found: Boolean(legacy.found && !legacy.error),
      error: legacy.error || '',
      sourcePath: legacy.sourcePath || '',
      summary: legacy.summary || null,
      fingerprint: legacy.fingerprint || '',
      alreadyMigrated: Boolean(meta.legacy_source_fingerprint && legacy.fingerprint && meta.legacy_source_fingerprint === legacy.fingerprint),
      currentSummary: unlockedMasterKey ? currentPayloadSummary() : null
    };
  });

  ipcMain.handle('legacy:migrate', (_event, options = {}) => migrateLegacyDatabaseIntoEncryptedStore(options));

  ipcMain.handle('db:load', () => {
    requireUnlocked();
    const row = firstRow('SELECT data_json, updated_at FROM app_data WHERE id = 1');
    return row ? { data: decryptJsonText(row.data_json, 'app_data:1'), updatedAt: row.updated_at } : null;
  });

  ipcMain.handle('db:save', (_event, payload) => {
    requireUnlocked();
    if (!payload || typeof payload !== 'object') throw new Error('ข้อมูลสำหรับบันทึกไม่ถูกต้อง');
    const now = new Date().toISOString();
    const encrypted = encryptJsonObject(payload, 'app_data:1');
    database.run(`
      INSERT INTO app_data (id, schema_version, data_json, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `, [Number(payload.version || 1), encrypted, now]);
    persistDatabase();
    return { ok: true, updatedAt: now };
  });

  ipcMain.handle('db:backup', (_event, reason = 'manual') => {
    requireUnlocked();
    const row = firstRow('SELECT data_json FROM app_data WHERE id = 1');
    if (!row) return { ok: false, reason: 'no_data' };
    const data = decryptJsonText(row.data_json, 'app_data:1');
    const now = new Date().toISOString();
    database.run('INSERT INTO backups (data_json, reason, created_at) VALUES (?, ?, ?)', [JSON.stringify(data), String(reason), now]);
    const newRow = firstRow('SELECT last_insert_rowid() AS id');
    const encryptedBackup = encryptJsonObject(data, `backup:${newRow.id}`);
    database.run('UPDATE backups SET data_json = ? WHERE id = ?', [encryptedBackup, newRow.id]);
    database.run('DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT 20)');
    persistDatabase();
    return { ok: true, createdAt: now };
  });

  ipcMain.handle('db:info', () => {
    const meta = safeAppMeta();
    return {
      databasePath,
      encrypted: Boolean(securityRow()),
      migrationVersion: meta ? Number(meta.migration_version || 1) : 1,
      encryptionFormatVersion: meta ? Number(meta.encryption_format_version || 0) : 0
    };
  });

  ipcMain.handle('db:choose-backup-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f4f7fb',
    title: 'FinNote',
    icon: path.join(__dirname, '..', 'assets', 'finnote-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'Index.html'));
}

app.whenReady().then(async () => {
  try {
    await openDatabase();
    registerIpc();
    createWindow();
  } catch (error) {
    logDiagnostic('เริ่ม FinNote ไม่สำเร็จ', error);
    dialog.showErrorBox('FinNote เริ่มทำงานไม่สำเร็จ', `${error.message || error}\n\nLog: ${path.join(app.getPath('userData'), LOG_FILE_NAME)}`);
    app.quit();
    return;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (unlockedMasterKey) unlockedMasterKey.fill(0);
  unlockedMasterKey = null;
  if (database) {
    persistDatabase();
    database.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
