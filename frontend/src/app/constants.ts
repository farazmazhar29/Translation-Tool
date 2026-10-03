import type { Role } from '@/shared/api/client'

/** Navigation entries (`key` selects the translated label `common:nav.<key>`) and the lowest role that sees them. */
export const NAV = [
  { to: '/', key: 'dashboard', min: 'translator' },
  { to: '/projects', key: 'projects', min: 'translator' },
  { to: '/glossary', key: 'glossary', min: 'translator' },
  { to: '/users', key: 'users', min: 'admin' },
  { to: '/settings', key: 'settings', min: 'translator' },
] as const satisfies readonly { to: string; key: string; min: Role }[]
