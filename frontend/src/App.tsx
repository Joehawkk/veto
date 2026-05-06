import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isOnboarded } from './lib/storage'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import Check from './pages/Check'
import Result from './pages/Result'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'

function HomeGuard() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isOnboarded()) navigate('/onboarding', { replace: true })
  }, [navigate])
  return <Home />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeGuard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/check" element={<Check />} />
        <Route path="/result" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<HistoryDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
