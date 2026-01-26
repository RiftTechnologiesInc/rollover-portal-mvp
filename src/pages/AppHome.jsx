import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './pages.css'

export default function AppHome() {
  const navigate = useNavigate()

  return (
    <div className="page app-page">
      <Header />

      <main className="app-main">
        <div className="app-container">
          <div className="app-welcome">
            <h1>Welcome to Rift</h1>
            <p className="welcome-subtitle">Manage your client rollovers seamlessly</p>
          </div>

          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-cards">
              <button className="action-card" onClick={() => navigate('/app/invite')}>
                <div className="action-icon">+</div>
                <div className="action-content">
                  <h3>Invite a Client</h3>
                  <p>Send an invitation to your client</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
