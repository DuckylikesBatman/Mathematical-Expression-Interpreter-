"use strict";
// sql.js (SQLite compiled to WebAssembly) — runs entirely in the browser.
// Loaded via CDN in index.html before this file.

let _db = null;

// ── Schema ───────────────────────────────────────────────
//   programs : named, user-saved programs
//   runs     : every execution automatically logged
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS programs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL UNIQUE,
    code     TEXT    NOT NULL,
    saved_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS runs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT    NOT NULL,
    result     TEXT    NOT NULL DEFAULT '',
    var_count  INTEGER NOT NULL DEFAULT 0,
    had_errors INTEGER NOT NULL DEFAULT 0,
    ran_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

// ── Init (called once on page load) ──────────────────────
function dbInit() {
  return initSqlJs({
    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
  }).then(SQL => {
    _db = new SQL.Database();
    _db.run(SCHEMA);
    dbRefreshUI();
  }).catch(err => {
    console.error('sql.js failed to load:', err);
    const el = document.getElementById('dbStatus');
    if (el) el.textContent = 'Database unavailable (CDN load failed).';
  });
}

// ── Expose raw db instance (used by sql_evaluator.js) ────
function dbGetRaw() { return _db; }

// ── Log a run ─────────────────────────────────────────────
function dbLogRun(code, result, varCount, hadErrors) {
  if (!_db) return;
  _db.run(
    'INSERT INTO runs (code, result, var_count, had_errors) VALUES (?, ?, ?, ?)',
    [code, result || '', varCount, hadErrors ? 1 : 0]
  );
  _refreshRunHistory();
}

// ── Save / load / delete programs ────────────────────────
function dbSaveProgram(name, code) {
  if (!_db) return;
  if (!name.trim()) { alert('Enter a name for the program.'); return; }
  try {
    _db.run(
      'INSERT OR REPLACE INTO programs (name, code, saved_at) VALUES (?, ?, datetime(\'now\'))',
      [name.trim(), code]
    );
  } catch (e) {
    alert('Save failed: ' + e.message);
    return;
  }
  _refreshSavedPrograms();
}

function dbLoadProgram(id) {
  if (!_db) return;
  const res = _db.exec('SELECT code FROM programs WHERE id = ?', [id]);
  if (!res.length || !res[0].values.length) return;
  document.getElementById('code').value = res[0].values[0][0];
  run();
}

function dbDeleteProgram(id) {
  if (!_db) return;
  _db.run('DELETE FROM programs WHERE id = ?', [id]);
  _refreshSavedPrograms();
}


function _truncate(s, n) {
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── UI refresh ────────────────────────────────────────────
function dbRefreshUI() {
  _refreshSavedPrograms();
  _refreshRunHistory();
}

function _refreshSavedPrograms() {
  const el = document.getElementById('savedPrograms');
  if (!el || !_db) return;
  const res = _db.exec('SELECT id, name, saved_at FROM programs ORDER BY saved_at DESC');
  if (!res.length || !res[0].values.length) {
    el.innerHTML = '<em class="muted">No saved programs yet.</em>';
    return;
  }
  el.innerHTML = res[0].values.map(([id, name, ts]) =>
    `<div class="db-row">
      <span class="db-prog-name">${escHtml(name)}</span>
      <span class="db-ts">${escHtml(ts)}</span>
      <button class="db-btn" onclick="dbLoadProgram(${id})">Load</button>
      <button class="db-btn db-btn-del" onclick="dbDeleteProgram(${id})">Del</button>
    </div>`
  ).join('');
}

function _refreshRunHistory() {
  const el = document.getElementById('runHistory');
  if (!el || !_db) return;
  const res = _db.exec(
    'SELECT id, code, result, var_count, had_errors, ran_at FROM runs ORDER BY ran_at DESC LIMIT 20'
  );
  if (!res.length || !res[0].values.length) {
    el.innerHTML = '<em class="muted">No runs logged yet.</em>';
    return;
  }
  el.innerHTML = res[0].values.map(([id, code, result, vars, errs, ts]) =>
    `<div class="db-row">
      <span class="db-run-id">#${id}</span>
      <span class="db-code-preview">${escHtml(_truncate(code, 30))}</span>
      ${result ? `<span class="db-result-preview">${escHtml(_truncate(result, 28))}</span>` : ''}
      <span class="db-badge ${errs ? 'db-badge-err' : 'db-badge-ok'}">
        ${errs ? 'errors' : 'ok'}
      </span>
      <span class="db-badge db-badge-vars">${vars} var${vars !== 1 ? 's' : ''}</span>
      <span class="db-ts">${escHtml(ts)}</span>
    </div>`
  ).join('');
}
