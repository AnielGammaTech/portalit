import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Settings, ExternalLink, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/client'

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

function getUserInitials(email) {
  if (email && email.length > 0) return email[0].toUpperCase()
  return 'U'
}

export default function Layout({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    window.location.href = `${PORTALIT_URL}/login`
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="flex items-center h-14 px-4 shrink-0" style={{ backgroundColor: '#13082E' }}>
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-pink-400 font-bold text-lg tracking-tight" style={{ textShadow: '0 0 12px rgba(236,72,153,0.4)' }}>
              LootIT
            </span>
            <span className="text-white/30 text-xs font-medium uppercase tracking-wider hidden sm:inline">
              Billing Reconciliation
            </span>
          </div>

          <nav className="flex items-center h-14">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 h-14 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500" />
                  )}
                </Link>
              )
            })}
            <a
              href={PORTALIT_URL}
              className="relative flex items-center gap-2 px-4 h-14 text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden md:inline">PortalIT</span>
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-white/50 text-xs hidden sm:inline truncate max-w-[160px]">
            {user?.email}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
