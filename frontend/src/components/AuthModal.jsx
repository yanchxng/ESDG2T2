import React, { useState } from 'react'
import { Modal, Input, Button } from './UI'
import { patientApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
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
      const data = await patientApi.getAll()
      const list = data.Data || data.data || []
      const found = list.find(p => p.Email === loginForm.email)
      if (!found) { toast('No patient found with that email. Please register first.', 'error'); return }
      login(found)
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
    if (!name || !email || !password || !dob || !address) { toast('Please fill all fields', 'error'); return }
    setLoading(true)
    try {
      const data = await patientApi.create({ Name: name, Email: email, Password: password, DOB: dob, Address: address })
      const p = data.Data || data.data || data
      login(p)
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
          <>
            <Button variant="secondary" onClick={() => setMode('register')}>Create account</Button>
            <Button onClick={handleLogin} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setMode('login')}>Sign in instead</Button>
            <Button onClick={handleRegister} disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</Button>
          </>
        )
      }
    >
      {mode === 'login' ? (
        <form onSubmit={handleLogin}>
          <Input label="Email address" type="email" placeholder="you@example.com" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Password" type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} />
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Input label="Full Name" placeholder="Alice Tan" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" placeholder="alice@example.com" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" placeholder="••••••••" value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
            <Input label="Date of Birth" type="date" value={regForm.dob} onChange={e => setRegForm(f => ({ ...f, dob: e.target.value }))} />
          </div>
          <Input label="Address" placeholder="123 Orchard Road, Singapore" value={regForm.address} onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))} />
        </form>
      )}
    </Modal>
  )
}
