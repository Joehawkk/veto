import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrent, setCheckResult, type CheckAnswers, type MoodValue, type ThoughtDuration } from '../lib/storage'
import { getLocalVerdict } from '../lib/scoring'
import {
  CheckMarkIcon, XIcon, TagIcon,
  ZapIcon, CoffeeIcon, MoonIcon, CalendarIcon,
  SmileFaceIcon, NeutralFaceIcon, SadFaceIcon, AngryFaceIcon, StressedFaceIcon, TiredFaceIcon,
} from '../components/Icons'

type StepKey = 'needNow' | 'hasSimilar' | 'duration' | 'mood'

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

const CATEGORIES: Record<StepKey, { title: string; subtitle: string; category: string; categoryColor: string }> = {
  needNow: {
    title: 'Тебе реально нужно это прямо сейчас?',
    subtitle: 'Не "хочу", а именно "нужно" — сегодня',
    category: 'ПОТРЕБНОСТЬ',
    categoryColor: 'text-primary bg-primary/10',
  },
  hasSimilar: {
    title: 'Есть ли у тебя что-то похожее?',
    subtitle: 'Похожее по функции, даже если не идентичное',
    category: 'ПОТРЕБНОСТЬ',
    categoryColor: 'text-primary bg-primary/10',
  },
  duration: {
    title: 'Как долго ты думаешь об этой покупке?',
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

export default function Check() {
  const navigate = useNavigate()
  const [current] = useState(() => getCurrent())
  const [answers, setAnswers] = useState<Partial<CheckAnswers>>({})

  if (!current) {
    navigate('/')
    return null
  }

  function update(key: keyof CheckAnswers, value: any) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function isComplete(): boolean {
    return (
      answers.needNow !== undefined &&
      answers.hasSimilar !== undefined &&
      answers.thoughtDuration !== undefined &&
      answers.mood !== undefined
    )
  }

  function handleSubmit() {
    const complete = answers as CheckAnswers
    const localVerdict = getLocalVerdict(complete)
    setCheckResult({ answers: complete, localVerdict })
    navigate('/result')
  }

  const DURATION_ICON: Record<ThoughtDuration, JSX.Element> = {
    '30min':   <ZapIcon size={24} />,
    '1hour':   <CoffeeIcon size={24} />,
    '24hours': <MoonIcon size={24} />,
    '3days':   <CalendarIcon size={24} />,
  }

  const MOOD_ICON: Record<MoodValue, JSX.Element> = {
    good:     <SmileFaceIcon size={28} />,
    neutral:  <NeutralFaceIcon size={28} />,
    sad:      <SadFaceIcon size={28} />,
    angry:    <AngryFaceIcon size={28} />,
    stressed: <StressedFaceIcon size={28} />,
    tired:    <TiredFaceIcon size={28} />,
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <button onClick={() => navigate('/')} className="text-muted hover:text-dark transition-colors text-sm font-medium">
          ← Назад
        </button>
        <p className="text-muted text-sm font-medium">Проверка покупки</p>
        <div className="w-16" />
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 max-w-md mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-dark font-black text-xl mb-1">{current.name}</h1>
          <p className="text-primary font-black text-lg">{current.price.toLocaleString('ru')} ₽</p>
          {current.hasDiscount && (
            <p className="text-[#F86D06] text-xs mt-1 flex items-center gap-1"><TagIcon size={11} /> Со скидкой</p>
          )}
        </div>

        {/* Question 1: Need now */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-card">
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${CATEGORIES.needNow.categoryColor}`}>
            {CATEGORIES.needNow.category}
          </span>
          <h2 className="text-lg font-black text-dark mb-1">{CATEGORIES.needNow.title}</h2>
          <p className="text-muted text-xs mb-4">{CATEGORIES.needNow.subtitle}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => update('needNow', true)}
              className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${
                answers.needNow === true
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-bg hover:border-primary/30'
              }`}
            >
              <CheckMarkIcon size={28} />
              <span className="font-black text-base">Да</span>
            </button>
            <button
              onClick={() => update('needNow', false)}
              className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${
                answers.needNow === false
                  ? 'border-secondary bg-secondary/10 text-secondary'
                  : 'border-border bg-bg hover:border-secondary/30'
              }`}
            >
              <XIcon size={28} />
              <span className="font-black text-base text-gray-dark">Нет</span>
            </button>
          </div>
        </div>

        {/* Question 2: Has similar */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-card">
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${CATEGORIES.hasSimilar.categoryColor}`}>
            {CATEGORIES.hasSimilar.category}
          </span>
          <h2 className="text-lg font-black text-dark mb-1">{CATEGORIES.hasSimilar.title}</h2>
          <p className="text-muted text-xs mb-4">{CATEGORIES.hasSimilar.subtitle}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => update('hasSimilar', true)}
              className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${
                answers.hasSimilar === true
                  ? 'border-secondary bg-secondary/10 text-secondary'
                  : 'border-border bg-bg hover:border-secondary/30'
              }`}
            >
              <CheckMarkIcon size={28} />
              <span className="font-black text-base text-gray-dark">Да</span>
            </button>
            <button
              onClick={() => update('hasSimilar', false)}
              className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${
                answers.hasSimilar === false
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-bg hover:border-primary/30'
              }`}
            >
              <XIcon size={28} />
              <span className="font-black text-base">Нет</span>
            </button>
          </div>
        </div>

        {/* Question 3: Duration */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-card">
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${CATEGORIES.duration.categoryColor}`}>
            {CATEGORIES.duration.category}
          </span>
          <h2 className="text-lg font-black text-dark mb-1">{CATEGORIES.duration.title}</h2>
          <p className="text-muted text-xs mb-4">{CATEGORIES.duration.subtitle}</p>
          <div className="grid grid-cols-2 gap-3">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('thoughtDuration', opt.value)}
                className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all active:scale-95 ${
                  answers.thoughtDuration === opt.value
                    ? 'border-[#F86D06] bg-[#FFDE8A]/30'
                    : 'border-border bg-bg hover:border-[#F86D06]/30'
                }`}
              >
                <span className="text-[#F86D06]">{DURATION_ICON[opt.value]}</span>
                <span className="text-dark font-black text-sm">{opt.label}</span>
                <span className="text-muted text-[10px]">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Question 4: Mood */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-card">
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${CATEGORIES.mood.categoryColor}`}>
            {CATEGORIES.mood.category}
          </span>
          <h2 className="text-lg font-black text-dark mb-1">{CATEGORIES.mood.title}</h2>
          <p className="text-muted text-xs mb-4">{CATEGORIES.mood.subtitle}</p>
          <div className="grid grid-cols-3 gap-2">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('mood', opt.value)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all active:scale-95 ${
                  answers.mood === opt.value
                    ? opt.good
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary bg-secondary/10'
                    : 'border-border bg-bg hover:border-primary/20'
                }`}
              >
                <span className={opt.good ? 'text-primary' : 'text-secondary'}>
                  {MOOD_ICON[opt.value]}
                </span>
                <span className="text-[10px] font-bold text-gray-dark">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!isComplete()}
          className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98] mb-8"
        >
          Получить вердикт →
        </button>
      </main>
    </div>
  )
}
