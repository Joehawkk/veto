import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type GroupDetail as IGroupDetail, type FeedItem, type GroupGoal } from '../api/client'
import { CopyIcon, HeartIcon } from '../components/Icons'

type Tab = 'feed' | 'members' | 'goals'

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<IGroupDetail | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [goals, setGoals] = useState<GroupGoal[]>([])
  const [tab, setTab] = useState<Tab>('feed')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  // Goal create form
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [goalLoading, setGoalLoading] = useState(false)

  // Transfer ownership dialog
  const [transferTarget, setTransferTarget] = useState<string | null>(null)

  async function reload() {
    if (!id) return
    const [g, f] = await Promise.all([
      api.groups.get(Number(id)),
      api.groups.getFeed(Number(id)),
    ])
    setGroup(g.data)
    setFeed(f.data)
  }

  async function reloadGoals() {
    if (!id) return
    const { data } = await api.groups.getGoals(Number(id))
    setGoals(data)
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.groups.get(Number(id)),
      api.groups.getFeed(Number(id)),
      api.groups.getGoals(Number(id)),
    ]).then(([g, f, gl]) => {
      setGroup(g.data)
      setFeed(f.data)
      setGoals(gl.data)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleLike(checkId: string | number) {
    const cid = String(checkId)
    const item = feed.find((v) => String(v.id) === cid)
    if (!item) return
    if (item.has_liked) {
      await api.checkLikes.unlike(cid)
      setFeed((prev) => prev.map((v) => String(v.id) === cid ? { ...v, has_liked: false, like_count: (v.like_count ?? 1) - 1 } : v))
    } else {
      await api.checkLikes.like(cid)
      setFeed((prev) => prev.map((v) => String(v.id) === cid ? { ...v, has_liked: true, like_count: (v.like_count ?? 0) + 1 } : v))
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
    setInviteMsg(''); setInviteError('')
    try {
      await api.groups.invite(Number(id), inviteUsername.trim())
      setInviteMsg(`Приглашение отправлено @${inviteUsername.trim()}`)
      setInviteUsername('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setInviteError(msg || 'Не удалось отправить приглашение')
    }
  }

  async function handleCreateGoal(e: FormEvent) {
    e.preventDefault()
    if (!id || !goalTitle || !goalAmount) return
    setGoalLoading(true)
    try {
      await api.groups.createGoal(Number(id), { title: goalTitle, target_amount: parseFloat(goalAmount) })
      setGoalTitle(''); setGoalAmount(''); setShowGoalForm(false)
      reloadGoals()
    } catch {}
    finally { setGoalLoading(false) }
  }

  async function handleSetRole(userId: string, role: 'admin' | 'member') {
    if (!id) return
    try {
      await api.groups.setMemberRole(Number(id), userId, role)
      reload()
    } catch {}
  }

  async function handleKick(userId: string, username: string) {
    if (!id || !confirm(`Исключить @${username}?`)) return
    try {
      await api.groups.kickMember(Number(id), userId)
      reload()
    } catch {}
  }

  async function handleTransfer(newOwnerId: string) {
    if (!id || !confirm('Передать владение группой? Вы станете администратором.')) return
    try {
      await api.groups.transferOwnership(Number(id), newOwnerId)
      setTransferTarget(null)
      reload()
    } catch {}
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

  const me = group.members.find((m) => m.is_me)
  const myRole = me?.role ?? 'member'
  const isOwner = group.is_owner || myRole === 'owner'
  const isAdmin = isOwner || myRole === 'admin'
  const medalEmoji = ['🥇', '🥈', '🥉']

  const ROLE_LABEL: Record<string, string> = { owner: 'Владелец', admin: 'Админ', member: '' }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-5">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/groups" className="text-muted hover:text-dark transition-colors text-xl">←</Link>
            <div>
              <h1 className="font-black text-dark text-lg">{group.name}</h1>
              <p className="text-muted text-xs">{group.members.length} участников</p>
            </div>
          </div>
          {!isOwner && (
            <button
              onClick={handleLeave}
              className="text-xs text-muted hover:text-secondary transition-colors px-3 py-1.5 border border-border rounded-xl"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-5 pb-10 max-w-md mx-auto w-full flex flex-col gap-4">

        {/* Invite code + invite form */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-muted text-xs">Код:</span>
            <span className="font-mono font-black text-primary tracking-widest">{group.invite_code}</span>
            <button onClick={copyCode} className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors" title="Скопировать код">
              {copied ? <span className="text-primary font-medium">✓</span> : <CopyIcon size={15} />}
            </button>
          </div>
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
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {(['feed', 'goals', 'members'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-dark'}`}
            >
              {t === 'feed' ? 'Лента' : t === 'goals' ? 'Цели' : 'Участники'}
            </button>
          ))}
        </div>

        {/* Feed */}
        {tab === 'feed' && (
          <div className="flex flex-col gap-3">
            {feed.length === 0 && (
              <div className="text-center py-16">
                <p className="text-dark font-bold mb-1">Лента пуста</p>
                <p className="text-muted text-sm">Когда кто-то из группы откажется от покупки — это появится здесь</p>
              </div>
            )}
            {feed.map((item) => (
              <div key={item.id} className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs overflow-hidden shrink-0">
                      {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.username} className="w-full h-full object-cover" />
                      ) : (
                        item.username[0]?.toUpperCase()
                      )}
                    </div>
                    <p className="text-dark font-bold text-sm">@{item.username}</p>
                  </div>
                  <p className="text-muted text-xs">{timeAgo(item.created_at)}</p>
                </div>
                <p className="text-dark text-sm mb-1">
                  отказался от <span className="font-bold">«{item.description}»</span>
                </p>
                <p className="text-primary font-black text-lg mb-3">+{item.amount.toLocaleString('ru')} ₽</p>
                <button
                  onClick={() => handleLike(item.id)}
                  className={`flex items-center gap-1.5 text-sm transition-all ${item.has_liked ? 'text-secondary' : 'text-muted hover:text-secondary'}`}
                >
                  <HeartIcon size={18} filled={item.has_liked} />
                  <span>{item.like_count ?? 0}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Goals */}
        {tab === 'goals' && (
          <div className="flex flex-col gap-3">
            {isAdmin && !showGoalForm && (
              <button
                onClick={() => setShowGoalForm(true)}
                className="w-full border-2 border-dashed border-primary/30 text-primary font-medium py-3 rounded-2xl text-sm hover:border-primary/60 transition-colors"
              >
                + Создать цель группы
              </button>
            )}
            {showGoalForm && (
              <form onSubmit={handleCreateGoal} className="bg-card border border-border rounded-2xl p-5 shadow-card flex flex-col gap-3">
                <h3 className="font-black text-dark">Новая цель</h3>
                <input
                  type="text" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Название цели" required
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary text-sm"
                />
                <input
                  type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="Целевая сумма (₽)" required min={1}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary text-sm"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowGoalForm(false)} className="flex-1 border border-border py-2.5 rounded-xl text-muted text-sm font-medium">Отмена</button>
                  <button type="submit" disabled={goalLoading} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-black text-sm shadow-orange disabled:opacity-60">
                    {goalLoading ? 'Создаём...' : 'Создать'}
                  </button>
                </div>
              </form>
            )}

            {goals.length === 0 && !showGoalForm && (
              <div className="text-center py-12">
                <p className="text-dark font-bold mb-1">Нет активных целей</p>
                <p className="text-muted text-sm">
                  {isAdmin ? 'Создайте первую цель для группы' : 'Администратор пока не создал цели'}
                </p>
              </div>
            )}

            {goals.map((goal) => {
              const pct = Math.min(100, goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0)
              return (
                <div key={goal.id} className="bg-card border border-border rounded-2xl p-5 shadow-card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-dark">{goal.title}</p>
                      {goal.status === 'completed' && (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1 inline-block">Выполнено!</span>
                      )}
                    </div>
                    <p className="text-primary font-black text-sm">{pct}%</p>
                  </div>
                  <div className="w-full bg-border rounded-full h-2 mb-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>{goal.current_amount.toLocaleString('ru')} ₽</span>
                    <span>{goal.target_amount.toLocaleString('ru')} ₽</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Members */}
        {tab === 'members' && (
          <div className="flex flex-col gap-3">
            {group.members.map((m, i) => (
              <div
                key={m.id}
                className={`bg-card border rounded-2xl p-4 shadow-card ${m.is_me ? 'border-primary/40' : 'border-border'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center text-primary font-black text-sm">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.username} className="w-full h-full object-cover" />
                      ) : (
                        (m.display_name || m.username)[0]?.toUpperCase()
                      )}
                    </div>
                    {i < 3 && (
                      <span className="absolute -bottom-1 -right-1 text-sm leading-none">{medalEmoji[i]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-dark truncate">
                        {m.display_name}
                        {m.is_me && <span className="ml-1.5 text-xs text-primary">(ты)</span>}
                      </p>
                      {m.role !== 'member' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.role === 'owner' ? 'bg-primary/15 text-primary' : 'bg-gray-dark/10 text-gray-dark'}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-xs">@{m.username}</p>
                  </div>
                  <p className="text-primary font-black shrink-0">{m.total_saved.toLocaleString('ru')} ₽</p>
                </div>

                {/* Admin controls — shown to owner/admin for other members */}
                {!m.is_me && isAdmin && m.role !== 'owner' && (
                  <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                    {isOwner && m.role === 'member' && (
                      <button
                        onClick={() => handleSetRole(m.id, 'admin')}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border text-gray-dark hover:border-primary hover:text-primary transition-colors"
                      >
                        Сделать админом
                      </button>
                    )}
                    {isOwner && m.role === 'admin' && (
                      <button
                        onClick={() => handleSetRole(m.id, 'member')}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border text-gray-dark hover:border-primary hover:text-primary transition-colors"
                      >
                        Снять роль
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => setTransferTarget(m.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border text-gray-dark hover:border-primary hover:text-primary transition-colors"
                      >
                        Передать владение
                      </button>
                    )}
                    <button
                      onClick={() => handleKick(m.id, m.username)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/5 transition-colors"
                    >
                      Исключить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Transfer ownership dialog */}
        {transferTarget && (
          <div className="fixed inset-0 bg-dark/50 flex items-center justify-center z-50 px-6">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-card-hover">
              <h3 className="font-black text-dark mb-2">Передать владение?</h3>
              <p className="text-muted text-sm mb-5">
                Вы передадите права владельца{' '}
                <span className="font-bold text-dark">
                  @{group.members.find((m) => m.id === transferTarget)?.username}
                </span>. Вы станете администратором.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setTransferTarget(null)} className="flex-1 border border-border py-3 rounded-xl text-muted font-medium hover:text-dark transition-colors">
                  Отмена
                </button>
                <button onClick={() => handleTransfer(transferTarget)} className="flex-1 bg-primary text-white font-black py-3 rounded-xl shadow-orange">
                  Передать
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
