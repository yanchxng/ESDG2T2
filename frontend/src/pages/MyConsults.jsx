import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { consultApi, compositeApi, doctorApi, diagnosisApi, patientApi, fmtDT } from '../api'
import { Card, Badge, Button, Modal, DetailRow, LoadingRow, EmptyState, Input } from '../components/UI'
import AuthModal from '../components/AuthModal'

const FILTERS = ['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED']

export default function MyConsults() {
  const { user } = useAuth()
  const toast = useToast()
  const [authOpen, setAuthOpen] = useState(false)
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null) // consult for detail modal
  const [actioning, setActioning] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completeForm, setCompleteForm] = useState({ diagnosis: '', prescription: ''})
  const [doctorsMap, setDoctorsMap] = useState({})
  const [patientsMap, setPatientsMap] = useState({})

  function load() {
    if (!user) return
    setLoading(true)
    const req = user.role === 'doctor' 
      ? consultApi.getByDoctor(user.DoctorID) 
      : consultApi.getByPatient(user.PatientID)
    req
      .then(data => setConsults(data.Data || data.data || data || []))
      .catch(() => setConsults([]))
      .finally(() => setLoading(false))

    // Preload docs dictionary
    doctorApi.getAll()
      .then(res => {
        const docs = res.Data || res.data || res || []
        const map = {}
        docs.forEach(d => {
          map[d.DoctorID || d.id] = d.Name || d.name || `Dr. ${d.DoctorID}`
        })
        setDoctorsMap(map)
      })
      .catch(() => {})

    // Preload patients dictionary
    patientApi.getAll()
      .then(res => {
        const patients = res.Data || res.data || res || []
        const map = {}
        patients.forEach(p => {
          map[p.PatientID || p.id] = p.Name || p.name || `Patient ${p.PatientID}`
        })
        setPatientsMap(map)
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [user])

  const filtered = filter === 'All' ? consults : consults.filter(c => {
    const s = (c.Status || c.status || '').toUpperCase()
    const match = s === 'BOOKED' ? 'SCHEDULED' : s
    return match === filter
  })

  async function handleView(c) {
    // If it's a completed consultation, gracefully fetch its diagnosis details
    const status = (c.Status || c.status || '').toUpperCase()
    if (status === 'COMPLETED') {
      try {
        const diagData = await diagnosisApi.getByConsult(c.ConsultID || c.consult_id)
        setSelected({ ...c, diagnosis: diagData.diagnosis, prescription: diagData.prescription })
      } catch (err) {
        // Just show what we safely have
        setSelected(c)
      }
    } else {
      setSelected(c)
    }
  }

  async function handleCancel(consultId) {
    if (!window.confirm('Are you sure you want to cancel this consultation?')) return
    setActioning(true)
    try {
      await compositeApi.cancelBooking({ PatientID: user.PatientID || selected?.PatientID, ConsultID: consultId })
      toast('Consultation cancelled. Notification sent.', 'success')
      setSelected(null)
      load()
    } catch (err) {
      toast('Cancel service not reachable: ' + err.message, 'error')
      // Optimistic update
      setConsults(prev => prev.map(c =>
        (c.ConsultID || c.consult_id) === consultId ? { ...c, Status: 'CANCELLED', status: 'CANCELLED' } : c
      ))
      setSelected(null)
    } finally {
      setActioning(false)
    }
  }

  async function handleCompleteSubmit() {
    if (!completeForm.diagnosis || !completeForm.prescription) {
      toast('Please enter both diagnosis and prescription.', 'error')
      return
    }
    const confirmPayment = window.confirm(
      'Consultation complete. Proceed to charge patient $35.00 via PayPal Sandbox?'
    )
    if (!confirmPayment) return

    setActioning(true)
    try {
      await compositeApi.consultDoctor({
        PatientID: selected.PatientID || selected.patient_id,
        ConsultID: selected.ConsultID || selected.consult_id,
        diagnosis: completeForm.diagnosis,
        prescription: completeForm.prescription,
        amount: 35.00
      })
      toast('Payment processed and diagnosis saved!', 'success')
      setCompleteModalOpen(false)
      setSelected(null)
      load()
    } catch (err) {
      toast('Failed to complete consultation: ' + err.message, 'error')
    } finally {
      setActioning(false)
    }
  }

  if (!user) {
    return (
      <div className="fade-up">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>My Consultations</div>
        </div>
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Sign in required</div>
          <p style={{ color: '#6b7280', marginBottom: 18, fontSize: 13 }}>Please sign in to view your consultations</p>
          <Button onClick={() => setAuthOpen(true)}>Sign In / Register</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Detail Modal */}
      <Modal
        open={!!selected && !completeModalOpen}
        onClose={() => setSelected(null)}
        title="Consultation Details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            {selected && ((selected.Status || selected.status || '').toUpperCase() === 'SCHEDULED' || (selected.Status || selected.status || '').toUpperCase() === 'BOOKED') && (
              <>
                <Button variant="danger" size="sm" disabled={actioning} onClick={() => handleCancel(selected.ConsultID || selected.consult_id)}>
                  {actioning ? 'Cancelling…' : 'Cancel Consult'}
                </Button>
                {user.role === 'doctor' && (
                  <Button variant="success" size="sm" onClick={() => { setCompleteForm({ diagnosis: '', prescription: '' }); setCompleteModalOpen(true); }}>
                    Complete Consult
                  </Button>
                )}
              </>
            )}
          </>
        }
      >
        {selected && (
          <>
            <DetailRow label="Consult ID"  value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.ConsultID || selected.consult_id}</span>} />
            <DetailRow label="Doctor"      value={doctorsMap[selected.DoctorID || selected.doctor_id] || (selected.DoctorID || selected.doctor_id)} />
            <DetailRow label="Patient"     value={patientsMap[selected.PatientID || selected.patient_id] || (selected.PatientID || selected.patient_id)} />
            <DetailRow label="Timeslot"    value={fmtDT(selected.Timeslot || selected.timeslot)} />
            <DetailRow label="Status"      value={<Badge status={selected.Status || selected.status} />} />
            <DetailRow label="Zoom URL"    value={selected.ZoomURL || selected.zoom_url
              ? <a href={selected.ZoomURL || selected.zoom_url} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9' }}>{selected.ZoomURL || selected.zoom_url}</a>
              : '—'} />
            {(selected.Diagnosis || selected.diagnosis) && <DetailRow label="Diagnosis"    value={selected.Diagnosis || selected.diagnosis} />}
            {(selected.Prescription || selected.prescription) && <DetailRow label="Prescription" value={selected.Prescription || selected.prescription} />}
            {(selected.PaymentID || selected.payment_id) && <DetailRow label="Payment ID"   value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.PaymentID || selected.payment_id}</span>} />}
          </>
        )}
      </Modal>

      {/* Complete Consult Modal (Doctor Only) */}
      <Modal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Consultation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteModalOpen(false)}>Cancel</Button>
            <Button variant="success" disabled={actioning} onClick={handleCompleteSubmit}>
              {actioning ? 'Saving Data...' : 'Submit & Complete'}
            </Button>
          </>
        }
      >
        <div style={{ marginBottom: 16, fontSize: 13, color: '#4b5563' }}>
          Please fill in the diagnosis and prescription information to conclude this consultation.
        </div>
        <Input 
          label="Diagnosis Details" 
          placeholder="Patient reporting fever and chills..." 
          value={completeForm.diagnosis} 
          onChange={e => setCompleteForm(f => ({ ...f, diagnosis: e.target.value }))} 
        />
        <div style={{ marginTop: 12 }}>
          <Input 
            label="Prescription Details" 
            placeholder="Paracetamol 500mg, 2x a day for 4 days" 
            value={completeForm.prescription} 
            onChange={e => setCompleteForm(f => ({ ...f, prescription: e.target.value }))} 
          />
        </div>
      </Modal>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>My Consultations</div>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>↻ Refresh</Button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
            background: filter === f ? '#0ea5e9' : '#fff',
            color: filter === f ? '#fff' : '#374151',
            border: filter === f ? 'none' : '1px solid #e5e7eb',
          }}>{f}</button>
        ))}
      </div>

      {/* Consult list */}
      {loading ? <LoadingRow /> : filtered.length === 0 ? (
        <EmptyState icon="📋" message={`No ${filter === 'All' ? '' : filter.toLowerCase() + ' '}consultations found.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => <ConsultCard key={c.ConsultID || c.consult_id} c={c} doctorsMap={doctorsMap} patientsMap={patientsMap} userRole={user.role} onView={() => handleView(c)} onCancel={handleCancel} />)}
        </div>
      )}
    </div>
  )
}

function ConsultCard({ c, doctorsMap, patientsMap, userRole, onView, onCancel }) {
  const rawStatus = (c.Status || c.status || '').toUpperCase()
  const status = rawStatus === 'BOOKED' ? 'SCHEDULED' : rawStatus
  const zoom = c.ZoomURL || c.zoom_url
  const id = c.ConsultID || c.consult_id || '—'
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Consult #{id.substring(0, 12)}…</span>
        <Badge status={status} />
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        <span>📅 {fmtDT(c.Timeslot || c.timeslot)}</span>
        {userRole === 'patient' ? (
          <span>👨‍⚕️ {doctorsMap?.[c.DoctorID || c.doctor_id] || (c.DoctorID || c.doctor_id || '—').substring(0, 12) + '…'}</span>
        ) : (
          <span>🧑 {patientsMap?.[c.PatientID || c.patient_id] || (c.PatientID || c.patient_id || '—').substring(0, 12) + '…'}</span>
        )}
        {zoom && <a href={zoom} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', fontWeight: 500 }}>🎥 Join Zoom</a>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button variant="secondary" size="sm" onClick={onView}>View Details</Button>
        {status === 'SCHEDULED' && (
          <Button variant="danger" size="sm" onClick={() => onCancel(id)}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
