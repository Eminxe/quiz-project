"use strict";

const { inline } = require("../format");

// Arithmetic progression in a story: seats per row in an amphitheatre.
function amphitheatre(rng) {
  const first = rng.int(10, 30);
  const step = rng.int(2, 5);
  const rows = rng.int(8, 20);
  const askTotal = rng.next() < 0.5;
  const row = rng.int(4, rows);
  const answer = askTotal ? ((2 * first + step * (rows - 1)) * rows) / 2 : first + step * (row - 1);

  return {
    prompt: `В амфитеатре ${rows} рядов. В первом ряду ${first} мест, а в каждом следующем на ${step} ${step === 5 ? "мест" : "места"} больше, чем в предыдущем. ${
      askTotal ? "Сколько всего мест в амфитеатре?" : `Сколько мест в ${row}-м ряду амфитеатра?`
    }`,
    answer,
    solution: askTotal
      ? `Арифметическая прогрессия, ${inline(`a_1 = ${first}`)}, ${inline(`d = ${step}`)}. ${inline(
          `S_{${rows}} = \\frac{2a_1 + ${rows - 1}d}{2} \\cdot ${rows} = \\frac{${2 * first} + ${step * (rows - 1)}}{2} \\cdot ${rows} = ${answer}`
        )}.`
      : `Арифметическая прогрессия, ${inline(`a_1 = ${first}`)}, ${inline(`d = ${step}`)}. ${inline(
          `a_{${row}} = a_1 + ${row - 1}d = ${first} + ${row - 1} \\cdot ${step} = ${answer}`
        )}.`
  };
}

// Geometric progression: bacteria doubling / tripling.
function bacteria(rng) {
  const start = rng.int(2, 9) * 10;
  const ratio = rng.pick([2, 2, 3]);
  const period = rng.pick([10, 15, 20, 30]);
  const steps = rng.int(3, ratio === 2 ? 7 : 5);
  const answer = start * ratio ** steps;

  return {
    prompt: `В колонии ${start} бактерий. Каждые ${period} минут число бактерий увеличивается в ${ratio} раза. Сколько бактерий будет в колонии через ${
      period * steps
    } минут?`,
    answer,
    solution: `Число увеличений: ${inline(`${period * steps} : ${period} = ${steps}`)}. ${inline(
      `${start} \\cdot ${ratio}^{${steps}} = ${answer}`
    )}.`
  };
}

// a_n = a_1 + (n − 1)d given by two terms.
function termByFormula(rng) {
  const first = rng.intExcept(-20, 20, [0]);
  const step = rng.intExcept(-7, 7, [0]);
  const n = rng.int(10, 40);
  const answer = first + (n - 1) * step;

  return {
    prompt: `Выписаны первые несколько членов арифметической прогрессии: ${[0, 1, 2]
      .map((i) => first + i * step)
      .join("; ")}; … Найдите ${inline(`a_{${n}}`)}.`,
    answer,
    solution: `${inline(`d = ${step}`)}, ${inline(
      `a_{${n}} = a_1 + ${n - 1}d = ${first} + ${n - 1} \\cdot ${step < 0 ? `(${step})` : step} = ${answer}`
    )}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 14,
  templates: { amphitheatre, bacteria, termByFormula }
};
