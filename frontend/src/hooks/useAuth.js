import { useState, useEffect } from 'react'

/**
 * Fetches the current authenticated user from /api/auth/me.
 * Returns { user, loading, error }
 * - user: null if not authenticated, or { _id, name, email, avatar } if logged in
 * - loading: true while the request is in-flight
 * - error: network-level error string, if any
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMe() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (!cancelled) {
          setUser(data.success ? data.user : null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMe()
    return () => { cancelled = true }
  }, [])

  return { user, loading, error }
}
