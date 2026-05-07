import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.auth.register({ username, display_name: displayName, password })
      login(data.token, data.user_id, data.username, data.display_name)
      navigate('/onboarding', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Ошибка регистрации. Попробуй снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <Link to="/" className="text-primary font-black text-2xl tracking-widest mb-10">
        VETO
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-card">
        <h1 className="text-2xl font-black text-dark mb-1">Создай аккаунт</h1>
        <p className="text-muted text-sm mb-8">Начни экономить и флексить на других</p>

        {error && (
          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-dark text-xs font-semibold block mb-1.5">Имя для отображения</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Александр"
              required
              minLength={2}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-dark text-xs font-semibold block mb-1.5">Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="alex_saver"
              required
              minLength={2}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-muted text-xs mt-1">Только латиница, цифры и _</p>
          </div>
          <div>
            <label className="text-dark text-xs font-semibold block mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
              required
              minLength={6}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-orange"
          >
            {loading ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
