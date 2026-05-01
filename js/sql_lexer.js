"use strict";

const SQL_TT = Object.freeze({
  SELECT:'SELECT', FROM:'FROM',  WHERE:'WHERE', ORDER:'ORDER',
  BY:'BY',         ASC:'ASC',    DESC:'DESC',   LIMIT:'LIMIT',
  AND:'AND',       OR:'OR',
  NUMBER:'NUMBER', STRING:'STRING', IDENT:'IDENT',
  EQ:'EQ', NEQ:'NEQ', GT:'GT', LT:'LT', GTE:'GTE', LTE:'LTE',
  STAR:'STAR', COMMA:'COMMA',
  EOF:'EOF',
});

class SqlError extends Error {
  constructor(msg, col=0) { super(msg); this.col = col; }
}

class SqlToken {
  constructor(type, value, col=0) { this.type=type; this.value=value; this.col=col; }
}

class SqlLexer {
  constructor(src) { this.src = src; this.pos = 0; }

  get ch() { return this.pos < this.src.length ? this.src[this.pos] : null; }
  advance() { this.pos++; }

  skipWS() {
    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\r' || this.ch === '\n')
      this.advance();
  }

  readNumber() {
    const col = this.pos; let s = '';
    while (this.ch && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    if (this.ch === '.') {
      s += '.'; this.advance();
      while (this.ch && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    }
    return new SqlToken(SQL_TT.NUMBER, parseFloat(s), col);
  }

  readString(quote) {
    const col = this.pos; this.advance(); let s = '';
    while (this.ch !== null && this.ch !== quote) { s += this.ch; this.advance(); }
    if (this.ch === null) throw new SqlError('Unterminated string', col);
    this.advance();
    return new SqlToken(SQL_TT.STRING, s, col);
  }

  readIdent() {
    const col = this.pos; let s = '';
    while (this.ch && /[A-Za-z_0-9]/.test(this.ch)) { s += this.ch; this.advance(); }
    const upper = s.toUpperCase();
    const kw = { SELECT:1,FROM:1,WHERE:1,ORDER:1,BY:1,ASC:1,DESC:1,LIMIT:1,AND:1,OR:1 };
    if (upper in kw) return new SqlToken(SQL_TT[upper], upper, col);
    return new SqlToken(SQL_TT.IDENT, s, col);
  }

  tokenize() {
    const tokens = [];
    while (this.ch !== null) {
      this.skipWS();
      if (this.ch === null) break;
      const c = this.ch, col = this.pos;
      if (/\d/.test(c))       { tokens.push(this.readNumber()); continue; }
      if (/[A-Za-z_]/.test(c)){ tokens.push(this.readIdent());  continue; }
      if (c==="'" || c==='"') { tokens.push(this.readString(c)); continue; }
      if (c==='*') { tokens.push(new SqlToken(SQL_TT.STAR,  '*', col)); this.advance(); continue; }
      if (c===',') { tokens.push(new SqlToken(SQL_TT.COMMA, ',', col)); this.advance(); continue; }
      if (c===';') { this.advance(); continue; }
      if (c==='=') { tokens.push(new SqlToken(SQL_TT.EQ,    '=', col)); this.advance(); continue; }
      if (c==='!') {
        this.advance();
        if (this.ch !== '=') throw new SqlError(`Unexpected '!'`, col);
        this.advance(); tokens.push(new SqlToken(SQL_TT.NEQ, '!=', col)); continue;
      }
      if (c==='>') {
        this.advance();
        if (this.ch==='=') { this.advance(); tokens.push(new SqlToken(SQL_TT.GTE,'>=',col)); }
        else tokens.push(new SqlToken(SQL_TT.GT, '>', col));
        continue;
      }
      if (c==='<') {
        this.advance();
        if (this.ch==='=') { this.advance(); tokens.push(new SqlToken(SQL_TT.LTE,'<=',col)); }
        else tokens.push(new SqlToken(SQL_TT.LT, '<', col));
        continue;
      }
      throw new SqlError(`Unexpected character '${c}'`, col);
    }
    tokens.push(new SqlToken(SQL_TT.EOF, null, this.pos));
    return tokens;
  }
}
