const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'Index.html');
const codePath = path.join(root, 'Code.gs');
const index = fs.readFileSync(indexPath, 'utf8');
const server = fs.readFileSync(codePath, 'utf8');

const scripts = [...index.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
if (!scripts.length) throw new Error('ไม่พบ JavaScript ใน Index.html');
scripts.forEach((script, index) => new vm.Script(script, {filename:`Index-script-${index + 1}.js`}));
new vm.Script(server, {filename:'Code.gs'});

const serverContext = vm.createContext({});
vm.runInContext(server, serverContext, {filename:'Code.gs'});
const longCell = serverContext.safeCell_('x'.repeat(60000));
if (longCell.length > 45000) throw new Error('safeCell_ ยังสร้างข้อความเกินขนาดเซลล์ที่ปลอดภัย');
if (!longCell.includes('ข้อมูลฉบับเต็มเก็บอยู่ใน _AppData')) {
  throw new Error('safeCell_ ไม่ได้ระบุแหล่งข้อมูลฉบับเต็มเมื่อมีการย่อข้อความ');
}
const formulaCell = serverContext.safeCell_('=' + 'x'.repeat(60000));
if (formulaCell.length > 45000 || !formulaCell.startsWith("'=")) {
  throw new Error('safeCell_ ป้องกันสูตรหรือจำกัดขนาดเซลล์ไม่ถูกต้อง');
}

const requiredFiles = ['Index.html','Code.gs','appsscript.json','README.md','CHANGELOG.md','LICENSE'];
requiredFiles.forEach(file => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`ไม่พบไฟล์ ${file}`);
});

const requiredText = [
  'FinNote',
  'v1.8.2',
  'function dashboardKpi',
  'function healthItem',
  '5 รายการเงินออกสูงสุด',
  'สุขภาพการเงิน',
  'data-view="journal"',
  'function openJournalModal',
  'sheet: \'DailyJournal\'',
  'บันทึกงานเสริม',
  'id="gJobType"',
  'const SIDE_JOB_TYPES',
  'sheet: \'GrabBike\'',
  'key: \'grabbikeLogs\'',
  'data-editsavingslog',
  'function openSavingsHistoryModal',
  'data-delsavingslog',
  'function confirmDeleteSavingsHistory',
  'data-delsaving',
  'function confirmDeleteSavingsGoal'
  ,'const CREATOR_EMAIL'
  ,'id="btnOpenSupportPage"'
  ,'ประกาศจากผู้สร้าง FinNote'
  ,'function openCategoryModal'
  ,'function openRecurringModal'
  ,'data-edit-recurring'
  ,'data-delete-recurring'
  ,'function reportKpi'
  ,'function drawReportPie'
  ,'รายรับ–เงินออก 6 เดือนล่าสุด'
  ,'ชำระหนี้ · ${creditor}'
  ,"category: curType==='transfer'?'':overlay.querySelector('#fCat').value"
  ,'ภาพรวมสุขภาพการเงิน'
  ,'function reportDebtTrendSeries'
  ,'function drawDebtTrendChart'
  ,'function drawDebtPageTrendChart'
  ,'function drawReportDebtTrendChart'
  ,'รวมทั้งหมด'
  ,'function alertGoalRow'
  ,'เงินเหลือและเงินสะสมเดือนนี้'
  ,'ค่าใช้จ่าย + หนี้สินที่จ่าย'
  ,'id="brandAppName"'
  ,'function applyBranding'
  ,'id="btnChooseDecoration"'
  ,'function renderJournalCalendarHtml'
  ,'data-journal-view="calendar"'
  ,'const GITHUB_REPO_URL'
  ,'ดู Source Code บน GitHub'
  ,'สนับสนุนค่ากาแฟผู้พัฒนา FinNote'
  ,'const BIRTHDAY_THEMES'
  ,'function currentColorPalette'
  ,'id="btnApplyCustomTheme"'
  ,'คืนค่าธีมเริ่มต้น FinNote'
  ,'--sidebar-start'
  ,"root.style.setProperty('--sidebar-start'"
  ,'const MAX_READABLE_CELL_CHARS = 45000'
  ,'function truncateReadableCell_'
  ,'ข้อมูลฉบับเต็มเก็บอยู่ใน _AppData'
];
requiredText.forEach(text => {
  if (!(index + server).includes(text)) throw new Error(`ไม่พบข้อความหรือฟังก์ชันที่จำเป็น: ${text}`);
});
['btnSaveCreatorInfo','btnChooseDonationQr','donationQrInput'].forEach(text => {
  if (index.includes(text)) throw new Error(`ยังพบฟอร์มข้อมูลผู้สร้างที่ควรถูกนำออก: ${text}`);
});

if (!index.includes("const STORAGE_KEY = 'finnote_v1'")) {
  throw new Error('ชื่อพื้นที่จัดเก็บข้อมูลไม่ตรงกับ FinNote รุ่น 1');
}

console.log(JSON.stringify({
  ok:true,
  product:'FinNote',
  release:'1.8.2',
  scripts:scripts.length,
  requiredFiles:requiredFiles.length
}, null, 2));
