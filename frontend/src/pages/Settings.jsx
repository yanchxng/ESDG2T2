import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { patientApi } from '../api'
import { Card, CardHeader, Input, Button } from '../components/UI'

export default function Settings() {
  const { patient, login } = useAuth()
  const toast = useToast()

  const [formData, setFormData] = useState({
    Name: '',
    Email: '',
    Address: '',
    DOB: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (patient) {
      setFormData({
        Name: patient.Name || '',
        Email: patient.Email || '',
        Address: patient.Address || '',
        DOB: patient.DOB ? patient.DOB.split('T')[0] : ''
      })
    }
  }, [patient])

  if (!patient) {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        PatientID: patient.PatientID,
        ...formData
      }
      // Assuming your OutSystems API returns the updated patient data
      await patientApi.update(payload)
      
      // Update global auth context so the sidebar reflects changes immediately
      login(payload)
      toast('Profile updated successfully! 🎉', 'success')
    } catch (err) {
      toast('Failed to update profile: ' + err.message, 'error')
    } finally {
      setLoading(false)
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
              label="Patient ID" 
              value={patient.PatientID} 
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
          </div>
          <div style={{ marginTop: 24 }}>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
