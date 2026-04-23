"use strict";

const TT = Object.freeze({
  NUMBER:'NUMBER', PLUS:'PLUS', MINUS:'MINUS', STAR:'STAR', SLASH:'SLASH', PERCENT:'PERCENT',
  LPAREN:'LPAREN', RPAREN:'RPAREN', LBRACKET:'LBRACKET', RBRACKET:'RBRACKET',
  COMMA:'COMMA', EQUALS:'EQUALS',
  FORWARD:'FORWARD', BACKWARD:'BACKWARD', LEFT:'LEFT', RIGHT:'RIGHT',
  PENUP:'PENUP', PENDOWN:'PENDOWN', PENCOLOR:'PENCOLOR',
  REPEAT:'REPEAT', RESET:'RESET', SET:'SET', SETPOS:'SETPOS',
  IDENT:'IDENT', NEWLINE:'NEWLINE', EOF:'EOF',
});

class Token {
  constructor(type, value, line = 1) {
    this.type  = type;
    this.value = value;
    this.line  = line;
  }
  toString() { return `Token(${this.type}, ${JSON.stringify(this.value)})`; }
}

// ──────────────────────────────────────────────────────────
//  Lexer  –  Lexical Analysis
//  Reads source text one character at a time and emits
//  a flat array of Token objects, with line numbers attached.
//
//  Supported extras over baseline:
//    • # comments (skip to end of line)
//    • SET / SETPOS keywords
//    • PENCOLOR / PC keyword
//    • COMMA ','  EQUALS '='  PERCENT '%'
// ──────────────────────────────────────────────────────────
class Lexer {
  constructor(src) { this.src = src; this.pos = 0; this.line = 1; }

  get ch() { return this.pos < this.src.length ? this.src[this.pos] : null; }

  advance() {
    if (this.src[this.pos] === '\n') this.line++;
    this.pos++;
  }

  skipWS() { while (this.ch === ' ' || this.ch === '\t' || this.ch === '\r') this.advance(); }

  readNumber() {
    const ln = this.line;
    let s = '';
    while (this.ch && /\d/.test(this.ch))  { s += this.ch; this.advance(); }
    if (this.ch === '.') {
      s += '.'; this.advance();
      while (this.ch && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    }
    return new Token(TT.NUMBER, parseFloat(s), ln);
  }

  readWord() {
    const ln = this.line;
    let s = '';
    while (this.ch && /[A-Za-z_0-9]/.test(this.ch)) { s += this.ch; this.advance(); }
    const upper = s.toUpperCase();
    const kw = {
      FORWARD:TT.FORWARD,   FD:TT.FORWARD,
      BACKWARD:TT.BACKWARD, BK:TT.BACKWARD,
      LEFT:TT.LEFT,         LT:TT.LEFT,
      RIGHT:TT.RIGHT,       RT:TT.RIGHT,
      PENUP:TT.PENUP,       PU:TT.PENUP,
      PENDOWN:TT.PENDOWN,   PD:TT.PENDOWN,
      PENCOLOR:TT.PENCOLOR, PC:TT.PENCOLOR,
      REPEAT:TT.REPEAT,     RESET:TT.RESET,
      SET:TT.SET,           SETPOS:TT.SETPOS,
    };
    // Keywords are stored uppercase; identifiers keep original casing
    if (upper in kw) return new Token(kw[upper], upper, ln);
    return new Token(TT.IDENT, s, ln);
  }

  tokenize() {
    const tokens = [];
    while (this.ch !== null) {
      const c  = this.ch;
      const ln = this.line;
      if (c === '#') {
        // Line comment – skip everything until newline
        while (this.ch && this.ch !== '\n') this.advance();
      } else if (c===' '||c==='\t'||c==='\r') this.skipWS();
      else if (c==='\n') { tokens.push(new Token(TT.NEWLINE, '\n', ln)); this.advance(); }
      else if (/\d/.test(c))        { tokens.push(this.readNumber()); }
      else if (/[A-Za-z_]/.test(c)) { tokens.push(this.readWord());   }
      else if (c==='+') { tokens.push(new Token(TT.PLUS,     '+', ln)); this.advance(); }
      else if (c==='-') { tokens.push(new Token(TT.MINUS,    '-', ln)); this.advance(); }
      else if (c==='*') { tokens.push(new Token(TT.STAR,     '*', ln)); this.advance(); }
      else if (c==='/') { tokens.push(new Token(TT.SLASH,    '/', ln)); this.advance(); }
      else if (c==='%') { tokens.push(new Token(TT.PERCENT,  '%', ln)); this.advance(); }
      else if (c==='(') { tokens.push(new Token(TT.LPAREN,   '(', ln)); this.advance(); }
      else if (c===')') { tokens.push(new Token(TT.RPAREN,   ')', ln)); this.advance(); }
      else if (c==='[') { tokens.push(new Token(TT.LBRACKET, '[', ln)); this.advance(); }
      else if (c===']') { tokens.push(new Token(TT.RBRACKET, ']', ln)); this.advance(); }
      else if (c===',') { tokens.push(new Token(TT.COMMA,    ',', ln)); this.advance(); }
      else if (c==='=') { tokens.push(new Token(TT.EQUALS,   '=', ln)); this.advance(); }
      else throw new Error(`Line ${this.line}: Unexpected character: '${c}'`);
    }
    tokens.push(new Token(TT.EOF, null, this.line));
    return tokens;
  }
}
