# ICT 互動課件庫

> 使用 AI 助手維護本網站？請讓它先讀 [AGENTS.md](AGENTS.md)。所有改動記錄在 [CHANGELOG.md](CHANGELOG.md)。

網站：https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/

只存放 ICT 科的 HTML 互動課件。（數學課件在另一個倉庫 [Teacher](https://github.com/Johnathan-LH/Teacher)。）

## 同事上傳課件（不需要 GitHub 帳號）

1. 打開網站，按右上角「⬆ 上傳課件」。
2. 選年級、單元，填課題，選擇 HTML 檔案（上限 5MB），確認課件名稱。
3. 填上傳者姓名和教師密碼，按「上傳」。
4. 等 1–3 分鐘，重新整理網站便會看到新課件。

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

## 改網站設定

打開 `index.html`，在 `CONFIG` 裏可以改學校名稱、標題、Apps Script 網址（`API_URL`）和單元列表。
