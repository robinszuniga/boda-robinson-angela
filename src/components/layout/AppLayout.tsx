import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { LogOut, Menu, X } from 'lucide-react'
import { useSettings } from '../../lib/api'
import { getCountdown } from '../../lib/countdown'
import { useAuth } from '../../features/auth/AuthProvider'
import { Monogram } from '../../features/auth/AuthShell'
import { cn } from '../ui/cn'
import { mobilePrimary, navGroups, type NavItem } from './nav'

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-ink/80 hover:bg-brand-50 hover:text-ink',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: settings } = useSettings()
  const { session, signOut } = useAuth()
  const days = settings ? getCountdown(new Date(settings.wedding_date)).days : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pt-5 pb-4">
        <Monogram className="size-11 text-base" />
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold">
            {settings ? `${settings.partner_1_name} & ${settings.partner_2_name}` : 'Nuestra boda'}
          </div>
          {days != null && (
            <div className="text-xs text-muted">{days > 0 ? `Faltan ${days} días` : '¡Llegó el gran día!'}</div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Principal">
        {navGroups.map((group, i) => (
          <div key={i} className={i > 0 ? 'mt-4' : ''}>
            {group.title && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.title}</div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavEntry key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="truncate px-1 pb-2 text-xs text-muted">{session?.user.email}</div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-black/5 hover:text-ink"
        >
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-white/70 backdrop-blur lg:block">
        <NavContent />
      </aside>

      {/* Menú lateral en móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 rounded-lg p-2 text-muted hover:bg-black/5"
            >
              <X className="size-5" />
            </button>
            <NavContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior en móvil */}
      <nav
        aria-label="Accesos rápidos"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {mobilePrimary.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                  isActive ? 'font-semibold text-brand-700' : 'text-muted',
                )
              }
            >
              <Icon className="size-5" />
              {item.label}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
        >
          <Menu className="size-5" />
          Más
        </button>
      </nav>
    </div>
  )
}
