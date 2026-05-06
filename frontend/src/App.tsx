import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { isOnboarded } from './lib/storage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Check from './pages/Check'
import Result from './pages/Result'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import ProfilePage from './pages/Profile'
import Accounts from './pages/Accounts'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function HomeGuard() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/landing', { replace: true })
    } else if (!isOnboarded()) {
      navigate('/onboarding', { replace: true })
    }
  }, [isAuthenticated, navigate])
  if (!isAuthenticated) return null
  return <Home />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root */}
          <Route path="/" element={<HomeGuard />} />

          {/* Auth-required: VETO checker */}
          <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
          <Route path="/check" element={<AuthGuard><Check /></AuthGuard>} />
          <Route path="/result" element={<AuthGuard><Result /></AuthGuard>} />
          <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
          <Route path="/history/:id" element={<AuthGuard><HistoryDetail /></AuthGuard>} />

          {/* Auth-required: Social/Dashboard */}
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/feed" element={<AuthGuard><Feed /></AuthGuard>} />
          <Route path="/groups" element={<AuthGuard><Groups /></AuthGuard>} />
          <Route path="/groups/:id" element={<AuthGuard><GroupDetail /></AuthGuard>} />
          <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
          <Route path="/accounts" element={<AuthGuard><Accounts /></AuthGuard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
