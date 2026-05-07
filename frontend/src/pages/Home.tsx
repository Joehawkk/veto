import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { setCurrent } from '../lib/storage'
import { useChecks } from '../hooks/useChecks'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import BottomNav from '../components/BottomNav'
import { ClockIcon, TagIcon, MoonIcon } from '../components/Icons'
import { api, type Goal, type CheckEntry } from '../api/client'

/* ── Widget ───────────────────────────────────────────────────────────────── */

function VetoWidget({
  onVeto,
  activeGoal,
  lastStop,
  totalSaved,
  vetoCount,
}: {
  onVeto: () => void
  activeGoal: Goal | null
  lastStop: CheckEntry | null
  totalSaved: number
  vetoCount: number
}) {
  const progress = activeGoal
    ? Math.min((activeGoal.current_amount / activeGoal.target_amount) * 100, 100)
    : 0

  return (
    <div
      className="w-full rounded-[28px] overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1c1c1e 0%, #141414 100%)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Goal section */}
      {activeGoal ? (
        <div className="px-5 pt-5 pb-4">
          <p
            className="text-xs font-bold tracking-[0.15em] mb-2"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            ЦЕЛЬ: {activeGoal.title.toUpperCase()}
          </p>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-white font-black text-[26px] leading-none">
              {activeGoal.current_amount.toLocaleString('ru')} ₽
            </span>
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              из {activeGoal.target_amount.toLocaleString('ru')} ₽
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="h-[5px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #FD7203, #FF9E30)',
              }}
            />
          </div>
        </div>
      ) : (
        /* No goal yet — show savings summary */
        <div className="px-5 pt-5 pb-4">
          {totalSaved > 0 ? (
            <>
              <p
                className="text-xs font-bold tracking-[0.15em] mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                СЭКОНОМЛЕНО
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-white font-black text-[26px] leading-none">
                  {totalSaved.toLocaleString('ru')} ₽
                </span>
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {vetoCount} отказов
                </span>
              </div>
            </>
          ) : (
            <p
              className="text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Нажми VETO перед любой покупкой
            </p>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* VETO button */}
      <div className="px-5 py-4">
        <button
          onClick={onVeto}
          className="w-full py-[22px] rounded-2xl font-black text-white text-3xl tracking-[0.2em] active:scale-[0.97] transition-all select-none"
          style={{
            background: 'linear-gradient(135deg, #FD7203 0%, #E8640A 100%)',
            boxShadow: '0 4px 24px rgba(253,114,3,0.55), 0 1px 0 rgba(255,255,255,0.15) inset',
          }}
        >
          VETO
        </button>
      </div>

      {/* Footer */}
      {lastStop && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <div className="px-5 py-3.5">
            <p
              className="text-xs text-center"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              последний раз:{' '}
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{lastStop.name}</span>
              {', '}−{lastStop.price.toLocaleString('ru')} ₽
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function Home() {
  const navigate = useNavigate()
  const { checks, stats } = useChecks()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [hasDiscount, setHasDiscount] = useState(false)
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null)

  const totalSaved = stats.saved
  const vetoCount = stats.stopped
  const displayName = user?.display_name || user?.username || ''
  const lastStop = checks.find((c) => c.outcome === 'stopped') ?? null

  useEffect(() => {
    api.goals.list()
      .then(({ data }) => {
        const active = data.find((g) => g.status === 'active') ?? null
        setActiveGoal(active)
      })
      .catch(() => {})
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price) return
    setCurrent({ name: name.trim(), price: parseFloat(price), hasDiscount })
    navigate('/check')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 bg-card border-b border-border">
        <div>
          <span className="text-primary font-black text-2xl tracking-widest">VETO</span>
          <p className="text-muted text-xs mt-0.5">осознанные покупки</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-bg text-muted hover:text-dark'
            }`}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <MoonIcon size={18} />
          </button>
          <button
            onClick={logout}
            className="text-sm text-muted hover:text-secondary transition-colors"
            title="Выйти"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 py-6 pb-24 max-w-md mx-auto w-full gap-4">

        {/* Greeting */}
        {displayName && (
          <p className="text-muted text-sm">{`Привет, ${displayName}`}</p>
        )}

        {/* Widget or form */}
        {!showForm ? (
          <>
            <VetoWidget
              onVeto={() => setShowForm(true)}
              activeGoal={activeGoal}
              lastStop={lastStop}
              totalSaved={totalSaved}
              vetoCount={vetoCount}
            />

            {stats.pending > 0 && (
              <Link
                to="/history"
                className="w-full border border-primary/30 bg-primary/10 text-primary font-medium py-3 rounded-xl text-sm text-center hover:bg-primary/15 transition-colors flex items-center justify-center gap-2"
              >
                <ClockIcon size={14} /> {stats.pending}{' '}
                {stats.pending === 1 ? 'товар ждёт' : 'товара ждут'} решения
              </Link>
            )}
          </>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setShowForm(false)}
                className="text-muted hover:text-dark transition-colors text-lg"
              >
                ←
              </button>
              <h2 className="text-xl font-black text-dark">Что хочешь купить?</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                  Название товара
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="AirPods, кроссовки, курс..."
                  required
                  autoFocus
                  className="w-full bg-card border border-border rounded-xl px-4 py-4 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-card"
                />
              </div>
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                  Стоимость
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={price ? `${Number(price).toLocaleString('ru')} ₽` : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '')
                      setPrice(digits)
                    }}
                    placeholder="0 ₽"
                    required
                    className="w-full bg-card border border-border rounded-xl pl-4 pr-12 py-4 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-card"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">₽</span>
                </div>
              </div>

              {/* Discount toggle */}
              <button
                type="button"
                onClick={() => setHasDiscount(!hasDiscount)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left shadow-card ${
                  hasDiscount
                    ? 'border-primary/40 bg-primary/10 text-dark'
                    : 'border-border bg-card text-muted hover:text-dark'
                }`}
              >
                <span className="text-primary"><TagIcon size={18} /></span>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">
                    {hasDiscount ? 'Есть скидка' : 'Скидки нет'}
                  </p>
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {hasDiscount ? 'AI учтёт скидку в вердикте' : 'Нажми, если товар по акции'}
                  </p>
                </div>
                <div
                  className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${
                    hasDiscount ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-card transition-all shadow-sm ${
                      hasDiscount ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              <button
                type="submit"
                className="w-full bg-primary text-white font-black text-lg py-4 rounded-xl shadow-orange hover:shadow-orange-lg active:scale-[0.98] transition-all mt-1"
              >
                Начать проверку →
              </button>
            </form>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
