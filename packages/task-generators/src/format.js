"use strict";

// Removes float noise: 0.1 + 0.2 -> 0.3.
function clean(value) {
  return Number(Number(value).toPrecision(12));
}

// Russian decimal comma for plain text answers: 4.75 -> "4,75".
function dec(value) {
  return String(clean(value)).replace(".", ",");
}

// Decimal comma inside LaTeX needs braces, otherwise it gets a space after it.
function tex(value) {
  const text = String(clean(value)).replace(".", "{,}");
  return text.startsWith("-") ? `-${text.slice(1)}` : text;
}

// Number in brackets when negative: used after operators, e.g. 3 \cdot (-2).
function texParen(value) {
  return value < 0 ? `\\left(${tex(value)}\\right)` : tex(value);
}

function frac(n, d) {
  return `\\frac{${n}}{${d}}`;
}

function inline(latex) {
  return `\\(${latex}\\)`;
}

// " + 5", " - 5" for building a polynomial term by term.
function signed(value, { first = false } = {}) {
  if (first) return tex(value);
  return value < 0 ? ` - ${tex(-value)}` : ` + ${tex(value)}`;
}

// Coefficient before a variable: 1 -> "", -1 -> "-", 3 -> "3".
function coef(value, variable, { first = false } = {}) {
  const abs = Math.abs(value);
  const body = `${abs === 1 ? "" : tex(abs)}${variable}`;

  if (first) return value < 0 ? `-${body}` : body;
  return value < 0 ? ` - ${body}` : ` + ${body}`;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

// Decimal places of a number with a finite decimal expansion (up to 6).
function decimalPlaces(value) {
  const text = String(clean(value));
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

module.exports = {
  clean,
  dec,
  tex,
  texParen,
  frac,
  inline,
  signed,
  coef,
  gcd,
  decimalPlaces
};
