# Windows 簽章與發布

目前 v1.1.5 已準備簽章流程，但尚未取得或設定受信任的程式碼簽章憑證。未簽章建置不能作為 Smart App Control 阻擋問題已解決的證明。

## 正式建置

`npm.cmd run dist` 必須明確設定簽章身分，否則在打包前停止。使用受 Windows 信任的程式碼簽章憑證；自行產生的測試憑證不等於公開信任。

支援兩種現有憑證的設定方式：

- Windows 憑證存放區／硬體金鑰：以 `EVENING_STUDY_CERT_SHA1` 指定憑證的 40 字元指紋。SHA-1 在這裡僅用於選取憑證，檔案簽章使用 SHA-256。
- 簽章供應商允許匯出的憑證：透過建置環境的 `WIN_CSC_LINK`／`CSC_LINK` 與對應 `WIN_CSC_KEY_PASSWORD`／`CSC_KEY_PASSWORD` 提供給 electron-builder。不要將憑證、密碼或私鑰寫入原始碼、文件或聊天。

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run dist
node tests/verify-package.cjs
```

正式建置啟用 `forceCodeSigning`，在簽章後檢查 App 主執行檔與 portable 發行檔的 Authenticode 狀態、時間戳記及一致的簽署者。此檢查不會執行 App，也不會更改電腦的信任設定。憑證有效仍不等於保證通過所有電腦的額外組織政策；發布前仍需在保留安全防護的測試環境驗證實際啟動。

## 未簽章的封裝檢查

尚未取得憑證時，可明確產生未簽章測試檔以核對封裝：

```powershell
npm.cmd run dist:unsigned
node tests/verify-package.cjs --unsigned
```

檔案位於 `release/unsigned/EveningStudy-1.1.5-Windows-UNSIGNED.exe`，與正式輸出分開。它仍可能被 Windows 阻擋，不應發布為「已修好啟動」的版本，也不應覆蓋現有安裝。

## 取得簽章的待辦

由專案擁有者選擇及申請符合資格的簽章供應商，完成必要的身分驗證、條款同意及費用確認。取得資格後才能完成真正的已簽章發布。

若考慮免費的 SignPath Foundation 開源方案，專案需要符合其開源授權、維護及可驗證建置等條件，並通過審核。本儲存庫目前尚未選定開源授權，沒有提交申請，也沒有宣稱獲得簽章贊助。公開 GitHub 儲存庫不等於已符合申請條件。

- [Microsoft：Smart App Control 簽章要求](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control)
- [SignPath Foundation 條件](https://signpath.org/terms)
- [SignPath Foundation 申請頁](https://signpath.org/apply.html)

更新應以完整、可驗證的正式套件交付。此專案的發布流程不會替換舊安裝的 `app.asar`、關閉 Windows 防護、加入系統信任例外，或更動現有使用者資料。
