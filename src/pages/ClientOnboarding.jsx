import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ClientOnboarding() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Finishing sign-in…')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function run() {
      try {
        setError('')
        setStatus('Finishing sign-in…')

        // 1) If Supabase redirected here with a ?code=... param, exchange it for a session
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        // 2) Confirm we have a user session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const user = sessionData?.session?.user
        if (!user) {
          throw new Error('No session found. Please open the invite link again.')
        }

        // 3) Ensure profile exists (create if missing)
        setStatus('Setting up your account…')

        const { data: existing, error: existingErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        // If row doesn't exist, insert a minimal profile
        if (!existing) {
          const { error: insertErr } = await supabase.from('profiles').insert({
            id: user.id,
            role: 'client',
            firm_name: '', // can fill later if you want
          })
          if (insertErr) throw insertErr
        } else if (existingErr) {
          throw existingErr
        }

        if (!mounted) return
        setStatus('Done! Redirecting…')
        navigate('/client', { replace: true })
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Onboarding failed')
        setStatus('')
      }
    }

    run()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div style={{ padding: 24 }}>
      <h1>Setting up your account</h1>
      {status ? <p>{status}</p> : null}
      {error ? <p style={{ color: 'tomato' }}>{error}</p> : null}
    </div>
  )
}
