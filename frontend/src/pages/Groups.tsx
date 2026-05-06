import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Group } from '../api/client'

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [createdCode, setCreatedCode] = useState('')

  async function load() {
    try {
      const { data } = await api.groups.list()
      setGroups(data)
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

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black">Группы</h1>
          <p className="text-muted text-sm mt-1">Соревнуйся с друзьями</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }}
            className="px-3 py-2 text-sm border border-border text-muted rounded-xl hover:border-primary hover:text-primary transition-colors"
          >
            + Код
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }}
            className="px-3 py-2 text-sm bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            + Создать
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          {createdCode ? (
            <div className="text-center">
              <p className="text-white font-bold mb-1">Группа создана!</p>
              <p className="text-muted text-sm mb-3">Поделись кодом с друзьями:</p>
              <div className="bg-bg rounded-xl px-6 py-3 text-primary font-black text-2xl tracking-widest text-center mb-4">
                {createdCode}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(createdCode) }}
                className="text-primary text-sm hover:underline mr-4"
              >
                Скопировать
              </button>
              <button onClick={() => { setCreatedCode(''); setShowCreate(false) }} className="text-muted text-sm hover:text-white">
                Закрыть
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название группы"
                required
                autoFocus
                className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-primary text-sm"
              />
              <button type="submit" className="bg-primary text-black font-bold px-4 py-2.5 rounded-xl text-sm">
                Создать
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted px-2">✕</button>
            </form>
          )}
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Код приглашения (напр. FIN001)"
              required
              autoFocus
              maxLength={6}
              className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-primary text-sm uppercase tracking-widest"
            />
            <button type="submit" className="bg-primary text-black font-bold px-4 py-2.5 rounded-xl text-sm">
              Войти
            </button>
            <button type="button" onClick={() => setShowJoin(false)} className="text-muted px-2">✕</button>
          </form>
        </div>
      )}

      {error && (
        <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3 mb-4">
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
          <p className="text-white font-bold mb-1">Нет групп</p>
          <p className="text-muted text-sm">Создай группу или вступи по коду</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <Link
            key={g.id}
            to={`/groups/${g.id}`}
            className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-white">{g.name}</p>
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
    </div>
  )
}
