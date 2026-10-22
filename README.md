# ICT 互動課件庫

> 使用 AI 助手維護本網站？請讓它先讀 [AGENTS.md](AGENTS.md)。所有改動記錄在 [CHANGELOG.md](CHANGELOG.md)。

網站：https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/

只存放 ICT 科的 HTML 互動課件。（數學課件在另一個倉庫 [Teacher](https://github.com/Johnathan-LH/Teacher)。）

## 同事上傳課件（不需要 GitHub 帳號）

1. 打開網站，按右上角「⬆ 上傳課件」。
2. 選年級、單元，填課題，選擇 HTML 檔案（上限 5MB）；課件名稱一律用檔案名稱（想用其他名稱，先在電腦把檔案改名）。
3. 輸入教師密碼（姓名可留空），按「上傳」。

簡介、標籤不在上傳表單內，需要時可直接在試算表補填。
4. 上傳後表單會自動等網站發佈完成（通常 1 分鐘內），再出現「打開課件」按鈕。

同名課件已存在時，系統會問「是否更新？」。選「是，更新」會取代舊檔案，並更新試算表原有那一行。

## 資料夾結構

```
F1/ … F6/              中一至中六課件（HTML）
index.html             課件目錄 + 上傳表單（Google Sites 嵌入這一頁）
apps-script/Code.gs    Apps Script 程式碼（不含 token 或密碼）
```

## 試算表欄名（第一行不要改）

年級 | 單元 | 課題 | 課件名稱 | 連結 | 簡介 | 標籤 | 上傳者 | 更新日期

- 中四至中六的「單元」用 DSE 課程：A 資訊處理、B 電腦系統基礎、C 互聯網及其應用、D 計算思維與程式編寫、E 資訊及通訊科技的社會影響、2A 數據庫、2B 網頁應用開發、2C 算法與程式編寫、2D 軟件開發。中一至中三可自由填寫。
- 只填了課題、未填課件名稱的行，會顯示為「課件準備中」。
- 「連結」只需填路徑，例如 `F4/網絡拓撲.html`；也可填完整網址（https://…）。
- 也可以直接在試算表手動加行，網站會即時讀到。

## 放在學校校網

index.html 是獨立的單一檔案，內含的網址都是完整網址，可以直接放在任何網站（例如學校校網），不需要改設定。課件檔案本身仍存放在本倉庫，由 GitHub Pages 提供。

## 改網站設定

打開 `index.html`，在 `CONFIG` 裏可以改學校名稱、標題、Apps Script 網址（`API_URL`）和單元列表。

## 管理員維護說明

相關連結：
- 網站：https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/
- 試算表「ICT課件清單」：https://docs.google.com/spreadsheets/d/1ZSUPRPEnqDmyp7HqULfLzuHEdcaYvLPVqKcAZr1v8io/edit
- Apps Script：試算表 → 擴充功能 → Apps Script（專案「ICT課件庫上傳系統」）

### 更改教師上傳密碼
1. Apps Script → 左邊齒輪「專案設定」→ 最底「指令碼屬性」。
2. 按 `UPLOAD_PASSWORD` 旁的編輯，改為新密碼 → 「儲存指令碼屬性」。即時生效，不用重新部署。
3. 通知同事新密碼。

### 更新或更換 GitHub token（例如 token 到期、懷疑外洩）
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → 「ICT課件庫上傳」→ **Regenerate token**（權限：只限 Maryknoll-ICT-Courseware，Contents 讀寫）。
2. 複製新 token，在 Apps Script「指令碼屬性」把 `GITHUB_TOKEN` 的值改為新 token → 儲存。不要把 token 貼到任何對話、電郵或檔案。
3. 在 Apps Script 編輯器選擇函式 `checkToken` → 執行，記錄會顯示「✅ token 有效」及到期日。

token 到期後，同事上傳時會看到「GitHub token 無效或已過期，請聯絡管理員更新 token」；網站瀏覽不受影響。建議在到期日前兩星期更換，並在月曆記下到期日。

### 其他
- **密碼錯誤太多次被鎖**：等 15 分鐘，或在 Apps Script 執行 `unlockUploads`。
- **修改 Apps Script 程式**：改完後「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本：新版本 → 部署」，網址不變；同時更新本倉庫 `apps-script/Code.gs`。
- **下架課件**：刪除試算表該行（或清空「課件名稱」），檔案保留在倉庫。
- **刪除課件檔案**：GitHub 進入檔案 → 「⋯」→ Delete file → Commit，再刪除試算表該行。
- **暫停整個網站**：Settings → Pages → Unpublish site（可再啟用）。
- **ICT 課件同步**：本倉庫與 Teacher 倉庫的 ICT 課件要保持一致，規則見 AGENTS.md 第 4 節。
