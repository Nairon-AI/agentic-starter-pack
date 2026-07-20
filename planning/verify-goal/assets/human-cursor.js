(() => {
  const CURSOR_ID = "codex-proof-cursor";
  const STYLE_ID = "codex-proof-cursor-style";

  const ease = (value) =>
    value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;

  function install() {
    if (!document.documentElement || document.getElementById(CURSOR_ID)) return;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        html, body, * { cursor: none !important; }
        #${CURSOR_ID} {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 2147483647;
          width: 22px;
          height: 28px;
          pointer-events: none;
          filter: drop-shadow(0 1px 1px rgba(255,255,255,.9)) drop-shadow(0 2px 3px rgba(0,0,0,.45));
          transform: translate3d(80px, 80px, 0);
          will-change: transform;
        }
        #${CURSOR_ID}::before {
          content: "";
          display: block;
          width: 100%;
          height: 100%;
          background: #111;
          clip-path: polygon(0 0, 0 100%, 27% 73%, 44% 100%, 59% 92%, 42% 65%, 78% 63%);
        }
        .codex-proof-ripple {
          position: fixed;
          z-index: 2147483646;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(30, 64, 175, .7);
          border-radius: 999px;
          pointer-events: none;
          transform: translate(-50%, -50%) scale(.35);
          animation: codex-proof-ripple 420ms ease-out forwards;
        }
        @keyframes codex-proof-ripple {
          to { opacity: 0; transform: translate(-50%, -50%) scale(2.8); }
        }
      `;
      document.documentElement.appendChild(style);
    }

    const cursor = document.createElement("div");
    cursor.id = CURSOR_ID;
    document.documentElement.appendChild(cursor);
  }

  let x = 80;
  let y = 80;
  let motionSequence = 0;
  const motionEvents = [];

  const epochNow = () => performance.timeOrigin + performance.now();
  const recordMotion = (event) => {
    const frozen = Object.freeze(event);
    motionEvents.push(frozen);
    return frozen;
  };

  window.__proofMotionEvents = motionEvents;
  window.__proofTakeMotionEvents = () => motionEvents.splice(0, motionEvents.length);

  window.__proofCursorTo = (targetX, targetY, duration = 500, plannedWindowId) =>
    new Promise((resolve) => {
      if (![targetX, targetY, duration].every(Number.isFinite) || duration <= 0) {
        throw new Error("proof cursor target and duration must be finite; duration must be positive");
      }
      install();
      const cursor = document.getElementById(CURSOR_ID);
      const startX = x;
      const startY = y;
      const startedAt = performance.now();
      const startedAtEpochMs = epochNow();

      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
        const eased = ease(progress);
        x = startX + (targetX - startX) * eased;
        y = startY + (targetY - startY) * eased;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (progress < 1) requestAnimationFrame(animate);
        else {
          resolve(recordMotion({
            schemaVersion: 1,
            id: `cursor-${++motionSequence}`,
            plannedWindowId: plannedWindowId || null,
            kind: "cursor",
            startedAtEpochMs,
            endedAtEpochMs: epochNow(),
            requestedDurationMs: duration,
            from: { x: startX, y: startY },
            to: { x: targetX, y: targetY },
          }));
        }
      };

      requestAnimationFrame(animate);
    });

  window.__proofSmoothScrollTo = (targetY, duration = 900, plannedWindowId) =>
    new Promise((resolve) => {
      if (![targetY, duration].every(Number.isFinite) || duration <= 0) {
        throw new Error("proof scroll target and duration must be finite; duration must be positive");
      }
      const startY = window.scrollY;
      const startedAt = performance.now();
      const startedAtEpochMs = epochNow();

      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
        window.scrollTo(0, startY + (targetY - startY) * ease(progress));
        if (progress < 1) requestAnimationFrame(animate);
        else {
          resolve(recordMotion({
            schemaVersion: 1,
            id: `scroll-${++motionSequence}`,
            plannedWindowId: plannedWindowId || null,
            kind: "scroll",
            startedAtEpochMs,
            endedAtEpochMs: epochNow(),
            requestedDurationMs: duration,
            from: { y: startY },
            to: { y: targetY },
          }));
        }
      };

      requestAnimationFrame(animate);
    });

  document.addEventListener(
    "mousedown",
    (event) => {
      install();
      const ripple = document.createElement("div");
      ripple.className = "codex-proof-ripple";
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.documentElement.appendChild(ripple);
      setTimeout(() => ripple.remove(), 450);
    },
    true,
  );

  install();
  document.addEventListener("DOMContentLoaded", install, { once: true });
})();
