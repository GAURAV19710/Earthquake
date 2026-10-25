import React, { useState } from 'react';
import { fm, fmtTime, levelClass } from './api.js';

// Simplified coastline polygons as [lon, lat] (hand-traced approximation, not survey-accurate)
const ISLANDS = [
  [[140.0, 41.4], [140.1, 42.3], [140.4, 43.2], [141.4, 43.3], [141.7, 44.3], [141.6, 45.4], [142.0, 45.5], [143.3, 44.6], [144.4, 44.0], [145.3, 44.4], [145.0, 43.3], [144.0, 42.9], [143.3, 42.0], [142.0, 42.5], [141.0, 42.6], [140.4, 42.4]],
  [[141.5, 41.4], [141.1, 40.5], [142.0, 39.6], [141.8, 38.3], [141.0, 37.0], [140.9, 36.3], [140.8, 35.7], [140.4, 35.2], [139.9, 34.95], [139.7, 35.4], [139.1, 35.2], [138.8, 34.7], [138.2, 34.6], [137.0, 34.6], [136.8, 34.3], [136.3, 33.9], [135.8, 33.5], [135.1, 34.2], [135.0, 34.6], [133.9, 34.7], [132.5, 34.2], [131.0, 33.9], [131.5, 34.5], [132.5, 35.4], [133.5, 35.55], [134.9, 35.6], [135.9, 35.6], [136.1, 36.1], [136.7, 37.2], [137.3, 37.5], [137.0, 36.8], [138.3, 37.2], [139.0, 37.9], [139.8, 39.0], [140.0, 39.9], [140.0, 40.5], [140.4, 41.2], [140.9, 41.2]],
  [[132.0, 33.3], [132.5, 32.9], [133.0, 32.8], [134.0, 33.4], [134.6, 34.2], [134.2, 34.3], [133.5, 34.0], [132.9, 34.1], [132.4, 33.8]],
  [[130.9, 33.9], [131.7, 33.6], [131.9, 33.0], [131.5, 31.4], [131.0, 31.0], [130.6, 31.2], [130.2, 31.3], [130.2, 32.0], [129.8, 32.6], [130.2, 33.1], [129.9, 33.4], [130.4, 33.6]],
];
const CITIES = [['Sapporo', 43.06, 141.35], ['Sendai', 38.27, 140.87], ['Tokyo', 35.68, 139.69], ['Osaka', 34.69, 135.5], ['Fukuoka', 33.59, 130.4]];
const K = 36, PAD = 20, LON0 = 129.2, LAT1 = 46;
export const proj = (lon, lat) => [PAD + (lon - LON0) * 0.79 * K, PAD + (LAT1 - lat) * K];
const VB = [PAD * 2 + 17.6 * 0.79 * K, PAD * 2 + 16.4 * K];
// Closed Catmull-Rom spline -> smooth coastline instead of straight polygon edges
const smooth = (pts) => {
  const n = pts.length, f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], k = 0.17;
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)},${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)},${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
};
const LANDS = ISLANDS.map((pts) => smooth(pts.map(([lo, la]) => proj(lo, la))));
const LONS = [130, 134, 138, 142, 146], LATS = [32, 36, 40, 44];
const color = (l) => ({ high: '#ff3b4d', moderate: '#ffb020', low: '#22d37b' }[levelClass(l)] || '#6b84a3');

export default function JapanMap({ events = [], onSelect, labels = true, interactive = true, className = '' }) {
  const [tip, setTip] = useState(null);
  const eq = events.filter((e) => e.is_earthquake);
  return (
    <div className={`japanmap ${className}`}>
      <svg viewBox={`0 0 ${VB[0]} ${VB[1]}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Japan with earthquake markers">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="graticule">
          {LONS.map((lo) => { const [x1, y1] = proj(lo, 46), [x2, y2] = proj(lo, 30.5); return <g key={lo}><line x1={x1} y1={y1} x2={x2} y2={y2} /><text x={x1 + 3} y={y2 - 4}>{lo}°E</text></g>; })}
          {LATS.map((la) => { const [x1, y1] = proj(129.2, la), [x2, y2] = proj(146.8, la); return <g key={la}><line x1={x1} y1={y1} x2={x2} y2={y2} /><text x={x1 + 3} y={y1 - 3}>{la}°N</text></g>; })}
        </g>
        {LANDS.map((d, i) => <path key={i} d={d} className="land" />)}
        {labels && CITIES.map(([n, la, lo]) => { const [x, y] = proj(lo, la); return <g key={n} className="city"><circle cx={x} cy={y} r="2.5" /><text x={x + 6} y={y + 3}>{n}</text></g>; })}
        {eq.map((e) => {
          const [x, y] = proj(e.lon, e.lat), r = 3 + (e.magnitude || 3) * 1.1, c = color(e.alert_level);
          return (
            <g key={e.id} className={interactive ? 'ev' : ''} onMouseEnter={() => setTip({ e, x, y })} onMouseLeave={() => setTip(null)} onClick={() => onSelect?.(e)}>
              <circle cx={x} cy={y} r={r} fill={c} opacity=".18" className="pulse" />
              <circle cx={x} cy={y} r={r * 0.45} fill={c} filter="url(#glow)" />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="maptip" style={{ left: `${(tip.x / VB[0]) * 100}%`, top: `${(tip.y / VB[1]) * 100}%` }}>
          <b>M {fm(tip.e.magnitude)}</b> · {tip.e.region}<br /><small>{fmtTime(tip.e.time)} · {tip.e.alert_level}</small>
        </div>
      )}
    </div>
  );
}
