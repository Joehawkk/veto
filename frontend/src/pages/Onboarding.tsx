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
    <div className="w-full bg-border rounded-full h-1.5 mb-10">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{
          width: `${(step / TOTAL) * 100}%`,
          background: 'linear-gradient(90deg, #FD7203, #F86D06)',
        }}
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
    <button
      onClick={() => setStep(to)}
      className="flex-1 border border-border bg-white text-gray-dark py-4 rounded-xl font-medium hover:border-border-dark transition-colors shadow-card"
    >
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
            <h2 className="text-2xl font-black text-dark mb-1">Зачем ты здесь?</h2>
            <p className="text-muted text-sm mb-8">Выбери, что тебе ближе всего</p>
            <div className="flex flex-col gap-3 mb-8">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all shadow-card ${
                    goal === g.value
                      ? 'border-primary bg-primary/10 text-dark'
                      : 'border-border bg-white text-gray-dark hover:border-primary/40'
                  }`}
                >
                  <span className="text-2xl shrink-0">{g.icon}</span>
                  <span className="font-medium text-sm leading-snug">{g.value}</span>
                  {goal === g.value && <span className="ml-auto text-primary shrink-0">✓</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!goal}
              className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange disabled:opacity-40 disabled:shadow-none transition-all"
            >
              Далее →
            </button>
          </div>
        )}

        {/* Step 2 — Триггеры */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black text-dark mb-1">Что заставляет тебя покупать?</h2>
            <p className="text-muted text-sm mb-8">Главная причина импульсных трат</p>
            <div className="flex flex-col gap-3 mb-8">
              {TRIGGERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTrigger(t.value)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all shadow-card ${
                    trigger === t.value
                      ? 'border-primary bg-primary/10 text-dark'
                      : 'border-border bg-white text-gray-dark hover:border-primary/40'
                  }`}
                >
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <span className="font-medium text-sm leading-snug">{t.value}</span>
                  {trigger === t.value && <span className="ml-auto text-primary shrink-0">✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {back(1)}
              <button
                onClick={() => setStep(3)}
                disabled={!trigger}
                className="flex-1 bg-primary text-white font-black py-4 rounded-xl shadow-orange disabled:opacity-40 disabled:shadow-none transition-all"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Интересы */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black text-dark mb-1">Твои интересы</h2>
            <p className="text-muted text-sm mb-2">Выбери до 4 — AI будет советовать альтернативы</p>
            <p className="text-primary text-xs font-bold mb-6">Выбрано: {interests.length} / 4</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {INTERESTS.map((i) => {
                const selected = interests.includes(i.value)
                const disabled = !selected && interests.length >= 4
                return (
                  <button
                    key={i.value}
                    onClick={() => toggleInterest(i.value)}
                    disabled={disabled}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all shadow-card ${
                      selected
                        ? 'border-primary bg-primary/10 text-dark'
                        : disabled
                        ? 'border-border bg-white text-muted opacity-40 cursor-not-allowed'
                        : 'border-border bg-white text-gray-dark hover:border-primary/40'
                    }`}
                  >
                    <span className="text-xl">{i.icon}</span>
                    <span className="font-medium text-sm">{i.value}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              {back(2)}
              <button
                onClick={() => setStep(4)}
                disabled={interests.length === 0}
                className="flex-1 bg-primary text-white font-black py-4 rounded-xl shadow-orange disabled:opacity-40 disabled:shadow-none transition-all"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Трата в месяц */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-black text-dark mb-1">Сколько уходит спонтанно?</h2>
            <p className="text-muted text-sm mb-8">В месяц, примерно</p>
            <div className="bg-white border border-border rounded-2xl p-6 text-center mb-6 shadow-card">
              <p className="text-primary font-black text-5xl">{monthlySpend.toLocaleString('ru')}</p>
              <p className="text-muted text-sm mt-2 font-medium">₽ в месяц</p>
            </div>
            <input
              type="range" min={0} max={50000} step={500} value={monthlySpend}
              onChange={(e) => setMonthlySpend(Number(e.target.value))}
              className="w-full mb-10"
              style={{ accentColor: '#FD7203' }}
            />
            <div className="flex gap-3">
              {back(3)}
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-primary text-white font-black py-4 rounded-xl shadow-orange transition-all"
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Цель накоплений */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-black text-dark mb-1">Есть цель накоплений?</h2>
            <p className="text-muted text-sm mb-8">Необязательно — можно пропустить</p>
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">Сумма (₽)</label>
                <input
                  type="number" value={savingsTarget} onChange={(e) => setSavingsTarget(e.target.value)}
                  placeholder="например, 50 000" min={1}
                  className="w-full bg-white border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-card"
                />
              </div>
              <div>
                <label className="text-muted text-xs font-semibold block mb-1.5 uppercase tracking-wide">За сколько месяцев?</label>
                <input
                  type="number" value={savingsMonths} onChange={(e) => setSavingsMonths(e.target.value)}
                  placeholder="например, 4" min={1} max={60}
                  className="w-full bg-white border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-card"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => finish(false)}
                className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange transition-all"
              >
                Начать →
              </button>
              {back(4)}
              <button
                onClick={() => finish(true)}
                className="w-full text-muted text-sm py-2 hover:text-dark transition-colors"
              >
                Пропустить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
