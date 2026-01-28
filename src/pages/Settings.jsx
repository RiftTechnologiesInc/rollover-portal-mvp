import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export default function Settings() {
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        // Get firm info from firm_memberships
        const { data: firmInfo } = await supabase.rpc('get_user_firm')

        // Get profile info
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.session.user.id)
          .single()

        if (firmInfo && profileData) {
          setRole(firmInfo.role)
          setProfile({
            email: data.session.user.email,
            firstName: profileData.first_name,
            lastName: profileData.last_name,
            firmName: firmInfo.firm_name,
          })
        }
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  function handleResetPassword() {
    // Placeholder for reset password functionality
    alert('Reset password functionality coming soon!')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="page app-page">
      <Header />

      <main className="app-main">
        <div className="app-container">
          <div className="page-header">
            <button
              className="back-button"
              onClick={() => navigate(role === 'client' ? '/client' : '/app')}
            >
              ← Back
            </button>
            <h1>Settings</h1>
            <p className="page-subtitle">Manage your account preferences</p>
          </div>

          <div className="settings-card">
            <div className="settings-section">
              <div className="profile-header">
                <h2>Profile Information</h2>
                {!loading && (
                  <p className="account-type-badge">
                    {role === 'advisor' || role === 'owner' ? 'Financial Professional' : role === 'client' ? 'Individual Investor' : 'N/A'}
                  </p>
                )}
              </div>
              {loading ? (
                <p className="loading-text">Loading profile...</p>
              ) : (
                <div className="profile-info-grid">
                  <div className="profile-info-item">
                    <label className="profile-label">First Name</label>
                    <p className="profile-value">{profile?.firstName || 'N/A'}</p>
                  </div>
                  <div className="profile-info-item">
                    <label className="profile-label">Last Name</label>
                    <p className="profile-value">{profile?.lastName || 'N/A'}</p>
                  </div>
                  <div className="profile-info-item">
                    <label className="profile-label">Firm Name</label>
                    <p className="profile-value">{profile?.firmName || 'N/A'}</p>
                  </div>
                  <div className="profile-info-item">
                    <label className="profile-label">Email</label>
                    <p className="profile-value">{profile?.email || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-buttons">
                <button className="secondary-button" onClick={handleResetPassword}>
                  Reset Password
                </button>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
