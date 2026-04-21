"use strict";

// ============================================================
//  TOKEN TYPES
// ============================================================
const TT = Object.freeze({
  NUMBER:   'NUMBER',
  PLUS:     'PLUS',   MINUS:    'MINUS',
  STAR:     'STAR',   SLASH:    'SLASH',
  LPAREN:   'LPAREN', RPAREN:   'RPAREN',
  LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
  FORWARD:  'FORWARD',  BACKWARD: 'BACKWARD',
  LEFT:     'LEFT',     RIGHT:    'RIGHT',
  PENUP:    'PENUP',    PENDOWN:  'PENDOWN',
  REPEAT:   'REPEAT',   RESET:    'RESET',
  IDENT:    'IDENT',
  NEWLINE:  'NEWLINE',  EOF:      'EOF',
});

// ============================================================
//  TOKEN
// ============================================================
class Token {
  constructor(type, value) {
    this.type  = type;
    this.value = value;
  }
  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)})`;
  }
}

// ============================================================
//  LEXER  – Lexical Analysis
//  Reads source text character-by-character and produces a
//  flat list of typed Token objects.
// ============================================================
class Lexer {
  constructor(src) {
    this.src = src;
    this.pos = 0;
  }

  get ch() { return this.pos < this.src.length ? this.src[this.pos] : null; }
  advance() { this.pos++; }

  skipWhitespace() {
    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\r') this.advance();
  }

  readNumber() {
    let s = '';
    while (this.ch !== null && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    if (this.ch === '.') {
      s += '.'; this.advance();
      while (this.ch !== null && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    }
    return new Token(TT.NUMBER, parseFloat(s));
  }

  readWord() {
    let s = '';
    while (this.ch !== null && /[A-Za-z_]/.test(this.ch)) { s += this.ch; this.advance(); }
    const kw = {
      FORWARD: TT.FORWARD,  FD:  TT.FORWARD,
      BACKWARD: TT.BACKWARD, BK:  TT.BACKWARD,
      LEFT:    TT.LEFT,     LT:  TT.LEFT,
      RIGHT:   TT.RIGHT,    RT:  TT.RIGHT,
      PENUP:   TT.PENUP,    PU:  TT.PENUP,
      PENDOWN: TT.PENDOWN,  PD:  TT.PENDOWN,
      REPEAT:  TT.REPEAT,
      RESET:   TT.RESET,
    };
    const type = kw[s.toUpperCase()] ?? TT.IDENT;
    return new Token(type, s.toUpperCase());
  }

  tokenize() {
    const tokens = [];
    while (this.ch !== null) {
      const c = this.ch;
      if      (c === ' ' || c === '\t' || c === '\r') { this.skipWhitespace(); }
      else if (c === '\n')          { tokens.push(new Token(TT.NEWLINE, '\n')); this.advance(); }
      else if (/\d/.test(c))        { tokens.push(this.readNumber()); }
      else if (/[A-Za-z_]/.test(c)) { tokens.push(this.readWord());   }
      else if (c === '+')  { tokens.push(new Token(TT.PLUS,     '+')); this.advance(); }
      else if (c === '-')  { tokens.push(new Token(TT.MINUS,    '-')); this.advance(); }
      else if (c === '*')  { tokens.push(new Token(TT.STAR,     '*')); this.advance(); }
      else if (c === '/')  { tokens.push(new Token(TT.SLASH,    '/')); this.advance(); }
      else if (c === '(')  { tokens.push(new Token(TT.LPAREN,   '(')); this.advance(); }
      else if (c === ')')  { tokens.push(new Token(TT.RPAREN,   ')')); this.advance(); }
      else if (c === '[')  { tokens.push(new Token(TT.LBRACKET, '[')); this.advance(); }
      else if (c === ']')  { tokens.push(new Token(TT.RBRACKET, ']')); this.advance(); }
      else { throw new Error(`Unexpected character: '${c}'`); }
    }
    tokens.push(new Token(TT.EOF, null));
    return tokens;
  }
}

// ============================================================
//  AST NODES
//  Each node represents one syntactic construct in the tree.
// ============================================================
class NumberNode  { constructor(v)          { this.type='Number';  this.value=v; } }
class BinOpNode   { constructor(l,op,r)     { this.type='BinOp';   this.left=l; this.op=op; this.right=r; } }
class UnaryNode   { constructor(op,operand) { this.type='Unary';   this.op=op; this.operand=operand; } }
class CommandNode { constructor(cmd,arg)    { this.type='Command'; this.cmd=cmd; this.arg=arg; } }
class RepeatNode  { constructor(count,body) { this.type='Repeat';  this.count=count; this.body=body; } }
class ProgramNode { constructor(stmts)      { this.type='Program'; this.stmts=stmts; } }

// ============================================================
//  PARSER  – Syntactic Analysis
//  Consumes the token list and builds an Abstract Syntax Tree.
//
//  Grammar:
//    program  → statement*
//    statement→ moveCmd '(' expr ')'
//             | noArgCmd
//             | 'REPEAT' '(' expr ')' '[' statement* ']'
//    expr     → term   ( ('+' | '-') term   )*
//    term     → factor ( ('*' | '/') factor )*
//    factor   → NUMBER | '(' expr ')' | ('+' | '-') factor
// ============================================================
class Parser {
  constructor(tokens) {
    this.tokens = tokens.filter(t => t.type !== TT.NEWLINE);
    this.pos = 0;
  }

  get cur() { return this.tokens[this.pos]; }

  consume(expected) {
    const t = this.tokens[this.pos++];
    if (expected && t.type !== expected)
      throw new Error(`Expected '${expected}' but got '${t.type}' (value: ${JSON.stringify(t.value)})`);
    return t;
  }

  // factor → NUMBER | '(' expr ')' | unary
  factor() {
    const t = this.cur;
    if (t.type === TT.NUMBER) { this.consume(); return new NumberNode(t.value); }
    if (t.type === TT.LPAREN) {
      this.consume(TT.LPAREN);
      const node = this.expr();
      this.consume(TT.RPAREN);
      return node;
    }
    if (t.type === TT.MINUS) { this.consume(); return new UnaryNode('-', this.factor()); }
    if (t.type === TT.PLUS)  { this.consume(); return new UnaryNode('+', this.factor()); }
    throw new Error(`Expected a number or '(' in expression, got '${t.type}' (${JSON.stringify(t.value)})`);
  }

  // term → factor ( ('*' | '/') factor )*
  term() {
    let node = this.factor();
    while (this.cur.type === TT.STAR || this.cur.type === TT.SLASH) {
      const op = this.consume().value;
      node = new BinOpNode(node, op, this.factor());
    }
    return node;
  }

  // expr → term ( ('+' | '-') term )*
  expr() {
    let node = this.term();
    while (this.cur.type === TT.PLUS || this.cur.type === TT.MINUS) {
      const op = this.consume().value;
      node = new BinOpNode(node, op, this.term());
    }
    return node;
  }

  statement() {
    const t = this.cur;
    const moveCmds = [TT.FORWARD, TT.BACKWARD, TT.LEFT, TT.RIGHT];

    if (moveCmds.includes(t.type)) {
      this.consume();
      this.consume(TT.LPAREN);
      const arg = this.expr();
      this.consume(TT.RPAREN);
      return new CommandNode(t.type, arg);
    }
    if (t.type === TT.PENUP || t.type === TT.PENDOWN || t.type === TT.RESET) {
      this.consume();
      return new CommandNode(t.type, null);
    }
    if (t.type === TT.REPEAT) {
      this.consume();
      this.consume(TT.LPAREN);
      const count = this.expr();
      this.consume(TT.RPAREN);
      this.consume(TT.LBRACKET);
      const body = [];
      while (this.cur.type !== TT.RBRACKET && this.cur.type !== TT.EOF) {
        body.push(this.statement());
      }
      this.consume(TT.RBRACKET);
      return new RepeatNode(count, body);
    }
    throw new Error(`Unknown command: '${t.value}' (type: ${t.type})`);
  }

  parse() {
    const stmts = [];
    while (this.cur.type !== TT.EOF) stmts.push(this.statement());
    return new ProgramNode(stmts);
  }
}

// ============================================================
//  EVALUATOR  – walks the AST and evaluates every node
// ============================================================
class Evaluator {
  eval(node) {
    switch (node.type) {
      case 'Number':  return node.value;

      case 'BinOp': {
        const l = this.eval(node.left);
        const r = this.eval(node.right);
        if (node.op === '+') return l + r;
        if (node.op === '-') return l - r;
        if (node.op === '*') return l * r;
        if (node.op === '/') {
          if (r === 0) throw new Error('Division by zero');
          return l / r;
        }
        break;
      }

      case 'Unary':
        return node.op === '-' ? -this.eval(node.operand) : this.eval(node.operand);

      case 'Command': {
        const val = node.arg !== null ? this.eval(node.arg) : null;
        execute(node.cmd, val);
        return val;
      }

      case 'Repeat': {
        const n = Math.round(this.eval(node.count));
        if (n < 0 || n > 10000) throw new Error(`REPEAT count out of range: ${n}`);
        for (let i = 0; i < n; i++)
          for (const stmt of node.body) this.eval(stmt);
        return null;
      }

      case 'Program':
        for (const stmt of node.stmts) this.eval(stmt);
        return null;
    }
    throw new Error(`Unknown AST node type: ${node.type}`);
  }
}

// ============================================================
//  CANVAS + TURTLE STATE
// ============================================================
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let turtle = { x: W / 2, y: H / 2, angle: 0, penDown: true };
let trail  = [];   // array of { x1, y1, x2, y2 }

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.lineWidth   = 1;
  ctx.strokeStyle = '#0d1f2d';
  for (let i = 0; i <= W; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
  }
  for (let j = 0; j <= H; j += 40) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke();
  }

  // Trail lines
  ctx.lineWidth   = 2;
  ctx.strokeStyle = '#00ff99';
  ctx.shadowColor = '#00ff99';
  ctx.shadowBlur  = 4;
  for (const seg of trail) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Turtle arrow (points in the direction of turtle.angle)
  const rad = turtle.angle * Math.PI / 180;
  ctx.save();
  ctx.translate(turtle.x, turtle.y);
  ctx.rotate(rad);
  ctx.shadowColor = '#00ff99';
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.moveTo(13, 0);       // nose
  ctx.lineTo(-7, -7);      // left wing
  ctx.lineTo(-3, 0);       // tail indent
  ctx.lineTo(-7,  7);      // right wing
  ctx.closePath();
  ctx.fillStyle = '#00ff99';
  ctx.fill();
  ctx.restore();
}

// ============================================================
//  EXECUTE  – applies one turtle command
// ============================================================
function execute(cmd, val) {
  const px = turtle.x, py = turtle.y;

  if (cmd === TT.FORWARD || cmd === TT.BACKWARD) {
    const sign = cmd === TT.FORWARD ? 1 : -1;
    const rad  = turtle.angle * Math.PI / 180;
    turtle.x  += sign * Math.cos(rad) * val;
    turtle.y  += sign * Math.sin(rad) * val;
    if (turtle.penDown) trail.push({ x1: px, y1: py, x2: turtle.x, y2: turtle.y });
  } else if (cmd === TT.LEFT)    { turtle.angle -= val; }
  else if (cmd === TT.RIGHT)   { turtle.angle += val; }
  else if (cmd === TT.PENUP)   { turtle.penDown = false; }
  else if (cmd === TT.PENDOWN) { turtle.penDown = true;  }
  else if (cmd === TT.RESET)   { resetTurtle(); return; }

  saveMove(cmd, val);
  logMove(cmd, val);
  updateStatus();
  draw();
}

// ============================================================
//  DATABASE  – sql.js (SQLite compiled to WebAssembly)
// ============================================================
let db;

initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` })
  .then(SQL => {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE moves (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        action  TEXT    NOT NULL,
        value   REAL,
        x       REAL    NOT NULL,
        y       REAL    NOT NULL,
        angle   REAL    NOT NULL,
        pen     INTEGER NOT NULL,
        time    TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    updateStatus();
  });

function saveMove(cmd, val) {
  if (!db) return;
  db.run(
    `INSERT INTO moves (action, value, x, y, angle, pen) VALUES (?, ?, ?, ?, ?, ?)`,
    [cmd, val, turtle.x, turtle.y, turtle.angle, turtle.penDown ? 1 : 0]
  );
}

// ============================================================
//  RUN  – full interpreter pipeline
// ============================================================
function run() {
  const src = document.getElementById('code').value.trim();
  clearOutput();
  if (!src) return;

  try {
    const tokens = new Lexer(src).tokenize();          // 1. Lex
    const ast    = new Parser(tokens).parse();          // 2. Parse → AST
    new Evaluator().eval(ast);                          // 3. Evaluate
  } catch (e) {
    showError(e.message);
  }
}

// ============================================================
//  SHOW TOKENS  – display lexical analysis output
// ============================================================
function showTokens() {
  clearOutput();
  const src = document.getElementById('code').value.trim();
  if (!src) return;
  try {
    const tokens = new Lexer(src).tokenize().filter(t => t.type !== TT.EOF);
    const html   = tokens.map(t => {
      const cls = 'tok tok-' + t.type.toLowerCase();
      const val = t.value !== null ? `<small>${t.value === '\n' ? '↵' : t.value}</small>` : '';
      return `<span class="${cls}">${t.type}${val}</span>`;
    }).join('');
    document.getElementById('tokenOut').innerHTML = html || '<em>No tokens</em>';
  } catch (e) { showError(e.message); }
}

// ============================================================
//  SHOW AST  – display syntactic analysis output
// ============================================================
function showAST() {
  clearOutput();
  const src = document.getElementById('code').value.trim();
  if (!src) return;
  try {
    const tokens = new Lexer(src).tokenize();
    const ast    = new Parser(tokens).parse();
    document.getElementById('astOut').textContent = prettyAST(ast, 0);
  } catch (e) { showError(e.message); }
}

function prettyAST(node, depth) {
  const pad = '  '.repeat(depth);
  switch (node.type) {
    case 'Program':
      return `Program[\n${node.stmts.map(s => pad + '  ' + prettyAST(s, depth + 1)).join('\n')}\n${pad}]`;
    case 'Number':
      return `Number(${node.value})`;
    case 'BinOp':
      return `BinOp(${node.op})\n${pad}  ├ ${prettyAST(node.left,  depth+1)}\n${pad}  └ ${prettyAST(node.right, depth+1)}`;
    case 'Unary':
      return `Unary(${node.op})\n${pad}  └ ${prettyAST(node.operand, depth+1)}`;
    case 'Command':
      return `Command(${node.cmd})` + (node.arg ? `\n${pad}  └ ${prettyAST(node.arg, depth+1)}` : '');
    case 'Repeat':
      return `Repeat\n${pad}  count: ${prettyAST(node.count, depth+1)}\n${pad}  body:\n${node.body.map(s => pad + '    ' + prettyAST(s, depth+2)).join('\n')}`;
    default:
      return JSON.stringify(node);
  }
}

// ============================================================
//  SQL QUERY
// ============================================================
function runSQL() {
  if (!db) { showError('Database not ready yet'); return; }
  const q = document.getElementById('sql').value.trim();
  try {
    const res = db.exec(q);
    if (!res.length) {
      document.getElementById('sqlOut').innerHTML = '<em>Query executed (no rows)</em>';
      return;
    }
    const { columns, values } = res[0];
    const thead = `<thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${values.map(row =>
      `<tr>${row.map(v => `<td>${v ?? 'NULL'}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;
    document.getElementById('sqlOut').innerHTML = `<table>${thead}${tbody}</table>`;
  } catch (e) {
    document.getElementById('sqlOut').innerHTML = `<span class="err">${e.message}</span>`;
  }
}

// ============================================================
//  KEYBOARD CONTROLS
// ============================================================
document.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'ArrowUp':   case 'w': execute(TT.FORWARD,  20); break;
    case 'ArrowDown': case 's': execute(TT.BACKWARD, 20); break;
    case 'ArrowLeft': case 'a': execute(TT.LEFT,     15); break;
    case 'ArrowRight':case 'd': execute(TT.RIGHT,    15); break;
    case 'r':                   resetTurtle();            break;
  }
});

// ============================================================
//  RESET
// ============================================================
function resetTurtle() {
  turtle = { x: W / 2, y: H / 2, angle: 0, penDown: true };
  trail  = [];
  document.getElementById('log').innerHTML = '';
  draw();
  updateStatus();
}

// ============================================================
//  UI HELPERS
// ============================================================
function updateStatus() {
  document.getElementById('status').innerHTML =
    `X: <b>${turtle.x.toFixed(1)}</b> &nbsp; ` +
    `Y: <b>${turtle.y.toFixed(1)}</b> &nbsp; ` +
    `Angle: <b>${turtle.angle.toFixed(1)}°</b> &nbsp; ` +
    `Pen: <b class="${turtle.penDown ? 'pen-down' : 'pen-up'}">${turtle.penDown ? 'DOWN' : 'UP'}</b>`;
}

function logMove(cmd, val) {
  const el  = document.getElementById('log');
  const txt = val !== null ? `${cmd}(${+val.toFixed(3)})` : cmd;
  el.innerHTML = `<div>${txt}</div>` + el.innerHTML;
}

function showError(msg) {
  document.getElementById('errOut').textContent = '⚠ ' + msg;
}

function clearOutput() {
  document.getElementById('errOut').textContent  = '';
  document.getElementById('tokenOut').innerHTML  = '';
  document.getElementById('astOut').textContent  = '';
}

// ============================================================
//  INIT
// ============================================================
draw();
updateStatus();
