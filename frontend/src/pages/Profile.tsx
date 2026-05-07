import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Profile, type Goal } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useChecks } from '../hooks/useChecks'
import BottomNav from '../components/BottomNav'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { stats } = useChecks()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Edit fields
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  // Goal fields
  const [goalTitle, setGoalTitle] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [goalLoading, setGoalLoading] = useState(false)
  const [goalSuccess, setGoalSuccess] = useState(false)
  const [goalError, setGoalError] = useState('')

  async function loadProfile() {
    try {
      const { data } = await api.profile.get()
      setProfile(data)
      setEditName(data.display_name)
      setEditEmail(data.email ?? '')
      if (data.active_goal) {
        setGoalTitle(data.active_goal.title)
        setGoalAmount(String(data.active_goal.target_amount))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    setEditSuccess(false)
    try {
      await api.me.update({
        display_name: editName,
        email: editEmail || null,
      })
      setEditSuccess(true)
      setEditMode(false)
      loadProfile()
      setTimeout(() => setEditSuccess(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setEditError(msg || 'Не удалось сохранить изменения')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleGoalSubmit(e: FormEvent) {
    e.preventDefault()
    if (!goalTitle || !goalAmount) return
    setGoalLoading(true)
    setGoalError('')
    setGoalSuccess(false)
    try {
      if (profile?.active_goal) {
        await api.goals.update(profile.active_goal.id, {
          title: goalTitle,
          target_amount: parseFloat(goalAmount),
        })
      } else {
        await api.goals.create({ title: goalTitle, target_amount: parseFloat(goalAmount) })
      }
      setGoalSuccess(true)
      loadProfile()
      setTimeout(() => setGoalSuccess(false), 3000)
    } catch {
      setGoalError('Не удалось сохранить цель.')
    } finally {
      setGoalLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/landing', { replace: true })
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    try {
      await api.profile.delete()
      logout()
      navigate('/landing', { replace: true })
    } catch {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const completedGoals = profile?.goals?.filter((g: Goal) => g.status === 'completed') ?? []

  return (
    <div className="min-h-screen bg-bg">
      <header className="px-6 py-5 bg-white border-b border-border">
        <h1 className="text-xl font-black text-dark">Профиль</h1>
      </header>

      <main className="px-6 py-6 pb-24 max-w-lg mx-auto flex flex-col gap-5">

        {/* User card */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-xl shrink-0">
              {profile?.display_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-dark text-lg truncate">{profile?.display_name}</p>
              <p className="text-muted text-sm truncate">@{profile?.username}</p>
              {profile?.email && <p className="text-muted text-xs truncate">{profile.email}</p>}
            </div>
            <button
              onClick={() => { setEditMode(!editMode); setEditError('') }}
              className="shrink-0 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {editMode ? 'Отмена' : 'Изменить'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg rounded-xl p-3 text-center">
              <p className="text-primary font-black text-xl">{stats.saved.toLocaleString('ru')} ₽</p>
              <p className="text-muted text-[10px] mt-0.5">сэкономлено</p>
            </div>
            <div className="bg-bg rounded-xl p-3 text-center">
              <p className="text-dark font-black text-xl">{stats.stopped}</p>
              <p className="text-muted text-[10px] mt-0.5">отказов</p>
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editMode && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <h2 className="font-black text-dark mb-4">Редактировать аккаунт</h2>

            {editSuccess && (
              <div className="bg-primary/10 border border-primary/30 text-primary text-sm rounded-xl px-4 py-3 mb-4">
                Изменения сохранены!
              </div>
            )}
            {editError && (
              <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3 mb-4">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Имя</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="не указан"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={editLoading}
                className="w-full bg-primary text-white font-black py-3 rounded-xl shadow-orange hover:shadow-orange-lg active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {editLoading ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </form>
          </div>
        )}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <h2 className="font-bold text-dark mb-4 flex items-center gap-2">
              <span>🏆</span> Выполненные цели
            </h2>
            <div className="flex flex-col gap-2">
              {completedGoals.map((g: Goal) => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <p className="text-dark text-sm">{g.title}</p>
                  <p className="text-primary font-bold text-sm">{g.current_amount.toLocaleString('ru')} ₽</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal form */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-1">
            {profile?.active_goal ? 'Активная цель' : 'Добавить цель'}
          </h2>
          <p className="text-muted text-sm mb-5">
            {profile?.active_goal ? 'Измени название или целевую сумму' : 'На что копишь? Установи цель.'}
          </p>

          {profile?.active_goal && (
            <div className="mb-5 bg-bg rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-dark font-medium">{profile.active_goal.title}</span>
                <span className="text-primary font-black">
                  {Math.round((profile.active_goal.current_amount / profile.active_goal.target_amount) * 100)}%
                </span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (profile.active_goal.current_amount / profile.active_goal.target_amount) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1.5">
                <span>{profile.active_goal.current_amount.toLocaleString('ru')} ₽</span>
                <span>{profile.active_goal.target_amount.toLocaleString('ru')} ₽</span>
              </div>
            </div>
          )}

          {goalSuccess && (
            <div className="bg-primary/10 border border-primary/30 text-primary text-sm rounded-xl px-4 py-3 mb-4">
              Цель сохранена!
            </div>
          )}
          {goalError && (
            <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3 mb-4">
              {goalError}
            </div>
          )}

          <form onSubmit={handleGoalSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Название цели</label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Новый iPhone, Путешествие в Токио..."
                required
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Целевая сумма (₽)</label>
              <input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="90000"
                required
                min={1}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={goalLoading}
              className="w-full bg-primary text-white font-black py-3 rounded-xl shadow-orange hover:shadow-orange-lg active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {goalLoading ? 'Сохраняем...' : profile?.active_goal ? 'Обновить цель' : 'Создать цель'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full border border-border text-muted font-medium py-3 rounded-xl hover:border-secondary hover:text-secondary transition-colors"
        >
          Выйти из аккаунта
        </button>

        {/* Delete account */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-muted/50 text-sm py-2 hover:text-secondary transition-colors"
          >
            Удалить аккаунт
          </button>
        ) : (
          <div className="bg-secondary/5 border border-secondary/30 rounded-2xl p-5">
            <p className="text-dark font-bold text-sm mb-1">Удалить аккаунт?</p>
            <p className="text-muted text-xs mb-4">
              Все данные будут безвозвратно удалены: цели, вето, группы.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-border text-muted py-2.5 rounded-xl text-sm font-medium hover:text-dark transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 bg-secondary text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleteLoading ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
