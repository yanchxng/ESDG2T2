import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml_user')
      if (saved) setUser(JSON.parse(saved))
    } catch {
      localStorage.removeItem('ml_user')
    }
    setLoading(false)
  }, [])

  function login(userData, role) {
    const u = {
      ...userData,
      role: role, // 'patient' or 'doctor'
    }
    setUser(u)
    localStorage.setItem('ml_user', JSON.stringify(u))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('ml_user')
  }

  // Alias patient to user for backward compatibility in some components while they are refactored
  return (
    <AuthContext.Provider value={{ user, patient: user?.role === 'patient' ? user : null, doctor: user?.role === 'doctor' ? user : null, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
