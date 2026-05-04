import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
PYTHON_BIN = sys.executable
RENDER_VISUAL_SCRIPT = ROOT / "render_visual.py"
VISUALS_DIR = ROOT / "assets" / "visuals"

SUPPORTED_TEMPLATES = {
    "quadratic_graph",
    "line_graph",
    "probability_urn",
    "triangle_geometry",
    "number_line_interval",
    "math_grid",
}


def run_render_visual(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [PYTHON_BIN, str(RENDER_VISUAL_SCRIPT), *map(str, args)],
        cwd=ROOT,
        env={**os.environ, "PYTHONUTF8": "1"},
        text=True,
        capture_output=True,
        check=True,
    )


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("JSON test file must contain an object at root level.")
    return data


def save_json(path: Path, data: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "_", value, flags=re.UNICODE)
    return value[:100] or "visual"


def get_questions_container(data: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    for key in ("questions", "items", "tasks"):
        value = data.get(key)
        if isinstance(value, list):
            return key, value
    raise ValueError("Не найден список вопросов: expected questions / items / tasks")


def extract_text(question: Dict[str, Any]) -> str:
    for key in ("text", "question", "prompt", "title", "statement"):
        value = question.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def already_has_visual(question: Dict[str, Any]) -> bool:
    visual = question.get("visual")
    return isinstance(visual, dict) and bool(visual.get("src"))


def to_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def to_int(value: Any, fallback: int) -> int:
    try:
        return int(round(float(value)))
    except Exception:
        return fallback


def to_bool(value: Any, fallback: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "1", "yes", "y"}:
            return True
        if v in {"false", "0", "no", "n"}:
            return False
    return fallback


def default_mode_for_template(template: str) -> str:
    if template in {
        "quadratic_graph",
        "line_graph",
        "probability_urn",
        "triangle_geometry",
        "math_grid",
    }:
        return "video"
    return "image"


def normalize_mode(template: str, raw_mode: Any) -> str:
    mode = str(raw_mode or "").strip().lower()
    if mode not in {"image", "video"}:
        return default_mode_for_template(template)
    return mode


def normalize_params(template: str, raw_params: Any) -> Dict[str, Any]:
    params = raw_params if isinstance(raw_params, dict) else {}

    if template == "quadratic_graph":
        return {
            "a": to_float(params.get("a"), 1),
            "b": to_float(params.get("b"), 0),
            "c": to_float(params.get("c"), 0),
            "x_min": to_float(params.get("x_min"), -5),
            "x_max": to_float(params.get("x_max"), 5),
        }

    if template == "line_graph":
        return {
            "m": to_float(params.get("m"), 1),
            "b": to_float(params.get("b"), 0),
            "x_min": to_float(params.get("x_min"), -5),
            "x_max": to_float(params.get("x_max"), 5),
        }

    if template == "probability_urn":
        return {
            "red": max(0, to_int(params.get("red"), 3)),
            "blue": max(0, to_int(params.get("blue"), 2)),
            "green": max(0, to_int(params.get("green"), 1)),
        }

    if template == "triangle_geometry":
        return {
            "a": to_float(params.get("a"), 3),
            "b": to_float(params.get("b"), 4),
            "c": to_float(params.get("c"), 5),
        }

    if template == "number_line_interval":
        left = to_float(params.get("left"), -2)
        right = to_float(params.get("right"), 3)
        if left > right:
            left, right = right, left

        return {
            "left": left,
            "right": right,
            "left_closed": to_bool(params.get("left_closed"), True),
            "right_closed": to_bool(params.get("right_closed"), False),
        }

    if template == "math_grid":
        return {
            "x_min": to_float(params.get("x_min"), -5),
            "x_max": to_float(params.get("x_max"), 5),
            "y_min": to_float(params.get("y_min"), -3),
            "y_max": to_float(params.get("y_max"), 3),
        }

    return {}


def read_blueprint(question: Dict[str, Any], fallback_text: str) -> Optional[Dict[str, Any]]:
    raw = question.get("visualBlueprint") or question.get("visual_blueprint")
    if not isinstance(raw, dict):
        return None

    template = str(raw.get("template", "")).strip()
    if template not in SUPPORTED_TEMPLATES:
        return None

    caption = str(raw.get("caption") or raw.get("title") or "Визуализация").strip()
    alt = str(raw.get("alt") or caption or fallback_text or "Визуализация к вопросу").strip()
    mode = normalize_mode(template, raw.get("mode"))

    return {
        "template": template,
        "params": normalize_params(template, raw.get("params")),
        "caption": caption,
        "alt": alt,
        "mode": mode,
        "source": "blueprint",
    }


def normalize_expression_text(text: str) -> str:
    s = text.replace("−", "-").replace("–", "-").replace("—", "-")
    s = s.replace("x²", "x^2").replace("X²", "x^2")
    s = s.replace(" ", "")
    s = s.replace("*", "")
    s = s.replace("·", "")
    return s


def extract_expression(text: str) -> Optional[str]:
    s = normalize_expression_text(text)
    patterns = [
        r"f\(x\)=([^\n,;]+)",
        r"y=([^\n,;]+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, s, flags=re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def parse_coeff(raw: str) -> float:
    if raw in ("", "+"):
        return 1.0
    if raw == "-":
        return -1.0
    return float(raw)


def parse_quadratic_expression(expr: str) -> Optional[Dict[str, float]]:
    s = normalize_expression_text(expr)
    if "x^2" not in s:
        return None

    quad_match = re.search(r"([+\-]?(?:\d+(?:\.\d+)?)?)x\^2", s)
    if not quad_match:
        return None

    a = parse_coeff(quad_match.group(1))
    rest = s.replace(quad_match.group(0), "", 1)

    lin_match = re.search(r"([+\-]?(?:\d+(?:\.\d+)?)?)x(?![\^0-9])", rest)
    b = parse_coeff(lin_match.group(1)) if lin_match else 0.0
    if lin_match:
        rest = rest.replace(lin_match.group(0), "", 1)

    c = 0.0
    if rest:
        const_match = re.search(r"([+\-]?\d+(?:\.\d+)?)", rest)
        if const_match:
            c = float(const_match.group(1))

    return {"a": a, "b": b, "c": c}


def parse_line_expression(expr: str) -> Optional[Dict[str, float]]:
    s = normalize_expression_text(expr)
    if "x^2" in s:
        return None
    if "x" not in s:
        return None

    lin_match = re.search(r"([+\-]?(?:\d+(?:\.\d+)?)?)x", s)
    if not lin_match:
        return None

    m = parse_coeff(lin_match.group(1))
    rest = s.replace(lin_match.group(0), "", 1)

    b = 0.0
    if rest:
        const_match = re.search(r"([+\-]?\d+(?:\.\d+)?)", rest)
        if const_match:
            b = float(const_match.group(1))

    return {"m": m, "b": b}


def infer_graph_from_expression(text: str) -> Optional[Dict[str, Any]]:
    expr = extract_expression(text)
    if not expr:
        return None

    quad = parse_quadratic_expression(expr)
    if quad:
        return {
            "template": "quadratic_graph",
            "params": {
                "a": quad["a"],
                "b": quad["b"],
                "c": quad["c"],
                "x_min": -5,
                "x_max": 5,
            },
            "caption": "График функции из условия",
            "alt": f"График функции {expr}",
            "mode": "video",
            "source": "heuristic",
        }

    line = parse_line_expression(expr)
    if line:
        return {
            "template": "line_graph",
            "params": {
                "m": line["m"],
                "b": line["b"],
                "x_min": -5,
                "x_max": 5,
            },
            "caption": "График функции из условия",
            "alt": f"График функции {expr}",
            "mode": "video",
            "source": "heuristic",
        }

    return None

def detect_heuristic(question: Dict[str, Any], text: str) -> Optional[Dict[str, Any]]:
    qtype = str(question.get("type", "")).lower()
    lower = text.lower()

    inferred_graph = infer_graph_from_expression(text)
    if inferred_graph:
        return inferred_graph

    if any(word in lower for word in ["урна", "шар", "вероятност", "достают", "доста", "случайн"]) or "probability" in qtype:
        return {
            "template": "probability_urn",
            "params": {"red": 3, "blue": 2, "green": 1},
            "caption": "Схема вероятностной модели",
            "alt": "Урна с шарами разных цветов",
            "mode": "video",
            "source": "heuristic",
        }

    if any(word in lower for word in ["треуголь", "угол", "гипотенуз", "катет", "сторона"]) or "geometry" in qtype:
        return {
            "template": "triangle_geometry",
            "params": {"a": 3, "b": 4, "c": 5},
            "caption": "Геометрическая схема к вопросу",
            "alt": "Треугольник со сторонами",
            "mode": "video",
            "source": "heuristic",
        }

    if any(word in lower for word in ["интервал", "промежут", "числов", "отрезок", "луч", "неравенств"]):
        return {
            "template": "number_line_interval",
            "params": {"left": -2, "right": 3, "left_closed": True, "right_closed": False},
            "caption": "Числовая схема к вопросу",
            "alt": "Числовая прямая с отмеченным промежутком",
            "mode": "image",
            "source": "heuristic",
        }

    # ВАЖНО: если нет уверенного визуала — пропускаем
    return None

def get_blueprint(question: Dict[str, Any], text: str) -> Optional[Dict[str, Any]]:
    explicit = read_blueprint(question, text)
    if explicit:
        return explicit
    return detect_heuristic(question, text)


def build_output_path(test_slug: str, index: int, template: str, mode: str) -> Path:
    VISUALS_DIR.mkdir(parents=True, exist_ok=True)
    ext = "mp4" if mode == "video" else "png"
    filename = f"{test_slug}_q{index + 1}_{template}.{ext}"
    return VISUALS_DIR / filename


def build_visual_block(media_path: Path, caption: str, alt: str, mode: str) -> Dict[str, Any]:
    relative = media_path.relative_to(ROOT).as_posix()
    version = int(media_path.stat().st_mtime)

    return {
        "type": "video" if mode == "video" else "image",
        "src": f"{relative}?v={version}",
        "caption": caption,
        "alt": alt or caption,
    }


def render_visual_for_question(test_slug: str, index: int, blueprint: Dict[str, Any]) -> Optional[Path]:
    output_path = build_output_path(test_slug, index, blueprint["template"], blueprint["mode"])

    result = run_render_visual(
        "--template", blueprint["template"],
        "--params", json.dumps(blueprint["params"], ensure_ascii=False),
        "--out", str(output_path),
        "--caption", blueprint["caption"],
        "--alt", blueprint["alt"],
        "--mode", blueprint["mode"],
    )

    if result.stdout:
        print(result.stdout)

    if result.stderr:
        print(result.stderr)

    if output_path.exists():
        return output_path

    return None


def process_test_file(test_path: Path, overwrite: bool = False) -> Dict[str, Any]:
    data = load_json(test_path)
    container_key, questions = get_questions_container(data)

    test_slug = slugify(test_path.stem)

    generated = 0
    skipped = 0
    failed = 0
    removed = 0
    blueprints_used = 0
    heuristics_used = 0

    for idx, question in enumerate(questions):
        if not isinstance(question, dict):
            skipped += 1
            continue

        current_has_visual = already_has_visual(question)

        if current_has_visual and not overwrite:
            skipped += 1
            continue

        text = extract_text(question)
        blueprint = get_blueprint(question, text)

        if not blueprint:
            if overwrite and current_has_visual:
                question.pop("visual", None)
                removed += 1
            skipped += 1
            continue

        try:
            media_path = render_visual_for_question(test_slug, idx, blueprint)

            if not media_path:
                failed += 1
                continue

            question["visual"] = build_visual_block(
                media_path=media_path,
                caption=blueprint["caption"],
                alt=blueprint["alt"],
                mode=blueprint["mode"],
            )

            if blueprint["source"] == "blueprint":
                blueprints_used += 1
                question["visualBlueprint"] = {
                    "template": blueprint["template"],
                    "params": blueprint["params"],
                    "caption": blueprint["caption"],
                    "alt": blueprint["alt"],
                    "mode": blueprint["mode"],
                }
            else:
                heuristics_used += 1

            generated += 1

        except subprocess.CalledProcessError as e:
            failed += 1
            print(f"[ERROR] q{idx + 1}: render failed")
            if e.stdout:
                print(e.stdout)
            if e.stderr:
                print(e.stderr)

        except Exception as e:
            failed += 1
            print(f"[ERROR] q{idx + 1}: {e}")

    data[container_key] = questions
    save_json(test_path, data)

    return {
        "test": str(test_path),
        "generated": generated,
        "skipped": skipped,
        "failed": failed,
        "removed": removed,
        "blueprints_used": blueprints_used,
        "heuristics_used": heuristics_used,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", required=True, help="Path to test JSON")
    parser.add_argument("--overwrite", action="store_true", help="Re-render visuals even if visual already exists")
    args = parser.parse_args()

    test_path = Path(args.test)
    if not test_path.is_absolute():
        test_path = (ROOT / test_path).resolve()

    if not test_path.exists():
        raise FileNotFoundError(f"Test file not found: {test_path}")

    summary = process_test_file(test_path, overwrite=args.overwrite)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()