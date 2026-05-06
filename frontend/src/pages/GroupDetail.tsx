import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type GroupDetail as IGroupDetail, type FeedItem } from '../api/client'

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<IGroupDetail | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [tab, setTab] = useState<'feed' | 'leaderboard'>('feed')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.groups.get(Number(id)),
      api.groups.getFeed(Number(id)),
    ]).then(([g, f]) => {
      setGroup(g.data)
      setFeed(f.data)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleRespect(vetoId: number) {
    await api.respects.create(vetoId)
    setFeed((prev) =>
      prev.map((v) =>
        v.id === vetoId
          ? { ...v, has_respected: true, respect_count: v.respect_count + 1 }
          : v,
      ),
    )
  }

  async function handleLeave() {
    if (!group) return
    if (!confirm(`Покинуть группу «${group.name}»?`)) return
    await api.groups.leave(group.id)
    navigate('/groups')
  }

  function copyCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'только что'
    if (m < 60) return `${m} мин назад`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} ч назад`
    return `${Math.floor(h / 24)} д назад`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted">Группа не найдена</p>
        <Link to="/groups" className="text-primary text-sm mt-2 block">← Назад</Link>
      </div>
    )
  }

  const medalEmoji = ['🥇', '🥈', '🥉']

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link to="/groups" className="text-muted hover:text-white transition-colors text-lg">←</Link>
          <div>
            <h1 className="text-xl font-black text-white">{group.name}</h1>
            <p className="text-muted text-sm">{group.members.length} участников</p>
          </div>
        </div>
        <button
          onClick={handleLeave}
          className="text-xs text-muted hover:text-secondary transition-colors px-3 py-1.5 border border-border rounded-xl"
        >
          {group.is_owner ? 'Удалить' : 'Выйти'}
        </button>
      </div>

      {/* Invite code */}
      <div className="flex items-center gap-3 mb-6 bg-card border border-border rounded-xl px-4 py-3">
        <span className="text-muted text-xs">Код приглашения:</span>
        <span className="font-mono font-black text-primary tracking-widest">{group.invite_code}</span>
        <button onClick={copyCode} className="ml-auto text-xs text-muted hover:text-primary transition-colors">
          {copied ? '✓ скопировано' : 'скопировать'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab('feed')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'feed' ? 'bg-primary text-black' : 'text-muted hover:text-white'}`}
        >
          Лента
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'leaderboard' ? 'bg-primary text-black' : 'text-muted hover:text-white'}`}
        >
          Лидерборд
        </button>
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div className="flex flex-col gap-3">
          {feed.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">🤫</p>
              <p className="text-muted text-sm">Пока никто не ветировал в этой группе</p>
            </div>
          )}
          {feed.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-primary font-bold text-sm">@{item.username}</p>
                <p className="text-muted text-xs">{timeAgo(item.created_at)}</p>
              </div>
              <p className="text-white text-sm mb-1">
                ветировал <span className="font-bold">«{item.description}»</span>
              </p>
              <p className="text-primary font-black text-lg mb-3">+{item.amount.toLocaleString('ru')} ₽</p>
              <button
                onClick={() => !item.has_respected && handleRespect(item.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${item.has_respected ? 'text-secondary cursor-default' : 'text-muted hover:text-secondary'}`}
              >
                <span>{item.has_respected ? '❤️' : '🤍'}</span>
                <span>{item.respect_count}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="flex flex-col gap-3">
          {group.members.map((m, i) => (
            <div
              key={m.id}
              className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${m.is_me ? 'border-primary/40' : 'border-border'}`}
            >
              <span className="text-2xl w-8 text-center">
                {i < 3 ? medalEmoji[i] : <span className="text-muted text-sm font-bold">{m.rank}</span>}
              </span>
              <div className="flex-1">
                <p className="font-bold text-white">
                  @{m.username}
                  {m.is_me && <span className="ml-2 text-xs text-primary">(ты)</span>}
                </p>
              </div>
              <p className="text-primary font-black">{m.total_saved.toLocaleString('ru')} ₽</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
