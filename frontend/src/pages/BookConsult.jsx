import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { doctorApi, compositeApi, fmtDT } from '../api'
import { Card, CardHeader, Select, Input, Button, LoadingRow, DetailRow } from '../components/UI'
import AuthModal from '../components/AuthModal'

export default function BookConsult() {
  const { patient } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)

  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [timeslot, setTimeslot] = useState('')
  const [booking, setBooking] = useState(false)

  // Min datetime = now
  const nowISO = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) })()

  useEffect(() => {
    if (!patient) return
    setDoctorsLoading(true)
    doctorApi.getAll()
      .then(data => setDoctors(data.Data || data.data || []))
      .catch(err => toast('Could not load doctors: ' + err.message, 'error'))
      .finally(() => setDoctorsLoading(false))
  }, [patient])

  const selectedDoctorObj = doctors.find(d => d.DoctorID === selectedDoctor)
  const canBook = selectedDoctor && timeslot

  async function handleBook() {
    if (!canBook) return
    setBooking(true)
    try {
      await compositeApi.makeBooking({
        PatientID: patient.PatientID,
        Name: patient.Name,
        Password: 'placeholder',
        DoctorID: selectedDoctor,
        timeslot,
      })
      toast('Booking confirmed! 🎉 Check your consults.', 'success')
      navigate('/consults')
    } catch (err) {
      toast('Booking service not reachable yet. Error: ' + err.message, 'error')
    } finally {
      setBooking(false)
    }
  }

  if (!patient) {
    return (
      <div className="fade-up">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Book a Consultation</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Scenario 1 — Select a doctor and timeslot</div>
        </div>
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Sign in required</div>
          <p style={{ color: '#6b7280', marginBottom: 18, fontSize: 13 }}>Please sign in to book a consultation</p>
          <Button onClick={() => setAuthOpen(true)}>Sign In / Register</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Book a Consultation</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Scenario 1 — Select a doctor and timeslot</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Step 1 */}
        <Card>
          <CardHeader title={<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#e0f2fe', fontSize: 13, marginRight: 6 }}>👨‍⚕️</span>Step 1 — Select Doctor</>} />
          {doctorsLoading ? <LoadingRow /> : (
            <>
              <Select label="Available Doctors" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                <option value="">— Select a doctor —</option>
                {doctors.map(d => <option key={d.DoctorID} value={d.DoctorID}>{d.Name}</option>)}
              </Select>
              {selectedDoctorObj && (
                <div style={{ marginTop: 4 }}>
                  <DetailRow label="Name"      value={selectedDoctorObj.Name} />
                  <DetailRow label="Email"     value={selectedDoctorObj.Email} />
                  <DetailRow label="Doctor ID" value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selectedDoctorObj.DoctorID}</span>} />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader title={<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#e0f2fe', fontSize: 13, marginRight: 6 }}>🕐</span>Step 2 — Choose Timeslot</>} />
          <Input label="Date & Time" type="datetime-local" min={nowISO} value={timeslot} onChange={e => setTimeslot(e.target.value)} />
          <Input label="Your Patient ID" value={patient.PatientID} readOnly mono />
        </Card>
      </div>

      {/* Step 3 */}
      <Card>
        <CardHeader title={<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#e0f2fe', fontSize: 13, marginRight: 6 }}>✅</span>Step 3 — Confirm Booking</>} />
        {canBook ? (
          <div style={{ marginBottom: 16 }}>
            <DetailRow label="Doctor"   value={selectedDoctorObj?.Name} />
            <DetailRow label="Timeslot" value={fmtDT(timeslot)} />
            <DetailRow label="Patient"  value={patient.Name} />
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Select a doctor and timeslot above to see a summary.</p>
        )}
        <Button disabled={!canBook || booking} onClick={handleBook}>
          {booking ? 'Booking…' : 'Book Consultation'}
        </Button>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
          Calls: Make Booking → Consult Service → Zoom API → Notification Service
        </p>
      </Card>
    </div>
  )
}
