import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute, RootRedirect } from './components/ProtectedRoute'
import Agents from './pages/Agents'
import Directory from './pages/Directory'
import Status from './pages/Status'
import Login from './pages/Login'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
          <Route path="/status" element={<ProtectedRoute><Status /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
