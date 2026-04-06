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

const settingsItems = [
  { path: '/settings',     label: 'Settings',        icon: '⚙' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <aside style={{
      width: 240, background: '#fff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100%', overflowY: 'auto', flexShrink: 0,
    }}>
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>♥</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>MediLink</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Telemedicine Platform</div>
        </div>
      </div>

      <nav style={{ padding: '8px 10px', flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 10, padding: '0 4px' }}>Menu</div>
        {navItems.map(item => {
          if (user?.role === 'doctor' && item.path === '/book') return null;
          return <NavItem key={item.path} item={item} active={pathname === item.path} onClick={() => navigate(item.path)} />
        })}
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', margin: '16px 0 10px', padding: '0 4px' }}>System</div>
        {user ? (
          <>
            {user.role === 'doctor' && adminItems.map(item => (
              <NavItem key={item.path} item={item} active={pathname === item.path} onClick={() => navigate(item.path)} />
            ))}
            {settingsItems.map(item => (
              <NavItem key={item.path} item={item} active={pathname === item.path} onClick={() => navigate(item.path)} />
            ))}
          </>
        ) : null}
      </nav>

      <div style={{ padding: 14, borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f0f4f8' }}>
          <div 
            onClick={() => { if (user) navigate('/settings'); }}
            style={{ cursor: user ? 'pointer' : 'default', width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            {user ? user.Name[0].toUpperCase() : '?'}
          </div>
          <div 
            onClick={() => { if (user) navigate('/settings'); }}
            style={{ cursor: user ? 'pointer' : 'default', minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user ? user.Name : 'Not signed in'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{user ? user.role : ''}</div>
          </div>
          {user && (
            <button onClick={() => { logout(); navigate('/'); }} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, padding: 2 }}>
              ⎋
            </button>
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
