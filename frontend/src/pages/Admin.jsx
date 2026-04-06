import React, { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { patientApi, doctorApi, fmtDate } from '../api'
import { Card, CardHeader, Input, Button, Table, Td, LoadingRow, EmptyState, DetailRow, Modal } from '../components/UI'

export default function Admin() {
  const [tab, setTab] = useState('patients')
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Admin Panel</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Manage patients and doctors</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['patients', '👥 Patients'], ['doctors', '👨‍⚕️ Doctors']].map(([key, label]) => (
          <Button key={key} variant={tab === key ? 'primary' : 'secondary'} size="sm" onClick={() => setTab(key)}>{label}</Button>
        ))}
      </div>
      {tab === 'patients' ? <PatientsTab /> : <DoctorsTab />}
    </div>
  )
}

function PatientsTab() {
  const toast = useToast()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', dob: '', address: '' })
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [creating, setCreating] = useState(false)

  function loadAll() {
    setLoading(true)
    patientApi.getAll()
      .then(data => setPatients(data.Data || data.data || []))
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(loadAll, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.dob || !form.address) { toast('Fill all fields', 'error'); return }
    setCreating(true)
    try {
      await patientApi.create({ Name: form.name, Email: form.email, Password: form.password, DOB: form.dob, Address: form.address })
      toast(`Patient "${form.name}" created!`, 'success')
      setForm({ name: '', email: '', password: '', dob: '', address: '' })
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleLookup() {
    if (!lookupId.trim()) { toast('Enter a Patient ID', 'error'); return }
    setLookupResult(null); setLookupError('')
    try {
      const data = await patientApi.getById(lookupId.trim())
      setLookupResult(data.Data || data.data || data)
    } catch (err) { setLookupError(err.message) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete patient "${name}"?`)) return
    try {
      await patientApi.delete(id)
      toast(`Patient "${name}" deleted`, 'success')
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
  }

  async function handleLookupDelete() {
    if (!lookupId.trim()) { toast('Enter a Patient ID first', 'error'); return }
    if (!window.confirm('Delete patient ' + lookupId + '?')) return
    try {
      await patientApi.delete(lookupId.trim())
      toast('Patient deleted', 'success')
      setLookupId(''); setLookupResult(null)
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card>
          <CardHeader title="Register New Patient" />
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Input label="Full Name"    placeholder="Alice Tan"          value={form.name}     onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input label="Email"        type="email" placeholder="alice@example.com" value={form.email}    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Password"     type="password" placeholder="••••••••"       value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <Input label="Date of Birth" type="date"                     value={form.dob}      onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
            </div>
            <Input label="Address" placeholder="123 Orchard Road" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Create Patient'}</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Lookup Patient by ID" />
          <Input label="Patient ID" placeholder="UUID..." value={lookupId} onChange={e => setLookupId(e.target.value)} mono />
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Button size="sm" onClick={handleLookup}>Lookup</Button>
            <Button size="sm" variant="secondary" onClick={handleLookupDelete}>Delete</Button>
          </div>
          {lookupResult && (
            <>
              <DetailRow label="Name"    value={lookupResult.Name} />
              <DetailRow label="Email"   value={lookupResult.Email} />
              <DetailRow label="Address" value={lookupResult.Address} />
              <DetailRow label="DOB"     value={fmtDate(lookupResult.DOB)} />
            </>
          )}
          {lookupError && <p style={{ fontSize: 12, color: '#ef4444' }}>{lookupError}</p>}
        </Card>
      </div>
      <Card>
        <CardHeader title="All Patients" action={<Button variant="secondary" size="sm" onClick={loadAll}>↻ Refresh</Button>} />
        {loading ? <LoadingRow /> : patients.length === 0 ? <EmptyState icon="👥" message="No patients yet." /> : (
          <Table headers={['Name', 'Email', 'Address', 'DOB', 'Patient ID', 'Actions']} rows={patients.map(p => (
            <tr key={p.PatientID} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <Td><strong>{p.Name}</strong></Td>
              <Td>{p.Email}</Td>
              <Td>{p.Address || '—'}</Td>
              <Td>{fmtDate(p.DOB)}</Td>
              <Td mono>{p.PatientID}</Td>
              <Td><Button variant="danger" size="sm" onClick={() => handleDelete(p.PatientID, p.Name)}>Delete</Button></Td>
            </tr>
          ))} />
        )}
      </Card>
    </>
  )
}

function DoctorsTab() {
  const toast = useToast()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [creating, setCreating] = useState(false)
  const [detailDoctor, setDetailDoctor] = useState(null)

  function loadAll() {
    setLoading(true)
    doctorApi.getAll()
      .then(data => setDoctors(data.Data || data.data || []))
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(loadAll, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast('Fill all fields', 'error'); return }
    setCreating(true)
    try {
      await doctorApi.create({ Name: form.name, Email: form.email, Password: form.password })
      toast(`Doctor "${form.name}" created!`, 'success')
      setForm({ name: '', email: '', password: '' })
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
    finally { setCreating(false) }
  }

  async function handleLookup() {
    if (!lookupId.trim()) { toast('Enter a Doctor ID', 'error'); return }
    setLookupResult(null); setLookupError('')
    try {
      const data = await doctorApi.getById(lookupId.trim())
      setLookupResult(data.Data || data.data || data)
    } catch (err) { setLookupError(err.message) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete doctor "${name}"?`)) return
    try {
      await doctorApi.delete(id)
      toast(`Doctor "${name}" deleted`, 'success')
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
  }

  async function handleLookupDelete() {
    if (!lookupId.trim()) { toast('Enter a Doctor ID first', 'error'); return }
    if (!window.confirm('Delete doctor ' + lookupId + '?')) return
    try {
      await doctorApi.delete(lookupId.trim())
      toast('Doctor deleted', 'success')
      setLookupId(''); setLookupResult(null)
      loadAll()
    } catch (err) { toast('Error: ' + err.message, 'error') }
  }

  return (
    <>
      <Modal open={!!detailDoctor} onClose={() => setDetailDoctor(null)} title="Doctor Profile"
        footer={<Button variant="secondary" onClick={() => setDetailDoctor(null)}>Close</Button>}>
        {detailDoctor && (
          <>
            <DetailRow label="Name"      value={detailDoctor.Name} />
            <DetailRow label="Email"     value={detailDoctor.Email} />
            <DetailRow label="Doctor ID" value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{detailDoctor.DoctorID}</span>} />
          </>
        )}
      </Modal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card>
          <CardHeader title="Register New Doctor" />
          <form onSubmit={handleCreate}>
            <Input label="Full Name" placeholder="Dr. Benjamin Lim" value={form.name}  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Input label="Email"     type="email" placeholder="benlim@medilink.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Password"  type="password" placeholder="••••••••"       value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Create Doctor'}</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Lookup Doctor by ID" />
          <Input label="Doctor ID" placeholder="UUID..." value={lookupId} onChange={e => setLookupId(e.target.value)} mono />
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Button size="sm" onClick={handleLookup}>Lookup</Button>
            <Button size="sm" variant="secondary" onClick={handleLookupDelete}>Delete</Button>
          </div>
          {lookupResult && (
            <>
              <DetailRow label="Name"  value={lookupResult.Name} />
              <DetailRow label="Email" value={lookupResult.Email} />
              <DetailRow label="ID"    value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{lookupResult.DoctorID}</span>} />
            </>
          )}
          {lookupError && <p style={{ fontSize: 12, color: '#ef4444' }}>{lookupError}</p>}
        </Card>
      </div>
      <Card>
        <CardHeader title="All Doctors" action={<Button variant="secondary" size="sm" onClick={loadAll}>↻ Refresh</Button>} />
        {loading ? <LoadingRow /> : doctors.length === 0 ? <EmptyState icon="👨‍⚕️" message="No doctors yet." /> : (
          <Table headers={['Name', 'Email', 'Doctor ID', 'Actions']} rows={doctors.map(d => (
            <tr key={d.DoctorID} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <Td><strong>{d.Name}</strong></Td>
              <Td>{d.Email}</Td>
              <Td mono>{d.DoctorID}</Td>
              <Td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" size="sm" onClick={() => setDetailDoctor(d)}>View</Button>
                  <Button variant="danger"    size="sm" onClick={() => handleDelete(d.DoctorID, d.Name)}>Delete</Button>
                </div>
              </Td>
            </tr>
          ))} />
        )}
      </Card>
    </>
  )
}
