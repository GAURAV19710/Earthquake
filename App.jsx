import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { AppCtx, useApp } from './ctx.js';
import { get, post, postJson, del, fm, fmtTime, onMode, retryConnection, API } from './api.js';
import { Badge } from './widgets.jsx';
import { WaveChart } from './charts.jsx';
import { AlertsPage, AnalyticsPage, DataPage, Dashboard, EventsPage, LivePage, MapPage, ReportsPage, SettingsPage, UploadPage } from './pages.jsx';
import JapanMap from './JapanMap.jsx';

const NAV = [['Dashboard', 'dash'], ['Upload & Analyze', 'upload'], ['Live Monitoring', 'live'], ['Earthquake Events', 'warn'], ['Japan Map', 'map'], ['Analytics & ML', 'chart'], ['Alert & Notifications', 'bell'], ['Reports', 'file'], ['Data Management', 'db'], ['Settings', 'sliders']];
const PAGES = { 'Dashboard': Dashboard, 'Upload & Analyze': UploadPage, 'Live Monitoring': LivePage, 'Earthquake Events': EventsPage, 'Japan Map': MapPage, 'Analytics & ML': AnalyticsPage, 'Alert & Notifications': AlertsPage, 'Reports': ReportsPage, 'Data Management': DataPage, 'Settings': SettingsPage };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const EMPTY = { events: [], alerts: [], stats: { total: 0, earthquakes: 0, non_earthquakes: 0, avg_magnitude: 0, demo_events: 0, high_alerts: 0 }, model: { mode: 'demo', trained: false, metrics: null }, dataset: [], regions: ['Japan (unspecified)'] };

function Login({ onLogin }) {
  const [n, setN] = useState('');
  const go = () => onLogin(n.trim() || 'User');
  return (
    <div className="login">
      <div className="radar" aria-hidden="true"><i /><i /><i /></div>
      <div className="card logincard">
        <div className="logo big"><Icon n="live" size={30} /><span>Seismo<b>Sense</b></span></div>
        <p className="mut">Japan seismic monitoring prototype. Demo sign-in — no password is stored or checked.</p>
        <label className="field">Your name<input autoFocus placeholder="e.g. Gaurav Kumar" value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
        <button className="btn primary lg" onClick={go}>Enter Dashboard</button>
      </div>
    </div>
  );
}

function EventModal({ ev, onClose }) {
  const { removeEvent } = useApp();
  useEffect(() => { if (!ev) return undefined; const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [ev, onClose]);
  if (!ev) return null;
  return (
    <div className="modalbg" onClick={onClose} role="presentation">
      <div className="modal card" role="dialog" aria-modal="true" aria-label="Event details" onClick={(e) => e.stopPropagation()}>
        <header><h3>{ev.is_earthquake ? `M ${fm(ev.magnitude)} · ` : ''}{ev.region}, Japan</h3><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon n="x" /></button></header>
        <WaveChart data={ev.waveform} color={ev.is_earthquake ? '#ff3b4d' : '#22d37b'} duration={Math.round(ev.duration)} height={150} />
        <div className="info4">{[['Prediction', ev.label], ['Confidence', `${ev.confidence}%`], ['Alert', ev.alert_level], ['Time (JST)', fmtTime(ev.time)], ['Duration', `${ev.duration}s`], ['Sampling', `${ev.fs} Hz`], ['Source', ev.source], ['Model', ev.model_mode]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
        {ev.is_earthquake && <div style={{ height: 220 }}><JapanMap events={[ev]} interactive={false} labels /></div>}
        <div className="btnrow"><button className="btn danger sm" onClick={() => { removeEvent(ev.id); onClose(); }}><Icon n="trash" size={13} />Delete event</button></div>
        {ev.source === 'demo' && <small className="mut">Demo seed event — illustrative, not a real observation.</small>}
      </div>
    </div>
  );
}

function OfflineBanner({ onRetry, retrying }) {
  const [help, setHelp] = useState(false);
  return (
    <div className="banner warn" role="status">
      <div className="bannerrow">
        <Icon n="server" size={16} />
        <span><b>Backend not reachable</b> — showing the built-in <b>demo mode</b> (data stays in this browser). Model training, MSEED and the dataset folder need the Python backend.</span>
        <button className="btn ghost sm" onClick={onRetry} disabled={retrying}><Icon n="refresh" size={13} />{retrying ? 'Checking…' : 'Retry connection'}</button>
        <button className="link" onClick={() => setHelp(!help)}>{help ? 'Hide help' : 'How to start it'}</button>
      </div>
      {help && (
        <ol className="helpsteps">
          <li>Easiest: close this and double-click <code>START_HERE_WINDOWS.bat</code> (Mac/Linux: <code>./START_HERE_MAC_LINUX.sh</code>). It starts both servers and waits until the backend is ready.</li>
          <li>Manual: open a terminal in the <code>backend</code> folder and run <code>python -m uvicorn app.main:app --reload</code> — keep that window open.</li>
          <li>Check <a href={`${API}/health`} target="_blank" rel="noreferrer">{API}/health</a> in a new tab — it should show <code>"status":"ok"</code>. Then press <b>Retry connection</b>.</li>
        </ol>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('ss_user'));
  const [page, setPage] = useState(() => decodeURIComponent(location.hash.slice(1)) || 'Dashboard');
  const [data, setData] = useState(EMPTY);
  const [offline, setOffline] = useState(false), [ready, setReady] = useState(false), [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false), [latestId, setLatestId] = useState(null);
  const [query, setQuery] = useState(''), [modal, setModal] = useState(null), [bell, setBell] = useState(false), [side, setSide] = useState(false), [msg, setMsg] = useState(null);
  const [settings, setSettingsState] = useState(() => load('ss_settings', { name: user || 'User', region: 'Japan (unspecified)', refresh: 10, notify: false }));
  const seenHigh = useRef(null), bellRef = useRef(null), searchRef = useRef(null), toastT = useRef(null);

  const toast = useCallback((text, bad) => { setMsg({ text, bad }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setMsg(null), 4000); }, []);
  const setSettings = (s) => { setSettingsState(s); localStorage.setItem('ss_settings', JSON.stringify(s)); };
  const go = (p) => { setPage(p); location.hash = encodeURIComponent(p); setSide(false); setBell(false); window.scrollTo(0, 0); };

  const refresh = useCallback(async () => {
    try {
      const [events, alerts, stats, model, dataset] = await Promise.all([get('/api/events'), get('/api/alerts'), get('/api/stats'), get('/api/model'), get('/api/dataset')]);
      setData((d) => ({ ...d, events, alerts, stats, model, dataset }));
    } catch (e) { toast(e.message, true); }
    setReady(true);
  }, [toast]);
  const retry = async () => { setSyncing(true); retryConnection(); await Promise.all([refresh(), get('/api/regions').then((regions) => setData((d) => ({ ...d, regions }))).catch(() => {})]); setSyncing(false); };

  useEffect(() => onMode(setOffline), []);
  useEffect(() => { get('/api/regions').then((regions) => setData((d) => ({ ...d, regions }))).catch(() => {}); }, [offline]);
  useEffect(() => { refresh(); const i = setInterval(refresh, settings.refresh * 1000); return () => clearInterval(i); }, [refresh, settings.refresh]);
  useEffect(() => { const h = () => setPage(decodeURIComponent(location.hash.slice(1)) || 'Dashboard'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { // close bell on outside click / Esc, "/" focuses search
    const down = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBell(false); };
    const key = (e) => {
      if (e.key === 'Escape') { setBell(false); setSide(false); }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener('mousedown', down); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); };
  }, []);

  const unread = data.alerts.filter((a) => !a.read).length;
  useEffect(() => { document.title = `${unread ? `(${unread}) ` : ''}SeismoSense | Japan Seismic Monitor`; }, [unread]);

  useEffect(() => { // browser notification for newly arrived High alerts
    const high = data.alerts.find((a) => a.level === 'High' && a.event_id);
    if (!high) return;
    if (seenHigh.current && seenHigh.current !== high.id && settings.notify && 'Notification' in window && Notification.permission === 'granted') new Notification('SeismoSense: ' + high.title, { body: high.detail });
    seenHigh.current = high.id;
  }, [data.alerts, settings.notify]);

  const analyze = async ({ file, sample, region, fs }) => {
    setBusy(true);
    try {
      let ev;
      if (file) { const fd = new FormData(); fd.append('file', file); fd.append('region', region); fd.append('fs', fs || 100); ev = await post('/predict', fd); } else ev = await postJson('/sample', { kind: sample, region });
      setLatestId(ev.id); await refresh();
      toast(`${ev.label} · ${ev.confidence}% confidence`);
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };
  const removeEvent = async (id) => { try { await del(`/api/events/${id}`); await refresh(); toast('Event deleted'); } catch (e) { toast(e.message, true); } };
  const markRead = async (ids) => { try { await postJson('/api/alerts/read', ids ?? null); await refresh(); } catch { /* ignore */ } };
  const sendAlert = async (id) => { try { await post(`/api/alerts/send/${id}`); await refresh(); toast('Alert recorded as sent (no SMS/push provider configured)'); } catch (e) { toast(e.message, true); } };

  const latest = useMemo(() => data.events.find((e) => e.id === latestId) || data.events[0] || null, [data.events, latestId]);
  const latestQuake = useMemo(() => data.events.find((e) => e.is_earthquake) || null, [data.events]);
  const closeModal = useCallback(() => setModal(null), []);
  const ctx = { ...data, online: !offline, offline, ready, busy, analyze, latest, latestQuake, go, query, setQuery, settings, setSettings, toast, refresh, removeEvent, markRead, sendAlert,
    openEvent: setModal, openAlert: (a) => { const e = data.events.find((x) => x.id === a.event_id); if (e) setModal(e); } };

  if (!user) return <Login onLogin={(n) => { localStorage.setItem('ss_user', n); setUser(n); setSettings({ ...settings, name: n }); }} />;
  const Page = PAGES[page] || Dashboard, initials = (settings.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`shell ${side ? 'open' : ''}`}>
        {(busy || syncing) && <div className="progress" aria-hidden="true"><i /></div>}
        {side && <div className="scrim" onClick={() => setSide(false)} aria-hidden="true" />}
        <aside className="sidebar">
          <div className="logo"><Icon n="live" size={28} /><span>Seismo<b>Sense</b></span></div>
          <nav aria-label="Main">{NAV.map(([n, i]) => <button key={n} className={page === n ? 'on' : ''} aria-current={page === n ? 'page' : undefined} onClick={() => go(n)}><Icon n={i} />{n}{n === 'Alert & Notifications' && unread > 0 && <em>{unread}</em>}</button>)}
            <button className="logout" onClick={() => { localStorage.removeItem('ss_user'); setUser(null); }}><Icon n="logout" />Logout</button></nav>
          <div className="sidemap" onClick={() => go('Japan Map')} role="button" aria-label="Open Japan map"><JapanMap events={data.events} labels={false} interactive={false} /></div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button className="iconbtn menu" aria-label="Menu" onClick={() => setSide(!side)}><Icon n="menu" /></button>
            <div className="search"><Icon n="search" size={16} /><input ref={searchRef} aria-label="Search events" placeholder="Search events, locations, magnitude…  ( / )" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go('Earthquake Events')} /></div>
            <div className="spacer" />
            <button className={`conn ${offline ? 'off' : 'on'}`} onClick={retry} title={offline ? 'Backend not reachable — click to retry' : 'Connected to the Python backend'}><i />{offline ? 'Demo mode' : 'API connected'}</button>
            <div className="bellwrap" ref={bellRef}><button className="iconbtn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setBell(!bell)}><Icon n="bell" />{unread > 0 && <em>{unread}</em>}</button>
              {bell && <div className="dropdown">{data.alerts.slice(0, 5).map((a) => <div key={a.id} className="ddrow" onClick={() => { setBell(false); go('Alert & Notifications'); }}><Badge level={a.level} /><div><b>{a.title}</b><small>{a.detail}</small></div></div>)}{!data.alerts.length && <div className="empty">No alerts yet.</div>}<button className="link" onClick={() => { setBell(false); markRead(); }}>Mark all read</button></div>}</div>
            <button className="iconbtn" aria-label="Settings" onClick={() => go('Settings')}><Icon n="sliders" /></button>
            <div className="user"><div className="avatar">{initials}</div><div><b>{settings.name}</b><small>Admin</small></div></div>
          </header>
          {offline && <OfflineBanner onRetry={retry} retrying={syncing} />}
          {!offline && data.stats.demo_events > 0 && page === 'Dashboard' && <div className="banner info">Events marked “demo” are illustrative seed data. Upload a waveform or use a sample to add real analyses.</div>}
          <main><div key={page} className="pagefade"><Page /></div></main>
        </div>
        <EventModal ev={modal} onClose={closeModal} />
        {msg && <div className={`toast ${msg.bad ? 'bad' : ''}`} role="status"><Icon n={msg.bad ? 'warn' : 'check'} size={16} />{msg.text}</div>}
      </div>
    </AppCtx.Provider>
  );
}
