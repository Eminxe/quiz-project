const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON_BIN = (() => {
  const venvPython =
    process.platform === "win32"
      ? path.join(__dirname, ".venv", "Scripts", "python.exe")
      : path.join(__dirname, ".venv", "bin", "python");

  return fs.existsSync(venvPython)
    ? venvPython
    : process.platform === "win32"
      ? "python"
      : "python3";
})();

function runPython(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      cwd: __dirname,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
      },
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `Python exited with code ${code}\n\nSTDERR:\n${stderr}\n\nSTDOUT:\n${stdout}`
          )
        );
      }
    });
  });
}

module.exports = {
  PYTHON_BIN,
  runPython,
};