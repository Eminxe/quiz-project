const params = new URLSearchParams(window.location.search);
const testId = params.get("id");

const titleEl = document.getElementById("test-title");
const descriptionEl = document.getElementById("test-description");
const quizBox = document.getElementById("quiz-box");
const resultBox = document.getElementById("result-box");

const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const quizActions = document.getElementById("quiz-actions");

const progressText = document.getElementById("progress-text");
const progressCounter = document.getElementById("progress-counter");
const progressFill = document.getElementById("progress-fill");

const CATALOG_URL = "/tests/catalog.json";

let currentQuestionIndex = 0;
let testData = null;
let answers = [];
let completed = false;

const storageKey = testId ? `quiz_state_${testId}` : "quiz_state_unknown";

async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить каталог тестов: ${CATALOG_URL}`);
  }

  const catalog = await response.json();

  if (!Array.isArray(catalog)) {
    throw new Error("Файл tests/catalog.json должен содержать массив.");
  }

  return catalog;
}

async function loadTestMetaById(id) {
  const catalog = await loadCatalog();
  const meta = catalog.find((item) => item.id === id);

  if (!meta) {
    throw new Error(`Тест с id "${id}" не найден в каталоге.`);
  }

  if (!meta.file || typeof meta.file !== "string") {
    throw new Error(`У теста "${id}" не указан путь к JSON-файлу.`);
  }

  return meta;
}

function normalizeLatexText(text = "") {
  return String(text || "")
    .replaceAll("$begin:math:text$", "\\(")
    .replaceAll("$end:math:text$", "\\)")
    .replaceAll("$begin:display:math$", "\\[")
    .replaceAll("$end:display:math$", "\\]")
    .replaceAll("\\\\(", "\\(")
    .replaceAll("\\\\)", "\\)")
    .replaceAll("\\\\[", "\\[")
    .replaceAll("\\\\]", "\\]")
    .trim();
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value = "") {
  return escapeHtml(value);
}

function renderMathSafe(element) {
  if (!element) return;

  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
      return;
    } catch (_) {}
  }

  if (
    window.MathJax &&
    typeof window.MathJax.typesetPromise === "function"
  ) {
    window.MathJax.typesetPromise([element]).catch(() => {});
  }
}

function isMeaningfulText(text = "") {
  return String(text || "").trim().length > 0;
}

function normalizeComparableText(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function looksLikeSameMath(textA = "", textB = "") {
  const a = normalizeComparableText(textA).replace(/\s+/g, "");
  const b = normalizeComparableText(textB).replace(/\s+/g, "");

  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function getOptionLabel(option) {
  if (typeof option === "string") {
    return normalizeLatexText(option);
  }

  if (option && typeof option === "object") {
    return normalizeLatexText(
      option.text ??
      option.label ??
      option.content ??
      option.value ??
      option.title ??
      ""
    );
  }

  return normalizeLatexText(String(option ?? ""));
}

function normalizeOption(option) {
  return getOptionLabel(option);
}

function normalizeQuestion(question, index) {
  const type =
    question.type ||
    (Array.isArray(question.options) ? "single" : "short_text");

  const base = {
    id: question.id ?? index + 1,
    type,
    skill: normalizeLatexText(question.skill || "Общая тема"),
    question: normalizeLatexText(
      question.question || question.text || question.prompt || question.title || ""
    ),
    displayQuestionLatex: normalizeLatexText(question.displayQuestionLatex || ""),
    difficulty: Number.isInteger(question.difficulty) ? question.difficulty : 1,
    explanation: normalizeLatexText(question.explanation || ""),
    answerFormatHint: normalizeLatexText(question.answerFormatHint || ""),
    pedagogyIntent: normalizeLatexText(question.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(question.diagnosticTags) ? question.diagnosticTags : [],
    visualBlueprint:
      question.visualBlueprint && typeof question.visualBlueprint === "object"
        ? question.visualBlueprint
        : null,
    visual:
      question.visual && typeof question.visual === "object"
        ? question.visual
        : null,
  };

  if (type === "single") {
    const options = Array.isArray(question.options)
      ? question.options.map(normalizeOption)
      : [];

    return {
      ...base,
      options,
      correct: Number.isInteger(question.correct)
        ? question.correct
        : Number.isInteger(question.answer)
          ? question.answer
          : 0,
    };
  }

  if (type === "numeric") {
    return {
      ...base,
      answer: {
        value:
          typeof question.answer?.value === "number" ? question.answer.value : 0,
        tolerance:
          typeof question.answer?.tolerance === "number"
            ? question.answer.tolerance
            : 0,
        format: question.answer?.format || "number",
      },
    };
  }

  if (type === "short_text") {
    const accepted = Array.isArray(question.answer?.accepted)
      ? question.answer.accepted.map((item) => normalizeLatexText(item))
      : [];

    return {
      ...base,
      answer: {
        accepted,
        display: normalizeLatexText(question.answer?.display || accepted[0] || ""),
        caseInsensitive: question.answer?.caseInsensitive !== false,
        trim: question.answer?.trim !== false,
        normalizeSpaces: question.answer?.normalizeSpaces !== false,
      },
    };
  }

  if (type === "find_error") {
    return {
      ...base,
      errorVisibility: question.errorVisibility || "moderate",
      solutionBlocks: Array.isArray(question.solutionBlocks)
        ? question.solutionBlocks.map((block) => normalizeLatexText(block))
        : Array.isArray(question.solutionSteps)
          ? question.solutionSteps.map((block) => normalizeLatexText(block))
          : [],
      answer: {
        wrongBlock: Number.isInteger(question.answer?.wrongBlock)
          ? question.answer.wrongBlock
          : Number.isInteger(question.answer?.wrongStep)
            ? question.answer.wrongStep
            : 1,
      },
    };
  }

  if (type === "order_steps") {
    return {
      ...base,
      items: Array.isArray(question.items)
        ? question.items.map((item) => normalizeLatexText(item))
        : [],
      answer: {
        order: Array.isArray(question.answer?.order)
          ? question.answer.order
          : [],
      },
    };
  }

  return base;
}

function normalizeLoadedTestData(data, meta) {
  return {
    version: data.version || 1,
    id: data.id || meta.id,
    title: normalizeLatexText(data.title || meta.title || "Тест"),
    description: normalizeLatexText(data.description || meta.description || ""),
    topic: normalizeLatexText(data.topic || ""),
    level: normalizeLatexText(data.level || ""),
    variantKey: data.variantKey || "",
    questions: Array.isArray(data.questions)
      ? data.questions.map((q, index) => normalizeQuestion(q, index))
      : [],
  };
}

async function loadTestData(id) {
  const meta = await loadTestMetaById(id);
  const response = await fetch(meta.file, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл ${meta.file}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Ошибка JSON в файле ${meta.file}`);
  }

  return normalizeLoadedTestData(data, meta);
}

function getInitialAnswerValue(question) {
  if (question.type === "single") return null;
  if (question.type === "numeric") return "";
  if (question.type === "short_text") return "";
  if (question.type === "find_error") return null;

  if (question.type === "order_steps") {
    return {
      order: Array.isArray(question.items)
        ? question.items.map((_, index) => index)
        : [],
      touched: false,
    };
  }

  return null;
}

function buildInitialAnswers(questions) {
  return questions.map((question) => getInitialAnswerValue(question));
}

function restoreState() {
  const saved = sessionStorage.getItem(storageKey);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    currentQuestionIndex = parsed.currentQuestionIndex ?? 0;
    answers = Array.isArray(parsed.answers) ? parsed.answers : [];
    completed = parsed.completed ?? false;
  } catch (error) {
    console.error("Ошибка восстановления состояния:", error);
  }
}

function saveState() {
  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      currentQuestionIndex,
      answers,
      completed,
    })
  );
}

function clearState() {
  sessionStorage.removeItem(storageKey);
}

function normalizeFreeText(value, question) {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (question?.answer?.trim !== false) {
    text = text.trim();
  }

  text = text
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/[−–—]/g, "-")
    .replace(/\\cdot/g, "*")
    .replace(/·/g, "*")
    .replace(/[{}]/g, "");

  if (question?.answer?.normalizeSpaces !== false) {
    text = text.replace(/\s+/g, "");
  } else {
    text = text.replace(/\s+/g, " ").trim();
  }

  if (question?.answer?.caseInsensitive !== false) {
    text = text.toLowerCase();
  }

  return text;
}

function parseMaybeFraction(value) {
  if (typeof value !== "string") return NaN;

  const cleaned = value.replace(",", ".").replace(/\s+/g, "").trim();

  if (/^-?\d+\/-?\d+$/.test(cleaned)) {
    const [a, b] = cleaned.split("/").map(Number);
    if (b === 0) return NaN;
    return a / b;
  }

  return Number(cleaned);
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;

  const fractionValue = parseMaybeFraction(value);
  if (!Number.isNaN(fractionValue)) return fractionValue;

  const normalized = String(value).replace(",", ".").replace(/\s+/g, "").trim();
  return Number(normalized);
}

function hasAnswerForQuestion(question, answerValue) {
  if (!question || typeof question !== "object") return false;

  if (question.type === "single") return answerValue !== null;
  if (question.type === "numeric") {
    return typeof answerValue === "string" && answerValue.trim() !== "";
  }
  if (question.type === "short_text") {
    return typeof answerValue === "string" && answerValue.trim() !== "";
  }
  if (question.type === "find_error") return Number.isInteger(answerValue);

  if (question.type === "order_steps") {
    return (
      answerValue &&
      Array.isArray(answerValue.order) &&
      answerValue.order.length === question.items.length &&
      answerValue.touched === true
    );
  }

  return false;
}

function isCorrectAnswer(question, answerValue) {
  if (!hasAnswerForQuestion(question, answerValue)) return false;

  if (question.type === "single") {
    return answerValue === question.correct;
  }

  if (question.type === "numeric") {
    const userValue = parseNumber(answerValue);
    if (Number.isNaN(userValue)) return false;

    const expected = question.answer.value;
    const tolerance = question.answer.tolerance || 0;

    return Math.abs(userValue - expected) <= tolerance;
  }

  if (question.type === "short_text") {
    const accepted = Array.isArray(question.answer.accepted)
      ? question.answer.accepted
      : [];
    const userText = normalizeFreeText(answerValue, question);

    return accepted.some(
      (variant) => normalizeFreeText(variant, question) === userText
    );
  }

  if (question.type === "find_error") {
    return answerValue === question.answer.wrongBlock;
  }

  if (question.type === "order_steps") {
    if (!answerValue || !Array.isArray(answerValue.order)) return false;

    const expected = question.answer.order || [];
    return (
      Array.isArray(expected) &&
      expected.length === answerValue.order.length &&
      expected.every((value, index) => value === answerValue.order[index])
    );
  }

  return false;
}

function updateProgress() {
  if (!progressText || !progressCounter || !progressFill) return;

  if (!testData || !Array.isArray(testData.questions) || testData.questions.length === 0) {
    progressText.textContent = "Прогресс: 0%";
    progressCounter.textContent = "0 / 0";
    progressFill.style.width = "0%";
    return;
  }

  const total = testData.questions.length;
  const answered = testData.questions.reduce((sum, question, index) => {
    return sum + (hasAnswerForQuestion(question, answers[index]) ? 1 : 0);
  }, 0);

  const percent = Math.round((answered / total) * 100);

  progressText.textContent = `Прогресс: ${percent}%`;
  progressCounter.textContent = `${answered} / ${total}`;
  progressFill.style.width = `${percent}%`;
}

function getQuestionTypeLabel(type) {
  const map = {
    single: "Выбор ответа",
    numeric: "Числовой ответ",
    short_text: "Короткий ответ",
    find_error: "Найди ошибку",
    order_steps: "Порядок шагов",
  };

  return map[type] || "Задание";
}

function ensureCurrentAnswerShape(question) {
  const current = answers[currentQuestionIndex];

  if (question.type === "order_steps") {
    const valid =
      current &&
      Array.isArray(current.order) &&
      current.order.length === question.items.length &&
      current.order.every((value) => Number.isInteger(value));

    if (!valid) {
      answers[currentQuestionIndex] = getInitialAnswerValue(question);
      saveState();
    }
  }
}

function buildQuestionTextHtml(question) {
  const mainText = String(question.question || "").trim();
  const latexText = String(question.displayQuestionLatex || "").trim();
  const hintText = String(question.answerFormatHint || "").trim();

  const duplicateLatex =
    latexText &&
    mainText &&
    (looksLikeSameMath(mainText, latexText) || mainText.includes(latexText));

  let html = "";

  if (mainText) {
    html += `<div class="question-main-text">${escapeHtml(mainText)}</div>`;
  }

 if (latexText && !duplicateLatex) {
  const lines = latexText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const linesHtml = lines
    .map(
      (line, index) => `
        <div class="question-support-line">
          <span class="question-support-index">${index + 1}.</span>
          <span class="question-latex">${escapeHtml(line)}</span>
        </div>
      `
    )
    .join("");

  html += `
    <div class="question-support-block">
      ${linesHtml}
    </div>
  `;
}

  if (hintText) {
    html += `<div class="question-answer-hint">${escapeHtml(hintText)}</div>`;
  }

  return html || `<div class="question-main-text">Текст вопроса отсутствует.</div>`;
}

function renderVisualBlock(question) {
  const visual = question?.visual;

  if (!visual || !visual.src) return "";

  const type = String(visual.type || "image").toLowerCase();
  const src = escapeHtmlAttr(visual.src);
  const alt = escapeHtmlAttr(visual.alt || visual.caption || "Визуализация");
  const caption = isMeaningfulText(visual.caption)
    ? `<figcaption class="question-visual-caption">${escapeHtml(visual.caption)}</figcaption>`
    : "";

  if (type === "video") {
    return `
      <figure class="question-visual test-visual">
        <video
          class="question-visual-media test-visual-media"
          src="${src}"
          autoplay
          muted
          loop
          playsinline
          controls
          preload="metadata"
        ></video>
        ${caption}
      </figure>
    `;
  }

  return `
    <figure class="question-visual test-visual">
      <img
        class="question-visual-media test-visual-media"
        src="${src}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
      />
      ${caption}
    </figure>
  `;
}

function renderSingle(question) {
  const selected = answers[currentQuestionIndex];

  return `
    <div class="options">
      ${question.options
        .map(
          (option, index) => `
        <button
          type="button"
          class="option ${selected === index ? "selected" : ""}"
          data-index="${index}"
        >
          ${escapeHtml(getOptionLabel(option))}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

function renderNumeric() {
  const value =
    typeof answers[currentQuestionIndex] === "string"
      ? answers[currentQuestionIndex]
      : "";

  return `
    <div class="input-block">
      <label class="input-label" for="answer-input">Введите числовой ответ</label>
      <input
        id="answer-input"
        class="answer-input"
        type="text"
        value="${escapeHtmlAttr(value)}"
        placeholder="Например: 15"
      />
    </div>
  `;
}

function renderShortText() {
  const value =
    typeof answers[currentQuestionIndex] === "string"
      ? answers[currentQuestionIndex]
      : "";

  return `
    <div class="input-block">
      <label class="input-label" for="answer-input">Введите ответ</label>
      <input
        id="answer-input"
        class="answer-input"
        type="text"
        value="${escapeHtmlAttr(value)}"
        placeholder="Введите короткий ответ"
      />
    </div>
  `;
}

function renderFindError(question) {
  const selected = answers[currentQuestionIndex];

  return `
    <div class="steps-block">
      <p class="helper-text">Ниже показано решение по блокам. Выберите блок, в котором допущена ошибка.</p>
      <div class="solution-block-list">
        ${question.solutionBlocks
          .map(
            (block, index) => `
          <button
            type="button"
            class="step-card ${selected === index + 1 ? "selected" : ""}"
            data-block="${index + 1}"
          >
            <span class="step-number">Блок ${index + 1}</span>
            <span class="step-text">${escapeHtml(block)}</span>
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOrderSteps(question) {
  ensureCurrentAnswerShape(question);
  const answerState = answers[currentQuestionIndex];
  const order = answerState.order;

  return `
    <div class="steps-block">
      <p class="helper-text">Расположите шаги решения в правильном порядке.</p>
      <div class="order-list">
        ${order
          .map((originalIndex, position) => {
            const stepText = question.items[originalIndex];
            return `
              <div class="order-item">
                <div class="order-item-content">
                  <span class="step-number">Шаг ${position + 1}</span>
                  <span class="step-text">${escapeHtml(stepText)}</span>
                </div>
                <div class="order-controls">
                  <button
                    type="button"
                    class="mini-btn"
                    data-move="up"
                    data-position="${position}"
                    ${position === 0 ? "disabled" : ""}
                  >↑</button>
                  <button
                    type="button"
                    class="mini-btn"
                    data-move="down"
                    data-position="${position}"
                    ${position === order.length - 1 ? "disabled" : ""}
                  >↓</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderQuestion() {
  if (
    !quizBox ||
    !testData ||
    !Array.isArray(testData.questions) ||
    !testData.questions[currentQuestionIndex]
  ) {
    if (quizBox) {
      quizBox.innerHTML = `<div class="error-box"><h2>Вопрос не найден</h2></div>`;
    }
    return;
  }

  const question = testData.questions[currentQuestionIndex];
  let answerHtml = "";

  if (question.type === "single") answerHtml = renderSingle(question);
  if (question.type === "numeric") answerHtml = renderNumeric(question);
  if (question.type === "short_text") answerHtml = renderShortText(question);
  if (question.type === "find_error") answerHtml = renderFindError(question);
  if (question.type === "order_steps") answerHtml = renderOrderSteps(question);

  quizBox.innerHTML = `
    <div class="question-box">
      <div class="question-meta">
        <span class="question-type-badge">${escapeHtml(getQuestionTypeLabel(question.type))}</span>
        <span class="question-skill-badge">${escapeHtml(question.skill || "Общая тема")}</span>
      </div>

      <h2 id="question-number">Вопрос ${currentQuestionIndex + 1} из ${testData.questions.length}</h2>

      <div id="question-text" class="question-text">
        ${buildQuestionTextHtml(question)}
      </div>

      ${renderVisualBlock(question)}

      <div class="answer-area">
        ${answerHtml}
      </div>
    </div>
  `;

  renderMathSafe(quizBox);
  attachQuestionHandlers(question);

  if (prevBtn) {
    prevBtn.disabled = currentQuestionIndex === 0;
  }

  if (nextBtn) {
    nextBtn.textContent =
      currentQuestionIndex === testData.questions.length - 1
        ? "Завершить"
        : "Далее";
  }
}

function attachQuestionHandlers(question) {
  if (question.type === "single") {
    const options = document.querySelectorAll(".option");

    options.forEach((option) => {
      option.addEventListener("click", () => {
        const index = Number(option.dataset.index);
        answers[currentQuestionIndex] = index;
        saveState();
        updateProgress();
        renderQuestion();
      });
    });
  }

  if (question.type === "numeric" || question.type === "short_text") {
    const input = document.getElementById("answer-input");

    if (input) {
      input.addEventListener("input", () => {
        answers[currentQuestionIndex] = input.value;
        saveState();
        updateProgress();
      });
    }
  }

  if (question.type === "find_error") {
    const blockButtons = document.querySelectorAll(".step-card");

    blockButtons.forEach((button) => {
      button.addEventListener("click", () => {
        answers[currentQuestionIndex] = Number(button.dataset.block);
        saveState();
        updateProgress();
        renderQuestion();
      });
    });
  }

  if (question.type === "order_steps") {
    const moveButtons = document.querySelectorAll(".mini-btn");

    moveButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.dataset.move;
        const position = Number(button.dataset.position);
        const state = answers[currentQuestionIndex];

        if (!state || !Array.isArray(state.order)) return;

        const nextOrder = [...state.order];

        if (direction === "up" && position > 0) {
          [nextOrder[position - 1], nextOrder[position]] = [
            nextOrder[position],
            nextOrder[position - 1],
          ];
        }

        if (direction === "down" && position < nextOrder.length - 1) {
          [nextOrder[position], nextOrder[position + 1]] = [
            nextOrder[position + 1],
            nextOrder[position],
          ];
        }

        answers[currentQuestionIndex] = {
          order: nextOrder,
          touched: true,
        };

        saveState();
        updateProgress();
        renderQuestion();
      });
    });
  }
}

function goNext() {
  if (!testData || !Array.isArray(testData.questions)) return;

  const question = testData.questions[currentQuestionIndex];
  const answer = answers[currentQuestionIndex];

  if (!hasAnswerForQuestion(question, answer)) {
    alert("Сначала дайте ответ на вопрос.");
    return;
  }

  if (currentQuestionIndex < testData.questions.length - 1) {
    currentQuestionIndex++;
    saveState();
    renderQuestion();
  } else {
    completed = true;
    saveState();
    showResult();
  }
}

function goPrev() {
  if (currentQuestionIndex === 0) return;

  currentQuestionIndex--;
  saveState();
  renderQuestion();
}

function getUserAnswerLabel(question, answerValue) {
  if (!hasAnswerForQuestion(question, answerValue)) {
    return "Нет ответа";
  }

  if (question.type === "single") {
    return escapeHtml(getOptionLabel(question.options[answerValue] || ""));
  }

  if (question.type === "numeric" || question.type === "short_text") {
    return escapeHtml(String(answerValue));
  }

  if (question.type === "find_error") {
    const blockText = question.solutionBlocks?.[answerValue - 1] || "";
    return `Блок ${answerValue}${blockText ? `: ${escapeHtml(blockText)}` : ""}`;
  }

  if (question.type === "order_steps") {
    return `
      <ol class="review-order-list">
        ${answerValue.order
          .map((originalIndex) => `<li>${escapeHtml(question.items[originalIndex] || "")}</li>`)
          .join("")}
      </ol>
    `;
  }

  return "Нет ответа";
}

function getCorrectAnswerLabel(question) {
  if (question.type === "single") {
    return escapeHtml(getOptionLabel(question.options[question.correct] || ""));
  }

  if (question.type === "numeric") {
    return escapeHtml(String(question.answer.value));
  }

  if (question.type === "short_text") {
    return escapeHtml(question.answer.display || question.answer.accepted?.[0] || "");
  }

  if (question.type === "find_error") {
    const blockNumber = question.answer.wrongBlock;
    const blockText = question.solutionBlocks?.[blockNumber - 1] || "";
    return `Блок ${blockNumber}${blockText ? `: ${escapeHtml(blockText)}` : ""}`;
  }

  if (question.type === "order_steps") {
    return `
      <ol class="review-order-list">
        ${question.answer.order
          .map((originalIndex) => `<li>${escapeHtml(question.items[originalIndex] || "")}</li>`)
          .join("")}
      </ol>
    `;
  }

  return "";
}

function calculateResult() {
  let score = 0;
  const weakSkillsMap = {};

  testData.questions.forEach((question, index) => {
    const correct = isCorrectAnswer(question, answers[index]);

    if (correct) {
      score++;
    } else {
      const skillName = question.skill || "Общая тема";
      weakSkillsMap[skillName] = (weakSkillsMap[skillName] || 0) + 1;
    }
  });

  const percent = Math.round((score / testData.questions.length) * 100);

  let level = "";
  let recommendation = "";
  let salesText = "";

  if (percent >= 85) {
    level = "Продвинутый уровень";
    recommendation =
      "У вас уже сильная база. Основной рост сейчас лежит в сложных задачах, скорости и устойчивости на экзамене.";
    salesText =
      "Сейчас вам нужен не базовый курс, а точечная доработка слабых мест и усиление сложных тем.";
  } else if (percent >= 55) {
    level = "Средний уровень";
    recommendation =
      "Основа есть, но видны пробелы. Если их не закрыть сейчас, дальше они будут тормозить прогресс.";
    salesText =
      "Вам подойдёт персональный план: убрать слабые темы, закрепить базу и перейти к более сильным заданиям.";
  } else {
    level = "Начальный уровень";
    recommendation =
      "Сейчас важно спокойно собрать фундамент и довести базовые типы задач до уверенного решения.";
    salesText =
      "Вам нужен понятный маршрут: с чего начинать, какие темы брать первыми и как быстро выйти на устойчивый уровень.";
  }

  const weakSkills = Object.entries(weakSkillsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill]) => skill);

  return {
    score,
    percent,
    level,
    recommendation,
    salesText,
    weakSkills,
  };
}

function buildReview() {
  return testData.questions
    .map((question, index) => {
      const userAnswer = answers[index];
      const correct = isCorrectAnswer(question, userAnswer);

      return `
        <div class="review-item">
          <div class="review-status ${correct ? "ok" : "bad"}">
            ${correct ? "Верно" : "Ошибка"}
          </div>

          <div class="review-question">
            <strong>Вопрос ${index + 1}.</strong>
            ${escapeHtml(question.question || "")}
          </div>

          <div class="review-answer">
            <strong>Тип:</strong> ${escapeHtml(getQuestionTypeLabel(question.type))}
          </div>

          <div class="review-answer">
            <strong>Ваш ответ:</strong>
            ${getUserAnswerLabel(question, userAnswer)}
          </div>

          <div class="review-answer">
            <strong>Правильный ответ:</strong>
            ${getCorrectAnswerLabel(question)}
          </div>

          ${
            question.explanation
              ? `<div class="review-explanation"><strong>Разбор:</strong> ${escapeHtml(question.explanation)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function restartTest() {
  if (!testData || !Array.isArray(testData.questions)) return;

  currentQuestionIndex = 0;
  completed = false;
  answers = buildInitialAnswers(testData.questions);

  clearState();

  if (resultBox) resultBox.classList.add("hidden");
  if (quizBox) quizBox.classList.remove("hidden");

  if (quizActions) {
    quizActions.classList.remove("hidden");
    quizActions.style.display = "flex";
  }

  updateProgress();
  renderQuestion();
}

function goToCatalog() {
  clearState();
  window.location.href = "index.html";
}

function buildLeadLink(resultData) {
  const url = new URL("lead.html", window.location.href);

  url.searchParams.set("test", testData.title || "Тест");
  url.searchParams.set("score", `${resultData.score}/${testData.questions.length}`);
  url.searchParams.set("percent", `${resultData.percent}`);
  url.searchParams.set("level", resultData.level);
  url.searchParams.set(
    "weakSkills",
    resultData.weakSkills.join(", ") || "Существенных провалов не обнаружено"
  );

  return url.toString();
}

function showResult() {
  if (!resultBox || !quizBox || !testData) return;

  const { score, percent, level, recommendation, salesText, weakSkills } =
    calculateResult();

  const leadLink = buildLeadLink({ score, percent, level, weakSkills });

  quizBox.classList.add("hidden");

  if (quizActions) {
    quizActions.classList.add("hidden");
  }

  resultBox.classList.remove("hidden");

  const weakSkillsHtml = weakSkills.length
    ? `
      <div class="weak-skills-box">
        <h3>Что сейчас проседает</h3>
        <ul class="weak-skills-list">
          ${weakSkills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}
        </ul>
      </div>
    `
    : `
      <div class="weak-skills-box">
        <h3>Что сейчас проседает</h3>
        <p>Существенных провалов не обнаружено. Можно усиливать более сложные темы.</p>
      </div>
    `;

  resultBox.innerHTML = `
    <h2>Ваш результат</h2>

    <div class="result-summary">
      <div class="result-stat">
        <span class="result-number">${score}/${testData.questions.length}</span>
        <span class="result-label">правильных ответов</span>
      </div>

      <div class="result-stat">
        <span class="result-number">${percent}%</span>
        <span class="result-label">точность</span>
      </div>
    </div>

    <div class="diagnostic-box">
      <p class="diagnostic-level"><strong>${escapeHtml(level)}</strong></p>
      <p>${escapeHtml(recommendation)}</p>
    </div>

    ${weakSkillsHtml}

    <div class="sales-box">
      <h3>Что делать дальше</h3>
      <p>${escapeHtml(salesText)}</p>
      <p>Я могу помочь составить персональный маршрут подготовки: какие темы закрывать в первую очередь, что повторять и как расти быстрее без хаоса.</p>
    </div>

    <div class="result-cta">
      <a class="cta-btn" href="${escapeHtml(leadLink)}">Получить план подготовки</a>
      <button class="secondary-btn" id="restart-btn" type="button">Пройти заново</button>
      <button class="secondary-btn" id="catalog-btn" type="button">К каталогу тестов</button>
    </div>

    <div class="review-block">
      <h3>Разбор по вопросам</h3>
      ${buildReview()}
    </div>
  `;

  const restartBtn = document.getElementById("restart-btn");
  const catalogBtn = document.getElementById("catalog-btn");

  if (restartBtn) {
    restartBtn.addEventListener("click", restartTest);
  }

  if (catalogBtn) {
    catalogBtn.addEventListener("click", goToCatalog);
  }

  renderMathSafe(resultBox);
}

async function loadTest() {
  try {
    if (!testId) {
      throw new Error("В URL не передан id теста.");
    }

    testData = await loadTestData(testId);

    if (titleEl) {
      titleEl.textContent = testData.title || "Тест";
    }

    if (descriptionEl) {
      descriptionEl.textContent = testData.description || "";
    }

    restoreState();

    const needResetAnswers =
      !Array.isArray(answers) ||
      answers.length !== testData.questions.length;

    if (needResetAnswers) {
      answers = buildInitialAnswers(testData.questions);
      currentQuestionIndex = 0;
      completed = false;
      clearState();
    }

    if (currentQuestionIndex < 0 || currentQuestionIndex >= testData.questions.length) {
      currentQuestionIndex = 0;
    }

    if (completed) {
      showResult();
    } else {
      updateProgress();
      renderQuestion();
    }
  } catch (error) {
    if (titleEl) {
      titleEl.textContent = "Ошибка загрузки";
    }

    if (descriptionEl) {
      descriptionEl.textContent = "";
    }

    if (quizBox) {
      quizBox.innerHTML = `
        <div class="error-box">
          <h2>Не удалось загрузить тест</h2>
          <p>${escapeHtml(error.message)}</p>
          <p><a href="index.html" class="catalog-link">← Вернуться к каталогу тестов</a></p>
        </div>
      `;
    }

    if (quizActions) {
      quizActions.style.display = "none";
    }

    console.error(error);
  }
}

if (nextBtn) {
  nextBtn.addEventListener("click", goNext);
}

if (prevBtn) {
  prevBtn.addEventListener("click", goPrev);
}

window.addEventListener("beforeunload", function (event) {
  if (
    !completed &&
    Array.isArray(answers) &&
    answers.some((answer, index) =>
      hasAnswerForQuestion(testData?.questions?.[index] || {}, answer)
    )
  ) {
    event.preventDefault();
    event.returnValue = "";
  }
});

loadTest();
