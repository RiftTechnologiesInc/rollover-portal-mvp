import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function InvestorLogin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 1) Sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    // 2) Get session + user
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError || !sessionData?.session?.user) {
      setLoading(false)
      setError('Failed to load session')
      return
    }

    const user = sessionData.session.user

    // 3) Get user's firm and role from firm_memberships
    const { data: firmInfo, error: firmError } = await supabase.rpc('get_user_firm')

    if (firmError || !firmInfo) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Failed to load user profile. Please contact support.')
      return
    }

    // 4) Route by role - for investor login, expect 'client' role
    if (firmInfo.role === 'client') {
      setLoading(false)
      navigate('/client')
    } else {
      // Sign out the user since they used the wrong portal
      await supabase.auth.signOut()
      setLoading(false)
      setError('This login is for Individual Investors only. Please use the Financial Professional login.')
    }
  }

  return (
    <div className="page login-page">
      <Header />

      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Individual Investor Login</h1>
          <p className="auth-subtitle">Access your rollover portal</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label">
              Email
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-label">
              Password
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
