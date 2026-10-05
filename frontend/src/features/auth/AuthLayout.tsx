import { BookOpen, History, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '@/shared/components/LanguageSwitch'

const POINTS: { icon: LucideIcon; key: 'point1' | 'point2' | 'point3' }[] = [
  { icon: BookOpen, key: 'point1' },
  { icon: ShieldCheck, key: 'point2' },
  { icon: History, key: 'point3' },
]

/** The frame of the sign-in and registration pages: brand panel on the left, the form on the right. */
export const AuthLayout = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => {
  const { t } = useTranslation('auth')
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-night p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-full bg-brand" aria-hidden="true" />
          <span className="text-2xl font-bold tracking-tight">Rotpunkt</span>
        </div>
        <div className="relative z-10 max-w-lg">
          <h2 className="text-5xl font-light leading-tight tracking-tight">{t('tagline')}</h2>
          <p className="mt-5 text-lg text-white/70">{t('pitch')}</p>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-4 text-white/85">
                <span className="grid size-10 place-items-center rounded-full bg-white/10" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <span
          className="pointer-events-none absolute -bottom-32 -right-32 size-[26rem] rounded-full bg-brand/90"
          aria-hidden="true"
        />
        <span className="relative z-10 text-sm text-white/50">{t('footer')}</span>
      </aside>
      <main className="relative grid place-items-center p-6">
        <div className="absolute right-6 top-6">
          <LanguageSwitch />
        </div>
        <div className="w-full max-w-sm py-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="size-9 rounded-full bg-brand" aria-hidden="true" />
            <span className="text-xl font-bold tracking-tight">Rotpunkt</span>
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-stone-600">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
