/**
 * proxy.js — Lightweight Express server that:
 * 1. Serves the static frontend files
 * 2. Proxies requests to the OpenAI API (hiding the API key from the browser)
 * 3. Falls back to mock responses when no API key is configured (demo mode)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Serve static files from project root (one level up from /server)
app.use(express.static(path.join(__dirname, '..')));

// ── Rate Limiting (simple in-memory, 10 req/min per IP) ────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({
      error: "Whoa, slow down! I need a moment to think."
    });
  }
  next();
}

// ── System Prompts ─────────────────────────────────────────────────────────

const DRAWING_SYSTEM_PROMPT = `You are a friendly robot assistant for kids ages 6-12. A child has drawn a picture. Look at it carefully and give your best guesses about what it might be.

Rules:
- Return exactly 5 guesses, ranked from most to least likely.
- Each guess has a "label" (1-3 simple words a kid would understand) and "confidence" (0-100).
- Be HONEST about your uncertainty. If the drawing is ambiguous, reflect that with lower confidence scores.
- If you truly cannot tell, your top guess should have confidence below 40.
- Confidence scores across all guesses should NOT all be high — spread them out realistically.
- Pick a "reaction" based on your overall certainty: "happy" (top guess > 75), "thinking" (top guess 40-75), "confused" (top guess 20-40), "surprised" (top guess < 20 OR the drawing is unexpected).
- Use simple, fun language for labels. Say "puppy" not "canine quadruped".

Return JSON: { "guesses": [{ "label": "string", "confidence": number }], "reaction": "happy"|"thinking"|"confused"|"surprised" }`;

const QUESTION_SYSTEM_PROMPT = `You are a friendly robot assistant for kids ages 6-12. A child has asked you a question. Think carefully about how certain you are of the answer.

Rules:
- Return 3-5 possible answers, ranked by confidence.
- Each answer has a "label" (a short, kid-friendly answer phrase) and "confidence" (0-100).
- Be BRUTALLY HONEST about uncertainty. Many questions are genuinely ambiguous or unknowable.
- For subjective questions (best color, favorite food), confidence should be LOW because there is no single right answer.
- For trick questions or paradoxes, say so in your top label and keep confidence low.
- For factual questions you are sure about, high confidence is fine.
- Pick a "reaction": "happy" (confident), "thinking" (somewhat sure), "confused" (unsure), "surprised" (tricky question).
- Use simple words a 6-year-old could understand.

Return JSON: { "guesses": [{ "label": "string", "confidence": number }], "reaction": "happy"|"thinking"|"confused"|"surprised" }`;

// ── OpenAI API Helper ──────────────────────────────────────────────────────

async function callOpenAI(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 1.0,
        response_format: { type: 'json_object' },
        messages
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`OpenAI API error ${res.status}: ${errBody}`);
      throw new Error('API_ERROR');
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('API_ERROR');

    return JSON.parse(content);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  }
}

// ── Mock Responses (demo/fallback mode) ────────────────────────────────────

const MOCK_DRAWING_LABELS = [
  ['A cat', 'A dog', 'A bunny', 'A cloud', 'A potato'],
  ['A house', 'A castle', 'A robot', 'A box', 'A cake'],
  ['The sun', 'A flower', 'A pizza', 'A clock', 'A ball'],
  ['A tree', 'Broccoli', 'A person', 'An alien', 'A mushroom'],
  ['A car', 'A bus', 'A whale', 'A shoe', 'A sandwich']
];

const MOCK_QUESTION_LABELS = [
  ["That's a really tricky one!", "Nobody knows for sure", "It depends on who you ask", "There's no right answer"],
  ["Hmm, maybe?", "I think so... but I'm not sure", "Scientists are still figuring this out", "It could go either way"],
  ["Great question!", "I'd guess yes", "Probably not", "This one confuses even grown-ups", "Let me think harder..."]
];

const REACTIONS = ['happy', 'thinking', 'confused', 'surprised'];

function mockResponse(labelSets) {
  const labels = labelSets[Math.floor(Math.random() * labelSets.length)];
  // Generate descending confidence values with some randomness
  let confidence = Math.floor(Math.random() * 50) + 30; // top guess: 30-79
  const guesses = labels.map((label) => {
    const c = Math.max(2, Math.min(100, confidence + Math.floor(Math.random() * 10 - 5)));
    confidence = Math.max(2, confidence - Math.floor(Math.random() * 20 + 5));
    return { label, confidence: c };
  });

  // Pick reaction based on top confidence
  const topConf = guesses[0].confidence;
  let reaction;
  if (topConf > 75) reaction = 'happy';
  else if (topConf > 40) reaction = 'thinking';
  else if (topConf > 20) reaction = 'confused';
  else reaction = 'surprised';

  return { guesses, reaction };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check — lets the frontend know if real API is available
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasKey: Boolean(OPENAI_API_KEY) });
});

// Analyze a drawing (vision endpoint)
app.post('/api/analyze-drawing', rateLimit, async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  // Demo mode — return mock data
  if (!OPENAI_API_KEY) {
    // Small delay to simulate API call
    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
    return res.json(mockResponse(MOCK_DRAWING_LABELS));
  }

  try {
    const result = await callOpenAI([
      { role: 'system', content: DRAWING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What did I draw?' },
          { type: 'image_url', image_url: { url: image, detail: 'low' } }
        ]
      }
    ]);
    res.json(result);
  } catch (err) {
    console.error('Drawing analysis error:', err.message);
    if (err.message === 'TIMEOUT') {
      return res.status(504).json({ error: "I was thinking so hard my brain overheated! Try again?" });
    }
    res.status(500).json({ error: "Oops! My wires got crossed. Let's try again!" });
  }
});

// Answer a tricky question
app.post('/api/ask-question', rateLimit, async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'No question provided' });
  }

  // Demo mode
  if (!OPENAI_API_KEY) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    return res.json(mockResponse(MOCK_QUESTION_LABELS));
  }

  try {
    const result = await callOpenAI([
      { role: 'system', content: QUESTION_SYSTEM_PROMPT },
      { role: 'user', content: question.slice(0, 500) } // cap input length
    ]);
    res.json(result);
  } catch (err) {
    console.error('Question analysis error:', err.message);
    if (err.message === 'TIMEOUT') {
      return res.status(504).json({ error: "I was thinking so hard my brain overheated! Try again?" });
    }
    res.status(500).json({ error: "Oops! My wires got crossed. Let's try again!" });
  }
});

// ── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🤖 The Hesitant Robot is running at http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) {
    console.log('⚠️  No OPENAI_API_KEY found — running in DEMO MODE (mock responses)');
  } else {
    console.log('✅ OpenAI API key detected — using GPT-4o');
  }
  console.log('');
});
