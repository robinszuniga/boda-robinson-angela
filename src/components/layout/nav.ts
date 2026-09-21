import {
  Armchair,
  Clock,
  FolderOpen,
  Gift,
  HandHeart,
  LayoutDashboard,
  ListChecks,
  Scale,
  Settings,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  title?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  { items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard }] },
  {
    title: 'Planeación',
    items: [
      { to: '/presupuesto', label: 'Presupuesto', icon: Wallet },
      { to: '/proveedores', label: 'Proveedores', icon: Store },
      { to: '/comparador', label: 'Comparador', icon: Scale },
    ],
  },
  {
    title: 'Invitados',
    items: [
      { to: '/invitados', label: 'Invitados y RSVP', icon: Users },
      { to: '/mesas', label: 'Mesas', icon: Armchair },
    ],
  },
  {
    title: 'Organización',
    items: [
      { to: '/tareas', label: 'Tareas', icon: ListChecks },
      { to: '/cronograma', label: 'Cronograma del día', icon: Clock },
      { to: '/documentos', label: 'Documentos', icon: FolderOpen },
    ],
  },
  {
    title: 'Regalos',
    items: [
      { to: '/regalos', label: 'Mesa de regalos', icon: Gift },
      { to: '/agradecimientos', label: 'Agradecimientos', icon: HandHeart },
    ],
  },
  { items: [{ to: '/configuracion', label: 'Configuración', icon: Settings }] },
]

/** Accesos de la barra inferior en móvil */
export const mobilePrimary: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/presupuesto', label: 'Presupuesto', icon: Wallet },
  { to: '/invitados', label: 'Invitados', icon: Users },
  { to: '/tareas', label: 'Tareas', icon: ListChecks },
]
