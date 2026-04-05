import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '../components/UI'

export function PaymentSuccess() {
  const navigate = useNavigate()
  return (
    <div className="fade-up" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment returned from PayPal</div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          If PayPal confirmed the payment, you can return to your consultations. Capture status may still sync on the server.
        </p>
        <Button type="button" onClick={() => navigate('/consults')}>Back to My Consultations</Button>
      </Card>
    </div>
  )
}

export function PaymentCancelled() {
  const navigate = useNavigate()
  return (
    <div className="fade-up" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>↩</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment cancelled</div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          No charge was completed. You can try again from My Consultations when you are ready.
        </p>
        <Button type="button" onClick={() => navigate('/consults')}>Back to My Consultations</Button>
      </Card>
    </div>
  )
}
