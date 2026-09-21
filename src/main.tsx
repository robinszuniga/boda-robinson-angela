import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import { App } from './App'
import { queryClient } from './lib/queryClient'
import { isSupabaseConfigured } from './lib/env'
import { AuthProvider } from './features/auth/AuthProvider'
import { ConfirmProvider } from './components/ui/Confirm'
import { SetupRequired } from './components/layout/SetupRequired'

// Los enlaces de invitación y de "olvidé mi contraseña" de Supabase llegan con
// #...&type=invite|recovery: se abren en la pantalla para elegir contraseña.
if (/[#&]type=(invite|recovery)\b/.test(window.location.hash) && window.location.pathname !== '/nueva-contrasena') {
  window.history.replaceState(null, '', `/nueva-contrasena${window.location.hash}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <SetupRequired />
    )}
    <Toaster position="top-center" richColors closeButton />
  </StrictMode>,
)
