// ─── SERVICE URLs ───────────────────────────────────────────
// Patient & Doctor: OutSystems. Kong-backed APIs: dev uses Vite proxy /kong → Kong (same-origin, no CORS).
// Production: set VITE_KONG_BASE at build time (e.g. https://api.example.com) or defaults to http://localhost:8000
const kongBase =
  (import.meta.env.VITE_KONG_BASE && String(import.meta.env.VITE_KONG_BASE).replace(/\/$/, '')) ||
  (import.meta.env.DEV ? '/kong' : 'http://localhost:8000')

export const CONFIG = {
  patientBase: 'https://personal-dzt0acam.outsystemscloud.com/Patient/rest/Patient',
  doctorBase: 'https://personal-dzt0acam.outsystemscloud.com/Doctor/rest/Doctor',
  consultBase: `${kongBase}/consult`,
  bookingBase: `${kongBase}/booking`,
  cancelBase: `${kongBase}/cancel-booking`,
  consultDoctorBase: `${kongBase}/consult-doctor`,
  diagnosisBase: `${kongBase}/diagnosis`,
  paymentBase: `${kongBase}/payment`,
}

// ─── GENERIC FETCH WRAPPER ──────────────────────────────────
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('ml_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Network error (no response from server): ${msg}`)
  }
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
  consultDoctor: (body) => apiFetch(`${CONFIG.consultDoctorBase}/api/consultation/complete`, { method: 'POST', body: JSON.stringify(body) }),
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

export const diagnosisApi = {
  getByConsult: (consultId) => apiFetch(`${CONFIG.diagnosisBase}/api/diagnoses/${consultId}`),
}
