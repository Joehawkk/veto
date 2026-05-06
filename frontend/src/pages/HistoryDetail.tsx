import { useParams, Link, useNavigate } from 'react-router-dom'
import { getHistory, updateOutcome, type HistoryEntry } from '../lib/storage'
import { getVerdictMeta } from '../lib/scoring'

const OUTCOME = {
  stopped: { label: 'Отказался', icon: '💚', color: 'text-primary' },
  bought:  { label: 'Купил',     icon: '🛒', color: 'text-white' },
  pending: { label: 'Ожидает решения', icon: '⏳', color: 'text-yellow-400' },
}

const MOOD_RU: Record<string, string> = {
  good: '😊 Хорошее', neutral: '😐 Нейтральное', sad: '😔 Грустное',
  angry: '😠 Злое', stressed: '😰 Стрессовое', tired: '😴 Усталое',
}

const DURATION_RU: Record<string, string> = {
  '30min': '⚡ 30 минут', '1hour': '☕ 1 час',
  '24hours': '🌙 24 часа', '3days': '📅 3+ дня',
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

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const history = getHistory()
  const entry: HistoryEntry | undefined = history.find((e) => e.id === id)

  if (!entry) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-white font-bold mb-4">Запись не найдена</p>
        <Link to="/history" className="text-primary font-bold hover:underline">
          ← Назад в историю
        </Link>
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

  function handleMark(outcome: 'stopped' | 'bought') {
    updateOutcome(entry.id, outcome)
    navigate('/history')
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-4 px-6 py-5 border-b border-border">
        <Link to="/history" className="text-muted hover:text-white transition-colors">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-white truncate">{entry.name}</h1>
          <p className="text-muted text-xs">{date}</p>
        </div>
      </header>

      <main className="px-6 py-6 max-w-md mx-auto flex flex-col gap-4">

        {/* Price + Verdict row */}
        <div className={`rounded-2xl border p-5 ${v.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide ${v.badge}`}>
              {v.icon} {v.label}
            </span>
            {entry.hasDiscount && (
              <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-full border border-yellow-400/30">
                🏷️ Со скидкой
              </span>
            )}
          </div>
          <p className={`font-black text-4xl ${v.text}`}>
            {entry.price.toLocaleString('ru')} ₽
          </p>
          <p className="text-white/50 text-xs mt-1">{entry.name}</p>
        </div>

        {/* Outcome */}
        <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">{o.icon}</span>
          <div>
            <p className="text-muted text-xs uppercase tracking-wide font-bold">Итог</p>
            <p className={`font-black text-base ${o.color}`}>{o.label}</p>
          </div>
        </div>

        {/* Timer */}
        {hasTimer && (
          <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${expired ? 'bg-secondary/10 border border-secondary/30' : 'bg-yellow-400/10 border border-yellow-400/30'}`}>
            <span className="text-xl">⏰</span>
            <div>
              <p className={`text-xs uppercase tracking-wide font-bold mb-0.5 ${expired ? 'text-secondary' : 'text-yellow-400'}`}>
                Таймер на решение
              </p>
              <p className={`text-sm font-bold ${expired ? 'text-secondary' : 'text-yellow-400'}`}>
                {expired ? '⚠️ Время вышло — пора решить!' : getTimeLeft(entry.timerDeadline!)}
              </p>
            </div>
          </div>
        )}

        {/* AI Comment */}
        {entry.aiComment && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex gap-3 items-start">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                  AI вердикт
                </p>
                <p className="text-white/80 text-sm leading-relaxed">{entry.aiComment}</p>
              </div>
            </div>
          </div>
        )}

        {/* Answers */}
        <div className="bg-card border border-border rounded-2xl p-5">
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
              <span className="text-sm font-bold text-white">
                {DURATION_RU[entry.answers.thoughtDuration]}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm">Настроение</p>
              <span className="text-sm font-bold text-white">
                {MOOD_RU[entry.answers.mood]}
              </span>
            </div>
          </div>
        </div>

        {/* Mark buttons for pending */}
        {isPending && (
          <div className="flex gap-2">
            <button
              onClick={() => handleMark('stopped')}
              className="flex-1 bg-primary/10 border border-primary/30 text-primary text-sm font-bold py-3 rounded-xl hover:bg-primary/20 active:scale-95 transition-all"
            >
              💚 Отказался
            </button>
            <button
              onClick={() => handleMark('bought')}
              className="flex-1 bg-border text-muted text-sm font-bold py-3 rounded-xl hover:text-white active:scale-95 transition-all"
            >
              🛒 Купил
            </button>
          </div>
        )}

        <Link
          to="/history"
          className="w-full text-center text-muted/60 text-sm py-2 hover:text-muted transition-colors block"
        >
          ← Вся история
        </Link>
      </main>
    </div>
  )
}
