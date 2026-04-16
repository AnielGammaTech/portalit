import { Link } from 'react-router-dom'
import { Home, Settings, ExternalLink, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/client'

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io'

export default function Layout({ children }) {
  const { user } = useAuth()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    window.location.href = `${PORTALIT_URL}/login`
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-800">
          <h1 className="text-lg font-semibold">LootIT</h1>
          <p className="text-xs text-slate-400 mt-0.5">Billing Reconciliation</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 text-sm"
          >
            <Home className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 text-sm"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <a
            href={PORTALIT_URL}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 text-sm"
          >
            <ExternalLink className="h-4 w-4" /> Back to PortalIT
          </a>
        </nav>
        <div className="px-3 py-3 border-t border-slate-800">
          <div className="text-xs text-slate-400 mb-2 truncate">{user?.email}</div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 text-sm"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
