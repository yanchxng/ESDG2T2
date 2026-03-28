import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_patient')
      if (saved) setPatient(JSON.parse(saved))
    } catch {
      localStorage.removeItem('ml_patient')
    }
    setLoading(false)
  }, [])

  function login(patientData) {
    const p = {
      PatientID: patientData.PatientID,
      Name:      patientData.Name,
      Email:     patientData.Email,
      Address:   patientData.Address,
      DOB:       patientData.DOB,
    }
    setPatient(p)
    localStorage.setItem('ml_patient', JSON.stringify(p))
  }

  function logout() {
    setPatient(null)
    localStorage.removeItem('ml_patient')
  }

  return (
    <AuthContext.Provider value={{ patient, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
