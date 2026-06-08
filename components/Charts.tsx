/** Pure presentational chart components (SVG), ported from the HTML prototype. */
import { fmtK, money } from "@/lib/format";
import type { BridgeStep } from "@/lib/uiSeries";

/** KPI card. */
export function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="kpi">
      <div className="kpi-bar" style={{ background: color }} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function KpiGrid({ items }: { items: { l: string; v: string; s?: string; c: string }[] }) {
  return (
    <div className="kpi-grid">
      {items.map((k, i) => <Kpi key={i} label={k.l} value={k.v} sub={k.s} color={k.c} />)}
    </div>
  );
}

/** Vertical bridge (waterfall-style list) — used by cost-basis and performance bridges. */
export function Bridge({ steps }: { steps: BridgeStep[] }) {
  const vals = steps.filter((s) => s.kind !== "spacer" && typeof s.val === "number").map((s) => Math.abs(s.val!));
  const maxAbs = Math.max(1, ...vals);
  return (
    <div>
      {steps.map((item, i) => {
        if (item.kind === "spacer") return <div key={i} style={{ height: 6 }} />;
        const val = item.val ?? 0;
        const w = Math.max(2, (Math.abs(val) / maxAbs) * 140);
        const sign = val < 0 ? "−" : val === 0 ? "" : "+";
        const valStr = item.kind === "grand" || item.kind === "subtotal"
          ? money(val)
          : (val < 0 ? "−" : sign) + money(Math.abs(val));
        const rowStyle: React.CSSProperties =
          item.kind === "grand" ? { background: "#f0fdf4", fontSize: 14, fontWeight: 800 }
            : item.kind === "subtotal" ? { background: "#f8faff", fontWeight: 700 }
              : item.kind === "sub" ? { opacity: 0.65, fontSize: 12 } : {};
        const bold = item.kind === "subtotal" || item.kind === "grand";
        return (
          <div key={i} className="bridge-row" style={rowStyle}>
            <span className="bridge-label" style={bold ? { fontWeight: 700 } : undefined}>{item.label}</span>
            <div className="bridge-bar-wrap">
              <div className="bridge-bar" style={{ width: w, left: val < 0 ? 140 - w : 0, background: item.color, opacity: item.kind === "sub" ? 0.4 : 0.75 }} />
            </div>
            <span className="bridge-val" style={{ color: item.color }}>{bold ? <b>{valStr}</b> : valStr}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal bar chart — top dividend payers, gainers/losers, top holdings. */
export function HBarChart({
  data, color, valueFmt = (v) => money(v), signed = false, width = 460, rowH = 24, labelW = 56, padR = 90, colorFor,
}: {
  data: { code: string; v: number; pct?: number }[];
  color?: string;
  valueFmt?: (v: number) => string;
  signed?: boolean;
  width?: number; rowH?: number; labelW?: number; padR?: number;
  colorFor?: (d: { code: string; v: number }) => string;
}) {
  const H = data.length * rowH;
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.v)));
  return (
    <svg viewBox={`0 0 ${width} ${H}`} width="100%" style={{ fontFamily: "inherit" }}>
      {data.map((d, i) => {
        const y = i * rowH;
        const bW = Math.max(2, (Math.abs(d.v) / maxAbs) * (width - labelW - padR));
        const sign = signed ? (d.v >= 0 ? "+" : "−") : "";
        const fill = colorFor ? colorFor(d) : color ?? "#2563eb";
        return (
          <g key={d.code}>
            <text x={labelW - 6} y={y + rowH / 2 + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#374151">{d.code}</text>
            <rect x={labelW} y={y + 3} width={bW} height={rowH - 6} rx="2" fill={fill} opacity="0.85" />
            <text x={labelW + bW + 6} y={y + rowH / 2 + 4} fontSize="10" fill="#374151" fontWeight={signed ? 600 : 400}>{sign}{valueFmt(Math.abs(d.v))}</text>
            {d.pct !== undefined ? <text x={width - 2} y={y + rowH / 2 + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{(d.pct >= 0 ? "+" : "") + d.pct.toFixed(1)}%</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Grouped vertical bars for monthly buys vs sells. */
export function MonthlyActivity({ months, buys, sells }: { months: string[]; buys: number[]; sells: number[] }) {
  const W = 460, H = 160, padL = 40, padB = 28, padT = 6, padR = 6;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const maxV = Math.max(1, ...buys, ...sells);
  const n = months.length, bW = Math.min((innerW / n) * 0.38, 16);
  return (
    <>
      <div className="legend">
        <span><span className="legend-dot" style={{ background: "#22c55e" }} />Buys</span>
        <span><span className="legend-dot" style={{ background: "#f87171" }} />Sells</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ fontFamily: "inherit" }}>
        {[0, 0.5, 1].map((f) => {
          const y = padT + innerH * (1 - f);
          return <g key={f}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="8" fill="#9ca3af">{fmtK(maxV * f)}</text>
          </g>;
        })}
        {months.map((m, i) => {
          const cx = padL + i * (innerW / n) + innerW / n / 2;
          const bH = (buys[i] / maxV) * innerH, sH = (sells[i] / maxV) * innerH;
          return <g key={m}>
            <rect x={cx - bW - 1} y={padT + innerH - bH} width={bW} height={bH} rx="2" fill="#22c55e" opacity="0.75" />
            <rect x={cx + 1} y={padT + innerH - sH} width={bW} height={sH} rx="2" fill="#f87171" opacity="0.75" />
            <text x={cx} y={H - padB + 11} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{m}</text>
          </g>;
        })}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#d1d5db" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#d1d5db" />
      </svg>
    </>
  );
}

/** Single-series monthly bars (dividends). */
export function MonthlyBars({ data, color = "#0d9488" }: { data: Record<string, number>; color?: string }) {
  const months = Object.keys(data), vals = Object.values(data);
  const W = 460, H = 180, padL = 44, padB = 32, padT = 8, padR = 8;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const maxV = Math.max(1, ...vals);
  const n = months.length, bW = Math.min((innerW / n) * 0.65, 26);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ fontFamily: "inherit" }}>
      {[0, 0.5, 1].map((f) => {
        const y = padT + innerH * (1 - f);
        return <g key={f}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" />
          <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{fmtK(maxV * f)}</text>
        </g>;
      })}
      {months.map((m, i) => {
        const cx = padL + i * (innerW / n) + innerW / n / 2;
        const bH = (vals[i] / maxV) * innerH, y = padT + innerH - bH;
        const col = vals[i] > 20000 ? "#0d9488" : vals[i] > 10000 ? "#22c55e" : color;
        return <g key={m}>
          <rect x={cx - bW / 2} y={y} width={bW} height={bH} rx="2" fill={col} />
          <text x={cx} y={H - padB + 13} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{m}</text>
          {vals[i] > 5000 ? <text x={cx} y={y - 3} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600">{fmtK(vals[i])}</text> : null}
        </g>;
      })}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#d1d5db" />
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#d1d5db" />
    </svg>
  );
}
