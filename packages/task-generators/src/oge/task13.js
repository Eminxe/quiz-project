"use strict";

const { tex, inline, coef, signed, clean } = require("../format");

// Linear inequality with a choice of four answers; ОГЭ shows them on a
// number line, here they are written as intervals.
function linear(rng) {
  const root = rng.intExcept(-9, 9, [0]);
  const a = rng.intExcept(-6, 6, [0]);
  const c = rng.intExcept(-6, 6, [0, a]);
  const b = rng.intExcept(-15, 15, [0]);
  const d = (a - c) * root + b;
  const sign = rng.pick([">", "<", "\\ge", "\\le"]);
  // a x + b (sign) c x + d  <=>  (a − c) x (sign) (a − c)·root
  const flips = a - c < 0;
  const flipped = { ">": "<", "<": ">", "\\ge": "\\le", "\\le": "\\ge" };
  const finalSign = flips ? flipped[sign] : sign;

  const interval = (s, r) => {
    const v = tex(r);
    if (s === ">") return `(${v}; +\\infty)`;
    if (s === "<") return `(-\\infty; ${v})`;
    if (s === "\\ge") return `[${v}; +\\infty)`;
    return `(-\\infty; ${v}]`;
  };

  const correctText = inline(interval(finalSign, root));
  const distractors = [
    inline(interval(flipped[finalSign], root)),
    inline(interval(finalSign, -root)),
    inline(interval(flipped[finalSign], -root))
  ];
  const options = rng.shuffle([correctText, ...distractors]);

  return {
    type: "single_choice",
    prompt: `Укажите решение неравенства ${inline(
      `${coef(a, "x", { first: true })}${signed(b)} ${sign} ${coef(c, "x", { first: true })}${signed(d)}`
    )}.`,
    options,
    correct: options.indexOf(correctText),
    solution: `${inline(`${coef(a - c, "x", { first: true })} ${sign} ${tex(clean(d - b))}`)}${
      flips ? ", при делении на отрицательное число знак меняется" : ""
    }: ${inline(`x ${finalSign} ${tex(root)}`)}, то есть ${correctText}.`
  };
}

// x² − k² (sign) 0
function quadratic(rng) {
  const k = rng.int(1, 9);
  const sign = rng.pick([">", "<"]);
  const inside = `(-${k}; ${k})`;
  const outside = `(-\\infty; -${k}) \\cup (${k}; +\\infty)`;
  const correctText = inline(sign === "<" ? inside : outside);
  const options = rng.shuffle([
    inline(inside),
    inline(outside),
    inline(`(-\\infty; ${k})`),
    inline(`(-${k}; +\\infty)`)
  ]);

  return {
    type: "single_choice",
    prompt: `Укажите решение неравенства ${inline(`x^2 - ${k * k} ${sign} 0`)}.`,
    options,
    correct: options.indexOf(correctText),
    solution: `${inline(`(x - ${k})(x + ${k}) ${sign} 0`)}. Парабола с ветвями вверх ${
      sign === "<" ? "ниже нуля между корнями" : "выше нуля вне промежутка между корнями"
    }: ${correctText}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 13,
  templates: { linear, quadratic }
};
