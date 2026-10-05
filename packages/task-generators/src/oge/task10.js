"use strict";

const { dec, frac, inline, clean } = require("../format");

// Totals with only factors 2 and 5 give a finite decimal probability.
const TOTALS = [10, 20, 25, 40, 50, 80, 100, 125, 200, 250];

const SETS = [
  { place: "На тарелке лежат пирожки", items: ["с мясом", "с капустой", "с вишней"], noun: "пирожок" },
  { place: "В коробке лежат конфеты", items: ["в красной обёртке", "в синей обёртке", "в золотой обёртке"], noun: "конфета" },
  { place: "В фирме такси имеются машины", items: ["жёлтого цвета", "чёрного цвета", "белого цвета"], noun: "машина" }
];

function classic(rng) {
  const set = rng.pick(SETS);
  const total = rng.pick(TOTALS.filter((t) => t <= 100));
  const first = rng.int(1, total - 2);
  const second = rng.int(1, total - first - 1);
  const third = total - first - second;
  const counts = [first, second, third];
  const target = rng.int(0, 2);
  const answer = clean(counts[target] / total);

  const listing = set.items.map((item, i) => `${counts[i]} ${item}`).join(", ");
  const adjective = set.noun === "пирожок" ? "случайный пирожок окажется" : set.noun === "конфета" ? "случайно выбранная конфета окажется" : "к заказчику приедет машина";

  return {
    prompt: `${set.place}: ${listing}. Найдите вероятность того, что ${adjective} ${set.items[target]}.`,
    answer,
    solution: `Всего ${total} равновозможных исходов, благоприятных ${counts[target]}. ${inline(
      `P = ${frac(counts[target], total)} = ${dec(answer).replace(",", "{,}")}`
    )}.`
  };
}

// Defective items: probability that a random item is fine.
function defects(rng) {
  const total = rng.pick(TOTALS.filter((t) => t >= 50));
  const bad = rng.int(1, Math.floor(total / 10));
  const product = rng.pick(["фонариков", "насосов", "чайников", "наушников"]);
  const answer = clean((total - bad) / total);

  return {
    prompt: `В среднем из ${total} ${product}, поступивших в продажу, ${bad} неисправны. Найдите вероятность того, что один случайно выбранный в магазине товар окажется исправен.`,
    answer,
    solution: `Исправных ${total} − ${bad} = ${total - bad}. ${inline(
      `P = ${frac(total - bad, total)} = ${dec(answer).replace(",", "{,}")}`
    )}.`
  };
}

const BINOMIAL = { 2: [1, 2, 1], 3: [1, 3, 3, 1] };

// n coin tosses, exactly k heads: C(n, k) / 2ⁿ.
function coins(rng) {
  const n = rng.pick([2, 3]);
  const k = rng.int(0, n);
  const favourable = BINOMIAL[n][k];
  const total = 2 ** n;
  const answer = clean(favourable / total);
  const times = n === 2 ? "дважды" : "трижды";
  const event = k === 0 ? "орёл не выпадет ни разу" : k === 1 ? "орёл выпадет ровно один раз" : `орёл выпадет ровно ${k} раза`;

  return {
    prompt: `Симметричную монету бросают ${times}. Найдите вероятность того, что ${event}.`,
    answer,
    solution: `Всего ${inline(`2^${n} = ${total}`)} равновозможных исходов, благоприятных ${favourable}. ${inline(
      `P = ${frac(favourable, total)} = ${dec(answer).replace(",", "{,}")}`
    )}.`
  };
}

module.exports = {
  examType: "OGE",
  taskNumber: 10,
  templates: { classic, defects, coins }
};
