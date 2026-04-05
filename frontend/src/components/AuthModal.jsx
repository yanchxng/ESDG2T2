import React, { useState, useEffect } from 'react'
import { Modal, Input, Button } from './UI'
import { patientApi, doctorApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function AuthModal({ open, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'register'

  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])
  const [role, setRole] = useState('patient') // 'patient' | 'doctor'
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  // Register form state
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', dob: '', address: '' })

  async function handleLogin(e) {
    e.preventDefault()
    if (!loginForm.email || !loginForm.password) { toast('Please enter email and password', 'error'); return }
    setLoading(true)
    try {
      const api = role === 'doctor' ? doctorApi : patientApi
      const data = await api.getAll()
      const list = data.Data || data.data || []
      const found = list.find(p => p.Email === loginForm.email)
      if (!found) { toast(`No ${role} found with that email. Please register first.`, 'error'); return }
      await login(found, role)
      toast(`Welcome back, ${found.Name}!`, 'success')
      onClose()
    } catch (err) {
      toast('Login failed: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const { name, email, password, dob, address } = regForm
    if (!name || !email || !password) { toast('Please fill all required fields', 'error'); return }
    if (role === 'patient' && (!dob || !address)) { toast('Please fill all fields', 'error'); return }
    setLoading(true)
    try {
      let data, p
      if (role === 'doctor') {
        data = await doctorApi.create({ Name: name, Email: email, Password: password })
      } else {
        data = await patientApi.create({ Name: name, Email: email, Password: password, DOB: dob, Address: address })
      }
      p = data.Data || data.data || data
      await login(p, role)
      toast(`Welcome, ${p.Name}! 🎉`, 'success')
      onClose()
    } catch (err) {
      toast('Registration failed: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Sign In' : 'Create Account'}
      footer={
        mode === 'login' ? (
          <Button onClick={handleLogin} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Button>
        ) : (
          <Button onClick={handleRegister} disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</Button>
        )
      }
    >
      {/* Role toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#f0f4f8', borderRadius: 8, padding: 3, marginBottom: 16 }}>
        {['patient', 'doctor'].map((r) => (
          <button key={r} onClick={() => setRole(r)} type="button" style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', textTransform: 'capitalize',
            color: role === r ? '#111827' : '#6b7280',
            background: role === r ? '#fff' : 'transparent',
            boxShadow: role === r ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}>
            {r === 'patient' ? '👤 Patient' : '🏥 Doctor'}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin}>
          <Input label="Email address" type="email" placeholder="you@example.com" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Password" type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} />
          <button type="submit" style={{ display: 'none' }} />
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Input label="Full Name" placeholder={role === 'doctor' ? "Dr. John Doe" : "Alice Tan"} value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" placeholder="email@example.com" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" placeholder="••••••••" value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
            {role === 'patient' && (
              <Input label="Date of Birth" type="date" value={regForm.dob} onChange={e => setRegForm(f => ({ ...f, dob: e.target.value }))} />
            )}
          </div>
          {role === 'patient' && (
            <Input label="Address" placeholder="123 Orchard Road, Singapore" value={regForm.address} onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))} />
          )}
        </form>
      )}
    </Modal>
  )
}
