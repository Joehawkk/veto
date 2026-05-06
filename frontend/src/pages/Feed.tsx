import { useState, useEffect, useCallback } from 'react'
import { api, type FeedItem } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

export default function Feed() {
  const { user } = useAuth()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api.feed.get()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFeed() }, [loadFeed])

  async function handleRespect(item: FeedItem) {
    if (item.has_respected || item.username === user?.username) return
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, has_respected: true, respect_count: i.respect_count + 1 }
          : i,
      ),
    )
    try {
      await api.respects.create(item.id)
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, has_respected: false, respect_count: i.respect_count - 1 }
            : i,
        ),
      )
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Анти-FOMO Лента</h1>
        <p className="text-muted text-sm mt-1">Что ветировало комьюнити</p>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🕊️</p>
          <p className="text-muted">Пока никто не ветировал. Будь первым!</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isOwn = item.username === user?.username
          return (
            <div key={item.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-primary font-bold text-sm">@{item.username}</span>
                    {isOwn && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        ты
                      </span>
                    )}
                    <span className="text-muted text-xs">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="text-white text-sm leading-relaxed">
                    ветировал{' '}
                    <span className="font-bold">«{item.description}»</span>{' '}
                    на{' '}
                    <span className="text-primary font-bold">
                      {item.amount.toLocaleString('ru')} ₽
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleRespect(item)}
                  disabled={item.has_respected || isOwn}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-shrink-0 ${
                    item.has_respected
                      ? 'text-secondary'
                      : isOwn
                      ? 'text-border cursor-default'
                      : 'text-muted hover:text-secondary hover:bg-secondary/10'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill={item.has_respected ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span className="text-xs font-bold">{item.respect_count}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
