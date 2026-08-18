/**
 * Smoothly scrolls to a target DOM element with an offset for sticky/fixed headers.
 * Uses requestAnimationFrame with easeInOutCubic curve for a fluid, cinematic scroll feel.
 */
export function smoothScrollTo(targetId, offset = 80) {
  if (!targetId || targetId === "top" || targetId === "#" || targetId === "/") {
    const startY = window.pageYOffset || document.documentElement.scrollTop;
    if (startY === 0) return;
    animateScroll(startY, 0, Math.min(700, Math.max(350, startY * 0.4)));
    if (window.history.pushState) {
      window.history.pushState(null, "", window.location.pathname);
    }
    return;
  }

  const cleanId = targetId.replace(/^#/, "");
  const targetElement = document.getElementById(cleanId);

  if (!targetElement) {
    if (window.location.pathname !== "/") {
      window.location.href = `/#${cleanId}`;
    }
    return;
  }

  const startY = window.pageYOffset || document.documentElement.scrollTop;
  const elementRect = targetElement.getBoundingClientRect();
  const targetY = Math.max(0, elementRect.top + startY - offset);
  const distance = Math.abs(targetY - startY);

  if (distance < 5) return;

  const duration = Math.min(850, Math.max(400, distance * 0.45));
  animateScroll(startY, targetY, duration, cleanId);
}

function animateScroll(startY, targetY, duration, hashToSet) {
  const distance = targetY - startY;
  let startTime = null;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(currentTime) {
    if (!startTime) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = easeInOutCubic(progress);

    window.scrollTo(0, startY + distance * ease);

    if (timeElapsed < duration) {
      window.requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
      if (hashToSet && window.history.pushState) {
        window.history.pushState(null, "", `#${hashToSet}`);
      }
    }
  }

  window.requestAnimationFrame(step);
}
