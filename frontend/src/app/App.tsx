import { lazy, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { can, type Role } from '@/shared/api/client'
import { Login, Register, useAuth } from '@/features/auth'
import { Shell } from './Shell'

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

const Guard = ({ min, children }: { min: Role; children: ReactNode }) => {
  const { user } = useAuth()
  return can(user, min) ? children : <Navigate to="/" replace />
}

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Shell />}>
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
