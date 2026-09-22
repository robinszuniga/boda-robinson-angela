import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { LoadingState } from './components/ui/Display'
import { RequireAuth } from './features/auth/RequireAuth'
import { LoginPage } from './features/auth/LoginPage'
import { NewPasswordPage } from './features/auth/NewPasswordPage'
import { ROUTER_BASENAME } from './lib/appUrl'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const BudgetPage = lazy(() => import('./features/budget/BudgetPage'))
const VendorsPage = lazy(() => import('./features/vendors/VendorsPage'))
const VendorDetailPage = lazy(() => import('./features/vendors/VendorDetailPage'))
const ComparatorPage = lazy(() => import('./features/comparator/ComparatorPage'))
const GuestsPage = lazy(() => import('./features/guests/GuestsPage'))
const SeatingPage = lazy(() => import('./features/seating/SeatingPage'))
const TasksPage = lazy(() => import('./features/tasks/TasksPage'))
const DaySchedulePage = lazy(() => import('./features/daySchedule/DaySchedulePage'))
const PrintSchedulePage = lazy(() => import('./features/daySchedule/PrintSchedulePage'))
const CoordinatorSheetPage = lazy(() => import('./features/daySchedule/CoordinatorSheetPage'))
const QrSheetPage = lazy(() => import('./features/guests/QrSheetPage'))
const DocumentsPage = lazy(() => import('./features/documents/DocumentsPage'))
const GiftsPage = lazy(() => import('./features/gifts/GiftsPage'))
const ThanksPage = lazy(() => import('./features/thanks/ThanksPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))
const PublicRsvpPage = lazy(() => import('./features/rsvp/PublicRsvpPage'))
const NotFoundPage = lazy(() => import('./features/NotFoundPage'))

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/nueva-contrasena" element={<NewPasswordPage />} />
        <Route path="/rsvp/:token" element={<Page><PublicRsvpPage /></Page>} />

        <Route element={<RequireAuth />}>
          <Route path="/cronograma/imprimir" element={<Page><PrintSchedulePage /></Page>} />
          <Route path="/cronograma/coordinador" element={<Page><CoordinatorSheetPage /></Page>} />
          <Route path="/invitados/qr" element={<Page><QrSheetPage /></Page>} />
          <Route element={<AppLayout />}>
            <Route index element={<Page><DashboardPage /></Page>} />
            <Route path="presupuesto" element={<Page><BudgetPage /></Page>} />
            <Route path="proveedores" element={<Page><VendorsPage /></Page>} />
            <Route path="proveedores/:id" element={<Page><VendorDetailPage /></Page>} />
            <Route path="comparador" element={<Page><ComparatorPage /></Page>} />
            <Route path="invitados" element={<Page><GuestsPage /></Page>} />
            <Route path="mesas" element={<Page><SeatingPage /></Page>} />
            <Route path="tareas" element={<Page><TasksPage /></Page>} />
            <Route path="cronograma" element={<Page><DaySchedulePage /></Page>} />
            <Route path="documentos" element={<Page><DocumentsPage /></Page>} />
            <Route path="regalos" element={<Page><GiftsPage /></Page>} />
            <Route path="agradecimientos" element={<Page><ThanksPage /></Page>} />
            <Route path="configuracion" element={<Page><SettingsPage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
