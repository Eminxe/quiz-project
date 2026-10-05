"use strict";

const { tex, inline, coef, signed, clean } = require("../format");

// a·x + b = c·x + d with a chosen root (integer or half-integer).
function linear(rng) {
  const root = rng.next() < 0.7 ? rng.intExcept(-12, 12, [0]) : clean(rng.intExcept(-15, 15, [0]) + 0.5);
  const a = rng.intExcept(-9, 9, [0]);
  const c = rng.intExcept(-9, 9, [0, a]);
  const b = rng.intExcept(-20, 20, [0]);
  const d = clean((a - c) * root + b);

  if (!Number.isInteger(d)) return null;

  return {
    prompt: `Найдите корень уравнения ${inline(`${coef(a, "x", { first: true })}${signed(b)} = ${coef(c, "x", { first: true })}${signed(d)}`)}.`,
    answer: root,
    solution: `${inline(`${coef(a, "x", { first: true })}${coef(-c, "x")} = ${tex(d)}${signed(-b)}`)}, ${inline(
      `${coef(a - c, "x", { first: true })} = ${tex(d - b)}`
    )}, ${inline(`x = ${tex(root)}`)}.`
  };
}

// x² + px + q = 0 with integer roots; the answer is the larger or smaller one.
function quadratic(rng) {
  const r1 = rng.intExcept(-9, 9, [0]);
  const r2 = rng.intExcept(-9, 9, [0, r1]);
  const a = rng.pick([1, 1, 1, 2, 3, -1, -2]);
  const p = -a * (r1 + r2);
  const q = a * r1 * r2;
  const larger = rng.next() < 0.5;
  const answer = larger ? Math.max(r1, r2) : Math.min(r1, r2);
  const equation = `${coef(a, "x^2", { first: true })}${p === 0 ? "" : coef(p, "x")}${signed(q)} = 0`;
  const reduced = `x^2${r1 + r2 === 0 ? "" : coef(-(r1 + r2), "x")}${signed(r1 * r2)} = 0`;

  return {
    prompt: `Решите уравнение ${inline(equation)}. Если уравнение имеет более одного корня, в ответ запишите ${
      larger ? "больший" : "меньший"
    } из корней.`,
    answer,
    solution: `${a === 1 ? "" : `Разделим обе части на ${tex(a)}: ${inline(reduced)}. `}По теореме Виета ${inline(`x_1 + x_2 = ${tex(r1 + r2)}`)}, ${inline(`x_1 x_2 = ${tex(r1 * r2)}`)}, откуда ${inline(
      `x_1 = ${Math.min(r1, r2)}`
    )}, ${inline(`x_2 = ${Math.max(r1, r2)}`)}. Ответ: ${tex(answer)}.`
  };
}

// (x + a)/k = (x + b)/m, solved by cross-multiplication.
function proportion(rng) {
  const k = rng.int(2, 9);
  const m = rng.intExcept(2, 9, [k]);
  const root = rng.intExcept(-15, 15, [0]);
  const a = rng.intExcept(-12, 12, [0]);
  // m(x + a) = k(x + b) -> b = (m(root + a) - k·root) / k must be an integer.
  const bNumerator = m * (root + a) - k * root;
  if (bNumerator % k !== 0) return null;
  const b = bNumerator / k;
  if (b === 0 || b === a) return null;

  return {
    prompt: `Найдите корень уравнения ${inline(`\\frac{x${signed(a)}}{${k}} = \\frac{x${signed(b)}}{${m}}`)}.`,
    answer: root,
    solution: `По основному свойству пропорции ${inline(`${m}(x${signed(a)}) = ${k}(x${signed(b)})`)}, ${inline(
      `${coef(m - k, "x", { first: true })} = ${tex(k * b - m * a)}`
    )}, ${inline(`x = ${tex(root)}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 9,
  templates: { linear, quadratic, proportion }
};
