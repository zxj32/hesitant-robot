# The Hesitant Robot

> Teaching Kids (Ages 6–12) that AI Can Be Uncertain

## Project Overview

An interactive web demo that visualizes how an AI "thinks." Instead of just showing a final answer, the app reveals confidence levels with colorful, animated bar charts. Kids can draw pictures or type tricky questions to try to "confuse" the AI — and watch it honestly say "I'm not sure!" when it's uncertain.

### Learning Goals

- AI is powerful but **not perfect** — it can be wrong or confused.
- AI has **confidence levels**, not just yes/no answers.
- It's okay (and smart!) to say "I don't know" — even for machines.

## Tech Stack

- **Frontend**: HTML + CSS + vanilla JavaScript (single-page app, no build step)
- **AI Backend**: Claude API (Anthropic) via a lightweight proxy
- **Visualization**: Canvas-based or CSS bar charts for confidence display
- **Deployment**: Static files — easy to demo from a laptop or deploy anywhere

## Design Principles

- **Kid-friendly UI**: Large fonts, bright colors, rounded corners, playful animations.
- **Simple language**: All AI responses should use vocabulary appropriate for ages 6–12.
- **No scary failure modes**: Errors are presented as "Hmm, my brain got tangled!" style messages.
- **Fast feedback**: Responses should feel instant; use loading animations shaped like a thinking robot.
- **Accessible**: Works on tablets, large touch targets, readable contrast.

## Key Features

1. **Drawing Canvas** — Kids draw something, AI guesses what it is and shows confidence bars for its top guesses.
2. **Tricky Question Mode** — Kids type or pick from pre-made tricky/ambiguous questions. AI shows how sure it is.
3. **Confidence Bar Chart** — Animated, colorful bars (green = confident, yellow = unsure, red = confused).
4. **Robot Reactions** — A cartoon robot face that changes expression based on confidence (happy, thinking, confused, surprised).
5. **"You Stumped Me!" Badge** — When kids successfully confuse the AI, they earn a fun badge/animation.

## File Structure

```
hesitant-robot/
├── CLAUDE.md          # This file
├── index.html         # Main entry point
├── css/
│   └── style.css      # All styles
├── js/
│   ├── app.js         # Main app logic & UI controller
│   ├── api.js         # Claude API communication
│   ├── canvas.js      # Drawing canvas logic
│   ├── chart.js       # Confidence bar chart rendering
│   └── robot.js       # Robot face expressions
├── assets/
│   └── robot.svg      # Robot character artwork
└── server/
    └── proxy.js       # Lightweight API proxy (Node.js) to hide API key
```

## Development Guidelines

- Keep everything in **plain HTML/CSS/JS** — no frameworks, no bundlers. A teacher should be able to open `index.html` and understand the structure.
- All JavaScript files use **ES modules** (`type="module"` in script tags).
- CSS uses **CSS custom properties** for the color palette so theming is easy.
- Comments should be written as if explaining to a junior developer or curious older kid.
- API key is **never** embedded in frontend code; always goes through `server/proxy.js`.
- Error messages shown to kids must be friendly and non-technical.

## Color Palette

| Role        | Color     | CSS Variable        |
|-------------|-----------|---------------------|
| Background  | `#F0F4FF` | `--color-bg`        |
| Primary     | `#4A90D9` | `--color-primary`   |
| Confident   | `#4CAF50` | `--color-confident` |
| Unsure      | `#FFC107` | `--color-unsure`    |
| Confused    | `#FF5252` | `--color-confused`  |
| Text        | `#2D3748` | `--color-text`      |
| Robot Body  | `#90CAF9` | `--color-robot`     |

## API Usage Notes

- Use Claude API with `temperature: 1.0` to surface genuine model uncertainty.
- Prompt Claude to return a JSON object with `{ guesses: [{ label, confidence }], reaction }`.
- Confidence values are 0–100; the prompt should instruct the model to be **honest** about uncertainty rather than always guessing confidently.
- For drawing recognition, convert the canvas to a base64 image and send via the vision/multimodal endpoint.

## Running the Demo

```bash
# 1. Install proxy dependencies
cd server && npm install

# 2. Set API key
export ANTHROPIC_API_KEY=your-key-here

# 3. Start the proxy server
node proxy.js

# 4. Open in browser
open http://localhost:3000
```
