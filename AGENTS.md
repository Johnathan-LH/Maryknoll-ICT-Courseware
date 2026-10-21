# AGENTS.md — 給 AI 助手的網站維護說明

本倉庫是 ICT 科的互動課件網站。任何 AI 助手（Claude、ChatGPT、Gemini、Copilot 等）在修改本倉庫前，請先讀完這份文件。
語言：網站內容和說明以繁體中文為主（香港用語）。

## 1. 網站架構

```
Google Sites 頁面
   └─ 「按網址嵌入」→ https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/   （本倉庫 index.html，GitHub Pages）
          ├─ 讀取：GET  Apps Script ?action=list  → 試算表「ICT課件清單」的 JSON
          └─ 上傳：POST Apps Script（text/plain JSON，檔案 base64）
                    → 驗證教師密碼 → GitHub Contents API 提交到本倉庫 → 寫入／更新試算表
```

- **課件清單的唯一資料來源是 Google 試算表**，不是資料夾結構。index.html 不會掃描倉庫。
- index.html 透過 Apps Script 讀取清單（不用「發佈到網路」CSV），因為 CSV 約 5 分鐘才更新，同事上傳後會以為失敗；讀取失敗時，頁面會顯示該瀏覽器上次快取的清單。
- GitHub Pages 從 `main` 分支根目錄發佈，推送後約 1–3 分鐘生效。

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
- 連續密碼錯誤 5 次（全站共用計數）會暫停上傳 15 分鐘；管理員可在編輯器執行 `unlockUploads()` 立即解除。執行 `checkToken()` 可檢查 token 是否有效及到期日。

## 2. 資料夾規則

```
F1/ … F6/              中一至中六課件
index.html             課件目錄頁 + 上傳表單（勿刪）
apps-script/Code.gs    Apps Script 程式碼副本
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
- 不要修改另一個倉庫 Johnathan-LH/Teacher。

## 4. 更新記錄（必須）

每次改動倉庫、試算表或 Apps Script 後，在 `CHANGELOG.md` **最上方**加一條記錄：

```
## YYYY-MM-DD
- 上架：中四「C 互聯網及其應用」課題「網絡」— 網絡拓撲（F4/網絡拓撲.html）
- 下架：…
- 修改：…
```

- 日期用香港時間；同一天的改動寫在同一個日期標題下。
- 經網站上傳的課件，GitHub commit 已記錄上傳者和課件名稱，不必每次補寫 CHANGELOG。
