const form = document.getElementById("generator-form");

const topicInput = document.getElementById("gen-topic");
const subtopicInput = document.getElementById("gen-subtopic");
const languageInput = document.getElementById("gen-language");
const formatInput = document.getElementById("gen-format");
const levelInput = document.getElementById("gen-level");
const questionsInput = document.getElementById("gen-questions");
const audienceInput = document.getElementById("gen-audience");
const goalInput = document.getElementById("gen-goal");
const toneInput = document.getElementById("gen-tone");
const explanationStyleInput = document.getElementById("gen-explanation-style");
const visualStyleInput = document.getElementById("gen-visual-style");

const submitBtn = document.getElementById("gen-submit");
const resetBtn = document.getElementById("gen-reset");

const statusBox = document.getElementById("generator-status");
const resultBox = document.getElementById("generator-result");

const STORAGE_KEY = "ems_math_generator_form_v2";
const QUESTION_TYPE_SELECTOR = 'input[name="gen-types"]';

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(type, title, text) {
  if (!statusBox) return;

  statusBox.className = `generator-status generator-status-${type}`;
  statusBox.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(text)}</span>
  `;
}

function setLoadingState(isLoading) {
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Генерируем тест..." : "Сгенерировать тест";
  }

  if (resetBtn) {
    resetBtn.disabled = isLoading;
  }

  const typeInputs = document.querySelectorAll(QUESTION_TYPE_SELECTOR);
  typeInputs.forEach((input) => {
    input.disabled = isLoading;
  });
}

function getSelectedQuestionTypes() {
  const typeInputs = document.querySelectorAll(QUESTION_TYPE_SELECTOR);
  return Array.from(typeInputs)
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function setSelectedQuestionTypes(values) {
  const set = new Set(Array.isArray(values) ? values : []);
  const typeInputs = document.querySelectorAll(QUESTION_TYPE_SELECTOR);

  typeInputs.forEach((input) => {
    input.checked = set.size ? set.has(input.value) : true;
  });
}

function saveFormState() {
  if (!topicInput) return;

  const data = {
    topic: topicInput.value,
    subtopic: subtopicInput?.value || "",
    language: languageInput?.value || "ru",
    examFormat: formatInput?.value || "custom",
    level: levelInput?.value || "",
    questionCount: questionsInput?.value || "8",
    audience: audienceInput?.value || "",
    goal: goalInput?.value || "diagnostic",
    tone: toneInput?.value || "exam-ready",
    explanationStyle: explanationStyleInput?.value || "detailed",
    visualStyle: visualStyleInput?.value || "standard",
    enabledTypes: getSelectedQuestionTypes(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreFormState() {
  if (!topicInput) return;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    topicInput.value = data.topic || "";
    if (subtopicInput) subtopicInput.value = data.subtopic || "";
    if (languageInput) languageInput.value = data.language || "ru";
    if (formatInput) formatInput.value = data.examFormat || "custom";
    if (levelInput) levelInput.value = data.level || "";
    if (questionsInput) questionsInput.value = data.questionCount || "8";
    if (audienceInput) audienceInput.value = data.audience || "";
    if (goalInput) goalInput.value = data.goal || "diagnostic";
    if (toneInput) toneInput.value = data.tone || "exam-ready";
    if (explanationStyleInput) explanationStyleInput.value = data.explanationStyle || "detailed";
    if (visualStyleInput) visualStyleInput.value = data.visualStyle || "standard";

    setSelectedQuestionTypes(
      Array.isArray(data.enabledTypes) && data.enabledTypes.length
        ? data.enabledTypes
        : ["single", "numeric", "short_text", "find_error", "order_steps"]
    );
  } catch {
    // ignore
  }
}

function resetForm() {
  if (!topicInput) return;

  topicInput.value = "";
  if (subtopicInput) subtopicInput.value = "";
  if (languageInput) languageInput.value = "ru";
  if (formatInput) formatInput.value = "custom";
  if (levelInput) levelInput.value = "";
  if (questionsInput) questionsInput.value = "8";
  if (audienceInput) audienceInput.value = "";
  if (goalInput) goalInput.value = "diagnostic";
  if (toneInput) toneInput.value = "exam-ready";
  if (explanationStyleInput) explanationStyleInput.value = "detailed";
  if (visualStyleInput) visualStyleInput.value = "standard";

  setSelectedQuestionTypes(["single", "numeric", "short_text", "find_error", "order_steps"]);

  localStorage.removeItem(STORAGE_KEY);

  if (resultBox) {
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";
  }

  setStatus(
    "idle",
    "Готов к генерации",
    "Заполни параметры и запусти создание нового теста. На сайт выводятся только чистые статусы без технических логов."
  );
}

function clampQuestionCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(30, Math.round(n)));
}

function buildPayload() {
  return {
    topic: topicInput.value.trim(),
    subtopic: subtopicInput?.value.trim() || "",
    language: languageInput?.value || "ru",
    examFormat: formatInput?.value || "custom",
    level: levelInput.value.trim(),
    questionCount: clampQuestionCount(questionsInput.value),
    audience: audienceInput.value.trim(),
    goal: goalInput?.value || "diagnostic",
    tone: toneInput.value.trim(),
    explanationStyle: explanationStyleInput?.value || "detailed",
    visualStyle: visualStyleInput?.value || "standard",
    enabledTypes: getSelectedQuestionTypes(),
  };
}

function validatePayload(payload) {
  if (!payload.topic) {
    throw new Error("Укажи тему теста.");
  }

  if (!payload.level) {
    throw new Error("Выбери уровень.");
  }

  if (!payload.audience) {
    throw new Error("Укажи аудиторию.");
  }

  if (!payload.tone) {
    throw new Error("Выбери стиль.");
  }

  if (!Number.isInteger(payload.questionCount) || payload.questionCount < 1 || payload.questionCount > 30) {
    throw new Error("Количество вопросов должно быть от 1 до 30.");
  }

  if (!Array.isArray(payload.enabledTypes) || payload.enabledTypes.length === 0) {
    throw new Error("Выбери хотя бы один тип задания.");
  }
}

function formatLabel(payload) {
  const languageMap = {
    ru: "Русский",
    en: "English",
  };

  const formatMap = {
    custom: "Custom",
    oge: "ОГЭ",
    ege: "ЕГЭ",
    sat: "SAT",
    gcse: "GCSE",
    ib: "IB",
    maxb: "MaxB",
  };

  return {
    language: languageMap[payload.language] || payload.language,
    examFormat: formatMap[payload.examFormat] || payload.examFormat,
  };
}

function renderResult(data, payload) {
  if (!resultBox) return;

  const labels = formatLabel(payload);

const visualsSummary = data.visuals?.ok
  ? "Визуализации обработаны и добавлены к тесту."
  : data.visuals?.pending
    ? "Тест уже создан. Визуальный слой запускается отдельно и может появиться чуть позже."
    : "Тест создан. Часть визуалов могла не сгенерироваться автоматически.";

  resultBox.classList.remove("hidden");
  resultBox.innerHTML = `
    <div class="generator-result-head">
      <h4>${escapeHtml(data.title || "Новый тест")}</h4>
      <span class="badge badge-accent">Готово</span>
    </div>

    <p>Тест успешно создан и добавлен в каталог EMS MATH.</p>

    <div class="generator-mini-list">
      <div class="generator-mini-box">
        <strong>Язык</strong>
        <span>${escapeHtml(labels.language)}</span>
      </div>

      <div class="generator-mini-box">
        <strong>Формат</strong>
        <span>${escapeHtml(labels.examFormat)}</span>
      </div>

      <div class="generator-mini-box">
        <strong>Вопросов</strong>
        <span>${escapeHtml(String(payload.questionCount))}</span>
      </div>
    </div>

<div class="generator-status ${
  data.visuals?.ok
    ? "generator-status-success"
    : data.visuals?.pending
      ? "generator-status-pending"
      : "generator-status-pending"
}" style="margin-top:14px;">
  <strong>${
    data.visuals?.ok
      ? "Визуалы готовы"
      : data.visuals?.pending
        ? "Визуалы запускаются"
        : "Визуалы обработаны частично"
  }</strong>
  <span>${escapeHtml(visualsSummary)}</span>
</div>

    <div class="generator-result-actions">
      <a class="btn" href="${escapeHtml(data.openUrl)}">Открыть тест</a>
      <a class="secondary-btn" href="#catalog">К каталогу</a>
    </div>
  `;
}

async function generateTest(payload) {
  const response = await fetch("/api/generate-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.ok) {
    const message =
      data?.message ||
      "Не удалось сгенерировать тест. Проверь, запущен ли Node-сервер.";
    throw new Error(message);
  }

  return data;
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = buildPayload();

  try {
    validatePayload(payload);
  } catch (error) {
    setStatus("error", "Проверь параметры", String(error.message || error));
    return;
  }

  saveFormState();
  setLoadingState(true);

  if (resultBox) {
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";
  }

  setStatus(
    "pending",
    "Идёт генерация",
    "Создаём качественный тест, проверяем структуру заданий и подготавливаем визуальный слой."
  );

  try {
    const data = await generateTest(payload);

    setStatus(
      "success",
      "Тест готов",
      "Новый вариант создан. Можно открыть его сразу или вернуться к каталогу."
    );

    renderResult(data, payload);

    if (typeof window.renderCatalog === "function") {
      window.renderCatalog().catch(() => {});
    }
  } catch (error) {
    const message = String(error.message || error);

    if (message.includes("Failed to fetch")) {
      setStatus(
        "error",
        "Нет соединения с сервером",
        "Запусти сайт через Node-сервер: npm.cmd run dev. Live Server для генерации не подходит."
      );
    } else {
      setStatus("error", "Ошибка генерации", message);
    }
  } finally {
    setLoadingState(false);
  }
}

function bindFormPersistence() {
  const inputs = [
    topicInput,
    subtopicInput,
    languageInput,
    formatInput,
    levelInput,
    questionsInput,
    audienceInput,
    goalInput,
    toneInput,
    explanationStyleInput,
    visualStyleInput,
  ];

  inputs.forEach((element) => {
    if (!element) return;
    element.addEventListener("input", saveFormState);
    element.addEventListener("change", saveFormState);
  });

  const typeInputs = document.querySelectorAll(QUESTION_TYPE_SELECTOR);
  typeInputs.forEach((input) => {
    input.addEventListener("change", saveFormState);
  });
}

function initHomeGenerator() {
  if (!form) return;

  restoreFormState();
  bindFormPersistence();

  form.addEventListener("submit", handleSubmit);

  if (resetBtn) {
    resetBtn.addEventListener("click", resetForm);
  }

  if (questionsInput) {
    questionsInput.addEventListener("blur", () => {
      questionsInput.value = String(clampQuestionCount(questionsInput.value));
      saveFormState();
    });
  }

  setStatus(
    "idle",
    "Готов к генерации",
    "Выбери тему, формат, язык и параметры. Генератор соберёт тест и добавит его в каталог."
  );
}

initHomeGenerator();