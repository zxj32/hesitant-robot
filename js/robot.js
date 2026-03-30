/**
 * robot.js — Creates and controls the robot face SVG.
 * The SVG is defined inline (no external file load) so it appears instantly.
 * Exports init() to inject the SVG and setExpression() to change the face.
 */

// ── SVG Template ───────────────────────────────────────────────────────
// A friendly robot face with parts that can be swapped via CSS classes.

const ROBOT_SVG = `
<svg class="robot-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Antenna -->
  <line x1="100" y1="38" x2="100" y2="16" stroke="#546E7A" stroke-width="4" stroke-linecap="round"/>
  <circle class="robot-antenna-ball" cx="100" cy="12" r="8" fill="#90CAF9"/>

  <!-- Head group (rotates when confused) -->
  <g class="robot-head-group">
    <!-- Head -->
    <rect x="40" y="38" width="120" height="110" rx="24" fill="#90CAF9" stroke="#546E7A" stroke-width="3"/>

    <!-- Face plate -->
    <rect x="52" y="50" width="96" height="86" rx="16" fill="#E3F2FD"/>

    <!-- Eyes group (blinks) -->
    <g class="robot-eyes">
      <!-- Left eye -->
      <g class="robot-eye-left">
        <circle cx="78" cy="82" r="14" fill="white" stroke="#546E7A" stroke-width="2"/>
        <circle class="robot-pupil-left" cx="78" cy="82" r="7" fill="#2D3748"/>
      </g>
      <!-- Right eye -->
      <g class="robot-eye-right">
        <circle cx="122" cy="82" r="14" fill="white" stroke="#546E7A" stroke-width="2"/>
        <circle class="robot-pupil-right" cx="122" cy="82" r="7" fill="#2D3748"/>
      </g>
    </g>

    <!-- Mouth (path changes per expression) -->
    <path class="robot-mouth" d="M 78 115 Q 100 130 122 115" fill="none" stroke="#2D3748" stroke-width="3" stroke-linecap="round"/>

    <!-- Cheeks (shown when happy) -->
    <circle class="robot-cheeks robot-cheek-l" cx="62" cy="108" r="8" fill="#FFCDD2" opacity="0.7"/>
    <circle class="robot-cheeks robot-cheek-r" cx="138" cy="108" r="8" fill="#FFCDD2" opacity="0.7"/>

    <!-- Sweat drop (shown when confused) -->
    <g class="robot-sweat" transform="translate(148, 55)">
      <path d="M 0 0 Q 3 8 0 14 Q -3 8 0 0" fill="#64B5F6"/>
    </g>

    <!-- Exclamation marks (shown when surprised) -->
    <g class="robot-exclaim">
      <text x="36" y="48" font-size="18" font-weight="800" fill="#FF5252">!</text>
      <text x="158" y="48" font-size="18" font-weight="800" fill="#FF5252">!</text>
    </g>
  </g>

  <!-- Body (simple) -->
  <rect x="60" y="152" width="80" height="36" rx="12" fill="#90CAF9" stroke="#546E7A" stroke-width="3"/>

  <!-- Body detail: three dots -->
  <circle cx="84" cy="170" r="4" fill="#546E7A"/>
  <circle cx="100" cy="170" r="4" fill="#546E7A"/>
  <circle cx="116" cy="170" r="4" fill="#546E7A"/>

  <!-- Arms -->
  <rect x="28" y="158" width="28" height="10" rx="5" fill="#90CAF9" stroke="#546E7A" stroke-width="2"/>
  <rect x="144" y="158" width="28" height="10" rx="5" fill="#90CAF9" stroke="#546E7A" stroke-width="2"/>
</svg>
`;

// ── Mouth path data for each expression ────────────────────────────────

const MOUTH_PATHS = {
  // Smile (upward curve)
  happy: 'M 78 112 Q 100 132 122 112',
  // Flat line (neutral)
  thinking: 'M 78 118 L 122 118',
  // Wavy / frown
  confused: 'M 78 122 Q 90 114 100 122 Q 110 130 122 122',
  // O shape
  surprised: 'M 90 114 Q 90 126 100 126 Q 110 126 110 114 Q 110 102 100 102 Q 90 102 90 114',
  // Default neutral smile
  idle: 'M 78 115 Q 100 130 122 115'
};

// ── Eye transforms for expressions ─────────────────────────────────────

const EYE_TRANSFORMS = {
  happy: { leftR: 14, rightR: 14, pupilR: 7 },
  thinking: { leftR: 14, rightR: 14, pupilR: 7, squint: true },
  confused: { leftR: 14, rightR: 14, pupilR: 5, spiral: true },
  surprised: { leftR: 18, rightR: 18, pupilR: 5 },
  idle: { leftR: 14, rightR: 14, pupilR: 7 }
};

// ── State ──────────────────────────────────────────────────────────────

let svgRoot = null;
let currentExpression = 'idle';

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Inject the robot SVG into the #robot-area container.
 */
export function init() {
  const container = document.getElementById('robot-area');
  if (!container) return;
  container.innerHTML = ROBOT_SVG;
  svgRoot = container.querySelector('.robot-svg');
}

/**
 * Change the robot's facial expression.
 * @param {'happy'|'thinking'|'confused'|'surprised'|'idle'} expression
 */
export function setExpression(expression) {
  if (!svgRoot) return;
  if (!MOUTH_PATHS[expression]) expression = 'idle';

  // Remove all expression classes, add the new one
  svgRoot.classList.remove('expr-happy', 'expr-thinking', 'expr-confused', 'expr-surprised');
  if (expression !== 'idle') {
    svgRoot.classList.add(`expr-${expression}`);
  }

  // Update mouth shape
  const mouth = svgRoot.querySelector('.robot-mouth');
  if (mouth) {
    mouth.setAttribute('d', MOUTH_PATHS[expression]);
  }

  // Update eye sizes for surprised expression
  const eyes = EYE_TRANSFORMS[expression];
  const leftEyeCircle = svgRoot.querySelector('.robot-eye-left circle:first-child');
  const rightEyeCircle = svgRoot.querySelector('.robot-eye-right circle:first-child');
  const leftPupil = svgRoot.querySelector('.robot-pupil-left');
  const rightPupil = svgRoot.querySelector('.robot-pupil-right');

  if (leftEyeCircle && rightEyeCircle) {
    leftEyeCircle.setAttribute('r', eyes.leftR);
    rightEyeCircle.setAttribute('r', eyes.rightR);
  }
  if (leftPupil && rightPupil) {
    leftPupil.setAttribute('r', eyes.pupilR);
    rightPupil.setAttribute('r', eyes.pupilR);
  }

  // Squint effect for thinking: flatten eyes vertically
  const eyesGroup = svgRoot.querySelector('.robot-eyes');
  if (eyesGroup) {
    eyesGroup.style.transform = eyes.squint ? 'scaleY(0.6)' : '';
  }

  currentExpression = expression;
}

/**
 * Get the current expression name.
 */
export function getExpression() {
  return currentExpression;
}
