import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import InvestorLogin from './pages/InvestorLogin'
import AdvisorLogin from './pages/AdvisorLogin'
import AppHome from './pages/AppHome'
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
        path="/client"
        element={
          <RequireAuth>
            <ClientHome />
          </RequireAuth>
        }
      />

      <Route path="/client/onboarding" element={<ClientOnboarding />} />
    </Routes>
  )
}
