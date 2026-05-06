import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import NotificationBell from './NotificationBell'

const navItems = [
  {
    to: '/dashboard',
    label: 'Щит',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
      </svg>
    ),
  },
  {
    to: '/feed',
    label: 'Лента',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/groups',
    label: 'Группы',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <circle cx="17" cy="4" r="2.5" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Профиль',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-6">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <span className="text-primary font-black text-2xl tracking-widest">VETO</span>
            <p className="text-muted text-xs mt-1">Экономить — это флекс</p>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:text-white hover:bg-border'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-primary font-black text-xl tracking-widest">VETO</span>
          <NotificationBell />
        </header>

        <div className="flex-1 overflow-auto pb-24 md:pb-0">
          {children}
        </div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-40">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
