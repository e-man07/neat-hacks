"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type Bucket = { t: number; n: number; failed: number; loss: number; cost: number };

/** The metrics endpoint only returns non-empty buckets; fill the gaps with zeros so the x axis is real time. */
export function fillBuckets(series: Bucket[], minutes: number, bucketS: number): Bucket[] {
  // End the window at the newest bucket the server returned (its clock), falling back to the browser clock.
  const latest = series.reduce((m, b) => Math.max(m, b.t), 0);
  const now = Math.floor((latest || Date.now() / 1000) / bucketS) * bucketS;
  const start = now - Math.floor((minutes * 60) / bucketS) * bucketS + bucketS;
  const by = new Map(series.map((b) => [Math.floor(b.t / bucketS) * bucketS, b]));
  const out: Bucket[] = [];
  for (let t = start; t <= now; t += bucketS) out.push(by.get(t) ?? { t, n: 0, failed: 0, loss: 0, cost: 0 });
  return out;
}

/** Sum several agents' bucket series into one. */
export function sumBuckets(all: Bucket[][]): Bucket[] {
  const m = new Map<number, Bucket>();
  for (const s of all)
    for (const b of s) {
      const cur = m.get(b.t) ?? { t: b.t, n: 0, failed: 0, loss: 0, cost: 0 };
      m.set(b.t, { t: b.t, n: cur.n + b.n, failed: cur.failed + b.failed, loss: cur.loss + b.loss, cost: cur.cost + b.cost });
    }
  return [...m.values()].sort((a, b) => a.t - b.t);
}

const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const runsConfig = {
  good: { label: "Good runs", color: "var(--chart-4)" },
  failed: { label: "Bad runs", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Stacked area: good runs vs bad runs per bucket. */
export function RunsChart({ data, height = 240 }: { data: Bucket[]; height?: number }) {
  const rows = data.map((b) => ({ t: b.t, good: Math.max(0, b.n - b.failed), failed: b.failed }));
  return (
    <ChartContainer config={runsConfig} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillGood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-good)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-good)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-failed)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-failed)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} tickFormatter={hhmm} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<ChartTooltipContent indicator="dot" labelFormatter={(_, p) => (p?.[0] ? hhmm(p[0].payload.t) : "")} />}
        />
        <Area dataKey="good" type="monotone" stackId="a" stroke="var(--color-good)" strokeWidth={1.5} fill="url(#fillGood)" isAnimationActive={false} />
        <Area dataKey="failed" type="monotone" stackId="a" stroke="var(--color-failed)" strokeWidth={1.5} fill="url(#fillFailed)" isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}

/** Tiny area sparkline for KPI cards. */
export function MiniSpark({ values, color = "var(--chart-4)", height = 44 }: { values: number[]; color?: string; height?: number }) {
  const rows = values.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <ChartContainer config={{ v: { label: "value", color } }} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={rows} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area dataKey="v" type="monotone" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}
