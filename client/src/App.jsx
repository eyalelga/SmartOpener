import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import WorkerDashboard from './pages/WorkerDashboard'

function RoleRedirect() {
  const { user } = useAuth()
  if (user === undefined) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />
  if (user.role === 'manager') return <Navigate to="/admin" replace />
  return <Navigate to="/worker" replace />
}

function Guard({ roles, children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <RoleRedirect />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/super-admin" element={
            <Guard roles={['super_admin']}><SuperAdminDashboard /></Guard>
          } />
          <Route path="/admin" element={
            <Guard roles={['manager']}><ManagerDashboard /></Guard>
          } />
          <Route path="/worker" element={
            <Guard roles={['worker']}><WorkerDashboard /></Guard>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
