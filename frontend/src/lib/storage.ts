import { type Verdict } from './scoring'

export interface Profile {
  goal: string
  monthlySpend: number
  spendingTrigger?: string
  interests: string[]
  savingsTarget?: number
  savingsMonths?: number
}

export type MoodValue = 'good' | 'neutral' | 'sad' | 'angry' | 'stressed' | 'tired'
export type ThoughtDuration = '30min' | '1hour' | '24hours' | '3days'

export interface CheckAnswers {
  needNow: boolean
  hasSimilar: boolean
  thoughtDuration: ThoughtDuration
  mood: MoodValue
}

export interface HistoryEntry {
  id: string
  name: string
  price: number
  hasDiscount: boolean
  answers: CheckAnswers
  aiVerdict: Verdict
  aiComment: string
  outcome: 'stopped' | 'bought' | 'pending'
  timerDeadline?: string
  createdAt: string
}

export interface CurrentItem {
  name: string
  price: number
  hasDiscount: boolean
}

export interface CheckResult {
  answers: CheckAnswers
  localVerdict: Verdict
}

function getUserSuffix(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? 'null')
    return user?.id ? `_${user.id}` : ''
  } catch { return '' }
}

const KEYS = {
  get profile() { return `veto_profile${getUserSuffix()}` },
  get history() { return `veto_history${getUserSuffix()}` },
  get onboarded() { return `veto_onboarded${getUserSuffix()}` },
  current: 'veto_current',
  result: 'veto_result',
}

export const getProfile = (): Profile | null => {
  try { return JSON.parse(localStorage.getItem(KEYS.profile) ?? 'null') } catch { return null }
}
export const setProfile = (p: Profile) =>
  localStorage.setItem(KEYS.profile, JSON.stringify(p))

export const isOnboarded = () => localStorage.getItem(KEYS.onboarded) === 'true'
export const setOnboarded = () => localStorage.setItem(KEYS.onboarded, 'true')

export const getHistory = (): HistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(KEYS.history) ?? '[]') } catch { return [] }
}
export const setHistory = (h: HistoryEntry[]) =>
  localStorage.setItem(KEYS.history, JSON.stringify(h))

export const addHistoryEntry = (entry: HistoryEntry) => {
  const h = getHistory()
  const idx = h.findIndex((e) => e.id === entry.id)
  if (idx >= 0) h[idx] = entry; else h.unshift(entry)
  setHistory(h)
}

export const updateOutcome = (id: string, outcome: 'stopped' | 'bought') => {
  const h = getHistory()
  const e = h.find((x) => x.id === id)
  if (e) { e.outcome = outcome; setHistory(h) }
}

export const updateAiComment = (id: string, aiComment: string, aiVerdict: Verdict) => {
  const h = getHistory()
  const e = h.find((x) => x.id === id)
  if (e) { e.aiComment = aiComment; e.aiVerdict = aiVerdict; setHistory(h) }
}

export const setTimerDeadline = (id: string, deadline: string) => {
  const h = getHistory()
  const e = h.find((x) => x.id === id)
  if (e) { e.timerDeadline = deadline; setHistory(h) }
}

export const getCurrent = (): CurrentItem | null => {
  try { return JSON.parse(sessionStorage.getItem(KEYS.current) ?? 'null') } catch { return null }
}
export const setCurrent = (item: CurrentItem) =>
  sessionStorage.setItem(KEYS.current, JSON.stringify(item))

export const getCheckResult = (): CheckResult | null => {
  try { return JSON.parse(sessionStorage.getItem(KEYS.result) ?? 'null') } catch { return null }
}
export const setCheckResult = (r: CheckResult) =>
  sessionStorage.setItem(KEYS.result, JSON.stringify(r))

export const clearSession = () => {
  sessionStorage.removeItem(KEYS.current)
  sessionStorage.removeItem(KEYS.result)
}
