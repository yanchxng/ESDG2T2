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
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [booking, setBooking] = useState(false)

  // Min datetime = now
  const nowISO = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) })()
  const minDate = nowISO.split('T')[0]
  const currentTime = nowISO.split('T')[1]

  useEffect(() => {
    if (!selectedDate) setSelectedDate(minDate)
  }, [minDate, selectedDate])

  const timeslot = selectedDate && selectedTime ? `${selectedDate}T${selectedTime}` : ''
  const canBook = timeslot

  const generateTimeslots = () => {
    const slots = [];
    for (let h = 9; h <= 17; h++) { // 9 AM to 5 PM
      for (let m = 0; m < 60; m += 15) {
        if (h === 17 && m > 0) continue; 
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };
  const availableTimes = generateTimeslots();
  const isToday = selectedDate === minDate;

  useEffect(() => {
    if (!patient) return
    setDoctorsLoading(true)
    doctorApi.getAll()
      .then(data => setDoctors(data.Data || data.data || []))
      .catch(err => toast('Could not load doctors: ' + err.message, 'error'))
      .finally(() => setDoctorsLoading(false))
  }, [patient])

  async function handleBook() {
    if (!canBook) return
    setBooking(true)
    try {
      await compositeApi.makeBooking({
        PatientID: patient.PatientID,
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
        <div style={{ fontSize: 13, color: '#6b7280' }}>Scenario 1 — Select a date and time. A doctor will be randomly assigned based on their availability.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginBottom: 18, maxWidth: 600 }}>
        {/* Step 1 */}
        <Card>
          <CardHeader title={<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#e0f2fe', fontSize: 13, marginRight: 6 }}>🕐</span>Step 1 — Choose Timeslot</>} />
          
          <Input label="Date" type="date" min={minDate} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }} />
          
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Available Times (15 min intervals)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {availableTimes.map(time => {
                const isPast = isToday && time <= currentTime;
                const isSelected = selectedTime === time;
                return (
                  <button
                    key={time}
                    disabled={isPast}
                    onClick={() => setSelectedTime(time)}
                    style={{
                      padding: '8px 4px', borderRadius: 6, border: '1px solid',
                      borderColor: isSelected ? '#0ea5e9' : isPast ? '#f3f4f6' : '#e5e7eb',
                      background: isSelected ? '#e0f2fe' : isPast ? '#f9fafb' : '#fff',
                      color: isPast ? '#d1d5db' : isSelected ? '#0284c7' : '#374151',
                      cursor: isPast ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (!isSelected && !isPast) { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#0284c7' } }}
                    onMouseLeave={e => { if (!isSelected && !isPast) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' } }}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Step 2 */}
      <Card style={{ maxWidth: 600 }}>
        <CardHeader title={<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#e0f2fe', fontSize: 13, marginRight: 6 }}>✅</span>Step 2 — Confirm Booking</>} />
        {canBook ? (
          <div style={{ marginBottom: 16 }}>
            <DetailRow label="Doctor" value="To be assigned" />
            <DetailRow label="Timeslot" value={fmtDT(timeslot)} />
            <DetailRow label="Patient" value={patient.Name} />
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Select a timeslot above to see a summary.</p>
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
