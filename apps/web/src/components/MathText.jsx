import React, { useEffect, useRef } from "react";

// MathJax replaces the text node with its own markup, so React must not own
// the children of this span: the text is written and typeset manually.
export function MathText({ children, className = "" }) {
  const ref = useRef(null);
  const text = children === null || children === undefined ? "" : String(children);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.textContent = text;

    const mathJax = window.MathJax;
    if (!mathJax) return;

    // The MathJax script loads async. Until it has loaded, window.MathJax is
    // only the config object and the startup pass typesets the whole page.
    if (!mathJax.typesetPromise) return;

    const ready = mathJax.startup?.promise || Promise.resolve();

    ready
      .then(() => {
        if (ref.current !== node || node.textContent !== text) return;
        mathJax.typesetClear?.([node]);
        return mathJax.typesetPromise?.([node]);
      })
      .catch(() => {});
  }, [text]);

  return <span ref={ref} className={className} />;
}
