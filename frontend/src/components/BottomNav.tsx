import { Link, useLocation } from 'react-router-dom'

const tabs = [
  {
    to: '/',
    exact: true,
    label: 'Главная',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    to: '/history',
    exact: false,
    label: 'История',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    to: '/accounts',
    exact: false,
    label: 'Аккаунты',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  function isActive(to: string, exact: boolean) {
    if (exact) return pathname === to
    return pathname.startsWith(to)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex">
      {tabs.map((tab) => {
        const active = isActive(tab.to, tab.exact)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
              active ? 'text-primary' : 'text-muted hover:text-dark'
            }`}
          >
            {tab.icon(active)}
            <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
