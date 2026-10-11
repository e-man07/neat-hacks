"use client";

import { useEffect, useRef } from "react";

/**
 * A halftone moon: a dot grid clipped to a sphere, dot size from how dark that point is. The lit
 * crescent reads as small dots, the night side and the maria as large ones. One spot pulses orange —
 * an incident, somewhere, at night.
 */
export default function HalftoneMoon({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let w = 0;
    let h = 0;

    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const noise = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    // a few fixed craters (sphere coords -1..1)
    const craters = Array.from({ length: 18 }, (_, i) => ({
      x: hash(i, 3) * 1.6 - 0.8,
      y: hash(i, 7) * 1.4 - 0.9,
      r: 0.04 + hash(i, 11) * 0.12,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w * (w < 640 ? 0.48 : 0.36), h * 1.02);
      const cx = w / 2;
      const cy = h + R * 0.22; // the sphere rises from the bottom edge
      const step = Math.max(5, Math.round(R / 70));
      const light = { x: -0.62, y: -0.42, z: 0.66 }; // from upper left: a fat crescent
      const drift = reduce ? 0 : t * 0.00004;
      const ping = { x: 0.34, y: -0.52 };
      const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 0.004);

      for (let y = cy - R; y <= Math.min(h, cy + R); y += step) {
        for (let x = cx - R; x <= cx + R; x += step) {
          const nx = (x - cx) / R;
          const ny = (y - cy) / R;
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          // lambert shading, softened
          let lit = Math.max(0, nx * light.x + ny * light.y + nz * light.z);
          lit = Math.pow(lit, 0.75);
          // maria: large dark patches
          const m = noise(nx * 2.2 + 4 + drift, ny * 2.2 + 1);
          let dark = 1 - lit * (0.55 + 0.45 * (m > 0.55 ? 0.55 : 1));
          // craters: darker rims
          for (const c of craters) {
            const dd = Math.hypot(nx - c.x, ny - c.y);
            if (dd < c.r) dark = Math.min(1, dark + 0.25 * (1 - Math.abs(dd / c.r - 0.8) * 2.2));
          }
          // grain
          dark += (hash(x * 0.37, y * 0.71) - 0.5) * 0.18;
          // limb darkening
          dark = Math.min(1, dark + Math.pow(1 - nz, 3) * 0.35);
          const size = Math.max(0, Math.min(1, dark)) * step * 0.62;
          if (size < 0.35) continue;
          const pd = Math.hypot(nx - ping.x, ny - ping.y);
          if (pd < 0.07) {
            ctx.fillStyle = `rgba(224, 80, 43, ${0.55 + 0.45 * pulse})`;
          } else {
            ctx.fillStyle = "#111";
          }
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // the ring around the incident
      const px = cx + ping.x * R, py = cy + ping.y * R;
      ctx.strokeStyle = `rgba(224, 80, 43, ${0.6 * (1 - pulse)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, R * (0.08 + 0.06 * pulse), 0, Math.PI * 2);
      ctx.stroke();

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={`block h-full w-full ${className}`} aria-hidden />;
}
