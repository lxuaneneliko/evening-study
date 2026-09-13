# 暮讀 · AFTERGLOW

Windows 桌面行程 App。深夜藍半透明卡片、冰藍與淡紫色星光，放在桌面右側，顯示「此刻」與「接著」。已內建提供的每週讀書與基隆／土城生活行程。

## 開始使用

1. 從 [GitHub Releases](https://github.com/lxuaneneliko/evening-study/releases/tag/v1.1.4) 下載 `EveningStudy-1.1.4-Windows.exe`，不需安裝 Node.js。執行檔可單獨移動；自行建置的 `release/win-unpacked/暮讀.exe` 則須保留整個資料夾。此版包含排版、不透明度、設定保存及開機啟動修正，並移除卡片底部裝飾文字。執行檔尚未簽章，以預發布形式提供；驗證範圍見 [VALIDATION.md](VALIDATION.md)。
2. 預設顯示在主螢幕右側。拖曳「暮讀」標題或卡片頂端可移動；拖曳四邊或角落可直接調整大小，右下角有拖曳標記。尺寸和位置會自動記住。
3. 按第二張卡片的「行程手帳」，查看一週安排。星期在左，各時段、住宿、電腦與衣物在上。
4. 點選星期，再按鉛筆編輯安排。可以補上課本名稱、章節、習題目標與備註。
5. 「匯入行程」支援選檔或直接貼表格，辨識並預覽後才套用。套用會替換整週行程；可復原上一次修改。

行程每週循環，依電腦本地日期與時間自動切換。預設排程含 **35 個安排：26 個定時安排、9 個未定時提醒**。「上課、通勤」等內容未提供時間，會保留為當日提醒；不會擅自排時間。書本名稱由使用者自行補上。

版本變更見 [CHANGELOG.md](CHANGELOG.md)。每次 portable 啟動使用獨立解壓目錄，避免重複開啟時誤刪仍在使用的程式資料。

## 桌面使用

- 第一張卡片：目前行程、課本、備註、剩餘時間，以及唯一的 **LOCKED IN** 按鈕。沒有定時行程時顯示空檔。
- 點 **LOCKED IN** 進入所在螢幕的全螢幕專注畫面，開始累計專注時間，並續播 Spotify 目前選好的內容。畫面顯示歌曲名稱、歌手與播放狀態，可直接暫停／繼續。
- 按 **Esc** 或右上角「返回桌面」退出全螢幕，回復原本卡片尺寸與位置。音樂會繼續播放；可在退出前按 Spotify 暫停。
- 全螢幕會先載入內容，再顯示視窗及啟動音樂。載入超過 10 秒、畫面程序中斷或切換失敗時，自動返回卡片並顯示原因。退出事件沒有回應時，1.5 秒後關閉專注視窗。若舊版卡住，可先按 Esc，或從系統匣選「顯示桌面卡片」。
- Spotify 需在本機安裝、登入，且曾選好歌曲／歌單。若尚未準備好，會開啟 Spotify 並顯示設定提示，不會假裝已開始播放。選好內容後可重試。
- 使用 Windows 系統媒體控制來續播，不需 Spotify 開發者帳號、API 金鑰或另外連接雲端服務。Spotify 的廣告與帳號播放限制仍依 Spotify 本身處理。
- 第二張卡片：接下來兩項行程、今晚住宿、電腦移動、衣物提醒；未定時行程可從提醒連到手帳。
- 預設不置頂，其他 App 可覆蓋卡片。按圖釘可保持在其他視窗上方。這是浮動視窗，不會改寫桌布或移動桌面圖示。
- 上方減號隱藏卡片；Windows 系統匣的月亮圖示可叫回。右鍵選單可完全結束 App。
- `Ctrl + Shift + Space` 切換顯示／隱藏（若其他程式占用快捷鍵，請使用系統匣）。
- 設定內可調尺寸、不透明度、通知、提前提醒與開機啟動。開機啟動預設關閉，正式版可以自行開啟；請保持執行檔位置固定。
- 桌面通知需 Windows 允許通知；專注模式等系統設定可能影響彈出。App 不會更動系統通知或安全設定。
- 不同螢幕／縮放設定會自動限制視窗範圍。找不到卡片時，可從系統匣選「移回主螢幕右側」。

## 匯入格式

範本：`samples/我的每週行程.md`。支援 `.md`、`.txt`、`.csv`、`.tsv`、`.xlsx`、`.json`；純文字檔請儲存為 UTF-8。檔案上限 5 MB。Excel 讀取第一個工作表（上限 1000 列、50 欄）。

每週表格依序使用以下欄位，星期一到日各一列；一格內用分號分開多項安排：

| 星期 | 早上讀書 | 下午讀書 | 晚上讀書／安排 | 晚上住哪 | 電腦 | 衣服 |
| --- | --- | --- | --- | --- | --- | --- |
| 一 | 08:00–09:30 工數 | 16:20–17:35 工材 | 19:30–20:30 奈米材料；20:45–21:45 電路 | 基隆 | 留基隆 | 使用 1 份換洗 |

也可使用每個行程一列的 CSV／TSV／Excel，標題如下：

```csv
星期,開始,結束,事項,書本,備註
一,08:00,09:30,工數,工程數學第3章,完成習題1–10
三,,,上課,,時間待確認
```

JSON 備份保留行程、書本、備註與生活安排，可直接重新匯入。匯出的是每週行程，不含個人設定、專注進度和完成紀錄。截圖、PDF、ICS 目前不支援直接辨識。

若結束時間早於開始時間，視為跨午夜、到隔天結束。開始和結束相同會拒絕匯入。時間重疊會在預覽與每週行程中提示，仍可保留原安排。

## 資料保存

資料在 `%APPDATA%/EveningStudy/planner.json`，僅存本機，沒有帳號、雲端上傳或遠端內容。

全螢幕失敗時會在同一資料夾寫入 `diagnostics.log`，只記錄時間、版本及錯誤代碼，不含行程、歌名或帳號；不會自動上傳。

- 儲存採暫存檔後替換，另保留 `planner.json.bak`。
- 檔案毀損時嘗試使用上一份備份，並在手帳提示。
- 完成紀錄依「日期＋行程」保存，保留約 120 天；不會把本週打勾套到下週。
- 行程編輯與匯入保留一層復原。修改過的行程會清除對應舊完成紀錄。
- 全螢幕專注時間依本次開始時間累計，退出後結束這次計時。行程與原本拖曳的卡片大小不受影響。

## 開發與驗證

這是獨立 Electron 專案，不依賴上層的 Next.js／Android 專案，也沒有修改它們的原始檔。

原始碼：[lxuaneneliko/evening-study](https://github.com/lxuaneneliko/evening-study)。此儲存庫與發布附件皆為公開，可直接查看及下載。`package.json` 的 `private: true` 只防止誤發到 npm，不影響 GitHub 公開狀態。版本變更見 [CHANGELOG.md](CHANGELOG.md)。

```powershell
npm.cmd install
npm.cmd run setup:electron
npm.cmd test
npm.cmd run test:e2e
npm.cmd start
npm.cmd run dist
node tests/verify-package.cjs
```

`setup:electron` 使用 Electron 官方檢核碼驗證發行檔，以 JavaScript 解壓，不需原生 ZIP 擴充模組。建議 Node.js 22.12 以上；此版本在 Windows 以 Node.js 26 驗證。

- 核心測試：原始表格、格式、開始／結束邊界、跨日、跨週、完成日期、重疊、JSON 保存。
- 全螢幕單元測試：內容與載入事件順序、首幀空畫面、載入逾時、預載失敗、渲染中斷、重複進入／退出、缺少 Spotify、Esc 退出逾時。這些測試使用視窗與 DOM 替身，不等於實際 Windows 操作驗證。
- Electron 操作測試：兩張原生卡片、每週表格、CRUD、教材備註、匯入預覽／套用／復原、置頂、尺寸、LOCKED IN 全螢幕與 Esc 回復、Spotify 狀態及重啟保存。
- `node tests/locked.cjs --real-spotify` 會以本機 Spotify 實際驗證播放／暫停／續播。執行前需已有可控制的 Spotify 工作階段；若測試前為暫停，測試結束後會恢復暫停。
- 測試使用獨立暫存資料，不更動實際使用者排程；截圖在 `test-results/`。
- 渲染程序使用 sandbox、context isolation、CSP 與最小 IPC；匯入文字只作資料，不能執行指令或 HTML。
- 目前執行檔未申請開發者簽章；沒有自動更新服務。

Electron 桌面功能依 [BrowserWindow 官方文件](https://www.electronjs.org/docs/latest/api/browser-window)、[Tray 官方文件](https://www.electronjs.org/docs/latest/api/tray) 與 [app 官方文件](https://www.electronjs.org/docs/latest/api/app) 實作。

Spotify 控制使用 [Windows 系統媒體工作階段 API](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession.tryplayasync)。由內建 Windows PowerShell 呼叫系統公開 API，背景執行，不變更執行原則或系統安全設定，也不會把媒體按鍵發給其他播放器。
