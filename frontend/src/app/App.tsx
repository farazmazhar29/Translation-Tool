import { lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { can, type Role } from '@/shared/api/client'
import { Login, useAuth } from '@/features/auth'
import { LanguageSwitch } from '@/shared/components/LanguageSwitch'
import { Loading } from '@/shared/components/layout'
import { NAV } from './constants'

/** A page that is downloaded when it is first opened, so the first load only contains the login and the shell. */
const lazyPage = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] })))

const Dashboard = lazyPage(() => import('@/features/projects'), 'Dashboard')
const Projects = lazyPage(() => import('@/features/projects'), 'Projects')
const NewProject = lazyPage(() => import('@/features/projects'), 'NewProject')
const ProjectView = lazyPage(() => import('@/features/projects'), 'ProjectView')
const Glossary = lazyPage(() => import('@/features/glossary'), 'Glossary')
const Users = lazyPage(() => import('@/features/users'), 'Users')
const Settings = lazyPage(() => import('@/features/settings'), 'Settings')

const Layout = () => {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (loading) return <p className="p-8 text-slate-600">{t('loading')}</p>
  if (!user) return <Navigate to="/login" replace />
  const link = ({ isActive }: { isActive: boolean }): string =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'}`
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <span className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-3 w-3 rounded-full bg-red-700" /> {t('appName')}
          </span>
          <button
            type="button"
            className="ml-auto md:hidden"
            aria-label={t('menu')}
            onClick={() => {
              setOpen(!open)
            }}
          >
            ☰
          </button>
          <nav
            className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 border-b bg-white p-3 md:static md:flex md:flex-row md:border-0 md:p-0`}
          >
            {NAV.filter((n) => can(user, n.min)).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={link}
                onClick={() => {
                  setOpen(false)
                }}
              >
                {t(`nav.${n.key}`)}
              </NavLink>
            ))}
            <span className="flex items-center gap-2 md:ml-auto">
              <span className="text-xs text-slate-600">
                {user.full_name || user.username} · {t(`role.${user.role}`)}
              </span>
              <LanguageSwitch />
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-red-700"
                onClick={() => {
                  logout()
                  void navigate('/login')
                }}
              >
                {t('logout')}
              </button>
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

const Guard = ({ min, children }: { min: Role; children: ReactNode }) => {
  const { user } = useAuth()
  return can(user, min) ? children : <Navigate to="/" replace />
}

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="glossary" element={<Glossary />} />
        <Route
          path="users"
          element={
            <Guard min="admin">
              <Users />
            </Guard>
          }
        />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
