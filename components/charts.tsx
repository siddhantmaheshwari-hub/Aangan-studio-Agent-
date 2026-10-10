// Small SVG charts rendered on the server. Colours come from the --c1..--c5 tokens.
// Each chart has a text alternative (aria-label + a visually hidden table).

export interface Series { key: string; label: string; color: string }

export function StackedBars({ data, series, height = 150, caption }: {
  data: { label: string; values: Record<string, number> }[];
  series: Series[];
  height?: number;
  caption: string;
}) {
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = Math.max(1, Math.ceil(max / 4));
  const top = Math.max(2, step * Math.ceil(max / step) + ((step * Math.ceil(max / step)) % 2));
  const w = 100 / data.length;
  return (
    <figure className="m-0">
      <div className="flex gap-3" style={{ height }}>
        <div aria-hidden className="relative w-5 text-right text-xs tabular-nums text-fg-3" style={{ height: height - 20 }}>
          {[top, top / 2, 0].map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - t / top) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <svg role="img" aria-label={caption} viewBox={`0 0 100 ${height - 20}`} preserveAspectRatio="none" className="h-[calc(100%-20px)] w-full overflow-visible">
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1="0" x2="100" y1={(height - 20) * f} y2={(height - 20) * f} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {data.map((d, i) => {
              let y = height - 20;
              return (
                <g key={d.label}>
                  {series.map((s) => {
                    const v = d.values[s.key] ?? 0;
                    if (!v) return null;
                    const h = (v / top) * (height - 20);
                    y -= h;
                    return <rect key={s.key} x={i * w + w * 0.28} width={w * 0.44} y={y} height={Math.max(h - 0.6, 0.6)} rx="1.2" fill={s.color}><title>{`${d.label}: ${v} ${s.label.toLowerCase()}`}</title></rect>;
                  })}
                </g>
              );
            })}
          </svg>
          <div aria-hidden className="mt-1 flex text-xs text-fg-3">
            {data.map((d) => <span key={d.label} className="text-center" style={{ width: `${w}%` }}>{d.label}</span>)}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
        ))}
      </figcaption>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Day</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th>{series.map((s) => <td key={s.key}>{d.values[s.key] ?? 0}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}

export function Donut({ parts, size = 132, label, sublabel }: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  label: string;
  sublabel: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 15.9155; // circumference 100
  let offset = 25;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg role="img" aria-label={`${sublabel}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`} viewBox="0 0 42 42" width={size} height={size} className="shrink-0">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        {total > 0 && parts.filter((p) => p.value).map((p) => {
          const pct = (p.value / total) * 100;
          const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${Math.max(pct - 0.8, 0.4)} ${100 - Math.max(pct - 0.8, 0.4)}`} strokeDashoffset={offset} />;
          offset -= pct;
          return el;
        })}
        <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="font-display" style={{ fontSize: 8, fill: "var(--fg)" }}>{label}</text>
        <text x="21" y="27.5" textAnchor="middle" style={{ fontSize: 3, fill: "var(--fg-3)" }}>{sublabel}</text>
      </svg>
      <ul className="min-w-36 flex-1 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-fg-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
            <span className="tabular-nums text-fg">{p.value}<span className="ml-1.5 text-xs text-fg-3">{total ? Math.round((p.value / total) * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Half-ring gauge: value against a target (lower is better when `lowerIsBetter`). */
export function Gauge({ value, max, label, caption }: { value: number | null; max: number; label: string; caption: string }) {
  const pct = value === null ? 0 : Math.min(value / max, 1);
  const arc = 125.66; // half circumference of r=40
  return (
    <svg role="img" aria-label={caption} viewBox="0 0 100 58" className="w-full max-w-56">
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--surface-2)" strokeWidth="9" strokeLinecap="round" />
      {value !== null && (
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--sage)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct * arc} ${arc}`} />
      )}
      <text x="50" y="44" textAnchor="middle" className="font-display" style={{ fontSize: 15, fill: "var(--fg)" }}>{label}</text>
    </svg>
  );
}
