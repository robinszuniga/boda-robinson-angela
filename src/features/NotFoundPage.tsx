import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Display'

export default function NotFoundPage() {
  return (
    <EmptyState title="Esta página no existe" action={<ButtonLink to="/">Ir al inicio</ButtonLink>}>
      Revisa el enlace o vuelve al inicio.
    </EmptyState>
  )
}
