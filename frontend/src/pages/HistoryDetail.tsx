import { useParams, Link, useNavigate } from 'react-router-dom'
import { type HistoryEntry } from '../lib/storage'
import { getVerdictMeta } from '../lib/scoring'
import { useHistory } from '../hooks/useHistory'

const OUTCOME = {
  stopped: { label: 'Отказался',        icon: '💚', color: 'text-primary' },
  bought:  { label: 'Купил',             icon: '🛒', color: 'text-gray-dark' },
  pending: { label: 'Ожидает решения',  icon: '⏳', color: 'text-[#F86D06]' },
}

const MOOD_RU: Record<string, string> = {
  good:    '😊 Хорошее',
  neutral: '😐 Нейтральное',
  sad:     '😔 Грустное',
  angry:   '😠 Злое',
  stressed:'😰 Стрессовое',
  tired:   '😴 Усталое',
}

const DURATION_RU: Record<string, string> = {
  '30min':   '⚡ 30 минут',
  '1hour':   '☕ 1 час',
  '24hours': '🌙 24 часа',
  '3days':   '📅 3+ дня',
}

function getTimeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'время вышло'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `ещё ${d} д ${h} ч`
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `ещё ${h} ч`
  return `ещё ${m} мин`
}

function verdictGradient(v: string) {
  if (v === 'go')   return 'linear-gradient(135deg, #FD7203 0%, #FF9E30 100%)'
  if (v === 'wait') return 'linear-gradient(135deg, #FF9E30 0%, #FFDE8A 100%)'
  return              'linear-gradient(135deg, #D4350E 0%, #F86D06 100%)'
}

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { history, setOutcome } = useHistory()
  const entry = history.find((e) => e.id === id) as HistoryEntry | undefined

  if (!entry) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-dark font-bold mb-4">Запись не найдена</p>
        <Link to="/history" className="text-primary font-bold hover:underline">← Назад в историю</Link>
      </div>
    )
  }

  const v = getVerdictMeta(entry.aiVerdict)
  const o = OUTCOME[entry.outcome]
  const isPending = entry.outcome === 'pending'
  const hasTimer = isPending && !!entry.timerDeadline
  const expired = hasTimer && new Date(entry.timerDeadline!).getTime() < Date.now()

  const date = new Date(entry.createdAt).toLocaleDateString('ru', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const entryId = entry.id
  function handleMark(outcome: 'stopped' | 'bought') {
    setOutcome(entryId, outcome)
    navigate('/history')
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-4 px-6 py-5 bg-white border-b border-border">
        <Link to="/history" className="text-muted hover:text-dark transition-colors text-lg">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-dark truncate">{entry.name}</h1>
          <p className="text-muted text-xs">{date}</p>
        </div>
      </header>

      <main className="px-6 py-6 max-w-md mx-auto flex flex-col gap-4">

        {/* Price + verdict hero */}
        <div className="rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-6" style={{ background: verdictGradient(entry.aiVerdict) }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide bg-white/25 text-white">
                {v.icon} {v.label}
              </span>
              {entry.hasDiscount && (
                <span className="text-xs font-bold text-white bg-white/20 px-2.5 py-1 rounded-full">
                  🏷️ Скидка
                </span>
              )}
            </div>
            <p className="text-white font-black text-4xl">{entry.price.toLocaleString('ru')} ₽</p>
            <p className="text-white/70 text-sm mt-1">{entry.name}</p>
          </div>
        </div>

        {/* Outcome */}
        <div className="bg-white border border-border rounded-2xl px-5 py-4 flex items-center gap-3 shadow-card">
          <span className="text-2xl">{o.icon}</span>
          <div>
            <p className="text-muted text-xs uppercase tracking-wide font-bold">Итог</p>
            <p className={`font-black text-base ${o.color}`}>{o.label}</p>
          </div>
        </div>

        {/* Timer */}
        {hasTimer && (
          <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
            expired
              ? 'bg-secondary/10 border border-secondary/20'
              : 'bg-[#FFDE8A]/40 border border-[#FF9E30]/30'
          }`}>
            <span className="text-xl">⏰</span>
            <div>
              <p className={`text-xs uppercase tracking-wide font-bold mb-0.5 ${expired ? 'text-secondary' : 'text-[#F86D06]'}`}>
                Таймер на решение
              </p>
              <p className={`text-sm font-bold ${expired ? 'text-secondary' : 'text-[#F86D06]'}`}>
                {expired ? '⚠️ Время вышло — пора решить!' : getTimeLeft(entry.timerDeadline!)}
              </p>
            </div>
          </div>
        )}

        {/* AI Comment */}
        {entry.aiComment && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <div className="flex gap-3 items-start">
              <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FD7203, #F86D06)' }}>
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <p className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5">AI вердикт</p>
                <p className="text-gray-dark text-sm leading-relaxed">{entry.aiComment}</p>
              </div>
            </div>
          </div>
        )}

        {/* Answers */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
          <p className="text-muted text-xs uppercase tracking-wide font-bold mb-4">Ответы на вопросы</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm">Нужно прямо сейчас?</p>
              <span className={`text-sm font-bold ${entry.answers.needNow ? 'text-secondary' : 'text-primary'}`}>
                {entry.answers.needNow ? '✅ Да' : '❌ Нет'}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm">Есть похожее?</p>
              <span className={`text-sm font-bold ${entry.answers.hasSimilar ? 'text-secondary' : 'text-primary'}`}>
                {entry.answers.hasSimilar ? '✅ Да' : '❌ Нет'}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm">Как долго думал?</p>
              <span className="text-sm font-bold text-dark">{DURATION_RU[entry.answers.thoughtDuration]}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm">Настроение</p>
              <span className="text-sm font-bold text-dark">{MOOD_RU[entry.answers.mood]}</span>
            </div>
          </div>
        </div>

        {/* Mark buttons for pending */}
        {isPending && (
          <div className="flex gap-2">
            <button
              onClick={() => handleMark('stopped')}
              className="flex-1 bg-primary/10 border border-primary/25 text-primary text-sm font-bold py-3 rounded-xl hover:bg-primary/20 active:scale-95 transition-all"
            >
              💚 Отказался
            </button>
            <button
              onClick={() => handleMark('bought')}
              className="flex-1 bg-bg border border-border text-gray-dark text-sm font-bold py-3 rounded-xl hover:border-border-dark active:scale-95 transition-all"
            >
              🛒 Купил
            </button>
          </div>
        )}

        <Link to="/history" className="w-full text-center text-muted text-sm py-2 hover:text-gray-dark transition-colors block">
          ← Вся история
        </Link>
      </main>
    </div>
  )
}
