"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-[#111] px-4 py-2.5 text-sm font-medium transition hover:bg-[#2a2a2a]"
      style={{ color: "#fff" }}
    >
      {children} <Arrow />
    </Link>
  );
}

export function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-[var(--panel)] px-4 py-2.5 text-sm font-medium text-fg shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-card-2"
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  onClick,
  tone = "default",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger" | "ok";
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    default: "border-line-strong bg-white/[0.04] text-fg hover:bg-white/[0.08]",
    primary: "border-white bg-white text-black hover:bg-white/90",
    danger: "border-alert/50 bg-alert/10 text-alert hover:bg-alert/20",
    ok: "border-ok/50 bg-ok/10 text-ok hover:bg-ok/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({ children, color = "var(--muted)", pulse = false }: { children: ReactNode; color?: string; pulse?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider"
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, color }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pulse ? "pulse-alert" : ""}`} style={{ background: color }} />
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card ${className}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{children}</div>;
}

/** A number that animates toward its target. */
export function Counter({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

export function Sparkline({
  values,
  color = "var(--alert)",
  height = 56,
  fill = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const w = 300;
  if (values.length < 2) {
    return <div style={{ height }} className="dotgrid rounded-md opacity-40" />;
  }
  const max = Math.max(...values, 1e-9);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - (v / max) * (height - 6) - 3]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {fill && <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function WindowFrame({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`window force-dark overflow-hidden ${className}`}>
      <div className="window-bar">
        <i style={{ background: "#ff5f57" }} />
        <i style={{ background: "#febc2e" }} />
        <i style={{ background: "#28c840" }} />
        <span className="ml-2 truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** The Nightly ghost: logo and character. */
export function Moon({ size = 18 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/nightly.png" width={Math.round(size * 1.1)} height={size} alt="" aria-hidden style={{ objectFit: "contain" }} />;
}

export const Logo = Moon;
