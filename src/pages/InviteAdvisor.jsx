import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function InviteAdvisor() {
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [firmName, setFirmName] = useState('')
  const [status, setStatus] = useState('')
  const [inviting, setInviting] = useState(false)

  async function handleInviteAdvisor(e) {
    e.preventDefault()
    setStatus('')
    setInviting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables are missing')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const headers = {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey
      }

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/invite-advisor`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          firmName
        })
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to invite advisor')
      }

      if (result.success) {
        setStatus(
          `Success! Invite sent to ${email}. ` +
          `They will be a ${result.role} at ${firmName}. ` +
          `They'll receive an email to set their password.`
        )
        setEmail('')
        setFirstName('')
        setLastName('')
        setFirmName('')
      } else {
        setStatus(`Error: ${result.message || 'Failed to invite advisor'}`)
      }
    } catch (error) {
      console.error('Invite error:', error)
      setStatus(`Error: ${error.message}`)
    } finally {
      setInviting(false)
    }
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
            <h1>Invite Financial Advisor</h1>
            <p className="page-subtitle">
              Send an invitation to a financial advisor. The first advisor in a firm becomes the owner.
            </p>
          </div>

          <div className="invite-form-card">
            <form onSubmit={handleInviteAdvisor} className="invite-form">
              <label className="form-label">
                Firm Name
                <input
                  className="form-input"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Acme Financial Group"
                  required
                />
              </label>

              <label className="form-label">
                First Name
                <input
                  className="form-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </label>

              <label className="form-label">
                Last Name
                <input
                  className="form-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                />
              </label>

              <label className="form-label">
                Email Address
                <input
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="john.smith@acmefinancial.com"
                />
              </label>

              {status && (
                <div className={status.startsWith('Error') ? 'status-error' : 'status-success'}>
                  {status}
                </div>
              )}

              <button className="primary" type="submit" disabled={inviting}>
                {inviting ? 'Sending Invite…' : 'Send Invite'}
              </button>
            </form>

            <div className="invite-info">
              <p className="info-text">
                <strong>Note:</strong> The first user invited to a firm will become the firm owner.
                Subsequent users will be advisors. Advisors can invite clients and share client access with other advisors in their firm.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
