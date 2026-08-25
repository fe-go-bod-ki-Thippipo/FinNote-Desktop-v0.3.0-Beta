
## v0.3.0 Beta — Dashboard Budget Chart Fix
- Dashboard “งบประมาณเดือนนี้” now uses `budgetTrackingForMonth()` as the single source of truth.
- Actual spending is calculated with `trackedBudgetSpent()` exactly like the budget management page.
- Only tracked budget rows for the selected month are shown.
- Empty months show “ยังไม่ได้ตั้งงบประมาณเดือนนี้” instead of legacy budget data.
- Over-budget rows are highlighted separately from normal spending.
## v0.3.0 Beta — Beta blocker & UI consistency update
- แก้บั๊กเพิ่ม/แก้ไขบัญชีและรายการประจำ: ลบโค้ด pendingParentCategory ที่ถูกแทรกผิดฟังก์ชัน
- ปรับหน้า จัดการบัญชี และ จัดการรายการประจำ เป็นตารางแบบกระชับเหมือนหน้าแผน/งบประมาณ
- กำหนด Menu Master กลางให้ Sidebar, Settings และชื่อหัวหน้าใช้ชื่อเดียวกัน
- ใช้มาตรฐานชื่อเมนู: ภาพรวมการเงิน, รายการรับ–จ่าย, จัดการงบประมาณ, จัดการหนี้สิน, จัดการเงินออม, จัดการแผน, บันทึกประจำวัน, บันทึกงานเสริม, รายงานการเงิน, จัดการบัญชี, จัดการหมวดหมู่, จัดการรายการประจำ
- แก้เลขเวอร์ชันที่ Sidebar จาก v2.4.0 เป็น v0.3.0 Beta
- เปลี่ยนข้อความเก่า “แผนลดค่าใช้จ่าย” ใน Dashboard เป็น “แผน” ให้สอดคล้องกับความสามารถปัจจุบัน

## v0.3.0 Beta / UI v3.0.0 Beta

- Beta release สำหรับแจกทดสอบบน Windows x64
- รวมฟังก์ชันทั้งหมดจาก v0.2.12 โดยไม่ลดฟังก์ชันเดิม
- เตรียม Windows Setup, Portable และ Source package

## v0.2.12 / UI v2.6.0

- เชื่อมบันทึกประจำวันกับแผนและ Checklist รายการย่อยได้แบบไม่บังคับ
- หน้าแผนเพิ่มส่วน “บันทึกที่เชื่อมโยง” แบบย่อ/ขยาย โดยไม่ใช้ในการคำนวณความคืบหน้า
- คืนความสามารถเปิดดู Transaction ที่เชื่อมกับแต่ละรายการย่อยในแผน
- ตัด Summary งบประมาณ/ใช้จริง/คงเหลือ/วันคงเหลือที่ซ้ำในรายละเอียดแผน เหลือข้อมูลสรุปในตารางหลัก
- เปลี่ยนหัวข้อ “เป้าหมาย / รายละเอียด” เป็น “รายละเอียดแผน”
- คงข้อมูลเดิมและ migration รองรับ journal planId/planItemId

## v0.2.11 / UI v2.5.2

- เอาช่อง “หมวดค่าใช้จ่ายของแผน” ออกจากหน้าสร้าง/แก้ไขแผน
- โครงสร้างแผนใช้ลำดับ แผน → รายการย่อย → Transaction จริง โดยหมวดหลัก/หมวดย่อยอ้างอิงจาก Transaction ที่เชื่อม
- เก็บ `categoryIds` เดิมไว้เฉพาะเพื่อ backward compatibility โดยไม่ใช้เป็นเงื่อนไขการคำนวณแผนใหม่
- รักษาฟังก์ชันเดิม Security, Encryption, Legacy Migration และข้อมูลแผนเดิมทั้งหมด

## v0.2.10 / UI v2.5.1

- แก้บั๊ก Theme ของหัวตาราง: ตารางงบประมาณและตารางอื่นใช้สีพื้นหัวตาราง/สีตัวอักษรหัวตารางจาก Advanced Theme Settings จริง
- ลบสีหัวตารางแบบ hard-coded ของ Budget ที่เขียนทับ Theme
- เพิ่มกฎกลางให้ทุก `table thead th` อ้างอิง `--advanced-table-bg` และ `--advanced-table-text`

# FinNote Desktop v0.2.8

## v0.2.9 / UI v2.5.0

- หน้าแผนย่อไว้เป็นค่าเริ่มต้น และขยายดูรายละเอียดเป็นรายแผนได้
- เพิ่มปุ่มย่อทั้งหมด / ขยายทั้งหมด
- ตอนย่อแสดงชื่อ ช่วงเวลา งบ ใช้จริง คงเหลือ/เกินงบ ความคืบหน้า และสถานะ
- ตอนขยายจึงแสดงรายละเอียดแผน รายการย่อย ค่าใช้จ่ายที่เชื่อม และสรุปผลแผนด้านล่างสุด
- รักษา Security, Encryption, Legacy Migration และฟังก์ชันเดิมทั้งหมด

- เชื่อม Transaction กับรายการย่อย (Checklist item) ภายในแผนได้
- เพิ่ม Dropdown รายการย่อยแบบสัมพันธ์กับแผนในหน้าบันทึกรายการ
- รายการย่อยในหน้าแผนแสดงยอดใช้จริงและจำนวน Transaction ที่เชื่อม
- หน้าสรุปการเงินของแผนรวมยอดจากรายการย่อยอัตโนมัติและแสดงตารางค่าใช้จ่ายตามรายการย่อย
- การลบรายการย่อยจะยกเลิกเฉพาะความสัมพันธ์กับ Transaction โดยไม่ลบ Transaction
- รักษาแผน/Transaction เดิมและฟังก์ชันเดิมทั้งหมด

# FinNote Desktop v0.2.7

- Plans upgraded into financial projects with start/end dates, overall budget, goal/description, planned expense categories, linked transactions, actual spend, remaining budget and category breakdown.
- New Transaction can optionally link a transaction to a Plan.
- Transactions table now separates Parent Category and Subcategory columns and adds dependent Parent → Subcategory filters.
- Side Jobs now use the shared Category Master for income/travel/other-cost transactions; side-job identity remains source linkage only.
- Existing security, encryption, migration, theme, budget, category and search features are preserved.

# FinNote Desktop v0.2.6

- Advanced Theme Settings: background/text/table/button/accent/border/status colors
- Live theme preview and Contrast Guard with automatic black/white text correction
- Categories page parent groups collapsed by default
- New Transaction subcategory dropdown now shows only subcategory icon/name

## v0.2.6
- Budget tracking redesigned as a compact table with progress/status and drag ordering.
- New transaction form now filters Parent Category → Subcategory by transaction type.
- Category parent headers compacted to one line.

# Changelog

## v0.2.4 — Hierarchical Categories + Selective Budget + Sidebar Info Pages

- หน้า Category แสดงหมวดหลัก → หมวดย่อยแบบย่อ/ขยาย
- หน้าเพิ่ม/แก้หมวดใช้ Dropdown หมวดหลัก และสร้างหมวดหลักใหม่ได้
- Budget แสดงเฉพาะหมวดที่ผู้ใช้เลือกติดตาม ตั้งได้ระดับหมวดหลักหรือหมวดย่อย
- Budget รองรับ Drag & Drop, เลื่อนขึ้น/ลง, จำลำดับ และ Reset
- ป้องกันการนับซ้ำระหว่างงบหมวดหลักกับหมวดย่อยโดยหักหมวดย่อยที่ติดตามแยกออกจากยอดหมวดหลัก
- ย้าย เกี่ยวกับ FinNote และ ประกาศจากผู้สร้าง ออกจาก Settings ไป Sidebar
- รักษาฟังก์ชัน Security, Legacy Migration และข้อมูลเดิมจาก v0.2.3

## v0.2.3 — Legacy Migration + Category Structure + About FinNote
- ตรวจหา Legacy SQLite อัตโนมัติจาก `%APPDATA%\\finnote-desktop\\finnote.sqlite3` โดยไม่เปลี่ยน path ของฐานเข้ารหัสใหม่
- เพิ่มขั้นตอนแจ้งผู้ใช้, สำรองฐานเดิมและฐานใหม่, Migration เข้าฐานเข้ารหัส และตรวจจำนวนข้อมูลก่อน/หลังแบบ transaction-safe
- ไม่ลบหรือเขียนทับ Legacy DB หลัง Migration และไม่ mark สำเร็จเมื่อ integrity check ไม่ผ่าน
- ปรับหมวดหมู่เป็นข้อมูลโครงสร้าง: Stable ID, ประเภท, icon, หมวดหลัก, หมวดย่อย, คำอธิบาย, สี และ active/inactive
- เพิ่มหน้าจัดการหมวดหลัก และใช้การปิดใช้งานแทนการลบข้อมูลที่มีประวัติ
- เปลี่ยนหน้า About เป็นเรื่องราวที่มาของ FinNote และซ่อน GitHub/Source links จนกว่า repository/release จะพร้อม
- คงฟังก์ชันเดิมทั้งหมด รวม Login, Encryption, Recovery Key, Sidebar customization และ Search focus fix

## v0.2.2 — Security Gate startup fix
- แก้บัคเปิดโปรแกรมแล้วขึ้น `Cannot read properties of null (reading 'classList')`
- เพิ่ม `#securityGate` container ในหน้า Desktop อย่างถูกต้อง
- เพิ่ม defensive fallback สร้าง Security Gate อัตโนมัติหากไฟล์ UI จาก package เก่า/ผสมไม่มี container
- ไม่ลบ ไม่ reset และไม่เขียนทับฐานข้อมูล SQLite เดิมระหว่างขั้นตอนแก้ไขนี้
- คง Diagnostic startup screen เพื่อแสดงสาเหตุจริงหากพบปัญหาอื่น

## FinNote Desktop v0.2.1 / UI v2.0.1
- แก้บัคเริ่มระบบความปลอดภัยค้างที่ “กำลังเปิดฐานข้อมูล…”
- เพิ่ม migration ซ่อมโครงสร้าง `app_meta` จาก build ทดสอบ v0.2.0 ที่อาจมีคอลัมน์ไม่ครบ โดยไม่ลบ SQLite เดิม
- ทำ `security:status` ให้ทนต่อ metadata รุ่นเก่าและบันทึก diagnostic log
- เพิ่มหน้าวินิจฉัยเมื่อเปิด Security/SQLite ไม่สำเร็จ พร้อมสาเหตุ ตำแหน่งฐานข้อมูล และปุ่มลองใหม่
- เพิ่ม IPC diagnostics สำหรับตรวจ database/schema version โดยไม่เปิดเผยข้อมูลการเงิน
- รักษาฟังก์ชันเดิมและไม่เปลี่ยนโครงสร้างข้อมูลธุรกรรม

## FinNote Desktop v0.2.0 / UI v2.0.0

- เพิ่ม Local Owner Login สำหรับการใช้งานแบบออฟไลน์บนเครื่องเจ้าของ
- เพิ่ม Encryption at Rest ด้วย AES-256-GCM สำหรับข้อมูลหลักและจุดสำรองภายใน SQLite
- ใช้ Master Key แบบสุ่ม และป้องกัน Master Key ด้วยรหัสผ่านผ่าน PBKDF2 แทนการใช้รหัสผ่านเข้ารหัสข้อมูลโดยตรง
- เพิ่ม Recovery Key, เปลี่ยนรหัสผ่าน และสร้าง Recovery Key ใหม่โดยไม่ต้องเข้ารหัสข้อมูลทั้งฐานใหม่
- รองรับ Migration ฐานข้อมูล v0.1.x ที่ยังไม่เข้ารหัส พร้อมสร้างสำเนา SQLite ก่อนแปลงอัตโนมัติ
- แยกเวอร์ชัน Database Schema, Migration และ Encryption Format เพื่อรองรับการอัปเดตในอนาคต
- Desktop ไม่เก็บข้อมูลการเงินแบบ plaintext ซ้ำใน localStorage อีกต่อไป
- แก้บัคช่องค้นหารายการและบันทึกประจำวัน Focus หลุดหลังพิมพ์ตัวอักษรแรก รวมถึงรองรับ Thai IME/composition
- เพิ่ม Drag & Drop สำหรับจัดลำดับเมนู Sidebar โดยล็อกภาพรวมไว้บนสุด และล็อกส่วน Footer/Settings/ภาพตกแต่งไว้ด้านล่าง
- เพิ่มคำสั่งคืนค่าลำดับ Sidebar เริ่มต้น และหัวข้อปรับแต่งเมนูใน Settings
- รักษาหน้า บัญชี / หมวดหมู่ / รายการประจำ เป็นหน้าแยกจาก Settings
- คง Import / Export / Backup / Restore ไว้ใน Settings
- ใช้ Default Category Master ใหม่ IN-01–IN-14 และ EX-01–EX-50 สำหรับผู้ใช้ใหม่เท่านั้น
- เพิ่ม Stable Category ID และปุ่ม “เพิ่มหมวดมาตรฐาน” แบบไม่เขียนทับหมวดของผู้ใช้เดิม
- หมวดหมู่ของฐานข้อมูลเดิม รายการย้อนหลัง และการเชื่อมโยงเดิมยังคงอยู่เมื่ออัปเดต
- การโอนเงินระหว่างบัญชีใช้ transaction type `transfer` และไม่ถูกรวมเป็นรายรับหรือรายจ่ายใน Cash Flow
- คง FinNote App Icon สำหรับ .exe / Taskbar / Shortcut แยกจากโลโก้ที่ผู้ใช้เปลี่ยนใน UI
- เตรียม Build Windows Setup (.exe) และ Portable สำหรับการเผยแพร่

## FinNote Desktop v0.1.1

- แยกหน้า บัญชี / หมวดหมู่ / รายการประจำ ออกจาก Settings
- คืนพื้นที่ภาพตกแต่ง Sidebar
- ปรับโลโก้ FinNote Desktop

### Branding logo regression fix
- แก้ปัญหาโลโก้ Sidebar/Settings แสดงเป็นรูปเสียเมื่อค่าโลโก้เดิมในฐานข้อมูลไม่สามารถโหลดได้
- เพิ่ม fallback อัตโนมัติไปยังโลโก้ FinNote เริ่มต้น โดยไม่ลบค่า Custom Branding เดิม
- คงฟังก์ชันมุมมองรายการ / ปฏิทิน / รายวัน และ Requirement ล่าสุดทั้งหมดไว้

- Logo reliability fix: embedded the default FinNote logo directly in Index.html so it still renders when Index.html is opened by itself from a ZIP/temp folder; custom logo continues to override it when available.

- Dashboard: หมวดที่ใกล้เต็มงบ ใช้ budgetTracking/trackedBudgetSpent ชุดเดียวกับหน้าจัดการงบประมาณ
