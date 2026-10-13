'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../Index.html'), 'utf8');

function functionSource(name, nextName) {
  const start = source.indexOf('async function ' + name + '(');
  const end = source.indexOf('async function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, 'expected desktop function boundaries');
  return source.slice(start, end);
}

test('Settings: missing optional support button cannot abort subsequent bindings', () => {
  assert.match(source, /getElementById\('btnOpenSupportPage'\)\?\.addEventListener/);
  const support = source.indexOf("getElementById('btnOpenSupportPage')?.addEventListener");
  const save = source.indexOf("getElementById('btnDesktopSave').addEventListener");
  const backup = source.indexOf("getElementById('btnDesktopSnapshot').addEventListener");
  assert.ok(support >= 0 && save > support && backup > save);
});

test('Settings: all direct ID event bindings have matching markup IDs', () => {
  const start = source.indexOf('function renderSettings(){');
  const end = source.indexOf('/* ----------------------------', start + 1);
  assert.ok(start >= 0 && end > start, 'expected Settings function section');
  const render = source.slice(start, end);
  const direct = [...render.matchAll(/getElementById\('([^']+)'\)\.addEventListener/g)].map(m => m[1]);
  assert.ok(direct.length >= 10, 'must examine actual settings handlers');
  for (const id of direct) {
    assert.ok(source.includes('id="' + id + '"'), 'missing DOM element: ' + id);
  }
});

test('SQLite load: successful existing data marks database connected without a save', async () => {
  const calls = [];
  const context = vm.createContext({
    IS_DESKTOP: true,
    window: { finnoteDesktop: {
      load: async () => ({ data: { version: 1 }, updatedAt: '2026-10-13T00:00:00.000Z' }),
      info: async () => ({ databasePath: 'uat.sqlite3' }),
      save: async () => { throw Error('should not save existing data'); }
    }},
    DATA: null, desktopDatabasePath: '', cloudStatus: 'connecting', cloudErrorMsg: 'old error',
    migrateData: x => x, defaultData: () => ({}),
    localStorage: { removeItem: () => {}, setItem: () => {} }, STORAGE_KEY: 'test',
    updateCloudStatusUI: () => calls.push('updated'), console
  });
  vm.runInContext(functionSource('loadDesktopData', 'saveDesktopData'), context);
  assert.equal(await vm.runInContext('loadDesktopData()', context), true);
  assert.equal(vm.runInContext('cloudStatus', context), 'connected');
  assert.equal(vm.runInContext('cloudErrorMsg', context), '');
  assert.deepEqual(calls, ['updated']);
});

test('SQLite load: failures show error state rather than stuck connecting', async () => {
  let updated = 0;
  const context = vm.createContext({
    IS_DESKTOP: true,
    window: { finnoteDesktop: {
      load: async () => { throw Error('unavailable'); },
      info: async () => ({})
    }},
    cloudStatus: 'connecting', cloudErrorMsg: '', desktopDatabasePath: '',
    updateCloudStatusUI: () => updated++,
    console: { error: () => {} }
  });
  vm.runInContext(functionSource('loadDesktopData', 'saveDesktopData'), context);
  assert.equal(await vm.runInContext('loadDesktopData()', context), false);
  assert.equal(vm.runInContext('cloudStatus', context), 'error');
  assert.match(vm.runInContext('cloudErrorMsg', context), /unavailable/);
  assert.equal(updated, 1);
});

test('All views: navigation renderer map contains all sidebar view keys', () => {
  const nav = source.slice(source.indexOf('function navigate(view){'), source.indexOf("document.querySelectorAll('.navbtn, .bottomnav button')"));
  assert.match(nav, /settings: renderSettings/);
  for (const view of ['dashboard','transactions','budget','debts','savings','plans','grabbike','journal','reports','accounts','categories','recurring','support','about','announcements','alerts','settings']) {
    assert.match(nav, new RegExp('\\b' + view + ':'));
  }
});
