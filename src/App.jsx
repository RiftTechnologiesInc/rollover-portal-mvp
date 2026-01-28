import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import InvestorLogin from './pages/InvestorLogin'
import AdvisorLogin from './pages/AdvisorLogin'
import AppHome from './pages/AppHome'
import InviteClient from './pages/InviteClient'
import InviteAdvisor from './pages/InviteAdvisor'
import Settings from './pages/Settings'
import ClientHome from './pages/ClientHome'
import ClientOnboarding from './pages/ClientOnboarding'
import RequireAuth from './components/RequireAuth'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/investor" element={<InvestorLogin />} />
      <Route path="/login/advisor" element={<AdvisorLogin />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppHome />
          </RequireAuth>
        }
      />

      <Route
        path="/app/invite"
        element={
          <RequireAuth>
            <InviteClient />
          </RequireAuth>
        }
      />

      <Route
        path="/app/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />

      <Route
        path="/client"
        element={
          <RequireAuth>
            <ClientHome />
          </RequireAuth>
        }
      />

      <Route
        path="/client/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />

      <Route path="/client/onboarding" element={<ClientOnboarding />} />

      {/* Admin Routes */}
      <Route
        path="/admin/invite-advisor"
        element={
          <RequireAuth>
            <InviteAdvisor />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
