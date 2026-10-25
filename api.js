import { handle as offlineHandle } from './offline.js';

export const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* ---- connection state: real backend when reachable, in-browser demo fallback otherwise ---- */
let offline = false, lastFail = 0;
const listeners = new Set();
export const isOffline = () => offline;
export const onMode = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const setMode = (v) => { if (v !== offline) { offline = v; listeners.forEach((f) => f(v)); } };
export const retryConnection = () => { lastFail = 0; };

class ApiError extends Error {}

async function req(path, opts = {}) {
  const method = opts.method || 'GET';
  if (!(offline && Date.now() - lastFail < 8000)) { // while offline, probe the real backend at most every 8 s
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(API + path, { ...opts, signal: ctrl.signal });
      clearTimeout(timer); setMode(false);
      if (!r.ok) {
        let msg = r.statusText;
        try { const j = await r.json(); msg = j.detail ?? msg; } catch { /* not json */ }
        throw new ApiError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.map((m) => m.msg).join('; ') : 'Request failed');
      }
      return await r.json();
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ApiError) throw e;
      lastFail = Date.now(); setMode(true);
    }
  }
  return offlineHandle(method, path, opts.body);
}
export const get = (p) => req(p);
export const post = (p, body) => req(p, { method: 'POST', body });
export const postJson = (p, obj) => req(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
export const del = (p) => req(p, { method: 'DELETE' });

/* ---- helpers ---- */
export const fmtTime = (s) => (s || '').slice(0, 19).replace('T', ' ');
export const ago = (s) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(s)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  if (m < 1440) return `${Math.round(m / 60)} hr ago`;
  return `${Math.round(m / 1440)} d ago`;
};
export const fm = (m) => (m == null ? '—' : Number(m).toFixed(1));
export const place = (r) => (r.startsWith('Japan') ? 'Japan' : `Near ${r}, Japan`);
export const levelClass = (l) => (l || 'none').toLowerCase();

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function eventsToCsv(events) {
  const head = ['id', 'time_jst', 'region', 'lat', 'lon', 'prediction', 'confidence_pct', 'magnitude_est', 'alert_level', 'source', 'model_mode'];
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [head.join(','), ...events.map((e) => [e.id, e.time, e.region, e.lat.toFixed(3), e.lon.toFixed(3), e.label, e.confidence, e.magnitude ?? '', e.alert_level, e.source, e.model_mode].map(esc).join(','))].join('\n');
}
