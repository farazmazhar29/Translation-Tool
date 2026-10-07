import type { Texts } from '@/shared/i18n'
import type { de } from './de'

export const en: Texts<typeof de> = {
  title: 'User management',
  editUser: 'Edit user',
  newUser: 'New user',
  addUser: 'Add user',
  activeYes: 'Active',
  activeNo: 'Inactive',
  username: 'Username',
  name: 'Name',
  passwordNew: 'New password (empty = unchanged)',
  passwordRequired: 'Password (min. 10 characters)',
  role: 'Role',
  active: 'Active',
  user: 'User',
  deleteTitle: 'Delete user?',
  confirmDelete:
    '“{{name}}” will be deleted. Projects, approvals and exports keep the name, and the username is never given to anyone else.',
  rights:
    'Permissions: translators create, translate and edit · reviewers check and approve · administrators manage users, glossary, settings and permissions.',
}
