"use strict";
// Depends on: AST node types  (parser.js)

// ──────────────────────────────────────────────────────────
//  Evaluator  –  Semantic Analysis / Tree Walking
//  Recursively evaluates each AST node.
//  Commands are dispatched via the onCommand callback so
//  this module stays decoupled from turtle/canvas logic.
// ──────────────────────────────────────────────────────────
class Evaluator {
  // onCommand: (tokenType, value) => void
  constructor(onCommand) { this.onCommand = onCommand; }

  eval(node) {
    switch (node.type) {

      case 'Number':
        return node.value;

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
        this.onCommand(node.cmd, val);
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
