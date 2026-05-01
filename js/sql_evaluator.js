"use strict";
// Depends on: sql_lexer.js, sql_parser.js, database.js (dbGetRaw), main.js (escHtml)

// Column definitions for each known table
const TABLE_SCHEMA = {
  runs:     ['id', 'code', 'result', 'var_count', 'had_errors', 'ran_at'],
  programs: ['id', 'name', 'code', 'saved_at'],
};

// ── Evaluator ─────────────────────────────────────────────
class SqlEvaluator {
  constructor(db) { this._db = db; }

  _fetchTable(name) {
    if (!TABLE_SCHEMA[name])
      throw new SqlError(`Unknown table '${name}'. Available: ${Object.keys(TABLE_SCHEMA).join(', ')}`);
    const res  = this._db.exec(`SELECT * FROM ${name}`);
    const cols = TABLE_SCHEMA[name];
    if (!res.length) return { cols, rows: [] };
    const rows = res[0].values.map(r => {
      const obj = {};
      res[0].columns.forEach((c, i) => { obj[c] = r[i]; });
      return obj;
    });
    return { cols: res[0].columns, rows };
  }

  _match(row, node) {
    if (node.type === 'SqlAnd') return this._match(row, node.left) && this._match(row, node.right);
    const rowVal = row[node.col];
    if (rowVal === undefined) throw new SqlError(`Unknown column '${node.col}'`);
    const v = node.val;
    switch (node.op) {
      case '=':  return String(rowVal) === String(v) || rowVal == v;
      case '!=': return String(rowVal) !== String(v) && rowVal != v;
      case '>':  return Number(rowVal) >  Number(v);
      case '<':  return Number(rowVal) <  Number(v);
      case '>=': return Number(rowVal) >= Number(v);
      case '<=': return Number(rowVal) <= Number(v);
    }
    return false;
  }

  eval(ast) {
    let { cols: allCols, rows } = this._fetchTable(ast.from);

    if (ast.where)   rows = rows.filter(r => this._match(r, ast.where));

    if (ast.orderBy) {
      const { col, dir } = ast.orderBy;
      rows.sort((a, b) => {
        const av = a[col], bv = b[col];
        const cmp = isNaN(Number(av))
          ? String(av).localeCompare(String(bv))
          : Number(av) - Number(bv);
        return dir === 'DESC' ? -cmp : cmp;
      });
    }

    if (ast.limit !== null) rows = rows.slice(0, ast.limit);

    const outCols = ast.cols[0] === '*' ? allCols : ast.cols;
    outCols.forEach(c => {
      if (!allCols.includes(c))
        throw new SqlError(`Unknown column '${c}' in table '${ast.from}'`);
    });

    return {
      columns: outCols,
      rows: rows.map(r => outCols.map(c => r[c] !== undefined ? r[c] : null)),
    };
  }
}

// ── UI helpers ────────────────────────────────────────────
function _sqlTokClass(type) {
  const KW = ['SELECT','FROM','WHERE','ORDER','BY','ASC','DESC','LIMIT','AND','OR'];
  if (KW.includes(type))  return 'tok-sql-keyword';
  if (type === 'IDENT')   return 'tok-sql-ident';
  if (type === 'NUMBER')  return 'tok-sql-number';
  if (type === 'STRING')  return 'tok-sql-string';
  if (type === 'STAR')    return 'tok-sql-star';
  if (type === 'COMMA')   return 'tok-sql-punct';
  return 'tok-sql-op';
}

function _renderSqlTokens(tokens) {
  return tokens
    .filter(t => t.type !== SQL_TT.EOF)
    .map(t => {
      const val = t.value !== null
        ? `<small class="tok-val">${escHtml(String(t.value))}</small>` : '';
      return `<span class="tok ${_sqlTokClass(t.type)}">${t.type}${val}</span>`;
    }).join('');
}

function _renderSqlTable(columns, rows) {
  if (!rows.length) return '<em class="muted">(0 rows)</em>';
  const head = columns.map(c => `<th>${escHtml(String(c))}</th>`).join('');
  const body = rows.map(r =>
    `<tr>${r.map(v => `<td>${escHtml(v === null ? 'NULL' : String(v))}</td>`).join('')}</tr>`
  ).join('');
  return `<table class="db-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ── Main entry point ──────────────────────────────────────
function runSqlInterp() {
  const src    = document.getElementById('sqlInterpInput').value.trim();
  const tokOut = document.getElementById('sqlInterpTokens');
  const astOut = document.getElementById('sqlInterpAST');
  const resOut = document.getElementById('sqlInterpResults');

  tokOut.innerHTML   = '<em class="muted">…</em>';
  astOut.textContent = '…';
  resOut.innerHTML   = '<em class="muted">…</em>';

  if (!src) return;

  // Stage 1: Lex
  let tokens;
  try {
    tokens = new SqlLexer(src).tokenize();
  } catch (e) {
    tokOut.innerHTML = `<span class="db-err">${escHtml(e.message)}</span>`;
    return;
  }
  tokOut.innerHTML = _renderSqlTokens(tokens);

  // Stage 2: Parse
  let ast;
  try {
    ast = new SqlParser(tokens).parse();
  } catch (e) {
    astOut.textContent = e.message;
    return;
  }
  astOut.textContent = prettySqlAST(ast);

  // Stage 3: Evaluate
  const db = dbGetRaw();
  if (!db) { resOut.innerHTML = '<span class="db-err">Database not ready yet.</span>'; return; }
  try {
    const { columns, rows } = new SqlEvaluator(db).eval(ast);
    resOut.innerHTML = _renderSqlTable(columns, rows);
  } catch (e) {
    resOut.innerHTML = `<span class="db-err">${escHtml(e.message)}</span>`;
  }
}

// ── Examples dropdown ─────────────────────────────────────
const SQL_EXAMPLES = [
  { label: 'All runs (latest first)',
    code:  'SELECT * FROM runs ORDER BY ran_at DESC LIMIT 10' },
  { label: 'Last 5 results',
    code:  'SELECT id, code, result FROM runs ORDER BY ran_at DESC LIMIT 5' },
  { label: 'Clean runs only',
    code:  'SELECT * FROM runs WHERE had_errors = 0 ORDER BY ran_at DESC' },
  { label: 'Runs with errors',
    code:  'SELECT id, code, had_errors FROM runs WHERE had_errors = 1' },
  { label: 'Runs with more than 2 variables',
    code:  'SELECT * FROM runs WHERE var_count > 2' },
  { label: 'Most variables first',
    code:  'SELECT id, code, var_count FROM runs ORDER BY var_count DESC LIMIT 10' },
  { label: 'All saved programs',
    code:  'SELECT * FROM programs ORDER BY saved_at DESC' },
  { label: 'Programs by name',
    code:  'SELECT id, name, saved_at FROM programs ORDER BY name ASC' },
];

(function initSqlExamples() {
  const sel = document.getElementById('sqlExampleSelect');
  SQL_EXAMPLES.forEach((ex, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = ex.label;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', e => {
    if (e.target.value === '') return;
    document.getElementById('sqlInterpInput').value = SQL_EXAMPLES[+e.target.value].code;
    e.target.value = '';
    runSqlInterp();
  });
})();

// Ctrl+Enter to run
document.getElementById('sqlInterpInput')?.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSqlInterp(); }
});
