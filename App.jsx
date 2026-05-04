import React, { useEffect, useMemo, useState } from "react";
import {
  listTests,
  getRuntimeTest,
  createGenerationJob,
  getGenerationJob,
  getGenerationPresets,
  createAttempt,
  submitAttempt,
  getAttemptResult
} from "../lib/api";
import { MathText } from "../components/MathText.jsx";

const DEMO_USER_ID = "demo-user";

const DIFFICULTY_LABELS = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
  very_hard: "Очень сложный",
  mixed: "Смешанный"
};

const FORMAT_LABELS = {
  EGE: "ЕГЭ",
  EGE_PROFILE: "ЕГЭ профиль",
  OGE: "ОГЭ",
  custom: "Свой формат"
};

const DEFAULT_GENERATION_FORM = {
  subject: "math",
  mode: "practice",
  examType: "OGE",
  examFormat: "OGE",
  examTaskNumber: 9,
  questionCount: 3,
  language: "ru",
  visuals: false,
  style: "exam_like",
  goal: "practice",
  engine: "mock"
};

const TOPIC_OPTIONS = [
  { value: "linear equations", label: "Линейные уравнения" },
  { value: "quadratic equations", label: "Квадратные уравнения" },
  { value: "systems of equations", label: "Системы уравнений" },
  { value: "fractions", label: "Дроби" },
  { value: "probability", label: "Вероятность" },
  { value: "derivatives", label: "Производные" }
];

const TASK_TYPE_OPTIONS = [
  { value: "single_choice", label: "Выбор ответа" },
  { value: "numeric", label: "Числовой ответ" },
  { value: "short_text", label: "Короткий текст" }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function getDifficultyLabel(value) {
  return DIFFICULTY_LABELS[value] || value || "—";
}

function getFormatLabel(value) {
  return FORMAT_LABELS[value] || value || "—";
}

function getTestSearchText(test) {
  return [
    test.title,
    test.subject,
    test.examFormat,
    test.difficulty,
    test.language,
    test.sourceType
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortTestsNewestFirst(tests) {
  return [...tests].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function QuestionInput({ question, value, onChange, disabled }) {
  if (question.type === "single_choice") {
    return (
      <div className="options">
        {(question.options || []).map((option) => (
          <label
            key={option.id}
            className={`option ${value === option.id ? "selected" : ""}`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.id}
              checked={value === option.id}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <span className="optionId">{option.id}</span>
            <MathText>{option.text}</MathText>
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      className="answerInput"
      value={value || ""}
      disabled={disabled}
      placeholder="Введите ответ"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TestMetaGrid({ test }) {
  if (!test) return null;

  return (
    <div className="metaGrid">
      <div className="metaItem">
        <span>Формат</span>
        <strong>{getFormatLabel(test.examFormat)}</strong>
      </div>
      <div className="metaItem">
        <span>Сложность</span>
        <strong>{getDifficultyLabel(test.difficulty)}</strong>
      </div>
      <div className="metaItem">
        <span>Заданий</span>
        <strong>{test.questionCount ?? "—"}</strong>
      </div>
      <div className="metaItem">
        <span>Язык</span>
        <strong>{String(test.language || "—").toUpperCase()}</strong>
      </div>
      <div className="metaItem">
        <span>Статус</span>
        <strong>{test.status || "—"}</strong>
      </div>
      <div className="metaItem">
        <span>Создан</span>
        <strong>{formatDate(test.createdAt)}</strong>
      </div>
    </div>
  );
}

function ResultBlock({ result, onRestart }) {
  if (!result) {
    return null;
  }

  return (
    <section className="card resultCard">
      <div className="resultHeader">
        <div>
          <div className="sectionTitle">Результат попытки</div>
          <h2>{result.test.title}</h2>
        </div>

        <button className="secondary" onClick={onRestart}>
          Пройти ещё раз
        </button>
      </div>

      <div className="scorePanel">
        <div className="scoreNumber">{result.summary.score}%</div>
        <div className="scoreDetails">
          <strong>
            Верно: {result.summary.correctAnswers} из{" "}
            {result.summary.totalQuestions}
          </strong>
          <span>Ошибок: {result.summary.wrongAnswers}</span>
        </div>
      </div>

      <div className="resultQuestions">
        {result.questions.map((question) => (
          <div
            key={question.questionId}
            className={`resultQuestion ${
              question.isCorrect ? "correct" : "wrong"
            }`}
          >
            <div className="questionHeader">
              <strong>Задание {question.orderIndex}</strong>
              <span>{question.isCorrect ? "Верно" : "Ошибка"}</span>
            </div>

            <p className="questionPrompt">
              <MathText>{question.prompt}</MathText>
            </p>

            <div className="resultGrid">
              <div>
                <div className="muted">Ответ ученика</div>
                <div className="answerPreview">
                  <MathText>{String(question.userAnswer ?? "—")}</MathText>
                </div>
              </div>

              <div>
                <div className="muted">Правильный ответ</div>
                <div className="answerPreview">
                  <MathText>
                    {question.correctAnswer?.display ||
                      question.correctAnswer?.value ||
                      "—"}
                  </MathText>
                </div>
              </div>
            </div>

            <details>
              <summary>Показать решение</summary>
              <p>
                <MathText>{question.solution}</MathText>
              </p>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="card emptyState">
      <div className="emptyIcon">∑</div>
      <h2>Выбери тест слева</h2>
      <p>
        Или настрой параметры генерации в верхней панели и создай новый AI-тест.
        После выбора справа появится карточка теста и кнопка начала попытки.
      </p>
    </div>
  );
}

function GenerationPanel({
  form,
  onChange,
  onGenerate,
  generationLoading,
  presetCatalog,
  presetLoading,
  presetError
}) {
  const exams = presetCatalog?.exams || [];
  const selectedExam =
    exams.find((exam) => exam.examType === form.examType) || exams[0] || null;

  const tasks = selectedExam?.tasks || [];
  const selectedTask =
    tasks.find((task) => Number(task.taskNumber) === Number(form.examTaskNumber)) ||
    tasks[0] ||
    null;

  const isExamMode = form.mode === "exam";
  const isPracticeMode = form.mode === "practice";

  const effectiveQuestionCount = isExamMode
    ? selectedExam?.questionCount || form.questionCount
    : form.questionCount;

  const canGenerate =
    !generationLoading &&
    !presetLoading &&
    selectedExam &&
    (isExamMode || selectedTask);

  return (
    <section className="card generationPanel">
      <div className="generationHeader">
        <div>
          <div className="sectionTitle">Генерация теста</div>
          <h2>Создать экзаменационный тест</h2>
          <p className="muted">
            Выбери полный вариант или тренировку по конкретному номеру экзамена.
            Структура ОГЭ и ЕГЭ профиль подгружается с backend.
          </p>
        </div>
      </div>

      <div className="presetDebug">
        <div className="sectionTitle">Экзаменационные пресеты</div>

        {presetLoading ? (
          <div className="muted">Загружаем структуру экзаменов...</div>
        ) : presetError ? (
          <div className="errorText">{presetError}</div>
        ) : presetCatalog?.exams?.length ? (
          <div className="presetGrid">
            {presetCatalog.exams.map((exam) => (
          <button
             type="button"
            className={`presetCard presetCardButton ${
           exam.examType === form.examType ? "active" : ""
            }`}
             key={exam.examType}
            onClick={() => onChange("examType", exam.examType)}
            >
            <div className="presetCardTitle">{exam.title}</div>
           <div className="muted">
         {exam.questionCount} заданий · {exam.tasks?.length || 0} пресетов
         </div>
         </button>
        ))}
          </div>
        ) : (
          <div className="muted">Пресеты пока не загружены</div>
        )}
      </div>

      <div className="generationGrid">
        <label className="field">
          <span>Режим</span>
          <select
            value={form.mode}
            onChange={(event) => onChange("mode", event.target.value)}
          >
            <option value="practice">Практика по номеру</option>
            <option value="exam">Полный вариант</option>
          </select>
        </label>

        <label className="field">
          <span>Экзамен</span>
          <select
            value={form.examType}
            disabled={!exams.length}
            onChange={(event) => onChange("examType", event.target.value)}
          >
            {exams.length ? (
              exams.map((exam) => (
                <option key={exam.examType} value={exam.examType}>
                  {exam.title}
                </option>
              ))
            ) : (
              <>
                <option value="OGE">ОГЭ по математике</option>
                <option value="EGE_PROFILE">ЕГЭ профильная математика</option>
              </>
            )}
          </select>
        </label>

        {isPracticeMode ? (
          <label className="field wide">
            <span>Номер задания</span>
            <select
              value={form.examTaskNumber || selectedTask?.taskNumber || ""}
              disabled={!tasks.length}
              onChange={(event) =>
                onChange("examTaskNumber", Number(event.target.value))
              }
            >
              {tasks.map((task) => (
                <option key={task.taskNumber} value={task.taskNumber}>
                  {task.title} · {task.answerType}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field wide readonlyField">
            <span>Состав варианта</span>
            <strong>{selectedExam?.questionCount || "—"} заданий</strong>
            <small>
              {form.examType === "OGE"
                ? "ОГЭ: 1–19 краткий ответ, 20–25 развёрнутое решение"
                : "ЕГЭ профиль: 1–12 краткий ответ, 13–19 развёрнутое решение"}
            </small>
          </div>
        )}

        <label className="field">
          <span>Количество заданий</span>
          <input
            type="number"
            min="1"
            max={isExamMode ? selectedExam?.questionCount || 25 : 30}
            value={effectiveQuestionCount}
            disabled={isExamMode}
            onChange={(event) =>
              onChange("questionCount", Number(event.target.value))
            }
          />
        </label>

        <label className="field">
          <span>Язык</span>
          <select
            value={form.language}
            onChange={(event) => onChange("language", event.target.value)}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="field">
          <span>Движок</span>
          <select
            value={form.engine}
            onChange={(event) => onChange("engine", event.target.value)}
          >
            <option value="ai">AI</option>
            <option value="mock">Mock / тестовый</option>
          </select>
        </label>
      </div>

      {isPracticeMode && selectedTask ? (
        <div className="selectedTaskHint">
          <div>
            <strong>{selectedTask.title}</strong>
            <p>{selectedTask.description}</p>
          </div>

          <div className="taskBadges">
            <span>{selectedTask.answerType}</span>
            <span>{selectedTask.responseMode}</span>
            <span>{getDifficultyLabel(selectedTask.difficulty)}</span>
          </div>
        </div>
      ) : null}

      <label className="visualToggle">
        <input
          type="checkbox"
          checked={form.visuals}
          onChange={(event) => onChange("visuals", event.target.checked)}
        />
        <span>Пробовать добавлять визуализации к заданиям</span>
      </label>

      <button
        className="primary large full"
        onClick={onGenerate}
        disabled={!canGenerate}
      >
        {generationLoading ? "Генерирую тест..." : "Сгенерировать тест"}
      </button>
    </section>
  );
}

function TestPreview({ test, onStartAttempt, loading }) {
  return (
    <div className="card previewCard">
      <div className="sectionTitle">Выбранный тест</div>

      <h2>{test.title}</h2>

      <p className="muted previewText">
        Это ученическая версия теста: правильные ответы и решения скрыты до
        отправки попытки.
      </p>

      <TestMetaGrid test={test} />

      <div className="previewActions">
        <button className="primary large" onClick={onStartAttempt} disabled={loading}>
          Начать тест
        </button>
      </div>
    </div>
  );
}

function AttemptView({
  runtimeTest,
  attempt,
  answers,
  setAnswers,
  answeredCount,
  loading,
  onSubmit,
  onRestart
}) {
  const progressPercent =
    runtimeTest.questionCount > 0
      ? Math.round((answeredCount / runtimeTest.questionCount) * 100)
      : 0;

  return (
    <div className="card">
      <div className="stickyTestHeader">
        <div>
          <div className="sectionTitle">Прохождение теста</div>
          <h2>{runtimeTest.title}</h2>
          <p className="muted">
            {getFormatLabel(runtimeTest.examFormat)} ·{" "}
            {getDifficultyLabel(runtimeTest.difficulty)} ·{" "}
            {runtimeTest.questionCount} заданий
          </p>
        </div>

        <button className="secondary" onClick={onRestart}>
          Сбросить попытку
        </button>
      </div>

      <div className="attemptBar">
        <div>
          <strong>Попытка:</strong> {attempt.id}
        </div>
        <div>
          <strong>Ответов:</strong> {answeredCount} / {runtimeTest.questionCount}
        </div>
      </div>

      <div className="progressOuter">
        <div className="progressInner" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="questions">
        {runtimeTest.questions.map((question) => (
          <div key={question.id} className="question">
            <div className="questionTitle">Задание {question.orderIndex}</div>

            <p className="questionPrompt">
              <MathText>{question.prompt}</MathText>
            </p>

            <QuestionInput
              question={question}
              value={answers[question.id]}
              disabled={loading}
              onChange={(value) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: value
                }))
              }
            />
          </div>
        ))}
      </div>

      <button
        className="primary submit"
        onClick={onSubmit}
        disabled={loading || !attempt}
      >
        {loading ? "Проверяю..." : "Отправить ответы"}
      </button>
    </div>
  );
}

export function App() {
  const [tests, setTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [runtimeTest, setRuntimeTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [generationForm, setGenerationForm] = useState(DEFAULT_GENERATION_FORM);
  const [presetCatalog, setPresetCatalog] = useState(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState("");

  const filteredTests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sortTestsNewestFirst(tests).filter((test) => {
      const matchesSearch = query
        ? getTestSearchText(test).includes(query)
        : true;

      const matchesFormat =
        formatFilter === "all" ? true : test.examFormat === formatFilter;

      const matchesDifficulty =
        difficultyFilter === "all"
          ? true
          : test.difficulty === difficultyFilter;

      return matchesSearch && matchesFormat && matchesDifficulty;
    });
  }, [tests, search, formatFilter, difficultyFilter]);

  const selectedSummary = useMemo(() => {
    return tests.find((test) => test.id === selectedTestId) || null;
  }, [tests, selectedTestId]);

  const answeredCount = useMemo(() => {
    if (!runtimeTest?.questions) {
      return 0;
    }

    return runtimeTest.questions.filter((question) => {
      const value = answers[question.id];
      return value !== undefined && value !== null && String(value).trim() !== "";
    }).length;
  }, [runtimeTest, answers]);

  async function refreshTests() {
    const data = await listTests();
    setTests(data.tests || []);
  }

  useEffect(() => {
  refreshTests().catch((err) => setError(err.message));

  setPresetLoading(true);
  getGenerationPresets()
    .then((data) => {
      setPresetCatalog(data.catalog || null);
      setPresetError("");
    })
    .catch((err) => {
      setPresetError(err.message || "Не удалось загрузить пресеты экзаменов");
    })
    .finally(() => {
      setPresetLoading(false);
    });
}, []);

  async function openTest(testId) {
    setError("");
    setLoading(true);
    setResult(null);
    setAttempt(null);
    setAnswers({});

    try {
      const data = await getRuntimeTest(testId);
      setSelectedTestId(testId);
      setRuntimeTest(data.test);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startAttempt() {
    if (!runtimeTest) {
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);
    setAnswers({});

    try {
      const data = await createAttempt({
        userId: DEMO_USER_ID,
        testId: runtimeTest.id
      });

      setAttempt(data.attempt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

function updateGenerationForm(field, value) {
  setGenerationForm((prev) => {
    const next = {
      ...prev,
      [field]: value
    };

    const exams = presetCatalog?.exams || [];
    const selectedExamType =
      field === "examType" ? value : next.examType;

    const selectedExam =
      exams.find((exam) => exam.examType === selectedExamType) || exams[0] || null;

    if (field === "examType") {
      next.examType = value;
      next.examFormat = value;

      const firstTask = selectedExam?.tasks?.[0];

      if (next.mode === "practice") {
        next.examTaskNumber = firstTask?.taskNumber || 1;
        next.questionCount = 3;
      }

      if (next.mode === "exam") {
        next.examTaskNumber = "";
        next.questionCount = selectedExam?.questionCount || 10;
      }
    }

    if (field === "mode") {
      if (value === "exam") {
        next.goal = "exam";
        next.examTaskNumber = "";
        next.questionCount = selectedExam?.questionCount || 10;
      } else {
        const defaultTask =
          selectedExam?.tasks?.find((task) => task.taskNumber === 9) ||
          selectedExam?.tasks?.[0];

        next.goal = "practice";
        next.examTaskNumber = defaultTask?.taskNumber || 1;
        next.questionCount = 3;
      }
    }

    if (field === "examTaskNumber") {
      next.examTaskNumber = Number(value);
    }

    if (field === "questionCount") {
      next.questionCount = Math.max(1, Number(value || 1));
    }

    return next;
  });
}

function toggleGenerationTaskType(taskType) {
  setGenerationForm((prev) => {
    const current = Array.isArray(prev.taskTypes) ? prev.taskTypes : [];

    const next = current.includes(taskType)
      ? current.filter((item) => item !== taskType)
      : [...current, taskType];

    return {
      ...prev,
      taskTypes: next
    };
  });

}
  function resetAttemptState() {
    setAttempt(null);
    setAnswers({});
    setResult(null);
  }

  async function handleSubmit() {
    if (!attempt || !runtimeTest) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const payload = runtimeTest.questions.map((question) => ({
        questionId: question.id,
        value: answers[question.id] ?? ""
      }));

      await submitAttempt({
        attemptId: attempt.id,
        answers: payload
      });

      const resultData = await getAttemptResult(attempt.id);
      setResult(resultData.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAiTest() {
  setError("");
  setGenerationLoading(true);

  try {
    const exams = presetCatalog?.exams || [];
    const selectedExam =
      exams.find((exam) => exam.examType === generationForm.examType) || null;

    const isExamMode = generationForm.mode === "exam";

    const normalizedQuestionCount = isExamMode
      ? selectedExam?.questionCount || Number(generationForm.questionCount || 10)
      : Math.max(1, Math.min(30, Number(generationForm.questionCount || 3)));

    const payload = {
      subject: "math",
      mode: generationForm.mode,
      examType: generationForm.examType,
      examFormat: generationForm.examType,
      language: generationForm.language,
      engine: generationForm.engine,
      visuals: generationForm.visuals,
      style: "exam_like",
      goal: isExamMode ? "exam" : "practice",
      questionCount: normalizedQuestionCount
    };

    if (!isExamMode) {
      payload.examTaskNumber = Number(generationForm.examTaskNumber);
    }

    const created = await createGenerationJob(payload);

    let job = null;

    for (let i = 0; i < 24; i += 1) {
      await sleep(5000);
      const data = await getGenerationJob(created.jobId);
      job = data.job;

      if (job.status === "COMPLETED" || job.status === "FAILED") {
        break;
      }
    }

    if (!job || job.status !== "COMPLETED") {
      throw new Error(job?.errorMessage || "AI generation did not complete");
    }

    await refreshTests();

    const testId = job.resultPayload?.testId;
    if (testId) {
      await openTest(testId);
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setGenerationLoading(false);
  }
}

  return (
    <main className="app">
      <header className="hero">
        <div>
          <div className="eyebrow">EMS MATH</div>
          <h1>AI-платформа генерации и прохождения тестов</h1>
          <p>
            Генерация тестов, прохождение попыток, серверная проверка ответов и
            подробный разбор результата.
          </p>
        </div>

        <a className="heroHint" href="#generation-panel">
        Настроить генерацию ↓
      </a>
      </header>

      {error ? <div className="error">{error}</div> : null}
      <div id="generation-panel">
        <GenerationPanel
        form={generationForm}
        onChange={updateGenerationForm}
        onGenerate={generateAiTest}
        generationLoading={generationLoading}
        presetCatalog={presetCatalog}
        presetLoading={presetLoading}
        presetError={presetError}
       />
       </div>

      <div className="layout">
        <aside className="card sidebar">
          <div className="sectionTitle">Библиотека тестов</div>

          <button className="secondary full" onClick={refreshTests}>
            Обновить список
          </button>

          <div className="filters">
            <input
              className="searchInput"
              value={search}
              placeholder="Поиск по названию"
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="selectInput"
              value={formatFilter}
              onChange={(event) => setFormatFilter(event.target.value)}
            >
              <option value="all">Все форматы</option>
              <option value="EGE">ЕГЭ</option>
              <option value="OGE">ОГЭ</option>
              <option value="custom">Свой формат</option>
            </select>

            <select
              className="selectInput"
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value)}
            >
              <option value="all">Все уровни</option>
              <option value="easy">Лёгкий</option>
              <option value="medium">Средний</option>
              <option value="hard">Сложный</option>
            </select>
          </div>

          <div className="listStats">
            Найдено тестов: <strong>{filteredTests.length}</strong>
          </div>

          <div className="testList">
            {filteredTests.map((test) => (
              <button
                key={test.id}
                className={`testItem ${
                  selectedTestId === test.id ? "active" : ""
                }`}
                onClick={() => openTest(test.id)}
              >
                <div className="testItemTop">
                  <strong>{test.title}</strong>
                  <span className={`difficultyPill ${test.difficulty}`}>
                    {getDifficultyLabel(test.difficulty)}
                  </span>
                </div>

                <span>
                  {getFormatLabel(test.examFormat)} · {test.questionCount}{" "}
                  заданий · {formatDate(test.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="content">
          {!runtimeTest ? (
            <EmptyState
              onGenerate={generateAiTest}
              generationLoading={generationLoading}
            />
          ) : result ? (
            <ResultBlock result={result} onRestart={startAttempt} />
          ) : attempt ? (
            <AttemptView
              runtimeTest={runtimeTest}
              attempt={attempt}
              answers={answers}
              setAnswers={setAnswers}
              answeredCount={answeredCount}
              loading={loading}
              onSubmit={handleSubmit}
              onRestart={resetAttemptState}
            />
          ) : (
            <TestPreview
              test={runtimeTest || selectedSummary}
              onStartAttempt={startAttempt}
              loading={loading}
            />
          )}
        </section>
      </div>
    </main>
  );
}
