"use strict";

const { inline } = require("../format");
const { TRIPLES } = require("./task15");

function inscribedAngle(rng) {
  const central = rng.int(10, 85) * 2;
  const inscribed = central / 2;

  if (rng.next() < 0.5) {
    return {
      prompt: `Точки ${inline("A")}, ${inline("B")} и ${inline("C")} лежат на окружности с центром ${inline(
        "O"
      )}. Центральный угол ${inline("AOB")} равен ${inline(`${central}^\\circ`)}, точка ${inline("C")} лежит на большей дуге ${inline(
        "AB"
      )}. Найдите вписанный угол ${inline("ACB")}. Ответ дайте в градусах.`,
      answer: inscribed,
      solution: `Вписанный угол равен половине центрального, опирающегося на ту же дугу: ${inline(`\\frac{${central}^\\circ}{2} = ${inscribed}^\\circ`)}.`
    };
  }

  return {
    prompt: `Вписанный угол ${inline("ACB")} окружности с центром ${inline("O")} равен ${inline(`${inscribed}^\\circ`)}. Найдите центральный угол ${inline(
      "AOB"
    )}, опирающийся на ту же дугу. Ответ дайте в градусах.`,
    answer: central,
    solution: `Центральный угол вдвое больше вписанного: ${inline(`2 \\cdot ${inscribed}^\\circ = ${central}^\\circ`)}.`
  };
}

function squareRadius(rng) {
  const k = rng.int(2, 25);

  if (rng.next() < 0.5) {
    return {
      prompt: `Радиус окружности, описанной около квадрата, равен ${inline(`${k}\\sqrt{2}`)}. Найдите сторону этого квадрата.`,
      answer: 2 * k,
      solution: `Диагональ квадрата равна диаметру: ${inline(`d = 2R = ${2 * k}\\sqrt{2}`)}. Сторона ${inline(`a = \\frac{d}{\\sqrt{2}} = ${2 * k}`)}.`
    };
  }

  return {
    prompt: `Сторона квадрата равна ${2 * k}. Найдите радиус окружности, вписанной в этот квадрат.`,
    answer: k,
    solution: `Радиус вписанной окружности равен половине стороны: ${inline(`r = \\frac{${2 * k}}{2} = ${k}`)}.`
  };
}

function tangent(rng) {
  const [a, b, c] = rng.pick(TRIPLES);
  const k = c > 20 ? rng.int(1, 2) : rng.int(1, 5);
  const radius = a * k;
  const length = b * k;
  const distance = c * k;

  return {
    prompt: `Из точки ${inline("A")} проведена касательная ${inline("AB")} к окружности с центром ${inline("O")} (${inline(
      "B"
    )} — точка касания). Радиус окружности равен ${radius}, ${inline(`AO = ${distance}`)}. Найдите ${inline("AB")}.`,
    answer: length,
    solution: `Радиус, проведённый в точку касания, перпендикулярен касательной, поэтому треугольник ${inline(
      "ABO"
    )} прямоугольный: ${inline(`AB = \\sqrt{${distance}^2 - ${radius}^2} = ${length}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 16,
  templates: { inscribedAngle, squareRadius, tangent }
};
