import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrent, setCheckResult, type CheckAnswers, type MoodValue, type ThoughtDuration } from '../lib/storage'
import { getLocalVerdict } from '../lib/scoring'

/* ── Fixed 4 questions ─────────────────────────── */
type StepKey = 'needNow' | 'hasSimilar' | 'duration' | 'mood'

const STEPS: StepKey[] = ['needNow', 'hasSimilar', 'duration', 'mood']

const STEP_META: Record<StepKey, { title: string; subtitle: string; category: string; categoryColor: string }> = {
  needNow: {
    title: 'Ты реально нуждаешься в этом прямо сейчас?',
    subtitle: 'Не "хочу", а именно "нужно" — сегодня',
    category: 'ПОТРЕБНОСТЬ',
    categoryColor: 'text-primary bg-primary/10',
  },
  hasSimilar: {
    title: 'Есть ли у тебя что-то похожее на этот товар?',
    subtitle: 'Похожее по функции, даже если не идентичное',
    category: 'ПОТРЕБНОСТЬ',
    categoryColor: 'text-primary bg-primary/10',
  },
  duration: {
    title: 'Как долго ты думал об этой покупке?',
    subtitle: 'Честно — когда впервые захотел?',
    category: 'ЛОГИКА',
    categoryColor: 'text-blue-400 bg-blue-400/10',
  },
  mood: {
    title: 'Как ты сейчас себя чувствуешь?',
    subtitle: 'Эмоции влияют на решения о покупках',
    category: 'ЭМОЦИИ',
    categoryColor: 'text-yellow-400 bg-yellow-400/10',
  },
}

const DURATION_OPTIONS: { value: ThoughtDuration; label: string; icon: string; sub: string }[] = [
  { value: '30min', label: '30 минут', icon: '⚡', sub: 'только что захотел' },
  { value: '1hour', label: '1 час', icon: '☕', sub: 'недавно увидел' },
  { value: '24hours', label: '24 часа', icon: '🌙', sub: 'вчера заметил' },
  { value: '3days', label: '3+ дня', icon: '📅', sub: 'давно думаю' },
]

const MOOD_OPTIONS: { value: MoodValue; emoji: string; label: string; isGood: boolean }[] = [
  { value: 'good', emoji: '😊', label: 'Хорошо', isGood: true },
  { value: 'neutral', emoji: '😐', label: 'Нейтрально', isGood: true },
  { value: 'sad', emoji: '😔', label: 'Грустно', isGood: false },
  { value: 'angry', emoji: '😠', label: 'Злюсь', isGood: false },
  { value: 'stressed', emoji: '😰', label: 'Стрессую', isGood: false },
  { value: 'tired', emoji: '😴', label: 'Устал', isGood: false },
]

export default function Check() {
  const navigate = useNavigate()
  const [current] = useState(() => getCurrent())
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<CheckAnswers>>({})
  const [visible, setVisible] = useState(true)

  useEffect(() => { if (!current) navigate('/') }, [current, navigate])
  if (!current) return null

  const stepKey = STEPS[step]
  const meta = STEP_META[stepKey]
  const progress = (step / STEPS.length) * 100

  function advance(partial: Partial<CheckAnswers>) {
    const newAnswers = { ...answers, ...partial }
    setVisible(false)
    setTimeout(() => {
      if (step < STEPS.length - 1) {
        setAnswers(newAnswers)
        setStep(step + 1)
        setVisible(true)
      } else {
        const complete = newAnswers as CheckAnswers
        const localVerdict = getLocalVerdict(complete)
        setCheckResult({ answers: complete, localVerdict })
        navigate('/result')
      }
    }, 200)
  }

  function goBack() {
    if (step === 0) { navigate('/'); return }
    setVisible(false)
    setTimeout(() => { setStep(step - 1); setVisible(true) }, 150)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Progress */}
      <div className="w-full bg-border h-1">
        <div className="bg-primary h-1 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <button onClick={goBack} className="text-muted hover:text-white transition-colors text-sm">← Назад</button>
          <p className="text-muted text-sm font-medium">Вопрос {step + 1} из {STEPS.length}</p>
          <div className="w-16" />
        </div>

        {/* Question */}
        <div
          className="flex-1 flex flex-col justify-center transition-all duration-200"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)' }}
        >
          <div className="bg-card border border-border rounded-3xl p-8 mb-8">
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-6 ${meta.categoryColor}`}>
              {meta.category}
            </span>
            <h2 className="text-2xl font-black text-white leading-snug mb-3">{meta.title}</h2>
            <p className="text-muted text-sm">{meta.subtitle}</p>
          </div>

          {/* Yes / No */}
          {(stepKey === 'needNow' || stepKey === 'hasSimilar') && (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => advance({ [stepKey]: true })}
                className="py-5 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary font-black text-lg hover:bg-primary/15 hover:border-primary active:scale-95 transition-all">
                ✅ Да
              </button>
              <button onClick={() => advance({ [stepKey]: false })}
                className="py-5 rounded-2xl border-2 border-border bg-card text-muted font-black text-lg hover:bg-border hover:text-white active:scale-95 transition-all">
                ❌ Нет
              </button>
            </div>
          )}

          {/* Duration */}
          {stepKey === 'duration' && (
            <div className="grid grid-cols-2 gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => advance({ thoughtDuration: opt.value })}
                  className="flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 hover:text-white active:scale-95 transition-all">
                  <span className="text-3xl">{opt.icon}</span>
                  <span className="text-white font-black text-sm">{opt.label}</span>
                  <span className="text-muted text-xs">{opt.sub}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mood */}
          {stepKey === 'mood' && (
            <div className="grid grid-cols-3 gap-3">
              {MOOD_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => advance({ mood: opt.value })}
                  className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all active:scale-95 ${opt.isGood ? 'border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10' : 'border-border bg-card hover:border-secondary/50 hover:bg-secondary/5'}`}>
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-xs font-bold text-muted">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom item card */}
      <div className="sticky bottom-0 bg-bg border-t border-border px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{current.name}</p>
            <p className="text-muted text-xs">{current.hasDiscount ? '🏷️ Со скидкой' : 'Проверяем покупку'}</p>
          </div>
          <p className="text-primary font-black text-lg">{current.price.toLocaleString('ru')} ₽</p>
        </div>
      </div>
    </div>
  )
}
