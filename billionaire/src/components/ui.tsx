import { useEffect, useState, type ReactNode } from 'react';
import type { Money as M } from '../types/core';
import { money } from '../utils/format';
import { Icon } from './icons';

export function Panel({ title, actions, children, tight, className = '', style }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`panel ${className}`} style={style}>
      {(title || actions) && (
        <div className="panel-h">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`panel-b ${tight ? 'tight' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, large }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' | 'gold'; large?: boolean }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={`value ${large ? 'lg' : ''} ${tone ?? ''}`}>{value}</span>
      {sub !== undefined && <span className="sub">{sub}</span>}
    </div>
  );
}

/** Money with sign coloring. */
export function Money({ v, sign, colored = true, full }: { v: M; sign?: boolean; colored?: boolean; full?: boolean }) {
  const cls = colored ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
  return <span className={`num ${cls}`}>{money(v, { sign, compact: !full })}</span>;
}

export function Progress({ ratio, tone }: { ratio: number; tone?: 'pos' | 'neg' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

export function Difficulty({ level, underground }: { level: number; underground?: boolean }) {
  return (
    <span className={`diff ${underground ? 'under' : ''}`} title={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= level ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Notice({ kind, children }: { kind?: 'warn' | 'neg' | 'future'; children: ReactNode }) {
  return (
    <div className={`notice ${kind ?? ''}`}>
      {kind === 'warn' || kind === 'neg' ? <Icon.alert /> : kind === 'future' ? <Icon.clock /> : <Icon.info />}
      <div>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'wide' | 'narrow' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ''}`} role="dialog">
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

/** A dollar amount input. Value is in cents. */
export function MoneyInput({ value, onChange, max, placeholder }: { value: M; onChange: (v: M) => void; max?: M; placeholder?: string }) {
  const [text, setText] = useState(value ? String(Math.round(value / 100)) : '');
  useEffect(() => {
    const cur = text === '' ? 0 : Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
    if (cur !== value) setText(value ? String(Math.round(value / 100)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="row" style={{ gap: 6 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <span className="dim" style={{ position: 'absolute', left: 10, top: 8 }}>
          $
        </span>
        <input
          className="input num"
          style={{ paddingLeft: 22 }}
          inputMode="numeric"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9]/g, '');
            setText(t);
            onChange(t === '' ? 0 : Number(t) * 100);
          }}
        />
      </div>
      {max !== undefined && max > 0 && (
        <button className="btn sm ghost" onClick={() => onChange(Math.floor(max / 100) * 100)}>
          Max
        </button>
      )}
    </div>
  );
}

export function initials(name: string): string {
  return name
    .replace(/["']/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#c8a35a', '#7ea6c9', '#7fb68b', '#c97b63', '#a08ac2', '#c9a0b4', '#8fc1b5', '#d9a066'];
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (
    <div className="avatar" style={{ width: size, height: size, background: AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length], fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

export function SkillBar({ value, label }: { value: number; label?: string }) {
  const tone = value >= 70 ? 'pos' : value < 35 ? 'neg' : undefined;
  return (
    <div className="row" style={{ gap: 8 }}>
      {label && <span className="small muted" style={{ width: 72 }}>{label}</span>}
      <div className="grow">
        <Progress ratio={value / 100} tone={tone} />
      </div>
      <span className="num small" style={{ width: 24, textAlign: 'right' }}>
        {Math.round(value)}
      </span>
    </div>
  );
}
