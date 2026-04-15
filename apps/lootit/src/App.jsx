import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/AuthContext'
import { queryClientInstance } from '@/lib/query-client'
import RequireAuth from '@/components/RequireAuth'
import Layout from './Layout.jsx'
import DashboardPage from '@/pages/DashboardPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <BrowserRouter>
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </RequireAuth>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
