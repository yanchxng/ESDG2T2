import React from 'react'

// ─── BUTTON ─────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
    borderRadius: 8, fontFamily: 'Inter, sans-serif', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
    opacity: disabled ? 0.45 : 1,
    padding: size === 'sm' ? '6px 12px' : '9px 18px',
    fontSize: size === 'sm' ? 12 : 13,
  }
  const variants = {
    primary:   { background: '#0ea5e9', color: '#fff' },
    secondary: { background: '#fff', color: '#374151', border: '1px solid #e5e7eb' },
    danger:    { background: '#ef4444', color: '#fff' },
    ghost:     { background: 'transparent', color: '#0ea5e9', padding: size === 'sm' ? '6px 10px' : '9px 14px' },
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => {
        if (disabled) return
        if (variant === 'primary')   e.currentTarget.style.background = '#0284c7'
        if (variant === 'secondary') e.currentTarget.style.background = '#f9fafb'
        if (variant === 'danger')    e.currentTarget.style.background = '#dc2626'
        if (variant === 'ghost')     e.currentTarget.style.background = '#e0f2fe'
      }}
      onMouseLeave={e => {
        if (disabled) return
        Object.assign(e.currentTarget.style, variants[variant])
      }}
    >
      {children}
    </button>
  )
}

// ─── INPUT ──────────────────────────────────────────────────
export function Input({ label, id, readOnly, mono, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>}
      <input id={id} readOnly={readOnly} {...props} style={{
        width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
        fontSize: 13, color: readOnly ? '#6b7280' : '#111827',
        background: readOnly ? '#f0f4f8' : '#fff', outline: 'none', transition: 'border-color 0.12s, box-shadow 0.12s',
        fontFamily: mono ? 'monospace' : 'Inter, sans-serif',
        ...(props.style || {})
      }}
        onFocus={e => { if (!readOnly) { e.target.style.borderColor = '#0ea5e9'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)' } }}
        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}

// ─── SELECT ─────────────────────────────────────────────────
export function Select({ label, id, children, onChange, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>{label}</label>}
      <select id={id} value={value} onChange={onChange} style={{
        width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
        fontSize: 13, color: '#111827', background: '#fff', outline: 'none',
        fontFamily: 'Inter, sans-serif', cursor: 'pointer',
      }}>
        {children}
      </select>
    </div>
  )
}

// ─── CARD ───────────────────────────────────────────────────
export function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.05)', padding: 22, ...style }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</div>
      {action}
    </div>
  )
}

// ─── BADGE ──────────────────────────────────────────────────
const badgeStyles = {
  SCHEDULED: { background: '#e0f2fe', color: '#0284c7' },
  COMPLETED: { background: '#dcfce7', color: '#15803d' },
  CANCELLED: { background: '#fee2e2', color: '#dc2626' },
  default:   { background: '#f1f5f9', color: '#64748b' },
}

export function Badge({ status }) {
  const norm = (status || '').toUpperCase()
  const display = norm === 'BOOKED' ? 'SCHEDULED' : norm
  const s = badgeStyles[display] || badgeStyles.default
  return (
    <span style={{ ...s, display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
      {display || '—'}
    </span>
  )
}

// ─── SPINNER ────────────────────────────────────────────────
export function Spinner({ dark }) {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%', display: 'inline-block',
      border: dark ? '2px solid #e5e7eb' : '2px solid rgba(255,255,255,0.3)',
      borderTopColor: dark ? '#0ea5e9' : '#fff',
      animation: 'spin 0.6s linear infinite',
    }} />
  )
}

// ─── LOADING ROW ────────────────────────────────────────────
export function LoadingRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 36, color: '#6b7280', gap: 10, fontSize: 13 }}>
      <Spinner dark /> Loading...
    </div>
  )
}

// ─── EMPTY STATE ────────────────────────────────────────────
export function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 16px', color: '#6b7280' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 13 }}>{message}</p>
    </div>
  )
}

// ─── MODAL ──────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeUp 0.18s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 26, width: '100%',
        maxWidth: 500, boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</div>
          <button onClick={onClose} style={{ background: '#f0f4f8', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>{footer}</div>}
      </div>
    </div>
  )
}

// ─── DETAIL ROW ─────────────────────────────────────────────
export function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{value || '—'}</span>
    </div>
  )
}

// ─── STAT CARD ──────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, iconBg }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
    </div>
  )
}

// ─── TABLE ──────────────────────────────────────────────────
export function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '9px 12px', background: '#f0f4f8', color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, mono }) {
  return <td style={{ padding: '11px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'middle', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 10 : 13 }}>{children}</td>
}
