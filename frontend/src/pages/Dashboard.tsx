import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Goal } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

function VetoModal({
  goals,
  onClose,
  onSuccess,
}: {
  goals: Goal[]
  onClose: () => void
  onSuccess: (completed: boolean, goalTitle?: string) => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [goalId, setGoalId] = useState<number | null>(
    goals.find((g) => g.status === 'active')?.id ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!description || !amount) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.vetos.create({
        description,
        amount: parseFloat(amount),
        goal_id: goalId,
      })
      const completedGoal = goals.find((g) => g.id === goalId)
      onSuccess(data.goal_completed, data.goal_completed ? completedGoal?.title : undefined)
    } catch {
      setError('Ошибка. Попробуй снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black">От чего отказываемся?</h2>
          <button onClick={onClose} className="text-muted hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-muted text-sm mb-6">Зафикси отказ и получи Respect от комьюнити</p>

        {error && (
          <div className="bg-secondary/10 text-secondary text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-muted text-xs font-medium block mb-1.5">От чего отказался?</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кофе, такси, одежда..."
              required
              autoFocus
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-muted text-xs font-medium block mb-1.5">Сумма (₽)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="350"
              required
              min={1}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Goal selector */}
          {goals.length > 0 && (
            <div>
              <label className="text-muted text-xs font-medium block mb-1.5">Зачислить в цель</label>
              <select
                value={goalId ?? ''}
                onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
              >
                <option value="">Без цели</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.current_amount.toLocaleString('ru')} / {g.target_amount.toLocaleString('ru')} ₽)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-black font-black text-lg py-4 rounded-xl shadow-neon-green hover:shadow-neon-green-lg transition-all disabled:opacity-60 mt-2"
          >
            {loading ? 'Сохраняем...' : '✓ Подтвердить VETO'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    try {
      const { data } = await api.profile.get()
      setActiveGoal(data.active_goal ?? null)
      setGoals(data.goals ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  function handleVetoSuccess(goalCompleted: boolean, goalTitle?: string) {
    setModalOpen(false)
    if (goalCompleted && goalTitle) {
      setSuccessMsg(`🎉 Цель «${goalTitle}» выполнена! Так держать!`)
    } else {
      setSuccessMsg('⚡ VETO засчитан! Комьюнити видит твой отказ.')
    }
    loadProfile()
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  const progress = activeGoal
    ? Math.min(100, Math.round((activeGoal.current_amount / activeGoal.target_amount) * 100))
    : 0

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-8">
        <p className="text-muted text-sm">Привет,</p>
        <h1 className="text-2xl font-black">@{user?.username}</h1>
      </div>

      {successMsg && (
        <div className="bg-primary/10 border border-primary/30 text-primary text-sm rounded-xl px-4 py-3 mb-6 animate-pulse">
          {successMsg}
        </div>
      )}

      {/* Completed goals */}
      {!loading && goals.filter((g) => g.status === 'completed').length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {goals.filter((g) => g.status === 'completed').map((g) => (
            <div key={g.id} className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <div className="flex-1">
                <p className="text-primary font-bold text-sm">{g.title}</p>
                <p className="text-muted text-xs">Цель выполнена!</p>
              </div>
              <span className="text-primary font-black text-sm">
                {g.current_amount.toLocaleString('ru')} ₽
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Active goal card */}
      {!loading && (
        activeGoal ? (
          <div className={`bg-card border rounded-2xl p-5 mb-8 ${activeGoal.status === 'completed' ? 'border-primary/40' : 'border-border'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-muted text-xs uppercase tracking-wider mb-1">Текущая цель</p>
                <p className="text-white font-bold text-lg">{activeGoal.title}</p>
              </div>
              <div className="text-right">
                <p className="text-primary font-black text-xl">
                  {activeGoal.current_amount.toLocaleString('ru')} ₽
                </p>
                <p className="text-muted text-xs">из {activeGoal.target_amount.toLocaleString('ru')} ₽</p>
              </div>
            </div>
            <div className="w-full bg-border rounded-full h-2.5 mb-2">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{progress}% выполнено</span>
              {progress < 100 ? (
                <span>осталось {(activeGoal.target_amount - activeGoal.current_amount).toLocaleString('ru')} ₽</span>
              ) : (
                <span className="text-primary font-bold">🎉 Достигнуто!</span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-2xl p-5 mb-8 text-center">
            <p className="text-muted text-sm mb-2">Цель не установлена</p>
            <Link to="/profile" className="text-primary text-sm font-medium hover:underline">
              Добавить цель →
            </Link>
          </div>
        )
      )}

      {/* VETO button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setModalOpen(true)}
          className="w-48 h-48 rounded-full bg-primary text-black font-black text-3xl tracking-widest shadow-neon-green hover:shadow-neon-green-lg active:scale-95 transition-all duration-150"
        >
          VETO
        </button>
        <p className="text-muted text-sm text-center">
          Нажми, когда хочешь отказаться от траты
        </p>
      </div>

      {modalOpen && (
        <VetoModal
          goals={goals.filter((g) => g.status !== 'completed')}
          onClose={() => setModalOpen(false)}
          onSuccess={handleVetoSuccess}
        />
      )}
    </div>
  )
}
