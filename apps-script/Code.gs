/**
 * ICT 互動課件庫 — Apps Script（綁定 Google 試算表「ICT課件清單」）
 *
 * doGet  ?action=list                    回傳課件清單 JSON（index.html 用來顯示目錄）
 * doGet  ?action=exists&grade=&title=    檢查同名課件是否已存在
 * doPost （text/plain JSON）              驗證教師密碼 → 檢查檔案 → 提交到 GitHub → 寫入／更新試算表
 *
 * ⚠️ 本檔案不含任何 token 或密碼。以下兩項存放在「專案設定 → 指令碼屬性（Script Properties）」：
 *    GITHUB_TOKEN      GitHub fine-grained token（只授權 Maryknoll-ICT-Courseware 的 Contents 讀寫）
 *    UPLOAD_PASSWORD   教師上傳密碼
 *
 * 部署：部署 → 新增部署作業 → 網頁應用程式；執行身分「我」；存取權「任何人」。
 * 修改程式後：部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署（網址不變）。
 */

const CFG = {
  OWNER: 'Johnathan-LH',
  REPO: 'Maryknoll-ICT-Courseware',
  BRANCH: 'main',
  PAGES_BASE: 'https://johnathan-lh.github.io/Maryknoll-ICT-Courseware/',
  SHEET_NAME: '課件清單',
  HEADERS: ['年級', '單元', '課題', '課件名稱', '連結', '簡介', '標籤', '上傳者', '更新日期'],
  GRADES: ['中一', '中二', '中三', '中四', '中五', '中六'],
  MAX_BYTES: 5 * 1024 * 1024,          // 5MB
  MAX_FAILS: 5,                        // 連續密碼錯誤次數上限
  LOCK_SECONDS: 15 * 60,               // 暫停 15 分鐘
  TZ: 'Asia/Hong_Kong'
};

/* ============================================================
   GET
   ============================================================ */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'list';
    if (action === 'list') return json_({ ok: true, canDelete: true, canEdit: true, courses: readCourses_() });
    if (action === 'exists') {
      const grade = String(p.grade || '');
      const title = safeName_(p.title);
      if (CFG.GRADES.indexOf(grade) < 0 || !title) return json_({ ok: false, code: 'BAD_INPUT', message: '年級或課件名稱不正確。' });
      const path = pathFor_(grade, title);
      const row = findRowByLink_(path);
      const onGithub = !!githubSha_(path);
      return json_({ ok: true, exists: onGithub || !!row, path: path, uploader: row ? row.uploader : '' });
    }
    return json_({ ok: false, code: 'BAD_ACTION', message: '未知的操作。' });
  } catch (err) {
    return json_({ ok: false, code: 'SERVER', message: '伺服器錯誤：' + err.message });
  }
}

/* ============================================================
   POST（上傳）
   ============================================================ */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    let d;
    try { d = JSON.parse(e.postData.contents); }
    catch (x) { return json_({ ok: false, code: 'BAD_JSON', message: '資料格式錯誤，請重新整理網頁再試。' }); }

    // 1. 密碼（含連續錯誤鎖定）
    const locked = lockRemaining_();
    if (locked > 0) return json_({ ok: false, code: 'LOCKED', message: '密碼錯誤次數過多，上傳功能暫停中，請約 ' + Math.ceil(locked / 60) + ' 分鐘後再試。' });
    const props = PropertiesService.getScriptProperties();
    const realPw = props.getProperty('UPLOAD_PASSWORD');
    const token = props.getProperty('GITHUB_TOKEN');
    if (!realPw || !token) return json_({ ok: false, code: 'NOT_SET', message: '系統未設定完成（缺少密碼或 GitHub token），請聯絡管理員。' });
    if (String(d.password || '') !== realPw) {
      const left = recordFail_();
      return json_({ ok: false, code: 'BAD_PASSWORD', message: left > 0 ? '教師密碼不正確（尚餘 ' + left + ' 次機會）。' : '密碼錯誤次數過多，上傳功能暫停 15 分鐘。' });
    }
    clearFails_();

    // 教師模式登入：只核對密碼
    if (d.action === 'verify') return json_({ ok: true });

    // 刪除課件（同一個教師密碼）
    if (d.action === 'delete') {
      if (!lock.tryLock(30000)) return json_({ ok: false, code: 'BUSY', message: '系統忙碌中，請稍後再試。' });
      return deleteCourse_(d, token);
    }

    // 編輯課件（同一個教師密碼）
    if (d.action === 'edit') {
      if (!lock.tryLock(30000)) return json_({ ok: false, code: 'BUSY', message: '系統忙碌中，請稍後再試。' });
      return editCourse_(d, token);
    }

    // 2. 欄位
    const grade = String(d.grade || '').trim();
    const unit = clean_(d.unit, 60);
    const topic = clean_(d.topic, 60);
    const titleRaw = clean_(d.title, 80);
    const title = safeName_(titleRaw);
    const desc = clean_(d.desc, 300);
    const tags = clean_(d.tags, 120);
    const uploader = clean_(d.uploader, 40);
    const filename = String(d.filename || '');
    if (CFG.GRADES.indexOf(grade) < 0) return bad_('請選擇年級。');
    if (!unit) return bad_('請填寫單元。');
    if (!topic) return bad_('請填寫課題。');
    if (!title) return bad_('課件名稱不可留空，亦不可只有符號。');
    if (!uploader) return bad_('請填寫上傳者姓名。');

    // 3. 檔案
    if (!/\.html?$/i.test(filename)) return bad_('只接受 .html 或 .htm 檔案。');
    const b64 = String(d.content || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
    if (!b64) return bad_('沒有收到檔案內容。');
    let bytes;
    try { bytes = Utilities.base64Decode(b64); } catch (x) { return bad_('檔案內容無法解讀，請重新選擇檔案。'); }
    if (bytes.length === 0) return bad_('檔案是空白的。');
    if (bytes.length > CFG.MAX_BYTES) return bad_('檔案太大（' + (bytes.length / 1048576).toFixed(1) + 'MB），上限為 5MB。');
    const head = Utilities.newBlob(bytes.slice(0, 4096)).getDataAsString('UTF-8').toLowerCase();
    if (head.indexOf('<') < 0) return bad_('這個檔案看來不是 HTML 網頁。');

    // 4. GitHub（同一時間只處理一個上傳，避免 sha 衝突）
    if (!lock.tryLock(30000)) return json_({ ok: false, code: 'BUSY', message: '系統忙碌中，請稍後再試。' });
    const path = pathFor_(grade, title);
    const sha = githubSha_(path, token);
    const row = findRowByLink_(path);
    if ((sha || row) && d.overwrite !== true) {
      return json_({ ok: false, code: 'EXISTS', path: path, uploader: row ? row.uploader : '', message: '同名課件已存在。' });
    }
    const verb = sha ? '更新' : '上傳';
    const message = verb + '：' + grade + '「' + titleRaw + '」（上傳者：' + uploader + '）';
    const body = { message: message, content: Utilities.base64Encode(bytes), branch: CFG.BRANCH };
    if (sha) body.sha = sha;
    const res = UrlFetchApp.fetch(apiUrl_(path), {
      method: 'put', contentType: 'application/json', payload: JSON.stringify(body),
      headers: ghHeaders_(token), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200 && code !== 201) return json_({ ok: false, code: 'GITHUB_' + code, message: githubError_(code) });

    // 5. 試算表（有同一連結的行就更新，否則新增）
    const values = {
      '年級': grade, '單元': unit, '課題': topic, '課件名稱': titleRaw, '連結': path,
      '簡介': desc, '標籤': tags, '上傳者': uploader,
      '更新日期': Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm')
    };
    writeRow_(values, row ? row.rowIndex : 0);
    const courses = publishCatalog_(token);

    return json_({ ok: true, updated: !!sha || !!row, path: path, url: CFG.PAGES_BASE + encPath_(path), courses: courses });
  } catch (err) {
    return json_({ ok: false, code: 'SERVER', message: '伺服器錯誤：' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ============================================================
   試算表
   ============================================================ */
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CFG.SHEET_NAME) || ss.getSheets()[0];
}

function headerIndex_(sh) {
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  CFG.HEADERS.forEach(function (h) { idx[h] = head.indexOf(h); });
  if (idx['年級'] < 0 || idx['課件名稱'] < 0 || idx['連結'] < 0) throw new Error('試算表第一行欄名不符');
  return idx;
}

function readCourses_() {
  const sh = sheet_();
  const idx = headerIndex_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
  const g = function (r, h) { return idx[h] >= 0 ? String(r[idx[h]] || '').trim() : ''; };
  return rows.map(function (r) {
    return {
      grade: g(r, '年級'), unit: g(r, '單元'), topic: g(r, '課題'), title: g(r, '課件名稱'),
      link: g(r, '連結'), desc: g(r, '簡介'), tags: g(r, '標籤'), uploader: g(r, '上傳者'), updated: g(r, '更新日期')
    };
  }).filter(function (c) { return c.grade && (c.title || c.topic); });
}

function normLink_(s) {
  s = String(s || '').trim();
  if (s.indexOf(CFG.PAGES_BASE) === 0) s = s.slice(CFG.PAGES_BASE.length);
  try { s = decodeURIComponent(s); } catch (x) {}
  return s.replace(/^\.?\//, '');
}

function findRowByLink_(path) {
  const sh = sheet_();
  const idx = headerIndex_(sh);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
  const want = normLink_(path).toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (normLink_(rows[i][idx['連結']]).toLowerCase() === want) {
      return { rowIndex: i + 2, uploader: idx['上傳者'] >= 0 ? rows[i][idx['上傳者']] : '' };
    }
  }
  return null;
}

function writeRow_(values, rowIndex) {
  const sh = sheet_();
  const idx = headerIndex_(sh);
  const width = sh.getLastColumn();
  const target = rowIndex || sh.getLastRow() + 1;
  const current = rowIndex ? sh.getRange(target, 1, 1, width).getValues()[0] : new Array(width).fill('');
  CFG.HEADERS.forEach(function (h) {
    if (idx[h] >= 0) current[idx[h]] = noFormula_(values[h]);
  });
  const range = sh.getRange(target, 1, 1, width);
  range.setNumberFormat('@');            // 純文字，避免日期、數字被自動轉換
  range.setValues([current]);
}

/**
 * 刪除課件：在試算表找出 年級＋課題＋課件名稱＋連結 都相同的那一行並刪除；
 * 連結是本倉庫的 F1–F6 檔案、而且沒有其他行用到它，就一併從 GitHub 刪除檔案。
 */
function deleteCourse_(d, token) {
  const sh = sheet_();
  const idx = headerIndex_(sh);
  const last = sh.getLastRow();
  const notFound = json_({ ok: false, code: 'NOT_FOUND', message: '找不到這個課件，可能已被刪除。請重新整理網頁。' });
  if (last < 2) return notFound;
  const rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
  const g = function (r, h) { return idx[h] >= 0 ? String(r[idx[h]] || '').trim() : ''; };
  const want = {
    grade: String(d.grade || '').trim(), topic: String(d.topic || '').trim(),
    title: String(d.title || '').trim(), link: normLink_(d.link)
  };
  let hit = -1;
  for (let i = 0; i < rows.length; i++) {
    if (g(rows[i], '年級') === want.grade && g(rows[i], '課題') === want.topic &&
        g(rows[i], '課件名稱') === want.title && normLink_(g(rows[i], '連結')) === want.link) { hit = i; break; }
  }
  if (hit < 0) return notFound;

  let fileDeleted = false;
  const link = want.link;
  if (link && !/^https?:\/\//i.test(link) && /^F[1-6]\/[^\/]+\.html?$/i.test(link)) {
    const usedElsewhere = rows.some(function (r, i) { return i !== hit && normLink_(g(r, '連結')).toLowerCase() === link.toLowerCase(); });
    if (!usedElsewhere) {
      const sha = githubSha_(link, token);
      if (sha) {
        const who = clean_(d.uploader, 40) || '未署名';
        const res = UrlFetchApp.fetch(apiUrl_(link), {
          method: 'delete', contentType: 'application/json', headers: ghHeaders_(token), muteHttpExceptions: true,
          payload: JSON.stringify({ message: '刪除：' + want.grade + '「' + (want.title || want.topic) + '」（操作者：' + who + '）', sha: sha, branch: CFG.BRANCH })
        });
        const code = res.getResponseCode();
        if (code !== 200) return json_({ ok: false, code: 'GITHUB_' + code, message: githubError_(code) });
        fileDeleted = true;
      }
    }
  }
  sh.deleteRow(hit + 2);
  const courses = publishCatalog_(token);
  return json_({ ok: true, fileDeleted: fileDeleted, title: want.title || want.topic, courses: courses });
}

/**
 * 編輯課件：按原來的 年級＋課題＋課件名稱＋連結 找出那一行，改為新資料。
 * - 可改：年級、單元、課題、課件名稱、簡介、標籤；可選擇上載新 HTML 取代原檔。
 * - 年級或課件名稱改變 → 檔案移到新路徑（F{年級}/{課件名稱}.html），舊檔案刪除，網址隨之改變。
 * - 「上傳者」保留原來的人；「更新日期」改為現在。
 */
function editCourse_(d, token) {
  const sh = sheet_();
  const idx = headerIndex_(sh);
  const last = sh.getLastRow();
  const notFound = json_({ ok: false, code: 'NOT_FOUND', message: '找不到這個課件，可能已被修改或刪除。請重新整理網頁。' });
  if (last < 2) return notFound;
  const rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
  const g = function (r, h) { return idx[h] >= 0 ? String(r[idx[h]] || '').trim() : ''; };
  const o = d.original || {};
  const was = { grade: String(o.grade || '').trim(), topic: String(o.topic || '').trim(), title: String(o.title || '').trim(), link: normLink_(o.link) };
  let hit = -1;
  for (let i = 0; i < rows.length; i++) {
    if (g(rows[i], '年級') === was.grade && g(rows[i], '課題') === was.topic &&
        g(rows[i], '課件名稱') === was.title && normLink_(g(rows[i], '連結')) === was.link) { hit = i; break; }
  }
  if (hit < 0) return notFound;

  // 新資料
  const grade = String(d.grade || '').trim();
  const unit = clean_(d.unit, 60);
  const topic = clean_(d.topic, 60);
  const titleRaw = clean_(d.title, 80);
  const title = safeName_(titleRaw);
  const who = clean_(d.uploader, 40) || '未署名';
  if (CFG.GRADES.indexOf(grade) < 0) return bad_('請選擇年級。');
  if (!unit) return bad_('請填寫單元。');
  if (!topic) return bad_('請填寫課題。');

  // 新檔案（可選）
  let bytes = null;
  const hasFile = !!d.content;
  if (hasFile) {
    if (!/\.html?$/i.test(String(d.filename || ''))) return bad_('只接受 .html 或 .htm 檔案。');
    try { bytes = Utilities.base64Decode(String(d.content).replace(/^data:[^,]*,/, '').replace(/\s/g, '')); }
    catch (x) { return bad_('檔案內容無法解讀，請重新選擇檔案。'); }
    if (bytes.length === 0) return bad_('檔案是空白的。');
    if (bytes.length > CFG.MAX_BYTES) return bad_('檔案太大（' + (bytes.length / 1048576).toFixed(1) + 'MB），上限為 5MB。');
  }

  const oldLink = was.link;
  const isRepo = function (l) { return /^F[1-6]\/[^\/]+\.html?$/i.test(l); };
  const usedByOther = function (l) {
    return rows.some(function (r, i) { return i !== hit && normLink_(g(r, '連結')).toLowerCase() === l.toLowerCase(); });
  };
  let newLink = oldLink, moved = false;

  if (/^https?:\/\//i.test(oldLink)) {
    if (hasFile) return bad_('這個課件連結到其他網站，不能在這裏更換檔案。');
  } else if (isRepo(oldLink) || hasFile) {
    if (!title) return bad_('課件名稱不可留空，亦不可只有符號。');
    newLink = pathFor_(grade, title);
    const samePath = newLink === oldLink;
    if (!samePath && (usedByOther(newLink) || githubSha_(newLink, token))) {
      return json_({ ok: false, code: 'EXISTS', message: '「' + newLink + '」已經有另一個課件，請改用其他課件名稱。' });
    }
    const oldSha = oldLink ? githubSha_(oldLink, token) : '';
    if (!bytes && !samePath && oldSha) bytes = githubBlob_(oldSha, token);    // 只是移動：沿用原檔內容
    if (bytes) {
      const note = (hasFile ? '更換檔案' : '') + (!samePath && oldLink ? (hasFile ? '及' : '') + '移至 ' + newLink : '');
      const body = {
        message: '編輯：' + grade + '「' + titleRaw + '」' + (note ? '（' + note + '）' : '') + '（操作者：' + who + '）',
        content: Utilities.base64Encode(bytes), branch: CFG.BRANCH
      };
      if (samePath && oldSha) body.sha = oldSha;
      const res = UrlFetchApp.fetch(apiUrl_(newLink), { method: 'put', contentType: 'application/json', payload: JSON.stringify(body), headers: ghHeaders_(token), muteHttpExceptions: true });
      const code = res.getResponseCode();
      if (code !== 200 && code !== 201) return json_({ ok: false, code: 'GITHUB_' + code, message: githubError_(code) });
    }
    if (!samePath && oldSha && !usedByOther(oldLink)) {
      const res = UrlFetchApp.fetch(apiUrl_(oldLink), {
        method: 'delete', contentType: 'application/json', headers: ghHeaders_(token), muteHttpExceptions: true,
        payload: JSON.stringify({ message: '編輯：移除舊位置 ' + oldLink + '（已移至 ' + newLink + '）', sha: oldSha, branch: CFG.BRANCH })
      });
      if (res.getResponseCode() !== 200) console.warn('舊檔案未能刪除：' + oldLink);
      moved = true;
    }
  }
  if (newLink && !titleRaw) return bad_('課件名稱不可留空。');

  writeRow_({
    '年級': grade, '單元': unit, '課題': topic, '課件名稱': titleRaw, '連結': newLink,
    '簡介': clean_(d.desc, 300), '標籤': clean_(d.tags, 120), '上傳者': g(rows[hit], '上傳者'),
    '更新日期': Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm')
  }, hit + 2);
  const courses = publishCatalog_(token);
  return json_({
    ok: true, moved: moved, replaced: hasFile, title: titleRaw || topic,
    url: newLink && !/^https?:/i.test(newLink) ? CFG.PAGES_BASE + encPath_(newLink) : newLink, courses: courses
  });
}

/** 讀取 GitHub 上的檔案內容（blob，支援 1MB 以上的檔案） */
function githubBlob_(sha, token) {
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + CFG.OWNER + '/' + CFG.REPO + '/git/blobs/' + sha,
    { headers: ghHeaders_(token), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error(githubError_(res.getResponseCode()));
  return Utilities.base64Decode(String(JSON.parse(res.getContentText()).content || '').replace(/\s/g, ''));
}

/**
 * 把最新課件清單存成網站上的 courses.json（GitHub Pages 讀取約 0.5 秒，比經 Apps Script 快很多）。
 * 失敗不影響上傳／刪除；網頁仍會在背景向 Apps Script 核對最新清單。回傳清單供網頁即時更新。
 */
function publishCatalog_(token) {
  const courses = readCourses_();
  try {
    const path = 'courses.json';
    const content = JSON.stringify({ ok: true, canDelete: true, canEdit: true, generated: Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), courses: courses }, null, 1);
    const body = { message: '更新課件清單 courses.json（自動）', content: Utilities.base64Encode(content, Utilities.Charset.UTF_8), branch: CFG.BRANCH };
    const sha = githubSha_(path, token);
    if (sha) body.sha = sha;
    UrlFetchApp.fetch(apiUrl_(path), { method: 'put', contentType: 'application/json', payload: JSON.stringify(body), headers: ghHeaders_(token), muteHttpExceptions: true });
  } catch (err) {
    console.warn('courses.json 未能更新：' + err.message);
  }
  return courses;
}

/** 管理員工具：手動在試算表改了資料後，可執行這個函式立即更新網站上的 courses.json */
function publishCatalogNow() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const n = publishCatalog_(token).length;
  Logger.log('✅ 已更新 courses.json（' + n + ' 個項目）');
}

/* ============================================================
   GitHub
   ============================================================ */
function ghHeaders_(token) {
  return { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}
function encPath_(path) { return path.split('/').map(encodeURIComponent).join('/'); }
function apiUrl_(path) { return 'https://api.github.com/repos/' + CFG.OWNER + '/' + CFG.REPO + '/contents/' + encPath_(path); }

/** 回傳檔案的 sha；不存在則回傳空字串 */
function githubSha_(path, token) {
  token = token || PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('未設定 GITHUB_TOKEN');
  const res = UrlFetchApp.fetch(apiUrl_(path) + '?ref=' + CFG.BRANCH, { headers: ghHeaders_(token), muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code === 404) return '';
  if (code !== 200) throw new Error(githubError_(code));
  return JSON.parse(res.getContentText()).sha || '';
}

function githubError_(code) {
  if (code === 401) return 'GitHub token 無效或已過期，請聯絡管理員更新 token。';
  if (code === 403) return 'GitHub 拒絕存取（token 權限不足或已達使用上限），請聯絡管理員。';
  if (code === 404) return '找不到 GitHub 倉庫，或 token 沒有此倉庫的權限，請聯絡管理員。';
  if (code === 409) return '檔案剛被其他人更新，請重新上傳一次。';
  if (code === 422) return 'GitHub 不接受這個檔案（可能檔名或內容有問題）。';
  return 'GitHub 發生錯誤（代碼 ' + code + '），請稍後再試。';
}

/* ============================================================
   密碼錯誤鎖定（CacheService；全站共用計數）
   ============================================================ */
function lockRemaining_() {
  const until = Number(CacheService.getScriptCache().get('lockUntil') || 0);
  return Math.max(0, Math.round((until - Date.now()) / 1000));
}
function recordFail_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('pwFails') || 0) + 1;
  if (n >= CFG.MAX_FAILS) {
    cache.put('lockUntil', String(Date.now() + CFG.LOCK_SECONDS * 1000), CFG.LOCK_SECONDS);
    cache.remove('pwFails');
    return 0;
  }
  cache.put('pwFails', String(n), CFG.LOCK_SECONDS);
  return CFG.MAX_FAILS - n;
}
function clearFails_() { CacheService.getScriptCache().remove('pwFails'); }

/* ============================================================
   工具
   ============================================================ */
function gradeFolder_(grade) { return 'F' + (CFG.GRADES.indexOf(grade) + 1); }
function pathFor_(grade, safeTitle) { return gradeFolder_(grade) + '/' + safeTitle + '.html'; }

/** 檔名：保留中文，移除 / \ : * ? " < > | 、控制字元及 ".." 等危險字元 */
function safeName_(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\/\\:*?"<>|#%{}^~\[\]`]/g, '')
    .replace(/\.{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80);
}

function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
/** 避免試算表把 = + - @ 開頭的文字當成公式 */
function noFormula_(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function bad_(msg) { return json_({ ok: false, code: 'BAD_INPUT', message: msg }); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/* ============================================================
   管理員工具：在編輯器選擇函式後按「執行」
   ============================================================ */
/** 檢查 token 是否有效（只顯示結果，不會顯示 token） */
function checkToken() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('❌ 未設定 GITHUB_TOKEN'); return; }
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + CFG.OWNER + '/' + CFG.REPO, { headers: ghHeaders_(token), muteHttpExceptions: true });
  const code = res.getResponseCode();
  Logger.log(code === 200 ? '✅ token 有效，可存取 ' + CFG.REPO : '❌ ' + githubError_(code));
  const exp = res.getHeaders()['github-authentication-token-expiration'];
  if (exp) Logger.log('token 到期時間：' + exp);
}

/** 解除密碼錯誤鎖定 */
function unlockUploads() {
  const cache = CacheService.getScriptCache();
  cache.remove('pwFails'); cache.remove('lockUntil');
  Logger.log('✅ 已解除鎖定');
}
