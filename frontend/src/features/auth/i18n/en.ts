import type { Texts } from '@/shared/i18n'
import type { de } from './de'

export const en: Texts<typeof de> = {
  title: 'Welcome back',
  subtitle: 'Sign in to continue with your translations.',
  tagline: 'Technical translations in your kitchen language.',
  pitch: 'Upload, review, approve – with your glossary and fully traceable.',
  point1: 'Translation with your glossary',
  point2: 'Quality check before approval',
  point3: 'Every approval is saved',
  footer: 'Rotpunkt Küchen · Translation tool',
  signIn: 'Sign in',
  username: 'Username',
  password: 'Password',
  registered: 'Your account has been created. Please sign in with your credentials.',
  or: 'or',
  createAccount: 'Create account',
  registerTitle: 'Create your account',
  registerSubtitle: 'Sign up to translate documents. New accounts start as translators.',
  fullName: 'Full name',
  usernameHint: '3–50 characters: letters, digits, dot, underscore and hyphen.',
  passwordHint: 'At least {{count}} characters.',
  confirmPassword: 'Repeat password',
  passwordMismatch: 'The passwords do not match.',
  haveAccount: 'Already have an account?',
  registrationClosed: 'Registration is currently disabled. Please contact an administrator.',
}
