import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { path: '/',             label: 'Dashboard',       icon: '⊞' },
  { path: '/book',         label: 'Book Consultation', icon: '📅' },
  { path: '/consults',     label: 'My Consultations', icon: '📋' },
]

const adminItems = [
  { path: '/admin',        label: 'Admin Panel',     icon: '⚙' },
]

export default function Sidebar() {
  const { patient, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <aside style={{
      width: 240, background: '#fff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>♥</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>MediLink</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Telemedicine Platform</div>
        </div>
      </div>

      {/* Role toggle (visual) */}
      <div style={{ display: 'flex', gap: 4, background: '#f0f4f8', borderRadius: 8, padding: 3, margin: '12px 12px 4px' }}>
        {['👤 Patient', '🏥 Doctor'].map((r, i) => (
          <button key={r} style={{
            flex: 1, padding: '6px 8px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            color: i === 0 ? '#111827' : '#6b7280',
            background: i === 0 ? '#fff' : 'transparent',
            boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}>{r}</button>
        ))}
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 10px', flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 10, padding: '0 4px' }}>Menu</div>
        {navItems.map(item => (
          <NavItem key={item.path} item={item} active={pathname === item.path} onClick={() => navigate(item.path)} />
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', margin: '16px 0 10px', padding: '0 4px' }}>System</div>
        {adminItems.map(item => (
          <NavItem key={item.path} item={item} active={pathname === item.path} onClick={() => navigate(item.path)} />
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: 14, borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f0f4f8' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            {patient ? patient.Name[0].toUpperCase() : '?'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {patient ? patient.Name : 'Not signed in'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Patient</div>
          </div>
          {patient && (
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 2 }}>→</button>
          )}
        </div>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
      borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
      marginBottom: 2, border: 'none', width: '100%', textAlign: 'left',
      fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
      background: active ? '#e0f2fe' : 'transparent',
      color: active ? '#0284c7' : '#6b7280',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f0f4f8'; e.currentTarget.style.color = '#111827' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' } }}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
      {item.label}
    </button>
  )
}
