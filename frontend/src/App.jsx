import { Routes, Route, Navigate } from 'react-router-dom'
import ProjectsDashboard from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { useAuth } from './hooks/useAuth'

/**
 * Wraps protected routes — redirects to /login if not authenticated.
 * Shows a full-screen loader while the session check is in flight.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex-1 h-full w-full flex items-center justify-center bg-forge-bg">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-8 h-8 text-forge-purple" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z"/>
          </svg>
          <span className="text-forge-muted text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/" element={
          <ProtectedRoute>
            <ProjectsDashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/:sandboxId" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
