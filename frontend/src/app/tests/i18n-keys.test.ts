import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { de as auth } from '@/features/auth/i18n/de'
import { de as glossary } from '@/features/glossary/i18n/de'
import { de as projects } from '@/features/projects/i18n/de'
import { de as settings } from '@/features/settings/i18n/de'
import { de as users } from '@/features/users/i18n/de'
import { de as common } from '@/shared/i18n/common/de'

/** `{ a: { b: 'x' } }` → `['a.b']`; plural forms (`n_one`, `n_other`) count as the key `n`. */
const flatten = (texts: object, prefix = ''): string[] =>
  Object.entries(texts).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key.replace(/_(one|other)$/, '')}`],
  )

// Plain file reads, not `import.meta.glob`: loading sources through Vite would hide them from the coverage report.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  )

const SKIPPED = ['/i18n/', '/testing/', '/tests/', 'schema.d.ts'] // texts, tests and generated code do not use keys

const source = files(join(process.cwd(), 'src'))
  .map((path) => path.replaceAll(sep, '/'))
  .filter((path) => /[.]tsx?$/.test(path) && !SKIPPED.some((part) => path.includes(part)))
  .map((path) => readFileSync(path, 'utf-8'))
  .join(' ')

/** A key is used when its full name appears as a string, or when code builds it (`status.${s}`). */
const isUsed = (key: string): boolean => {
  const name = (path: string): string => path.replaceAll('.', '[.]')
  const parents = key.split('.').slice(0, -1)
  const literal = new RegExp(`['"` + '`' + `:]${name(key)}['"` + '`' + `]`)
  const built = new RegExp(`['"` + '`' + `:]${name(parents.join('.'))}[.][$][{]`)
  return literal.test(source) || (parents.length > 0 && built.test(source))
}

describe('translation files', () => {
  it.each(Object.entries({ common, auth, glossary, projects, settings, users }))(
    'namespace %s has no key that no code uses',
    (_name, texts) => {
      expect(flatten(texts).filter((key) => !isUsed(key))).toEqual([])
    },
  )
})
