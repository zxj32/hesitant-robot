/**
 * api.js — Thin wrapper around fetch calls to our proxy server.
 * Handles timeouts, response validation, and kid-friendly error messages.
 */

const CLIENT_TIMEOUT_MS = 20_000; // 20 seconds

// ── Core fetch wrapper with timeout ────────────────────────────────────

async function apiCall(endpoint, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (!res.ok) throw new Error('API_ERROR');

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    return validateResponse(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  }
}

// ── Response validation ────────────────────────────────────────────────
// Makes sure the API response is well-formed before the UI tries to use it.
// If anything is off, return a safe fallback so the app never crashes.

const VALID_REACTIONS = ['happy', 'thinking', 'confused', 'surprised'];
const SAFE_FALLBACK = {
  guesses: [{ label: "Hmm, I'm not sure!", confidence: 15 }],
  reaction: 'confused'
};

function validateResponse(data) {
  if (!data || !Array.isArray(data.guesses) || data.guesses.length === 0) {
    return SAFE_FALLBACK;
  }

  // Validate and clamp each guess
  const guesses = data.guesses.slice(0, 5).map(g => ({
    label: typeof g.label === 'string' ? g.label.slice(0, 60) : '???',
    confidence: typeof g.confidence === 'number'
      ? Math.max(0, Math.min(100, Math.round(g.confidence)))
      : 10
  }));

  const reaction = VALID_REACTIONS.includes(data.reaction)
    ? data.reaction
    : 'confused';

  return { guesses, reaction };
}

// ── Public API ─────────────────────────────────────────────────────────

export async function analyzeDrawing(imageDataUrl) {
  return apiCall('/api/analyze-drawing', { image: imageDataUrl });
}

export async function askQuestion(questionText) {
  return apiCall('/api/ask-question', { question: questionText });
}

/**
 * Check if the server is up and whether a real API key is configured.
 * Returns { status, hasKey } or null if the server is unreachable.
 */
export async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Friendly error messages ────────────────────────────────────────────
// Maps error codes to messages that won't scare a 6-year-old.

const ERROR_MESSAGES = {
  TIMEOUT: "I was thinking so hard my brain overheated! Try again? 🤯",
  RATE_LIMITED: "Whoa, slow down! I need a moment to catch my breath. 😮‍💨",
  API_ERROR: "Oops! My wires got crossed. Let's try again! 🔌",
};

export function getErrorMessage(error) {
  const code = error?.message || error;
  return ERROR_MESSAGES[code] || "Hmm, something funny happened. Let's try once more! 🤔";
}
