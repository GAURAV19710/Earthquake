import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import JapanMap from './JapanMap.jsx';
import { WaveChart, SpectrumChart, Spectrogram, Confusion, Curve, dft } from './charts.jsx';
import { useApp } from './ctx.js';
import { ago, fm, fmtTime, levelClass, place } from './api.js';

export const Badge = ({ level }) => <span className={`badge ${levelClass(level)}`}>{level === 'None' ? '—' : level}</span>;
export const Card = ({ title, action, children, className = '', live }) => (
  <section className={`card ${className}`}>
    {(title || action) && <header><h3>{title}</h3>{live && <span className="livepill"><i />Live</span>}{action}</header>}
    {children}
  </section>
);
const Tag = ({ children }) => <span className="demotag">{children}</span>;

/* ---------- Hero ---------- */
export function Hero() {
  const { events, go, latestQuake } = useApp();
  return (
    <div className="hero">
      <JapanMap events={events} labels className="herobg" interactive={false} />
      <div className="herotxt">
        <span className="chip">Real-time Monitoring</span>
        <h1>Seismo<b>Sense</b></h1>
        <p className="sub">A Machine Learning Framework for<br />Seismic Event Detection and Early Warning<br />(Using Japan Earthquake Data)</p>
        <ul className="ticks">
          {['Real-time detection and alerts', 'Machine learning based classification', 'Interactive Japan map visualization', 'Seismic waveform analysis', 'High accuracy and early warning'].map((t) => <li key={t}><Icon n="check" size={13} />{t}</li>)}
        </ul>
        <div className="btnrow"><button className="btn primary" onClick={() => go('Live Monitoring')}>View Live Dashboard</button><button className="btn ghost" onClick={() => go('Upload & Analyze')}>Upload Seismic Data</button></div>
      </div>
      {latestQuake && <div className="callout"><b>M {fm(latestQuake.magnitude)}</b><span>{place(latestQuake.region)}</span><small>{fmtTime(latestQuake.time)}</small></div>}
    </div>
  );
}

function useCount(v, ms = 700) {
  const target = Number(v) || 0, [x, setX] = useState(target), from = useRef(target);
  useEffect(() => {
    const a = from.current;
    if (a === target) { setX(target); return undefined; }
    const t0 = performance.now(); let raf;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); setX(a + (target - a) * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return x;
}
function Tile({ label, value, icon, color, dec = 0 }) {
  const x = useCount(value);
  return <div className={`tile ${color}`}><div className="ti"><Icon n={icon} size={22} /></div><div><small>{label}</small><b>{dec ? x.toFixed(dec) : Math.round(x)}</b></div></div>;
}
export function StatTiles() {
  const { stats } = useApp();
  return (
    <div className="tiles">
      <Tile label="Total Events" value={stats.total} icon="live" color="blue" />
      <Tile label="Earthquakes" value={stats.earthquakes} icon="warn" color="red" />
      <Tile label="Non-Earthquakes" value={stats.non_earthquakes} icon="shield" color="green" />
      <Tile label="Avg. Magnitude" value={stats.avg_magnitude} icon="pin" color="violet" dec={1} />
    </div>
  );
}

/* ---------- Recent activity ---------- */
export function RecentActivity({ limit = 5 }) {
  const { events, go, openEvent } = useApp();
  const list = events.filter((e) => e.is_earthquake).slice(0, limit);
  return (
    <Card title="Recent Earthquake Activity" action={<button className="link" onClick={() => go('Earthquake Events')}>View All</button>} className="recent">
      {list.length === 0 && <div className="empty">No earthquake events yet.</div>}
      {list.map((e) => (
        <div className="recrow" key={e.id} onClick={() => openEvent(e)}>
          <div className={`mag ${levelClass(e.alert_level)}`}>{fm(e.magnitude)}</div>
          <div className="rt"><b>{place(e.region)}</b><small>{fmtTime(e.time)}</small></div>
          <Badge level={e.alert_level} />
        </div>
      ))}
    </Card>
  );
}

/* ---------- Japan overview + system status ---------- */
export function JapanOverview() {
  const [now, setNow] = useState(new Date());
  const [wx, setWx] = useState(null);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,weather_code')
      .then((r) => r.json()).then((d) => setWx({ t: Math.round(d.current.temperature_2m), c: d.current.weather_code })).catch(() => setWx(null));
  }, []);
  const cond = wx ? (wx.c === 0 ? 'Clear' : wx.c < 4 ? 'Cloudy' : wx.c < 70 ? 'Rain' : 'Snow/Storm') : '—';
  const tz = { timeZone: 'Asia/Tokyo' };
  return (
    <Card title="Japan Overview" live className="overview">
      <div className="scene"><svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#233b66" /><stop offset="1" stopColor="#d99ab0" /></linearGradient></defs><rect width="300" height="120" fill="url(#sky)" /><path d="M20 120L120 40l12-4 12 4 112 80z" fill="#35507c" /><path d="M108 48l24-12 24 12-12 6-8-6-8 6-8-6z" fill="#f2f6ff" /><g fill="#f7b6cf" opacity=".85">{[[20, 20], [60, 70], [250, 25], [270, 80], [200, 60], [40, 95]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" />)}</g></svg>
        <div className="clock"><b>{now.toLocaleTimeString('en-GB', tz)}</b><small>{now.toLocaleDateString('en-US', { ...tz, month: 'short', day: 'numeric', year: 'numeric' })} (JST)</small></div></div>
      <div className="wxrow"><div><small>Temperature</small><b><Icon n="temp" size={14} /> {wx ? `${wx.t}°C` : '—'}</b></div><div><small>Weather</small><b><Icon n="sun" size={14} /> {cond}</b></div><div><small>Location</small><b><Icon n="pin" size={14} /> Tokyo</b></div></div>
    </Card>
  );
}

export function SystemStatus() {
  const { offline, model } = useApp();
  const rows = offline
    ? [['Data Feed', 'Demo'], ['ML Model', 'Demo'], ['Alert System', 'Demo'], ['Database', 'Local']]
    : [['Data Feed', 'Active'], ['ML Model', model.trained ? 'Active' : 'Demo'], ['Alert System', 'Active'], ['Database', 'Active']];
  const ok = rows.every(([, st]) => st === 'Active');
  return (
    <Card title="System Status" action={<span className={`pill ${ok ? 'ok' : 'warn'}`}>{ok ? 'All Systems Operational' : offline ? 'Demo mode · no backend' : 'Model not trained'}</span>} className="sysstatus">
      {rows.map(([n, st], i) => <div className="srow" key={n}><Icon n={['live', 'bolt', 'bell', 'db'][i]} size={14} /><span>{n}</span><b className={st === 'Active' ? 'g' : 'a'}>● {st}</b></div>)}
    </Card>
  );
}

/* ---------- Upload card ---------- */
export function UploadCard({ big }) {
  const { analyze, busy, regions, settings } = useApp();
  const [region, setRegion] = useState(settings.region);
  const [drag, setDrag] = useState(false), [fs, setFs] = useState(100), [name, setName] = useState('');
  const inp = useRef();
  const run = (f) => { if (!f) return; setName(f.name); analyze({ file: f, region, fs }); };
  return (
    <Card title="Upload & Analyze Seismic Data" className={`upload ${big ? 'big' : ''}`}>
      <div className={`drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); run(e.dataTransfer.files[0]); }}>
        <Icon n="cloud" size={40} />
        <p>Drag & drop your seismic data file here<br /><small>(CSV, MSEED, TXT)</small></p>
        <input ref={inp} type="file" hidden accept=".csv,.txt,.mseed,.miniseed" onChange={(e) => { run(e.target.files[0]); e.target.value = ''; }} />
        <button className="btn primary" disabled={busy} onClick={() => inp.current.click()}>{busy ? 'Analyzing…' : 'Choose File'}</button>
        {name && <small className="fname">Last file: {name}</small>}
        <small className="mut">Supported: .csv, .mseed, .txt — numeric samples in first column (Use Japan seismic data)</small>
      </div>
      <div className="twocol"><label className="field">Event region (Japan)<select value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="field">Sampling rate (Hz, CSV/TXT)<input type="number" min="1" max="1000" value={fs} onChange={(e) => setFs(Math.max(1, +e.target.value || 100))} /></label></div>
      <h4>Sample Data</h4>
      <div className="btnrow two"><button className="btn blue" disabled={busy} onClick={() => analyze({ sample: 'earthquake', region })}>Use Sample Earthquake Data</button><button className="btn ghost" disabled={busy} onClick={() => analyze({ sample: 'noise', region })}>Use Sample Noise Data (Non-Earthquake)</button></div>
      <small className="mut">Samples are generated synthetic waveforms for testing the pipeline.</small>
    </Card>
  );
}

export function WaveformPreview() {
  const { latest } = useApp();
  if (!latest) return <Card title="Waveform Preview"><div className="empty">Analyze a file to see its waveform.</div></Card>;
  return (
    <Card title="Waveform Preview" className="wfprev" action={<span className="rec"><i />{latest.source === 'demo' ? 'Demo' : 'Latest'}</span>}>
      <WaveChart data={latest.waveform} duration={Math.round(latest.duration)} height={150} />
      <div className="axislabel">Time (seconds)</div>
      <h4>Signal Information</h4>
      <div className="info4">{[['Duration', `${latest.duration} s`], ['Sampling Rate', `${latest.fs} Hz`], ['Data Points', latest.samples], ['Format', (latest.source === 'demo' ? 'csv' : latest.filename.split('.').pop() || 'csv').toUpperCase()]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
    </Card>
  );
}

export function PredictionResult() {
  const { latest, go, alerts, sendAlert } = useApp();
  if (!latest) return <Card title="Prediction Result"><div className="empty">No prediction yet.</div></Card>;
  const q = latest.is_earthquake, alert = alerts.find((a) => a.event_id === latest.id);
  return (
    <Card title="Prediction Result" className="pred">
      <div className={`verdict ${q ? 'yes' : 'no'}`}><Icon n={q ? 'check' : 'shield'} size={26} /><div><b>{q ? 'Earthquake Detected' : 'No Earthquake Detected'}</b><small>The seismic waveform is classified as {q ? 'an Earthquake' : 'Non-Earthquake (noise)'}.</small></div></div>
      <div className="predgrid">
        <div className="mini"><h5>Event Details</h5>
          {[['Prediction', latest.label], ['Confidence', `${latest.confidence}%`], ['Magnitude (Est.)', fm(latest.magnitude)], ['Location', `${latest.region} (Est.)`], ['Time', fmtTime(latest.time).slice(5)], ['Model', latest.model_mode]].map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b className={k === 'Prediction' ? (q ? 'r' : 'g') : ''}>{v}</b></div>)}</div>
        <div className="mini"><h5>Waveform</h5><WaveChart data={latest.waveform} color={q ? '#ff3b4d' : '#22d37b'} height={92} duration={Math.round(latest.duration)} /></div>
      </div>
      {q && <div className={`alertbar ${levelClass(latest.alert_level)}`}><Icon n="warn" size={22} /><div><b>Alert Level: {latest.alert_level}</b><small>Magnitude is an indicative heuristic estimate.</small></div>{alert && <button className="btn danger sm" disabled={alert.sent} onClick={() => sendAlert(alert.id)}><Icon n="send" size={13} />{alert.sent ? 'Sent' : 'Send Alert'}</button>}</div>}
      <div className="btnrow three"><button className="btn blue sm" onClick={() => go('Japan Map')}>View on Map</button><a className="btn ghost sm" href={`data:application/json,${encodeURIComponent(JSON.stringify({ ...latest, waveform: undefined }, null, 2))}`} download={`${latest.id}.json`}>Download Result</a><button className="btn ghost sm" onClick={() => go('Upload & Analyze')}>Analyze Another File</button></div>
      <small className="mut">{latest.note || (latest.source === 'demo' ? 'Demo seed event.' : '')}</small>
    </Card>
  );
}

export function AlertsPanel({ limit = 4 }) {
  const { alerts, go, openAlert } = useApp();
  return (
    <Card title="Real-time Alerts" action={<button className="link" onClick={() => go('Alert & Notifications')}>View All</button>} className="alerts">
      {alerts.slice(0, limit).map((a) => (
        <div className="alrow" key={a.id} onClick={() => openAlert(a)}>
          <div className={`aico ${levelClass(a.level)}`}><Icon n={a.level === 'Info' ? 'info' : 'warn'} size={18} /></div>
          <div className="at"><b>{a.title}</b><small>{a.detail}</small><small>{fmtTime(a.time)}</small></div>
          <div className="ar"><Badge level={a.level} /><small>{ago(a.time)}</small></div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- Live simulation ---------- */
const N = 400;
export function useLive(running) {
  const st = useRef({ raw: Array(N).fill(0), age: -1, amp: 0, t: 0 });
  const [view, setView] = useState({ raw: st.current.raw, flt: st.current.raw, spec: null, ratio: 1, ev: 0 });
  const [ev, setEv] = useState(0);
  const inject = () => { st.current.age = 0; st.current.amp = 1.2 + Math.random() * 1.5; };
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const s = st.current;
      for (let k = 0; k < 5; k++) {
        s.t++;
        const g = (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;
        let v = g + 0.06 * Math.sin(s.t * 0.03);
        if (s.age < 0 && Math.random() < 0.0003) { s.age = 0; s.amp = 0.8 + Math.random() * 2; setEv((n) => n + 1); }
        if (s.age >= 0) { v += s.amp * Math.exp(-s.age / 70) * Math.sin(s.age * 0.8) * Math.min(1, s.age / 5); s.age++; if (s.age > 400) s.age = -1; }
        s.raw.push(v);
      }
      s.raw = s.raw.slice(-N);
      const r = s.raw, ma = (i, w) => { let a = 0, c = 0; for (let j = Math.max(0, i - w); j <= i; j++) { a += r[j]; c++; } return a / c; };
      const flt = r.map((v, i) => v - ma(i, 20));
      const e = (a, b) => { let x = 0; for (let i = a; i < b; i++) x += r[i] * r[i]; return x / (b - a); };
      const ratio = e(N - 10, N) / (e(N - 210, N - 10) + 1e-9);
      setView({ raw: r, flt, spec: dft(flt.slice(-128)).slice(0, 64), ratio });
    }, 100);
    return () => clearInterval(id);
  }, [running]);
  return { ...view, ev, inject };
}

export function LiveMonitor({ tall }) {
  const [tab, setTab] = useState('Real-time Waveform');
  const [run, setRun] = useState(true);
  const live = useLive(run);
  const h = tall ? 240 : 150, trig = live.ratio > 4;
  return (
    <Card title="Live Monitoring Dashboard" live={run} className="livemon" action={tall && <div className="btnrow"><button className="btn ghost sm" onClick={() => setRun(!run)}><Icon n={run ? 'pause' : 'play'} size={13} />{run ? 'Pause' : 'Resume'}</button><button className="btn danger sm" onClick={live.inject}><Icon n="bolt" size={13} />Inject test event</button></div>}>
      <div className="tabs">{['Real-time Waveform', 'Frequency Spectrum', 'Spectrogram'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Real-time Waveform' && <><div className="legend right"><i style={{ background: '#1e90ff' }} />Raw Signal<i style={{ background: '#ff3b4d' }} />Filtered Signal</div><WaveChart data={live.raw} second={live.flt} height={h} duration={100} fill={false} /></>}
      {tab === 'Frequency Spectrum' && (live.spec ? <SpectrumChart data={live.spec} height={h} /> : <div className="empty">Waiting for signal…</div>)}
      {tab === 'Spectrogram' && <Spectrogram spec={live.spec} height={h} />}
      <div className="livestat"><span>STA/LTA <b className={trig ? 'r' : 'g'}>{live.ratio.toFixed(1)}</b></span><span className={`pill ${trig ? 'warn' : 'ok'}`}>{trig ? 'TRIGGER' : 'Quiet'}</span><small>Simulated feed · no live JMA/NIED connection</small></div>
    </Card>
  );
}

/* ---------- Events table ---------- */
export function EventsTable({ list, limit, del = false, compact = false }) {
  const { openEvent, removeEvent } = useApp();
  const [sort, setSort] = useState({ k: 'time', dir: -1 });
  const sorted = [...list].sort((a, b) => {
    const x = a[sort.k] ?? -Infinity, y = b[sort.k] ?? -Infinity;
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  const rows = limit ? sorted.slice(0, limit) : sorted;
  const th = (k, label) => <th aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}><button className="thbtn" onClick={() => setSort((s0) => ({ k, dir: s0.k === k ? -s0.dir : -1 }))}>{label}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>;
  return (
    <div className={`tablewrap ${compact ? 'compact' : ''}`}>
      <table>
        <thead><tr><th>#</th>{th('time', 'Date & Time (JST)')}{th('magnitude', 'Magnitude')}{th('region', 'Location')}<th>Prediction</th>{th('confidence', 'Confidence')}<th>Alert Level</th>{!compact && <th>Action</th>}</tr></thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.id} className={compact ? 'clickable' : ''} onClick={compact ? () => openEvent(e) : undefined}>
              <td>{i + 1}</td><td>{compact ? fmtTime(e.time).slice(5, 16) : fmtTime(e.time)}</td><td>{fm(e.magnitude)}</td><td>{e.region}</td>
              <td><span className={`tag ${e.is_earthquake ? 'red' : 'green'}`}>{e.label}</span></td><td>{e.confidence}%</td><td><Badge level={e.alert_level} /></td>
              {!compact && <td className="acts"><button className="btn ghost xs" onClick={() => openEvent(e)}>View</button>{del && <button className="btn ghost xs" aria-label="Delete event" onClick={() => removeEvent(e.id)}><Icon n="trash" size={12} /></button>}</td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="8" className="empty">No events match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Model analytics ---------- */
export function ModelAnalytics({ full }) {
  const { model, go } = useApp();
  const m = model.metrics;
  const tiles = m ? [['Accuracy', m.accuracy], ['Precision', m.precision], ['Recall', m.recall], ['F1-Score', m.f1]] : null;
  return (
    <Card title="Model Analytics" className="modelan" action={<button className="link" onClick={() => go('Analytics & ML')}>View Details</button>}>
      {!m && <div className="note">No trained model yet — metrics are not measured. Open <b>Data Management</b> to train (a synthetic test run takes seconds).</div>}
      {m && m.data_source === 'synthetic' && <div className="note warn">Trained on SYNTHETIC data — pipeline test only, not real performance.</div>}
      {tiles && <div className="info4">{tiles.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}%</b></div>)}</div>}
      {m && <div className="twocol"><div><h4>Confusion Matrix</h4><Confusion cm={m.confusion} /></div><div><h4>Learning Curve</h4><Curve curve={m.curve} height={full ? 170 : 110} /></div></div>}
      {m && <small className="mut">Hold-out test: {m.n_test} files · trained on {m.n_train}.</small>}
    </Card>
  );
}
