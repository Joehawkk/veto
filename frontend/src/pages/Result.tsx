import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  getCheckResult, getCurrent, addHistoryEntry,
  updateOutcome, setTimerDeadline, getHistory,
} from '../lib/storage'
import { getVerdictMeta } from '../lib/scoring'
import { useAI, type AIResult } from '../hooks/useAI'
import { useProfile } from '../hooks/useProfile'
import { v4 as uuid } from 'uuid'

const TIMER_OPTIONS = [
  { label: '1 день', days: 1 },
  { label: '2 дня', days: 2 },
  { label: '3 дня', days: 3 },
  { label: 'Неделю', days: 7 },
]

/* ── Interest suggestions ──────────────────────── */
const INTEREST_SUGGESTIONS: Record<string, { text: string; icon: string }> = {
  'Игры': { icon: '🎮', text: 'Поищи игру на распродаже в Steam — часто топ за 100-300 ₽' },
  'Музыка': { icon: '🎵', text: 'Месяц Яндекс Музыки или Spotify — музыка без рекламы за ~200 ₽' },
  'Мода': { icon: '👗', text: 'Загляни на Авито или Vinted — те же вещи в разы дешевле' },
  'Технологии': { icon: '💻', text: 'Инвестируй в знания: курс на Stepik или YouTube-плейлист' },
  'Спорт': { icon: '🏋️', text: 'Пробный день в зале или новый маршрут для пробежки' },
  'Книги': { icon: '📚', text: 'Bookmate или электронка в библиотеке — тысячи книг бесплатно' },
  'Путешествия': { icon: '✈️', text: 'Отложи эти деньги в копилку — ближе к поездке мечты!' },
  'Еда': { icon: '🍕', text: 'Попробуй приготовить что-то новое — вложи деньги в хорошие продукты' },
  'Творчество': { icon: '🎨', text: 'Canva Pro или новые краски/материалы для проекта' },
  'Кино и сериалы': { icon: '🎬', text: 'Кинопоиск или ИВИ дают первый месяц за 1 ₽ — смотри сколько влезет' },
}

function pickSuggestion(interests: string[]): { icon: string; text: string } | null {
  for (const i of interests) {
    if (INTEREST_SUGGESTIONS[i]) return INTEREST_SUGGESTIONS[i]
  }
  return null
}

/* ── Loading screen ────────────────────────────── */
function LoadingScreen({ name, price }: { name: string; price: number }) {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '.' : d + '.')), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm w-full">
        <div className="relative inline-flex items-center justify-center mb-10">
          <div className="absolute w-24 h-24 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute w-16 h-16 rounded-full bg-primary/30 animate-ping [animation-delay:200ms]" />
          <div className="relative w-14 h-14 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <span className="text-primary font-black text-lg">AI</span>
          </div>
        </div>
        <h2 className="text-white font-black text-2xl mb-2">Анализирую{dots}</h2>
        <p className="text-muted text-sm mb-1">AI изучает твои ответы и выносит вердикт</p>
        <p className="text-primary/60 text-xs mb-10">"{name}" · {price.toLocaleString('ru')} ₽</p>

        <div className="flex flex-col gap-4 w-full">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="h-4 bg-border rounded animate-pulse w-1/3 mb-4" />
            <div className="h-6 bg-border rounded animate-pulse w-2/3 mb-3" />
            <div className="h-3 bg-border rounded animate-pulse w-full mb-2" />
            <div className="h-3 bg-border rounded animate-pulse w-4/5" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="h-3 bg-border rounded animate-pulse w-full mb-2" />
            <div className="h-3 bg-border rounded animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Celebration screen ────────────────────────── */
function CelebrationScreen({
  name, price, totalSaved, suggestion, onHome, onHistory,
}: {
  name: string
  price: number
  totalSaved: number
  suggestion: { icon: string; text: string } | null
  onHome: () => void
  onHistory: () => void
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-6">

        {/* Animated checkmark */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full bg-primary/10 animate-ping [animation-duration:2s]" />
          <div className="relative w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center">
            <span className="text-4xl">💚</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-white font-black text-3xl mb-2">Так держать!</h2>
          <p className="text-muted text-sm leading-relaxed">
            Ты устоял перед импульсом и сохранил{' '}
            <span className="text-primary font-black">{price.toLocaleString('ru')} ₽</span>
          </p>
        </div>

        {/* Savings card */}
        <div className="w-full bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-primary/10 border-b border-primary/20 px-5 py-4">
            <p className="text-white/70 text-xs uppercase tracking-widest font-bold mb-1">Отказался от</p>
            <p className="text-white font-bold text-base truncate">{name}</p>
            <p className="text-primary font-black text-2xl mt-1">{price.toLocaleString('ru')} ₽</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {totalSaved > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-muted text-sm">Всего сэкономлено:</p>
                <p className="text-primary font-black text-lg">
                  {totalSaved.toLocaleString('ru')} ₽
                </p>
              </div>
            )}
            {suggestion && (
              <div className="flex gap-3 items-start pt-3 border-t border-border">
                <span className="text-2xl">{suggestion.icon}</span>
                <div>
                  <p className="text-muted text-[10px] uppercase tracking-wide font-bold mb-1">
                    Лучше потрать на интересы:
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed">{suggestion.text}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onHome}
            className="w-full bg-primary text-black font-black py-4 rounded-xl shadow-neon-green hover:shadow-neon-green-lg transition-all active:scale-[0.98]"
          >
            На главную
          </button>
          <button
            onClick={onHistory}
            className="w-full border border-border text-muted font-medium py-3 rounded-xl hover:text-white transition-colors"
          >
            📋 Посмотреть историю
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────── */
export default function Result() {
  const navigate = useNavigate()
  const { getAIResult } = useAI()
  const { profile } = useProfile()
  const saved = useRef(false)
  const [entryId] = useState(() => uuid())
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [timerSet, setTimerSet] = useState(false)
  const [timerDays, setTimerDays] = useState<number | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const current = getCurrent()
  const checkResult = getCheckResult()

  useEffect(() => {
    if (!current || !checkResult) { navigate('/'); return }
    if (saved.current) return
    saved.current = true

    const recentHistory = getHistory().slice(0, 6)

    getAIResult({
      name: current.name,
      price: current.price,
      hasDiscount: current.hasDiscount,
      answers: checkResult.answers,
      localVerdict: checkResult.localVerdict,
      profile,
      recentHistory,
    }).then((result) => {
      setAiResult(result)
      addHistoryEntry({
        id: entryId,
        name: current.name,
        price: current.price,
        hasDiscount: current.hasDiscount,
        answers: checkResult.answers,
        aiVerdict: result.verdict,
        aiComment: result.tip,
        outcome: 'pending',
        createdAt: new Date().toISOString(),
      })
    })
  }, [])

  if (!current || !checkResult) return null
  if (!aiResult) return <LoadingScreen name={current.name} price={current.price} />

  /* Celebration screen after refusing */
  if (showCelebration) {
    const totalSaved = getHistory()
      .filter((e) => e.outcome === 'stopped')
      .reduce((s, e) => s + e.price, 0)
    const suggestion = pickSuggestion(profile?.interests ?? [])
    return (
      <CelebrationScreen
        name={current.name}
        price={current.price}
        totalSaved={totalSaved}
        suggestion={suggestion}
        onHome={() => navigate('/')}
        onHistory={() => navigate('/history')}
      />
    )
  }

  const v = getVerdictMeta(aiResult.verdict)

  function handleOutcome(outcome: 'stopped' | 'bought') {
    updateOutcome(entryId, outcome)
    if (outcome === 'stopped') {
      setShowCelebration(true)
    } else {
      navigate('/')
    }
  }

  function handleSetTimer(days: number) {
    const d = new Date(); d.setDate(d.getDate() + days)
    setTimerDeadline(entryId, d.toISOString())
    setTimerDays(days); setTimerSet(true)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-md mx-auto">

      {/* ── AI TIP TOP BLOCK ── */}
      <div className={`border-b ${v.bg} px-6 py-8`}>
        <div className="flex items-center gap-3 mb-5">
          <span className={`text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide ${v.badge}`}>
            {v.icon} {v.label}
          </span>
        </div>
        <div className="flex gap-3 items-start">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
            <span className="text-base">🤖</span>
          </div>
          <div>
            <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-1.5">AI вердикт</p>
            <p className="text-white text-[15px] leading-relaxed font-medium">{aiResult.tip}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col gap-4 overflow-y-auto pb-8">

        {/* Item info */}
        <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-xl">
          <div>
            <p className="text-white font-medium text-sm">{current.name}</p>
            {current.hasDiscount && <p className="text-yellow-400 text-xs mt-0.5">🏷️ Со скидкой</p>}
          </div>
          <p className={`font-black ${v.text}`}>{current.price.toLocaleString('ru')} ₽</p>
        </div>

        {/* Timer */}
        {!timerSet ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-white font-bold mb-1">⏰ Нужно подумать?</p>
            <p className="text-muted text-xs mb-4">Поставь таймер — напомним вернуться и решить</p>
            <div className="flex flex-wrap gap-2">
              {TIMER_OPTIONS.map((opt) => (
                <button key={opt.days} onClick={() => handleSetTimer(opt.days)}
                  className="px-4 py-2 rounded-xl border border-border bg-bg text-muted text-sm font-medium hover:border-primary hover:text-primary transition-all active:scale-95">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 text-center">
            <p className="text-primary font-black text-lg mb-1">⏰ Таймер поставлен</p>
            <p className="text-muted text-sm">
              Вернись через {timerDays} {timerDays === 1 ? 'день' : timerDays! < 5 ? 'дня' : 'дней'} — найдёшь товар в истории
            </p>
            <Link to="/history" className="inline-block mt-3 text-primary text-sm font-bold hover:underline">
              Перейти в историю →
            </Link>
          </div>
        )}

        {/* Action buttons */}
        {!timerSet && (
          <div className="flex flex-col gap-3">
            {aiResult.verdict !== 'go' ? (
              <>
                <button onClick={() => handleOutcome('stopped')}
                  className="w-full bg-primary text-black font-black py-4 rounded-xl shadow-neon-green hover:shadow-neon-green-lg transition-all">
                  🛑 Отказываюсь — сохраняю {current.price.toLocaleString('ru')} ₽
                </button>
                <button onClick={() => handleOutcome('bought')}
                  className="w-full border border-border text-muted font-medium py-3 rounded-xl hover:text-white transition-colors">
                  🛒 Всё равно куплю
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleOutcome('bought')}
                  className="w-full bg-primary text-black font-black py-4 rounded-xl shadow-neon-green transition-all">
                  🛒 Куплю
                </button>
                <button onClick={() => handleOutcome('stopped')}
                  className="w-full border border-border text-muted font-medium py-3 rounded-xl hover:text-white transition-colors">
                  🛑 Всё-таки откажусь
                </button>
              </>
            )}
            <Link to="/history" className="w-full text-center text-muted/60 text-sm py-2 hover:text-muted transition-colors block">
              История покупок
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
