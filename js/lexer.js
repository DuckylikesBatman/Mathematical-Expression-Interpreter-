"use strict";

// Token type constants shared across all modules
const TT = Object.freeze({
  NUMBER:'NUMBER', PLUS:'PLUS', MINUS:'MINUS', STAR:'STAR', SLASH:'SLASH',
  LPAREN:'LPAREN', RPAREN:'RPAREN', LBRACKET:'LBRACKET', RBRACKET:'RBRACKET',
  FORWARD:'FORWARD', BACKWARD:'BACKWARD', LEFT:'LEFT', RIGHT:'RIGHT',
  PENUP:'PENUP', PENDOWN:'PENDOWN', REPEAT:'REPEAT', RESET:'RESET',
  IDENT:'IDENT', NEWLINE:'NEWLINE', EOF:'EOF',
});

// A single token produced by the Lexer
class Token {
  constructor(type, value) { this.type = type; this.value = value; }
  toString() { return `Token(${this.type}, ${JSON.stringify(this.value)})`; }
}

// ──────────────────────────────────────────────────────────
//  Lexer  –  Lexical Analysis
//  Reads source text one character at a time and emits
//  a flat array of Token objects.
// ──────────────────────────────────────────────────────────
class Lexer {
  constructor(src) { this.src = src; this.pos = 0; }

  get ch()   { return this.pos < this.src.length ? this.src[this.pos] : null; }
  advance()  { this.pos++; }
  skipWS()   { while (this.ch === ' ' || this.ch === '\t' || this.ch === '\r') this.advance(); }

  readNumber() {
    let s = '';
    while (this.ch && /\d/.test(this.ch))  { s += this.ch; this.advance(); }
    if (this.ch === '.') {
      s += '.'; this.advance();
      while (this.ch && /\d/.test(this.ch)) { s += this.ch; this.advance(); }
    }
    return new Token(TT.NUMBER, parseFloat(s));
  }

  readWord() {
    let s = '';
    while (this.ch && /[A-Za-z_]/.test(this.ch)) { s += this.ch; this.advance(); }
    const kw = {
      FORWARD:TT.FORWARD, FD:TT.FORWARD,
      BACKWARD:TT.BACKWARD, BK:TT.BACKWARD,
      LEFT:TT.LEFT,  LT:TT.LEFT,
      RIGHT:TT.RIGHT, RT:TT.RIGHT,
      PENUP:TT.PENUP,   PU:TT.PENUP,
      PENDOWN:TT.PENDOWN, PD:TT.PENDOWN,
      REPEAT:TT.REPEAT, RESET:TT.RESET,
    };
    return new Token(kw[s.toUpperCase()] ?? TT.IDENT, s.toUpperCase());
  }

  tokenize() {
    const tokens = [];
    while (this.ch !== null) {
      const c = this.ch;
      if      (c===' '||c==='\t'||c==='\r') this.skipWS();
      else if (c==='\n')           { tokens.push(new Token(TT.NEWLINE,'\n')); this.advance(); }
      else if (/\d/.test(c))       { tokens.push(this.readNumber()); }
      else if (/[A-Za-z_]/.test(c)){ tokens.push(this.readWord()); }
      else if (c==='+') { tokens.push(new Token(TT.PLUS,     '+')); this.advance(); }
      else if (c==='-') { tokens.push(new Token(TT.MINUS,    '-')); this.advance(); }
      else if (c==='*') { tokens.push(new Token(TT.STAR,     '*')); this.advance(); }
      else if (c==='/') { tokens.push(new Token(TT.SLASH,    '/')); this.advance(); }
      else if (c==='(') { tokens.push(new Token(TT.LPAREN,   '(')); this.advance(); }
      else if (c===')') { tokens.push(new Token(TT.RPAREN,   ')')); this.advance(); }
      else if (c==='[') { tokens.push(new Token(TT.LBRACKET, '[')); this.advance(); }
      else if (c===']') { tokens.push(new Token(TT.RBRACKET, ']')); this.advance(); }
      else throw new Error(`Unexpected character: '${c}'`);
    }
    tokens.push(new Token(TT.EOF, null));
    return tokens;
  }
}
