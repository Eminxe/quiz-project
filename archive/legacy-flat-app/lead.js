const params = new URLSearchParams(window.location.search);

const testNameEl = document.getElementById("lead-test-name");
const scoreLineEl = document.getElementById("lead-score-line");
const scoreEl = document.getElementById("lead-score");
const percentEl = document.getElementById("lead-percent");
const levelEl = document.getElementById("lead-level");
const levelLabelEl = document.getElementById("lead-level-label");
const weakSkillsEl = document.getElementById("lead-weak-skills");
const recommendationEl = document.getElementById("lead-recommendation");

const nameInput = document.getElementById("lead-name");
const contactInput = document.getElementById("lead-contact");
const goalInput = document.getElementById("lead-goal");

const sendBtn = document.getElementById("lead-send-btn");
const copyBtn = document.getElementById("lead-copy-btn");
const noteEl = document.getElementById("lead-note");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLevelDisplay(rawLevel = "") {
  const original = String(rawLevel || "").trim();
  const level = original.toLowerCase();

  if (!original) {
    return {
      value: "Не определён",
      label: "уровень",
    };
  }

  if (
    level.includes("продвин") ||
    level.includes("advanced") ||
    level.includes("upper")
  ) {
    return {
      value: "Продвинутый",
      label: "уровень",
    };
  }

  if (
    level.includes("сред") ||
    level.includes("intermediate") ||
    level.includes("medium")
  ) {
    return {
      value: "Средний",
      label: "уровень",
    };
  }

  if (
    level.includes("баз") ||
    level.includes("нач") ||
    level.includes("basic") ||
    level.includes("beginner")
  ) {
    return {
      value: "Базовый",
      label: "уровень",
    };
  }

  if (
    level.includes("эксперт") ||
    level.includes("expert") ||
    level.includes("pro")
  ) {
    return {
      value: "Экспертный",
      label: "уровень",
    };
  }

  return {
    value: original,
    label: "уровень",
  };
}

function parseWeakSkills(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== "Существенных провалов не обнаружено");
}

function buildRecommendation(percent, level, weakSkills) {
  if (percent >= 85) {
    return "У вас уже сильная база. Сейчас лучше усиливать сложные задачи, скорость решения и устойчивость на экзамене.";
  }

  if (percent >= 55) {
    if (weakSkills.length) {
      return `База уже есть, но нужно точечно закрыть слабые темы: ${weakSkills.join(", ")}. После этого можно быстро расти дальше.`;
    }
    return "Основа уже собрана, но есть пробелы. Сейчас важно убрать слабые места и закрепить ключевые типы задач.";
  }

  if (weakSkills.length) {
    return `Сейчас лучше спокойно собрать фундамент и выстроить последовательную подготовку, начиная с тем: ${weakSkills.join(", ")}.`;
  }

  return "Сейчас важно спокойно собрать фундамент, закрепить базовые типы задач и выстроить понятный маршрут подготовки.";
}

function buildRequestText() {
  const test = params.get("test") || "Тест";
  const score = params.get("score") || "—";
  const percent = params.get("percent") || "—";
  const level = params.get("level") || "Не указан";
  const weakSkills = parseWeakSkills(params.get("weakSkills") || "");
  const name = nameInput.value.trim() || "Не указано";
  const contact = contactInput.value.trim() || "Не указано";
  const goal = goalInput.value.trim() || "Не указано";

  return [
    "Здравствуйте! Хочу получить план подготовки.",
    "",
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    "",
    `Тест: ${test}`,
    `Результат: ${score}`,
    `Точность: ${percent}%`,
    `Уровень: ${level}`,
    `Слабые темы: ${weakSkills.length ? weakSkills.join(", ") : "не выделены"}`,
    "",
    `Цель: ${goal}`
  ].join("\n");
}

async function copyRequestText() {
  const text = buildRequestText();

  try {
    await navigator.clipboard.writeText(text);
    noteEl.textContent = "Текст заявки скопирован. Теперь его можно отправить в мессенджер.";
  } catch {
    noteEl.textContent = "Не удалось автоматически скопировать текст. Попробуйте ещё раз.";
  }
}

function openTelegram() {
  const text = buildRequestText();
  const url = `https://t.me/share/url?url=${encodeURIComponent("https://ems-math.local")}&text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  noteEl.textContent = "Открылся Telegram с подготовленным текстом заявки.";
}

function fillLeadPage() {
  const test = params.get("test") || "Тест";
  const score = params.get("score") || "—";
  const percent = Number(params.get("percent") || 0);
  const percentText = `${Number.isFinite(percent) ? percent : 0}%`;
  const level = params.get("level") || "Не указан";
  const weakSkills = parseWeakSkills(params.get("weakSkills") || "");
  const displayLevel = normalizeLevelDisplay(level);

  testNameEl.textContent = test;
  scoreLineEl.textContent = `${score} · ${percentText}`;

  scoreEl.textContent = score;
  percentEl.textContent = percentText;
  levelEl.textContent = displayLevel.value;

  if (levelLabelEl) {
    levelLabelEl.textContent = displayLevel.label;
  }

  if (displayLevel.value !== level) {
    levelEl.title = level;
  }

  if (weakSkills.length) {
    weakSkillsEl.innerHTML = weakSkills
      .map((skill) => `<span class="badge badge-light">${escapeHtml(skill)}</span>`)
      .join("");
  } else {
    weakSkillsEl.innerHTML = `<span class="badge badge-light">Сильных провалов нет</span>`;
  }

  recommendationEl.textContent = buildRecommendation(percent, level, weakSkills);
}

if (sendBtn) {
  sendBtn.addEventListener("click", openTelegram);
}

if (copyBtn) {
  copyBtn.addEventListener("click", copyRequestText);
}

fillLeadPage();
