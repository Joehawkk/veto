import { useCallback } from 'react'
import { type Verdict } from '../lib/scoring'
import { type Profile, type CheckAnswers, type HistoryEntry } from '../lib/storage'

export interface AIResult {
  verdict: Verdict
  tip: string
}

export function useAI() {
  const getAIResult = useCallback(
    async (params: {
      name: string
      price: number
      hasDiscount: boolean
      answers: CheckAnswers
      localVerdict: Verdict
      profile: Profile | null
      recentHistory: HistoryEntry[]
    }): Promise<AIResult> => {
      const fallback: AIResult = {
        verdict: params.localVerdict,
        tip: 'AI временно недоступен. Вердикт рассчитан на основе твоих ответов.',
      }

      try {
        const res = await fetch('/api/ai/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        })

        if (!res.ok) return fallback

        const data = await res.json()
        if (!['go', 'wait', 'veto'].includes(data?.verdict)) return fallback
        if (typeof data?.tip !== 'string' || !data.tip.trim()) return fallback

        return {
          verdict: data.verdict as Verdict,
          tip: data.tip.trim(),
        }
      } catch {
        return fallback
      }
    },
    [],
  )

  return { getAIResult }
}
