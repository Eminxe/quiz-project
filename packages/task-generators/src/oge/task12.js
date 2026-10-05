"use strict";

const { tex, dec, inline, clean } = require("../format");

// P = I²R, find R.
function power(rng) {
  const current = rng.pick([1.5, 2, 2.5, 3, 4, 5, 6]);
  const resistance = rng.int(2, 30);
  const p = clean(current * current * resistance);

  return {
    prompt: `Мощность постоянного тока (в ваттах) вычисляется по формуле ${inline("P = I^2 R")}, где ${inline("I")} — сила тока (в амперах), ${inline(
      "R"
    )} — сопротивление (в омах). Пользуясь этой формулой, найдите сопротивление ${inline("R")}, если мощность составляет ${dec(p)} Вт, а сила тока равна ${dec(current)} А. Ответ дайте в омах.`,
    answer: resistance,
    solution: `${inline(`R = \\frac{P}{I^2} = \\frac{${tex(p)}}{${tex(current)}^2} = \\frac{${tex(p)}}{${tex(clean(current * current))}} = ${resistance}`)}.`
  };
}

// t_F = 1,8·t_C + 32, find t_C.
function temperature(rng) {
  const celsius = rng.intExcept(-40, 100, [0]);
  const fahrenheit = clean(1.8 * celsius + 32);

  return {
    prompt: `Чтобы перевести значение температуры по шкале Цельсия в шкалу Фаренгейта, пользуются формулой ${inline(
      "t_F = 1{,}8 t_C + 32"
    )}, где ${inline("t_C")} — температура в градусах Цельсия, ${inline("t_F")} — температура в градусах Фаренгейта. Скольким градусам по шкале Цельсия соответствует ${dec(fahrenheit)} градусов по шкале Фаренгейта?`,
    answer: celsius,
    solution: `${inline(`t_C = \\frac{t_F - 32}{1{,}8} = \\frac{${tex(fahrenheit)} - 32}{1{,}8} = ${tex(celsius)}`)}.`
  };
}

// C = a + b·n, find n.
function cost(rng) {
  const fixed = rng.pick([4000, 5000, 6000, 7500, 8000]);
  const perRing = rng.pick([3500, 4100, 4500, 5200, 6000]);
  const rings = rng.int(3, 15);
  const total = fixed + perRing * rings;

  return {
    prompt: `Стоимость колодца из железобетонных колец рассчитывается по формуле ${inline(
      `C = ${fixed} + ${perRing} n`
    )}, где ${inline("n")} — число колец, установленных в колодце. Пользуясь этой формулой, найдите, сколько колец в колодце стоимостью ${total} рублей.`,
    answer: rings,
    solution: `${inline(`${perRing} n = ${total} - ${fixed} = ${total - fixed}`)}, ${inline(`n = ${rings}`)}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 12,
  templates: { power, temperature, cost }
};
