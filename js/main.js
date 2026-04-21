"use strict";
// Depends on: lexer.js, parser.js, evaluator.js, turtle.js, database.js

// ── Game State ───────────────────────────────────────────
let gameState  = 'start';   // 'start' | 'playing' | 'win'
let moveCount  = 0;

// Wire the turtle callback: runs after every completed move
setMoveCallback((cmd, val, fromKeyboard) => {
  if (cmd === TT.RESET) {
    moveCount = 0;
    document.getElementById('log').innerHTML = '';
    updateStatus();
    return;
  }
  moveCount++;
  saveMove(cmd, val, fromKeyboard);
  logMove(cmd, val);
  updateStatus();
  checkGoal();
});

// ── Game flow ────────────────────────────────────────────
function startGame() {
  gameState = 'playing';
  document.getElementById('startOverlay').classList.add('hidden');
  placeGoal();
  startRenderLoop();
  startSession();
  moveCount = 0;
  updateStatus();
}

function checkGoal() {
  if (gameState !== 'playing') return;
  if (distToGoal() < 28) triggerWin();
}

function triggerWin() {
  gameState = 'win';
  flushMoves();
  endSession(moveCount);
  clearGoal();

  const dist = trail.reduce((sum, s) => {
    const dx = s.x2-s.x1, dy = s.y2-s.y1;
    return sum + Math.sqrt(dx*dx+dy*dy);
  }, 0);

  document.getElementById('winStats').innerHTML =
    `Moves: <b>${moveCount}</b> &nbsp;|&nbsp; Distance: <b>${dist.toFixed(0)}px</b>`;
  document.getElementById('winOverlay').classList.remove('hidden');
}

function playAgain() {
  document.getElementById('winOverlay').classList.add('hidden');
  resetTurtle();
  placeGoal();
  startSession();
  moveCount = 0;
  gameState = 'playing';
  document.getElementById('log').innerHTML = '';
  updateStatus();
}

// ── Keyboard controls ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;
  if (document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'INPUT') return;
  if (animBusy) return;

  switch (e.key) {
    case 'ArrowUp':    case 'w': queueMove(TT.FORWARD,  30, true); break;
    case 'ArrowDown':  case 's': queueMove(TT.BACKWARD, 30, true); break;
    case 'ArrowLeft':  case 'a': queueMove(TT.LEFT,     45, true); break;
    case 'ArrowRight': case 'd': queueMove(TT.RIGHT,    45, true); break;
    case 'r': resetTurtle(); break;
    default: return;
  }
  e.preventDefault();
});

// ── Interpreter run ──────────────────────────────────────
function run() {
  if (gameState !== 'playing') return;
  clearOutput();
  const src = document.getElementById('code').value.trim();
  if (!src) return;
  try {
    const tokens = new Lexer(src).tokenize();
    const ast    = new Parser(tokens).parse();
    const ev     = new Evaluator((cmd, val) => queueMove(cmd, val, false));
    ev.eval(ast);
  } catch (e) {
    showError(e.message);
  }
}

// ── Show Tokens ──────────────────────────────────────────
function showTokens() {
  clearOutput();
  const src = document.getElementById('code').value.trim();
  if (!src) return;
  try {
    const tokens = new Lexer(src).tokenize().filter(t => t.type !== TT.EOF);
    document.getElementById('tokenOut').innerHTML = tokens.map(t => {
      const val = t.value !== null
        ? `<small>${t.value === '\n' ? '↵' : t.value}</small>`
        : '';
      return `<span class="tok tok-${t.type.toLowerCase()}">${t.type}${val}</span>`;
    }).join('');
  } catch (e) { showError(e.message); }
}

// ── Show AST ─────────────────────────────────────────────
function showAST() {
  clearOutput();
  const src = document.getElementById('code').value.trim();
  if (!src) return;
  try {
    const tokens = new Lexer(src).tokenize();
    const ast    = new Parser(tokens).parse();
    document.getElementById('astOut').textContent = prettyAST(ast);
  } catch (e) { showError(e.message); }
}

// ── Standalone Expression Evaluator ─────────────────────
function evalExpression() {
  const src = document.getElementById('exprInput').value.trim();
  const out = document.getElementById('exprResult');
  if (!src) { out.textContent = ''; return; }
  try {
    const tokens = new Lexer(src).tokenize();
    const p      = new Parser(tokens);
    const ast    = p.expr();                        // parse as pure expression
    if (p.cur.type !== TT.EOF)
      throw new Error('Unexpected token after expression');
    const result = new Evaluator(() => {
      throw new Error('Commands not allowed in expression mode');
    }).eval(ast);
    out.innerHTML = `= <b>${result}</b>`;
    out.className = 'expr-ok';
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
    out.className   = 'expr-err';
  }
}

// Allow Enter key in expr input
document.getElementById('exprInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') evalExpression();
});

// ── SQL Panel ────────────────────────────────────────────
function runSQL() {
  clearOutput();
  const q = document.getElementById('sql').value.trim();
  try {
    const res = runQuery(q);
    if (!res.length) {
      document.getElementById('sqlOut').innerHTML = '<em>Query executed (no rows)</em>';
      return;
    }
    const { columns, values } = res[0];
    const head  = `<thead><tr>${columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`;
    const body  = `<tbody>${values.map(row =>
      `<tr>${row.map(v=>`<td>${v??'NULL'}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;
    document.getElementById('sqlOut').innerHTML = `<table>${head}${body}</table>`;
  } catch (e) {
    document.getElementById('sqlOut').innerHTML = `<span class="err">${e.message}</span>`;
  }
}

// ── UI helpers ───────────────────────────────────────────
function updateStatus() {
  document.getElementById('status').innerHTML =
    `X: <b>${turtle.x.toFixed(1)}</b> &nbsp; ` +
    `Y: <b>${turtle.y.toFixed(1)}</b> &nbsp; ` +
    `Angle: <b>${turtle.angle.toFixed(0)}°</b> &nbsp; ` +
    `Pen: <b class="${turtle.penDown ? 'pen-dn' : 'pen-up'}">${turtle.penDown ? 'DOWN' : 'UP'}</b> &nbsp; ` +
    `Moves: <b>${moveCount}</b>`;
}

function logMove(cmd, val) {
  const el  = document.getElementById('log');
  const txt = val !== null ? `${cmd}(${+val.toFixed(2)})` : cmd;
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

// ── Init ─────────────────────────────────────────────────
draw();          // draw static turtle on start screen
updateStatus();
