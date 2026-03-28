import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

const icons = { success: '✅', error: '❌', info: 'ℹ️' }
const styles = {
  success: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  error:   { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  info:    { background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' },
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          ...styles[t.type],
          padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', maxWidth: 320,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'slideIn 0.25s ease',
        }}>
          {icons[t.type]} {t.msg}
        </div>
      ))}
    </div>
  )
}
