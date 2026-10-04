export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001";

async function request(path, options = {}) {
  const { headers, ...rest } = options;

  // Fastify rejects an empty body sent with Content-Type: application/json,
  // so the header is only set when there is a body.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function getHealth() {
  return request("/health");
}

export async function listTests() {
  return request("/tests");
}

export async function getRuntimeTest(testId) {
  return request(`/tests/${testId}/runtime`);
}

export async function getRuntimeTestDebug(testId) {
  return request(`/tests/${testId}/runtime?includeAnswers=true&includeSolutions=true`);
}

export async function createAttempt({ userId, testId }) {
  return request("/attempts", {
    method: "POST",
    body: JSON.stringify({
      userId,
      testId
    })
  });
}

export async function submitAttempt({ attemptId, answers }) {
  return request(`/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      answers
    })
  });
}

export async function getAttemptResult(attemptId) {
  return request(`/attempts/${attemptId}/result`);
}

export async function createGenerationJob(inputPayload) {
  return request("/generation/jobs", {
    method: "POST",
    body: JSON.stringify({
      userId: "demo-user",
      type: "TEST_GENERATION",
      inputPayload
    })
  });
}

export async function getGenerationJob(jobId) {
  return request(`/generation/jobs/${jobId}`);
}

export async function getGenerationPresets() {
  return request("/generation/presets");
}
