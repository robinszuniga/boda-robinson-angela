import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/Display'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading, signOut } = useAuth()
  const location = useLocation()
  const userId = session?.user.id

  const couple = useQuery({
    queryKey: ['is_couple', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_couple')
      if (error) throw error
      return data
    },
  })

  if (loading) return <FullScreen><LoadingState /></FullScreen>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (couple.isPending) return <FullScreen><LoadingState label="Verificando acceso…" /></FullScreen>
  if (couple.isError) {
    return (
      <FullScreen>
        <ErrorState error={couple.error} onRetry={() => couple.refetch()} />
      </FullScreen>
    )
  }

  if (!couple.data) {
    return (
      <FullScreen>
        <div className="max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto size-8 text-accent-500" />
          <h1 className="mt-3 text-2xl font-semibold">Tu usuario no está autorizado</h1>
          <p className="mt-2 text-sm text-muted">
            Iniciaste sesión como <strong>{session.user.email}</strong>, pero ese correo no está en la tabla{' '}
            <code className="rounded bg-stone-100 px-1">app_users</code>. Agrégalo desde el SQL Editor de Supabase
            (último bloque de <code className="rounded bg-stone-100 px-1">setup.sql</code>) y vuelve a entrar.
          </p>
          <Button className="mt-5" variant="secondary" onClick={signOut}>
            Cerrar sesión
          </Button>
        </div>
      </FullScreen>
    )
  }

  return <Outlet />
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
}
