import React, { useEffect, useRef } from "react";

export function MathText({ children, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.MathJax && ref.current) {
      window.MathJax.typesetPromise?.([ref.current]).catch(() => {});
    }
  }, [children]);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
