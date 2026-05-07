import { createContext, useContext, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

function applyTheme(t: Theme) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('veto_theme', t)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = (localStorage.getItem('veto_theme') as Theme) ?? 'light'
    // Apply synchronously during init — no flash
    applyTheme(saved)
    return saved
  })

  function toggleTheme() {
    setTheme((t) => {
      const next: Theme = t === 'light' ? 'dark' : 'light'
      applyTheme(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
