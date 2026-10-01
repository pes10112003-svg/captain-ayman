/**
 * Browser-only, dependency-free confetti burst used for small wins (workout finished, all meals eaten).
 * Draws on a temporary full-screen canvas that ignores pointer events and removes itself.
 */
export function celebrate() {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "9998",
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();

  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const colors = ["#C4F042", "#A3D13A", "#FFFFFF", "#38BDF8", "#FBBF24", "#F472B6"];
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const parts = Array.from({ length: 140 }, (_, i) => {
    const fromStart = i % 2 === 0;
    return {
      x: fromStart ? rand(-10, W * 0.08) : rand(W * 0.92, W + 10),
      y: H + 10,
      vx: (fromStart ? 1 : -1) * rand(2.5, 9) * Math.min(1.4, W / 420),
      vy: -rand(13, 22) * Math.min(1.25, H / 760),
      rot: rand(0, Math.PI),
      vr: rand(-0.25, 0.25),
      w: rand(6, 11),
      h: rand(3, 6),
      color: colors[i % colors.length]!,
      wobble: rand(0, Math.PI * 2),
    };
  });

  const start = performance.now();
  const duration = 2200;
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    const fade = t > duration * 0.65 ? Math.max(0, 1 - (t - duration * 0.65) / (duration * 0.35)) : 1;
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.wobble += 0.12;
      p.x += p.vx + Math.sin(p.wobble) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.wobble));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
