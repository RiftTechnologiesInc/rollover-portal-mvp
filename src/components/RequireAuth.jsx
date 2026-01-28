import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireAuth({ children }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setHasSession(!!data.session)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) return null
  if (!hasSession) {
    const path = location.pathname || ''
    let loginPath = '/login'

    if (path.startsWith('/admin') || path.startsWith('/app')) {
      loginPath = '/login/advisor'
    } else if (path.startsWith('/client')) {
      loginPath = '/login/investor'
    }

    return <Navigate to={loginPath} replace />
  }

  return children
}
