import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import ConfigBanner from './components/ConfigBanner'
import Dashboard from './pages/Dashboard'
import BookConsult from './pages/BookConsult'
import MyConsults from './pages/MyConsults'
import Admin from './pages/Admin'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Config banner at the very top */}
            <ConfigBanner />

            {/* Sidebar + main content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <Sidebar />
              <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 48px' }}>
                <Routes>
                  <Route path="/"        element={<Dashboard />} />
                  <Route path="/book"    element={<BookConsult />} />
                  <Route path="/consults" element={<MyConsults />} />
                  <Route path="/admin"   element={<Admin />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
