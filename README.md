**Current Desktop Version: v0.3.0 Beta / UI v3.0.0 Beta**

# FinNote Desktop

FinNote Desktop เป็นโปรแกรมบันทึกการเงินแบบออฟไลน์บน Windows ใช้ SQLite ภายในเครื่อง และใน v0.2.4 ใช้ Local Owner Login พร้อม Encryption at Rest เพื่อให้ข้อมูลหลักเปิดอ่านได้หลังปลดล็อกด้วยรหัสผ่านของเจ้าของเท่านั้น

## ความปลอดภัย v0.2.4

เมื่อเปิดเวอร์ชันนี้ครั้งแรก โปรแกรมจะให้สร้างชื่อเจ้าของและรหัสผ่านอย่างน้อย 8 ตัวอักษร จากนั้นสร้าง Master Key แบบสุ่มสำหรับเข้ารหัสข้อมูลด้วย AES-256-GCM โดยรหัสผ่านใช้สำหรับปลดล็อก Master Key ผ่าน PBKDF2 ไม่ได้ถูกใช้เป็นกุญแจข้อมูลโดยตรง โปรแกรมจะแสดง Recovery Key ให้เก็บไว้นอกเครื่องเพื่อใช้ตั้งรหัสผ่านใหม่หากลืมรหัสผ่าน

หากพบฐานข้อมูลจาก v0.1.x โปรแกรมจะสร้างไฟล์สำรอง `finnote.pre-encryption.<timestamp>.sqlite3` ในโฟลเดอร์ข้อมูลแอปก่อน Migration แล้วจึงเข้ารหัสข้อมูลหลักและจุดสำรองภายใน SQLite ผู้ใช้ไม่ต้อง Export/Import ข้อมูลเดิมใหม่

> ไฟล์ JSON ที่ผู้ใช้กดส่งออกเองเป็นไฟล์สำหรับย้ายข้อมูลและยังเป็น plaintext จึงควรจัดเก็บในพื้นที่ปลอดภัย

## ข้อมูลและการอัปเดต

- ไฟล์ฐานข้อมูลหลักยังใช้ชื่อ `finnote.sqlite3` ใน App Data เดิม เพื่อรักษาความต่อเนื่องกับผู้ใช้เดิม
- เวอร์ชันเก่าจะไม่สามารถอ่านฐานข้อมูลหลัง Migration เป็นรูปแบบเข้ารหัสได้
- การติดตั้งเวอร์ชันใหม่ทับเวอร์ชันเดิมต้องไม่ลบฐานข้อมูลใน App Data
- ระบบแยก Schema Version, Migration Version และ Encryption Format Version เพื่อให้พัฒนาเวอร์ชันถัดไปได้โดยไม่บังคับสร้างฐานใหม่

## UX/UI

- บัญชี หมวดหมู่ และรายการประจำเป็นหน้าแยก
- Import / Export / Backup / Restore อยู่ใน Settings
- Sidebar รองรับ Drag & Drop, จำลำดับล่าสุด และมี Reset to Default
- Dashboard ล็อกบนสุด ส่วน Settings/ติดต่อผู้สร้าง/ภาพตกแต่งล็อกด้านล่าง
- แก้ Search Focus สำหรับการพิมพ์ไทยและอังกฤษต่อเนื่อง
- ผู้ใช้เปลี่ยนโลโก้ภายในโปรแกรมได้ แต่ App Icon ของ Windows ยังคงเป็น FinNote

## หมวดหมู่มาตรฐาน

ผู้ใช้ใหม่จะได้รับ Default Category Master รหัส IN-01–IN-14 และ EX-01–EX-50 ผู้ใช้เดิมจะไม่ถูกเขียนทับหมวดหมู่เมื่ออัปเดต และสามารถกด “เพิ่มหมวดมาตรฐาน” เพื่อเพิ่มเฉพาะรายการที่ยังไม่มีได้

## Development

```bash
npm ci
npm test
npm start
```

Build Windows Installer:

```bash
npm run dist:win
```

Build Windows Portable executable:

```bash
npm run dist:portable
```


## Legacy Migration v0.2.4
FinNote Desktop ตรวจฐานเดิมที่ `%APPDATA%\finnote-desktop\finnote.sqlite3` และฐานใหม่ที่ `%APPDATA%\FinNote Desktop\finnote.sqlite3` แยกกัน เมื่อพบฐานเดิมจะแจ้งผู้ใช้และสำรองทั้งสองฝั่งก่อน Migration เข้า encrypted store พร้อมตรวจจำนวนข้อมูลก่อน/หลัง ฐานเดิมจะไม่ถูกลบอัตโนมัติ

## Category Structure
หมวดหมู่รองรับ Stable ID, ประเภท, icon, หมวดหลัก, หมวดย่อย, คำอธิบาย, สี และสถานะใช้งาน โดยรักษาการเชื่อมโยงของรายการย้อนหลัง


## v0.3.0 Beta
รุ่น Beta สำหรับแจกทดสอบ รวมฟังก์ชันทั้งหมดจาก v0.2.12. แนะนำสำรองข้อมูลและเก็บ Recovery Key ก่อนอัปเดต

### Beta blocker fixes (latest)
- หน้า **จัดการบัญชี** และ **จัดการรายการประจำ** สามารถเพิ่ม/แก้ไขได้ตามปกติ และแสดงเป็น Compact Table
- ชื่อเมนูทั้ง Sidebar / Settings / Page Title ใช้ Menu Master เดียวกัน
- UI แสดงเวอร์ชัน **v0.3.0 Beta** ให้ตรงกับ package/release


### Branding logo regression fix
- แก้ปัญหาโลโก้ Sidebar/Settings แสดงเป็นรูปเสียเมื่อค่าโลโก้เดิมในฐานข้อมูลไม่สามารถโหลดได้
- เพิ่ม fallback อัตโนมัติไปยังโลโก้ FinNote เริ่มต้น โดยไม่ลบค่า Custom Branding เดิม
- คงฟังก์ชันมุมมองรายการ / ปฏิทิน / รายวัน และ Requirement ล่าสุดทั้งหมดไว้

- Logo reliability fix: embedded the default FinNote logo directly in Index.html so it still renders when Index.html is opened by itself from a ZIP/temp folder; custom logo continues to override it when available.
