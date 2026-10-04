"use strict";

const OpenAI = require("openai");

let client = null;

// Created on first use: constructing OpenAI without a key throws, and the
// worker must still start (and serve the mock engine) when no key is set.
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for AI generation.");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-5.2";
}

module.exports = {
  getOpenAIClient,
  getModel
};
