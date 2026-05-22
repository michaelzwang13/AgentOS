import { Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn } from '@/lib/api'

/**
 * Wraps a route so unauthenticated users are bounced to /login.
 * The attempted path is preserved in location state so login can return there.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/** Landing route — send signed-in users to the feed, everyone else to login. */
export function RootRedirect() {
  return <Navigate to={isLoggedIn() ? '/agents' : '/login'} replace />
}
