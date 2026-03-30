/**
 * app.js — Main controller that wires all modules together.
 * Handles mode switching, event binding, submission flows, and UI state.
 */

import { analyzeDrawing, askQuestion, checkHealth, getErrorMessage } from './api.js';
import { init as initRobot, setExpression } from './robot.js';
import { renderChart, isStumped, clearChart } from './chart.js';
import { initCanvas } from './canvas.js';

// ── State ──────────────────────────────────────────────────────────────

let canvas = null;       // canvas API returned by initCanvas()
let isRequesting = false; // prevents double-submission
let currentMode = 'drawing';

// ── DOM References ─────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialization ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check server health and demo mode
  const health = await checkHealth();
  if (health && !health.hasKey) {
    $('#demo-banner').classList.remove('hidden');
  }

  // 2. Inject robot SVG and start idle expression
  initRobot();
  setExpression('idle');

  // 3. Initialize drawing canvas
  const canvasEl = $('#drawing-canvas');
  if (canvasEl) {
    canvas = initCanvas(canvasEl);
  }

  // 4. Bind all event listeners
  bindTabSwitching();
  bindDrawingControls();
  bindQuestionControls();
  bindKeyboard();
  bindGlobalErrorHandler();
});

// ── Tab Switching ──────────────────────────────────────────────────────

function bindTabSwitching() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === currentMode) return;

      currentMode = mode;

      // Update tab button states
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide mode sections
      $('#drawing-mode').classList.toggle('hidden', mode !== 'drawing');
      $('#question-mode').classList.toggle('hidden', mode !== 'question');

      // Reset results area for fresh start
      showSpeechBubble("Alright, let's try this mode! Go ahead!");
      clearChart();
      setExpression('idle');
    });
  });
}

// ── Drawing Controls ───────────────────────────────────────────────────

function bindDrawingControls() {
  // Color picker
  $$('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      canvas?.setColor(btn.dataset.color);
    });
  });

  // Brush size toggle
  $('#btn-thin')?.addEventListener('click', () => {
    canvas?.setLineWidth(4);
    $('#btn-thin').classList.add('active');
    $('#btn-thick').classList.remove('active');
  });

  $('#btn-thick')?.addEventListener('click', () => {
    canvas?.setLineWidth(8);
    $('#btn-thick').classList.add('active');
    $('#btn-thin').classList.remove('active');
  });

  // Undo
  $('#btn-undo')?.addEventListener('click', () => canvas?.undo());

  // Clear
  $('#btn-clear')?.addEventListener('click', () => {
    canvas?.clear();
    clearChart();
    setExpression('idle');
    showSpeechBubble("Fresh canvas! Draw me something new!");
  });

  // Submit drawing
  $('#btn-ask-drawing')?.addEventListener('click', submitDrawing);
}

async function submitDrawing() {
  if (isRequesting) return;
  if (!canvas || canvas.isEmpty()) {
    shakeButton($('#btn-ask-drawing'));
    showSpeechBubble("Hey, draw something first! I need something to look at! 👀");
    return;
  }

  isRequesting = true;
  disableSubmitButtons();
  showLoading();
  setExpression('thinking');
  hideSpeechBubble();

  try {
    const imageData = canvas.getImageData();
    const result = await analyzeDrawing(imageData);

    hideLoading();
    setExpression(result.reaction);
    renderChart(result.guesses);

    // Show appropriate speech based on confidence
    const topConf = result.guesses[0]?.confidence || 0;
    if (topConf > 75) {
      showSpeechBubble(`I'm pretty sure that's a ${result.guesses[0].label}! 😄`);
    } else if (topConf > 40) {
      showSpeechBubble(`Hmm, maybe a ${result.guesses[0].label}? I'm not totally sure...`);
    } else {
      showSpeechBubble("Whoa, that's a tough one! I really can't tell! 😵‍💫");
    }

    // "You Stumped Me!" badge if AI is very confused
    if (isStumped(result.guesses)) {
      setTimeout(showStumpedBadge, 600);
    }
  } catch (err) {
    hideLoading();
    setExpression('confused');
    showErrorToast(getErrorMessage(err));
  } finally {
    isRequesting = false;
    enableSubmitButtons();
  }
}

// ── Question Controls ──────────────────────────────────────────────────

function bindQuestionControls() {
  // Pre-made question buttons
  $$('.question-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      submitQuestion(btn.dataset.question);
    });
  });

  // Custom question submit
  $('#btn-ask-question')?.addEventListener('click', () => {
    const input = $('#question-input');
    const q = input?.value.trim();
    if (q) submitQuestion(q);
  });
}

async function submitQuestion(questionText) {
  if (isRequesting) return;
  if (!questionText) return;

  isRequesting = true;
  disableSubmitButtons();
  showLoading();
  setExpression('thinking');
  hideSpeechBubble();

  try {
    const result = await askQuestion(questionText);

    hideLoading();
    setExpression(result.reaction);
    renderChart(result.guesses);

    // Show speech based on reaction
    const topConf = result.guesses[0]?.confidence || 0;
    if (topConf > 70) {
      showSpeechBubble(`I think the answer is: "${result.guesses[0].label}" 😊`);
    } else if (topConf > 40) {
      showSpeechBubble(`Hmm, maybe "${result.guesses[0].label}"? But I'm not very sure!`);
    } else {
      showSpeechBubble("Wow, what a tricky question! I really don't know! 🤯");
    }

    if (isStumped(result.guesses)) {
      setTimeout(showStumpedBadge, 600);
    }
  } catch (err) {
    hideLoading();
    setExpression('confused');
    showErrorToast(getErrorMessage(err));
  } finally {
    isRequesting = false;
    enableSubmitButtons();
  }
}

// ── Keyboard Shortcuts ─────────────────────────────────────────────────

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Enter submits question in question mode
    if (e.key === 'Enter' && currentMode === 'question') {
      const input = $('#question-input');
      const q = input?.value.trim();
      if (q) submitQuestion(q);
    }

    // Escape dismisses the stumped badge
    if (e.key === 'Escape') {
      hideStumpedBadge();
    }
  });
}

// ── Global Error Handler ───────────────────────────────────────────────

function bindGlobalErrorHandler() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorToast("Hmm, something funny happened. Let's try once more! 🤔");
  });
}

// ── UI Helpers ─────────────────────────────────────────────────────────

function showLoading() {
  $('#loading-overlay')?.classList.remove('hidden');
}

function hideLoading() {
  $('#loading-overlay')?.classList.add('hidden');
}

function showSpeechBubble(text) {
  const bubble = $('#speech-bubble');
  if (bubble) {
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    // Re-trigger fade animation
    bubble.style.animation = 'none';
    bubble.offsetHeight; // force reflow
    bubble.style.animation = '';
  }
}

function hideSpeechBubble() {
  $('#speech-bubble')?.classList.add('hidden');
}

function showStumpedBadge() {
  const badge = $('#stumped-badge');
  if (!badge) return;
  badge.classList.remove('hidden');

  // Auto-dismiss after 3 seconds
  setTimeout(hideStumpedBadge, 3000);
}

function hideStumpedBadge() {
  $('#stumped-badge')?.classList.add('hidden');
}

function showErrorToast(message) {
  const toast = $('#error-toast');
  const msgEl = $('#error-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('hidden');

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function shakeButton(btn) {
  if (!btn) return;
  btn.style.animation = 'wiggle 0.4s ease';
  setTimeout(() => { btn.style.animation = ''; }, 400);
}

function disableSubmitButtons() {
  $$('.submit-btn').forEach(b => b.disabled = true);
}

function enableSubmitButtons() {
  $$('.submit-btn').forEach(b => b.disabled = false);
}
