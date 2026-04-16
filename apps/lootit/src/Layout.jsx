import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Settings, ExternalLink, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/client'

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

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
    <div className="flex flex-col h-screen bg-pink-50/50">
      <header className="shrink-0" style={{ backgroundColor: '#2E0820' }}>
        <div className="flex items-center h-14 px-6">
          <div className="flex items-center gap-2.5 shrink-0 w-48">
            <div className="w-7 h-7 rounded-md flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #2E0820, #4A1035)' }}>
              <span className="text-white font-extrabold text-sm leading-none">L</span>
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-pink-400" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-pink-400" style={{ textShadow: '0 0 12px rgba(236,72,153,0.4)' }}>Loot</span><span className="text-white">IT</span>
            </span>
          </div>

          <nav className="flex-1 flex items-center justify-center h-14 gap-1">
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
              <span>PortalIT</span>
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0 w-48 justify-end">
            <span className="text-white/50 text-xs truncate max-w-[140px]">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
