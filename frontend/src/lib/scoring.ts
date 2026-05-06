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
  // Max 5 points
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
      badge: 'bg-primary text-black',
    },
    wait: {
      verdict: 'wait',
      label: 'Подожди',
      icon: '⏳',
      bg: 'bg-yellow-500/10 border-yellow-500/30',
      text: 'text-yellow-400',
      badge: 'bg-yellow-400 text-black',
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
