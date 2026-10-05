"use strict";

const { tex, inline, clean } = require("../format");
const { TRIPLES } = require("./task15");

function parallelogramAngle(rng) {
  const acute = rng.int(20, 89);

  if (rng.next() < 0.5) {
    return {
      prompt: `Один из углов параллелограмма равен ${inline(`${acute}^\\circ`)}. Найдите больший угол этого параллелограмма. Ответ дайте в градусах.`,
      answer: 180 - acute,
      solution: `Соседние углы параллелограмма в сумме дают ${inline("180^\\circ")}: ${inline(`180^\\circ - ${acute}^\\circ = ${180 - acute}^\\circ`)}.`
    };
  }

  const sum = 2 * acute;
  return {
    prompt: `Сумма двух углов параллелограмма равна ${inline(`${sum}^\\circ`)}. Найдите один из оставшихся углов. Ответ дайте в градусах.`,
    answer: 180 - acute,
    solution: `Равные углы параллелограмма — противоположные, значит каждый из них равен ${inline(
      `${acute}^\\circ`
    )}, а оставшиеся равны ${inline(`180^\\circ - ${acute}^\\circ = ${180 - acute}^\\circ`)}.`
  };
}

function trapezoidArea(rng) {
  const small = rng.int(2, 20);
  const large = small + rng.int(2, 20);
  const height = rng.int(2, 15);
  const answer = clean(((small + large) / 2) * height);

  return {
    prompt: `Основания трапеции равны ${small} и ${large}, а высота равна ${height}. Найдите площадь этой трапеции.`,
    answer,
    solution: `${inline(`S = \\frac{${small} + ${large}}{2} \\cdot ${height} = ${tex(answer)}`)}.`
  };
}

function rhombus(rng) {
  const choice = rng.int(0, 2);

  if (choice === 0) {
    const side = rng.int(2, 25);
    const answer = clean((side * side) / 2);
    return {
      prompt: `Периметр ромба равен ${4 * side}, а один из углов равен ${inline("30^\\circ")}. Найдите площадь этого ромба.`,
      answer,
      solution: `Сторона ${inline(`a = \\frac{${4 * side}}{4} = ${side}`)}. ${inline(
        `S = a^2 \\sin 30^\\circ = ${side * side} \\cdot \\frac{1}{2} = ${tex(answer)}`
      )}.`
    };
  }

  const [a, b, c] = rng.pick(TRIPLES.slice(0, 4));
  const k = rng.int(1, 2);
  const d1 = 2 * a * k;
  const d2 = 2 * b * k;

  if (choice === 1) {
    return {
      prompt: `Диагонали ромба равны ${d1} и ${d2}. Найдите сторону ромба.`,
      answer: c * k,
      solution: `Диагонали ромба перпендикулярны и делятся точкой пересечения пополам: ${inline(
        `a = \\sqrt{${a * k}^2 + ${b * k}^2} = ${c * k}`
      )}.`
    };
  }

  return {
    prompt: `Диагонали ромба равны ${d1} и ${d2}. Найдите площадь ромба.`,
    answer: (d1 * d2) / 2,
    solution: `${inline(`S = \\frac{d_1 d_2}{2} = \\frac{${d1} \\cdot ${d2}}{2} = ${(d1 * d2) / 2}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 17,
  templates: { parallelogramAngle, trapezoidArea, rhombus }
};
