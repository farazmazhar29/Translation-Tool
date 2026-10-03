import * as auth from '@/features/auth/i18n'
import * as glossary from '@/features/glossary/i18n'
import * as projects from '@/features/projects/i18n'
import * as settings from '@/features/settings/i18n'
import * as users from '@/features/users/i18n'
import { setupI18n } from '@/shared/i18n'
import * as common from '@/shared/i18n/common'

/** Every text of the app by language and namespace. A feature adds its own namespace here. */
const resources = {
  de: {
    common: common.de,
    auth: auth.de,
    glossary: glossary.de,
    projects: projects.de,
    settings: settings.de,
    users: users.de,
  },
  en: {
    common: common.en,
    auth: auth.en,
    glossary: glossary.en,
    projects: projects.en,
    settings: settings.en,
    users: users.en,
  },
}

setupI18n(resources)

/** Typed keys: `t('common:save')` compiles, a typo does not. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof resources.de
  }
}
