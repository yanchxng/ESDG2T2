import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { consultApi, analyticsApi, fmtDate, fmtDT } from '../api'
import { StatCard, Card, CardHeader, Badge, Button, LoadingRow, EmptyState, DetailRow } from '../components/UI'
import AuthModal from '../components/AuthModal'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'patient') return
    setLoading(true)
    consultApi.getByPatient(user.PatientID)
      .then(data => setConsults(data.Data || data.data || data || []))
      .catch(() => setConsults([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'doctor') return
    setAnalyticsLoading(true)
    analyticsApi.getDoctorAnalytics(user.DoctorID)
      .then(data => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false))
  }, [user])

  const upcoming   = consults.filter(c => { const s = (c.Status || c.status || '').toUpperCase(); return s === 'SCHEDULED' || s === 'BOOKED' })
  const completed  = consults.filter(c => (c.Status || c.status || '').toUpperCase() === 'COMPLETED')
  const cancelled  = consults.filter(c => (c.Status || c.status || '').toUpperCase() === 'CANCELLED')

  if (!user) {
    return (
      <div className="fade-up">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
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
          <Button onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>Sign In</Button>
          <Button variant="secondary" onClick={() => { setAuthMode('register'); setAuthOpen(true) }}>Create Account</Button>
        </div>
      </div>
    )
  }

  if (user?.role === 'doctor') {
    return (
      <div className="fade-up">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Welcome, {user.Name}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Manage your consultations and patients.</div>
          </div>
          <Button onClick={() => navigate('/admin')}>⚙️ Admin Panel</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard
            label="Total Consults"
            value={analyticsLoading ? '…' : analytics?.stats?.totalConsultations || 0}
            sub="all time"
            icon="📊"
            iconBg="#e0f2fe"
          />
          <StatCard
            label="Completed"
            value={analyticsLoading ? '…' : analytics?.stats?.completedConsultations || 0}
            sub="consultations"
            icon="✅"
            iconBg="#f0fdf4"
          />
          <StatCard
            label="Upcoming"
            value={analyticsLoading ? '…' : analytics?.stats?.upcomingConsultations || 0}
            sub="scheduled"
            icon="📅"
            iconBg="#fef3c7"
          />
          <StatCard
            label="Cancelled"
            value={analyticsLoading ? '…' : analytics?.stats?.cancelledConsultations || 0}
            sub="consultations"
            icon="❌"
            iconBg="#fee2e2"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
          <Card>
            <CardHeader title="Status Distribution" />
            {analyticsLoading ? <LoadingRow /> : !analytics?.stats ? (
              <EmptyState icon="📊" message="No data available" />
            ) : (
              <div style={{ height: 180, padding: '14px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: analytics.stats.completedConsultations, color: '#10b981' },
                        { name: 'Upcoming', value: analytics.stats.upcomingConsultations, color: '#f59e0b' },
                        { name: 'Cancelled', value: analytics.stats.cancelledConsultations, color: '#ef4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {[
                        { name: 'Completed', value: analytics.stats.completedConsultations, color: '#10b981' },
                        { name: 'Upcoming', value: analytics.stats.upcomingConsultations, color: '#f59e0b' },
                        { name: 'Cancelled', value: analytics.stats.cancelledConsultations, color: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value, name) => [`${value} consultations`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Completed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%' }} />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Upcoming</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Cancelled</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Peak Hours" />
            {analyticsLoading ? <LoadingRow /> : !analytics?.peakHours?.length ? (
              <EmptyState icon="🕐" message="No data" />
            ) : (
              <div style={{ height: 200, padding: '16px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.peakHours.slice(0, 8)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(hour) => `${hour}`}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Top Diagnoses" />
            {analyticsLoading ? <LoadingRow /> : !analytics?.topDiagnoses?.length ? (
              <EmptyState icon="🏥" message="No diagnosis data available" />
            ) : (
              <div style={{ padding: '8px 0' }}>
                {analytics.topDiagnoses.map((diag, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < analytics.topDiagnoses.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{diag.diagnosis}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: Math.min(diag.count * 8, 60),
                        height: 6,
                        background: '#8b5cf6',
                        borderRadius: 3
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#8b5cf6' }}>{diag.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent Patient Care" />
            {analyticsLoading ? <LoadingRow /> : !analytics?.recentDiagnoses?.length ? (
              <EmptyState icon="💊" message="No recent diagnoses" />
            ) : (
              <div style={{ padding: '8px 0' }}>
                {analytics.recentDiagnoses.map((diag, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < analytics.recentDiagnoses.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{diag.diagnosis}</span>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{fmtDate(diag.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                      Patient: {diag.patientId}
                    </div>
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>
                      💊 {diag.prescription}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 24 }}>
          <Card>
            <CardHeader title="Consultation Trends (30 Days)" />
            {analyticsLoading ? <LoadingRow /> : !analytics?.trends?.length ? (
              <EmptyState icon="📈" message="No recent consultations" />
            ) : (
              <div style={{ height: 300, padding: '16px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value, name) => [`${value} consultations`, 'Daily Count']}
                      labelFormatter={(date) => fmtDate(date)}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Monthly Summary" />
            {analyticsLoading ? <LoadingRow /> : (
              <div style={{ padding: '16px 0' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>
                    {analytics?.monthlyComparison?.currentMonth || 0}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>This month</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#6b7280' }}>
                    {analytics?.monthlyComparison?.previousMonth || 0}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Last month</div>
                </div>

                <div style={{
                  padding: '12px',
                  background: (analytics?.monthlyComparison?.growthPercentage || 0) >= 0 ? '#f0fdf4' : '#fef2f2',
                  borderRadius: 8,
                  border: `1px solid ${(analytics?.monthlyComparison?.growthPercentage || 0) >= 0 ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: (analytics?.monthlyComparison?.growthPercentage || 0) >= 0 ? '#166534' : '#991b1b'
                  }}>
                    {(analytics?.monthlyComparison?.growthPercentage || 0) >= 0 ? '↗' : '↘'} {Math.abs(analytics?.monthlyComparison?.growthPercentage || 0)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                    Growth rate
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Card>
            <CardHeader title="Recent Consultations" action={<button onClick={() => navigate('/consults')} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>View all →</button>} />
            {analyticsLoading ? <LoadingRow /> : !analytics?.recentConsultations?.length ? (
              <EmptyState icon="📋" message="No recent consultations" />
            ) : analytics.recentConsultations.map(c => (
              <ConsultRow key={c.consult_id || c.ConsultID} c={c} />
            ))}
          </Card>

          <Card>
            <CardHeader title="Doctor Profile" action={<Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Edit ⚙️</Button>} />
            <DetailRow label="Name"        value={user.Name} />
            <DetailRow label="Email"       value={user.Email} />
            <DetailRow label="Doctor ID"   value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{user.DoctorID}</span>} />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Welcome back, {user.Name.split(' ')[0]}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Here's your health overview</div>
        </div>
        <Button onClick={() => navigate('/book')}>📅 Book Consultation</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Upcoming"   value={loading ? '…' : upcoming.length}  sub="scheduled"     icon="📅" iconBg="#e0f2fe" />
        <StatCard label="Cancelled"  value={loading ? '…' : cancelled.length} sub="consultations" icon="❌" iconBg="#fee2e2" />
        <StatCard label="Completed"  value={loading ? '…' : completed.length} sub="consultations" icon="✅" iconBg="#f0fdf4" />
        <StatCard label="Total"      value={loading ? '…' : consults.length}  sub="all time"      icon="💊" iconBg="#faf5ff" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Card>
          <CardHeader title="Upcoming Consultations" action={<button onClick={() => navigate('/consults')} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>View all →</button>} />
          {loading ? <LoadingRow /> : upcoming.length === 0 ? (
            <EmptyState icon="📋" message={<>No upcoming consults. <span onClick={() => navigate('/book')} style={{ color: '#0ea5e9', cursor: 'pointer' }}>Book one now!</span></>} />
          ) : upcoming.slice(0, 3).map(c => (
            <ConsultRow key={c.ConsultID || c.consult_id} c={c} />
          ))}
        </Card>

        <Card>
          <CardHeader title="My Profile" action={<Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Edit ⚙</Button>} />
          <DetailRow label="Name"        value={user.Name} />
          <DetailRow label="Email"       value={user.Email} />
          <DetailRow label="Address"     value={user.Address} />
          <DetailRow label="Date of Birth" value={fmtDate(user.DOB)} />
          <DetailRow label="Patient ID"  value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{user.PatientID}</span>} />
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
