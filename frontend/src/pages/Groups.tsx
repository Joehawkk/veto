import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Group, type Notification } from '../api/client'
import BottomNav from '../components/BottomNav'
import { BellIcon } from '../components/Icons'

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)

  async function load() {
    try {
      const [g, n] = await Promise.all([api.groups.list(), api.notifications.get()])
      setGroups(g.data)
      setNotifications(n.data.items)
      setUnread(n.data.unread)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.groups.create(newName)
      setCreatedCode(data.invite_code)
      setNewName('')
      load()
    } catch {
      setError('Не удалось создать группу')
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.groups.join(joinCode.toUpperCase())
      setShowJoin(false)
      setJoinCode('')
      load()
    } catch {
      setError('Группа не найдена. Проверь код.')
    }
  }

  async function handleAccept(inviteId: number) {
    try {
      await api.invites.accept(inviteId)
      load()
    } catch {
      setError('Не удалось принять приглашение')
    }
  }

  async function handleDecline(inviteId: number) {
    try {
      await api.invites.decline(inviteId)
      setNotifications((prev) => prev.filter((n) => n.reference_id !== inviteId))
    } catch {}
  }

  async function openNotifs() {
    setShowNotifs(true)
    if (unread > 0) {
      await api.notifications.markRead()
      setUnread(0)
    }
  }

  const inviteNotifs = notifications.filter((n) => n.type === 'group_invite' && n.reference_id)
  const otherNotifs = notifications.filter((n) => n.type !== 'group_invite')

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 bg-card border-b border-border">
        <div>
          <span className="text-primary font-black text-2xl tracking-widest">VETO</span>
          <p className="text-muted text-xs mt-0.5">группы</p>
        </div>
        <button
          onClick={openNotifs}
          className="relative text-muted hover:text-dark transition-colors p-1"
        >
          <BellIcon size={20} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </header>

      {/* Notifications panel */}
      {showNotifs && (
        <div className="bg-card border-b border-border px-6 py-4 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-dark text-sm">Уведомления</p>
            <button onClick={() => setShowNotifs(false)} className="text-muted text-sm hover:text-dark">✕</button>
          </div>

          {inviteNotifs.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {inviteNotifs.map((n) => (
                <div key={n.id} className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <p className="text-dark text-sm mb-2">{n.message}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => n.reference_id && handleAccept(n.reference_id)}
                      className="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => n.reference_id && handleDecline(n.reference_id)}
                      className="flex-1 border border-border text-muted text-xs font-medium py-2 rounded-lg hover:text-dark"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {otherNotifs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {otherNotifs.slice(0, 8).map((n) => (
                <div key={n.id} className={`text-sm px-3 py-2 rounded-xl ${n.read ? 'text-muted' : 'text-dark font-medium bg-bg'}`}>
                  {n.message}
                </div>
              ))}
            </div>
          )}

          {inviteNotifs.length === 0 && otherNotifs.length === 0 && (
            <p className="text-muted text-sm text-center py-4">Нет уведомлений</p>
          )}
        </div>
      )}

      <main className="flex-1 px-6 py-6 pb-24 max-w-md mx-auto w-full flex flex-col gap-4">

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError('') }}
            className="flex-1 border border-border text-muted font-medium py-3 rounded-xl text-sm hover:border-primary hover:text-primary transition-colors"
          >
            + По коду
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); setError('') }}
            className="flex-1 bg-primary text-white font-black py-3 rounded-xl text-sm shadow-orange"
          >
            + Создать
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
            {createdCode ? (
              <div className="text-center">
                <p className="text-dark font-bold mb-1">Группа создана!</p>
                <p className="text-muted text-sm mb-3">Поделись кодом с друзьями:</p>
                <div className="bg-bg rounded-xl px-6 py-3 text-primary font-black text-2xl tracking-widest text-center mb-4">
                  {createdCode}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(createdCode)}
                  className="text-primary text-sm hover:underline mr-4"
                >
                  Скопировать
                </button>
                <button onClick={() => { setCreatedCode(''); setShowCreate(false) }} className="text-muted text-sm hover:text-dark">
                  Закрыть
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="flex gap-3">
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Название группы" required autoFocus
                  className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-dark placeholder-muted focus:outline-none focus:border-primary text-sm"
                />
                <button type="submit" className="bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm">
                  Создать
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-muted px-2 hover:text-dark">✕</button>
              </form>
            )}
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Код (напр. ABC123)" required autoFocus maxLength={6}
                className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-dark placeholder-muted focus:outline-none focus:border-primary text-sm uppercase tracking-widest"
              />
              <button type="submit" className="bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm">
                Войти
              </button>
              <button type="button" onClick={() => setShowJoin(false)} className="text-muted px-2 hover:text-dark">✕</button>
            </form>
          </div>
        )}

        {error && (
          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">👥</p>
            <p className="text-dark font-bold mb-1">Нет групп</p>
            <p className="text-muted text-sm">Создай группу или вступи по коду</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-dark">{g.name}</p>
                    {g.is_owner && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">владелец</span>
                    )}
                  </div>
                  <p className="text-muted text-sm">{g.member_count} участников</p>
                </div>
                <div className="text-right">
                  <p className="text-primary font-black">{g.group_total.toLocaleString('ru')} ₽</p>
                  <p className="text-muted text-xs">сэкономлено</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <span className="text-muted text-xs font-mono tracking-widest">{g.invite_code}</span>
                <button
                  onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(g.invite_code) }}
                  className="text-muted text-xs hover:text-primary transition-colors"
                >
                  скопировать
                </button>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
