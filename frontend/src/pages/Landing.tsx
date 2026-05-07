import { Link } from 'react-router-dom'
import { ZapIcon, FlameIcon, TargetIcon } from '../components/Icons'

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
  return (
    <div className="min-h-screen bg-bg text-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="text-primary font-black text-xl tracking-widest">VETO</span>
        <div className="flex gap-3">
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

      {/* Mock UI */}
      <section className="px-6 pb-20 flex justify-center">
        <div className="bg-white border border-border rounded-3xl p-6 w-full max-w-xs text-left shadow-card">
          <p className="text-muted text-xs mb-3 uppercase tracking-widest">Цель: Новый iPhone</p>
          <div className="flex justify-between items-end mb-2">
            <span className="text-dark font-bold">18 500 ₽</span>
            <span className="text-muted text-xs">из 90 000 ₽</span>
          </div>
          <div className="w-full bg-border rounded-full h-2 mb-6">
            <div className="bg-primary h-2 rounded-full" style={{ width: '20%' }} />
          </div>
          <div className="w-full h-20 rounded-2xl bg-primary text-white font-black text-2xl tracking-widest shadow-orange flex items-center justify-center select-none pointer-events-none">
            VETO
          </div>
          <p className="text-center text-muted text-xs mt-3">последний раз: Кофе, −350 ₽</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-border rounded-2xl p-6 shadow-card">
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
