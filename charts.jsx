import React, { useEffect, useRef } from 'react';

const W = 600;

/** Waveform line chart with axis ticks. data: number[] */
export function WaveChart({ data, color = '#1e90ff', height = 130, duration = 50, fill = true, second, secondColor = '#ff3b4d' }) {
  const a = data?.length ? data : [0, 0];
  const m = Math.max(...a.map(Math.abs), 1e-9);
  const pts = (arr) => arr.map((v, i) => `${((i / (arr.length - 1)) * W).toFixed(1)},${(50 - (v / m) * 44).toFixed(1)}`).join(' ');
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(f * duration));
  return (
    <div className="wavechart" style={{ height }}>
      <div className="yt"><span>1</span><span>0</span><span>-1</span></div>
      <div className="plot">
        <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none">
          {[25, 50, 75].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} className="grid" />)}
          {fill && <polygon points={`0,50 ${pts(a)} ${W},50`} fill={color} opacity=".12" />}
          <polyline points={pts(a)} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          {second && <polyline points={pts(second)} fill="none" stroke={secondColor} strokeWidth="1.4" opacity=".85" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="xt">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
      </div>
    </div>
  );
}

/** Magnitude spectrum bars (0..fs/2). data: number[] magnitudes */
export function SpectrumChart({ data, height = 130 }) {
  const m = Math.max(...data, 1e-9);
  return (
    <div className="wavechart" style={{ height }}>
      <div className="yt"><span>1</span><span>.5</span><span>0</span></div>
      <div className="plot">
        <svg viewBox={`0 0 ${data.length} 100`} preserveAspectRatio="none">
          {data.map((v, i) => <rect key={i} x={i + 0.1} width="0.8" y={100 - (v / m) * 96} height={(v / m) * 96} fill="#1e90ff" opacity=".85" />)}
        </svg>
        <div className="xt">{[0, 10, 20, 30, 40, 50].map((t) => <span key={t}>{t} Hz</span>)}</div>
      </div>
    </div>
  );
}

/** Scrolling spectrogram on a canvas. spec: number[] latest spectrum column */
export function Spectrogram({ spec, height = 130 }) {
  const ref = useRef(null);
  const hist = useRef([]);
  useEffect(() => {
    if (!spec) return;
    hist.current.push(spec);
    hist.current = hist.current.slice(-120);
    const c = ref.current, g = c.getContext('2d');
    const cols = hist.current.length, cw = c.width / 120, mx = Math.max(...hist.current.flat(), 1e-9);
    g.fillStyle = '#050b16'; g.fillRect(0, 0, c.width, c.height);
    hist.current.forEach((col, x) => col.forEach((v, y) => {
      const t = Math.min(1, (v / mx) ** 0.6);
      g.fillStyle = `hsl(${240 - t * 240},90%,${12 + t * 45}%)`;
      g.fillRect((x + 120 - cols) * cw, c.height - (y + 1) * (c.height / col.length), cw + 0.5, c.height / col.length + 0.5);
    }));
  }, [spec]);
  return <canvas ref={ref} width="600" height="130" className="spectro" style={{ height }} />;
}

export function Confusion({ cm }) {
  const [[tn, fp], [fn, tp]] = cm || [[0, 0], [0, 0]];
  const mx = Math.max(tn, fp, fn, tp, 1);
  const cell = (v, good) => <div className="cm-cell" style={{ background: `rgba(${good ? '30,144,255' : '255,80,90'},${0.15 + 0.85 * v / mx})` }}>{v}</div>;
  return (
    <div className="cm">
      <div /><div className="cm-h">Quake</div><div className="cm-h">Noise</div>
      <div className="cm-h side">Quake</div>{cell(tp, true)}{cell(fn, false)}
      <div className="cm-h side">Noise</div>{cell(fp, false)}{cell(tn, true)}
      <div /><div className="cm-cap" style={{ gridColumn: 'span 2' }}>Columns: predicted · Rows: actual</div>
    </div>
  );
}

export function Curve({ curve, height = 150 }) {
  if (!curve) return <div className="empty">Needs 20+ training files for a learning curve.</div>;
  const n = curve.sizes.length, line = (arr) => arr.map((v, i) => `${(i / (n - 1)) * 300},${100 - v * 95}`).join(' ');
  return (
    <div>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="curve" style={{ height }}>
        {[25, 50, 75].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} className="grid" />)}
        <polyline points={line(curve.train)} fill="none" stroke="#1e90ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polyline points={line(curve.val)} fill="none" stroke="#ff3b4d" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="legend"><i style={{ background: '#1e90ff' }} />Train<i style={{ background: '#ff3b4d' }} />Validation (x: {curve.sizes[0]}–{curve.sizes[n - 1]} files)</div>
    </div>
  );
}

export function Bars({ items, color = '#1e90ff', height = 130 }) {
  const mx = Math.max(...items.map((i) => i.v), 1);
  return (
    <div className="bars" style={{ height }}>
      {items.map((i) => (
        <div key={i.k} className="bar"><div className="bv">{i.v}</div><div className="bf" style={{ height: `${(i.v / mx) * 80}%`, background: i.c || color }} /><div className="bk">{i.k}</div></div>
      ))}
    </div>
  );
}

/** Naive DFT magnitude (bins 1..n/2) for small arrays */
export function dft(x) {
  const n = x.length, out = [];
  for (let k = 1; k <= n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) { const a = (2 * Math.PI * k * t) / n; re += x[t] * Math.cos(a); im -= x[t] * Math.sin(a); }
    out.push(Math.hypot(re, im) / n);
  }
  return out;
}
