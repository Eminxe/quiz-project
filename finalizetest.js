const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  process.env.PYTHON ||
  (process.platform === "win32" ? "python" : "python3");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeSlug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "item";
}

function getVisualExtension(mode = "image") {
  return mode === "video" ? "mp4" : "png";
}

function buildVisualFileName(testId, questionIndex, blueprint) {
  const template = safeSlug(blueprint?.template || "visual");
  const ext = getVisualExtension(blueprint?.mode || "image");
  return `${safeSlug(testId)}_q${questionIndex + 1}_${template}.${ext}`;
}

function buildVisualRelativePath(fileName) {
  return `/assets/generated/${fileName}`;
}

function buildVisualAbsolutePath(projectRoot, fileName) {
  return path.join(projectRoot, "assets", "generated", fileName);
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasRenderableBlueprint(question) {
  const vb = question?.visualBlueprint;
  return !!(
    vb &&
    typeof vb === "object" &&
    typeof vb.template === "string" &&
    vb.template.trim()
  );
}

function shouldRenderVisual(question) {
  if (!hasRenderableBlueprint(question)) return false;

  const vb = question.visualBlueprint;
  const template = String(vb.template || "").trim();

  if (!template) return false;

  return true;
}

function fileExistsNonEmpty(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function cleanText(text) {
  return String(text || "").replace(/\u001b\[[0-9;]*m/g, "").trim();
}

function renderVisualViaPython({
  projectRoot,
  question,
  testId,
  questionIndex,
}) {
  const blueprint = question.visualBlueprint;
  const fileName = buildVisualFileName(testId, questionIndex, blueprint);
  const outputPath = buildVisualAbsolutePath(projectRoot, fileName);
  const relativePath = buildVisualRelativePath(fileName);

  ensureDir(path.dirname(outputPath));

  const pythonScript = path.join(projectRoot, "render_visual.py");

  if (!fs.existsSync(pythonScript)) {
    return {
      ok: false,
      reason: "render_visual.py не найден",
      visual: null,
    };
  }

  if (fs.existsSync(outputPath)) {
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // ignore
    }
  }

  const args = [
    pythonScript,
    "--template",
    String(blueprint.template || ""),
    "--params",
    JSON.stringify(blueprint.params || {}),
    "--out",
    outputPath,
    "--caption",
    String(blueprint.caption || ""),
    "--alt",
    String(blueprint.alt || ""),
    "--mode",
    String(blueprint.mode || "image"),
  ];

  const result = spawnSync(PYTHON_BIN, args, {
    cwd: projectRoot,
    encoding: "utf-8",
    shell: false,
    windowsHide: true,
    timeout: 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
    },
  });

  if (result.error) {
    return {
      ok: false,
      reason: cleanText(result.error.message || "Ошибка запуска Python"),
      visual: null,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      reason: cleanText(result.stderr || result.stdout || `Python завершился с кодом ${result.status}`),
      visual: null,
    };
  }

  if (!fileExistsNonEmpty(outputPath)) {
    return {
      ok: false,
      reason: "Файл визуала не был создан",
      visual: null,
    };
  }

  return {
    ok: true,
    reason: "",
    visual: {
      type: blueprint.mode === "video" ? "video" : "image",
      src: relativePath,
      caption: blueprint.caption || "",
      alt: blueprint.alt || blueprint.caption || "Визуализация",
    },
  };
}

async function finalizeTestVisuals(testData, { testId, projectRoot }) {
  const cloned = cloneDeep(testData || {});

  if (!Array.isArray(cloned.questions)) {
    return cloned;
  }

  const finalizedQuestions = cloned.questions.map((question) => {
    const q = cloneDeep(question);
    q.visual = null;
    return q;
  });

  for (let i = 0; i < finalizedQuestions.length; i++) {
    const question = finalizedQuestions[i];

    if (!shouldRenderVisual(question)) {
      question.visual = null;
      continue;
    }

    const renderResult = renderVisualViaPython({
      projectRoot,
      question,
      testId,
      questionIndex: i,
    });

    if (renderResult.ok) {
      question.visual = renderResult.visual;
      console.log(
        `[VISUAL] Вопрос ${i + 1}: OK -> ${renderResult.visual.src}`
      );
    } else {
      question.visual = null;
      console.warn(
        `[VISUAL] Вопрос ${i + 1}: визуал не создан: ${renderResult.reason}`
      );
    }
  }

  cloned.questions = finalizedQuestions;
  return cloned;
}

module.exports = {
  finalizeTestVisuals,
};
