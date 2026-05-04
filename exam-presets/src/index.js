"use strict";

function getDefaultTaskTypesForAnswerType(answerType) {
  if (answerType === "numeric") {
    return ["numeric"];
  }

  if (answerType === "single_digit") {
    return ["single_choice"];
  }

  if (answerType === "digit_sequence") {
    return ["short_text"];
  }

  if (answerType === "full_solution") {
    return ["full_solution"];
  }

  return ["numeric"];
}

const OGE_CONTEXT_BLOCKS = [
  {
    id: "stoves",
    title: "Печи",
    description:
      "Практико-ориентированный блок ОГЭ 1–5: выбор печи, параметры помещения, мощность, объём, расчёты по таблице."
  },
  {
    id: "apartments",
    title: "Квартиры",
    description:
      "Практико-ориентированный блок ОГЭ 1–5: план квартиры, площади комнат, размеры, стоимость ремонта или материалов."
  },
  {
    id: "tariffs",
    title: "Тарифы",
    description:
      "Практико-ориентированный блок ОГЭ 1–5: тарифные планы, стоимость, сравнение вариантов, выбор оптимального тарифа."
  },
  {
    id: "tires",
    title: "Шины",
    description:
      "Практико-ориентированный блок ОГЭ 1–5: маркировка шин, диаметр, радиус, стоимость комплекта, таблицы параметров."
  },
  {
    id: "paper",
    title: "Листы бумаги",
    description:
      "Практико-ориентированный блок ОГЭ 1–5: форматы листов, размеры, площади, масштабирование, сравнение форматов."
  }
];

const OGE_TASKS = [
  {
    taskNumber: 1,
    title: "№1 Практический блок: выбор объекта",
    topic: "oge_context_task_1",
    template: "context_selection",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Первое задание общего практического блока 1–5: печи, шины, тарифы, квартиры, листы, участок."
  },
  {
    taskNumber: 2,
    title: "№2 Практический блок: расчёт по условию",
    topic: "oge_context_task_2",
    template: "context_calculation",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Второе задание общего практического блока 1–5: площадь, объём, размер, тариф, параметр объекта."
  },
  {
    taskNumber: 3,
    title: "№3 Практический блок: стоимость или величина",
    topic: "oge_context_task_3",
    template: "context_cost_or_measure",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Третье задание общего практического блока 1–5: стоимость, диаметр, доставка, суммарный расчёт."
  },
  {
    taskNumber: 4,
    title: "№4 Практический блок: проценты или изменение",
    topic: "oge_context_task_4",
    template: "context_percent_change",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Четвёртое задание общего блока: скидки, изменение размера, сравнение величин, проценты."
  },
  {
    taskNumber: 5,
    title: "№5 Практический блок: геометрия/проценты",
    topic: "oge_context_task_5",
    template: "context_geometry_or_percent",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Пятое задание общего блока: прикладная геометрия, радиус, длина, процентное изменение."
  },
  {
    taskNumber: 6,
    title: "№6 Вычисления",
    topic: "oge_arithmetic_calculation",
    template: "arithmetic_calculation",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Арифметические вычисления: дроби, десятичные числа, степени, порядок действий."
  },
  {
    taskNumber: 7,
    title: "№7 Координатная прямая",
    topic: "oge_number_line",
    template: "number_line",
    answerType: "single_digit",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Координатная прямая, сравнение чисел, корни, отрицательность/положительность выражений."
  },
  {
    taskNumber: 8,
    title: "№8 Алгебраические выражения",
    topic: "oge_algebraic_expressions",
    template: "algebraic_expressions",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Преобразование выражений, степени, корни, формулы сокращённого умножения."
  },
  {
    taskNumber: 9,
    title: "№9 Уравнения",
    topic: "oge_basic_equations",
    template: "basic_equations",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Линейные, квадратные, рациональные и простые уравнения уровня ОГЭ; обычно требуется записать корень."
  },
  {
    taskNumber: 10,
    title: "№10 Вероятность",
    topic: "oge_probability_basic",
    template: "probability_basic",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Простая классическая вероятность, случайный выбор, отношение благоприятных исходов к общему числу исходов."
  },
  {
    taskNumber: 11,
    title: "№11 Графики функций",
    topic: "oge_function_graphs_matching",
    template: "function_graphs_matching",
    answerType: "digit_sequence",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Соответствие графиков и формул: линейные функции, параболы, гиперболы, знаки коэффициентов."
  },
  {
    taskNumber: 12,
    title: "№12 Формулы",
    topic: "oge_formula_application",
    template: "formula_application",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Работа с готовой формулой: физика, геометрия, экономика, подстановка данных и нахождение величины."
  },
  {
    taskNumber: 13,
    title: "№13 Неравенства",
    topic: "oge_inequalities_basic",
    template: "inequalities_basic",
    answerType: "single_digit",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Выбор решения неравенства или системы неравенств по промежуткам и числовой прямой."
  },
  {
    taskNumber: 14,
    title: "№14 Последовательности и закономерности",
    topic: "oge_sequences_patterns",
    template: "sequences_patterns",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Последовательности, закономерности, модели роста: змейки, столики, прогрессии, табличные или графические правила."
  },
  {
    taskNumber: 15,
    title: "№15 Геометрия: треугольники",
    topic: "oge_geometry_triangles",
    template: "geometry_triangles",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Треугольники, средняя линия, синусы, косинусы, теорема Пифагора, простые метрические вычисления."
  },
  {
    taskNumber: 16,
    title: "№16 Геометрия: окружность",
    topic: "oge_geometry_circle",
    template: "geometry_circle",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Окружность, вписанные и центральные углы, дуги, радиус, квадрат и окружность."
  },
  {
    taskNumber: 17,
    title: "№17 Геометрия: четырёхугольники",
    topic: "oge_geometry_quadrilaterals",
    template: "geometry_quadrilaterals",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Ромб, трапеция, параллелограмм, углы, свойства сторон и диагоналей."
  },
  {
    taskNumber: 18,
    title: "№18 Геометрия на клетчатой бумаге",
    topic: "oge_grid_geometry",
    template: "grid_geometry",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Клетчатая бумага: площади, трапеции, круги, отношения площадей, геометрические измерения по рисунку."
  },
  {
    taskNumber: 19,
    title: "№19 Геометрические утверждения",
    topic: "oge_geometry_statements",
    template: "geometry_statements",
    answerType: "digit_sequence",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Выбор одного или нескольких верных геометрических утверждений; ответ может быть одной цифрой или последовательностью цифр."
  },
  {
    taskNumber: 20,
    title: "№20 Алгебра с развёрнутым решением",
    topic: "oge_algebra_full_solution",
    template: "algebra_full_solution",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Уравнение, система уравнений или неравенство с полным решением."
  },
  {
    taskNumber: 21,
    title: "№21 Текстовая задача",
    topic: "oge_word_problem_full_solution",
    template: "word_problem_full_solution",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Текстовая задача на движение, работу, проценты, смеси, сплавы или практическую модель."
  },
  {
    taskNumber: 22,
    title: "№22 График функции и параметр",
    topic: "oge_function_graph_parameter",
    template: "function_graph_parameter",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Построение графика функции и определение значений параметра, при которых прямая имеет нужное число общих точек."
  },
  {
    taskNumber: 23,
    title: "№23 Геометрическая задача",
    topic: "oge_geometry_computation_full_solution",
    template: "geometry_computation_full_solution",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Геометрическая вычислительная задача с полным обоснованием."
  },
  {
    taskNumber: 24,
    title: "№24 Геометрическое доказательство",
    topic: "oge_geometry_proof",
    template: "geometry_proof",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Доказательство геометрического утверждения."
  },
  {
    taskNumber: 25,
    title: "№25 Сложная геометрия",
    topic: "oge_geometry_advanced",
    template: "geometry_advanced",
    answerType: "full_solution",
    difficulty: "very_hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Сложная геометрическая задача на вычисление с доказательной частью."
  }
];

const EGE_PROFILE_TASKS = [
  {
    taskNumber: 1,
    title: "№1 Планиметрия",
    topic: "ege_profile_planimetry_basic",
    template: "planimetry_basic",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Простая планиметрия: окружность, треугольник, трапеция, углы, длины, площади."
  },
  {
    taskNumber: 2,
    title: "№2 Векторы",
    topic: "ege_profile_vectors",
    template: "vectors",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Координаты векторов, длина вектора, скалярное произведение, угол между векторами."
  },
  {
    taskNumber: 3,
    title: "№3 Стереометрия",
    topic: "ege_profile_stereometry_basic",
    template: "stereometry_basic",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Объёмы, площади, пирамиды, призмы, усечения, простые пространственные конфигурации."
  },
  {
    taskNumber: 4,
    title: "№4 Простая вероятность",
    topic: "ege_profile_probability_basic",
    template: "probability_basic",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Классическая вероятность одного события, дополнение события, простые случайные выборы."
  },
  {
    taskNumber: 5,
    title: "№5 Вероятность событий",
    topic: "ege_profile_probability_events",
    template: "probability_events",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Сложные вероятностные события: несколько условий, независимость, зависимость, сочетания событий."
  },
  {
    taskNumber: 6,
    title: "№6 Простые уравнения",
    topic: "ege_profile_equations_basic",
    template: "equations_basic",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Простые логарифмические, показательные, степенные, тригонометрические и рациональные уравнения."
  },
  {
    taskNumber: 7,
    title: "№7 Преобразование выражений",
    topic: "ege_profile_expressions",
    template: "expressions",
    answerType: "numeric",
    difficulty: "easy",
    part: 1,
    responseMode: "short_answer",
    description:
      "Тригонометрические, степенные, логарифмические и алгебраические выражения."
  },
  {
    taskNumber: 8,
    title: "№8 Графики и производная",
    topic: "ege_profile_derivative_graphs",
    template: "derivative_graphs",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Анализ графика функции или производной: экстремумы, монотонность, касательные, количество точек."
  },
  {
    taskNumber: 9,
    title: "№9 Формулы и прикладные расчёты",
    topic: "ege_profile_formula_application",
    template: "formula_application",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Физические, технические и прикладные формулы: выразить величину, подставить данные, найти число."
  },
  {
    taskNumber: 10,
    title: "№10 Текстовая задача",
    topic: "ege_profile_word_problem",
    template: "word_problem",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Движение, смеси, сплавы, проценты, работа, рациональная модель по условию."
  },
  {
    taskNumber: 11,
    title: "№11 Графики функций",
    topic: "ege_profile_function_graphs",
    template: "function_graphs",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Пересечение графиков, восстановление параметров функций, координаты точек пересечения."
  },
  {
    taskNumber: 12,
    title: "№12 Производная и исследование функции",
    topic: "ege_profile_derivative_optimization",
    template: "derivative_optimization",
    answerType: "numeric",
    difficulty: "medium",
    part: 1,
    responseMode: "short_answer",
    description:
      "Производная, наибольшее/наименьшее значение, исследование функции на отрезке."
  },
  {
    taskNumber: 13,
    title: "№13 Уравнение с развёрнутым решением",
    topic: "ege_profile_advanced_equations",
    template: "advanced_equations",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Тригонометрические, логарифмические, показательные и комбинированные уравнения с отбором корней."
  },
  {
    taskNumber: 14,
    title: "№14 Стереометрия",
    topic: "ege_profile_stereometry_advanced",
    template: "stereometry_advanced",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Сложная стереометрия: доказательство, сечения, углы, расстояния, объёмы."
  },
  {
    taskNumber: 15,
    title: "№15 Неравенство",
    topic: "ege_profile_inequalities",
    template: "inequalities",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Логарифмические, показательные, рациональные и смешанные неравенства."
  },
  {
    taskNumber: 16,
    title: "№16 Экономическая задача",
    topic: "ege_profile_economics",
    template: "economics",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Кредиты, вклады, платежи, проценты, последовательности платежей, финансовые модели."
  },
  {
    taskNumber: 17,
    title: "№17 Планиметрия с доказательством",
    topic: "ege_profile_planimetry_advanced",
    template: "planimetry_advanced",
    answerType: "full_solution",
    difficulty: "hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Сложная планиметрия: доказательство геометрического факта и вычисление длины, угла или площади."
  },
  {
    taskNumber: 18,
    title: "№18 Параметр",
    topic: "ege_profile_parameters",
    template: "parameters",
    answerType: "full_solution",
    difficulty: "very_hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Уравнения, неравенства или системы с параметром; анализ количества решений."
  },
  {
    taskNumber: 19,
    title: "№19 Числа и логика",
    topic: "ege_profile_number_theory",
    template: "number_theory",
    answerType: "full_solution",
    difficulty: "very_hard",
    part: 2,
    responseMode: "full_solution",
    description:
      "Теория чисел, целочисленные конструкции, логика, оценки, доказательство невозможности или максимума."
  }
];

function getExamQuestionCount(examType) {
  if (examType === "OGE") return 25;
  if (examType === "EGE_PROFILE") return 19;
  if (examType === "EGE") return 19;
  return 10;
}

function getExamTitle(examType) {
  const normalized = normalizeExamType(examType);

  if (normalized === "OGE") {
    return "ОГЭ по математике";
  }

  if (normalized === "EGE_PROFILE") {
    return "ЕГЭ профильная математика";
  }

  return "Математический тест";
}

function getExamTasks(examType) {
  if (examType === "OGE") return OGE_TASKS;
  if (examType === "EGE_PROFILE" || examType === "EGE") return EGE_PROFILE_TASKS;
  return [];
}

function resolveOgeBlock(input) {
  const requested = String(input.blockType || "").trim();

  if (requested) {
    const found = OGE_CONTEXT_BLOCKS.find((block) => block.id === requested);
    if (found) return found;
  }

  return OGE_CONTEXT_BLOCKS[0];
}

function buildExamStructureText(examType) {
  const tasks = getExamTasks(examType);

  return tasks
    .map((task) => {
      return `${task.taskNumber}. ${task.title}: ${task.description}`;
    })
    .join("\n");
}

function normalizeExamType(value) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "OGE" || raw === "ОГЭ") return "OGE";

  if (
    raw === "EGE" ||
    raw === "ЕГЭ" ||
    raw === "EGE_PROFILE" ||
    raw === "ЕГЭ_PROFILE" ||
    raw === "ЕГЭ_ПРОФИЛЬ" ||
    raw === "PROFILE_EGE"
  ) {
    return "EGE_PROFILE";
  }

  return raw || "CUSTOM";
}

function getDefaultTaskTypesForAnswerType(answerType) {
  switch (answerType) {
    case "numeric":
      return ["numeric"];

    case "single_digit":
      return ["single_choice"];

    case "digit_sequence":
      return ["short_text"];

    case "full_solution":
      return ["full_solution"];

    case "mixed":
      return ["numeric", "short_text", "full_solution"];

    default:
      return ["numeric"];
  }
}

function getDefaultPracticeQuestionCount(preset, input) {
  if (Number.isInteger(input.questionCount) && input.questionCount > 0) {
    return input.questionCount;
  }

  if (preset?.responseMode === "full_solution") return 3;

  return 5;
}

function getTaskPreset(examType, taskNumber) {
  const number = Number(taskNumber);

  if (!Number.isInteger(number)) {
    return null;
  }

  return (
    getExamTasks(examType).find((task) => task.taskNumber === number) || null
  );
}


function resolveGenerationProfile(input) {
  const mode = input.mode === "exam" ? "exam" : "practice";
  const examType = normalizeExamType(input.examType || input.examFormat || "CUSTOM");

  const isOge = examType === "OGE";
  const isEgeProfile = examType === "EGE_PROFILE";
  const isKnownExam = isOge || isEgeProfile;

  if (mode === "exam") {
    if (!isKnownExam) {
      return {
        mode,
        examType,
        title: input.topic || "Свободный экзаменационный вариант",
        topic: input.topic || "custom_exam",
        topicLabel: input.topic || "Свободный экзамен",
        questionCount:
          Number.isInteger(input.questionCount) && input.questionCount > 0
            ? input.questionCount
            : 10,
        difficulty: input.difficulty || "mixed",
        answerType: "mixed",
        taskTypes: Array.isArray(input.taskTypes) && input.taskTypes.length
          ? input.taskTypes
          : ["numeric", "short_text", "full_solution"],
        structure: [],
        instructions: `
Сгенерируй экзаменационный вариант по указанной теме.

ТЕМА: ${input.topic || "custom_exam"}
КОЛИЧЕСТВО ЗАДАНИЙ: ${
          Number.isInteger(input.questionCount) && input.questionCount > 0
            ? input.questionCount
            : 10
        }

ТРЕБОВАНИЯ:
- Соблюдай единый экзаменационный стиль.
- Сложность должна возрастать постепенно.
- У каждого задания должен быть корректный ответ.
- У заданий с развёрнутым решением должны быть solutionBlocks и итоговый ответ.
`
      };
    }

    const tasks = getExamTasks(examType);
    const examTitle = getExamTitle(examType);
    const questionCount = isOge ? 25 : 19;
    const block = isOge ? resolveOgeBlock(input) : null;

    return {
      mode,
      examType,
      title: examTitle,
      topic: isOge ? "oge_full_variant" : "ege_profile_full_variant",
      topicLabel: "Полный вариант",
      questionCount,
      difficulty: "mixed",
      answerType: "mixed",
      taskTypes: ["numeric", "short_text", "full_solution"],
      block,
      structure: tasks,
      instructions: `
Сгенерируй полный экзаменационный вариант.

ЭКЗАМЕН: ${examTitle}
КОЛИЧЕСТВО ЗАДАНИЙ: ${questionCount}

ТРЕБОВАНИЯ:
- Сгенерируй ровно ${questionCount} заданий.
- Нумерация заданий должна строго соответствовать структуре экзамена.
- Каждое задание должно иметь поле examTaskNumber.
- Каждое задание должно соответствовать своему номеру экзамена.
- Не смешивай разные номера заданий.
- Не заменяй задания с кратким ответом заданиями с выбором ответа, если в структуре указан numeric или short_text.
- Для заданий с кратким ответом дай проверяемый answer.
- Для заданий с развёрнутым решением дай полноценное решение: solution, explanation и solutionBlocks.
- Для digit_sequence ответ должен быть строкой без пробелов, например "13", "132", "321".

${
  isOge
    ? `ОСОБО ДЛЯ ОГЭ:
- Задания 1–5 должны быть связаны одним общим практическим блоком.
- Тип блока 1–5: ${block?.title || "практический блок"}.
- Описание блока: ${block?.description || "единый прикладной сюжет для заданий 1–5"}.
- Задания 1–19 имеют краткий ответ.
- Задания 20–25 требуют развёрнутого решения.`
    : `ОСОБО ДЛЯ ЕГЭ ПРОФИЛЬ:
- Задания 1–12 имеют краткий ответ.
- Задания 13–19 требуют развёрнутого решения.
- Задание 17 — сложная планиметрия: доказательство и вычисление.
- Задание 18 — параметр.
- Задание 19 — числа, логика или теория чисел.`
}

СТРУКТУРА:
${buildExamStructureText(examType)}
`
    };
  }

  const preset = getTaskPreset(examType, input.examTaskNumber);

  if (preset) {
    const taskTypes = getDefaultTaskTypesForAnswerType(preset.answerType);
    const questionCount = getDefaultPracticeQuestionCount(preset, input);
    const examTitle = getExamTitle(examType);

    return {
      mode,
      examType,
      taskNumber: preset.taskNumber,
      title: `${examTitle} · ${preset.title}`,
      topic: preset.topic,
      topicLabel: preset.title,
      questionCount,
      difficulty: preset.difficulty || input.difficulty || "medium",
      answerType: preset.answerType,
      taskTypes,
      template: preset.template,
      structure: [preset],
      instructions: `
Сгенерируй тренировочный набор по конкретному номеру экзамена.

ЭКЗАМЕН: ${examTitle}
НОМЕР ЗАДАНИЯ: ${preset.taskNumber}
НАЗВАНИЕ: ${preset.title}
ТЕМА: ${preset.topic}
ОПИСАНИЕ: ${preset.description}
ФОРМАТ ОТВЕТА: ${preset.answerType}
ТИПЫ ЗАДАНИЙ: ${taskTypes.join(", ")}
КОЛИЧЕСТВО ЗАДАНИЙ: ${questionCount}
СЛОЖНОСТЬ: ${preset.difficulty || input.difficulty || "medium"}

ТРЕБОВАНИЯ:
- Все задания должны соответствовать именно этому номеру экзамена.
- Не генерируй задания из других номеров.
- Сохраняй экзаменационный стиль.
- В каждом вопросе укажи examTaskNumber: ${preset.taskNumber}.
- Формат ответа должен соответствовать preset.answerType.
- Если answerType = numeric, не делай single_choice.
- Если answerType = digit_sequence, правильный ответ должен быть строкой цифр без пробелов, например "13" или "132".
- Если answerType = full_solution, задание должно требовать развёрнутого решения.
- Ответ, решение и ключ проверки должны быть математически согласованы.
`
    };
  }

  return {
    mode,
    examType,
    title: input.topic || "Тренировка по теме",
    topic: input.topic || "general_math",
    topicLabel: input.topic || "Общая математика",
    questionCount:
      Number.isInteger(input.questionCount) && input.questionCount > 0
        ? input.questionCount
        : 5,
    difficulty: input.difficulty || "medium",
    answerType: "mixed",
    taskTypes: Array.isArray(input.taskTypes) && input.taskTypes.length
      ? input.taskTypes
      : ["numeric", "single_choice", "short_text"],
    structure: [],
    instructions: `
Сгенерируй тренировочный набор по теме: ${input.topic || "general math"}.

ТРЕБОВАНИЯ:
- Если указан экзамен, сохраняй стиль этого экзамена.
- Все задания должны быть математически корректны.
- Ответ, решение и ключ проверки должны совпадать.
- Не допускай задания, где правильного ответа нет, если формат требует числовой ответ.
`
  };
}

function getExamQuestionCount(examType) {
  const normalized = normalizeExamType(examType);

  if (normalized === "OGE") return 25;
  if (normalized === "EGE_PROFILE") return 19;

  return 10;
}

function getExamPresetCatalog() {
  const examTypes = ["OGE", "EGE_PROFILE"];

  return {
    modes: [
      {
        id: "exam",
        title: "Полный вариант",
        description: "Сгенерировать полный экзаменационный вариант."
      },
      {
        id: "practice",
        title: "Практика по номеру",
        description: "Сгенерировать задания по конкретному номеру экзамена."
      }
    ],
    exams: examTypes.map((examType) => {
      const tasks = getExamTasks(examType);

      return {
        examType,
        title: getExamTitle(examType),
        questionCount: getExamQuestionCount(examType),
        tasks: tasks.map((task) => ({
          taskNumber: task.taskNumber,
          title: task.title,
          topic: task.topic,
          template: task.template,
          answerType: task.answerType,
          difficulty: task.difficulty,
          part: task.part,
          responseMode: task.responseMode,
          description: task.description
        }))
      };
    })
  };
}

module.exports = {
  OGE_CONTEXT_BLOCKS,
  OGE_TASKS,
  EGE_PROFILE_TASKS,
  normalizeExamType,
  getExamTitle,
  getExamTasks,
  getTaskPreset,
  getExamQuestionCount,
  getDefaultTaskTypesForAnswerType,
  getExamPresetCatalog,
  resolveGenerationProfile
};
