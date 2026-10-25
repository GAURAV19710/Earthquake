import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import JapanMap from './JapanMap.jsx';
import { Bars, Curve } from './charts.jsx';
import { useApp } from './ctx.js';
import { API, ago, del as apiDel, download, eventsToCsv, fmtTime, levelClass, post } from './api.js';
import { AlertsPanel, Badge, Card, EventsTable, Hero, JapanOverview, LiveMonitor, ModelAnalytics, PredictionResult, RecentActivity, StatTiles, SystemStatus, UploadCard, WaveformPreview } from './widgets.jsx';

export function Dashboard() {
  const { go, events } = useApp();
  return (
    <div className="dash">
      <div className="rowA">
        <div className="colHero"><Hero /><StatTiles /></div>
        <RecentActivity />
        <div className="colRight"><JapanOverview /><SystemStatus /></div>
      </div>
      <div className="rowB"><UploadCard /><WaveformPreview /><PredictionResult /><AlertsPanel /></div>
      <div className="rowC">
        <LiveMonitor />
        <Card title="Earthquake Events (Japan)" action={<button className="link" onClick={() => go('Earthquake Events')}>View All</button>}><EventsTable list={events} limit={5} compact /></Card>
        <ModelAnalytics />
      </div>
    </div>
  );
}

export const UploadPage = () => {
  const { events } = useApp();
  const mine = events.filter((e) => e.source !== 'demo');
  return (
    <div className="page grid2">
      <UploadCard big /><PredictionResult /><WaveformPreview />
      <Card title="Your analyses this session">{mine.length ? <EventsTable list={mine} limit={8} /> : <div className="empty">Upload a file or use a sample to see results here.</div>}</Card>
    </div>
  );
};

export const LivePage = () => (
  <div className="page"><LiveMonitor tall /><div className="grid2"><AlertsPanel limit={5} /><Card title="How this works"><p className="mut">This view runs a <b>simulated</b> seismometer stream in your browser (noise + random events). It computes a STA/LTA trigger ratio, a filtered signal, a frequency spectrum and a spectrogram. Use “Inject test event” to see a trigger. To connect real data, replace the generator in <code>useLive()</code> with a WebSocket from a JMA/NIED relay.</p></Card></div></div>
);

export function EventsPage() {
  const { events, query, setQuery } = useApp();
  const [label, setLabel] = useState(''), [level, setLevel] = useState('');
  const list = events.filter((e) => (!label || e.label === label) && (!level || e.alert_level === level) && (!query || `${e.region} ${e.id} ${e.magnitude} ${e.time}`.toLowerCase().includes(query.toLowerCase())));
  return (
    <div className="page">
      <Card title={`Earthquake Events (${list.length})`} action={<button className="btn ghost sm" disabled={!list.length} onClick={() => download('seismosense_events.csv', eventsToCsv(list), 'text/csv')}><Icon n="download" size={13} />Export CSV</button>}>
        <div className="filters">
          <input placeholder="Search region, id, magnitude…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={label} onChange={(e) => setLabel(e.target.value)}><option value="">All predictions</option><option>Earthquake</option><option>Non-Earthquake</option></select>
          <select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All alert levels</option><option>High</option><option>Moderate</option><option>Low</option></select>
        </div>
        <EventsTable list={list} del />
      </Card>
    </div>
  );
}

export function MapPage() {
  const { events, openEvent } = useApp();
  const [lvl, setLvl] = useState('');
  const shown = events.filter((e) => !lvl || e.alert_level === lvl);
  return (
    <div className="page mappage">
      <Card title="Japan Seismic Map" action={<select value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">All levels</option><option>High</option><option>Moderate</option><option>Low</option></select>} className="bigmap">
        <JapanMap events={shown} onSelect={openEvent} />
        <div className="legend"><i style={{ background: '#ff3b4d' }} />High<i style={{ background: '#ffb020' }} />Moderate<i style={{ background: '#22d37b' }} />Low · marker size = magnitude · click a marker for details · simplified coastline</div>
      </Card>
      <RecentActivity limit={8} />
    </div>
  );
}

export function AnalyticsPage() {
  const { events, model } = useApp();
  const byMag = useMemo(() => {
    const b = { '<4': 0, '4–5': 0, '5–6': 0, '6+': 0 };
    events.filter((e) => e.is_earthquake).forEach((e) => { const m = e.magnitude; b[m < 4 ? '<4' : m < 5 ? '4–5' : m < 6 ? '5–6' : '6+']++; });
    return Object.entries(b).map(([k, v]) => ({ k, v }));
  }, [events]);
  const byRegion = useMemo(() => {
    const c = {}; events.filter((e) => e.is_earthquake).forEach((e) => { c[e.region] = (c[e.region] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ k, v }));
  }, [events]);
  const imp = model.metrics?.importance ? Object.entries(model.metrics.importance).sort((a, b) => b[1] - a[1]) : [];
  return (
    <div className="page grid2">
      <ModelAnalytics full />
      <Card title="Magnitude distribution"><Bars items={byMag} height={170} /></Card>
      <Card title="Events by region"><Bars items={byRegion} color="#7c5cff" height={170} /></Card>
      <Card title="Feature importance (Random Forest)">
        {imp.length ? imp.map(([k, v]) => <div className="imp" key={k}><span>{k}</span><div><i style={{ width: `${v * 100 / imp[0][1]}%` }} /></div><b>{(v * 100).toFixed(1)}%</b></div>) : <div className="empty">Train a model to see feature importance.</div>}
      </Card>
    </div>
  );
}

export function AlertsPage() {
  const { alerts, markRead, sendAlert, openAlert } = useApp();
  return (
    <div className="page">
      <Card title={`Alerts & Notifications (${alerts.filter((a) => !a.read).length} unread)`} action={<button className="btn ghost sm" onClick={() => markRead()}>Mark all read</button>}>
        <div className="note">Alerts are generated automatically when an Earthquake is detected. “Send Alert” records the dispatch locally — no SMS/e-mail/push provider is configured in this prototype.</div>
        {alerts.map((a) => (
          <div className={`alrow ${a.read ? '' : 'unread'}`} key={a.id} onClick={() => { markRead([a.id]); openAlert(a); }}>
            <div className={`aico ${levelClass(a.level)}`}><Icon n={a.level === 'Info' ? 'info' : 'warn'} size={18} /></div>
            <div className="at"><b>{a.title}</b><small>{a.detail}</small><small>{fmtTime(a.time)} · {ago(a.time)}</small></div>
            <div className="ar"><Badge level={a.level} />{a.event_id && <button className="btn ghost xs" disabled={a.sent} onClick={(e) => { e.stopPropagation(); sendAlert(a.id); }}>{a.sent ? 'Sent' : 'Send'}</button>}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const { events, stats, model } = useApp();
  const hi = events.filter((e) => e.alert_level === 'High').length;
  const dl = download;
  return (
    <div className="page">
      <Card title="Summary report" action={<div className="btnrow"><button className="btn ghost sm" onClick={() => dl('seismosense_events.csv', eventsToCsv(events), 'text/csv')}><Icon n="download" size={13} />CSV</button><button className="btn ghost sm" onClick={() => dl('seismosense_events.json', JSON.stringify(events.map(({ waveform, ...r }) => r), null, 2), 'application/json')}>JSON</button><button className="btn primary sm" onClick={() => window.print()}>Print / Save PDF</button></div>} className="report">
        <p className="mut">Generated {new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tokyo' })} JST · Model mode: <b>{model.mode}</b></p>
        <div className="info4">{[['Total events', stats.total], ['Earthquakes', stats.earthquakes], ['High alerts', hi], ['Avg. magnitude', stats.avg_magnitude]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
        {stats.demo_events > 0 && <div className="note warn">{stats.demo_events} of these events are DEMO seed data, not real observations.</div>}
        <EventsTable list={events} />
        <p className="mut">Research prototype — not an official earthquake warning system. Magnitudes are heuristic estimates.</p>
      </Card>
    </div>
  );
}

export function DataPage() {
  const { dataset, refresh, toast, model, offline } = useApp();
  const [label, setLabel] = useState('earthquake'), [busy, setBusy] = useState('');
  const act = async (key, fn, okMsg) => { setBusy(key); try { await fn(); toast(okMsg); await refresh(); } catch (e) { toast(e.message, true); } setBusy(''); };
  const upload = (f) => act('up', () => { const fd = new FormData(); fd.append('file', f); fd.append('label', label); return post('/api/dataset/upload', fd); }, 'File added to dataset');
  const n = (l) => dataset.filter((d) => d.label === l).length;
  return (
    <div className="page">
      {offline && <div className="note warn">Backend is offline — dataset upload and model training are disabled. Start the backend (see the banner above), then press <b>Retry connection</b>.</div>}
      <div className="grid2">
      <Card title="Japan waveform dataset">
        <div className="note">Only add waveforms you can verify are from Japan (e.g. JMA / NIED). Name = label: <code>earthquake_###.csv</code> / <code>noise_###.csv</code>. Need ≥ 4 per class to train.</div>
        <div className="info4"><div><small>Earthquake files</small><b>{n('earthquake')}</b></div><div><small>Noise files</small><b>{n('noise')}</b></div></div>
        <div className="filters"><select value={label} onChange={(e) => setLabel(e.target.value)}><option value="earthquake">Label: earthquake</option><option value="noise">Label: noise</option></select>
          <label className={`btn primary sm ${offline ? 'disabled' : ''}`}>{busy === 'up' ? 'Uploading…' : 'Add file'}<input type="file" hidden disabled={offline} accept=".csv,.txt,.mseed,.miniseed" onChange={(e) => { e.target.files[0] && upload(e.target.files[0]); e.target.value = ''; }} /></label></div>
        <div className="tablewrap short"><table><thead><tr><th>File</th><th>Label</th><th>Size</th><th /></tr></thead><tbody>
          {dataset.map((d) => <tr key={d.name}><td>{d.name}</td><td><span className={`tag ${d.label === 'earthquake' ? 'red' : 'green'}`}>{d.label}</span></td><td>{d.size_kb} KB</td><td><button className="btn ghost xs" aria-label={`Delete ${d.name}`} onClick={() => act('d' + d.name, () => apiDel(`/api/dataset/${encodeURIComponent(d.name)}`), 'Deleted')}><Icon n="trash" size={12} /></button></td></tr>)}
          {!dataset.length && <tr><td colSpan="4" className="empty">No files yet.</td></tr>}</tbody></table></div>
      </Card>
      <Card title="Train model">
        <p className="mut">Current: <b>{model.mode}</b>{model.metrics && ` · accuracy ${model.metrics.accuracy}% (${model.metrics.data_source})`}</p>
        <div className="btnrow"><button className="btn primary" disabled={!!busy || offline} onClick={() => act('tj', () => post('/api/train?source=japan'), 'Model trained on Japan dataset')}>{busy === 'tj' ? 'Training…' : 'Train on Japan dataset'}</button>
          <button className="btn ghost" disabled={!!busy || offline} onClick={() => act('ts', () => post('/api/train?source=synthetic'), 'Trained on synthetic test data')}>{busy === 'ts' ? 'Training…' : 'Train on synthetic test data'}</button></div>
        <small className="mut">Synthetic training only proves the pipeline works; its metrics say nothing about real earthquakes.</small>
        <h4>Housekeeping</h4>
        <button className="btn ghost" disabled={!!busy} onClick={() => act('rs', () => post('/api/reset-demo'), 'Demo events restored')}><Icon n="refresh" size={14} />Reset events to demo data</button>
      </Card>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { settings, setSettings, toast, regions } = useApp();
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  const notif = async (on) => { if (on && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('Browser blocked notifications', true); return; } } set('notify', on); };
  return (
    <div className="page"><Card title="Settings" className="settings">
      <label className="field">Display name<input value={settings.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label className="field">Default event region<select value={settings.region} onChange={(e) => set('region', e.target.value)}>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="field">Auto-refresh every (seconds)<select value={settings.refresh} onChange={(e) => set('refresh', +e.target.value)}>{[5, 10, 30, 60].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={settings.notify} onChange={(e) => notif(e.target.checked)} />Browser notification for new High-level alerts</label>
      <p className="mut">API: <code>{API}</code> (change with <code>VITE_API_URL</code> in <code>frontend/.env</code>)</p>
    </Card></div>
  );
}
