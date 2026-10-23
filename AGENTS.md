# AGENTS.md — 給 AI 助手的網站維護說明

本倉庫是 ICT 科的互動課件網站。任何 AI 助手（Codex、Claude、ChatGPT、Gemini、Copilot 等）在修改本倉庫前，請先讀完這份文件。
語言：網站內容和說明以繁體中文為主（香港用語）。

## 1. 網站架構

```
Google Sites 頁面
   └─ 「按網址嵌入」→ https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/   （本倉庫 index.html，GitHub Pages）
          ├─ 讀取：GET  Apps Script ?action=list  → 試算表「ICT課件清單」的 JSON
          ├─ 快速清單：GET 本網站 courses.json（Apps Script 自動更新）
          └─ 上傳／編輯／刪除：POST Apps Script（text/plain JSON，檔案 base64）
                    → 驗證教師密碼 → GitHub Contents API 提交到本倉庫 → 寫入／更新試算表 → 更新 courses.json
```

- **課件清單的唯一資料來源是 Google 試算表**，不是資料夾結構。index.html 不會掃描倉庫。
- 載入清單（快 → 準）：先顯示瀏覽器上次的清單 → 讀取網站上的 `courses.json`（約 0.5 秒）→ 背景向 Apps Script `?action=list` 讀取試算表最新內容（3–20 秒），有分別才更新畫面。
- `courses.json` 由 Apps Script `publishCatalog_()` 在每次上傳／編輯／刪除後自動寫入倉庫，**不要手動編輯**。在試算表手動改了資料，網頁的背景核對會顯示最新內容；如想 courses.json 也即時更新，在 Apps Script 執行 `publishCatalogNow()`。
- 上傳、編輯和刪除的回應都附帶最新清單（`courses`），網頁直接用來更新，不再額外讀取。上傳不再先另外檢查同名，由上傳請求本身回傳 `EXISTS`。
- GitHub Pages 從 `main` 分支根目錄發佈，推送後約 1–3 分鐘生效。
- index.html 也可以原封不動放在學校校網（所有網址均為完整網址）。在 iframe 內選檔受限時，表單的後備按鈕會開啟 GitHub Pages 上的同一頁（`?upload=1` 會自動打開上傳表單）。
- **教師模式**：學生預設只看到課件卡片的「開始學習」。橫幅上「上傳課件」旁的「教師模式」是實體按鈕（`#teacherKey`），按下輸入教師密碼，由 Apps Script 核對（POST `action: "verify"`；密碼不在網頁內），正確後才顯示「編輯」「刪除」按鈕，並在統計列顯示「🔓 教師模式 · 登出」。入口按鈕登入後改為「離開教師模式」，按下即可登出。登入狀態存於 sessionStorage（只限該分頁），編輯／刪除表單自動填入密碼。核對時，新版後端回傳 `ok`；第 3 版後端未有 verify，密碼正確時回傳 `BAD_INPUT`（未有上傳資料），前端兩者都當作正確。密碼錯誤同樣計入 5 次鎖定。「上傳課件」按鈕仍然對所有人顯示（上傳時一樣要密碼）。
- 上傳成功後，表單每 5 秒檢查 GitHub Pages 是否已發佈該檔案，發佈後才顯示「打開課件」；目錄頁的課件連結加上 `?v=更新日期`，避免瀏覽器沿用舊版或之前的 404。
- AI 網頁工具（例如 wouter 路由的 React 單頁程式）匯出的 HTML，只在網址為「/」時顯示主頁，放在子資料夾會顯示其內置的「404 Page Not Found」。上傳表單的 `fixSpaRouting()` 會自動把後備路由改為主頁；手動上架這類檔案時也要做同樣修正。
- 上傳表單只有：年級、單元、課題、HTML 檔案、課件名稱（一律取自所選 HTML 的檔案名稱，表單沒有名稱欄；要改名須先改檔名）、上傳者姓名（可留空，留空記為「未署名」）、教師密碼。簡介、標籤可用課件卡片的「✎ 編輯」補填，或直接在試算表填寫。

### Google 試算表

- 名稱：ICT課件清單（工作表「課件清單」）
- 編輯連結：https://docs.google.com/spreadsheets/d/1ZSUPRPEnqDmyp7HqULfLzuHEdcaYvLPVqKcAZr1v8io/edit
- Apps Script 專案：ICT課件庫上傳系統（試算表 → 擴充功能 → Apps Script）
- 網頁應用程式網址：https://script.google.com/macros/s/AKfycbx1dysUi686POjxx-5Y-1NMHP8oBo4QibSaLkWkj1ka6nHV3rZPrrhUGM_5dgO3vFkh/exec
- 第一行欄名固定，**不可更改**（Apps Script 按欄名找欄，次序可調但不建議）：

| 欄名 | 說明 |
|---|---|
| 年級 | `中一`–`中六` |
| 單元 | 中四至中六：`A 資訊處理`、`B 電腦系統基礎`、`C 互聯網及其應用`、`D 計算思維與程式編寫`、`E 資訊及通訊科技的社會影響`、`2A 數據庫`、`2B 網頁應用開發`、`2C 算法與程式編寫`、`2D 軟件開發`（格式「代號 空格 名稱」）。中一至中三自由填寫 |
| 課題 | 自由輸入 |
| 課件名稱 | 留空＝顯示「課件準備中」 |
| 連結 | 倉庫內路徑，例如 `F4/網絡拓撲.html`；也可填完整 https 網址 |
| 簡介 | 可留空 |
| 標籤 | 可留空；多個用逗號分隔 |
| 上傳者 | 上傳表單自動填寫 |
| 更新日期 | 上傳表單自動填寫（香港時間 `yyyy-MM-dd HH:mm`） |

### Apps Script（綁定上述試算表）

- 程式碼副本在 `apps-script/Code.gs`。**改程式後要同時更新這個檔案和 Apps Script 編輯器**，並「管理部署作業 → 編輯 → 新版本」重新部署（網址不變）。
- 指令碼屬性（Script Properties）：`GITHUB_TOKEN`、`UPLOAD_PASSWORD`。**絕不可把 token 或密碼寫入任何檔案、commit 或試算表。**
- 部署為網頁應用程式：執行身分「我」，存取權「任何人」。網址寫在 index.html 的 `CONFIG.API_URL`。
- 上傳規則：只接受 .html/.htm、5MB 以下；檔名＝課件名稱（保留中文，移除 `/ \ : * ? " < > | # % ..` 等）；路徑 `F{年級數字}/{課件名稱}.html`；同名時前端先問「是否更新？」，確認後帶 sha 覆蓋，並更新試算表中「連結」相同的那一行。
- 刪除：doPost `action: "delete"`（同一個教師密碼及錯誤鎖定），按 年級＋課題＋課件名稱＋連結 找出試算表那一行並刪除；連結是本倉庫 F1–F6 的檔案、且沒有其他行用到時，用 Contents API DELETE 刪除檔案。`?action=list` 回傳 `canDelete: true`，網頁才會顯示刪除按鈕。經網站刪除同步課件（ict-sync.tsv 內）時，Teacher 那份不會自動刪除。
- 編輯：doPost `action: "edit"`（同一個教師密碼），`original` 為原來的 年級／課題／課件名稱／連結。可改年級、單元、課題、課件名稱、簡介、標籤及（可選）更換 HTML。年級或課件名稱改變 → 檔案移到 `F{年級}/{課件名稱}.html`（新位置已有其他課件則拒絕），舊檔刪除；「上傳者」保留原值。`canEdit: true` 時網頁才顯示編輯按鈕。經網站編輯同步課件（ict-sync.tsv 內）後，要把變更同步到 Teacher 並更新 ict-sync.tsv。
- 連續密碼錯誤 5 次（全站共用計數）會暫停上傳 15 分鐘；管理員可在編輯器執行 `unlockUploads()` 立即解除。執行 `checkToken()` 可檢查 token 是否有效及到期日。

## 2. 資料夾規則

```
F1/ … F6/              中一至中六課件
index.html             課件目錄頁 + 上傳表單（勿刪）
apps-script/Code.gs    Apps Script 程式碼副本
ict-sync.tsv           ICT 課件與 Teacher 倉庫的檔案對照表
tools/check-ict-sync.sh  檢查兩邊 ICT 課件是否一致
AGENTS.md / CLAUDE.md / README.md / CHANGELOG.md
```

- 年級資料夾用 `F1`–`F6`，檔案名稱可以用中文。
- 課件必須是獨立可開啟的 HTML 檔案（外部資源只用 CDN）。

## 3. 常見工作

### 上架新課件
- 一般由教師用網站的「上傳課件」完成，系統自動提交並寫入試算表。
- AI 助手手動上架時：把 HTML 放到 `F{n}/`，推送到 `main`，在試算表加一行（課件名稱預設用 HTML 的 `<title>`），並記錄在 CHANGELOG。

### 下架課件
- 在試算表刪除該行（或清空「課件名稱」）。HTML 檔案可以保留。
- 只有教師明確要求時，才從倉庫刪除 HTML 檔案。

### 移動或改名 HTML
- 必須同步更新試算表「連結」欄。

### 修改網站外觀或設定
- 只改 `index.html`，設定集中在 `CONFIG`。
- 改完後保持：讀取清單、年級／單元篩選、搜尋、「課件準備中」、`fullUrl()` 路徑轉換、上傳表單（同名確認、進度、錯誤訊息、iframe 後備按鈕）正常。
- 不要只靠顏色區分資訊（課室投影及黑白列印）。

### 不要做的事
- 不要把課件清單寫死在 index.html 裏，也不要加入自動產生 index.html 的腳本或 GitHub Actions。
- 不要更改試算表第一行欄名。
- 只在同步 ICT 課件時改動 Johnathan-LH/Teacher 的 `ICT/`、試算表 ICT 行、AGENTS.md 及 CHANGELOG.md；不要改動其數學課件或 index.html。

## 4. ICT 課件同步（Teacher ⇄ Maryknoll-ICT-Courseware）

ICT 課件同時放在兩個網站，**內容必須保持一致**：
- 個人網站：https://github.com/Johnathan-LH/Teacher （`ICT/F1/`…`ICT/F6/`，試算表「課件清單」，科目＝ICT）
- 學校網站：https://github.com/Johnathan-LH/Maryknoll-ICT-Courseware （`F1/`…`F6/`，試算表「ICT課件清單」）

檔案對照表：Maryknoll-ICT-Courseware 倉庫的 `ict-sync.tsv`（兩邊檔名可以不同，以此表為準）。

**每次新增或修改任何一個 ICT 課件時（不論先改哪一邊）：**
1. 把同一份 HTML 寫到兩個倉庫的對應路徑，兩邊檔案必須完全相同。
2. 新課件：在 `ict-sync.tsv` 加一行；兩個試算表各加一行（Teacher 試算表：科目 ICT、年級、課題、課件名稱、連結、簡介、標籤；ICT課件清單：年級、單元、課題、課件名稱、連結、簡介、標籤、上傳者、更新日期）。
3. 改名或移動：同時更新兩邊檔案、兩個試算表的「連結」及 `ict-sync.tsv`。
4. 兩個倉庫的 `CHANGELOG.md` 都要記錄（註明「已同步」）。
5. 完成後在 Maryknoll-ICT-Courseware 倉庫執行 `bash tools/check-ict-sync.sh <Teacher 路徑> .`，全部顯示 ✓ 才算完成。
6. 下架或刪除只在教師明確要求時做，並問清楚是兩邊一起還是只處理一邊。

同事經學校網站「上傳課件」上載的檔案**不會自動**出現在 Teacher。維護時如果檢查腳本列出「Maryknoll 有、對照表沒有」的課件，先問教師是否要複製到 Teacher，不要自行加入。

## 5. 更新記錄（必須）

每次改動倉庫、試算表或 Apps Script 後，在 `CHANGELOG.md` **最上方**加一條記錄：

```
## YYYY-MM-DD
- 上架：中四「C 互聯網及其應用」課題「網絡」— 網絡拓撲（F4/網絡拓撲.html）
- 下架：…
- 修改：…
```

- 日期用香港時間；同一天的改動寫在同一個日期標題下。
- 經網站上傳的課件，GitHub commit 已記錄上傳者和課件名稱，不必每次補寫 CHANGELOG。

## 6. 交接須知（給接手的 AI 助手，例如 Codex）

### AI 助手可以自己做
- 修改本倉庫任何檔案（index.html、apps-script/Code.gs、課件 HTML、文件），提交並推送到 `main`；GitHub Pages 約 1 分鐘後生效。
- 讀取課件清單：`GET <網頁應用程式網址>?action=list`（不需要密碼）。
- 同步 Teacher 倉庫的 ICT 課件（見第 4 節）及執行 `tools/check-ict-sync.sh`。

### 必須交給教師（Johnathan）親手做，AI 助手不可代勞
- **重新部署 Apps Script**：改了 `apps-script/Code.gs` 後，教師要把整個檔案貼到 Apps Script 編輯器 → 儲存 → 「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本：新版本 → 部署」。網址不變。未部署前，網站仍用舊版後端。改 Code.gs 後要在回覆中明確提醒教師做這一步。
- 部署前先問教師確認。
- GitHub token、教師密碼（Script Properties）、任何登入或 Google 授權畫面。**絕不可要求教師把 token 或密碼貼到對話中。**
- 直接編輯 Google 試算表（除非 AI 助手有教師授權的 Google Sheets 工具）。沒有的話，請教師在試算表手動改，或改用網站的編輯功能。

### 新增後端功能的做法（向後兼容）
- 前端用 `?action=list` 回傳的旗標（例如 `canDelete`、`canEdit`）決定是否顯示新按鈕；舊版後端未部署時按鈕自動隱藏，網站不會壞。新增功能時沿用這個做法，並同時在 `publishCatalog_()` 寫入 courses.json 的旗標。

### 修改後如何測試
- 前端：用 Playwright 開啟 index.html 的副本，把 `CONFIG.API_URL` 換成假網址並攔截請求回傳假資料，測試清單、上傳、編輯、刪除流程。
- Apps Script：可用 Node 的 `vm` 執行 Code.gs，以假的 SpreadsheetApp／UrlFetchApp 模擬試算表及 GitHub。
- **不要用真正的教師密碼做測試上傳**；需要實測時請教師親自操作。

### 目前狀態（2026-10-23）
- Apps Script 已部署第 3 版（上傳、編輯、刪除、courses.json 自動更新）。
- 同步中的課件：中一兩個、中五「DSE 算法追蹤室」（見 ict-sync.tsv）。其餘課件由同事經網站上傳，只在本倉庫。
