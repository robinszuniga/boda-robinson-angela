import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { describeError } from '../../lib/errors'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthShell } from './AuthShell'
import { useAuth } from './AuthProvider'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>()

  if (session) return <Navigate to={from} replace />

  const onSubmit = async (values: LoginForm) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    })
    if (error) setError(describeError(error))
    else navigate(from, { replace: true })
  }

  const resetPassword = async () => {
    const email = getValues('email')?.trim()
    if (!email) {
      setError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    if (error) setError(describeError(error))
    else toast.success('Te enviamos un correo para restablecer la contraseña.')
  }

  return (
    <AuthShell subtitle="Inicia sesión para seguir planeando">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Correo" error={errors.email?.message}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email', { required: 'Escribe tu correo' })}
            />
          )}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password', { required: 'Escribe tu contraseña' })}
            />
          )}
        </Field>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <button type="button" onClick={resetPassword} className="text-sm text-muted underline-offset-2 hover:underline">
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </AuthShell>
  )
}
