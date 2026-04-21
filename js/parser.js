"use strict";
// Depends on: TT, Token  (lexer.js)

// ── AST Node classes ────────────────────────────────────
class NumberNode  { constructor(v)       { this.type='Number';  this.value=v; } }
class BinOpNode   { constructor(l,op,r)  { this.type='BinOp';   this.left=l; this.op=op; this.right=r; } }
class UnaryNode   { constructor(op,opnd) { this.type='Unary';   this.op=op; this.operand=opnd; } }
class CommandNode { constructor(cmd,arg) { this.type='Command'; this.cmd=cmd; this.arg=arg; } }
class RepeatNode  { constructor(n,body)  { this.type='Repeat';  this.count=n; this.body=body; } }
class ProgramNode { constructor(stmts)   { this.type='Program'; this.stmts=stmts; } }

// ──────────────────────────────────────────────────────────
//  Parser  –  Syntactic Analysis
//  Consumes the token list and builds an Abstract Syntax Tree.
//
//  Grammar:
//    program   → statement*
//    statement → moveCmd '(' expr ')' | noArgCmd
//              | REPEAT '(' expr ')' '[' statement* ']'
//    expr      → term   ( ('+' | '-') term   )*
//    term      → factor ( ('*' | '/') factor )*
//    factor    → NUMBER | '(' expr ')' | ('+' | '-') factor
// ──────────────────────────────────────────────────────────
class Parser {
  constructor(tokens) {
    this.tokens = tokens.filter(t => t.type !== TT.NEWLINE);
    this.pos = 0;
  }

  get cur() { return this.tokens[this.pos]; }

  consume(expected) {
    const t = this.tokens[this.pos++];
    if (expected && t.type !== expected)
      throw new Error(`Expected '${expected}' but got '${t.type}' ('${t.value}')`);
    return t;
  }

  factor() {
    const t = this.cur;
    if (t.type === TT.NUMBER) { this.consume(); return new NumberNode(t.value); }
    if (t.type === TT.LPAREN) {
      this.consume(TT.LPAREN);
      const n = this.expr();
      this.consume(TT.RPAREN);
      return n;
    }
    if (t.type === TT.MINUS) { this.consume(); return new UnaryNode('-', this.factor()); }
    if (t.type === TT.PLUS)  { this.consume(); return new UnaryNode('+', this.factor()); }
    throw new Error(`Expected a number or '(' in expression, got '${t.type}' ('${t.value}')`);
  }

  term() {
    let n = this.factor();
    while (this.cur.type===TT.STAR || this.cur.type===TT.SLASH) {
      const op = this.consume().value;
      n = new BinOpNode(n, op, this.factor());
    }
    return n;
  }

  expr() {
    let n = this.term();
    while (this.cur.type===TT.PLUS || this.cur.type===TT.MINUS) {
      const op = this.consume().value;
      n = new BinOpNode(n, op, this.term());
    }
    return n;
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
    if (t.type===TT.PENUP || t.type===TT.PENDOWN || t.type===TT.RESET) {
      this.consume();
      return new CommandNode(t.type, null);
    }
    if (t.type === TT.REPEAT) {
      this.consume();
      this.consume(TT.LPAREN);
      const cnt = this.expr();
      this.consume(TT.RPAREN);
      this.consume(TT.LBRACKET);
      const body = [];
      while (this.cur.type !== TT.RBRACKET && this.cur.type !== TT.EOF)
        body.push(this.statement());
      this.consume(TT.RBRACKET);
      return new RepeatNode(cnt, body);
    }
    throw new Error(`Unknown command: '${t.value}' (${t.type})`);
  }

  parse() {
    const stmts = [];
    while (this.cur.type !== TT.EOF) stmts.push(this.statement());
    return new ProgramNode(stmts);
  }
}

// ── AST pretty-printer (used by the Show AST button) ────
function prettyAST(node, depth = 0) {
  const p = '  '.repeat(depth);
  switch (node.type) {
    case 'Program':
      return `Program[\n${node.stmts.map(s => p+'  '+prettyAST(s,depth+1)).join('\n')}\n${p}]`;
    case 'Number':
      return `Number(${node.value})`;
    case 'BinOp':
      return `BinOp(${node.op})\n${p}  ├ ${prettyAST(node.left,depth+1)}\n${p}  └ ${prettyAST(node.right,depth+1)}`;
    case 'Unary':
      return `Unary(${node.op})\n${p}  └ ${prettyAST(node.operand,depth+1)}`;
    case 'Command':
      return `Command(${node.cmd})` + (node.arg ? `\n${p}  └ ${prettyAST(node.arg,depth+1)}` : '');
    case 'Repeat':
      return `Repeat\n${p}  count: ${prettyAST(node.count,depth+1)}\n${p}  body:\n${node.body.map(s=>p+'    '+prettyAST(s,depth+2)).join('\n')}`;
    default:
      return JSON.stringify(node);
  }
}
