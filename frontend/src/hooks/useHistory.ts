import { useState, useCallback, useEffect } from 'react'
import { getHistory, addHistoryEntry, updateOutcome, setHistory, type HistoryEntry } from '../lib/storage'

export function useHistory() {
  const [history, setHistoryState] = useState<HistoryEntry[]>(() => getHistory())

  useEffect(() => {
    const onAuthChange = () => setHistoryState(getHistory())
    window.addEventListener('veto-auth-change', onAuthChange)
    return () => window.removeEventListener('veto-auth-change', onAuthChange)
  }, [])

  const refresh = useCallback(() => setHistoryState(getHistory()), [])

  const add = useCallback((entry: HistoryEntry) => {
    addHistoryEntry(entry)
    setHistoryState(getHistory())
  }, [])

  const setOutcome = useCallback((id: string, outcome: 'stopped' | 'bought') => {
    updateOutcome(id, outcome)
    setHistoryState(getHistory())
  }, [])

  const clearAll = useCallback(() => {
    setHistory([])
    setHistoryState([])
  }, [])

  const stats = {
    saved: history.filter((e) => e.outcome === 'stopped').reduce((s, e) => s + e.price, 0),
    stopped: history.filter((e) => e.outcome === 'stopped').length,
    bought: history.filter((e) => e.outcome === 'bought').length,
    pending: history.filter((e) => e.outcome === 'pending').length,
  }

  return { history, stats, add, setOutcome, refresh, clearAll }
}
