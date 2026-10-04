import React from "react";
import { API_BASE_URL } from "../lib/api";

// Rendered pictures are served by the API (/assets/generated/...).
export function QuestionVisual({ visual }) {
  if (!visual?.src) {
    return null;
  }

  const src = /^https?:\/\//.test(visual.src)
    ? visual.src
    : `${API_BASE_URL}${visual.src}`;

  return (
    <figure className="questionVisual">
      {visual.type === "video" ? (
        <video src={src} controls />
      ) : (
        <img src={src} alt={visual.alt || visual.caption || ""} />
      )}
      {visual.caption ? <figcaption>{visual.caption}</figcaption> : null}
    </figure>
  );
}
