import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard/:sandboxId" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
