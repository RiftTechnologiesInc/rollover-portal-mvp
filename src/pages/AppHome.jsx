import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function AppHome() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [advisors, setAdvisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [openShareDropdown, setOpenShareDropdown] = useState(null)

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

      setCurrentUserId(userId)

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

      // For each client, get their email and all advisors who have access
      if (clientAccessData) {
        const enrichedClients = await Promise.all(
          clientAccessData.map(async (access) => {
            const clientId = access.client_id
            const profile = access.profiles

            // Get all advisors who have access to this client
            const { data: sharedWith } = await supabase
              .from('client_access')
              .select(`
                advisor_id,
                granted_by,
                created_at,
                profiles!client_access_advisor_profile_fkey (
                  first_name,
                  last_name
                )
              `)
              .eq('client_id', clientId)
              .neq('advisor_id', userId) // Exclude current user

            return {
              id: clientId,
              firstName: profile?.first_name || 'N/A',
              lastName: profile?.last_name || 'N/A',
              email: 'N/A',
              addedAt: access.created_at,
              sharedWith: sharedWith || []
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

      // Load other advisors in the firm (for share dropdown)
      const { data: firmAdvisors, error: advisorError } = await supabase
        .from('firm_memberships')
        .select(`
          user_id,
          profiles!firm_memberships_user_profile_fkey (
            first_name,
            last_name
          )
        `)
        .eq('firm_id', firmInfo.firm_id)
        .in('role', ['advisor', 'owner'])
        .neq('user_id', userId)

      if (advisorError) {
        console.error('Error loading advisors:', advisorError)
      } else {
        setAdvisors(firmAdvisors || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleShareClient(clientId, advisorId) {
    try {
      const { error } = await supabase.rpc('share_client', {
        p_client_id: clientId,
        p_advisor_id: advisorId
      })

      if (error) {
        alert(`Error sharing client: ${error.message}`)
      } else {
        // Reload data to show updated sharing
        await loadData()
        setOpenShareDropdown(null)
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  async function handleRevokeAccess(clientId, advisorId) {
    if (!confirm('Are you sure you want to revoke this advisor\'s access to this client?')) {
      return
    }

    try {
      const { error } = await supabase.rpc('revoke_client_access', {
        p_client_id: clientId,
        p_advisor_id: advisorId
      })

      if (error) {
        alert(`Error revoking access: ${error.message}`)
      } else {
        // Reload data
        await loadData()
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  function getAvailableAdvisorsForClient(client) {
    // Get advisors who don't already have access to this client
    const sharedAdvisorIds = client.sharedWith.map(s => s.advisor_id)
    return advisors.filter(a => !sharedAdvisorIds.includes(a.user_id))
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
            <button className="invite-button-small" onClick={() => navigate('/app/invite')}>
              + Invite a Client
            </button>

            <div className="dashboard-section">
              <div className="dashboard-header">
                <h2>My Clients</h2>
              </div>

              {loading ? (
                <div className="dashboard-loading">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="dashboard-empty">
                  <p>No clients yet.</p>
                  <button className="primary" onClick={() => navigate('/app/invite')}>
                    Invite Your First Client
                  </button>
                </div>
              ) : (
                <div className="clients-grid">
                  {clients.map((client) => {
                    const availableAdvisors = getAvailableAdvisorsForClient(client)
                    const isDropdownOpen = openShareDropdown === client.id

                    return (
                      <div key={client.id} className="client-card">
                        <div className="client-card-header">
                          <div>
                            <div className="client-name">
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="client-email">{client.email}</div>
                          </div>
                          <div className="client-actions">
                            <div className="share-dropdown">
                              <button
                                className="share-button"
                                onClick={() => setOpenShareDropdown(isDropdownOpen ? null : client.id)}
                              >
                                Share
                              </button>
                              {isDropdownOpen && (
                                <div className="dropdown-content">
                                  {availableAdvisors.length === 0 ? (
                                    <div className="dropdown-empty">
                                      All advisors have access
                                    </div>
                                  ) : (
                                    availableAdvisors.map((advisor) => (
                                      <div
                                        key={advisor.user_id}
                                        className="dropdown-item"
                                        onClick={() => handleShareClient(client.id, advisor.user_id)}
                                      >
                                        {advisor.profiles?.first_name} {advisor.profiles?.last_name}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {client.sharedWith.length > 0 && (
                          <div className="shared-with-section">
                            <div className="shared-with-title">Shared with</div>
                            {client.sharedWith.map((share) => (
                              <div key={share.advisor_id} className="shared-advisor">
                                <span className="shared-advisor-name">
                                  {share.profiles?.first_name} {share.profiles?.last_name}
                                </span>
                                <button
                                  className="revoke-button"
                                  onClick={() => handleRevokeAccess(client.id, share.advisor_id)}
                                >
                                  Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
