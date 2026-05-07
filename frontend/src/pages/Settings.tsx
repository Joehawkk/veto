import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useTheme } from '../contexts/ThemeContext'
import BottomNav from '../components/BottomNav'
import {
  StopIcon, BrainIcon, TargetIcon, FrownIcon,
  StressedFaceIcon, TiredFaceIcon, TagIcon, PhoneIcon, NeutralFaceIcon, UsersIcon,
  GamepadIcon, MusicNoteIcon, ShirtIcon, LaptopIcon, DumbbellIcon,
  BookIcon, PlaneIcon, UtensilsIcon, PaletteIcon, FilmIcon,
} from '../components/Icons'

type IconComponent = React.ComponentType<{ size?: number }>

const GOALS: { value: string; Icon: IconComponent }[] = [
  { value: 'Трачу слишком много и хочу остановиться', Icon: StopIcon },
  { value: 'Хочу тратить осознаннее', Icon: BrainIcon },
  { value: 'Коплю на конкретную цель', Icon: TargetIcon },
  { value: 'Справляюсь с финансовым стрессом', Icon: FrownIcon },
]

const TRIGGERS: { value: string; Icon: IconComponent }[] = [
  { value: 'Стресс или тревога', Icon: StressedFaceIcon },
  { value: 'Усталость после учёбы', Icon: TiredFaceIcon },
  { value: 'Скидки и акции', Icon: TagIcon },
  { value: 'Реклама в соцсетях', Icon: PhoneIcon },
  { value: 'Скука', Icon: NeutralFaceIcon },
  { value: 'Влияние друзей', Icon: UsersIcon },
]

const INTERESTS: { value: string; Icon: IconComponent }[] = [
  { value: 'Игры', Icon: GamepadIcon },
  { value: 'Музыка', Icon: MusicNoteIcon },
  { value: 'Мода', Icon: ShirtIcon },
  { value: 'Технологии', Icon: LaptopIcon },
  { value: 'Спорт', Icon: DumbbellIcon },
  { value: 'Книги', Icon: BookIcon },
  { value: 'Путешествия', Icon: PlaneIcon },
  { value: 'Еда', Icon: UtensilsIcon },
  { value: 'Творчество', Icon: PaletteIcon },
  { value: 'Кино и сериалы', Icon: FilmIcon },
]

export default function Settings() {
  const navigate = useNavigate()
  const { profile, saveProfile } = useProfile()
  const { theme, toggleTheme } = useTheme()

  const [monthlySpend, setMonthlySpend] = useState(profile?.monthlySpend ?? 8000)
  const [goals, setGoals] = useState<string[]>(
    profile?.goal ? profile.goal.split('; ').filter(Boolean) : []
  )
  const [triggers, setTriggers] = useState<string[]>(profile?.spendingTriggers ?? [])
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [saved, setSaved] = useState(false)

  function toggleArr<T>(arr: T[], val: T, max?: number): T[] {
    if (arr.includes(val)) return arr.filter((x) => x !== val)
    if (max !== undefined && arr.length >= max) return arr
    return [...arr, val]
  }

  function handleSave() {
    if (!profile) return
    saveProfile({
      ...profile,
      monthlySpend,
      goal: goals.join('; '),
      spendingTriggers: triggers,
      interests,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="px-6 py-5 bg-card border-b border-border flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted hover:text-dark text-xl transition-colors">←</button>
        <h1 className="text-xl font-black text-dark">Настройки</h1>
      </header>

      <main className="px-6 py-6 pb-28 max-w-lg mx-auto flex flex-col gap-6">

        {/* Appearance */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-4">Внешний вид</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark font-medium text-sm">Тёмная тема</p>
              <p className="text-muted text-xs mt-0.5">Меньше нагрузки на глаза</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-primary' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        {/* Monthly spend */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-1">Спонтанные траты</h2>
          <p className="text-muted text-sm mb-5">Сколько уходит на импульсивные покупки в месяц</p>
          <div className="text-center mb-4">
            <p className="text-primary font-black text-4xl">{monthlySpend.toLocaleString('ru')}</p>
            <p className="text-muted text-sm mt-1">₽ в месяц</p>
          </div>
          <input
            type="range" min={0} max={50000} step={500} value={monthlySpend}
            onChange={(e) => setMonthlySpend(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#FD7203' }}
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>0 ₽</span>
            <span>50 000 ₽</span>
          </div>
        </div>

        {/* Goals */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-1">Зачем ты здесь?</h2>
          <p className="text-muted text-sm mb-4">Можно выбрать несколько</p>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => {
              const sel = goals.includes(g.value)
              return (
                <button
                  key={g.value}
                  onClick={() => setGoals(toggleArr(goals, g.value))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    sel ? 'border-primary bg-primary/10 text-dark' : 'border-border bg-bg text-gray-dark hover:border-primary/40'
                  }`}
                >
                  <span className="text-primary shrink-0"><g.Icon size={18} /></span>
                  <span className="font-medium text-sm leading-snug">{g.value}</span>
                  {sel && <span className="ml-auto text-primary font-black text-sm">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Triggers */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-1">Триггеры трат</h2>
          <p className="text-muted text-sm mb-4">Что заставляет тебя покупать?</p>
          <div className="flex flex-col gap-2">
            {TRIGGERS.map((t) => {
              const sel = triggers.includes(t.value)
              return (
                <button
                  key={t.value}
                  onClick={() => setTriggers(toggleArr(triggers, t.value))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    sel ? 'border-primary bg-primary/10 text-dark' : 'border-border bg-bg text-gray-dark hover:border-primary/40'
                  }`}
                >
                  <span className="text-primary shrink-0"><t.Icon size={18} /></span>
                  <span className="font-medium text-sm leading-snug">{t.value}</span>
                  {sel && <span className="ml-auto text-primary font-black text-sm">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Interests */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-black text-dark mb-1">Интересы</h2>
          <p className="text-muted text-sm mb-4">До 4 — AI советует альтернативы · Выбрано: {interests.length} / 4</p>
          <div className="grid grid-cols-2 gap-2">
            {INTERESTS.map((i) => {
              const sel = interests.includes(i.value)
              const disabled = !sel && interests.length >= 4
              return (
                <button
                  key={i.value}
                  onClick={() => !disabled && setInterests(toggleArr(interests, i.value, 4))}
                  disabled={disabled}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    sel
                      ? 'border-primary bg-primary/10 text-dark'
                      : disabled
                      ? 'border-border bg-card text-muted opacity-40 cursor-not-allowed'
                      : 'border-border bg-bg text-gray-dark hover:border-primary/40'
                  }`}
                >
                  <span className="text-primary"><i.Icon size={16} /></span>
                  <span className="font-medium text-sm">{i.value}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Save */}
        {saved && (
          <div className="bg-primary/10 border border-primary/30 text-primary text-sm rounded-xl px-4 py-3 text-center font-medium">
            Настройки сохранены!
          </div>
        )}
        <button
          onClick={handleSave}
          className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-orange hover:shadow-orange-lg active:scale-[0.98] transition-all"
        >
          Сохранить изменения
        </button>

      </main>
      <BottomNav />
    </div>
  )
}
