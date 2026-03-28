import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { consultApi, fmtDate, fmtDT } from '../api'
import { StatCard, Card, CardHeader, Badge, Button, LoadingRow, EmptyState, DetailRow } from '../components/UI'
import AuthModal from '../components/AuthModal'

export default function Dashboard() {
  const { patient } = useAuth()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!patient) return
    setLoading(true)
    consultApi.getByPatient(patient.PatientID)
      .then(data => setConsults(data.Data || data.data || data || []))
      .catch(() => setConsults([]))
      .finally(() => setLoading(false))
  }, [patient])

  const upcoming  = consults.filter(c => (c.Status || c.status) === 'SCHEDULED')
  const completed = consults.filter(c => (c.Status || c.status) === 'COMPLETED')

  if (!patient) {
    return (
      <div className="fade-up">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Welcome to MediLink</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Your connected healthcare platform</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',
          borderRadius: 12, padding: '28px 32px', color: '#fff', marginBottom: 22, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(14,165,233,0.12)' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Get Started</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, maxWidth: 460 }}>
            Book teleconsults with certified doctors, receive diagnoses and prescriptions, and pay — all in one platform.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['1. Register / Login', '2. Book a Consult', '3. Attend via Zoom', '4. Receive Diagnosis', '5. Pay & Done'].map(s => (
              <span key={s} style={{ background: 'rgba(14,165,233,0.18)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.25)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => setAuthOpen(true)}>Sign In</Button>
          <Button variant="secondary" onClick={() => setAuthOpen(true)}>Create Account</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Welcome back, {patient.Name.split(' ')[0]}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Here's your health overview</div>
        </div>
        <Button onClick={() => navigate('/book')}>📅 Book Consultation</Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Upcoming"  value={loading ? '…' : upcoming.length}  sub="consultations" icon="📈" iconBg="#e0f2fe" />
        <StatCard label="Completed" value={loading ? '…' : completed.length} sub="consultations" icon="✅" iconBg="#f0fdf4" />
        <StatCard label="Total"     value={loading ? '…' : consults.length}  sub="all time"      icon="💊" iconBg="#faf5ff" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Upcoming consults */}
        <Card>
          <CardHeader title="Upcoming Consultations" action={<button onClick={() => navigate('/consults')} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>View all →</button>} />
          {loading ? <LoadingRow /> : upcoming.length === 0 ? (
            <EmptyState icon="📋" message={<>No upcoming consults. <span onClick={() => navigate('/book')} style={{ color: '#0ea5e9', cursor: 'pointer' }}>Book one now!</span></>} />
          ) : upcoming.slice(0, 3).map(c => (
            <ConsultRow key={c.ConsultID || c.consult_id} c={c} />
          ))}
        </Card>

        {/* Profile */}
        <Card>
          <CardHeader title="My Profile" action={<Button variant="ghost" size="sm" onClick={() => { useAuth().logout && null }}>—</Button>} />
          <DetailRow label="Name"        value={patient.Name} />
          <DetailRow label="Email"       value={patient.Email} />
          <DetailRow label="Address"     value={patient.Address} />
          <DetailRow label="Date of Birth" value={fmtDate(patient.DOB)} />
          <DetailRow label="Patient ID"  value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{patient.PatientID}</span>} />
          <div style={{ marginTop: 14 }}>
            <Button size="sm" onClick={() => navigate('/book')}>+ New Booking</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function ConsultRow({ c }) {
  const navigate = useNavigate()
  const status = c.Status || c.status
  const zoom = c.ZoomURL || c.zoom_url
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>#{(c.ConsultID || c.consult_id || '').substring(0, 8)}…</span>
        <Badge status={status} />
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>📅 {fmtDT(c.Timeslot || c.timeslot)}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {zoom && <a href={zoom} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', fontSize: 12, fontWeight: 500 }}>🎥 Join Zoom</a>}
        <button onClick={() => navigate('/consults')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Details →</button>
      </div>
    </div>
  )
}
