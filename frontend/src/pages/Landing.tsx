import { Link } from 'react-router-dom'
import { ZapIcon, FlameIcon, TargetIcon, MoonIcon } from '../components/Icons'
import { useTheme } from '../contexts/ThemeContext'

const features = [
  {
    icon: <ZapIcon size={28} />,
    color: 'text-primary bg-primary/10',
    title: 'Нажми VETO',
    desc: 'Вместо импульсивной покупки — один тап. Зафикси отказ и почувствуй силу.',
  },
  {
    icon: <FlameIcon size={28} />,
    color: 'text-[#F86D06] bg-[#FFDE8A]/40',
    title: 'Получи Respect',
    desc: 'Комьюнити видит твои отказы и дает Respect. Отказываться стало модно.',
  },
  {
    icon: <TargetIcon size={28} />,
    color: 'text-secondary bg-secondary/10',
    title: 'Копи на цель',
    desc: 'Каждый VETO приближает к цели. Прогресс-бар не врёт — ты реально копишь.',
  },
]

export default function Landing() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-bg text-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="text-primary font-black text-xl tracking-widest">VETO</span>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-card text-muted hover:text-dark border border-border'
            }`}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <MoonIcon size={18} />
          </button>
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-muted hover:text-dark transition-colors"
          >
            Войти
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            Регистрация
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-20 max-w-3xl mx-auto">
        <div className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">
          Loud Budgeting Movement
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 text-dark">
          ЭКОНОМИТЬ —<br />
          <span className="text-primary">ЭТО НОВЫЙ</span>
          <br />
          ФЛЕКС
        </h1>
        <p className="text-muted text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
          Превращай отказ от импульсивных трат в социальное достижение.
          Шерь свои "Veto" и получай Respect от комьюнити.
        </p>
        <Link
          to="/register"
          className="inline-block px-10 py-4 bg-primary text-white font-black text-lg rounded-2xl shadow-orange hover:shadow-orange-lg transition-all hover:scale-105"
        >
          Начать бесплатно →
        </Link>
      </section>

      {/* Mock UI — phone widget */}
      <section className="px-6 pb-20 flex justify-center">
        <div
          className="rounded-3xl p-5 w-full max-w-xs text-left select-none"
          style={{ background: 'linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 100%)', boxShadow: '0 8px 40px rgba(0,0,0,0.45)' }}
        >
          {/* Goal row */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#8e8e93' }}>Цель: Новый iPhone 16 Pro</p>
            <span className="text-[11px] font-bold" style={{ color: '#fd7203' }}>20%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full rounded-full mb-1" style={{ height: 4, background: '#3a3a3c' }}>
            <div className="rounded-full h-full" style={{ width: '20%', background: 'linear-gradient(90deg, #fd7203, #ff9a3c)' }} />
          </div>

          {/* Amounts */}
          <div className="flex justify-between mb-5">
            <span className="text-xs font-bold" style={{ color: '#ffffff' }}>18 500 ₽</span>
            <span className="text-xs" style={{ color: '#8e8e93' }}>из 90 000 ₽</span>
          </div>

          {/* VETO button */}
          <div
            className="w-full h-16 rounded-2xl flex items-center justify-center font-black text-2xl tracking-widest text-white"
            style={{ background: 'linear-gradient(135deg, #fd7203 0%, #ff5500 100%)', boxShadow: '0 0 24px rgba(253,114,3,0.55), 0 4px 16px rgba(0,0,0,0.3)' }}
          >
            VETO
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] mt-3" style={{ color: '#636366' }}>последний раз: Кофе, −350 ₽</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 shadow-card">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-dark mb-2">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 pb-24">
        <h2 className="text-3xl font-black text-dark mb-4">Готов отказаться от лишнего?</h2>
        <p className="text-muted mb-8">Присоединяйся — это бесплатно.</p>
        <Link
          to="/register"
          className="inline-block px-10 py-4 bg-primary text-white font-black text-lg rounded-2xl shadow-orange hover:shadow-orange-lg transition-all"
        >
          Создать аккаунт
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center text-muted text-xs pb-8 border-t border-border pt-8">
        VETO © 2026 · Экономить — это флекс
      </footer>
    </div>
  )
}
