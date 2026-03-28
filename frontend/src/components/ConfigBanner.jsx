import React, { useState } from 'react'
import { CONFIG } from '../api'

export default function ConfigBanner() {
  const [patient, setPatient] = useState(CONFIG.patientBase)
  const [doctor,  setDoctor]  = useState(CONFIG.doctorBase)
  const [consult, setConsult] = useState(CONFIG.consultBase)
  const [booking, setBooking] = useState(CONFIG.bookingBase)
  const [saved, setSaved] = useState(false)

  function save() {
    CONFIG.patientBase = patient.trim().replace(/\/$/, '')
    CONFIG.doctorBase  = doctor.trim().replace(/\/$/, '')
    CONFIG.consultBase = consult.trim().replace(/\/$/, '')
    CONFIG.bookingBase = booking.trim().replace(/\/$/, '')
    CONFIG.cancelBase  = booking.trim().replace(/\/$/, '')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = {
    background: '#334155', border: '1px solid #475569', color: '#f1f5f9',
    padding: '3px 8px', borderRadius: 4, fontSize: 10, width: 220, fontFamily: 'monospace',
    outline: 'none',
  }
  const lbl = { color: '#475569', fontSize: 11 }

  return (
    <div style={{
      background: '#1e293b', color: '#94a3b8', fontSize: 11,
      padding: '7px 20px', display: 'flex', alignItems: 'center',
      gap: 12, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <strong style={{ color: '#e2e8f0' }}>⚙ Service URLs</strong>
      <span style={lbl}>Patient:</span>   <input style={inp} value={patient} onChange={e => setPatient(e.target.value)} />
      <span style={lbl}>Doctor:</span>    <input style={inp} value={doctor}  onChange={e => setDoctor(e.target.value)} />
      <span style={lbl}>Consult:</span>   <input style={inp} value={consult} onChange={e => setConsult(e.target.value)} />
      <span style={lbl}>Booking:</span>   <input style={inp} value={booking} onChange={e => setBooking(e.target.value)} />
      <button onClick={save} style={{
        background: saved ? '#22c55e' : '#0ea5e9', color: '#fff', border: 'none',
        padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'background 0.2s',
      }}>
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}
