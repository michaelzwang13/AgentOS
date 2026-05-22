import { useEffect, useState } from 'react'
import { listEmployees, type Agent } from './api'

/** Loads the signed-in user's hired employees from GET /agents. */
export function useAgents() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listEmployees()
      .then(a => { if (!cancelled) setAgents(a) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  return { agents, error, loading: agents === null && error === null }
}
