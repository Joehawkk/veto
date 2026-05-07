import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type UserProfile } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function EditProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    api.profile.get().then(({ data }) => {
      setProfile(data)
      setDisplayName(data.display_name)
      setUsername(data.username)
      setEmail(data.email ?? '')
      setPhone(data.phone ?? '')
      setAvatarUrl(data.avatar_url ?? '')
    }).finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword && newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (newPassword && !currentPassword) {
      setError('Введи текущий пароль для смены пароля')
      return
    }

    setSaving(true)
    try {
      const updates: Parameters<typeof api.me.update>[0] = {}
      if (displayName !== profile?.display_name) updates.display_name = displayName
      if (username !== profile?.username) updates.username = username
      updates.email = email || null
      updates.phone = phone || null
      updates.avatar_url = avatarUrl || null
      if (newPassword) {
        updates.current_password = currentPassword
        updates.new_password = newPassword
      }

      await api.me.update(updates)
      setSuccess('Изменения сохранены!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => navigate('/profile'), 1200)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Не удалось сохранить изменения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = (displayName || user?.display_name || '?')[0]?.toUpperCase()

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center gap-4 px-6 py-5 bg-white border-b border-border">
        <button onClick={() => navigate('/profile')} className="text-muted hover:text-dark transition-colors text-xl">
          ←
        </button>
        <h1 className="text-xl font-black text-dark">Редактировать профиль</h1>
      </header>

      <main className="flex-1 px-6 py-6 pb-10 max-w-md mx-auto w-full flex flex-col gap-5">

        {/* Avatar preview */}
        <div className="flex justify-center py-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/30" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary font-black text-3xl">
              {initials}
            </div>
          )}
        </div>

        {success && (
          <div className="bg-primary/10 border border-primary/30 text-primary text-sm rounded-xl px-4 py-3">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Basic info */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card flex flex-col gap-4">
            <h2 className="font-black text-dark text-sm uppercase tracking-wider">Основное</h2>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Имя</label>
              <input
                type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Логин</label>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="не указан"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Телефон</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+79001234567"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Аватар (URL)</label>
              <input
                type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Password change */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card flex flex-col gap-4">
            <h2 className="font-black text-dark text-sm uppercase tracking-wider">Сменить пароль</h2>
            <p className="text-muted text-xs -mt-2">Оставь пустым, если не хочешь менять пароль</p>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Текущий пароль</label>
              <input
                type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Новый пароль</label>
              <input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="минимум 6 символов"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Повторить пароль</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-white font-black text-lg py-4 rounded-xl shadow-orange hover:shadow-orange-lg active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {saving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
        </form>
      </main>
    </div>
  )
}
