"use strict";

const { tex, frac, inline, gcd, clean } = require("../format");

const DENOMINATORS = [2, 4, 5, 8, 10, 20, 25];

function properFraction(rng) {
  const d = rng.pick(DENOMINATORS);
  let n = rng.int(1, d - 1);
  while (gcd(n, d) !== 1) n = rng.int(1, d - 1);
  return { n, d };
}

// (a/b ± c/d) · k: denominators only have factors 2 and 5, so the answer is
// always a finite decimal, as ОГЭ requires.
function fractionSum(rng) {
  const x = properFraction(rng);
  let y = properFraction(rng);
  while (y.d === x.d && y.n === x.n) y = properFraction(rng);

  const op = rng.pick(["+", "-"]);
  const k = rng.pick([2, 3, 4, 5, 6, 8, 12, 15, 16, 24]);
  const inner = op === "+" ? x.n / x.d + y.n / y.d : x.n / x.d - y.n / y.d;
  const answer = clean(inner * k);

  return {
    prompt: `Найдите значение выражения ${inline(
      `\\left(${frac(x.n, x.d)} ${op} ${frac(y.n, y.d)}\\right) \\cdot ${k}`
    )}.`,
    answer,
    solution: `${inline(
      `\\left(${frac(x.n, x.d)} ${op} ${frac(y.n, y.d)}\\right) \\cdot ${k} = ${frac(x.n, x.d)} \\cdot ${k} ${op} ${frac(y.n, y.d)} \\cdot ${k} = ${tex(answer)}`
    )}.`
  };
}

// a,b / (c,d − e,f): the quotient is chosen first, the numerator is built from it.
function decimalQuotient(rng) {
  const denominator = rng.pick([0.2, 0.4, 0.5, 0.8, 1.2, 1.5, 1.6, 2.5, 0.25]);
  const quotient = rng.intExcept(-9, 9, [0, 1, -1]);
  const numerator = clean(denominator * quotient);
  const minuend = clean(rng.int(11, 59) / 10);
  const subtrahend = clean(minuend - denominator);

  return {
    prompt: `Найдите значение выражения ${inline(
      `\\frac{${tex(numerator)}}{${tex(minuend)} - ${tex(subtrahend)}}`
    )}.`,
    answer: quotient,
    solution: `Знаменатель: ${inline(`${tex(minuend)} - ${tex(subtrahend)} = ${tex(denominator)}`)}. Тогда ${inline(
      `${tex(numerator)} : ${tex(denominator)} = ${tex(quotient)}`
    )}.`
  };
}

// a · (−b)² + c · (−b)
function powers(rng) {
  const a = rng.intExcept(-9, 9, [0]);
  const b = rng.int(2, 6);
  const c = rng.intExcept(-20, 20, [0]);
  const answer = a * b * b + c * -b;

  return {
    prompt: `Найдите значение выражения ${inline(
      `${tex(a)} \\cdot (-${b})^2 ${c < 0 ? "-" : "+"} ${Math.abs(c)} \\cdot (-${b})`
    )}.`,
    answer,
    solution: `${inline(
      `${tex(a)} \\cdot ${b * b} ${c < 0 ? "-" : "+"} ${Math.abs(c)} \\cdot (-${b}) = ${tex(a * b * b)} ${
        c * -b < 0 ? "-" : "+"
      } ${Math.abs(c * b)} = ${tex(answer)}`
    )}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 6,
  templates: { fractionSum, decimalQuotient, powers }
};

