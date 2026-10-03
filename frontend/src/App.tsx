import { useState, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { can, type Role } from './api/client'
import { useAuth } from './auth-context'
import Dashboard from './pages/Dashboard'
import Glossary from './pages/Glossary'
import Login from './pages/Login'
import NewProject from './pages/NewProject'
import ProjectView from './pages/ProjectView'
import Projects from './pages/Projects'
import Settings from './pages/Settings'
import Users from './pages/Users'

const NAV: { to: string; label: string; min: Role }[] = [
  { to: '/', label: 'Dashboard', min: 'translator' },
  { to: '/projects', label: 'Projekte', min: 'translator' },
  { to: '/glossary', label: 'Glossar', min: 'translator' },
  { to: '/users', label: 'Benutzer', min: 'admin' },
  { to: '/settings', label: 'Einstellungen', min: 'translator' },
]

function Layout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (loading) return <p className="p-8 text-slate-600">Laden …</p>
  if (!user) return <Navigate to="/login" replace />
  const link = ({ isActive }: { isActive: boolean }): string =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'}`
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <span className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-3 w-3 rounded-full bg-red-700" /> Rotpunkt Übersetzung
          </span>
          <button
            type="button"
            className="ml-auto md:hidden"
            aria-label="Menü"
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
                {n.label}
              </NavLink>
            ))}
            <span className="flex items-center gap-2 md:ml-auto">
              <span className="text-xs text-slate-600">
                {user.full_name || user.username} · {user.role}
              </span>
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-red-700"
                onClick={() => {
                  logout()
                  void navigate('/login')
                }}
              >
                Abmelden
              </button>
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <Outlet />
      </main>
    </div>
  )
}

const Guard = ({ min, children }: { min: Role; children: ReactNode }) => {
  const { user } = useAuth()
  return can(user, min) ? children : <Navigate to="/" replace />
}

export default function App() {
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
