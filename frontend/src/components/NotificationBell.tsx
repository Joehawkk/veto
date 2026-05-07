import { useState, useEffect, useRef } from 'react'
import { api, type Notification } from '../api/client'
import { BellIcon } from './Icons'

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const { data } = await api.notifications.get()
      setItems(data.items)
      setUnread(data.unread)
    } catch {}
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpen() {
    setOpen((v) => !v)
    if (!open && unread > 0) {
      await api.notifications.markRead()
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'только что'
    if (m < 60) return `${m} мин`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} ч`
    return `${Math.floor(h / 24)} д`
  }

  const iconByType: Record<string, string> = {
    group_veto: '⚡',
    goal_completed: '🎉',
    respect: '❤️',
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-white hover:bg-card transition-colors"
      >
        <BellIcon size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-bold text-white text-sm">Уведомления</p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-muted text-sm">Нет уведомлений</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border last:border-0 flex items-start gap-3 ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <span className="text-lg mt-0.5 shrink-0">{iconByType[n.type] ?? '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">{n.message}</p>
                    <p className="text-xs text-muted mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
