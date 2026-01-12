import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function AppHome() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)

  // Invite form state
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      setError('')
      setLoading(true)

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        if (!mounted) return
        setError(sessionError.message)
        setLoading(false)
        return
      }

      const user = sessionData?.session?.user
      if (!user) {
        if (!mounted) return
        navigate('/login')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('firm_name, role')
        .eq('id', user.id)
        .single()

      if (!mounted) return

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      setProfile(data)
      setLoading(false)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [navigate])

  async function handleInviteClient(e) {
    e.preventDefault()
    setInviteStatus('')
    setInviting(true)

    // IMPORTANT: you need the firm_id. For now, paste it once (Step 2B below).
    const firm_id = import.meta.env.VITE_FIRM_ID

    if (!firm_id) {
      setInviting(false)
      setInviteStatus('Missing VITE_FIRM_ID in .env')
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    if (!token) {
      setInviting(false)
      setInviteStatus('Not logged in')
      return
    }

    const res = await fetch('/functions/v1/invite_client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ firm_id, email: inviteEmail, name: inviteName }),
    })


    const payload = await res.json().catch(() => ({}))

    setInviting(false)

    if (!res.ok) {
      setInviteStatus(`Error: ${payload.error || res.statusText}`)
      return
    }

    if (!payload?.ok) {
      setInviteStatus('Error: Invite failed')
      return
    }

    setInviteStatus(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteName('')


    setInviting(false)

    if (error) {
      setInviteStatus(`Error: ${error.message}`)
      return
    }

    if (!data?.ok) {
      setInviteStatus('Error: Invite failed')
      return
    }

    setInviteStatus(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteName('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="page">
      <Header />
      <main className="placeholder">
        <h1>App Home</h1>

        {loading ? <p>Loading profile…</p> : null}
        {error ? <p style={{ color: 'tomato' }}>{error}</p> : null}

        {profile ? (
          <div style={{ marginTop: 12 }}>
            <p><strong>Firm:</strong> {profile.firm_name}</p>
            <p><strong>Role:</strong> {profile.role}</p>
          </div>
        ) : null}

        <hr style={{ margin: '20px 0' }} />

        <h2>Invite a client</h2>
        <form onSubmit={handleInviteClient} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Client name (optional)
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Jane Client"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            Client email
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              required
              placeholder="jane@example.com"
            />
          </label>

          <button type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Send invite'}
          </button>

          {inviteStatus ? <p>{inviteStatus}</p> : null}
        </form>

        <div style={{ marginTop: 18 }}>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </main>
    </div>
  )
}
