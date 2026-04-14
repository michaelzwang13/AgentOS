import { useEffect, useState } from 'react'
import { listRoles, type Role } from './api'

export function useRoles() {
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listRoles()
      .then(r => { if (!cancelled) setRoles(r) })
      .catch(e => { if (!cancelled) setError(String(e.message ?? e)) })
    return () => { cancelled = true }
  }, [])

  return { roles, error, loading: roles === null && error === null }
}
