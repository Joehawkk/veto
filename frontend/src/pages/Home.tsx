import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { setCurrent } from '../lib/storage'
import { useHistory } from '../hooks/useHistory'
import { useProfile } from '../hooks/useProfile'

export default function Home() {
  const navigate = useNavigate()
  const { stats } = useHistory()
  const { profile } = useProfile()
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

  const hasSaved = stats.saved > 0 || stats.stopped > 0

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div>
          <span className="text-primary font-black text-2xl tracking-widest">VETO</span>
          <p className="text-muted text-xs">осознанные покупки</p>
        </div>
        <Link to="/history" className="text-muted text-sm hover:text-white transition-colors flex items-center gap-1.5">
          <span>📋</span><span>История</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full gap-6">

        {/* Greeting */}
        {profile && (
          <p className="text-muted text-sm self-start">
            Привет{profile.goal ? ` — ты здесь, чтобы "${profile.goal.toLowerCase()}"` : ''} 👋
          </p>
        )}

        {/* Savings stats */}
        {hasSaved && (
          <div className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-5">
            <p className="text-muted text-xs uppercase tracking-wider mb-3">Твой прогресс</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-primary font-black text-3xl leading-tight">
                  {stats.saved.toLocaleString('ru')} ₽
                </p>
                <p className="text-muted text-xs mt-1">сэкономлено всего</p>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-xl">{stats.stopped}</p>
                <p className="text-muted text-xs">отказов</p>
              </div>
            </div>
          </div>
        )}

        {/* Hero or form */}
        {!showForm ? (
          <div className="w-full flex flex-col items-center text-center gap-6">
            <div>
              <h1 className="text-4xl font-black text-white leading-tight mb-3">
                Хочешь что-то<br />
                <span className="text-primary">купить?</span>
              </h1>
              <p className="text-muted text-base leading-relaxed">
                4 быстрых вопроса — и честный AI-вердикт.<br />
                Помогаем не тратить деньги на эмоциях.
              </p>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-primary text-black font-black text-xl py-5 rounded-2xl shadow-neon-green hover:shadow-neon-green-lg active:scale-[0.97] transition-all"
            >
              Хочу совершить покупку →
            </button>

            {stats.pending > 0 && (
              <Link to="/history"
                className="w-full border border-yellow-400/30 bg-yellow-400/5 text-yellow-400 font-medium py-3 rounded-xl text-sm text-center hover:bg-yellow-400/10 transition-colors">
                ⏳ {stats.pending} {stats.pending === 1 ? 'товар ждёт' : 'товара ждут'} решения
              </Link>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-white transition-colors">
                ←
              </button>
              <h2 className="text-xl font-black text-white">Что хочешь купить?</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-muted text-xs font-medium block mb-1.5">Название товара</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="AirPods, кроссовки, курс..." required autoFocus
                  className="w-full bg-card border border-border rounded-xl px-4 py-4 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors text-base"
                />
              </div>
              <div>
                <label className="text-muted text-xs font-medium block mb-1.5">Стоимость</label>
                <div className="relative">
                  <input
                    type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0" required min={1}
                    className="w-full bg-card border border-border rounded-xl pl-4 pr-12 py-4 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors text-base"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">₽</span>
                </div>
              </div>

              {/* Discount toggle */}
              <button type="button" onClick={() => setHasDiscount(!hasDiscount)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${hasDiscount ? 'border-yellow-400/50 bg-yellow-400/10 text-white' : 'border-border bg-card text-muted hover:text-white'}`}>
                <span className="text-xl">🏷️</span>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{hasDiscount ? 'Есть скидка' : 'Скидки нет'}</p>
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {hasDiscount ? 'Спросим: купил бы без скидки?' : 'Нажми, если товар по акции'}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${hasDiscount ? 'bg-yellow-400' : 'bg-border'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-all ${hasDiscount ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              <button type="submit"
                className="w-full bg-primary text-black font-black text-lg py-4 rounded-xl shadow-neon-green active:scale-[0.98] transition-all mt-1">
                Начать проверку →
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
