import React from 'react';

const P = {
  dash: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18 M12 12v7 M9 15l3-3 3 3',
  live: 'M3 12h4l3-8 4 16 3-8h4',
  warn: 'M12 3l10 18H2z M12 10v5 M12 18v.01',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',
  chart: 'M3 3v18h18 M7 15l4-4 3 3 5-6',
  bell: 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9 M10 21h4',
  file: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6',
  db: 'M4 6c0-2 16-2 16 0s-16 2-16 0 M4 6v6c0 2 16 2 16 0V6 M4 12v6c0 2 16 2 16 0v-6',
  sliders: 'M4 6h16 M4 12h16 M4 18h16 M9 4v4 M15 10v4 M8 16v4',
  logout: 'M9 4H4v16h5 M16 8l4 4-4 4 M20 12H9',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14 M21 21l-5-5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  check: 'M5 12l5 5 9-10',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
  pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z M12 11a2 2 0 100-4 2 2 0 000 4',
  x: 'M6 6l12 12 M18 6L6 18',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 4v16 M16 4v16',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  refresh: 'M20 11a8 8 0 10-2 6 M20 4v7h-7',
  server: 'M4 5h16v6H4z M4 13h16v6H4z M8 8h.01 M8 16h.01',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18 M12 11v6 M12 7.5v.01',
  temp: 'M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
};

export default function Icon({ n, size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {(P[n] || '').split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}
    </svg>
  );
}
