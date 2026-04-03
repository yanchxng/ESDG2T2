import React, { createContext, useContext, useState, useEffect } from 'react'
import { signJwtHs256 } from '../utils/signJwtHs256'

const AuthContext = createContext(null)

const JWT_ISSUER = 'http://localhost:8000'
const JWT_SECRET = 'secret'

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

  async function login(userData, role) {
    const u = {
      ...userData,
      role: role, // 'patient' or 'doctor'
    }
    // iss must match jwt_secrets.key in kong.yml so Kong can verify HS256 tokens.
    const token = await signJwtHs256(
      {
        userId: userData.Id,
        role,
        iss: JWT_ISSUER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    )
    u.token = token
    setUser(u)
    localStorage.setItem('ml_user', JSON.stringify(u))
    localStorage.setItem('ml_token', token)
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('ml_user')
    localStorage.removeItem('ml_token')
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
