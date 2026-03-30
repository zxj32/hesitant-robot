/**
 * chart.js — Renders an animated confidence bar chart using DOM elements.
 * Each bar fills in with a bouncy animation, staggered for a cascading effect.
 */

const CONTAINER_ID = 'chart-container';

// Confidence thresholds for color coding
const THRESHOLD_CONFIDENT = 65; // green
const THRESHOLD_UNSURE = 35;    // yellow (35-64), red below 35

/**
 * Get the CSS class for a bar based on its confidence value.
 */
function getBarClass(confidence) {
  if (confidence >= THRESHOLD_CONFIDENT) return 'bar-confident';
  if (confidence >= THRESHOLD_UNSURE) return 'bar-unsure';
  return 'bar-confused';
}

/**
 * Render the confidence bar chart with staggered animation.
 * @param {Array<{label: string, confidence: number}>} guesses
 */
export function renderChart(guesses) {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  // Clear previous chart
  container.innerHTML = '';

  // Empty state
  if (!guesses || guesses.length === 0) {
    container.innerHTML = '<p class="chart-empty">Draw something or ask a question to see what I think!</p>';
    return;
  }

  // Build bar rows
  const rows = guesses.map((guess) => {
    const row = document.createElement('div');
    row.className = 'chart-row';

    row.innerHTML = `
      <span class="chart-label">${escapeHtml(guess.label)}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${getBarClass(guess.confidence)}" data-target="${guess.confidence}"></div>
      </div>
      <span class="chart-percent">${guess.confidence}%</span>
    `;

    return row;
  });

  // Append all rows first (so they're in the DOM before animation)
  rows.forEach(row => container.appendChild(row));

  // Trigger staggered animation after a brief delay
  // Each bar starts filling 100ms after the previous one
  requestAnimationFrame(() => {
    rows.forEach((row, i) => {
      const fill = row.querySelector('.chart-bar-fill');
      if (!fill) return;
      setTimeout(() => {
        fill.style.width = `${fill.dataset.target}%`;
      }, i * 100);
    });
  });
}

/**
 * Check if the AI was "stumped" — top guess confidence below 30.
 * @param {Array<{label: string, confidence: number}>} guesses
 * @returns {boolean}
 */
export function isStumped(guesses) {
  if (!guesses || guesses.length === 0) return false;
  return guesses[0].confidence < 30;
}

/**
 * Clear the chart and show the empty state.
 */
export function clearChart() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  container.innerHTML = '<p class="chart-empty">Draw something or ask a question to see what I think!</p>';
}

// ── Helper ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
