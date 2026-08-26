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

GitHub Actions: open **Actions → Build Windows Release → Run workflow**. After completion, download both artifacts from the workflow run.
