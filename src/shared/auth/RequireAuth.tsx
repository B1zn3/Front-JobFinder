import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authSession, initializeSession } from './session'

type RequireAuthProps = {
  allowedRoles?: Array<'applicant' | 'company' | 'admin'>
}

export const RequireAuth = ({ allowedRoles }: RequireAuthProps) => {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const run = async () => {
      const ok = await initializeSession()
      setIsAuthorized(ok)
      setChecking(false)
    }

    void run()
  }, [])

  if (checking) {
    return <div style={{ padding: 24 }}>Проверяем сессию...</div>
  }

  if (!isAuthorized) {
    const adminLogin = allowedRoles?.includes('admin') ? '/admin/login' : '/login'

    return (
      <Navigate
        to={adminLogin}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  const currentRole = authSession.getRole()

  if (
    allowedRoles &&
    currentRole &&
    !allowedRoles.includes(currentRole as 'applicant' | 'company' | 'admin')
  ) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}