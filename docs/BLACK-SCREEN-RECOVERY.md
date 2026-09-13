# 全螢幕黑畫面：2026-09-13 實機診斷與修復

## 已確認的問題

執行中的 v1.1.0 曾只剩原生視窗的深色背景，沒有行程、計時或 Spotify 控制。實際執行目錄缺少 66 個檔案，包括 `icudtl.dat`、`resources.pak`、`snapshot_blob.bin`、`v8_context_snapshot.bin` 與所有語系檔。`app.asar` 還在，因此只核對 App 原始碼並不能發現這個問題。

從原版 portable 還原並逐檔核對後，重新啟動同一版，原生全螢幕、計時、Spotify 與 Esc 返回均恢復正常。

## 造成缺檔的打包缺陷

electron-builder 26.15.3 預設為每個建置產生固定的 `UNPACK_DIR_NAME`。它的 `portable.nsi` 在執行前與子程序結束後都對此資料夾進行遞迴清理。多次啟動同一份 portable 會共用資料夾；第二個 Electron 因單一執行個體限制結束時，第二個啟動器便可能清掉第一個仍在使用的資料檔。被 Windows 鎖住的 EXE／DLL 尚存，使症狀容易被誤認為單純渲染問題。

v1.1.3 改用每次啟動獨立的 `$PLUGINSDIR/app`。目前固定版本的實作需要 `unpackDirName: true`；其型別註解寫 false，但實作中的 `!unpackDirName` 分支會重新產生固定名稱，所以以實際編譯參數為準。`scripts/build-portable.cjs` 在編譯前驗證 `UNPACK_DIR_NAME` 沒有被定義，若未符合就拒絕產出。

## 現有桌面修復

以雜湊核對過的原始 v1.1.0 完整套件恢復桌面，將 73 個未修改的原版檔案放在 `%LOCALAPPDATA%/Programs/EveningStudy-1.1.0`。桌面捷徑直接啟動這份 App，不再透過會清理共用暫存資料夾的舊 portable 啟動器。使用者行程及原本尺寸、位置保留。

這是同版修復；沒有把較新版本的內容塞入舊版執行檔。重複啟動固定資料夾的 App 後，全部 73 個檔案仍與原版雜湊一致；使用者亦已確認 App 恢復正常。

## 與 Windows 阻擋的區別

較新執行檔被攔截是另一件事。已從本機讀到 `VerifiedAndReputablePolicyState = 1`，且事件所指政策的內文名稱為 `VerifiedAndReputableDesktop`，屬於 Smart App Control。不能僅憑事件中的 Enterprise signing 字樣就判定為公司管理政策。

2026-09-13 18:01（Asia/Taipei），完成 v1.1.3 的單元與封裝驗證後，直接啟動這份新版執行檔，Windows 回報「應用程式控制原則已封鎖此檔案」，並記錄 Code Integrity 3077／3033。新版仍未取得受信任簽章，因此尚未更新桌面配色。原版桌面修復的操作證據與新版本的單元／封裝驗證分開記錄。

參考：[Microsoft Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview)、[Microsoft 程式碼簽章選項](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)。
