import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrent, setCheckResult, type CheckAnswers, type MoodValue, type ThoughtDuration } from '../lib/storage'
import { getLocalVerdict } from '../lib/scoring'
import {
  CheckMarkIcon, XIcon, TagIcon,
  ZapIcon, CoffeeIcon, MoonIcon, CalendarIcon,
  SmileFaceIcon, NeutralFaceIcon, SadFaceIcon, AngryFaceIcon, StressedFaceIcon, TiredFaceIcon,
} from '../components/Icons'

type StepKey = 'needNow' | 'hasSimilar' | 'duration' | 'mood'
const STEPS: StepKey[] = ['needNow', 'hasSimilar', 'duration', 'mood']

const DURATION_ICON: Record<ThoughtDuration, JSX.Element> = {
  '30min':   <ZapIcon size={28} />,
  '1hour':   <CoffeeIcon size={28} />,
  '24hours': <MoonIcon size={28} />,
  '3days':   <CalendarIcon size={28} />,
}

const MOOD_ICON: Record<MoodValue, JSX.Element> = {
  good:     <SmileFaceIcon size={32} />,
  neutral:  <NeutralFaceIcon size={32} />,
  sad:      <SadFaceIcon size={32} />,
  angry:    <AngryFaceIcon size={32} />,
  stressed: <StressedFaceIcon size={32} />,
  tired:    <TiredFaceIcon size={32} />,
}

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
    categoryColor: 'text-[#F86D06] bg-[#FFDE8A]/50',
  },
  mood: {
    title: 'Как ты сейчас себя чувствуешь?',
    subtitle: 'Эмоции влияют на решения о покупках',
    category: 'ЭМОЦИИ',
    categoryColor: 'text-secondary bg-secondary/10',
  },
}

const DURATION_OPTIONS: { value: ThoughtDuration; label: string; sub: string }[] = [
  { value: '30min',   label: '30 минут', sub: 'только что захотел' },
  { value: '1hour',   label: '1 час',    sub: 'недавно увидел' },
  { value: '24hours', label: '24 часа',  sub: 'вчера заметил' },
  { value: '3days',   label: '3+ дня',   sub: 'давно думаю' },
]

const MOOD_OPTIONS: { value: MoodValue; label: string; good: boolean }[] = [
  { value: 'good',     label: 'Хорошо',     good: true  },
  { value: 'neutral',  label: 'Нейтрально', good: true  },
  { value: 'sad',      label: 'Грустно',    good: false },
  { value: 'angry',    label: 'Злюсь',      good: false },
  { value: 'stressed', label: 'Стрессую',   good: false },
  { value: 'tired',    label: 'Устал',      good: false },
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
      {/* Progress bar */}
      <div className="w-full bg-border h-1">
        <div
          className="h-1 transition-all duration-500"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #FD7203, #F86D06)' }}
        />
      </div>

      <main className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <button onClick={goBack} className="text-muted hover:text-dark transition-colors text-sm font-medium">
            ← Назад
          </button>
          <p className="text-muted text-sm font-medium">Вопрос {step + 1} из {STEPS.length}</p>
          <div className="w-16" />
        </div>

        {/* Question */}
        <div
          className="flex-1 flex flex-col justify-center transition-all duration-200"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)' }}
        >
          <div className="bg-white border border-border rounded-3xl p-8 mb-8 shadow-card">
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-6 ${meta.categoryColor}`}>
              {meta.category}
            </span>
            <h2 className="text-2xl font-black text-dark leading-snug mb-3">{meta.title}</h2>
            <p className="text-muted text-sm">{meta.subtitle}</p>
          </div>

          {/* Yes / No */}
          {(stepKey === 'needNow' || stepKey === 'hasSimilar') && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => advance({ [stepKey]: true })}
                className="flex flex-col items-center justify-center gap-3 py-9 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary active:scale-95 transition-all shadow-card"
              >
                <CheckMarkIcon size={34} />
                <span className="font-black text-lg">Да</span>
              </button>
              <button
                onClick={() => advance({ [stepKey]: false })}
                className="flex flex-col items-center justify-center gap-3 py-9 rounded-2xl border-2 border-border bg-white text-secondary hover:border-secondary/40 hover:bg-secondary/5 active:scale-95 transition-all shadow-card"
              >
                <XIcon size={34} />
                <span className="font-black text-lg text-gray-dark">Нет</span>
              </button>
            </div>
          )}

          {/* Duration */}
          {stepKey === 'duration' && (
            <div className="grid grid-cols-2 gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => advance({ thoughtDuration: opt.value })}
                  className="flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border-2 border-border bg-white hover:border-primary hover:bg-primary/5 active:scale-95 transition-all shadow-card"
                >
                  <span className="text-[#F86D06]">{DURATION_ICON[opt.value]}</span>
                  <span className="text-dark font-black text-sm">{opt.label}</span>
                  <span className="text-muted text-xs">{opt.sub}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mood */}
          {stepKey === 'mood' && (
            <div className="grid grid-cols-3 gap-3">
              {MOOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => advance({ mood: opt.value })}
                  className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all active:scale-95 shadow-card ${
                    opt.good
                      ? 'border-primary/20 bg-primary/5 hover:border-primary hover:bg-primary/10'
                      : 'border-border bg-white hover:border-secondary/40 hover:bg-secondary/5'
                  }`}
                >
                  <span className={opt.good ? 'text-primary' : 'text-secondary'}>
                    {MOOD_ICON[opt.value]}
                  </span>
                  <span className="text-xs font-bold text-gray-dark">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom item card */}
      <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 shadow-[0_-2px_12px_rgba(6,6,6,0.06)]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-dark font-bold text-sm">{current.name}</p>
            <p className="text-muted text-xs flex items-center gap-1">
              {current.hasDiscount ? <><TagIcon size={11} /> Со скидкой</> : 'Проверяем покупку'}
            </p>
          </div>
          <p className="text-primary font-black text-lg">{current.price.toLocaleString('ru')} ₽</p>
        </div>
      </div>
    </div>
  )
}
