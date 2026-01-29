import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function AppHome() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)

    try {
      // Get current user
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id

      if (!userId) {
        setLoading(false)
        return
      }

      // Get user's firm info
      const { data: firmInfo } = await supabase.rpc('get_user_firm')

      if (!firmInfo) {
        setLoading(false)
        return
      }

      // Load clients this advisor has access to
      const { data: clientAccessData, error: clientError } = await supabase
        .from('client_access')
        .select(`
          client_id,
          created_at,
          profiles!client_access_client_profile_fkey (
            first_name,
            last_name,
            id
          )
        `)
        .eq('advisor_id', userId)

      if (clientError) {
        console.error('Error loading clients:', clientError)
      }

      // For each client, check if they have completed account setup
      if (clientAccessData) {
        const enrichedClients = await Promise.all(
          clientAccessData.map(async (access) => {
            const clientId = access.client_id
            const profile = access.profiles

            // Check if client has completed setup by looking in firm_memberships
            const { data: membershipData } = await supabase
              .from('firm_memberships')
              .select('role')
              .eq('user_id', clientId)
              .eq('role', 'client')
              .single()

            const hasCompletedSetup = !!membershipData

            return {
              id: clientId,
              firstName: profile?.first_name || 'N/A',
              lastName: profile?.last_name || 'N/A',
              email: 'N/A',
              addedAt: access.created_at,
              hasCompletedSetup: hasCompletedSetup
            }
          })
        )

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const clientIds = enrichedClients.map((client) => client.id)

        if (supabaseUrl && supabaseAnonKey && clientIds.length > 0) {
          const { data: sessionData } = await supabase.auth.getSession()
          const accessToken = sessionData?.session?.access_token

          if (accessToken) {
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/get-client-emails`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${accessToken}`
              },
              body: JSON.stringify({ clientIds })
            })

            const emailResult = await emailResponse.json().catch(() => ({}))
            const emailMap = {}

            if (emailResponse.ok && Array.isArray(emailResult.emails)) {
              emailResult.emails.forEach((entry) => {
                if (entry?.id && entry?.email) {
                  emailMap[entry.id] = entry.email
                }
              })
            }

            setClients(enrichedClients.map((client) => ({
              ...client,
              email: emailMap[client.id] || client.email
            })))
          } else {
            setClients(enrichedClients)
          }
        } else {
          setClients(enrichedClients)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="page app-page">
      <Header />

      <main className="app-main">
        <div className="app-container">
          <div className="app-welcome">
            <h1>Welcome to Rift</h1>
            <p className="welcome-subtitle">Manage your client rollovers seamlessly</p>
          </div>

          <div className="right-section">
            <div className="client-management-container">
              <button className="invite-button" onClick={() => navigate('/app/invite')}>
                + Invite a Client
              </button>

              <div className="clients-list-section">
                <h2>Invited Clients</h2>

                {loading ? (
                  <div className="clients-loading">Loading clients...</div>
                ) : clients.length === 0 ? (
                  <div className="clients-empty">
                    <p>No clients invited yet.</p>
                  </div>
                ) : (
                  <div className="clients-list">
                    {clients.map((client) => (
                      <div key={client.id} className="client-item">
                        <div className="client-info">
                          <div className="client-name">
                            {client.firstName} {client.lastName}
                          </div>
                          <div className="client-email">{client.email}</div>
                        </div>
                        <div className="client-status">
                          {client.hasCompletedSetup ? (
                            <span className="status-badge status-completed">Account Set Up</span>
                          ) : (
                            <span className="status-badge status-pending-setup">Pending Setup</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
