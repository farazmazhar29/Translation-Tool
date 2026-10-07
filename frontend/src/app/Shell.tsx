import { BookOpen, FolderOpen, LayoutDashboard, LogOut, Menu, Settings, Users, X, type LucideIcon } from 'lucide-react'
import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { can } from '@/shared/api/client'
import { Loading } from '@/shared/components/layout'
import { LanguageSwitch } from '@/shared/components/LanguageSwitch'
import { NAV } from './constants'

const ICONS: Record<(typeof NAV)[number]['key'], LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderOpen,
  glossary: BookOpen,
  users: Users,
  settings: Settings,
}

/** The red dot of the Rotpunkt logo, with the product name below. */
const Brand = () => {
  const { t } = useTranslation()
  return (
    <NavLink to="/" aria-label={t('appName')} className="flex items-center gap-3 rounded-full">
      <span className="size-9 rounded-full bg-brand" aria-hidden="true" />
      <span className="leading-none" aria-hidden="true">
        <span className="block text-xl font-bold tracking-tight">Rotpunkt</span>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.32em] text-stone-600">
          {t('brandProduct')}
        </span>
      </span>
    </NavLink>
  )
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Navigation on the left (a drawer on phones), the page on the right. */
export const Shell = () => {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  const name = user.full_name || user.username
  const link = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-soft text-brand-dark' : 'text-stone-600 hover:bg-stone-100 hover:text-ink'}`
  return (
    <div className="min-h-screen md:grid md:grid-cols-[17rem_1fr]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          aria-label={t('menu')}
          aria-expanded={open}
          className="grid size-11 place-items-center rounded-full bg-stone-100 text-brand transition hover:bg-stone-200"
          onClick={() => {
            setOpen(true)
          }}
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
          onClick={() => {
            setOpen(false)
          }}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-8 border-r border-line bg-white p-6 transition-transform md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0 ${open ? 'translate-x-0' : 'invisible -translate-x-full md:visible'}`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            aria-label={t('close')}
            className="grid size-9 place-items-center rounded-full text-stone-600 hover:bg-stone-100 md:hidden"
            onClick={() => {
              setOpen(false)
            }}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={t('menu')} className="flex flex-col gap-1">
          {NAV.filter((n) => can(user, n.min)).map((n) => {
            const Icon = ICONS[n.key]
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={link}
                onClick={() => {
                  setOpen(false)
                }}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(`nav.${n.key}`)}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-4 border-t border-line pt-5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-bold text-stone-700"
              aria-hidden="true"
            >
              {initials(name)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-stone-600">{t(`role.${user.role}`)}</p>
            </div>
          </div>
          <LanguageSwitch />
          <button
            type="button"
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-brand"
            onClick={() => {
              logout()
              void navigate('/login')
            }}
          >
            <LogOut className="size-5" aria-hidden="true" />
            {t('logout')}
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-[100rem] px-4 py-8 md:px-10 md:py-10">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
