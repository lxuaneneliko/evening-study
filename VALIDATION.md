# v1.1.5 驗證結果

2026-10-09，Windows。狀態：完整未簽章重建已完成，正式簽章及原生啟動驗證尚未完成。

- `npm.cmd test`：48 項通過。涵蓋行程、Spotify 命令、全螢幕載入與退出、尺寸保存、實際啟動項目判斷及簽章發布條件。
- `npm.cmd run dist`：目前沒有設定簽章憑證，依預期在打包前停止，未產生新的正式發行檔。
- `npm.cmd run dist:unsigned`：正常完整建置成功，輸出 `release/unsigned/EveningStudy-1.1.5-Windows-UNSIGNED.exe`。本檔未簽章，仍可能被 Smart App Control 阻擋。
- `node tests/verify-package.cjs --unsigned`：19 個封裝檔案與來源一致；套件版本、入口與每次啟動獨立解壓設定核對通過。
- PowerShell `Get-AuthenticodeSignature`：測試發行檔為 `NotSigned`，無時間戳記，沒有把它視為可正式發布。
- 簽章檢查測試涵蓋無憑證、不可信或無簽章、缺時間戳記、不同簽署者，以及 App／portable 只有一份通過的情況。真正持有憑證的端到端簽署仍待完成。
- 未執行新建的 App；原生視窗、Spotify 及重新登入後的行為未在本次發行檔實測。沒有修改已安裝的暮讀、使用者排程、暮讀啟動項目或 Windows 安全設定。

未簽章測試檔 SHA-256：

```text
2f1001293f4fce2e6fbc37f3e755cbe526a0b6e2040ac9fdad2c7d408cb34936
```

簽章取得與正式發布步驟見 [SIGNING.md](SIGNING.md)。單元與封裝檢查不能證明 Windows 已解除阻擋。
