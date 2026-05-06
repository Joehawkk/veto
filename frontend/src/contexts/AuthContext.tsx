import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthUser {
  id: string
  username: string
  display_name: string
}

interface AuthContextType {
  token: string | null
  user: AuthUser | null
  login: (token: string, userId: string, username: string, displayName: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  const login = useCallback((token: string, userId: string, username: string, displayName: string) => {
    const u: AuthUser = { id: userId, username, display_name: displayName }
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(token)
    setUser(u)
    window.dispatchEvent(new Event('veto-auth-change'))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('veto_current')
    sessionStorage.removeItem('veto_result')
    setToken(null)
    setUser(null)
    window.dispatchEvent(new Event('veto-auth-change'))
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
