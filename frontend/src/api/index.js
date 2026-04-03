// ─── SERVICE URLs ───────────────────────────────────────────
// Update these to point at your group's running services.
// Patient & Doctor: your OutSystems personal environment
// Others: your group's Python/Flask microservices
export const CONFIG = {
  patientBase: 'https://personal-dzt0acam.outsystemscloud.com/Patient/rest/Patient',
  doctorBase: 'https://personal-dzt0acam.outsystemscloud.com/Doctor/rest/Doctor',
  consultBase: 'http://localhost:5003',       // Kushala/Lisa — Consult Service
  bookingBase: 'http://localhost:4001',       // Nigel — Make Booking composite
  cancelBase: 'http://localhost:4003',       // Nigel — Cancel Booking composite
  consultDoctorBase: 'http://localhost:5003',       // Nigel — Consult Doctor composite
  diagnosisBase: 'http://localhost:5004',       // Aaliya — Diagnosis Service
  paymentBase: 'http://localhost:5005',       // Aaliya — Payment Service
}

// ─── GENERIC FETCH WRAPPER ──────────────────────────────────
export async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) {
    const msg = data?.Errors?.[0] || data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

// ─── PATIENT SERVICE ────────────────────────────────────────
export const patientApi = {
  getAll: () => apiFetch(`${CONFIG.patientBase}/patient/`),
  getById: (id) => apiFetch(`${CONFIG.patientBase}/patient/${id}/`),
  create: (body) => apiFetch(`${CONFIG.patientBase}/patient/`, { method: 'POST', body: JSON.stringify(body) }),
  update: (body) => apiFetch(`${CONFIG.patientBase}/patient/`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`${CONFIG.patientBase}/patient/${id}/`, { method: 'DELETE' }),
}

// ─── DOCTOR SERVICE ─────────────────────────────────────────
export const doctorApi = {
  getAll: () => apiFetch(`${CONFIG.doctorBase}/doctor/`),
  getById: (id) => apiFetch(`${CONFIG.doctorBase}/doctor/${id}/`),
  create: (body) => apiFetch(`${CONFIG.doctorBase}/doctor/`, { method: 'POST', body: JSON.stringify(body) }),
  update: (body) => apiFetch(`${CONFIG.doctorBase}/doctor/`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`${CONFIG.doctorBase}/doctor/${id}/`, { method: 'DELETE' }),
}

// ─── CONSULT SERVICE ────────────────────────────────────────
export const consultApi = {
  getByPatient: (patientId) => apiFetch(`${CONFIG.consultBase}/api/consults/patient/${patientId}`),
  getByDoctor: (doctorId) => apiFetch(`${CONFIG.consultBase}/api/consults/doctor/${doctorId}`),
  getById: (id) => apiFetch(`${CONFIG.consultBase}/api/consults/${id}`),
}

// ─── COMPOSITE SERVICES ─────────────────────────────────────
export const compositeApi = {
  getCapacity: (date) => apiFetch(`${CONFIG.bookingBase}/api/booking/capacity?date=${date}`),
  makeBooking: (body) => apiFetch(`${CONFIG.bookingBase}/api/booking`, { method: 'POST', body: JSON.stringify(body) }),
  cancelBooking: (body) => apiFetch(`${CONFIG.cancelBase}/api/booking/cancel`, { method: 'POST', body: JSON.stringify(body) }),
  consultDoctor: (body) => apiFetch(`${CONFIG.consultDoctorBase}/consult-doctor`, { method: 'POST', body: JSON.stringify(body) }),
}

// ─── HELPERS ────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—'
  // If it's a simple YYYY-MM-DD string, don't append timezone offset to prevent Invalid Date errors
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  // Strip backend timezone artifacts and force it to be interpreted as Singapore Time
  const raw = d.replace(/(Z|[+-]\d{2}:\d{2})$/, '') + '+08:00'
  return new Date(raw).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}

export function fmtDT(d) {
  if (!d) return '—'
  // Strip backend timezone artifacts and force it to be interpreted as Singapore Time
  const raw = d.replace(/(Z|[+-]\d{2}:\d{2})$/, '') + '+08:00'
  return new Date(raw).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })
}

export function getInitial(name) {
  return name ? name[0].toUpperCase() : '?'
}
