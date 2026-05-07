import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Profile, type Goal } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import BottomNav from '../components/BottomNav'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [goalTitle, setGoalTitle] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [goalLoading, setGoalLoading] = useState(false)
  const [goalSuccess, setGoalSuccess] = useState(false)
  const [goalError, setGoalError] = useState('')

  async function loadProfile() {
    try {
      const { data } = await api.profile.get()
      setProfile(data)
      if (data.active_goal) {
        setGoalTitle(data.active_goal.title)
        setGoalAmount(String(data.active_goal.target_amount))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

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
      <div className="flex justify-center items-center h-64">
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
    <div className="p-6 pb-24 max-w-lg mx-auto">

      {/* Stats */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-xl">
            {profile?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg">@{profile?.username}</p>
            <p className="text-muted text-sm">{profile?.email}</p>
          </div>
        </div>
        <div className="bg-bg rounded-xl p-4 text-center">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Всего сэкономлено</p>
          <p className="text-primary font-black text-3xl">
            {profile?.total_saved.toLocaleString('ru')} ₽
          </p>
        </div>
      </div>

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <span>🏆</span> Выполненные цели
          </h2>
          <div className="flex flex-col gap-2">
            {completedGoals.map((g: Goal) => (
              <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <p className="text-white text-sm">{g.title}</p>
                <p className="text-primary font-bold text-sm">{g.current_amount.toLocaleString('ru')} ₽</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal form */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="font-bold mb-1">
          {profile?.active_goal ? 'Активная цель' : 'Добавить цель'}
        </h2>
        <p className="text-muted text-sm mb-5">
          {profile?.active_goal
            ? 'Измени название или целевую сумму'
            : 'На что копишь? Установи цель.'}
        </p>

        {/* Active goal progress */}
        {profile?.active_goal && (
          <div className="mb-5 bg-bg rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white font-medium">{profile.active_goal.title}</span>
              <span className="text-primary font-black">
                {Math.round((profile.active_goal.current_amount / profile.active_goal.target_amount) * 100)}%
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (profile.active_goal.current_amount / profile.active_goal.target_amount) * 100)}%`,
                }}
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
            <label className="text-muted text-xs font-medium block mb-1.5">Название цели</label>
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Новый iPhone, Путешествие в Токио..."
              required
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-muted text-xs font-medium block mb-1.5">Целевая сумма (₽)</label>
            <input
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="90000"
              required
              min={1}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={goalLoading}
            className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {goalLoading ? 'Сохраняем...' : profile?.active_goal ? 'Обновить цель' : 'Создать цель'}
          </button>
        </form>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full border border-border text-muted font-medium py-3 rounded-xl hover:border-secondary hover:text-secondary transition-colors mb-3"
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
          <p className="text-white font-bold text-sm mb-1">Удалить аккаунт?</p>
          <p className="text-muted text-xs mb-4">
            Все данные будут безвозвратно удалены: цели, вето, группы.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border border-border text-muted py-2.5 rounded-xl text-sm font-medium hover:text-white transition-colors"
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
    </div>
      <BottomNav />
    </div>
  )
}
