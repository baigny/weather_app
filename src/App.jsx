import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MasjidsPage from './pages/MasjidsPage'
import AdminMasjidsPage from './pages/AdminMasjidsPage'
import ErrorBoundary from './components/ui/ErrorBoundary'
import AppShell from './components/layout/AppShell'

const App = () => (
  <BrowserRouter>
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/weather" replace />} />
        <Route path="/weather" element={<HomePage />} />
        <Route path="/explore-neighborhood" element={<HomePage />} />
        <Route path="/find-masjids" element={<HomePage />} />
        <Route path="/directions" element={<HomePage />} />
        <Route path="/masjids" element={<ErrorBoundary><MasjidsPage /></ErrorBoundary>} />
        <Route path="/masjids/:id" element={<ErrorBoundary><MasjidsPage /></ErrorBoundary>} />
        <Route path="/admin/masjids" element={<AdminMasjidsPage />} />
      </Routes>
    </AppShell>
  </BrowserRouter>
)

export default App
