import { useState, useEffect } from 'react'
import { api, type CheckEntry } from '../api/client'

export function useChecks() {
  const [checks, setChecks] = useState<CheckEntry[]>([])
  const [loading, setLoading] = useState(true)

  function refresh() {
    return api.checks.list()
      .then(({ data }) => setChecks(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  async function setOutcome(id: string, outcome: 'stopped' | 'bought') {
    await api.checks.update(id, { outcome })
    refresh()
  }

  async function setTimer(id: string, deadline: string) {
    await api.checks.update(id, { timer_deadline: deadline })
    refresh()
  }

  const stats = {
    saved: checks.filter((c) => c.outcome === 'stopped').reduce((s, c) => s + c.price, 0),
    stopped: checks.filter((c) => c.outcome === 'stopped').length,
    bought: checks.filter((c) => c.outcome === 'bought').length,
    pending: checks.filter((c) => c.outcome === 'pending').length,
  }

  return { checks, history: checks, stats, setOutcome, setTimer, loading, refresh }
}
