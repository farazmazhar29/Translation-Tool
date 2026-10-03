import type { Texts } from '@/shared/i18n'
import type { de } from './de'

export const en: Texts<typeof de> = {
  title: 'User management',
  editUser: 'Edit user',
  newUser: 'New user',
  addUser: '+ User',
  username: 'Username',
  name: 'Name',
  passwordNew: 'New password (empty = unchanged)',
  passwordRequired: 'Password (min. 10 characters)',
  role: 'Role',
  active: 'Active',
  user: 'User',
  rights:
    'Permissions: translators create, translate and edit · reviewers check and approve · administrators manage users, glossary, settings and permissions.',
}
