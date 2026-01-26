import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './pages.css'

export default function Settings() {
  const navigate = useNavigate()

  function handleResetPassword() {
    // Placeholder for reset password functionality
    alert('Reset password functionality coming soon!')
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
            <h1>Settings</h1>
            <p className="page-subtitle">Manage your account preferences</p>
          </div>

          <div className="settings-card">
            <div className="settings-section">
              <h2>Account</h2>
              <button className="secondary-button" onClick={handleResetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
