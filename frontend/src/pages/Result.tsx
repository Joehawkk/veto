import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getCheckResult, getCurrent } from '../lib/storage'
import { useAI, type AIResult } from '../hooks/useAI'
import { useProfile } from '../hooks/useProfile'
import { api } from '../api/client'
import VerdictBadge from '../components/VerdictBadge'
import { HeartIcon, CartIcon, ClockIcon, TagIcon, LightbulbIcon, ListIcon, BotIcon, CheckCircleIcon } from '../components/Icons'
import type { Verdict } from '../lib/scoring'

const TIMER_OPTIONS = [
  { label: '1 день',  days: 1 },
  { label: '2 дня',  days: 2 },
  { label: '3 дня',  days: 3 },
  { label: 'Неделю', days: 7 },
]



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
          <div className="absolute w-24 h-24 rounded-full animate-ping" style={{ background: 'rgba(253,114,3,0.15)' }} />
          <div className="absolute w-16 h-16 rounded-full animate-ping [animation-delay:200ms]" style={{ background: 'rgba(253,114,3,0.20)' }} />
          <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FD7203, #F86D06)' }}>
            <span className="text-white font-black text-lg">AI</span>
          </div>
        </div>
        <h2 className="text-dark font-black text-2xl mb-2">Анализирую{dots}</h2>
        <p className="text-muted text-sm mb-1">AI изучает твои ответы и выносит вердикт</p>
        <p className="text-primary/70 text-xs mb-10">"{name}" · {price.toLocaleString('ru')} ₽</p>
        <div className="flex flex-col gap-4 w-full">
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <div className="h-4 bg-bg rounded animate-pulse w-1/3 mb-4" />
            <div className="h-6 bg-bg rounded animate-pulse w-2/3 mb-3" />
            <div className="h-3 bg-bg rounded animate-pulse w-full mb-2" />
            <div className="h-3 bg-bg rounded animate-pulse w-4/5" />
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <div className="h-3 bg-bg rounded animate-pulse w-full mb-2" />
            <div className="h-3 bg-bg rounded animate-pulse w-3/4" />
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
  name: string; price: number; totalSaved: number
  suggestion: string | null
  onHome: () => void; onHistory: () => void
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-6">
        {/* Animated circle */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full animate-ping [animation-duration:2s]" style={{ background: 'rgba(253,114,3,0.12)' }} />
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-orange text-white" style={{ background: 'linear-gradient(135deg, #FD7203, #F86D06)' }}>
            <CheckCircleIcon size={36} />
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-dark font-black text-3xl mb-2">Так держать!</h2>
          <p className="text-muted text-sm leading-relaxed">
            Ты устоял перед импульсом и сохранил{' '}
            <span className="text-primary font-black">{price.toLocaleString('ru')} ₽</span>
          </p>
        </div>

        {/* Savings card */}
        <div className="w-full bg-white border border-border rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #FD7203 0%, #F86D06 100%)' }}>
            <p className="text-white/80 text-xs uppercase tracking-widest font-bold mb-1">Отказался от</p>
            <p className="text-white font-bold text-base truncate">{name}</p>
            <p className="text-white font-black text-3xl mt-1">{price.toLocaleString('ru')} ₽</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {totalSaved > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-muted text-sm">Всего сэкономлено:</p>
                <p className="text-primary font-black text-lg">{totalSaved.toLocaleString('ru')} ₽</p>
              </div>
            )}
            {suggestion && (
              <div className="flex gap-3 items-start pt-3 border-t border-border">
                <span className="text-primary shrink-0"><LightbulbIcon size={18} /></span>
                <div>
                  <p className="text-muted text-[10px] uppercase tracking-wide font-bold mb-1">Лучше потрать на интересы:</p>
                  <p className="text-gray-dark text-sm leading-relaxed">{suggestion}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button onClick={onHome} className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange hover:shadow-orange-lg transition-all active:scale-[0.98]">
            На главную
          </button>
          <button onClick={onHistory} className="w-full border border-border bg-white text-gray-dark font-medium py-3 rounded-xl hover:border-border-dark transition-colors shadow-card flex items-center justify-center gap-2">
            <ListIcon size={16} /> Посмотреть историю
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Verdict top block colors ───────────────────── */
function verdictGradient(v: string) {
  if (v === 'go')   return 'linear-gradient(135deg, #FD7203 0%, #FF9E30 100%)'
  if (v === 'wait') return 'linear-gradient(135deg, #FF9E30 0%, #FFDE8A 100%)'
  return              'linear-gradient(135deg, #D4350E 0%, #F86D06 100%)'
}

/* ── Main component ────────────────────────────── */
export default function Result() {
  const navigate = useNavigate()
  const { getAIResult } = useAI()
  const { profile } = useProfile()
  const saved = useRef(false)
  const checkIdRef = useRef<string | null>(null)
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
    getAIResult({
      name: current.name, price: current.price,
      hasDiscount: current.hasDiscount,
      answers: checkResult.answers, localVerdict: checkResult.localVerdict,
      profile, recentHistory: [],
    }).then((result) => {
      setAiResult(result)
      api.checks.create({
        name: current.name, price: current.price,
        has_discount: current.hasDiscount,
        answers: checkResult.answers,
        ai_verdict: result.verdict, ai_comment: result.tip,
        outcome: 'pending',
      }).then(({ data }) => { checkIdRef.current = data.id }).catch(() => {})
    })
  }, [])

  if (!current || !checkResult) return null
  if (!aiResult) return <LoadingScreen name={current.name} price={current.price} />

  if (showCelebration) {
    const suggestion = aiResult.suggestion || null
    return (
      <CelebrationScreen
        name={current.name} price={current.price} totalSaved={0}
        suggestion={suggestion} onHome={() => navigate('/')} onHistory={() => navigate('/history')}
      />
    )
  }

  const suggestion = aiResult.verdict !== 'go' ? (aiResult.suggestion || null) : null

  function handleOutcome(outcome: 'stopped' | 'bought') {
    if (checkIdRef.current) api.checks.update(checkIdRef.current, { outcome }).catch(() => {})
    if (outcome === 'stopped') {
      setShowCelebration(true)
    } else {
      navigate('/')
    }
  }

  function handleSetTimer(days: number) {
    const d = new Date(); d.setDate(d.getDate() + days)
    if (checkIdRef.current) api.checks.update(checkIdRef.current, { timer_deadline: d.toISOString() }).catch(() => {})
    setTimerDays(days); setTimerSet(true)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-md mx-auto">

      {/* ── Verdict top banner ── */}
      <div className="px-6 py-8" style={{ background: verdictGradient(aiResult.verdict) }}>
        <div className="flex items-center gap-3 mb-5">
          <VerdictBadge verdict={aiResult.verdict as Verdict} size="lg" ghost />
        </div>
        <div className="flex gap-3 items-start">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mt-0.5 text-white">
            <BotIcon size={18} />
          </div>
          <div>
            <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1.5">AI вердикт</p>
            <p className="text-white text-[15px] leading-relaxed font-medium">{aiResult.tip}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col gap-4 overflow-y-auto pb-8">

        {/* Interest suggestion — only for wait/veto */}
        {suggestion && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary"><LightbulbIcon size={18} /></span>
              <p className="text-dark font-black text-sm">Лучше потрать на это</p>
            </div>
            <p className="text-gray-dark text-sm leading-relaxed">{suggestion}</p>
          </div>
        )}

        {/* Item info */}
        <div className="flex items-center justify-between py-3 px-4 bg-white border border-border rounded-xl shadow-card">
          <div>
            <p className="text-dark font-medium text-sm">{current.name}</p>
            {current.hasDiscount && <p className="text-[#F86D06] text-xs mt-0.5 flex items-center gap-1"><TagIcon size={12} /> Со скидкой</p>}
          </div>
          <p className={`font-black ${aiResult.verdict === 'go' ? 'text-primary' : aiResult.verdict === 'wait' ? 'text-[#F86D06]' : 'text-secondary'}`}>{current.price.toLocaleString('ru')} ₽</p>
        </div>

        {/* Timer */}
        {!timerSet ? (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <p className="text-dark font-bold mb-1 flex items-center gap-2"><ClockIcon size={16} /> Нужно подумать?</p>
            <p className="text-muted text-xs mb-4">Поставь таймер — напомним вернуться и решить</p>
            <div className="flex flex-wrap gap-2">
              {TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => handleSetTimer(opt.days)}
                  className="px-4 py-2 rounded-xl border border-border bg-bg text-gray-dark text-sm font-medium hover:border-primary hover:text-primary transition-all active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="border rounded-2xl p-5 text-center" style={{ background: 'rgba(253,114,3,0.06)', borderColor: 'rgba(253,114,3,0.30)' }}>
            <p className="text-primary font-black text-lg mb-1 flex items-center justify-center gap-2"><ClockIcon size={18} /> Таймер поставлен</p>
            <p className="text-muted text-sm">
              Вернись через {timerDays} {timerDays === 1 ? 'день' : timerDays! < 5 ? 'дня' : 'дней'} — найдёшь товар в истории
            </p>
            <Link to="/history" className="inline-flex items-center gap-1 mt-3 text-primary text-sm font-bold hover:underline">
              <ListIcon size={14} /> Перейти в историю
            </Link>
          </div>
        )}

        {/* Action buttons */}
        {!timerSet && (
          <div className="flex flex-col gap-3">
            {aiResult.verdict !== 'go' ? (
              <>
                <button
                  onClick={() => handleOutcome('stopped')}
                  className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange hover:shadow-orange-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <HeartIcon size={18} filled /> Отказываюсь — сохраняю {current.price.toLocaleString('ru')} ₽
                </button>
                <button
                  onClick={() => handleOutcome('bought')}
                  className="w-full border border-border bg-white text-gray-dark font-medium py-3 rounded-xl hover:border-border-dark transition-colors shadow-card flex items-center justify-center gap-2"
                >
                  <CartIcon size={16} /> Всё равно куплю
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleOutcome('bought')}
                  className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CartIcon size={18} /> Куплю
                </button>
                <button
                  onClick={() => handleOutcome('stopped')}
                  className="w-full border border-border bg-white text-gray-dark font-medium py-3 rounded-xl hover:border-border-dark transition-colors shadow-card flex items-center justify-center gap-2"
                >
                  <HeartIcon size={16} /> Всё-таки откажусь
                </button>
              </>
            )}
            <Link to="/history" className="w-full text-center text-muted text-sm py-2 hover:text-gray-dark transition-colors block">
              История покупок
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
