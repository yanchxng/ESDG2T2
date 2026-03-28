# MediLink Frontend

React + Vite frontend for the MediLink Teleconsult platform.

## Setup & Running

### Prerequisites
- Node.js 18+ installed

### Install dependencies
```bash
cd frontend
npm install
```

### Configure service URLs
Open `src/api/index.js` and update the `CONFIG` object with your actual service URLs:

```js
export const CONFIG = {
  patientBase: 'YOUR_OUTSYSTEMS_PATIENT_URL',  // e.g. https://xxx.outsystemscloud.com/Patient/rest/Patient
  doctorBase:  'YOUR_OUTSYSTEMS_DOCTOR_URL',   // e.g. https://xxx.outsystemscloud.com/Doctor/rest/Doctor
  consultBase: 'http://localhost:5001',         // Kushala/Lisa's Consult Service
  bookingBase: 'http://localhost:5002',         // Nigel's Make Booking composite
  ...
}
```

You can also update URLs live in the browser via the config banner at the top of the page.

### Run dev server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — stats, upcoming consults, profile |
| `/book` | Book a Consultation (Scenario 1) |
| `/consults` | My Consultations — view, join Zoom, cancel (Scenarios 2 & 3) |
| `/admin` | Admin Panel — manage patients and doctors |

## Integration Contract

### Book Consult — POST to bookingBase/booking
```json
{ "PatientID": "...", "Name": "...", "Password": "...", "DoctorID": "...", "timeslot": "2026-03-25T10:00" }
```

### Cancel Consult — POST to cancelBase/cancel
```json
{ "PatientID": "...", "ConsultID": "..." }
```

### Get Consults — GET consultBase/consult/patient/{PatientID}
Expected response:
```json
{ "Data": [{ "ConsultID": "...", "DoctorID": "...", "PatientID": "...", "Timeslot": "...", "Status": "SCHEDULED", "ZoomURL": "..." }] }
```

## Project Structure
```
src/
  api/index.js          — API helpers & CONFIG object
  context/
    AuthContext.jsx     — patient session (localStorage)
    ToastContext.jsx    — toast notifications
  components/
    UI.jsx              — reusable components (Button, Card, Modal, Table, etc.)
    Sidebar.jsx         — sidebar navigation
    ConfigBanner.jsx    — service URL config bar
    AuthModal.jsx       — login / register modal
  pages/
    Dashboard.jsx
    BookConsult.jsx
    MyConsults.jsx
    Admin.jsx
```
