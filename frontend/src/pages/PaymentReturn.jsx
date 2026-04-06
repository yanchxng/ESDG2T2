import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button } from '../components/UI'
import { paymentApi } from '../api'

export function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    paymentApi.capturePayment(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [searchParams])

  return (
    <div className="fade-up" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card style={{ padding: 28, textAlign: 'center' }}>
        {status === 'processing' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>âŒ›</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Completing your payment...</div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              Please wait while we confirm your payment with PayPal.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, color: '#10b981' }}>âœ“</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment Successful</div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              Thank you! Your consultation has been fully paid.
            </p>
            <Button type="button" onClick={() => navigate('/consults')}>Back to My Consultations</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, color: '#ef4444' }}>âœ—</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment Completion Failed</div>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              We could not confirm the capture of your payment. Please contact support.
            </p>
            <Button type="button" onClick={() => navigate('/consults')}>Back to My Consultations</Button>
          </>
        )}
      </Card>
    </div>
  )
}

export function PaymentCancelled() {
  const navigate = useNavigate()
  return (
    <div className="fade-up" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, color: '#ef4444' }}>â†©</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment Cancelled</div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          No charge was completed. You can try again from My Consultations when you are ready.
        </p>
        <Button type="button" onClick={() => navigate('/consults')}>Back to My Consultations</Button>
      </Card>
    </div>
  )
}
