import { type CheckAnswers } from './storage'

export type Verdict = 'go' | 'wait' | 'veto'

export interface VerdictMeta {
  verdict: Verdict
  label: string
  icon: string
  bg: string
  text: string
  badge: string
}

const DURATION_SCORE: Record<string, number> = {
  '30min': 0,
  '1hour': 0,
  '24hours': 1,
  '3days': 2,
}

const GOOD_MOODS = new Set(['good', 'neutral'])

export function getLocalVerdict(answers: CheckAnswers): Verdict {
  let score = 0
  if (answers.needNow) score += 1
  if (!answers.hasSimilar) score += 1
  score += DURATION_SCORE[answers.thoughtDuration] ?? 0
  if (GOOD_MOODS.has(answers.mood)) score += 1
  if (score >= 4) return 'go'
  if (score >= 2) return 'wait'
  return 'veto'
}

export function getVerdictMeta(verdict: Verdict): VerdictMeta {
  const map: Record<Verdict, VerdictMeta> = {
    go: {
      verdict: 'go',
      label: 'Купи',
      icon: '✅',
      bg: 'bg-primary/10 border-primary/30',
      text: 'text-primary',
      badge: 'bg-primary text-white',
    },
    wait: {
      verdict: 'wait',
      label: 'Подожди',
      icon: '⏳',
      bg: 'bg-[#FFDE8A]/40 border-[#FF9E30]/40',
      text: 'text-[#F86D06]',
      badge: 'bg-[#FF9E30] text-white',
    },
    veto: {
      verdict: 'veto',
      label: 'Не покупай',
      icon: '🛑',
      bg: 'bg-secondary/10 border-secondary/30',
      text: 'text-secondary',
      badge: 'bg-secondary text-white',
    },
  }
  return map[verdict]
}
