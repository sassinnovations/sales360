export const COLORS = ["#7c5cfc", "#3b82f6", "#14b8a6", "#f59e0b", "#22c55e", "#ec4899", "#6366f1"];

export function LineChart({
  series,
}: {
  series: { label: string; leads: number; opps: number }[];
}) {
  const width = 560;
  const height = 210;
  const pad = 28;
  const max = Math.max(1, ...series.flatMap((row) => [row.leads, row.opps]));
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(1, series.length - 1);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const path = (key: "leads" | "opps") =>
    series.map((row, index) => `${index ? "L" : "M"}${x(index)},${y(row[key])}`).join(" ");
  const ticks = [0, Math.round(max / 2), max];
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Leads and opportunities over six months">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad} x2={width - 8} y1={y(tick)} y2={y(tick)} stroke="#eef1f6" />
          <text x={0} y={y(tick) + 4} fontSize="11" fill="#98a0b3">{tick}</text>
        </g>
      ))}
      <path d={path("leads")} fill="none" stroke="#7c5cfc" strokeWidth="3" strokeLinejoin="round" />
      <path d={path("opps")} fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinejoin="round" />
      {series.map((row, index) => (
        <text key={row.label} x={x(index)} y={height - 6} textAnchor="middle" fontSize="11" fill="#98a0b3">
          {row.label}
        </text>
      ))}
    </svg>
  );
}

export function Donut({
  slices,
  center,
  caption,
}: {
  slices: { name: string; count: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 160 160" className="chart" role="img" aria-label={caption}>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#eef1f6" strokeWidth="16" />
          {slices.map((slice) => {
            const length = (slice.count / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const node = (
              <circle
                key={slice.name}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 80 80)"
              />
            );
            offset += length;
            return node;
          })}
        </svg>
        <div className="donut-label">
          <div>
            <strong>{center}</strong>
            <span>{caption}</span>
          </div>
        </div>
      </div>
      <div className="legend-list">
        {slices.map((slice) => (
          <div key={slice.name}>
            <span><i className="swatch" style={{ background: slice.color }} />{slice.name}</span>
            <span className="muted">{Math.round((slice.count / total) * 100)}% ({slice.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bars" aria-label="Revenue by month">
      {rows.map((row) => (
        <div key={row.label}>
          <i style={{ height: `${Math.max(6, (row.value / max) * 100)}%` }} />
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  );
}
