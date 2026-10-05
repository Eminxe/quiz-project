"use strict";

const { tex, inline, clean } = require("../format");

// a^m · a^n / a^k with a small resulting power.
function powerRules(rng) {
  const a = rng.pick([2, 3, 4, 5, 6, 7]);
  const result = rng.pick([1, 2, 2, 3]);
  const m = rng.int(3, 12);
  const n = rng.int(2, 9);
  const k = m + n - result;
  const variable = rng.pick(["a", "b", "x"]);
  const answer = a ** result;

  return {
    prompt: `Найдите значение выражения ${inline(
      `\\frac{${variable}^{${m}} \\cdot ${variable}^{${n}}}{${variable}^{${k}}}`
    )} при ${inline(`${variable} = ${a}`)}.`,
    answer,
    solution: `${inline(
      `\\frac{${variable}^{${m}} \\cdot ${variable}^{${n}}}{${variable}^{${k}}} = ${variable}^{${m} + ${n} - ${k}} = ${variable}^{${result}}`
    )}. При ${inline(`${variable} = ${a}`)} получаем ${inline(`${a}^{${result}} = ${answer}`)}.`
  };
}

// √(k·a²) · √(k·b²) = k·a·b
function rootProduct(rng) {
  const k = rng.pick([2, 3, 5, 6, 7, 10, 11]);
  const a = rng.int(1, 6);
  let b = rng.int(2, 7);
  while (b === a) b = rng.int(2, 7);
  const answer = k * a * b;

  return {
    prompt: `Найдите значение выражения ${inline(`\\sqrt{${k * a * a}} \\cdot \\sqrt{${k * b * b}}`)}.`,
    answer,
    solution: `${inline(
      `\\sqrt{${k * a * a} \\cdot ${k * b * b}} = \\sqrt{${k}^2 \\cdot ${a}^2 \\cdot ${b}^2} = ${k} \\cdot ${a} \\cdot ${b} = ${answer}`
    )}.`
  };
}

// (x² − c²)/(x − c) = x + c, evaluated at a decimal x.
function shortMultiplication(rng) {
  const c = rng.int(2, 9);
  let x = clean(rng.int(-90, 90) / 10);
  while (x === c || x === -c || Number.isInteger(x)) x = clean(rng.int(-90, 90) / 10);
  const answer = clean(x + c);

  return {
    prompt: `Найдите значение выражения ${inline(`\\frac{x^2 - ${c * c}}{x - ${c}}`)} при ${inline(`x = ${tex(x)}`)}.`,
    answer,
    solution: `${inline(
      `\\frac{x^2 - ${c * c}}{x - ${c}} = \\frac{(x - ${c})(x + ${c})}{x - ${c}} = x + ${c}`
    )}. При ${inline(`x = ${tex(x)}`)}: ${inline(`${tex(x)} + ${c} = ${tex(answer)}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 8,
  templates: { powerRules, rootProduct, shortMultiplication }
};

