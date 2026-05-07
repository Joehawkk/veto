import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type GroupDetail as IGroupDetail, type FeedItem } from '../api/client'

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<IGroupDetail | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [tab, setTab] = useState<'feed' | 'members'>('feed')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

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

  async function handleLike(checkId: string | number) {
    const cid = String(checkId)
    const item = feed.find((v) => String(v.id) === cid)
    if (!item) return
    if (item.has_liked) {
      await api.checkLikes.unlike(cid)
      setFeed((prev) =>
        prev.map((v) => String(v.id) === cid
          ? { ...v, has_liked: false, like_count: (v.like_count ?? 1) - 1 }
          : v,
        ),
      )
    } else {
      await api.checkLikes.like(cid)
      setFeed((prev) =>
        prev.map((v) => String(v.id) === cid
          ? { ...v, has_liked: true, like_count: (v.like_count ?? 0) + 1 }
          : v,
        ),
      )
    }
  }

  async function handleLeave() {
    if (!group) return
    if (!confirm(`Покинуть группу «${group.name}»?`)) return
    await api.groups.leave(group.id)
    navigate('/groups')
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setInviteMsg('')
    setInviteError('')
    try {
      await api.groups.invite(Number(id), inviteUsername.trim())
      setInviteMsg(`Приглашение отправлено @${inviteUsername.trim()}`)
      setInviteUsername('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setInviteError(msg || 'Не удалось отправить приглашение')
    }
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
      <div className="min-h-screen bg-bg flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <p className="text-muted mb-4">Группа не найдена</p>
        <Link to="/groups" className="text-primary text-sm">← Назад</Link>
      </div>
    )
  }

  const medalEmoji = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-5">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/groups" className="text-muted hover:text-dark transition-colors text-xl">←</Link>
            <div>
              <h1 className="font-black text-dark text-lg">{group.name}</h1>
              <p className="text-muted text-xs">{group.members.length} участников</p>
            </div>
          </div>
          <button
            onClick={handleLeave}
            className="text-xs text-muted hover:text-secondary transition-colors px-3 py-1.5 border border-border rounded-xl"
          >
            {group.is_owner ? 'Удалить' : 'Выйти'}
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 pb-10 max-w-md mx-auto w-full flex flex-col gap-4">

        {/* Invite code + invite form */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-muted text-xs">Код:</span>
            <span className="font-mono font-black text-primary tracking-widest">{group.invite_code}</span>
            <button onClick={copyCode} className="ml-auto text-xs text-muted hover:text-primary transition-colors">
              {copied ? '✓ скопировано' : 'скопировать'}
            </button>
          </div>

          {/* Invite by username */}
          <button
            onClick={() => { setShowInvite(!showInvite); setInviteMsg(''); setInviteError('') }}
            className="text-xs text-primary font-medium hover:underline"
          >
            {showInvite ? '✕ Скрыть' : '+ Пригласить по логину'}
          </button>
          {showInvite && (
            <form onSubmit={handleInvite} className="mt-3 flex gap-2">
              <input
                type="text" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="логин пользователя" required autoFocus
                className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-dark placeholder-muted focus:outline-none focus:border-primary text-sm"
              />
              <button type="submit" className="bg-primary text-white font-bold px-3 py-2 rounded-xl text-xs">
                Пригласить
              </button>
            </form>
          )}
          {inviteMsg && <p className="text-primary text-xs mt-2">{inviteMsg}</p>}
          {inviteError && <p className="text-secondary text-xs mt-2">{inviteError}</p>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1">
          <button
            onClick={() => setTab('feed')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'feed' ? 'bg-primary text-white' : 'text-muted hover:text-dark'}`}
          >
            Лента
          </button>
          <button
            onClick={() => setTab('members')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'members' ? 'bg-primary text-white' : 'text-muted hover:text-dark'}`}
          >
            Участники
          </button>
        </div>

        {/* Feed */}
        {tab === 'feed' && (
          <div className="flex flex-col gap-3">
            {feed.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">🤫</p>
                <p className="text-dark font-bold mb-1">Лента пуста</p>
                <p className="text-muted text-sm">Когда кто-то из группы откажется от покупки — это появится здесь</p>
              </div>
            )}
            {feed.map((item) => (
              <div key={item.id} className="bg-white border border-border rounded-2xl p-4 shadow-card">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-primary font-bold text-sm">@{item.username}</p>
                  <p className="text-muted text-xs">{timeAgo(item.created_at)}</p>
                </div>
                <p className="text-dark text-sm mb-1">
                  отказался от <span className="font-bold">«{item.description}»</span>
                </p>
                <p className="text-primary font-black text-lg mb-3">+{item.amount.toLocaleString('ru')} ₽</p>
                <button
                  onClick={() => handleLike(item.id)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${item.has_liked ? 'text-secondary' : 'text-muted hover:text-secondary'}`}
                >
                  <span>{item.has_liked ? '❤️' : '🤍'}</span>
                  <span>{item.like_count ?? 0}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Members leaderboard */}
        {tab === 'members' && (
          <div className="flex flex-col gap-3">
            {group.members.map((m, i) => (
              <div
                key={m.id}
                className={`bg-white border rounded-2xl p-4 shadow-card flex items-center gap-4 ${m.is_me ? 'border-primary/40' : 'border-border'}`}
              >
                <span className="text-2xl w-8 text-center">
                  {i < 3 ? medalEmoji[i] : <span className="text-muted text-sm font-bold">{m.rank}</span>}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-dark">
                    @{m.username}
                    {m.is_me && <span className="ml-2 text-xs text-primary">(ты)</span>}
                  </p>
                  <p className="text-muted text-xs">{m.display_name}</p>
                </div>
                <p className="text-primary font-black">{m.total_saved.toLocaleString('ru')} ₽</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
