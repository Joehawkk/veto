import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.auth.login({ username, password })
      login(data.token, data.user_id, data.username, data.display_name, data.onboarded, data.profile_data)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'account_not_found') {
        setError('account_not_found')
      } else {
        setError('invalid_credentials')
      }
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
        <h1 className="text-2xl font-black text-dark mb-1">Добро пожаловать</h1>
        <p className="text-muted text-sm mb-8">Войди, чтобы продолжить экономить</p>

        {error && (
          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3 mb-6">
            {error === 'account_not_found' ? (
              <span>
                Аккаунта с таким именем не существует.{' '}
                <Link to="/register" className="font-bold underline hover:opacity-80">
                  Зарегистрируйтесь
                </Link>
              </span>
            ) : (
              'Неверный пароль. Попробуй ещё раз.'
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-dark text-xs font-semibold block mb-1.5">Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alex_saver"
              required
              autoComplete="username"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-dark text-xs font-semibold block mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              autoComplete="current-password"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-orange"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  )
}
