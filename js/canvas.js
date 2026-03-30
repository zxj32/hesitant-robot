/**
 * canvas.js — Drawing canvas with touch + mouse support via Pointer Events.
 * Supports stroke-based undo, multiple colors, and two brush sizes.
 * Internal resolution is always 512×512 regardless of CSS display size.
 */

/**
 * Initialize the drawing canvas.
 * @param {HTMLCanvasElement} canvasEl — the <canvas> element from the DOM
 * @returns {Object} API: { getImageData, clear, undo, setColor, setLineWidth, isEmpty }
 */
export function initCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');

  // Internal drawing resolution (sent to API)
  canvasEl.width = 512;
  canvasEl.height = 512;

  // Fill with white initially
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 512, 512);

  // ── Drawing state ──────────────────────────────────────────────────

  let isDrawing = false;
  let currentColor = '#2D3748';
  let lineWidth = 8;        // default: thick brush
  let strokes = [];          // array of completed strokes for undo
  let currentStroke = [];    // points in the stroke being drawn

  // ── Coordinate mapping ─────────────────────────────────────────────
  // Converts pointer position to canvas-internal coordinates,
  // accounting for CSS scaling.

  function getCoords(event) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvasEl.width / rect.width),
      y: (event.clientY - rect.top) * (canvasEl.height / rect.height)
    };
  }

  // ── Drawing functions ──────────────────────────────────────────────

  function drawSegment(from, to, color, width) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawDot(point, color, width) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Replay all strokes from scratch (used after undo)
  function redrawAll() {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 512, 512);

    for (const stroke of strokes) {
      if (stroke.points.length === 1) {
        drawDot(stroke.points[0], stroke.color, stroke.width);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          drawSegment(stroke.points[i - 1], stroke.points[i], stroke.color, stroke.width);
        }
      }
    }
  }

  // ── Pointer event handlers ─────────────────────────────────────────

  function onPointerDown(e) {
    e.preventDefault();
    isDrawing = true;
    const pt = getCoords(e);
    currentStroke = [pt];

    // Draw a dot immediately for single taps
    drawDot(pt, currentColor, lineWidth);
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const pt = getCoords(e);
    const prev = currentStroke[currentStroke.length - 1];
    currentStroke.push(pt);
    drawSegment(prev, pt, currentColor, lineWidth);
  }

  function onPointerEnd(e) {
    if (!isDrawing) return;
    e.preventDefault();
    isDrawing = false;

    // Save completed stroke for undo
    if (currentStroke.length > 0) {
      strokes.push({
        points: [...currentStroke],
        color: currentColor,
        width: lineWidth
      });
    }
    currentStroke = [];
  }

  // Bind pointer events (unified mouse + touch + stylus)
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerEnd);
  canvasEl.addEventListener('pointerleave', onPointerEnd);
  canvasEl.addEventListener('pointercancel', onPointerEnd);

  // ── Public API ─────────────────────────────────────────────────────

  return {
    /**
     * Export the canvas as a JPEG data URL (quality 0.6 for small payload).
     */
    getImageData() {
      return canvasEl.toDataURL('image/jpeg', 0.6);
    },

    /**
     * Clear the canvas and reset stroke history.
     */
    clear() {
      strokes = [];
      currentStroke = [];
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 512, 512);

      // Brief flash animation
      canvasEl.style.animation = 'flash 0.3s ease';
      setTimeout(() => { canvasEl.style.animation = ''; }, 300);
    },

    /**
     * Undo the last stroke.
     */
    undo() {
      if (strokes.length === 0) return;
      strokes.pop();
      redrawAll();
    },

    /**
     * Set the drawing color.
     * @param {string} hexColor
     */
    setColor(hexColor) {
      currentColor = hexColor;
    },

    /**
     * Set the brush line width.
     * @param {number} width
     */
    setLineWidth(width) {
      lineWidth = width;
    },

    /**
     * Check if the canvas is empty (all white).
     * Samples a grid of 25 points for speed instead of scanning all pixels.
     */
    isEmpty() {
      const step = 100; // sample every 100px in the 512×512 grid
      for (let x = step; x < 512; x += step) {
        for (let y = step; y < 512; y += step) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          // If any sampled pixel isn't white, canvas has content
          if (pixel[0] < 250 || pixel[1] < 250 || pixel[2] < 250) {
            return false;
          }
        }
      }
      return true;
    },

    /**
     * Returns the number of strokes (useful for UI feedback).
     */
    strokeCount() {
      return strokes.length;
    }
  };
}
