"use strict";
// Depends on: sql_lexer.js  (SQL_TT, SqlError, SqlToken)

// ── AST nodes ─────────────────────────────────────────────
class SqlSelectNode {
  constructor(cols, from, where, orderBy, limit) {
    this.type    = 'SqlSelect';
    this.cols    = cols;      // ['*'] | string[]
    this.from    = from;      // table name string
    this.where   = where;     // SqlCondNode | SqlAndNode | null
    this.orderBy = orderBy;   // { col, dir } | null
    this.limit   = limit;     // number | null
  }
}

class SqlCondNode {
  constructor(col, op, val) { this.type='SqlCond'; this.col=col; this.op=op; this.val=val; }
}

class SqlAndNode {
  constructor(left, right) { this.type='SqlAnd'; this.left=left; this.right=right; }
}

// ── Parser ────────────────────────────────────────────────
//  Grammar (simple subset):
//    query   → SELECT cols FROM IDENT
//                (WHERE cond)?
//                (ORDER BY IDENT (ASC|DESC)?)?
//                (LIMIT NUMBER)?
//    cols    → '*' | IDENT (',' IDENT)*
//    cond    → IDENT op value (AND cond)*
//    op      → '=' | '!=' | '>' | '<' | '>=' | '<='
//    value   → NUMBER | STRING | IDENT
// ─────────────────────────────────────────────────────────
class SqlParser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  get cur() { return this.tokens[this.pos]; }

  consume(expected) {
    const t = this.tokens[this.pos++];
    if (expected && t.type !== expected)
      throw new SqlError(`Expected ${expected} but got '${t.value}'`, t.col);
    return t;
  }

  parseValue() {
    const t = this.cur;
    if (t.type === SQL_TT.NUMBER || t.type === SQL_TT.STRING || t.type === SQL_TT.IDENT) {
      this.consume(); return t.value;
    }
    throw new SqlError(`Expected a value but got '${t.value}'`, t.col);
  }

  parseCond() {
    const col   = this.consume(SQL_TT.IDENT).value;
    const opTok = this.cur;
    const OPS   = [SQL_TT.EQ, SQL_TT.NEQ, SQL_TT.GT, SQL_TT.LT, SQL_TT.GTE, SQL_TT.LTE];
    if (!OPS.includes(opTok.type)) throw new SqlError(`Expected a comparison operator`, opTok.col);
    this.consume();
    const val  = this.parseValue();
    let   node = new SqlCondNode(col, opTok.value, val);
    if (this.cur.type === SQL_TT.AND) { this.consume(); node = new SqlAndNode(node, this.parseCond()); }
    return node;
  }

  parse() {
    this.consume(SQL_TT.SELECT);

    // columns
    const cols = [];
    if (this.cur.type === SQL_TT.STAR) { this.consume(); cols.push('*'); }
    else {
      cols.push(this.consume(SQL_TT.IDENT).value);
      while (this.cur.type === SQL_TT.COMMA) { this.consume(); cols.push(this.consume(SQL_TT.IDENT).value); }
    }

    this.consume(SQL_TT.FROM);
    const from = this.consume(SQL_TT.IDENT).value;

    let where = null, orderBy = null, limit = null;

    if (this.cur.type === SQL_TT.WHERE) {
      this.consume(); where = this.parseCond();
    }

    if (this.cur.type === SQL_TT.ORDER) {
      this.consume(); this.consume(SQL_TT.BY);
      const col = this.consume(SQL_TT.IDENT).value;
      let dir = 'ASC';
      if      (this.cur.type === SQL_TT.DESC) { this.consume(); dir = 'DESC'; }
      else if (this.cur.type === SQL_TT.ASC)  { this.consume(); }
      orderBy = { col, dir };
    }

    if (this.cur.type === SQL_TT.LIMIT) {
      this.consume(); limit = this.consume(SQL_TT.NUMBER).value;
    }

    if (this.cur.type !== SQL_TT.EOF)
      throw new SqlError(`Unexpected token '${this.cur.value}'`, this.cur.col);

    return new SqlSelectNode(cols, from, where, orderBy, limit);
  }
}

// ── AST pretty-printer ────────────────────────────────────
function prettySqlAST(node) {
  const lines = ['SqlSelect'];
  lines.push(`  ├ cols:    ${node.cols.join(', ')}`);
  lines.push(`  ├ from:    ${node.from}`);
  if (node.where)   lines.push(`  ├ where:   ${_condStr(node.where)}`);
  if (node.orderBy) lines.push(`  ├ orderBy: ${node.orderBy.col} ${node.orderBy.dir}`);
  lines.push(`  └ limit:   ${node.limit !== null ? node.limit : '(none)'}`);
  return lines.join('\n');
}

function _condStr(node) {
  if (node.type === 'SqlAnd')
    return `${_condStr(node.left)}\n  │           AND ${_condStr(node.right)}`;
  return `${node.col} ${node.op} ${JSON.stringify(node.val)}`;
}
