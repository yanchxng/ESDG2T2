import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { consultApi, compositeApi, fmtDT } from '../api'
import { Card, Badge, Button, Modal, DetailRow, LoadingRow, EmptyState } from '../components/UI'
import AuthModal from '../components/AuthModal'

const FILTERS = ['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED']

export default function MyConsults() {
  const { patient } = useAuth()
  const toast = useToast()
  const [authOpen, setAuthOpen] = useState(false)
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null) // consult for detail modal
  const [cancelling, setCancelling] = useState(false)

  function load() {
    if (!patient) return
    setLoading(true)
    consultApi.getByPatient(patient.PatientID)
      .then(data => setConsults(data.Data || data.data || data || []))
      .catch(() => setConsults([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patient])

  const filtered = filter === 'All' ? consults : consults.filter(c => (c.Status || c.status) === filter)

  async function handleCancel(consultId) {
    if (!window.confirm('Are you sure you want to cancel this consultation?')) return
    setCancelling(true)
    try {
      await compositeApi.cancelBooking({ PatientID: patient.PatientID, ConsultID: consultId })
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
      setCancelling(false)
    }
  }

  if (!patient) {
    return (
      <div className="fade-up">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>My Consultations</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Scenarios 2 & 3 — view, join, or cancel</div>
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
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Consultation Details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            {selected && (selected.Status || selected.status) === 'SCHEDULED' && (
              <Button variant="danger" size="sm" disabled={cancelling} onClick={() => handleCancel(selected.ConsultID || selected.consult_id)}>
                {cancelling ? 'Cancelling…' : 'Cancel Consult'}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <>
            <DetailRow label="Consult ID"  value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.ConsultID || selected.consult_id}</span>} />
            <DetailRow label="Doctor ID"   value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.DoctorID || selected.doctor_id}</span>} />
            <DetailRow label="Patient ID"  value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.PatientID || selected.patient_id}</span>} />
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

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>My Consultations</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Scenarios 2 & 3 — view, join, or cancel</div>
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
          {filtered.map(c => <ConsultCard key={c.ConsultID || c.consult_id} c={c} onView={() => setSelected(c)} onCancel={handleCancel} />)}
        </div>
      )}
    </div>
  )
}

function ConsultCard({ c, onView, onCancel }) {
  const status = c.Status || c.status
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
        <span>👨‍⚕️ {(c.DoctorID || c.doctor_id || '—').substring(0, 12)}…</span>
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
