# Build FinNote Desktop v0.3.0 Beta on Windows

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run dist:win
npm.cmd run dist:portable
```

Outputs:
- `dist/FinNote-Desktop-v0.3.0-Beta-Setup.exe`
- `dist-portable/FinNote-Desktop-v0.3.0-Beta-Portable.exe`

GitHub Actions: open **Actions → Build Windows Release → Run workflow**. After completion, download the artifact from the workflow run.

## Channels

| Channel | ใช้เมื่อ | ตัวตนโปรแกรม | โฟลเดอร์ข้อมูล |
|---|---|---|---|
| `beta` / `stable` | รุ่นใช้งานจริง (Build จาก `main` หรือ tag `v*` เท่านั้น) | `com.finnote.desktop` · FinNote Desktop | `%APPDATA%\FinNote Desktop\` (เดิม ไม่เปลี่ยน) |
| `uat` | ตรวจรับ Feature Branch ก่อน Merge | `com.finnote.desktop.uat` · FinNote UAT | Setup: `%APPDATA%\FinNote Desktop UAT\` · Portable: `FinNote-UAT-Data\` ข้างไฟล์ .exe |
| `dev` | `npm start` จากซอร์ส | — | `%APPDATA%\FinNote Desktop Dev\` |

UAT/dev จะไม่อ่านหรือเสนอย้ายฐานข้อมูล FinNote เดิม (`%APPDATA%\finnote-desktop\`) และมีแถบสีส้มแสดง channel, เวอร์ชัน และ Commit ด้านบนหน้าจอ

ทุก channel เปิดได้ครั้งละหนึ่งหน้าต่างต่อโฟลเดอร์ข้อมูล (single instance) เพื่อป้องกันการเขียนทับ `finnote.sqlite3`

## UAT Build จาก Feature Branch

1. **Actions → Build Windows Release → Run workflow**
2. **Use workflow from:** เลือก Feature Branch
3. `channel: uat` · `target: portable` (หรือ `setup` / `both`) · `retention_days: 5`
4. ดาวน์โหลด Artifact `FinNote-uat-<version>-<commit>` จากหน้า Run แล้วตรวจ checksum:
   ```powershell
   Get-FileHash .\FinNote-UAT-*.exe -Algorithm SHA256   # เทียบกับ SHA256SUMS.txt
   ```
5. เปิดโปรแกรม ตรวจว่า Commit บนแถบด้านบนตรงกับ Commit ของ Run แล้วจึงเริ่มตรวจรับ
6. ใช้ข้อมูลจำลองเท่านั้น ตรวจรับเสร็จให้ลบ Artifact และโฟลเดอร์ข้อมูล UAT

ทำเองในเครื่อง (ไม่ผ่าน Actions):

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run dist:uat:portable   # สร้าง build-info.json (channel uat) ให้อัตโนมัติ
```

Build ที่ไม่มี `build-info.json` จะถือเป็นรุ่นใช้งานจริง (stable) ตามพฤติกรรมเดิม
หลัง Build UAT ในเครื่อง ให้ลบ `build-info.json` ก่อน Build รุ่นใช้งานจริงด้วย `dist:win` / `dist:portable`
