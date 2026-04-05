import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { patientApi, doctorApi, consultApi } from '../api'
import { Card, Input, Button } from '../components/UI'

export default function Settings() {
  const { user, login, logout } = useAuth()
  const toast = useToast()
  
  const isDoc = user?.role === 'doctor'

  const [formData, setFormData] = useState({
    Name: '',
    Email: '',
    Address: '',
    DOB: ''
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        Name: user.Name || '',
        Email: user.Email || '',
        Address: user.Address || '',
        DOB: user.DOB ? user.DOB.split('T')[0] : ''
      })
    }
  }, [user])

  if (!user) {
    return (
      <div className="fade-up">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Settings</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Update your personal information.</div>
        </div>
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Please sign in to view settings.</p>
        </Card>
      </div>
    )
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = isDoc ? {
        DoctorID: user.DoctorID,
        Password: user.Password, // Preserving password on standard update just in case
        Name: formData.Name,
        Email: formData.Email
      } : {
        PatientID: user.PatientID,
        Password: user.Password, // Preserving password on standard update just in case
        ...formData
      }
      
      if (isDoc) {
        await doctorApi.update(payload)
      } else {
        await patientApi.update(payload)
      }
      
      // Update global auth context so the sidebar reflects changes immediately
      await login({ ...user, ...payload }, user.role)
      toast('Profile updated successfully! 🎉', 'success')
    } catch (err) {
      toast('Failed to update profile: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('Passwords do not match', 'error')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast('Password must be at least 6 characters long', 'error')
      return
    }
    
    setPasswordLoading(true)
    try {
      const payload = isDoc ? {
        DoctorID: user.DoctorID,
        Name: user.Name,
        Email: user.Email,
        Password: passwordForm.newPassword
      } : {
        PatientID: user.PatientID,
        Name: user.Name,
        Email: user.Email,
        DOB: user.DOB,
        Address: user.Address,
        Password: passwordForm.newPassword
      }
      
      if (isDoc) {
        await doctorApi.update(payload)
      } else {
        await patientApi.update(payload)
      }
      
      await login({ ...user, Password: passwordForm.newPassword }, user.role)
      
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      toast('Password updated successfully! 🎉', 'success')
    } catch (err) {
      toast('Failed to update password: ' + err.message, 'error')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      // First check if there are any upcoming scheduled consultations
      const consultsReq = isDoc 
        ? await consultApi.getByDoctor(user.DoctorID)
        : await consultApi.getByPatient(user.PatientID)
        
      const consultsList = consultsReq.Data || consultsReq.data || consultsReq || []
      const hasUpcoming = consultsList.some(c => {
        const s = (c.Status || c.status || '').toUpperCase()
        return s === 'SCHEDULED' || s === 'BOOKED'
      })

      if (hasUpcoming) {
        toast('You must cancel all upcoming scheduled consultations before deleting your account.', 'error')
        setDeleting(false)
        return
      }

      const msg = "Are you absolutely sure you want to permanently delete your account? This action cannot be undone."
      if (!window.confirm(msg)) {
        setDeleting(false)
        return
      }
      
      if (isDoc) {
        await doctorApi.delete(user.DoctorID)
      } else {
        await patientApi.delete(user.PatientID)
      }
      toast('Account deleted successfully.', 'success')
      logout() // clears local session and re-renders to the signed out state
    } catch (err) {
      toast('Failed to delete account: ' + err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Settings</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Update your personal information.</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: 22, maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>My Profile</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 16 }}>
            <Input 
              label={isDoc ? "Doctor ID" : "Patient ID"}
              value={isDoc ? user.DoctorID : user.PatientID} 
              readOnly 
              mono 
            />
            <Input 
              label="Full Name" 
              name="Name"
              value={formData.Name} 
              onChange={handleChange} 
              required 
            />
            <Input 
              label="Email Address" 
              type="email"
              name="Email"
              value={formData.Email} 
              onChange={handleChange} 
              required 
            />
            {!isDoc && (
              <>
                <Input 
                  label="Home Address" 
                  name="Address"
                  value={formData.Address} 
                  onChange={handleChange} 
                />
                <Input 
                  label="Date of Birth" 
                  type="date"
                  name="DOB"
                  value={formData.DOB} 
                  onChange={handleChange} 
                />
              </>
            )}
          </div>
          <div style={{ marginTop: 24 }}>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
      
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: 22, maxWidth: 600, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Change Password</div>
        </div>
        <form onSubmit={handlePasswordSubmit}>
          <div style={{ display: 'grid', gap: 16 }}>
            <Input 
              label="New Password" 
              type="password"
              name="newPassword"
              value={passwordForm.newPassword} 
              onChange={handlePasswordChange}
              placeholder="••••••••"
              required 
            />
            <Input 
              label="Confirm New Password" 
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword} 
              onChange={handlePasswordChange}
              placeholder="••••••••"
              required 
            />
          </div>
          <div style={{ marginTop: 24 }}>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fecaca', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: 22, maxWidth: 600, marginTop: 24, marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#dc2626' }}>Danger Zone</div>
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
          Permanently delete your account and remove all associated data. This action cannot be undone.
        </p>
        <Button variant="danger" disabled={deleting} onClick={handleDeleteAccount}>
          {deleting ? 'Deleting...' : 'Delete Account'}
        </Button>
      </div>
    </div>
  )
}
