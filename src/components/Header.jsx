import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './header.css'

export default function Header() {
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState(false)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setHasSession(!!data.session)

      // Load user profile and firm info if session exists
      if (data.session?.user) {
        // Get firm info from firm_memberships
        const { data: firmInfo, error: firmError } = await supabase.rpc('get_user_firm')

        // Get profile info
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.session.user.id)
          .single()

        if (mounted) {
          setProfile({
            name: profileData?.first_name || data.session.user.email?.split('@')[0] || 'User',
            firmName: firmInfo?.firm_name || 'N/A',
            role: firmInfo?.role || null,
          })
        }
      }
    }

    load()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
      if (!session) {
        setProfile(null)
      } else {
        load()
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Determine home link based on auth status and role
  const getHomeLink = () => {
    if (!hasSession || !profile) return '/'
    return profile.role === 'client' ? '/client' : '/app'
  }

  return (
    <header className="header">
      <div className="header-left">
        <Link to={getHomeLink()} className="brand">
          Rift
        </Link>
      </div>

      <div className="header-right">
        {hasSession ? (
          <div className="user-section">
            <div className="user-info">
              <div className="user-name">{profile?.name || 'User'}</div>
              <div className="user-firm">{profile?.firmName || 'Loading...'}</div>
            </div>
            <button
              className="settings-button"
              onClick={() => navigate(profile?.role === 'client' ? '/client/settings' : '/app/settings')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.1667 12.5C16.0558 12.7513 16.0221 13.0302 16.0698 13.3006C16.1175 13.571 16.2444 13.8211 16.4334 14.0167L16.4834 14.0667C16.6296 14.2127 16.7454 14.3864 16.8242 14.5776C16.903 14.7687 16.9433 14.9737 16.9433 15.1808C16.9433 15.388 16.903 15.5929 16.8242 15.7841C16.7454 15.9753 16.6296 16.149 16.4834 16.295C16.3374 16.4412 16.1637 16.557 15.9725 16.6358C15.7814 16.7146 15.5764 16.7549 15.3692 16.7549C15.1621 16.7549 14.9571 16.7146 14.766 16.6358C14.5748 16.557 14.4011 16.4412 14.2551 16.295L14.2051 16.245C14.0095 16.056 13.7594 15.9291 13.489 15.8814C13.2186 15.8337 12.9397 15.8674 12.6884 15.9783C12.4418 16.0845 12.2317 16.2596 12.0831 16.4832C11.9345 16.7069 11.8538 16.9697 11.8501 17.2392V17.5C11.8501 17.9198 11.6831 18.3225 11.3862 18.6194C11.0893 18.9163 10.6866 19.0833 10.2667 19.0833C9.8469 19.0833 9.44424 18.9163 9.14731 18.6194C8.85038 18.3225 8.68341 17.9198 8.68341 17.5V17.425C8.67421 17.1477 8.58432 16.8788 8.42438 16.6521C8.26444 16.4254 8.04128 16.2509 7.78341 16.1508C7.53212 16.0399 7.25321 16.0062 6.98282 16.0539C6.71242 16.1016 6.46232 16.2285 6.26674 16.4175L6.21674 16.4675C6.07075 16.6137 5.897 16.7295 5.70586 16.8083C5.51471 16.8871 5.30972 16.9274 5.10258 16.9274C4.89544 16.9274 4.69045 16.8871 4.4993 16.8083C4.30816 16.7295 4.13441 16.6137 3.98841 16.4675C3.84219 16.3215 3.72637 16.1477 3.64757 15.9566C3.56876 15.7654 3.52844 15.5604 3.52844 15.3533C3.52844 15.1462 3.56876 14.9412 3.64757 14.75C3.72637 14.5589 3.84219 14.3851 3.98841 14.2392L4.03841 14.1892C4.22738 13.9936 4.35432 13.7435 4.40202 13.4731C4.44972 13.2027 4.41605 12.9238 4.30508 12.6725C4.19882 12.4259 4.02374 12.2158 3.80007 12.0672C3.5764 11.9186 3.31364 11.8379 3.04424 11.8342H2.83341C2.41358 11.8342 2.01092 11.6672 1.71399 11.3703C1.41706 11.0733 1.25008 10.6707 1.25008 10.2508C1.25008 9.83101 1.41706 9.42835 1.71399 9.13142C2.01092 8.83449 2.41358 8.66751 2.83341 8.66751H2.90841C3.18575 8.65831 3.45459 8.56842 3.68129 8.40848C3.90799 8.24854 4.08245 8.02538 4.18258 7.76751C4.29355 7.51622 4.32722 7.23731 4.27952 6.96691C4.23182 6.69652 4.10488 6.44642 3.91591 6.25084L3.86591 6.20084C3.71969 6.05485 3.60387 5.8811 3.52506 5.68995C3.44625 5.49881 3.40594 5.29382 3.40594 5.08668C3.40594 4.87954 3.44625 4.67454 3.52506 4.4834C3.60387 4.29226 3.71969 4.11851 3.86591 3.97251C4.01191 3.82629 4.18566 3.71047 4.3768 3.63166C4.56794 3.55285 4.77294 3.51254 4.98008 3.51254C5.18722 3.51254 5.39221 3.55285 5.58335 3.63166C5.7745 3.71047 5.94825 3.82629 6.09424 3.97251L6.14424 4.02251C6.33983 4.21148 6.58992 4.33842 6.86032 4.38612C7.13071 4.43382 7.40962 4.40015 7.66091 4.28918H7.73591C7.98252 4.18292 8.19261 4.00784 8.34121 3.78417C8.48981 3.5605 8.57048 3.29774 8.57424 3.02834V2.83751C8.57424 2.41768 8.74122 2.01502 9.03815 1.71809C9.33508 1.42116 9.73774 1.25418 10.1576 1.25418C10.5774 1.25418 10.9801 1.42116 11.277 1.71809C11.5739 2.01502 11.7409 2.41768 11.7409 2.83751V2.91251C11.7447 3.18191 11.8253 3.44467 11.9739 3.66834C12.1225 3.89201 12.3326 4.06709 12.5792 4.17334C12.8305 4.28431 13.1094 4.31798 13.3798 4.27028C13.6502 4.22258 13.9003 4.09564 14.0959 3.90668L14.1459 3.85668C14.2919 3.71046 14.4656 3.59464 14.6568 3.51583C14.8479 3.43702 15.0529 3.39671 15.2601 3.39671C15.4672 3.39671 15.6722 3.43702 15.8633 3.51583C16.0545 3.59464 16.2282 3.71046 16.3742 3.85668C16.5204 4.00267 16.6363 4.17642 16.7151 4.36757C16.7939 4.55871 16.8342 4.7637 16.8342 4.97084C16.8342 5.17798 16.7939 5.38298 16.7151 5.57412C16.6363 5.76526 16.5204 5.93901 16.3742 6.08501L16.3242 6.13501C16.1353 6.33059 16.0083 6.5807 15.9606 6.85109C15.9129 7.12149 15.9466 7.4004 16.0576 7.65168V7.72668C16.1638 7.97329 16.3389 8.18337 16.5626 8.33197C16.7863 8.48057 17.049 8.56124 17.3184 8.56501H17.5092C17.9291 8.56501 18.3317 8.73199 18.6287 9.02892C18.9256 9.32585 19.0926 9.72851 19.0926 10.1483C19.0926 10.5682 18.9256 10.9708 18.6287 11.2678C18.3317 11.5647 17.9291 11.7317 17.5092 11.7317H17.4342C17.1648 11.7354 16.9021 11.8161 16.6784 11.9647C16.4547 12.1133 16.2796 12.3234 16.1734 12.57V12.57Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="login-buttons">
            <Link to="/login/investor" className="login-link investor-login">
              Individual Investor
            </Link>
            <Link to="/login/advisor" className="login-link advisor-login">
              Financial Professional
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
