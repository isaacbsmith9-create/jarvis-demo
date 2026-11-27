import type { ReactElement, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (children: ReactElement | ReactElement[], props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);

export const Icon = {
  dashboard: (p: P = {}) => base([<rect key="a" x="3" y="3" width="7.5" height="9" />, <rect key="b" x="13.5" y="3" width="7.5" height="5" />, <rect key="c" x="13.5" y="11" width="7.5" height="10" />, <rect key="d" x="3" y="15" width="7.5" height="6" />], p),
  city: (p: P = {}) => base([<path key="a" d="M3 21h18" />, <path key="b" d="M5 21V9l5-3v15" />, <path key="c" d="M10 21V3l6 3v15" />, <path key="d" d="M16 21v-9l3 1.5V21" />, <path key="e" d="M12.5 8h1M12.5 11h1M12.5 14h1M7 12h1M7 15h1" />], p),
  company: (p: P = {}) => base([<rect key="a" x="3" y="7" width="18" height="13" />, <path key="b" d="M8 7V4h8v3" />, <path key="c" d="M3 12h18" />, <path key="d" d="M11 12v2h2v-2" />], p),
  property: (p: P = {}) => base([<path key="a" d="M3 11l9-7 9 7" />, <path key="b" d="M5 9.5V20h14V9.5" />, <path key="c" d="M10 20v-6h4v6" />], p),
  staff: (p: P = {}) => base([<circle key="a" cx="9" cy="8" r="3.2" />, <path key="b" d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />, <circle key="c" cx="17" cy="9" r="2.5" />, <path key="d" d="M16 14.2c2.8.3 5 2.7 5 5.8" />], p),
  finance: (p: P = {}) => base([<path key="a" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />], p),
  market: (p: P = {}) => base([<path key="a" d="M3 17l5-5 4 4 8-9" />, <path key="b" d="M15 7h5v5" />], p),
  news: (p: P = {}) => base([<rect key="a" x="3" y="4" width="15" height="16" />, <path key="b" d="M18 8h3v10a2 2 0 0 1-2 2" />, <path key="c" d="M6.5 8h8M6.5 12h8M6.5 16h5" />], p),
  org: (p: P = {}) => base([<path key="a" d="M12 3l8 3.5v5c0 4.8-3.4 8.3-8 9.5-4.6-1.2-8-4.7-8-9.5v-5z" />, <path key="b" d="M9 12l2 2 4-4" />], p),
  profile: (p: P = {}) => base([<circle key="a" cx="12" cy="8" r="4" />, <path key="b" d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />], p),
  save: (p: P = {}) => base([<path key="a" d="M5 3h11l3 3v15H5z" />, <path key="b" d="M8 3v5h7V3" />, <rect key="c" x="8" y="13" width="8" height="6" />], p),
  pause: (p: P = {}) => base([<path key="a" d="M8 5v14M16 5v14" />], { strokeWidth: 2.2, ...p }),
  play: (p: P = {}) => base([<path key="a" d="M7 4.5v15L19 12z" fill="currentColor" />], p),
  fast: (p: P = {}) => base([<path key="a" d="M3 5v14l8-7zM12 5v14l8-7z" fill="currentColor" />], p),
  faster: (p: P = {}) => base([<path key="a" d="M2 6v12l6-6zM9 6v12l6-6zM16 6v12l6-6z" fill="currentColor" />], p),
  step: (p: P = {}) => base([<path key="a" d="M5 5v14l9-7z" fill="currentColor" />, <path key="b" d="M18 5v14" strokeWidth={2.2} />], p),
  info: (p: P = {}) => base([<circle key="a" cx="12" cy="12" r="9" />, <path key="b" d="M12 11v5M12 8h.01" />], p),
  alert: (p: P = {}) => base([<path key="a" d="M12 3l9.5 17h-19z" />, <path key="b" d="M12 10v4M12 17h.01" />], p),
  clock: (p: P = {}) => base([<circle key="a" cx="12" cy="12" r="9" />, <path key="b" d="M12 7v5l3 2" />], p),
  plus: (p: P = {}) => base([<path key="a" d="M12 5v14M5 12h14" />], p),
  pin: (p: P = {}) => base([<path key="a" d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />, <circle key="b" cx="12" cy="10" r="2" />], p),
  door: (p: P = {}) => base([<path key="a" d="M5 21V3h11v18" />, <path key="b" d="M16 5h3v16H3" />, <path key="c" d="M12.5 12h.01" />], p),
  menu: (p: P = {}) => base([<path key="a" d="M4 7h16M4 12h16M4 17h16" />], p),
};
