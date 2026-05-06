import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { type Profile } from '../lib/storage'

const TOTAL = 5

const GOALS = [
  { value: 'Трачу слишком много и хочу остановиться', icon: '🛑' },
  { value: 'Хочу тратить осознаннее', icon: '🧠' },
  { value: 'Коплю на конкретную цель', icon: '🎯' },
  { value: 'Справляюсь с финансовым стрессом', icon: '😤' },
]

const TRIGGERS = [
  { value: 'Стресс или тревога', icon: '😰' },
  { value: 'Усталость после учёбы', icon: '😴' },
  { value: 'Скидки и акции', icon: '🏷️' },
  { value: 'Реклама в соцсетях', icon: '📱' },
  { value: 'Скука', icon: '😶' },
  { value: 'Влияние друзей', icon: '👥' },
]

const INTERESTS = [
  { value: 'Игры', icon: '🎮' },
  { value: 'Музыка', icon: '🎵' },
  { value: 'Мода', icon: '👗' },
  { value: 'Технологии', icon: '💻' },
  { value: 'Спорт', icon: '🏋️' },
  { value: 'Книги', icon: '📚' },
  { value: 'Путешествия', icon: '✈️' },
  { value: 'Еда', icon: '🍕' },
  { value: 'Творчество', icon: '🎨' },
  { value: 'Кино и сериалы', icon: '🎬' },
]

function Bar({ step }: { step: number }) {
  return (
    <div className="w-full bg-border rounded-full h-1 mb-10">
      <div
        className="bg-primary h-1 rounded-full transition-all duration-500"
        style={{ width: `${(step / TOTAL) * 100}%` }}
      />
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { completeOnboarding } = useProfile()
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState('')
  const [trigger, setTrigger] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [monthlySpend, setMonthlySpend] = useState(8000)
  const [savingsTarget, setSavingsTarget] = useState('')
  const [savingsMonths, setSavingsMonths] = useState('')

  function toggleInterest(v: string) {
    setInterests((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 4 ? [...prev, v] : prev,
    )
  }

  function finish(skip = false) {
    const profile: Profile = {
      goal,
      spendingTrigger: trigger,
      interests,
      monthlySpend,
      ...(!skip && savingsTarget
        ? { savingsTarget: parseFloat(savingsTarget), savingsMonths: savingsMonths ? parseInt(savingsMonths) : undefined }
        : {}),
    }
    completeOnboarding(profile)
    navigate('/')
  }

  const nav = (
    <div className="text-center mb-6">
      <span className="text-primary font-black text-3xl tracking-widest">VETO</span>
      <p className="text-muted text-sm mt-1">Шаг {step} из {TOTAL}</p>
    </div>
  )

  const back = (to: number) => (
    <button onClick={() => setStep(to)} className="flex-1 border border-border text-muted py-4 rounded-xl font-medium hover:text-white transition-colors">
      ← Назад
    </button>
  )

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {nav}
        <Bar step={step} />

        {/* Step 1 — Зачем здесь */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Зачем ты здесь?</h2>
            <p className="text-muted text-sm mb-8">Выбери, что тебе ближе всего</p>
            <div className="flex flex-col gap-3 mb-8">
              {GOALS.map((g) => (
                <button key={g.value} onClick={() => setGoal(g.value)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${goal === g.value ? 'border-primary bg-primary/10 text-white' : 'border-border bg-card text-muted hover:text-white'}`}>
                  <span className="text-2xl shrink-0">{g.icon}</span>
                  <span className="font-medium text-sm leading-snug">{g.value}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} disabled={!goal}
              className="w-full bg-primary text-black font-black py-4 rounded-xl disabled:opacity-40">
              Далее →
            </button>
          </div>
        )}

        {/* Step 2 — Триггеры */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Что заставляет тебя покупать?</h2>
            <p className="text-muted text-sm mb-8">Главная причина импульсных трат</p>
            <div className="flex flex-col gap-3 mb-8">
              {TRIGGERS.map((t) => (
                <button key={t.value} onClick={() => setTrigger(t.value)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${trigger === t.value ? 'border-primary bg-primary/10 text-white' : 'border-border bg-card text-muted hover:text-white'}`}>
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <span className="font-medium text-sm leading-snug">{t.value}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {back(1)}
              <button onClick={() => setStep(3)} disabled={!trigger}
                className="flex-1 bg-primary text-black font-black py-4 rounded-xl disabled:opacity-40">
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Интересы */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Твои интересы</h2>
            <p className="text-muted text-sm mb-2">Выбери до 4 — AI будет советовать альтернативы</p>
            <p className="text-primary text-xs font-bold mb-6">Выбрано: {interests.length} / 4</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {INTERESTS.map((i) => (
                <button key={i.value} onClick={() => toggleInterest(i.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${interests.includes(i.value) ? 'border-primary bg-primary/10 text-white' : 'border-border bg-card text-muted hover:text-white'} ${!interests.includes(i.value) && interests.length >= 4 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <span className="text-xl">{i.icon}</span>
                  <span className="font-medium text-sm">{i.value}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {back(2)}
              <button onClick={() => setStep(4)} disabled={interests.length === 0}
                className="flex-1 bg-primary text-black font-black py-4 rounded-xl disabled:opacity-40">
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Трата в месяц */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Сколько уходит спонтанно?</h2>
            <p className="text-muted text-sm mb-8">В месяц, примерно</p>
            <div className="text-center mb-6">
              <p className="text-primary font-black text-4xl">{monthlySpend.toLocaleString('ru')} ₽</p>
              <p className="text-muted text-xs mt-1">в месяц</p>
            </div>
            <input type="range" min={0} max={50000} step={500} value={monthlySpend}
              onChange={(e) => setMonthlySpend(Number(e.target.value))}
              className="w-full mb-10 accent-primary" />
            <div className="flex gap-3">
              {back(3)}
              <button onClick={() => setStep(5)} className="flex-1 bg-primary text-black font-black py-4 rounded-xl">
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Цель накоплений */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Есть цель накоплений?</h2>
            <p className="text-muted text-sm mb-8">Необязательно — можно пропустить</p>
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="text-muted text-xs font-medium block mb-1.5">Сумма (₽)</label>
                <input type="number" value={savingsTarget} onChange={(e) => setSavingsTarget(e.target.value)}
                  placeholder="например, 50 000" min={1}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-muted text-xs font-medium block mb-1.5">За сколько месяцев?</label>
                <input type="number" value={savingsMonths} onChange={(e) => setSavingsMonths(e.target.value)}
                  placeholder="например, 4" min={1} max={60}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => finish(false)} className="w-full bg-primary text-black font-black py-4 rounded-xl">
                Начать →
              </button>
              {back(4)}
              <button onClick={() => finish(true)} className="w-full text-muted text-sm py-2 hover:text-white transition-colors">
                Пропустить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
