"use strict";
// Depends on: turtle (turtle.js)

let db             = null;
let currentSession = null;

// Keyboard moves are batched to avoid excessive SQL writes
let pendingMoves = [];
let batchTimer   = null;
const BATCH_LIMIT = 8;
const BATCH_WAIT  = 1500; // ms

// ── Init ─────────────────────────────────────────────────
initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` })
  .then(SQL => {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time  TEXT NOT NULL,
        end_time    TEXT,
        total_moves INTEGER DEFAULT 0
      );
      CREATE TABLE moves (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        action     TEXT    NOT NULL,
        value      REAL,
        x          REAL    NOT NULL,
        y          REAL    NOT NULL,
        angle      REAL    NOT NULL,
        pen        INTEGER NOT NULL,
        time       TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

// ── Session management ───────────────────────────────────
function startSession() {
  if (!db) return;
  db.run("INSERT INTO sessions (start_time) VALUES (datetime('now'))");
  currentSession = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
}

function endSession(totalMoves) {
  if (!db || !currentSession) return;
  flushMoves();
  db.run(
    "UPDATE sessions SET end_time=datetime('now'), total_moves=? WHERE id=?",
    [totalMoves, currentSession]
  );
}

// ── Save a single move ───────────────────────────────────
function saveMove(cmd, val, fromKeyboard) {
  if (!db) return;
  const row = [currentSession, cmd, val ?? null, turtle.x, turtle.y, turtle.angle, turtle.penDown ? 1 : 0];

  if (fromKeyboard) {
    // Batch keyboard moves – flush after pause or batch fills
    pendingMoves.push(row);
    clearTimeout(batchTimer);
    if (pendingMoves.length >= BATCH_LIMIT) flushMoves();
    else batchTimer = setTimeout(flushMoves, BATCH_WAIT);
  } else {
    // Interpreter moves saved immediately
    _insertMove(row);
  }
}

function flushMoves() {
  if (!db || !pendingMoves.length) return;
  clearTimeout(batchTimer);
  for (const row of pendingMoves) _insertMove(row);
  pendingMoves = [];
}

function _insertMove(row) {
  db.run(
    `INSERT INTO moves (session_id,action,value,x,y,angle,pen) VALUES (?,?,?,?,?,?,?)`,
    row
  );
}

// ── Query helper (used by SQL panel) ────────────────────
function runQuery(sql) {
  if (!db) throw new Error('Database not ready yet');
  return db.exec(sql);
}
