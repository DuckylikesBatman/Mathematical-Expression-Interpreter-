"use strict";
// Depends on: lexer.js, parser.js, evaluator.js, turtle.js, database.js

// ── Example programs ─────────────────────────────────────
const EXAMPLES = {
  default: `FORWARD(100)\nRIGHT(90)\nFORWARD(50 + 50)\nLEFT(45 * 2)\nREPEAT(4)[\n  FORWARD(60)\n  RIGHT(90)\n]`,
  square: `# Draw a square using a variable for side length\nSET side = 120\nREPEAT(4)[\n  FORWARD(side)\n  RIGHT(90)\n]`,
  triangle: `# Equilateral triangle\nSET side = 110\nREPEAT(3)[\n  FORWARD(side)\n  RIGHT(120)\n]`,
  star: `# 5-pointed star\nREPEAT(5)[\n  FORWARD(120)\n  RIGHT(144)\n]`,
  spiral: `# Growing spiral using a variable\nSET n = 10\nREPEAT(18)[\n  FORWARD(n)\n  RIGHT(90)\n  SET n = n + 8\n]`,
  rainbow: `# Rainbow square – pen changes colour each side\nSET side = 90\nPENCOLOR(0)\nFORWARD(side)\nRIGHT(90)\nPENCOLOR(60)\nFORWARD(side)\nRIGHT(90)\nPENCOLOR(210)\nFORWARD(side)\nRIGHT(90)\nPENCOLOR(300)\nFORWARD(side)`,
  polygon: `# Regular polygon – change sides to any number\nSET sides = 6\nSET len   = 70\nSET turn  = 360 / sides\nREPEAT(sides)[\n  FORWARD(len)\n  RIGHT(turn)\n]`,
  modulo: `# Modulo demo: alternate pen up/down every other move\nSET i = 0\nREPEAT(10)[\n  SET i = i + 1\n  FORWARD(40)\n  RIGHT(36)\n]`,
};

// ── Persistent symbol table – survives between runs ──────
const globalEnv = {};

// ── Game State ───────────────────────────────────────────
let gameState = 'start';
let moveCount = 0;

// Wire the turtle callback: runs after every completed move
setMoveCallback((cmd, val, fromKeyboard) => {
  if (cmd === TT.RESET) {
    moveCount = 0;
    document.getElementById('log').innerHTML = '';
    updateStatus();
    updateVarsPanel();
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
    // Pass the shared env so variables persist across runs
    const ev = new Evaluator((cmd, val) => queueMove(cmd, val, false), globalEnv);
    ev.eval(ast);
    updateVarsPanel();
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
    const ast    = p.expr();
    if (p.cur.type !== TT.EOF)
      throw new Error('Unexpected token after expression');
    // Use globalEnv so variables defined in the interpreter are accessible
    const result = new Evaluator(() => {
      throw new Error('Commands not allowed in expression mode');
    }, globalEnv).eval(ast);
    out.innerHTML = `= <b>${+result.toFixed(6)}</b>`;
    out.className = 'expr-ok';
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
    out.className   = 'expr-err';
  }
}

document.getElementById('exprInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') evalExpression();
});

// ── Examples dropdown ────────────────────────────────────
document.getElementById('exampleSelect').addEventListener('change', e => {
  const key = e.target.value;
  if (key && EXAMPLES[key]) {
    document.getElementById('code').value = EXAMPLES[key];
    e.target.value = '';   // reset so same option can be re-selected
  }
});

// ── Speed slider ─────────────────────────────────────────
document.getElementById('speed').addEventListener('input', e => {
  // slider 1 (slow=400ms) … 10 (fast=30ms)
  const ms = Math.round(430 - e.target.value * 40);
  setAnimSpeed(ms);
  document.getElementById('speedLabel').textContent =
    e.target.value <= 3 ? 'Slow' : e.target.value >= 8 ? 'Fast' : 'Normal';
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
    const head = `<thead><tr>${columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${values.map(row =>
      `<tr>${row.map(v=>`<td>${v??'NULL'}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;
    document.getElementById('sqlOut').innerHTML = `<table>${head}${body}</table>`;
  } catch (e) {
    document.getElementById('sqlOut').innerHTML = `<span class="err">${e.message}</span>`;
  }
}

// ── UI helpers ───────────────────────────────────────────
function updateStatus() {
  const hue   = turtle.penHue;
  const swatch = `<span class="pen-swatch" style="background:hsl(${hue},100%,55%)" title="Pen hue ${hue}°"></span>`;
  document.getElementById('status').innerHTML =
    `X: <b>${turtle.x.toFixed(1)}</b> &nbsp; ` +
    `Y: <b>${turtle.y.toFixed(1)}</b> &nbsp; ` +
    `Angle: <b>${turtle.angle.toFixed(0)}°</b> &nbsp; ` +
    `Pen: <b class="${turtle.penDown ? 'pen-dn' : 'pen-up'}">${turtle.penDown ? 'DOWN' : 'UP'}</b> ` +
    `${swatch} &nbsp; Moves: <b>${moveCount}</b>`;
}

function updateVarsPanel() {
  const el   = document.getElementById('varsOut');
  const keys = Object.keys(globalEnv);
  if (!keys.length) {
    el.innerHTML = '<em class="muted">No variables defined</em>';
    return;
  }
  el.innerHTML = keys.map(k => {
    const v = globalEnv[k];
    return `<div class="var-row">
      <span class="var-name">${k}</span>
      <span class="var-eq">=</span>
      <span class="var-val">${+v.toFixed(4)}</span>
    </div>`;
  }).join('');
}

function logMove(cmd, val) {
  const el  = document.getElementById('log');
  let txt;
  if (cmd === 'SETPOS' && val && typeof val === 'object') {
    txt = `SETPOS(${val.x.toFixed(1)}, ${val.y.toFixed(1)})`;
  } else {
    txt = val !== null ? `${cmd}(${+val.toFixed(2)})` : cmd;
  }
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
draw();
updateStatus();
updateVarsPanel();
