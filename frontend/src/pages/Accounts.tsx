import { useState, useEffect } from 'react'
import { api, type AccountUser } from '../api/client'
import BottomNav from '../components/BottomNav'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 30) return new Date(dateStr).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
  if (d > 0) return `${d} дн. назад`
  if (h > 0) return `${h} ч. назад`
  return 'только что'
}

export default function Accounts() {
  const [users, setUsers] = useState<AccountUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.users.list()
      .then(({ data }) => setUsers(data))
      .catch(() => setError('Не удалось загрузить пользователей'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-4 px-6 py-5 bg-card border-b border-border">
        <div className="flex-1">
          <h1 className="text-xl font-black text-dark">Аккаунты</h1>
          <p className="text-muted text-xs">{users.length} пользователей в базе</p>
        </div>
      </header>

      <main className="px-4 py-5 pb-24 max-w-lg mx-auto">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени..."
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-dark placeholder-muted focus:outline-none focus:border-primary transition-colors mb-4 shadow-card"
        />

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-muted text-sm">Ничего не найдено</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((u, i) => (
            <div
              key={u.id}
              className="bg-card border border-border rounded-2xl p-4 shadow-card"
            >
              <div className="flex items-center gap-3">
                {/* Avatar / rank */}
                <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                  {i === 0 ? (
                    <span className="text-lg">🥇</span>
                  ) : i === 1 ? (
                    <span className="text-lg">🥈</span>
                  ) : i === 2 ? (
                    <span className="text-lg">🥉</span>
                  ) : (
                    <span className="text-primary font-black text-sm">{u.display_name[0]?.toUpperCase()}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-dark truncate">{u.display_name}</p>
                    <span className="text-muted text-xs shrink-0">@{u.username}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-muted text-xs">{u.veto_count} вето</span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-muted text-xs">{timeAgo(u.created_at)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-primary font-black text-base">
                    {u.total_saved.toLocaleString('ru')} ₽
                  </p>
                  <p className="text-muted text-[10px]">сэкономлено</p>
                </div>
              </div>

              {/* ID for debug */}
              <div className="mt-2 px-2 py-1 bg-bg rounded-lg">
                <p className="text-muted text-[10px] font-mono truncate">id: {u.id}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
