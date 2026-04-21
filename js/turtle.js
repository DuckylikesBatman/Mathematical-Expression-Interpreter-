"use strict";
// Depends on: TT  (lexer.js)

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ── State ────────────────────────────────────────────────
let turtle        = { x: W/2, y: H/2, angle: 0, penDown: true };
let trail         = [];          // [{x1,y1,x2,y2}]
let goal          = null;        // {x,y} or null
let animQueue     = [];
let animBusy      = false;
let turtleWalking = false;
let renderLoop    = null;

// Callback set by main.js after each completed move
let _onMoveComplete = () => {};
function setMoveCallback(fn) { _onMoveComplete = fn; }

// ── Render Loop ──────────────────────────────────────────
function startRenderLoop() {
  if (renderLoop) return;
  (function loop() {
    draw();
    renderLoop = requestAnimationFrame(loop);
  })();
}

function stopRenderLoop() {
  if (renderLoop) { cancelAnimationFrame(renderLoop); renderLoop = null; }
}

// ── Main draw ────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  _drawGrid();
  if (goal) _drawGoal(goal.x, goal.y);
  _drawTrail();
  _drawTurtle(turtle.x, turtle.y, turtle.angle);
}

function _drawGrid() {
  ctx.lineWidth   = 1;
  ctx.strokeStyle = '#0d1f2d';
  ctx.shadowBlur  = 0;
  for (let i=0; i<=W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
  for (let j=0; j<=H; j+=40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }
}

function _drawGoal(x, y) {
  const pulse = 1 + 0.1 * Math.sin(Date.now() / 500);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);

  // Glow halo
  const grd = ctx.createRadialGradient(0,0,0, 0,0,32);
  grd.addColorStop(0, 'rgba(255,215,0,0.35)');
  grd.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI*2);
  ctx.fillStyle = grd; ctx.fill();

  // 5-pointed star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r   = i % 2 === 0 ? 17 : 7;
    const ang = (i * Math.PI / 5) - Math.PI/2;
    i===0
      ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
      : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
  }
  ctx.closePath();
  ctx.fillStyle   = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur  = 16;
  ctx.fill();
  ctx.strokeStyle = '#cc8800';
  ctx.lineWidth   = 1.2;
  ctx.shadowBlur  = 0;
  ctx.stroke();
  ctx.restore();
}

function _drawTrail() {
  if (!trail.length) return;
  ctx.lineWidth   = 2;
  ctx.strokeStyle = '#00ff99';
  ctx.shadowColor = '#00ff99';
  ctx.shadowBlur  = 5;
  for (const s of trail) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ── Turtle sprite ────────────────────────────────────────
function _drawTurtle(x, y, angle) {
  const walk = turtleWalking ? Math.sin(Date.now() / 70) * 0.35 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * Math.PI / 180);

  // Tail
  ctx.save();
  ctx.translate(-15, 0);
  ctx.rotate(walk * 0.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI*2);
  ctx.fillStyle = '#4a7a3a'; ctx.fill();
  ctx.restore();

  // Back legs (closer to tail)
  _leg(-7, -9,  0.65 + walk * 0.4);
  _leg(-7,  9, -0.65 - walk * 0.4);

  // Front legs (closer to head)
  _leg( 7, -9, -0.5 + walk * 0.4);
  _leg( 7,  9,  0.5 - walk * 0.4);

  // Shell – base
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI*2);
  ctx.fillStyle   = '#2a5c20';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur  = 8;
  ctx.fill();

  // Shell – highlight
  ctx.beginPath();
  ctx.ellipse(1, -1.5, 9, 6.5, -0.15, 0, Math.PI*2);
  ctx.fillStyle = '#3a7a2e';
  ctx.shadowBlur= 0;
  ctx.fill();

  // Shell – hexagon pattern
  ctx.strokeStyle = '#1a3d14';
  ctx.lineWidth   = 0.9;
  ctx.beginPath();
  for (let i=0; i<6; i++) {
    const a = i * Math.PI / 3;
    i===0
      ? ctx.moveTo(Math.cos(a)*6,  Math.sin(a)*5)
      : ctx.lineTo(Math.cos(a)*6,  Math.sin(a)*5);
  }
  ctx.closePath(); ctx.stroke();
  for (let i=0; i<6; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*6,  Math.sin(a)*5);
    ctx.lineTo(Math.cos(a)*13, Math.sin(a)*9);
    ctx.stroke();
  }

  // Head
  ctx.save();
  ctx.translate(17, 0);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI*2);
  ctx.fillStyle   = '#4a7a3a';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur  = 5;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Eye
  ctx.beginPath(); ctx.arc(3, -1.5, 1.8, 0, Math.PI*2);
  ctx.fillStyle = '#0a0a0a'; ctx.fill();
  ctx.beginPath(); ctx.arc(3.7, -2.1, 0.6, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill();

  // Nostril
  ctx.beginPath(); ctx.arc(6.2, 0.5, 0.6, 0, Math.PI*2);
  ctx.fillStyle = '#1a3d14'; ctx.fill();
  ctx.restore();

  ctx.restore();
}

function _leg(lx, ly, rot) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.5, 3.5, 0, 0, Math.PI*2);
  ctx.fillStyle = '#4a7a3a';
  ctx.shadowBlur= 0;
  ctx.fill();
  ctx.restore();
}

// ── Animation Queue ──────────────────────────────────────
function queueMove(cmd, val, fromKeyboard) {
  animQueue.push({ cmd, val, fromKeyboard: !!fromKeyboard });
  if (!animBusy) _nextStep();
}

function _nextStep() {
  if (!animQueue.length) {
    animBusy      = false;
    turtleWalking = false;
    return;
  }
  animBusy = true;
  _executeStep(animQueue.shift());
}

function _executeStep({ cmd, val, fromKeyboard }) {
  const px = turtle.x, py = turtle.y;

  if (cmd === TT.FORWARD || cmd === TT.BACKWARD) {
    const sign = cmd === TT.FORWARD ? 1 : -1;
    const rad  = turtle.angle * Math.PI / 180;
    const nx   = px + sign * Math.cos(rad) * val;
    const ny   = py + sign * Math.sin(rad) * val;

    // Soft-clamp to canvas so turtle stays visible
    turtle.x = Math.max(15, Math.min(W - 15, nx));
    turtle.y = Math.max(15, Math.min(H - 15, ny));

    turtleWalking = true;
    _animateTo(px, py, turtle.x, turtle.y, 260, () => {
      turtleWalking = false;
      if (turtle.penDown) trail.push({ x1: px, y1: py, x2: turtle.x, y2: turtle.y });
      _onMoveComplete(cmd, val, fromKeyboard);
      _nextStep();
    });
    return;
  }

  if (cmd === TT.LEFT)    turtle.angle -= val;
  if (cmd === TT.RIGHT)   turtle.angle += val;
  if (cmd === TT.PENUP)   turtle.penDown = false;
  if (cmd === TT.PENDOWN) turtle.penDown = true;
  if (cmd === TT.RESET)   { _hardReset(); return; }

  _onMoveComplete(cmd, val, fromKeyboard);
  _nextStep();
}

function _animateTo(x1, y1, x2, y2, ms, cb) {
  const t0 = performance.now();
  function step(now) {
    const p  = Math.min((now - t0) / ms, 1);
    const ep = p < 0.5 ? 2*p*p : -1 + (4 - 2*p) * p;   // ease-in-out
    turtle.x = x1 + (x2 - x1) * ep;
    turtle.y = y1 + (y2 - y1) * ep;
    if (p < 1) requestAnimationFrame(step);
    else { turtle.x = x2; turtle.y = y2; cb(); }
  }
  requestAnimationFrame(step);
}

function _hardReset() {
  animQueue     = [];
  animBusy      = false;
  turtleWalking = false;
  turtle        = { x: W/2, y: H/2, angle: 0, penDown: true };
  trail         = [];
  _onMoveComplete(TT.RESET, null, false);
}

function resetTurtle() { _hardReset(); }

// ── Goal helpers ─────────────────────────────────────────
function placeGoal() {
  const ang  = Math.random() * Math.PI * 2;
  const dist = 130 + Math.random() * 80;
  goal = {
    x: Math.round(Math.max(40, Math.min(W-40, W/2 + Math.cos(ang)*dist))),
    y: Math.round(Math.max(40, Math.min(H-40, H/2 + Math.sin(ang)*dist))),
  };
}

function clearGoal() { goal = null; }

function distToGoal() {
  if (!goal) return Infinity;
  const dx = turtle.x - goal.x, dy = turtle.y - goal.y;
  return Math.sqrt(dx*dx + dy*dy);
}
