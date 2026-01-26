import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function InviteClient() {
  const navigate = useNavigate()

  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviting, setInviting] = useState(false)

  async function handleInviteClient(e) {
    e.preventDefault()
    setInviteStatus('')
    setInviting(true)

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
  }

  return (
    <div className="page app-page">
      <Header />

      <main className="app-main">
        <div className="app-container">
          <div className="page-header">
            <button className="back-button" onClick={() => navigate('/app')}>
              ← Back
            </button>
            <h1>Invite a Client</h1>
            <p className="page-subtitle">Send an invitation to your client to join the rollover portal</p>
          </div>

          <div className="invite-form-card">
            <form onSubmit={handleInviteClient} className="invite-form">
              <label className="form-label">
                Client Name (Optional)
                <input
                  className="form-input"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Client"
                />
              </label>

              <label className="form-label">
                Client Email
                <input
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="jane@example.com"
                />
              </label>

              {inviteStatus ? (
                <div className={inviteStatus.startsWith('Error') ? 'status-error' : 'status-success'}>
                  {inviteStatus}
                </div>
              ) : null}

              <button className="primary" type="submit" disabled={inviting}>
                {inviting ? 'Sending Invite…' : 'Send Invite'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
