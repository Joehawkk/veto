import { Link, useNavigate } from 'react-router-dom'
import { useChecks } from '../hooks/useChecks'
import { type CheckEntry } from '../api/client'
import { type Verdict } from '../lib/scoring'
import BottomNav from '../components/BottomNav'
import VerdictBadge from '../components/VerdictBadge'
import { HeartIcon, CartIcon, ClockIcon, WarningIcon, TagIcon } from '../components/Icons'

const OUTCOME = {
  stopped: { label: 'Отказался', color: 'text-primary' },
  bought:  { label: 'Купил',     color: 'text-gray-500' },
  pending: { label: 'Ожидает',   color: 'text-[#F86D06]' },
}

function outcomeCardClass(entry: CheckEntry): string {
  if (entry.outcome === 'stopped') {
    return 'border-green-400 bg-green-50 shadow-[0_0_0_1px_rgba(74,222,128,0.4)]'
  }
  if (entry.outcome === 'bought') {
    if (entry.ai_verdict === 'go')   return 'border-green-400 bg-green-50 shadow-[0_0_0_1px_rgba(74,222,128,0.4)]'
    if (entry.ai_verdict === 'wait') return 'border-amber-400 bg-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]'
    return 'border-red-400 bg-red-50 shadow-[0_0_0_1px_rgba(248,113,113,0.4)]'
  }
  return 'border-border bg-white'
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

const verdictTextColor: Record<string, string> = {
  go: 'text-primary', wait: 'text-[#F86D06]', veto: 'text-secondary',
}

function Card({ entry, onOutcome }: { entry: CheckEntry; onOutcome: (id: string, o: 'stopped' | 'bought') => void }) {
  const navigate = useNavigate()
  const o = OUTCOME[entry.outcome]
  const isPending = entry.outcome === 'pending'
  const hasTimer = isPending && !!entry.timer_deadline
  const expired = hasTimer && new Date(entry.timer_deadline!).getTime() < Date.now()
  const date = new Date(entry.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  const priceColor = verdictTextColor[entry.ai_verdict] ?? 'text-dark'

  return (
    <div
      className={`border rounded-2xl p-4 cursor-pointer hover:shadow-card-hover transition-all ${outcomeCardClass(entry)}`}
      onClick={() => navigate(`/history/${entry.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-dark font-bold truncate">{entry.name}</p>
          <p className="text-muted text-xs mt-0.5">
            {date}{entry.has_discount && <span className="ml-2 text-[#F86D06]">🏷️</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className={`font-black ${priceColor}`}>{entry.price.toLocaleString('ru')} ₽</p>
          <span className="text-muted text-xs">›</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <VerdictBadge verdict={entry.ai_verdict as Verdict} />
        <span className={`text-xs font-medium flex items-center gap-1 ${o.color}`}>
          {entry.outcome === 'stopped' && <HeartIcon size={12} filled />}
          {entry.outcome === 'bought' && <CartIcon size={12} />}
          {o.label}
        </span>
      </div>

      {hasTimer && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${
          expired
            ? 'bg-secondary/10 border border-secondary/20 text-secondary'
            : 'bg-[#FFDE8A]/40 border border-[#FF9E30]/30 text-[#F86D06]'
        }`}>
          {expired ? <WarningIcon size={13} /> : <ClockIcon size={13} />}
          <span>{expired ? 'Время вышло — пора решить!' : getTimeLeft(entry.timer_deadline!)}</span>
        </div>
      )}

      {entry.has_discount && (
        <p className="text-[#F86D06] text-xs mt-2 flex items-center gap-1">
          <TagIcon size={11} /> Со скидкой
        </p>
      )}

      {entry.ai_comment && (
        <p className="text-muted text-xs mt-3 leading-relaxed line-clamp-2">{entry.ai_comment}</p>
      )}

      {isPending && (
        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onOutcome(entry.id, 'stopped')}
            className="flex-1 bg-primary/10 border border-primary/25 text-primary text-sm font-bold py-2.5 rounded-xl hover:bg-primary/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <HeartIcon size={14} filled /> Отказался
          </button>
          <button
            onClick={() => onOutcome(entry.id, 'bought')}
            className="flex-1 bg-bg border border-border text-gray-dark text-sm font-bold py-2.5 rounded-xl hover:border-border-dark active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <CartIcon size={14} /> Купил
          </button>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const { checks, stats, setOutcome, loading } = useChecks()

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-4 px-6 py-5 bg-white border-b border-border">
        <div className="flex-1">
          <h1 className="text-xl font-black text-dark">История</h1>
          <p className="text-muted text-xs">{checks.length} проверок</p>
        </div>
      </header>

      <main className="px-6 py-6 pb-24 max-w-md mx-auto">
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

        {stats.pending > 0 && (
          <div className="bg-[#FFDE8A]/40 border border-[#FF9E30]/40 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <p className="text-[#F86D06] text-sm font-medium">
              {stats.pending} {stats.pending === 1 ? 'товар ждёт' : 'товара ждут'} твоего решения
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : checks.length === 0 ? (
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
            {checks.map((entry) => (
              <Card key={entry.id} entry={entry} onOutcome={setOutcome} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
