import { Link, useNavigate } from 'react-router-dom'
import { useHistory } from '../hooks/useHistory'
import { type HistoryEntry } from '../lib/storage'
import { getVerdictMeta } from '../lib/scoring'

const OUTCOME = {
  stopped: { label: 'Отказался', icon: '💚' },
  bought:  { label: 'Купил',     icon: '🛒' },
  pending: { label: 'Ожидает',   icon: '⏳' },
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

function Card({ entry, onOutcome }: { entry: HistoryEntry; onOutcome: (id: string, o: 'stopped' | 'bought') => void }) {
  const navigate = useNavigate()
  const v = getVerdictMeta(entry.aiVerdict)
  const o = OUTCOME[entry.outcome]
  const isPending = entry.outcome === 'pending'
  const hasTimer = isPending && !!entry.timerDeadline
  const expired = hasTimer && new Date(entry.timerDeadline!).getTime() < Date.now()
  const date = new Date(entry.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })

  return (
    <div
      className="bg-white border border-border rounded-2xl p-4 shadow-card cursor-pointer hover:shadow-card-hover hover:border-border-dark transition-all"
      onClick={() => navigate(`/history/${entry.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-dark font-bold truncate">{entry.name}</p>
          <p className="text-muted text-xs mt-0.5">
            {date}{entry.hasDiscount && <span className="ml-2 text-[#F86D06]">🏷️</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className={`font-black ${v.text}`}>{entry.price.toLocaleString('ru')} ₽</p>
          <span className="text-muted text-xs">›</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${v.badge}`}>
          {v.icon} {v.label}
        </span>
        <span className="text-xs text-muted flex items-center gap-1">
          <span>{o.icon}</span><span>{o.label}</span>
        </span>
      </div>

      {/* Timer badge */}
      {hasTimer && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${
          expired
            ? 'bg-secondary/10 border border-secondary/20 text-secondary'
            : 'bg-[#FFDE8A]/40 border border-[#FF9E30]/30 text-[#F86D06]'
        }`}>
          <span>⏰</span>
          <span>{expired ? '⚠️ Время вышло — пора решить!' : getTimeLeft(entry.timerDeadline!)}</span>
        </div>
      )}

      {/* AI comment */}
      {entry.aiComment && (
        <p className="text-muted text-xs mt-3 leading-relaxed line-clamp-2">🤖 {entry.aiComment}</p>
      )}

      {/* Mark buttons */}
      {isPending && (
        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onOutcome(entry.id, 'stopped')}
            className="flex-1 bg-primary/10 border border-primary/25 text-primary text-sm font-bold py-2.5 rounded-xl hover:bg-primary/20 active:scale-95 transition-all"
          >
            💚 Отказался
          </button>
          <button
            onClick={() => onOutcome(entry.id, 'bought')}
            className="flex-1 bg-bg border border-border text-gray-dark text-sm font-bold py-2.5 rounded-xl hover:border-border-dark active:scale-95 transition-all"
          >
            🛒 Купил
          </button>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const { history, stats, setOutcome } = useHistory()

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-5 bg-white border-b border-border">
        <Link to="/" className="text-muted hover:text-dark transition-colors text-lg">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-dark">История</h1>
          <p className="text-muted text-xs">{history.length} проверок</p>
        </div>
      </header>

      <main className="px-6 py-6 max-w-md mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-primary font-black text-lg">{stats.saved.toLocaleString('ru')}</p>
            <p className="text-muted text-[10px] mt-0.5">₽ сохранено</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-dark font-black text-lg">{stats.stopped}</p>
            <p className="text-muted text-[10px] mt-0.5">отказов</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-3 text-center shadow-card">
            <p className="text-dark font-black text-lg">{stats.bought}</p>
            <p className="text-muted text-[10px] mt-0.5">куплено</p>
          </div>
        </div>

        {/* Pending alert */}
        {stats.pending > 0 && (
          <div className="bg-[#FFDE8A]/40 border border-[#FF9E30]/40 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <p className="text-[#F86D06] text-sm font-medium">
              {stats.pending} {stats.pending === 1 ? 'товар ждёт' : 'товара ждут'} твоего решения
            </p>
          </div>
        )}

        {/* List */}
        {history.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-dark font-bold mb-1">История пуста</p>
            <p className="text-muted text-sm mb-6">Запусти первую проверку покупки</p>
            <Link to="/" className="inline-block bg-primary text-white font-black px-6 py-3 rounded-xl shadow-orange">
              Начать проверку
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((entry) => (
              <Card key={entry.id} entry={entry} onOutcome={setOutcome} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
