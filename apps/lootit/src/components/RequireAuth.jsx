import { useAuth } from '@/lib/AuthContext'

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io'

export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth()

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(window.location.href)
    // Hard navigation — intentional, crosses origins for SSO
    window.location.href = `${PORTALIT_URL}/login?returnUrl=${returnUrl}`
    return null
  }

  return children
}
