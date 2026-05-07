import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { setCurrent } from '../lib/storage'
import { useChecks } from '../hooks/useChecks'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import BottomNav from '../components/BottomNav'
import { ClockIcon, TagIcon, MoonIcon } from '../components/Icons'

export default function Home() {
  const navigate = useNavigate()
  const { stats } = useChecks()
  const { profile } = useProfile()
  const { user, logout } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [hasDiscount, setHasDiscount] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price) return
    setCurrent({ name: name.trim(), price: parseFloat(price), hasDiscount })
    navigate('/check')
  }

  const { theme, toggleTheme } = useTheme()
  const totalSaved = stats.saved
  const vetoCount = stats.stopped
  const hasSaved = totalSaved > 0 || vetoCount > 0
  const displayName = user?.display_name || user?.username || ''

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

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-6 pb-24 max-w-md mx-auto w-full gap-4">

        {/* Greeting */}
        {displayName && (
          <p className="text-muted text-sm self-start">Привет, {displayName}</p>
        )}

        {/* Savings stats */}
        {hasSaved && (
          <div className="w-full bg-card border border-border rounded-2xl p-4 shadow-card">
            <p className="text-muted text-xs uppercase tracking-wider font-semibold mb-2">Твой прогресс</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-primary font-black text-3xl leading-tight">
                  {totalSaved.toLocaleString('ru')} ₽
                </p>
                <p className="text-muted text-xs mt-0.5">сэкономлено всего</p>
              </div>
              <div className="text-right">
                <p className="text-dark font-black text-xl">{vetoCount}</p>
                <p className="text-muted text-xs">отказов</p>
              </div>
            </div>
          </div>
        )}

        {/* Hero or form */}
        {!showForm ? (
          <div className="w-full flex flex-col items-center text-center gap-5 mt-2">
            {/* Hero text */}
            <div className="w-full text-center">
              <p className="text-muted text-xs font-semibold uppercase tracking-widest mb-2">Перед покупкой</p>
              <h1 className="text-4xl font-black text-dark leading-tight mb-2">
                Хочешь что-то<br />
                <span className="text-primary">купить?</span>
              </h1>
              <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
                4 быстрых вопроса — и честный AI-вердикт.<br />
                Помогаем не тратить деньги на эмоциях.
              </p>
            </div>

            {/* Animated home icon */}
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full animate-ping-slow" style={{ background: 'rgba(253,114,3,0.15)' }} />
              <div className="relative w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
                </svg>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-primary text-white font-black text-lg py-4 rounded-2xl shadow-orange hover:shadow-orange-lg active:scale-[0.97] transition-all"
            >
              Хочу совершить покупку →
            </button>

            {stats.pending > 0 && (
              <Link
                to="/history"
                className="w-full border border-primary/30 bg-primary/10 text-primary font-medium py-3 rounded-xl text-sm text-center hover:bg-primary/15 transition-colors flex items-center justify-center gap-2"
              >
                <ClockIcon size={14} /> {stats.pending} {stats.pending === 1 ? 'товар ждёт' : 'товара ждут'} решения
              </Link>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-dark transition-colors text-lg">
                ←
              </button>
              <h2 className="text-xl font-black text-dark">Что хочешь купить?</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Название товара</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="AirPods, кроссовки, курс..." required autoFocus
                  className="w-full bg-card border border-border rounded-xl px-4 py-4 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-card"
                />
              </div>
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Стоимость</label>
                <div className="relative">
                  <input
                    type="text" value={price ? `${Number(price).toLocaleString('ru')} ₽` : ''} onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '')
                      setPrice(digits)
                    }}
                    placeholder="0 ₽" required
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
                    ? 'border-[#FF9E30] bg-[#FFDE8A]/30 text-dark'
                    : 'border-border bg-card text-muted hover:text-dark'
                }`}
              >
                <span className="text-[#F86D06]"><TagIcon size={18} /></span>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{hasDiscount ? 'Есть скидка' : 'Скидки нет'}</p>
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {hasDiscount ? 'AI учтёт скидку в вердикте' : 'Нажми, если товар по акции'}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${hasDiscount ? 'bg-primary' : 'bg-border'}`}>
                  <div className={`w-4 h-4 rounded-full bg-card transition-all shadow-sm ${hasDiscount ? 'translate-x-4' : 'translate-x-0'}`} />
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
