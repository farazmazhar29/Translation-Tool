import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { get, type S } from '@/shared/api/client'
import { TextField } from '@/shared/components/form'
import { Form } from '@/shared/components/layout'
import { useAction, useFields } from '@/shared/lib/hooks'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './auth-context'

const MIN_PASSWORD_LENGTH = 10 // the same rule as in the API

const Register = () => {
  const { t } = useTranslation('auth')
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const { values, set } = useFields({ full_name: '', username: '', password: '', confirm: '' })
  const signUp = useAction(
    () => register({ full_name: values.full_name, username: values.username, password: values.password }), // not `confirm`
    { onSuccess: () => void navigate('/login', { state: { registered: true } }) },
  )
  const { data: options } = useQuery({
    queryKey: ['auth-options'],
    queryFn: () => get<S['AuthOptions']>('/auth/options'),
  })
  if (user) return <Navigate to="/" replace />
  const tooShort = values.password.length > 0 && values.password.length < MIN_PASSWORD_LENGTH
  const mismatch = values.confirm.length > 0 && values.confirm !== values.password
  const complete =
    values.username.length >= 3 && values.password.length >= MIN_PASSWORD_LENGTH && values.confirm === values.password
  return (
    <AuthLayout title={t('registerTitle')} subtitle={t('registerSubtitle')}>
      {options && !options.registration_enabled ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('registrationClosed')}</p>
      ) : (
        <Form
          onSubmit={() => {
            signUp.mutate()
          }}
          submitLabel={t('createAccount')}
          submitClassName="w-full !py-3"
          disabled={!complete || signUp.isPending}
          error={signUp.error}
          className="space-y-5"
        >
          <TextField
            label={t('fullName')}
            autoComplete="name"
            maxLength={100}
            value={values.full_name}
            onChange={set('full_name')}
          />
          <div>
            <TextField
              label={t('username')}
              autoComplete="username"
              maxLength={50}
              value={values.username}
              onChange={set('username')}
            />
            <p className="mt-1.5 text-xs text-stone-600">{t('usernameHint')}</p>
          </div>
          <div>
            <TextField
              label={t('password')}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={set('password')}
            />
            <p className={`mt-1.5 text-xs ${tooShort ? 'text-red-700' : 'text-stone-600'}`}>
              {t('passwordHint', { count: MIN_PASSWORD_LENGTH })}
            </p>
          </div>
          <div>
            <TextField
              label={t('confirmPassword')}
              type="password"
              autoComplete="new-password"
              value={values.confirm}
              onChange={set('confirm')}
            />
            {mismatch && <p className="mt-1.5 text-xs text-red-700">{t('passwordMismatch')}</p>}
          </div>
        </Form>
      )}
      <p className="mt-8 text-center text-sm text-stone-600">
        {t('haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand-dark hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default Register
