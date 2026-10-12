import type { ReactNode } from "react";

/** Strip markdown so agent replies read as plain text (no raw `**` or backticks). */
export function plain(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/(^|[\s(])\*(\S[^*\n]*?)\*/g, "$1$2")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={m.index} className="font-semibold text-fg">{m[1]}</strong>);
    else out.push(<code key={m.index} className="rounded bg-card-2 px-1 font-mono text-[0.92em]">{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** A tiny markdown renderer for paragraphs, bullet lists, bold and inline code. */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(lines.join(" ").replace(/^#{1,6}\s*/, ""))}</p>;
      })}
    </div>
  );
}

export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
