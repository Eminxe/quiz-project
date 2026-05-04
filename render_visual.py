import argparse
import json
from pathlib import Path
from typing import Any, Dict

from manim import (
    Axes,
    Circle,
    Create,
    Dot,
    DOWN,
    FadeIn,
    GREEN,
    LEFT,
    Line,
    MathTex,
    NumberLine,
    NumberPlane,
    Polygon,
    RED,
    RIGHT,
    Scene,
    Square,
    Text,
    UP,
    VGroup,
    WHITE,
    BLACK,
    BLUE,
    config,
)

ROOT = Path(__file__).resolve().parent


def load_params(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def fmt_num(value: float) -> str:
    if int(value) == value:
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def quadratic_formula(a: float, b: float, c: float) -> str:
    parts = ["y = "]

    if a == 1:
        parts.append("x²")
    elif a == -1:
        parts.append("-x²")
    else:
        parts.append(f"{fmt_num(a)}x²")

    if b != 0:
        sign = " + " if b > 0 else " - "
        coeff = abs(b)
        if coeff == 1:
            parts.append(f"{sign}x")
        else:
            parts.append(f"{sign}{fmt_num(coeff)}x")

    if c != 0:
        sign = " + " if c > 0 else " - "
        parts.append(f"{sign}{fmt_num(abs(c))}")

    return "".join(parts)


def line_formula(m: float, b: float) -> str:
    parts = ["y = "]

    if m == 1:
        parts.append("x")
    elif m == -1:
        parts.append("-x")
    else:
        parts.append(f"{fmt_num(m)}x")

    if b != 0:
        sign = " + " if b > 0 else " - "
        parts.append(f"{sign}{fmt_num(abs(b))}")

    return "".join(parts)


def base_scene_setup(mode: str):
    config.background_color = WHITE
    config.pixel_width = 900
    config.pixel_height = 420
    config.frame_rate = 30
    config.disable_caching = True

    if mode == "video":
        config.format = "mp4"
        config.write_to_movie = True
        config.save_last_frame = False
    else:
        config.format = "png"
        config.write_to_movie = False
        config.save_last_frame = True


def build_title(caption: str):
    text = caption.strip() if caption else "Визуализация"
    return Text(text, font_size=20, color=BLACK).to_edge(UP, buff=0.18)


class BaseVisualScene(Scene):
    def __init__(self, params=None, caption="", mode="image", **kwargs):
        self.params = params or {}
        self.caption = caption
        self.mode = mode
        super().__init__(**kwargs)

    def show_static(self, *mobjects):
        self.add(*mobjects)

    def show_video_title(self, title, subtitle=None):
        self.play(FadeIn(title, shift=DOWN * 0.1), run_time=0.4)
        if subtitle is not None:
            self.play(FadeIn(subtitle, shift=DOWN * 0.05), run_time=0.35)

    def finish_video(self, pause=0.35):
        self.wait(pause)


def build_callable_from_spec(spec):
    kind = str(spec.get("kind", "")).strip().lower()

    if kind == "quadratic":
        a = float(spec.get("a", 1) or 0)
        b = float(spec.get("b", 0) or 0)
        c = float(spec.get("c", 0) or 0)
        return lambda x: a * x * x + b * x + c

    if kind == "line":
        m = float(spec.get("m", 1) or 0)
        b = float(spec.get("b", 0) or 0)
        return lambda x: m * x + b

    raise ValueError(f"Unsupported function kind: {kind}")


class TwoFunctionGraphScene(BaseVisualScene):
    def construct(self):
        x_min = float(self.params.get("x_min", -6) or -6)
        x_max = float(self.params.get("x_max", 6) or 6)
        y_min = float(self.params.get("y_min", -6) or -6)
        y_max = float(self.params.get("y_max", 6) or 6)

        functions = self.params.get("functions", []) or []
        if len(functions) < 2:
            functions = [
                {"kind": "quadratic", "a": 1, "b": 0, "c": 0, "m": None},
                {"kind": "line", "m": 1, "b": 0, "a": None, "c": None},
            ]

        title = build_title(self.caption or "Графики двух функций")

        axes = Axes(
            x_range=[x_min, x_max, 1],
            y_range=[y_min, y_max, 1],
            x_length=8,
            y_length=5,
            axis_config={
                "color": BLACK,
                "include_numbers": True,
                "font_size": 18,
                "stroke_width": 2,
            },
            tips=False,
        ).shift(DOWN * 0.15)

        x_label = MathTex("x").scale(0.7).set_color(BLACK)
        y_label = MathTex("y").scale(0.7).set_color(BLACK)
        labels = axes.get_axis_labels(x_label=x_label, y_label=y_label)

        curves = []
        for fn_spec in functions:
            fn = build_callable_from_spec(fn_spec)
            curve = axes.plot(fn, x_range=[x_min, x_max], stroke_width=3)
            curves.append(curve)

        if self.mode == "video":
            self.show_video_title(title)
            self.play(Create(axes), FadeIn(labels), run_time=0.8)
            for curve in curves:
                self.play(Create(curve), run_time=0.6)
            self.finish_video()
        else:
            self.show_static(title, axes, labels, *curves)


class QuadraticGraphScene(BaseVisualScene):
    def construct(self):
        a = float(self.params.get("a", 1))
        b = float(self.params.get("b", 0))
        c = float(self.params.get("c", 0))
        x_min = float(self.params.get("x_min", -5))
        x_max = float(self.params.get("x_max", 5))

        title = build_title(self.caption or "Квадратичная функция")
        formula = Text(
            quadratic_formula(a, b, c),
            font_size=18,
            color=BLACK,
        ).next_to(title, DOWN, buff=0.12)

        axes = Axes(
            x_range=[x_min, x_max, 1],
            y_range=[-6, 10, 2],
            x_length=6.8,
            y_length=3.8,
            axis_config={
                "color": BLACK,
                "include_numbers": True,
                "font_size": 18,
                "stroke_width": 2,
            },
            tips=True,
        ).shift(DOWN * 0.15)

        x_label = Text("x", font_size=20, color=BLACK).next_to(
            axes.x_axis.get_end(), RIGHT, buff=0.08
        )
        y_label = Text("y", font_size=20, color=BLACK).next_to(
            axes.y_axis.get_end(), UP, buff=0.08
        )

        graph = axes.plot(
            lambda x: a * x * x + b * x + c,
            x_range=[x_min, x_max],
            color=BLUE,
            stroke_width=3,
        )

        vertex_x = -b / (2 * a) if a != 0 else 0
        vertex_y = a * vertex_x * vertex_x + b * vertex_x + c
        vertex_dot = Dot(axes.c2p(vertex_x, vertex_y), color=RED, radius=0.05)

        if self.mode == "video":
            self.show_video_title(title, formula)
            self.play(Create(axes), FadeIn(x_label), FadeIn(y_label), run_time=0.7)
            self.play(Create(graph), FadeIn(vertex_dot), run_time=1.0)
            self.finish_video()
        else:
            self.show_static(title, formula, axes, x_label, y_label, graph, vertex_dot)


class LineGraphScene(BaseVisualScene):
    def construct(self):
        m = float(self.params.get("m", 1))
        b = float(self.params.get("b", 0))
        x_min = float(self.params.get("x_min", -5))
        x_max = float(self.params.get("x_max", 5))

        title = build_title(self.caption or "Линейная функция")
        formula = Text(
            line_formula(m, b),
            font_size=18,
            color=BLACK,
        ).next_to(title, DOWN, buff=0.12)

        axes = Axes(
            x_range=[x_min, x_max, 1],
            y_range=[-6, 10, 2],
            x_length=6.8,
            y_length=3.8,
            axis_config={
                "color": BLACK,
                "include_numbers": True,
                "font_size": 18,
                "stroke_width": 2,
            },
            tips=True,
        ).shift(DOWN * 0.15)

        x_label = Text("x", font_size=20, color=BLACK).next_to(
            axes.x_axis.get_end(), RIGHT, buff=0.08
        )
        y_label = Text("y", font_size=20, color=BLACK).next_to(
            axes.y_axis.get_end(), UP, buff=0.08
        )

        graph = axes.plot(
            lambda x: m * x + b,
            x_range=[x_min, x_max],
            color=BLUE,
            stroke_width=3,
        )

        if self.mode == "video":
            self.show_video_title(title, formula)
            self.play(Create(axes), FadeIn(x_label), FadeIn(y_label), run_time=0.7)
            self.play(Create(graph), run_time=0.9)
            self.finish_video()
        else:
            self.show_static(title, formula, axes, x_label, y_label, graph)


class ProbabilityUrnScene(BaseVisualScene):
    def construct(self):
        red_count = int(self.params.get("red", 3))
        blue_count = int(self.params.get("blue", 2))
        green_count = int(self.params.get("green", 1))

        title = build_title(self.caption or "Модель урны")

        frame = Square(side_length=3.4, color=BLACK, stroke_width=2).shift(DOWN * 0.1)

        balls = VGroup()
        colors = [RED] * red_count + [BLUE] * blue_count + [GREEN] * green_count

        positions = [
            (-0.9, 0.75, 0), (0.0, 0.75, 0), (0.9, 0.75, 0),
            (-0.9, 0.0, 0), (0.0, 0.0, 0), (0.9, 0.0, 0),
            (-0.45, -0.75, 0), (0.45, -0.75, 0),
        ]

        for i, color in enumerate(colors[: len(positions)]):
            balls.add(
                Circle(radius=0.16, color=color, fill_opacity=1)
                .move_to(positions[i])
                .shift(DOWN * 0.1)
            )

        legend_red = Text(f"красные: {red_count}", font_size=18, color=BLACK)
        legend_blue = Text(f"синие: {blue_count}", font_size=18, color=BLACK)
        legend_green = Text(f"зелёные: {green_count}", font_size=18, color=BLACK)

        legend = VGroup(legend_red, legend_blue, legend_green).arrange(
            DOWN, aligned_edge=LEFT, buff=0.10
        )
        legend.next_to(frame, RIGHT, buff=0.35)

        if self.mode == "video":
            self.show_video_title(title)
            self.play(Create(frame), run_time=0.5)
            self.play(FadeIn(balls), run_time=0.8)
            self.play(FadeIn(legend), run_time=0.5)
            self.finish_video()
        else:
            self.show_static(title, frame, balls, legend)


class TriangleGeometryScene(BaseVisualScene):
    def construct(self):
        a = float(self.params.get("a", 3))
        b = float(self.params.get("b", 4))
        c = float(self.params.get("c", 5))

        title = build_title(self.caption or "Геометрическая схема")

        p1 = [-2.6, -1.0, 0]
        p2 = [1.8, -1.0, 0]
        p3 = [-2.6, 1.7, 0]

        triangle = Polygon(p1, p2, p3, color=BLUE, stroke_width=3)

        label_A = Text("A", font_size=20, color=BLACK).move_to([p1[0] - 0.18, p1[1] - 0.18, 0])
        label_B = Text("B", font_size=20, color=BLACK).move_to([p2[0] + 0.18, p2[1] - 0.18, 0])
        label_C = Text("C", font_size=20, color=BLACK).move_to([p3[0] - 0.18, p3[1] + 0.18, 0])

        side_c = Text(fmt_num(c), font_size=20, color=BLACK).move_to(
            [(p1[0] + p2[0]) / 2, p1[1] - 0.25, 0]
        )
        side_b = Text(fmt_num(b), font_size=20, color=BLACK).move_to(
            [p1[0] - 0.28, (p1[1] + p3[1]) / 2, 0]
        )
        side_a = Text(fmt_num(a), font_size=20, color=BLACK).move_to(
            [(p2[0] + p3[0]) / 2 + 0.22, (p2[1] + p3[1]) / 2, 0]
        )

        if self.mode == "video":
            self.show_video_title(title)
            self.play(Create(triangle), run_time=0.8)
            self.play(FadeIn(label_A), FadeIn(label_B), FadeIn(label_C), run_time=0.4)
            self.play(FadeIn(side_a), FadeIn(side_b), FadeIn(side_c), run_time=0.4)
            self.finish_video()
        else:
            self.show_static(title, triangle, label_A, label_B, label_C, side_a, side_b, side_c)


class NumberLineIntervalScene(BaseVisualScene):
    def construct(self):
        left = float(self.params.get("left", -2))
        right = float(self.params.get("right", 3))
        left_closed = bool(self.params.get("left_closed", True))
        right_closed = bool(self.params.get("right_closed", False))

        title = build_title(self.caption or "Числовая прямая")

        line = NumberLine(
            x_range=[-6, 6, 1],
            length=8.2,
            include_numbers=True,
            color=BLACK,
            font_size=18,
        ).shift(DOWN * 0.1)

        start = line.n2p(left)
        end = line.n2p(right)
        segment = Line(start, end, color=BLUE, stroke_width=4)

        left_dot = Dot(
            start,
            color=BLUE,
            radius=0.055,
            fill_opacity=1 if left_closed else 0,
            stroke_width=2,
        )
        right_dot = Dot(
            end,
            color=BLUE,
            radius=0.055,
            fill_opacity=1 if right_closed else 0,
            stroke_width=2,
        )

        interval_text = (
            f"{'[' if left_closed else '('}{fmt_num(left)}; {fmt_num(right)}"
            f"{']' if right_closed else ')'}"
        )
        interval_label = Text(interval_text, font_size=18, color=BLACK).next_to(
            title, DOWN, buff=0.12
        )

        if self.mode == "video":
            self.show_video_title(title, interval_label)
            self.play(Create(line), run_time=0.7)
            self.play(Create(segment), FadeIn(left_dot), FadeIn(right_dot), run_time=0.6)
            self.finish_video()
        else:
            self.show_static(title, interval_label, line, segment, left_dot, right_dot)


class MathGridScene(BaseVisualScene):
    def construct(self):
        title = build_title(self.caption or "Математическая схема")

        plane = NumberPlane(
            x_range=[-5, 5, 1],
            y_range=[-3, 3, 1],
            x_length=7.0,
            y_length=3.6,
            background_line_style={
                "stroke_color": BLACK,
                "stroke_width": 0.6,
                "stroke_opacity": 0.20,
            },
            axis_config={
                "color": BLACK,
                "stroke_width": 2,
                "include_numbers": False,
            },
        ).shift(DOWN * 0.05)

        x_label = Text("x", font_size=18, color=BLACK).next_to(
            plane.x_axis.get_end(), RIGHT, buff=0.08
        )
        y_label = Text("y", font_size=18, color=BLACK).next_to(
            plane.y_axis.get_end(), UP, buff=0.08
        )

        p1 = Dot(plane.c2p(-2, 1), color=BLUE, radius=0.05)
        p2 = Dot(plane.c2p(2, 2), color=RED, radius=0.05)

        if self.mode == "video":
            self.show_video_title(title)
            self.play(Create(plane), FadeIn(x_label), FadeIn(y_label), run_time=0.8)
            self.play(FadeIn(p1), FadeIn(p2), run_time=0.4)
            self.finish_video()
        else:
            self.show_static(title, plane, x_label, y_label, p1, p2)


def build_scene(template: str, params: Dict[str, Any], caption: str, mode: str):
    scene_map = {
        "quadratic_graph": QuadraticGraphScene,
        "line_graph": LineGraphScene,
        "probability_urn": ProbabilityUrnScene,
        "triangle_geometry": TriangleGeometryScene,
        "number_line_interval": NumberLineIntervalScene,
        "math_grid": MathGridScene,
        "two_function_graph": TwoFunctionGraphScene,
    }

    scene_cls = scene_map.get(template)
    if not scene_cls:
        raise ValueError(f"Unsupported template: {template}")

    return scene_cls(params=params, caption=caption, mode=mode)


def find_rendered_artifact(media_dir: Path, stem: str, mode: str) -> Path:
    ext = ".mp4" if mode == "video" else ".png"

    candidates = sorted(
        media_dir.rglob(f"{stem}{ext}"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not candidates:
        raise FileNotFoundError(f"Rendered file not found for {stem}{ext}")

    return candidates[0]


def copy_rendered_artifact(out_path: Path, mode: str):
    rendered = find_rendered_artifact(out_path.parent, out_path.stem, mode)
    if rendered.resolve() != out_path.resolve():
        out_path.write_bytes(rendered.read_bytes())


def render_visual(
    template: str,
    params: Dict[str, Any],
    out_path: Path,
    caption: str,
    mode: str = "image",
):
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.exists():
        out_path.unlink()

    base_scene_setup(mode)
    config.media_dir = str(out_path.parent)
    config.output_file = out_path.stem

    scene = build_scene(template, params, caption, mode)
    scene.render()

    copy_rendered_artifact(out_path, mode)


def run_from_stdin_payload(payload: Dict[str, Any]):
    output_path = payload.get("outputPath")
    blueprint = payload.get("blueprint", {}) or {}
    template = str(blueprint.get("template", "")).strip()
    params = blueprint.get("params", {}) or {}
    caption = str(blueprint.get("caption", "")).strip()
    mode = str(blueprint.get("mode", "image")).strip().lower()

    if not output_path:
        raise ValueError("outputPath is required in stdin payload")

    out_path = Path(output_path)
    if not out_path.is_absolute():
        out_path = (ROOT / out_path).resolve()

    render_visual(
        template=template,
        params=params,
        out_path=out_path,
        caption=caption,
        mode=mode,
    )

    return {
        "ok": True,
        "template": template,
        "mode": mode,
        "out": str(out_path),
    }


def run_from_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", required=True)
    parser.add_argument("--params", default="{}")
    parser.add_argument("--out", required=True)
    parser.add_argument("--caption", default="")
    parser.add_argument("--alt", default="")
    parser.add_argument("--mode", default="image", choices=["image", "video"])
    args = parser.parse_args()

    template = args.template
    params = load_params(args.params)
    out_path = Path(args.out)

    if not out_path.is_absolute():
        out_path = (ROOT / out_path).resolve()

    render_visual(
        template=template,
        params=params,
        out_path=out_path,
        caption=args.caption,
        mode=args.mode,
    )

    return {
        "ok": True,
        "template": template,
        "mode": args.mode,
        "out": str(out_path),
    }


def main():
    raw_stdin = ""
    try:
        import sys
        raw_stdin = sys.stdin.read().strip()
    except Exception:
        raw_stdin = ""

    try:
        if raw_stdin:
            payload = json.loads(raw_stdin)
            result = run_from_stdin_payload(payload)
        else:
            result = run_from_cli()

        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(e),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        raise


if __name__ == "__main__":
    main()
    