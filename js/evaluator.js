"use strict";
// Depends on: AST node types  (parser.js)

// ──────────────────────────────────────────────────────────
//  Evaluator  –  Semantic Analysis / Tree Walking
//
//  Recursively walks the AST, evaluates every expression node
//  to a number, and dispatches command nodes via onCommand.
//
//  Symbol table (env):
//    Passed in from the caller so variables persist across
//    multiple interpreter runs in the same session.
//    SET x = 50  →  env['x'] = 50
//    FORWARD(x)  →  looks up env['x']
// ──────────────────────────────────────────────────────────
class Evaluator {
  // onCommand : (tokenType | 'SETPOS', value) => void
  // env       : shared symbol table object (persists across runs)
  constructor(onCommand, env = {}) {
    this.onCommand = onCommand;
    this.env = env;
  }

  eval(node) {
    switch (node.type) {

      case 'Number':
        return node.value;

      // Variable lookup
      case 'Ident': {
        if (!(node.name in this.env))
          throw new Error(`Undefined variable: '${node.name}'`);
        return this.env[node.name];
      }

      // Variable assignment
      case 'Set': {
        const val = this.eval(node.val);
        this.env[node.name] = val;
        return val;
      }

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
        if (node.op === '%') {
          if (r === 0) throw new Error('Modulo by zero');
          return l % r;
        }
        break;
      }

      case 'Unary':
        return node.op === '-' ? -this.eval(node.operand) : this.eval(node.operand);

      // Single-argument turtle commands
      case 'Command': {
        const val = node.arg !== null ? this.eval(node.arg) : null;
        this.onCommand(node.cmd, val);
        return val;
      }

      // Two-argument absolute positioning
      case 'SetPos': {
        const x = this.eval(node.x);
        const y = this.eval(node.y);
        this.onCommand('SETPOS', { x, y });
        return null;
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
