/* In-browser fallback for the SeismoSense API.
 * Used ONLY when the Python backend is unreachable, so the dashboard still works (demo mode).
 * Data lives in localStorage of this browser. Classification = the same STA/LTA demo heuristic as the backend.
 * Model training, MSEED parsing and the Japan dataset folder need the real backend. */

const KEY = 'ss_offline_store_v1';
export const REGIONS = {
  Hokkaido: [43.06, 142.8], Aomori: [40.82, 140.74], Iwate: [39.7, 141.15], Miyagi: [38.27, 141.0], Akita: [39.72, 140.1],
  Yamagata: [38.24, 140.33], Fukushima: [37.4, 141.0], Ibaraki: [36.3, 140.6], Tochigi: [36.57, 139.88], Chiba: [35.55, 140.4],
  Tokyo: [35.68, 139.69], Kanagawa: [35.45, 139.64], Niigata: [37.5, 138.9], Ishikawa: [37.2, 136.8], Nagano: [36.65, 138.18],
  Shizuoka: [34.9, 138.2], Aichi: [35.18, 136.91], Osaka: [34.69, 135.5], Hyogo: [34.69, 134.9], Wakayama: [33.8, 135.4],
  Hiroshima: [34.4, 132.46], Kochi: [33.4, 133.4], Fukuoka: [33.59, 130.4], Kumamoto: [32.8, 130.7], Oita: [33.24, 131.61],
  Kagoshima: [31.6, 130.55], 'Japan (unspecified)': [36.0, 138.0],
};
const SEED = [[2, 6.8, 'Miyagi', 1, 98.7], [26, 5.4, 'Fukushima', 1, 96.4], [51, 4.7, 'Ibaraki', 1, 94.1], [74, 5.6, 'Chiba', 1, 97.2],
  [101, 3.9, 'Hokkaido', 1, 91.5], [125, 4.3, 'Niigata', 1, 93.0], [150, 6.1, 'Kumamoto', 1, 97.9], [170, 3.4, 'Shizuoka', 1, 90.2],
  [14, null, 'Tokyo', 0, 96.0], [40, null, 'Osaka', 0, 94.5], [88, null, 'Fukuoka', 0, 92.8]];

/* ---------- random + signal helpers ---------- */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, uniform: (lo, hi) => lo + (hi - lo) * next(), int: (lo, hi) => Math.floor(lo + (hi - lo) * next()),
    normal: () => Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next()) };
}

export function synthWave(r, quake, n = 3000, fs = 100, bursts = true) {
  const g = Array.from({ length: n }, () => r.normal() * r.uniform(0.05, 0.25));
  const x = g.map((_, i) => ((g[i - 1] || 0) + g[i] + (g[i + 1] || 0)) / 3);
  const a0 = r.uniform(0.02, 0.2), f0 = r.uniform(0.1, 0.4), ph = r.uniform(0, 6);
  for (let i = 0; i < n; i++) x[i] += a0 * Math.sin(2 * Math.PI * f0 * (i / fs) + ph);
  if (quake) {
    const t0 = r.uniform(0.2, 0.55) * n / fs, ts = t0 + r.uniform(3, 6), a = r.uniform(0.4, 3), fP = r.uniform(8, 15), fS = r.uniform(2, 6), dec = r.uniform(6, 12);
    for (let i = 0; i < n; i++) {
      const t = i / fs;
      if (t >= t0 && t < ts) { const p = t - t0; x[i] += 0.3 * a * Math.sin(2 * Math.PI * fP * p) * Math.min(p / 0.5, 1); }
      if (t >= ts) { const s = t - ts; x[i] += a * Math.exp(-s / dec) * Math.sin(2 * Math.PI * fS * s) * Math.min(s, 1); }
    }
  } else if (bursts) {
    for (let k = r.int(0, 4); k > 0; k--) {
      const i0 = r.int(0, n - 40), L = r.int(5, 30), amp = r.uniform(0.3, 1), f = r.uniform(10, 25);
      for (let j = 0; j < L; j++) x[i0 + j] += amp * Math.sin(2 * Math.PI * f * j / fs);
    }
  }
  return x;
}

const preview = (x, n = 300) => {
  if (x.length <= n) return x.map((v) => +v.toFixed(4));
  const k = Math.floor(x.length / n), out = [];
  for (let i = 0; i < n; i++) { let best = 0; for (let j = 0; j < k; j++) { const v = x[i * k + j]; if (Math.abs(v) > Math.abs(best)) best = v; } out.push(+best.toFixed(4)); }
  return out;
};

function staLtaMax(x, sta = 8, lta = 64) {
  const n = x.length;
  if (n <= sta + lta) return 1;
  const c = [0]; for (let i = 0; i < n; i++) c.push(c[i] + x[i] * x[i]);
  let best = 0;
  for (let t = sta + lta; t <= n; t++) { const s = (c[t] - c[t - sta]) / sta, l = (c[t - sta] - c[t - sta - lta]) / lta; best = Math.max(best, s / (l + 1e-12)); }
  return best;
}

export function classify(values) {
  const v = Array.from(values).filter(Number.isFinite);
  if (v.length < 8) throw new Error('File needs at least 8 numeric samples.');
  const mean = v.reduce((a, b) => a + b, 0) / v.length, c = v.map((q) => q - mean), N = 512;
  const xs = Array.from({ length: N }, (_, i) => { const p = (i * (c.length - 1)) / (N - 1), lo = Math.floor(p), hi = Math.min(lo + 1, c.length - 1); return c[lo] + (c[hi] - c[lo]) * (p - lo); });
  const peak = Math.max(...xs.map(Math.abs)) || 1, ratio = staLtaMax(xs.map((q) => q / peak));
  const prob = 1 / (1 + Math.exp(-(ratio - 7) * 0.5)), quake = prob >= 0.5;
  const mag = Math.round(Math.min(7.5, Math.max(2, 3.2 + 1.6 * Math.log10(Math.max(ratio, 1)))) * 10) / 10;
  return { quake, label: quake ? 'Earthquake' : 'Non-Earthquake', confidence: Math.round(Math.max(prob, 1 - prob) * 1000) / 10, magnitude: quake ? mag : null, ratio: Math.round(ratio * 100) / 100, c };
}
const alertLevel = (m) => (m >= 5.5 ? 'High' : m >= 4 ? 'Moderate' : 'Low');
const jst = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 19) + '+09:00';
const uid = () => Math.random().toString(16).slice(2, 8).toUpperCase();

/* ---------- store ---------- */
function alertFor(ev) {
  if (!ev.is_earthquake) return null;
  const title = { High: 'Earthquake Detected', Moderate: 'Moderate Earthquake', Low: 'Low Magnitude Event' }[ev.alert_level];
  return { id: Math.random().toString(16).slice(2, 10), time: ev.time, level: ev.alert_level, title, event_id: ev.id,
    detail: `M ${ev.magnitude.toFixed(1)} - ` + (ev.region.startsWith('Japan') ? 'Japan' : `Near ${ev.region}, Japan`), read: false, sent: false };
}
function seed() {
  const r = rng(11), now = Date.now(), events = [], alerts = [];
  SEED.forEach(([h, mag, reg, q, conf], i) => {
    const [lat, lon] = REGIONS[reg], w = synthWave(r, !!q);
    const ev = { id: `EV${1000 + i}`, time: jst(now - h * 3600e3 - r.int(0, 50) * 60e3), region: reg, lat: lat + r.normal() * 0.15, lon: lon + r.normal() * 0.15,
      is_earthquake: !!q, label: q ? 'Earthquake' : 'Non-Earthquake', confidence: conf, magnitude: mag, alert_level: q ? alertLevel(mag) : 'None',
      fs: 100, samples: w.length, duration: w.length / 100, waveform: preview(w), source: 'demo', filename: 'demo-seed', model_mode: 'demo', sta_lta: null };
    events.push(ev);
    const a = alertFor(ev); if (a) { a.read = i > 2; alerts.push(a); }
  });
  events.sort((a, b) => b.time.localeCompare(a.time)); alerts.sort((a, b) => b.time.localeCompare(a.time));
  alerts.push({ id: 'sys0001', time: jst(now), level: 'Info', title: 'System Notification', detail: 'SeismoSense started in offline demo mode. Seed events are DEMO data.', event_id: null, read: true, sent: false });
  return { events, alerts };
}
const mem = { d: null };
function load() {
  if (mem.d) return mem.d;
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.events) && Array.isArray(d.alerts)) return (mem.d = d); } catch { /* ignore */ }
  return save(seed());
}
function save(d) { mem.d = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full / blocked: keep in memory */ } return d; }

function addEvent(values, fs, region, filename, source, notePrefix = '') {
  const res = classify(values), reg = REGIONS[region] ? region : 'Japan (unspecified)', [lat, lon] = REGIONS[reg];
  const ev = { id: 'EV' + uid(), time: jst(), region: reg, lat, lon, is_earthquake: res.quake, label: res.label, confidence: res.confidence, magnitude: res.magnitude,
    alert_level: res.quake ? alertLevel(res.magnitude) : 'None', fs, samples: values.length, duration: Math.round(values.length / fs * 100) / 100, waveform: preview(res.c),
    source, filename, model_mode: 'demo', sta_lta: res.ratio, note: notePrefix + 'Offline demo heuristic (STA/LTA) running in your browser - start the Python backend for the ML model.' };
  const d = load(); d.events.unshift(ev); const a = alertFor(ev); if (a) d.alerts.unshift(a); save(d);
  return ev;
}
function parseText(text) {
  const rows = text.split(/\r?\n/).map((l) => l.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite)).filter((r) => r.length);
  if (!rows.length) return [];
  const c0 = rows.map((r) => r[0]), rising = rows.length > 1 && rows[0].length > 1 && c0.every((v, i) => i === 0 || v > c0[i - 1]);
  return rows.map((r) => (rising ? r[1] : r[0])).filter(Number.isFinite);
}
const needBackend = (what) => { throw new Error(`${what} needs the Python backend. Start it with the START_HERE script, then press “Retry connection”.`); };

/** Mimics the FastAPI routes the UI uses. body: JSON string | FormData | undefined */
export async function handle(method, path, body) {
  const u = new URL(path, 'http://offline'), p = u.pathname, d = load(), json = () => { try { return JSON.parse(body); } catch { return null; } };
  if (method === 'GET') {
    if (p === '/api/regions') return Object.keys(REGIONS);
    if (p === '/api/events') {
      const q = (u.searchParams.get('q') || '').toLowerCase(), l = u.searchParams.get('label'), lv = u.searchParams.get('level');
      return d.events.filter((e) => (!q || `${e.region} ${e.id} ${e.magnitude} ${e.time} ${e.label}`.toLowerCase().includes(q)) && (!l || e.label.toLowerCase() === l.toLowerCase()) && (!lv || e.alert_level.toLowerCase() === lv.toLowerCase()));
    }
    if (p === '/api/alerts') return d.alerts;
    if (p === '/api/model') return { mode: 'demo', trained: false, metrics: null, features: [] };
    if (p === '/api/dataset') return [];
    if (p === '/api/stats') {
      const q = d.events.filter((e) => e.is_earthquake), mags = q.map((e) => e.magnitude).filter((m) => m != null);
      return { total: d.events.length, earthquakes: q.length, non_earthquakes: d.events.length - q.length, avg_magnitude: mags.length ? Math.round(mags.reduce((a, b) => a + b, 0) / mags.length * 10) / 10 : 0,
        demo_events: d.events.filter((e) => e.source === 'demo').length, high_alerts: d.events.filter((e) => e.alert_level === 'High').length };
    }
  }
  if (method === 'POST') {
    if (p === '/sample') {
      const b = json() || {}, quake = String(b.kind || 'earthquake').startsWith('earth');
      return addEvent(synthWave(rng(Date.now() & 0xffffffff), quake, 5000, 100, false), 100, b.region, quake ? 'sample_earthquake.csv' : 'sample_noise.csv', 'sample');
    }
    if (p === '/predict') {
      const f = body.get('file'), name = (f.name || '').toLowerCase();
      if (name.endsWith('.mseed') || name.endsWith('.miniseed')) needBackend('MSEED files');
      if (!/\.(csv|txt)$/.test(name)) throw new Error('Upload a .csv, .txt or .mseed file.');
      const vals = parseText(await f.text());
      if (vals.length < 8) throw new Error('File needs at least 8 numeric samples.');
      return addEvent(vals, Number(body.get('fs')) || 100, body.get('region'), f.name, 'upload');
    }
    if (p === '/api/alerts/read') { const ids = json(); d.alerts.forEach((a) => { if (!ids || ids.includes(a.id)) a.read = true; }); save(d); return { ok: true }; }
    if (p.startsWith('/api/alerts/send/')) {
      const a = d.alerts.find((x) => x.id === p.split('/').pop()); if (!a) throw new Error('Alert not found');
      a.sent = true; save(d); return { ...a, delivery: 'recorded locally' };
    }
    if (p === '/api/reset-demo') { save(seed()); return { ok: true }; }
    if (p === '/api/train') needBackend('Model training');
    if (p === '/api/dataset/upload') needBackend('The Japan waveform dataset');
  }
  if (method === 'DELETE') {
    if (p.startsWith('/api/events/')) {
      const id = p.split('/').pop(), n = d.events.length;
      d.events = d.events.filter((e) => e.id !== id); d.alerts = d.alerts.filter((a) => a.event_id !== id); save(d);
      if (d.events.length === n) throw new Error('Event not found');
      return { deleted: id };
    }
    if (p.startsWith('/api/dataset/')) needBackend('The Japan waveform dataset');
  }
  throw new Error(`Not available offline: ${method} ${p}`);
}
