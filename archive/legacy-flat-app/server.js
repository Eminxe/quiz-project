const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { runPython, PYTHON_BIN } = require("../../apps/worker-visuals/src/python/pythonRunner");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(ROOT_DIR));

function cleanMessage(text) {
  if (!text) return "Неизвестная ошибка.";
  return String(text).replace(/\u001b\[[0-9;]*m/g, "").trim();
}

function normalizeEnabledTypes(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

function runGenerator({
  topic,
  subtopic,
  language,
  examFormat,
  level,
  questionCount,
  audience,
  goal,
  tone,
  explanationStyle,
  visualStyle,
  enabledTypes,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["generator.js"], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Генерация заняла слишком много времени."));
    }, 10 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const output = `${stdout}\n${stderr}`.trim();
      const errorMatch = output.match(/Ошибка:\s*([\s\S]+)/m);

      if (code !== 0 || errorMatch) {
        reject(
          new Error(
            cleanMessage(
              errorMatch?.[1] ||
                stderr ||
                stdout ||
                `generator.js завершился с кодом ${code}`
            )
          )
        );
        return;
      }

      const testIdMatch = output.match(/Добавлен в каталог:\s*(.+)/);
      const titleMatch = output.match(/Название теста:\s*(.+)/);
      const filePathMatch = output.match(/Файл сохранён:\s*(.+)/);

      const testId = testIdMatch?.[1]?.trim();
      const title = titleMatch?.[1]?.trim() || topic;
      const filePath = filePathMatch?.[1]?.trim() || "";

      if (!testId || !filePath) {
        reject(
          new Error("Тест создан, но не удалось извлечь id или путь к файлу.")
        );
        return;
      }

      resolve({
        testId,
        title,
        filePath,
        rawOutput: output,
      });
    });

    const inputLines = [
      topic,
      subtopic || "",
      language || "ru",
      examFormat || "custom",
      level,
      String(questionCount),
      audience,
      goal || "diagnostic",
      tone,
      explanationStyle || "detailed",
      visualStyle || "standard",
      Array.isArray(enabledTypes) ? enabledTypes.join(",") : "",
    ];

    child.stdin.write(`${inputLines.join("\n")}\n`, "utf-8");
    child.stdin.end();
  });
}

function resolveTestFileFromId(testId) {
  const catalogPath = path.join(ROOT_DIR, "tests", "catalog.json");

  if (!fs.existsSync(catalogPath)) {
    throw new Error("Не найден tests/catalog.json");
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  const item = Array.isArray(catalog)
    ? catalog.find((x) => x.id === testId)
    : null;

  if (!item?.file) {
    throw new Error(`Тест с id "${testId}" не найден в catalog.json`);
  }

  const relPath = String(item.file).replace(/^\//, "");
  return path.join(ROOT_DIR, relPath);
}

async function tryRenderVisuals(testFilePath) {
  try {
    const resolvedFile = path.isAbsolute(testFilePath)
      ? testFilePath
      : path.join(ROOT_DIR, testFilePath);

    const { stdout, stderr } = await runPython([
      "render_test_visuals.py",
      "--test",
      resolvedFile,
      "--overwrite",
    ]);

    return {
      ok: true,
      message: cleanMessage(stdout || "Визуализации Manim созданы."),
      stderr: cleanMessage(stderr || ""),
    };
  } catch (error) {
    return {
      ok: false,
      message: cleanMessage(error.message || error),
    };
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    python: PYTHON_BIN,
  });
});

app.post("/api/generate-test", async (req, res) => {
  try {
    const {
      topic = "",
      subtopic = "",
      language = "ru",
      examFormat = "custom",
      level = "",
      questionCount,
      audience = "",
      goal = "diagnostic",
      tone = "",
      explanationStyle = "detailed",
      visualStyle = "standard",
      enabledTypes = [],
    } = req.body || {};

    const normalizedTopic = String(topic).trim();
    const normalizedSubtopic = String(subtopic).trim();
    const normalizedLanguage =
      String(language).trim().toLowerCase() === "en" ? "en" : "ru";
    const normalizedExamFormat =
      String(examFormat).trim().toLowerCase() || "custom";
    const normalizedLevel = String(level).trim();
    const normalizedAudience = String(audience).trim();
    const normalizedGoal = String(goal).trim() || "diagnostic";
    const normalizedTone = String(tone).trim();
    const normalizedExplanationStyle =
      String(explanationStyle).trim() || "detailed";
    const normalizedVisualStyle =
      String(visualStyle).trim() || "standard";
    const normalizedQuestionCount = Number(questionCount);
    const normalizedEnabledTypes = normalizeEnabledTypes(enabledTypes);

    if (!normalizedTopic) {
      return res.status(400).json({
        ok: false,
        message: "Укажи тему теста.",
      });
    }

    if (!normalizedLevel) {
      return res.status(400).json({
        ok: false,
        message: "Укажи уровень.",
      });
    }

    if (
      !Number.isInteger(normalizedQuestionCount) ||
      normalizedQuestionCount < 1 ||
      normalizedQuestionCount > 30
    ) {
      return res.status(400).json({
        ok: false,
        message: "Количество вопросов должно быть целым числом от 1 до 30.",
      });
    }

    if (!normalizedAudience) {
      return res.status(400).json({
        ok: false,
        message: "Укажи аудиторию.",
      });
    }

    if (!normalizedTone) {
      return res.status(400).json({
        ok: false,
        message: "Укажи стиль.",
      });
    }

    if (!normalizedEnabledTypes.length) {
      return res.status(400).json({
        ok: false,
        message: "Выбери хотя бы один тип задания.",
      });
    }

  const generation = await runGenerator({
  topic: normalizedTopic,
  subtopic: normalizedSubtopic,
  language: normalizedLanguage,
  examFormat: normalizedExamFormat,
  level: normalizedLevel,
  questionCount: normalizedQuestionCount,
  audience: normalizedAudience,
  goal: normalizedGoal,
  tone: normalizedTone,
  explanationStyle: normalizedExplanationStyle,
  visualStyle: normalizedVisualStyle,
  enabledTypes: normalizedEnabledTypes,
});

res.json({
  ok: true,
  message: "Тест успешно создан.",
  testId: generation.testId,
  title: generation.title,
  filePath: generation.filePath,
  openUrl: `/test.html?id=${encodeURIComponent(generation.testId)}`,
  catalogUrl: "/index.html#catalog",
  visuals: {
    ok: false,
    pending: true,
    message: "Тест создан. Визуализации можно обработать отдельным этапом."
  },
});

setImmediate(async () => {
  try {
    const visuals = await tryRenderVisuals(generation.filePath);
    console.log(
      `[VISUALS] ${generation.testId}: ${visuals.ok ? "ok" : "fail"} - ${visuals.message}`
    );
  } catch (visualError) {
    console.error(
      `[VISUALS] ${generation.testId}: ${cleanMessage(visualError.message || visualError)}`
    );
  }
});
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: cleanMessage(error.message || error),
    });
  }
});

app.post("/api/render-visuals", async (req, res) => {
  try {
    const { testId = "", filePath = "" } = req.body || {};

    let resolvedFile = "";

    if (filePath) {
      resolvedFile = path.isAbsolute(filePath)
        ? filePath
        : path.join(ROOT_DIR, filePath);
    } else if (testId) {
      resolvedFile = resolveTestFileFromId(String(testId).trim());
    } else {
      return res.status(400).json({
        ok: false,
        message: "Передай testId или filePath.",
      });
    }

    const result = await tryRenderVisuals(resolvedFile);

    if (!result.ok) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: cleanMessage(error.message || error),
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`EMS MATH server started: http://localhost:${PORT}`);
  console.log(`Python bin: ${PYTHON_BIN}`);
});
