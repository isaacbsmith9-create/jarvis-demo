import { useMemo, useRef, useState } from 'react';

export interface Series {
  name: string;
  color: string;
  values: number[];
  area?: boolean;
  dashed?: boolean;
}

interface LineChartProps {
  series: Series[];
  labels: string[];
  height?: number;
  format: (v: number) => string;
  zeroLine?: boolean;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max - min < 100) {
    // Flat or near-flat data: give the axis a sensible minimum span.
    const d = Math.max(Math.abs(min), Math.abs(max), 10000);
    if (min >= 0) max = min + d;
    else min = max - d;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) out.push(v);
  return out;
}

/** Multi-series line/area chart over real data, with hover readout. */
export function LineChart({ series, labels, height = 220, format, zeroLine }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const padL = 64;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const n = labels.length;
  const { ticks, y } = useMemo(() => {
    const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
    let min = all.length ? Math.min(...all) : 0;
    let max = all.length ? Math.max(...all) : 1;
    if (zeroLine || min > 0) min = Math.min(min, 0);
    if (max < 0) max = 0;
    const ticks = niceTicks(min, max);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
    return { ticks, y };
  }, [series, H, zeroLine]);
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));

  if (n === 0 || (n < 2 && series.every((x) => x.values.length < 2))) return <div className="empty small">No history yet — advance time to build it.</div>;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const labelEvery = Math.max(1, Math.ceil(n / 6));
  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#34353d' : undefined} />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(Number.isFinite(v) ? v : 0).toFixed(1)}`);
          if (!pts.length) return null;
          const zeroY = y(Math.max(ticks[0], 0));
          return (
            <g key={s.name}>
              {s.area && <path d={`M${x(0)},${zeroY} L${pts.join(' L')} L${x(s.values.length - 1)},${zeroY} Z`} fill={s.color} opacity={0.09} />}
              <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dashed ? '4 4' : undefined} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#4a4b55" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 8, transform: `translateX(${hover > n / 2 ? '-105%' : '8px'})` }}>
          <div className="dim tiny" style={{ marginBottom: 4 }}>
            {labels[hover]}
          </div>
          {series.map((s) => (
            <div key={s.name} className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ background: s.color }} />
              <span className="muted">{s.name}</span>
              <span className="num" style={{ marginLeft: 'auto', paddingLeft: 12 }}>
                {format(s.values[hover] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface BarChartProps {
  values: number[];
  labels: string[];
  height?: number;
  format: (v: number) => string;
  posColor?: string;
  negColor?: string;
}

/** Bars over real data; negative values drawn below the axis. */
export function BarChart({ values, labels, height = 160, format, posColor = 'var(--pos)', negColor = 'var(--neg)' }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const padL = 64;
  const padB = 22;
  const padT = 10;
  if (!values.length || values.every((v) => v === 0)) return <div className="empty small">No activity yet.</div>;
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const bw = (W - padL - 8) / values.length;
  const labelEvery = Math.max(1, Math.ceil(values.length / 8));
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#3a3b44' : undefined} />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
            <rect x={padL + i * bw + bw * 0.18} width={bw * 0.64} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} fill={v >= 0 ? posColor : negColor} opacity={hover === i ? 1 : 0.78} />
            {(i % labelEvery === 0 || i === values.length - 1) && (
              <text x={padL + i * bw + bw / 2} y={H - 6} textAnchor="middle">
                {labels[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%`, top: 4, transform: hover > values.length / 2 ? 'translateX(-105%)' : 'translateX(8px)' }}>
          <span className="dim">{labels[hover]}</span> <span className={`num ${values[hover] >= 0 ? 'pos' : 'neg'}`}>{format(values[hover])}</span>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = 'var(--gold)', width = 90, height = 26 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}
