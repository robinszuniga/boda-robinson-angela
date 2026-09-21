import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthShell } from './AuthShell'
import { useAuth } from './AuthProvider'

interface Form {
  password: string
  confirm: string
}

/** Destino del correo de "restablecer contraseña" de Supabase */
export function NewPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>()

  const onSubmit = async ({ password }: Form) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Contraseña actualizada')
    navigate('/', { replace: true })
  }

  return (
    <AuthShell subtitle="Elige una contraseña nueva">
      {!loading && !session ? (
        <p className="text-sm text-muted">
          El enlace expiró o no es válido. Vuelve a la pantalla de inicio y pide otro correo de restablecimiento.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Nueva contraseña" error={errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                {...register('password', {
                  required: 'Escribe una contraseña',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
              />
            )}
          </Field>
          <Field label="Repítela" error={errors.confirm?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                {...register('confirm', {
                  validate: (v, values) => v === values.password || 'No coinciden',
                })}
              />
            )}
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
