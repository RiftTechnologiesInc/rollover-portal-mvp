import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function Login() {
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

    // 3) Load firm role
    const { data: firmInfo, error: firmError } = await supabase.rpc('get_user_firm')

    setLoading(false)

    if (firmError || !firmInfo) {
      setError('Failed to load user role')
      return
    }

    // 4) Route by role
    if (firmInfo.role === 'client') {
      navigate('/client')
    } else if (firmInfo.role === 'advisor' || firmInfo.role === 'owner') {
      navigate('/app')
    } else {
      setError('Unknown user role')
    }
  }

  return (
    <div className="page login-page">
      <Header />

      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Member Login</h1>

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
