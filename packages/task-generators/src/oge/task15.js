"use strict";

const { tex, inline, clean } = require("../format");

const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41]
];

function scaledTriple(rng) {
  const [a, b, c] = rng.pick(TRIPLES);
  const k = c > 20 ? rng.int(1, 2) : rng.int(1, 6);
  return [a * k, b * k, c * k];
}

function pythagoras(rng) {
  const [a, b, c] = scaledTriple(rng);
  const askHypotenuse = rng.next() < 0.5;

  if (askHypotenuse) {
    return {
      prompt: `Катеты прямоугольного треугольника равны ${a} и ${b}. Найдите гипотенузу этого треугольника.`,
      answer: c,
      solution: `${inline(`c = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}`)}.`
    };
  }

  return {
    prompt: `В прямоугольном треугольнике гипотенуза равна ${c}, а один из катетов равен ${a}. Найдите другой катет.`,
    answer: b,
    solution: `${inline(`b = \\sqrt{${c}^2 - ${a}^2} = \\sqrt{${c * c - a * a}} = ${b}`)}.`
  };
}

function angles(rng) {
  if (rng.next() < 0.5) {
    const vertex = rng.int(10, 85) * 2;
    const base = (180 - vertex) / 2;
    return {
      prompt: `В равнобедренном треугольнике угол при вершине, противолежащей основанию, равен ${inline(`${vertex}^\\circ`)}. Найдите угол при основании. Ответ дайте в градусах.`,
      answer: base,
      solution: `Углы при основании равны: ${inline(`\\frac{180^\\circ - ${vertex}^\\circ}{2} = ${base}^\\circ`)}.`
    };
  }

  const a = rng.int(20, 100);
  const b = rng.int(15, 160 - a);
  const answer = 180 - a - b;
  return {
    prompt: `В треугольнике ${inline("ABC")} угол ${inline("A")} равен ${inline(`${a}^\\circ`)}, угол ${inline("B")} равен ${inline(`${b}^\\circ`)}. Найдите угол ${inline("C")}. Ответ дайте в градусах.`,
    answer,
    solution: `${inline(`\\angle C = 180^\\circ - ${a}^\\circ - ${b}^\\circ = ${answer}^\\circ`)}.`
  };
}

function midline(rng) {
  const side = rng.int(3, 99);
  const answer = clean(side / 2);
  return {
    prompt: `Точки ${inline("M")} и ${inline("N")} являются серединами сторон ${inline("AB")} и ${inline("BC")} треугольника ${inline(
      "ABC"
    )}, сторона ${inline("AC")} равна ${side}. Найдите ${inline("MN")}.`,
    answer,
    solution: `${inline("MN")} — средняя линия, она равна половине ${inline("AC")}: ${inline(`MN = \\frac{${side}}{2} = ${tex(answer)}`)}.`
  };
}

function areaSine(rng) {
  const a = rng.int(3, 20);
  const b = rng.int(2, 20);
  const answer = clean((a * b) / 4);
  return {
    prompt: `В треугольнике две стороны равны ${a} и ${b}, а угол между ними равен ${inline("30^\\circ")}. Найдите площадь этого треугольника.`,
    answer,
    solution: `${inline(`S = \\frac{1}{2} \\cdot ${a} \\cdot ${b} \\cdot \\sin 30^\\circ = \\frac{1}{2} \\cdot ${a * b} \\cdot \\frac{1}{2} = ${tex(answer)}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 15,
  templates: { pythagoras, angles, midline, areaSine },
  TRIPLES
};
