'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'Index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'electron/main.js'),'utf8');
const preload=fs.readFileSync(path.join(root,'electron/preload.js'),'utf8');
test('idle lock default and user settings',()=>{
  assert.match(index,/autoLockMinutes: 10/);
  assert.match(index,/id="sAutoLockMinutes"/);
  assert.match(index,/minutes\*60000/);
  assert.match(index,/resetFinNoteIdleTimer\(\)/);
});
test('lock persists before clearing master key and UI',()=>{
  const section=index.slice(index.indexOf('async function lockFinNote(){'),index.indexOf('/* ======',index.indexOf('async function lockFinNote(){')));
  assert.ok(section.indexOf('await saveDesktopData(true)')>=0);
  assert.ok(section.indexOf("if(cloudStatus==='error')")>section.indexOf('await saveDesktopData(true)'));
  assert.ok(section.indexOf('await window.finnoteDesktop.securityLock()')>section.indexOf("if(cloudStatus==='error')"));
  assert.ok(section.indexOf('DATA=null')>section.indexOf('await window.finnoteDesktop.securityLock()'));
});
test('OS lock and suspend notifications are wired',()=>{
  assert.match(main,/powerMonitor\.on\(eventName/);
  assert.match(main,/'lock-screen', 'suspend'/);
  assert.match(preload,/onSystemLock: callback/);
  assert.match(index,/onSystemLock\?\.\(/);
});
test('desktop JSON import backups before data replacement',()=>{
  const section=index.slice(index.indexOf('function handleImportFile(e){'),index.indexOf('function generateRecurringForCurrentPeriod()'));
  const save=section.indexOf('await saveDesktopData(true)');
  const backup=section.indexOf("await window.finnoteDesktop.backup('pre-import')");
  const replace=section.indexOf('DATA=migrated');
  assert.ok(save>=0 && backup>save && replace>backup);
  assert.match(section,/if\(!backup\?\.ok\) throw/);
  assert.match(section,/Array\.isArray\(imported\.transactions\)/);
});
test('stable release naming',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.version,'1.0.0');
  assert.match(pkg.scripts['dist:win'],/--channel stable/);
  assert.match(pkg.scripts['dist:portable'],/--channel stable/);
  assert.match(pkg.build.win.artifactName,/v1\.0\.0-Setup/);
});
