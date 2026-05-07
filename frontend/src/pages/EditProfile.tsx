import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function EditProfile() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.profile.get().then(({ data }) => {
      setDisplayName(data.display_name)
      setUsername(data.username)
      setEmail(data.email ?? '')
      setPhone(data.phone ?? '')
      if (data.avatar_url) setAvatarPreview(data.avatar_url)
    }).finally(() => setLoading(false))
  }, [])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

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
      // Upload avatar first if a file was selected
      let newAvatarUrl: string | undefined
      if (avatarFile) {
        const { data } = await api.me.uploadAvatar(avatarFile)
        newAvatarUrl = data.avatar_url
      }

      // Update other profile fields
      const updates: Parameters<typeof api.me.update>[0] = {
        display_name: displayName,
        username,
        email: email || null,
        phone: phone || null,
      }
      if (newAvatarUrl) updates.avatar_url = newAvatarUrl
      if (newPassword) {
        updates.current_password = currentPassword
        updates.new_password = newPassword
      }

      const { data: updated } = await api.me.update(updates)

      // Refresh the AuthContext so display_name/username are current everywhere
      const token = localStorage.getItem('token') ?? ''
      login(token, updated.id, updated.username, updated.display_name)

      setSuccess('Изменения сохранены!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setAvatarFile(null)
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

  const initials = (displayName || user?.username || '')[0]?.toUpperCase()

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center gap-4 px-6 py-5 bg-white border-b border-border">
        <button onClick={() => navigate('/profile')} className="text-muted hover:text-dark transition-colors text-xl">
          ←
        </button>
        <h1 className="text-xl font-black text-dark">Редактировать профиль</h1>
      </header>

      <main className="flex-1 px-6 py-6 pb-10 max-w-md mx-auto w-full flex flex-col gap-5">

        {/* Avatar picker */}
        <div className="flex flex-col items-center py-2 gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary font-black text-4xl group-hover:opacity-80 transition-opacity">
                {initials || '?'}
              </div>
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </button>
          <p className="text-muted text-xs">Нажми для выбора фото</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
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
          </div>

          {/* Password change */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card flex flex-col gap-4">
            <h2 className="font-black text-dark text-sm uppercase tracking-wider">Сменить пароль</h2>
            <p className="text-muted text-xs -mt-2">Оставь пустым, если не хочешь менять</p>

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
