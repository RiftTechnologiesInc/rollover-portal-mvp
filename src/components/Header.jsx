import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './header.css'

export default function Header() {
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setHasSession(!!data.session)
    }

    load()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="brand">
          Rollover Portal
        </Link>
      </div>

      <div className="header-right">
        {hasSession ? (
          <button className="linklike" onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <Link to="/login" className="login-link">
            Client Login
          </Link>
        )}
      </div>
    </header>
  )
}
