"use client";

import { useEffect, useRef } from "react";

/**
 * Halftone night sky: a dot matrix whose brightness comes from a soft noise field, a crescent
 * moon and a low city skyline. Dots twinkle slowly; an alert tint can wash over the skyline.
 */
export default function NightSky({ alert = 0, className = "" }: { alert?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const alertRef = useRef(alert);
  alertRef.current = alert;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const STEP = 7;

    // deterministic hash noise
    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const smooth = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };

    let skyline: number[] = [];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      skyline = [];
      let x = 0;
      while (x < w + 40) {
        const bw = 18 + hash(x, 3) * 46;
        const bh = h * (0.06 + hash(x, 9) * 0.16);
        for (let i = 0; i < bw; i += STEP) skyline.push(bh);
        x += bw;
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const mx = w * 0.78, my = h * 0.28, mr = Math.min(w, h) * 0.13;
      const a = alertRef.current;
      for (let y = STEP / 2; y < h; y += STEP) {
        for (let x = STEP / 2; x < w; x += STEP) {
          const col = Math.floor(x / STEP);
          const sky = skyline[col] ?? 0;
          const inBuilding = y > h - sky;
          let v = smooth(x * 0.012, y * 0.02 + t * 0.00003) * 0.35;
          v *= Math.pow(1 - y / h, 0.6) * 0.9;
          // cloud bands
          v += Math.max(0, smooth(x * 0.004 + t * 0.00002, y * 0.012) - 0.55) * 1.3;
          // moon (crescent)
          const d1 = Math.hypot(x - mx, y - my);
          const d2 = Math.hypot(x - (mx + mr * 0.42), y - (my - mr * 0.18));
          if (d1 < mr && d2 > mr * 0.92) v = 0.95;
          else if (d1 < mr * 1.9) v += (1 - d1 / (mr * 1.9)) * 0.18;
          // stars
          const star = hash(col, Math.floor(y / STEP));
          if (star > 0.992) v = 0.55 + 0.45 * Math.sin(t * 0.002 + star * 100);
          let r = 255, g = 255, b = 255;
          if (inBuilding) {
            const lit = hash(col * 3, Math.floor(y / STEP) * 7) > 0.86;
            v = lit ? 0.75 : 0.07;
            if (lit && a > 0) {
              r = 255; g = 120 + 80 * (1 - a); b = 70;
            }
          }
          if (v < 0.06) continue;
          const size = Math.min(1.7, 0.4 + v * 1.6);
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(v, 1) * 0.9})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
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

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
