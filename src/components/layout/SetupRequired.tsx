import { Database } from 'lucide-react'

const steps = [
  <>
    Crea un proyecto gratis en <strong>supabase.com</strong> (región São Paulo, la más cercana a Colombia).
  </>,
  <>
    En <strong>SQL Editor</strong> pega el contenido de <code>supabase/setup.sql</code>, cambia los dos correos del
    final y dale <strong>Run</strong>.
  </>,
  <>
    En <strong>Authentication → Users</strong> crea los dos usuarios (con “Auto Confirm User”) y en{' '}
    <strong>Authentication → Sign In / Providers</strong> desactiva “Allow new users to sign up”.
  </>,
  <>
    Copia <code>.env.example</code> como <code>.env.local</code> y pega la <strong>Project URL</strong> y la{' '}
    <strong>anon / publishable key</strong> (Project Settings → API).
  </>,
  <>
    Reinicia <code>npm run dev</code>.
  </>,
]

export function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Database className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Configura Supabase</h1>
            <p className="text-sm text-muted">Falta conectar la base de datos para empezar.</p>
          </div>
        </div>
        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="[&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:text-[0.85em]">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-muted">La guía completa está en el README del proyecto.</p>
      </div>
    </div>
  )
}
