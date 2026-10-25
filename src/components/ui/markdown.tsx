import * as React from "react";
import { cn } from "@/lib/utils";

/** Renderizador Markdown mínimo e seguro (sem HTML): títulos, negrito, itálico, listas e tabelas. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}-${i++}`} className="rounded bg-muted px-1 text-[0.85em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}-${i++}`} className="text-muted-foreground">{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      const [head, ...body] = rows;
      blocks.push(
        <div key={`t${i}`} className="my-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/70">
              <tr>{head?.map((h, k) => <th key={k} className="whitespace-nowrap px-3 py-2 font-semibold">{inline(h, `h${i}${k}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-t">
                  {r.map((c, k) => <td key={k} className="px-3 py-2">{inline(c, `c${i}${ri}${k}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•]\s+/, ""));
      i--;
      blocks.push(<ul key={`u${i}`} className="my-2 list-disc space-y-1 pl-5">{items.map((it, k) => <li key={k}>{inline(it, `l${i}${k}`)}</li>)}</ul>);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      blocks.push(<p key={`h${i}`} className={cn("mt-3 font-semibold", h[1].length === 1 ? "text-base" : "text-sm")}>{inline(h[2], `hh${i}`)}</p>);
      continue;
    }
    if (!line.trim()) {
      blocks.push(<div key={`s${i}`} className="h-2" />);
      continue;
    }
    blocks.push(<p key={`p${i}`} className="leading-relaxed">{inline(line, `p${i}`)}</p>);
  }
  return <div className={cn("text-sm", className)}>{blocks}</div>;
}
